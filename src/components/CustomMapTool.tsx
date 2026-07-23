import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { db } from '../lib/db';
import { Map as MapIcon, X, Check, MapPin, Route, Hexagon, Square, Grid, Search, ChevronUp, ChevronDown, Loader2, Trees, Droplets, Mountain, Navigation, Compass, Plus, Save, Camera } from 'lucide-react';
import { useConfigStore } from '../lib/store';

type DrawMode = 'idle' | 'point' | 'line' | 'polygon' | 'area_select' | 'kinematic';

// Tactical Tools vs Landscape Tools
type TacticalTool = 'poi' | 'route' | 'area' | 'expand';
type LandscapeTool = 'water' | 'forest' | 'sand' | 'concrete';

const CustomMapTool: React.FC<{ isActive: boolean }> = ({ isActive }) => {
  const map = useMap();
  const setActiveTool = useConfigStore(state => state.setActiveTool);
  const setActiveLayer = useConfigStore(state => state.setActiveLayer);
  const activeCustomMapId = useConfigStore(state => state.activeCustomMapId);
  
  const [wizardState, setWizardState] = useState<'select_source' | 'cutout_setup' | 'cutout_draw' | 'cutout_process' | 'blank_setup' | 'sandbox'>('select_source');
  const [cutoutMode, setCutoutMode] = useState<'live' | 'snapshot'>('live');
  const [sandboxMode, setSandboxMode] = useState<'tactical' | 'landscape'>('tactical');
  
  const [tacticalTool, setTacticalTool] = useState<TacticalTool>('poi');
  const [landscapeTool, setLandscapeTool] = useState<LandscapeTool>('forest');
  
  const [mode, setMode] = useState<DrawMode>('idle');
  const [isSaving, setIsSaving] = useState(false);
  const [isFolded, setIsFolded] = useState(false);
  const [points, setPoints] = useState<L.LatLng[]>([]);
  
  // Kinematic Drafting State
  const [kinematicEnabled, setKinematicEnabled] = useState(false);
  const [sensorState, setSensorState] = useState<'gps' | 'location' | 'none'>('none');
  const [currentLocation, setCurrentLocation] = useState<L.LatLng | null>(null);

  const activePolylineRef = useRef<L.Polyline | null>(null);
  const activePolygonRef = useRef<L.Polygon | null>(null);
  const activeMarkerRef = useRef<L.CircleMarker | null>(null);
  const maskLayerRef = useRef<L.Polygon | null>(null);

  // Detail Popups
  const [showDetailPopup, setShowDetailPopup] = useState(false);
  const [detailName, setDetailName] = useState('');
  const [detailDesc, setDetailDesc] = useState('');

  // Final Save Form
  const [showFinalSave, setShowFinalSave] = useState(false);
  const [mapName, setMapName] = useState('');
  const [mapDesc, setMapDesc] = useState('');

  useEffect(() => {
    if (!isActive) {
      clearPreview();
      removeMask();
      setMode('idle');
      setWizardState('select_source');
      setKinematicEnabled(false);
    } else {
      if (activeCustomMapId) {
        // Load existing map logic
        setWizardState('sandbox');
      } else {
        setWizardState('select_source');
      }
    }
  }, [isActive, activeCustomMapId]);

  // Simulate Geolocation for Kinematic Mode (or read real location later)
  useEffect(() => {
    let watchId: number;
    if (kinematicEnabled && isActive && (sensorState === 'gps' || sensorState === 'location')) {
        if ('geolocation' in navigator) {
            watchId = navigator.geolocation.watchPosition((pos) => {
                setCurrentLocation(L.latLng(pos.coords.latitude, pos.coords.longitude));
            }, (err) => {
                console.warn(err);
            }, { enableHighAccuracy: sensorState === 'gps' });
        }
    }

    return () => {
        if (watchId && navigator.geolocation) {
            navigator.geolocation.clearWatch(watchId);
        }
    };
  }, [kinematicEnabled, isActive, sensorState]);

  const clearPreview = () => {
    if (activePolylineRef.current) {
      map.removeLayer(activePolylineRef.current);
      activePolylineRef.current = null;
    }
    if (activePolygonRef.current) {
      map.removeLayer(activePolygonRef.current);
      activePolygonRef.current = null;
    }
    if (activeMarkerRef.current) {
      map.removeLayer(activeMarkerRef.current);
      activeMarkerRef.current = null;
    }
  };

  const removeMask = () => {
    if (maskLayerRef.current) {
      map.removeLayer(maskLayerRef.current);
      maskLayerRef.current = null;
    }
  };

  const drawMask = (pts: L.LatLng[]) => {
    removeMask();
    // Inverted polygon for masking
    const outerRing = [
      L.latLng(-90, -180),
      L.latLng(90, -180),
      L.latLng(90, 180),
      L.latLng(-90, 180),
      L.latLng(-90, -180)
    ];
    const innerRing = [...pts];
    
    maskLayerRef.current = L.polygon([outerRing, innerRing], {
      color: '#000',
      fillColor: '#000',
      fillOpacity: 0.8,
      weight: 0,
      interactive: false
    }).addTo(map);
  };

  const syncPreview = useCallback((pts: L.LatLng[]) => {
    clearPreview();
    if (pts.length === 0) return;

    if (mode === 'point') {
      activeMarkerRef.current = L.circleMarker(pts[0], {
        radius: 8,
        color: '#f59e0b',
        fillColor: '#f59e0b',
        fillOpacity: 0.8
      }).addTo(map);
    } else if (mode === 'line') {
      activePolylineRef.current = L.polyline(pts, {
        color: '#f59e0b',
        weight: 4,
        dashArray: '5, 10'
      }).addTo(map);
    } else if (mode === 'polygon' || mode === 'area_select') {
      activePolygonRef.current = L.polygon(pts, {
        color: mode === 'area_select' ? '#10b981' : '#f59e0b',
        weight: 3,
        fillColor: mode === 'area_select' ? '#10b981' : '#f59e0b',
        fillOpacity: 0.3
      }).addTo(map);
    }
  }, [map, mode]);

  useEffect(() => {
    syncPreview(points);
  }, [points, syncPreview]);

  useMapEvents({
    click(e) {
      if (!isActive || isFolded || kinematicEnabled) return;
      if (mode === 'idle') return;
      
      const pt = e.latlng;
      if (mode === 'point') {
        setPoints([pt]);
        setShowDetailPopup(true);
      } else {
        setPoints(prev => [...prev, pt]);
      }
    }
  });

  const toggleKinematic = () => {
    setKinematicEnabled(!kinematicEnabled);
    if (!kinematicEnabled && sensorState === 'none') {
        setSensorState('gps'); // Auto-fallback
    }
  };

  const handleKinematicDrop = () => {
    if (!currentLocation) return;
    if (mode === 'point') {
        setPoints([currentLocation]);
        setShowDetailPopup(true);
    } else {
        setPoints(prev => [...prev, currentLocation]);
    }
  };

  const saveDetail = () => {
      // Stub for saving an individual object
      setPoints([]);
      setMode('idle');
      setShowDetailPopup(false);
      setDetailName('');
      setDetailDesc('');
  };

  const finishSandbox = async () => {
      setShowFinalSave(true);
  };

  const confirmFinalSave = async () => {
      setIsSaving(true);
      try {
          await db.bookmarks.add({
              lat: map.getCenter().lat,
              lng: map.getCenter().lng,
              name: mapName || `Custom Map - ${new Date().toLocaleTimeString()}`,
              category: 'custommap',
              savedAt: Date.now(),
              note: mapDesc,
              data: {
                  type: 'sandbox',
                  objects: []
              }
          });
          window.dispatchEvent(new CustomEvent('bookmarks-updated'));
          setActiveTool(null);
      } finally {
          setIsSaving(false);
      }
  };

  if (!isActive) return null;

  return createPortal(
    <>
      <div className="fixed top-20 left-4 z-[9999] w-80 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden tactical-font flex flex-col pointer-events-auto max-h-[85vh]">
        <div className="flex items-center justify-between p-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-2 text-zinc-800 dark:text-zinc-200 font-bold text-sm">
            <MapIcon className="w-4 h-4 text-amber-500" />
            CUSTOM MAPS
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setIsFolded(!isFolded)} className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg text-zinc-500 transition-colors">
              {isFolded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
            <button onClick={() => setActiveTool(null)} className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg text-zinc-500 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        {!isFolded && (
          <div className="p-3 overflow-y-auto tactical-scrollbar space-y-4">
            
            {wizardState === 'select_source' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-bold mb-2">INITIALIZATION</div>
                    <div className="grid grid-cols-2 gap-2">
                        <button 
                            onClick={() => { setActiveLayer('blank'); setWizardState('sandbox'); }}
                            className="p-3 rounded-lg flex flex-col items-center justify-center gap-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors border border-transparent hover:border-amber-500/50"
                        >
                            <Grid className="w-5 h-5 text-amber-500" />
                            <span className="text-[10px] font-bold">BLANK GRID</span>
                        </button>
                        <button 
                            onClick={() => setWizardState('cutout_setup')}
                            className="p-3 rounded-lg flex flex-col items-center justify-center gap-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors border border-transparent hover:border-blue-500/50"
                        >
                            <Search className="w-5 h-5 text-blue-500" />
                            <span className="text-[10px] font-bold text-center leading-tight">LIVE MAP<br/>CUTOUT</span>
                        </button>
                    </div>
                </div>
            )}

            {wizardState === 'cutout_setup' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-bold mb-2">1. BASE LAYER</div>
                    <div className="grid grid-cols-3 gap-1 mb-4">
                        <button onClick={() => { setActiveLayer('satellite'); setWizardState('cutout_draw'); setMode('area_select'); setPoints([]); }} className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-[9px] font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700">SAT</button>
                        <button onClick={() => { setActiveLayer('hybrid'); setWizardState('cutout_draw'); setMode('area_select'); setPoints([]); }} className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-[9px] font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700">HYBRID</button>
                        <button onClick={() => { setActiveLayer('depth'); setWizardState('cutout_draw'); setMode('area_select'); setPoints([]); }} className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-[9px] font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700">DEPTH</button>
                    </div>
                </div>
            )}

            {wizardState === 'cutout_draw' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-bold mb-2">2. ENCLOSE BOUNDARY</div>
                    <div className="w-full p-3 rounded-lg flex flex-col items-center justify-center gap-2 bg-emerald-500 text-white font-bold">
                        <Square className="w-5 h-5" />
                        <span className="text-[10px]">TAP TO DRAW POLYGON</span>
                    </div>
                    
                    {points.length >= 3 && (
                        <button
                            onClick={() => {
                                setWizardState('cutout_process');
                            }}
                            className="w-full bg-emerald-500 text-white font-bold p-3 rounded-lg mt-4 flex justify-center gap-2 animate-in fade-in slide-in-from-bottom-2"
                        >
                            <Check className="w-4 h-4" /> CONFIRM BOUNDARY
                        </button>
                    )}
                </div>
            )}

            {wizardState === 'cutout_process' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-bold mb-2">3. BOUNDARY ISOLATION METHOD</div>
                    <div className="grid grid-cols-1 gap-2">
                        <button 
                            onClick={() => { 
                                setCutoutMode('live');
                                drawMask(points);
                                setWizardState('sandbox'); 
                                setMode('idle'); 
                                setPoints([]); 
                            }}
                            className="p-3 rounded-lg flex flex-col items-center justify-center gap-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors border border-zinc-200 dark:border-zinc-700 hover:border-emerald-500/50"
                        >
                            <Navigation className="w-5 h-5 text-emerald-500" />
                            <span className="text-[10px] font-bold text-center leading-tight">LIVE MAP<br/><span className="text-[9px] font-normal text-zinc-500 line-clamp-1">Maintains dynamic map updates within cutout.</span></span>
                        </button>
                        <button 
                            onClick={() => { 
                                setCutoutMode('snapshot'); 
                                drawMask(points); 
                                setWizardState('sandbox'); 
                                setMode('idle'); 
                                setPoints([]);
                            }}
                            className="p-3 rounded-lg flex flex-col items-center justify-center gap-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors border border-zinc-200 dark:border-zinc-700 hover:border-amber-500/50"
                        >
                            <Camera className="w-5 h-5 text-amber-500" />
                            <span className="text-[10px] font-bold text-center leading-tight">STATIC SNAPSHOT<br/><span className="text-[9px] font-normal text-zinc-500 line-clamp-1">Freezes map tiles as a static image offline.</span></span>
                        </button>
                    </div>
                </div>
            )}

            {wizardState === 'sandbox' && !showDetailPopup && !showFinalSave && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="flex items-center justify-between">
                        <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-wider flex items-center gap-1">
                            Sandbox Engine
                            {activeCustomMapId ? null : (
                                <span className={`ml-1 px-1.5 py-0.5 rounded-sm text-[8px] ${cutoutMode === 'live' ? 'bg-emerald-500/20 text-emerald-600' : 'bg-amber-500/20 text-amber-600'}`}>
                                    {cutoutMode === 'live' ? 'LIVE' : 'SNAPSHOT'}
                                </span>
                            )}
                        </div>
                        <button onClick={finishSandbox} className="px-2 py-1 bg-amber-500 text-black text-[9px] font-bold rounded flex items-center gap-1 hover:bg-amber-400 transition-colors">
                            <Save className="w-3 h-3" /> SAVE MAP
                        </button>
                    </div>

                    <div className="flex gap-2">
                        <button 
                            onClick={() => setSandboxMode('landscape')}
                            className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg border ${sandboxMode === 'landscape' ? 'bg-zinc-800 text-zinc-100 border-zinc-900 shadow-inner' : 'bg-zinc-100 text-zinc-500 border-transparent hover:bg-zinc-200 bg-opacity-70'}`}
                        >
                            LANDSCAPE
                        </button>
                        <button 
                            onClick={() => setSandboxMode('tactical')}
                            className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg border ${sandboxMode === 'tactical' ? 'bg-zinc-800 text-zinc-100 border-zinc-900 shadow-inner' : 'bg-zinc-100 text-zinc-500 border-transparent hover:bg-zinc-200 bg-opacity-70'}`}
                        >
                            TACTICAL
                        </button>
                    </div>

                    {sandboxMode === 'landscape' && (
                        <div className="grid grid-cols-2 gap-2 mt-2">
                             <button onClick={() => { setLandscapeTool('water'); setMode('polygon'); setPoints([]); }} className={`p-2 rounded flex flex-col items-center justify-center gap-1 text-[9px] font-bold transition-all ${landscapeTool === 'water' && mode === 'polygon' ? 'bg-blue-500 text-white shadow-md' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}>
                                 <Droplets className="w-4 h-4" /> WATER
                             </button>
                             <button onClick={() => { setLandscapeTool('forest'); setMode('polygon'); setPoints([]); }} className={`p-2 rounded flex flex-col items-center justify-center gap-1 text-[9px] font-bold transition-all ${landscapeTool === 'forest' && mode === 'polygon' ? 'bg-emerald-500 text-white shadow-md' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}>
                                 <Trees className="w-4 h-4" /> FOREST
                             </button>
                             <button onClick={() => { setLandscapeTool('sand'); setMode('polygon'); setPoints([]); }} className={`p-2 rounded flex flex-col items-center justify-center gap-1 text-[9px] font-bold transition-all ${landscapeTool === 'sand' && mode === 'polygon' ? 'bg-amber-300 text-amber-900 shadow-md' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}>
                                 <Mountain className="w-4 h-4" /> SAND
                             </button>
                             <button onClick={() => { setLandscapeTool('concrete'); setMode('polygon'); setPoints([]); }} className={`p-2 rounded flex flex-col items-center justify-center gap-1 text-[9px] font-bold transition-all ${landscapeTool === 'concrete' && mode === 'polygon' ? 'bg-zinc-500 text-white shadow-md' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}>
                                 <Square className="w-4 h-4" /> CONCRETE
                             </button>
                        </div>
                    )}

                    {sandboxMode === 'tactical' && (
                        <div className="grid grid-cols-4 gap-1 mt-2">
                            <button onClick={() => { setTacticalTool('poi'); setMode('point'); setPoints([]); }} className={`p-2 rounded flex flex-col items-center gap-1 text-[9px] font-bold transition-all ${tacticalTool === 'poi' && mode === 'point' ? 'bg-amber-500 text-black shadow-md' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}>
                                <MapPin className="w-4 h-4" /> POI
                            </button>
                            <button onClick={() => { setTacticalTool('route'); setMode('line'); setPoints([]); }} className={`p-2 rounded flex flex-col items-center gap-1 text-[9px] font-bold transition-all ${tacticalTool === 'route' && mode === 'line' ? 'bg-amber-500 text-black shadow-md' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}>
                                <Route className="w-4 h-4" /> ROUTE
                            </button>
                            <button onClick={() => { setTacticalTool('area'); setMode('polygon'); setPoints([]); }} className={`p-2 rounded flex flex-col items-center gap-1 text-[9px] font-bold transition-all ${tacticalTool === 'area' && mode === 'polygon' ? 'bg-amber-500 text-black shadow-md' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}>
                                <Hexagon className="w-4 h-4" /> AREA
                            </button>
                            <button onClick={() => { setTacticalTool('expand'); setMode('idle'); }} className={`p-2 rounded flex flex-col items-center gap-1 text-[9px] font-bold transition-all ${tacticalTool === 'expand' ? 'bg-blue-500 text-white shadow-md' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}>
                                <Plus className="w-4 h-4" /> EXPAND
                            </button>
                        </div>
                    )}

                    {mode !== 'idle' && (
                        <div className="animate-in slide-in-from-bottom-2 duration-200">
                            <div className="p-2 bg-amber-500/10 border border-amber-500/30 text-amber-700 text-[10px] font-bold rounded mt-4">
                                {kinematicEnabled ? '🚶 WALK TO MARK POINTS' : '👆 TAP GLASS TO DRAW'}
                                {points.length > 0 && <div className="mt-1 flex items-center justify-between">{points.length} nodes tracking <button onClick={() => setPoints([])} className="underline text-red-500 text-[9px]">Clear</button></div>}
                            </div>
                            
                            {(mode === 'line' || mode === 'polygon') && points.length > 0 && (
                                <button onClick={() => setShowDetailPopup(true)} className="w-full mt-2 p-3 bg-amber-500 text-black font-bold text-[10px] rounded flex items-center justify-center gap-2 hover:bg-amber-400 transition-colors shadow-lg">
                                    <Check className="w-4 h-4" /> FINISH SHAPE
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Custom Detail Entry Popup (Workflow Rule) */}
            {showDetailPopup && (
                <div className="space-y-3 animate-in zoom-in-95 duration-200 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3 rounded-lg shadow-inner">
                    <div className="text-[10px] font-bold text-amber-500 mb-2 border-b border-zinc-200 dark:border-zinc-700 pb-2">PLACEMENT DETAILS</div>
                    <input type="text" placeholder="Name / Label" value={detailName} onChange={e => setDetailName(e.target.value)} className="w-full text-xs p-2 rounded bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 outline-none focus:border-amber-500" />
                    <textarea placeholder="Tactical Notes" value={detailDesc} onChange={e => setDetailDesc(e.target.value)} className="w-full text-xs p-2 rounded bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 outline-none resize-none focus:border-amber-500" rows={3} />
                    <button onClick={saveDetail} className="w-full bg-emerald-500 hover:bg-emerald-400 transition-colors text-white font-bold p-2 text-xs rounded mt-2">SAVE TO MAP</button>
                    <button onClick={() => { setShowDetailPopup(false); setPoints([]); }} className="w-full bg-transparent hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors text-zinc-500 font-bold p-2 text-xs rounded">CANCEL</button>
                </div>
            )}

            {showFinalSave && (
                <div className="space-y-3 animate-in zoom-in-95 duration-200 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/30 p-3 rounded-lg shadow-inner">
                    <div className="text-[10px] font-bold text-blue-500 mb-2 border-b border-blue-200 dark:border-blue-800/30 pb-2 flex items-center gap-2">
                        <Save className="w-4 h-4"/> CUSTOM MAP SAVE FORM
                    </div>
                    <input type="text" placeholder="Map Name" value={mapName} onChange={e => setMapName(e.target.value)} className="w-full text-xs p-2 rounded bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 outline-none focus:border-blue-500" />
                    <textarea placeholder="Description / Purpose" value={mapDesc} onChange={e => setMapDesc(e.target.value)} className="w-full text-xs p-2 rounded bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 outline-none resize-none focus:border-blue-500" rows={4} />
                    <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded text-[9px] text-zinc-500 font-medium">
                        ✦ Map coordinate anchor and scale bounds will be automatically saved.
                    </div>
                    <button onClick={confirmFinalSave} disabled={isSaving} className="w-full bg-blue-500 text-white font-bold p-3 text-xs rounded flex justify-center items-center gap-2 hover:bg-blue-400 transition-colors mt-2">
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Check className="w-4 h-4" />} FINISH & STORE OFFLINE
                    </button>
                    <button onClick={() => setShowFinalSave(false)} className="w-full bg-transparent hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors text-zinc-500 font-bold p-2 text-xs rounded">CANCEL</button>
                </div>
            )}
            
          </div>
        )}
      </div>

      {/* Sensor / Kinematic FABs */}
      {wizardState === 'sandbox' && !isFolded && (
          <div className="fixed bottom-32 right-4 z-[9999] flex flex-col items-end gap-3 pointer-events-auto">
              
              <button
                 onClick={() => {
                     const states: ('gps'|'location'|'none')[] = ['gps', 'location', 'none'];
                     const next = states[(states.indexOf(sensorState) + 1) % states.length];
                     setSensorState(next);
                     if (next === 'none') setKinematicEnabled(false);
                 }}
                 className="p-3 bg-zinc-900 dark:bg-black text-white rounded-full shadow-lg shadow-black/20 flex flex-col items-center justify-center transition-transform hover:scale-110 border border-zinc-700 group relative"
              >
                  <Navigation className={`w-5 h-5 transition-colors ${sensorState === 'gps' ? 'text-blue-400' : sensorState === 'location' ? 'text-amber-400' : 'text-zinc-500'}`} />
                  <span className="absolute -top-8 bg-zinc-900 text-white text-[9px] font-bold px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                      SENSOR: {sensorState.toUpperCase()}
                  </span>
              </button>

              <button
                 onClick={toggleKinematic}
                 className={`p-4 rounded-full shadow-2xl flex items-center justify-center transition-all border ${kinematicEnabled ? 'bg-amber-500 text-black scale-110 shadow-amber-500/50 border-amber-400' : 'bg-black text-white hover:bg-zinc-800 border-zinc-700 relative group'}`}
              >
                 <Compass className="w-6 h-6" />
                 {!kinematicEnabled && (
                    <span className="absolute -left-36 bg-black text-white text-[9px] font-bold px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        KINEMATIC AUTO-WALK (OFF)
                    </span>
                 )}
              </button>

              {kinematicEnabled && mode !== 'idle' && (
                  <button
                     onClick={handleKinematicDrop}
                     className="mt-6 p-4 bg-emerald-500 text-white rounded-full shadow-2xl flex items-center justify-center animate-bounce border-4 border-emerald-300 relative group"
                  >
                      <Plus className="w-6 h-6" />
                      <span className="absolute right-16 bg-emerald-900 text-white text-[10px] font-black px-3 py-1 rounded whitespace-nowrap shadow-lg">
                          DROP NODE
                      </span>
                  </button>
              )}
          </div>
      )}
    </>,
    document.body
  );
};

export default CustomMapTool;
