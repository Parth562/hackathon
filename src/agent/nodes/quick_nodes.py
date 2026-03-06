from langchain_core.messages import SystemMessage
from langgraph.prebuilt import create_react_agent
from src.agent.state import AgentState

async def _run_tool_calling_agent(state: AgentState, name: str, system_prompt: str, tools: list) -> dict:
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
        res = await agent.ainvoke({"messages": input_messages})
        
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
async def read_data_node(state: AgentState) -> dict:
    from src.tools.finance_tools import get_stock_price, get_financial_statements, get_key_metrics
    from src.tools.portfolio_tools import analyze_portfolio
    
    tools = [get_stock_price, get_financial_statements, get_key_metrics, analyze_portfolio]
    sys_prompt = "You retrieve data using tools and return a neat summary of the results."
    
    res = await _run_tool_calling_agent(state, "READ_DATA", sys_prompt, tools)
    res["research_mode"] = "Quick (Read Data)"
    return res

# ==========================================
# Write Data Node
# ==========================================
async def write_data_node(state: AgentState) -> dict:
    from src.tools.portfolio_tools import update_portfolio
    
    tools = [update_portfolio]
    sys_prompt = "You modify user state specifically using the update_portfolio tool. Do it quickly."
    
    res = await _run_tool_calling_agent(state, "WRITE_DATA", sys_prompt, tools)
    res["research_mode"] = "Quick (Write Data)"
    return res
