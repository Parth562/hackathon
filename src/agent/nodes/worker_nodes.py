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
    doc_context = state.get("document_context", "") or ""
    mem_context = state.get("memory_context", "") or ""
    
    extra_context = ""
    if mem_context:
        extra_context += f"\n{mem_context}\n"
    if doc_context:
        extra_context += f"""
UPLOADED DOCUMENT CONTEXT (auto-retrieved from user's uploaded files — USE THIS DATA):
{doc_context}

IMPORTANT: The above document context was retrieved from the user's uploaded files (PDFs, reports, prospectuses).
If it contains information relevant to the query, you MUST use it as your primary data source.
Do NOT ignore it in favor of external lookups if it already answers the question.
"""
    
    full_prompt = f"""You are the {name} AGENT.
Your job is to execute your specific step in the larger quant pipeline.
User Query: {user_query}
Overall Plan:
{plan_str}
{extra_context}
YOUR INSTRUCTIONS:
{prompt}
"""
    
    try:
        res = await agent.ainvoke({"messages": [SystemMessage(content=full_prompt), HumanMessage(content="Begin your task now. Output a detailed summary of your findings/data.")]})
        final_text = res['messages'][-1].content
        
        # Intercept widgets
        import re
        widgets = []
        widget_regex = r"```widget\n([\s\S]*?)```"
        
        for match in re.finditer(widget_regex, final_text):
            widgets.append(match.group(0))
            
        # Clean the text so downstream agents don't get confused by the raw JSON
        cleaned_text = re.sub(widget_regex, "*[Widget extracted and sent to UI]*", final_text)
        
        return {"content": cleaned_text, "widgets": widgets}
    except Exception as e:
        print(f"[{name}] Failed: {e}")
        return {"content": f"Failed to execute {name} step.", "widgets": []}

# ==========================================
# 2. Research Node
# ==========================================
async def research_node(state: AgentState) -> AgentState:
    from src.tools.scraping_tools import search_web, scrape_webpage
    from src.tools.document_tools import search_company_documents
    from src.tools.research_tools import search_pdf_content
    
    tools = [search_web, scrape_webpage, search_company_documents, search_pdf_content]
    prompt = """You are the Qualitative Research Agent.
GOAL: Gather deep contextual, qualitative data (news, macro, narratives, management commentary).
RULES:
1. No Math: Leave financial data and ratio calculation to the Data and Analysis agents.
2. IPOs & Unlisted: For private/SME upcoming IPOs (e.g. "Srinibas Pradhan"), tickers won't work. Use `search_web` to find DRHP/Prospectus links, then `scrape_webpage` to extract text.
3. PDF Priority: Use `search_pdf_content` for deep institutional reports when relevant.
OUTPUT FORMAT: Provide a highly structured qualitative summary with bullet points and clear citations."""
    
    result = await _run_sub_agent(state, "RESEARCH", prompt, tools)
    return {
        "research_findings": {"summary": result["content"]},
        "intermediate_widgets": result["widgets"]
    }


# ==========================================
# 3. Data Node
# ==========================================
async def data_node(state: AgentState) -> AgentState:
    from src.tools.finance_tools import get_stock_price, get_financial_statements, get_key_metrics, get_options_data
    from src.tools.scraping_tools import search_web, scrape_webpage
    
    tools = [get_stock_price, get_financial_statements, get_key_metrics, get_options_data, search_web, scrape_webpage]
    prompt = """You are the Data Engineering Agent.
GOAL: Fetch highly accurate, EXACT numerical financial data.
RULES:
1. Verify Tickers: Ensure the ticker is correct before querying.
2. Public vs Private: Use yfinance tools for listed companies. For unlisted/IPOs, use `search_web` + `scrape_webpage` to find exact DRHP metrics.
3. No Analysis: Do not calculate DCF, SMA, or explain trends. Just retrieve and structure the raw verifiable numbers.
OUTPUT FORMAT: Output tables or structured markdown detailing metrics, dates, and sources."""
    
    result = await _run_sub_agent(state, "DATA", prompt, tools)
    return {
        "financial_data": {"raw": result["content"]},
        "intermediate_widgets": result["widgets"]
    }

