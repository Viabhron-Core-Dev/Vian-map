import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { useConfigStore, useGPSStore, useMapStore } from '../lib/store';
import { MAP_LAYERS, OfflineTileLayer } from '../lib/OfflineLayer';
import { Compass, Navigation2, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Crosshair, Navigation } from 'lucide-react';
import IntelOverlay from './IntelOverlay';
import TagOverlay from './TagOverlay';
import VianVectorRoads from './VianVectorRoads';
import MapNavigationOverlay from './MapNavigationOverlay';

const LayerManager: React.FC = () => {
  const map = useMap();
  const activeLayerId = useConfigStore(s => s.activeLayerId);
  const isOnline = useConfigStore(s => s.isOnline);
  const layerRef = useRef<OfflineTileLayer | null>(null);

  useEffect(() => {
    if (layerRef.current) map.removeLayer(layerRef.current);
    
    const layerConfig = MAP_LAYERS[activeLayerId as keyof typeof MAP_LAYERS] || MAP_LAYERS.vianap;
    const url = layerConfig.url;
    
    const layer = new OfflineTileLayer(url, layerConfig.id, {
      maxZoom: layerConfig.maxZoom || 19,
      minZoom: 1,
      attribution: layerConfig.attribution,
      noCache: layerConfig.noCache,
      detectRetina: true,
      className: 'transition-opacity duration-300'
    });
    
    layerRef.current = layer;
    layer.addTo(map);

    return () => {
      if (layerRef.current) map.removeLayer(layerRef.current);
    };
  }, [activeLayerId, isOnline, map]);

  return null;
};

