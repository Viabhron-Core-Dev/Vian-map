import React, { useState, useEffect } from 'react';
import MapComponent from './components/MapComponent';
import MapWidget from './components/MapWidget';
import Panel from './components/UI/Panel';
import { Layers, Navigation, Bookmark, Wrench, Settings, Search, Map as MapIcon, Signal, SignalLow, Route, Zap, Menu, X, Download, Eraser, Hash, Circle, Plus, Minus, Cloud, CloudOff, Wifi, WifiOff, Locate, LocateFixed, LocateOff, Trash2, RefreshCw, Activity, Share2, ChevronUp, ChevronDown, Radio, Database, Box, BookOpen, Image as ImageIcon } from 'lucide-react';
import { App as CapApp } from '@capacitor/app';
import { Toast } from '@capacitor/toast';
import { useConfigStore, useGPSStore, useMapStore } from './lib/store';
import { MAP_LAYERS, OfflineTileLayer } from './lib/OfflineLayer';
import { toDMS, getMapScaleLabel, getMetersPerPixel } from './lib/utils';

import BookmarkManager from './components/BookmarkManager';
import SettingsPanel from './components/SettingsPanel';
import SensorDashboard from './components/SensorDashboard';
import NetworkTester from './components/NetworkTester';
import { LaneAssistantTool } from './components/LaneAssistantTool';
import { GPSMetricsRow } from './components/GPSMetricsRow';
import { CompassButton } from './components/CompassButton';
import { MapLayersPanel } from './components/MapLayersPanel';
import { NavigationMenu } from './components/NavigationMenu';

import { motion, AnimatePresence } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { db } from './lib/db';
import { appLogger } from './lib/logger';

import { Geolocation } from '@capacitor/geolocation';

