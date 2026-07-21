import os
import re
import json
import uuid
import logging
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, UploadFile, File, BackgroundTasks, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import config
import database
import parser_service
import vector_service
import gemini_service
import gmail_service

# Initialize logger
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# Initialize database
database.init_db()

app = FastAPI(
    title="Universal Document Ingestion & Knowledge Graph Agent API",
    description="Backend service for ingestion, entity extraction, local vector indexing, RAG, and diagrams.",
    version="1.0.0"
)

# Configure CORS for local frontend testing
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def verify_api_key(request: Request, call_next):
    if request.url.path not in ["/docs", "/openapi.json", "/redoc", "/api/status", "/status"]:
        api_key = request.headers.get("X-API-Key")
        expected_key = os.getenv("GLOBAL_API_KEY", "et_brain_secure_key_2026_xyz")
        if api_key != expected_key:
            return JSONResponse(status_code=401, content={"detail": "Unauthorized: Invalid X-API-Key"})
    response = await call_next(request)
    return response

# Request Models
class QueryRequest(BaseModel):
    question: str

class MindmapRequest(BaseModel):
    topic: Optional[str] = None
    document_id: Optional[str] = None
    query_id: Optional[str] = None

class FlowchartRequest(BaseModel):
    document_id: str

class GmailSyncRequest(BaseModel):
    query: Optional[str] = "label:INBOX"
    max_results: Optional[int] = 5

class GmailConnectRequest(BaseModel):
    redirect_uri: str

class GmailCallbackRequest(BaseModel):
    code: str
    redirect_uri: str

# Ingestion Pipeline Background Task
async def process_document_pipeline(doc_id: str, file_path: str, filename: str, source_type: str):
    logger.info(f"Starting ingestion pipeline for document {doc_id} ({filename})")
    
    try:
        # Step 1: Reading
        database.update_document_status(doc_id, "Reading")
        
        extracted_content = ""
        
        if source_type == "pdf":
            pages = parser_service.parse_pdf(file_path)
            # Check if ocr/vision is needed for pages
            ocr_pages = [p["page"] for p in pages if p["ocr_required"]]
            
            if ocr_pages:
                logger.info(f"PDF contains scanned pages: {ocr_pages}. Invoking Gemini Multimodal vision OCR.")
                ocr_text = gemini_service.read_scanned_pdf_with_gemini(file_path, ocr_pages)
                
                # Merge OCR text back into pages
                ocr_sections = ocr_text.split("--- PAGE ")
                ocr_map = {}
                for sec in ocr_sections:
                    if not sec.strip():
                        continue
                    # Parse page number
                    match = re.match(r"^(\d+)\s*---\n([\s\S]*)", sec.strip())
                    if match:
                        p_num = int(match.group(1))
                        p_txt = match.group(2)
                        ocr_map[p_num] = p_txt
                
                for p in pages:
                    if p["page"] in ocr_map:
                        p["text"] = ocr_map[p["page"]]
                        
            # Accumulate full text and index vectors
            for p in pages:
                extracted_content += f"--- PAGE {p['page']} ---\n{p['text']}\n\n"
                # Store chunk in vector index immediately to support localized citations
                if p["text"]:
                    vector_service.index_document_text(doc_id, p["text"], page_or_ref=f"Page {p['page']}")
                    
        elif source_type == "image":
            # Direct image vision
            extracted_content = gemini_service.read_image_with_gemini(file_path)
            if extracted_content:
                vector_service.index_document_text(doc_id, extracted_content, page_or_ref="Image Content")
                
        elif source_type == "xlsx":
            sheets = parser_service.parse_excel(file_path)
            for sheet_name, sheet_data in sheets.items():
                markdown_tbl = sheet_data["markdown_content"]
                extracted_content += f"--- SHEET {sheet_name} ---\n{markdown_tbl}\n\n"
                vector_service.index_document_text(doc_id, markdown_tbl, page_or_ref=f"Sheet {sheet_name}")
                
        else:
            raise ValueError(f"Unsupported source type: {source_type}")
            
        if not extracted_content.strip():
            raise ValueError("No text could be extracted from this document.")

        # Step 2: Entity Extraction
        database.update_document_status(doc_id, "Extracting")
        extraction_result = gemini_service.extract_entities_and_relationships(extracted_content, source_type)
        
        # Step 3: Graph Construction
        database.update_document_status(doc_id, "Building")
        gemini_service.resolve_and_save_graph(doc_id, extraction_result)
        
        # Step 4: Complete
        database.update_document_status(doc_id, "Ready")
        logger.info(f"Ingestion pipeline completed successfully for document {doc_id}")
        
    except Exception as e:
        logger.error(f"Ingestion pipeline failed for document {doc_id}: {e}", exc_info=True)
        database.update_document_status(doc_id, "Error", str(e))


