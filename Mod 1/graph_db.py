import os
import json
from datetime import datetime
from neo4j import GraphDatabase
import config
from gemini_client import ExtractionResult

def normalize_tag(tag: str) -> str:
    """Normalize equipment tags for robust cross-document matching (e.g. 'P-204', 'Pump 204', 'P204' -> 'P-204')."""
    if not tag:
        return ""
    # Convert to uppercase, strip leading/trailing spaces
    normalized = tag.strip().upper()
    # Strip spaces and hyphens temporarily for standard form matching
    clean = normalized.replace(" ", "").replace("-", "")
    
    # Standardize prefixes (e.g., PUMP204 -> P204, VALVE101 -> V101)
    import re
    if clean.startswith("PUMP") and clean[4:].isdigit():
        clean = "P" + clean[4:]
    elif clean.startswith("VALVE") and clean[5:].isdigit():
        clean = "V" + clean[5:]
        
    # Re-insert the hyphen between leading letters and trailing digits
    match = re.match(r"^([A-Z]+)(\d+)$", clean)
    if match:
        normalized = f"{match.group(1)}-{match.group(2)}"
    else:
        # Fallback to normalized with spaces/hyphens cleaned
        normalized = clean
    return normalized

class GraphDBConnector:
    def __init__(self):
        self.uri = config.NEO4J_URI
        self.user = config.NEO4J_USER
        self.password = config.NEO4J_PASSWORD
        self.driver = None
        self.use_mock = False
        self.mock_file_path = os.path.join(os.path.dirname(__file__), "mock_graph.json")
        
        # Try establishing connection
        try:
            print(f"Connecting to Neo4j at {self.uri}...")
            self.driver = GraphDatabase.driver(self.uri, auth=(self.user, self.password))
            # Test connectivity
            self.driver.verify_connectivity()
            print("Successfully connected to Neo4j.")
        except Exception as e:
            print(f"Neo4j connection failed: {e}.")
            print("Activating local mock graph file fallback (mock_graph.json).")
            self.use_mock = True
            # Initialize mock graph file if it does not exist
            if not os.path.exists(self.mock_file_path):
                self._save_mock_graph({"nodes": [], "relationships": []})

    def close(self):
        if self.driver:
            self.driver.close()

    def _read_mock_graph(self) -> dict:
        try:
            with open(self.mock_file_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {"nodes": [], "relationships": []}

    def _save_mock_graph(self, graph_data: dict):
        try:
            with open(self.mock_file_path, "w", encoding="utf-8") as f:
                json.dump(graph_data, f, indent=2)
        except Exception as e:
            print(f"Failed to write mock graph to file: {e}")

    def _upsert_mock_node(self, node_type: str, key_prop: str, key_val: str, properties: dict):
        graph = self._read_mock_graph()
        # Find existing
        found = False
        for node in graph["nodes"]:
            if node["type"] == node_type and node["properties"].get(key_prop) == key_val:
                # Update
                node["properties"].update(properties)
                node["properties"]["updated_at"] = str(datetime.now())
                found = True
                break
        if not found:
            # Create
            properties[key_prop] = key_val
            properties["created_at"] = str(datetime.now())
            graph["nodes"].append({
                "type": node_type,
                "properties": properties
            })
        self._save_mock_graph(graph)

    def _upsert_mock_relationship(self, from_type: str, from_key: str, from_val: str,
                                  rel_type: str,
                                  to_type: str, to_key: str, to_val: str, properties: dict = None):
        graph = self._read_mock_graph()
        properties = properties or {}
        # Find existing
        found = False
        for rel in graph["relationships"]:
            if (rel["type"] == rel_type and
                rel["from"]["type"] == from_type and rel["from"]["val"] == from_val and
                rel["to"]["type"] == to_type and rel["to"]["val"] == to_val):
                rel["properties"].update(properties)
                found = True
                break
        if not found:
            graph["relationships"].append({
                "type": rel_type,
                "from": {"type": from_type, "key": from_key, "val": from_val},
                "to": {"type": to_type, "key": to_key, "val": to_val},
                "properties": properties
            })
        self._save_mock_graph(graph)

    def upsert_document(self, doc_id: str, filename: str, doc_type: str, source_path: str):
        """Idempotently insert a Document node."""
        if self.use_mock:
            self._upsert_mock_node("Document", "id", doc_id, {
                "filename": filename,
                "type": doc_type,
                "source_path": source_path,
                "ingested_at": str(datetime.now())
            })
            return
            
        def _tx(tx):
            query = """
            MERGE (d:Document {id: $doc_id})
            ON CREATE SET d.filename = $filename, d.type = $doc_type, d.source_path = $source_path, d.ingested_at = datetime()
            ON MATCH SET d.source_path = $source_path, d.ingested_at = datetime()
            """
            tx.run(query, doc_id=doc_id, filename=filename, doc_type=doc_type, source_path=source_path)
            
        with self.driver.session() as session:
            session.execute_write(_tx)

    def upsert_entities(self, doc_id: str, entities: ExtractionResult, doc_type: str):
        """Idempotently insert extracted entities and set relationships in Neo4j (or Mock)."""
        filename = entities.document_id
        
        # 1. Equipment Tags
        for eq in entities.equipment_tags:
            norm_tag = normalize_tag(eq.tag)
            if not norm_tag:
                continue
            
            # Upsert Equipment Node
            eq_name = eq.name or "Unknown Equipment"
            eq_type = "Pump" if "pump" in eq_name.lower() else "Valve" if "valve" in eq_name.lower() else "Equipment"
            
            if self.use_mock:
                self._upsert_mock_node("Equipment", "tag", norm_tag, {"name": eq_name, "type": eq_type})
                self._upsert_mock_relationship("Document", "id", doc_id, "MENTIONS", "Equipment", "tag", norm_tag)
                # Serviced by / Inspected in relationship
                if "work_order" in doc_type.lower() or "service" in filename.lower():
                    self._upsert_mock_relationship("Equipment", "tag", norm_tag, "SERVICED_BY", "Document", "id", doc_id)
                elif "inspection" in doc_type.lower() or "report" in filename.lower():
                    self._upsert_mock_relationship("Equipment", "tag", norm_tag, "INSPECTED_IN", "Document", "id", doc_id)
            else:
                def _tx_eq(tx):
                    # Upsert Equipment
                    tx.run("""
                    MERGE (e:Equipment {tag: $tag})
                    ON CREATE SET e.name = $name, e.type = $type
                    ON MATCH SET e.name = COALESCE(e.name, $name)
                    """, tag=norm_tag, name=eq_name, type=eq_type)
                    
                    # Connect Document - MENTIONS -> Equipment
                    tx.run("""
                    MATCH (d:Document {id: $doc_id})
                    MATCH (e:Equipment {tag: $tag})
                    MERGE (d)-[:MENTIONS]->(e)
                    """, doc_id=doc_id, tag=norm_tag)
                    
                    # Custom relationship mappings
                    if "work_order" in doc_type.lower() or "service" in filename.lower():
                        tx.run("""
                        MATCH (d:Document {id: $doc_id})
                        MATCH (e:Equipment {tag: $tag})
                        MERGE (e)-[:SERVICED_BY]->(d)
                        """, doc_id=doc_id, tag=norm_tag)
                    elif "inspection" in doc_type.lower() or "report" in filename.lower():
                        tx.run("""
                        MATCH (d:Document {id: $doc_id})
                        MATCH (e:Equipment {tag: $tag})
                        MERGE (e)-[:INSPECTED_IN]->(d)
                        """, doc_id=doc_id, tag=norm_tag)
                
                with self.driver.session() as session:
                    session.execute_write(_tx_eq)

        # 2. Regulatory References
        for reg in entities.regulatory_references:
            if not reg.ref_code:
                continue
            
            reg_code = reg.ref_code.strip().upper()
            reg_desc = reg.context or "Regulatory Standard"
            
            if self.use_mock:
                self._upsert_mock_node("Regulation", "ref_code", reg_code, {"description": reg_desc})
                self._upsert_mock_relationship("Document", "id", doc_id, "MENTIONS", "Regulation", "ref_code", reg_code)
                
                # Check context for equipment tags to link Regulation - APPLIES_TO -> Equipment
                for eq in entities.equipment_tags:
                    norm_tag = normalize_tag(eq.tag)
                    if norm_tag:
                        self._upsert_mock_relationship("Regulation", "ref_code", reg_code, "APPLIES_TO", "Equipment", "tag", norm_tag)
            else:
                def _tx_reg(tx):
                    tx.run("""
                    MERGE (r:Regulation {ref_code: $ref_code})
                    ON CREATE SET r.description = $description
                    ON MATCH SET r.description = COALESCE(r.description, $description)
                    """, ref_code=reg_code, description=reg_desc)
                    
                    tx.run("""
                    MATCH (d:Document {id: $doc_id})
                    MATCH (r:Regulation {ref_code: $ref_code})
                    MERGE (d)-[:MENTIONS]->(r)
                    """, doc_id=doc_id, ref_code=reg_code)
                    
                    # Link to related equipment if mentioned in same document
                    for eq in entities.equipment_tags:
                        norm_tag = normalize_tag(eq.tag)
                        if norm_tag:
                            tx.run("""
                            MATCH (r:Regulation {ref_code: $ref_code})
                            MATCH (e:Equipment {tag: $tag})
                            MERGE (r)-[:APPLIES_TO]->(e)
                            """, ref_code=reg_code, tag=norm_tag)
                            
                with self.driver.session() as session:
                    session.execute_write(_tx_reg)

        # 3. Personnel
        for pers in entities.personnel:
            if not pers.name:
                continue
            
            p_name = pers.name.strip()
            p_role = pers.role or "Personnel"
            
            if self.use_mock:
                self._upsert_mock_node("Personnel", "name", p_name, {"role": p_role})
                if "work_order" in doc_type.lower() or "service" in filename.lower():
                    self._upsert_mock_relationship("Personnel", "name", p_name, "PERFORMED", "Document", "id", doc_id)
            else:
                def _tx_pers(tx):
                    tx.run("""
                    MERGE (p:Personnel {name: $name})
                    ON CREATE SET p.role = $role
                    ON MATCH SET p.role = COALESCE(p.role, $role)
                    """, name=p_name, role=p_role)
                    
                    if "work_order" in doc_type.lower() or "service" in filename.lower():
                        tx.run("""
                        MATCH (p:Personnel {name: $name})
                        MATCH (d:Document {id: $doc_id})
                        MERGE (p)-[:PERFORMED]->(d)
                        """, name=p_name, doc_id=doc_id)
                        
                with self.driver.session() as session:
                    session.execute_write(_tx_pers)

        # 4. Process parameters & potential Incidents
        # If parameters indicate abnormal conditions (e.g. value containing "high", "exceeded", "leak", "failure", "alert", or high pressure),
        # we can flag an Incident node.
        for param in entities.process_parameters:
            val_lower = param.value.lower() if param.value else ""
            is_anomaly = any(word in val_lower for word in ["exceed", "high", "low", "fail", "leak", "alert", "error", "burst"])
            
            if is_anomaly and param.equipment_tag:
                norm_tag = normalize_tag(param.equipment_tag)
                inc_id = f"INC-{norm_tag}-{datetime.now().strftime('%Y%m%d')}"
                inc_desc = f"Parameter anomaly: {param.parameter} was {param.value}"
                inc_date = datetime.now().strftime("%Y-%m-%d")
                
                # Check if we can find a date in entities
                if entities.dates:
                    inc_date = entities.dates[0].date
                
                if self.use_mock:
                    self._upsert_mock_node("Incident", "id", inc_id, {"description": inc_desc, "date": inc_date})
                    self._upsert_mock_relationship("Incident", "id", inc_id, "INVOLVES", "Equipment", "tag", norm_tag)
                else:
                    def _tx_inc(tx):
                        tx.run("""
                        MERGE (i:Incident {id: $inc_id})
                        ON CREATE SET i.description = $desc, i.date = $date
                        ON MATCH SET i.description = $desc
                        """, inc_id=inc_id, desc=inc_desc, date=inc_date)
                        
                        tx.run("""
                        MATCH (i:Incident {id: $inc_id})
                        MATCH (e:Equipment {tag: $tag})
                        MERGE (i)-[:INVOLVES]->(e)
                        """, inc_id=inc_id, tag=norm_tag)
                    with self.driver.session() as session:
                        session.execute_write(_tx_inc)

    def get_all_mock_data(self) -> dict:
        """Returns the full contents of the mock graph for API inspection."""
        return self._read_mock_graph()

# Singleton connector instance
graph_db = GraphDBConnector()

if __name__ == "__main__":
    print("Graph DB Connector Module Loaded.")
