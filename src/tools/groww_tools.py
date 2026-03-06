import json
import yfinance as yf
from langchain_core.tools import tool
from src.memory.redis_cache import sync_cache


@tool
@sync_cache(ttl_seconds=30)
def get_live_stock_price_groww(ticker: str) -> str:
    """
    Get the LIVE stock price and market data for a given ticker symbol.
    Uses yfinance for real-time data (free, no API key required).
    Supports NSE (.NS), BSE (.BO), US, and international tickers.
    """
    try:
        stock = yf.Ticker(ticker)
        info  = stock.info

        current_price   = info.get('currentPrice') or info.get('regularMarketPrice')
        previous_close  = info.get('previousClose') or info.get('regularMarketPreviousClose')
        open_price      = info.get('open') or info.get('regularMarketOpen')
        day_high        = info.get('dayHigh') or info.get('regularMarketDayHigh')
        day_low         = info.get('dayLow') or info.get('regularMarketDayLow')
        volume          = info.get('volume') or info.get('regularMarketVolume')
        market_cap      = info.get('marketCap')
        currency        = info.get('currency', 'USD')
        name            = info.get('longName') or info.get('shortName') or ticker

        # Fallback: pull from recent history if info is empty
        if not current_price:
            hist = stock.history(period='1d', interval='1m')
            if not hist.empty:
                current_price  = float(hist['Close'].iloc[-1])
                previous_close = float(hist['Close'].iloc[0])

        change    = round(current_price - previous_close, 4)  if current_price and previous_close else None
        change_pct = round((change / previous_close) * 100, 4) if change and previous_close else None

        return json.dumps({
            "ticker":         ticker,
            "name":           name,
            "current_price":  current_price,
            "previous_close": previous_close,
            "open":           open_price,
            "day_high":       day_high,
            "day_low":        day_low,
            "volume":         volume,
            "market_cap":     market_cap,
            "change":         change,
            "change_pct":     change_pct,
            "currency":       currency,
            "source":         "yfinance",
        })
    except Exception as e:
        return json.dumps({"error": f"Failed to retrieve price for {ticker}: {str(e)}"})


@tool
def show_live_stock_widget(ticker: str) -> str:
    """
    Spawns a live, auto-updating stock widget on the user's dashboard/canvas for the given ticker.
    Use this when the user explicitly asks to "add", "show", or "put" a "live widget", "live price",
    or "auto updating price" on their screen/canvas.
    (Do NOT use if they just ask what the price is right now — use get_live_stock_price_groww for that.)
    """
    widget_cfg = {
        "widget_type": "live_stock",
        "ticker": ticker,
        "name": f"Live Price: {ticker}",
        "description": "Auto-updating live feed",
    }
    return f"```widget\n{json.dumps(widget_cfg)}\n```"
