import os
from typing import Dict, Any
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage, ToolMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_ollama import ChatOllama
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode
from langchain_core.tools import tool

# Local imports
from .state import AgentState
from src.tools.finance_tools import get_stock_price, get_financial_statements, get_key_metrics, get_options_data
from src.tools.scraping_tools import search_web, scrape_webpage
from src.tools.analysis_tools import calculate_correlations, find_leading_companies, get_company_ecosystem, get_insider_trading, calculate_dcf
from src.tools.graphing_tools import render_stock_comparison_graph, render_advanced_stock_graph
from src.memory.vector_store import MemoryManager
from src.memory.sqlite_store import StructuredStore

# Initialize memory stores
memory_manager = MemoryManager()
structured_store = StructuredStore()

# Define tools
tools = [
     get_stock_price, 
     get_financial_statements, 
     get_key_metrics, 
     search_web, 
     scrape_webpage, 
     calculate_correlations, 
     find_leading_companies,
     get_options_data,
     render_stock_comparison_graph,
     render_advanced_stock_graph,
     get_company_ecosystem,
     get_insider_trading,
     calculate_dcf
]

# Dynamic LLM Loader
def get_llm(state: AgentState = None):
     model_name = "gemini-2.5-flash"
     provider = "google"
     if state:
         model_name = state.get('model_name', model_name) or model_name
         provider = state.get('provider', provider) or provider
         
     if provider == "ollama":
         return ChatOllama(model=model_name, temperature=0.1)
     else:
         return ChatGoogleGenerativeAI(model=model_name, temperature=0.1)

# Helper Node: Setup and routing
def triage_node(state: AgentState) -> AgentState:
    """
    Determines if the request is Quick or Deep mode, extracts explicitly mentioned
    user preferences to store in Qdrant, and sets up the system prompt.
    """
    llm = get_llm(state)
    messages = state['messages']
    user_query = messages[-1].content if messages else ""
    
    # 1. Fetch relevant long-term memories
    relevant_memories = memory_manager.retrieve_relevant_memories(user_query, limit=3)
    memory_context = "\n".join([m['text'] for m in relevant_memories]) if relevant_memories else "No specific past context found."
    
    # 2. Check if we need to store new preferences
    memory_extraction_prompt = f"""
    Analyze the following user query for explicitly stated investment preferences, risk tolerance, 
    key performance indicators (KPIs) like EBITDA or ROE, preferred sectors, or geographies.
    
    If you find any, summarize them concisely. If none, return 'NONE'.
    
    User Query: {user_query}
    """
    extraction_result = llm.invoke([HumanMessage(content=memory_extraction_prompt)]).content.strip()
    
    if extraction_result and extraction_result.upper() != "NONE":
        memory_manager.store_memory(extraction_result, metadata={"type": "extracted_preference"})
        # Ensure we use it right now
        memory_context += "\n" + extraction_result
    
    # 3. Classify Mode (Quick vs Deep)
    mode_classification_prompt = f"""
    Is the following query a 'Quick' request (e.g., getting a recent stock price, summarizing last earnings) 
    or a 'Deep' request (e.g., fundamental analysis, peer benchmarking, bull/bear thesis generation, scenario analysis)?
    
    Respond with exactly 'QUICK' or 'DEEP'.
    
    User Query: {user_query}
    """
    mode = llm.invoke([HumanMessage(content=mode_classification_prompt)]).content.strip().upper()
    if "DEEP" in mode:
        research_mode = "DEEP"
    else:
        research_mode = "QUICK"
        
    return {
         "memory_context": memory_context,
         "research_mode": research_mode
    }

