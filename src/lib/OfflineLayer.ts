import L from 'leaflet';
import { db } from './db';

export interface LayerDefinition {
  id: string;
  name: string;
  url: string;
  attribution: string;
  maxZoom: number;
  noCache?: boolean;
}

export const MAP_LAYERS: Record<string, LayerDefinition> = {
  osm: {
    id: 'osm',
    name: 'OpenStreetMap',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19
  },
  satellite: {
    id: 'satellite',
    name: 'Google Satellite',
    url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    attribution: '© Google Maps',
    maxZoom: 20
  },
  hybrid: {
    id: 'hybrid',
    name: 'Google Hybrid (Backup)',
    url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    attribution: '© Google Maps',
    maxZoom: 20
  },
  vianap: {
    id: 'vianap',
    name: 'Vianap Layer',
    url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    attribution: '© Google Maps, OSM Data',
    maxZoom: 20
  },
  topo: {
    id: 'topo',
    name: 'Elevation (Topo)',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '© OpenTopoMap contributors',
    maxZoom: 17
  },
  blank: {
    id: 'blank',
    name: 'Blank Grid',
    url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEAAQMAAABmvDolAAAAA1BMVEWAgICQ970KAAAAGUlEQVRoge3BAQ0AAADCoPdPbQ8HFAAAAAAA4GcgAAH9AAnkAAAAAElFTkSuQmCC',
    attribution: '',
    maxZoom: 20
  }
};

export class OfflineTileLayer extends L.TileLayer {
  private cachePrefix: string;
  private isOnline: boolean = true;
  private autoCache: boolean = true;
  private blobUrls: Map<string, string> = new Map();

  constructor(url: string, id: string, options: L.TileLayerOptions & { noCache?: boolean } = {}) {
    super(url, {
      ...options,
      keepBuffer: 2, // Keep more tiles around for smoother transitions
      updateWhenIdle: false, // Update while panning
      updateWhenZooming: true,
      className: 'tactical-tile-layer'
    });
    this.cachePrefix = id + '/';
    if (options.noCache) {
      this.autoCache = false;
    }
  }

  setOnline(online: boolean) {
    this.isOnline = online;
    this.redraw();
  }

  setAutoCache(auto: boolean) {
    this.autoCache = auto;
  }

  createTile(coords: L.Coords, done: L.DoneCallback): HTMLElement {
    const tile = document.createElement('img');
    const key = this.cachePrefix + `${coords.z}/${coords.x}/${coords.y}`;

    L.DomEvent.on(tile, 'load', L.Util.bind(this._onTileLoad, this, done, tile));
    L.DomEvent.on(tile, 'error', L.Util.bind(this._onTileError, this, done, tile));

    if (this.options.crossOrigin || this.options.crossOrigin === '') {
      tile.crossOrigin = this.options.crossOrigin === true ? '' : this.options.crossOrigin;
    }

    tile.alt = '';
    tile.setAttribute('role', 'presentation');
    
    // Add a class for CSS transitions
    tile.classList.add('leaflet-tile-fade');

    this._setupTile(coords, key, tile, done);

    return tile;
  }

  // Cleanup blob URLs to prevent memory leaks
  _removeTile(key: string) {
    const url = this.blobUrls.get(key);
    if (url) {
      URL.revokeObjectURL(url);
      this.blobUrls.delete(key);
    }
    (L.TileLayer.prototype as any)._removeTile.call(this, key);
  }

  private async _setupTile(coords: L.Coords, key: string, tile: HTMLImageElement, done: L.DoneCallback) {
    try {
      // Check in-memory cache first
      if (this.blobUrls.has(key)) {
        tile.src = this.blobUrls.get(key)!;
        return;
      }

      const cached = await db.tiles.get(key);
      if (cached) {
        const url = URL.createObjectURL(cached.data);
        this.blobUrls.set(key, url);
        tile.src = url;
      } else if (this.isOnline) {
        const url = this.getTileUrl(coords);
        try {
          // Attempt fetch for offline caching if autoCache is enabled
          if (this.autoCache) {
            const response = await fetch(url, { referrerPolicy: 'no-referrer' });
            if (response.ok) {
              const blob = await response.blob();
              await db.tiles.put({ id: key, data: blob, timestamp: Date.now() });
              const blobUrl = URL.createObjectURL(blob);
              this.blobUrls.set(key, blobUrl);
              tile.src = blobUrl;
            } else {
              tile.src = url;
            }
          } else {
            // Direct load without caching
            tile.src = url;
          }
        } catch (fetchError) {
          // CORS or Network error - fallback to direct source
          if (fetchError instanceof Error && fetchError.name !== 'AbortError') {
            console.warn(`Tile fetch/cache failed for ${url}, falling back to direct load.`, fetchError);
          }
          tile.src = url;
        }
      } else {
        // Transparent pixel placeholder for offline missing tiles
        tile.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
      }
    } catch (error) {
      console.error('Tile error:', error);
      done(error as any, tile);
    }
  }

