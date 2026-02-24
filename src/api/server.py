from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import urllib.request
import json
import sys
import os
from dotenv import load_dotenv

load_dotenv()

# Ensure the src directory is in the path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from src.agent.graph import app as agent_app
from langchain_core.messages import HumanMessage
import uuid

app = FastAPI(title="Financial Research Agent API")

# Enable CORS for the Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this to the frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory session store to maintain conversational context
sessions: dict[str, dict] = {}

class ChatRequest(BaseModel):
    message: str
    session_id: str = None
    model_name: str = "gemini-2.5-flash"
    provider: str = "google"

class ChatResponse(BaseModel):
    response: str
    session_id: str
    mode: str

@app.get("/api/models")
async def get_models():
    models = []
    models.append({
        "id": "gemini-2.5-flash",
        "name": "Google Gemini (2.5 Flash)",
        "provider": "google"
    })
    try:
        req = urllib.request.Request("http://localhost:11434/api/tags")
        with urllib.request.urlopen(req, timeout=2.0) as response:
            if response.getcode() == 200:
                data = json.loads(response.read().decode())
                for model in data.get("models", []):
                    models.append({
                        "id": model["name"],
                        "name": f"Ollama ({model['name']})",
                        "provider": "ollama"
                    })
    except Exception as e:
        print(f"Warning: Could not connect to local Ollama instance: {e}")
        
    return {"models": models}

@app.post("/api/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    try:
        session_id = request.session_id or str(uuid.uuid4())
        
        # Retrieve existing session state or initialize a new one
        if session_id in sessions:
            state = sessions[session_id]
            # Append new user message to existing history
            state["messages"].append(HumanMessage(content=request.message))
        else:
            state = {
                "messages": [HumanMessage(content=request.message)],
                "session_id": session_id,
                "model_name": request.model_name,
                "provider": request.provider,
                "tools_used": [],
                "assumptions": [],
                "confidence_score": 0.0,
                "detected_contradictions": []
            }
        
        # Invoke the graph with the full conversational state
        final_state = agent_app.invoke(state)
        
        # Save the updated state back to the session store
        sessions[session_id] = final_state
        
        messages = final_state.get('messages', [])
        response_text = messages[-1].content if messages else "No response generated."
        
        return ChatResponse(
            response=response_text,
            session_id=session_id,
            mode=final_state.get('research_mode', 'UNKNOWN')
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        
        # Intercept Gemini Free Tier Rate Limiting string to avoid 500 error bombs on the frontend
        error_msg = str(e)
        if "429" in error_msg or "Quota" in error_msg or "rate-limit" in error_msg.lower():
            friendly_text = "⚠️ **API Rate Limit Exceeded:** The free tier of Google Gemini only allows 15 requests per minute. Please wait about 30 seconds before sending another message or graphing a new stock."
            return ChatResponse(
                response=friendly_text,
                session_id=request.session_id or "error",
                mode="UNKNOWN"
            )
            
        raise HTTPException(status_code=500, detail=error_msg)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("src.api.server:app", host="0.0.0.0", port=8261, reload=True)
