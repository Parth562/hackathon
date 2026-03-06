import httpx
import json
import asyncio

async def test_ml_tools():
    url = "http://localhost:8261/api/chat"
    payload = {
        "message": "Predict AAPL stock price for the next 60 days and show me all technical indicators including RSI and MACD.",
        "model_name": "glm-5:cloud",
        "provider": "ollama",
        "forced_mode": "DEEP"
    }
    
    print(f"Sending request for ML analysis of AAPL...")
    
    try:
        async with httpx.AsyncClient(timeout=300.0) as client:
            async with client.stream("POST", url, json=payload) as response:
                if response.status_code != 200:
                    print(f"Error: {response.status_code}")
                    print(await response.aread())
                    return

                print("Streaming response:")
                async for line in response.aiter_lines():
                    if not line:
                        continue
                    try:
                        data = json.loads(line)
                        if data["type"] == "status":
                            print(f"STATUS: {data['content']}")
                        elif data["type"] == "token":
                            print(data["content"], end="", flush=True)
                        elif data["type"] == "result":
                            print("\n\nFINAL RESULT COMPLETED")
                            # print(f"Mode: {data['mode']}")
                            # print(f"Session: {data['session_id']}")
                        elif data["type"] == "error":
                            print(f"\nERROR: {data['content']}")
                    except json.JSONDecodeError:
                        pass
    except Exception as e:
        print(f"\nRequest failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_ml_tools())
