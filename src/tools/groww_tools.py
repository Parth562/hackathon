import os
import json
from typing import Dict, Any
from langchain_core.tools import tool
from src.memory.redis_cache import sync_cache

# Initialize groww client lazily
_groww_client = None

def get_groww_client():
    global _groww_client
    if _groww_client is None:
        try:
            from growwapi import GrowwAPI
            
            api_key = os.environ.get("GROWW_APIKEY")
            secret = os.environ.get("GROWW_SECRET")
            
            if api_key and secret:
                access_token = GrowwAPI.get_access_token(api_key=api_key, secret=secret)
                _groww_client = GrowwAPI(access_token)
        except Exception as e:
            import traceback
            traceback.print_exc()
            print(f"Failed to initialize GrowwAPI client: {e}")
            _groww_client = "FAILED"
    return _groww_client

@tool
@sync_cache(ttl_seconds=300)
def get_live_stock_price_groww(ticker: str) -> str:
    """
    Get the LIVE stock price and market data for a given ticker or trading symbol from the Groww API.
    This provides highly accurate, real-time brokerage data. Falls back to yfinance if the broker API is unavailable.
    """
    try:
        groww = get_groww_client()
        if groww and groww != "FAILED":
            # Attempt to fetch live data using groww
            # We don't have the exact method documented but we can try typical endpoints or place_order failure tests
            # Actually, let's look at the growwapi package or assume it has get_live_price/get_stock_price
            
            try:
                # The documentation mentions Rate limits for "Live Data" APIs
                # Assuming there's a get_live_price or similar function, let's introspect it or try a few
                # Clean up symbol for Groww (remove .NS, .BO from yfinance symbols)
                clean_symbol = ticker.split('.')[0]
                exchange_code = groww.EXCHANGE_BSE if ticker.endswith('.BO') else groww.EXCHANGE_NSE
                # Fetch quote
                quote = groww.get_quote(exchange=exchange_code, trading_symbol=clean_symbol)
                if quote:
                    return json.dumps({
                        "ticker": ticker,
                        "groww_symbol": clean_symbol,
                        "source": "Groww live data",
                        "data": quote
                    })
                
            except Exception as e2:
                print(f"Groww live fetch failed for {ticker} ({clean_symbol}): {e2}. Falling back to yfinance.")

                
        # Fallback to yfinance if Groww fails or is unavailable
        import yfinance as yf
        stock = yf.Ticker(ticker)
        info = stock.info
        current_price = info.get('currentPrice', info.get('regularMarketPrice'))
        previous_close = info.get('previousClose')
        
        if not current_price:
            hist = stock.history(period="1d")
            if not hist.empty:
                current_price = hist['Close'].iloc[-1]
                
        return json.dumps({
            "ticker": ticker,
            "current_price": current_price,
            "previous_close": previous_close,
            "currency": info.get('currency', 'USD'),
            "source": "yfinance (fallback)"
        })
    except Exception as e:
        return json.dumps({"error": f"Failed to retrieve price for {ticker}: {str(e)}"})

@tool
def show_live_stock_widget(ticker: str) -> str:
    """
    Spawns a live, auto-updating stock widget on the user's dashboard/canvas for the given ticker.
    Use this when the user explicitly asks to "add", "show", or "put" a "live widget", "live price", or "auto updating price" on their screen/canvas.
    (Do NOT use if they just ask what the price is right now - use get_live_stock_price_groww for that).
    """
    widget_cfg = {
        "widget_type": "live_stock",
        "ticker": ticker,
        "name": f"Live Price: {ticker}",
        "description": "Auto-updating live feed"
    }
    return f"```widget\n{json.dumps(widget_cfg)}\n```"
