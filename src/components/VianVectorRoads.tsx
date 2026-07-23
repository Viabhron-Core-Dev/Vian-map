import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useConfigStore } from '../lib/store';
import { db, VectorRoadRecord } from '../lib/db';

interface OSMWay {
  id: number;
  nodes: number[];
  geometry: { lat: number, lon: number }[];
  tags: Record<string, string>;
}

export const VianVectorRoads: React.FC = () => {
  const map = useMap();
  const activeLayerId = useConfigStore(s => s.activeLayerId);
  const isOnline = useConfigStore(s => s.isOnline);
  const activeTool = useConfigStore(s => s.activeTool);
  
  const [waysMap, setWaysMap] = useState<Map<number, OSMWay>>(new Map());
  const loading = useRef(false);
  const cacheBox = useRef<L.LatLngBounds | null>(null);
  const fetchTimeout = useRef<NodeJS.Timeout>();

  const loadRoads = useCallback(async () => {
    if (activeLayerId !== 'vianap') {
       // Clear out if we switch away from vianap
       if (waysMap.size > 0) {
           setWaysMap(new Map());
           cacheBox.current = null;
       }
       return;
    }

    const zoom = map.getZoom();
    
    // Clear out if we zoom too far out to save memory, but keep a wide buffer
    if (zoom < 13) {
       setWaysMap(new Map());
       cacheBox.current = null;
       return; 
    }

    // Only fetch new data if zoomed in enough
    if (zoom < 14) return;

    const bounds = map.getBounds();
    // Only fetch if we've moved significantly outside our last fetched cachebox
    if (cacheBox.current && cacheBox.current.contains(bounds)) {
       return;
    }

    if (loading.current) return;
    loading.current = true;

    // Expand bounds significantly to create a large seamless buffer
    const padLat = (bounds.getNorth() - bounds.getSouth()) * 1.5;
    const padLng = (bounds.getEast() - bounds.getWest()) * 1.5;
    
    const fetchBounds = L.latLngBounds(
      L.latLng(bounds.getSouth() - padLat, bounds.getWest() - padLng),
      L.latLng(bounds.getNorth() + padLat, bounds.getEast() + padLng)
    );

    const s = fetchBounds.getSouth();
    const w = fetchBounds.getWest();
    const n = fetchBounds.getNorth();
    const e = fetchBounds.getEast();

    try {
      if (isOnline) {
        // Prevent spamming overpass if it recently failed
        const now = Date.now();
        const overpassApiThrottled = (window as any).__lastOverpassError && (now - (window as any).__lastOverpassError < 15000);
        
        if (overpassApiThrottled) {
             return;
        }

        const query = `
          [out:json];
          way[highway](${s},${w},${n},${e});
          out geom;
        `;
        const res = await fetch('https://overpass-api.de/api/interpreter', {
          method: 'POST',
          body: query
        });
        const text = await res.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch (e) {
          console.warn("Overpass API returned non-JSON:", text.substring(0, 100));
          throw new Error("Overpass rate limit or error");
        }

        if (data.elements) {
          const newRecords: VectorRoadRecord[] = [];
          setWaysMap(prev => {
            const nextMap = new Map(prev);
            data.elements
              .filter((el: any) => el.type === 'way' && el.geometry)
              .forEach((el: any) => {
                 const way = {
                   id: el.id,
                   nodes: el.nodes,
                   geometry: el.geometry,
                   tags: el.tags || {}
                 };
                 nextMap.set(el.id, way);
                 newRecords.push({ ...way, timestamp: Date.now() });
              });
            return nextMap;
          });
          
          // Optionally cache them if we are online so offline will work automatically
          if (newRecords.length > 0) {
             // In a real app we'd debounce DB writes, but bulkPut is fast
             db.vectorRoads.bulkPut(newRecords).catch(e => console.error(e));
          }
          cacheBox.current = fetchBounds;
        }
      } else {
        // Offline: Load from IndexedDB
        // Since Dexie doesn't have a simple 2D spatial query easily without an R-tree plugin,
        // we'll fetch all roads and filter in memory. For huge offline caches, this would need optimization.
        const allCached = await db.vectorRoads.toArray();
        const inBounds = allCached.filter(r => {
           // check if any geometry point is inside the bounding box
           return r.geometry.some(pt => 
             pt.lat >= s && pt.lat <= n && pt.lon >= w && pt.lon <= e
           );
        });
        
        setWaysMap(prev => {
           const nextMap = new Map(prev);
           inBounds.forEach(way => nextMap.set(way.id, way));
           return nextMap;
        });
        cacheBox.current = fetchBounds;
      }
    } catch (err) {
      if (isOnline) {
          (window as any).__lastOverpassError = Date.now();
      }
      console.warn("Vector Roads Fetch Error:", err);
    } finally {
      loading.current = false;
    }
  }, [map, isOnline, activeLayerId]);

  useEffect(() => {
    // Initial load
    loadRoads();

    const handleMoveEnd = () => {
      if (fetchTimeout.current) clearTimeout(fetchTimeout.current);
      fetchTimeout.current = setTimeout(() => {
        loadRoads();
      }, 300); // 300ms debounce
    };

    map.on('moveend', handleMoveEnd);
    map.on('zoomend', handleMoveEnd);
    return () => {
      map.off('moveend', handleMoveEnd);
      map.off('zoomend', handleMoveEnd);
      if (fetchTimeout.current) clearTimeout(fetchTimeout.current);
    };
  }, [map, activeLayerId, isOnline, loadRoads]); // Still watch activeLayerId so changing layers can trigger a load if needed

  // If the user isn't using lane assistant, roads are 100% invisible.
  // We still load them in the background (above) so they are ready/cached.
  const isLaneAssistant = activeTool === 'lane';
  
  if (!isLaneAssistant) return null;

  const ways: OSMWay[] = Array.from(waysMap.values());

  return (
    <>
      {ways.map(way => {
        let color = '#ffffff';
        let weight = 4;
        let opacity = 0; // invisible by default
        
        switch (way.tags.highway) {
          case 'motorway':
          case 'motorway_link':
            color = '#ff3333'; weight = 12; opacity = 0.9; break;
          case 'trunk':
          case 'trunk_link':
            color = '#ff6600'; weight = 10; opacity = 0.9; break;
          case 'primary':
          case 'primary_link':
            color = '#ffcc00'; weight = 10; opacity = 0.9; break;
          case 'secondary':
          case 'secondary_link':
            color = '#3399ff'; weight = 9; opacity = 0.8; break;
          case 'tertiary':
            color = '#00ffff'; weight = 8; opacity = 0.8; break;
          case 'residential':
          case 'unclassified':
            color = '#00ff66'; weight = 7; opacity = 0.8; break;
          case 'service':
          case 'living_street':
            color = '#cc33ff'; weight = 6; opacity = 0.7; break;
          case 'footway':
          case 'path':
          case 'pedestrian':
            color = '#ff3399'; weight = 4; opacity = 0.5; break;
          default:
            color = '#ffffff'; weight = 5; opacity = 0.6; break;
        }

        const positions: L.LatLngExpression[] = way.geometry.map(g => [g.lat, g.lon]);
        
        return (
          <Polyline 
            key={way.id} 
            positions={positions} 
            color={color} 
            weight={weight} 
            opacity={opacity} 
            interactive={false}
            lineCap="round"
            lineJoin="round"
            className="neon-road"
          />
        );
      })}
    </>
  );
};

export default VianVectorRoads;
