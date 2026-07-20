import os
import re
import json
import logging
import sqlite3
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
from rag_core import get_db_connection, groq_client, extract_query_entities

logger = logging.getLogger("visualization")

# Schemas matching Module 1 / Module 3
class MindmapItem(BaseModel):
    id: str
    name: str
    description: str
    parent_id: str

class MindmapStructure(BaseModel):
    items: List[MindmapItem]

def flat_to_nested(items: List[MindmapItem], topic_name: str) -> Dict[str, Any]:
    nodes_map = {}
    for item in items:
        nodes_map[item.id] = {
            "name": item.name,
            "description": item.description or "",
            "children": []
        }
        
    root_node = None
    for item in items:
        nid = item.id
        pid = item.parent_id
        if pid and pid.strip() and pid in nodes_map:
            nodes_map[pid]["children"].append(nodes_map[nid])
        else:
            if root_node is None:
                root_node = nodes_map[nid]
                
    if root_node is None:
        if nodes_map:
            root_node = list(nodes_map.values())[0]
        else:
            root_node = {"name": topic_name, "description": "No nodes available", "children": []}
            
    return {"root": root_node}

def get_subgraph_for_document(doc_id: str) -> Dict[str, Any]:
    conn = get_db_connection()
    nodes = []
    edges = []
    
    node_rows = conn.execute("""
        SELECT n.* FROM nodes n
        JOIN node_documents nd ON n.id = nd.node_id
        WHERE nd.document_id = ?
    """, (doc_id,)).fetchall()
    
    node_ids = set()
    for row in node_rows:
        nid = row['id']
        node_ids.add(nid)
        nodes.append({
            "id": nid,
            "label": row['label'],
            "name": row['name'],
            "properties": json.loads(row['properties'])
        })
        
    if node_ids:
        placeholders = ','.join(['?'] * len(node_ids))
        edge_rows = conn.execute(f"""
            SELECT DISTINCT e.* FROM edges e
            LEFT JOIN edge_documents ed ON e.id = ed.edge_id
            WHERE ed.document_id = ? 
               OR (e.source_id IN ({placeholders}) AND e.target_id IN ({placeholders}))
        """, [doc_id] + list(node_ids) + list(node_ids)).fetchall()
        
        for row in edge_rows:
            edges.append({
                "id": row['id'],
                "source": row['source_id'],
                "target": row['target_id'],
                "type": row['type'],
                "properties": json.loads(row['properties'])
            })
            
    conn.close()
    return {"nodes": nodes, "links": edges}

def get_subgraph_by_topic(topic: str) -> Dict[str, Any]:
    conn = get_db_connection()
    # Find node matching topic
    row = conn.execute("SELECT id FROM nodes WHERE name LIKE ? LIMIT 1", (f"%{topic}%",)).fetchone()
    if not row:
        conn.close()
        return {"nodes": [], "links": []}
        
    node_id = row["id"]
    nodes = []
    edges = []
    visited = {node_id}
    
    # 2-hop search
    layer_nodes = {node_id}
    for _ in range(2):
        if not layer_nodes:
            break
        placeholders = ','.join(['?'] * len(layer_nodes))
        edge_rows = conn.execute(f"""
            SELECT * FROM edges 
            WHERE source_id IN ({placeholders}) OR target_id IN ({placeholders})
        """, list(layer_nodes) * 2).fetchall()
        
        next_layer = set()
        for r in edge_rows:
            edges.append({
                "id": r['id'],
                "source": r['source_id'],
                "target": r['target_id'],
                "type": r['type'],
                "properties": json.loads(r['properties'])
            })
            s, t = r['source_id'], r['target_id']
            if s not in visited:
                next_layer.add(s)
                visited.add(s)
            if t not in visited:
                next_layer.add(t)
                visited.add(t)
        layer_nodes = next_layer
        
    if visited:
        placeholders = ','.join(['?'] * len(visited))
        node_rows = conn.execute(f"SELECT * FROM nodes WHERE id IN ({placeholders})", list(visited)).fetchall()
        for r in node_rows:
            nodes.append({
                "id": r['id'],
                "label": r['label'],
                "name": r['name'],
                "properties": json.loads(r['properties'])
            })
            
    conn.close()
    return {"nodes": nodes, "links": edges}


# -------------------------------------------------------------
# Mindmap Generation Flow
# -------------------------------------------------------------

def generate_mindmap(topic_name: str, subgraph: Dict[str, Any]) -> Dict[str, Any]:
    if not groq_client:
        return {"error": "Groq client not initialized"}
        
    nodes_desc = "\n".join([f"- Node '{n['name']}' ({n['label']}): {n['properties'].get('description', '')}" for n in subgraph.get('nodes', [])])
    links_desc = "\n".join([f"- Edge: {e['source']} --({e['type']})--> {e['target']}" for e in subgraph.get('links', [])])
    
    schema_dict = MindmapStructure.model_json_schema() if hasattr(MindmapStructure, "model_json_schema") else MindmapStructure.schema()
    
    prompt = (
        f"You are a structured mindmap generator. Generate a hierarchical mindmap about: '{topic_name}'\n\n"
        "Instructions:\n"
        "1. Construct a flat list of items, where each item defines: id, name, description, parent_id.\n"
        "2. The root node representing the main topic should have parent_id as an empty string.\n"
        "3. Group related parameters, equipment, people, and regulations under respective categories as branches.\n"
        "4. Your response must be valid JSON matching this schema: "
        f"{json.dumps(schema_dict)}\n"
        "Do not include markdown triple backticks around the JSON.\n\n"
        "Graph Context Details:\n"
        f"Entities:\n{nodes_desc}\n\n"
        f"Relations:\n{links_desc}"
    )
    
    try:
        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "You are a JSON generator that outputs pure valid JSON matching the requested schema without markdown backticks."},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0.1
        )
        data = json.loads(response.choices[0].message.content)
        items = [MindmapItem(**item) for item in data.get("items", [])]
        return flat_to_nested(items, topic_name)
    except Exception as e:
        logger.error(f"Failed to generate mindmap via Groq: {e}. Falling back to rule-based hierarchy.")
        return generate_fallback_mindmap(topic_name, subgraph)

