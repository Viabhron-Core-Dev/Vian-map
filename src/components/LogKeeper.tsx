import React, { useState, useEffect } from 'react';
import { ArrowLeft, Copy, Download, Trash2 } from 'lucide-react';
import { db, LogRecord } from '../lib/db';
import { useConfigStore } from '../lib/store';
import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';

interface LogKeeperProps {
  onClose: () => void;
}

export const LogKeeper: React.FC<LogKeeperProps> = ({ onClose }) => {
  const { isLoggingEnabled, setLoggingEnabled } = useConfigStore();
  const [timeFilter, setTimeFilter] = useState<'1H' | '6H' | '12H' | '24H' | 'ALL'>('1H');

  const logs = useLiveQuery(async () => {
    let query = db.logs.orderBy('timestamp').reverse();
    
    if (timeFilter !== 'ALL') {
      const now = Date.now();
      let ms = 0;
      if (timeFilter === '1H') ms = 60 * 60 * 1000;
      if (timeFilter === '6H') ms = 6 * 60 * 60 * 1000;
      if (timeFilter === '12H') ms = 12 * 60 * 60 * 1000;
      if (timeFilter === '24H') ms = 24 * 60 * 60 * 1000;
      query = db.logs.where('timestamp').above(now - ms).reverse();
    }

    return await query.toArray();
  }, [timeFilter]);

  const handleCopy = () => {
    if (!logs) return;
    const text = logs.map(l => `[${format(l.timestamp, 'HH:mm:ss.SSS')}] [${l.level.toUpperCase()}] [${l.module}] ${l.message}\n${l.details || ''}`).join('\n');
    navigator.clipboard.writeText(text);
  };

  const handleDownload = () => {
    if (!logs) return;
    const text = logs.map(l => `[${format(l.timestamp, 'HH:mm:ss.SSS')}] [${l.level.toUpperCase()}] [${l.module}] ${l.message}\n${l.details || ''}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vian_logs_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClear = async () => {
    await db.logs.clear();
  };

  return (
    <div className="fixed inset-0 z-[5000] bg-[#111111] text-white flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold leading-tight">The Log<br/>Keeper</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">Master Switch</span>
          <button
            onClick={() => setLoggingEnabled(!isLoggingEnabled)}
            className={`w-12 h-6 rounded-full relative transition-colors duration-200 ${isLoggingEnabled ? 'bg-[#D4E09B]' : 'bg-white/20'}`}
          >
            <div className={`w-5 h-5 rounded-full bg-[#2B301B] absolute top-0.5 transition-transform duration-200 ${isLoggingEnabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
          </button>
        </div>
      </div>

      {/* Filters and Actions */}
      <div className="p-4 shrink-0 flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {['1H', '6H', '12H', '24H', 'ALL'].map((f) => (
            <button
              key={f}
              onClick={() => setTimeFilter(f as any)}
              className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${timeFilter === f ? 'bg-[#D4E09B] text-[#2B301B]' : 'bg-[#2B301B] text-white/80'}`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="flex gap-3">
          <button onClick={handleCopy} className="px-5 py-2 rounded-full bg-[#D4E09B] text-[#2B301B] font-bold text-sm shadow-md">
            Copy
          </button>
          <button onClick={handleDownload} className="px-5 py-2 rounded-full bg-[#D4E09B] text-[#2B301B] font-bold text-sm shadow-md">
            Download
          </button>
          <div className="flex-1" />
          <button onClick={handleClear} className="p-2 rounded-full bg-red-900/30 text-red-400 hover:bg-red-900/50">
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Log List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-xs">
        {!logs && <div className="text-white/50 text-center py-4">Loading logs...</div>}
        {logs?.length === 0 && <div className="text-white/50 text-center py-4">No logs found in this time frame.</div>}
        {logs?.map(log => (
          <div key={log.id} className="bg-white/5 rounded p-2 break-all">
            <div className="flex justify-between items-start mb-1 text-white/50">
              <span>{format(log.timestamp, 'HH:mm:ss.SSS')}</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                log.level === 'error' ? 'bg-red-500/20 text-red-300' :
                log.level === 'warn' ? 'bg-yellow-500/20 text-yellow-300' :
                'bg-blue-500/20 text-blue-300'
              }`}>
                {log.level}
              </span>
            </div>
            <div className="font-bold text-white/90 mb-1">[{log.module}]</div>
            <div className="text-white/80">{log.message}</div>
            {log.details && (
              <pre className="mt-2 p-2 bg-black/40 rounded text-[10px] text-white/60 whitespace-pre-wrap">
                {log.details}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
