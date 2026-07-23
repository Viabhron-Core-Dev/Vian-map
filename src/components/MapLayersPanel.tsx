import React, { useState } from 'react';
import { Layers, Box, ChevronDown, ChevronRight, Upload, Wind, CloudRain, Anchor, Sprout, Image as ImageIcon, Map } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useConfigStore } from '../lib/store';
import { MAP_LAYERS } from '../lib/OfflineLayer';
import { db } from '../lib/db';

export const MapLayersPanel: React.FC = () => {
  const { activeLayerId, setActiveLayer, activeTool, setActiveTool, setActiveImageMapId } = useConfigStore();
  const [openSection, setOpenSection] = useState<string>('');

  const imageMaps = useLiveQuery(() => db.bookmarks.where('category').equals('imagemap').toArray(), []) || [];
  const customMaps = useLiveQuery(() => db.bookmarks.where('category').equals('custommap').toArray(), []) || [];

  const toggleSection = (id: string) => {
    setOpenSection(openSection === id ? '' : id);
  };

  const depthMapIds = ['topo', 'nautical', 'vegetation', 'precipitation', 'aqi'];
  const depthLabels: Record<string, { icon: any, label: string }> = {
    topo: { icon: Layers, label: 'ELEVATION (TOPO)' },
    nautical: { icon: Anchor, label: 'NAUTICAL MAP' },
    vegetation: { icon: Sprout, label: 'VEGETATION (NDVI)' },
    precipitation: { icon: CloudRain, label: 'WEATHER RADAR' },
    aqi: { icon: Wind, label: 'AIR QUALITY (AQI)' }
  };

  return (
    <div className="flex flex-col gap-1 w-64 max-h-[60vh] overflow-y-auto tactical-scrollbar">
       {/* Normal Maps */}
       <div>
         <button onClick={() => toggleSection('normal')} className="w-full px-2 py-1.5 flex items-center justify-between text-zinc-500 hover:text-zinc-900 border-b border-zinc-100 dark:border-zinc-800">
           <span className="text-[10px] font-black uppercase tracking-wider">Normal</span>
           {openSection === 'normal' ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
         </button>
         {openSection === 'normal' && (
           <div className="flex flex-col pl-1 pr-2 pt-2 pb-1 gap-1">
             {Object.values(MAP_LAYERS).filter(ml => !depthMapIds.includes(ml.id)).map(layer => (
               <button
                 key={layer.id}
                 onClick={() => { setActiveLayer(layer.id); setActiveTool(null); }}
                 className={`w-full px-3 py-2 text-left text-[10px] font-bold rounded-md flex items-center justify-between group ${
                   activeLayerId === layer.id && activeTool !== '3d' ? 'bg-blue-600 text-white shadow-sm' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                 }`}
               >
                 <span className="truncate">{layer.name.toUpperCase()}</span>
                 {activeLayerId === layer.id && activeTool !== '3d' && <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
               </button>
             ))}
           </div>
         )}
       </div>

       {/* Depth Maps */}
       <div>
         <button
            onClick={() => setActiveTool(activeTool === 'depth' ? null : 'depth')}
            className={`w-full px-2 py-1.5 flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 ${
              activeTool === 'depth' ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'text-zinc-500 hover:text-zinc-900'
            }`}
         >
           <div className="flex items-center gap-2">
             <Layers className={`w-3.5 h-3.5 ${activeTool === 'depth' ? 'text-blue-600' : ''}`} />
             <span className="text-[10px] font-black uppercase tracking-wider">Depth Maps</span>
           </div>
           {activeTool === 'depth' && <div className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />}
         </button>
       </div>

       {/* Custom Maps Section */}
       <div>
         <button onClick={() => toggleSection('custom')} className="w-full px-2 py-1.5 flex items-center justify-between text-zinc-500 hover:text-zinc-900 border-b border-zinc-100 dark:border-zinc-800">
           <span className="text-[10px] font-black uppercase tracking-wider">Custom</span>
           {openSection === 'custom' ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
         </button>
         {openSection === 'custom' && (
           <div className="flex flex-col pl-2 pt-1 pb-1 gap-1">
              <button 
                onClick={() => { setActiveTool('custommap'); useConfigStore.getState().setActiveCustomMapId(null); }}
                className="px-3 py-2 text-[10px] font-bold text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-md flex items-center gap-2"
              >
                 <Map className="w-3.5 h-3.5" />
                 ADD NEW CUSTOM MAP
              </button>
              
              {customMaps.length > 0 ? (
                customMaps.map(m => (
                    <button
                        key={m.id}
                        onClick={() => { setActiveTool('custommap'); useConfigStore.getState().setActiveCustomMapId(m.id || null); }}
                        className="w-full px-3 py-2 text-left text-[10px] font-bold rounded-md flex items-center justify-between hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                    >
                        <div className="flex items-center gap-2 truncate pr-2">
                           <Map className="w-3.5 h-3.5 shrink-0" />
                           <span className="truncate">{m.name.toUpperCase()}</span>
                        </div>
                    </button>
                ))
              ) : (
                <div className="px-3 py-2 text-[9px] text-zinc-400 italic">No existing custom maps</div>
              )}
           </div>
         )}
       </div>

       {/* Uploaded Section */}
       <div>
         <button onClick={() => toggleSection('uploaded')} className="w-full px-2 py-1.5 flex items-center justify-between text-zinc-500 hover:text-zinc-900 border-b border-zinc-100 dark:border-zinc-800">
           <span className="text-[10px] font-black uppercase tracking-wider">Uploaded</span>
           {openSection === 'uploaded' ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
         </button>
         {openSection === 'uploaded' && (
           <div className="flex flex-col pl-2 pt-1 pb-1 gap-1">
              <button 
                onClick={() => { setActiveTool('imagemap'); setActiveImageMapId(null); }}
                className="px-3 py-2 text-[10px] font-bold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md flex items-center gap-2"
              >
                 <Upload className="w-3.5 h-3.5" />
                 UPLOAD PHOTO MAP
              </button>
              
              {imageMaps.length > 0 ? (
                imageMaps.map(m => (
                    <button
                        key={m.id}
                        onClick={() => { setActiveTool('imagemap'); setActiveImageMapId(m.id || null); }}
                        className="w-full px-3 py-2 text-left text-[10px] font-bold rounded-md flex items-center justify-between hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                    >
                        <div className="flex items-center gap-2 truncate pr-2">
                           <ImageIcon className="w-3.5 h-3.5 shrink-0" />
                           <span className="truncate">{m.name.toUpperCase()}</span>
                        </div>
                    </button>
                ))
              ) : (
                <div className="px-3 py-2 text-[9px] text-zinc-400 italic">No existing maps</div>
              )}
           </div>
         )}
       </div>

       {/* 3D Map */}
       <div>
         <button onClick={() => toggleSection('3d')} className="w-full px-2 py-1.5 flex items-center justify-between text-zinc-500 hover:text-zinc-900">
           <span className="text-[10px] font-black uppercase tracking-wider">Direct 3D</span>
           {openSection === '3d' ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
         </button>
         {openSection === '3d' && (
           <div className="flex flex-col pl-1 pr-2 pt-1 pb-2 gap-1">
             <button
                onClick={() => {
                   setActiveTool(activeTool === '3d' ? null : '3d');
                }}
                className={`w-full px-3 py-2 text-left text-[10px] font-bold rounded-md flex items-center justify-between ${
                  activeTool === '3d' ? 'bg-blue-600 text-white shadow-sm' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                }`}
             >
                <div className="flex items-center gap-2">
                  <Box className="w-3.5 h-3.5" />
                  <span>3D OFFLINE MAP (BETA)</span>
                </div>
                {activeTool === '3d' && <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
             </button>
           </div>
         )}
       </div>
    </div>
  );
};
