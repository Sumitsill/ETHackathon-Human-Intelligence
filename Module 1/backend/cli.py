import os
import sys
import uuid
import json
import logging
from datetime import datetime
from pathlib import Path

# Set up clean logging to console (warnings/errors only to avoid cluttering menu output)
logging.basicConfig(level=logging.WARNING, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("pipeline_cli")

# Add current folder to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import config
import database
import parser_service
import vector_service
import gemini_service
import gmail_service

# Initialize DB on start
database.init_db()

def print_banner():
    print("\n" + "=" * 70)
    print("    🔥 UNIVERSAL INGESTION & KNOWLEDGE GRAPH OPERATIONS CONSOLE 🔥")
    print("=" * 70)

def show_stats():
    conn = database.get_db_connection()
    doc_count = conn.execute("SELECT count(*) FROM documents").fetchone()[0]
    node_count = conn.execute("SELECT count(*) FROM nodes").fetchone()[0]
    edge_count = conn.execute("SELECT count(*) FROM edges").fetchone()[0]
    chunk_count = conn.execute("SELECT count(*) FROM chunks").fetchone()[0]
    query_count = conn.execute("SELECT count(*) FROM queries").fetchone()[0]
    conn.close()
    
    print("\n📊 DATABASE METRICS & STATISTICS:")
    print(f"  - Total Documents Ingested : {doc_count}")
    print(f"  - Total Text Chunks Indexed: {chunk_count}")
    print(f"  - Knowledge Graph Nodes    : {node_count}")
    print(f"  - Knowledge Graph Edges    : {edge_count}")
    print(f"  - Grounded Queries Logged  : {query_count}")

def list_ready_documents():
    docs = database.list_documents()
    ready_docs = [d for d in docs if d["status"] == "Ready"]
    if not ready_docs:
        print("  (No Ready documents in DB. Ingest a file first.)")
        return []
    
    print("\n📄 READY DOCUMENTS IN QUEUE:")
    for idx, d in enumerate(ready_docs):
        print(f"  [{idx + 1}] {d['filename']} (ID: {d['id']}, Type: {d['source_type'].upper()})")
    return ready_docs

def handle_ingestion():
    print("\n📥 INGEST LOCAL DOCUMENT:")
    file_path_str = input("  Enter absolute or relative path to file: ").strip()
    if not file_path_str:
        print("❌ Canceled.")
        return
    
    file_path = Path(file_path_str)
    if not file_path.exists():
        print(f"❌ File not found at: {file_path.resolve()}")
        return
        
    filename = file_path.name
    ext = file_path.suffix.lower()
    
    if ext == ".pdf":
        source_type = "pdf"
    elif ext in [".png", ".jpg", ".jpeg", ".webp"]:
        source_type = "image"
    elif ext in [".xlsx", ".xls", ".csv"]:
        source_type = "xlsx"
    else:
        print("❌ Unsupported format. Please load PDF, PNG/JPG, or Excel/CSV.")
        return
        
    doc_id = f"doc_{uuid.uuid4().hex[:10]}"
    print(f"\n1. Registering document as '{filename}' (ID: {doc_id})...")
    database.add_document(doc_id=doc_id, source_type=source_type, filename=filename, raw_path=str(file_path.resolve()))
    
    # Run pipeline synchronously in terminal
    try:
        # Step 1: Read and OCR
        print("2. Reading document content & generating embeddings index...")
        extracted_content = ""
        
        if source_type == "pdf":
            pages = parser_service.parse_pdf(str(file_path))
            ocr_pages = [p["page"] for p in pages if p["ocr_required"]]
            
            if ocr_pages:
                print(f"   [Scan Detected] Running OCR fallbacks on pages {ocr_pages}...")
                ocr_text = gemini_service.read_scanned_pdf_with_gemini(str(file_path), ocr_pages)
                
                # Merge OCR text
                ocr_sections = ocr_text.split("--- PAGE ")
                ocr_map = {}
                for sec in ocr_sections:
                    if not sec.strip():
                        continue
                    parts = sec.strip().split("---\n", 1)
                    if len(parts) == 2:
                        try:
                            p_num = int(parts[0].split()[0])
                            ocr_map[p_num] = parts[1]
                        except:
                            pass
                for p in pages:
                    if p["page"] in ocr_map:
                        p["text"] = ocr_map[p["page"]]
                        
            for p in pages:
                extracted_content += f"--- PAGE {p['page']} ---\n{p['text']}\n\n"
                if p["text"]:
                    vector_service.index_document_text(doc_id, p["text"], page_or_ref=f"Page {p['page']}")
                    
        elif source_type == "image":
            extracted_content = gemini_service.read_image_with_gemini(str(file_path))
            if extracted_content:
                vector_service.index_document_text(doc_id, extracted_content, page_or_ref="Image Content")
                
        elif source_type == "xlsx":
            sheets = parser_service.parse_excel(str(file_path))
            for sheet_name, sheet_data in sheets.items():
                markdown_tbl = sheet_data["markdown_content"]
                extracted_content += f"--- SHEET {sheet_name} ---\n{markdown_tbl}\n\n"
                vector_service.index_document_text(doc_id, markdown_tbl, page_or_ref=f"Sheet {sheet_name}")
                
        if not extracted_content.strip():
            raise ValueError("No text could be extracted.")
            
        # Step 2: Entity extraction
        print("3. Extracting entities and relationships using Llama-3.3-70b (Groq)...")
        extraction_result = gemini_service.extract_entities_and_relationships(extracted_content, source_type)
        
        # Step 3: Graph construction
        print("4. Saving resolved entities & deduplicating SQLite Knowledge Graph...")
        gemini_service.resolve_and_save_graph(doc_id, extraction_result)
        
        database.update_document_status(doc_id, "Ready")
        print("🎉 Ingestion complete! Document is ready in terminal console.")
        
        # Output summary details
        print(f"\nExtracted {len(extraction_result.entities)} entities:")
        for ent in extraction_result.entities[:8]:
            print(f"  - [{ent.type.upper()}] '{ent.normalized_value}' ({ent.description[:60]}...)")
        if len(extraction_result.entities) > 8:
            print(f"  - ... and {len(extraction_result.entities) - 8} more.")
            
    except Exception as e:
        print(f"❌ Ingestion failed: {e}")
        database.update_document_status(doc_id, "Error", str(e))

def handle_sync_emails():
    print("\n✉️ SYNC ARCHIVES (MOCK INBOX):")
    confirm = input("  Sync simulated emergency emails into processing queue? (y/n): ").strip().lower()
    if confirm != 'y':
        print("❌ Canceled.")
        return
        
    print("1. Pulling email headers & threads from mock repository...")
    emails = gmail_service.fetch_gmail_emails(max_results=5, query="label:INBOX")
    
    print(f"2. Processing {len(emails)} email archives asynchronously in terminal...")
    synced = 0
    for email_item in emails:
        doc_id = f"gmail_{email_item['id']}"
        existing = database.get_document(doc_id)
        if existing:
            continue
            
        filename = f"Email: {email_item['subject']}"
        database.add_document(doc_id=doc_id, source_type="gmail", filename=filename, uploaded_by="gmail_sync")
        
        try:
            email_content = (
                f"Subject: {email_item['subject']}\n"
                f"Sender: {email_item['sender']}\n"
                f"Date: {email_item['date']}\n\n"
                f"Body:\n{email_item['body']}"
            )
            vector_service.index_document_text(doc_id, email_content, page_or_ref="Email Body")
            extraction_result = gemini_service.extract_entities_and_relationships(email_content, "gmail")
            gemini_service.resolve_and_save_graph(doc_id, extraction_result)
            database.update_document_status(doc_id, "Ready")
            synced += 1
            print(f"   ✅ Ingested: '{email_item['subject']}'")
        except Exception as e:
            database.update_document_status(doc_id, "Error", str(e))
            print(f"   ❌ Failed: '{email_item['subject']}' - {e}")
            
    print(f"🎉 Mock sync completed. Processed {synced} new messages.")

def handle_qa():
    print("\n🔍 GROUNDED Q&A AGENT:")
    question = input("  Ask a question: ").strip()
    if not question:
        return
        
    print("\n1. Searching local vector index for relevant text blocks...")
    chunks = vector_service.vector_search(question, top_k=4)
    if not chunks:
        print("⚠️ No matching document text found. Search context is empty.")
        
    print("2. Mapping Knowledge Graph subgraphs & citations...")
    matched_doc_ids = list(set(ch["document_id"] for ch in chunks))
    graph_context = {"nodes": [], "links": []}
    seen_nodes = set()
    for doc_id in matched_doc_ids:
        sub = database.get_subgraph_by_document(doc_id)
        for n in sub.get("nodes", []):
            if n["id"] not in seen_nodes:
                seen_nodes.add(n["id"])
                graph_context["nodes"].append(n)
        for l in sub.get("links", []):
            graph_context["links"].append(l)
            
    print("3. Generating grounded answer from Groq Llama-3.3-70b...")
    res = gemini_service.generate_grounded_answer(question, chunks, graph_context)
    
    # Save Query History
    query_id = f"q_{uuid.uuid4().hex[:10]}"
    sources_formatted = [{"filename": c.source_filename, "ref": c.page_or_ref} for c in res.citations]
    database.add_query(
        query_id=query_id,
        question=question,
        answer=res.answer,
        sources=sources_formatted,
        confidence=res.confidence
    )
    
    # Save markdown output file
    try:
        q_file = config.QUERIES_DIR / f"{query_id}.md"
        citations_str = "\n".join([f"- **{c['filename']}** (Location: *{c['ref']}*)" for c in sources_formatted])
        md_content = (
            f"# Grounded Q&A Session\n\n"
            f"**Query ID**: `{query_id}`  \n"
            f"**Timestamp**: `{datetime.now().isoformat()}`  \n"
            f"**Confidence Level**: `{res.confidence * 100:.1f}%`  \n\n"
            f"--- \n\n"
            f"## Question\n"
            f"> {question}\n\n"
            f"## Grounded Answer\n"
            f"{res.answer}\n\n"
            f"## Source Citations\n"
            f"{citations_str if sources_formatted else '*No citations retrieved.*'}\n"
        )
        with open(q_file, "w", encoding="utf-8") as f:
            f.write(md_content)
    except Exception as e:
        logger.error(f"Failed to write query output file: {e}")
        
    print("\n" + "-" * 70)
    print(f"🤖 GROUNDED ANSWER (Confidence: {res.confidence*100:.1f}%):")
    print(res.answer)
    print("-" * 70)
    print("📚 SOURCE CITATIONS:")
    if res.citations:
        for idx, cit in enumerate(res.citations):
            print(f"  [{idx + 1}] {cit.source_filename} ({cit.page_or_ref}) -> '{cit.matched_text}'")
        print(f"💾 Output file written to: {q_file.resolve()}")
    else:
        print("  (No direct document citations found.)")

def handle_mindmap():
    print("\n🧠 GENERATE MINDMAP TREE:")
    topic = input("  Enter node topic or keyword to center mindmap (or press enter for Global): ").strip()
    
    source_id = ""
    topic_name = "Knowledge Graph Overview"
    subgraph = {"nodes": [], "links": []}
    
    if topic:
        source_id = f"node_{topic.lower()}"
        topic_name = topic
        conn = database.get_db_connection()
        row = conn.execute("SELECT id FROM nodes WHERE name LIKE ? LIMIT 1", (f"%{topic}%",)).fetchone()
        conn.close()
        if row:
            subgraph = database.get_subgraph_by_node(row["id"], depth=2)
        else:
            print(f"⚠️ Topic node '{topic}' not found in database. Generating fallback tree...")
            subgraph = {"nodes": [], "links": []}
    else:
        source_id = "global"
        subgraph = database.get_graph()
        
    if not subgraph["nodes"]:
        subgraph = database.get_graph()
        
    print("1. Extracting mindmap hierarchy via Llama-3.3-70b...")
    mindmap_data = gemini_service.generate_mindmap_structure(topic_name, subgraph)
    
    # Save outputs to filesystem
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
    except Exception as e:
        logger.error(f"Failed to write mindmap outputs: {e}")
        
    print("\n" + "-" * 70)
    print(f"🌿 MINDMAP INDENTED OUTLINE FOR: {topic_name.upper()}")
    print("-" * 70)
    
    root_item = mindmap_data.get("root", mindmap_data)
    def print_tree(node, indent=""):
        desc = f" ({node['description']})" if node.get('description') else ""
        print(f"{indent}• {node['name']}{desc}")
        if node.get('children'):
            for child in node['children']:
                print_tree(child, indent + "    ")
                
    print_tree(root_item)
    print("-" * 70)
    print(f"💾 Outline file written to: {m_md_file.resolve()}")
    print(f"💾 JSON tree file written to: {m_json_file.resolve()}")

def handle_flowchart():
    print("\n🌿 GENERATE FLOWCHART WORKFLOW:")
    docs = list_ready_documents()
    if not docs:
        return
        
    sel = input(f"  Select document number (1-{len(docs)}): ").strip()
    try:
        idx = int(sel) - 1
        if idx < 0 or idx >= len(docs):
            raise ValueError()
    except:
        print("❌ Invalid selection.")
        return
        
    selected_doc = docs[idx]
    doc_id = selected_doc["id"]
    
    # Retrieve full text of document from chunks
    conn = database.get_db_connection()
    chunks = conn.execute("SELECT content FROM chunks WHERE document_id = ? ORDER BY id", (doc_id,)).fetchall()
    conn.close()
    
    if not chunks:
        print("❌ No text chunks found for this document.")
        return
        
    full_text = "\n\n".join(ch["content"] for ch in chunks)
    print("1. Examining document structure & compiling Mermaid process steps...")
    mermaid_code = gemini_service.generate_flowchart_mermaid(selected_doc["filename"], full_text)
    
    # Save outputs to filesystem
    try:
        f_file = config.FLOWCHARTS_DIR / f"{doc_id}.mmd"
        md_content = (
            f"%% Mermaid Flowchart: {selected_doc['filename']}\n"
            f"%% Document ID: {doc_id}\n\n"
            f"{mermaid_code}\n"
        )
        with open(f_file, "w", encoding="utf-8") as f:
            f.write(md_content)
    except Exception as e:
        logger.error(f"Failed to write flowchart file: {e}")
        
    print("\n" + "-" * 70)
    print(f"📐 MERMAID FLOWCHART CODE:")
    print("-" * 70)
    print(mermaid_code)
    print("-" * 70)
    print(f"💾 Mermaid flowchart file written to: {f_file.resolve()}")

def run_loop():
    while True:
        print_banner()
        print("  [1] Ingest Local File (PDF, Image/Blueprint, Excel/CSV)")
        print("  [2] Sync Simulated Emails (Mock Inbox)")
        print("  [3] Ask Grounded RAG Question")
        print("  [4] Generate Mindmap Hierarchy Outline")
        print("  [5] Generate Procedural Flowchart Code (Mermaid)")
        print("  [6] Database Statistics & Metrics")
        print("  [7] Exit Console")
        print("-" * 70)
        
        choice = input("👉 Enter choice (1-7): ").strip()
        if choice == "1":
            handle_ingestion()
        elif choice == "2":
            handle_sync_emails()
        elif choice == "3":
            handle_qa()
        elif choice == "4":
            handle_mindmap()
        elif choice == "5":
            handle_flowchart()
        elif choice == "6":
            show_stats()
        elif choice == "7":
            print("\n👋 Exiting console. Goodbye!")
            sys.exit(0)
        else:
            print("❌ Invalid input. Please enter a number between 1 and 7.")
            
        input("\nPress Enter to return to main menu...")

if __name__ == "__main__":
    try:
        run_loop()
    except KeyboardInterrupt:
        print("\n👋 Console interrupted. Exiting.")
        sys.exit(0)
