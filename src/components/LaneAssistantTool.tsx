import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Compass, 
  Map as MapIcon,
  Play, 
  Pause,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Navigation,
  LocateFixed,
  LocateOff,
  MapPin,
  Route
} from 'lucide-react';
import { useGPSStore, useMapStore, useConfigStore } from '../lib/store';
import { toDMS } from '../lib/utils';
import L from 'leaflet';

interface LaneAssistantToolProps {
  onClose: () => void;
}

export const LaneAssistantTool: React.FC<LaneAssistantToolProps> = ({ onClose }) => {
  const { position, speed: gpsSpeed, heading: gpsHeading, isTracking } = useGPSStore();
  const map = useMapStore(s => s.map);
  const { isOnline, setMapRotation, setMapRotationLocked } = useConfigStore();

  type RoadFeature = 'straight' | 'turn-left' | 'turn-right' | 'split-left' | 'split-right';

  const [setupMode, setSetupMode] = useState<'select' | 'pick-point' | 'active'>('select');
  const [trackingMode, setTrackingMode] = useState<'routes' | 'manual' | 'freeroam'>('freeroam');

  const [isSnapping, setIsSnapping] = useState(false);
  const [snappingError, setSnappingError] = useState('');

  const [feature, setFeature] = useState<RoadFeature>('straight');
  const [featureY, setFeatureY] = useState(-200);

  const [isPlaying, setIsPlaying] = useState(true);
  const [currentSpeed, setCurrentSpeed] = useState(67);
  const [speedLimit, setSpeedLimit] = useState(70);
  const [activeLane, setActiveLane] = useState<'left' | 'center' | 'right'>('center');
  const [targetLane, setTargetLane] = useState<'left' | 'center' | 'right'>('center');

  const [roadOffset, setRoadOffset] = useState(0);
  const [sceneryItems, setSceneryItems] = useState([
    { id: 1, z: 1.0, side: 'right', type: 'tree' },
    { id: 2, z: 0.7, side: 'left', type: 'tree' },
    { id: 3, z: 0.4, side: 'right', type: 'tree' },
    { id: 4, z: 0.1, side: 'left', type: 'tree' }
  ]);

  // Discrete Real-time Updates State
  const [snappedPos, setSnappedPos] = useState<[number, number] | null>(null);
  const [snappedHeading, setSnappedHeading] = useState(0);
  const [mockHeading, setMockHeading] = useState(0); // Simulator heading
  const lastUpdateRef = useRef<{ pos: [number, number], heading: number } | null>(null);

  // Sync GPS to Discrete Snapped State
  useEffect(() => {
    if (isTracking && position) {
      if (!lastUpdateRef.current) {
        lastUpdateRef.current = { pos: position, heading: gpsHeading || 0 };
        setSnappedPos(position);
        setSnappedHeading(gpsHeading || 0);
        return;
      }

      // Calculate distance between current and last snapped position
      const last = lastUpdateRef.current.pos;
      const dist = L.latLng(position[0], position[1]).distanceTo(L.latLng(last[0], last[1]));
      const headingDiff = Math.abs((gpsHeading || 0) - lastUpdateRef.current.heading);
      
      // Update discreetly: Milestone (e.g., 20m), large direction change, or lane switch context
      if (dist > 20 || headingDiff > 15) {
        lastUpdateRef.current = { pos: position, heading: gpsHeading || 0 };
        setSnappedPos(position);
        setSnappedHeading(gpsHeading || 0);
        if (setupMode === 'active') {
          map?.panTo([position[0], position[1]], { animate: true, duration: 0.5 });
        }
      }
    } else {
      setSnappedPos(null);
    }
  }, [position, gpsHeading, isTracking, map, setupMode]);

  useEffect(() => {
    if (setupMode === 'pick-point' && map) {
      const handleClick = async (e: L.LeafletMouseEvent) => {
         if (isSnapping) return;
         setIsSnapping(true);
         setSnappingError('');
         try {
           const lat = e.latlng.lat;
           const lng = e.latlng.lng;
           // Query Overpass with a 100m radius and broader road tag acceptance
           const query = `[out:json];way(around:100,${lat},${lng})["highway"~"^(motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link|tertiary|tertiary_link|unclassified|residential|service|living_street)$"];out center 1;`;
           const res = await fetch('https://overpass-api.de/api/interpreter', {
              method: 'POST',
              body: query
           });
           const text = await res.text();
           let data;
           try {
              data = JSON.parse(text);
           } catch (err) {
              console.warn("Overpass API returned non-JSON in LaneAssistant:", text.substring(0, 100));
              throw new Error("Overpass rate limit or error");
           }
           if (data.elements && data.elements.length > 0) {
              setSnappedPos([lat, lng]);
              setMockHeading(Math.floor(Math.random() * 360));
              setSetupMode('active');
              map.panTo([lat, lng], { animate: true, duration: 0.5 });
           } else {
              setSnappingError('No valid road detected. Tap closer to a road.');
           }
         } catch (err) {
           setSnappingError('Network error verifying road.');
         } finally {
           setIsSnapping(false);
         }
      };
      map.on('click', handleClick);
      const container = map.getContainer();
      container.style.cursor = 'crosshair';
      return () => {
        map.off('click', handleClick);
        container.style.cursor = '';
      };
    }
  }, [setupMode, map, isSnapping]);

  useEffect(() => {
    if (isTracking && gpsSpeed !== null) {
      setCurrentSpeed(Math.round(gpsSpeed * 3.6)); // Convert m/s to km/h
    }
  }, [isTracking, gpsSpeed]);

  useEffect(() => {
    if (!isPlaying && !isTracking) return;
    if (setupMode !== 'active') return;

    const interval = setInterval(() => {
      // If tracking, speed dictates road visual offset
      const effectiveSpeed = isTracking ? Math.max(10, currentSpeed) : currentSpeed;
      const speedFactor = effectiveSpeed / 67;
      
      setRoadOffset(prev => (prev + 5 * speedFactor) % 100);

      setSceneryItems(prev => prev.map(item => {
        let nextZ = item.z - 0.05 * speedFactor;
        if (nextZ < 0) nextZ = 1.0;
        return { ...item, z: parseFloat(nextZ.toFixed(2)) };
      }));

      if (!isTracking) {
        setCurrentSpeed(prev => {
          const target = speedLimit - 3;
          const nextSpeed = prev + (prev < target ? 1 : prev > target ? -1 : 0);
          return Math.max(30, Math.min(speedLimit + 5, nextSpeed));
        });
        
        if (feature !== 'straight') {
           setFeatureY(prev => {
             const nextY = prev + 5 * speedFactor;
             if (nextY >= 150) {
                if (feature === 'turn-right') setMockHeading(h => h + 90);
                if (feature === 'turn-left') setMockHeading(h => h - 90);
                setFeature('straight');
                return -200;
             }
             return nextY;
           });
        } else {
           if (Math.random() < 0.02) {
              const features = ['turn-left', 'turn-right', 'split-left', 'split-right'];
              setFeature(features[Math.floor(Math.random() * features.length)] as RoadFeature);
              setFeatureY(-200);
           } else if (Math.random() < 0.01) {
              setTargetLane(['left', 'center', 'right'][Math.floor(Math.random() * 3)] as any);
           }
        }
      }
    }, 150);
    return () => clearInterval(interval);
  }, [isPlaying, currentSpeed, speedLimit, isTracking, setupMode, feature]);

  const handleLaneChange = (lane: 'left' | 'center' | 'right') => {
    setActiveLane(lane);
    // Force discrete visual update on lane switch exactly as requested
    if (snappedPos && setupMode === 'active') {
       map?.panTo([snappedPos[0], snappedPos[1]], { animate: true, duration: 0.5 });
    }
    if (!isTracking) {
      setTargetLane(lane); // auto align target lane in free roam when user switches
    }
  };

  const getLanePath = (lane: 'left' | 'center' | 'right') => {
    const startX = lane === 'left' ? 80 : lane === 'center' ? 100 : 120;
    if (feature === 'straight' || feature.startsWith('split')) return `M ${startX}, -150 L ${startX}, 400`;
    if (feature === 'turn-right') {
      const turnY = lane === 'left' ? featureY - 50 : lane === 'center' ? featureY - 30 : featureY - 10;
      return `M ${startX}, 400 L ${startX}, ${turnY + 15} Q ${startX}, ${turnY} ${startX + 15}, ${turnY} L 350, ${turnY}`;
    }
    if (feature === 'turn-left') {
      const turnY = lane === 'left' ? featureY - 10 : lane === 'center' ? featureY - 30 : featureY - 50;
      return `M ${startX}, 400 L ${startX}, ${turnY + 15} Q ${startX}, ${turnY} ${startX - 15}, ${turnY} L -150, ${turnY}`;
    }
    return '';
  };

  const getRoadSurfacePath = () => {
    if (feature === 'straight' || feature.startsWith('split')) return 'M 70, -150 L 70, 400 L 130, 400 L 130, -150 Z';
    if (feature === 'turn-right') {
      return `M 70, 400 L 70, ${(featureY-60)+20} Q 70, ${featureY-60} 90, ${featureY-60} L 350, ${featureY-60} L 350, ${featureY} L 150, ${featureY} Q 130, ${featureY} 130, ${featureY+20} L 130, 400 Z`;
    }
    if (feature === 'turn-left') {
      return `M 130, 400 L 130, ${(featureY-60)+20} Q 130, ${featureY-60} 110, ${featureY-60} L -150, ${featureY-60} L -150, ${featureY} L 50, ${featureY} Q 70, ${featureY} 70, ${featureY+20} L 70, 400 Z`;
    }
    return '';
  };

  const getDividerPath = (pos: 'left' | 'right') => {
    const startX = pos === 'left' ? 90 : 110;
    if (feature === 'straight' || feature.startsWith('split')) return `M ${startX}, -150 L ${startX}, 400`;
    if (feature === 'turn-right') {
      const turnY = pos === 'left' ? featureY - 40 : featureY - 20;
      return `M ${startX}, 400 L ${startX}, ${turnY + 10} Q ${startX}, ${turnY} ${startX + 10}, ${turnY} L 350, ${turnY}`;
    }
    if (feature === 'turn-left') {
      const turnY = pos === 'left' ? featureY - 20 : featureY - 40;
      return `M ${startX}, 400 L ${startX}, ${turnY + 10} Q ${startX}, ${turnY} ${startX - 10}, ${turnY} L -150, ${turnY}`;
    }
    return '';
  };

  const isWrongLane = activeLane !== targetLane && isTracking === false; // Simplified logic, for real routing we would determine actual wrong lane based on polyline
  const isSimulated = !isTracking || !position;
  const displayHeading = isSimulated ? mockHeading : snappedHeading;

  // Sync map rotation with car heading when active
  useEffect(() => {
    if (setupMode !== 'active') return;
    setMapRotationLocked(false);
    setMapRotation(-displayHeading);
  }, [displayHeading, setupMode, setMapRotation, setMapRotationLocked]);

  // Clean up rotation only on unmount/exit
  useEffect(() => {
    return () => {
      setMapRotation(0);
      setMapRotationLocked(true);
    };
  }, [setMapRotation, setMapRotationLocked]);

  if (setupMode === 'select') {
    return (
      <div className="absolute inset-0 z-[2000] bg-zinc-950 flex flex-col font-sans text-white p-6 sm:p-10 animate-in fade-in duration-300">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-black tracking-tight flex items-center gap-2 uppercase">
             <Route className="text-emerald-500 w-6 h-6" />
             Lane Assistant
          </h2>
          <button onClick={onClose} className="w-10 h-10 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 rounded-full flex items-center justify-center transition-colors">
             <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        <div className="text-sm text-zinc-400 font-medium mb-6">Select a navigation mode to launch the dedicated Lane OS layout:</div>

        <div className="flex flex-col gap-4 max-w-md">
           <button 
             onClick={() => { setTrackingMode('routes'); setSetupMode('active'); }} 
             className="bg-zinc-900/50 backdrop-blur border border-emerald-500/30 p-5 rounded-2xl text-left hover:border-emerald-500 hover:bg-zinc-800/80 transition-all flex items-start gap-4"
           >
              <div className="mt-1 w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shrink-0">
                 <LocateFixed className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-emerald-400 font-bold mb-1 uppercase tracking-widest text-sm">Saved Routes (OSM)</h3>
                <p className="text-emerald-200/60 text-xs leading-relaxed">Load locally synced premium lane maps for detailed junction analysis. Offline available.</p>
              </div>
           </button>
           
           <button 
             onClick={() => { setTrackingMode('manual'); setSetupMode('pick-point'); }} 
             className="bg-zinc-900/50 backdrop-blur border border-blue-500/30 p-5 rounded-2xl text-left hover:border-blue-500 hover:bg-zinc-800/80 transition-all flex items-start gap-4"
           >
              <div className="mt-1 w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20 shrink-0">
                 <MapPin className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <h3 className="text-blue-400 font-bold mb-1 uppercase tracking-widest text-sm">Manual Point-to-Point</h3>
                <p className="text-blue-200/60 text-xs leading-relaxed">Drop a pin directly onto an active lane network for instant guidance.</p>
              </div>
           </button>
           
           <button 
             onClick={() => { setTrackingMode('freeroam'); setSetupMode('pick-point'); }} 
             className="bg-zinc-900/50 backdrop-blur border border-amber-500/30 p-5 rounded-2xl text-left hover:border-amber-500 hover:bg-zinc-800/80 transition-all flex items-start gap-4"
           >
              <div className="mt-1 w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/20 shrink-0">
                 <Navigation className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <h3 className="text-amber-400 font-bold mb-1 uppercase tracking-widest text-sm">Free Roam</h3>
                <p className="text-amber-200/60 text-xs leading-relaxed">Just tracking lane switches and upcoming topology. Dynamic environmental rotation.</p>
              </div>
           </button>
        </div>
      </div>
    );
  }

  if (setupMode === 'pick-point') {
    return (
      <div className="absolute inset-x-0 top-0 z-[2000] flex justify-center p-6 pointer-events-none animate-in fade-in slide-in-from-top-8 duration-500">
        <div className="bg-zinc-950/90 backdrop-blur-md border border-zinc-800 shadow-2xl p-4 rounded-3xl flex items-center justify-between gap-6 w-full max-w-sm pointer-events-auto">
           <div className="flex items-center gap-4">
             {isSnapping ? (
                <div className="w-10 h-10 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin shrink-0" />
             ) : (
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0 border border-emerald-500/20">
                  <MapPin className="w-5 h-5 text-emerald-400" />
                </div>
             )}
             <div className="flex flex-col">
               <span className="font-bold text-white text-sm uppercase tracking-widest text-emerald-400">
                 {isSnapping ? 'Verifying...' : 'Set Spawn Location'}
               </span>
               <span className="text-zinc-400 text-[10px] uppercase font-bold tracking-wider mt-0.5">
                 {snappingError ? (
                   <span className="text-red-400">{snappingError}</span>
                 ) : (
                   'Tap on any valid road on the map.'
                 )}
               </span>
             </div>
           </div>
           <button onClick={() => setSetupMode('select')} className="w-10 h-10 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 rounded-full flex items-center justify-center shrink-0 transition-colors">
              <X className="w-5 h-5 text-zinc-400" />
           </button>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-[2000] overflow-hidden bg-[#556B2F] flex flex-col font-sans text-white animate-in fade-in zoom-in-95 duration-500">
      {/* ========================================================= */}
      {/* TOP-DOWN 2D ENVIRONMENT MAP (GTA 1/2 STYLE)                 */}
      {/* ========================================================= */}
      <div className="absolute inset-[-50%] z-0">
        <svg className="w-full h-full" viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice">
          {/* Rotatable Map Container */}
          <g 
            style={{ 
              transform: `rotate(${-displayHeading}deg)`, 
              transformOrigin: '100px 100px',
              transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)' 
            }}
          >
            {/* Animated Dirt Patches / Grass variations */}
            <g transform={`translate(0, ${roadOffset * 2})`}>
              <rect x="-85" y="-130" width="12" height="18" fill="#6B8E23" opacity="0.6" rx="3" />
              <rect x="275" y="20" width="15" height="25" fill="#6B8E23" opacity="0.6" rx="4" />
              <rect x="-90" y="80" width="14" height="20" fill="#4B5320" opacity="0.4" rx="2" />
              <rect x="280" y="140" width="10" height="15" fill="#4B5320" opacity="0.4" rx="2" />
  
              <rect x="15" y="-30" width="12" height="18" fill="#6B8E23" opacity="0.6" rx="3" />
              <rect x="175" y="20" width="15" height="25" fill="#6B8E23" opacity="0.6" rx="4" />
              <rect x="10" y="80" width="14" height="20" fill="#4B5320" opacity="0.4" rx="2" />
              <rect x="180" y="140" width="10" height="15" fill="#4B5320" opacity="0.4" rx="2" />
  
              <rect x="15" y="-230" width="12" height="18" fill="#6B8E23" opacity="0.6" rx="3" />
              <rect x="175" y="-180" width="15" height="25" fill="#6B8E23" opacity="0.6" rx="4" />
              <rect x="10" y="-120" width="14" height="20" fill="#4B5320" opacity="0.4" rx="2" />
              <rect x="180" y="-60" width="10" height="15" fill="#4B5320" opacity="0.4" rx="2" />
            </g>
  
            {/* Branches First (so main road overlays) */}
            {feature === 'split-right' && (
              <path d={`M 130, ${featureY} L 220, ${featureY - 90} L 205, ${featureY - 110} L 130, ${featureY - 40} Z`} fill="#374151" stroke="#9CA3AF" strokeWidth="2" />
            )}
            {feature === 'split-left' && (
              <path d={`M 70, ${featureY} L -20, ${featureY - 90} L -5, ${featureY - 110} L 70, ${featureY - 40} Z`} fill="#374151" stroke="#9CA3AF" strokeWidth="2" />
            )}

            {/* Main Road Surface */}
            <path d={getRoadSurfacePath()} fill="#374151" stroke="#9CA3AF" strokeWidth="2" />

            {/* Trodden Path Behind */}
            <path 
              d={getLanePath(activeLane)} 
              stroke="#000000" strokeWidth="18" fill="none" opacity="0.3" 
              strokeDasharray="260 1000"
            />
            
            {/* Highlight Ahead */}
            <path 
              d={getLanePath(activeLane)} 
              stroke="#3B82F6" strokeWidth="18" fill="none" opacity="0.3" 
              strokeDasharray="0 260 1000 0"
            />

            {/* Lane Dividers */}
            <path d={getDividerPath('left')} stroke="#FFFFFF" strokeWidth="1.5" strokeDasharray="6 8" style={{ strokeDashoffset: -roadOffset * 2 }} fill="none" />
            <path d={getDividerPath('right')} stroke="#FFFFFF" strokeWidth="1.5" strokeDasharray="6 8" style={{ strokeDashoffset: -roadOffset * 2 }} fill="none" />

            {/* Target Lane Indicator Outline */}
            <path 
              d={getLanePath(targetLane)} 
              stroke="#22C55E" strokeWidth="20" fill="none" 
              strokeDasharray="4 4" 
              opacity={isWrongLane ? 0.8 : 0.2} 
            />
  
            {/* Moving Scenery (Trees) */}
            {sceneryItems.map((b) => {
              const y = (1 - b.z) * 200;
              return (
                <g key={b.id} transform={`translate(${b.side === 'left' ? 40 : 160}, ${y})`}>
                  <circle cx="0" cy="0" r="10" fill="#064E3B" stroke="#065F46" strokeWidth="1.5" />
                  <circle cx="2" cy="-2" r="5" fill="#047857" />
                </g>
              );
            })}
          </g>

          {/* Top Down Car (Always points UP visually in the screen, untransformed by rotation) */}
          <g 
            style={{
              transform: `translate(${activeLane === 'left' ? 80 : activeLane === 'center' ? 100 : 120}px, 140px) scale(0.65)`,
              transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)'
            }}
          >
            {/* Shadow */}
            <rect x="-10" y="-18" width="20" height="38" fill="#000" opacity="0.4" rx="3" />
            {/* Wheels */}
            <rect x="-11" y="-12" width="3" height="6" fill="#111827" rx="1" />
            <rect x="8" y="-12" width="3" height="6" fill="#111827" rx="1" />
            <rect x="-11" y="8" width="3" height="6" fill="#111827" rx="1" />
            <rect x="8" y="8" width="3" height="6" fill="#111827" rx="1" />
            {/* Body */}
            <rect x="-9" y="-16" width="18" height="32" fill="#F8FAFC" stroke="#E2E8F0" strokeWidth="0.5" rx="3" />
            {/* Windshields */}
            <rect x="-7" y="-6" width="14" height="12" fill="#0EA5E9" rx="1" />
            <path d="M-6 -6 L6 -6 L8 -12 L-8 -12 Z" fill="#1E293B" />
            <path d="M-6 6 L6 6 L8 12 L-8 12 Z" fill="#1E293B" />
            {/* Taillights */}
            <rect x="-7" y="14" width="4" height="2" fill="#EF4444" rx="0.5" />
            <rect x="3" y="14" width="4" height="2" fill="#EF4444" rx="0.5" />
            {/* Headlights */}
            <circle cx="-6" cy="-14" r="1.5" fill="#FEF08A" />
            <circle cx="6" cy="-14" r="1.5" fill="#FEF08A" />
          </g>
        </svg>
      </div>

      {/* ========================================================= */}
      {/* UI OVERLAY / HUD LAYER                                    */}
      {/* ========================================================= */}
      
      {/* Top Warning Banner (appears if in wrong lane) */}
      {isWrongLane && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-600/90 backdrop-blur-md text-white px-4 py-2 rounded-full border border-red-400 shadow-xl flex items-center gap-2 z-[2020] animate-bounce">
          <AlertTriangle className="w-5 h-5 text-red-200" />
          <span className="font-black tracking-widest text-sm uppercase">WRONG LANE - MERGE {targetLane === 'left' ? 'LEFT' : targetLane === 'right' ? 'RIGHT' : 'CENTER'}</span>
        </div>
      )}

      {/* Minimap (Mock) & Compass top right */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 z-[2020]">
        
        {/* Real-time Compass */}
        <div className="bg-zinc-900/80 backdrop-blur border border-zinc-700/50 p-2 rounded-xl shadow-lg flex items-center justify-center pointer-events-none">
           <div className="relative w-8 h-8 flex items-center justify-center">
             <div className="absolute text-[8px] font-bold text-zinc-400 top-0">N</div>
             <div className="absolute text-[8px] font-bold text-zinc-400 bottom-0">S</div>
             <Compass 
               className="w-5 h-5 text-emerald-400 transition-transform duration-500 ease-out" 
               style={{ transform: `rotate(${-displayHeading}deg)` }} 
             />
           </div>
        </div>

        {/* Small Mini-map block */}
        <div className="w-24 h-24 bg-zinc-900/80 backdrop-blur border border-zinc-700/50 rounded-xl shadow-lg p-1.5 flex flex-col gap-1 relative overflow-hidden">
           <div className="flex items-center gap-1 mb-0.5">
             <MapIcon className="w-3 h-3 text-zinc-400" />
             <span className="text-[8px] font-black tracking-widest text-zinc-400 uppercase">Minimap</span>
           </div>
           
           <div className="flex-1 bg-zinc-800 rounded flex flex-col justify-center items-center relative overflow-hidden h-full w-full">
              {isSimulated ? (
                <>
                  {/* Mock map content */}
                  <div className="absolute w-[2px] h-[200%] bg-zinc-400 left-1/2 -translate-x-1/2 transition-transform duration-1000 origin-bottom" style={{ transform: `rotate(${-mockHeading}deg)` }} />
                  {isWrongLane && (
                    <div className={`absolute top-4 h-[2px] w-6 bg-red-500 ${targetLane === 'left' ? 'right-1/2' : 'left-1/2'}`} />
                  )}
                  <div className="w-2 h-2 rounded-full bg-blue-500 absolute bottom-4 shadow-[0_0_8px_rgba(59,130,246,0.8)] z-10" />
                </>
              ) : (
                <>
                  {/* Real Grid System representation */}
                  <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(#9CA3AF 1px, transparent 1px), linear-gradient(90deg, #9CA3AF 1px, transparent 1px)', backgroundSize: '10px 10px' }} />
                  <div className="flex flex-col items-center justify-center absolute inset-0 gap-1 text-[7px] text-emerald-400 font-mono scale-90">
                     <span>{toDMS(snappedPos?.[0] || 0, true)}</span>
                     <span>{toDMS(snappedPos?.[1] || 0, false)}</span>
                  </div>
                  <div className="w-2 h-2 rounded-full border border-white bg-emerald-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 shadow-[0_0_8px_rgba(16,185,129,0.8)] z-10" />
                </>
              )}
           </div>
        </div>

      </div>

      {/* POI Labels Floating Left */}
      <div className="absolute left-4 top-4 flex flex-col gap-3 z-[2020]">
        
        {/* Connection Intel */}
        {!isSimulated && (
          <div className="bg-emerald-900/40 backdrop-blur border border-emerald-500/30 px-3 py-1.5 rounded-xl shadow-lg flex items-center justify-center gap-2 mb-2">
             <LocateFixed className="w-4 h-4 text-emerald-400" />
             <div className="flex flex-col">
               <span className="text-[9px] font-black uppercase tracking-widest text-emerald-200">GPS LINKED</span>
               <span className="text-[8px] tracking-wider text-emerald-400/80">Discrete Snapping</span>
             </div>
          </div>
        )}
        {(isSimulated && !isOnline) && (
          <div className="bg-red-900/40 backdrop-blur border border-red-500/30 px-3 py-1.5 rounded-xl shadow-lg flex items-center justify-center gap-2 mb-2">
             <LocateOff className="w-4 h-4 text-red-400 animate-pulse" />
             <div className="flex flex-col">
               <span className="text-[9px] font-black uppercase tracking-widest text-red-200">OFFLINE LINK</span>
               <span className="text-[8px] tracking-wider text-red-400/80">Running Cached</span>
             </div>
          </div>
        )}

        <div className="bg-zinc-900/80 backdrop-blur border border-zinc-700/50 p-2 rounded-xl shadow-lg flex items-center gap-2">
           <div className="w-6 h-6 bg-blue-600/20 text-blue-400 rounded flex items-center justify-center font-bold text-[10px]">M</div>
           <div className="flex flex-col">
             <span className="text-[9px] font-black uppercase tracking-widest text-zinc-300">Mode</span>
             <span className="text-[10px] text-zinc-400 tracking-wide font-medium uppercase">{trackingMode}</span>
           </div>
        </div>

        {/* Mock POI 1 */}
        <div className="bg-zinc-900/80 backdrop-blur border border-zinc-700/50 p-2 rounded-xl shadow-lg flex items-center gap-2">
           <div className="w-6 h-6 bg-amber-600/20 text-amber-500 rounded flex items-center justify-center font-bold text-[10px]">O</div>
           <div className="flex flex-col">
             <span className="text-[9px] font-black uppercase tracking-widest text-zinc-300">Gas Station</span>
             <span className="text-[10px] text-zinc-400">1.2 km</span>
           </div>
        </div>
        
        {/* Mock POI 2 */}
        <div className="bg-zinc-900/80 backdrop-blur border border-zinc-700/50 p-2 rounded-xl shadow-lg flex items-center gap-2">
           <div className="w-6 h-6 bg-emerald-600/20 text-emerald-500 rounded flex items-center justify-center font-bold text-[10px]">P</div>
           <div className="flex flex-col">
             <span className="text-[9px] font-black uppercase tracking-widest text-zinc-300">Park Hub</span>
             <span className="text-[10px] text-zinc-400">5.0 km</span>
           </div>
        </div>

      </div>

      {/* BOTTOM CONTROLS & MANUAL SIMULATION TOGGLES */}
      <div className="absolute bottom-6 w-full px-4 flex flex-col items-center gap-4 z-[2020]">
        
        {/* Info panel */}
        <div className="bg-zinc-900/90 backdrop-blur border border-zinc-700 p-3 rounded-2xl flex items-center gap-4 shadow-xl">
           <div className={`flex flex-col items-center pr-4 border-r border-zinc-700/50 ${!isSimulated ? 'text-emerald-400' : 'text-emerald-400'}`}>
             <span className="text-2xl font-mono font-black">{currentSpeed}</span>
             <span className="text-[9px] uppercase tracking-widest font-black text-zinc-500">KM/H</span>
           </div>
           
           <div className="flex flex-col text-left">
             <span className={`text-sm font-black tracking-widest uppercase flex items-center gap-1.5 ${isSimulated ? 'text-zinc-100' : 'text-emerald-400'}`}>
               <Navigation className={`w-3.5 h-3.5 ${isSimulated ? 'text-blue-400' : 'text-emerald-400'}`} /> 
               {isSimulated ? 'Simulation' : 'Real-time Linked'}
             </span>
             <span className="text-[10px] text-zinc-400 mt-0.5 tracking-wider font-medium max-w-[200px] truncate leading-tight">
               {isSimulated ? `${trackingMode} active. Auto/manual drive.` : 'Discrete milestones GPS feed active. Snap to route.'}
             </span>
           </div>

           <button 
             onClick={onClose}
             className="ml-auto md:ml-4 w-9 h-9 bg-red-600 hover:bg-red-700 text-white rounded-xl flex items-center justify-center transition-colors shadow-lg"
           >
             <X className="w-5 h-5" />
           </button>
        </div>

        {/* Manual drive bar */}
        <div className={`bg-zinc-950/90 backdrop-blur border border-zinc-800 p-1.5 rounded-2xl flex flex-wrap items-center justify-center gap-1 shadow-2xl overflow-x-auto w-full max-w-[360px] ${!isSimulated ? 'opacity-80 scale-95 pointer-events-none' : ''}`}>
          <button
            onClick={() => {
              setIsPlaying(false);
              setRoadOffset(prev => (prev - 5 + 100) % 100);
            }}
            className="w-10 h-10 bg-zinc-800 hover:bg-zinc-700 active:scale-95 transition-all rounded-xl flex items-center justify-center text-zinc-300"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`w-10 h-10 rounded-xl flex items-center justify-center active:scale-95 transition-all ${isPlaying ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' : 'bg-zinc-800 text-zinc-300'}`}
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
          </button>

          <button
            onClick={() => {
              setIsPlaying(false);
              setRoadOffset(prev => (prev + 5) % 100);
            }}
            className="w-10 h-10 bg-zinc-800 hover:bg-zinc-700 active:scale-95 transition-all rounded-xl flex items-center justify-center text-zinc-300"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          <div className="w-px h-6 bg-zinc-700 mx-1 hidden sm:block" />

          {/* Lane switches */}
          <div className="flex bg-zinc-900 rounded-xl p-0.5 ml-1">
            {(['left', 'center', 'right'] as const).map(lane => (
               <button
                  key={lane}
                  onClick={() => handleLaneChange(lane)}
                  className={`px-2 sm:px-3 py-2 rounded-lg text-[9px] sm:text-[10px] font-black tracking-widest uppercase transition-all ${
                    activeLane === lane ? 'bg-blue-600 text-white shadow-md' : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'
                  }`}
               >
                 {lane.slice(0, 3)}
               </button>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
};

