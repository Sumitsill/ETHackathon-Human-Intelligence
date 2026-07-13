import sqlite3
import numpy as np
import logging
import google.generativeai as genai
from typing import List, Dict, Any, Optional
from database import get_db_connection, add_chunk
from config import GEMINI_API_KEY

logger = logging.getLogger(__name__)

def chunk_text(text: str, chunk_size: int = 800, overlap: int = 150) -> List[str]:
    """
    Split text into chunks of roughly `chunk_size` characters
    with `overlap` character overlap.
    """
    if not text:
        return []
    
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end])
        start += chunk_size - overlap
        
    return chunks

def get_embedding(text: str) -> np.ndarray:
    """
    Calls Gemini embedding model to generate a 768-dimension vector.
    Attempts multiple models with fallback.
    """
    for model_name in ["models/gemini-embedding-001", "models/gemini-embedding-2"]:
        try:
            response = genai.embed_content(
                model=model_name,
                content=text,
                task_type="retrieval_document"
            )
            return np.array(response['embedding'], dtype=np.float32)
        except Exception as e:
            logger.warning(f"Error calling Gemini embedding model {model_name}: {e}")
            
    logger.error("Error: All Gemini embedding models failed to load.")
    # Return a zero vector of size 768 on failure as a fallback
    return np.zeros(768, dtype=np.float32)

def index_document_text(doc_id: str, text: str, page_or_ref: Optional[str] = None):
    """
    Chunks a text block, generates embeddings, and saves them to SQLite.
    """
    chunks = chunk_text(text)
    for i, chunk in enumerate(chunks):
        chunk_id = f"{doc_id}_ch_{page_or_ref or '0'}_{i}"
        emb = get_embedding(chunk)
        emb_bytes = emb.tobytes()
        add_chunk(chunk_id, doc_id, chunk, emb_bytes, page_or_ref)
    logger.info(f"Indexed {len(chunks)} chunks for document {doc_id} (Ref: {page_or_ref}).")

def vector_search(query: str, top_k: int = 5) -> List[Dict[str, Any]]:
    """
    Retrieves the most similar chunks to a query using local cosine similarity.
    """
    # Embed the query
    query_emb = None
    for model_name in ["models/gemini-embedding-001", "models/gemini-embedding-2"]:
        try:
            query_emb_resp = genai.embed_content(
                model=model_name,
                content=query,
                task_type="retrieval_query"
            )
            query_emb = np.array(query_emb_resp['embedding'], dtype=np.float32)
            break
        except Exception as e:
            logger.warning(f"Error calling query embedding for {model_name}: {e}")
            
    if query_emb is None:
        logger.error("Error embedding query: All embedding models failed.")
        return []

    conn = get_db_connection()
    # Fetch all chunks and documents details
    rows = conn.execute("""
        SELECT c.id, c.document_id, c.content, c.embedding, c.page_or_ref, d.filename, d.source_type
        FROM chunks c
        JOIN documents d ON c.document_id = d.id
    """).fetchall()
    conn.close()

    if not rows:
        return []

    # Prepare numpy matrix
    embeddings = []
    chunk_meta = []
    
    for r in rows:
        emb = np.frombuffer(r['embedding'], dtype=np.float32)
        embeddings.append(emb)
        chunk_meta.append({
            "chunk_id": r['id'],
            "document_id": r['document_id'],
            "content": r['content'],
            "page_or_ref": r['page_or_ref'],
            "filename": r['filename'],
            "source_type": r['source_type']
        })

    emb_matrix = np.array(embeddings, dtype=np.float32) # Shape: (N, 768)
    
    # Calculate cosine similarity
    # similarity = dot(A, B) / (norm(A) * norm(B))
    dot_products = np.dot(emb_matrix, query_emb)
    matrix_norms = np.linalg.norm(emb_matrix, axis=1)
    query_norm = np.linalg.norm(query_emb)
    
    # Avoid division by zero
    norms = matrix_norms * query_norm
    norms[norms == 0] = 1e-9
    
    similarities = dot_products / norms
    
    # Sort and pick top k
    top_indices = np.argsort(similarities)[::-1][:top_k]
    
    results = []
    for idx in top_indices:
        score = float(similarities[idx])
        meta = chunk_meta[idx]
        meta["score"] = score
        results.append(meta)
        
    return results
