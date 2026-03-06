PROJECT DOCUMENTATION - KEN (financial research agent)

1. PROJECT OVERVIEW
-------------------
This project is a sophisticated AI-powered financial analysis coding agent designed to assist with investment research, market data retrieval, and complex financial modeling. It combines a Python-based backend (using LangGraph and LangChain) with a modern Next.js frontend dashboard. The system is capable of distinguishing between "Quick" information requests and "Deep" analytical tasks, routing them to the appropriate processing pipelines.

2. KEY FEATURES
---------------

Backend Capabilities (Python/FastAPI/LangGraph):
- Intelligent Agent Routing: Automatically triages user requests into "Quick" (data lookup) or "Deep" (fundamental analysis) workflows.
- Research & Data Tools:
  - Real-time Stock Data: Prices, volumes, and historical data via yfinance.
  - Financial Statements: Balance sheets, income statements, and cash flow reports.
  - Key Metrics: ROE, EBITDA, P/E ratios, and other fundamental indicators.
  - Options Data: Analysis of options chains and market sentiment.
- Advanced Analysis Modules:
  - DCF Analysis: Automated Discounted Cash Flow valuation modeling.
  - Peer Comparison: "Leading Companies" tool for benchmarking against industry competitors.
  - Correlation Analysis: Calculates statistical correlations between different assets.
  - Insider Trading: Tracks and visualizes insider buy/sell activities.
  - Ecosystem Mapping: Analyzes and visualizes a company's business ecosystem and relationships.
- Web & Document Intelligence:
  - Web Scraping: Autonomous web search and page scraping for latest news/sentiment using DuckDuckGo and Playwright.
  - RAG (Retrieval-Augmented Generation): Ingests and searches uploaded company documents (PDFs/Reports) using Qdrant vector database.
- Memory & Context:
  - Long-term Memory: Remembers user preferences, risk tolerance, and past queries using Vector Store.
  - Structured Storage: Caches financial data in SQLite for quick retrieval.

Frontend Dashboard (Next.js/React):
- Interactive Chat Interface: A persistent chat sidebar for conversing with the financial agent.
- Dynamic Widget Board: A main workspace that dynamically renders interactive widgets based on the conversation context.
- Custom Widgets:
  - ChartWidget: Interactive stock price and comparison graphs.
  - DcfWidget: Visual breakdown of DCF valuation assumptions and outputs.
  - EcosystemWidget: Network graph of company relationships.
  - InsiderWidget: Visual tracker for insider trading activity.
  - CustomWidget: Flexible component for rendering miscellaneous data insights.

3. TECH STACK
-------------
Backend:
- Python 3.x
- LangChain & LangGraph (Agent orchestration)
- FastAPI (API Server)
- Qdrant (Vector Database for RAG and Memory)
- SQLite (Structured Data Cache)
- yfinance (Market Data)
- Playwright & BeautifulSoup4 (Web Scraping)
- Google Gemini (Default LLM) / Ollama (Local LLM support)

Frontend:
- Next.js (React Framework)
- TypeScript
- CSS Modules

4. SETUP & INSTALLATION
-----------------------
Prerequisites:
- Python 3.10+
- Node.js & npm/yarn
- API Keys for Google Gemini (and potentially others)

Backend Setup:
1. Navigate to the root directory.
2. Install dependencies: pip install -r requirements.txt
3. Set up environment variables (.env) with necessary API keys.
4. Run the server: python main.py (or uvicorn src.api.server:app --reload)

Frontend Setup:
1. Navigate to the client directory: cd client
2. Install dependencies: npm install
3. Run the development server: npm run dev
4. Access the dashboard at http://localhost:3000

5. FUTURE SCOPE & ROADMAP
-------------------------
- Enhanced Reporting: Automated generation of PDF investment memos and detailed equity research reports.
- Multi-Agent Collaboration: Specialized sub-agents for technical analysis, macro-economic research, and news sentiment analysis working together.
- User Personalization: deeper integration of user portfolio data to provide tailored alerts and recommendations.
- Real-time Alerts: WebSocket integration for pushing real-time market price alerts to the frontend.
- Voice Interface: Voice-to-text input for hands-free querying.
- Mobile Application: React Native version of the dashboard for mobile access.
- Backtesting Engine: Ability to simulate trading strategies based on historical data.

6. CONTRIBUTING
---------------
When adding new tools, ensure they are registered in `src/agent/graph.py` and have corresponding typed definitions in `src/tools/`. Frontend components should be added to `client/src/components` and registered in the `DynamicBoard` component map.
