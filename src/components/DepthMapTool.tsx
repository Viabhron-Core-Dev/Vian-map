import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMap, TileLayer } from 'react-leaflet';
import { Layers, X, Loader2, ChevronDown, Check, Anchor, Sprout, CloudRain, Wind } from 'lucide-react';
import { useConfigStore } from '../lib/store';

export const DepthMapTool: React.FC<{ isActive: boolean }> = ({ isActive }) => {
  const map = useMap();
  const { setActiveTool } = useConfigStore();
  const [depthOverlay, setDepthOverlay] = useState<string>('topo');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [gibsDate, setGibsDate] = useState('');
  const [rainviewerTime, setRainviewerTime] = useState<number | null>(null);

  useEffect(() => {
    if (!isActive) return;
    const d = new Date();
    d.setDate(d.getDate() - 8);
    setGibsDate(d.toISOString().split('T')[0]);

    fetch('https://api.rainviewer.com/public/weather-maps.json')
      .then(r => r.json())
      .then(data => {
        if (data && data.radar && data.radar.past && data.radar.past.length > 0) {
          setRainviewerTime(data.radar.past[data.radar.past.length - 1].time);
        }
      })
      .catch(e => console.warn("Failed to fetch rainviewer data:", e.message));
  }, [isActive]);

  if (!isActive) return null;

  const overlays = [
    { id: 'topo', name: 'Elevation (Topo)', icon: Layers },
    { id: 'nautical', name: 'Nautical Map', icon: Anchor },
    { id: 'vegetation', name: 'Vegetation (NDVI)', icon: Sprout },
    { id: 'precipitation', name: 'Weather Radar', icon: CloudRain },
    { id: 'aqi', name: 'Air Quality (AQI)', icon: Wind },
  ];

  const activeOverlay = overlays.find(o => o.id === depthOverlay) || overlays[0];
  const Icon = activeOverlay.icon;

  const ui = createPortal(
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[3000] flex flex-col items-center gap-2 pointer-events-none">
      <div className="flex items-center gap-2 pointer-events-auto">
        <button
          onClick={() => setActiveTool(null)}
          className="p-3 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md text-zinc-700 dark:text-zinc-300 rounded-xl shadow-lg border border-black/5 dark:border-white/5 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="relative">
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="flex items-center gap-3 px-4 py-3 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md rounded-xl shadow-lg border border-black/5 dark:border-white/5 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors min-w-[200px]"
          >
            <div className="flex items-center gap-3 flex-1">
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
              ) : (
                <Icon className={`w-5 h-5 ${isError ? 'text-red-500' : 'text-blue-500'}`} />
              )}
              <div className="flex flex-col items-start -gap-1">
                <span className={`text-[10px] font-black uppercase tracking-wider ${isError ? 'text-red-500' : 'text-zinc-500'}`}>
                  {isError ? 'FAILED TO LOAD' : 'ACTIVE DEPTH MAP'}
                </span>
                <span className={`text-sm font-bold ${isError ? 'text-red-600' : 'text-zinc-900 dark:text-zinc-100'}`}>
                  {activeOverlay.name}
                </span>
              </div>
            </div>
            <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} />
          </button>
          
          {isMenuOpen && (
            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-full bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-black/5 dark:border-white/10 overflow-hidden py-1">
              {overlays.map(overlay => (
                <button
                  key={overlay.id}
                  onClick={() => {
                    setDepthOverlay(overlay.id);
                    setIsMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors ${
                    depthOverlay === overlay.id ? 'bg-zinc-50 dark:bg-zinc-800/50' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <overlay.icon className={`w-4 h-4 ${depthOverlay === overlay.id ? 'text-blue-500' : 'text-zinc-400'}`} />
                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{overlay.name}</span>
                  </div>
                  {depthOverlay === overlay.id && <Check className="w-4 h-4 text-blue-500" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );

  return (
    <>
      {ui}
      
      {/* Light reference map for transparent overlays so panning isn't "stuck" on a blank screen */}
      {depthOverlay !== 'topo' && (
        <TileLayer
          key="reference-basemap"
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution="&copy; CARTO"
          maxZoom={20}
          opacity={0.8}
          zIndex={5}
        />
      )}

      {depthOverlay === 'topo' && (
        <TileLayer
          key="topo"
          url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenTopoMap"
          maxZoom={20}
          maxNativeZoom={17}
          opacity={1}
          zIndex={10}
          eventHandlers={{
            loading: () => setIsLoading(true),
            load: () => { setIsLoading(false); setIsError(false); },
            tileerror: () => { setIsLoading(false); setIsError(true); }
          }}
        />
      )}
      {depthOverlay === 'nautical' && (
        <TileLayer
          key="nautical"
          url="https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png"
          attribution="&copy; OpenSeaMap"
          maxZoom={20}
          maxNativeZoom={18}
          opacity={1}
          zIndex={10}
          eventHandlers={{
            loading: () => setIsLoading(true),
            load: () => { setIsLoading(false); setIsError(false); },
            tileerror: () => { setIsLoading(false); setIsError(true); }
          }}
        />
      )}
      {depthOverlay === 'vegetation' && gibsDate && (
        <TileLayer
          key="vegetation"
          url={`https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_NDVI_8Day/default/${gibsDate}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.png`}
          attribution="&copy; NASA GIBS"
          maxZoom={20}
          maxNativeZoom={9}
          opacity={0.7}
          zIndex={10}
          eventHandlers={{
            loading: () => setIsLoading(true),
            load: () => { setIsLoading(false); setIsError(false); },
            tileerror: () => { setIsLoading(false); setIsError(true); }
          }}
        />
      )}
      {depthOverlay === 'precipitation' && rainviewerTime && (
        <TileLayer
          key="precipitation"
          url={`https://tilecache.rainviewer.com/v2/radar/${rainviewerTime}/256/{z}/{x}/{y}/2/1_1.png`}
          attribution="&copy; RainViewer"
          maxZoom={20}
          maxNativeZoom={18}
          opacity={0.8}
          zIndex={10}
          eventHandlers={{
            loading: () => setIsLoading(true),
            load: () => { setIsLoading(false); setIsError(false); },
            tileerror: () => { setIsLoading(false); setIsError(true); }
          }}
        />
      )}
      {depthOverlay === 'aqi' && (
        <TileLayer
          key="aqi"
          url="https://tiles.aqicn.org/tiles/usepa-aqi/{z}/{x}/{y}.png"
          attribution="&copy; Air Quality Open Data Platform"
          maxZoom={20}
          maxNativeZoom={15}
          opacity={1}
          zIndex={10}
          eventHandlers={{
            loading: () => setIsLoading(true),
            load: () => { setIsLoading(false); setIsError(false); },
            tileerror: () => { setIsLoading(false); setIsError(true); }
          }}
        />
      )}
    </>
  );
};

export default DepthMapTool;
