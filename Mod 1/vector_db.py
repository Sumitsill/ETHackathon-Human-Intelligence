import os
import uuid
from typing import List, Dict, Any
from qdrant_client import QdrantClient
from qdrant_client.http import models
from qdrant_client.http.models import Distance, VectorParams
import config
from gemini_client import client

class VectorDBWrapper:
    def __init__(self):
        self.collection_name = "industrial_corpus"
        self.db_path = str(config.QDRANT_DIR)
        self._qdrant_client = None

    @property
    def qdrant_client(self):
        if self._qdrant_client is None:
            # Initialize local Qdrant Client (running in-process, saving to disk)
            print(f"Initializing local Qdrant Client at {self.db_path}...")
            self._qdrant_client = QdrantClient(path=self.db_path)
            self._ensure_collection()
        return self._qdrant_client

    def _ensure_collection(self):
        try:
            # Check if collection exists, if not create it
            collections = self._qdrant_client.get_collections().collections
            exists = any(c.name == self.collection_name for c in collections)
            
            if not exists:
                print(f"Creating Qdrant collection: {self.collection_name} (Vector Dimension: 768, Distance: Cosine)")
                self._qdrant_client.create_collection(
                    collection_name=self.collection_name,
                    vectors_config=VectorParams(
                        size=768,
                        distance=Distance.COSINE
                    )
                )
            else:
                print(f"Qdrant collection '{self.collection_name}' already exists.")
        except Exception as e:
            print(f"Error ensuring Qdrant collection: {e}")

    def chunk_text(self, text: str, chunk_size: int = 1000, overlap: int = 200) -> List[str]:
        """Simple, robust character-level text chunker with overlap."""
        if not text:
            return []
            
        chunks = []
        start = 0
        text_len = len(text)
        
        while start < text_len:
            end = min(start + chunk_size, text_len)
            chunk = text[start:end].strip()
            if chunk:
                chunks.append(chunk)
            start += chunk_size - overlap
            
        return chunks

    def store_document_chunks(self, doc_id: str, text: str, related_node_ids: List[str]):
        """Chunks a document's text, embeds each chunk, and stores it in Qdrant with metadata."""
        chunks = self.chunk_text(text)
        if not chunks:
            print(f"No text to chunk for document {doc_id}.")
            return
            
        points = []
        print(f"Chunked document {doc_id} into {len(chunks)} chunks. Generating embeddings...")
        
        for idx, chunk in enumerate(chunks):
            embedding = client.generate_embeddings(chunk)
            chunk_uuid = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{doc_id}_{idx}"))
            
            points.append(
                models.PointStruct(
                    id=chunk_uuid,
                    vector=embedding,
                    payload={
                        "document_id": doc_id,
                        "chunk_id": idx,
                        "text": chunk,
                        "related_node_ids": related_node_ids
                    }
                )
            )
            
        try:
            self.qdrant_client.upsert(
                collection_name=self.collection_name,
                points=points
            )
            print(f"Successfully upserted {len(points)} chunks into Qdrant for document {doc_id}.")
        except Exception as e:
            print(f"Failed to upsert chunks to Qdrant: {e}")

    def search_similar_chunks(self, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        """Search vector database for matching chunks using modern query_points interface."""
        query_vector = client.generate_embeddings(query)
        try:
            results = self.qdrant_client.query_points(
                collection_name=self.collection_name,
                query=query_vector,
                limit=limit
            )
            return [
                {
                    "score": r.score,
                    "document_id": r.payload.get("document_id"),
                    "chunk_id": r.payload.get("chunk_id"),
                    "text": r.payload.get("text"),
                    "related_node_ids": r.payload.get("related_node_ids")
                }
                for r in results.points
            ]
        except Exception as e:
            print(f"Qdrant query_points search failed: {e}")
            return []

# Singleton vector db instance
vector_db = VectorDBWrapper()

if __name__ == "__main__":
    print("Vector DB Wrapper loaded.")
