from langchain_core.messages import SystemMessage
from langchain_core.runnables.config import RunnableConfig
from langgraph.prebuilt import create_react_agent
from src.agent.state import AgentState

async def _run_tool_calling_agent(state: AgentState, name: str, system_prompt: str, tools: list, config: RunnableConfig = None) -> dict:
    """Helper to run a fast tool-calling agent that doesn't overthink."""
    from src.agent.graph import get_llm
    llm = get_llm(state)
    
    # We pass the full message history to the fast tool-calling agent
    messages = state.get("messages", [])
    
    # Using create_react_agent (which LangGraph sets up for tool-calling)
    agent = create_react_agent(llm, tools)
    
    prompt = f"""You are a {name} AGENT designed for speed.
Your job is to parse the user's request and IMMEDIATELY call the provided tool.
Do not reason, do not over-explain, do not hesitate.
If you have the necessary arguments, call the tool directly.

{system_prompt}"""

    try:
        # Prepend the system prompt and append the existing conversation history
        input_messages = [SystemMessage(content=prompt)] + messages
        res = await agent.ainvoke({"messages": input_messages}, config=config)
        
        # Extract the final message
        final_message = res['messages'][-1].content
        
        # Append to our main state messages
        return {"messages": [res['messages'][-1]], "final_insight": final_message}
        
    except Exception as e:
        print(f"[{name}] Failed: {e}")
        return {"final_insight": f"Failed to execute {name} step."}

# ==========================================
# Read Data Node
# ==========================================
async def read_data_node(state: AgentState, config: RunnableConfig) -> dict:
    from src.tools.finance_tools import get_financial_statements, get_key_metrics
    from src.tools.groww_tools import get_live_stock_price_groww, show_live_stock_widget
    from src.tools.portfolio_tools import analyze_portfolio
    from src.tools.canvas_tools import get_canvas_state, set_canvas_variable, connect_canvas_widgets, disconnect_canvas_widgets, add_canvas_widget, remove_canvas_widget, list_available_widgets
    from src.tools.ticker_tools import resolve_ticker

    tools = [
        get_live_stock_price_groww,
        show_live_stock_widget,
        get_financial_statements,
        get_key_metrics,
        analyze_portfolio,
        get_canvas_state,
        set_canvas_variable,
        connect_canvas_widgets,
        disconnect_canvas_widgets,
        add_canvas_widget,
        remove_canvas_widget,
        list_available_widgets,
        resolve_ticker,
    ]
    
    session_id = state.get("session_id", "unknown")
    
    sys_prompt = f"""You are a fast READ_DATA agent. The current session_id is: {session_id}

Your job is to retrieve data, display widgets on the canvas, and build canvas flows/workflows.

SMART TICKER RESOLUTION:
- If the user uses a layman name (e.g., 'Nifty 50', 'Google', 'Reliance'), FIRST call resolve_ticker to get the official symbol (e.g., '^NSEI', 'GOOGL', 'RELIANCE.NS').
- Use the resolved ticker for all subsequent tool calls in this turn.

CANVAS FLOW CREATION (when user asks to "create a flow", "connect widgets", "build a pipeline", "add math block"):
1. First call get_canvas_state(session_id="{session_id}") to see what's on the canvas.
2. Use add_canvas_widget(session_id="{session_id}", "customWidget", {{"widget_type": "preprocessing", "function": "SMA", "ticker": "AAPL"}}) for math blocks.
3. Call show_live_stock_widget or add_canvas_widget for other data blocks.
4. Call connect_canvas_widgets to wire the correct ports together (e.g., out-result → in-data).
5. Use set_canvas_variable to set or update any named variables.
6. Use remove_canvas_widget to delete blocks.
7. Explain what you built in plain language.

WIDGET DISPLAY (when user asks to "show", "add to canvas", "display"):
- Call show_live_stock_widget for live price cards.
- CRITICAL: Include the exact ```widget markdown block from tool responses in your final answer.

DATA LOOKUP (price, financials):
- Call get_live_stock_price_groww for a quick price check.
- Call get_financial_statements / get_key_metrics for company data.

IMPORTANT: If a tool returns a markdown block starting with ```widget, you MUST copy that EXACT block into your final response."""
    
    res = await _run_tool_calling_agent(state, "READ_DATA", sys_prompt, tools, config)
    res["research_mode"] = "Quick (Read Data)"
    return res


# ==========================================
# Write Data Node
# ==========================================
async def write_data_node(state: AgentState, config: RunnableConfig) -> dict:
    from src.tools.portfolio_tools import update_portfolio
    
    tools = [update_portfolio]
    sys_prompt = "You modify user state specifically using the update_portfolio tool. Do it quickly."
    
    res = await _run_tool_calling_agent(state, "WRITE_DATA", sys_prompt, tools, config)
    res["research_mode"] = "Quick (Write Data)"
    return res
