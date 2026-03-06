import sqlite3
import os
import json
from datetime import datetime
from typing import Dict, Any, List

class StructuredStore:
    """
    Manages structured data using SQLite.
    Used for logging agent outputs, caching financial data to avoid rate limits,
    and structured task history.
    """
    def __init__(self, db_path: str = "agent_data.sqlite"):
        self.db_path = os.path.join(os.getcwd(), db_path)
        self._init_db()
        
    def _get_connection(self):
        return sqlite3.connect(self.db_path)
        
    def _init_db(self):
        """Initialize the SQLite tables."""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        # Table for caching expensive Tool outputs (like Playwright scrape results)
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS tool_cache (
            key TEXT PRIMARY KEY,
            tool_name TEXT,
            result_json TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        ''')
        
        # Table for logging agent sessions/outputs for traceability
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS research_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT,
            query TEXT,
            mode TEXT,
            result_json TEXT,
            assumptions TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        ''')
        
        # Table for Persistent User Portfolio Tracking
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_portfolio (
            ticker TEXT PRIMARY KEY,
            shares REAL,
            cost_basis REAL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        ''')

        # Table for persisting chat sessions + board state
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            title TEXT,
            board_state_json TEXT DEFAULT '[]',
            messages_json TEXT DEFAULT '[]',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        ''')
        # Migrate: add messages_json column if missing (safe for existing DBs)
        try:
            cursor.execute("ALTER TABLE sessions ADD COLUMN messages_json TEXT DEFAULT '[]'")
        except Exception:
            pass  # column already exists

        conn.commit()
        conn.close()
        
    def set_cache(self, tool_name: str, cache_key: str, data: Any):
        """Cache tool results."""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        # Using REPLACE to update exist records with the same primary key
        cursor.execute(
            "INSERT OR REPLACE INTO tool_cache (key, tool_name, result_json) VALUES (?, ?, ?)",
            (cache_key, tool_name, json.dumps(data))
        )
        
        conn.commit()
        conn.close()
        
    def get_cache(self, cache_key: str, max_age_hours: int = 24) -> Any:
        """Retrieve cached tool result if it is fresh enough."""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        cursor.execute(
            "SELECT result_json, timestamp FROM tool_cache WHERE key = ?",
            (cache_key,)
        )
        row = cursor.fetchone()
        conn.close()
        
        if row:
            result_json, timestamp_str = row
            timestamp = datetime.strptime(timestamp_str, "%Y-%m-%d %H:%M:%S")
            if (datetime.utcnow() - timestamp).total_seconds() < (max_age_hours * 3600):
                return json.loads(result_json)
                
        return None
        
    def log_research(self, session_id: str, query: str, mode: str, result: Dict[str, Any], assumptions: List[str]):
        """Log the result of a generic research query for transparency & traceability."""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        cursor.execute(
            "INSERT INTO research_logs (session_id, query, mode, result_json, assumptions) VALUES (?, ?, ?, ?, ?)",
            (session_id, query, mode, json.dumps(result), json.dumps(assumptions))
        )
        
        log_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        return log_id
        
    def update_portfolio_item(self, ticker: str, shares: float, cost_basis: float = 0.0) -> bool:
        """Upsert a holding into the user's permanent SQLite portfolio."""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        if shares <= 0:
            cursor.execute("DELETE FROM user_portfolio WHERE ticker = ?", (ticker,))
        else:
            cursor.execute(
                "INSERT OR REPLACE INTO user_portfolio (ticker, shares, cost_basis, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)",
                (ticker, shares, cost_basis)
            )
            
        conn.commit()
        conn.close()
        return True
        
    def get_full_portfolio(self) -> List[Dict[str, Any]]:
        """Retrieve all current holdings from the user's permanent SQLite portfolio."""
        conn = self._get_connection()
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute("SELECT ticker, shares, cost_basis FROM user_portfolio ORDER BY ticker ASC")
        rows = cursor.fetchall()
        conn.close()
        
        return [{"ticker": row["ticker"], "shares": row["shares"], "cost_basis": row["cost_basis"]} for row in rows]

    # ── Session management ────────────────────────────────────────────────────

    def upsert_session(self, session_id: str, title: str = None, board_state: list = None) -> bool:
        """Create or update a session record."""
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute(
            """INSERT INTO sessions (id, title, board_state_json, updated_at)
               VALUES (?, ?, ?, CURRENT_TIMESTAMP)
               ON CONFLICT(id) DO UPDATE SET
                 title = COALESCE(?, title),
                 board_state_json = COALESCE(?, board_state_json),
                 updated_at = CURRENT_TIMESTAMP""",
            (
                session_id,
                title or "Untitled Chat",
                json.dumps(board_state or []),
                title,
                json.dumps(board_state) if board_state is not None else None,
            )
        )
        conn.commit()
        conn.close()
        return True

    def save_board_state(self, session_id: str, board_state: list) -> bool:
        """Persist the board widget state for a session."""
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE sessions SET board_state_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (json.dumps(board_state), session_id)
        )
        if cursor.rowcount == 0:
            # Session doesn't exist yet — create it
            cursor.execute(
                "INSERT INTO sessions (id, title, board_state_json) VALUES (?, 'Untitled Chat', ?)",
                (session_id, json.dumps(board_state))
            )
        conn.commit()
        conn.close()
        return True

    def save_messages(self, session_id: str, messages: list) -> bool:
        """Persist chat messages (as simple role/content dicts) for a session."""
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE sessions SET messages_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (json.dumps(messages), session_id)
        )
        conn.commit()
        conn.close()
        return True

    def get_all_sessions(self) -> List[Dict[str, Any]]:
        """Return all sessions ordered by most recently updated."""
        conn = self._get_connection()
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT id, title, created_at, updated_at FROM sessions ORDER BY updated_at DESC")
        rows = cursor.fetchall()
        conn.close()
        return [{"id": r["id"], "title": r["title"], "created_at": r["created_at"], "updated_at": r["updated_at"]} for r in rows]

    def get_session(self, session_id: str) -> Dict[str, Any]:
        """Return session metadata + board state + messages."""
        conn = self._get_connection()
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM sessions WHERE id = ?", (session_id,))
        row = cursor.fetchone()
        conn.close()
        if not row:
            return None
        return {
            "id": row["id"],
            "title": row["title"],
            "board_state": json.loads(row["board_state_json"] or "[]"),
            "messages": json.loads(row["messages_json"] or "[]"),
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
        }

    def delete_session(self, session_id: str) -> bool:
        """Delete a session."""
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
        conn.commit()
        conn.close()
        return True
