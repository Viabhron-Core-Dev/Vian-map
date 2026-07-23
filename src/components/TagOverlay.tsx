import React, { useEffect, useState, useRef } from 'react';
import { Marker, Polyline, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { useConfigStore } from '../lib/store';
import { db, Bookmark } from '../lib/db';

const OVERPASS_TYPE_MAP: Record<string, string> = {
  fuel: 'amenity=fuel',
  gas: 'amenity=fuel',
  hospital: 'amenity=hospital',
  medical: 'amenity=hospital',
  pharmacy: 'amenity=pharmacy',
  police: 'amenity=police',
  security: 'amenity=police',
  water: 'amenity=drinking_water',
  tower: 'man_made=tower',
  bank: 'amenity=bank',
  store: 'shop',
  cafe: 'amenity=cafe'
};

interface POI {
  id: number;
  lat: number;
  lon: number;
  name: string;
  type: string;
}

const TagOverlay: React.FC = () => {
  const activeTagFilters = useConfigStore(s => s.activeTagFilters);
  const [pois, setPois] = useState<POI[]>([]);
  const [visiblePois, setVisiblePois] = useState<POI[]>([]);
  const [userMarks, setUserMarks] = useState<Bookmark[]>([]);
  const [visibleMarks, setVisibleMarks] = useState<Bookmark[]>([]);
  const map = useMap();
  const theme = useConfigStore(s => s.theme);
  const performanceMode = useConfigStore(s => s.performanceMode);
  const lastBbox = useRef<string>('');
  const fetchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const handleManual = () => {
      lastBbox.current = ''; // Clear cache key
      debouncedFetch();
    };
    window.addEventListener('map-manual-refresh', handleManual);
    return () => {
      window.removeEventListener('map-manual-refresh', handleManual);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  // Filter points based on current viewport
  const filterVisiblePoints = () => {
    if (!map) return;
    const bounds = map.getBounds().pad(0.1); // Add 10% buffer
    
    // Limit total number of markers rendered to 100 for performance
    const filteredPois = pois.filter(p => bounds.contains([p.lat, p.lon]));
    setVisiblePois(filteredPois.slice(0, 100));

    const filteredMarks = userMarks.filter(m => bounds.contains([m.lat, m.lng]));
    setVisibleMarks(filteredMarks.slice(0, 50));
  };

  const filterTimerRef = useRef<NodeJS.Timeout | null>(null);
  const debouncedFilter = () => {
    if (filterTimerRef.current) clearTimeout(filterTimerRef.current);
    filterTimerRef.current = setTimeout(filterVisiblePoints, performanceMode === 'low' ? 200 : 100);
  };

  // Run filter when underlying data changes
  useEffect(() => {
    filterVisiblePoints();
  }, [pois, userMarks]);

  const getIconHtml = (type: string, name: string) => {
    const isHighPerf = performanceMode === 'high';
    
    return `<div class="relative group flex flex-col items-center unrotate" style="width: 10px; height: 10px;">
      <div class="absolute bottom-full mb-1 px-1.5 py-0.5 bg-zinc-900 border border-zinc-700 text-[9px] font-black text-white rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-xl pointer-events-none">
        ${name}
      </div>
      <div class="w-2.5 h-2.5 rounded-full border border-white bg-blue-500 shadow-sm transition-transform group-hover:scale-150"></div>
      ${type === 'tower' ? `
        <div class="absolute inset-0 w-2.5 h-2.5 rounded-full bg-blue-500/20 animate-ping" style="animation-duration: 3s; transform: scale(8);"></div>
        <div class="absolute inset-x-[-20px] inset-y-[-20px] border border-blue-500/10 rounded-full pointer-events-none"></div>
      ` : ''}
      ${isHighPerf ? '<div class="absolute inset-0 w-2.5 h-2.5 border border-blue-400 rounded-full animate-ping opacity-50 pointer-events-none"></div>' : ''}
    </div>`;
  };

  const getUserMarkHtml = (mark: Bookmark) => {
    const isImageMap = mark.category === 'imagemap';
    const svgPath = isImageMap 
      ? '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline>'
      : '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>';
    const color = isImageMap ? "#a855f7" : "#3b82f6"; // purple for imagemap

    return `<div class="relative group flex flex-col items-center unrotate" style="width: 14px; height: 14px;">
      <div class="absolute bottom-full mb-1 px-1.5 py-0.5 bg-zinc-900 border border-zinc-700 text-[9px] font-black text-white rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-xl pointer-events-none z-[1000]">
         ${mark.name}
      </div>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" class="drop-shadow-md shadow-${isImageMap ? 'purple' : 'blue'}-500/50">${svgPath}</svg>
    </div>`;
  };

  const fetchPOIs = async () => {
    // 1. Fetch User Bookmarks (Instant, local DB)
    const allBookmarks = await db.bookmarks.toArray();
    const filteredMarks = allBookmarks.filter(b => {
      if (typeof b.lat !== 'number' || typeof b.lng !== 'number' || isNaN(b.lat) || isNaN(b.lng)) return false;
      if ((b.category === 'note' || b.category === 'wiki') && map.getZoom() <= 14) return false;
      if (activeTagFilters.includes('all')) return true;
      const bTags = (b.tags || '').toLowerCase().split(',').map(t => t.trim());
      return activeTagFilters.some(f => bTags.includes(f.toLowerCase()));
    });
    setUserMarks(filteredMarks);

    // 2. Fetch OSM POIs (External, needs debouncing)
    const activeOsmFilters = activeTagFilters.filter(f => f !== 'all');
    if (activeOsmFilters.length === 0) {
      if (pois.length > 0) setPois([]);
      return;
    }

    const currentZoom = map.getZoom();
    // Allow fetching at lower zoom if specific filters are active, but bound it
    const zoomThreshold = activeOsmFilters.length > 0 ? 8 : 12;
    if (currentZoom < zoomThreshold) {
      if (pois.length > 0) setPois([]);
      return;
    }

    const bounds = map.getBounds();
    const bbox = `${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()}`;
    
    // Throttle: don't fetch if bbox hasn't changed much
    if (bbox === lastBbox.current) return;
    lastBbox.current = bbox;

    const queries = activeOsmFilters.map(filter => {
      const osmQuery = OVERPASS_TYPE_MAP[filter] || '';
      if (!osmQuery) return '';
      return `node[${osmQuery}](${bbox});`;
    }).filter(q => q !== '').join('');

    if (!queries) return;

    const overpassQuery = `[out:json][timeout:25];(${queries});out body;`;
    
    // Abort previous request
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: new URLSearchParams({ data: overpassQuery }),
        signal: abortControllerRef.current.signal
      });
      
      if (response.status === 429) {
        console.warn('Overpass Rate Limit Exceeded (429). Retrying is suppressed for 5 seconds.');
        return;
      }

      if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.warn("Overpass API returned non-JSON in TagOverlay:", text.substring(0, 100));
        throw new Error("Overpass rate limit or error");
      }
      
      const newPois = data.elements.map((el: any) => ({
        id: el.id,
        lat: el.lat,
        lon: el.lon,
        name: el.tags.name || el.tags.amenity || el.tags.shop || 'Unknown POI',
        type: activeOsmFilters.find(f => {
          const q = OVERPASS_TYPE_MAP[f];
          if (q.includes('=')) {
            const [k, v] = q.split('=');
            return el.tags[k] === v;
          }
          return el.tags[q] !== undefined;
        }) || 'default'
      }));

      setPois(newPois);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // Silent
        return;
      }
      console.warn('Overpass fetch failed:', error);
    } finally {
      if (abortControllerRef.current?.signal.aborted === false) {
          // abortControllerRef.current = null; // Don't clear yet to avoid race
      }
    }
  };

  const debouncedFetch = () => {
    if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current);
    fetchTimerRef.current = setTimeout(fetchPOIs, 1000);
  };

  // Fetch POIs when filters change or map moves
  useMapEvents({
    moveend: () => {
      debouncedFetch();
      filterVisiblePoints();
    },
    move: debouncedFilter,
    zoomend: filterVisiblePoints
  });

  useEffect(() => {
    debouncedFetch();
    return () => {
      if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current);
    };
  }, [activeTagFilters]);

  return (
    <>
      {/* 1. Render User-Created Marks */}
      {visibleMarks.map(mark => {
        if (mark.category === 'route' && mark.data?.path) {
          return (
            <Polyline
              key={`mark-${mark.id}`}
              positions={mark.data.path}
              pathOptions={{
                color: '#f59e0b',
                weight: 4,
                opacity: 0.8,
                dashArray: mark.note?.includes('DIRECT') ? '5,10' : 'none'
              }}
              eventHandlers={{
                click: (e) => {
                  L.DomEvent.stopPropagation(e);
                  map.fitBounds(L.latLngBounds(mark.data.path));
                }
              }}
            />
          );
        }

        return (
        <Marker
          key={`mark-${mark.id}`}
          position={[mark.lat, mark.lng]}
          icon={L.divIcon({
            className: 'user-mark-tag',
            html: getUserMarkHtml(mark),
            iconSize: [14, 14],
            iconAnchor: [7, 7]
          })}
          eventHandlers={{
            click: (e) => {
              L.DomEvent.stopPropagation(e);
              map.setView([mark.lat, mark.lng], Math.max(map.getZoom(), 17));
              window.dispatchEvent(new CustomEvent('map-set-target', { detail: [mark.lat, mark.lng] }));
              
              if (mark.category === 'imagemap') {
                  useConfigStore.getState().setActiveTool('imagemap');
                  useConfigStore.getState().setActiveImageMapId(mark.id || null);
              }
            }
          }}
        />
      );
      })}

      {/* 2. Render Extracted OSM POIs */}
      {visiblePois.map(poi => {
        const icon = L.divIcon({
          className: 'zoom-independent-tag',
          html: getIconHtml(poi.type, poi.name),
          iconSize: [10, 10],
          iconAnchor: [5, 5]
        });

        return (
          <Marker 
            key={poi.id} 
            position={[poi.lat, poi.lon]} 
            icon={icon}
            eventHandlers={{
              click: (e) => {
                L.DomEvent.stopPropagation(e);
                map.setView([poi.lat, poi.lon], Math.max(map.getZoom(), 17));
                window.dispatchEvent(new CustomEvent('map-set-target', { detail: [poi.lat, poi.lon] }));
              }
            }}
          />
        );
      })}
    </>
  );
};

export default TagOverlay;
