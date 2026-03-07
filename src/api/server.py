from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Any
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
from src.memory.sqlite_store import StructuredStore
from src.tools.canvas_tools import update_canvas_state, pop_pending_actions
from langchain_core.messages import HumanMessage
import uuid

# Shared structured data store for sessions, portfolio, etc.
_store = StructuredStore()

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
    model_name: str = "glm-5:cloud"
    provider: str = "ollama"
    forced_mode: str = None  # 'QUICK' or 'DEEP' — bypasses triage LLM classification

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
async def upload_document(file: UploadFile = File(...)):
    """Uploads a company document, extracts text, chunks it, and stores in the FAISS document index."""
    try:
        # Create a temporary file to save the uploaded content
        suffix = os.path.splitext(file.filename)[1]
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name

        documents = []
        if suffix.lower() == '.pdf':
            loader = PyPDFLoader(tmp_path)
            documents = await asyncio.to_thread(loader.load)
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
            chunk_size=2000,
            chunk_overlap=200,
            length_function=len,
        )
        chunks = text_splitter.split_documents(documents)
        
        from src.tools.document_tools import get_document_store
        
        texts = [chunk.page_content for chunk in chunks]
        metadatas = [{**(chunk.metadata if chunk.metadata else {}), "source": file.filename} for chunk in chunks]
        
        await asyncio.to_thread(get_document_store().store_memories_batch, texts, metadatas=metadatas)
            
        os.unlink(tmp_path)
        
        return {"message": f"Successfully uploaded and processed {file.filename} into {len(chunks)} chunks.", "filename": file.filename}

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/documents")
async def get_documents():
    """Returns a list of all uniquely uploaded document filenames from the FAISS index."""
    try:
        from src.tools.document_tools import get_document_store
        sources = await asyncio.to_thread(get_document_store().get_all_document_sources)
        # Sort for better UX
        sources.sort()
        return {"documents": sources}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/quote/{ticker}")
async def get_live_quote(ticker: str):
    """Endpoint for the frontend to poll live stock prices directly, bypassing the LLM."""
    try:
        from src.tools.groww_tools import get_live_stock_price_groww
        # The tool returns a JSON string, so we parse it to send as a proper JSON response
        result_json = await asyncio.to_thread(get_live_stock_price_groww.invoke, ticker)
        return json.loads(result_json)
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/history/{ticker}")
async def get_price_history(ticker: str, period: str = "1y", interval: str = "1d"):
    """
    Returns raw OHLCV price history using yfinance (free, local — no API key).
    period: 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max
    interval: 1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h, 1d, 5d, 1wk, 1mo, 3mo
    The browser computes all indicators locally from this data.
    """
    try:
        import yfinance as yf
        def _fetch():
            t = yf.Ticker(ticker)
            hist = t.history(period=period, interval=interval)
            if hist.empty:
                return []
            rows = []
            for dt, row in hist.iterrows():
                rows.append({
                    "time": dt.strftime("%Y-%m-%d") if interval in ("1d","5d","1wk","1mo","3mo") else dt.strftime("%Y-%m-%dT%H:%M:%S"),
                    "open":   float(row["Open"]),
                    "high":   float(row["High"]),
                    "low":    float(row["Low"]),
                    "close":  float(row["Close"]),
                    "volume": int(row["Volume"]),
                })
            return rows

        data = await asyncio.to_thread(_fetch)
        return {"ticker": ticker, "data": data}
    except Exception as e:
        return {"error": str(e), "data": []}

