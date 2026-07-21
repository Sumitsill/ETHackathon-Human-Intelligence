import sqlite3
import json
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional
from config import DB_PATH

logger = logging.getLogger(__name__)

def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    # Enable foreign keys
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. Documents table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        source_type TEXT NOT NULL, -- pdf, image, xlsx, gmail
        filename TEXT NOT NULL,
        uploaded_by TEXT,
        uploaded_at TEXT NOT NULL,
        status TEXT NOT NULL, -- Queued, Reading, Extracting, Building, Ready, Error
        raw_storage_path TEXT,
        error_message TEXT
    );
    """)
    
    # 2. Extracted Entities table (flat list of raw extractions)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS extracted_entities (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        entity_type TEXT NOT NULL, -- equipment, parameter, regulation, person, date, fact, other
        value TEXT NOT NULL,
        normalized_value TEXT NOT NULL,
        page_or_ref TEXT,
        confidence REAL,
        description TEXT,
        FOREIGN KEY (document_id) REFERENCES documents (id) ON DELETE CASCADE
    );
    """)
    
    # 3. Knowledge Graph Nodes table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS nodes (
        id TEXT PRIMARY KEY, -- e.g., 'equipment:p-204'
        label TEXT NOT NULL, -- Equipment, Parameter, RegulatoryReference, Person, Document, EmailThread, ExcelRecord
        name TEXT NOT NULL,
        properties TEXT NOT NULL DEFAULT '{}' -- JSON dictionary
    );
    """)
    
    # 4. Knowledge Graph Edges table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS edges (
        id TEXT PRIMARY KEY, -- e.g., 'source_id:target_id:type'
        source_id TEXT NOT NULL,
        target_id TEXT NOT NULL,
        type TEXT NOT NULL, -- MENTIONED_IN, PERFORMED_ON, LINKED_TO, SENT_BY, PART_OF_THREAD, REFERENCES
        properties TEXT NOT NULL DEFAULT '{}', -- JSON dictionary
        FOREIGN KEY (source_id) REFERENCES nodes (id) ON DELETE CASCADE,
        FOREIGN KEY (target_id) REFERENCES nodes (id) ON DELETE CASCADE
    );
    """)
    
    # 5. Join table for Node-to-Document citation tracking
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS node_documents (
        node_id TEXT NOT NULL,
        document_id TEXT NOT NULL,
        PRIMARY KEY (node_id, document_id),
        FOREIGN KEY (node_id) REFERENCES nodes (id) ON DELETE CASCADE,
        FOREIGN KEY (document_id) REFERENCES documents (id) ON DELETE CASCADE
    );
    """)

    # 6. Join table for Edge-to-Document citation tracking
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS edge_documents (
        edge_id TEXT NOT NULL,
        document_id TEXT NOT NULL,
        PRIMARY KEY (edge_id, document_id),
        FOREIGN KEY (edge_id) REFERENCES edges (id) ON DELETE CASCADE,
        FOREIGN KEY (document_id) REFERENCES documents (id) ON DELETE CASCADE
    );
    """)
    
    # 7. Chunks table for local vector search
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS chunks (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        content TEXT NOT NULL,
        embedding BLOB NOT NULL, -- binary serialization of float32 array
        page_or_ref TEXT,
        FOREIGN KEY (document_id) REFERENCES documents (id) ON DELETE CASCADE
    );
    """)
    
    # 8. Queries table (Q&A history)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS queries (
        id TEXT PRIMARY KEY,
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        sources TEXT NOT NULL, -- JSON list of source documents / pages
        confidence REAL,
        created_at TEXT NOT NULL
    );
    """)
    
    # 9. Visualizations table (Mindmaps and Flowcharts cached)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS visualizations (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL, -- mindmap, flowchart
        source_id TEXT NOT NULL, -- can be document_id, query_id, or topic name
        structure_json TEXT NOT NULL, -- JSON payload or Mermaid text
        created_at TEXT NOT NULL
    );
    """)
    
    conn.commit()
    conn.close()
    logger.info("Database initialized successfully.")

# Document operations
def add_document(doc_id: str, source_type: str, filename: str, raw_path: Optional[str] = None, uploaded_by: str = "user") -> Dict[str, Any]:
    conn = get_db_connection()
    cursor = conn.cursor()
    uploaded_at = datetime.utcnow().isoformat()
    cursor.execute(
        "INSERT INTO documents (id, source_type, filename, uploaded_by, uploaded_at, status, raw_storage_path) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (doc_id, source_type, filename, uploaded_by, uploaded_at, "Queued", raw_path)
    )
    conn.commit()
    conn.close()
    return {
        "id": doc_id,
        "source_type": source_type,
        "filename": filename,
        "uploaded_by": uploaded_by,
        "uploaded_at": uploaded_at,
        "status": "Queued"
    }

def update_document_status(doc_id: str, status: str, error_message: Optional[str] = None):
    conn = get_db_connection()
    cursor = conn.cursor()
    if error_message:
        cursor.execute("UPDATE documents SET status = ?, error_message = ? WHERE id = ?", (status, error_message, doc_id))
    else:
        cursor.execute("UPDATE documents SET status = ? WHERE id = ?", (status, doc_id))
    conn.commit()
    conn.close()

def get_document(doc_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    row = conn.execute("SELECT * FROM documents WHERE id = ?", (doc_id,)).fetchone()
    conn.close()
    return dict(row) if row else None

def list_documents() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    rows = conn.execute("SELECT * FROM documents ORDER BY uploaded_at DESC").fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_extracted_entities(doc_id: str) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    rows = conn.execute("SELECT * FROM extracted_entities WHERE document_id = ?", (doc_id,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]

# Entity and Graph operations
def add_extracted_entity(entity_id: str, doc_id: str, etype: str, val: str, norm_val: str, ref: Optional[str], conf: float, desc: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """INSERT OR REPLACE INTO extracted_entities 
           (id, document_id, entity_type, value, normalized_value, page_or_ref, confidence, description)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (entity_id, doc_id, etype, val, norm_val, ref, conf, desc)
    )
    conn.commit()
    conn.close()

