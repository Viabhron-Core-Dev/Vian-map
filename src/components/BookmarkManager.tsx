import React, { useState, useEffect, useRef } from 'react';
import { db, Bookmark } from '../lib/db';
import { 
  Bookmark as BookmarkIcon, 
  Trash2, 
  MapPin, 
  Share2, 
  Tag, 
  X, 
  Flag, 
  AlertTriangle, 
  Star, 
  Home, 
  Tent, 
  Coffee, 
  Camera, 
  Crosshair,
  FileText,
  BookOpen,
  MoreVertical,
  PlusSquare,
  Search,
  WifiOff,
  Loader2,
  Route,
  ChevronUp,
  ChevronDown,
  Edit2
} from 'lucide-react';
import { useGPSStore, useMapStore, useConfigStore } from '../lib/store';
import { motion, AnimatePresence } from 'framer-motion';
import { CachedPlace } from '../lib/db';

interface SearchResult {
  id: string;
  name: string;
  display_name: string;
  lat: number;
  lng: number;
  source: 'bookmark' | 'cache' | 'online';
  type?: string;
}

const MARKER_ICONS = [
  { id: 'bookmark', icon: BookmarkIcon },
  { id: 'flag', icon: Flag },
  { id: 'alert', icon: AlertTriangle },
  { id: 'star', icon: Star },
  { id: 'home', icon: Home },
  { id: 'tent', icon: Tent },
  { id: 'coffee', icon: Coffee },
  { id: 'camera', icon: Camera },
  { id: 'crosshair', icon: Crosshair },
];

const ICON_MAP: Record<string, any> = {
  bookmark: BookmarkIcon,
  flag: Flag,
  alert: AlertTriangle,
  star: Star,
  home: Home,
  tent: Tent,
  coffee: Coffee,
  camera: Camera,
  crosshair: Crosshair,
  'file-text': FileText,
  wiki: BookOpen
};

const TAG_OPTIONS = [
  { id: 'all', label: 'GENERAL' },
  { id: 'pharmacy', label: 'PHARMACY' },
  { id: 'store', label: 'STORE' },
  { id: 'medical', label: 'MEDICAL' },
  { id: 'fuel', label: 'FUEL' },
  { id: 'water', label: 'WATER' },
  { id: 'security', label: 'SECURITY' },
  { id: 'tower', label: 'COMMS' },
];

