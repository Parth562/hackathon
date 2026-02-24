from typing import List, Dict, Any
from langchain_core.tools import tool
from duckduckgo_search import DDGS
from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup
import time

@tool
def search_web(query: str, max_results: int = 5) -> str:
    """
    Search the web for recent news, reports, or articles using DuckDuckGo.
    Returns a formatted string of titles, links, and snippets.
    """
    try:
        results = []
        with DDGS() as ddgs:
            for r in ddgs.text(query, max_results=max_results):
                results.append(f"Title: {r.get('title', '')}\nURL: {r.get('href', '')}\nSnippet: {r.get('body', '')}\n")
        
        if not results:
            return "No results found."
            
        return "\n---\n".join(results)
    except Exception as e:
        return f"Web search failed: {str(e)}"

@tool
def scrape_webpage(url: str) -> str:
    """
    Scrape the text content of a single webpage using a headless browser.
    Useful for reading full investor relations announcements or news articles.
    Returns the clean text extracted from the page.
    """
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            
            # Navigate and explicitly wait for some time to let JS render
            page.goto(url, wait_until="networkidle", timeout=30000)
            time.sleep(2) # Additional brief wait for tricky sites
            
            html_content = page.content()
            browser.close()
            
            # Parse with BeautifulSoup to extract clean text
            soup = BeautifulSoup(html_content, "html.parser")
            
            # Remove scripts, styles
            for script in soup(["script", "style", "header", "footer", "nav"]):
                script.decompose()
                
            text = soup.get_text(separator='\n')
            
            # Clean up whitespace
            lines = (line.strip() for line in text.splitlines())
            chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
            clean_text = '\n'.join(chunk for chunk in chunks if chunk)
            
            # Limit the size returned to avoid blowing up the LLM token limit
            # ~8000 characters is a safe chunk for modern LLMs that summarizes well
            max_chars = 8000
            if len(clean_text) > max_chars:
                clean_text = clean_text[:max_chars] + "\n...[Content Truncated]..."
                
            return str({
                "url": url,
                "text": clean_text
            })
    except Exception as e:
        return {"error": f"Failed to scrape {url}: {str(e)}"}
