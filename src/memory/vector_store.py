"""
vector_store.py
~~~~~~~~~~~~~~~
Local, disk-persisted vector store backed by LangChain FAISS.

Embedding model : sentence-transformers/all-MiniLM-L6-v2
                  (GPU-accelerated when CUDA/MPS is available, falls back to CPU)
FAISS index     : IndexFlatIP  (inner-product / cosine on L2-normalised vectors —
                  faster than L2 in high-dimensional space)
Deletion        : uses FAISS's native delete(ids=[...]) — no full-index rebuild.
"""

import os
import json
import uuid
from typing import List, Dict, Any, Optional

import faiss
from langchain_community.docstore.in_memory import InMemoryDocstore
from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_core.documents import Document

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
                "batch_size": 64,           # process 64 chunks at a time
                "normalize_embeddings": True,  # required for cosine via dot-product
            },
        )
        print(f"[VectorStore] Embedding model loaded on device: {device}")
    return _embeddings


# ── Paths ─────────────────────────────────────────────────────────────────────

FAISS_DIR = os.path.join(os.path.dirname(__file__), "faiss_store")


def _index_path(namespace: str) -> str:
    return os.path.join(FAISS_DIR, namespace)


def _id_map_path(namespace: str) -> str:
    """JSON file: { source_filename -> [faiss_doc_id, ...] }"""
    return os.path.join(_index_path(namespace), "source_id_map.json")


# ── FAISS store factory ───────────────────────────────────────────────────────

def _new_faiss_store(emb: HuggingFaceEmbeddings) -> FAISS:
    """Create a brand-new, empty FAISS store with an IndexFlatIP index."""
    index = faiss.IndexFlatIP(_EMBED_DIM)  # cosine similarity on normalised vecs
    return FAISS(
        embedding_function=emb,
        index=index,
        docstore=InMemoryDocstore(),
        index_to_docstore_id={},
    )


def _load_or_create(namespace: str) -> FAISS:
    path = _index_path(namespace)
    emb = _get_embeddings()
    if os.path.isdir(path) and os.path.isfile(os.path.join(path, "index.faiss")):
        return FAISS.load_local(path, emb, allow_dangerous_deserialization=True)
    store = _new_faiss_store(emb)
    os.makedirs(path, exist_ok=True)
    store.save_local(path)
    return store


# ── Source → doc-ID map helpers ───────────────────────────────────────────────