  // Harvest all tiles in a bounding box across zoom levels
  async harvest(bounds: L.LatLngBounds, minZoom: number, maxZoom: number) {
    if (!this.isOnline) return;

    for (let z = minZoom; z <= maxZoom; z++) {
      const nw = bounds.getNorthWest();
      const se = bounds.getSouthEast();

      const nwProj = L.CRS.EPSG3857.project(nw);
      const seProj = L.CRS.EPSG3857.project(se);

      const tileSize = 256;
      const scale = Math.pow(2, z) / tileSize;

      const xMin = Math.floor(nwProj.x * scale);
      const xMax = Math.floor(seProj.x * scale);
      const yMin = Math.floor(-nwProj.y * scale);
      const yMax = Math.floor(-seProj.y * scale);

      // Limit harvesting to a reasonable amount of tiles per zoom level to avoid freezing
      const MAX_TILES = 100;
      let count = 0;

      for (let x = xMin; x <= xMax; x++) {
        for (let y = yMin; y <= yMax; y++) {
          if (count++ > MAX_TILES) break;
          const key = this.cachePrefix + `${z}/${x}/${y}`;
          const exists = await db.tiles.get(key);
          if (!exists) {
            const url = this.getTileUrl({ x, y, z } as any);
            try {
              const res = await fetch(url, { referrerPolicy: 'no-referrer' });
              if (res.ok) {
                const blob = await res.blob();
                await db.tiles.put({ id: key, data: blob, timestamp: Date.now() });
              }
            } catch (e) { 
              if (e instanceof Error && e.name !== 'AbortError') {
                /* ignore single tile failures but log if not abort */
              }
            }
          }
        }
      }
    }
  }

  // Deep Erase: Wipes an area across ALL zoom levels
  async deepErase(bounds: L.LatLngBounds) {
    for (let z = 0; z <= 20; z++) {
      const nw = bounds.getNorthWest();
      const se = bounds.getSouthEast();

      // We use a simpler bounding box calculation for deletion
      // To be safe, we calculate the tile range for this zoom
      // Leaflet's project is easier
      
      // We'll use the same logic as harvest but for deletion
      const nwProj = L.CRS.EPSG3857.project(nw);
      const seProj = L.CRS.EPSG3857.project(se);
      const tileSize = 256;
      const scale = Math.pow(2, z) / tileSize;

      const xMin = Math.floor(nwProj.x * scale);
      const xMax = Math.floor(seProj.x * scale);
      const yMin = Math.floor(-nwProj.y * scale);
      const yMax = Math.floor(-seProj.y * scale);

      const keys: string[] = [];
      for (let x = xMin; x <= xMax; x++) {
        for (let y = yMin; y <= yMax; y++) {
          keys.push(this.cachePrefix + `${z}/${x}/${y}`);
        }
      }
      
      if (keys.length > 0) {
        await Promise.all(keys.map(k => db.tiles.delete(k)));
      }
    }
  }

  // Recursive deletion of a tile and all its high-zoom children
  async deleteTileFamily(z: number, x: number, y: number) {
    const keysToDelete: string[] = [];
    
    const collectKeys = (currZ: number, currX: number, currY: number) => {
      keysToDelete.push(this.cachePrefix + `${currZ}/${currX}/${currY}`);
      
      // Stop at max zoom 20 to prevent infinite recursion or excessive load
      if (currZ < 20) {
        const nextZ = currZ + 1;
        const nx = currX * 2;
        const ny = currY * 2;
        collectKeys(nextZ, nx, ny);
        collectKeys(nextZ, nx + 1, ny);
        collectKeys(nextZ, nx, ny + 1);
        collectKeys(nextZ, nx + 1, ny + 1);
      }
    };
    
    collectKeys(z, x, y);
    
    // Perform bulk delete in chunks to avoid blocking the DB or exceeding memory
    const CHUNK_SIZE = 1000;
    for (let i = 0; i < keysToDelete.length; i += CHUNK_SIZE) {
      const chunk = keysToDelete.slice(i, i + CHUNK_SIZE);
      await db.tiles.bulkDelete(chunk);
    }
  }

  private _onTileLoad(done: L.DoneCallback, tile: HTMLImageElement) {
    done(undefined, tile);
  }

  private _onTileError(done: L.DoneCallback, tile: HTMLImageElement, e: any) {
    done(e, tile);
  }
}
