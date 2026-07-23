import React, { useState, useEffect } from 'react';
import { Search, MapPin, Loader2, Route as RouteIcon, VolumeX, Volume2, Save, Sparkles, Hash } from 'lucide-react';
import { useConfigStore, useGPSStore } from '../lib/store';
import { db, SavedRoute } from '../lib/db';
import { GoogleGenAI } from '@google/genai';

export const NavigationMenu: React.FC = () => {
  const position = useGPSStore(s => s.position);
  const { geminiApiKey, setNavRoutePath, setNavDestination, navRoutePath, activeTagFilters, setTagFilters } = useConfigStore();

  const [tab, setTab] = useState<'search' | 'ai' | 'directions' | 'saved'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<{ name: string, display_name: string, lat: number, lon: number, isAI?: boolean }[]>([]);
  
  const [instructions, setInstructions] = useState<any[]>([]);
  const [isRouting, setIsRouting] = useState(false);
  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>([]);
  const [audioEnabled, setAudioEnabled] = useState(true);

  // Load saved routes
  useEffect(() => {
    if (tab === 'saved') {
      db.savedRoutes.orderBy('savedAt').reverse().toArray().then(setSavedRoutes);
    }
  }, [tab]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchResults([]);

    try {
      const cached = await db.cachedPlaces.filter(p => !!p.name?.toLowerCase().includes(searchQuery.toLowerCase())).toArray();
      const results: any[] = cached.map(c => ({
        name: c.name,
        display_name: c.display_name,
        lat: c.lat,
        lon: c.lng
      }));

      if (useConfigStore.getState().isOnline) {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=5`);
        const data = await res.json();
        
        data.forEach((d: any) => {
          if (!results.find(r => r.lat === parseFloat(d.lat) && r.lon === parseFloat(d.lon))) {
            results.push({
              name: d.name || d.display_name.split(',')[0],
              display_name: d.display_name,
              lat: parseFloat(d.lat),
              lon: parseFloat(d.lon)
            });
            db.cachedPlaces.put({
                id: `nom_${d.place_id}`,
                name: d.name || d.display_name.split(',')[0],
                display_name: d.display_name,
                lat: parseFloat(d.lat),
                lng: parseFloat(d.lon),
                cachedAt: Date.now()
            });
          }
        });
      }

      setSearchResults(results);
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleGeminiSearch = async () => {
    if (!searchQuery.trim() || !geminiApiKey) return;
    setIsSearching(true);
    setSearchResults([]);

    try {
      const ai = new GoogleGenAI({ apiKey: geminiApiKey });
      const prompt = `You are a geolocation extractor. The user provides a query: "${searchQuery}".
Extract the best possible real-world latitude and longitude for this request. 
Format your exact response as valid JSON ONLY:
{"name": "Location Name", "lat": 12.345, "lon": -12.345}`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      const text = response.text || '';
      const match = text.match(/\{.*\}/s);
      if (match) {
        const parsed = JSON.parse(match[0]);
        setSearchResults([{
            name: parsed.name,
            display_name: `AI Found coordinates for "${searchQuery}"`,
            lat: parsed.lat,
            lon: parsed.lon,
            isAI: true
        }]);
      }
    } catch (err) {
      console.error("AI Search Error:", err);
      alert('AI Search Failed: ' + (err as Error).message);
    } finally {
      setIsSearching(false);
    }
  };

  const calculateRoute = async (destLat: number, destLng: number) => {
    if (!position) {
      alert("Current position unknown");
      return;
    }
    
    setNavDestination([destLat, destLng]);
    setTab('directions');
    setIsRouting(true);
    setNavRoutePath([]);
    setInstructions([]);

    try {
      const currentLat = position[0];
      const currentLng = position[1];
      const url = `https://router.project-osrm.org/route/v1/driving/${currentLng},${currentLat};${destLng},${destLat}?steps=true&geometries=geojson&overview=full`;
      
      const response = await fetch(url);
      const data = await response.json();

      if (data.code === 'Ok' && data.routes.length > 0) {
        const route = data.routes[0];
        const path: L.LatLngExpression[] = route.geometry.coordinates.map((coord: number[]) => [coord[1], coord[0]]);
        setNavRoutePath(path);
        
        const steps = route.legs[0].steps;
        setInstructions(steps);
        
        if (audioEnabled && steps.length > 0) {
           speakInstruction(`Head ${steps[0].maneuver.modifier || 'straight'} on ${steps[0].name || 'the road'}`);
        }
      } else {
        alert("No route found");
      }
    } catch (err) {
      console.error(err);
      alert("Routing failed");
    } finally {
      setIsRouting(false);
    }
  };

  const speakInstruction = (text: string) => {
    if (!audioEnabled || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.volume = 1;
    utterance.rate = 1;
    window.speechSynthesis.speak(utterance);
  };

  const saveCurrentRoute = async () => {
    if (navRoutePath.length === 0) return;
    try {
      await db.savedRoutes.put({
          name: `Route from ${new Date().toLocaleDateString()}`,
          points: navRoutePath.map((p: any) => ({ lat: p[0], lng: p[1] })),
          instructions: instructions,
          distance: 0,
          duration: 0,
          savedAt: Date.now()
      });
      alert('Route Saved Offline');
    } catch (err) {
      console.error(err);
    }
  };

  const loadSavedRoute = (route: SavedRoute) => {
      setNavRoutePath(route.points.map(p => [p.lat, p.lng]));
      setInstructions(route.instructions || []);
      setTab('directions');
  };

  const TAGS = [
    { id: 'pharmacy', label: 'PHARMACY' },
    { id: 'store', label: 'STORE' },
    { id: 'bank', label: 'BANK / ATM' },
    { id: 'cafe', label: 'CAFE / FOOD' },
    { id: 'gas', label: 'FUEL / ENERGY' },
    { id: 'medical', label: 'MEDICAL / HOSP' },
    { id: 'security', label: 'POLICE / SEC' },
    { id: 'water', label: 'WATER SUPPLY' },
    { id: 'tower', label: 'COMMS / TOWER' },
  ];

  return (
    <div className="flex flex-col max-h-[60vh] overflow-hidden">
      <div className="flex bg-zinc-800/50 p-1 mx-2 mt-2 rounded gap-1 flex-wrap">
        <button onClick={() => setTab('search')} className={`flex-1 min-w-[60px] py-1.5 text-[9px] font-bold uppercase rounded ${tab === 'search' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>Search</button>
        <button onClick={() => setTab('ai')} className={`flex-1 min-w-[60px] py-1.5 text-[9px] font-bold uppercase rounded ${tab === 'ai' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>AI Parse</button>
        <button onClick={() => setTab('directions')} className={`flex-1 min-w-[60px] py-1.5 text-[9px] font-bold uppercase rounded ${tab === 'directions' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>Route</button>
        <button onClick={() => setTab('saved')} className={`flex-1 min-w-[60px] py-1.5 text-[9px] font-bold uppercase rounded ${tab === 'saved' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>Offline</button>
      </div>

      <div className="p-3 flex-1 overflow-y-auto">
        {tab === 'search' && (
          <div className="space-y-4">
            <form onSubmit={handleSearch} className="flex flex-col gap-2">
              <div className="relative">
                 <input 
                   type="text" 
                   value={searchQuery}
                   onChange={e => setSearchQuery(e.target.value)}
                   placeholder="Search location, POI, coordinate..."
                   className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 transition-colors"
                 />
                 <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
              </div>
              
              <div className="flex gap-2">
                 <button 
                   type="submit" 
                   disabled={isSearching}
                   className="w-full bg-zinc-800 hover:bg-zinc-700 text-white text-[10px] font-bold py-2 rounded uppercase flex items-center justify-center gap-1 transition-colors"
                 >
                   {isSearching ? <Loader2 className="w-3 h-3 animate-spin"/> : <MapPin className="w-3 h-3"/>} Search
                 </button>
              </div>
            </form>

            {searchResults.length > 0 && !searchResults[0].isAI && (
              <div className="space-y-2 mt-4">
                {searchResults.map((res, i) => (
                  <div key={i} className="bg-zinc-800/50 p-2 rounded-lg border border-zinc-700/50 hover:border-blue-500/50 transition-colors cursor-pointer"
                       onClick={() => calculateRoute(res.lat, res.lon)}>
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                      <div>
                        <div className="text-xs font-bold text-white line-clamp-1">{res.name}</div>
                        <div className="text-[10px] text-zinc-500 line-clamp-2 mt-0.5">{res.display_name}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-4 border-t border-zinc-800/50">
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest pl-1 mb-2 block">Quick POI Filters</span>
              <div className="flex flex-wrap gap-1.5">
                {TAGS.map(tag => {
                  const isActive = activeTagFilters.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      onClick={() => {
                        setTagFilters(isActive 
                          ? activeTagFilters.filter(f => f !== tag.id)
                          : [...activeTagFilters, tag.id]
                        );
                      }}
                      className={`px-2 py-1 text-[9px] font-black rounded border flex items-center gap-1 transition-all ${
                        isActive 
                        ? 'bg-blue-900/40 text-blue-400 border-blue-500/50' 
                        : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      {isActive && <Hash className="w-2.5 h-2.5" />}
                      {tag.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {tab === 'ai' && (
          <div className="space-y-4">
            <form onSubmit={(e) => { e.preventDefault(); handleGeminiSearch(); }} className="flex flex-col gap-2">
              <div className="relative">
                 <textarea 
                   value={searchQuery}
                   onChange={e => setSearchQuery(e.target.value)}
                   placeholder="Rambling description of a place to parse into [lat, lon] natively..."
                   className="w-full h-24 bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs text-white focus:outline-none focus:border-blue-500 transition-colors resize-none"
                 />
              </div>
              
              {!geminiApiKey ? (
                 <div className="p-3 bg-red-900/20 border border-red-900/50 rounded text-center">
                    <span className="text-[10px] text-red-500 font-bold uppercase">Gemini API Key Required in Settings</span>
                 </div>
              ) : (
                 <button 
                   type="submit"
                   disabled={isSearching || !searchQuery.trim()}
                   className="w-full bg-blue-900/30 text-blue-400 hover:bg-blue-900/50 border border-blue-900/50 text-[10px] font-bold py-2 rounded uppercase flex items-center justify-center gap-1 transition-colors disabled:opacity-50"
                 >
                    {isSearching ? <Loader2 className="w-3 h-3 animate-spin"/> : <Sparkles className="w-3 h-3"/>} Parse Context Coordinates
                 </button>
              )}
            </form>

            {searchResults.length > 0 && searchResults.some(r => r.isAI) && (
              <div className="space-y-2 mt-4">
                {searchResults.filter(r => r.isAI).map((res, i) => (
                  <div key={i} className="bg-blue-900/20 p-2 rounded-lg border border-blue-500/30 hover:border-blue-500 transition-colors cursor-pointer"
                       onClick={() => calculateRoute(res.lat, res.lon)}>
                    <div className="flex items-start gap-2">
                      <Sparkles className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                      <div>
                        <div className="text-xs font-bold text-blue-400 line-clamp-1">{res.name}</div>
                        <div className="text-[10px] text-zinc-400 line-clamp-2 mt-0.5">{res.display_name}</div>
                        <div className="text-[9px] font-mono text-zinc-500 mt-1">[{res.lat.toFixed(4)}, {res.lon.toFixed(4)}]</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'directions' && (
          <div className="space-y-4">
               <div className="flex items-center justify-between bg-blue-900/20 p-2 rounded-lg border border-blue-900/50">
                  <div className="flex items-center gap-2">
                      {audioEnabled ? <Volume2 className="w-4 h-4 text-blue-400" /> : <VolumeX className="w-4 h-4 text-zinc-500" />}
                      <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Voice Guidance</span>
                  </div>
                  <button onClick={() => setAudioEnabled(!audioEnabled)} className="w-8 h-4 bg-zinc-950 rounded-full relative">
                      <div className={`absolute top-0.5 w-3 h-3 rounded-full transition-all ${audioEnabled ? 'right-0.5 bg-blue-500' : 'left-0.5 bg-zinc-600'}`}/>
                  </button>
               </div>

               {isRouting ? (
                 <div className="flex flex-col items-center justify-center p-8 gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                    <span className="text-[10px] uppercase font-bold text-zinc-500">Calculating...</span>
                 </div>
               ) : navRoutePath.length > 0 ? (
                 <div className="space-y-3">
                    <button onClick={saveCurrentRoute} className="w-full py-2 bg-emerald-900/30 text-emerald-400 hover:bg-emerald-900/50 rounded text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 border border-emerald-900/50">
                        <Save className="w-3 h-3" /> Save Route Offline
                    </button>
                    
                    <div className="flex flex-col gap-2">
                       {instructions.map((step, idx) => (
                           <div key={idx} className="bg-zinc-800/80 p-2.5 rounded border border-zinc-700/50 flex items-start gap-3">
                               <div className="w-5 h-5 bg-zinc-700 rounded-full flex items-center justify-center shrink-0">
                                   <span className="text-[9px] font-bold text-zinc-300">{idx + 1}</span>
                               </div>
                               <div className="flex flex-col">
                                  <span className="text-xs font-bold text-zinc-100">{step.maneuver.modifier ? `${step.maneuver.modifier} on ` : ''}{step.name || 'Proceed straight'}</span>
                                  <span className="text-[10px] text-zinc-500">{Math.round(step.distance)} meters</span>
                               </div>
                           </div>
                       ))}
                    </div>
                 </div>
               ) : (
                 <div className="text-center p-8">
                    <RouteIcon className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                    <span className="text-[9px] uppercase font-bold text-zinc-500">Search to calculate</span>
                 </div>
               )}
          </div>
        )}

        {tab === 'saved' && (
            <div className="space-y-2">
               {savedRoutes.length === 0 && (
                   <div className="text-[10px] text-zinc-500 uppercase text-center p-4">No routes saved</div>
               )}
               {savedRoutes.map((route, i) => (
                   <div key={i} className="bg-zinc-800/50 p-3 rounded-lg border border-zinc-700/50 flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                           <RouteIcon className="w-4 h-4 text-emerald-500" />
                           <span className="text-xs font-bold text-white line-clamp-1">{route.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                          <button onClick={() => loadSavedRoute(route)} className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[9px] font-bold rounded uppercase">
                              Navigate
                          </button>
                          <button onClick={() => {
                              db.savedRoutes.delete(route.id!);
                              setSavedRoutes(prev => prev.filter(r => r.id !== route.id));
                          }} className="px-3 py-1.5 bg-red-900/30 text-red-500 hover:bg-red-900/50 rounded text-[9px] font-bold uppercase transition-colors">
                              Delete
                          </button>
                      </div>
                   </div>
               ))}
            </div>
        )}
      </div>
    </div>
  );
};
