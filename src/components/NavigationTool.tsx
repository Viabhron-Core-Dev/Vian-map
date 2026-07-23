import React, { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { useConfigStore } from '../lib/store';

interface NavigationToolProps {
  isActive: boolean;
}

const NavigationTool: React.FC<NavigationToolProps> = ({ isActive }) => {
  const map = useMap();
  const routePath = useConfigStore(s => s.navRoutePath);
  const destination = useConfigStore(s => s.navDestination);

  // Draw Route Effect
  useEffect(() => {
    if (!isActive || routePath.length === 0) return;

    // Glowing path effect
    const outerPath = L.polyline(routePath, { color: '#3b82f6', weight: 8, opacity: 0.3 }).addTo(map);
    const innerPath = L.polyline(routePath, { color: '#60a5fa', weight: 4, opacity: 1, dashArray: '10, 10' }).addTo(map);

    let destMarker: L.Marker | null = null;
    if (destination) {
        destMarker = L.marker(destination, {
            icon: L.divIcon({
                className: 'dest-marker',
                html: `<div class="w-4 h-4 bg-red-500 rounded-full border-2 border-white shadow-lg animate-bounce"></div>`,
                iconSize: [16, 16],
                iconAnchor: [8, 16]
            })
        }).addTo(map);
    }

    return () => {
      outerPath.remove();
      innerPath.remove();
      if (destMarker) destMarker.remove();
    };
  }, [isActive, routePath, map, destination]);

  return null;
};

export default NavigationTool;
