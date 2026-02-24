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
