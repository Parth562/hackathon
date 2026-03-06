import json
from langchain_core.messages import SystemMessage
from src.agent.state import AgentState

async def planner_node(state: AgentState) -> AgentState:
    """
    Step 1: The Planner Agent.
    Analyzes the user's query and formulates a step-by-step Execution Plan.
     Outputs a JSON with the "plan" array.
    """
    # Import dynamically to avoid circular dependencies if needed
    from src.agent.graph import get_llm
    
    llm = get_llm(state)
    messages = state.get("messages", [])
    if not messages:
        return {"plan": []}
        
    user_query = messages[-1].content
    
    system_prompt = f"""You are the PLANNER AGENT for a sophisticated quant research system.
Your job is to read the user query and output a concise step-by-step plan.
The plan determines which subsequent agents (Research, Data, Analysis) will be needed.

User query: "{user_query}"

Respond ONLY with a valid JSON object matching this schema:
{{
  "plan": [
    "step 1 description",
    "step 2 description",
    ...
  ]
}}
Do not include markdown blocks or any other text.
"""
    
    try:
        response = await llm.ainvoke([SystemMessage(content=system_prompt)])
        content = response.content.strip()
        # Clean up markdown if the LLM adds it
        if content.startswith("```json"):
            content = content[7:]
        if content.endswith("```"):
            content = content[:-3]
            
        data = json.loads(content)
        plan = data.get("plan", [])
        return {"plan": plan}
        
    except Exception as e:
        print(f"[Planner] Failed to parse JSON plan: {e}")
        # Fallback to a generic plan
        return {"plan": ["Analyze the query", "Fetch relevant data", "Generate final report"]}
