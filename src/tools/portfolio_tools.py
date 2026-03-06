import json
import pandas as pd
import yfinance as yf
from typing import Dict, Any, List
from langchain_core.tools import tool
import os
from src.memory.sqlite_store import StructuredStore

_store = StructuredStore()

@tool
def analyze_portfolio(file_path: str = "default") -> str:
    """
    Ingest and analyze a user's portfolio.
    If file_path is 'default', it reads the user's saved holdings from the database.
    Otherwise, it reads from a CSV or JSON file containing 'Ticker' and 'Shares'.
    This tool calculates concentration risk, sector breakdown, and unrealized P&L.
    
    Returns a structured payload suitable for rendering a PortfolioWidget.
    """
    try:
        tickers = []
        shares = []
        costs = []
        
        if file_path.lower() == "default":
             # Read from persistent SQLite store
             holdings = _store.get_full_portfolio()
             if not holdings:
                 return json.dumps({"error": "Your portfolio is currently empty. Try adding some shares first!"})
                 
             for h in holdings:
                 tickers.append(h["ticker"])
                 shares.append(h["shares"])
                 costs.append(h["cost_basis"] or 0.0)
        else:
            # Check if file exists
            if not os.path.exists(file_path):
                return json.dumps({"error": f"File not found: {file_path}"})
                
            # Try reading to pandas
            if file_path.lower().endswith('.csv'):
                df = pd.read_csv(file_path)
            elif file_path.lower().endswith('.json'):
                df = pd.read_json(file_path)
            else:
                return json.dumps({"error": "Unsupported file format. Use CSV or JSON."})
                
            # Normalize columns
            df.columns = [c.strip().lower() for c in df.columns]
            
            # Verify required columns
            valid_ticker_cols = ['ticker', 'symbol', 'holding']
            valid_shares_cols = ['shares', 'quantity', 'qty']
            
            ticker_col = next((c for c in df.columns if c in valid_ticker_cols), None)
            shares_col = next((c for c in df.columns if c in valid_shares_cols), None)
            
            if not ticker_col or not shares_col:
                 return json.dumps({"error": "Portfolio file MUST contain a Ticker/Symbol column and a Shares/Quantity column."})
                 
            tickers = df[ticker_col].astype(str).tolist()
            shares = pd.to_numeric(df[shares_col], errors='coerce').tolist()
            
            # Optional Cost basis
            cost_cols = ['cost basis', 'cost_basis', 'avg_price', 'average price']
            cost_col = next((c for c in df.columns if c in cost_cols), None)
            costs = pd.to_numeric(df[cost_col], errors='coerce').tolist() if cost_col else [0]*len(tickers)
        
        # Fetch price + sector per ticker using yf.Ticker() with fast_info properties
        current_prices = {}
        sectors = {}
        for t in tickers:
            try:
                ticker_obj = yf.Ticker(t)
                # fast_info is a FastInfo object (not a dict) — access via attributes
                price = None
                try:
                    price = ticker_obj.fast_info.last_price
                except Exception:
                    pass
                if not price:
                    try:
                        price = ticker_obj.fast_info.previous_close
                    except Exception:
                        pass
                if not price:
                    # Last resort: pull 1d history
                    hist = ticker_obj.history(period="1d")
                    if not hist.empty:
                        price = float(hist["Close"].iloc[-1])
                current_prices[t] = float(price) if price else 0.0
                print(f"[portfolio] {t} price resolved: {current_prices[t]}")
                # Grab sector from info
                try:
                    sectors[t] = ticker_obj.info.get('sector', 'Unknown')
                except Exception:
                    sectors[t] = 'Unknown'
            except Exception:
                current_prices[t] = 0.0
                sectors[t] = 'Unknown'
                
        # Build portfolio math
        holdings = []
        total_value = 0.0
        total_cost = 0.0
        
        for i, t in enumerate(tickers):
            qty = shares[i]
            if pd.isna(qty) or qty <= 0: continue
            
            price = current_prices.get(t, 0.0)
            cost_per_share = costs[i] if not pd.isna(costs[i]) else 0.0
            
            value = float(qty) * price
            cost = float(qty) * float(cost_per_share)
            
            pnl = value - cost if cost > 0 else 0
            pnl_pct = (pnl / cost) * 100 if cost > 0 else 0
            
            total_value += value
            total_cost += cost
            
            holdings.append({
                "ticker": t,
                "shares": qty,
                "price": round(price, 2),
                "value": round(value, 2),
                "cost_basis": round(cost_per_share, 2),
                "pnl": round(pnl, 2),
                "pnl_pct": round(pnl_pct, 2),
                "sector": sectors.get(t, 'Unknown')
            })
            
        # Analysis computations
        sector_allocation = {}
        concentration_alerts = []
        
        for h in holdings:
            # Allocation
            if total_value > 0:
                h["weight_pct"] = round((h["value"] / total_value) * 100, 2)
            else:
                h["weight_pct"] = 0.0
                
            # Sector aggregation
            sector = h["sector"]
            sector_allocation[sector] = sector_allocation.get(sector, 0) + h["value"]
            
            # Risk triggers
            if h["weight_pct"] > 20.0:
                 concentration_alerts.append(f"High concentration risk in {h['ticker']} ({h['weight_pct']}% of portfolio)")
                 
        # Normalize sector weights
        formatted_sectors = []
        for s, v in sector_allocation.items():
            s_weight = (v / total_value) * 100 if total_value > 0 else 0
            formatted_sectors.append({"name": s, "value": round(v, 2), "weight_pct": round(s_weight, 2)})
            if s_weight > 40.0:
                 concentration_alerts.append(f"High sector exposure in {s} ({round(s_weight, 1)}%)")
                 
        overall_pnl = total_value - total_cost if total_cost > 0 else 0
        overall_pnl_pct = (overall_pnl / total_cost) * 100 if total_cost > 0 else 0
        
        return json.dumps({
            "widget_type": "portfolio_analysis",
            "summary": {
                "total_value": round(total_value, 2),
                "total_cost": round(total_cost, 2),
                "overall_pnl": round(overall_pnl, 2),
                "overall_pnl_pct": round(overall_pnl_pct, 2),
            },
            "holdings": holdings,
            "sectors": formatted_sectors,
            "alerts": concentration_alerts
        })
        
    except Exception as e:
        return json.dumps({"error": f"Failed to analyze portfolio: {str(e)}"})

