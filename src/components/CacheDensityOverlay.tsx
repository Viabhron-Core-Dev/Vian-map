import React, { useEffect, useState } from 'react';
import { Rectangle, useMap } from 'react-leaflet';
import { db } from '../lib/db';
import { useConfigStore } from '../lib/store';
import L from 'leaflet';

const CacheDensityOverlay: React.FC = () => {
  const map = useMap();
  const showCacheVis = useConfigStore(s => s.showCacheVis);
  const activeLayerId = useConfigStore(s => s.activeLayerId);
  const [cachedRects, setCachedRects] = useState<L.LatLngBoundsExpression[]>([]);
  const [zoom, setZoom] = useState(map.getZoom());

  useEffect(() => {
    if (!showCacheVis) {
      setCachedRects([]);
      return;
    }

    const updateDensity = async () => {
      try {
        const prefix = activeLayerId + '/';
        const allKeys = await db.tiles.where('id').startsWith(prefix).keys();
        
        const rects: L.LatLngBoundsExpression[] = [];
        const currentZoom = Math.round(map.getZoom());
        
        allKeys.forEach(key => {
          // key format: layerId/z/x/y
          const parts = key.toString().split('/');
          if (parts.length < 4) return;
          
          const z = parseInt(parts[1]);
          const x = parseInt(parts[2]);
          const y = parseInt(parts[3]);

          // Only show tiles near current zoom to prevent visual clutter
          if (Math.abs(z - currentZoom) > 2) return;

          // Convert tile coords to LatLng bounds
          const nw = tileToLatLng(x, y, z);
          const se = tileToLatLng(x + 1, y + 1, z);
          rects.push([nw, se]);
        });

        setCachedRects(rects);
      } catch (err) {
        console.error('Failed to load cache density:', err);
      }
    };

    updateDensity();
    
    const onMove = () => setZoom(map.getZoom());
    const onRefresh = () => updateDensity();

    map.on('moveend', onMove);
    window.addEventListener('map-refresh', onRefresh);
    window.addEventListener('map-manual-refresh', onRefresh);

    return () => {
      map.off('moveend', onMove);
      window.removeEventListener('map-refresh', onRefresh);
      window.removeEventListener('map-manual-refresh', onRefresh);
    };
  }, [showCacheVis, activeLayerId, map]);

  if (!showCacheVis) return null;

  return (
    <>
      {cachedRects.map((rect, i) => (
        <Rectangle
          key={i}
          bounds={rect}
          pathOptions={{
            color: '#3b82f6',
            weight: 0.5,
            fillColor: '#3b82f6',
            fillOpacity: 0.2,
            interactive: false
          }}
        />
      ))}
    </>
  );
};

// Helper: Tile to LatLng
function tileToLatLng(x: number, y: number, z: number): [number, number] {
  const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z);
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  const lng = (x / Math.pow(2, z)) * 360 - 180;
  return [lat, lng];
}

export default CacheDensityOverlay;
