import urllib.request
import json

try:
    req = urllib.request.Request(
        'http://127.0.0.1:8261/api/chat', 
        data=json.dumps({"message": "graph aapl"}).encode('utf-8'), 
        headers={'Content-Type': 'application/json'}
    )
    res = urllib.request.urlopen(req)
    print("Status:", res.getcode())
    print("Response:", res.read().decode())
except urllib.error.HTTPError as e:
    print("HTTP Error:", e.code)
    print("Error Body:", e.read().decode())
except Exception as e:
    print("Error:", e)
