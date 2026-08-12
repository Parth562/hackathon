import json
from langchain_core.messages import SystemMessage
from src.agent.state import AgentState

async def planner_node(state: AgentState) -> AgentState:
    """
    Step 1: The Planner Agent.
    Analyzes the user's query and formulates a step-by-step Execution Plan.
    Also determines WHICH agents are actually needed for this query.
    """
    from src.agent.graph import get_llm
    
    llm = get_llm(state)
    messages = state.get("messages", [])
    if not messages:
        return {"plan": [], "required_agents": []}
        
    user_query = messages[-1].content
    doc_context = state.get("document_context", "") or ""
    mem_context = state.get("memory_context", "") or ""
    
    extra_context = ""
    if mem_context:
        extra_context += f"\n{mem_context}\n"
    if doc_context:
        extra_context += f"""
AVAILABLE DOCUMENT CONTEXT (auto-retrieved from user's uploaded files):
{doc_context}

NOTE: The above context is from the user's uploaded documents. If it contains relevant data,
your plan should prioritize using this data rather than external API lookups.
"""
    
    system_prompt = f"""You are the PLANNER AGENT for a sophisticated quant research system.
Your job is to:
1. Read the user query and output a concise step-by-step plan
2. Decide which agents are ACTUALLY NEEDED (skip unnecessary ones)

Available agents:
- "research": Web search, news, qualitative research. Use for: macro trends, news, company overviews, web lookups.
  SKIP if: the answer is available from uploaded documents or user memory, or if it's a purely quantitative question.
- "data": Financial data retrieval (stock prices, statements, metrics). Use for: getting hard financial numbers.
  SKIP if: no financial data is needed, or data is already available from uploaded documents.
- "analysis": Quantitative analysis (DCF, peer benchmarking, risk scores, technical indicators). Use for: calculations and models.
  SKIP if: no calculations or analysis are requested.

IMPORTANT: If the query can be answered from the uploaded document context or user memory alone,
set required_agents to an empty list [] — the report agent will synthesize the answer directly.

User query: "{user_query}"
{extra_context}
Respond ONLY with a valid JSON object matching this schema:
{{
  "plan": ["step 1 description", "step 2 description"],
  "required_agents": ["research", "data", "analysis"]
}}
Only include agents that are truly needed. Do not include markdown blocks or any other text.
"""
    
    try:
        response = await llm.ainvoke([SystemMessage(content=system_prompt)])
        content = response.content.strip()
        # Clean up markdown if the LLM adds it
        if content.startswith("```json"):
            content = content[7:]
        if content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
            
        data = json.loads(content.strip())
        plan = data.get("plan", [])
        required = data.get("required_agents", ["research", "data", "analysis"])
        
        # Validate: only allow known agent names
        valid_agents = {"research", "data", "analysis"}
        required = [a for a in required if a in valid_agents]
        
        print(f"[Planner] Required agents: {required} for query: {user_query[:80]}...")
        return {"plan": plan, "required_agents": required}
        
    except Exception as e:
        print(f"[Planner] Failed to parse JSON plan: {e}")
        # Fallback to all agents
        return {"plan": ["Analyze the query", "Fetch relevant data", "Generate final report"], "required_agents": ["research", "data", "analysis"]}