const App: React.FC = () => {
  const [activePanel, setActivePanel] = useState<string | null>(null);
  const { 
    activeLayerId, 
    setActiveLayer, 
    isOnline, 
    setOnline,
    isGPSEngineActive,
    setGPSEngine,
    isSensorsActive,
    setSensors,
    activeTagFilters,
    setTagFilters,
    theme,
    eraserMode,
    setEraserMode,
    pendingBookmark,
    pendingContextMenu,
    setPendingContextMenu,
    setPendingBookmark,
    activeTool,
    setActiveTool,
    positionMode,
    setPositionMode,
    selectedTiles,
    setSelectedTiles,
    performanceMode,
    setPerformanceMode,
    deepDelete,
    setDeepDelete,
    isHudFolded,
    setHudFolded,
    networkProvider
  } = useConfigStore(useShallow(state => ({
    activeLayerId: state.activeLayerId,
    setActiveLayer: state.setActiveLayer,
    isOnline: state.isOnline,
    setOnline: state.setOnline,
    isGPSEngineActive: state.isGPSEngineActive,
    setGPSEngine: state.setGPSEngine,
    isSensorsActive: state.isSensorsActive,
    setSensors: state.setSensors,
    activeTagFilters: state.activeTagFilters,
    setTagFilters: state.setTagFilters,
    theme: state.theme,
    eraserMode: state.eraserMode,
    setEraserMode: state.setEraserMode,
    pendingBookmark: state.pendingBookmark,
    pendingContextMenu: state.pendingContextMenu,
    setPendingContextMenu: state.setPendingContextMenu,
    setPendingBookmark: state.setPendingBookmark,
    activeTool: state.activeTool,
    setActiveTool: state.setActiveTool,
    positionMode: state.positionMode,
    setPositionMode: state.setPositionMode,
    selectedTiles: state.selectedTiles,
    setSelectedTiles: state.setSelectedTiles,
    performanceMode: state.performanceMode,
    setPerformanceMode: state.setPerformanceMode,
    deepDelete: state.deepDelete,
    setDeepDelete: state.setDeepDelete,
    isHudFolded: state.isHudFolded,
    setHudFolded: state.setHudFolded,
    networkProvider: state.networkProvider
  })));
  const { isTracking, setTracking, position } = useGPSStore(useShallow(state => ({
    isTracking: state.isTracking,
    setTracking: state.setTracking,
    position: state.position
  })));
  const map = useMapStore(s => s.map);
  const [currentZoom, setCurrentZoom] = useState(13);
  const [center, setCenter] = useState<{lat: number, lng: number}>({ lat: 0, lng: 0 });
  const [tileCount, setTileCount] = useState<number>(0);
  const [coordMode, setCoordMode] = useState<'dms' | 'decimal'>('dms');
  const [showCopied, setShowCopied] = useState(false);
  const [showRefreshPulse, setShowRefreshPulse] = useState(false);
  const [isSensorDashboardOpen, setSensorDashboardOpen] = useState(false);

  useEffect(() => {
    const handleToolsClose = (e: any) => {
      if (activeTool === e.detail) {
        setActiveTool(null);
      }
    };
    window.addEventListener('tools-close', handleToolsClose);
    return () => window.removeEventListener('tools-close', handleToolsClose);
  }, [activeTool, setActiveTool]);

  useEffect(() => {
    appLogger.info('App', 'Vian Maps Platform started');
    
    let lastBackPress = 0;
    const backButtonListener = CapApp.addListener('backButton', async (data) => {
      if (activePanel) {
        setActivePanel(null);
        return;
      }

      if (activeTool) {
        setActiveTool(null);
        return;
      }

      const currentTime = new Date().getTime();
      if (currentTime - lastBackPress < 2000) {
        CapApp.exitApp();
      } else {
        lastBackPress = currentTime;
        await Toast.show({
          text: 'Press back again to exit',
          duration: 'short'
        });
      }
    });

    return () => {
      backButtonListener.then(l => l.remove());
    };
  }, [activePanel, activeTool]);

  useEffect(() => {
    // Handle Shared Coordinates (PWA Deep Linking)
    const params = new URLSearchParams(window.location.search);
    const lat = parseFloat(params.get('lat') || '');
    const lng = parseFloat(params.get('lng') || '');
    const zoom = parseInt(params.get('z') || '15', 10);

    if (!isNaN(lat) && !isNaN(lng) && map) {
      map.setView([lat, lng], zoom);
    }

    // Handle Native Deep Linking
    const handleAppUrlOpen = (data: any) => {
      try {
        const url = new URL(data.url);
        const params = url.searchParams;
        
        if (params.get('widget') === 'true') {
          // Opened from homescreen widget
          setPerformanceMode('low'); // Example: optimize for quick view
        }

        const lat = parseFloat(params.get('lat') || '');
        const lng = parseFloat(params.get('lng') || '');
        const zoom = parseInt(params.get('z') || '15', 10);

        if (!isNaN(lat) && !isNaN(lng) && map) {
          map.setView([lat, lng], zoom);
        }
      } catch (e) {
        console.error('Deep link failed:', e);
      }
    };

    CapApp.addListener('appUrlOpen', handleAppUrlOpen);
    return () => { CapApp.removeAllListeners(); };
  }, [map]);

  useEffect(() => {
    const updateTileCount = async () => {
      try {
        const count = await db.tiles.count();
        setTileCount(count);
      } catch (err) {
        console.error('Failed to update tile count:', err);
      }
    };
    
    updateTileCount();
    const interval = setInterval(updateTileCount, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!isOnline) return;
    
    const performLiveSync = async () => {
      // Live Sync logic placeholder
      try {
        // This is where remote synchronization with a backend would occur
        // e.g. checking for new mission data or syncing mission reports
      } catch (err) {
        console.error('Live Sync Error:', err);
      }
    };

    const interval = setInterval(performLiveSync, 60000); // 1 minute interval
    performLiveSync();
    
    return () => clearInterval(interval);
  }, [isOnline]);

  const handleManualRefresh = () => {
    setShowRefreshPulse(true);
    window.dispatchEvent(new CustomEvent('map-manual-refresh'));
    setTimeout(() => setShowRefreshPulse(false), 1000);
  };

  const shareCoords = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set('lat', center.lat.toFixed(6));
    url.searchParams.set('lng', center.lng.toFixed(6));
    url.searchParams.set('z', map?.getZoom().toString() || '15');

    const shareData = {
      title: 'Vian Maps Location',
      text: `Tactical Coordinates: ${center.lat.toFixed(6)}, ${center.lng.toFixed(6)}`,
      url: url.toString()
    };

    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(url.toString());
        setShowCopied(true);
        setTimeout(() => setShowCopied(false), 2000);
      }
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(30);
    } catch (err) {
      console.log('Share failed:', err);
    }
  };

  const toggleGPSMode = () => {
    if (!isTracking) {
      setTracking(true);
      setPositionMode('gps');
    } else if (positionMode === 'gps') {
      setPositionMode('location');
    } else {
      setTracking(false);
    }
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50);
  };
  const isEraserActive = activeTool === 'eraser';
  const isMeasureActive = activeTool === 'measure';
  const isAnyToolActive = activeTool !== null;

  useEffect(() => {
    if (performanceMode === 'low') {
      document.documentElement.classList.add('performance-low');
    } else {
      document.documentElement.classList.remove('performance-low');
    }
  }, [performanceMode]);

  // Use this to get distance if needed
  const [measureDistance, setMeasureDistance] = useState(0);

  useEffect(() => {
    // Listen for custom event from MeasurementTool if we want to show it in HUD
    const handleDist = (e: any) => setMeasureDistance(e.detail);
    window.addEventListener('measure-update', handleDist);
    return () => window.removeEventListener('measure-update', handleDist);
  }, []);

  useEffect(() => {
    if (pendingBookmark) {
      setActivePanel('bookmarks');
    }
  }, [pendingBookmark]);

  useEffect(() => {
    if (!map) return;
    setCurrentZoom(map.getZoom());
    const onZoom = () => setCurrentZoom(map.getZoom());
    map.on('zoomend', onZoom);
    return () => { map.off('zoomend', onZoom); };
  }, [map]);

  useEffect(() => {
    if (!map) return;
    const onMoveEnd = () => {
      const c = map.getCenter();
      setCenter({ lat: c.lat, lng: c.lng });
    };
    map.on('moveend', onMoveEnd);
    onMoveEnd(); // Initial sync
    return () => { map.off('moveend', onMoveEnd); };
  }, [map]);

  useEffect(() => {
    let watchId: string | null = null;
    
    const startWatching = async () => {
      if (isTracking && isGPSEngineActive) {
        try {
          watchId = await Geolocation.watchPosition(
            { 
              enableHighAccuracy: positionMode === 'gps',
              timeout: positionMode === 'gps' ? 10000 : 5000,
              maximumAge: positionMode === 'gps' ? 0 : 5000
            },
            (pos) => {
              if (pos) {
                useGPSStore.getState().setPosition([pos.coords.latitude, pos.coords.longitude]);
                useGPSStore.getState().setMetrics({
                  accuracy: pos.coords.accuracy,
                  speed: pos.coords.speed || 0,
                  heading: pos.coords.heading || 0,
                  altitude: pos.coords.altitude || 0,
                });
              }
            }
          );
        } catch (err) {
          console.error('Geolocation error:', err);
        }
      }
    };

    startWatching();

    return () => {
      if (watchId !== null) {
        Geolocation.clearWatch({ id: watchId });
      }
    };
  }, [isTracking, isGPSEngineActive, positionMode]);

  const mpp = getMetersPerPixel(position?.[0], currentZoom);
  const scaleWidth = Math.min(100, 200 / mpp); // Aim for 200m representation, capped at 100% width
  const scaleLabel = mpp > 0 ? "200m" : "--";

  const isWidgetView = new URLSearchParams(window.location.search).get('widget') === 'true';
  if (isWidgetView) {
    return <MapWidget />;
  }

  return (
    <div className="relative w-full h-screen overflow-hidden select-none bg-zinc-100 dark:bg-zinc-950">
      {/* Main Map Background - Lowest Level */}
      <div className={`absolute inset-0 z-0 ${activeTool === '3d' ? 'invisible pointer-events-none' : 'visible'}`}>
        <MapComponent />
      </div>

      {pendingContextMenu && (
        <div 
          className="absolute z-[3000] bg-zinc-900 border border-zinc-700/50 rounded-xl shadow-2xl flex items-center p-1 gap-1"
          style={{ left: Math.min(pendingContextMenu.x, window.innerWidth - 120), top: Math.min(pendingContextMenu.y, window.innerHeight - 60) }}
        >
          <button 
            onClick={() => {
              setPendingBookmark({ lat: pendingContextMenu.lat, lng: pendingContextMenu.lng });
              setActivePanel('bookmarks');
              setPendingContextMenu(null);
            }}
            className="flex flex-col items-center gap-1 p-3 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-300"
          >
            <MapIcon className="w-5 h-5 text-blue-400" />
            <span className="text-[9px] font-bold uppercase tracking-wider">Waypoint</span>
          </button>
          
          <button 
            onClick={() => {
              setActivePanel('bookmarks');
              setTimeout(() => {
                window.dispatchEvent(new CustomEvent('open-note-modal', { detail: { lat: pendingContextMenu.lat, lng: pendingContextMenu.lng } }));
              }, 100);
              setPendingContextMenu(null);
            }}
            className="flex flex-col items-center gap-1 p-3 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-300"
          >
            <Bookmark className="w-5 h-5 text-amber-400" />
            <span className="text-[9px] font-bold uppercase tracking-wider">Note</span>
          </button>
        </div>
      )}

      {/* Global Scrim for Outside Tap Detection - Above Map, Below UI */}
      <AnimatePresence>
        {activePanel && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActivePanel(null)}
            className="absolute inset-0 z-[2500] bg-black/5 backdrop-blur-[2px] pointer-events-auto"
          />
        )}
      </AnimatePresence>

      {/* HUD Top Bar - Floating Intelligence Stack */}
      <AnimatePresence>
        {activeTool !== 'lane' && activeTool !== '3d' && activeTool !== 'depth' && (
          <motion.div 
            initial={{ opacity: 0, x: -20, y: -20 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, x: -20, y: -20 }}
            className="absolute top-4 left-4 z-[3000] flex flex-col gap-1.5 items-start pointer-events-none"
          >
          {/* Primary Position Header */}
          {!isMeasureActive && !isEraserActive && (
            <div className="flex items-center gap-1.5 pointer-events-auto">
                  <div className="flex flex-col gap-1.5">
                    <button 
                      onClick={() => {
                        if (!isTracking) {
                          setTracking(true);
                          setGPSEngine(true);
                        }
                        setCoordMode(coordMode === 'dms' ? 'decimal' : 'dms');
                        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50);
                      }}
                      className={`white-glass px-3 py-1.5 rounded-lg flex items-center gap-3 active:scale-95 transition-transform ${!position ? 'animate-pulse opacity-80' : ''}`}
                    >
                      {/* Storage Pill Integration */}
                      <div className="flex items-center gap-1 px-1.5 py-0.5 bg-zinc-900/10 dark:bg-zinc-100/10 rounded-full border border-zinc-900/5 dark:border-zinc-100/10 shadow-sm" id="storage-pill">
                        <Database className="w-3 h-3 text-blue-500" strokeWidth={3} />
                        <span className="text-[9px] font-black tabular-nums text-zinc-500 uppercase tracking-tighter">
                          {tileCount.toLocaleString()} TILES
                        </span>
                      </div>

                       <div className="flex flex-col">
                          <div className={`text-[11px] font-black tactical-font transition-colors ${position ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-400 dark:text-zinc-500'}`}>
                            {position ? (
                              coordMode === 'dms' 
                              ? `${toDMS(position[0], true)} ${toDMS(position[1], false)}`
                              : `${position[0].toFixed(6)}° N ${position[1].toFixed(6)}° E`
                            ) : 'SIGNAL TRAPPED'}
                          </div>
                       </div>
                    </button>
                  </div>
              </div>
            )}

            {isMeasureActive && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                onDoubleClick={(e) => e.stopPropagation()}
                className="white-glass px-4 py-2 rounded-xl flex items-center gap-4 shadow-2xl border border-white/40 pointer-events-auto"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center shadow-lg ring-2 ring-white/20">
                    <Route className="w-5 h-5 text-zinc-950" strokeWidth={3} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[8px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-tighter leading-none">Trace Mode Active</span>
                    <span className="text-sm font-black text-zinc-900 dark:text-zinc-100 tactical-font leading-tight">
                      {measureDistance > 1000 ? (measureDistance/1000).toFixed(3) + ' km' : Math.round(measureDistance) + ' m'}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center gap-1.5 border-l border-zinc-200 dark:border-zinc-800 pl-3">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      window.dispatchEvent(new CustomEvent('measure-clear'));
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    title="Clear measurement"
                    className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors text-zinc-500 dark:text-zinc-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      window.dispatchEvent(new CustomEvent('measure-save'));
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    title="Save as route"
                    className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors text-zinc-500 dark:text-zinc-400"
                  >
                    <Bookmark className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveTool(null);
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    title="Close tool"
                    className="p-1.5 text-white active:scale-125 transition-all outline-none"
                  >
                     <X className="w-8 h-8 drop-shadow-lg" strokeWidth={3} />
                  </button>
                </div>
              </motion.div>
            )}

            {isEraserActive && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                className="white-glass px-4 py-2 rounded-xl flex items-center gap-4 shadow-2xl border border-red-500/40 pointer-events-auto"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-colors ring-2 ring-white/20 ${selectedTiles.length > 0 ? 'bg-red-600' : 'bg-red-600/60'}`}>
                    <Eraser className="w-5 h-5 text-white" strokeWidth={3} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[8px] font-black text-red-600 dark:text-red-400 uppercase tracking-tighter leading-none">Purge Selection</span>
                    <span className="text-xs font-black text-zinc-900 dark:text-zinc-100 tactical-font leading-tight">
                      {selectedTiles.length > 0 ? `${selectedTiles.length} TILES MARKED` : 'TAP TO CHOOSE TILES'}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center gap-1.5 border-l border-zinc-200 dark:border-zinc-800 pl-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeepDelete(!deepDelete);
                      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(30);
                    }}
                    className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase transition-all border ${
                      deepDelete 
                      ? 'bg-red-600/20 border-red-500/50 text-red-500' 
                      : 'bg-zinc-800/40 border-zinc-700 text-zinc-500'
                    }`}
                  >
                    DEEP
                  </button>
                  {selectedTiles.length > 0 && (
                    <button 
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([40, 40]);
                        
                        const layerDef = MAP_LAYERS[activeLayerId];
                        const tempLayer = new OfflineTileLayer(layerDef.url, layerDef.id);

                        if (deepDelete) {
                          // Recursive Purge
                          for (const t of selectedTiles) {
                            const [z, x, y] = t.split('-').map(Number);
                            await tempLayer.deleteTileFamily(z, x, y);
                          }
                        } else {
                          // Simple Purge
                          const prefix = activeLayerId + '/';
                          const keys = selectedTiles.map(t => {
                            const [z, x, y] = t.split('-');
                            return `${prefix}${z}/${x}/${y}`;
                          });
                          await db.tiles.bulkDelete(keys);
                        }
                        
                        setSelectedTiles([]);
                        window.dispatchEvent(new CustomEvent('map-refresh'));
                        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([100, 50, 100]);
                      }}
                      className="bg-red-600 text-white px-3 py-1 rounded-lg text-[10px] font-black uppercase hover:bg-red-700 transition-colors shadow-lg active:scale-95"
                    >
                      PURGE DATA
                    </button>
                  )}
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveTool(null);
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    title="Close tool"
                    className="p-1.5 text-white active:scale-125 transition-all outline-none"
                  >
                     <X className="w-8 h-8 drop-shadow-lg" strokeWidth={3} />
                  </button>
                </div>
              </motion.div>
            )}

            {/* Scale & Mission Detail Overlay */}
            {!isMeasureActive && !isEraserActive && (
              <div className="white-glass px-3 py-2 rounded-lg flex flex-col pointer-events-auto w-fit min-w-[170px] transition-all duration-300 overflow-hidden">
               {/* Center HUD */}
               <div className="flex items-center justify-between gap-3 pb-1.5 border-b border-zinc-100 dark:border-zinc-800">
                  <div className="flex flex-col gap-0.5 cursor-pointer" onClick={() => setCoordMode(coordMode === 'dms' ? 'decimal' : 'dms')}>
                    <span className="text-[7px] font-black text-zinc-400 uppercase tracking-widest">Map Center</span>
                    <div className="flex items-center gap-1.5 mb-1 bg-zinc-900/5 dark:bg-zinc-100/5 px-1 py-0.5 rounded-sm">
                      <Radio className="w-2.5 h-2.5 text-blue-500" />
                      <span className="text-[7px] font-black text-zinc-600 dark:text-zinc-400 uppercase tracking-tighter truncate max-w-[80px]">{networkProvider}</span>
                      <div className={`w-1 h-1 rounded-full ${isOnline ? 'bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.5)]' : 'bg-red-500 animate-pulse'}`} />
                    </div>
                    <span className="text-[10px] font-mono font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">
                      {coordMode === 'dms' 
                        ? `${toDMS(center.lat, true)} ${toDMS(center.lng, false)}` 
                        : `${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {!isOnline && (
                      <div className="p-1 text-red-500 animate-pulse bg-red-500/10 rounded" title="NO NETWORK SIGNAL">
                        <SignalLow className="w-3.5 h-3.5" strokeWidth={3} />
                      </div>
                    )}
                    <button 
                      onClick={() => setHudFolded(!isHudFolded)}
                      className="p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                    >
                      {isHudFolded ? <ChevronDown className="w-3.5 h-3.5" strokeWidth={3} /> : <ChevronUp className="w-3.5 h-3.5" strokeWidth={3} />}
                    </button>
                    <button 
                      onClick={shareCoords}
                      className="p-1 text-zinc-400 hover:text-blue-500 transition-colors"
                      title="Share Center"
                    >
                      <Share2 className="w-3 h-3" strokeWidth={3} />
                    </button>
                  </div>
               </div>

               <div className="flex items-center justify-between gap-4 pt-1.5 pb-1.5">
                  <button 
                    onClick={() => setActivePanel('layers')}
                    className="flex items-center gap-1.5 hover:opacity-70 transition-opacity"
                  >
                    <MapIcon className="w-4 h-4 text-zinc-900 dark:text-zinc-100" strokeWidth={2.5} />
                    <span className="text-[10px] font-black tactical-font text-zinc-900 dark:text-zinc-100 uppercase">
                      {getMapScaleLabel(currentZoom)}
                    </span>
                  </button>
                  <div className="text-[10px] font-bold tactical-font text-zinc-500">
                    {Math.round(currentZoom)}/20
                  </div>
               </div>
               
               <div className="flex flex-col gap-1 mb-2">
                  <div className="h-[2px] bg-zinc-200 dark:bg-zinc-800 w-full relative">
                    <div 
                      className="h-full bg-zinc-900 dark:bg-zinc-100 relative scale-line transition-all duration-300"
                      style={{ width: `${scaleWidth}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[7px] font-black text-zinc-400">
                     <span>0m</span>
                     <span>{scaleLabel}</span>
                  </div>
               </div>

               {/* Telemetry Row - Foldable */}
               {!isHudFolded && (
                 <motion.div 
                   initial={{ height: 0, opacity: 0 }}
                   animate={{ height: 'auto', opacity: 1 }}
                   exit={{ height: 0, opacity: 0 }}
                   className="flex flex-col gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800"
                 >
                   <GPSMetricsRow />
                   
                   {!isOnline && (
                     <div className="flex items-center gap-2 px-2 py-1 bg-red-500/10 rounded-md border border-red-500/20">
                        <Signal className="w-3 h-3 text-red-500 animate-pulse" />
                        <span className="text-[8px] font-black text-red-600 uppercase tracking-widest">Signal Lost / Offline</span>
                     </div>
                   )}
                 </motion.div>
               )}
            </div>
          )}
          </motion.div>
        )}
      </AnimatePresence>

      {activeTool === 'lane' && (
        <LaneAssistantTool onClose={() => setActiveTool(null)} />
      )}



      {/* Global Scrim for Outside Tap Detection */}
      <AnimatePresence>
        {activePanel && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActivePanel(null)}
            className="absolute inset-0 z-[1500] pointer-events-auto"
          />
        )}
      </AnimatePresence>

      {/* Tool Quick Exit Button - Only visible in other tool modes if any */}
      <AnimatePresence>
        {isAnyToolActive && !isMeasureActive && !isEraserActive && activeTool !== 'lane' && activeTool !== '3d' && activeTool !== 'depth' && activeTool !== 'wiki' && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="absolute top-4 right-6 z-[3000] pointer-events-none"
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                setActiveTool(null);
              }}
              onMouseDown={(e) => e.stopPropagation()}
              className={`w-12 h-12 text-white rounded-full flex items-center justify-center shadow-2xl border-2 border-white/20 transition-colors pointer-events-auto ${
                isEraserActive ? 'bg-red-600 active:bg-red-700' : 'bg-amber-500 active:bg-amber-600'
              }`}
            >
              <X className="w-6 h-6" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Vertical Tactical Stack - Right Side Column */}
      {activeTool !== 'lane' && activeTool !== '3d' && (
        <div className="absolute right-4 bottom-8 z-[3000] flex flex-col gap-3 items-center pointer-events-none">
         {/* Sensor Intelligence */}
         <button 
           onClick={() => setSensorDashboardOpen(!isSensorDashboardOpen)}
           className={`p-2 rounded-lg backdrop-blur-md border transition-all active:scale-90 pointer-events-auto shadow-xl ${
             isSensorDashboardOpen 
             ? 'bg-blue-600 border-blue-400 text-white' 
             : 'bg-zinc-800/80 border-zinc-700 text-zinc-400 hover:text-white'
           }`}
           title="Sensor Intel"
         >
           <Activity className="w-5 h-5" strokeWidth={3} />
         </button>

         {/* Manual Refresh */}
         <button 
           onClick={handleManualRefresh}
           className={`p-2 rounded-lg backdrop-blur-md border transition-all active:scale-90 pointer-events-auto shadow-xl ${
             showRefreshPulse 
             ? 'bg-blue-600 border-blue-400 text-white animate-pulse' 
             : 'bg-zinc-800/80 border-zinc-700 text-zinc-400 hover:text-white'
           }`}
           title="Refresh Scan"
         >
           <RefreshCw className={`w-5 h-5 ${showRefreshPulse ? 'animate-spin' : ''}`} strokeWidth={3} />
         </button>

         {/* Network Toggle */}
         <button 
           onClick={() => setOnline(!isOnline)}
           className={`p-2 rounded-lg backdrop-blur-md border transition-all active:scale-90 pointer-events-auto shadow-xl ${
             isOnline 
             ? 'bg-green-600/20 border-green-500/50 text-green-500' 
             : 'bg-zinc-800/80 border-zinc-700 text-zinc-500'
           }`}
           title={isOnline ? "Network: ACTIVE" : "Network: STEALTH"}
         >
           {isOnline ? <Wifi className="w-5 h-5" strokeWidth={3} /> : <WifiOff className="w-5 h-5" strokeWidth={3} />}
         </button>

         {/* GPS Mode Cycle */}
         <button 
           onClick={toggleGPSMode}
           className={`p-2 rounded-lg backdrop-blur-md border transition-all active:scale-90 pointer-events-auto shadow-xl ${
             !isTracking 
             ? 'bg-zinc-800/80 border-zinc-700 text-zinc-500' 
             : positionMode === 'gps'
             ? 'bg-blue-600 border-white/20 text-white animate-pulse'
             : 'bg-amber-600/20 border-amber-500/50 text-amber-500'
           }`}
           title={`Positioning: ${!isTracking ? 'OFF' : positionMode.toUpperCase()}`}
         >
           <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" className="mx-auto">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="3" fill={isTracking ? 'currentColor' : 'none'} />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              {!isTracking && <line x1="1" y1="1" x2="23" y2="23" opacity="0.8" />}
            </svg>
         </button>

         {/* Zoom Pack - White Style */}
         <div className="flex flex-col gap-2 mt-2">
           <button 
             onClick={() => map?.zoomIn()}
             className="p-1 px-2 text-white drop-shadow-lg active:scale-125 transition-all pointer-events-auto"
           >
             <Plus className="w-8 h-8" strokeWidth={4} />
           </button>
           <button 
             onClick={() => map?.zoomOut()}
             className="p-1 px-2 text-white drop-shadow-lg active:scale-125 transition-all pointer-events-auto"
           >
             <Minus className="w-8 h-8" strokeWidth={4} />
           </button>
         </div>
      </div>

      )}

      <SensorDashboard isOpen={isSensorDashboardOpen} onClose={() => setSensorDashboardOpen(false)} />

      <NetworkTester 
        isActive={activeTool === 'network'} 
        onClose={() => setActiveTool(null)} 
      />

      {/* Primary Navigation Console - Left Aligned */}
      <AnimatePresence>
        {!isAnyToolActive && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="absolute left-2 bottom-8 z-[3000] pointer-events-none flex flex-col items-start gap-3"
          >

        <div className="obsidian-glass rounded-xl p-1 pointer-events-auto flex items-center gap-1 shadow-2xl relative">
          {/* Anchored Dropdown Menus - Absolute positioned relative to toolbar container */}
          <AnimatePresence>
            {activePanel && (
              <div className="absolute bottom-full left-0 mb-3 w-64 pointer-events-auto shadow-2xl">
                <Panel
                  title={
                    activePanel === 'settings' ? 'CONFIG' :
                    activePanel === 'layers' ? 'MAPS' :
                    activePanel === 'bookmarks' ? 'INTEL' :
                    activePanel === 'navigation' ? 'NAVIGATION & SEARCH' :
                    activePanel === 'tools' ? 'TOOLS' : ''
                  }
                  isOpen={true}
                  onClose={() => setActivePanel(null)}
                  variant="menu"
                  align="left"
                >
                  {activePanel === 'layers' && (
                    <MapLayersPanel />
                  )}

                  {activePanel === 'bookmarks' && (
                    <BookmarkManager />
                  )}

                  {activePanel === 'navigation' && (
                    <div className="flex flex-col gap-0.5">
                      <NavigationMenu />
                    </div>
                  )}

                  {activePanel === 'tools' && (
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-col gap-1 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                        <button
                          onClick={() => {
                            const newState = activeTool === 'radar' ? null : 'radar';
                            setActiveTool(newState);
                            if (newState === 'radar') setActivePanel(null);
                          }}
                          className={`w-full px-3 py-2 text-left text-[10px] font-bold rounded-md flex items-center justify-between ${
                            activeTool === 'radar' ? 'bg-blue-600 text-white' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Radio className="w-3.5 h-3.5" />
                            <span>SIGNAL RADAR</span>
                          </div>
                          {activeTool === 'radar' && <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                        </button>
                        <button
                          onClick={() => {
                            const newState = activeTool === 'network' ? null : 'network';
                            setActiveTool(newState);
                            if (newState === 'network') setActivePanel(null);
                          }}
                          className={`w-full px-3 py-2 text-left text-[10px] font-bold rounded-md flex items-center justify-between ${
                            activeTool === 'network' ? 'bg-blue-600 text-white' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Zap className="w-3.5 h-3.5" />
                            <span>NET ANALYSIS</span>
                          </div>
                          {activeTool === 'network' && <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                        </button>
                        <button
                          onClick={() => {
                            const newState = activeTool === 'eraser' ? null : 'eraser';
                            setActiveTool(newState);
                            if (newState === 'eraser') setActivePanel(null);
                          }}
                          className={`w-full px-3 py-2 text-left text-[10px] font-bold rounded-md flex items-center justify-between ${
                            activeTool === 'eraser' ? 'bg-red-600 text-white' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Eraser className="w-3.5 h-3.5" />
                            <span>ERASER</span>
                          </div>
                          {activeTool === 'eraser' && <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                        </button>
                        <button
                          onClick={() => {
                            const newState = activeTool === 'measure' ? null : 'measure';
                            setActiveTool(newState);
                            if (newState === 'measure') setActivePanel(null);
                          }}
                          className={`w-full px-3 py-2 text-left text-[10px] font-bold rounded-md flex items-center justify-between ${
                            activeTool === 'measure' ? 'bg-amber-500 text-zinc-950' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Route className="w-3.5 h-3.5" />
                            <span>TRACE</span>
                          </div>
                          {activeTool === 'measure' && <div className="w-1.5 h-1.5 rounded-full bg-zinc-950 animate-pulse" />}
                        </button>
                        <button
                          onClick={() => {
                            const newState = activeTool === 'custommap' ? null : 'custommap';
                            setActiveTool(newState);
                            if (newState === 'custommap') setActivePanel(null);
                          }}
                          className={`w-full px-3 py-2 text-left text-[10px] font-bold rounded-md flex items-center justify-between ${
                            activeTool === 'custommap' ? 'bg-amber-500 text-zinc-950' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <MapIcon className="w-3.5 h-3.5" />
                            <span>CUSTOM MAP / INTEL</span>
                          </div>
                          {activeTool === 'custommap' && <div className="w-1.5 h-1.5 rounded-full bg-zinc-950 animate-pulse" />}
                        </button>
                        <button
                          onClick={() => {
                            const newState = activeTool === 'lane' ? null : 'lane';
                            setActiveTool(newState);
                            if (newState === 'lane') setActivePanel(null);
                          }}
                          className={`w-full px-3 py-2 text-left text-[10px] font-bold rounded-md flex items-center justify-between ${
                            activeTool === 'lane' ? 'bg-blue-600 text-white' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Navigation className="w-3.5 h-3.5 rotate-[45deg]" />
                            <span>LANE ASSISTANT</span>
                          </div>
                          {activeTool === 'lane' && <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                        </button>
                        <button
                          onClick={() => {
                            const newState = activeTool === 'wiki' ? null : 'wiki';
                            setActiveTool(newState);
                            if (newState === 'wiki') setActivePanel(null);
                          }}
                          className={`w-full px-3 py-2 text-left text-[10px] font-bold rounded-md flex items-center justify-between ${
                            activeTool === 'wiki' ? 'bg-blue-600 text-white' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <BookOpen className="w-3.5 h-3.5" />
                            <span>WIKI CHECK</span>
                          </div>
                          {activeTool === 'wiki' && <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                        </button>
                      </div>
                      <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
                        <button
                          onClick={() => {
                            const showCacheVis = useConfigStore.getState().showCacheVis;
                            useConfigStore.getState().setShowCacheVis(!showCacheVis);
                          }}
                          className={`w-full px-3 py-2 text-left text-[10px] font-bold rounded-md flex items-center justify-between ${
                            useConfigStore.getState().showCacheVis ? 'bg-blue-900/40 text-blue-400' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <MapIcon className="w-3.5 h-3.5" />
                            <span>OFFLINE DATA DENSITY</span>
                          </div>
                          <div className={`w-8 h-4 rounded-full p-0.5 transition-colors ${useConfigStore.getState().showCacheVis ? 'bg-blue-600' : 'bg-zinc-300 dark:bg-zinc-700'}`}>
                            <div className={`w-3 h-3 rounded-full bg-white transition-transform ${useConfigStore.getState().showCacheVis ? 'translate-x-4' : 'translate-x-0'}`} />
                          </div>
                        </button>
                      </div>
                    </div>
                  )}

                  {activePanel === 'settings' && (
                    <SettingsPanel />
                  )}
                </Panel>
              </div>
            )}
          </AnimatePresence>

          {[
            { id: 'settings', icon: Settings, label: 'CONFIG' },
            { id: 'layers', icon: MapIcon, label: 'MAPS' },
            { id: 'bookmarks', icon: Bookmark, label: 'INTEL' },
            { id: 'tools', icon: Wrench, label: 'TOOLS' }
          ].map((item: any) => (
            <div key={item.id} className="relative">
              <button
                onClick={item.onClick || (() => setActivePanel(activePanel === item.id ? null : item.id))}
                onPointerDown={item.onPointerDown}
                onPointerUp={item.onPointerUp}
                onPointerLeave={item.onPointerUp}
                className={`w-11 h-11 flex items-center justify-center rounded-lg transition-all ${
                  activePanel === item.id 
                  ? 'bg-blue-600 text-white shadow-inner scale-95 ring-1 ring-white/40' 
                  : 'text-zinc-700 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white hover:bg-white/10'
                }`}
                title={item.label}
              >
                <item.icon 
                  className="w-6 h-6 transition-transform duration-300" 
                  strokeWidth={2.5}
                />
              </button>
            </div>
          ))}
          <CompassButton onLongPress={() => setActivePanel('navigation')} />
        </div>
      </motion.div>
    )}
  </AnimatePresence>

    </div>
  );
};

export default App;
