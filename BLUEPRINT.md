# Vian Maps Blueprint

## Architecture & Current App State
Vian Maps is an offline-first, highly specialized tactical mapping application built using React (Vite environment), TypeScript, Tailwind CSS, Leaflet (2D map engine), MapLibre GL (3D capabilities), and Dexie (IndexedDB for robust offline persistence).

The application uses an immersive, mobile-first glass-morphic tactical interface ("Obsidian Glass" styling) prioritizing geolocation precision, tactical intelligence, sensor diagnostics, and offline data collection under field-operation capability constraints.

### Core Systems & Architecture Map
1. **Core State Management (`src/lib/store.ts`)**:
   - `useConfigStore`: Manages application-wide toggles, active map layers, tactical tools, rendering modes (Performance/Quality), rotation/compass locks, and UI folding rules.
   - `useGPSStore`: Houses strict hardware geolocation logic (altitude, speed, heading, accuracy constraints).
   - `useMapStore`: The critical "bridge" enabling disparate React overlay components to inject behavior into the central Leaflet `map` instance globally.
2. **Local Storage Engine (`src/lib/db.ts`)**:
   - Powers the "Offline-First" mandate by intercepting and storing geographic objects: `tiles` (X/Y/Z map grid blobs), `poi` (Points of Interest), `elevations`, `bookmarks`, and localized Wiki snapshots securely in IndexedDB.
3. **Primary Render Orchestration (`src/App.tsx`, `src/components/MapComponent.tsx`)**:
   - Coordinates the Leaflet map container and governs active UI layers over the interactive canvas.
   - Handles Map rotation rules dynamically on the CSS transform level (`tactical-rotated-container`).
4. **The Log Keeper Protocol (`src/lib/logger.ts`)**:
   - Strict offline-persistent diagnostic log indexer. It traps critical errors, map engine exceptions, API throttles, and renders them copy-able from the User Settings to ensure offline hardware debugging is available.

### Tactical Modules (Located in `src/components/`)
- **Offline / Tile Protocol (`src/lib/OfflineLayer.ts`, `CacheDensityOverlay.tsx`, `DownloadManager.tsx`)**: Evaluates incoming map tile requests, hits the Dexie database strictly, fallback to remote if permitted, and handles mass-downloads for large operational areas.
- **Signal Radar (`SignalRadar.tsx`)**: Integrates OpenCelliD & Overpass API to scan and document cellular infrastructure data (Telecom Provider, 2G/3G/4G/5G capabilities).
- **Sensor Dashboards (`SensorDashboard.tsx`)**: hardware telemetry outputs (accel/gyro constraints).
- **Network Validation & Exporting (`NetworkTester.tsx`, `EraserTool.tsx`)**: Connection constraint diagnostics and cache purging utilities.
- **3D Topographic Analysis (`ThreeDMapTool.tsx`)**: Integrates MapLibre to construct volumetric renders (Extruding Buildings) or terrain-deformation layers seamlessly inside the Leaflet context.
- **Area Extraction (`WikiTool.tsx`, `BookmarkManager.tsx`)**: Tools pulling structured intelligence data (POI/Wikipedia) for caching entirely on-device.

## Pre-Iteration Backup Reference
- A hardened exact replica of the current codebase has been copied to the newly generated `reference_react_backup/` directory. This exists purely to restore or cross-reference functionality if an update degrades stability.

## Known Risks & Guardrails (State Thrashing / Collisions)
- **State Thrashing Risk**: Complex asynchronous tools (Leaflet renderers, MapLibre fetch engines, OpenCelliD polling) frequently intercept react lifecycles. They dispatch directly to `zustand` stores. The risk is an infinite loop (e.g. Map updates `setCenter` -> Component Re-renders -> Re-queries OSM API -> OSM API updates Map -> `setCenter`).
  - *Guardrail / Fix Strategy*: Ensure mapping `useEffect` hooks **strictly** limit dependency updates. Rely primarily on primitive tracking variables or debounced/throttled event listeners inside Map element handlers, rather than binding raw Component State to Map viewport moving events directly.
- **Multi-Engine Memory OOM**: Heavy concurrent rendering of 3D data and 2D canvas tiles can strain mobile graphics limits.
  - *Guardrail / Fix Strategy*: Maintain the 'Engine Sleep Protocol' – selectively blocking Leaflet event loops when MapLibre instances govern the primary view.

