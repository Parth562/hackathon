from typing import List, Dict, Any
import requests
import io
from PyPDF2 import PdfReader
from duckduckgo_search import DDGS
from langchain_core.tools import tool

@tool
def search_pdf_content(query: str, max_results: int = 3) -> str:
    """
    Searches for PDF documents on the web related to the query using Google Dorking techniques (filetype:pdf).
    Downloads and extracts text from the most relevant PDFs to provide high-quality research context.
    Returns the extracted text from the top PDF results.
    """
    try:
        pdf_query = f"{query} filetype:pdf"
        results = []
        
        with DDGS() as ddgs:
            # Get search results for PDFs
            search_results = list(ddgs.text(pdf_query, max_results=max_results))
            
            for r in search_results:
                url = r.get('href')
                if not url or not url.lower().endswith('.pdf'):
                    # Some search results might not be direct PDF links even with filetype:pdf
                    # But often they are. We can try to download anyway if we suspect it's a PDF.
                    if 'pdf' not in url.lower() and 'pdf' not in r.get('body', '').lower():
                        continue
                
                try:
                    # Download the PDF
                    response = requests.get(url, timeout=15)
                    if response.status_code == 200:
                        # Parse PDF content
                        with io.BytesIO(response.content) as open_pdf_file:
                            reader = PdfReader(open_pdf_file)
                            text = ""
                            # Extract first few pages to stay within token limits
                            max_pages = 10
                            for i in range(min(len(reader.pages), max_pages)):
                                page_text = reader.pages[i].extract_text()
                                if page_text:
                                    text += page_text + "\n"
                            
                            if text.strip():
                                # Limit text size
                                max_chars = 6000
                                if len(text) > max_chars:
                                    text = text[:max_chars] + "\n...[Content Truncated]..."
                                
                                results.append({
                                    "title": r.get('title', 'Untitled PDF'),
                                    "url": url,
                                    "content": text
                                })
                except Exception as e_pdf:
                    print(f"Failed to process PDF from {url}: {e_pdf}")
                    continue
        
        if not results:
            return "No PDF results found or failed to extract content from them."
            
        formatted_output = ""
        for i, res in enumerate(results):
            formatted_output += f"--- Result {i+1}: {res['title']} ---\nURL: {res['url']}\nContent:\n{res['content']}\n\n"
            
        return formatted_output
        
    except Exception as e:
        return f"PDF search and extraction failed: {str(e)}"
