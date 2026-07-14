import React, { useRef, useEffect } from 'react';

interface TouchControlsProps {
  onMove: (x: number, y: number) => void;
  onAction: (action: string, active: boolean) => void;
}

export const TouchControls: React.FC<TouchControlsProps> = ({ onMove, onAction }) => {
  const padRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const pad = padRef.current;
    if (!pad) return;
    
    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      const rect = pad.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      let dx = (touch.clientX - centerX) / (rect.width / 2);
      let dy = (touch.clientY - centerY) / (rect.height / 2);
      
      const mag = Math.hypot(dx, dy);
      if (mag > 1.0) {
        dx /= mag;
        dy /= mag;
      }
      onMove(dx, dy);
    };

    const handleTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      onMove(0, 0);
    };

    pad.addEventListener('touchmove', handleTouchMove, { passive: false });
    pad.addEventListener('touchend', handleTouchEnd, { passive: false });
    
    return () => {
      pad.removeEventListener('touchmove', handleTouchMove);
      pad.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onMove]);

  return (
    <div className="absolute bottom-4 left-0 right-0 p-4 flex justify-between z-40 pointer-events-none">
      <div 
        ref={padRef}
        className="w-32 h-32 rounded-full border-2 border-cyan-500/50 bg-slate-900/50 pointer-events-auto shadow-[0_0_15px_rgba(6,182,212,0.3)] touch-none"
      >
         <div className="w-12 h-12 rounded-full bg-cyan-400/50 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      </div>
      
      <div className="flex gap-4 items-end pointer-events-auto touch-none">
         <div className="flex flex-col gap-2">
            <button 
              className="w-14 h-14 rounded-full bg-slate-800/80 border border-purple-500/50 text-purple-400 font-bold active:bg-purple-600 active:text-white"
              onTouchStart={() => onAction('c', true)}
              onTouchEnd={() => onAction('c', false)}
              onMouseDown={() => onAction('c', true)}
              onMouseUp={() => onAction('c', false)}
            >C</button>
            <button 
              className="w-14 h-14 rounded-full bg-slate-800/80 border border-emerald-500/50 text-emerald-400 font-bold active:bg-emerald-600 active:text-white"
              onTouchStart={() => onAction('z', true)}
              onTouchEnd={() => onAction('z', false)}
              onMouseDown={() => onAction('z', true)}
              onMouseUp={() => onAction('z', false)}
            >Z</button>
         </div>
      </div>
    </div>
  );
};
