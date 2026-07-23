# Vian Maps Blueprint

## Current App
Vian Maps is an offline-first tactical mapping application built with React, TypeScript, Leaflet, and Dexie (IndexedDB). 
It currently supports:
- Multi-layer map rendering (Google Satellite, OSM, pure satellite).
- Offline tile caching and spatial data storage.
- Real-time GPS tracking and trailing.
- Tactical interactive tools (Eraser, Measurement, area Download Manager).

## To-Do / Not Done
- **Lane Assistant**: Work in progress / Not fully complete.
- **3D Tactical Map**: Work in progress / Not fully complete.

## Recent Changes
- Overhauled 3D Elevation Map with real-world satellite heights (Open-Meteo API) and offline IndexedDB caching (`db.elevationGrids`).
- Overhauled 3D map engine to a simpler, faster 3-layer Minecraft-style voxel renderer (Terrain blocks, Water, Buildings) sorted via Painter's Algorithm.
- Removed overly complex rendering options (smooth vs blocky split), enforcing one unified clean aesthetic. Roads draw smoothly as vector lines draped on voxel terrain.
- Suppressed harmless "Failed to fetch" Overpass API UI error overlays by handling them as warnings.
- Fixed "Vector Roads Fetch Error" by making all Overpass API JSON parsing safe and robust against HTML/XML rate-limit responses.
- Overhauled Signal Radar tool to fetch real cellular towers from OSM (Overpass API).
- Created interactive widget to select Telecom Providers and Network Generations (2G, 3G, 4G, 5G).
- Enabled offline IndexedDB caching for telecom tower data.
- Linked Signal Radar data fetch to native manual refresh button and viewport boundaries.
- Fixed intelligence long press context menu functionality.
- Removed route generation logic to simplify intel mapping workflow.
- Aligned Map rotation to vehicle heading during Lane Assistant simulation ("Heading-Up" mode).
- Restricted OSM Neon road rendering exclusively to Lane Assistant mode.
- Created `appLogger`, an offline-persistent diagnostic Log Keeper stored in Dexie, to trace rendering bugs (like the 3D Map black screen issue) and logic failures.
- Added a "DIAGNOSTIC LOG" hardware toggle and copy-to-clipboard tool in the Settings UI.
- Implemented multi-mode location fetching distinction (`gps` hardware accuracy priority vs `location` cached/fused location modes) within Capacitor Geolocation constraints.
- Added OpenCelliD API configuration to Settings panel with secure (hidden input) Key handling.
- Upgraded Signal Radar tool to automatically request bounding-box signal tower intelligence from OpenCelliD API when a valid user key is configured.
- Renamed "3D ELEVATION MAP" to "DEPTH MAPS" to provide OpenTopoMap and OpenSeaMap dynamic overlay tiles over the main map view.
- Added a new placeholder tool "3D OFFLINE MAP (BETA)" that stubs out the 3D Render Optimization Engine ("Awake/Asleep" rule and viewport-bounded 3D rendering).
- Implemented Weather Depth Maps supporting both free default Open-Source radar (RainViewer API) and OpenWeatherMap premium radar layers (configurable via new API key in Settings).
- Refined online-only Map overlays (including Weather) by mapping direct Leaflet `TileLayer`s, bypassing the offline-cache indexer entirely to prevent client bloat.
- Introduced map load-failure heuristics for Depth Overlays: turning the UI overlay selector red dynamically if map tiles fail to load.
- Replaced the placeholder 3D Map tool with a live MapLibre GL JS engine integration.
- Configured Frustum Culling / Engine Sleep protocols: Unmounting or isolating Leaflet events (disabling panning/zooming) when 3D mode is active to prevent multi-engine memory crashes.
- Implemented the 'Zoom Lock Guardrail': strictly forbidding 3D initializations if the viewport zoom is < 16, presenting a warning to the user instead.
- Added live dual vector options for 3D: "Extruding Buildings" (using MapLibre `fill-extrusion` via open vector tiles) vs "Deforming Terrain" (using Mapzen raster-dem datasets).
- Fixed benign 3D Tile 404/Abort error handling in MapLibre which was spamming the console with `Failed to fetch (0)`.
- Replaced raw event object logging with stringified payloads in `ThreeDMapTool` `onError` handler to prevent "Converting circular structure to JSON" crashes during metadata interception.
- Integrated new Wikipedia Area Check (WikiTool) to fetch geolocated Wikipedia articles within the current map viewport.
- Enhanced Data & Bookmarks tool by adding dynamic "Notes" and "Wiki" tabs, allowing dedicated views for non-waypoint tactical notes and downloaded Wiki pages.
- Corrected strict TypeScript types in internal IndexedDB `Bookmark` representations to officially support these newly integrated tabs.
