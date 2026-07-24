import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, useMap, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import { MAP_LAYERS, OfflineTileLayer } from '../lib/OfflineLayer';
import { useConfigStore, useGPSStore, useMapStore } from '../lib/store';
import { db } from '../lib/db';
import { Compass } from 'lucide-react';
import { CacheManager } from '../lib/CacheManager';
import MeasurementTool from './MeasurementTool';
import ImageMapTool from './ImageMapTool';
import EraserTool from './EraserTool';
import SignalRadar from './SignalRadar';
import { DepthMapTool } from './DepthMapTool';
import ThreeDMapTool from './ThreeDMapTool';
import { WikiTool } from './WikiTool';
import TagOverlay from './TagOverlay';
import MapNavigationOverlay from './MapNavigationOverlay';
import CacheDensityOverlay from './CacheDensityOverlay';
import VianVectorRoads from './VianVectorRoads';
import CustomMapTool from './CustomMapTool';
import NavigationTool from './NavigationTool';
import IntelOverlay from './IntelOverlay';

const MapInstanceCapture: React.FC = () => {
  const map = useMap();
  const setMap = useMapStore(s => s.setMap);

  useEffect(() => {
    setMap(map);
    // Trigger lazy cleanup on startup
    CacheManager.performCleanup();
    return () => setMap(null);
  }, [map, setMap]);

  return null;
};

const LayerManager: React.FC = () => {
  const map = useMap();
  const activeLayerId = useConfigStore(s => s.activeLayerId);
  const isOnline = useConfigStore(s => s.isOnline);
  const autoCache = useConfigStore(s => s.autoCache);
  const activeTool = useConfigStore(s => s.activeTool);
  const layerRef = useRef<OfflineTileLayer | null>(null);

  useEffect(() => {
    if (activeTool === '3d' || activeTool === 'depth') {
      // ENGINE SLEEP PROTOCOL: Unmount 2D tiles to prevent Dual-Engine OOM Crash and conflicting tile loads
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
      return;
    }

    const layerDef = MAP_LAYERS[activeLayerId] || MAP_LAYERS.osm;
    
    // Remove old layer
    if (layerRef.current) {
      map.removeLayer(layerRef.current);
    }

    let url = layerDef.url;

    // Add new custom OfflineLayer
    const newLayer = new OfflineTileLayer(url, layerDef.id, {
      attribution: layerDef.attribution,
      maxZoom: layerDef.maxZoom,
      crossOrigin: true,
      noCache: layerDef.noCache
    });
    
    newLayer.setOnline(isOnline);
    newLayer.setAutoCache(autoCache);
    newLayer.addTo(map);
    layerRef.current = newLayer;

    return () => {
      if (layerRef.current) map.removeLayer(layerRef.current);
    };
  }, [activeLayerId, isOnline, autoCache, map, activeTool]);

  useEffect(() => {
    if (!autoCache || !layerRef.current || activeTool === '3d') return;

    const handleMoveEnd = () => {
      if (!layerRef.current) return;
      const bounds = map.getBounds();
      const zoom = map.getZoom();
      // Harvest current zoom and the next zoom level for granular detail
      // Reduced from zoom + 2 to zoom + 1 to save space
      layerRef.current.harvest(bounds, Math.max(0, zoom - 1), Math.min(20, zoom + 1));
    };

    map.on('moveend', handleMoveEnd);
    return () => {
      map.off('moveend', handleMoveEnd);
    };
  }, [map, autoCache]);

  return null;
};

