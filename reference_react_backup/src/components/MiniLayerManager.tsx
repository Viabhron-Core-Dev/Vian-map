import React, { useState, useEffect } from 'react';
import { db, Overlay } from '../lib/db';
import { useMapStore } from '../lib/store';
import { Upload, Trash2, Eye, Ruler } from 'lucide-react';

const MiniLayerManager: React.FC = () => {
  const [overlays, setOverlays] = useState<Overlay[]>([]);
  const map = useMapStore(s => s.map);

  useEffect(() => {
    const fetchOverlays = async () => {
      const all = await db.overlays.toArray();
      setOverlays(all);
    };
    fetchOverlays();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !map) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const url = event.target?.result as string;
      const center = map.getCenter();
      
      // Default bounds of small area around center
      const d = 0.01;
      const newOverlay: Overlay = {
        name: file.name,
        url: url,
        bounds: [
          [center.lat - d, center.lng - d],
          [center.lat + d, center.lng + d]
        ],
        opacity: 0.7
      };
      
      const id = await db.overlays.add(newOverlay);
      setOverlays([...overlays, { ...newOverlay, id }]);
    };
    reader.readAsDataURL(file);
  };

  const deleteOverlay = async (id: number) => {
    await db.overlays.delete(id);
    setOverlays(overlays.filter(o => o.id !== id));
  };

  const updateOpacity = async (id: number, opacity: number) => {
    await db.overlays.update(id, { opacity });
    setOverlays(overlays.map(o => o.id === id ? { ...o, opacity } : o));
  };

  return (
    <div className="space-y-4">
      <div className="space-y-0.5">
        <h3 className="text-[9px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest px-2 py-1">Mission Overlays</h3>
        
        <label className="flex items-center justify-between w-full px-3 py-2 text-[10px] font-bold rounded-md cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 group transition-all">
          <div className="flex items-center gap-2">
            <Upload className="w-3.5 h-3.5" />
            <span>UPLOAD PHOTOS</span>
          </div>
          <span className="text-[7px] opacity-40">JPG/PNG</span>
          <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
        </label>
      </div>

      <div className="space-y-2 max-h-[30vh] overflow-y-auto tactical-scrollbar pr-1">
        {overlays.map(overlay => (
          <div key={overlay.id} className="p-3 bg-white dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700/50 rounded-xl space-y-3 shadow-sm dark:shadow-none">
             <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 truncate">{overlay.name}</span>
                <button 
                  onClick={() => deleteOverlay(overlay.id!)}
                  className="p-1.5 hover:bg-red-500/10 text-red-500 rounded transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
             </div>
             
             <div className="flex gap-2">
                <button className="flex-1 py-1.5 bg-blue-600/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 text-[10px] font-bold rounded-lg flex items-center justify-center gap-2 hover:bg-blue-600/20 transition-colors">
                   <Ruler className="w-3.5 h-3.5" /> Calibrate
                </button>
                <div className="flex items-center gap-2 px-3 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-700 rounded-lg">
                  <input 
                    type="range" 
                    min="10" max="100" 
                    value={overlay.opacity * 100}
                    onChange={(e) => updateOpacity(overlay.id!, parseInt(e.target.value) / 100)}
                    className="w-16 h-1 bg-zinc-200 dark:bg-zinc-700 rounded-full appearance-none accent-blue-600 dark:accent-blue-500 cursor-pointer" 
                  />
                  <Eye className="w-3 h-3 text-zinc-400 dark:text-zinc-500" />
                </div>
             </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MiniLayerManager;
