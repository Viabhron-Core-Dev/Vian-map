import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Route, Trash2, X, Bookmark, Zap, Map as MapIcon, Radio, Play, Square } from 'lucide-react';
import { useConfigStore, useGPSStore } from '../lib/store';
import { db } from '../lib/db';
import { Geolocation } from '@capacitor/geolocation';

type TraceMode = 'direct' | 'osrm' | 'osm' | 'live';

const MeasurementTool: React.FC<{ isActive: boolean }> = ({ isActive }) => {
  const map = useMap();
  const { mapRotation } = useConfigStore();
  const [points, setPoints] = useState<L.LatLng[]>([]);
  const [distance, setDistance] = useState(0);
  const [mode, setMode] = useState<TraceMode>('direct');
  const lineRef = useRef<L.Polyline | null>(null);
  const markersRef = useRef<L.CircleMarker[]>([]);
  const [isRecordingLive, setIsRecordingLive] = useState(false);
  const wakeLockRef = useRef<any>(null);
  const liveWatchRef = useRef<number | null>(null);

  // Parallel array of coordinates for routing geometry
  const [pathCoords, setPathCoords] = useState<L.LatLng[]>([]);

  // Calculate distance on raw points
  const calculateDistance = (pts: L.LatLng[]) => {
    let d = 0;
    for (let i = 0; i < pts.length - 1; i++) {
        d += pts[i].distanceTo(pts[i+1]);
    }
    return d;
  };

  const syncUI = useCallback((pts: L.LatLng[]) => {
    if (!lineRef.current) {
      lineRef.current = L.polyline(pts, { color: '#fbbf24', weight: 4, dashArray: mode === 'direct' ? '5, 10' : undefined }).addTo(map);
    } else {
      lineRef.current.setLatLngs(pts);
      if (mode === 'direct') {
          lineRef.current.setStyle({ dashArray: '5, 10' });
      } else {
          lineRef.current.setStyle({ dashArray: 'none' });
      }
    }
    const d = calculateDistance(pts);
    setDistance(d);
    window.dispatchEvent(new CustomEvent('measure-update', { detail: d }));
  }, [map, mode]);

  const clear = useCallback(() => {
    setPoints([]);
    setDistance(0);
    setPathCoords([]);
    window.dispatchEvent(new CustomEvent('measure-update', { detail: 0 }));
    if (lineRef.current) map.removeLayer(lineRef.current);
    markersRef.current.forEach(m => map.removeLayer(m));
    markersRef.current = [];
    lineRef.current = null;
    setIsRecordingLive(false);
    localStorage.removeItem('vian_live_trace');
  }, [map]);

  const saveRoute = useCallback(async () => {
    if (pathCoords.length < 2) return;
    
    await db.bookmarks.add({
      lat: pathCoords[0].lat,
      lng: pathCoords[0].lng,
      name: `ROUTE ${new Date().toLocaleTimeString()}`,
      category: 'route',
      savedAt: Date.now(),
      note: `Trace Distance: ${Math.round(distance)}m | Mode: ${mode.toUpperCase()}`,
      data: {
        path: pathCoords.map(p => ({ lat: p.lat, lng: p.lng })),
        distance
      }
    });
    
    window.dispatchEvent(new CustomEvent('bookmarks-updated'));
    
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([100, 50, 100]);
    clear();
    useConfigStore.getState().setActiveTool(null);
  }, [pathCoords, distance, mode, clear]);

  useEffect(() => {
    const handleClear = () => clear();
    const handleSave = () => saveRoute();
    
    window.addEventListener('measure-clear', handleClear);
    window.addEventListener('measure-save', handleSave);
    
    return () => {
      window.removeEventListener('measure-clear', handleClear);
      window.removeEventListener('measure-save', handleSave);
    };
  }, [clear, saveRoute]);

  // Load trace from localstorage if resumed
  useEffect(() => {
    if (isActive) {
       const savedData = localStorage.getItem('vian_live_trace');
       if (savedData) {
         try {
           const parsed = JSON.parse(savedData);
           if (parsed && Array.isArray(parsed) && parsed.length > 0) {
             const restoredPts = parsed.map((p: any) => L.latLng(p.lat, p.lng));
             setPathCoords(restoredPts);
             setPoints(restoredPts);
             setMode('live');
             syncUI(restoredPts);
           }
         } catch(e) {
           console.error("Failed to parse live trace from localstorage");
         }
       }
    }
  }, [isActive]);

  useEffect(() => {
    if (!isActive) {
      if (isRecordingLive) {
          // Instead of clearing, let it stay in localstorage but stop recording if UI hides.
          // Or pause it. We simply close the tool. Live recording shouldn't clear just because tool is hidden?
          // The user wanted background tracking potentially. So we don't clear on inactive!
          // We just stop the UI effects. But we do stop the tool. So trace stops.
      } else {
        clear();
      }
      window.dispatchEvent(new CustomEvent('measure-update', { detail: 0 }));
    }
  }, [isActive, clear, isRecordingLive]);

  // Live Recording Effect
  useEffect(() => {
    let watchId: string | null = null;
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLockRef.current = await navigator.wakeLock.request('screen');
        }
      } catch (err) {}
    };

    const releaseWakeLock = async () => {
      if (wakeLockRef.current) {
        try {
          await wakeLockRef.current.release();
          wakeLockRef.current = null;
        } catch (err) {}
      }
    };

    const startRecording = async () => {
      requestWakeLock();
      
      const { isTracking, setTracking } = useGPSStore.getState();
      const { positionMode, setPositionMode } = useConfigStore.getState();
      
      let activeMode = positionMode;
      if (!isTracking) {
        setTracking(true);
        setPositionMode('gps');
        activeMode = 'gps';
      }

      try {
        watchId = await Geolocation.watchPosition(
          { enableHighAccuracy: activeMode === 'gps', maximumAge: 0, timeout: 5000 },
          (pos) => {
            if (pos) {
              const newPt = L.latLng(pos.coords.latitude, pos.coords.longitude);
              setPathCoords(prev => {
                const latest = [...prev, newPt];
                localStorage.setItem('vian_live_trace', JSON.stringify(latest.map(p => ({ lat: p.lat, lng: p.lng }))));
                syncUI(latest);
                return latest;
              });
              setPoints(prev => [...prev, newPt]);
            }
          }
        );
      } catch (err) {
        console.error("Live Recording GPS error:", err);
      }
    };

    if (isRecordingLive && mode === 'live') {
      startRecording();
    } else {
      releaseWakeLock();
      if (watchId !== null) {
        Geolocation.clearWatch({ id: watchId });
        watchId = null;
      }
    }

    return () => {
      releaseWakeLock();
      if (watchId !== null) {
        Geolocation.clearWatch({ id: watchId });
      }
    };
  }, [isRecordingLive, mode, syncUI]);


  const getSubPath = async (start: L.LatLng, end: L.LatLng, md: TraceMode): Promise<L.LatLng[]> => {
    if (md === 'direct' || md === 'osm' || md === 'live') {
        return [start, end];
    }
    
    if (md === 'osrm') {
        try {
            const resp = await fetch(`https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`);
            const data = await resp.json();
            if (data.routes && data.routes.length > 0) {
              return data.routes[0].geometry.coordinates.map((c: any) => L.latLng(c[1], c[0]));
            }
        } catch (e) {
            console.error(e);
        }
    }
    return [start, end];
  };

  useMapEvents({
    async click(e) {
      if (!isActive) return;
      if (mode === 'live') return; // Cannot point-click in live mode
      
      let latlng = e.latlng;

      if (mapRotation !== 0) {
        const container = map.getContainer();
        const rect = container.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        const mouseEvent = e.originalEvent as MouseEvent;
        const dx = mouseEvent.clientX - centerX;
        const dy = mouseEvent.clientY - centerY;
        
        const theta = (-mapRotation * Math.PI) / 180;
        const rDx = dx * Math.cos(theta) - dy * Math.sin(theta);
        const rDy = dx * Math.sin(theta) + dy * Math.cos(theta);
        
        const rectMap = container.getBoundingClientRect();
        const mapRelativePoint = L.point(centerX + rDx - rectMap.left, centerY + rDy - rectMap.top);
        latlng = map.containerPointToLatLng(mapRelativePoint);
      }

      const newPoints = [...points, latlng];
      setPoints(newPoints);

      const marker = L.circleMarker(latlng, {
        radius: 5,
        color: '#fbbf24',
        fillColor: '#fbbf24',
        fillOpacity: 1
      }).addTo(map);
      markersRef.current.push(marker);

      if (newPoints.length > 1) {
        const lastPoint = newPoints[newPoints.length - 2];
        const subPath = await getSubPath(lastPoint, latlng, mode);
        
        const newPathCoords = [...pathCoords, ...(pathCoords.length > 0 ? subPath.slice(1) : subPath)];
        setPathCoords(newPathCoords);
        syncUI(newPathCoords);
      } else {
        setPathCoords([latlng]);
      }
    }
  });

  if (!isActive) return null;

  const ui = (
    <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[9999] bg-zinc-900/90 backdrop-blur-xl border border-zinc-800 rounded-2xl p-2 shadow-2xl safe-area-top" style={{ pointerEvents: 'auto' }}>
      <div className="flex gap-2">
         {/* Live Recording Mode */}
         {mode === 'live' ? (
           <div className="flex items-center gap-2">
             <button 
               onClick={() => setIsRecordingLive(!isRecordingLive)}
               className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all ${isRecordingLive ? 'bg-red-500 text-white animate-pulse' : 'bg-red-500/20 text-red-500 hover:bg-red-500/40'}`}
             >
               {isRecordingLive ? <Square className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
               {isRecordingLive ? 'REC' : 'START TRACE'}
             </button>
             <button 
               onClick={() => { clear(); setMode('direct'); }}
               className="px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest bg-zinc-800 text-zinc-400 hover:text-white transition-all"
             >
               EXIT LIVE
             </button>
           </div>
         ) : (
           <>
             <button 
                onClick={() => { setMode('direct'); clear(); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${mode === 'direct' ? 'bg-amber-500 text-amber-950' : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'}`}
             >
                Direct
             </button>
             <button 
                onClick={() => { setMode('osrm'); clear(); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest flex items-center gap-1 transition-all ${mode === 'osrm' ? 'bg-amber-500 text-amber-950' : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'}`}
             >
               <Zap className="w-3 h-3" /> OSRM
             </button>
             <button 
                onClick={() => { setMode('osm'); clear(); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest flex items-center gap-1 transition-all ${mode === 'osm' ? 'bg-amber-500 text-amber-950' : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'}`}
             >
               <MapIcon className="w-3 h-3" /> OSM
             </button>
             <div className="w-px bg-zinc-700 mx-1"></div>
             <button 
                onClick={() => { setMode('live'); clear(); }}
                className="px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest flex items-center gap-1 transition-all bg-red-500/10 text-red-500 hover:bg-red-500/20"
             >
               <Radio className="w-3 h-3" /> LIVE
             </button>
           </>
         )}
      </div>
    </div>
  );

  return createPortal(ui, document.body);
};

export default MeasurementTool;