const GPSMarker: React.FC = () => {
  const map = useMap();
  const position = useGPSStore(s => s.position);
  const heading = useGPSStore(s => s.heading);
  const isTracking = useGPSStore(s => s.isTracking);
  const performanceMode = useConfigStore(s => s.performanceMode);
  const markerRef = useRef<L.Marker | null>(null);
  const trailRef = useRef<L.Polyline | null>(null);
  const path = useRef<L.LatLngExpression[]>([]);

  useEffect(() => {
    if (!position || isNaN(position[0]) || isNaN(position[1])) return;

    const latLng = L.latLng(position[0], position[1]);

    if (!markerRef.current) {
      const icon = L.divIcon({
        className: 'gps-cursor',
        html: `<div class="relative w-8 h-10 unrotate flex items-center justify-center">
                 <!-- Shadow -->
                 <div class="absolute bottom-0 w-4 h-2 bg-black/20 blur-[2px] rounded-[100%] scale-x-150"></div>
                 
                 <!-- Sims Plumbob Diamond -->
                 <div class="relative w-6 h-10 animate-bounce-slow">
                   <svg viewBox="0 0 100 160" class="w-full h-full drop-shadow-lg">
                     <defs>
                       <linearGradient id="plumbob-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                         <stop offset="0%" style="stop-color:#38bdf8" />
                         <stop offset="100%" style="stop-color:#a855f7" />
                       </linearGradient>
                       <filter id="inner-shadow">
                          <feOffset dx="0" dy="2"/>
                          <feGaussianBlur stdDeviation="1" result="offset-blur"/>
                          <feComposite operator="out" in="SourceGraphic" in2="offset-blur" result="inverse"/>
                          <feFlood flood-color="black" flood-opacity="0.3" result="color"/>
                          <feComposite operator="in" in="color" in2="inverse" result="shadow"/>
                          <feComponentTransfer in="shadow" result="shadow">
                            <feFuncA type="linear" slope=".5"/>
                          </feComponentTransfer>
                          <feComposite operator="over" in="shadow" in2="SourceGraphic"/>
                       </filter>
                     </defs>
                     <path d="M50 0 L90 50 L50 100 L10 50 Z" fill="url(#plumbob-grad)" filter="url(#inner-shadow)" />
                     <path d="M50 160 L90 110 L50 60 L10 110 Z" fill="url(#plumbob-grad)" filter="url(#inner-shadow)" opacity="0.8" />
                   </svg>
                   <div id="gps-arrow" class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-b-[6px] border-b-white/80 transition-transform duration-300"></div>
                 </div>
                 
                 <!-- Pulse -->
                 <div class="absolute inset-0 bg-blue-400 rounded-full animate-ping opacity-10 scale-50"></div>
               </div>`,
        iconSize: [32, 40],
        iconAnchor: [16, 20]
      });
      markerRef.current = L.marker(latLng, { icon, zIndexOffset: 1000 }).addTo(map);
      trailRef.current = L.polyline([], { color: '#3b82f6', weight: 3, opacity: 0.6 }).addTo(map);
    } else {
      markerRef.current.setLatLng(latLng);
    }

    // Rotate arrow
    const arrow = document.getElementById('gps-arrow');
    if (arrow && heading !== null) {
      arrow.style.transform = `rotate(${heading}deg)`;
    }

    // Update trail
    path.current.push(latLng);
    if (path.current.length > 500) path.current.shift();
    trailRef.current?.setLatLngs(path.current);

    // Track
    if (isTracking) {
      map.setView(latLng, map.getZoom(), { animate: true, duration: 1 });
    }
  }, [position, heading, isTracking, map]);

  return null;
};

const ContextActions: React.FC = () => {
  const map = useMap();
  const { setPendingContextMenu, activeTool } = useConfigStore();

  useEffect(() => {
    const handleContextMenu = (e: L.LeafletMouseEvent) => {
      if (activeTool) return;
      // Trigger the floating context popup
      setPendingContextMenu({ 
        lat: e.latlng.lat, 
        lng: e.latlng.lng, 
        x: e.originalEvent.clientX, 
        y: e.originalEvent.clientY 
      });
      // Optionally provide feedback
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(40);
      L.DomEvent.preventDefault(e.originalEvent);
    };

    map.on('contextmenu', handleContextMenu);
    return () => {
      map.off('contextmenu', handleContextMenu);
    };
  }, [map, setPendingContextMenu, activeTool]);

  useEffect(() => {
    const handleClick = () => {
        window.dispatchEvent(new CustomEvent('map-set-target', { detail: null }));
        setPendingContextMenu(null);
    };
    map.on('click', handleClick);
    return () => { map.off('click', handleClick); };
  }, [map, setPendingContextMenu]);

  return null;
};

