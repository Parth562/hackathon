from langchain_core.tools import tool
from src.memory.vector_store import DocumentStore

# Shared document store backed by local FAISS index
document_store = DocumentStore()

@tool
def search_company_documents(query: str) -> str:
    """
    Searches uploaded company papers, PDFs, and internal documents for information matching the query.
    Use this tool whenever the user asks about 'uploaded documents', 'company papers', or 'internal data'.
    """
    results = document_store.retrieve_relevant_memories(query, limit=5)

    if not results:
        return "No relevant information found in the uploaded company documents."

    context = "Retrieved from uploaded company documents:\n\n"
    for idx, hit in enumerate(results):
        source = hit.get("metadata", {}).get("source", "Unknown Document")
        context += f"--- Excerpt {idx+1} (Source: {source}) ---\n{hit['text']}\n\n"

    return context
