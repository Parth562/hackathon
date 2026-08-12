import os
import requests
from langchain_core.tools import tool

# Using the provided Massive API Key (which acts like a Polygon.io key)
MASSIVE_API_KEY = os.environ.get("MASSIVE_API_KEY", "Ef8vFpEabZ_GfFQCQGC3knfetzexv2p3")

@tool
def fetch_massive_news(ticker: str) -> str:
    """
    Fetch the latest news for a given ticker using the Massive.com API.
    """
    try:
        # Massive API often aliases to Polygon.io structures
        url = f"https://api.polygon.io/v2/reference/news?ticker={ticker}&limit=5&apiKey={MASSIVE_API_KEY}"
        response = requests.get(url, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            results = data.get("results", [])
            if not results:
                return str([{"title": f"No recent news found for {ticker}."}])
                
            news_items = []
            for item in results:
                news_items.append({
                    "title": item.get("title"),
                    "publisher": item.get("publisher", {}).get("name"),
                    "published_utc": item.get("published_utc"),
                    "description": item.get("description")
                })
            return str(news_items)
        else:
            return str({"error": f"Failed to fetch news from Massive API: {response.text}"})
    except Exception as e:
        return str({"error": f"Exception fetching massive news for {ticker}: {str(e)}"})
