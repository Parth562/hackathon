from langchain_core.messages import SystemMessage
from src.agent.state import AgentState

def _fetch_document_context(query: str) -> str:
    """Auto-retrieve relevant context from uploaded documents via Qdrant."""
    try:
        from src.tools.document_tools import get_document_store
        store = get_document_store()
        results = store.retrieve_relevant_memories(query, limit=5)
        if not results:
            return ""
        
        context_parts = []
        for idx, hit in enumerate(results):
            source = hit.get("metadata", {}).get("source", "Unknown")
            score = hit.get("score", 0)
            # Only include results with reasonable relevance (cosine > 0.25)
            if score < 0.25:
                continue
            context_parts.append(
                f"--- Document Excerpt {idx+1} (Source: {source}, Score: {score:.2f}) ---\n{hit['text']}"
            )
        
        if not context_parts:
            return ""
        
        n = len(context_parts)
        print(f"[RAG] Retrieved {n} document excerpts for query: {query[:80]}...")
        return "CONTEXT FROM UPLOADED DOCUMENTS:\n\n" + "\n\n".join(context_parts)
    except Exception as e:
        print(f"[RAG] Auto-retrieval failed: {e}")
        return ""


def _fetch_user_memories(query: str) -> str:
    """Auto-retrieve relevant personal facts/preferences from long-term memory."""
    try:
        from src.agent.graph import get_memory_manager
        memory = get_memory_manager()
        results = memory.retrieve_relevant_memories(query, limit=5)
        if not results:
            return ""
        
        # Filter to only user_fact type entries with decent scores
        facts = []
        for hit in results:
            meta = hit.get("metadata", {})
            score = hit.get("score", 0)
            if meta.get("type") != "user_fact":
                continue
            if score < 0.20:
                continue
            facts.append(hit["text"])
        
        if not facts:
            return ""
        
        print(f"[Memory] Retrieved {len(facts)} user memories for query: {query[:80]}...")
        return "USER'S PERSONAL CONTEXT (remembered from past conversations):\n" + "\n".join(
            f"- {fact}" for fact in facts
        )
    except Exception as e:
        print(f"[Memory] Auto-retrieval failed: {e}")
        return ""


