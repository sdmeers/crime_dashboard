import os
from .base import CacheRepository
from .sqlite_cache import SQLiteCache

def get_cache() -> CacheRepository:
    app_env = os.environ.get("APP_ENV", "local")
    if app_env == "production":
        from .firestore_cache import FirestoreCache
        return FirestoreCache()
    else:
        return SQLiteCache()

# Export a default instance
cache = get_cache()