const BookmarkManager: React.FC = () => {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [newBookmarkName, setNewBookmarkName] = useState('');
  const [newBookmarkNote, setNewBookmarkNote] = useState('');
  const [newBookmarkTags, setNewBookmarkTags] = useState('all');
  const [selectedIcon, setSelectedIcon] = useState('bookmark');
  const [longPressedId, setLongPressedId] = useState<number | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editingBookmarkId, setEditingBookmarkId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'placemarks' | 'routes' | 'notes' | 'wiki'>('placemarks');
  
  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const position = useGPSStore(s => s.position);
  const map = useMapStore(s => s.map);
  const { pendingBookmark, setPendingBookmark, isOnline } = useConfigStore();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadBookmarks();
    
    const handleUpdate = () => loadBookmarks();
    window.addEventListener('bookmarks-updated', handleUpdate);
    return () => window.removeEventListener('bookmarks-updated', handleUpdate);
  }, []);

  // Search Logic
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchQuery.trim().length > 2) {
        performSearch(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const performSearch = async (searchTerm: string) => {
    setIsSearching(true);
    const searchLower = searchTerm.toLowerCase();
    
    // 1. Search Bookmarks
    const matchedBookmarks = await db.bookmarks
      .filter(b => b.name.toLowerCase().includes(searchLower))
      .toArray();
    
    const bookmarkResults: SearchResult[] = matchedBookmarks.map(b => ({
      id: `bkmk-${b.id}`,
      name: b.name,
      display_name: b.note || `Saved Bookmark in ${b.category}`,
      lat: b.lat,
      lng: b.lng,
      source: 'bookmark',
      type: b.category
    }));

    // 2. Search Local Cache
    const cached = await db.cachedPlaces
      .filter(p => p.name.toLowerCase().includes(searchLower) || p.display_name.toLowerCase().includes(searchLower))
      .limit(10)
      .toArray();
    
    const cacheResults: SearchResult[] = cached.map(p => ({
      id: p.id,
      name: p.name,
      display_name: p.display_name,
      lat: p.lat,
      lng: p.lng,
      source: 'cache',
      type: p.type
    }));

    const localResults = [...bookmarkResults, ...cacheResults];
    setSearchResults(localResults);

    // 3. Online Search
    if (isOnline) {
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchTerm)}&limit=10`);
        const onlineData = await response.json();
        
        const onlineResults: SearchResult[] = onlineData.map((p: any) => ({
          id: `osm-${p.place_id}`,
          name: p.name || p.display_name.split(',')[0],
          display_name: p.display_name,
          lat: parseFloat(p.lat),
          lng: parseFloat(p.lon),
          source: 'online',
          type: p.type
        }));

        const filteredOnline = onlineResults.filter(o => !localResults.some(l => l.name === o.name));
        setSearchResults(prev => [...prev, ...filteredOnline]);

        for (const res of onlineResults) {
          await db.cachedPlaces.put({
            id: res.id,
            name: res.name,
            display_name: res.display_name,
            lat: res.lat,
            lng: res.lng,
            type: res.type,
            cachedAt: Date.now()
          });
        }
      } catch (error) {
        console.error("Online search failed", error);
      }
    }
    setIsSearching(false);
  };

  // Open drafting window automatically if there is a pending bookmark from map
  useEffect(() => {
    if (pendingBookmark) setIsAdding(true);
  }, [pendingBookmark]);

  useEffect(() => {
    const handleOpenNoteModal = (e: CustomEvent) => {
      setPendingBookmark({ lat: e.detail.lat, lng: e.detail.lng });
      setActiveTab('notes');
      setNewBookmarkTags('note'); // use tags or category... wait, category is hardcoded in `addBookmark`? Let's check `addBookmark`
    };
    window.addEventListener('open-note-modal', handleOpenNoteModal as EventListener);
    return () => window.removeEventListener('open-note-modal', handleOpenNoteModal as EventListener);
  }, [setPendingBookmark]);

  const loadBookmarks = async () => {
    const all = await db.bookmarks.orderBy('savedAt').reverse().toArray();
    setBookmarks(all);
  };

  const startEditing = (bm: Bookmark) => {
    setEditingBookmarkId(bm.id || null);
    setNewBookmarkName(bm.name);
    setNewBookmarkNote(bm.note || '');
    setNewBookmarkTags(bm.tags || 'all');
    setSelectedIcon(bm.icon || 'bookmark');
    setIsAdding(true);
    setLongPressedId(null);
  };

  const reorderBookmark = async (id: number, direction: 'up' | 'down') => {
    const list = bookmarks.filter(b => activeTab === 'routes' ? b.category === 'route' : b.category !== 'route');
    const index = list.findIndex(b => b.id === id);
    if (index === -1) return;
    
    if (direction === 'up' && index > 0) {
      // Swap savedAt with the one above it
      const current = list[index];
      const target = list[index - 1];
      const temp = current.savedAt;
      await db.bookmarks.update(current.id!, { savedAt: target.savedAt });
      await db.bookmarks.update(target.id!, { savedAt: temp });
    } else if (direction === 'down' && index < list.length - 1) {
      const current = list[index];
      const target = list[index + 1];
      const temp = current.savedAt;
      await db.bookmarks.update(current.id!, { savedAt: target.savedAt });
      await db.bookmarks.update(target.id!, { savedAt: temp });
    }
    loadBookmarks();
  };

  const addBookmark = async (isView?: boolean) => {
    if (editingBookmarkId) {
      await db.bookmarks.update(editingBookmarkId, {
        name: newBookmarkName.trim() || 'Untitled',
        note: newBookmarkNote,
        tags: newBookmarkTags || 'all',
        icon: selectedIcon
      });
      setNewBookmarkName('');
      setNewBookmarkNote('');
      setNewBookmarkTags('all');
      setSelectedIcon('bookmark');
      setEditingBookmarkId(null);
      setIsAdding(false);
      loadBookmarks();
      return;
    }

    let coords: [number, number] | null = null;
    let zoomValue: number | undefined = undefined;

    if (isView && map) {
      const center = map.getCenter();
      coords = [center.lat, center.lng];
      zoomValue = map.getZoom();
    } else {
      coords = pendingBookmark ? [pendingBookmark.lat, pendingBookmark.lng] : position;
    }

    if (!coords || isNaN(coords[0]) || isNaN(coords[1])) {
      alert("Invalid location data. Cannot save bookmark.");
      return;
    }

    const name = newBookmarkName.trim() || (isView ? `View ${new Date().toLocaleTimeString()}` : `Mark ${new Date().toLocaleTimeString()}`);
    await db.bookmarks.add({
      name,
      lat: coords[0],
      lng: coords[1],
      zoom: zoomValue,
      category: activeTab === 'notes' ? 'note' : (activeTab === 'wiki' ? 'wiki' : 'waypoint'),
      icon: activeTab === 'notes' ? 'file-text' : (isView ? 'camera' : selectedIcon),
      note: newBookmarkNote,
      tags: newBookmarkTags || 'all',
      savedAt: Date.now()
    });
    
    setNewBookmarkName('');
    setNewBookmarkNote('');
    setNewBookmarkTags('all');
    setSelectedIcon('bookmark');
    setPendingBookmark(null);
    setIsAdding(false);
    loadBookmarks();
  };

  const removeBookmark = async (id?: number) => {
    if (!id) return;
    await db.bookmarks.delete(id);
    setLongPressedId(null);
    loadBookmarks();
  };

  const shareBookmark = async (bm: Bookmark) => {
    const url = `https://www.google.com/maps?q=${bm.lat},${bm.lng}`;
    const text = `${bm.name}\n${bm.note || ''}\n${url}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: bm.name,
          text: text,
          url: url
        });
      } catch (err) {
        console.error("Error sharing:", err);
      }
    } else {
      // Fallback
      await navigator.clipboard.writeText(text);
      alert("Link copied to clipboard");
    }
    setLongPressedId(null);
  };

  const teleport = (lat: number, lng: number, zoom?: number) => {
    if (!map || isNaN(lat) || isNaN(lng)) return;
    map.flyTo([lat, lng], zoom || 15, { duration: 1.5 });
  };

  const handlePointerDown = (id: number) => {
    timerRef.current = setTimeout(() => {
      setLongPressedId(id);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, 600); // 600ms long press
  };

  const handlePointerUp = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const filteredBookmarks = bookmarks.filter(b => {
    if (activeTab === 'routes') return b.category === 'route';
    if (activeTab === 'notes') return b.category === 'note';
    if (activeTab === 'wiki') return b.category === 'wiki';
    return b.category !== 'route' && b.category !== 'note' && b.category !== 'wiki';
  });

  const getEmptyMessage = () => {
    if (activeTab === 'routes') return 'routes saved';
    if (activeTab === 'notes') return 'notes saved';
    if (activeTab === 'wiki') return 'saved wikipedia pages';
    return 'mission marks';
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Search Bar - Integrated in Intel */}
      <div className="relative group px-1">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search Tactical Intel..."
          className="w-full bg-zinc-100 dark:bg-zinc-800 border-none rounded-lg py-2 pl-9 pr-8 text-[11px] font-bold tactical-font focus:ring-1 focus:ring-blue-500 outline-none placeholder:text-zinc-400"
        />
        <div className="absolute left-4 top-1/2 -translate-y-1/2">
          {isSearching ? (
            <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />
          ) : (
            <Search className="w-3.5 h-3.5 text-zinc-400" />
          )}
        </div>
        {searchQuery && (
          <button 
            onClick={() => setSearchQuery('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {searchQuery.trim().length > 2 ? (
          <motion.div
            key="search-results"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-1 max-h-[50vh] overflow-y-auto pr-1"
          >
            {searchResults.length === 0 && !isSearching ? (
              <div className="flex flex-col items-center justify-center py-8 opacity-40">
                <WifiOff className="w-8 h-8 mb-2" />
                <span className="text-[10px] font-black uppercase tracking-widest text-center">No intelligence found in local or global databases</span>
              </div>
            ) : (
              searchResults.map(res => (
                <button
                  key={res.id}
                  onClick={() => teleport(res.lat, res.lng)}
                  className="w-full text-left p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-all border border-transparent hover:border-zinc-100 dark:hover:border-zinc-800 group"
                >
                  <div className="flex items-start gap-2.5">
                    <div className={`mt-0.5 p-1.5 rounded-md ${
                      res.source === 'bookmark' 
                      ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600' 
                      : res.source === 'cache'
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-500'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
                    }`}>
                      {res.source === 'bookmark' ? <BookmarkIcon className="w-3 h-3" /> : <MapPin className="w-3 h-3" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] font-black tactical-font text-zinc-900 dark:text-zinc-100 truncate">{res.name}</span>
                        {res.source === 'bookmark' && <span className="text-[6px] font-black bg-amber-500/10 text-amber-600 px-1 py-0.5 rounded border border-amber-500/20 uppercase">Intel</span>}
                        {res.source === 'cache' && <span className="text-[6px] font-black bg-blue-500/10 text-blue-500 px-1 py-0.5 rounded border border-blue-500/20 uppercase">Cached</span>}
                      </div>
                      <p className="text-[8px] font-medium text-zinc-500 truncate italic leading-none">{res.display_name}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </motion.div>
        ) : isAdding ? (
          <motion.div 
            key="drafting"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className={`p-4 rounded-xl border transition-all ${
              pendingBookmark 
              ? 'bg-blue-600/10 border-blue-500 shadow-md ring-1 ring-blue-500/20' 
              : 'bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700/50'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex flex-col">
                <h3 className="text-[10px] font-black text-zinc-500 uppercase flex items-center gap-2 tracking-widest leading-none">
                  {editingBookmarkId ? (
                    <span className="text-amber-600 dark:text-amber-500">Edit Mark</span>
                  ) : pendingBookmark ? (
                    <span className="text-blue-600 dark:text-blue-400">Mission: Finalize Mark</span>
                  ) : (
                    <>
                      <PlusSquare className="w-3 h-3" />
                      New Intel Mark
                    </>
                  )}
                </h3>
                <span className="text-[9px] font-mono text-zinc-400 mt-1 uppercase tracking-tighter">
                  LOC: {pendingBookmark ? `${pendingBookmark.lat.toFixed(5)}, ${pendingBookmark.lng.toFixed(5)}` : (position ? `${position[0].toFixed(5)}, ${position[1].toFixed(5)}` : 'ACQUIRING...')}
                </span>
              </div>
              <button onClick={() => { setIsAdding(false); setPendingBookmark(null); }} className="p-1 text-zinc-400 hover:text-zinc-600 dark:text-zinc-600 dark:hover:text-zinc-400 bg-zinc-100 dark:bg-zinc-900 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <input
                type="text"
                autoFocus
                value={newBookmarkName}
                onChange={(e) => setNewBookmarkName(e.target.value)}
                placeholder={activeTab === 'notes' ? "Note Title" : (pendingBookmark ? "Point Name (required for mission)" : "Mark Name (optional)")}
                className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 text-zinc-900 dark:text-zinc-100"
              />

              {activeTab === 'placemarks' && (
                <>
                  <div className="flex items-center gap-2 flex-wrap bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-2">
                    {MARKER_ICONS.map(({ id, icon: Icon }) => (
                      <button
                        key={id}
                        onClick={() => setSelectedIcon(id)}
                        className={`p-2 rounded-lg transition-all ${
                          selectedIcon === id 
                          ? 'bg-blue-600 text-white' 
                          : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </button>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-1">Tactical Tagging</h4>
                    <div className="flex flex-wrap gap-1.5 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-2">
                      {TAG_OPTIONS.map(tag => (
                        <button
                          key={tag.id}
                          onClick={() => setNewBookmarkTags(tag.id)}
                          className={`px-2 py-1 rounded text-[9px] font-black tactical-font transition-all ${
                            newBookmarkTags === tag.id
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-500 hover:text-zinc-700'
                          }`}
                        >
                          {tag.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
              
              <div className="space-y-2">
                <textarea
                  value={newBookmarkNote}
                  onChange={(e) => setNewBookmarkNote(e.target.value)}
                  placeholder="Mission Notes / Intelligence..."
                  rows={2}
                  className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => { setIsAdding(false); setPendingBookmark(null); setEditingBookmarkId(null); }}
                  className="flex-1 py-2 rounded-lg text-xs font-black uppercase tracking-widest bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
                >
                  Cancel
                </button>
                <button
                  onClick={() => addBookmark()}
                  disabled={!position && !pendingBookmark && !editingBookmarkId}
                  className={`flex-[2] py-2.5 rounded-lg text-sm font-black tracking-widest transition-all shadow-sm ${
                    editingBookmarkId
                    ? 'bg-amber-500 text-amber-950 hover:bg-amber-400'
                    : pendingBookmark 
                    ? 'bg-blue-600 text-white hover:bg-blue-700' 
                    : 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 hover:opacity-90'
                  }`}
                >
                  {editingBookmarkId ? 'UPDATE' : pendingBookmark ? 'COMMIT' : 'SAVE POINT'}
                </button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="list"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-2"
          >
            <div className="flex flex-col gap-2 mb-4">
              <div className="flex gap-2 mb-2 p-1 bg-zinc-100 dark:bg-zinc-800/50 rounded-lg">
                <button
                  onClick={() => setActiveTab('placemarks')}
                  className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-md transition-all ${
                    activeTab === 'placemarks' 
                    ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-100' 
                    : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                  }`}
                >
                  Marks
                </button>
                <button
                  onClick={() => setActiveTab('routes')}
                  className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-md transition-all ${
                    activeTab === 'routes' 
                    ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-100' 
                    : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                  }`}
                >
                  Routes
                </button>
                <button
                  onClick={() => setActiveTab('notes')}
                  className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-md transition-all ${
                    activeTab === 'notes' 
                    ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-100' 
                    : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                  }`}
                >
                  Notes
                </button>
                <button
                  onClick={() => setActiveTab('wiki')}
                  className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-md transition-all ${
                    activeTab === 'wiki' 
                    ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-100' 
                    : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                  }`}
                >
                  Wiki
                </button>
              </div>

              {(activeTab === 'placemarks' || activeTab === 'notes') && (
                <>
                  <button 
                    onClick={() => setIsAdding(true)}
                    className="w-full h-12 rounded-xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 flex items-center justify-center gap-3 text-zinc-400 dark:text-zinc-500 hover:border-blue-500 hover:text-blue-500 hover:bg-blue-500/5 transition-all"
                  >
                    <PlusSquare className="w-5 h-5" />
                    <span className="text-xs font-black uppercase tracking-widest">
                      {activeTab === 'notes' ? 'New Note' : 'New Placemark'}
                    </span>
                  </button>
                  
                  {activeTab === 'placemarks' && (
                    <button 
                      onClick={() => addBookmark(true)}
                      className="w-full h-12 rounded-xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 flex items-center justify-center gap-3 text-zinc-400 dark:text-zinc-500 hover:border-amber-500 hover:text-amber-500 hover:bg-amber-500/5 transition-all"
                    >
                      <Camera className="w-5 h-5" />
                      <span className="text-xs font-black uppercase tracking-widest">Save Current View</span>
                    </button>
                  )}
                </>
              )}
            </div>

            <AnimatePresence>
              {filteredBookmarks.length === 0 ? (
                <div className="py-6 text-center text-zinc-400 dark:text-zinc-600 italic text-[9px]">
                  No {getEmptyMessage()}
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  {filteredBookmarks.map(bm => {
                    const Icon = activeTab === 'routes' ? Route : (ICON_MAP[bm.icon || 'bookmark'] || BookmarkIcon);
                    return (
                      <div key={bm.id} className="relative group">
                        <motion.div 
                          onClick={() => teleport(bm.lat, bm.lng, bm.zoom)}
                          onPointerDown={(e) => {
                            handlePointerDown(bm.id!);
                          }}
                          onPointerUp={() => {
                            handlePointerUp();
                          }}
                          onPointerLeave={() => {
                            handlePointerUp();
                          }}
                          onPointerCancel={() => {
                            handlePointerUp();
                          }}
                          className={`flex items-center justify-between px-2 py-1.5 rounded-md border transition-all cursor-pointer ${
                            longPressedId === bm.id 
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                            : 'border-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <div className="w-6 h-6 flex-shrink-0 bg-zinc-100 dark:bg-zinc-800 rounded flex items-center justify-center text-zinc-400">
                              <Icon className="w-3.5 h-3.5" />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <h4 className="text-[10px] font-bold text-zinc-800 dark:text-zinc-200 truncate pr-1">{bm.name}</h4>
                              <p className="text-[8px] font-mono text-zinc-500 truncate leading-none">
                                {bm.lat.toFixed(4)}, {bm.lng.toFixed(4)}
                              </p>
                            </div>
                          </div>
                          
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setLongPressedId(longPressedId === bm.id ? null : (bm.id || null));
                            }}
                            className="p-1.5 text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>
                        </motion.div>

                        {/* Tiny Context Menu Overlay */}
                        <AnimatePresence>
                          {longPressedId === bm.id && (
                            <motion.div 
                              initial={{ opacity: 0, x: 10 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: 10 }}
                              className="absolute right-0 top-0 bottom-0 bg-white dark:bg-zinc-900 shadow-xl border border-zinc-200 dark:border-zinc-800 z-20 flex items-center gap-1 px-1 rounded-md"
                            >
                              <button onClick={() => reorderBookmark(bm.id!, 'up')} className="p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded">
                                <ChevronUp className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => reorderBookmark(bm.id!, 'down')} className="p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded">
                                <ChevronDown className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => startEditing(bm)} className="p-1.5 text-amber-500 hover:bg-amber-500/10 rounded">
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => shareBookmark(bm)} className="p-1.5 text-blue-500 hover:bg-blue-500/10 rounded">
                                <Share2 className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => removeBookmark(bm.id)} className="p-1.5 text-red-500 hover:bg-red-500/10 rounded">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => setLongPressedId(null)} className="p-1.5 text-zinc-400">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BookmarkManager;
