from langchain_core.messages import SystemMessage
from src.agent.state import AgentState

async def intent_node(state: AgentState) -> dict:
    """
    Evaluates the user query to classify the intent into one of 4 tiers:
    READ_DATA, WRITE_DATA, ANALYSIS, RESEARCH.
    """
    messages = state.get("messages", [])
    if not messages:
        return {"intent": "RESEARCH"}
        
    user_query = messages[-1].content.lower()
    
    # 1. Deterministic / Keyword-based Rules (Extremely fast, no LLM needed)
    if any(word in user_query for word in ["add", "buy", "sell", "remove", "update"]) and any(word in user_query for word in ["shares", "portfolio", "stock"]):
        return {"intent": "WRITE_DATA"}
        
    if "portfolio" in user_query and any(word in user_query for word in ["show", "what", "my"]):
        return {"intent": "READ_DATA"}
        
    if "price" in user_query and ("what is" in user_query or "get" in user_query) and "analyze" not in user_query and "predict" not in user_query:
        return {"intent": "READ_DATA"}
        
    # 2. LLM Classification for complex queries
    from src.agent.graph import get_llm
    llm = get_llm(state)
    
    system_prompt = """Classify the following user query into exactly ONE of these four categories:

1. READ_DATA (Simple data retrieval like getting a stock price, fetching financial statements, or viewing portfolio).
2. WRITE_DATA (Modifying state, like adding/removing shares in a portfolio).
3. ANALYSIS (Calculations or comparisons like DCF valuation, peer benchmarking, technical indicators).
4. RESEARCH (Deep qualitative research, supply chain impact, searching news/documents).

Return ONLY the category name. Do not explain.

Examples:
"What is AAPL's price?" -> READ_DATA
"Add 10 shares of MSFT" -> WRITE_DATA
"Calculate DCF for NVDA" -> ANALYSIS
"What are the macro catalysts for tech stocks?" -> RESEARCH"""
    
    try:
        response = await llm.ainvoke([
            SystemMessage(content=system_prompt),
            messages[-1]
        ])
        
        content = response.content.strip().upper()
        
        if "WRITE_DATA" in content:
            return {"intent": "WRITE_DATA"}
        elif "READ_DATA" in content:
            return {"intent": "READ_DATA"}
        elif "ANALYSIS" in content:
            return {"intent": "ANALYSIS"}
        else:
            return {"intent": "RESEARCH"}
            
    except Exception as e:
        print(f"[Intent Classifier] Failed: {e}")
        # Default to deepest mode if classification fails
        return {"intent": "RESEARCH"}
