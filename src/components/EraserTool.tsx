import React, { useEffect, useCallback } from 'react';
import { useMap, useMapEvents, Rectangle } from 'react-leaflet';
import L from 'leaflet';
import { useConfigStore } from '../lib/store';
import { MAP_LAYERS } from '../lib/OfflineLayer';

const EraserTool: React.FC<{ isActive: boolean }> = ({ isActive }) => {
  const map = useMap();
  const { 
    selectedTiles,
    setSelectedTiles,
    activeLayerId,
    setOnline,
    deepDelete
  } = useConfigStore();

  useEffect(() => {
    if (isActive) {
      setOnline(false);
    } else {
      setSelectedTiles([]);
    }
  }, [isActive, setOnline, setSelectedTiles]);

  const toggleTile = useCallback((latlng: L.LatLng) => {
    const zoom = map.getZoom();
    const point = map.project(latlng, zoom).divideBy(256).floor();
    const tileKey = `${zoom}-${point.x}-${point.y}`;

    if (selectedTiles.includes(tileKey)) {
      setSelectedTiles(selectedTiles.filter(t => t !== tileKey));
    } else {
      setSelectedTiles([...selectedTiles, tileKey]);
    }
    
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(20);
  }, [map, selectedTiles, setSelectedTiles]);

  useMapEvents({
    click(e) {
      if (!isActive) return;
      toggleTile(e.latlng);
    }
  });

  if (!isActive) return null;

  // Render selection rectangles
  return (
    <>
      <div className="absolute bottom-24 right-4 z-[2000] flex flex-col items-end gap-3 pointer-events-auto">
        <div className={`px-3 py-1.5 rounded-full text-[9px] font-black tracking-widest uppercase border backdrop-blur-md text-white shadow-lg ${deepDelete ? 'bg-orange-600 border-orange-500 shadow-orange-500/20' : 'bg-red-600 border-red-500 shadow-red-500/20'}`}>
          {deepDelete ? 'DEEP PURGE SELECTION' : 'SELECT TILES TO PURGE'}
        </div>
        <div className="bg-black/40 backdrop-blur-sm px-2 py-1 rounded text-[7px] text-zinc-400 uppercase font-bold tracking-tighter">
          {deepDelete ? 'Tap to mark parent and ALL child tiles' : 'Tap tiles to highlight red'}
        </div>
      </div>

      {selectedTiles.map(key => {
        const [z, x, y] = key.split('-').map(Number);
        if (z !== map.getZoom()) return null; // Only show for current zoom to avoid overlapping confusion

        const nwPoint = L.point(x * 256, y * 256);
        const sePoint = L.point((x + 1) * 256, (y + 1) * 256);
        const nw = map.unproject(nwPoint, z);
        const se = map.unproject(sePoint, z);
        
        return (
          <Rectangle
            key={key}
            bounds={L.latLngBounds(nw, se)}
            pathOptions={{
              color: '#ef4444',
              weight: 2,
              fillColor: '#ef4444',
              fillOpacity: 0.85,
              className: 'selected-tile-rect'
            }}
          />
        );
      })}
    </>
  );
};

export default EraserTool;
