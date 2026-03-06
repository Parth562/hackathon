from langchain_core.messages import SystemMessage, AIMessage
from langchain_core.runnables.config import RunnableConfig
from src.agent.state import AgentState

async def report_node(state: AgentState, config: RunnableConfig) -> AgentState:
    """
    Step 6: The Report Agent.
    Takes the structured findings from Research, Data, Analysis, and Critic.
    Produces the final markdown response for the user.
    """
    from src.agent.graph import get_llm
    llm = get_llm(state)
    
    plan = "\n".join(state.get("plan", []))
    research = state.get("research_findings", {}).get("summary", "None")
    data = state.get("financial_data", {}).get("raw", "None")
    analysis = state.get("analysis_results", {}).get("findings", "None")
    critic = state.get("critic_feedback", "None")
    user_query = state['messages'][0].content if state['messages'] else ""
    
    system_prompt = f"""You are the REPORT AGENT, the final step in the quant pipeline.
Your job is to synthesize all findings into a coherent, highly professional financial report for the user.

USER QUERY:
{user_query}

PIPELINE EXECUTION PLAN:
{plan}

1. RESEARCH FINDINGS (Qualitative):
{research}

2. FINANCIAL DATA (Quantitative Data):
{data}

3. ANALYSIS RESULTS (DCF, Peers, Risk):
{analysis}

4. CRITIC FEEDBACK (Risks & Confidence):
{critic}

INSTRUCTIONS:
- Write a clear, structured markdown response directly answering the user's query.
- Emphasize the Critic's feedback regarding risks and assumptions.
- Be concise but comprehensive. Use bolding and bullet points for readability.
- Do NOT hallucinate any numbers. Only use the numbers provided in the Data and Analysis sections.
"""
    
    try:
        res = await llm.ainvoke([SystemMessage(content=system_prompt)], config=config)
        
        # We append the final response to the message history so the frontend sees it
        new_messages = list(state.get("messages", []))
        new_messages.append(res)
        
        return {
            "messages": new_messages,
            "final_insight": res.content
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"[Report] Failed: {e}")
        fallback = AIMessage(content="Error generating final report from the multi-agent pipeline.")
        return {"messages": state["messages"] + [fallback]}
