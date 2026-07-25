import { create } from 'zustand';
import L from 'leaflet';

interface MapInstance {
  map: L.Map | null;
  setMap: (map: L.Map | null) => void;
}

export const useMapStore = create<MapInstance>((set) => ({
  map: null,
  setMap: (map) => set({ map }),
}));

interface GPSState {
  position: [number, number] | null;
  accuracy: number | null;
  speed: number | null; // m/s
  heading: number | null;
  altitude: number | null;
  isTracking: boolean;
  isNearEdge: boolean;
  
  // Actions
  setPosition: (pos: [number, number] | null) => void;
  setMetrics: (metrics: Partial<Pick<GPSState, 'accuracy' | 'speed' | 'heading' | 'altitude'>>) => void;
  setTracking: (tracking: boolean) => void;
  setNearEdge: (edge: boolean) => void;
}

export const useGPSStore = create<GPSState>((set) => ({
  position: null,
  accuracy: null,
  speed: null,
  heading: null,
  altitude: null,
  isTracking: false,
  isNearEdge: false,

  setPosition: (position) => set({ position }),
  setMetrics: (metrics) => set((state) => ({ ...state, ...metrics })),
  setTracking: (isTracking) => set({ isTracking }),
  setNearEdge: (isNearEdge) => set({ isNearEdge }),
}));

interface ConfigState {
  activeLayerId: string;
  isOnline: boolean;
  isGPSEngineActive: boolean;
  isSensorsActive: boolean;
  autoCache: boolean;
  showCacheVis: boolean;
  cacheMaxTiles: number;
  cacheMaxAgeDays: number;
  cacheAutoClean: boolean;
  eraseRadius: number;
  activeTagFilters: string[];
  theme: 'light' | 'dark';
  eraserMode: 'brush' | 'circle';
  isEraserArmed: boolean;
  activeTool: string | null;
  activeImageMapId: number | null;
  activeCustomMapId: number | null;
  zoomOffset: number;
  pendingBookmark: { lat: number, lng: number } | null;
  pendingContextMenu: { lat: number, lng: number, x: number, y: number } | null;
  mapRotation: number;
  mapRotationLocked: boolean;
  compassLocked: boolean;
  positionMode: 'gps' | 'location';
  selectedTiles: string[];
  performanceMode: 'high' | 'low';
  deepDelete: boolean;
  isHudFolded: boolean;
  networkProvider: string;
  isLoggingEnabled: boolean;
  isLogKeeperOpen: boolean;
  openCellIdKey: string | null;
  depthOverlay: 'none' | 'topo' | 'nautical' | 'weather' | 'vegetation' | 'clouds' | 'wind' | 'temperature';
  openWeatherMapKey: string | null;
  geminiApiKey: string | null;

  navRoutePath: L.LatLngExpression[];
  navDestination: L.LatLngExpression | null;
  setNavRoutePath: (path: L.LatLngExpression[]) => void;
  setNavDestination: (dest: L.LatLngExpression | null) => void;
  
  setActiveLayer: (id: string) => void;
  setOnline: (online: boolean) => void;
  setGPSEngine: (active: boolean) => void;
  setSensors: (active: boolean) => void;
  setAutoCache: (auto: boolean) => void;
  setShowCacheVis: (show: boolean) => void;
  setCacheMaxTiles: (tiles: number) => void;
  setCacheMaxAgeDays: (days: number) => void;
  setCacheAutoClean: (auto: boolean) => void;
  setEraseRadius: (radius: number) => void;
  setTagFilters: (filters: string[]) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setEraserMode: (mode: 'brush' | 'circle') => void;
  setEraserArmed: (armed: boolean) => void;
  setActiveTool: (tool: 'radar' | 'network' | 'eraser' | 'measure' | 'lane' | 'wiki' | 'imagemap' | 'depth' | '3d' | 'custommap' | 'navigation' | string | null) => void;
  setActiveImageMapId: (id: number | null) => void;
  setActiveCustomMapId: (id: number | null) => void;
  setZoomOffset: (offset: number) => void;
  setPendingBookmark: (bm: { lat: number, lng: number } | null) => void;
  setPendingContextMenu: (menu: { lat: number, lng: number, x: number, y: number } | null) => void;
  setMapRotation: (rotation: number) => void;
  setMapRotationLocked: (locked: boolean) => void;
  setCompassLocked: (locked: boolean) => void;
  setPositionMode: (mode: 'gps' | 'location') => void;
  setSelectedTiles: (tiles: string[]) => void;
  setPerformanceMode: (mode: 'high' | 'low') => void;
  setDeepDelete: (deep: boolean) => void;
  setHudFolded: (folded: boolean) => void;
  setNetworkProvider: (provider: string) => void;
  setLoggingEnabled: (enabled: boolean) => void;
  setLogKeeperOpen: (open: boolean) => void;
  setOpenCellIdKey: (key: string | null) => void;
  setDepthOverlay: (overlay: 'none' | 'topo' | 'nautical' | 'weather' | 'vegetation' | 'clouds' | 'wind' | 'temperature') => void;
  setOpenWeatherMapKey: (key: string | null) => void;
  setGeminiApiKey: (key: string | null) => void;
}

