import os
from dotenv import load_dotenv

load_dotenv()

from src.tools.groww_tools import get_live_stock_price_groww

if __name__ == "__main__":
    print("Testing Groww Live Price Tool...")
    # Test with Reliance or TCS
    result = get_live_stock_price_groww.invoke({"ticker": "RELIANCE.NS"})
    print("\nResult:\n", result)
