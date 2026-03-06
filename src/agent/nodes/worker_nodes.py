from typing import List
from langchain_core.messages import SystemMessage, HumanMessage
from langgraph.prebuilt import create_react_agent
from src.agent.state import AgentState

async def _run_sub_agent(state: AgentState, name: str, prompt: str, tools: list) -> str:
    from src.agent.graph import get_llm
    llm = get_llm(state)
    
    # Create a small ReAct loop just for this agent
    agent = create_react_agent(llm, tools)
    
    # We pass the original user query and any relevant context
    user_query = state['messages'][-1].content if state['messages'] else ""
    plan_str = "\n".join(state.get("plan", []))
    
    full_prompt = f"""You are the {name} AGENT.
Your job is to execute your specific step in the larger quant pipeline.
User Query: {user_query}
Overall Plan:
{plan_str}

YOUR INSTRUCTIONS:
{prompt}
"""
    
    try:
        res = await agent.ainvoke({"messages": [SystemMessage(content=full_prompt), HumanMessage(content="Begin your task now. Output a detailed summary of your findings/data.")]})
        return res['messages'][-1].content
    except Exception as e:
        print(f"[{name}] Failed: {e}")
        return f"Failed to execute {name} step."

# ==========================================
# 2. Research Node
# ==========================================
async def research_node(state: AgentState) -> AgentState:
    from src.tools.scraping_tools import search_web, scrape_webpage
    from src.tools.document_tools import search_company_documents
    
    tools = [search_web, scrape_webpage, search_company_documents]
    prompt = "Gather qualitative info, news, company documents, or context needed to answer the query. Do not do math or pull raw metrics. Focus on narrative, catalysts, and events."
    
    result = await _run_sub_agent(state, "RESEARCH", prompt, tools)
    return {"research_findings": {"summary": result}}

# ==========================================
# 3. Data Node
# ==========================================
async def data_node(state: AgentState) -> AgentState:
    from src.tools.finance_tools import get_stock_price, get_financial_statements, get_key_metrics, get_options_data
    
    tools = [get_stock_price, get_financial_statements, get_key_metrics, get_options_data]
    prompt = "Fetch EXACT numerical financial data (price, balance sheet, metrics) using your tools. Do not analyze. Just provide the raw verified data requested."
    
    result = await _run_sub_agent(state, "DATA", prompt, tools)
    return {"financial_data": {"raw": result}}

# ==========================================
# 4. Analysis Node
# ==========================================
async def analysis_node(state: AgentState) -> AgentState:
    from src.tools.analysis_tools import calculate_correlations, find_leading_companies, get_company_ecosystem, get_insider_trading, calculate_dcf, analyze_supply_chain_impact
    from src.tools.financial_analysis_tools import get_kpi_dashboard, get_peer_benchmarking, get_risk_score, generate_bull_bear_thesis, run_scenario_analysis, predict_stock_price
    from src.tools.portfolio_tools import analyze_portfolio
    from src.tools.ml_analysis_tools import classify_trade_signal, forecast_price_prophet, get_technical_indicators, detect_bollinger_breakout
    
    tools = [
        calculate_correlations, find_leading_companies, get_company_ecosystem, get_insider_trading,
        calculate_dcf, analyze_supply_chain_impact, analyze_portfolio,
        get_kpi_dashboard, get_peer_benchmarking, get_risk_score, 
        generate_bull_bear_thesis, run_scenario_analysis, predict_stock_price,
        # ML & advanced analysis
        classify_trade_signal, forecast_price_prophet, get_technical_indicators, detect_bollinger_breakout,
    ]
    
    data_context = state.get("financial_data", {}).get("raw", "None")
    prompt = f"""Run deep financial analysis using your tools.
You have access to raw data gathered by the Data agent: {data_context}

Use the most relevant combination of tools to answer the user's question:
- For valuation: calculate_dcf, run_scenario_analysis
- For risk: get_risk_score, detect_bollinger_breakout
- For fundamentals: get_kpi_dashboard, get_peer_benchmarking
- For investment thesis: generate_bull_bear_thesis
- For technical signals: get_technical_indicators, classify_trade_signal
- For trend/forecasting: predict_stock_price, forecast_price_prophet
- For supply chain: analyze_supply_chain_impact
- For portfolio: analyze_portfolio

Select tools based on what the user actually asked. Do not run every tool — be selective."""
    
    result = await _run_sub_agent(state, "ANALYSIS", prompt, tools)
    return {"analysis_results": {"findings": result}}

# ==========================================
# 5. Critic Node
# ==========================================
async def critic_node(state: AgentState) -> AgentState:
    from src.agent.graph import get_llm
    llm = get_llm(state)
    
    data = state.get("financial_data", {}).get("raw", "")
    analysis = state.get("analysis_results", {}).get("findings", "")
    
    prompt = f"""You are the CRITIC AGENT.
Your job is to review the Data and Analysis provided by previous agents.
Look for inconsistencies, hallucinated numbers, or overly optimistic assumptions (especially in DCF or Bull Thesis).

DATA GATHERED:
{data}

ANALYSIS PERFORMED:
{analysis}

Write a short, sharp critique of the financial risks and any data inconsistencies.
"""
    try:
        res = await llm.ainvoke([SystemMessage(content=prompt)])
        return {"critic_feedback": res.content}
    except Exception as e:
        return {"critic_feedback": "Critic failed to evaluate."}
