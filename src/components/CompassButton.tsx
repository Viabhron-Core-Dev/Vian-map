import React, { useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Compass } from 'lucide-react';
import { useConfigStore } from '../lib/store';

export const CompassButton: React.FC<{ onLongPress?: () => void }> = ({ onLongPress }) => {
  const { mapRotation, setMapRotation, setMapRotationLocked, compassLocked, setCompassLocked, setActiveTool } = useConfigStore(useShallow(state => ({
    mapRotation: state.mapRotation,
    setMapRotation: state.setMapRotation,
    setMapRotationLocked: state.setMapRotationLocked,
    compassLocked: state.compassLocked,
    setCompassLocked: state.setCompassLocked,
    setActiveTool: state.setActiveTool
  })));

  const pressTimer = useRef<NodeJS.Timeout | null>(null);

  const handlePointerDown = () => {
    pressTimer.current = setTimeout(() => {
      if (onLongPress) {
        onLongPress();
      } else {
        setActiveTool('navigation');
      }
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([100, 50, 100]);
      pressTimer.current = null;
    }, 600); // 600ms long press
  };

  const cancelPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    e.preventDefault();
    if (pressTimer.current) {
      cancelPress();
      // It was a short click
      if (mapRotation !== 0) {
        setMapRotation(0);
        setMapRotationLocked(true);
        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50);
      } else {
        setCompassLocked(!compassLocked);
        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(100);
      }
    }
  };

  const isLockedOrRotated = mapRotation !== 0 || compassLocked;

  return (
    <div className="relative">
      <button
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={cancelPress}
        onContextMenu={(e) => e.preventDefault()}
        className={`w-11 h-11 flex items-center justify-center rounded-lg transition-all ${
          isLockedOrRotated
            ? 'text-blue-500 bg-blue-500/20 ring-1 ring-blue-500/40'
            : 'text-zinc-700 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white hover:bg-white/10'
        }`}
        title={compassLocked ? 'LOCKED' : 'NORTH'}
      >
        <Compass
          style={{ transform: `rotate(${-mapRotation}deg)` }}
          strokeWidth={isLockedOrRotated ? 3 : 2}
          className={`w-5 h-5 transition-transform duration-300 ease-out`}
        />
        {compassLocked && (
          <span className="absolute bottom-1 right-1 w-2 h-2 bg-blue-500 rounded-full ring-2 ring-zinc-950 shadow-sm" />
        )}
      </button>
    </div>
  );
};
