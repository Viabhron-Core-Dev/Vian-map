import Dexie, { Table } from 'dexie';

export interface TileRecord {
  id: string; // z/x/y
  data: Blob;
  timestamp: number;
}

export interface Bookmark {
  id?: number;
  name: string;
  lat: number;
  lng: number;
  zoom?: number;
  category: 'favorite' | 'waypoint' | 'warning' | 'other' | 'route' | 'note' | 'wiki';
  icon?: string;
  tags?: string;
  note: string;
  savedAt: number;
  data?: any; // For flexible data like route paths
}

export interface Overlay {
  id?: number;
  name: string;
  url: string;
  bounds: [[number, number], [number, number]];
  opacity: number;
}

export interface CachedPlace {
  id: string; // OsmId or similar
  name: string;
  display_name: string;
  lat: number;
  lng: number;
  category?: string;
  type?: string;
  cachedAt: number;
}

export interface VectorRoadRecord {
  id: number;
  nodes: number[];
  geometry: { lat: number, lon: number }[];
  tags: Record<string, string>;
  timestamp: number;
}

export interface CachedBoxRecord {
  id: string; // e.g. "lat_lng_lat_lng" to avoid refetching
  bounds: {
    s: number; w: number; n: number; e: number;
  };
  timestamp: number;
}

export interface CellTower {
  id: string; // e.g. "node/123456"
  lat: number;
  lng: number;
  provider: string; // "O2", "Vodafone", "Unknown", etc.
  type: string; // "2G", "3G", "4G", "5G", "LTE", "Unknown"
  range: number; // radius in meters
  timestamp: number;
}

export interface ElevationGridRecord {
  id: string; // "grid_[rounded_lat]_[rounded_lng]_[radius]"
  grid: { lat: number; lng: number; elev: number }[];
  timestamp: number;
}

export interface LogRecord {
  id?: number;
  timestamp: number;
  level: 'info' | 'warn' | 'error';
  module: string;
  message: string;
  details?: string;
}

export class OfflineMapDB extends Dexie {
  tiles!: Table<TileRecord>;
  bookmarks!: Table<Bookmark>;
  overlays!: Table<Overlay>;
  cachedPlaces!: Table<CachedPlace>;
  vectorRoads!: Table<VectorRoadRecord>;
  cachedBoxes!: Table<CachedBoxRecord>;
  towers!: Table<CellTower>;
  elevationGrids!: Table<ElevationGridRecord>;
  logs!: Table<LogRecord>;

  constructor() {
    super('VianOfflineMaps');
    this.version(9).stores({
      tiles: 'id, timestamp',
      bookmarks: '++id, name, category, savedAt',
      overlays: '++id, name',
      cachedPlaces: 'id, name, cachedAt',
      vectorRoads: 'id, timestamp',
      cachedBoxes: 'id, timestamp',
      towers: 'id, provider, type, timestamp',
      elevationGrids: 'id, timestamp'
    });
    this.version(10).stores({
      tiles: 'id, timestamp',
      bookmarks: '++id, name, category, savedAt',
      overlays: '++id, name',
      cachedPlaces: 'id, name, cachedAt',
      vectorRoads: 'id, timestamp',
      cachedBoxes: 'id, timestamp',
      towers: 'id, provider, type, timestamp',
      elevationGrids: 'id, timestamp',
      logs: '++id, timestamp, level, module'
    });
  }
}

export const db = new OfflineMapDB();
