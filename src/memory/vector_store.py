from qdrant_client import QdrantClient
from qdrant_client.http.models import Distance, VectorParams, PointStruct
from langchain_core.embeddings import Embeddings
import os
import uuid
from typing import List, Dict, Any, Optional

# Singleton client to prevent multiple instances from locking the local database
_qdrant_client = None

def _get_qdrant_client():
    global _qdrant_client
    if _qdrant_client is None:
        db_path = os.path.join(os.getcwd(), "qdrant_db")
        os.makedirs(db_path, exist_ok=True)
        _qdrant_client = QdrantClient(path=db_path)
    return _qdrant_client

class MemoryManager:
    """
    Manages long-term memory for the Agent using Qdrant.
    Stores and retrieves user preferences (risk tolerance, favourite KPIs)
    and context across sessions.
    """
    def __init__(self, collection_name: str = "financial_memory"):
        # Use an in-memory client or a local file for the hackathon
        # To persist state, we map it to a local sqlite database format for qdrant
        self.client = _get_qdrant_client()
        
        self.collection_name = collection_name
        
        # Use HuggingFace local embeddings
        try:
             from langchain_huggingface import HuggingFaceEmbeddings
             # all-MiniLM-L6-v2 is a great fast, small local model for this
             self.embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
             self.vector_size = 384 # specific to all-MiniLM-L6-v2
        except Exception as e:
             print(f"Warning: Failed to load HuggingFace embeddings. {e}")
        
        # Initialize collection if it doesn't exist
        self._init_collection()
        
    def _init_collection(self):
        """Creates the Qdrant collection if it doesn't already exist."""
        collections = self.client.get_collections().collections
        exists = any(c.name == self.collection_name for c in collections)
        
        if not exists:
            self.client.create_collection(
                collection_name=self.collection_name,
                vectors_config=VectorParams(size=self.vector_size, distance=Distance.COSINE),
            )
            
    def store_memory(self, text: str, metadata: Dict[str, Any] = None):
        """
        Stores a new memory (e.g., 'User prefers conservative investments' or 'User cares about EBITDA')
        """
        metadata = metadata or {}
        vector = self.embeddings.embed_query(text)
        
        point_id = str(uuid.uuid4())
        
        self.client.upsert(
            collection_name=self.collection_name,
            points=[
                PointStruct(
                    id=point_id,
                    vector=vector,
                    payload={"text": text, **metadata}
                )
            ]
        )
        return point_id

    def store_memories_batch(self, texts: List[str], metadatas: List[Dict[str, Any]] = None):
        """
        Stores multiple memories in a single batch to speed up embedding and network overhead.
        """
        if not texts:
            return []
            
        metadatas = metadatas or [{} for _ in texts]
        vectors = self.embeddings.embed_documents(texts)
        
        points = []
        for text, meta, vector in zip(texts, metadatas, vectors):
            point_id = str(uuid.uuid4())
            points.append(
                PointStruct(
                    id=point_id,
                    vector=vector,
                    payload={"text": text, **meta}
                )
            )
            
        self.client.upsert(
            collection_name=self.collection_name,
            points=points
        )
        return [p.id for p in points]
        
    def retrieve_relevant_memories(self, query: str, limit: int = 3) -> List[Dict[str, Any]]:
        """
        Retrieves memories relevantw to the current user query or situation.
        """
        vector = self.embeddings.embed_query(query)
        
        query_response = self.client.query_points(
            collection_name=self.collection_name,
            query=vector,
            limit=limit
        )
        search_result = query_response.points
        
        return [
            {
                "id": hit.id,
                "score": hit.score,
                "text": hit.payload.get("text", ""),
                "metadata": {k: v for k, v in hit.payload.items() if k != "text"}
            }
            for hit in search_result
        ]
        
    def get_all_preferences_summary(self) -> str:
        """
        Retrieves a summary of all explicit user preferences stored (risk, kpis, etc)
        Useful for injecting into the system prompt.
        """
        # Fetch practically everything (assumes small scale for personal memory)
        results = self.client.scroll(
            collection_name=self.collection_name,
            limit=50,
            with_payload=True,
            with_vectors=False
        )
        
        memories = reversed([point.payload.get('text') for point in results[0] if point.payload.get('text')])
        if not memories:
            return "No specific preferences remembered yet."
            
        return "\n".join([f"- {m}" for m in set(memories)])

    def get_all_document_sources(self) -> List[str]:
        """
        Retrieves a list of all unique document sources uploaded and indexed in this collection.
        Valuable for maintaining persistent UI state across reloads.
        """
        try:
            results = self.client.scroll(
                collection_name=self.collection_name,
                limit=1000, 
                with_payload=True,
                with_vectors=False
            )
            
            # Extract unique 'source' values from payload metadata
            sources = set()
            for point in results[0]:
                if point.payload and 'source' in point.payload:
                    sources.add(point.payload['source'])
                    
            return list(sources)
        except Exception as e:
            print(f"Error fetching document sources: {e}")
            return []
