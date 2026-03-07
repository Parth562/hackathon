"""
qdrant_store.py
~~~~~~~~~~~~~~~
Cloud-hosted vector store backed by Qdrant Cloud.

Drop-in replacement for the FAISS-backed vector_store.py.
Embedding model : sentence-transformers/all-MiniLM-L6-v2  (384-dim)
Distance metric : Cosine
"""

import os
import uuid
from typing import List, Dict, Any, Optional

from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    VectorParams,
    PointStruct,
    Filter,
    FieldCondition,
    MatchValue,
    models,
)
from langchain_huggingface import HuggingFaceEmbeddings

# ── Device detection ──────────────────────────────────────────────────────────

def _best_device() -> str:
    """Return 'cuda', 'mps', or 'cpu' depending on what's available."""
    try:
        import torch
        if torch.cuda.is_available():
            return "cuda"
        if torch.backends.mps.is_available():
            return "mps"
    except ImportError:
        pass
    return "cpu"


# ── Shared embedding model (singleton, loaded once per process) ───────────────

_embeddings: Optional[HuggingFaceEmbeddings] = None
_EMBED_DIM = 384  # all-MiniLM-L6-v2 output dimension


def _get_embeddings() -> HuggingFaceEmbeddings:
    global _embeddings
    if _embeddings is None:
        device = _best_device()
        _embeddings = HuggingFaceEmbeddings(
            model_name="sentence-transformers/all-MiniLM-L6-v2",
            model_kwargs={"device": device},
            encode_kwargs={
                "batch_size": 64,
                "normalize_embeddings": True,
            },
        )
        print(f"[QdrantStore] Embedding model loaded on device: {device}")
    return _embeddings


# ── Qdrant client singleton ──────────────────────────────────────────────────

_qdrant_client: Optional[QdrantClient] = None


def _get_client() -> QdrantClient:
    global _qdrant_client
    if _qdrant_client is None:
        url = os.environ.get("QDRANT_URL")
        api_key = os.environ.get("QDRANT_API_KEY")
        if not url or not api_key:
            raise RuntimeError(
                "QDRANT_URL and QDRANT_API_KEY must be set in .env"
            )
        _qdrant_client = QdrantClient(url=url, api_key=api_key, timeout=30)
        print(f"[QdrantStore] Connected to Qdrant Cloud: {url}")
    return _qdrant_client


def _ensure_collection(name: str) -> None:
    """Create the collection if it does not already exist, and ensure payload index."""
    client = _get_client()
    existing = [c.name for c in client.get_collections().collections]
    if name not in existing:
        client.create_collection(
            collection_name=name,
            vectors_config=VectorParams(
                size=_EMBED_DIM,
                distance=Distance.COSINE,
            ),
        )
        print(f"[QdrantStore] Created collection: {name}")

    # Always ensure the 'source' payload index exists (idempotent)
    try:
        client.create_payload_index(
            collection_name=name,
            field_name="source",
            field_schema=models.PayloadSchemaType.KEYWORD,
        )
    except Exception:
        pass  # Index already exists


# ─────────────────────────────────────────────────────────────────────────────
# MemoryManager
# ─────────────────────────────────────────────────────────────────────────────