@app.get("/api/indicators/{ticker}")
async def get_technical_indicator(ticker: str, function: str = "SMA", interval: str = "daily", time_period: str = "20", series_type: str = "close"):
    """Fetch Alpha Vantage mathematical preprocessing indicators natively."""
    try:
        from src.tools.alpha_vantage_tools import _fetch_alpha_vantage
        
        params = {
            "function": function,
            "symbol": ticker,
            "interval": interval,
            "time_period": time_period,
            "series_type": series_type
        }
        
        result = await asyncio.to_thread(_fetch_alpha_vantage, params)
        
        # Transform Alpha Vantage standard response into a time-series array
        data_key = next((k for k in result.keys() if "Technical Analysis" in k), None)
        series = []
        if data_key and isinstance(result[data_key], dict):
            # Object with dates like "2024-03-01": {"SMA": "150.22"}
            for date_str, values in result[data_key].items():
                # Extract the first value (since key name depends on function)
                val = next(iter(values.values()), None)
                if val is not None:
                    series.append({"time": date_str, "value": float(val)})
            
            # Sort chronologically
            series.sort(key=lambda x: x["time"])
            
        return {"ticker": ticker, "function": function, "data": series}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/documents/{filename}")
async def delete_document(filename: str):
    """Deletes all chunks associated with a specific document filename."""
    try:
        from src.tools.document_tools import get_document_store
        success = await asyncio.to_thread(get_document_store().delete_document_by_source, filename)
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
async def search_documents(request: SimilaritySearchRequest):
    """Performs a manual similarity search on the uploaded documents."""
    try:
        from src.tools.document_tools import get_document_store
        results = await asyncio.to_thread(get_document_store().retrieve_relevant_memories, request.query, limit=request.limit)
        
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


# ── Canvas State Endpoints ────────────────────────────────────────────────────

class CanvasStateRequest(BaseModel):
    nodes: list
    edges: list

@app.post("/api/canvas/{session_id}/state")
async def push_canvas_state(session_id: str, request: CanvasStateRequest):
    """Frontend pushes the current node/edge state so the LLM can read it."""
    await asyncio.to_thread(update_canvas_state, session_id, request.nodes, request.edges)
    return {"ok": True}

@app.get("/api/canvas/{session_id}/actions")
async def get_canvas_actions(session_id: str):
    """Frontend polls this to get any pending LLM-driven canvas actions."""
    actions = await asyncio.to_thread(pop_pending_actions, session_id)
    return {"actions": actions}


@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    session_id = request.session_id or str(uuid.uuid4())
    
    # Retrieve existing session state or initialize a new one
    if session_id in sessions:
        state = sessions[session_id]
        state["messages"].append(HumanMessage(content=request.message))
    else:
        state = {
            "messages": [HumanMessage(content=request.message)],
            "session_id": session_id,
            "model_name": request.model_name,
            "provider": request.provider,
            "forced_mode": request.forced_mode,
            "tools_used": [],
            "assumptions": [],
            "confidence_score": 0.0,
            "detected_contradictions": []
        }
        # Persist session to DB with the first message as title
        title = request.message[:60].strip()
        await asyncio.to_thread(_store.upsert_session, session_id, title)
    
    async def event_generator():
        try:
            # 1. Yield initial status
            yield json.dumps({"type": "status", "content": "Routing request..."}) + "\n"
            
            # Tracking state updates for final result and persistence
            current_state = state.copy()
            
            # Nodes whose AI output chunks should be streamed to the user as final tokens
            STREAMING_NODES = {"report", "read_data", "write_data"}
            
            import re as _re
            async for event in agent_app.astream_events(state, version="v2"):
                kind = event["event"]
                metadata = event.get("metadata", {})
                langgraph_node = metadata.get("langgraph_node", "")

                # A. Token Streaming
                if kind == "on_chat_model_stream":
                    content = event["data"]["chunk"].content
                    if content and langgraph_node in STREAMING_NODES:
                        yield json.dumps({"type": "token", "content": content}) + "\n"
                    elif content:
                        yield json.dumps({"type": "thinking", "kind": "reasoning", "content": content}) + "\n"

                # B. Tool Execution
                elif kind == "on_tool_start":
                    tool_name = event["name"]
                    inputs = event["data"].get("input", {})
                    yield json.dumps({
                        "type": "thinking", 
                        "kind": "tool_start", 
                        "tool": tool_name, 
                        "input": inputs
                    }) + "\n"
                
                elif kind == "on_tool_end":
                    tool_name = event["name"]
                    output = event["data"].get("output", "")
                    str_output = str(output)[:500] + "..." if len(str(output)) > 500 else str(output)
                    yield json.dumps({
                        "type": "thinking", 
                        "kind": "tool_end", 
                        "tool": tool_name, 
                        "output": str_output
                    }) + "\n"

                # C. Node Status Updates
                elif kind == "on_chain_start":
                    name = event["name"]
                    status_map = {
                        "intent": "🧭 Understanding your request...",
                        "read_data": "📊 Fetching data...",
                        "write_data": "✏️ Updating portfolio...",
                        "planner": "🗺️ Planner: Formulating research plan...",
                        "research": "🔍 Research Agent: Scouring the web and documents...",
                        "data": "📈 Data Agent: Retrieving hard financial figures...",
                        "analysis": "🧮 Analysis Agent: Running quantitative models...",
                        "critic": "🔬 Critic Agent: Verifying reasoning and assessing risks...",
                        "report": "📝 Report Agent: Synthesizing final insight..."
                    }
                    if name in status_map:
                        yield json.dumps({"type": "status", "content": status_map[name]}) + "\n"

                # D. State Updates & Intermediate Widgets
                elif kind == "on_chain_end":
                    data = event.get("data", {})
                    output = data.get("output", {})
                    
                    if isinstance(output, dict):
                        # Update current state tracker
                        current_state.update(output)
                        
                        # Handle widgets
                        if "intermediate_widgets" in output:
                            for raw_widget in output["intermediate_widgets"]:
                                clean_json = _re.sub(r"```widget\n|\n```", "", raw_widget).strip()
                                try:
                                    parsed = json.loads(clean_json)
                                    yield json.dumps({"type": "widget", "content": parsed}) + "\n"
                                except: pass

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
            
            # Persist messages for session restore
            raw_messages = current_state.get("messages", [])
            serialized = []
            for m in raw_messages:
                role = "user" if getattr(m, "type", None) == "human" else "agent"
                serialized.append({"role": role, "content": m.content})
            await asyncio.to_thread(_store.save_messages, session_id, serialized)
            
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