# API Endpoints

@app.get("/documents")
async def get_documents():
    """Returns list of all ingested documents."""
    return database.list_documents()

@app.get("/documents/{doc_id}")
async def get_document_details(doc_id: str):
    """Returns details and extracted entities for a document."""
    doc = database.get_document(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    entities = database.get_extracted_entities(doc_id)
    doc["entities"] = entities
    return doc

@app.post("/documents/upload", status_code=201)
@app.post("/upload", status_code=201)
async def upload_document(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    """Uploads a PDF, Excel sheet, or Image file and triggers background processing."""
    filename = file.filename
    ext = os.path.splitext(filename)[1].lower()
    
    # Classify source type
    if ext == ".pdf":
        source_type = "pdf"
    elif ext in [".png", ".jpg", ".jpeg", ".webp"]:
        source_type = "image"
    elif ext in [".xlsx", ".xls", ".csv"]:
        source_type = "xlsx"
    else:
        raise HTTPException(status_code=400, detail="Unsupported file format. Please upload PDF, PNG/JPG, or Excel/CSV.")
        
    doc_id = f"doc_{uuid.uuid4().hex[:10]}"
    file_path = os.path.join(config.UPLOAD_DIR, f"{doc_id}_{filename}")
    
    # Write uploaded file to storage
    try:
        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)
    except Exception as e:
        logger.error(f"Failed to save file: {e}")
        raise HTTPException(status_code=500, detail="Could not save uploaded file.")
        
    # Register document in database
    doc_record = database.add_document(
        doc_id=doc_id,
        source_type=source_type,
        filename=filename,
        raw_path=file_path
    )
    
    # Queue background processing
    background_tasks.add_task(process_document_pipeline, doc_id, file_path, filename, source_type)
    
    return doc_record

@app.get("/documents")
async def get_documents():
    """Returns a list of all documents and their ingestion statuses."""
    return database.list_documents()

@app.get("/documents/{doc_id}/status")
async def get_document_status(doc_id: str):
    """Fetches the processing status of a single document."""
    doc = database.get_document(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")
    return {
        "id": doc["id"],
        "filename": doc["filename"],
        "status": doc["status"],
        "error_message": doc.get("error_message")
    }

@app.get("/documents/{doc_id}/entities")
async def get_document_entities(doc_id: str):
    """Fetches the extracted entities of a single document."""
    doc = database.get_document(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")
    return database.get_extracted_entities(doc_id)

@app.get("/stats")
async def get_database_stats():
    """Fetches key database metrics and statistics."""
    try:
        conn = database.get_db_connection()
        doc_count = conn.execute("SELECT count(*) FROM documents").fetchone()[0]
        node_count = conn.execute("SELECT count(*) FROM nodes").fetchone()[0]
        edge_count = conn.execute("SELECT count(*) FROM edges").fetchone()[0]
        chunk_count = conn.execute("SELECT count(*) FROM chunks").fetchone()[0]
        query_count = conn.execute("SELECT count(*) FROM queries").fetchone()[0]
        conn.close()
        return {
            "documents_count": doc_count,
            "chunks_count": chunk_count,
            "nodes_count": node_count,
            "edges_count": edge_count,
            "queries_count": query_count
        }
    except Exception as e:
        logger.error(f"Failed to fetch database statistics: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

# Gmail Integrations

@app.get("/gmail/status")
async def get_gmail_status():
    """Checks whether the backend is authenticated with Google Gmail API."""
    return {
        "connected": gmail_service.is_gmail_connected(),
        "credentials_configured": os.path.exists(config.GMAIL_CREDENTIALS_PATH)
    }

@app.post("/gmail/connect")
async def connect_gmail(req: GmailConnectRequest):
    """Generates the Gmail OAuth 2.0 Auth URL."""
    auth_url = gmail_service.get_gmail_auth_url(req.redirect_uri)
    if not auth_url:
        return {
            "auth_url": None,
            "message": "Gmail client secrets (credentials.json) not found on backend. Please use Mock Sync option."
        }
    return {"auth_url": auth_url}

@app.post("/gmail/callback")
async def handle_gmail_callback(req: GmailCallbackRequest):
    """Handles OAuth redirect code exchange."""
    success = gmail_service.save_token_from_code(req.code, req.redirect_uri)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to exchange authorization code for access token.")
    return {"status": "success", "message": "Gmail OAuth connection established."}

@app.post("/gmail/disconnect")
async def disconnect_gmail():
    """Logs out and deletes Gmail authentication tokens."""
    gmail_service.disconnect_gmail()
    return {"status": "success", "message": "Gmail disconnected."}

# Background thread process for Gmail email ingestion
async def process_email_ingestion(email_item: Dict[str, Any]):
    doc_id = f"gmail_{email_item['id']}"
    filename = f"Email: {email_item['subject']}"
    
    # Store email metadata as a document record
    database.add_document(
        doc_id=doc_id,
        source_type="gmail",
        filename=filename,
        uploaded_by="gmail_sync"
    )
    
    try:
        database.update_document_status(doc_id, "Reading")
        
        email_content = (
            f"Subject: {email_item['subject']}\n"
            f"Sender: {email_item['sender']}\n"
            f"Date: {email_item['date']}\n\n"
            f"Body:\n{email_item['body']}"
        )
        
        # Save email body as raw vector chunks
        vector_service.index_document_text(doc_id, email_content, page_or_ref="Email Body")
        
        # Entity extraction
        database.update_document_status(doc_id, "Extracting")
        extraction_result = gemini_service.extract_entities_and_relationships(email_content, "gmail")
        
        # Graph construction
        database.update_document_status(doc_id, "Building")
        gemini_service.resolve_and_save_graph(doc_id, extraction_result)
        
        database.update_document_status(doc_id, "Ready")
        
    except Exception as e:
        logger.error(f"Failed to ingest email {doc_id}: {e}", exc_info=True)
        database.update_document_status(doc_id, "Error", str(e))

@app.post("/gmail/sync")
async def sync_gmail(background_tasks: BackgroundTasks, req: GmailSyncRequest):
    """Triggers synchronizing emails from the user's Gmail box."""
    if not gmail_service.is_gmail_connected():
        raise HTTPException(status_code=400, detail="Gmail not connected. Please login first.")
        
    emails = gmail_service.fetch_gmail_emails(max_results=req.max_results, query=req.query)
    
    for email in emails:
        background_tasks.add_task(process_email_ingestion, email)
        
    return {
        "status": "Syncing",
        "synced_count": len(emails),
        "message": f"Queued {len(emails)} emails for ingestion."
    }

@app.post("/gmail/mock-sync")
async def sync_gmail_mock(background_tasks: BackgroundTasks):
    """
    Simulates syncing emails from Gmail without requiring OAuth credentials.
    Highly useful for user evaluations.
    """
    emails = gmail_service.get_default_mock_emails()
    
    for email in emails:
        # Check if already processed to avoid duplicates
        existing = database.get_document(f"gmail_{email['id']}")
        if not existing:
            background_tasks.add_task(process_email_ingestion, email)
            
    return {
        "status": "Syncing",
        "synced_count": len(emails),
        "message": f"Queued {len(emails)} mock emails for ingestion."
    }

# Search and Q&A Endpoints

@app.post("/query")
async def query_documents(req: QueryRequest):
    """
    RAG endpoint that performs vector search + graph retrieval,
    then queries Gemini to return a grounded citation answer.
    """
    question = req.question
    
    # 1. Local Vector Search
    chunks = vector_service.vector_search(question, top_k=5)
    
    # 2. Graph Context Retrieval
    # Pull graph structures from documents matching the top vector search results
    matched_doc_ids = list(set(ch["document_id"] for ch in chunks))
    
    graph_context = {"nodes": [], "links": []}
    seen_nodes = set()
    seen_edges = set()
    
    for doc_id in matched_doc_ids:
        sub = database.get_subgraph_by_document(doc_id)
        for n in sub.get("nodes", []):
            if n["id"] not in seen_nodes:
                seen_nodes.add(n["id"])
                graph_context["nodes"].append(n)
        for l in sub.get("links", []):
            if l["id"] not in seen_edges:
                seen_edges.add(l["id"])
                graph_context["links"].append(l)
                
    # 3. Grounded Generation
    grounded_res = gemini_service.generate_grounded_answer(question, chunks, graph_context)
    
    # 4. Save Query History
    query_id = f"q_{uuid.uuid4().hex[:10]}"
    sources_formatted = [{"filename": c.source_filename, "ref": c.page_or_ref} for c in grounded_res.citations]
    
    database.add_query(
        query_id=query_id,
        question=question,
        answer=grounded_res.answer,
        sources=sources_formatted,
        confidence=grounded_res.confidence
    )
    
    # Write query output markdown file to disk
    try:
        from datetime import datetime
        q_file = config.QUERIES_DIR / f"{query_id}.md"
        citations_str = "\n".join([f"- **{c['filename']}** (Location: *{c['ref']}*)" for c in sources_formatted])
        md_content = (
            f"# Grounded Q&A Session\n\n"
            f"**Query ID**: `{query_id}`  \n"
            f"**Timestamp**: `{datetime.now().isoformat()}`  \n"
            f"**Confidence Level**: `{grounded_res.confidence * 100:.1f}%`  \n\n"
            f"--- \n\n"
            f"## Question\n"
            f"> {question}\n\n"
            f"## Grounded Answer\n"
            f"{grounded_res.answer}\n\n"
            f"## Source Citations\n"
            f"{citations_str if sources_formatted else '*No citations retrieved.*'}\n"
        )
        with open(q_file, "w", encoding="utf-8") as f:
            f.write(md_content)
        logger.info(f"Saved Q&A markdown output to {q_file}")
    except Exception as e:
        logger.error(f"Failed to write query output file: {e}")
        
    return {
        "id": query_id,
        "answer": grounded_res.answer,
        "sources": sources_formatted,
        "confidence": grounded_res.confidence
    }

# Visualization Endpoints

# Helper functions for saving visualization outputs to filesystem

def write_mindmap_files(source_id: str, topic_name: str, mindmap_data: Dict[str, Any]):
    try:
        m_json_file = config.MINDMAPS_DIR / f"{source_id}.json"
        m_md_file = config.MINDMAPS_DIR / f"{source_id}.md"
        
        with open(m_json_file, "w", encoding="utf-8") as f:
            json.dump(mindmap_data, f, indent=2)
            
        def outline_node(node, depth=0):
            lines = [f"{'  ' * depth}- **{node['name']}**" + (f" (*{node['description']}*)" if node.get('description') else "")]
            if node.get('children'):
                for child in node['children']:
                    lines.extend(outline_node(child, depth + 1))
            return lines
            
        root = mindmap_data.get("root", mindmap_data)
        md_lines = [f"# Mindmap Outline: {topic_name}\n\n"] + outline_node(root)
        with open(m_md_file, "w", encoding="utf-8") as f:
            f.write("\n".join(md_lines))
            
        logger.info(f"Saved mindmap outputs to {m_json_file} and {m_md_file}")
    except Exception as e:
        logger.error(f"Failed to write mindmap output file: {e}")

def write_flowchart_file(doc_id: str, filename: str, mermaid_code: str):
    try:
        f_file = config.FLOWCHARTS_DIR / f"{doc_id}.mmd"
        md_content = (
            f"%% Mermaid Flowchart: {filename}\n"
            f"%% Document ID: {doc_id}\n\n"
            f"{mermaid_code}\n"
        )
        with open(f_file, "w", encoding="utf-8") as f:
            f.write(md_content)
        logger.info(f"Saved flowchart output to {f_file}")
    except Exception as e:
        logger.error(f"Failed to write flowchart output file: {e}")

@app.post("/visualize/mindmap")
async def get_mindmap(req: MindmapRequest):
    """
    Generates or retrieves a cached hierarchical mindmap structure.
    Works by selecting relevant subgraphs and prompting Gemini to format as a tree.
    """
    source_id = ""
    topic_name = "Knowledge Graph Overview"
    subgraph = {"nodes": [], "links": []}
    
    # Fetch appropriate subgraph based on request arguments
    if req.document_id:
        source_id = req.document_id
        doc = database.get_document(req.document_id)
        if doc:
            topic_name = doc["filename"]
            subgraph = database.get_subgraph_by_document(req.document_id)
    elif req.topic:
        # Match topic against node name
        source_id = f"node_{req.topic.lower()}"
        topic_name = req.topic
        # Find node ID
        conn = database.get_db_connection()
        row = conn.execute("SELECT id FROM nodes WHERE name LIKE ? LIMIT 1", (f"%{req.topic}%",)).fetchone()
        conn.close()
        if row:
            subgraph = database.get_subgraph_by_node(row["id"], depth=2)
    elif req.query_id:
        source_id = req.query_id
        conn = database.get_db_connection()
        row = conn.execute("SELECT question, answer FROM queries WHERE id = ?", (req.query_id,)).fetchone()
        conn.close()
        if row:
            topic_name = f"Query: {row['question'][:30]}..."
            # For queries, search vector database for related documents and extract subgraph
            chunks = vector_service.vector_search(row['question'], top_k=2)
            matched_doc_ids = list(set(ch["document_id"] for ch in chunks))
            seen_nodes = set()
            for doc_id in matched_doc_ids:
                sub = database.get_subgraph_by_document(doc_id)
                for n in sub.get("nodes", []):
                    if n["id"] not in seen_nodes:
                        seen_nodes.add(n["id"])
                        subgraph["nodes"].append(n)
                for l in sub.get("links", []):
                    subgraph["links"].append(l)
    
    if not source_id:
        # Fallback to the entire graph if no inputs are supplied
        source_id = "global"
        subgraph = database.get_graph()
        
    # Check cache first
    cached = database.get_cached_visualization("mindmap", source_id)
    if cached:
        logger.info(f"Returning cached mindmap for {source_id}")
        data = json.loads(cached["structure_json"])
        # Ensure files are logged to outputs even on cache read
        write_mindmap_files(source_id, topic_name, data)
        return data
        
    # Generate new structure using Gemini
    logger.info(f"Generating new mindmap structure for {topic_name} (ID: {source_id})")
    mindmap_data = gemini_service.generate_mindmap_structure(topic_name, subgraph)
    
    # Save to cache
    database.add_visualization(
        viz_id=f"viz_{uuid.uuid4().hex[:10]}",
        type="mindmap",
        source_id=source_id,
        structure_json=json.dumps(mindmap_data)
    )
    
    # Write mindmap files (both JSON and MD representation) to disk
    write_mindmap_files(source_id, topic_name, mindmap_data)
        
    return mindmap_data

@app.post("/visualize/flowchart")
async def get_flowchart(req: FlowchartRequest):
    """
    Generates a process flowchart in Mermaid.js syntax from a document.
    Enforces check for procedural content and caches the result.
    """
    doc_id = req.document_id
    doc = database.get_document(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")
        
    # Check cache
    cached = database.get_cached_visualization("flowchart", doc_id)
    if cached:
        logger.info(f"Returning cached flowchart for {doc_id}")
        mermaid_code = cached["structure_json"]
        # Ensure file logged on cache read
        write_flowchart_file(doc_id, doc["filename"], mermaid_code)
        return {"mermaid_code": mermaid_code}
        
    # Retrieve full text of document from chunks
    conn = database.get_db_connection()
    chunks = conn.execute("SELECT content FROM chunks WHERE document_id = ? ORDER BY id", (doc_id,)).fetchall()
    conn.close()
    
    if not chunks:
        raise HTTPException(status_code=400, detail="No processed text found for this document. Status might not be Ready.")
        
    full_text = "\n\n".join(ch["content"] for ch in chunks)
    
    # Generate flowchart
    logger.info(f"Generating flowchart for {doc['filename']}")
    mermaid_code = gemini_service.generate_flowchart_mermaid(doc["filename"], full_text)
    
    # Cache result
    database.add_visualization(
        viz_id=f"viz_{uuid.uuid4().hex[:10]}",
        type="flowchart",
        source_id=doc_id,
        structure_json=mermaid_code
    )
    
    # Write flowchart mermaid file to disk
    write_flowchart_file(doc_id, doc["filename"], mermaid_code)
        
    return {"mermaid_code": mermaid_code}

# Graph DB Fetch Endpoints

@app.get("/graph")
async def get_entire_graph():
    """Fetches the complete knowledge graph nodes and connections."""
    return database.get_graph()

@app.get("/graph/document/{doc_id}")
async def get_document_subgraph(doc_id: str):
    """Fetches the subgraph connected to a specific document."""
    return database.get_subgraph_by_document(doc_id)

@app.get("/graph/node/{node_id}")
async def get_node_subgraph(node_id: str, depth: int = Query(default=1, ge=1, le=3)):
    """Fetches a subgraph centered on a specific node up to the given search depth."""
    subgraph = database.get_subgraph_by_node(node_id, depth)
    if not subgraph["nodes"]:
        raise HTTPException(status_code=404, detail=f"Node '{node_id}' not found in the graph.")
    return subgraph

import re # needed in process_document_pipeline for ocr mapping regex
