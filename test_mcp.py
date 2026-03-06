import asyncio
import os
from mcp.client.sse import sse_client
from mcp.client.session import ClientSession

async def main():
    api_key = "9JSFVQ6UOX4D04J8" # From .env
    url = f"https://mcp.alphavantage.co/mcp?apikey={api_key}"
    async with sse_client(url) as streams:
        async with ClientSession(streams[0], streams[1]) as session:
            await session.initialize()
            tools = await session.list_tools()
            print("Server returned", len(tools.tools), "tools")
            print(tools.tools[0].name)

asyncio.run(main())