const RotationHandler: React.FC = () => {
  const map = useMap();
  const { mapRotation, setMapRotation, setMapRotationLocked, compassLocked } = useConfigStore();
  const startRotation = useRef(0);
  const startAngle = useRef(0);
  const startDist = useRef(0);
  const isRotating = useRef(false);
  const isZooming = useRef(false);

  useEffect(() => {
    const container = map.getContainer();

    const getMetrics = (touches: TouchList) => {
      const p1 = touches[0];
      const p2 = touches[1];
      const dy = p2.clientY - p1.clientY;
      const dx = p2.clientX - p1.clientX;
      return {
        angle: Math.atan2(dy, dx) * 180 / Math.PI,
        dist: Math.sqrt(dx * dx + dy * dy)
      };
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (compassLocked) return;
      if (e.touches.length === 2) {
        const metrics = getMetrics(e.touches);
        startAngle.current = metrics.angle;
        startDist.current = metrics.dist;
        startRotation.current = mapRotation;
        
        isRotating.current = false;
        isZooming.current = false;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (compassLocked) return;
      if (e.touches.length === 2) {
        const metrics = getMetrics(e.touches);
        
        if (!isRotating.current && !isZooming.current) {
          const angleDelta = Math.abs(metrics.angle - startAngle.current);
          const distDelta = Math.abs(metrics.dist - startDist.current);
          
          // Identify Intent: Twist vs Pinch
          if (angleDelta > 8) { // Twist detected first
            isRotating.current = true;
            map.touchZoom.disable();
            map.dragging.disable();
            container.classList.add('is-active-rotating');
            setMapRotationLocked(false);
          } else if (distDelta > 25) { // Spread detected first
            isZooming.current = true;
          }
        }

        if (isRotating.current) {
          const delta = metrics.angle - startAngle.current;
          setMapRotation(startRotation.current + delta);
          e.preventDefault();
        }
      }
    };

    const handleTouchEnd = () => {
      if (isRotating.current || isZooming.current) {
        isRotating.current = false;
        isZooming.current = false;
        container.classList.remove('is-active-rotating');
        
        map.touchZoom.enable();
        map.dragging.enable();
      }
    };

    container.addEventListener('touchstart', handleTouchStart);
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [map, mapRotation, setMapRotation, setMapRotationLocked, compassLocked]);

  useEffect(() => {
    // Apply rotation variable to document for CSS engine
    document.documentElement.style.setProperty('--map-rotation', `${mapRotation}deg`);
    
    // Ensure Leaflet keeps size accurate during orientation shifts
    map.invalidateSize({ animate: false });
  }, [map, mapRotation]);

  return null;
};

const TacticalPanningHandler: React.FC = () => {
  const map = useMap();
  const { mapRotation } = useConfigStore();
  const isPanning = useRef(false);
  const lastPoint = useRef<L.Point | null>(null);
  const rafId = useRef<number | null>(null);

  useEffect(() => {
    const container = map.getContainer();

    const handleStart = (e: TouchEvent | MouseEvent) => {
      // Only 1 finger for panning to avoid conflict with rotation
      if (e instanceof TouchEvent && e.touches.length !== 1) return;
      
      const point = e instanceof TouchEvent ? L.point(e.touches[0].clientX, e.touches[0].clientY) : L.point(e.clientX, e.clientY);
      lastPoint.current = point;
      isPanning.current = true;
      
      // We manually override dragging when rotated
      if (mapRotation !== 0) {
        map.dragging.disable();
      } else {
        map.dragging.enable();
      }
    };

    const handleMove = (e: TouchEvent | MouseEvent) => {
      if (!isPanning.current || !lastPoint.current) return;
      if (e instanceof TouchEvent && e.touches.length !== 1) return;
      if (mapRotation === 0) return; // Let native dragging handle it

      const currentPoint = e instanceof TouchEvent ? L.point(e.touches[0].clientX, e.touches[0].clientY) : L.point(e.clientX, e.clientY);
      
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
      }

      rafId.current = requestAnimationFrame(() => {
        if (!isPanning.current || !lastPoint.current) return;

        const deltaX = currentPoint.x - lastPoint.current.x;
        const deltaY = currentPoint.y - lastPoint.current.y;

        // ROTATION MATRIX: Convert Screen Delta to Map Delta
        const angleRad = (mapRotation * Math.PI) / 180;
        const rotatedDeltaX = deltaX * Math.cos(angleRad) + deltaY * Math.sin(angleRad);
        const rotatedDeltaY = -deltaX * Math.sin(angleRad) + deltaY * Math.cos(angleRad);

        const centerPoint = map.project(map.getCenter(), map.getZoom());
        const newCenter = map.unproject(
          L.point(centerPoint.x - rotatedDeltaX, centerPoint.y - rotatedDeltaY),
          map.getZoom()
        );

        map.setView(newCenter, map.getZoom(), { animate: false });
        lastPoint.current = currentPoint;
        rafId.current = null;
      });
      
      if (e.cancelable) e.preventDefault();
    };

    const handleEnd = () => {
      isPanning.current = false;
      lastPoint.current = null;
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
      map.dragging.enable(); // Always restore
    };

    container.addEventListener('mousedown', handleStart);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);

    container.addEventListener('touchstart', handleStart);
    container.addEventListener('touchmove', handleMove, { passive: false });
    container.addEventListener('touchend', handleEnd);

    return () => {
      container.removeEventListener('mousedown', handleStart);
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      
      container.removeEventListener('touchstart', handleStart);
      container.removeEventListener('touchmove', handleMove);
      container.removeEventListener('touchend', handleEnd);
    };
  }, [map, mapRotation]);

  return null;
};

