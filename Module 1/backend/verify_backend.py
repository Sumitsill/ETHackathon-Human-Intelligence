import sys
import os
import json
import logging
from datetime import datetime

# Set up logging to stdout
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# Ensure current folder is in Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    import config
    import database
    import parser_service
    import vector_service
    import gemini_service
    import gmail_service
except ImportError as e:
    logger.error(f"Failed to import core modules: {e}")
    sys.exit(1)

def run_verification():
    logger.info("====================================================")
    logger.info("      STARTING BACKEND VERIFICATION TESTING         ")
    logger.info("====================================================")
    
    # 1. DB Init
    logger.info("1. Initializing SQLite Database (Resetting first)...")
    try:
        if os.path.exists(config.DB_PATH):
            os.remove(config.DB_PATH)
            logger.info("   Removed existing database file to ensure clean test run.")
        database.init_db()
        logger.info("   DB initialized successfully.")
    except Exception as e:
        logger.error(f"   DB Init Failed: {e}")
        return False

    # 2. API Key Check
    logger.info(f"2. Checking Gemini API Key Configuration...")
    if not config.GEMINI_API_KEY:
        logger.error("   Gemini API Key is not set! Set GEMINI_API_KEY in backend/.env file.")
        return False
    logger.info("   Gemini API Key detected.")

    # 3. Test Embedding Call
    logger.info("3. Testing text embedding model ('text-embedding-004')...")
    test_text = "Standard Operating Procedure for Valve V-102 isolation."
    try:
        emb = vector_service.get_embedding(test_text)
        logger.info(f"   Embedding retrieved. Dimensions: {len(emb)}")
        if len(emb) != 768:
            logger.warning(f"   Warning: Expected 768 dimensions, got {len(emb)}")
    except Exception as e:
        logger.error(f"   Embedding API Call Failed: {e}")
        return False

    # 4. Ingest and Process Mock Document (Programmatic Slice)
    logger.info("4. Testing Entity Extraction & Graph Building on mock document content...")
    mock_doc_id = "doc_verify_test_001"
    mock_text = (
        "PROCEDURE: Valve V-102 Isolation and Maintenance.\n"
        "Date: 2026-07-14. Author: John Engineer.\n"
        "1. Turn Valve V-102 clockwise to isolate the downstream piping.\n"
        "2. Keep the inlet pressure below 150 PSI to avoid pressure shocks.\n"
        "3. This procedure complies with standard ASME B31.3 piping regulations.\n"
        "4. Notify Supervisor Dave Miller once isolation is verified."
    )
    
    try:
        # Save document record
        database.add_document(
            doc_id=mock_doc_id,
            source_type="pdf",
            filename="Verify_Test_Procedure.pdf",
            uploaded_by="verifier"
        )
        
        # Index document text
        vector_service.index_document_text(mock_doc_id, mock_text, page_or_ref="Page 1")
        
        # Test extraction
        logger.info("   Calling Gemini structured entity extraction...")
        extraction = gemini_service.extract_entities_and_relationships(mock_text, "pdf")
        
        logger.info(f"   Extracted {len(extraction.entities)} entities and {len(extraction.relationships)} relationships.")
        for ent in extraction.entities:
            logger.info(f"     - Entity: [{ent.type}] Value: '{ent.value}' -> Normalized: '{ent.normalized_value}'")
        for rel in extraction.relationships:
            logger.info(f"     - Relation: {rel.source_value} --({rel.relationship_type})--> {rel.target_value}")
            
        # Resolve and write to graph
        gemini_service.resolve_and_save_graph(mock_doc_id, extraction)
        database.update_document_status(mock_doc_id, "Ready")
        logger.info("   Entity extraction and Graph building complete.")
        
    except Exception as e:
        logger.error(f"   Extraction or Graph Resolution Failed: {e}")
        return False

    # 5. Check Graph Queries
    logger.info("5. Fetching Knowledge Graph representation from SQLite...")
    try:
        graph = database.get_graph()
        logger.info(f"   Graph contains {len(graph['nodes'])} nodes and {len(graph['links'])} edges.")
        if not graph['nodes']:
            logger.error("   Error: Knowledge Graph has 0 nodes after insertion!")
            return False
    except Exception as e:
        logger.error(f"   Graph Fetch Failed: {e}")
        return False

    # 6. Test RAG Q&A
    logger.info("6. Testing Grounded RAG Query endpoint...")
    question = "Who should I notify after isolating Valve V-102 and what is the limit?"
    try:
        # Search vector
        chunks = vector_service.vector_search(question, top_k=2)
        logger.info(f"   Vector search retrieved {len(chunks)} chunks.")
        
        # Fetch subgraph
        subgraph = database.get_subgraph_by_document(mock_doc_id)
        
        # Generate Answer
        grounded_res = gemini_service.generate_grounded_answer(question, chunks, subgraph)
        logger.info(f"   Answer: {grounded_res.answer}")
        logger.info(f"   Citations: {[c.source_filename + ' (' + c.page_or_ref + ')' for c in grounded_res.citations]}")
        logger.info(f"   Confidence Score: {grounded_res.confidence}")
        
    except Exception as e:
        logger.error(f"   RAG Query Failed: {e}")
        return False

    # 7. Test Mindmap & Flowchart Visualizer Generator
    logger.info("7. Testing Mindmap & Flowchart generator...")
    try:
        # Mindmap
        mindmap_data = gemini_service.generate_mindmap_structure("Valve V-102 Isolation", subgraph)
        logger.info(f"   Mindmap root node: {mindmap_data['root']['name']} with {len(mindmap_data['root']['children'])} branches.")
        
        # Flowchart
        flowchart_code = gemini_service.generate_flowchart_mermaid("Verify_Test_Procedure.pdf", mock_text)
        logger.info("   Mermaid Flowchart Code Generated:")
        print(flowchart_code)
        
    except Exception as e:
        logger.error(f"   Visualization Generation Failed: {e}")
        return False

    logger.info("====================================================")
    logger.info("   ALL VERIFICATION TESTS COMPLETED SUCCESSFULLY!    ")
    logger.info("====================================================")
    return True

if __name__ == "__main__":
    success = run_verification()
    sys.exit(0 if success else 1)
