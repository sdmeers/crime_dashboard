from typing import Any, Optional
import time
import json
import hashlib
from google.cloud import firestore
from .base import CacheRepository

class FirestoreCache(CacheRepository):
    def __init__(self, collection_name: str = "cache"):
        self.db = firestore.AsyncClient()
        self.collection_name = collection_name

    def _hash_key(self, key: str) -> str:
        # Firestore document IDs cannot contain slashes and have length limits.
        # Hashing the key ensures safe document IDs.
        return hashlib.sha256(key.encode('utf-8')).hexdigest()

    async def get(self, key: str) -> Optional[Any]:
        hashed_key = self._hash_key(key)
        doc_ref = self.db.collection(self.collection_name).document(hashed_key)
        doc = await doc_ref.get()

        if doc.exists:
            data = doc.to_dict()
            # Explicit TTL check to handle Firestore's deletion delay
            if data.get("expires_at", 0) > time.time():
                return json.loads(data.get("value"))
        return None

    async def set(self, key: str, value: Any, ttl_seconds: int = 86400) -> None:
        hashed_key = self._hash_key(key)
        doc_ref = self.db.collection(self.collection_name).document(hashed_key)
        
        expires_at = int(time.time() + ttl_seconds)
        
        # Store as stringified JSON to preserve structure, similar to SQLite implementation
        await doc_ref.set({
            "key": key, # Store original key for debugging
            "value": json.dumps(value),
            "expires_at": expires_at
        })
