import os
from dotenv import load_dotenv
load_dotenv()
from src.tools.mcp_tools import call_alphavantage_mcp
print(call_alphavantage_mcp.invoke({"tool_name": "PING", "arguments": {}}))