# ── Session Management Endpoints ─────────────────────────────────────────────

@app.get("/api/sessions")
async def get_sessions():
    """List all sessions ordered by most recently updated."""
    try:
        session_list = await asyncio.to_thread(_store.get_all_sessions)
        return {"sessions": session_list}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/sessions/{session_id}")
async def get_session(session_id: str):
    """Get session metadata + board state."""
    try:
        data = await asyncio.to_thread(_store.get_session, session_id)
        if not data:
            raise HTTPException(status_code=404, detail="Session not found")
        return data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class BoardStateRequest(BaseModel):
    board_state: Any  # Can be list (legacy) or {nodes, edges} object

@app.post("/api/sessions/{session_id}/board")
async def save_board(session_id: str, request: BoardStateRequest):
    """Persist the board widget state for a session."""
    try:
        await asyncio.to_thread(_store.save_board_state, session_id, request.board_state)
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/sessions/{session_id}")
async def delete_session(session_id: str):
    """Delete a session and its history."""
    try:
        await asyncio.to_thread(_store.delete_session, session_id)
        # Also purge from in-memory store
        sessions.pop(session_id, None)
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class AlertRequest(BaseModel):
    ticker: str
    condition: str = "negative_fcf"

@app.post("/api/alerts")
async def check_alerts(request: AlertRequest):
    """
    Simple rule-based alert endpoint.
    """
    try:
        from src.tools.finance_tools import get_financial_statements
        result_json = await asyncio.to_thread(get_financial_statements.invoke, request.ticker)
        data = json.loads(result_json)
        
        alerts = []
        if request.condition == "negative_fcf":
            fcf = data.get("free_cash_flow")
            if fcf is not None and fcf < 0:
                alerts.append(f"ALERT: {request.ticker} has negative Free Cash Flow: {fcf}")
            elif fcf is not None:
                alerts.append(f"OK: {request.ticker} has positive Free Cash Flow: {fcf}")
            else:
                alerts.append(f"UNKNOWN: FCF data missing for {request.ticker}")
                
        return {"ticker": request.ticker, "alerts": alerts}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("src.api.server:app", host="0.0.0.0", port=8261, reload=True)
