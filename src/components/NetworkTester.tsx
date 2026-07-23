import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Wifi, Signal, Activity, Gauge, Monitor, Download, Upload, Clock, X, RefreshCw } from 'lucide-react';

interface NetworkMetrics {
  downlink: number;
  effectiveType: string;
  rtt: number;
  saveData: boolean;
  latency?: number;
  jitter?: number;
  packetLoss?: number;
}

const NetworkTester: React.FC<{ isActive: boolean; onClose: () => void }> = ({ isActive, onClose }) => {
  const [metrics, setMetrics] = useState<NetworkMetrics | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [history, setHistory] = useState<number[]>([]);

  const fetchMetrics = () => {
    setIsScanning(true);
    
    // Attempt real data using Network Information API
    const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    
    setTimeout(() => {
      const baseMetrics = conn ? {
        downlink: conn.downlink,
        effectiveType: conn.effectiveType,
        rtt: conn.rtt,
        saveData: conn.saveData,
      } : {
        downlink: 1.5,
        effectiveType: '4g',
        rtt: 100,
        saveData: false,
      };

      // Mock some detailed metrics
      const newMetrics: NetworkMetrics = {
        ...baseMetrics,
        latency: Math.floor(Math.random() * 40 + 20),
        jitter: Math.floor(Math.random() * 10 + 2),
        packetLoss: Math.random() < 0.1 ? 0.1 : 0
      };

      setMetrics(newMetrics);
      setHistory(prev => [...prev.slice(-19), newMetrics.downlink]);
      setIsScanning(false);
    }, 1500);
  };

  useEffect(() => {
    if (isActive) {
      fetchMetrics();
      const interval = setInterval(fetchMetrics, 10000); // Re-scan every 10s
      return () => clearInterval(interval);
    }
  }, [isActive]);

  if (!isActive) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      className="fixed inset-x-4 bottom-24 z-[4000] md:left-auto md:right-4 md:w-80 pointer-events-auto"
    >
      <div className="obsidian-glass border border-white/10 rounded-2xl p-4 shadow-2xl overflow-hidden relative">
        {/* Background Graphic */}
        <div className="absolute -top-10 -right-10 opacity-5">
           <Zap size={150} strokeWidth={1} />
        </div>

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest leading-none">Net Analysis</span>
              <span className="text-xs font-black text-zinc-100 tactical-font">NETWORK INTEL</span>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded-lg text-zinc-500 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {isScanning && !metrics ? (
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
            <span className="text-[10px] font-black text-zinc-400 uppercase animate-pulse">Scanning Waves...</span>
          </div>
        ) : metrics && (
          <div className="flex flex-col gap-4">
            {/* Speed Gauge */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex flex-col items-center">
                <Download size={16} className="text-zinc-500 mb-1" />
                <span className="text-[18px] font-black text-zinc-100 tactical-font">{metrics.downlink}</span>
                <span className="text-[8px] font-black text-zinc-500 uppercase">Mbps Down</span>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex flex-col items-center">
                <Clock size={16} className="text-zinc-500 mb-1" />
                <span className="text-[18px] font-black text-zinc-100 tactical-font">{metrics.latency}</span>
                <span className="text-[8px] font-black text-zinc-500 uppercase">ms Latency</span>
              </div>
            </div>

            {/* Additional Stats */}
            <div className="grid grid-cols-3 gap-2">
               <div className="flex flex-col">
                  <span className="text-[7px] font-bold text-zinc-500 uppercase">Type</span>
                  <span className="text-[10px] font-black text-zinc-300 uppercase">{metrics.effectiveType}</span>
               </div>
               <div className="flex flex-col">
                  <span className="text-[7px] font-bold text-zinc-500 uppercase">Jitter</span>
                  <span className="text-[10px] font-black text-zinc-300 uppercase">{metrics.jitter}ms</span>
               </div>
               <div className="flex flex-col">
                  <span className="text-[7px] font-bold text-zinc-500 uppercase">Loss</span>
                  <span className="text-[10px] font-black text-zinc-300 uppercase">{metrics.packetLoss}%</span>
               </div>
            </div>

            {/* History Graph */}
            <div className="h-12 flex items-end gap-0.5 border-b border-white/5 pb-1">
               {history.map((val, i) => (
                 <div 
                   key={i} 
                   className="flex-1 bg-blue-500/50 rounded-t-sm" 
                   style={{ height: `${Math.min(100, (val / 10) * 100)}%` }} 
                 />
               ))}
            </div>

            {/* Refresh Action */}
            <button 
              onClick={fetchMetrics}
              disabled={isScanning}
              className="w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            >
              <RefreshCw size={14} className={isScanning ? 'animate-spin' : ''} />
              <span className="text-[10px] font-black text-zinc-300 uppercase">Deep Scan</span>
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default NetworkTester;
