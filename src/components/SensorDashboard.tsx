import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Compass, Activity, Wind, Thermometer, ChevronRight, ChevronLeft } from 'lucide-react';

interface SensorDashboardProps {
  isOpen: boolean;
  onClose: () => void;
}

const SensorDashboard: React.FC<SensorDashboardProps> = ({ isOpen, onClose }) => {
  const [orientation, setOrientation] = useState({ alpha: 0, beta: 0, gamma: 0 });

  useEffect(() => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      setOrientation({
        alpha: Math.round(e.alpha || 0),
        beta: Math.round(e.beta || 0),
        gamma: Math.round(e.gamma || 0)
      });
    };

    if (isOpen) {
      window.addEventListener('deviceorientation', handleOrientation);
    }
    return () => window.removeEventListener('deviceorientation', handleOrientation);
  }, [isOpen]);

  return (
    <div className="absolute right-0 top-1/2 -translate-y-1/2 z-[4000] flex items-center pointer-events-none">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            className="bg-zinc-900/95 border-l border-zinc-800 w-48 p-4 shadow-2xl flex flex-col gap-6 pointer-events-auto rounded-l-2xl"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                <Compass className="w-3 h-3" />
                Heading
              </div>
              <button 
                onClick={onClose}
                className="p-1 text-zinc-600 hover:text-white transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            
            <div className="text-3xl font-mono font-bold text-white tabular-nums">
              {orientation.alpha}°
              <span className="text-xs ml-1 text-blue-500">N</span>
            </div>

            {/* Inclinometer (Grade) */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                <Activity className="w-3 h-3" />
                Inclinometer
              </div>
              <div className="relative h-24 bg-black/40 rounded-lg overflow-hidden border border-white/5 flex items-center justify-center">
                <div 
                  className="w-1 bg-blue-500 h-full transition-transform duration-100" 
                  style={{ transform: `rotate(${orientation.gamma}deg)` }}
                />
                <div className="absolute inset-0 flex items-center justify-between px-2 text-[8px] text-zinc-600 font-mono">
                  <span>-45°</span>
                  <span>0°</span>
                  <span>45°</span>
                </div>
              </div>
              <div className="flex justify-between text-xs font-mono text-zinc-300">
                <span>P: {orientation.beta}°</span>
                <span>R: {orientation.gamma}°</span>
              </div>
            </div>

            {/* Environmental Readout */}
            <div className="pt-4 border-t border-white/5 flex flex-col gap-4">
               <div className="flex items-center justify-between">
                  <Wind className="w-4 h-4 text-zinc-500" />
                  <span className="text-xs text-zinc-400">12 km/h NW</span>
               </div>
               <div className="flex items-center justify-between">
                  <Thermometer className="w-4 h-4 text-zinc-500" />
                  <span className="text-xs text-zinc-400">22°C</span>
               </div>
            </div>

            <div className="mt-4 text-[8px] text-zinc-600 text-center uppercase font-bold tracking-tighter">
                Tactical Sensor Suite v1.0
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SensorDashboard;