## Active Pipeline / Next Steps
- **Custom Maps Architecture Overhaul**: [PARTIAL] Transitioned `CustomMapTool.tsx` into a robust standalone "Sandbox Engine" based on `CUSTOM_MAPS_IDEA.md`.
  - **Sandbox Initialization**: Done. Implemented selection between 'Cutout' (polygon masking to trap area) or 'Blank Grid' mode.
  - **Sequential Workflow Lock**: Done. The initialization process is now strictly sequential (Source -> Layer -> Boundary Draw), hiding options until the current step is completed to prevent premature mode switches.
  - **Boundary Processing**: Done. Added confirmation step allowing the choice between a dynamic "Live Map" bounds or a "Static Snapshot" simulation for generated custom masks.
  - **Toolbar Separation**: Done. Implemented dual toolbars (Landscape Build / Tactical). Added workflow detail popup triggers.
  - **Kinematic Drafting**: Done. Integrated Kinematic toggle FAB and Sensor state cycling, with direct "DROP NODE" point projection.
  - **Sandbox Persistence**: Pending. Need to serialize the sandbox nodes properly and rebuild them on load.
- **Navigation & Search Architecture**: [DONE] A comprehensive navigation and search suite leveraging both offline and online capabilities, accessible via a long press on the main compass button.
  - **Unified Search**: Implemented search for Points of Interest (POI), specific areas, or coordinates exclusively on the main map. Support for offline cached searches and online queries via Nominatim.
  - **Gemini AI Coordinate Resolution**: Option to parse conversational or complex natural language search queries via the Gemini API to extract precise target coordinates.
  - **Routing & Directions**: Implemented turn-by-turn direction flows relying on live GPS tracking, calculating paths between current and destination nodes via OSRM.
  - **Saved Offline Routes**: Support for saving pre-calculated route geometries (snapped via OSRM) and turn instructions securely offline for total disconnected navigation.
  - **Visual & Audio Guidance**: Render active routes as a distinct visual blue glowing path tracking the user's position, paired with Text-to-Speech (TTS) audio directions.
  - **Tags/Bookmarks Integration**: Integrated the existing Tags window directly into the location search/destination selection flow.
- **Lane Assistant (`LaneAssistantTool.tsx`)**: Continued maturation over OSM Node parsing.
- Refinement of unified error handling across tactical modules.

## Recent Changelog History
- **GPS/Location Unified Protocol**: Implemented a fallback toggle mechanism in `ImageMapTool` and `MeasurementTool`. Automatically transitions from "None/Off" back to active `gps` tracking whenever precision coordinate sampling is requested by the user, respecting the new GPS/Location/None cyclical toggle logic.
- **Mission Overlays Restored & Relocated**: Restored the `ImageMapTool` component and custom image/photo mapping capabilities. Relocated the "Upload Map" UI directly inside the new structured `MapLayersPanel` under the "Uploaded" section to clean up the workspace.
- **Structural UI Overhaul**: Reorganized the floating panels. Renamed `MISSION` to `MAPS`. Created a brand-new structured, accordion-based `MapLayersPanel` component that separates categories: Normal Maps, Depth Maps (Elevation, AQI), Custom, Uploaded, and Direct 3D Map toggles.
- **Air Quality (AQI) Integration**: Added an online-only, non-cached public EPA AQI layer (`waqi.info`) as a tactical Depth Map layer.
- Implemented **Deep Architecture Isolation (Thrashing Guardrail 2)**: Replaced root destructuring inside `App.tsx` with atomic `useShallow` selectors from `zustand/react/shallow`. Extracted heavy redraw elements (`CompassButton`, `GPSMetricsRow`) into pure isolated components. The root DOM no longer re-renders 60 times a second when the device heading/speed updates or the canvas rotates.
- Implemented **Hardware Debouncing (Thrashing Guardrail 1)**: Wrapped synchronous Capacitor multi-touch math on the 2D Canvas panning logic (`TacticalPanningHandler` / `handleMove`) inside `requestAnimationFrame`. This breaks the cycle of layout thrashing to ensure smooth tactical operations.
- Implemented **Engine Sleep Protocol (OOM Guardrail)**: Modified `LayerManager` inside `MapComponent.tsx` to automatically unmount the 2D Leaflet background tile layers entirely whenever the MapLibre 3D engine is engaged. This ensures the mobile graphics processor is never forced to render two separate heavy tile grids simultaneously.
- Implemented **State Thrashing Guardrail**: Converted high-frequency `map.on('move')` event listeners inside the core `App.tsx` module to `map.on('moveend')`. This eliminates continuous React re-renders during viewport dragging, severely cutting down memory allocation noise and API loop risks.
- Deployed safe backup copy of the current repository state into `/reference_react_backup/`.
- Overhauled 3D Elevation Map with real-world satellite heights (Open-Meteo API) and offline IndexedDB caching.
- Overhauled Signal Radar tool to fetch real cellular towers from OSM (Overpass API) and OpenCelliD.
- Introduced offline logging traces and Wiki/Note tracking tab models.
- Stabilized Map rotation engine constraints against Lane-Assist modes.
