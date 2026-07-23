import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useMap, ImageOverlay } from 'react-leaflet';
import L from 'leaflet';
import { triangulateBounds } from '../lib/mathEngine';
import { Upload, Save, X, Image as ImageIcon, Settings2, Move, MapPin, Navigation } from 'lucide-react';
import { useConfigStore, useGPSStore } from '../lib/store';
import { Geolocation } from '@capacitor/geolocation';
import { db, Bookmark } from '../lib/db';
import { useLiveQuery } from 'dexie-react-hooks';

interface Props {
  isActive: boolean;
}

const ImageMapTool: React.FC<Props> = ({ isActive }) => {
  const map = useMap();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  
  const activeImageMapId = useConfigStore(state => state.activeImageMapId);
  const setActiveTool = useConfigStore(state => state.setActiveTool);
  const setActiveImageMapId = useConfigStore(state => state.setActiveImageMapId);

  const [setupStep, setSetupStep] = useState<'upload' | 'mode' | 'calibrate' | 'gps_1_img' | 'gps_1_loc' | 'gps_2_img' | 'gps_2_loc' | 'gps_solve'>('upload');
  const [uploading, setUploading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [mapName, setMapName] = useState('');
  const [opacity, setOpacity] = useState(0.6);
  const [scale, setScale] = useState(1);
  
  // GPS Triangulation State
  const [p1Img, setP1Img] = useState<{x: number, y: number} | null>(null);
  const [p2Img, setP2Img] = useState<{x: number, y: number} | null>(null);
  const [p1Geo, setP1Geo] = useState<{lat: number, lng: number} | null>(null);
  const [p2Geo, setP2Geo] = useState<{lat: number, lng: number} | null>(null);

  // Create an active bookmark listener
  const activeBookmark = useLiveQuery(
    () => activeImageMapId ? db.bookmarks.get(activeImageMapId) : Promise.resolve(null),
    [activeImageMapId]
  );

  useEffect(() => {
    if (!isActive) {
      setPreviewImage(null);
      setMapName('');
      setSetupStep('upload');
      setScale(1);
      setOpacity(0.6);
    }
  }, [isActive]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      if (event.target?.result) {
        setPreviewImage(event.target.result as string);
        setMapName(file.name.split('.')[0] || 'Custom Photo Map');
        setSetupStep('mode');
      }
      setUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleGPSImageTap = (e: React.MouseEvent<HTMLImageElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    
    if (setupStep === 'gps_1_img') {
      setP1Img({ x, y });
      setSetupStep('gps_1_loc');
    } else if (setupStep === 'gps_2_img') {
      setP2Img({ x, y });
      setSetupStep('gps_2_loc');
    }
  };

  const captureGPSLocation = async () => {
    const { isTracking, setTracking } = useGPSStore.getState();
    const { positionMode, setPositionMode } = useConfigStore.getState();
    
    // Auto-switch to GPS if currently "None/Off"
    let activeMode = positionMode;
    if (!isTracking) {
      setTracking(true);
      setPositionMode('gps');
      activeMode = 'gps';
    }

    setUploading(true);
    try {
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: activeMode === 'gps',
        timeout: 10000,
        maximumAge: activeMode === 'gps' ? 0 : 5000
      });
      setUploading(false);
      const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      
      if (setupStep === 'gps_1_loc') {
        setP1Geo(coords);
        setSetupStep('gps_2_img');
      } else if (setupStep === 'gps_2_loc') {
        setP2Geo(coords);
        setSetupStep('gps_solve');
      }
    } catch (err: any) {
      setUploading(false);
      alert("Failed to get location");
    }
  };

  const handleSolveGPSMap = async () => {
    if (!p1Img || !p2Img || !p1Geo || !p2Geo || !previewImage) return;
    try {
      const bounds = triangulateBounds(p1Img, p2Img, p1Geo, p2Geo);
      const newId = await db.bookmarks.add({
        name: mapName || 'Custom GPS Map',
        lat: p1Geo.lat,
        lng: p1Geo.lng,
        category: 'imagemap',
        note: '',
        savedAt: Date.now(),
        data: {
          image: previewImage,
          bounds: bounds
        }
      });
      setPreviewImage(null);
      setMapName('');
      setSetupStep('upload');
      setActiveImageMapId(newId as number);
    } catch (e: any) {
      alert(e.message || "Failed to triangulate points.");
      setSetupStep('gps_1_img');
    }
  };

  const handleSaveMap = async () => {
    if (!previewImage || !imgRef.current) return;

    const imgRect = imgRef.current.getBoundingClientRect();
    const mapRect = map.getContainer().getBoundingClientRect();
    
    // Calculate the coordinates of the image relative to the map container
    const nwPoint = L.point(imgRect.left - mapRect.left, imgRect.top - mapRect.top);
    const sePoint = L.point(imgRect.right - mapRect.left, imgRect.bottom - mapRect.top);
    
    // Project those pixel coordinates down to lat/lng on the current map view
    const nwLatLng = map.containerPointToLatLng(nwPoint);
    const seLatLng = map.containerPointToLatLng(sePoint);
    
    const boundArray = [
      [nwLatLng.lat, nwLatLng.lng],
      [seLatLng.lat, seLatLng.lng]
    ];

    try {
      const newId = await db.bookmarks.add({
        name: mapName || 'Custom Photo Map',
        lat: map.getCenter().lat,
        lng: map.getCenter().lng,
        category: 'imagemap',
        note: '',
        savedAt: Date.now(),
        data: {
          image: previewImage,
          bounds: boundArray
        }
      });
      
      setPreviewImage(null);
      setMapName('');
      setSetupStep('upload');
      setActiveImageMapId(newId as number);
    } catch (err) {
      console.error("Failed to save imagemap", err);
    }
  };

  const handleClose = () => {
    setActiveTool(null);
  };

  if (!isActive) return null;

  return (
    <>
      {/* Active Bookmark View - Act as replacing the basemap (1.0 opacity) */}
      {activeBookmark && activeBookmark.category === 'imagemap' && activeBookmark.data?.image && activeBookmark.data?.bounds && (
        <>
          <ImageOverlay
            url={activeBookmark.data.image}
            bounds={activeBookmark.data.bounds as L.LatLngBoundsExpression}
            opacity={1.0}
            zIndex={200}
          />
          {createPortal(
            <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[4000] bg-zinc-900/90 text-white px-4 py-2 rounded-full border border-zinc-700 backdrop-blur-md shadow-2xl flex items-center gap-3">
              <ImageIcon className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-bold uppercase tracking-widest">{activeBookmark.name}</span>
              <div className="w-px h-4 bg-zinc-700 mx-1" />
              <button 
                onClick={() => { setActiveImageMapId(null); setActiveTool(null); }}
                className="text-[10px] text-zinc-400 hover:text-white uppercase font-bold"
              >
                Close
              </button>
            </div>,
            document.body
          )}
        </>
      )}

      {/* Upload UI Flow - When no map is selected */}
      {!activeImageMapId && (
        <>
          {setupStep === 'upload' && createPortal(
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[4000] w-[320px] bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 p-6 flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/40 rounded-full flex items-center justify-center mb-4">
                <ImageIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h2 className="text-lg font-black text-zinc-900 dark:text-white mb-2 uppercase tracking-tight">Upload Photo Map</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-6">Select an image from your device to overlay on the map. You will be able to calibrate it to GPS coordinates.</p>
              
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 mb-3 transition-colors"
                disabled={uploading}
              >
                <Upload className="w-4 h-4" />
                {uploading ? 'LOADING...' : 'CHOOSE IMAGE'}
              </button>
              
              <button onClick={handleClose} className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 font-bold uppercase transition-colors">
                Cancel
              </button>
            </div>,
            document.body
          )}

          {setupStep === 'mode' && createPortal(
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[4000] w-[320px] bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 p-6 flex flex-col">
              <h2 className="text-lg font-black text-zinc-900 dark:text-white mb-1 uppercase tracking-tight">Calibration Mode</h2>
              <p className="text-[10px] text-zinc-500 mb-6">Choose how complex the map alignment needs to be.</p>
              
              <div className="flex flex-col gap-3">
                <button onClick={() => { setSetupStep('calibrate'); }} className="w-full text-left p-4 rounded-xl border-2 border-blue-500 bg-blue-50 dark:bg-blue-900/20 relative overflow-hidden transition-all hover:bg-blue-100 dark:hover:bg-blue-900/40">
                  <div className="absolute top-0 right-0 bg-blue-500 text-white text-[8px] font-black px-2 py-1 rounded-bl-lg uppercase">Recommended</div>
                  <div className="font-bold text-sm text-blue-900 dark:text-blue-100 mb-1">2-Point (Quick Align)</div>
                  <div className="text-[10px] text-blue-700/80 dark:text-blue-300/80 leading-snug">Good for flat maps where you just need to pinch, scale, and align two known intersections.</div>
                </button>

                <button onClick={() => setSetupStep('gps_1_img')} className="w-full text-left p-4 rounded-xl border-2 border-green-500 bg-green-50 dark:bg-green-900/20 relative overflow-hidden transition-all hover:bg-green-100 dark:hover:bg-green-900/40">
                  <div className="absolute top-0 right-0 bg-green-500 text-white text-[8px] font-black px-2 py-1 rounded-bl-lg uppercase">Precision Mode</div>
                  <div className="font-bold text-sm text-green-900 dark:text-green-100 mb-1">GPS Triangulation Survey</div>
                  <div className="text-[10px] text-green-700/80 dark:text-green-300/80 leading-snug">Walk to start point, then mark another point. Uses physical device movement to triangulate map alignment.</div>
                </button>
              </div>

              <button onClick={() => setSetupStep('upload')} className="mt-6 text-xs text-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 font-bold uppercase transition-colors">
                Back
              </button>
            </div>,
            document.body
          )}

          {setupStep === 'calibrate' && previewImage && createPortal(
            <>
              {/* Central Fixed Image Overlay for Calibration */}
              <div className="absolute inset-0 z-[5000] pointer-events-none flex items-center justify-center overflow-hidden">
                <img 
                  ref={imgRef}
                  src={previewImage} 
                  alt="Calibration" 
                  style={{ 
                    opacity: opacity,
                    transform: `scale(${scale})`,
                    transformOrigin: 'center'
                  }}
                  className="max-w-[70vw] max-h-[70vh] object-contain shadow-2xl"
                />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                   <Move className="w-6 h-6 text-blue-500/50" />
                </div>
              </div>

              {/* Calibration Control Panel */}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[5000] w-[90%] max-w-[340px] bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 p-4 pointer-events-auto">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/40 rounded-lg flex items-center justify-center">
                    <Settings2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black uppercase text-zinc-900 dark:text-white leading-tight">Align Map</h3>
                    <p className="text-[9px] text-zinc-500 dark:text-zinc-400">Pan/zoom the background map to match</p>
                  </div>
                </div>

                <div className="flex flex-col gap-4 mb-4">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase">Image Scale</span>
                      <span className="text-[9px] text-zinc-400">{scale.toFixed(2)}x</span>
                    </div>
                    <input 
                      type="range" 
                      min="0.2" max="3" step="0.05" 
                      value={scale} 
                      onChange={e => setScale(parseFloat(e.target.value))}
                      className="w-full accent-blue-500 h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer pointer-events-auto"
                    />
                  </div>
                  
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase">Transparency</span>
                      <span className="text-[9px] text-zinc-400">{Math.round(opacity * 100)}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0.1" max="1" step="0.05" 
                      value={opacity} 
                      onChange={e => setOpacity(parseFloat(e.target.value))}
                      className="w-full accent-blue-500 h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer pointer-events-auto"
                    />
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-zinc-500 uppercase mb-1 block">Map Name</span>
                    <input
                        type="text"
                        value={mapName}
                        onChange={(e) => setMapName(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg outline-none focus:border-blue-500 font-bold pointer-events-auto"
                        placeholder="E.g. Zoo Map"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <button onClick={() => setSetupStep('mode')} className="flex-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 font-bold text-xs py-3 rounded-xl uppercase transition-colors pointer-events-auto">
                    Back
                  </button>
                  <button onClick={handleSaveMap} className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 uppercase transition-colors pointer-events-auto">
                    <Save className="w-4 h-4" />
                    Save & Lock
                  </button>
                </div>
              </div>
            </>,
            document.body
          )}

          {(setupStep === 'gps_1_img' || setupStep === 'gps_2_img') && previewImage && createPortal(
            <>
              <div className="absolute inset-0 z-[5000] bg-zinc-900/95 flex flex-col items-center justify-center p-6">
                <h2 className="text-xl font-black text-white mb-2 uppercase tracking-tight">
                  {setupStep === 'gps_1_img' ? 'Tap Start Location' : 'Tap End Location'}
                </h2>
                <p className="text-sm text-zinc-400 mb-6 text-center max-w-md">
                  Tap exactly where you are currently standing on the map image. 
                </p>
                <div className="relative rounded-xl overflow-hidden shadow-2xl border border-zinc-700 bg-black cursor-crosshair">
                  <img 
                    src={previewImage} 
                    alt="GPS Map Tap" 
                    className="max-w-[90vw] max-h-[60vh] object-contain opacity-90 hover:opacity-100 transition-opacity"
                    onClick={handleGPSImageTap}
                  />
                  {p1Img && (
                    <div className="absolute w-4 h-4 bg-green-500 rounded-full border-2 border-white -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={{ left: `${p1Img.x * 100}%`, top: `${p1Img.y * 100}%`}} />
                  )}
                </div>
                <button onClick={() => setSetupStep('mode')} className="absolute bottom-10 text-xs text-zinc-400 hover:text-white font-bold uppercase" >
                  Cancel GPS Survey
                </button>
              </div>
            </>,
            document.body
          )}

          {(setupStep === 'gps_1_loc' || setupStep === 'gps_2_loc') && createPortal(
            <div className="absolute inset-0 z-[5000] bg-zinc-900/95 flex flex-col items-center justify-center p-6">
                <div className="w-16 h-16 bg-blue-900/40 rounded-full flex items-center justify-center mb-6">
                  <Navigation className={`w-8 h-8 text-blue-400 ${uploading ? 'animate-pulse' : ''}`} />
                </div>
                <h2 className="text-xl font-black text-white mb-2 uppercase tracking-tight text-center">
                  Get GPS Coordinates
                </h2>
                <p className="text-sm text-zinc-400 mb-8 text-center max-w-md">
                  Ensure you are standing exactly at the point you tapped.
                </p>
                <button 
                  onClick={captureGPSLocation}
                  disabled={uploading}
                  className="w-full max-w-xs bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-3 shadow-lg shadow-blue-500/20 mb-4 transition-colors text-lg"
                >
                  <MapPin className="w-5 h-5" />
                  {uploading ? 'ACQUIRING SIGNAL...' : 'LOCK GPS HERE'}
                </button>
                <button onClick={() => setSetupStep('mode')} className="text-xs text-zinc-400 hover:text-white font-bold uppercase mt-4" >
                  Cancel GPS Survey
                </button>
            </div>,
            document.body
          )}

          {setupStep === 'gps_solve' && createPortal(
            <div className="absolute inset-0 z-[5000] bg-zinc-900/95 flex flex-col items-center justify-center p-6">
                <h2 className="text-xl font-black text-white mb-2 uppercase tracking-tight text-center">
                  Survey Complete
                </h2>
                <p className="text-sm text-green-400 mb-8 text-center max-w-md">
                  We have mapped your image to physical reality!
                </p>
                
                <div className="w-full max-w-xs mb-8">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1 block">Name This Map</label>
                  <input
                      type="text"
                      value={mapName}
                      onChange={(e) => setMapName(e.target.value)}
                      className="w-full px-4 py-3 text-lg bg-zinc-800 border border-zinc-700 rounded-xl outline-none focus:border-green-500 text-white font-bold"
                      placeholder="E.g. Festival Grounds"
                  />
                </div>

                <button 
                  onClick={handleSolveGPSMap}
                  className="w-full max-w-xs bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-3 shadow-lg shadow-green-500/20 mb-4 transition-colors text-lg uppercase"
                >
                  <Save className="w-5 h-5" />
                  Triangulate & Save
                </button>
            </div>,
            document.body
          )}

          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/jpeg, image/png, image/webp" 
            onChange={handleFileUpload} 
          />
        </>
      )}
    </>
  );
};

export default ImageMapTool;
