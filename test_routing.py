import sys
import asyncio
from langchain_core.messages import HumanMessage
from src.agent.graph import app

async def test_router():
    test_queries = [
        "What is the price of AAPL?",  # Expect READ_DATA
        "Add 10 shares of MSFT",       # Expect WRITE_DATA
        "Calculate the DCF for TSLA",   # Expect ANALYSIS
        "What are the supply chain issues for NVIDIA?" # Expect RESEARCH
    ]
    
    for query in test_queries:
        print(f"\n{'='*50}")
        print(f"Testing Query: {query}")
        
        state = {
            "messages": [HumanMessage(content=query)],
            "session_id": "test_session",
            "tools_used": [],
            "assumptions": [],
            "confidence_score": 0.0,
            "detected_contradictions": []
        }
        
        try:
            # We use ainvoke to better handle async generator printing if needed, 
            # or just invoke for sync access. Let's use invoke.
            final_state = await app.ainvoke(state)
            
            intent = final_state.get('intent', 'UNKNOWN')
            print(f"Routed Intent: {intent}")
            print(f"Research Mode: {final_state.get('research_mode', 'N/A')}")
            
            messages = final_state.get('messages', [])
            if messages:
                print(f"Final Agent Output:\n{messages[-1].content}")
                
        except Exception as e:
            print(f"Error testing query: {e}")

if __name__ == "__main__":
    asyncio.run(test_router())