async def intent_node(state: AgentState) -> dict:
    """
    Evaluates the user query to classify the intent into one of 4 tiers:
    READ_DATA, WRITE_DATA, ANALYSIS, RESEARCH.
    Also auto-retrieves RAG context and user memories for every query.
    """
    messages = state.get("messages", [])
    if not messages:
        return {"intent": "RESEARCH", "document_context": "", "memory_context": ""}

    user_query = messages[-1].content.lower()

    # ── 0. Auto-retrieve RAG context + user memories in parallel ─────────────
    import asyncio
    doc_future = asyncio.to_thread(_fetch_document_context, user_query)
    mem_future = asyncio.to_thread(_fetch_user_memories, user_query)
    document_context, memory_context = await asyncio.gather(doc_future, mem_future)

    # ── 1. Deterministic / Keyword-based Rules ─────────────────────────────────
    # These must fire BEFORE the LLM to prevent expensive misclassifications.

    # Canvas / UI / workflow creation — always READ_DATA (spawn widgets + tools)
    CANVAS_KEYWORDS = [
        "canvas", "board", "widget", "show", "display", "flow", "workflow",
        "create a flow", "connect", "stream", "live widget", "add to canvas",
        "show on", "put on", "place on", "draw", "chart", "visualise", "visualize",
    ]
    is_canvas_request = any(kw in user_query for kw in CANVAS_KEYWORDS)

    # Simple price / data lookups
    PRICE_KEYWORDS = ["price", "quote", "current value", "how much is", "what is the price"]
    is_price_request = any(kw in user_query for kw in PRICE_KEYWORDS)

    # Portfolio WRITES — only fire when the user explicitly modifies counts/positions
    # Must have (buy/sell/bought/sold/remove + quantity context) OR explicit "add X shares"
    WRITE_VERBS = ["bought", "sold", "i bought", "i sold", "purchase", "sell"]
    ADD_REMOVE_VERBS = ["add", "remove", "buy", "sell"]
    PORTFOLIO_NOUNS = ["shares", "position", "holdings", "stake", "lot", "units"]

    # Strong write signals: explicit "I bought / sold X"
    is_explicit_trade = any(kw in user_query for kw in WRITE_VERBS) and any(
        kw in user_query for kw in PORTFOLIO_NOUNS
    )
    # Ambiguous add only: "add X shares" where there is a NUMBER and "shares"
    import re
    has_number = bool(re.search(r'\b\d+\b', user_query))
    is_add_shares = (
        any(kw in user_query for kw in ADD_REMOVE_VERBS)
        and any(kw in user_query for kw in PORTFOLIO_NOUNS)
        and has_number
    )

    # Always prefer canvas_request over portfolio write
    is_portfolio_mod = (is_explicit_trade or is_add_shares) and not is_canvas_request

    # Route immediately based on deterministic rules
    if is_portfolio_mod:
        return {"intent": "WRITE_DATA", "document_context": document_context, "memory_context": memory_context}

    if is_canvas_request or is_price_request:
        # Unless it explicitly asks for deep analysis, route to quick READ
        if not any(kw in user_query for kw in [
            "analyze", "predict", "forecast", "dcf", "valuation",
            "compare", "benchmark", "risk score", "scenario", "technical indicators",
        ]):
            return {"intent": "READ_DATA", "document_context": document_context, "memory_context": memory_context}

    # "show me / what is my portfolio" → READ
    if "portfolio" in user_query and any(kw in user_query for kw in ["show", "what", "my", "view"]):
        return {"intent": "READ_DATA", "document_context": document_context, "memory_context": memory_context}

    # ── 2. LLM Classification for complex / ambiguous queries ──────────────────
    from src.agent.graph import get_llm
    llm = get_llm(state)

    system_prompt = """Classify the following user query into exactly ONE of these four categories:

1. READ_DATA — Simple data retrieval: getting stock prices, adding live widgets/charts to the canvas, viewing portfolio, creating canvas flows/workflows, connecting widgets, fetching financial data.
2. WRITE_DATA — Strictly: recording a trade the user has actually made (e.g. "I bought 10 shares of AAPL"). NEVER use this for UI/canvas actions.
3. ANALYSIS — Calculations or comparisons: DCF valuation, peer benchmarking, risk scores, technical indicators, scenario analysis.
4. RESEARCH — Deep qualitative research: macro trends, news, supply chain, RAG document search.

Return ONLY the category name. No explanation.

Examples:
"What is AAPL's price?" -> READ_DATA
"Show me the live widget for AAPL" -> READ_DATA
"Create a flow where a variable multiplies the Google stock price" -> READ_DATA
"Add a live stock chart for GOOGL to the canvas" -> READ_DATA
"Connect variable discount_rate to the DCF widget" -> READ_DATA
"I bought 10 shares of MSFT" -> WRITE_DATA
"Sell 5 shares of NVDA from my portfolio" -> WRITE_DATA
"Calculate DCF for NVDA" -> ANALYSIS
"How does AMD compare to INTC on margins?" -> ANALYSIS
"What are the macro catalysts for tech stocks?" -> RESEARCH
"Search our documents for Q3 earnings" -> RESEARCH"""

    try:
        response = await llm.ainvoke([
            SystemMessage(content=system_prompt),
            messages[-1]
        ])

        content = response.content.strip().upper()

        if "WRITE_DATA" in content:
            return {"intent": "WRITE_DATA", "document_context": document_context, "memory_context": memory_context}
        elif "READ_DATA" in content:
            return {"intent": "READ_DATA", "document_context": document_context, "memory_context": memory_context}
        elif "ANALYSIS" in content:
            return {"intent": "ANALYSIS", "document_context": document_context, "memory_context": memory_context}
        else:
            return {"intent": "RESEARCH", "document_context": document_context, "memory_context": memory_context}

    except Exception as e:
        print(f"[Intent Classifier] Failed: {e}")
        return {"intent": "RESEARCH", "document_context": document_context, "memory_context": memory_context}
