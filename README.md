# This repo contains two independent projects

- [`speaker-workbench/`](#speaker-intelligence-workbench) — offline audio diarization/transcription pipeline (below)
- **ALEX: Financial Research Agent** — AI-powered financial research agent (see below)

They share no code paths; each has its own setup instructions.

---

# Speaker Intelligence Workbench

Offline audio pipeline: upload a clip (≤90s) → preprocess → transcribe (faster-whisper) →
diarize (pyannote 3.1) → reconcile → embed + identify speakers (ECAPA + pgvector) →
search/export. Everything runs on-premises; models are baked into the worker image at
build time (`HF_HUB_OFFLINE=1`).

## Run it

```bash
cp .env.example .env        # edit POSTGRES_PASSWORD / API_KEY
echo "<your-hf-token>" > .hf_token   # needed once, to accept pyannote's gated-model terms
make up
```

Deps are managed with [uv](https://docs.astral.sh/uv/) — `api/pyproject.toml` and
`worker/pyproject.toml` are installed via `uv pip install --system -r pyproject.toml`
inside each Dockerfile. For local (non-Docker) dev:

```bash
uv pip install -r worker/pyproject.toml   # or api/pyproject.toml
uv pip install pytest
make test
```

Then: API on `:8000`, web on `:5173`, Postgres on `:5432`.

## Offline verification

```bash
docker compose exec worker env | grep OFFLINE   # HF_HUB_OFFLINE=1 / TRANSFORMERS_OFFLINE=1
docker compose logs worker | grep models_loaded  # confirms models loaded from local disk only
```

The worker Dockerfile fails the *build* (not the first request) if any model in
`models/REGISTRY.yaml` is missing — see `worker/Dockerfile`'s `verify_models` step.

## What's scoped out (and where the seam is)

This follows the original spec's own instruction to name what's cut rather than pretend
it isn't. Everything below is a `# ponytail:`-style deliberate simplification, not an
oversight:

- **Object storage**: local disk under `DATA_DIR`, not MinIO/S3. `common/storage.py` is
  the seam — swap its four functions for an S3 client if this goes multi-node.
- **Migrations**: one `db/init.sql` run by Postgres's own `docker-entrypoint-initdb.d`,
  not Alembic. Fine until the schema needs versioned upgrades against live data.
- **Auth**: single static API key (`common.config.api_key`) checked in
  `api/app/auth.py:get_current_user`. That one function is the documented seam for
  swapping in real SSO/RBAC — every route already depends on it, not on ad-hoc checks.
- **Pagination**: offset/limit, not cursor. Correct up to a few thousand clips; add
  cursor pagination when the library actually gets that large.
- **Phonetic search** (`dmetaphone` for ASR-mangled names) and the **2D embedding plot**:
  not implemented. Full-text, semantic, and hybrid (RRF) search all work.
- **GPU OOM recovery**: retries via arq's normal backoff, not a lower-precision
  `pool.degraded()` variant. Add if OOM under load turns out to be common.
- **Multi-tenancy / RBAC beyond admin**: out of scope per the original spec; no
  `tenant_id` column exists. Add it + a row-level-security policy if needed.

## What's real

Full pipeline stages (validate → preprocess → transcribe → diarize → reconcile → embed →
identify → postprocess → index), reliability-gated identification with margin/abstention
logic, enrollment + centroid recomputation with outlier detection, unknown-speaker
clustering with promote-to-profile, EER calibration, hash-chained audit log, structured
logs with correlation IDs, Prometheus metrics, SRT/VTT/RTTM/JSON/TXT export, hybrid
search, live-tunable pipeline settings, and an on-demand model catalog (download +
activate alternate ASR/diarization/embedding models from the Settings UI). See
`tests/unit` for the logic that has the sharpest edges (word/turn reconciliation,
reliability scoring, turn cleanup).

## Layout

```
common/        shared by api + worker: config, db (asyncpg+pgvector), storage, audit, speaker logic
api/           FastAPI — upload, listing, search, admin, correction, model catalog, WS progress
worker/        arq consumer — the ML pipeline, one stage per file under worker/worker/stages/
web/           React/Vite/TS + Tailwind/shadcn — Library, Upload, ClipDetail, Speakers, Settings
db/init.sql    full schema (pgvector + FTS)
models/        REGISTRY.yaml + prefetch.py, baked into the worker image
```

---

# ALEX: Financial Research Agent 📈
> **An AI-powered financial analysis coding agent designed to assist with investment research, market data retrieval, and complex financial modeling.**

![Python](https://img.shields.io/badge/Python-3.10+-blue.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-green.svg)
![Next.js](https://img.shields.io/badge/Next.js-14+-black)
![LangGraph](https://img.shields.io/badge/LangGraph-Agentic-purple)

---

## 1. Project Overview

This project combines a robust Python-based backend (orchestrated via **LangGraph** and **LangChain**) with a gorgeous, modern **Next.js** frontend dashboard. 

The agent system is capable of distinguishing between "Quick" information requests and "Deep" analytical tasks, routing them to specialized processing pipelines for the best response speed and depth.

---

## 2. Key Features

### 🧠 Backend Capabilities (Python / FastAPI / LangGraph)
* **Intelligent Agent Routing:** Automatically triages user requests into "Quick" (data lookup) or "Deep" (fundamental analysis) workflows.
* **Research & Data Tools:**
  * **Real-time Stock Data:** Prices, volumes, and historical data via `yfinance`.
  * **Financial Statements:** Balance sheets, income statements, and cash flow reports.
  * **Key Metrics:** ROE, EBITDA, P/E ratios, and fundamental indicators.
  * **Options Data:** Analysis of options chains and market sentiment.
* **Advanced Analysis Modules:**
  * **DCF Analysis:** Automated Discounted Cash Flow valuation modeling.
  * **Peer Comparison:** "Leading Companies" tool for benchmarking against industry competitors.
  * **Correlation Analysis:** Calculates statistical correlations between different assets.
  * **Insider Trading:** Tracks and visualizes insider buy/sell activities.
  * **Ecosystem Mapping:** Analyzes and visualizes a company's business ecosystem and relationships.
  * **Python Code Sandbox:** A secure, isolated Python execution environment allowing the LLM to write and run custom scripts (with timeouts) for proprietary math, arrays, or algorithms not covered by standard tools.
* **Web & Document Intelligence:**
  * **Web Scraping:** Autonomous web search and page scraping for latest news/sentiment using DuckDuckGo and Playwright.
  * **RAG (Retrieval-Augmented Generation):** Ingests and searches uploaded company documents (PDFs/Reports) using a Qdrant vector database.
* **Memory & Context:**
  * **Long-term Memory:** Remembers user preferences, risk tolerance, and past queries using Vector Store.
  * **Structured Storage:** Caches financial data in SQLite for quick retrieval.

### 💻 Frontend Dashboard (Next.js / React)
* **Interactive Chat Interface:** A persistent chat sidebar for conversing with the financial agent, featuring **ReactMarkdown** for beautifully formatted internal tool execution logs.
* **Dynamic Widget Board:** A main workspace that dynamically renders interactive widgets based on the conversation context. 
  * *Features a **"Decoupled Data Architecture"** where the LLM passes lightweight configuration parameters to widgets, and widgets autonomously fetch their own massive datasets to prevent LLM token bloat.*
* **Custom Widgets:**
  * `ChartWidget`: Interactive stock price and comparison graphs.
  * `DcfWidget`: Visual breakdown of DCF valuation assumptions and outputs.
  * `EcosystemWidget` / `NetworkGraphWidget`: Force-directed network graph visualizing interconnected entities and industry relationships.
  * `SandboxWidget`: A split-pane IDE view showing the Python code written by the agent alongside its terminal execution output.
  * `InsiderWidget`: Visual tracker for insider trading activity.
  * `CustomWidget`: Flexible component for rendering miscellaneous data insights.

---

## 3. Tech Stack

### Backend
- **Core:** Python 3.x
- **AI/Orchestration:** LangChain & LangGraph
- **API Server:** FastAPI
- **Databases:** Qdrant (Vector / RAG / Memory), SQLite (Structured Cache)
- **Data APIs:** `yfinance` (Market Data), Playwright & BeautifulSoup4 (Scraping)
- **LLM Support:** Google Gemini (Default) / Ollama (Local)

### Frontend
- **Framework:** Next.js (React Framework)
- **Language:** TypeScript
- **Styling:** CSS Modules, Lucide React

---

## 4. Setup & Installation

### Prerequisites
- Python 3.10+
- Node.js & npm/yarn
- API Keys for Google Gemini (*or your preferred LLM provider*)

### Backend Setup
1. Navigate to the root directory.
2. Install dependencies: 
   ```bash
   pip install -r requirements.txt
   ```
3. Set up your `.env` file with necessary API keys.
4. Run the server:
   ```bash
   python main.py
   # or: uvicorn src.api.server:app --reload
   ```

### Frontend Setup
1. Navigate to the client directory: 
   ```bash
   cd client
   ```
2. Install dependencies: 
   ```bash
   npm install
   ```
3. Run the development server: 
   ```bash
   npm run dev
   ```
4. Access the dashboard at [http://localhost:3000](http://localhost:3000)

---

## 5. Future Scope & Roadmap

- **Enhanced Reporting:** Automated generation of PDF investment memos and detailed equity research reports.
- **Multi-Agent Collaboration:** Specialized sub-agents for technical analysis, macro-economic research, and news sentiment analysis working together.
- **User Personalization:** Deeper integration of user portfolio data to provide tailored alerts and recommendations.
- **Real-time Alerts:** WebSocket integration for pushing real-time market price alerts to the frontend.
- **Voice Interface:** Voice-to-text input for hands-free querying.
- **Mobile Application:** React Native version of the dashboard for mobile access.
- **Backtesting Engine:** Ability to simulate trading strategies based on historical data.

---

## 6. Contributing

When adding new tools, ensure they are registered in `src/agent/graph.py` and have corresponding typed definitions in `src/tools/`. Frontend components should be added to `client/src/components` and registered in the `DynamicBoard` component map configuration.
