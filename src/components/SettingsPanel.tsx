import React, { useState } from 'react';
import { useConfigStore } from '../lib/store';
import { db } from '../lib/db';
import { Cloud, CloudOff, Zap, Eye, Trash2, Database, Download, Sun, Moon, Package, Upload, Loader2, CheckCircle2, Signal, Navigation, Activity, Terminal, FileText, Key } from 'lucide-react';
import DownloadManager from './DownloadManager';
import JSZip from 'jszip';

const SettingsPanel: React.FC = () => {
  const { 
    isOnline, setOnline, 
    autoCache, setAutoCache, 
    showCacheVis, setShowCacheVis, 
    theme, setTheme,
    isGPSEngineActive, setGPSEngine,
    isSensorsActive, setSensors,
    positionMode, setPositionMode,
    performanceMode, setPerformanceMode,
    cacheMaxTiles, setCacheMaxTiles,
    cacheMaxAgeDays, setCacheMaxAgeDays,
    cacheAutoClean, setCacheAutoClean,
    networkProvider, setNetworkProvider,
    isLoggingEnabled, setLoggingEnabled,
    openCellIdKey, setOpenCellIdKey,
    openWeatherMapKey, setOpenWeatherMapKey,
    geminiApiKey, setGeminiApiKey
  } = useConfigStore();
  const [archiveStatus, setArchiveStatus] = useState<string | null>(null);
  const [tempApiKey, setTempApiKey] = useState('');
  const [tempOwmKey, setTempOwmKey] = useState('');
  const [tempGeminiKey, setTempGeminiKey] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [cacheSize, setCacheSize] = useState<string | null>(null);

  // Load cache size
  React.useEffect(() => {
    const loadSize = async () => {
      let size = 0;
      await db.tiles.each(t => size += t.data.size);
      if (size > 1024 * 1024 * 1024) {
        setCacheSize((size / (1024 * 1024 * 1024)).toFixed(2) + ' GB');
      } else {
        setCacheSize((size / (1024 * 1024)).toFixed(1) + ' MB');
      }
    };
    loadSize();
  }, []);

  const exportDiagnosticLogs = async (hoursLimit: number = 0) => {
    if (isProcessing) return;
    setIsProcessing(true);
    setArchiveStatus('Packaging Logs...');

    try {
      let logs = [];
      if (hoursLimit > 0) {
        const timeLimit = Date.now() - (hoursLimit * 60 * 60 * 1000);
        logs = await db.logs.where('timestamp').aboveOrEqual(timeLimit).toArray();
        logs.sort((a, b) => a.timestamp - b.timestamp);
      } else {
        logs = await db.logs.orderBy('timestamp').toArray();
      }

      let logText = `VIAN MAP DIAGNOSTIC LOGS\nGenerated: ${new Date().toISOString()}\n========================\n\n`;
      
      for (const l of logs) {
        const time = new Date(l.timestamp).toISOString();
        logText += `[${time}] [${l.level.toUpperCase()}] [${l.module}] ${l.message}\n`;
        if (l.details) {
          logText += `Details: ${l.details}\n`;
        }
        logText += `------------------------\n`;
      }

      try {
        await navigator.clipboard.writeText(logText);
        setArchiveStatus('Copied to Clipboard');
      } catch (clipErr) {
        setArchiveStatus('Clipboard Copy Failed');
      }
    } catch (e) {
      console.error(e);
      setArchiveStatus('Export Failed');
    } finally {
      setIsProcessing(false);
      setTimeout(() => setArchiveStatus(null), 3000);
    }
  };

  const clearAllTiles = async () => {
    if (confirm('Are you sure? This will delete ALL cached map tiles for all layers.')) {
      await db.tiles.clear();
      alert('Cache cleared.');
    }
  };

  const exportMissionPackage = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    setArchiveStatus('Packaging Mission Archive...');
    
    try {
      const zip = new JSZip();
      const bookmarks = await db.bookmarks.toArray();
      const tiles = await db.tiles.toArray();

      // Intelligence Manifest
      const manifest = {
        version: '2.1-TACTICAL',
        exportedAt: new Date().toISOString(),
        bookmarks
      };

      zip.file('mission_manifest.json', JSON.stringify(manifest, null, 2));

      // Map Tiles (The heavy lifting)
      const tileFolder = zip.folder('map_tiles');
      for (const t of tiles) {
        // JSZip handles nested paths correctly if we provide a full path string
        tileFolder?.file(t.id, t.data);
      }

      setArchiveStatus('Compressing Package...');
      const content = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
      
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `MISSION_ARCHIVE_${new Date().toISOString().split('T')[0]}.vian`;
      a.click();
      
      setArchiveStatus('Export Complete');
    } catch (err) {
      console.error(err);
      setArchiveStatus('Package Error');
    } finally {
      setIsProcessing(false);
      setTimeout(() => setArchiveStatus(null), 3000);
    }
  };

  const importMissionPackage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || isProcessing) return;

    if (!confirm('Warning: Importing a mission package will merge with current data. Map tiles will be added to cache. Continue?')) return;

    setIsProcessing(true);
    setArchiveStatus('Unpacking Archive...');

    try {
      const zip = await JSZip.loadAsync(file);
      const manifestFile = zip.file('mission_manifest.json');
      if (!manifestFile) throw new Error('Invalid Mission Archive: No manifest found.');

      const manifestText = await manifestFile.async('text');
      const manifest = JSON.parse(manifestText);

      // Restore Bookmarks
      if (manifest.bookmarks) {
        for (const bm of manifest.bookmarks) {
          const { id, ...data } = bm;
          await db.bookmarks.put(data);
        }
      }

      // Restore Tiles
      const tileEntries = zip.folder('map_tiles')?.files;
      if (tileEntries) {
        setArchiveStatus('Restoring Map Cache...');
        const entries = Object.entries(tileEntries);
        for (const [name, zipFile] of entries) {
          if (zipFile.dir) continue;
          // ID is the relative path from map_tiles/
          const tileId = name.replace('map_tiles/', '');
          const tileData = await zipFile.async('blob');
          await db.tiles.put({ id: tileId, data: tileData, timestamp: Date.now() });
        }
      }

      setArchiveStatus('Restore Successful');
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      console.error(err);
      setArchiveStatus('Import Failed');
    } finally {
      setIsProcessing(false);
      setTimeout(() => setArchiveStatus(null), 3000);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      {/* Theme & Priority */}
      <div className="flex gap-0.5 p-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
        {['light', 'dark'].map(t => (
          <button
            key={t}
            onClick={() => setTheme(t as any)}
            className={`flex-1 py-1.5 rounded-md text-[9px] font-black uppercase transition-all ${
              theme === t ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex gap-0.5 p-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
        {['gps', 'location'].map(m => (
          <button
            key={m}
            onClick={() => setPositionMode(m as any)}
            className={`flex-1 py-1.5 rounded-md text-[9px] font-black uppercase transition-all ${
              positionMode === m ? 'bg-blue-600 text-white shadow-sm' : 'text-zinc-500'
            }`}
          >
            {m === 'gps' ? 'SATELLITE' : 'INTEGRATED'}
          </button>
        ))}
      </div>

      {/* Network Provider Input */}
      <div className="flex flex-col gap-1 p-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg mt-1">
        <label className="text-[7.5px] font-black text-zinc-500 uppercase tracking-widest px-1 flex items-center gap-1.5">
          <Signal className="w-2.5 h-2.5" />
          Telecom Provider (SIM)
        </label>
        <input 
          type="text"
          value={networkProvider}
          onChange={(e) => setNetworkProvider(e.target.value.toUpperCase())}
          placeholder="e.g. JIO 5G, AIRTEL..."
          className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1.5 text-[9px] font-bold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500 uppercase"
        />
      </div>

      {/* OpenCelliD API Key */}
      <div className="flex flex-col gap-1 p-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg mt-1">
        <label className="text-[7.5px] font-black text-zinc-500 uppercase tracking-widest px-1 flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5">
            <Key className="w-2.5 h-2.5" />
            OpenCelliD API Key
          </div>
        </label>
        {openCellIdKey ? (
          <div className="flex items-center gap-1.5 px-2 py-1.5 bg-white dark:bg-zinc-900 rounded border border-zinc-200 dark:border-zinc-700">
            <div className="text-[9px] font-bold text-green-500 flex-1">KEY CONFIGURED (***)</div>
            <button
              onClick={() => setOpenCellIdKey(null)}
              className="text-[9px] font-black text-red-500 uppercase"
            >
              DEL
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <input 
              type="password"
              value={tempApiKey}
              onChange={(e) => setTempApiKey(e.target.value)}
              placeholder="Enter API Key"
              className="flex-1 min-w-0 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1.5 text-[9px] font-bold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={() => {
                if (tempApiKey.trim()) {
                  setOpenCellIdKey(tempApiKey.trim());
                  setTempApiKey('');
                }
              }}
              disabled={!tempApiKey.trim()}
              className="px-2 py-1.5 bg-blue-500 text-white text-[9px] font-black rounded uppercase disabled:opacity-50"
            >
              SAVE
            </button>
          </div>
        )}
      </div>

      {/* OpenWeatherMap API Key */}
      <div className="flex flex-col gap-1 p-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg mt-1">
        <label className="text-[7.5px] font-black text-zinc-500 uppercase tracking-widest px-1 flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5">
            <Key className="w-2.5 h-2.5" />
            OpenWeatherMap API Key
          </div>
        </label>
        {openWeatherMapKey ? (
          <div className="flex items-center gap-1.5 px-2 py-1.5 bg-white dark:bg-zinc-900 rounded border border-zinc-200 dark:border-zinc-700">
            <div className="text-[9px] font-bold text-green-500 flex-1">KEY CONFIGURED (***)</div>
            <button
              onClick={() => setOpenWeatherMapKey(null)}
              className="text-[9px] font-black text-red-500 uppercase"
            >
              DEL
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <input 
              type="password"
              value={tempOwmKey}
              onChange={(e) => setTempOwmKey(e.target.value)}
              placeholder="Enter API Key"
              className="flex-1 min-w-0 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1.5 text-[9px] font-bold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={() => {
                if (tempOwmKey.trim()) {
                  setOpenWeatherMapKey(tempOwmKey.trim());
                  setTempOwmKey('');
                }
              }}
              disabled={!tempOwmKey.trim()}
              className="px-2 py-1.5 bg-blue-500 text-white text-[9px] font-black rounded uppercase disabled:opacity-50"
            >
              SAVE
            </button>
          </div>
        )}
      </div>

      {/* Gemini API Key */}
      <div className="flex flex-col gap-1 p-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg mt-1">
        <label className="text-[7.5px] font-black text-zinc-500 uppercase tracking-widest px-1 flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5">
            <Key className="w-2.5 h-2.5" />
            Gemini API Key (AI Search)
          </div>
        </label>
        {geminiApiKey ? (
          <div className="flex items-center gap-1.5 px-2 py-1.5 bg-white dark:bg-zinc-900 rounded border border-zinc-200 dark:border-zinc-700">
            <div className="text-[9px] font-bold text-green-500 flex-1">KEY CONFIGURED (***)</div>
            <button
              onClick={() => setGeminiApiKey(null)}
              className="text-[9px] font-black text-red-500 uppercase"
            >
              DEL
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <input 
              type="password"
              value={tempGeminiKey}
              onChange={(e) => setTempGeminiKey(e.target.value)}
              placeholder="Enter API Key"
              className="flex-1 min-w-0 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1.5 text-[9px] font-bold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={() => {
                if (tempGeminiKey.trim()) {
                  setGeminiApiKey(tempGeminiKey.trim());
                  setTempGeminiKey('');
                }
              }}
              disabled={!tempGeminiKey.trim()}
              className="px-2 py-1.5 bg-blue-500 text-white text-[9px] font-black rounded uppercase disabled:opacity-50"
            >
              SAVE
            </button>
          </div>
        )}
      </div>

      {/* Network & Cache List */}
      <div className="flex flex-col gap-0.5 mt-1 pt-1 border-t border-zinc-100 dark:border-zinc-800">
        {[
          { label: 'SYSTEM LINK', icon: isOnline ? Cloud : CloudOff, value: isOnline, toggle: () => setOnline(!isOnline), color: 'text-green-500' },
          { label: 'AUTO-CACHE', icon: Zap, value: autoCache, toggle: () => setAutoCache(!autoCache), color: 'text-blue-500' },
          { label: 'CACHE VISUAL', icon: Eye, value: showCacheVis, toggle: () => setShowCacheVis(!showCacheVis), color: 'text-purple-500' },
          { label: 'HIGH PERF', icon: Activity, value: performanceMode === 'high', toggle: () => setPerformanceMode(performanceMode === 'high' ? 'low' : 'high'), color: 'text-orange-500' },
          { label: 'DIAGNOSTIC LOG', icon: Terminal, value: isLoggingEnabled, toggle: () => setLoggingEnabled(!isLoggingEnabled), color: 'text-teal-500' },
          { label: 'AUTO CLEAN', icon: Trash2, value: cacheAutoClean, toggle: () => setCacheAutoClean(!cacheAutoClean), color: 'text-red-500' },
        ].map(item => (
          <button
            key={item.label}
            onClick={item.toggle}
            className="flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
          >
            <div className="flex items-center gap-2">
              <item.icon className={`w-3.5 h-3.5 ${item.value ? item.color : 'text-zinc-400'}`} />
              <span className="text-[9px] font-black text-zinc-600 dark:text-zinc-400 uppercase">{item.label}</span>
            </div>
            <div className={`w-6 h-3 rounded-full relative transition-colors ${item.value ? 'bg-blue-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}>
              <div className={`absolute top-0.5 w-2 h-2 bg-white rounded-full transition-all ${item.value ? 'right-0.5' : 'left-0.5'}`} />
            </div>
          </button>
        ))}
      </div>

      {/* Cache Limits */}
      <div className="flex flex-col gap-2 mt-1 pt-2 border-t border-zinc-100 dark:border-zinc-800">
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Cache Quota: {cacheMaxTiles} Tiles</span>
            {cacheSize && <span className="text-[8px] font-bold text-blue-500">{cacheSize}</span>}
          </div>
          <input 
            type="range" min="1000" max="25000" step="1000" 
            value={cacheMaxTiles} 
            onChange={(e) => setCacheMaxTiles(parseInt(e.target.value))}
            className="w-full h-1 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
        </div>
        <div className="flex flex-col gap-1">
           <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Expiration: {cacheMaxAgeDays} Days</span>
           <input 
            type="range" min="1" max="90" step="1" 
            value={cacheMaxAgeDays} 
            onChange={(e) => setCacheMaxAgeDays(parseInt(e.target.value))}
            className="w-full h-1 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
        </div>
      </div>

      {/* Bundle Tools */}
      <div className="flex flex-col gap-1 mt-1 pt-1 border-t border-zinc-100 dark:border-zinc-800">
        {archiveStatus && (
          <div className="px-2 py-1 bg-blue-500/10 text-blue-500 text-[8px] font-black uppercase rounded flex items-center gap-2">
            {isProcessing ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <CheckCircle2 className="w-2.5 h-2.5" />}
            {archiveStatus}
          </div>
        )}
        <div className="grid grid-cols-2 gap-1">
          <button onClick={exportMissionPackage} disabled={isProcessing} className="py-2 bg-zinc-900 dark:bg-zinc-200 text-white dark:text-zinc-950 rounded-md text-[8px] font-black uppercase tracking-tight flex items-center justify-center gap-1.5">
            <Package className="w-3 h-3" /> EXPORT
          </button>
          <label className="py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-md text-[8px] font-black uppercase tracking-tight flex items-center justify-center gap-1.5 cursor-pointer">
            <Upload className="w-3 h-3" /> IMPORT
            <input type="file" className="hidden" accept=".vian" onChange={importMissionPackage} disabled={isProcessing} />
          </label>
        </div>
        <div className="flex flex-col gap-1 mt-1">
          <div className="flex items-center gap-1">
             <FileText className="w-3 h-3 text-teal-500" />
             <span className="text-[7.5px] font-black text-teal-600 dark:text-teal-400 uppercase tracking-widest">COPY DIAGNOSTIC LOGS</span>
          </div>
          <div className="grid grid-cols-4 gap-1">
            <button onClick={() => exportDiagnosticLogs(1)} disabled={isProcessing} className="py-1.5 bg-teal-500/10 text-teal-600 dark:text-teal-400 rounded-md text-[8px] font-black uppercase tracking-tight flex items-center justify-center">1 HR</button>
            <button onClick={() => exportDiagnosticLogs(12)} disabled={isProcessing} className="py-1.5 bg-teal-500/10 text-teal-600 dark:text-teal-400 rounded-md text-[8px] font-black uppercase tracking-tight flex items-center justify-center">12 HR</button>
            <button onClick={() => exportDiagnosticLogs(24)} disabled={isProcessing} className="py-1.5 bg-teal-500/10 text-teal-600 dark:text-teal-400 rounded-md text-[8px] font-black uppercase tracking-tight flex items-center justify-center">24 HR</button>
            <button onClick={() => exportDiagnosticLogs(0)} disabled={isProcessing} className="py-1.5 bg-teal-500/10 text-teal-600 dark:text-teal-400 rounded-md text-[8px] font-black uppercase tracking-tight flex items-center justify-center">ALL</button>
          </div>
        </div>
      </div>

      <div className="mt-1 pt-1 border-t border-zinc-100 dark:border-zinc-800">
        <DownloadManager />
      </div>

      <button onClick={clearAllTiles} className="w-full mt-2 py-1.5 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-md text-[8px] font-black uppercase tracking-widest flex items-center justify-center gap-2">
        <Trash2 className="w-3 h-3" /> PURGE TILE CACHE
      </button>
    </div>
  );
};

export default SettingsPanel;