def generate_fallback_mindmap(topic_name: str, subgraph: Dict[str, Any]) -> Dict[str, Any]:
    root = {
        "name": topic_name,
        "description": "Offline local mindmap fallback",
        "children": []
    }
    categories = {}
    for n in subgraph.get("nodes", []):
        lbl = n["label"]
        if lbl not in categories:
            categories[lbl] = []
        categories[lbl].append(n)
        
    for cat_name, cat_nodes in categories.items():
        branch = {
            "name": f"{cat_name} Details",
            "description": f"Extracted {cat_name} entities",
            "children": []
        }
        for node in cat_nodes:
            branch["children"].append({
                "name": node["name"],
                "description": node["properties"].get("description") or "",
                "children": []
            })
        root["children"].append(branch)
        
    return {"root": root}


# -------------------------------------------------------------
# Flowchart Generation Flow
# -------------------------------------------------------------

def validate_mermaid_syntax(code: str) -> bool:
    """Verifies that the generated flowchart code is syntactically sound Mermaid graph format."""
    lines = code.split("\n")
    if not lines:
        return False
        
    # Must start with graph or flowchart declaration
    header = lines[0].strip().lower()
    if not (header.startswith("graph ") or header.startswith("flowchart ")):
        return False
        
    # Basic matching for balanced quotes
    for line in lines:
        if line.count('"') % 2 != 0:
            return False
            
    return True

def generate_flowchart(document_id: str) -> Dict[str, str]:
    conn = get_db_connection()
    doc = conn.execute("SELECT filename, source_type FROM documents WHERE id = ?", (document_id,)).fetchone()
    if not doc:
        conn.close()
        return {"error": f"Document {document_id} not found."}
        
    chunks = conn.execute("SELECT content FROM chunks WHERE document_id = ? ORDER BY id", (document_id,)).fetchall()
    conn.close()
    
    filename = doc["filename"]
    full_text = "\n\n".join(ch["content"] for ch in chunks)
    
    if not groq_client:
        return {"error": "Groq client not initialized."}
        
    prompt = (
        f"You are a process mapping assistant. Examine this procedure: '{filename}'.\n"
        "Determine if the content outlines a sequential process, procedure, or SOP.\n\n"
        "If it is a sequential procedure, output a valid Mermaid.js flowchart (graph TD) outlining all steps and conditional branches.\n"
        "Format guidelines:\n"
        "- Use clean nodes: A[\"Step 1\"] --> B{\"Decision\"}\n"
        "- Do not use special characters in node IDs; stick to simple alphanumeric IDs (A, B, C).\n"
        "- Return ONLY the Mermaid code block starting with `graph TD`. Do not wrap in markdown or add explanations.\n\n"
        "If the document is NOT procedural (e.g. just email threads, tables, specifications), respond exactly with: "
        "'FLOWCHART_FALLBACK: This document does not describe a sequential process.'\n\n"
        f"Document Content:\n{full_text}"
    )
    
    try:
        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "You are a process drawing assistant. Return only the Mermaid code or the fallback phrase verbatim."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.0
        )
        code = response.choices[0].message.content.strip()
        
        # Clean markdown code blocks if Llama wraps it
        if "```mermaid" in code:
            code = re.search(r"```mermaid\s*([\s\S]*?)\s*```", code).group(1).strip()
        elif "```" in code:
            code = re.search(r"```\s*([\s\S]*?)\s*```", code).group(1).strip()
            
        if "FLOWCHART_FALLBACK" in code:
            return {"status": "fallback", "message": "This document does not describe a sequential process."}
            
        # Validate Mermaid syntax
        if validate_mermaid_syntax(code):
            return {"status": "success", "mermaid_code": code}
        else:
            logger.warning("Mermaid syntax validation failed. Retrying once with strict instructions...")
            retry_prompt = prompt + "\n\nWARNING: The code you just generated had syntax errors. Please regenerate, ensuring all double quotes are balanced and node labels use valid syntax like A[\"Label\"] with no nesting."
            retry_response = groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": "Return only the syntactically correct Mermaid code."},
                    {"role": "user", "content": retry_prompt}
                ],
                temperature=0.0
            )
            code = retry_response.choices[0].message.content.strip()
            if "```mermaid" in code:
                code = re.search(r"```mermaid\s*([\s\S]*?)\s*```", code).group(1).strip()
            elif "```" in code:
                code = re.search(r"```\s*([\s\S]*?)\s*```", code).group(1).strip()
                
            if validate_mermaid_syntax(code):
                return {"status": "success", "mermaid_code": code}
            else:
                return {"status": "fallback", "message": "Failed to generate syntactically correct Mermaid code after validation gate."}
                
    except Exception as e:
        logger.error(f"Failed to generate flowchart: {e}")
        return {"status": "error", "message": str(e)}
