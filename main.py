import os
import sys
import uvicorn
from dotenv import load_dotenv

# Load environment variables (expecting GEMINI_API_KEY) BEFORE any langchain imports
load_dotenv()

# Ensure the src directory is in the path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

if __name__ == "__main__":
    print("Starting Financial Research Agent API Server...")
    # Run the FastAPI server defined in src/api/server.py
    uvicorn.run("src.api.server:app", host="0.0.0.0", port=8261, reload=True)
