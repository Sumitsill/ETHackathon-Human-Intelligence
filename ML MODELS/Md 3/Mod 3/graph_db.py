import os
import json
from datetime import datetime
from neo4j import GraphDatabase
import config

class GraphDBWrapper:
    def __init__(self):
        self.uri = config.NEO4J_URI
        self.user = config.NEO4J_USER
        self.password = config.NEO4J_PASSWORD
        self.driver = None
        self.use_mock = False
        self.mock_file_path = config.MOCK_GRAPH_PATH
        
        try:
            print(f"Mod 3: Connecting to Neo4j at {self.uri}...")
            self.driver = GraphDatabase.driver(self.uri, auth=(self.user, self.password))
            self.driver.verify_connectivity()
            print("Mod 3: Neo4j connection verified successfully.")
        except Exception as e:
            print(f"Mod 3: Neo4j connection failed: {e}. Activating mock graph storage: {self.mock_file_path}")
            self.use_mock = True
            if not os.path.exists(self.mock_file_path):
                self._save_mock_graph({"nodes": [], "relationships": []})

    def _read_mock_graph(self) -> dict:
        try:
            if os.path.exists(self.mock_file_path):
                with open(self.mock_file_path, "r", encoding="utf-8") as f:
                    return json.load(f)
        except Exception as e:
            print(f"Mod 3: Failed reading mock graph file: {e}")
        return {"nodes": [], "relationships": []}

    def _save_mock_graph(self, data: dict):
        try:
            with open(self.mock_file_path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            print(f"Mod 3: Failed saving mock graph file: {e}")

    def upsert_node(self, label: str, key_prop: str, key_val: str, properties: dict):
        if self.use_mock:
            graph = self._read_mock_graph()
            found = False
            for node in graph["nodes"]:
                if node["label"] == label and node["properties"].get(key_prop) == key_val:
                    node["properties"].update(properties)
                    node["properties"]["updated_at"] = str(datetime.now())
                    found = True
                    break
            if not found:
                properties[key_prop] = key_val
                properties["created_at"] = str(datetime.now())
                graph["nodes"].append({
                    "label": label,
                    "properties": properties
                })
            self._save_mock_graph(graph)
            return

        def _tx(tx):
            query = f"""
            MERGE (n:{label} {{{key_prop}: $key_val}})
            ON CREATE SET n += $props, n.created_at = datetime()
            ON MATCH SET n += $props, n.updated_at = datetime()
            """
            tx.run(query, key_val=key_val, props=properties)
            
        try:
            with self.driver.session() as session:
                session.execute_write(_tx)
        except Exception as e:
            print(f"Mod 3: Neo4j upsert_node failed: {e}. Switching to mock.")
            self.use_mock = True
            self.upsert_node(label, key_prop, key_val, properties)

    def upsert_relationship(self, from_label: str, from_key: str, from_val: str,
                            rel_type: str,
                            to_label: str, to_key: str, to_val: str, properties: dict = None):
        properties = properties or {}
        if self.use_mock:
            graph = self._read_mock_graph()
            found = False
            for rel in graph["relationships"]:
                if (rel["type"] == rel_type and
                    rel["from"]["label"] == from_label and rel["from"]["val"] == from_val and
                    rel["to"]["label"] == to_label and rel["to"]["val"] == to_val):
                    rel["properties"].update(properties)
                    found = True
                    break
            if not found:
                graph["relationships"].append({
                    "type": rel_type,
                    "from": {"label": from_label, "key": from_key, "val": from_val},
                    "to": {"label": to_label, "key": to_key, "val": to_val},
                    "properties": properties
                })
            self._save_mock_graph(graph)
            return

        def _tx(tx):
            query = f"""
            MATCH (a:{from_label} {{{from_key}: $from_val}})
            MATCH (b:{to_label} {{{to_key}: $to_val}})
            MERGE (a)-[r:{rel_type}]->(b)
            ON CREATE SET r += $props
            ON MATCH SET r += $props
            """
            tx.run(query, from_val=from_val, to_val=to_val, props=properties)

        try:
            with self.driver.session() as session:
                session.execute_write(_tx)
        except Exception as e:
            print(f"Mod 3: Neo4j upsert_relationship failed: {e}. Switching to mock.")
            self.use_mock = True
            self.upsert_relationship(from_label, from_key, from_val, rel_type, to_label, to_key, to_val, properties)

    def get_all_data(self) -> dict:
        if self.use_mock:
            return self._read_mock_graph()

        nodes = []
        relationships = []
        try:
            with self.driver.session() as session:
                node_result = session.run("MATCH (n) RETURN labels(n)[0] as label, properties(n) as props")
                for r in node_result:
                    nodes.append({
                        "label": r["label"] or "Equipment",
                        "properties": dict(r["props"])
                    })
                rel_result = session.run("""
                MATCH (n)-[r]->(m) 
                RETURN labels(n)[0] as from_label,
                       COALESCE(n.tag, n.id, n.name) as from_val,
                       type(r) as type,
                       labels(m)[0] as to_label,
                       COALESCE(m.tag, m.id, m.name) as to_val,
                       properties(r) as props
                """)
                for r in rel_result:
                    relationships.append({
                        "type": r["type"],
                        "from": {"label": r["from_label"], "val": r["from_val"]},
                        "to": {"label": r["to_label"], "val": r["to_val"]},
                        "properties": dict(r["props"])
                    })
            return {"nodes": nodes, "relationships": relationships}
        except Exception as e:
            print(f"Mod 3: Querying Neo4j failed: {e}. Returning mock fallback.")
            return self._read_mock_graph()

    def get_connected_nodes(self, node_label: str, key_prop: str, key_val: str) -> dict:
        graph = self.get_all_data()
        connected_nodes = []
        connected_relationships = []
        
        for n in graph["nodes"]:
            if n["label"] == node_label and n["properties"].get(key_prop) == key_val:
                connected_nodes.append(n)
                break
                
        for r in graph["relationships"]:
            is_from = r["from"].get("label") == node_label and r["from"].get("val") == key_val
            is_to = r["to"].get("label") == node_label and r["to"].get("val") == key_val
            if is_from or is_to:
                connected_relationships.append(r)
                other_label = r["to"]["label"] if is_from else r["from"]["label"]
                other_val = r["to"]["val"] if is_from else r["from"]["val"]
                
                exists = any(n["label"] == other_label and (n["properties"].get("tag") == other_val or n["properties"].get("id") == other_val or n["properties"].get("name") == other_val) for n in connected_nodes)
                if not exists:
                    for n in graph["nodes"]:
                        n_val = n["properties"].get("tag") or n["properties"].get("id") or n["properties"].get("name")
                        if n["label"] == other_label and n_val == other_val:
                            connected_nodes.append(n)
                            break
                            
        return {"nodes": connected_nodes, "relationships": connected_relationships}

# Singleton instance
graph_db = GraphDBWrapper()
