# PROJECT DOCUMENTATION - KENT (Financial Research Agent)

## 1. Project Overview
KENT is an AI-powered financial analysis coding agent designed to assist with investment research, market data retrieval, and complex financial modeling. The system architecture is built around a Python/FastAPI/LangGraph backend and a modern Next.js React frontend. It features an intelligent routing system capable of differentiating between "Quick" data retrievals and "Deep" analytical research tasks.

## 2. Architecture & Tech Stack

### Backend Architecture
- **API Server (`src/api/server.py`)**: Built with FastAPI. Provides REST endpoints for document upload, retrieval, and chat streaming via Server-Sent Events (SSE). It manages user session states in memory.
- **Agent Orchestrator (`src/agent/graph.py` & `state.py`)**: Built using LangGraph. The graph controls the flow of information:
  - **Triage Node**: Determines "QUICK" or "DEEP" research mode, extracts explicitly mentioned user preferences, and fetches long-term memory context + relevant documents.
  - **Research Agent Node**: The core LLM reasoning engine that uses the system prompt to decide which tools to call.
  - **Tool Node**: Executes the chosen Python tools.
  - **Synthesis Node**: Synthesizes the final output, ensures frontend widgets are formatted correctly, and logs the session to SQLite for traceability.
- **LLM Support**: Supports both Google Gemini (via `langchain-google-genai`) and local Ollama models.

### Memory & Storage Layer
- **Vector Store (`src/memory/vector_store.py`)**: Uses FAISS vector database powered by HuggingFace embeddings (`sentence-transformers/all-MiniLM-L6-v2`).
  - **MemoryManager**: Manages long-term agent memory and user preferences.
  - **DocumentStore**: Manages uploaded company documents (PDF/TXT files) split into chunks using LangChain text splitters for Retrieval-Augmented Generation (RAG).
- **Structured Store (`src/memory/sqlite_store.py`)**: Uses SQLite to cache tool outputs (to avoid repeated expensive operations or API rate limits) and log agent research sessions for observability.

### Frontend Architecture
- **Framework**: Next.js with React (TypeScript) and CSS Modules for styling.
- **Chat Interface (`client/src/components/ChatInterface.tsx`)**: An interactive sidebar for real-time conversation with the backend agent.
- **Dynamic Board (`client/src/components/DynamicBoard.tsx`)**: The main workspace area.
- **Custom Widgets**: Specialized React components dynamically rendered based on the JSON payload structure returned by the agent tools:
  - `ChartWidget.tsx`: Renders stock comparisons and historical price graphs.
  - `DcfWidget.tsx`: Visualizes Discounted Cash Flow valuation models.
  - `EcosystemWidget.tsx`: Renders supplier, customer, and competitor networks.
  - `InsiderWidget.tsx`: Displays insider trading activity tables.
  - `SupplyChainWidget.tsx`: Analyzes supply chain impact and correlations.
  - `CustomWidget.tsx`: Flexible fallback widget for custom charts or metric tables.

## 3. Key Features & Tools

The agent has access to a variety of specialized Python tools spread across different modules:

### Finance Data (`src/tools/finance_tools.py`)
- **`get_stock_price`**: Fetches current and historical close prices via `yfinance`.
- **`get_financial_statements`**: Retrieves key summaries of Income Statement, Balance Sheet, and Cash Flow.
- **`get_key_metrics`**: Gathers fundamental indicators (P/E ratio, ROE, margins, Beta, Market Cap).
- **`get_options_data`**: Analyzes nearest expiration options chains (calls and puts volumes/implied volatility).

### Advanced Analysis (`src/tools/analysis_tools.py`)
- **`calculate_correlations`**: Builds a correlation matrix of daily returns for a list of tickers.
- **`find_leading_companies`**: Ranks peers based on metrics like market cap, revenue, or return on equity.
- **`get_company_ecosystem`**: Identifies suppliers, customers, and competitors using DuckDuckGo search.
- **`analyze_supply_chain_impact`**: Correlates the performance of a target ticker with its suppliers and customers.
- **`get_insider_trading`**: Fetches recent buying and selling activity by company executives.
- **`calculate_dcf`**: Performs a robust Discounted Cash Flow (DCF) valuation projecting future cash flows and calculating a fair implied share price.
- **`create_custom_widget`**: Generates JSON payloads to render arbitrary charts, metric tables, or markdown on the frontend workspace.

### Web Intelligence & Scraping (`src/tools/scraping_tools.py`)
- **`search_web`**: Conducts general DuckDuckGo searches to pull recent news and snippet data.
- **`scrape_webpage`**: Uses a headless Playwright Chromium browser to render and scrape full text from complex web pages or investor relation announcements.

### Graphing (`src/tools/graphing_tools.py`)
- **`render_stock_comparison_graph`**: Normalizes and returns multi-ticker percentage change data over time for frontend charting.
- **`render_advanced_stock_graph`**: Provides candlestick data and calculates specific Moving Averages (e.g., MA20, MA50) alongside volume data for a single ticker.

### Document Integration (`src/tools/document_tools.py`)
- **`search_company_documents`**: Queries the local FAISS index for semantic matches against user-uploaded documents to ground answers using RAG.
