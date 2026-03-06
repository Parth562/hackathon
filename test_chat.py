import asyncio
import httpx
import json

async def test_chat():
    url = "http://localhost:8261/api/chat"
    payload = {
        "message": "What is the recent financial performance of AAPL?"
    }
    
    print(f"Sending request to {url}...")
    async with httpx.AsyncClient(timeout=300.0) as client:
        async with client.stream("POST", url, json=payload) as response:
            print(f"Status: {response.status_code}")
            async for line in response.aiter_lines():
                if not line.strip():
                    continue
                try:
                    data = json.loads(line)
                    if data.get("type") == "status":
                        print(f"[STATUS] {data.get('content')}")
                    elif data.get("type") == "token":
                        # print(data.get("content"), end="", flush=True)
                        pass
                    elif data.get("type") == "result":
                        print(f"\n[RESULT] Mode: {data.get('mode')}")
                        print("="*40)
                        print(data.get('response'))
                        print("="*40)
                    elif data.get("type") == "error":
                        print(f"[ERROR] {data.get('content')}")
                except json.JSONDecodeError:
                    print(f"Unparsed line: {line}")

if __name__ == "__main__":
    asyncio.run(test_chat())
