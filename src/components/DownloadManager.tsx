import React, { useState } from 'react';
import { Download, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { MAP_LAYERS } from '../lib/OfflineLayer';
import { db, VectorRoadRecord } from '../lib/db';
import { useConfigStore, useMapStore } from '../lib/store';

const DownloadManager: React.FC = () => {
  const map = useMapStore(state => state.map);
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const activeLayerId = useConfigStore(state => state.activeLayerId);

  const downloadRegion = async () => {
    if (isDownloading || !map) return;
    setIsDownloading(true);
    setStatus('Calculating tiles...');
    setProgress(0);

    const bounds = map.getBounds();
    const zoom = map.getZoom();
    const layer = MAP_LAYERS[activeLayerId];

    // Simple tile calculation for current view and next 2 levels
    const zooms = [zoom, zoom + 1, zoom + 2].filter(z => z <= layer.maxZoom);
    const tilesToFetch: { z: number; x: number; y: number }[] = [];

    zooms.forEach(z => {
      const nw = map.project(bounds.getNorthWest(), z).divideBy(256).floor();
      const se = map.project(bounds.getSouthEast(), z).divideBy(256).floor();

      for (let x = nw.x; x <= se.x; x++) {
        for (let y = nw.y; y <= se.y; y++) {
          tilesToFetch.push({ z, x, y });
        }
      }
    });

    if (tilesToFetch.length > 500) {
      setStatus(`Too many tiles (${tilesToFetch.length}). Zoom in more.`);
      setIsDownloading(false);
      return;
    }

    let completed = 0;
    setStatus(`Downloading ${tilesToFetch.length} tiles...`);

    for (const t of tilesToFetch) {
      const key = `${layer.id}/${t.z}/${t.x}/${t.y}`;
      try {
        const cached = await db.tiles.get(key);
        if (!cached) {
          const url = layer.url
            .replace('{s}', 'a')
            .replace('{z}', t.z.toString())
            .replace('{x}', t.x.toString())
            .replace('{y}', t.y.toString());
          
          const res = await fetch(url);
          if (res.ok) {
            const blob = await res.blob();
            await db.tiles.put({ id: key, data: blob, timestamp: Date.now() });
          }
        }
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') {
          setIsDownloading(false);
          return;
        }
        console.error('Download failed for tile', t, e);
      }
      completed++;
      setProgress(Math.round((completed / tilesToFetch.length) * 100));
    }

    setStatus('Downloading invisible road vectors...');
    try {
      const s = bounds.getSouth();
      const w = bounds.getWest();
      const n = bounds.getNorth();
      const e = bounds.getEast();
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
      } catch (err) {
        console.warn("Overpass API returned non-JSON in DownloadManager:", text.substring(0, 100));
        throw new Error("Overpass rate limit or error");
      }
      if (data.elements) {
        const roadRecords: VectorRoadRecord[] = data.elements
          .filter((el: any) => el.type === 'way' && el.geometry)
          .map((el: any) => ({
             id: el.id,
             nodes: el.nodes,
             geometry: el.geometry,
             tags: el.tags || {},
             timestamp: Date.now()
          }));
        await db.vectorRoads.bulkPut(roadRecords);
        await db.cachedBoxes.put({
          id: `${s}_${w}_${n}_${e}`,
          bounds: {s, w, n, e},
          timestamp: Date.now()
        });
      }
    } catch(err) {
      console.warn('Vector download failed:', err);
    }

    setStatus('Download Complete');
    setIsDownloading(false);
    setTimeout(() => setStatus(null), 3000);
  };

  return (
    <div className="space-y-4">
      <div className="p-4 bg-blue-500/5 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-2xl">
        <h3 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1">Regional Download</h3>
        <p className="text-[11px] text-zinc-500 dark:text-zinc-500 leading-relaxed">
          Saves the current visible map area + 2 zoom levels deep for offline use.
        </p>
      </div>

      <button
        onClick={downloadRegion}
        disabled={isDownloading}
        className={`w-full py-4 rounded-xl flex items-center justify-center gap-3 font-bold transition-all ${
          isDownloading 
          ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed' 
          : 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 hover:bg-black dark:hover:bg-white active:scale-95 shadow-md'
        }`}
      >
        {isDownloading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
        {isDownloading ? `Downloading ${progress}%` : 'Download Visible Area'}
      </button>

      {status && (
        <div className={`flex items-center gap-2 text-[11px] font-bold px-3 py-2 rounded-lg ${
          status.includes('Too many') ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'
        }`}>
          {status.includes('Complete') ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
          {status}
        </div>
      )}
    </div>
  );
};

export default DownloadManager;
