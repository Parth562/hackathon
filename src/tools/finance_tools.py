from typing import Dict, Any
from langchain_core.tools import tool

@tool
def get_stock_price(ticker: str) -> str:
    """
    Get the current stock price and recent market data for a given ticker symbol.
    """
    try:
        import yfinance as yf
        stock = yf.Ticker(ticker)
        info = stock.info
        current_price = info.get('currentPrice', info.get('regularMarketPrice'))
        previous_close = info.get('previousClose')
        
        if not current_price:
            # Fallback to history if info is incomplete
            hist = stock.history(period="1d")
            if not hist.empty:
                current_price = hist['Close'].iloc[-1]
                
        return str({
            "ticker": ticker,
            "current_price": current_price,
            "previous_close": previous_close,
            "currency": info.get('currency', 'USD')
        })
    except Exception as e:
        return str({"error": f"Failed to retrieve price for {ticker}: {str(e)}"})

@tool
def get_financial_statements(ticker: str) -> str:
    """
    Get key financial statements (Income Statement, Balance Sheet, Cash Flow) 
    summaries for the given ticker symbol to perform fundamental analysis.
    """
    try:
        import yfinance as yf
        stock = yf.Ticker(ticker)
        
        # Get the most recent annual data
        inc = stock.financials
        bs = stock.balance_sheet
        cf = stock.cashflow
        
        # Convert to dict for easy JSON serialization by the LLM
        # We take just the most recent period to save token space
        recent_date = inc.columns[0] if not inc.empty else None
        
        summary = {
            "ticker": ticker,
            "period": str(recent_date) if recent_date else "Unknown"
        }
        
        if not inc.empty:
            summary["revenue"] = float(inc.loc['Total Revenue'].iloc[0]) if 'Total Revenue' in inc.index else None
            summary["net_income"] = float(inc.loc['Net Income'].iloc[0]) if 'Net Income' in inc.index else None
            
        if not bs.empty:
            summary["total_assets"] = float(bs.loc['Total Assets'].iloc[0]) if 'Total Assets' in bs.index else None
            summary["total_debt"] = float(bs.loc['Total Debt'].iloc[0]) if 'Total Debt' in bs.index else None
            
        if not cf.empty:
            summary["operating_cash_flow"] = float(cf.loc['Operating Cash Flow'].iloc[0]) if 'Operating Cash Flow' in cf.index else None
            summary["free_cash_flow"] = float(cf.loc['Free Cash Flow'].iloc[0]) if 'Free Cash Flow' in cf.index else None
            
        return str(summary)
    except Exception as e:
        return str({"error": f"Failed to retrieve financials for {ticker}: {str(e)}"})

@tool
def get_key_metrics(ticker: str) -> str:
    """
    Get key financial metrics like PE ratio, ROE, margins, and 
    risk indicators for the given ticker symbol.
    """
    try:
        import yfinance as yf
        stock = yf.Ticker(ticker)
        info = stock.info
        
        return str({
            "ticker": ticker,
            "sector": info.get('sector'),
            "industry": info.get('industry'),
            "market_cap": info.get('marketCap'),
            "trailing_pe": info.get('trailingPE'),
            "forward_pe": info.get('forwardPE'),
            "profit_margin": info.get('profitMargins'),
            "operating_margin": info.get('operatingMargins'),
            "return_on_equity": info.get('returnOnEquity'),
            "return_on_assets": info.get('returnOnAssets'),
            "debt_to_equity": info.get('debtToEquity'),
            "beta": info.get('beta'),
            "52_week_high": info.get('fiftyTwoWeekHigh'),
            "52_week_low": info.get('fiftyTwoWeekLow')
        })
    except Exception as e:
        return str({"error": f"Failed to retrieve metrics for {ticker}: {str(e)}"})

@tool
def get_options_data(ticker: str) -> str:
    """
    Get the future options bets (calls and puts) for the upcoming expiration date for a given ticker symbol.
    """
    try:
        import yfinance as yf
        stock = yf.Ticker(ticker)
        expirations = stock.options
        if not expirations:
            return f"No options data available for {ticker}."
        
        # Get the nearest expiration date
        nearest_expiry = expirations[0]
        opt = stock.option_chain(nearest_expiry)
        
        calls = opt.calls.head(5)[['strike', 'lastPrice', 'impliedVolatility', 'volume']]
        puts = opt.puts.head(5)[['strike', 'lastPrice', 'impliedVolatility', 'volume']]
        
        data = {
            "ticker": ticker,
            "nearest_expiration": nearest_expiry,
            "top_calls": calls.to_dict(orient='records'),
            "top_puts": puts.to_dict(orient='records')
        }
        return str(data)
    except Exception as e:
        return str({"error": f"Failed to retrieve options data for {ticker}: {str(e)}"})
