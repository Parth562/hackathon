import json
import yfinance as yf
import mplfinance as mpf
from typing import List
from langchain_core.tools import tool

@tool
def render_stock_comparison_graph(tickers: List[str], period: str = "1y", filename: str = "stock_comparison.json") -> str:
    """
    Downloads historical stock prices for a list of tickers, normalizes them for comparison, 
    and returns JSON data for a ChartWidget on the frontend dashboard.
    Use this whenever a user asks to draw, render, or see a graph of stock prices or correlations.
    """
    try:
        if not tickers:
            return '{"error": "No tickers provided to graph."}'

        # Fetch data
        data = yf.download(tickers, period=period, auto_adjust=True, progress=False)

        output_data = {"chart_type": "comparison", "period": period, "series": []}

        # Process each ticker
        for ticker in tickers:
            try:
                if isinstance(data.columns, type(data.index)): # If MultiIndex
                    pass
                series = data['Close'][ticker] if 'Close' in data and ticker in data['Close'] else data['Close']
                if series.ndim > 1: # if we accidentally got a dataframe instead of a series
                    series = series.iloc[:, 0]
            except KeyError:
                continue
            
            # Normalize to percentage change from start of period
            if not series.empty:
                normalized = (series / series.iloc[0] - 1) * 100
                
                points = []
                for date, val in normalized.items():
                    points.append({"date": date.strftime('%Y-%m-%d'), "value": round(float(val), 2)})
                    
                output_data["series"].append({
                    "ticker": ticker,
                    "data": points
                })

        return json.dumps(output_data)
    except Exception as e:
        return json.dumps({"error": f"Failed to render graph: {str(e)}"})

@tool
def render_advanced_stock_graph(ticker: str, period: str = "6mo", chart_type: str = "candle", moving_averages: List[int] = [20, 50], filename: str = "advanced_stock_graph.json") -> str:
    """
    Generates advanced financial JSON data (candlestick or line) for a SINGLE ticker, 
    including Volume and Moving Averages (e.g. MA20, MA50) to render on the Next.js frontend.
    chart_type can be 'candle' or 'line'.
    Use this whenever a user asks for all types of financial graphs, candlesticks, or volume data.
    """
    try:
        data = yf.download(ticker, period=period, progress=False)
        if data.empty:
            return json.dumps({"error": f"No data found for {ticker}."})
        
        # Flatten MultiIndex if yfinance returned one
        if isinstance(data.columns, type(data.index)):
            data.columns = [col[0] for col in data.columns]
            
        points = []
        for date, row in data.iterrows():
             point = {
                 "date": date.strftime('%Y-%m-%d'),
                 "open": round(float(row['Open']), 2) if 'Open' in row else 0,
                 "high": round(float(row['High']), 2) if 'High' in row else 0,
                 "low": round(float(row['Low']), 2) if 'Low' in row else 0,
                 "close": round(float(row['Close']), 2) if 'Close' in row else 0,
                 "volume": int(row['Volume']) if 'Volume' in row else 0
             }
             points.append(point)
             
        output_data = {
            "chart_type": chart_type,
            "period": period,
            "ticker": ticker,
            "moving_averages": moving_averages,
            "data": points
        }
        
        return json.dumps(output_data)
    except Exception as e:
        return json.dumps({"error": f"Failed to render advanced graph: {str(e)}"})
