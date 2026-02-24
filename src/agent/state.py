from typing import Annotated, Dict, Any, List, Optional
from typing_extensions import TypedDict
from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages


class AgentState(TypedDict):
    """
    State object for LangGraph agent orchestration.
    Maintains conversional history, user context from memory,
    and metadata about the current research task.
    """
    # Chat history
    messages: Annotated[List[BaseMessage], add_messages]
    
    # Session identifiers
    session_id: str
    
    # Long-term memory context retrieved for this session (e.g., risk tolerance)
    memory_context: str
    
    # Internal agent scratchpad / tracking fields
    # Quick mode vs Deep mode determination
    research_mode: Optional[str] 
    
    # Model tracking
    model_name: Optional[str]
    provider: Optional[str]
    
    # Track which tools have run to avoid infinite loops or budget blows
    tools_used: List[str]
    
    # Extracted or explicit assumptions made during analysis for transparency
    assumptions: List[str]
    
    # Confidence score for the final generated output based on data quality (0.0 to 1.0)
    confidence_score: float
    
    # Structured representation of final response
    final_insight: Optional[str]
    
    # Any contradiction found (e.g., between an earnings call and general news)
    detected_contradictions: List[str]
