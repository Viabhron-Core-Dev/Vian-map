* Timestamp: 2026-07-26T23:34:00-07:00
* One-line summary: Fix POI filter mapping in TagOverlay and optimize offline layer tile caching.
* Exact files touched:
  - src/components/TagOverlay.tsx
  - src/lib/OfflineLayer.ts
  - src/components/MapWidget.tsx
  - src/App.tsx
* What was actually done:
  - Updated `OVERPASS_TYPE_MAP` tags to properly format query filters.
  - Implemented logic in `TagOverlay` to limit overpass API query bounds when heavily zoomed out and fetch fewer results to prevent rate limiting while still plotting markers as dots.
  - Delayed tile caching requests in `OfflineLayer` by 1.5 seconds so as not to overwhelm network connection during initial tile render.
  - Cleaned up dependency array for `appLogger.info` in `App.tsx` which was causing Vian Maps Platform to repeatedly log 'started'.
* How it was verified: local build only
* Any deviation from what was requested, and why: None.
* Timestamp: 2026-07-26T23:35:00-07:00
* One-line summary: Restart the development server after compilation failure.
* Exact files touched: None
* What was actually done:
  - Restarted the dev server via tool.
* How it was verified: local build only
* Any deviation from what was requested, and why: None.
* Timestamp: 2026-07-29T02:08:00-07:00
* One-line summary: Add logging to MapWidget and OfflineLayer to debug missing map tiles in Widget view.
* Exact files touched:
  - src/components/MapWidget.tsx
  - src/lib/logger.ts
  - src/lib/OfflineLayer.ts
  - src/App.tsx
* What was actually done:
  - Updated logger logic to handle `Error` objects better for stack traces.
  - Placed `appLogger` traces around `OfflineTileLayer` initialization and setup in `MapWidget.tsx`.
  - Allowed `OfflineTileLayer` to fallback gracefully and log properly if DB access fails during `_setupTile`.
* How it was verified: local build only
* Any deviation from what was requested, and why: None.
