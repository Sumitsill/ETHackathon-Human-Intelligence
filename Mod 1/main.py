import os
import shutil
from typing import Optional
from contextlib import asynccontextmanager
from fastapi import FastAPI, UploadFile, File, Query, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
import config
from watcher import watcher, process_file, read_registry
from graph_db import graph_db
from vector_db import vector_db
from gemini_client import client

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize directories and start folder watcher
    config.WATCHED_DIR.mkdir(parents=True, exist_ok=True)
    config.QDRANT_DIR.mkdir(parents=True, exist_ok=True)
    
    print("Starting background file watcher...")
    watcher.start()
    yield
    # Shutdown: Stop watcher
    print("Stopping background file watcher...")
    watcher.stop()

app = FastAPI(
    title="Universal Document Ingestion & Knowledge Graph API",
    description="Module 1 infrastructure service: ingestion watcher, format router, entity extractor, graph database loader, and vector store indexer.",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for frontend connectivity
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
@app.get("/ui", response_class=HTMLResponse)
def read_root():
    """Serves the interactive knowledge graph console UI."""
    try:
        ui_path = os.path.join(os.path.dirname(__file__), "index.html")
        with open(ui_path, "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"UI file index.html not found: {e}")

@app.post("/upload", status_code=201)
def upload_document(file: UploadFile = File(...)):
    """
    Accepts file upload, saves it to the watched directory, and runs the ingestion
    pipeline synchronously to return the ingestion results immediately.
    """
    filename = file.filename
    # Sanitize name
    if not filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
        
    target_path = config.WATCHED_DIR / filename
    
    try:
        # Write file to watched folder
        with open(target_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        print(f"File uploaded and saved to watched directory: {target_path}")
        
        # Trigger ingestion synchronously for immediate API response
        success = process_file(str(target_path))
        
        if success:
            # Retrieve node relations for quick response
            registry = read_registry()
            # Try to return ingestion report
            return {
                "message": "File uploaded and ingested successfully",
                "filename": filename,
                "saved_path": str(target_path),
                "status": "ingested",
                "registered": str(target_path) in registry
            }
        else:
            raise HTTPException(status_code=500, detail="Ingestion pipeline failed during parsing or loading.")
            
    except Exception as e:
        print(f"Upload and processing failed: {e}")
        # Clean up failed file if it exists
        if target_path.exists():
            try:
                os.remove(target_path)
            except Exception:
                pass
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/scan")
def trigger_manual_scan():
    """Triggers an immediate scan of the watched folder for new or updated files."""
    try:
        watcher.run_initial_scan()
        return {"status": "success", "message": "Manual scan triggered successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/graph")
def get_knowledge_graph():
    """
    Retrieves the parsed knowledge graph.
    Pulls from Neo4j DB directly, or falls back to mock_graph.json if offline.
    """
    if graph_db.use_mock:
        return {
            "source": "local_mock_registry",
            "data": graph_db.get_all_mock_data()
        }
        
    # Query live Neo4j database
    nodes = []
    relationships = []
    try:
        with graph_db.driver.session() as session:
            # Query nodes
            node_result = session.run("MATCH (n) RETURN labels(n)[0] as label, properties(n) as props")
            for record in node_result:
                label = record["label"] or "Unknown"
                nodes.append({
                    "type": label,
                    "properties": record["props"]
                })
                
            # Query relationships
            rel_result = session.run("""
            MATCH (n)-[r]->(m) 
            RETURN labels(n)[0] as from_type, 
                   COALESCE(n.id, n.tag, n.name, 'Unknown') as from_val,
                   type(r) as type, 
                   labels(m)[0] as to_type, 
                   COALESCE(m.id, m.tag, m.name, 'Unknown') as to_val,
                   properties(r) as props
            """)
            for record in rel_result:
                relationships.append({
                    "type": record["type"],
                    "from": {"type": record["from_type"], "val": record["from_val"]},
                    "to": {"type": record["to_type"], "val": record["to_val"]},
                    "properties": record["props"]
                })
                
        return {
            "source": "neo4j_database",
            "data": {
                "nodes": nodes,
                "relationships": relationships
            }
        }
    except Exception as e:
        print(f"Error querying Neo4j: {e}. Falling back to mock data.")
        return {
            "source": "local_mock_registry_fallback",
            "error": str(e),
            "data": graph_db.get_all_mock_data()
        }

@app.get("/search")
def search_vectors(
    query: str = Query(..., description="Query string to match against vector index"),
    limit: int = Query(5, description="Maximum number of chunks to return")
):
    """Searches local Qdrant vector index for semantically relevant chunks."""
    results = vector_db.search_similar_chunks(query, limit)
    return {
        "query": query,
        "results": results
    }

@app.get("/status")
def get_system_status():
    """Diagnostics endpoint showing the status of integrated endpoints."""
    # Check Gemini embedding
    gemini_status = "ok"
    try:
        test_emb = client.generate_embeddings("test")
        if not test_emb or len(test_emb) != 768:
            gemini_status = "invalid_vector_size"
    except Exception:
        gemini_status = "error"

    # Check Qdrant
    qdrant_status = "ok"
    try:
        cols = vector_db.qdrant_client.get_collections().collections
        qdrant_status = f"connected (collections: {[c.name for c in cols]})"
    except Exception as e:
        qdrant_status = f"error: {e}"

    # Check Neo4j
    neo4j_status = "ok"
    if graph_db.use_mock:
        neo4j_status = "mock_active"
    else:
        try:
            graph_db.driver.verify_connectivity()
        except Exception as e:
            neo4j_status = f"offline: {e}"

    # Count items in registry
    registry = read_registry()
    
    return {
        "gemini_api": gemini_status,
        "neo4j_graph": neo4j_status,
        "qdrant_vector": qdrant_status,
        "ingested_files_count": len(registry),
        "watched_directory": str(config.WATCHED_DIR),
        "qdrant_directory": str(config.QDRANT_DIR)
    }

@app.post("/run_tests")
def run_pipeline_tests():
    """Runs the test suite programmatically and returns print log results."""
    import io
    import sys
    from test_pipeline import run_tests as execute_test_suite
    
    # Capture standard print statements
    old_stdout = sys.stdout
    new_stdout = io.StringIO()
    sys.stdout = new_stdout
    
    try:
        execute_test_suite()
        log_output = new_stdout.getvalue()
        return {"status": "success", "logs": log_output}
    except Exception as e:
        log_output = new_stdout.getvalue()
        return {"status": "error", "logs": f"{log_output}\nException during test execution: {e}"}
    finally:
        sys.stdout = old_stdout

@app.post("/reset")
def reset_system():
    """Resets the ingestion registry, watched folder files, Qdrant collection, and mock graph."""
    import os
    try:
        # 1. Reset processed registry
        registry_path = config.BASE_DIR / "processed_registry.json"
        if registry_path.exists():
            os.remove(registry_path)
            
        # 2. Reset mock graph
        if os.path.exists(graph_db.mock_file_path):
            os.remove(graph_db.mock_file_path)
        graph_db._save_mock_graph({"nodes": [], "relationships": []})
        
        # 3. Clean Qdrant collection
        try:
            vector_db.qdrant_client.delete_collection(vector_db.collection_name)
            vector_db._ensure_collection()
        except Exception:
            pass
            
        # 4. Clean watched files
        for filename in os.listdir(config.WATCHED_DIR):
            file_path = config.WATCHED_DIR / filename
            if os.path.isfile(file_path):
                os.remove(file_path)
                
        return {"status": "success", "message": "System database and files reset successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Reset failed: {e}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
