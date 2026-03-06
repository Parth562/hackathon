import os
import certifi

# Fix SSL_CERT_FILE if it points to a non-existent path (common in multi-python environments)
ssl_cert_file = os.environ.get("SSL_CERT_FILE")
if ssl_cert_file and not os.path.exists(ssl_cert_file):
    os.environ["SSL_CERT_FILE"] = certifi.where()

import asyncio
from typing import Dict, Any
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage, ToolMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_ollama import ChatOllama
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode
from langchain_core.tools import tool

# Local imports
from .state import AgentState
from src.tools.finance_tools import get_financial_statements, get_key_metrics, get_options_data
from src.tools.groww_tools import get_live_stock_price_groww, show_live_stock_widget
from src.tools.scraping_tools import search_web, scrape_webpage
from src.tools.analysis_tools import calculate_correlations, find_leading_companies, get_company_ecosystem, get_insider_trading, calculate_dcf, create_custom_widget, analyze_supply_chain_impact
from src.tools.graphing_tools import render_stock_comparison_graph, render_advanced_stock_graph
from src.tools.document_tools import search_company_documents
from src.tools.portfolio_tools import analyze_portfolio, update_portfolio
from src.tools.financial_analysis_tools import (
    get_kpi_dashboard, get_peer_benchmarking, get_risk_score,
    generate_bull_bear_thesis, run_scenario_analysis, predict_stock_price,
)
from src.tools.ml_analysis_tools import (
    classify_trade_signal, forecast_price_prophet,
    get_technical_indicators, detect_bollinger_breakout,
)
from src.memory.vector_store import MemoryManager
from src.memory.sqlite_store import StructuredStore
from src.tools.canvas_tools import get_canvas_state, set_canvas_variable, connect_canvas_widgets, disconnect_canvas_widgets, add_canvas_widget, remove_canvas_widget, list_canvas_connections, update_canvas_widget, redirect_canvas_connection, set_widget_ticker
from src.tools.alpha_vantage_tools import get_sma, get_ema, get_rsi, get_macd

# Initialize memory stores lazily to prevent PyTorch OOM on import
_memory_manager_instance = None
def get_memory_manager():
    global _memory_manager_instance
    if _memory_manager_instance is None:
        _memory_manager_instance = MemoryManager()
    return _memory_manager_instance

structured_store = StructuredStore()

# Define tools
tools = [
     get_live_stock_price_groww,
     show_live_stock_widget,
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
     calculate_dcf,
     create_custom_widget,
     search_company_documents,
     analyze_supply_chain_impact,
     analyze_portfolio,
     update_portfolio,
     # Financial analysis suite
     get_kpi_dashboard,
     get_peer_benchmarking,
     get_risk_score,
     generate_bull_bear_thesis,
     run_scenario_analysis,
     predict_stock_price,
     # ML & advanced analysis
     classify_trade_signal,
     forecast_price_prophet,
     get_technical_indicators,
     detect_bollinger_breakout,
     # Canvas control tools
     get_canvas_state,
     set_canvas_variable,
     connect_canvas_widgets,
     disconnect_canvas_widgets,
     add_canvas_widget,
     remove_canvas_widget,
     list_canvas_connections,
     update_canvas_widget,
     redirect_canvas_connection,
     set_widget_ticker,
     # Math/Preprocessing
     get_sma,
     get_ema,
     get_rsi,
     get_macd,
]

# Dynamic LLM Loader
def get_llm(state: AgentState = None):
    model_name = "glm-5:cloud"
    provider = "ollama"  # Always force ollama for now
    if state:
        model_name = state.get('model_name', model_name) or model_name
        # Ignoring state provider to bypass leaked Gemini key
        # provider = state.get('provider', provider) or provider
         
    # Force ollama
    return ChatOllama(model=model_name, temperature=0.0, streaming=True, base_url="http://localhost:11434")

from src.agent.nodes.planner_node import planner_node
from src.agent.nodes.worker_nodes import research_node, data_node, analysis_node, critic_node
from src.agent.nodes.report_node import report_node
from src.agent.nodes.intent_node import intent_node
from src.agent.nodes.quick_nodes import read_data_node, write_data_node

def route_query(state: AgentState) -> str:
    """Routes the graph based on the Intent Classifier output."""
    intent = state.get("intent", "RESEARCH")
    
    if intent == "READ_DATA":
        return "read_data"
    elif intent == "WRITE_DATA":
        return "write_data"
    elif intent == "ANALYSIS":
        return "analysis"
    else:
        # Default to full pipeline starting with planner
        return "planner"

def create_agent_graph() -> StateGraph:
    """
    Builds the 4-Tier Agent Pipeline Architecture:
    Intent Routing -> (Quick/Direct Nodes OR Analysis OR Full Planner/Research)
    """
    builder = StateGraph(AgentState)
    
    # 1. Add all single-responsibility agent nodes
    builder.add_node("intent", intent_node)
    builder.add_node("read_data", read_data_node)
    builder.add_node("write_data", write_data_node)
    
    builder.add_node("planner",  planner_node)
    builder.add_node("research", research_node)
    builder.add_node("data",     data_node)
    builder.add_node("analysis", analysis_node)
    builder.add_node("critic",   critic_node)
    builder.add_node("report",   report_node)
    
    # 2. Define the Entry Point as the Intent Classifier
    builder.set_entry_point("intent")
    
    # 3. Add Conditional Routing from Intent Node
    builder.add_conditional_edges(
        "intent",
        route_query,
        {
            "read_data": "read_data",
            "write_data": "write_data",
            "analysis": "analysis",
            "planner": "planner"
        }
    )
    
    # 4. Connect quick nodes directly to END
    builder.add_edge("read_data", END)
    builder.add_edge("write_data", END)
    
    # ANALYSIS route short-circuits planner/research/data
    builder.add_edge("analysis", "critic")
    
    # RESEARCH route goes through the full deep pipeline
    builder.add_edge("planner",  "research")
    builder.add_edge("research", "data")
    builder.add_edge("data",     "analysis")
    
    # Standard tail for deep paths
    builder.add_edge("critic",   "report")
    builder.add_edge("report",   END)
    
    # 5. Compile graph
    return builder.compile()

# Export the compiled graph instance
app = create_agent_graph()
