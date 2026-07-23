import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface PanelProps {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  variant?: 'panel' | 'menu';
  align?: 'left' | 'right';
}

const Panel: React.FC<PanelProps> = ({ title, isOpen, onClose, children, variant = 'panel', align = 'left' }) => {
  const isMenu = variant === 'menu';
  const isRight = align === 'right';

  const positionClasses = isMenu
    ? `relative w-full max-h-[70vh] min-h-[120px] origin-bottom-left`
    : 'bottom-full left-0 mb-3 w-80 h-[60vh] max-h-[600px] min-h-[300px]';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={isMenu ? { y: 10, opacity: 0, scale: 0.9 } : { y: 20, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={isMenu ? { y: 10, opacity: 0, scale: 0.9 } : { y: 20, opacity: 0, scale: 0.95 }}
          className={`absolute ${positionClasses} bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl z-[3500] overflow-hidden flex flex-col pointer-events-auto`}
        >
          <div className={`px-4 py-2 border-b border-zinc-100 dark:border-zinc-800/50 flex flex-shrink-0 items-center justify-between ${isMenu ? 'bg-zinc-100/50 dark:bg-zinc-800/30' : 'bg-zinc-50/50 dark:bg-transparent'}`}>
            <h2 className="font-bold text-[9px] text-zinc-500 dark:text-zinc-400 uppercase tracking-widest truncate pr-2">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="w-5 h-5 flex items-center justify-center bg-zinc-200 dark:bg-zinc-700 active:scale-90 rounded-full text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-all border border-zinc-300 dark:border-zinc-600"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </div>
          <div className={`${isMenu ? 'p-1' : 'flex-1 p-4'} overflow-y-auto tactical-scrollbar text-zinc-900 dark:text-zinc-100`}>
            {children}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Panel;
