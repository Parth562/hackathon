from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import urllib.request
import json
import sys
import os
import asyncio
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

from fastapi import UploadFile, File
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import PyPDFLoader
import tempfile

@app.post("/api/upload")
def upload_document(file: UploadFile = File(...)):
    """Uploads a company document, extracts text, chunks it, and stores in the Qdrant document collection."""
    try:
        # Create a temporary file to save the uploaded content
        suffix = os.path.splitext(file.filename)[1]
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            content = file.file.read()
            tmp.write(content)
            tmp_path = tmp.name

        documents = []
        if suffix.lower() == '.pdf':
            loader = PyPDFLoader(tmp_path)
            documents = loader.load()
        elif suffix.lower() == '.txt':
            # Simple text parsing
            from langchain_core.documents import Document
            with open(tmp_path, 'r', encoding='utf-8') as f:
                text = f.read()
                documents = [Document(page_content=text, metadata={"source": file.filename})]
        else:
            os.unlink(tmp_path)
            raise HTTPException(status_code=400, detail="Only PDF and TXT files are supported.")

        # Chunk the documents
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=500,
            chunk_overlap=50,
            length_function=len,
        )
        chunks = text_splitter.split_documents(documents)
        
        # Store in Qdrant using the document store
        from src.tools.document_tools import document_store
        
        texts = [chunk.page_content for chunk in chunks]
        metadatas = [{"source": file.filename, **(chunk.metadata if chunk.metadata else {})} for chunk in chunks]
        
        document_store.store_memories_batch(texts, metadatas=metadatas)
            
        os.unlink(tmp_path)
        
        return {"message": f"Successfully uploaded and processed {file.filename} into {len(chunks)} chunks.", "filename": file.filename}

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/documents")
def get_documents():
    """Returns a list of all uniquely uploaded document filenames from the Qdrant store."""
    try:
        from src.tools.document_tools import document_store
        sources = document_store.get_all_document_sources()
        # Sort for better UX
        sources.sort()
        return {"documents": sources}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/documents/{filename}")
def delete_document(filename: str):
    """Deletes all chunks associated with a specific document filename."""
    try:
        from src.tools.document_tools import document_store
        success = document_store.delete_document_by_source(filename)
        if success:
            return {"message": f"Successfully deleted {filename}"}
        else:
            raise HTTPException(status_code=500, detail="Failed to delete document from vector store.")
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

class SimilaritySearchRequest(BaseModel):
    query: str
    limit: int = 5

@app.post("/api/documents/search")
def search_documents(request: SimilaritySearchRequest):
    """Performs a manual similarity search on the uploaded documents."""
    try:
        from src.tools.document_tools import document_store
        results = document_store.retrieve_relevant_memories(request.query, limit=request.limit)
        
        # Format for frontend
        formatted_results = []
        for r in results:
            formatted_results.append({
                "text": r['text'],
                "source": r['metadata'].get('source', 'Unknown'),
                "score": r['score'],
                "page": r['metadata'].get('page', None)
            })
            
        return {"results": formatted_results}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
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
    
    async def event_generator():
        try:
            # 1. Yield initial status
            yield json.dumps({"type": "status", "content": "Initializing agent..."}) + "\n"
            
            # Local variable to track state updates
            current_state = state.copy()
            
            # 2. Iterate through graph updates
            async for event in agent_app.astream(state):
                for node_name, node_state in event.items():
                    
                    # Update local tracking of state
                    if isinstance(node_state, dict):
                        current_state.update(node_state)
                        # Special handling for list updates (append them instead of overwrite)
                        if "messages" in node_state:
                            # Note: In a real LangGraph, the reducer handles this. 
                            # Here we just want to ensure we have the latest message for the response
                            pass 

                    if node_name == "triage":
                        mode = node_state.get('research_mode', 'unknown')
                        yield json.dumps({"type": "status", "content": f"Triaging request (Mode: {mode})..."}) + "\n"
                    
                    elif node_name == "agent":
                        messages = node_state.get("messages", [])
                        if messages:
                            last_msg = messages[-1]
                            if hasattr(last_msg, 'tool_calls') and last_msg.tool_calls:
                                tool_names = [tc.get('name', 'unknown') for tc in last_msg.tool_calls]
                                yield json.dumps({"type": "status", "content": f"Executing tools: {', '.join(tool_names)}..."}) + "\n"
                            else:
                                yield json.dumps({"type": "status", "content": "Synthesizing final answer..."}) + "\n"
                    
                    elif node_name == "tools":
                        yield json.dumps({"type": "status", "content": "Processing tool results..."}) + "\n"

            # 3. Final response
            # Instead of relying on the last partial update, we invoke the app once to get the FULL final state
            # reliably if we missed any reducer logic, OR we just assume the last "agent" message is the answer.
            
            # Since 'astream' yields partial state updates, reconstructing the full state manually is error-prone without the reducers.
            # However, running 'invoke' again is double-work.
            # The best approach for this specific graph structure:
            
            # 'synthesis' step sets 'final_insight'.
            if "final_insight" in current_state:
                response_text = current_state["final_insight"]
            else:
                 # If 'final_insight' is missing, it means synthesis didn't run or update it.
                 # We fallback to fetching the full state again to be safe.
                 print("Warning: final_insight not found in stream, re-invoking for full state.")
                 final_state_full = await agent_app.ainvoke(state)
                 messages = final_state_full.get('messages', [])
                 response_text = messages[-1].content if messages else "No response generated."
                 current_state = final_state_full

            # Update global session store
            sessions[session_id] = current_state
            
            mode = current_state.get('research_mode', 'UNKNOWN')
            
            yield json.dumps({
                "type": "result", 
                "response": response_text,
                "session_id": session_id,
                "mode": mode
            }) + "\n"

        except Exception as e:
            error_msg = str(e)
            if "429" in error_msg or "Quota" in error_msg or "rate-limit" in error_msg.lower():
                friendly_text = "⚠️ **API Rate Limit Exceeded:** The free tier of Google Gemini only allows 15 requests per minute. Please wait about 30 seconds."
                yield json.dumps({"type": "result", "response": friendly_text, "session_id": session_id, "mode": "error"}) + "\n"
            else:
                import traceback
                traceback.print_exc()
                yield json.dumps({"type": "error", "content": f"Stream error: {str(e)}"}) + "\n"


    return StreamingResponse(event_generator(), media_type="application/x-ndjson")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("src.api.server:app", host="0.0.0.0", port=8261, reload=True)
