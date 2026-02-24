from qdrant_client import QdrantClient
from qdrant_client.http.models import Distance, VectorParams, PointStruct
from langchain_core.embeddings import Embeddings
import os
import uuid
from typing import List, Dict, Any, Optional

class MemoryManager:
    """
    Manages long-term memory for the Agent using Qdrant.
    Stores and retrieves user preferences (risk tolerance, favourite KPIs)
    and context across sessions.
    """
    def __init__(self, collection_name: str = "financial_memory"):
        # Use an in-memory client or a local file for the hackathon
        # To persist state, we map it to a local sqlite database format for qdrant
        db_path = os.path.join(os.getcwd(), "qdrant_db")
        os.makedirs(db_path, exist_ok=True)
        self.client = QdrantClient(path=db_path)
        
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
        
    def retrieve_relevant_memories(self, query: str, limit: int = 3) -> List[Dict[str, Any]]:
        """
        Retrieves memories relevant to the current user query or situation.
        """
        vector = self.embeddings.embed_query(query)
        
        search_result = self.client.search(
            collection_name=self.collection_name,
            query_vector=vector,
            limit=limit
        )
        
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
