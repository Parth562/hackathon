import os
import sys
import uuid
from dotenv import load_dotenv

# Load environment variables (expecting GEMINI_API_KEY) BEFORE any langchain imports
load_dotenv()

from langchain_core.messages import HumanMessage

# Ensure the src directory is in the path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.agent.graph import app
from src.agent.graph import memory_manager, structured_store

def run_agent(query: str, session_id: str = None):
    print(f"\n{'='*50}\nUser Request: {query}\n{'='*50}")
    
    if not session_id:
        session_id = str(uuid.uuid4())
        
    initial_state = {
        "messages": [HumanMessage(content=query)],
        "session_id": session_id,
        "tools_used": [],
        "assumptions": [],
        "confidence_score": 0.0,
        "detected_contradictions": []
    }
    
    # Run the graph
    print("Agent is thinking...\n")
    try:
        final_state = app.invoke(initial_state)
        print(f"\n[Research Mode: {final_state.get('research_mode', 'UNKNOWN')}]")
        print("\nAgent Response:\n" + "-"*30)
        messages = final_state.get('messages', [])
        if messages:
            print(messages[-1].content)
        else:
            print("No response generated.")
            
        print("\n" + "-"*30)
    except Exception as e:
        print(f"\nError running agent: {e}")

if __name__ == "__main__":
    # Ensure api key exists
    if not os.getenv("GEMINI_API_KEY"):
         print("ERROR: Please create a .env file with GEMINI_API_KEY=your_key_here")
         sys.exit(1)
         
    # Generate a constant session for testing memory across calls
    test_session = "test_user_session_1"
    
    print("Starting Financial Research Agent Test...\n")
    
    # Test 1: Tell it our preferences (Will store to Qdrant)
    run_agent("I am a very conservative investor. I care most about Free Cash Flow and strong Profit Margins.", test_session)
    
    # Test 2: Quick Mode request (Should utilize yfinance)
    run_agent("Summarize AAPL's last quarter earnings.", test_session)
    
    # Test 3: Deep Mode request (Should utilize the pandas tools and remember preferences)
    run_agent("Compare MSFT vs GOOGL on fundamentals into a small table. What's the leader in market cap? Give a bull thesis for the winner.", test_session)
    
    # Clean up Qdrant client to prevent atexit shutdown errors in the local provider
    try:
        memory_manager.client.close()
    except:
        pass
