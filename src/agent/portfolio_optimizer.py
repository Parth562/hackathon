import asyncio
import json
import uuid
from langchain_core.messages import SystemMessage, HumanMessage
from src.tools.massive_tools import fetch_massive_news
from src.memory.sqlite_store import StructuredStore

store = StructuredStore()

async def optimize_portfolio_background_task():
    """
    Background job that evaluates the user's portfolio periodically or on-demand,
    and generates buy/sell/hold suggestions based on Massive.com news.
    """
    portfolio = await asyncio.to_thread(store.get_full_portfolio)
    if not portfolio:
        return

    # Try to use the project's LLM, fallback to gemini if not available in this context
    try:
        from src.agent.graph import get_llm
        llm = get_llm()
    except Exception:
        from langchain_google_genai import ChatGoogleGenerativeAI
        llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0.2)
        
    for item in portfolio:
        ticker = item["ticker"]
        shares = item["shares"]
        
        # 1. Fetch recent news for context
        try:
            news_str = await asyncio.to_thread(fetch_massive_news.invoke, {"ticker": ticker})
        except:
            news_str = await asyncio.to_thread(fetch_massive_news.invoke, ticker)
            
        prompt = f"""
You are an expert AI Portfolio Manager.
Analyze the following latest news for {ticker}. The user currently holds {shares} shares of {ticker}.
Based on this news, should the user BUY more, SELL some/all, or HOLD?

Recent News:
{news_str}

OUTPUT FORMAT:
Return ONLY valid JSON with no markdown formatting. The structure must be:
{{
    "action": "buy", "sell", or "hold",
    "suggested_shares_to_trade": float (0 if hold),
    "reasoning": "A concise (1 sentence) explanation for the sidebar card.",
    "detailed_analysis": "A comprehensive, markdown-formatted analysis explaining your reasoning in depth. Breakdown the news sentiment, risk, and expected impact.",
    "citations": ["URL or Publisher Name 1", "URL or Publisher Name 2"]
}}
"""
        try:
            res = await llm.ainvoke([SystemMessage(content="You return ONLY valid JSON and no other text."), HumanMessage(content=prompt)])
            text = res.content.strip()
            
            # Clean up markdown formatting if present
            if text.startswith("```json"):
                text = text.replace("```json\n", "")
            if text.startswith("```"):
                text = text.replace("```\n", "")
            text = text.replace("```", "").strip()
            
            data = json.loads(text)
            action = data.get("action", "hold").lower()
            suggested_shares = float(data.get("suggested_shares_to_trade", 0))
            reasoning = data.get("reasoning", "No clear reasoning provided.")
            detailed_analysis = data.get("detailed_analysis", reasoning)
            citations = json.dumps(data.get("citations", []))
            
            if action in ["buy", "sell"] and suggested_shares > 0:
                suggestion_id = str(uuid.uuid4())
                await asyncio.to_thread(
                    store.add_portfolio_suggestion,
                    suggestion_id,
                    ticker,
                    action,
                    suggested_shares,
                    reasoning,
                    detailed_analysis,
                    citations
                )
                print(f"[Optimizer] Generated {action} suggestion for {ticker}")
        except Exception as e:
            print(f"[Optimizer] Error analyzing {ticker}: {e}")