def add_node(node_id: str, label: str, name: str, properties: Dict[str, Any], doc_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    props_json = json.dumps(properties)
    
    # 1. Insert or update node
    # If node exists, we merge properties
    existing = cursor.execute("SELECT properties FROM nodes WHERE id = ?", (node_id,)).fetchone()
    if existing:
        old_props = json.loads(existing['properties'])
        old_props.update(properties)
        props_json = json.dumps(old_props)
        cursor.execute("UPDATE nodes SET properties = ? WHERE id = ?", (props_json, node_id))
    else:
        cursor.execute("INSERT INTO nodes (id, label, name, properties) VALUES (?, ?, ?, ?)", (node_id, label, name, props_json))
    
    # 2. Track node-document relationship
    cursor.execute("INSERT OR IGNORE INTO node_documents (node_id, document_id) VALUES (?, ?)", (node_id, doc_id))
    
    conn.commit()
    conn.close()

def add_edge(source_id: str, target_id: str, edge_type: str, properties: Dict[str, Any], doc_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    edge_id = f"{source_id}:{target_id}:{edge_type}"
    props_json = json.dumps(properties)
    
    # Check if endpoints exist first (to satisfy SQLite foreign keys)
    # They should have been created in the entity resolution step, but double check
    s_exists = cursor.execute("SELECT 1 FROM nodes WHERE id = ?", (source_id,)).fetchone()
    t_exists = cursor.execute("SELECT 1 FROM nodes WHERE id = ?", (target_id,)).fetchone()
    
    if not s_exists or not t_exists:
        logger.warning(f"Skipping edge {edge_id} as source or target node does not exist in nodes table.")
        conn.close()
        return

    # Insert or update edge
    existing = cursor.execute("SELECT properties FROM edges WHERE id = ?", (edge_id,)).fetchone()
    if existing:
        old_props = json.loads(existing['properties'])
        old_props.update(properties)
        props_json = json.dumps(old_props)
        cursor.execute("UPDATE edges SET properties = ? WHERE id = ?", (props_json, edge_id))
    else:
        cursor.execute("INSERT INTO edges (id, source_id, target_id, type, properties) VALUES (?, ?, ?, ?, ?)", 
                       (edge_id, source_id, target_id, edge_type, props_json))
        
    # Track edge-document relationship
    cursor.execute("INSERT OR IGNORE INTO edge_documents (edge_id, document_id) VALUES (?, ?)", (edge_id, doc_id))
    
    conn.commit()
    conn.close()

def get_graph() -> Dict[str, List[Dict[str, Any]]]:
    conn = get_db_connection()
    nodes = []
    edges = []
    
    # Fetch all nodes and link them to their documents
    node_rows = conn.execute("SELECT * FROM nodes").fetchall()
    for row in node_rows:
        node_id = row['id']
        doc_rows = conn.execute("SELECT document_id FROM node_documents WHERE node_id = ?", (node_id,)).fetchall()
        doc_ids = [r['document_id'] for r in doc_rows]
        
        nodes.append({
            "id": node_id,
            "label": row['label'],
            "name": row['name'],
            "properties": json.loads(row['properties']),
            "documents": doc_ids
        })
        
    # Fetch all edges and link them to their documents
    edge_rows = conn.execute("SELECT * FROM edges").fetchall()
    for row in edge_rows:
        edge_id = row['id']
        doc_rows = conn.execute("SELECT document_id FROM edge_documents WHERE edge_id = ?", (edge_id,)).fetchall()
        doc_ids = [r['document_id'] for r in doc_rows]
        
        edges.append({
            "id": edge_id,
            "source": row['source_id'],
            "target": row['target_id'],
            "type": row['type'],
            "properties": json.loads(row['properties']),
            "documents": doc_ids
        })
        
    conn.close()
    return {"nodes": nodes, "links": edges}

def get_subgraph_by_document(doc_id_or_filename: str) -> Dict[str, List[Dict[str, Any]]]:
    """Retrieve nodes and edges connected to a specific document ID or filename."""
    conn = get_db_connection()
    nodes = []
    edges = []
    
    # Resolve filename to doc_id if needed
    doc_row = conn.execute("SELECT id FROM documents WHERE id = ? OR filename LIKE ?", 
                           (doc_id_or_filename, f"%{doc_id_or_filename}%")).fetchone()
    target_doc_id = doc_row['id'] if doc_row else doc_id_or_filename

    # Get all nodes mentioned in document
    node_rows = conn.execute("""
        SELECT n.* FROM nodes n
        JOIN node_documents nd ON n.id = nd.node_id
        WHERE nd.document_id = ?
    """, (target_doc_id,)).fetchall()
    
    # If no specific nodes bound to this doc_id, fallback to all nodes
    if not node_rows:
        node_rows = conn.execute("SELECT * FROM nodes").fetchall()

    node_ids = set()
    for row in node_rows:
        node_id = row['id']
        node_ids.add(node_id)
        
        doc_rows = conn.execute("SELECT document_id FROM node_documents WHERE node_id = ?", (node_id,)).fetchall()
        doc_ids = [r['document_id'] for r in doc_rows]
        
        nodes.append({
            "id": node_id,
            "label": row['label'],
            "name": row['name'],
            "properties": json.loads(row['properties']) if row['properties'] else {},
            "documents": doc_ids
        })
        
    # Get all edges where source or target is in node_ids
    if node_ids:
        placeholders = ','.join(['?'] * len(node_ids))
        edge_rows = conn.execute(f"""
            SELECT DISTINCT * FROM edges 
            WHERE source_id IN ({placeholders}) OR target_id IN ({placeholders})
        """, list(node_ids) + list(node_ids)).fetchall()
    else:
        edge_rows = conn.execute("SELECT * FROM edges").fetchall()
    
    seen_edges = set()
    for row in edge_rows:
        edge_id = row['id']
        if edge_id in seen_edges:
            continue
        seen_edges.add(edge_id)
        
        # Ensure target/source node exists in nodes array if neighbor node was pulled in
        for endpoint in (row['source_id'], row['target_id']):
            if endpoint not in node_ids:
                n_row = conn.execute("SELECT * FROM nodes WHERE id = ?", (endpoint,)).fetchone()
                if n_row:
                    node_ids.add(endpoint)
                    nodes.append({
                        "id": n_row['id'],
                        "label": n_row['label'],
                        "name": n_row['name'],
                        "properties": json.loads(n_row['properties']) if n_row['properties'] else {},
                        "documents": []
                    })

        doc_rows = conn.execute("SELECT document_id FROM edge_documents WHERE edge_id = ?", (edge_id,)).fetchall()
        doc_ids = [r['document_id'] for r in doc_rows]
        
        edges.append({
            "id": edge_id,
            "source": row['source_id'],
            "target": row['target_id'],
            "type": row['type'],
            "properties": json.loads(row['properties']) if row['properties'] else {},
            "documents": doc_ids
        })
        
    conn.close()
    return {"nodes": nodes, "links": edges}

def get_subgraph_by_node(node_id: str, depth: int = 1) -> Dict[str, List[Dict[str, Any]]]:
    """Retrieve node, its neighbors, and the connections between them."""
    conn = get_db_connection()
    visited_nodes = {node_id}
    current_layer = {node_id}
    edges_found = []
    
    for _ in range(depth):
        if not current_layer:
            break
        placeholders = ','.join(['?'] * len(current_layer))
        # Find all edges connected to current layer
        query = f"SELECT * FROM edges WHERE source_id IN ({placeholders}) OR target_id IN ({placeholders})"
        params = list(current_layer) * 2
        rows = conn.execute(query, params).fetchall()
        
        next_layer = set()
        for r in rows:
            edges_found.append(dict(r))
            s, t = r['source_id'], r['target_id']
            if s not in visited_nodes:
                next_layer.add(s)
                visited_nodes.add(s)
            if t not in visited_nodes:
                next_layer.add(t)
                visited_nodes.add(t)
        current_layer = next_layer
        
    # Get details for all visited nodes
    nodes = []
    if visited_nodes:
        placeholders = ','.join(['?'] * len(visited_nodes))
        node_rows = conn.execute(f"SELECT * FROM nodes WHERE id IN ({placeholders})", list(visited_nodes)).fetchall()
        for row in node_rows:
            nid = row['id']
            doc_rows = conn.execute("SELECT document_id FROM node_documents WHERE node_id = ?", (nid,)).fetchall()
            nodes.append({
                "id": nid,
                "label": row['label'],
                "name": row['name'],
                "properties": json.loads(row['properties']),
                "documents": [r['document_id'] for r in doc_rows]
            })
            
    # Format edges
    links = []
    for e in edges_found:
        eid = e['id']
        doc_rows = conn.execute("SELECT document_id FROM edge_documents WHERE edge_id = ?", (eid,)).fetchall()
        links.append({
            "id": eid,
            "source": e['source_id'],
            "target": e['target_id'],
            "type": e['type'],
            "properties": json.loads(e['properties']),
            "documents": [r['document_id'] for r in doc_rows]
        })
        
    conn.close()
    return {"nodes": nodes, "links": links}

# Chunk and Vector operations
def add_chunk(chunk_id: str, doc_id: str, content: str, embedding_bytes: bytes, page_or_ref: Optional[str]):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO chunks (id, document_id, content, embedding, page_or_ref) VALUES (?, ?, ?, ?, ?)",
        (chunk_id, doc_id, content, embedding_bytes, page_or_ref)
    )
    conn.commit()
    conn.close()

def get_all_chunks() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    rows = conn.execute("SELECT id, document_id, content, embedding, page_or_ref FROM chunks").fetchall()
    conn.close()
    return [dict(r) for r in rows]

# Query logging
def add_query(query_id: str, question: str, answer: str, sources: List[Dict[str, Any]], confidence: float) -> Dict[str, Any]:
    conn = get_db_connection()
    cursor = conn.cursor()
    created_at = datetime.utcnow().isoformat()
    sources_json = json.dumps(sources)
    cursor.execute(
        "INSERT INTO queries (id, question, answer, sources, confidence, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        (query_id, question, answer, sources_json, confidence, created_at)
    )
    conn.commit()
    conn.close()
    return {
        "id": query_id,
        "question": question,
        "answer": answer,
        "sources": sources,
        "confidence": confidence,
        "created_at": created_at
    }

# Visualization Caching
def add_visualization(viz_id: str, type: str, source_id: str, structure_json: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    created_at = datetime.utcnow().isoformat()
    cursor.execute(
        "INSERT OR REPLACE INTO visualizations (id, type, source_id, structure_json, created_at) VALUES (?, ?, ?, ?, ?)",
        (viz_id, type, source_id, structure_json, created_at)
    )
    conn.commit()
    conn.close()

def get_cached_visualization(type: str, source_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    row = conn.execute(
        "SELECT * FROM visualizations WHERE type = ? AND source_id = ? ORDER BY created_at DESC LIMIT 1",
        (type, source_id)
    ).fetchone()
    conn.close()
    return dict(row) if row else None
