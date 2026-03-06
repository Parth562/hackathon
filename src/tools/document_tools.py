from langchain_core.tools import tool

# Lazy load pattern so we don't boot up 5 PyTorch FAISS instances at once (fixes OOM error 1455)
_document_store_instance = None

def get_document_store():
    global _document_store_instance
    if _document_store_instance is None:
        from src.memory.vector_store import DocumentStore
        _document_store_instance = DocumentStore()
    return _document_store_instance

@tool
def search_company_documents(query: str) -> str:
    """
    Searches uploaded company papers, PDFs, and internal documents for information matching the query.
    Use this tool whenever the user asks about 'uploaded documents', 'company papers', or 'internal data'.
    """
    store = get_document_store()
    results = store.retrieve_relevant_memories(query, limit=5)

    if not results:
        return "No relevant information found in the uploaded company documents."

    context = "Retrieved from uploaded company documents:\n\n"
    for idx, hit in enumerate(results):
        source = hit.get("metadata", {}).get("source", "Unknown Document")
        context += f"--- Excerpt {idx+1} (Source: {source}) ---\n{hit['text']}\n\n"

    return context
