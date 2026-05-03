from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import httpx
import json
import hashlib
from typing import Optional
from cache.sqlite_cache import SQLiteCache

app = FastAPI(title="UK Crime Dashboard API")

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

cache = SQLiteCache()
POLICE_API_BASE = "https://data.police.uk/api"

async def fetch_police_data(endpoint: str, params: dict) -> list | dict:
    # Create a stable cache key
    key_dict = {"endpoint": endpoint, "params": params}
    key_str = json.dumps(key_dict, sort_keys=True)
    cache_key = hashlib.md5(key_str.encode()).hexdigest()

    cached_data = await cache.get(cache_key)
    if cached_data is not None:
        return cached_data

    async with httpx.AsyncClient() as client:
        # The Police API sometimes expects POST for large polygons
        # We will use POST if poly is in params
        if "poly" in params:
            response = await client.post(f"{POLICE_API_BASE}/{endpoint}", data=params)
        else:
            response = await client.get(f"{POLICE_API_BASE}/{endpoint}", params=params)
        
        if response.status_code == 503:
            raise HTTPException(status_code=503, detail="Police API unavailable or too much data requested")
        if response.status_code == 400:
            raise HTTPException(status_code=400, detail="Invalid request to Police API. Bounding box might be too large.")
        response.raise_for_status()
        
        data = response.json()
        await cache.set(cache_key, data, ttl_seconds=86400 * 7) # Cache for 7 days
        return data

@app.get("/api/crimes")
async def get_crimes(poly: str, date: str):
    return await fetch_police_data("crimes-street/all-crime", {"poly": poly, "date": date})

@app.get("/api/outcomes")
async def get_outcomes(poly: str, date: str):
    return await fetch_police_data("outcomes-at-location", {"poly": poly, "date": date})

@app.get("/api/stops")
async def get_stops(poly: str, date: str):
    return await fetch_police_data("stops-street", {"poly": poly, "date": date})

@app.get("/api/last-updated")
async def get_last_updated():
    # Cache this for less time, maybe 1 day
    cached = await cache.get("last_updated")
    if cached:
        return cached
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{POLICE_API_BASE}/crime-last-updated")
        response.raise_for_status()
        data = response.json()
        await cache.set("last_updated", data, ttl_seconds=86400)
        return data

import asyncio
from datetime import datetime
from dateutil.relativedelta import relativedelta

@app.get("/api/historical-crimes")
async def get_historical_crimes(poly: str):
    # Fetch last updated date to know where to start
    last_updated_data = await get_last_updated()
    latest_month_str = last_updated_data.get("date", "2024-01")[:7]

    
    # Parse latest month
    latest_date = datetime.strptime(latest_month_str, "%Y-%m")
    
    # Generate last 12 months
    months = [(latest_date - relativedelta(months=i)).strftime("%Y-%m") for i in range(11, -1, -1)]
    
    # Fetch data concurrently for all 12 months with a semaphore to prevent 503s
    sem = asyncio.Semaphore(3)
    
    async def fetch_with_sem(month):
        # Retry up to 3 times for transient 503s or timeouts
        for attempt in range(3):
            async with sem:
                try:
                    return await fetch_police_data("crimes-street/all-crime", {"poly": poly, "date": month})
                except Exception as e:
                    if attempt == 2:
                        return e
                    await asyncio.sleep(1 * (attempt + 1))
    
    tasks = [fetch_with_sem(month) for month in months]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    historical_data = []
    for i, res in enumerate(results):
        month = months[i]
        if isinstance(res, Exception):
            # If a month fails after retries, return None so the chart doesn't plunge to 0
            print(f"Failed to fetch historical data for {month}: {res}")
            historical_data.append({"month": month, "total": None, "antiSocial": None, "violent": None})
            continue
            
        crimes = res if isinstance(res, list) else []
        total = len(crimes)
        anti_social = sum(1 for c in crimes if c.get("category") == "anti-social-behaviour")
        violent = sum(1 for c in crimes if c.get("category") in ["violent-crime", "public-order"])
        
        historical_data.append({
            "month": month,
            "total": total,
            "antiSocial": anti_social,
            "violent": violent
        })
        
    return historical_data

@app.get("/api/overview-stats")
async def get_overview_stats():
    import os
    if not os.path.exists("stats.json"):
        raise HTTPException(status_code=404, detail="Stats file not generated yet")
    with open("stats.json", "r") as f:
        return json.load(f)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
