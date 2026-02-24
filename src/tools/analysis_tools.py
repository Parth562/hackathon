from typing import Dict, Any, List
from langchain_core.tools import tool
import pandas as pd
import yfinance as yf
import numpy as np
from datetime import datetime, timedelta

@tool
def calculate_correlations(tickers: List[str], period: str = "1y") -> Dict[str, Any]:
    """
    Calculate the correlation matrix between the daily returns of a list of stock tickers
    over a specified period (e.g., '1mo', '3mo', '1y', 'ytd').
    Helps identify which companies have correlated or inversely correlated stock prices.
    """
    try:
        if len(tickers) < 2:
            return {"error": "Need at least two tickers to calculate correlation."}
            
        # Download historical data for all tickers
        data = yf.download(tickers, period=period, group_by='ticker', auto_adjust=True, progress=False)
        
        # Extract closing prices
        df_close = pd.DataFrame()
        
        # yfinance returns different structures depending on the number of tickers
        if len(tickers) == 1:
             df_close[tickers[0]] = data['Close']
        else:
             for ticker in tickers:
                 # Check if the ticker exists in columns to prevent errors
                 if ticker in data.columns.levels[0]:
                    df_close[ticker] = data[ticker]['Close']
                 else:
                    return {"error": f"Failed to download data for {ticker}"}
        
        # Calculate daily returns
        returns = df_close.pct_change().dropna()
        
        # Calculate correlation matrix
        corr_matrix = returns.corr()
        
        # Convert to dictionary for easy consumption
        result_dict = {}
        for row in corr_matrix.index:
            result_dict[row] = {}
            for col in corr_matrix.columns:
                 if row != col: # Omit self-correlation (which is always 1.0)
                    # Round to 3 decimal places
                    result_dict[row][col] = round(float(corr_matrix.loc[row, col]), 3)
                    
        return {
             "period": period,
             "correlations": result_dict
        }
    except Exception as e:
        return {"error": f"Failed to calculate correlations: {str(e)}"}

@tool
def find_leading_companies(tickers: List[str], metric: str = 'marketCap') -> Dict[str, Any]:
    """
    Compare a list of companies based on a specific financial metric to find the leader.
    Supported metrics: 'marketCap', 'revenue', 'profitMargins', 'returnOnEquity', 'trailingPE'
    """
    valid_metrics = ['marketCap', 'revenue', 'profitMargins', 'returnOnEquity', 'trailingPE']
    if metric not in valid_metrics:
         return {"error": f"Invalid metric '{metric}'. Choose from {valid_metrics}"}
         
    try:
        results = []
        for ticker in tickers:
            stock = yf.Ticker(ticker)
            info = stock.info
            
            val = info.get(metric)
            if val is not None:
                 results.append({"ticker": ticker, metric: val})
                 
        if not results:
             return {"error": f"Could not retrieve metric {metric} for any of the given tickers."}
             
        df = pd.DataFrame(results)
        
        # Determine sort order depending on the metric
        ascending = True if metric == 'trailingPE' else False # Lower PE is 'better' usually, but debatable. Higher market cap is definitely leading.
        
        df_sorted = df.sort_values(by=metric, ascending=ascending).reset_index(drop=True)
        
        leader = df_sorted.iloc[0].to_dict()
        
        return {
            "metric": metric,
            "leader": leader,
            "all_data": df_sorted.to_dict(orient='records')
        }
    except Exception as e:
        return {"error": f"Failed to find leading companies: {str(e)}"}
