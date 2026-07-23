import React, { useState } from 'react';
import { Search, Navigation, X, MapPin, Hash, ArrowRight, CloudOff } from 'lucide-react';
import { useMapStore, useConfigStore } from '../lib/store';
import L from 'leaflet';
import { motion, AnimatePresence } from 'framer-motion';

interface SearchResult {
  display_name: string;
  lat: string;
  lon: string;
}

const SearchAndRouting: React.FC = () => {
  const map = useMapStore(s => s.map);
  const isOnline = useConfigStore(s => s.isOnline);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [routeStep, setRouteStep] = useState<'none' | 'start' | 'end'>('none');
  const [routePoints, setRoutePoints] = useState<{start?: L.LatLng, end?: L.LatLng}>({});
  const [routeLayer, setRouteLayer] = useState<L.Polyline | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setIsSearching(true);
    let url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=8`;
    
    // Add viewbox if map available to prioritize local results
    if (map) {
      const bounds = map.getBounds();
      const viewbox = `${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()},${bounds.getSouth()}`;
      url += `&viewbox=${viewbox}&bounded=0`; // bounded=0 means prioritize but don't strictly limit
    }

    try {
      const resp = await fetch(url);
      const data = await resp.json();
      setResults(data);
    } catch (e) {
      console.error('Search failed', e);
    } finally {
      setIsSearching(false);
    }
  };

  const selectResult = (res: SearchResult) => {
    if (!map) return;
    const lat = parseFloat(res.lat);
    const lng = parseFloat(res.lon);
    map.setView([lat, lng], 15);
    setResults([]);
    setQuery('');
  };

  const startRouting = () => {
    setRouteStep('start');
    if (routeLayer && map) {
      map.removeLayer(routeLayer);
      setRouteLayer(null);
    }
  };

  const calculateRoute = async (start: L.LatLng, end: L.LatLng) => {
    if (!map) return;
    try {
      const resp = await fetch(`https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`);
      const data = await resp.json();
      
      if (data.routes && data.routes.length > 0) {
        const coordinates = data.routes[0].geometry.coordinates.map((c: any) => [c[1], c[0]]);
        const polyline = L.polyline(coordinates, { color: '#3b82f6', weight: 6, opacity: 0.8 }).addTo(map);
        map.fitBounds(polyline.getBounds(), { padding: [50, 50] });
        setRouteLayer(polyline);
      }
    } catch (e) {
      console.error('Routing failed', e);
    } finally {
      setRouteStep('none');
    }
  };

  const handleMapClickForRoute = (e: any) => {
    if (routeStep === 'start') {
      setRoutePoints({ start: e.latlng });
      setRouteStep('end');
    } else if (routeStep === 'end') {
      const newPoints = { ...routePoints, end: e.latlng };
      setRoutePoints(newPoints);
      calculateRoute(routePoints.start!, e.latlng);
    }
  };

  React.useEffect(() => {
    if (!map || routeStep === 'none') return;
    map.on('click', handleMapClickForRoute);
    map.getContainer().style.cursor = 'crosshair';
    return () => {
      map.off('click', handleMapClickForRoute);
      map.getContainer().style.cursor = '';
    };
  }, [map, routeStep, routePoints]);

  return (
    <div className="flex flex-col gap-3">
      {!isOnline && (
        <div className="flex flex-col items-center gap-2 p-4 bg-zinc-100 dark:bg-zinc-800/50 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700">
           <CloudOff className="w-8 h-8 text-zinc-400 opacity-50" />
           <span className="text-[9px] font-black tactical-font text-zinc-500 uppercase tracking-widest text-center">
             Connectivity Severed<br/>Offline Systems Only
           </span>
        </div>
      )}
      
      {isOnline && (
        <>
          {/* Search Input */}
          <div className="relative">
            <div className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1 px-2 border border-zinc-200 dark:border-zinc-700">
              <Search className="w-4 h-4 text-zinc-400" />
              <input 
                type="text" 
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search Objective..."
                className="bg-transparent border-none outline-none text-[10px] font-bold tactical-font w-full text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500"
              />
              {isSearching ? (
                 <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                 query && <X className="w-3 h-3 text-zinc-400 cursor-pointer" onClick={() => { setQuery(''); setResults([]); }} />
              )}
            </div>

            <AnimatePresence>
              {results.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-zinc-900 rounded-lg shadow-xl border border-zinc-200 dark:border-zinc-800 z-[100] max-h-48 overflow-y-auto"
                >
                  {results.map((res, i) => (
                    <button
                      key={i}
                      onClick={() => selectResult(res)}
                      className="w-full text-left px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-[9px] font-bold tactical-font border-b border-zinc-100 dark:border-zinc-800 last:border-0"
                    >
                      {res.display_name}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </>
      )}
    </div>
  );
};

export default SearchAndRouting;