def research_agent_node(state: AgentState) -> AgentState:
    """
    The main reasoning node. Makes tool calls or provides final answers.
    """
    llm = get_llm(state)
    llm_with_tools = llm.bind_tools(tools)
    
    mode = state.get('research_mode', 'QUICK')
    memory = state.get('memory_context', '')
    
    # Construct base prompt depending on mode
    sys_prompt = f"""
    You are a highly capable Financial & Market Research Agent, behaving like a junior equity analyst or strategy consultant.
    Your task is to produce decision-ready insights with transparency and traceability.
    
    Current Research Mode: {mode}. 
    - Quick Mode: Be concise. Summarize metrics quickly. Target < 30s processing.
    - Deep Mode: Be comprehensive. Perform fundamental analysis, peer benchmarking, or bull/bear thesis generation. Target clear explanations.
    
    User Long-Term Memory & Preferences (Apply these to your analysis!):
    {memory}
    
    REQUIREMENTS:
    - If the user asks to "draw", "render", or "show a graph", MUST CALL `render_stock_comparison_graph` OR `render_advanced_stock_graph`.
    - Explain your assumptions clearly! (e.g., 'Assuming standard PE ratios apply this quarter...').
    - If the user asks for a valuation or fair price, MUST USE the `calculate_dcf` tool to perform a Discounted Cash Flow model.
    - If the user asks about executives or insider actions, USE `get_insider_trading`.
    - If you see contradictions between your tool results (e.g., Yahoo Finance says price is up, but news says it's down), explicitly state them.
    - Suggest follow up questions the user could ask (e.g. 'Would you like to stress test under high inflation?').
    """
    
    # Format messages for the LLM
    current_messages = [SystemMessage(content=sys_prompt)] + state['messages']
    
    # Invoke
    response = llm_with_tools.invoke(current_messages)
    
    return {"messages": [response]}
    
def should_continue(state: AgentState) -> str:
    """Conditional routing: loop to tools or end."""
    messages = state['messages']
    last_message = messages[-1]
    
    if last_message.tool_calls:
        return "continue"
        
    return "end"

def synthesis_node(state: AgentState) -> AgentState:
    """
    Final synthesis block. 
    Can extract assumptions, confidence scores, and format the final insight for the user.
    Records structured logs.
    """
    # For now, we will just format the final LLM response as the final insight
    # and log it to SQLite.
    
    messages = state['messages']
    last_content = messages[-1].content
    
    # Handle Gemini-specific list structure to return clean text instead of a raw dictionary representation
    if isinstance(last_content, list):
        text_parts = []
        for block in last_content:
            if isinstance(block, dict) and 'text' in block:
                text_parts.append(block['text'])
            elif isinstance(block, str):
                text_parts.append(block)
        last_content = "\n".join(text_parts)
    
    import json
    import re

    # Strip any LLM-hallucinated widget blocks to prevent corrupted JSON or duplicates
    last_content = re.sub(r"```widget\n[\s\S]*?```", "", last_content)
    
    # Intercept pure tool payloads to guarantee front-end widget consistency
    recent_tool_widgets = []
    # Iterate backwards through messages to find tools executed during this specific round
    for msg in reversed(messages[:-1]): # Exclude the final AIMessage itself
        if isinstance(msg, HumanMessage):
            break
        if isinstance(msg, ToolMessage):
            try:
                # Try to parse the raw Python tool output as JSON
                tool_data = json.loads(msg.content)
                # Check if it has a widget signature
                if isinstance(tool_data, dict) and ('widget_type' in tool_data or 'chart_type' in tool_data or 'type' in tool_data or 'all_data' in tool_data):
                    widget_md = f"\n```widget\n{msg.content}\n```\n"
                    recent_tool_widgets.append(widget_md)
            except Exception:
                pass

    if recent_tool_widgets:
        last_content += "\n" + "".join(recent_tool_widgets)

    # Ensure it's pushed back to the state so the chat history loop prints cleanly
    messages[-1].content = last_content
    
    # In a full production app, we would use LLM structural extraction here to fill
    # the assumption list and confidence score. For hackathon scope, we trust the agent's prose 
    # and log the result.
    
    # Log to sqlite
    user_query = [m for m in state['messages'] if isinstance(m, HumanMessage)][0].content
    
    structured_store.log_research(
        session_id=state.get('session_id', 'unknown'),
        query=user_query,
        mode=state.get('research_mode', 'unknown'),
        result={"final_answer": last_content},
        assumptions=["Logged in full text response"] # simplified
    )
    
    return {"final_insight": last_content}

# Build the Graph
workflow = StateGraph(AgentState)

# Nodes
workflow.add_node("triage", triage_node)
workflow.add_node("agent", research_agent_node)
workflow.add_node("tools", ToolNode(tools))
workflow.add_node("synthesis", synthesis_node)

# Edges
workflow.set_entry_point("triage")
workflow.add_edge("triage", "agent")
workflow.add_conditional_edges(
    "agent",
    should_continue,
    {
        "continue": "tools",
        "end": "synthesis"
    }
)
workflow.add_edge("tools", "agent")
workflow.add_edge("synthesis", END)

# Compile
app = workflow.compile()
