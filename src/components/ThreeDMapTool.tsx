import React, { useEffect, useState, useRef } from 'react';
import { X, Layers, Building2, Mountain, Loader2, Maximize2, Minimize2, ChevronDown, ChevronUp } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useMap } from 'react-leaflet';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useConfigStore } from '../lib/store';
import { db } from '../lib/db';

interface ThreeDMapToolProps {
  isActive: boolean;
}

const ThreeDMapTool: React.FC<ThreeDMapToolProps> = ({ isActive }) => {
  const map = useMap();
  const setActiveTool = useConfigStore(state => state.setActiveTool);
  
  const [zoomError, setZoomError] = useState(false);
  const [mode, setMode] = useState<'none' | 'buildings' | 'terrain'>('none');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  
  // New States
  const [isControlsCollapsed, setIsControlsCollapsed] = useState(false);
  const [isMinimapExpanded, setIsMinimapExpanded] = useState(false);
  
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mlMapRef = useRef<maplibregl.Map | null>(null);
  
  const minimapContainerRef = useRef<HTMLDivElement>(null);
  const minimapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!isActive) {
      setMode('none');
      setLoading(false);
      setError(false);
      setZoomError(false);
      setIsControlsCollapsed(false);
      setIsMinimapExpanded(false);
      if (mlMapRef.current) {
        mlMapRef.current.remove();
        mlMapRef.current = null;
      }
      if (minimapRef.current) {
        minimapRef.current.remove();
        minimapRef.current = null;
      }
      return;
    }

    const checkZoom = () => {
      const z = map.getZoom();
      if (z < 16) {
        setZoomError(true);
        setMode('none');
        map.setZoom(16, { animate: true });
      } else {
        setZoomError(false);
      }
    };

    checkZoom();

    const onZoomEnd = () => {
      if (map.getZoom() >= 16) {
        setZoomError(false);
      } else {
        setZoomError(true);
        setMode('none');
      }
    };

    map.on('zoomend', onZoomEnd);
    return () => {
      map.off('zoomend', onZoomEnd);
    };
  }, [isActive, map]);

  // Handle freeze/unfreeze of the 2D map
  useEffect(() => {
    if (isActive && mode !== 'none' && !zoomError) {
      // 2D Engine "Sleep" Mode
      map.dragging.disable();
      map.touchZoom.disable();
      map.doubleClickZoom.disable();
      map.scrollWheelZoom.disable();
      map.boxZoom.disable();
      map.keyboard.disable();
      //@ts-ignore Disable tap safely
      if (map.tap) map.tap.disable();

      return () => {
        // 2D Engine "Awake" Mode
        map.dragging.enable();
        map.touchZoom.enable();
        map.doubleClickZoom.enable();
        map.scrollWheelZoom.enable();
        map.boxZoom.enable();
        map.keyboard.enable();
        //@ts-ignore
        if (map.tap) map.tap.enable();
      };
    }
  }, [isActive, mode, zoomError, map]);

  // Initialize MapLibre Custom 3D & Minimap
  useEffect(() => {
    if (!isActive || mode === 'none' || zoomError || !mapContainerRef.current || !minimapContainerRef.current) return;

    setLoading(true);
    setError(false);

    const center = map.getCenter();
    const zoom = map.getZoom();

    const baseStyle = mode === 'buildings'
      ? 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'
      : {
          version: 8,
          sources: {
            hybrid: {
              type: 'raster',
              tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
              tileSize: 256,
              attribution: 'Esri'
            }
          },
          layers: [{ id: 'hybrid', type: 'raster', source: 'hybrid', minzoom: 0, maxzoom: 19 }]
        } as maplibregl.StyleSpecification;

    // 1. MAIN 3D MAP
    const mlMap = new maplibregl.Map({
      container: mapContainerRef.current,
      style: baseStyle,
      center: [center.lng, center.lat],
      zoom: zoom + 1, // Zoom a bit more
      pitch: 45, // Strategy game like angle
      minPitch: 45, // Lock pitch
      maxPitch: 45,
      bearing: map.options.transform3DLimit ? 0 : 0,
      attributionControl: false,
      maxTileCacheZoomLevels: 0 // Keep engine light, load what's seen
    });

    mlMapRef.current = mlMap;

    const minimapStyle = mode === 'buildings'
      ? 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json'
      : baseStyle;

    // 2. MINIMAP 2D
    const mmMap = new maplibregl.Map({
      container: minimapContainerRef.current,
      style: minimapStyle,
      center: [center.lng, center.lat],
      zoom: zoom - 3.5,
      pitch: 0,
      bearing: 0,
      attributionControl: false,
      interactive: true // Interactive when expanded
    });
    
    minimapRef.current = mmMap;

    mmMap.on('click', (e) => {
      if (mlMapRef.current) {
        mlMapRef.current.flyTo({ center: e.lngLat, zoom: mlMapRef.current.getZoom(), duration: 800 });
      }
    });

    // Render minimap rectangle outline
    mmMap.on('load', () => {
      mmMap.addSource('viewport-box', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [[]]
          },
          properties: {}
        }
      });
      mmMap.addLayer({
        id: 'viewport-box-line',
        type: 'line',
        source: 'viewport-box',
        paint: {
          'line-color': '#ef4444',
          'line-width': 2
        }
      });
      mmMap.addLayer({
        id: 'viewport-box-fill',
        type: 'fill',
        source: 'viewport-box',
        paint: {
          'fill-color': '#ef4444',
          'fill-opacity': 0.1
        }
      });
      
      // Load POIs onto Minimap
      db.bookmarks.toArray().then(bookmarks => {
        bookmarks.forEach(bm => {
          // Add marker
          const el = document.createElement('div');
          el.className = 'w-3 h-3 bg-red-500 rounded-full border border-white shadow-sm';
          new maplibregl.Marker({ element: el })
            .setLngLat([bm.lng, bm.lat])
            .addTo(mmMap);

          // If route, draw line
          if (bm.category === 'route' && bm.data?.coordinates) {
             const layerId = 'route-' + bm.id;
             mmMap.addSource(layerId, {
               type: 'geojson',
               data: {
                 type: 'Feature',
                 geometry: {
                   type: 'LineString',
                   coordinates: bm.data.coordinates.map((c: any) => [c[1], c[0]]) // leaflet is lat,lng, maplibre is lng,lat
                 },
                 properties: {}
               }
             });
             mmMap.addLayer({
               id: layerId,
               type: 'line',
               source: layerId,
               paint: {
                 'line-color': '#3b82f6',
                 'line-width': 3
               }
             });
          }
        });
      });
    });

    const updateViewportBox = () => {
      if (!mlMapRef.current || !minimapRef.current) return;
      const b = mlMapRef.current.getBounds();
      const coords = [
        [b.getWest(), b.getNorth()],
        [b.getEast(), b.getNorth()],
        [b.getEast(), b.getSouth()],
        [b.getWest(), b.getSouth()],
        [b.getWest(), b.getNorth()]
      ];
      const source = mmMap.getSource('viewport-box') as maplibregl.GeoJSONSource;
      if (source && source.setData) {
        source.setData({
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [coords]
          },
          properties: {}
        });
      }
      mmMap.setCenter(mlMapRef.current.getCenter());
    };

    mlMap.on('move', updateViewportBox);
    mlMap.on('error', (e: any) => {
      const msg = e?.error?.message || e?.message || 'Unknown error';
      if (msg.includes('Failed to fetch') || msg.includes('404')) {
        console.warn('Map tile load issue:', msg);
        return;
      }
      console.error('Critical MapLibre error:', msg);
      setError(true);
      setLoading(false);
    });

    mlMap.on('load', () => {
      setLoading(false);
      setError(false);
      
      // LOCK ZOOM & PITCH INTERACTIONS (Only panning/rotating allowed)
      if (mlMap.scrollZoom) mlMap.scrollZoom.disable();
      if (mlMap.boxZoom) mlMap.boxZoom.disable();
      if (mlMap.doubleClickZoom) mlMap.doubleClickZoom.disable();

      if (mlMap.touchZoomRotate) {
        mlMap.touchZoomRotate.enable();
      }
      
      const currentZoom = mlMap.getZoom();
      mlMap.setMinZoom(currentZoom);
      
      if (mlMap.touchPitch) mlMap.touchPitch.disable();
      if (mlMap.keyboard) mlMap.keyboard.disable();

      if (mode === 'buildings') {
        const layers = mlMap.getStyle().layers;
        let labelLayerId;
        for (let i = 0; i < layers.length; i++) {
          const layer = layers[i];
          if (layer.type === 'symbol' && layer.layout && layer.layout['text-field']) {
            labelLayerId = layer.id;
            break;
          }
        }

        // Hide text labels for POIs and roads to keep it clean, but keep the roads visible
        layers.forEach(layer => {
           if (layer.id.includes('poi_') || layer.id.includes('roadname_')) {
               mlMap.setLayoutProperty(layer.id, 'visibility', 'none');
           }
        });

        // Add POI dots to replace the text labels
        if (!mlMap.getLayer('poi-dots')) {
          mlMap.addLayer({
            'id': 'poi-dots',
            'type': 'circle',
            'source': 'carto',
            'source-layer': 'poi',
            'minzoom': 13,
            'paint': {
              'circle-radius': 3,
              'circle-color': '#94a3b8',
              'circle-stroke-width': 1,
              'circle-stroke-color': '#1e293b'
            }
          }, labelLayerId);
        }

        if (mlMap.getLayer('building')) {
          mlMap.setLayoutProperty('building', 'visibility', 'none');
        }
        if (mlMap.getLayer('building-top')) {
          mlMap.setLayoutProperty('building-top', 'visibility', 'none');
        }

        if (!mlMap.getLayer('3d-buildings')) {
          mlMap.addLayer({
            'id': '3d-buildings',
            'source': 'carto',
            'source-layer': 'building',
            'type': 'fill-extrusion',
            'minzoom': 13,
            'paint': {
              'fill-extrusion-color': '#e5e7eb', // gray-200
              'fill-extrusion-height': [
                'interpolate', ['linear'], ['zoom'],
                13, 0,
                15.05, ['coalesce', ['get', 'render_height'], ['get', 'height'], 20]
              ],
              'fill-extrusion-base': [
                'interpolate', ['linear'], ['zoom'],
                13, 0,
                15.05, ['coalesce', ['get', 'render_min_height'], ['get', 'min_height'], 0]
              ],
              'fill-extrusion-opacity': 0.8
            }
          }, labelLayerId);
        }
      } else if (mode === 'terrain') {
        mlMap.showTileBoundaries = true;
        mlMap.addSource('terrain-source', {
          type: 'raster-dem',
          tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
          encoding: 'terrarium',
          tileSize: 256,
        });
        mlMap.setTerrain({ source: 'terrain-source', exaggeration: 1.5 });
      }

      updateViewportBox();
    });

    return () => {
      // Jump 2D Leaflet map to where 3D map ended up
      if (mlMapRef.current) {
        const c = mlMapRef.current.getCenter();
        const z = mlMapRef.current.getZoom() - 1;
        map.setView([c.lat, c.lng], z, { animate: false });
      }

      mlMap.remove();
      mmMap.remove();
      mlMapRef.current = null;
      minimapRef.current = null;
    };
  }, [isActive, mode, zoomError, map]);

  // Handle Minimap Taps
  const handleMinimapTap = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!minimapRef.current || !mlMapRef.current) return;
    
    // Expand to bigger map if tapped while small
    if (!isMinimapExpanded) {
      setIsMinimapExpanded(true);
      setTimeout(() => minimapRef.current?.resize(), 300);
    }
  };

  if (!isActive) return null;

  return createPortal(
    <>
      {/* 3D Container */}
      {mode !== 'none' && !zoomError && (
        <div 
          ref={mapContainerRef} 
          className="absolute inset-0 z-[400] bg-zinc-900"
          style={{ width: '100vw', height: '100vh', position: 'fixed', top: 0, left: 0 }}
        />
      )}

      {/* Minimap Container */}
      {mode !== 'none' && !zoomError && (
        <div 
          className={`fixed top-4 right-4 z-[2001] bg-black/50 backdrop-blur-md border border-zinc-700/50 rounded-xl shadow-2xl overflow-hidden transition-all duration-300 cursor-pointer ${isMinimapExpanded ? 'w-[300px] h-[300px]' : 'w-[100px] h-[100px] hover:border-blue-500/50 hover:shadow-blue-500/20'}`}
          onClick={handleMinimapTap}
        >
          <div ref={minimapContainerRef} className={`w-full h-full ${isMinimapExpanded ? 'pointer-events-auto' : 'pointer-events-none'}`} />
          
          <div className="absolute top-2 right-2 bg-black/60 rounded p-1 text-white flex gap-1 items-center">
            {isMinimapExpanded ? (
               <button onClick={(e) => { e.stopPropagation(); setIsMinimapExpanded(false); setTimeout(() => minimapRef.current?.resize(), 300); }} className="hover:text-blue-400">
                 <Minimize2 className="w-4 h-4" />
               </button>
            ) : (
               <Maximize2 className="w-3 h-3 opacity-70" />
            )}
          </div>
        </div>
      )}

      {/* Interface Panel */}
      <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[2000] bg-zinc-950/95 backdrop-blur-md rounded-xl border border-zinc-800 flex flex-col min-w-[320px] shadow-2xl transition-all duration-300 ${isControlsCollapsed ? 'min-h-0' : 'p-4 gap-3'}`}>
        {/* Header - Always visible */}
        <div className={`flex items-center justify-between ${isControlsCollapsed ? 'p-3' : ''}`}>
          <div className="flex items-center gap-2 text-zinc-100 font-bold text-xs uppercase tracking-wider">
            <Layers className="w-4 h-4 text-blue-500" />
            <span>3D Engine (Online)</span>
            {loading && <Loader2 className={`w-3.5 h-3.5 animate-spin ${error ? 'text-red-500' : 'text-blue-400'}`} />}
          </div>
          <div className="flex items-center gap-1">
            <button 
              onClick={() => setIsControlsCollapsed(!isControlsCollapsed)} 
              className="p-1 hover:bg-zinc-800 rounded bg-zinc-900 border border-zinc-700/50 transition-colors"
            >
              {isControlsCollapsed ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
            </button>
            <button onClick={() => setActiveTool(null)} className="p-1 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/50 rounded bg-zinc-900 border border-zinc-700/50 transition-colors">
              <X className="w-4 h-4 text-zinc-400" />
            </button>
          </div>
        </div>

        {/* Collapsible Content */}
        {!isControlsCollapsed && (
          zoomError ? (
            <div className="text-[11px] text-zinc-400 flex flex-col gap-2 font-mono">
              <div className="flex items-center gap-2 text-blue-400 bg-blue-500/10 p-2 rounded-lg border border-blue-500/20">
                 <Loader2 className="w-4 h-4 animate-spin" />
                 <span className="font-bold">AUTO-ZOOMING</span>
              </div>
              <p>Acquiring necessary zoom level (16) for 3D geometry...</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2 mt-1">
               <div className="text-[10px] text-zinc-500 font-mono mb-2 leading-relaxed bg-black/20 p-2 rounded border border-white/5">
                 Pan and rotate to explore. Zoom/Tilt are locked for spatial consistency. Minimap tracks your active viewport.
               </div>
               
               <button
                 onClick={() => setMode('buildings')}
                 className={`flex items-center justify-between text-left px-3 py-2 border rounded-lg transition-colors ${mode === 'buildings' ? 'border-blue-500 bg-blue-500/20 text-white' : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200'}`}
               >
                 <div className="flex items-center gap-2.5">
                   <Building2 className={`w-4 h-4 ${mode === 'buildings' ? 'text-blue-400' : ''}`} />
                   <div className="flex flex-col">
                     <span className="text-[10px] font-bold uppercase tracking-wide">Extrude Buildings</span>
                     <span className="text-[8px] opacity-70">Requires urban map location</span>
                   </div>
                 </div>
                 {mode === 'buildings' && !loading && !error && <div className="ml-2 w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />}
                 {mode === 'buildings' && error && <div className="ml-2 w-1.5 h-1.5 rounded-full bg-red-500" />}
               </button>

               <button
                 onClick={() => setMode('terrain')}
                 className={`flex items-center justify-between text-left px-3 py-2 border rounded-lg transition-colors ${mode === 'terrain' ? 'border-emerald-500 bg-emerald-500/20 text-white' : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200'}`}
               >
                 <div className="flex items-center gap-2.5">
                   <Mountain className={`w-4 h-4 ${mode === 'terrain' ? 'text-emerald-400' : ''}`} />
                   <div className="flex flex-col">
                     <span className="text-[10px] font-bold uppercase tracking-wide">Deform Terrain</span>
                     <span className="text-[8px] opacity-70">Requires mountainous terrain</span>
                   </div>
                 </div>
                 {mode === 'terrain' && !loading && !error && <div className="ml-2 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                 {mode === 'terrain' && error && <div className="ml-2 w-1.5 h-1.5 rounded-full bg-red-500" />}
               </button>

               {error && (
                 <div className="text-[10px] text-red-400 font-bold font-mono py-1 text-center bg-red-500/10 border border-red-500/20 rounded mt-1">
                   TILE LOAD FAILED
                 </div>
               )}

               {mode !== 'none' && (
                 <button
                   onClick={() => setActiveTool(null)}
                   className="mt-2 text-[9px] text-zinc-500 uppercase font-black tracking-widest hover:text-zinc-300 py-1 transition-colors"
                 >
                   Close 3D Engine & Wake Leaflet
                 </button>
               )}
            </div>
          )
        )}
      </div>
    </>,
    document.body
  );
};

export default ThreeDMapTool;