@tool
def update_portfolio(action: str, ticker: str, shares: float, cost_basis: float = 0.0) -> str:
    """
    Directly manage the user's saved portfolio holdings in the database.
    Actions allowed: 'add', 'remove', 'set'.
      - 'add' increases the current share count for the ticker by the given amount.
      - 'remove' decreases the current share count.
      - 'set' overwrites the current share count completely.
      
    If cost_basis is provided during an 'add' or 'set', it updates the average cost.
    Returns a success message.
    """
    try:
        action = action.lower()
        if action not in ['add', 'remove', 'set']:
            return json.dumps({"error": "Invalid action. Must be 'add', 'remove', or 'set'."})
            
        ticker = ticker.upper()
        
        current_holdings = _store.get_full_portfolio()
        existing_holding = next((h for h in current_holdings if h["ticker"] == ticker), None)
        
        current_shares = existing_holding["shares"] if existing_holding else 0.0
        current_cost = existing_holding["cost_basis"] if existing_holding else 0.0
        
        new_shares = current_shares
        new_cost = current_cost
        
        if action == "add":
            new_shares = current_shares + shares
            # Basic average cost math
            if new_shares > 0:
                if cost_basis > 0:
                     total_old_cost = current_shares * current_cost
                     total_new_cost = shares * cost_basis
                     new_cost = (total_old_cost + total_new_cost) / new_shares
            
        elif action == "remove":
            new_shares = current_shares - shares
            if new_shares < 0: new_shares = 0
            
        elif action == "set":
            new_shares = shares
            if cost_basis > 0:
                 new_cost = cost_basis
                 
        _store.update_portfolio_item(ticker, new_shares, new_cost)
        
        verb = "Updated"
        if new_shares == 0:
            verb = "Removed"
        elif action == "add":
            verb = "Added"
            
        return json.dumps({"success": f"{verb} {ticker} in portfolio. Current holding: {new_shares} shares."})
        
    except Exception as e:
        return json.dumps({"error": f"Failed to update portfolio: {str(e)}"})
