import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useMap, TileLayer } from 'react-leaflet';
import { Layers, X, Loader2, ChevronDown, Check } from 'lucide-react';
import { useConfigStore } from '../lib/store';

export const DepthMapTool: React.FC<{ isActive: boolean }> = ({ isActive }) => {
  const map = useMap();
  const { depthOverlay, setDepthOverlay, openWeatherMapKey } = useConfigStore();
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [rainviewerTime, setRainviewerTime] = useState<number | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const gibsDate = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 14 days ago for stable NDVI

  const options: { id: string, label: string, source: string, requireOwm?: boolean }[] = [
    { id: 'topo', label: 'Topo Data (Contours / Terrain)', source: 'OpenTopoMap' },
    { id: 'nautical', label: 'Nautical Depths', source: 'OpenSeaMap' },
    { id: 'weather', label: 'Weather (Precipitation)', source: openWeatherMapKey ? 'OpenWeatherMap' : 'RainViewer' },
    { id: 'vegetation', label: 'Vegetation Index', source: 'NASA GIBS' },
    { id: 'clouds', label: 'Cloud Cover', source: 'OpenWeatherMap', requireOwm: true },
    { id: 'wind', label: 'Wind Speed', source: 'OpenWeatherMap', requireOwm: true },
    { id: 'temperature', label: 'Temperature Heat Map', source: 'OpenWeatherMap', requireOwm: true },
  ];

  useEffect(() => {
    if (isActive && depthOverlay === 'weather' && !openWeatherMapKey && !rainviewerTime) {
      setIsLoading(true);
      fetch('https://api.rainviewer.com/public/weather-maps.json')
        .then(res => res.json())
        .then(data => {
          if (data && data.radar && data.radar.past && data.radar.past.length > 0) {
            setRainviewerTime(data.radar.past[data.radar.past.length - 1].time);
          }
        })
        .catch(() => setIsError(true))
        .finally(() => setIsLoading(false));
    }
  }, [isActive, depthOverlay, openWeatherMapKey, rainviewerTime]);

  useEffect(() => {
    if (isActive && depthOverlay === 'none') {
      setDepthOverlay('topo'); // Default to topo when first activated
    }
    // reset error when overlay switches
    setIsError(false);
  }, [isActive, depthOverlay, setDepthOverlay]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDropdownOpen]);

  if (!isActive) return null;

  const selectedOption = options.find(o => o.id === depthOverlay) || options[0];

  const ui = createPortal(
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[2000] bg-zinc-950/95 backdrop-blur-md rounded-xl border border-zinc-800 p-4 flex flex-col gap-3 min-w-[300px] shadow-2xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-zinc-100 font-bold text-xs uppercase tracking-wider">
          <Layers className="w-4 h-4 text-blue-500" />
          <span>Depth Maps</span>
          {isLoading && <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />}
        </div>
        <button 
          onClick={() => {
            setDepthOverlay('none');
            window.dispatchEvent(new CustomEvent('tools-close', { detail: 'depth' }));
          }} 
          className="p-1 hover:bg-zinc-800 rounded bg-zinc-900 border border-zinc-700 transition-colors"
        >
          <X className="w-4 h-4 text-zinc-400" />
        </button>
      </div>

      <div className="relative mt-1" ref={dropdownRef}>
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-left transition-colors ${
            isError ? 'border-red-500/50 bg-red-500/10' : 'bg-zinc-900 border-zinc-700 hover:border-zinc-600'
          }`}
        >
          <div className="flex flex-col">
            <span className={`text-[11px] font-bold uppercase tracking-wide ${isError ? 'text-red-400' : 'text-zinc-100'}`}>
              {selectedOption.label}
            </span>
            <span className="text-[9px] text-zinc-500 uppercase tracking-wider mt-0.5">
              Source: {selectedOption.source}
            </span>
          </div>
          <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
        </button>

        {isDropdownOpen && (
          <div className="absolute bottom-full left-0 w-full mb-2 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl overflow-hidden z-10 flex flex-col max-h-[220px] overflow-y-auto">
            {options.map(option => {
              const disabled = option.requireOwm && !openWeatherMapKey;
              return (
                <button
                  key={option.id}
                  disabled={disabled}
                  onClick={() => {
                    setDepthOverlay(option.id as any);
                    setIsDropdownOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-left transition-colors border-b border-zinc-800 last:border-b-0 ${
                    disabled
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:bg-zinc-800'
                  }`}
                >
                  <div className="flex flex-col">
                    <span className={`text-[10px] font-bold uppercase tracking-wide ${depthOverlay === option.id ? 'text-blue-400' : 'text-zinc-300'}`}>
                      {option.label}
                    </span>
                    <span className="text-[8px] text-zinc-500 uppercase tracking-wider">
                      {disabled ? 'Requires OpenWeatherMap Key' : option.source}
                    </span>
                  </div>
                  {depthOverlay === option.id && <Check className="w-3.5 h-3.5 text-blue-500" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
      
      {isError && (
        <div className="text-[10px] text-red-500 font-bold uppercase text-center mt-1 bg-red-500/10 py-1 rounded">
          Tile Service Error or Unavailable
        </div>
      )}
    </div>,
    document.body
  );

  return (
    <>
      {ui}
      {depthOverlay === 'topo' && (
        <TileLayer
          key="topo"
          url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenTopoMap'
          maxZoom={17}
          opacity={0.8}
          zIndex={10}
          eventHandlers={{ loading: () => setIsLoading(true), load: () => { setIsLoading(false); setIsError(false); }, tileerror: () => { setIsLoading(false); setIsError(true); } }}
        />
      )}
      {depthOverlay === 'nautical' && (
        <TileLayer
          key="nautical"
          url="https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png"
          attribution='&copy; OpenSeaMap'
          maxZoom={18}
          opacity={0.8}
          zIndex={10}
          eventHandlers={{ loading: () => setIsLoading(true), load: () => { setIsLoading(false); setIsError(false); }, tileerror: () => { setIsLoading(false); setIsError(true); } }}
        />
      )}
      {depthOverlay === 'vegetation' && (
        <TileLayer
          key="vegetation"
          url={`https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_NDVI_8Day/default/${gibsDate}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.png`}
          attribution='&copy; NASA GIBS'
          maxZoom={9}
          opacity={0.6}
          zIndex={10}
          eventHandlers={{ loading: () => setIsLoading(true), load: () => { setIsLoading(false); setIsError(false); }, tileerror: () => { setIsLoading(false); setIsError(true); } }}
        />
      )}
      {depthOverlay === 'weather' && (
        openWeatherMapKey ? (
          <TileLayer
            key="owm-precip"
            url={`https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${openWeatherMapKey}`}
            attribution='&copy; OpenWeatherMap'
            maxZoom={18}
            opacity={0.8}
            zIndex={10}
            eventHandlers={{ loading: () => setIsLoading(true), load: () => { setIsLoading(false); setIsError(false); }, tileerror: () => { setIsLoading(false); setIsError(true); } }}
          />
        ) : rainviewerTime ? (
          <TileLayer
            key="rainviewer"
            url={`https://tilecache.rainviewer.com/v2/radar/${rainviewerTime}/256/{z}/{x}/{y}/2/1_1.png`}
            attribution='&copy; RainViewer'
            maxZoom={18}
            opacity={0.8}
            zIndex={10}
            eventHandlers={{ loading: () => setIsLoading(true), load: () => { setIsLoading(false); setIsError(false); }, tileerror: () => { setIsLoading(false); setIsError(true); } }}
          />
        ) : null
      )}
      {depthOverlay === 'clouds' && openWeatherMapKey && (
        <TileLayer
          key="owm-clouds"
          url={`https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=${openWeatherMapKey}`}
          attribution='&copy; OpenWeatherMap'
          maxZoom={18}
          opacity={0.8}
          zIndex={10}
          eventHandlers={{ loading: () => setIsLoading(true), load: () => { setIsLoading(false); setIsError(false); }, tileerror: () => { setIsLoading(false); setIsError(true); } }}
        />
      )}
      {depthOverlay === 'wind' && openWeatherMapKey && (
        <TileLayer
          key="owm-wind"
          url={`https://tile.openweathermap.org/map/wind_new/{z}/{x}/{y}.png?appid=${openWeatherMapKey}`}
          attribution='&copy; OpenWeatherMap'
          maxZoom={18}
          opacity={0.7}
          zIndex={10}
          eventHandlers={{ loading: () => setIsLoading(true), load: () => { setIsLoading(false); setIsError(false); }, tileerror: () => { setIsLoading(false); setIsError(true); } }}
        />
      )}
      {depthOverlay === 'temperature' && openWeatherMapKey && (
        <TileLayer
          key="owm-temp"
          url={`https://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png?appid=${openWeatherMapKey}`}
          attribution='&copy; OpenWeatherMap'
          maxZoom={18}
          opacity={0.5}
          zIndex={10}
          eventHandlers={{ loading: () => setIsLoading(true), load: () => { setIsLoading(false); setIsError(false); }, tileerror: () => { setIsLoading(false); setIsError(true); } }}
        />
      )}
    </>
  );
};

export default DepthMapTool;