class MemoryManager:
    """Long-term agent memory backed by Qdrant Cloud."""

    COLLECTION = "financial_memory"

    def __init__(self, collection_name: str = "financial_memory"):
        self.COLLECTION = collection_name
        _ensure_collection(self.COLLECTION)

    # ── Public API ────────────────────────────────────────────────────────────

    def store_memory(self, text: str, metadata: Dict[str, Any] = None) -> str:
        metadata = metadata or {}
        doc_id = str(uuid.uuid4())
        emb = _get_embeddings()
        vector = emb.embed_query(text)

        _get_client().upsert(
            collection_name=self.COLLECTION,
            points=[
                PointStruct(
                    id=doc_id,
                    vector=vector,
                    payload={"text": text, **metadata},
                )
            ],
        )
        return doc_id

    def store_memories_batch(
        self, texts: List[str], metadatas: List[Dict[str, Any]] = None
    ) -> List[str]:
        if not texts:
            return []
        metadatas = metadatas or [{} for _ in texts]
        ids = [str(uuid.uuid4()) for _ in texts]

        emb = _get_embeddings()
        vectors = emb.embed_documents(texts)

        points = [
            PointStruct(
                id=doc_id,
                vector=vec,
                payload={"text": t, **m},
            )
            for doc_id, vec, t, m in zip(ids, vectors, texts, metadatas)
        ]

        # Qdrant supports batch upsert up to ~100 points at a time efficiently
        BATCH = 100
        client = _get_client()
        for i in range(0, len(points), BATCH):
            client.upsert(
                collection_name=self.COLLECTION,
                points=points[i : i + BATCH],
            )

        return ids

    def retrieve_relevant_memories(
        self, query: str, limit: int = 3, use_mmr: bool = False
    ) -> List[Dict[str, Any]]:
        emb = _get_embeddings()
        query_vector = emb.embed_query(query)

        results = _get_client().query_points(
            collection_name=self.COLLECTION,
            query=query_vector,
            limit=limit,
            with_payload=True,
        ).points

        return [
            {
                "id": str(hit.id),
                "score": float(hit.score) if hit.score is not None else None,
                "text": hit.payload.get("text", ""),
                "metadata": {
                    k: v for k, v in hit.payload.items() if k != "text"
                },
            }
            for hit in results
        ]

    def delete_document_by_source(self, source_filename: str) -> bool:
        return True

    def get_all_preferences_summary(self) -> str:
        return "Preferences are stored in the Qdrant Cloud memory collection."

    def get_all_document_sources(self) -> List[str]:
        return []


# ─────────────────────────────────────────────────────────────────────────────
# DocumentStore
# ─────────────────────────────────────────────────────────────────────────────

