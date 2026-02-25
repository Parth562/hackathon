import os
from typing import List
from langchain_core.tools import tool
from src.memory.vector_store import MemoryManager

# Use the same memory manager instance or create a new one for company documents
# to keep them separate from user preferences. For simplicity, we'll store
# them in a distinct collection name.
document_store = MemoryManager(collection_name="company_documents")

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
        source = hit.get('metadata', {}).get('source', 'Unknown Document')
        context += f"--- Excerpt {idx+1} (Source: {source}) ---\n{hit['text']}\n\n"
        
    return context
