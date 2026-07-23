import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGPSStore } from '../lib/store';

export const GPSMetricsRow: React.FC = () => {
  const { speed, accuracy, altitude, heading } = useGPSStore(useShallow(state => ({
    speed: state.speed,
    accuracy: state.accuracy,
    altitude: state.altitude,
    heading: state.heading
  })));

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex items-baseline gap-0.5">
        <span className="text-[9px] font-black tactical-font text-zinc-900 dark:text-zinc-100">{speed ? (speed * 3.6).toFixed(1) : '0.0'}</span>
        <span className="text-[6px] text-zinc-400 font-bold uppercase tracking-tighter">kmh</span>
      </div>
      <div className="flex items-baseline gap-0.5">
        <span className="text-[9px] font-black tactical-font text-zinc-900 dark:text-zinc-100">{accuracy ? accuracy.toFixed(0) : '--'}</span>
        <span className="text-[6px] text-zinc-400 font-bold uppercase tracking-tighter">acc</span>
      </div>
      <div className="flex items-baseline gap-0.5">
        <span className="text-[9px] font-black tactical-font text-zinc-900 dark:text-zinc-100">{altitude ? altitude.toFixed(0) : '--'}</span>
        <span className="text-[6px] text-zinc-400 font-bold uppercase tracking-tighter">alt</span>
      </div>
      <div className="flex items-baseline gap-0.5">
        <span className="text-[9px] font-black tactical-font text-zinc-900 dark:text-zinc-100">{heading ? heading.toFixed(0) : '--'}</span>
        <span className="text-[6px] text-zinc-400 font-bold uppercase tracking-tighter">hdg</span>
      </div>
    </div>
  );
};
