import os
import sys
import uuid
from dotenv import load_dotenv

# Load environment variables BEFORE any langchain imports
load_dotenv()

from langchain_core.messages import HumanMessage
from src.agent.graph import app
from src.agent.graph import memory_manager

def chat_loop():
    print("\n" + "="*50)
    print("   Financial Research Agent - Interactive Mode")
    print("="*50)
    print("Ask me anything about stocks, dependencies, or fundamentals.")
    print("Type 'exit' or 'quit' to stop.\n")
    
    # Use a persistent session ID for the chat memory loop
    session_id = str(uuid.uuid4())
    state = {
        "messages": [],
        "session_id": session_id,
        "tools_used": [],
        "assumptions": [],
        "confidence_score": 0.0,
        "detected_contradictions": []
    }
    
    while True:
        try:
            user_input = input("You: ")
            if not user_input.strip():
                continue
                
            if user_input.lower() in ['exit', 'quit']:
                print("Exiting...")
                break
                
            # Append the user's new message to the state graph
            state["messages"].append(HumanMessage(content=user_input))
            
            print("\nAgent is thinking...")
            
            # Invoke the graph with the full conversation history
            final_state = app.invoke(state)
            
            # Print the response
            messages = final_state.get('messages', [])
            if messages:
                latest_msg = messages[-1].content
                print(f"\n[Mode: {final_state.get('research_mode', 'UNKNOWN')}]")
                print(f"Agent:\n{latest_msg}\n")
                print("-" * 50 + "\n")
                
                # Update our tracking state with the latest messages so it remembers context
                state["messages"] = final_state["messages"]
            else:
                print("\nAgent: No response generated.\n")
                
        except KeyboardInterrupt:
            print("\nExiting...")
            break
        except Exception as e:
            print(f"\nError: {e}")

if __name__ == "__main__":
    if not os.getenv("GEMINI_API_KEY") or os.getenv("GEMINI_API_KEY") == "your_key_here":
         print("ERROR: Please create or update the .env file with a valid GEMINI_API_KEY")
         sys.exit(1)
         
    chat_loop()
    