class DocumentStore:
    """
    Company document store for RAG backed by Qdrant Cloud.

    Key design decisions
    --------------------
    - Uses Qdrant Cloud with cosine distance on 384-dim embeddings.
    - Tracks source → [point_ids] via payload filtering for efficient deletion.
    - Hybrid BM25 + cosine search with Reciprocal Rank Fusion is preserved.
    """

    COLLECTION = "company_documents"

    def __init__(self, collection_name: str = "company_documents"):
        self.COLLECTION = collection_name
        _ensure_collection(self.COLLECTION)

    # ── Public API ────────────────────────────────────────────────────────────

    def store_memories_batch(
        self, texts: List[str], metadatas: List[Dict[str, Any]] = None
    ) -> List[str]:
        """
        Ingest chunks into the Qdrant collection.
        Embeddings are computed in batches of 64 by the sentence-transformer model.
        """
        if not texts:
            return []
        metadatas = metadatas or [{} for _ in texts]
        ids = [str(uuid.uuid4()) for _ in texts]

        emb = _get_embeddings()
        vectors = emb.embed_documents(texts)

        points = [
            PointStruct(
                id=doc_id,
                vector=vec,
                payload={
                    "text": t,
                    **{k: str(v) for k, v in m.items()},
                },
            )
            for doc_id, vec, t, m in zip(ids, vectors, texts, metadatas)
        ]

        BATCH = 100
        client = _get_client()
        for i in range(0, len(points), BATCH):
            client.upsert(
                collection_name=self.COLLECTION,
                points=points[i : i + BATCH],
            )

        return ids

    def retrieve_relevant_memories(
        self,
        query: str,
        limit: int = 5,
        use_mmr: bool = False,
        use_hybrid: bool = True,
    ) -> List[Dict[str, Any]]:
        """Similarity search (hybrid cosine + BM25). Returns top-k results with scores."""
        emb = _get_embeddings()
        query_vector = emb.embed_query(query)

        # Semantic search via Qdrant
        qdrant_hits = _get_client().query_points(
            collection_name=self.COLLECTION,
            query=query_vector,
            limit=limit * 2,
            with_payload=True,
        ).points

        semantic_results = [
            {
                "id": str(hit.id),
                "score": float(hit.score) if hit.score is not None else 0.0,
                "text": hit.payload.get("text", ""),
                "metadata": {
                    k: v for k, v in hit.payload.items() if k != "text"
                },
            }
            for hit in qdrant_hits
        ]

        if not use_hybrid:
            return semantic_results[:limit]

        # ── BM25 lexical search on the Qdrant candidate pool ─────────────
        try:
            from rank_bm25 import BM25Okapi

            # Scroll ALL documents from the collection for BM25 ranking
            all_docs = []
            offset = None
            client = _get_client()
            while True:
                scroll_result = client.scroll(
                    collection_name=self.COLLECTION,
                    limit=500,
                    offset=offset,
                    with_payload=True,
                    with_vectors=False,
                )
                points, next_offset = scroll_result
                all_docs.extend(points)
                if next_offset is None:
                    break
                offset = next_offset

            if not all_docs:
                return semantic_results[:limit]

            corpus_texts = [p.payload.get("text", "") for p in all_docs]
            tokenized_corpus = [t.lower().split(" ") for t in corpus_texts]
            bm25 = BM25Okapi(tokenized_corpus)
            tokenized_query = query.lower().split(" ")
            bm25_scores = bm25.get_scores(tokenized_query)

            bm25_ranked = []
            for idx, score in enumerate(bm25_scores):
                if score > 0:
                    p = all_docs[idx]
                    bm25_ranked.append(
                        {
                            "id": str(p.id),
                            "score": float(score),
                            "text": p.payload.get("text", ""),
                            "metadata": {
                                k: v
                                for k, v in p.payload.items()
                                if k != "text"
                            },
                        }
                    )
            bm25_ranked.sort(key=lambda x: x["score"], reverse=True)
            bm25_ranked = bm25_ranked[: limit * 2]

            # Reciprocal Rank Fusion (RRF)
            k = 60
            rrf_scores: Dict[str, float] = {}
            doc_map: Dict[str, Dict] = {}

            for rank, item in enumerate(semantic_results):
                text_key = item["text"]
                doc_map[text_key] = item
                rrf_scores[text_key] = rrf_scores.get(text_key, 0) + (
                    1.0 / (k + rank + 1)
                )

            for rank, item in enumerate(bm25_ranked):
                text_key = item["text"]
                if text_key not in doc_map:
                    doc_map[text_key] = item
                rrf_scores[text_key] = rrf_scores.get(text_key, 0) + (
                    1.0 / (k + rank + 1)
                )

            fused_results = []
            for text_key, rrf_score in sorted(
                rrf_scores.items(), key=lambda x: x[1], reverse=True
            ):
                item = doc_map[text_key]
                item["score"] = rrf_score
                fused_results.append(item)

            return fused_results[:limit]

        except ImportError:
            return semantic_results[:limit]

    def delete_document_by_source(self, source_filename: str) -> bool:
        """Delete all vectors for a given source document using payload filtering."""
        try:
            _get_client().delete(
                collection_name=self.COLLECTION,
                points_selector=models.FilterSelector(
                    filter=Filter(
                        must=[
                            FieldCondition(
                                key="source",
                                match=MatchValue(value=source_filename),
                            )
                        ]
                    )
                ),
            )
            return True
        except Exception as e:
            print(f"[DocumentStore] Failed to delete '{source_filename}': {e}")
            return False

    def get_all_document_sources(self) -> List[str]:
        """Return a sorted list of unique source filenames in the collection."""
        sources = set()
        offset = None
        client = _get_client()
        while True:
            scroll_result = client.scroll(
                collection_name=self.COLLECTION,
                limit=500,
                offset=offset,
                with_payload=["source"],
                with_vectors=False,
            )
            points, next_offset = scroll_result
            for p in points:
                src = p.payload.get("source")
                if src:
                    sources.add(src)
            if next_offset is None:
                break
            offset = next_offset

        return sorted(sources)
