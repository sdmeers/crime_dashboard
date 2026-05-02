import sqlite3
import json
import time
from typing import Any, Optional
from .base import CacheRepository

class SQLiteCache(CacheRepository):
    def __init__(self, db_path: str = "cache.db"):
        self.db_path = db_path
        self._init_db()

    def _init_db(self):
        with sqlite3.connect(self.db_path) as conn:
            conn.execute('''
                CREATE TABLE IF NOT EXISTS cache (
                    key TEXT PRIMARY KEY,
                    value TEXT,
                    expires_at REAL
                )
            ''')
            conn.commit()

    async def get(self, key: str) -> Optional[Any]:
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                "SELECT value, expires_at FROM cache WHERE key = ?", (key,)
            )
            row = cursor.fetchone()
            if row:
                value, expires_at = row
                if expires_at and time.time() > expires_at:
                    conn.execute("DELETE FROM cache WHERE key = ?", (key,))
                    conn.commit()
                    return None
                return json.loads(value)
        return None

    async def set(self, key: str, value: Any, ttl_seconds: int = 86400) -> None:
        expires_at = time.time() + ttl_seconds if ttl_seconds else None
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                "INSERT OR REPLACE INTO cache (key, value, expires_at) VALUES (?, ?, ?)",
                (key, json.dumps(value), expires_at)
            )
            conn.commit()