export const useConfigStore = create<ConfigState>((set) => ({
  activeLayerId: 'vianap',
  isOnline: true,
  isGPSEngineActive: true,
  isSensorsActive: true,
  autoCache: localStorage.getItem('vian-maps-auto-cache') !== 'false',
  showCacheVis: false,
  cacheMaxTiles: Number(localStorage.getItem('vian-maps-cache-limit') || 5000),
  cacheMaxAgeDays: Number(localStorage.getItem('vian-maps-cache-age') || 30),
  cacheAutoClean: localStorage.getItem('vian-maps-cache-autoclean') !== 'false',
  eraseRadius: 50,
  activeTagFilters: ['all'],
  theme: localStorage.getItem('vian-maps-theme') as 'light' | 'dark' || 'light',
  eraserMode: 'brush',
  isEraserArmed: false,
  activeTool: null,
  activeImageMapId: null,
  activeCustomMapId: null,
  zoomOffset: 120,
  pendingBookmark: null,
  pendingContextMenu: null,
  mapRotation: 0,
  mapRotationLocked: true,
  compassLocked: false,
  positionMode: 'gps',
  selectedTiles: [],
  performanceMode: 'low',
  deepDelete: false,
  isHudFolded: localStorage.getItem('vian-maps-hud-folded') !== 'false',
  networkProvider: localStorage.getItem('vian-maps-provider') || 'UNSPECIFIED',
  isLoggingEnabled: localStorage.getItem('vian-maps-logging') !== 'false',
  isLogKeeperOpen: false,
  openCellIdKey: localStorage.getItem('vian-maps-opencellid-key') || null,
  depthOverlay: (localStorage.getItem('vian-maps-depth-overlay') as any) || 'none',
  openWeatherMapKey: localStorage.getItem('vian-maps-openweathermap-key') || null,
  geminiApiKey: localStorage.getItem('vian-maps-gemini-key') || null,

  navRoutePath: [],
  navDestination: null,
  setNavRoutePath: (navRoutePath) => set({ navRoutePath }),
  setNavDestination: (navDestination) => set({ navDestination }),

  setActiveLayer: (activeLayerId) => set({ activeLayerId }),
  setOnline: (isOnline) => set({ isOnline }),
  setGPSEngine: (isGPSEngineActive) => set({ isGPSEngineActive }),
  setSensors: (isSensorsActive) => set({ isSensorsActive }),
  setAutoCache: (autoCache) => {
    localStorage.setItem('vian-maps-auto-cache', String(autoCache));
    set({ autoCache });
  },
  setShowCacheVis: (showCacheVis) => set({ showCacheVis }),
  setCacheMaxTiles: (cacheMaxTiles) => {
    localStorage.setItem('vian-maps-cache-limit', String(cacheMaxTiles));
    set({ cacheMaxTiles });
  },
  setCacheMaxAgeDays: (cacheMaxAgeDays) => {
    localStorage.setItem('vian-maps-cache-age', String(cacheMaxAgeDays));
    set({ cacheMaxAgeDays });
  },
  setCacheAutoClean: (cacheAutoClean) => {
    localStorage.setItem('vian-maps-cache-autoclean', String(cacheAutoClean));
    set({ cacheAutoClean });
  },
  setEraseRadius: (eraseRadius) => set({ eraseRadius }),
  setTagFilters: (activeTagFilters) => set({ activeTagFilters }),
  setTheme: (theme) => {
    localStorage.setItem('vian-maps-theme', theme);
    set({ theme });
  },
  setEraserMode: (eraserMode) => set({ eraserMode }),
  setEraserArmed: (isEraserArmed) => set({ isEraserArmed }),
  setActiveTool: (activeTool) => set({ activeTool }),
  setActiveImageMapId: (activeImageMapId) => set({ activeImageMapId }),
  setActiveCustomMapId: (activeCustomMapId) => set({ activeCustomMapId }),
  setZoomOffset: (zoomOffset) => set({ zoomOffset }),
  setPendingBookmark: (pendingBookmark) => set({ pendingBookmark, pendingContextMenu: null }),
  setPendingContextMenu: (pendingContextMenu) => set({ pendingContextMenu }),
  setMapRotation: (mapRotation) => set({ mapRotation }),
  setMapRotationLocked: (mapRotationLocked) => set({ mapRotationLocked }),
  setCompassLocked: (compassLocked) => set({ compassLocked }),
  setPositionMode: (positionMode) => set({ positionMode }),
  setSelectedTiles: (selectedTiles) => set({ selectedTiles }),
  setPerformanceMode: (performanceMode) => set({ performanceMode }),
  setDeepDelete: (deepDelete) => set({ deepDelete }),
  setHudFolded: (isHudFolded) => {
    localStorage.setItem('vian-maps-hud-folded', String(isHudFolded));
    set({ isHudFolded });
  },
  setNetworkProvider: (networkProvider) => {
    localStorage.setItem('vian-maps-provider', networkProvider);
    set({ networkProvider });
  },
  setLoggingEnabled: (isLoggingEnabled) => {
    localStorage.setItem('vian-maps-logging', String(isLoggingEnabled));
    set({ isLoggingEnabled });
  },
  setLogKeeperOpen: (isLogKeeperOpen) => set({ isLogKeeperOpen }),
  setOpenCellIdKey: (openCellIdKey) => {
    if (openCellIdKey) {
      localStorage.setItem('vian-maps-opencellid-key', openCellIdKey);
    } else {
      localStorage.removeItem('vian-maps-opencellid-key');
    }
    set({ openCellIdKey });
  },
  setDepthOverlay: (depthOverlay) => {
    localStorage.setItem('vian-maps-depth-overlay', depthOverlay);
    set({ depthOverlay });
  },
  setOpenWeatherMapKey: (openWeatherMapKey) => {
    if (openWeatherMapKey) {
      localStorage.setItem('vian-maps-openweathermap-key', openWeatherMapKey);
    } else {
      localStorage.removeItem('vian-maps-openweathermap-key');
    }
    set({ openWeatherMapKey });
  },
  setGeminiApiKey: (geminiApiKey) => {
    if (geminiApiKey) {
      localStorage.setItem('vian-maps-gemini-key', geminiApiKey);
    } else {
      localStorage.removeItem('vian-maps-gemini-key');
    }
    set({ geminiApiKey });
  },
}));