def _load_id_map(namespace: str) -> Dict[str, List[str]]:
    p = _id_map_path(namespace)
    if os.path.isfile(p):
        with open(p, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def _save_id_map(namespace: str, id_map: Dict[str, List[str]]) -> None:
    with open(_id_map_path(namespace), "w", encoding="utf-8") as f:
        json.dump(id_map, f)


# ─────────────────────────────────────────────────────────────────────────────
# MemoryManager
# ─────────────────────────────────────────────────────────────────────────────

class MemoryManager:
    """Long-term agent memory backed by a local FAISS index."""

    def __init__(self, collection_name: str = "financial_memory"):
        self.namespace = "memories"
        self._store_instance = None

    @property
    def _store(self):
        if self._store_instance is None:
            self._store_instance = _load_or_create(self.namespace)
        return self._store_instance

    # ── Internal ──────────────────────────────────────────────────────────────

    def _save(self):
        self._store.save_local(_index_path(self.namespace))

    # ── Public API ────────────────────────────────────────────────────────────

    def store_memory(self, text: str, metadata: Dict[str, Any] = None) -> str:
        metadata = metadata or {}
        doc_id = str(uuid.uuid4())
        self._store.add_documents(
            [Document(page_content=text, metadata=metadata)],
            ids=[doc_id],
        )
        self._save()
        return doc_id

    def store_memories_batch(
        self, texts: List[str], metadatas: List[Dict[str, Any]] = None
    ) -> List[str]:
        if not texts:
            return []
        metadatas = metadatas or [{} for _ in texts]
        ids = [str(uuid.uuid4()) for _ in texts]
        docs = [Document(page_content=t, metadata=m) for t, m in zip(texts, metadatas)]
        self._store.add_documents(docs, ids=ids)
        self._save()
        return ids

    def retrieve_relevant_memories(
        self, query: str, limit: int = 3, use_mmr: bool = False
    ) -> List[Dict[str, Any]]:
        if self._store.index.ntotal == 0:
            return []
        if use_mmr:
            hits = self._store.max_marginal_relevance_search(query, k=limit)
            return [
                {"id": "", "score": None, "text": doc.page_content, "metadata": doc.metadata}
                for doc in hits
            ]
        hits = self._store.similarity_search_with_score(query, k=limit)
        return [
            {
                "id": "",
                "score": float(score),
                "text": doc.page_content,
                "metadata": doc.metadata,
            }
            for doc, score in hits
        ]

    def delete_document_by_source(self, source_filename: str) -> bool:
        return True

    def get_all_preferences_summary(self) -> str:
        return "Preferences are stored in the local FAISS memory index."

    def get_all_document_sources(self) -> List[str]:
        return []


# ─────────────────────────────────────────────────────────────────────────────
# DocumentStore
# ─────────────────────────────────────────────────────────────────────────────

class DocumentStore:
    """
    Company document store for RAG backed by a local FAISS index.

    Key design decisions
    --------------------
    - Uses IndexFlatIP + L2-normalised embeddings (≡ cosine similarity).
    - Tracks source → [doc_ids] in a JSON sidecar so deletion is a fast
      native FAISS delete(ids=[...]) — no index rebuild required.
    - Embedding batches are processed at batch_size=64 for maximum throughput.
    """

    def __init__(self, collection_name: str = "company_documents"):
        self.namespace = "documents"
        self._store_instance = None
        self._id_map_instance = None

    @property
    def _store(self):
        if self._store_instance is None:
            self._store_instance = _load_or_create(self.namespace)
        return self._store_instance

    @property
    def _id_map(self):
        if self._id_map_instance is None:
            self._id_map_instance = _load_id_map(self.namespace)
        return self._id_map_instance

    # ── Persistence helpers ───────────────────────────────────────────────────

    def _save(self):
        self._store.save_local(_index_path(self.namespace))
        _save_id_map(self.namespace, self._id_map)

    # ── Public API ────────────────────────────────────────────────────────────

    def store_memories_batch(
        self, texts: List[str], metadatas: List[Dict[str, Any]] = None
    ) -> List[str]:
        """
        Ingest chunks into the FAISS index.
        Embeddings are computed in batches of 64 by the sentence-transformer model.
        Saves the index and source-ID map once, after all chunks are added.
        """
        if not texts:
            return []
        metadatas = metadatas or [{} for _ in texts]
        ids = [str(uuid.uuid4()) for _ in texts]

        docs = [
            Document(
                page_content=t,
                metadata={k: str(v) for k, v in m.items()},  # FAISS metadata must be str
            )
            for t, m in zip(texts, metadatas)
        ]

        # add_documents triggers a single batched encode call internally
        self._store.add_documents(docs, ids=ids)

        # Update source → id_map
        for doc_id, m in zip(ids, metadatas):
            src = m.get("source")
            if src:
                self._id_map.setdefault(src, []).append(doc_id)

        self._save()
        return ids

    def retrieve_relevant_memories(
        self, query: str, limit: int = 5, use_mmr: bool = False, use_hybrid: bool = True
    ) -> List[Dict[str, Any]]:
        """Similarity search (hybrid cosine + bm25). Returns top-k results with scores."""
        if self._store.index.ntotal == 0:
            return []
            
        # Get Semantic Results (FAISS)
        if use_mmr:
            faiss_hits = self._store.max_marginal_relevance_search(query, k=limit*2)
            faiss_results = [
                {
                    "id": str(i), 
                    "score": 1.0 / (i + 1), # mock score for RRF
                    "text": doc.page_content,
                    "metadata": doc.metadata,
                }
                for i, doc in enumerate(faiss_hits)
            ]
        else:
            faiss_hits = self._store.similarity_search_with_score(query, k=limit*2)
            faiss_results = [
                {
                    "id": str(i),
                    "score": float(score),
                    "text": doc.page_content,
                    "metadata": doc.metadata,
                }
                for i, (doc, score) in enumerate(faiss_hits)
            ]

        if not use_hybrid:
            return faiss_results[:limit]
            
        # Get Lexical Results (BM25)
        try:
            from rank_bm25 import BM25Okapi
            # We need the full pool of documents
            all_docs_dict = self._store.docstore._dict
            all_docs = list(all_docs_dict.values())
            
            if not all_docs:
                return faiss_results[:limit]
                
            tokenized_corpus = [doc.page_content.lower().split(" ") for doc in all_docs]
            bm25 = BM25Okapi(tokenized_corpus)
            tokenized_query = query.lower().split(" ")
            
            bm25_scores = bm25.get_scores(tokenized_query)
            
            # Sort all docs by BM25 score
            bm25_ranked = []
            for idx, score in enumerate(bm25_scores):
                if score > 0:
                    bm25_ranked.append({
                        "id": str(idx),
                        "score": score,
                        "text": all_docs[idx].page_content,
                        "metadata": all_docs[idx].metadata
                    })
                    
            bm25_ranked = sorted(bm25_ranked, key=lambda x: x["score"], reverse=True)[:limit*2]
            
            # Reciprocal Rank Fusion (RRF)
            # RRF Score = 1 / (k + rank)
            k = 60
            rrf_scores = {}
            doc_map = {}
            
            for rank, item in enumerate(faiss_results):
                text_key = item["text"]
                doc_map[text_key] = item
                rrf_scores[text_key] = rrf_scores.get(text_key, 0) + (1.0 / (k + rank + 1))
                
            for rank, item in enumerate(bm25_ranked):
                text_key = item["text"]
                if text_key not in doc_map:
                    doc_map[text_key] = item
                rrf_scores[text_key] = rrf_scores.get(text_key, 0) + (1.0 / (k + rank + 1))
                
            # Sort by fused score
            fused_results = []
            for text_key, rrf_score in sorted(rrf_scores.items(), key=lambda x: x[1], reverse=True):
                item = doc_map[text_key]
                item["score"] = rrf_score
                fused_results.append(item)
                
            return fused_results[:limit]
            
        except ImportError:
            # Fallback to pure semantic search if BM25 isn't available
            return faiss_results[:limit]

    def delete_document_by_source(self, source_filename: str) -> bool:
        """
        Delete all vectors for a given source document.
        Uses FAISS's native delete(ids=[...]) — O(n) scan but no rebuild needed.
        """
        ids_to_delete = self._id_map.get(source_filename, [])
        if not ids_to_delete:
            return True  # nothing to remove
        try:
            self._store.delete(ids=ids_to_delete)
            del self._id_map[source_filename]
            self._save()
            return True
        except Exception as e:
            print(f"[DocumentStore] Failed to delete '{source_filename}': {e}")
            return False

    def get_all_document_sources(self) -> List[str]:
        return sorted(self._id_map.keys())