const GPSMarker: React.FC = () => {
  const map = useMap();
  const position = useGPSStore(s => s.position);
  const heading = useGPSStore(s => s.heading);
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!position || isNaN(position[0]) || isNaN(position[1])) return;

    if (!markerRef.current) {
      const icon = L.divIcon({
        className: 'gps-marker-container',
        html: `
          <div class="relative flex items-center justify-center">
            <div class="w-6 h-6 bg-blue-500 rounded-full border-2 border-white shadow-lg z-10"></div>
            <div class="absolute w-12 h-12 bg-blue-500/20 rounded-full animate-ping pointer-events-none"></div>
            ${heading !== null ? `<div class="absolute w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[12px] border-b-blue-600 -top-3 gps-heading-arrow pointer-events-none" style="transform: rotate(${heading}deg); transform-origin: 50% 24px;"></div>` : ''}
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      markerRef.current = L.marker([position[0], position[1]], {
        icon,
        zIndexOffset: 1000
      }).addTo(map);
    } else {
      markerRef.current.setLatLng([position[0], position[1]]);
      if (heading !== null) {
        const el = markerRef.current.getElement();
        if (el) {
          const arrow = el.querySelector('.gps-heading-arrow') as HTMLElement;
          if (arrow) {
            arrow.style.transform = `rotate(${heading}deg)`;
          } else {
            // Re-render icon if heading just became available
            const icon = L.divIcon({
              className: 'gps-marker-container',
              html: `
                <div class="relative flex items-center justify-center">
                  <div class="w-6 h-6 bg-blue-500 rounded-full border-2 border-white shadow-lg z-10"></div>
                  <div class="absolute w-12 h-12 bg-blue-500/20 rounded-full animate-ping pointer-events-none"></div>
                  <div class="absolute w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[12px] border-b-blue-600 -top-3 gps-heading-arrow pointer-events-none" style="transform: rotate(${heading}deg); transform-origin: 50% 24px;"></div>
                </div>
              `,
              iconSize: [24, 24],
              iconAnchor: [12, 12]
            });
            markerRef.current.setIcon(icon);
          }
        }
      }
    }

    return () => {
      if (markerRef.current) {
        map.removeLayer(markerRef.current);
        markerRef.current = null;
      }
    };
  }, [position, heading, map]);

  return null;
};

const WidgetControls: React.FC = () => {
  const map = useMap();
  const { isTracking, setTracking, position } = useGPSStore();
  const { positionMode, setPositionMode } = useConfigStore();
  const [mapRotation, setMapRotation] = useState(0);

  const panMap = (dx: number, dy: number) => {
    map.panBy([dx, dy], { animate: true, duration: 0.25 });
  };

  const handleGPSToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isTracking) {
      setTracking(true);
      setPositionMode('gps');
    } else if (positionMode === 'gps') {
      setPositionMode('location');
    } else {
      setTracking(false);
      setPositionMode('gps');
    }
    
    // Attempt to center map on GPS if toggled on
    if (position) {
      map.setView([position[0], position[1]], map.getZoom(), { animate: true });
    }
  };

  const handleCompassClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMapRotation(0);
    const container = map.getContainer();
    container.style.transform = `rotate(0deg)`;
  };

  return (
    <div className="absolute inset-0 z-[2000] pointer-events-none">
      {/* Compass */}
      <div 
        className="absolute top-2 left-1/2 -translate-x-1/2 pointer-events-auto bg-black/50 backdrop-blur rounded-full p-1 border border-zinc-700/50 cursor-pointer text-zinc-300 hover:text-white"
        onClick={handleCompassClick}
      >
        <Navigation className="w-4 h-4 text-amber-500" />
      </div>

      {/* GPS Toggle */}
      <div 
        className="absolute bottom-2 right-2 pointer-events-auto bg-black/50 backdrop-blur rounded-full p-2 border border-zinc-700/50 cursor-pointer shadow-lg"
        onClick={handleGPSToggle}
      >
        {!isTracking ? (
          <Crosshair className="w-6 h-6 text-zinc-400" />
        ) : positionMode === 'gps' ? (
          <Crosshair className="w-6 h-6 text-blue-500 animate-pulse" />
        ) : (
          <Navigation2 className="w-6 h-6 text-blue-500 fill-blue-500" />
        )}
      </div>

      {/* Pan Arrows */}
      <div 
        className="absolute top-2 left-2 pointer-events-auto bg-black/30 hover:bg-black/50 backdrop-blur rounded p-1 cursor-pointer"
        onClick={(e) => { e.stopPropagation(); panMap(0, -100); }}
      >
        <ChevronUp className="w-6 h-6 text-white" />
      </div>
      <div 
        className="absolute bottom-2 left-2 pointer-events-auto bg-black/30 hover:bg-black/50 backdrop-blur rounded p-1 cursor-pointer"
        onClick={(e) => { e.stopPropagation(); panMap(0, 100); }}
      >
        <ChevronDown className="w-6 h-6 text-white" />
      </div>
      <div 
        className="absolute top-1/2 left-2 -translate-y-1/2 pointer-events-auto bg-black/30 hover:bg-black/50 backdrop-blur rounded p-1 cursor-pointer"
        onClick={(e) => { e.stopPropagation(); panMap(-100, 0); }}
      >
        <ChevronLeft className="w-6 h-6 text-white" />
      </div>
      <div 
        className="absolute top-1/2 right-2 -translate-y-1/2 pointer-events-auto bg-black/30 hover:bg-black/50 backdrop-blur rounded p-1 cursor-pointer"
        onClick={(e) => { e.stopPropagation(); panMap(100, 0); }}
      >
        <ChevronRight className="w-6 h-6 text-white" />
      </div>
    </div>
  );
};

interface MapWidgetProps {
  onWake: () => void;
}

const MapClickWake: React.FC<{ onWake: () => void }> = ({ onWake }) => {
  useMapEvents({
    click: () => {
      onWake();
    }
  });
  return null;
};

const MapWidget: React.FC<MapWidgetProps> = ({ onWake }) => {
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

  const handleMapTap = () => {
    window.history.replaceState({}, '', window.location.pathname + '?fromWidget=true');
    onWake();
  };

  return (
    <div className="w-full h-screen bg-zinc-950 relative overflow-hidden">
      <MapContainer
        center={initialView.center}
        zoom={initialView.zoom}
        zoomControl={false}
        className="w-full h-full"
        attributionControl={false}
        preferCanvas={true}
      >
        <MapClickWake onWake={handleMapTap} />
        <LayerManager />
        <MapNavigationOverlay />
        <TagOverlay />
        <GPSMarker />
        <WidgetControls />
      </MapContainer>
    </div>
  );
};

export default MapWidget;
