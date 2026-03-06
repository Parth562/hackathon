import os
import requests
import json
from langchain_core.tools import tool
from src.memory.redis_cache import sync_cache

# We use the explicit demo key here for testing, but typically fall back to environment variable
# as you posted the link with demo key in the instruction.
DEFAULT_API_KEY = os.getenv("ALPHA_VANTAGE", "9JSFVQ6UOX4D04J8")
BASE_URL = "https://www.alphavantage.co/query"

def _fetch_alpha_vantage(params: dict) -> dict:
    """Helper to fetch from Alpha Vantage REST API."""
    if "apikey" not in params:
        params["apikey"] = DEFAULT_API_KEY
    
    response = requests.get(BASE_URL, params=params)
    response.raise_for_status()
    data = response.json()
    
    if "Information" in data and "rate limit" in str(data["Information"]).lower():
        raise Exception(f"Alpha Vantage Rate Limit: {data['Information']}")
    if "Error Message" in data:
        raise Exception(f"Alpha Vantage Error: {data['Error Message']}")
        
    return data

@tool
@sync_cache(ttl_seconds=3600)
def get_sma(ticker: str, interval: str = "daily", time_period: int = 20, series_type: str = "close") -> str:
    """
    Get the Simple Moving Average (SMA) for a given stock ticker over a specified time period and interval.
    Intervals can be: 1min, 5min, 15min, 30min, 60min, daily, weekly, monthly.
    """
    try:
        data = _fetch_alpha_vantage({
            "function": "SMA",
            "symbol": ticker,
            "interval": interval,
            "time_period": time_period,
            "series_type": series_type
        })
        return json.dumps(data)
    except Exception as e:
        return json.dumps({"error": str(e)})

@tool
@sync_cache(ttl_seconds=3600)
def get_ema(ticker: str, interval: str = "daily", time_period: int = 20, series_type: str = "close") -> str:
    """
    Get the Exponential Moving Average (EMA) for a given stock ticker over a specified time period and interval.
    Intervals can be: 1min, 5min, 15min, 30min, 60min, daily, weekly, monthly.
    """
    try:
        data = _fetch_alpha_vantage({
            "function": "EMA",
            "symbol": ticker,
            "interval": interval,
            "time_period": time_period,
            "series_type": series_type
        })
        return json.dumps(data)
    except Exception as e:
        return json.dumps({"error": str(e)})

@tool
@sync_cache(ttl_seconds=3600)
def get_rsi(ticker: str, interval: str = "daily", time_period: int = 14, series_type: str = "close") -> str:
    """
    Get the Relative Strength Index (RSI) for a given stock ticker over a specified time period and interval.
    Intervals can be: 1min, 5min, 15min, 30min, 60min, daily, weekly, monthly.
    """
    try:
        data = _fetch_alpha_vantage({
            "function": "RSI",
            "symbol": ticker,
            "interval": interval,
            "time_period": time_period,
            "series_type": series_type
        })
        return json.dumps(data)
    except Exception as e:
        return json.dumps({"error": str(e)})

@tool
@sync_cache(ttl_seconds=3600)
def get_macd(ticker: str, interval: str = "daily", series_type: str = "close") -> str:
    """
    Get the Moving Average Convergence Divergence (MACD) for a given stock ticker.
    Intervals can be: 1min, 5min, 15min, 30min, 60min, daily, weekly, monthly.
    """
    try:
        data = _fetch_alpha_vantage({
            "function": "MACD",
            "symbol": ticker,
            "interval": interval,
            "series_type": series_type
        })
        return json.dumps(data)
    except Exception as e:
        return json.dumps({"error": str(e)})
