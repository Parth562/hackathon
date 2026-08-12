"""
memory_node.py
~~~~~~~~~~~~~~
Extracts personal facts / preferences from user messages and stores them
in the long-term MemoryManager (Qdrant) so they persist across sessions.

This runs as a fire-and-forget background task after each chat response.
"""
import asyncio
from datetime import datetime


EXTRACTION_PROMPT = """You are a MEMORY EXTRACTION assistant.
Read the user's message below and decide if it contains any personal facts, preferences,
or important context that should be remembered for FUTURE conversations.

Examples of things to extract:
- "I own ABC Industries" → FACT: The user owns a company called ABC Industries.
- "My risk tolerance is low" → FACT: The user has low risk tolerance.
- "I'm interested in renewable energy stocks" → FACT: The user is interested in renewable energy stocks.
- "I invested 50 lakhs in HDFC" → FACT: The user invested 50 lakhs in HDFC.
- "I'm based in Mumbai" → FACT: The user is based in Mumbai.

Do NOT extract:
- Questions or data requests (e.g., "What is AAPL price?")
- Transient instructions (e.g., "Show me a chart")
- Information that is only relevant to this conversation turn

If there ARE personal facts, respond with one fact per line, each starting with "FACT: ".
If there are NO personal facts, respond with exactly: NONE

USER MESSAGE:
{message}"""


async def extract_and_store_facts(user_message: str):
    """
    Send the user message to the LLM, extract personal facts,
    and store them in MemoryManager for cross-session recall.
    """
    try:
        from src.agent.graph import get_llm, get_memory_manager
        from langchain_core.messages import SystemMessage

        llm = get_llm()
        prompt = EXTRACTION_PROMPT.format(message=user_message)

        response = await llm.ainvoke([SystemMessage(content=prompt)])
        content = response.content.strip()

        if not content or content.upper() == "NONE":
            return

        # Parse out facts
        facts = []
        for line in content.split("\n"):
            line = line.strip()
            if line.upper().startswith("FACT:"):
                fact_text = line[5:].strip()
                if fact_text:
                    facts.append(fact_text)

        if not facts:
            return

        # Store each fact in MemoryManager with metadata
        memory = get_memory_manager()
        timestamp = datetime.utcnow().isoformat()

        for fact in facts:
            await asyncio.to_thread(
                memory.store_memory,
                fact,
                {
                    "type": "user_fact",
                    "source": "conversation_extraction",
                    "timestamp": timestamp,
                    "original_message": user_message[:200],
                },
            )
            print(f"[Memory] Stored user fact: {fact}")

    except Exception as e:
        # Never let memory extraction crash the main flow
        print(f"[Memory] Fact extraction failed (non-fatal): {e}")
