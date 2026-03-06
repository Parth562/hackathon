import os
import json
import asyncio
from typing import Dict, Any
from langchain_core.tools import tool

@tool
def call_alphavantage_mcp(tool_name: str, arguments: Dict[str, Any]) -> str:
    """
    Call an official Alpha Vantage MCP tool by name with arguments.
    Available Tools by Category:
    core_stock_apis: TIME_SERIES_INTRADAY, TIME_SERIES_DAILY, TIME_SERIES_DAILY_ADJUSTED, TIME_SERIES_WEEKLY, TIME_SERIES_WEEKLY_ADJUSTED, TIME_SERIES_MONTHLY, TIME_SERIES_MONTHLY_ADJUSTED, GLOBAL_QUOTE, REALTIME_BULK_QUOTES, SYMBOL_SEARCH, MARKET_STATUS
    options_data_apis: REALTIME_OPTIONS, HISTORICAL_OPTIONS
    alpha_intelligence: NEWS_SENTIMENT, EARNINGS_CALL_TRANSCRIPT, TOP_GAINERS_LOSERS, INSIDER_TRANSACTIONS, INSTITUTIONAL_HOLDINGS, ANALYTICS_FIXED_WINDOW, ANALYTICS_SLIDING_WINDOW
    fundamental_data: COMPANY_OVERVIEW, INCOME_STATEMENT, BALANCE_SHEET, CASH_FLOW, EARNINGS, LISTING_STATUS, EARNINGS_CALENDAR, IPO_CALENDAR
    forex: FX_INTRADAY, FX_DAILY, FX_WEEKLY, FX_MONTHLY
    cryptocurrencies: CURRENCY_EXCHANGE_RATE, DIGITAL_CURRENCY_INTRADAY, DIGITAL_CURRENCY_DAILY, DIGITAL_CURRENCY_WEEKLY, DIGITAL_CURRENCY_MONTHLY
    commodities: WTI, BRENT, NATURAL_GAS, COPPER, ALUMINUM, WHEAT, CORN, COTTON, SUGAR, COFFEE, GOLD_SILVER_SPOT, GOLD_SILVER_HISTORY, ALL_COMMODITIES
    economic_indicators: REAL_GDP, REAL_GDP_PER_CAPITA, TREASURY_YIELD, FEDERAL_FUNDS_RATE, CPI, INFLATION, RETAIL_SALES, DURABLES, UNEMPLOYMENT, NONFARM_PAYROLL
    technical_indicators: SMA, EMA, WMA, DEMA, TEMA, MACD, RSI, etc.

    Arguments commonly include 'symbol' (e.g., {'symbol': 'AAPL'}), but may also require 'interval', 'time_period', 'series_type', etc. depending on the exact tool. 
    Returns JSON string with market data or news sentiment.
    """
    api_key = os.getenv("ALPHA_VANTAGE")
    if not api_key:
        return "Error: ALPHA_VANTAGE API key not set in environment."
        
    async def run_mcp_call():
        from mcp.client.stdio import stdio_client, StdioServerParameters
        from mcp.client.session import ClientSession
        
        import sys
        
        # Hardcode the verified working path for this environment
        uv_path = r"C:\Users\isitr\AppData\Local\Programs\Python\Python312\Scripts\uv.exe"
            
        server_params = StdioServerParameters(
            command=uv_path,
            args=["tool", "run", "av-mcp", api_key],
        )
        
        try:
            async with stdio_client(server_params) as (read, write):
                async with ClientSession(read, write) as session:
                    await session.initialize()
                    result = await session.call_tool(tool_name, arguments)
                    return str(result.content)
        except Exception as e:
            return f"Failed to call Alpha Vantage MCP tool '{tool_name}': {e}"
            
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # Already in an event loop, run in a new thread
            import threading
            result = []
            def run_in_thread():
                new_loop = asyncio.new_event_loop()
                asyncio.set_event_loop(new_loop)
                res = new_loop.run_until_complete(run_mcp_call())
                result.append(res)
            t = threading.Thread(target=run_in_thread)
            t.start()
            t.join()
            return result[0]
        else:
            return loop.run_until_complete(run_mcp_call())
    except Exception as e:
        return f"Error executing async MCP call: {e}"
