# UK Crime Dashboard - Requirements & Implementation Plan

## Problem Description
The goal is to upgrade the existing Python/Folium-based MVP into a robust, interactive web service that visualizes UK Police data. The application needs to allow users to explore crime data geographically and temporally, without hitting the Police API's 10,000 incident limit.

## User Requirements
1. **Interactive Map**: A full-screen or prominent map view allowing users to pan and zoom.
2. **Postcode Search**: Users can enter a UK postcode to automatically center and zoom the map to that location.
3. **Data Layers**: 
   - Individual marker pins for crimes.
   - Heatmap layer to visualize density.
   - (Optional) Stop and search data layer.
4. **Time Selection**: A time slider or selector to view data for different months, defaulting to the latest available month.
5. **Historical Trends**: A visualization (e.g., line chart) showing how crime rates vary over time for a selected geographic area.
6. **Rate Limiting / Performance**: 
   - Prevent the user from zooming out too far and attempting to fetch too much data at once.
   - Enforce a minimum zoom level for data fetching.
   - Cache API responses on the backend to avoid hitting Police API rate limits.

## Architecture & Tech Stack (Based on User Rules)
- **Backend**: Python with `FastAPI` (fast, modern, built-in async for API calls). 
  - Package Management: `uv`.
  - Caching/Database: `SQLite` (local first) to cache API responses and prevent redundant external calls.
- **Frontend**: `Vite` + `React (TypeScript)` + `Tailwind CSS`.
  - Map Library: `react-leaflet` (Leaflet wrapper for React).
  - Charts: `recharts` for the historical trend graphs.

## Open Questions

1. **Tech Stack**: I have proposed FastAPI (Python) for the backend and Vite+React+Tailwind for the frontend, utilizing SQLite for caching. Does this align with your vision?
2. **Postcode API**: To convert postcodes to map coordinates, is it acceptable to use the free `api.postcodes.io` service?
3. **Time Slider**: The Police API returns data for specific months. Should the time slider select a single specific month to display on the map, or should it allow selecting a range (which would require aggregating multiple API calls)?
4. **Historical Data Definition**: For the "crime rates over time for a geographic area" visualization, how should we define this area? Should it be the currently visible map bounding box, or a specific radius around the searched postcode?
5. **Police API Limits**: To enforce the 10,000 incident limit, we will need to restrict data fetching when the map is zoomed out too far. Is it acceptable to display a message like "Zoom in to see crime data" at higher zoom levels?

## Proposed Changes

### Phase 1: Foundation & Backend API
- Initialize the Python virtual environment using `uv`.
- Create a FastAPI application to serve as a proxy and cache for the Police API.
- Implement endpoints for fetching crimes by bounding box and month.
- Implement SQLite caching layer for API responses to improve performance.

### Phase 2: Frontend Setup & Map Integration
- Initialize the Vite React TypeScript project.
- Setup Tailwind CSS for styling.
- Integrate `react-leaflet` and render the base map of the UK.
- Implement Postcode search functionality using `postcodes.io`.

### Phase 3: Data Visualization & Layers
- Connect the frontend map bounds to the backend API.
- Implement the Marker layer with clustering (`react-leaflet-cluster`).
- Implement the Heatmap layer.
- Add zoom-level guards to prevent massive API requests.
- Add the Time Slider component.

### Phase 4: Historical Trends Dashboard
- Implement backend endpoint to fetch historical data for an area (last 12 months).
- Add `recharts` to the frontend.
- Create a chart component displaying crime trends over time.

## Verification Plan

### Automated Tests
- **Backend**: `pytest` for unit testing the FastAPI endpoints, mocking the Police API responses, and verifying the SQLite caching logic.
- **Frontend**: `vitest` and React Testing Library for component rendering and basic interaction tests.

### Manual Verification
- Run backend locally (`uv run uvicorn main:app --reload`).
- Run frontend locally (`npm run dev`).
- Search for a postcode (e.g., SW1A 1AA) and verify zoom.
- Pan the map and ensure markers/heatmaps load only when sufficiently zoomed in.
- Change the time slider and verify data updates.
- Check the historical trend chart for accuracy.
