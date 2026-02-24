import os
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import seaborn as sns
import yfinance as yf
import mplfinance as mpf
from typing import List
from langchain_core.tools import tool

@tool
def render_stock_comparison_graph(tickers: List[str], period: str = "1y", filename: str = "stock_comparison.png") -> str:
    """
    Downloads historical stock prices for a list of tickers, normalizes them, 
    renders a line chart comparing their performance, saves it as a PNG file, 
    and automatically opens it for the user like a Bloomberg terminal.
    Use this whenever a user asks to draw, render, or see a graph of stock prices or correlations.
    """
    try:
        if not tickers:
            return "Error: No tickers provided to graph."

        # Fetch data
        data = yf.download(tickers, period=period, auto_adjust=True, progress=False)

        plt.figure(figsize=(12, 6))
        sns.set_theme(style="darkgrid")

        # Plot each ticker
        for ticker in tickers:
            try:
                if isinstance(data.columns, type(data.index)): # If MultiIndex not explicitly imported
                    pass
                series = data['Close'][ticker] if 'Close' in data and ticker in data['Close'] else data['Close']
                if series.ndim > 1: # if we accidentally got a dataframe instead of a series
                    series = series.iloc[:, 0]
            except KeyError:
                continue
            
            # Normalize to percentage change from start of period
            if not series.empty:
                normalized = (series / series.iloc[0] - 1) * 100
                plt.plot(series.index, normalized, label=ticker)

        plt.title(f"Stock Performance Comparison ({period}) - % Change")
        plt.xlabel("Date")
        plt.ylabel("Percentage Change (%)")
        plt.legend(loc="upper left")
        plt.tight_layout()

        # Save the graph
        filepath = os.path.abspath(filename)
        plt.savefig(filepath, dpi=300)
        plt.close()

        # Open the graph in the default image opener (Windows)
        os.startfile(filepath)

        return f"Graph successfully rendered, saved to {filepath}, and opened on your screen."
    except Exception as e:
        return f"Failed to render graph: {str(e)}"

@tool
def render_advanced_stock_graph(ticker: str, period: str = "6mo", chart_type: str = "candle", moving_averages: List[int] = [20, 50], filename: str = "advanced_stock_graph.png") -> str:
    """
    Renders an advanced financial graph (candlestick or line) for a SINGLE ticker, 
    including Volume and Moving Averages (e.g. MA20, MA50).
    Saves it as a PNG and opens it.
    chart_type can be 'candle' or 'line'.
    Use this whenever a user asks for all types of financial graphs, candlesticks, or volume data.
    """
    try:
        data = yf.download(ticker, period=period, progress=False)
        if data.empty:
            return f"Error: No data found for {ticker}."
        
        # Flatten MultiIndex if yfinance returned one
        if isinstance(data.columns, type(data.index)):
            data.columns = [col[0] for col in data.columns]
            
        filepath = os.path.abspath(filename)
        
        # Plot styling
        kwargs = dict(type=chart_type, volume=True, figratio=(12, 6), figscale=1.0, title=f"{ticker} - {period} ({chart_type.capitalize()})", style="yahoo", savefig=filepath)
        
        if moving_averages:
            kwargs['mav'] = tuple(moving_averages)
            
        mpf.plot(data, **kwargs)
        
        os.startfile(filepath)
        return f"Advanced graph successfully rendered, saved to {filepath}, and opened on your screen."
    except Exception as e:
        return f"Failed to render advanced graph: {str(e)}"
