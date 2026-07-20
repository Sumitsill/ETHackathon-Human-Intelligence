import os
import uuid
import re
from typing import List, Dict, Any

QDRANT_AVAILABLE = False
QdrantClient = None
models = None
Distance = None
VectorParams = None

try:
    from qdrant_client import QdrantClient
    from qdrant_client.http import models
    from qdrant_client.http.models import Distance, VectorParams
    QDRANT_AVAILABLE = True
except Exception as e:
    print(f"WARNING: Qdrant Client library import failed: {e}. Switching to keyword search fallback.")
    QDRANT_AVAILABLE = False

import config
from gemini_client import client

class VectorDBWrapper:
    def __init__(self):
        self.collection_name = "regulations_mod4"
        self.db_path = str(config.QDRANT_DIR)
        self._qdrant_client = None
        self.use_fallback = False
        self.fallback_documents = []

    @property
    def qdrant_client(self):
        if not QDRANT_AVAILABLE:
            self.use_fallback = True
            return None
        if self._qdrant_client is None and not self.use_fallback:
            try:
                print(f"Mod 4: Initializing local Qdrant Client at {self.db_path}...")
                self._qdrant_client = QdrantClient(path=self.db_path)
                self._ensure_collection()
            except Exception as e:
                print(f"Mod 4: Qdrant Client initialization failed: {e}. Falling back to Python in-memory keyword search.")
                self.use_fallback = True
        return self._qdrant_client

    def _ensure_collection(self):
        try:
            collections = self._qdrant_client.get_collections().collections
            exists = any(c.name == self.collection_name for c in collections)
            
            if not exists:
                print(f"Mod 4: Creating collection: {self.collection_name} (Dimension: 768)")
                self._qdrant_client.create_collection(
                    collection_name=self.collection_name,
                    vectors_config=VectorParams(
                        size=768,
                        distance=Distance.COSINE
                    )
                )
            else:
                print(f"Mod 4: Collection '{self.collection_name}' exists.")
        except Exception as e:
            print(f"Mod 4: Error checking/creating collection: {e}. Switching to fallback mode.")
            self.use_fallback = True

    def chunk_text(self, text: str, chunk_size: int = 1000, overlap: int = 200) -> List[str]:
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

    def store_regulation_chunks(self, doc_id: str, title: str, text: str):
        chunks = self.chunk_text(text)
        if not chunks:
            return
            
        print(f"Mod 4: Ingesting regulation '{title}' ({doc_id}) - {len(chunks)} chunks.")
        
        for idx, chunk in enumerate(chunks):
            self.fallback_documents.append({
                "document_id": doc_id,
                "chunk_id": idx,
                "title": title,
                "text": chunk
            })

        if self.use_fallback or self.qdrant_client is None:
            return

        points = []
        for idx, chunk in enumerate(chunks):
            embedding = client.generate_embeddings(chunk)
            chunk_uuid = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{doc_id}_{idx}_mod4"))
            points.append(
                models.PointStruct(
                    id=chunk_uuid,
                    vector=embedding,
                    payload={
                        "document_id": doc_id,
                        "title": title,
                        "chunk_id": idx,
                        "text": chunk
                    }
                )
            )
            
        try:
            self.qdrant_client.upsert(
                collection_name=self.collection_name,
                points=points
            )
            print(f"Mod 4: Successfully loaded {len(points)} chunks into Qdrant for {doc_id}.")
        except Exception as e:
            print(f"Mod 4: Upsert to Qdrant failed: {e}. Stored in fallback register.")
            self.use_fallback = True

    def search_similar_chunks(self, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        if not self.use_fallback and self.qdrant_client is not None:
            try:
                query_vector = client.generate_embeddings(query)
                results = self.qdrant_client.query_points(
                    collection_name=self.collection_name,
                    query=query_vector,
                    limit=limit
                )
                return [
                    {
                        "score": r.score,
                        "document_id": r.payload.get("document_id"),
                        "title": r.payload.get("title", "Regulation standard"),
                        "chunk_id": r.payload.get("chunk_id"),
                        "text": r.payload.get("text")
                    }
                    for r in results.points
                ]
            except Exception as e:
                print(f"Mod 4: Qdrant query failed: {e}. Switching to keyword search.")
                self.use_fallback = True

        query_words = [w.lower() for w in re.findall(r'\w+', query) if len(w) > 2]
        scored_results = []
        
        for item in self.fallback_documents:
            text_lower = item["text"].lower()
            score = 0.0
            for word in query_words:
                occurrences = text_lower.count(word)
                if occurrences > 0:
                    score += occurrences * 1.5
                    
            title_lower = item["title"].lower()
            for word in query_words:
                if word in title_lower:
                    score += 5.0
                    
            if score > 0:
                norm_score = min(0.95, 0.1 + (score / (len(query_words) * 5 + 1)))
                scored_results.append((norm_score, item))
                
        scored_results.sort(key=lambda x: x[0], reverse=True)
        
        formatted = []
        for score, item in scored_results[:limit]:
            formatted.append({
                "score": score,
                "document_id": item["document_id"],
                "title": item["title"],
                "chunk_id": item["chunk_id"],
                "text": item["text"]
            })
            
        if not formatted and self.fallback_documents:
            for idx, item in enumerate(self.fallback_documents[:limit]):
                formatted.append({
                    "score": 0.1 - (idx * 0.01),
                    "document_id": item["document_id"],
                    "title": item["title"],
                    "chunk_id": item["chunk_id"],
                    "text": item["text"]
                })
        return formatted

# Singleton instance
vector_db = VectorDBWrapper()
