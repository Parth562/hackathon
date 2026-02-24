from typing import Dict, Any, List
from langchain_core.tools import tool
import pandas as pd
import yfinance as yf
import numpy as np
from datetime import datetime, timedelta
from duckduckgo_search import DDGS

@tool
def calculate_correlations(tickers: List[str], period: str = "1y") -> str:
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
                    
        return str({
             "period": period,
             "correlations": result_dict
        })
    except Exception as e:
        return {"error": f"Failed to calculate correlations: {str(e)}"}

@tool
def find_leading_companies(tickers: List[str], metric: str = 'marketCap') -> str:
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
        
        return str({
            "metric": metric,
            "leader": leader,
            "all_data": df_sorted.to_dict(orient='records')
        })
    except Exception as e:
        return {"error": f"Failed to find leading companies: {str(e)}"}

@tool
def get_company_ecosystem(ticker: str) -> str:
    """
    Find the public companies that act as suppliers (inputs), customers (outputs), 
    or competitors to a given stock ticker. Helpful for supply-chain correlation and trade impacts.
    """
    try:
        results = []
        with DDGS() as ddgs:
            # Search for top suppliers
            for r in ddgs.text(f"{ticker} major suppliers companies supply chain", max_results=2):
                results.append(f"Supplier Info: {r.get('body', '')}")
            # Search for top customers
            for r in ddgs.text(f"{ticker} major customers corporate", max_results=2):
                results.append(f"Customer Info: {r.get('body', '')}")
            # Search for top competitors
            for r in ddgs.text(f"{ticker} main competitors market", max_results=2):
                results.append(f"Competitor Info: {r.get('body', '')}")
        
        if not results:
            return f"No ecosystem data found for {ticker}."
            
        ecosystem_summary = " ".join(results)
        return str({"ticker": ticker, "ecosystem_data": ecosystem_summary})
    except Exception as e:
        return str({"error": f"Failed to get ecosystem for {ticker}: {str(e)}"})

@tool
def get_insider_trading(ticker: str) -> str:
    """
    Fetch the recent insider trading activities (buying or selling by executives) for a given stock ticker.
    High insider buying is typically a bullish signal, while heavy selling might be bearish.
    """
    try:
        stock = yf.Ticker(ticker)
        insider_roster = stock.insider_roster_holders
        insider_purchases = stock.insider_purchases
        
        data = {}
        if insider_roster is not None and not insider_roster.empty:
             data["insider_roster"] = insider_roster.to_dict(orient="records")
        if insider_purchases is not None and not insider_purchases.empty:
             data["insider_purchases"] = insider_purchases.to_dict(orient="records")
             
        if not data:
             return f"No insider trading data readily available for {ticker}."
             
        return str({"ticker": ticker, "insider_data": data})
    except Exception as e:
        return str({"error": f"Failed to get insider trading data for {ticker}: {str(e)}"})

@tool
def calculate_dcf(ticker: str, growth_rate: float = 0.05, discount_rate: float = 0.10, terminal_growth_rate: float = 0.02, years: int = 5) -> str:
    """
    Perform a basic Discounted Cash Flow (DCF) valuation for a given stock ticker.
    This projects the Free Cash Flow over a number of years and discounts it back to Present Value.
    
    Arguments:
    - growth_rate: Expected annual growth rate of Free Cash Flow (e.g. 0.05 for 5%)
    - discount_rate: Weighted Average Cost of Capital (e.g. 0.10 for 10%)
    - terminal_growth_rate: Expected long-term infinite growth rate (e.g. 0.02 for 2%)
    - years: Projection period (e.g. 5)
    """
    try:
        stock = yf.Ticker(ticker)
        cf = stock.cashflow
        
        # We need the most recent Free Cash Flow to start the projection
        if cf.empty or 'Free Cash Flow' not in cf.index:
            return f"Error: Cannot calculate DCF. Free Cash Flow data missing for {ticker}."
            
        current_fcf = float(cf.loc['Free Cash Flow'].iloc[0])
        
        # We also need Shares Outstanding to calculate fair value per share
        shares_outstanding = stock.info.get('sharesOutstanding')
        if not shares_outstanding:
            return f"Error: Cannot calculate DCF per share. Shares Outstanding missing for {ticker}."
            
        # Project Cash Flows
        projected_fcf = []
        for year in range(1, years + 1):
            projected_fcf.append(current_fcf * ((1 + growth_rate) ** year))
            
        # Discount Cash Flows to Present Value
        pv_fcf = []
        for year in range(1, years + 1):
            pv_fcf.append(projected_fcf[year - 1] / ((1 + discount_rate) ** year))
            
        sum_pv_fcf = sum(pv_fcf)
        
        # Calculate Terminal Value
        terminal_value = (projected_fcf[-1] * (1 + terminal_growth_rate)) / (discount_rate - terminal_growth_rate)
        pv_terminal_value = terminal_value / ((1 + discount_rate) ** years)
        
        # Calculate Enterprise Value
        enterprise_value = sum_pv_fcf + pv_terminal_value
        
        # Factor in Net Debt to get Equity Value
        bs = stock.balance_sheet
        total_debt = float(bs.loc['Total Debt'].iloc[0]) if not bs.empty and 'Total Debt' in bs.index else 0
        cash = float(bs.loc['Cash And Cash Equivalents'].iloc[0]) if not bs.empty and 'Cash And Cash Equivalents' in bs.index else 0
        
        net_debt = total_debt - cash
        equity_value = enterprise_value - net_debt
        
        # Calculate Fair Value Per Share
        implied_share_price = equity_value / shares_outstanding
        
        result = {
            "ticker": ticker,
            "inputs": {
                "base_fcf": current_fcf,
                "growth_rate": growth_rate,
                "discount_rate": discount_rate,
                "terminal_growth_rate": terminal_growth_rate,
                "projection_years": years
            },
            "valuation": {
                "enterprise_value": enterprise_value,
                "equity_value": equity_value,
                "implied_share_price": round(implied_share_price, 2),
                "current_price": stock.info.get('currentPrice', 'Unknown')
            }
        }
        
        return str(result)
        
    except Exception as e:
         return str({"error": f"Failed to run DCF calculation for {ticker}: {str(e)}"})