# ==========================================
# 4. Analysis Node
# ==========================================
async def analysis_node(state: AgentState) -> AgentState:
    from src.tools.analysis_tools import calculate_correlations, find_leading_companies, get_company_ecosystem, get_insider_trading, calculate_dcf, analyze_supply_chain_impact
    from src.tools.financial_analysis_tools import get_kpi_dashboard, get_peer_benchmarking, get_risk_score, generate_bull_bear_thesis, run_scenario_analysis, predict_stock_price
    from src.tools.portfolio_tools import analyze_portfolio
    from src.tools.ml_analysis_tools import classify_trade_signal, forecast_price_prophet, get_technical_indicators, detect_bollinger_breakout
    from src.tools.canvas_tools import get_canvas_state, set_canvas_variable, connect_canvas_widgets, disconnect_canvas_widgets, add_canvas_widget, remove_canvas_widget, list_available_widgets
    from src.tools.alpha_vantage_tools import get_sma, get_ema, get_rsi, get_macd
    from src.tools.sandbox_tools import execute_python_code
    
    tools = [
        calculate_correlations, find_leading_companies, get_company_ecosystem, get_insider_trading,
        calculate_dcf, analyze_supply_chain_impact, analyze_portfolio,
        get_kpi_dashboard, get_peer_benchmarking, get_risk_score, 
        generate_bull_bear_thesis, run_scenario_analysis, predict_stock_price,
        # ML & advanced analysis
        classify_trade_signal, forecast_price_prophet, get_technical_indicators, detect_bollinger_breakout,
        # Canvas control & Math
        get_canvas_state, set_canvas_variable, connect_canvas_widgets, disconnect_canvas_widgets, add_canvas_widget, remove_canvas_widget, list_available_widgets,
        # Indicators & Sandbox
        get_sma, get_ema, get_rsi, get_macd, execute_python_code
    ]
    
    data_context = state.get("financial_data", {}).get("raw", "None")
    prompt = f"""You are the Quantitative Analysis Agent.
GOAL: Execute rigorous financial models and calculations using the specified tools.
RAW DATA AVAILABLE: {data_context}

RULES:
1. Precision matters: Ensure accurate inputs to your models. Do not invent target dates.
2. Be selective: ONLY use the tools relevant to the user query. 
3. Tool Usage:
   - Valuation: calculate_dcf, run_scenario_analysis
   - Risk: get_risk_score, detect_bollinger_breakout
   - Fundamentals: get_kpi_dashboard, get_peer_benchmarking
   - Technicals/Trend: get_sma, get_ema, get_rsi, get_macd, forecast_price_prophet, classify_trade_signal
4. Canvas UI Integration & Decoupled Data: 
   - If asked to "create a workflow/pipeline/model visually" or "plot a chart/graph/SMA", DO NOT fetch the raw data yourself! 
   - Massive arrays of JSON will break your context window. 
   - INSTEAD, strictly use `add_canvas_widget` (e.g. type `preprocessing` or `chart` or `network_graph`) passing just the minimal config (like `ticker` and `period`). The frontend widget will fetch its own data.
5. Python Sandbox Execution:
   - If you need to perform custom mathematical combinations, complex matrix math, write algorithmic backtests, calculate Fibonacci sequences, or run *anything* that requires looping logic not provided by the tools, you MUST write the python script yourself and run it using the `execute_python_code` tool. 
   - Write self-contained python scripts with `print()` for the result. Using this tool automatically deploys a beautiful IDE widget to the user showcasing your code. Output the results of your script into your analysis report.
OUTPUT FORMAT: Present your analysis as a polished financial report section. Breakdown the math, clarify assumptions, and highlight actionable insights."""
    
    result = await _run_sub_agent(state, "ANALYSIS", prompt, tools)
    return {
        "analysis_results": {"findings": result["content"]},
        "intermediate_widgets": result["widgets"]
    }

# ==========================================
# 5. Critic Node
# ==========================================
async def critic_node(state: AgentState) -> AgentState:
    from src.agent.graph import get_llm
    llm = get_llm(state)
    
    data = state.get("financial_data", {}).get("raw", "")
    analysis = state.get("analysis_results", {}).get("findings", "")
    
    prompt = f"""You are the Risk & Compliance Critic Agent.
GOAL: Act as the ultimate skeptic for the multi-agent pipeline.
DATA GATHERED: {data}
ANALYSIS PERFORMED: {analysis}

RULES:
1. Challenge Assumptions: Identify overly optimistic inputs in DCF models or growth forecasts.
2. Detect Hallucinations: Flag any dates that are in the future or numbers that contradict each other.
3. Context Check: Ensure findings align with known macroeconomic reality.

OUTPUT FORMAT: A short, sharp, structured critique titled "CRITIC'S REVIEW". Bullet point the key risks and inconsistencies.
"""
    try:
        res = await llm.ainvoke([SystemMessage(content=prompt)])
        return {"critic_feedback": res.content}
    except Exception as e:
        return {"critic_feedback": "Critic failed to evaluate."}
