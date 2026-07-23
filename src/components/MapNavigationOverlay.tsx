import React, { useEffect, useState } from 'react';
import { Polyline, Tooltip } from 'react-leaflet';
import { useGPSStore, useMapStore } from '../lib/store';
import L from 'leaflet';

const MapNavigationOverlay: React.FC = () => {
    const position = useGPSStore(s => s.position);
    const [target, setTarget] = useState<[number, number] | null>(null);

    useEffect(() => {
        const handleTarget = (e: any) => {
            setTarget(e.detail);
        };
        window.addEventListener('map-set-target', handleTarget);
        return () => window.removeEventListener('map-set-target', handleTarget);
    }, []);

    if (!position || !target) return null;

    // Calculate Bearing
    const getBearing = (start: [number, number], end: [number, number]) => {
        const startLat = start[0] * Math.PI / 180;
        const startLng = start[1] * Math.PI / 180;
        const endLat = end[0] * Math.PI / 180;
        const endLng = end[1] * Math.PI / 180;
        const y = Math.sin(endLng - startLng) * Math.cos(endLat);
        const x = Math.cos(startLat) * Math.sin(endLat) -
                Math.sin(startLat) * Math.cos(endLat) * Math.cos(endLng - startLng);
        const bearing = Math.atan2(y, x) * 180 / Math.PI;
        return (bearing + 360) % 360;
    };

    const dist = L.latLng(position).distanceTo(target);
    const bearing = getBearing(position, target);

    return (
        <Polyline 
            positions={[position, target]}
            pathOptions={{ 
                color: '#3b82f6', 
                dashArray: '10, 10', 
                weight: 2,
                opacity: 0.6
            }}
        >
            <Tooltip permanent direction="top" offset={[0, -20]} className="tactical-tooltip">
                <div className="bg-zinc-900/90 border border-blue-500/50 px-2 py-1 rounded text-white text-[10px] font-black tactical-font flex flex-col items-center">
                    <span>{dist > 1000 ? (dist/1000).toFixed(2) + 'km' : Math.round(dist) + 'm'}</span>
                    <span className="text-blue-400">{Math.round(bearing)}° BRG</span>
                </div>
            </Tooltip>
        </Polyline>
    );
};

export default MapNavigationOverlay;
