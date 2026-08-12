"""
test_qdrant.py
~~~~~~~~~~~~~~
Verification test for Qdrant Cloud integration.
Tests connectivity, CRUD operations for both MemoryManager and DocumentStore.
"""

import os
import sys
from dotenv import load_dotenv

load_dotenv()
sys.path.append(os.path.dirname(os.path.abspath(__file__)))


def test_connectivity():
    """Test basic connectivity to Qdrant Cloud."""
    from qdrant_client import QdrantClient

    url = os.environ["QDRANT_URL"]
    api_key = os.environ["QDRANT_API_KEY"]

    client = QdrantClient(url=url, api_key=api_key, timeout=15)
    collections = client.get_collections().collections
    print(f"✅ Connected to Qdrant Cloud. Existing collections: {[c.name for c in collections]}")
    return True


def test_document_store():
    """Test DocumentStore: insert, search, list sources, delete."""
    from src.memory.qdrant_store import DocumentStore

    store = DocumentStore(collection_name="test_company_documents")
    print("\n── DocumentStore Tests ──")

    # 1. Insert
    texts = [
        "Apple Inc reported revenue of $394 billion in fiscal year 2022.",
        "Tesla's gross margin improved to 25.6% in Q3 2023.",
        "Microsoft Azure cloud revenue grew 29% year-over-year.",
    ]
    metadatas = [
        {"source": "apple_10k.pdf", "page": "1"},
        {"source": "tesla_earnings.pdf", "page": "5"},
        {"source": "microsoft_report.pdf", "page": "12"},
    ]
    ids = store.store_memories_batch(texts, metadatas)
    print(f"  ✅ Inserted {len(ids)} document chunks")
    assert len(ids) == 3

    # 2. Search (semantic only)
    results = store.retrieve_relevant_memories("Apple revenue", limit=2, use_hybrid=False)
    print(f"  ✅ Semantic search returned {len(results)} results")
    assert len(results) > 0
    assert "apple" in results[0]["text"].lower() or "revenue" in results[0]["text"].lower()
    print(f"     Top result: {results[0]['text'][:60]}... (score: {results[0]['score']:.4f})")

    # 3. Search (hybrid BM25 + cosine)
    results_hybrid = store.retrieve_relevant_memories("Tesla gross margin", limit=2, use_hybrid=True)
    print(f"  ✅ Hybrid search returned {len(results_hybrid)} results")
    assert len(results_hybrid) > 0
    print(f"     Top result: {results_hybrid[0]['text'][:60]}... (score: {results_hybrid[0]['score']:.4f})")

    # 4. List sources
    sources = store.get_all_document_sources()
    print(f"  ✅ Listed {len(sources)} document sources: {sources}")
    assert "apple_10k.pdf" in sources
    assert "tesla_earnings.pdf" in sources

    # 5. Delete by source
    success = store.delete_document_by_source("apple_10k.pdf")
    assert success
    sources_after = store.get_all_document_sources()
    print(f"  ✅ Deleted apple_10k.pdf. Remaining sources: {sources_after}")
    assert "apple_10k.pdf" not in sources_after

    # 6. Cleanup: delete remaining test data
    store.delete_document_by_source("tesla_earnings.pdf")
    store.delete_document_by_source("microsoft_report.pdf")
    
    # Delete the test collection
    from src.memory.qdrant_store import _get_client
    _get_client().delete_collection("test_company_documents")
    print("  ✅ Cleaned up test collection")

    print("── DocumentStore: ALL PASSED ──\n")


def test_memory_manager():
    """Test MemoryManager: store, retrieve, batch store."""
    from src.memory.qdrant_store import MemoryManager, _get_client

    mm = MemoryManager(collection_name="test_financial_memory")
    print("── MemoryManager Tests ──")

    # 1. Store single memory
    doc_id = mm.store_memory("User prefers value investing strategies", {"type": "preference"})
    print(f"  ✅ Stored single memory: {doc_id}")
    assert doc_id

    # 2. Store batch
    batch_ids = mm.store_memories_batch(
        ["AAPL has strong fundamentals", "TSLA is a growth stock"],
        [{"type": "insight"}, {"type": "insight"}],
    )
    print(f"  ✅ Stored batch of {len(batch_ids)} memories")
    assert len(batch_ids) == 2

    # 3. Retrieve
    results = mm.retrieve_relevant_memories("value investing", limit=2)
    print(f"  ✅ Retrieved {len(results)} relevant memories")
    assert len(results) > 0
    print(f"     Top result: {results[0]['text'][:60]}... (score: {results[0]['score']:.4f})")

    # 4. Cleanup
    _get_client().delete_collection("test_financial_memory")
    print("  ✅ Cleaned up test collection")

    print("── MemoryManager: ALL PASSED ──\n")


if __name__ == "__main__":
    print("=" * 60)
    print("  Qdrant Cloud Integration Test Suite")
    print("=" * 60)

    try:
        test_connectivity()
        test_document_store()
        test_memory_manager()
        print("🎉 ALL TESTS PASSED — Qdrant Cloud integration is working!")
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"\n❌ TEST FAILED: {e}")
        sys.exit(1)
