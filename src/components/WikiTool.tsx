import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useMap } from 'react-leaflet';
import { BookOpen, X, Loader2, Bookmark as BookmarkIcon, Check } from 'lucide-react';
import { useConfigStore } from '../lib/store';
import { db } from '../lib/db';

export const WikiTool: React.FC<{ isActive: boolean }> = ({ isActive }) => {
  const map = useMap();
  const setActiveTool = useConfigStore(s => s.setActiveTool);
  
  const [isLoading, setIsLoading] = useState(false);
  const [articles, setArticles] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());

  const fetchWiki = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const bounds = map.getBounds();
      const s = bounds.getSouth();
      const n = bounds.getNorth();
      const w = bounds.getWest();
      const e = bounds.getEast();
      
      const res = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=geosearch&gsbbox=${n}|${w}|${s}|${e}&gslimit=20&format=json&origin=*`);
      const data = await res.json();
      
      if (data && data.query && data.query.geosearch) {
        setArticles(data.query.geosearch);
      } else {
        setArticles([]);
      }
    } catch (e) {
      console.error(e);
      setError("Failed to fetch Wikipedia data.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isActive) {
      fetchWiki();
      
      // Load saved wiki ids to update UI
      db.bookmarks.where('category').equals('wiki').toArray().then(saved => {
        const ids = new Set(saved.map(s => Number(s.data?.pageid)));
        setSavedIds(ids);
      });
    } else {
      setArticles([]);
    }
  }, [isActive, map]);

  if (!isActive) return null;

  const handleSave = async (article: any) => {
    if (savedIds.has(article.pageid)) return;
    
    await db.bookmarks.add({
      name: article.title,
      lat: article.lat,
      lng: article.lon,
      category: 'wiki',
      icon: 'wiki',
      note: 'Saved from WikiCheck Area',
      savedAt: Date.now(),
      data: {
        pageid: article.pageid,
        url: `https://en.wikipedia.org/?curid=${article.pageid}`
      }
    });

    setSavedIds(new Set([...savedIds, article.pageid]));
  };

  return createPortal(
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[2000] bg-zinc-950/95 backdrop-blur-md rounded-xl border border-zinc-800 p-4 flex flex-col gap-3 min-w-[320px] max-w-[90vw] max-h-[80vh] shadow-2xl overflow-hidden">
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 text-zinc-100 font-bold text-xs uppercase tracking-wider">
          <BookOpen className="w-4 h-4 text-blue-500" />
          <span>WIKI AREA CHECK</span>
          {isLoading && <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />}
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => fetchWiki()} 
            className="text-[9px] uppercase font-black bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2 py-1 rounded"
          >
            Refetch
          </button>
          <button 
            onClick={() => setActiveTool(null)} 
            className="p-1 hover:bg-zinc-800 rounded bg-zinc-900 border border-zinc-700 transition-colors"
          >
            <X className="w-4 h-4 text-zinc-400" />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2 overflow-y-auto pr-1">
        {error && <div className="text-red-400 text-[10px] text-center font-bold p-2">{error}</div>}
        
        {!isLoading && articles.length === 0 && !error && (
          <div className="text-zinc-500 text-[10px] text-center italic py-4">No Wikipedia articles found in this map view.</div>
        )}

        {articles.map(article => (
          <div key={article.pageid} className="flex flex-col bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 hover:border-zinc-700 transition-colors">
            <div className="flex items-start justify-between gap-2">
              <a 
                href={`https://en.wikipedia.org/?curid=${article.pageid}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-[12px] font-bold text-blue-400 hover:underline break-words"
              >
                {article.title}
              </a>
              <button 
                onClick={() => handleSave(article)}
                disabled={savedIds.has(article.pageid)}
                className={`shrink-0 p-1.5 rounded transition-all flex items-center ${
                  savedIds.has(article.pageid) 
                  ? 'bg-green-500/10 text-green-500 cursor-default' 
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                }`}
              >
                {savedIds.has(article.pageid) ? <Check className="w-3.5 h-3.5" /> : <BookmarkIcon className="w-3.5 h-3.5" />}
              </button>
            </div>
            <div className="text-[9px] text-zinc-500 mt-1 font-mono tracking-tighter">
              {article.lat.toFixed(5)}, {article.lon.toFixed(5)} • {article.dist}m away
            </div>
          </div>
        ))}
      </div>
    </div>,
    document.body
  );
};
