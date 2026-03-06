import yfinance as yf
from langchain_core.tools import tool
import json
from typing import Optional

@tool
def resolve_ticker(query: str) -> str:
    """
    Resolves a layman company name or index name (e.g., 'Nifty 50', 'Reliance Industries', 'Apple') 
     to its official stock ticker symbol used by yfinance and broker APIs.
    Returns a JSON string with the resolved ticker and company name.
    """
    try:
        # Hardcoded common indices/aliases
        aliases = {
            "nifty 50": "^NSEI",
            "nifty": "^NSEI",
            "sensex": "^BSESN",
            "bank nifty": "^NSEBANK",
            "sp 500": "^GSPC",
            "s&p 500": "^GSPC",
            "nasdaq": "^IXIC",
            "dow jones": "^DJI",
        }
        
        normalized_query = query.lower().strip()
        if normalized_query in aliases:
            return json.dumps({
                "query": query,
                "ticker": aliases[normalized_query],
                "name": query,
                "confidence": 1.0,
                "source": "alias_map"
            })

        # Use yfinance search
        # yfinance doesn't have a direct "search" method in the Ticker class that works well for names
        # But we can use the Ticker.info or just try to find it via a search query on a dummy ticker object
        # Alternatively, use a simple search heuristic or just try if the query itself is a valid ticker
        
        # Strategy: Search using yfinance's undocumented search endpoint or just use ticker validation
        import requests
        headers = {'User-Agent': 'Mozilla/5.0'}
        url = f"https://query2.finance.yahoo.com/v1/finance/search?q={query}"
        
        response = requests.get(url, headers=headers)
        data = response.json()
        
        if data.get('quotes'):
            top_result = data['quotes'][0]
            return json.dumps({
                "query": query,
                "ticker": top_result.get('symbol'),
                "name": top_result.get('shortname', top_result.get('longname', query)),
                "confidence": 0.9,
                "source": "yahoo_search"
            })
            
        return json.dumps({"error": f"Could not resolve ticker for: {query}"})
    except Exception as e:
        return json.dumps({"error": f"Ticker resolution failed: {str(e)}"})