const RefreshListener: React.FC = () => {
  const map = useMap();
  useEffect(() => {
    const handleRefresh = () => {
      map.eachLayer((layer) => {
        if (layer instanceof L.TileLayer) {
          layer.redraw();
        }
      });
    };
    window.addEventListener('map-refresh', handleRefresh);
    return () => window.removeEventListener('map-refresh', handleRefresh);
  }, [map]);
  return null;
};

const PersistenceHandler: React.FC = () => {
  const map = useMap();

  useEffect(() => {
    const handleMoveEnd = () => {
      const center = map.getCenter();
      const zoom = map.getZoom();
      localStorage.setItem('vian-maps-last-view', JSON.stringify({
        lat: center.lat,
        lng: center.lng,
        zoom: zoom
      }));
    };

    map.on('moveend', handleMoveEnd);
    return () => {
      map.off('moveend', handleMoveEnd);
    };
  }, [map]);

  return null;
};

const MapComponent: React.FC = () => {
  const activeTool = useConfigStore(s => s.activeTool);
  const isEraser = activeTool === 'eraser';

  const [initialView] = useState(() => {
    const saved = localStorage.getItem('vian-maps-last-view');
    if (saved) {
      try {
        const { lat, lng, zoom } = JSON.parse(saved);
        return { center: [lat, lng] as [number, number], zoom };
      } catch (e) {
        console.error('Failed to parse saved view', e);
      }
    }
    return { center: [51.505, -0.09] as [number, number], zoom: 13 };
  });

  return (
    <div className={`tactical-map-viewport bg-zinc-100 dark:bg-zinc-950 ${isEraser ? 'eraser-mode-active' : ''}`}>
      <MapContainer
        center={initialView.center}
        zoom={initialView.zoom}
        zoomControl={false}
        className="tactical-rotated-container"
        attributionControl={true}
        preferCanvas={true}
        worldCopyJump={true}
        zoomSnap={0.5}
        zoomDelta={0.5}
        wheelDebounceTime={100}
        fadeAnimation={false}
        zoomAnimation={false}
        markerZoomAnimation={false}
      >
        <MapInstanceCapture />
        <RefreshListener />
        <LayerManager />
        <GPSMarker />
        <ContextActions />
        <PersistenceHandler />
        <RotationHandler />
        <TacticalPanningHandler />
        <VianVectorRoads />
        <TagOverlay />
        <MapNavigationOverlay />
        <CacheDensityOverlay />
        <SignalRadar isActive={activeTool === 'radar'} />
        <MeasurementTool isActive={activeTool === 'measure'} />
        <ImageMapTool isActive={activeTool === 'imagemap'} />
        <EraserTool isActive={activeTool === 'eraser'} />
        <DepthMapTool isActive={activeTool === 'depth'} />
        <ThreeDMapTool isActive={activeTool === '3d'} />
        <WikiTool isActive={activeTool === 'wiki'} />
        <CustomMapTool isActive={activeTool === 'custommap'} />
        <NavigationTool isActive={true} />
        <IntelOverlay />
      </MapContainer>
    </div>
  );
};


export default MapComponent;
