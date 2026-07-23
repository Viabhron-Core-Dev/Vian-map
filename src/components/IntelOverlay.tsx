import React, { useState, useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { db, Bookmark } from '../lib/db';
import { useLiveQuery } from 'dexie-react-hooks';

const IntelOverlay: React.FC = () => {
  const map = useMap();
  const intelItems = useLiveQuery(() => db.bookmarks.where('category').equals('intel').toArray());

  useEffect(() => {
    if (!intelItems) return;
    
    const layerGroup = L.layerGroup().addTo(map);

    intelItems.forEach(item => {
      const data = item.data;
      if (!data || !data.geometry) return;

      const popupHtml = `
        <div class="p-2 min-w-[200px] font-mono text-sm max-h-[300px] overflow-y-auto">
          <div class="font-bold text-amber-500 mb-2 border-b border-amber-500/30 pb-1">${item.name || 'CUSTOM INTEL'}</div>
          ${data.terrain ? `<div class="mb-1"><span class="text-zinc-500 text-xs">TERRAIN:</span> <span class="text-zinc-900 dark:text-zinc-100">${data.terrain}</span></div>` : ''}
          ${data.soil ? `<div class="mb-1"><span class="text-zinc-500 text-xs">SOIL TYPE:</span> <span class="text-zinc-900 dark:text-zinc-100">${data.soil}</span></div>` : ''}
          ${data.customFields?.map((f: any) => `<div class="mb-1"><span class="text-zinc-500 text-xs">${f.key.toUpperCase()}:</span> <span class="text-zinc-900 dark:text-zinc-100">${f.value}</span></div>`).join('') || ''}
          ${item.note ? `<div class="mt-2 pt-2 border-t border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 text-xs whitespace-pre-wrap">${item.note}</div>` : ''}
        </div>
      `;

      if (data.type === 'point' && data.geometry.length > 0) {
        L.circleMarker(data.geometry[0], {
          radius: 8,
          color: '#f59e0b',
          fillColor: '#f59e0b',
          fillOpacity: 0.8
        }).bindPopup(popupHtml).addTo(layerGroup);
      } else if (data.type === 'line' && data.geometry.length > 1) {
        L.polyline(data.geometry, {
          color: '#f59e0b',
          weight: 4,
          dashArray: '5, 10'
        }).bindPopup(popupHtml).addTo(layerGroup);
      } else if (data.type === 'polygon' && data.geometry.length > 2) {
        L.polygon(data.geometry, {
          color: '#f59e0b',
          weight: 3,
          fillColor: '#f59e0b',
          fillOpacity: 0.3
        }).bindPopup(popupHtml).addTo(layerGroup);
      } else if (data.type === 'area_bounds' && data.geometry.length === 4) {
        // Render boundary with a green/emerald stroke
        L.polygon(data.geometry, {
           color: '#10b981',
           weight: 3,
           fillColor: '#10b981',
           fillOpacity: 0.1, // very light fill so they can still see map
           dashArray: '10, 10' // dashed indicating a designated zone rather than a physical structure
        }).bindPopup(popupHtml).addTo(layerGroup);
      }
    });

    return () => {
      map.removeLayer(layerGroup);
    };
  }, [intelItems, map]);

  return null;
};

export default IntelOverlay;
