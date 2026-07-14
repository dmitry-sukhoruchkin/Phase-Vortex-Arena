// src/components/ArenaHUD.tsx
import React from 'react';

interface ArenaHUDProps {
  playerInfo: any;
  botInfo: any;
  mode: string;
  time: number;
  fps: number;
  engineText: string;
  settings: any;
  setSettings: React.Dispatch<React.SetStateAction<any>>;
  cameraMode: 'CENTERED' | 'FIXED';
  setCameraMode: (val: 'CENTERED' | 'FIXED') => void;
  onAbort: () => void;
}

export const ArenaHUD: React.FC<ArenaHUDProps> = ({
  playerInfo, botInfo, mode, time, fps, engineText, settings, setSettings, cameraMode, setCameraMode, onAbort
}) => {
  let pPercent = 50;
  if (playerInfo && botInfo) {
     const pInt = playerInfo.integrity || 0.1;
     const bInt = botInfo.integrity || 0.1;
     const total = pInt + bInt;
     if (total > 0) pPercent = (pInt / total) * 100;
  }

  return (
    <>
       {/* Верхний статус-бар */}
       <div className="w-full max-w-[800px] flex justify-between items-center mb-2 px-2 text-xs absolute top-2 z-50">
          <div className="text-slate-300 drop-shadow-md bg-slate-950/40 px-2 py-1 rounded">
             FPS: <span className={fps >= 45 ? "text-emerald-400" : "text-orange-400"}>{fps}</span> | {engineText}
          </div>
          <div className="flex gap-2 pointer-events-auto">
             {/* ПЕРЕКЛЮЧАТЕЛЬ КАМЕРЫ (СЛЕЖЕНИЕ ИЛИ ФИКСИРОВАННЫЙ ОБЗОР) */}
             <button 
                className={`px-3 py-1 border text-xs cursor-pointer ${cameraMode === 'FIXED' ? 'bg-cyan-900 border-cyan-400 text-cyan-200' : 'bg-slate-900 border-slate-700 text-slate-400'}`}
                onClick={() => setCameraMode(cameraMode === 'FIXED' ? 'CENTERED' : 'FIXED')}
             >
                CAMERA: {cameraMode === 'FIXED' ? 'FIXED VIEW' : 'CENTERED'}
             </button>
             <button 
                className="px-3 py-1 bg-slate-900/80 border border-slate-700 hover:bg-slate-800 hover:text-white text-slate-400 cursor-pointer text-xs"
                onClick={onAbort}
             >
                ABORT MATCH
             </button>
          </div>
       </div>

       {/* ШКАЛА ПРЕВОСХОДСТВА (WHO IS WINNING BAR) */}
       <div className="absolute top-10 w-[450px] h-3 bg-slate-950 border border-slate-800 flex overflow-hidden z-40 rounded shadow-lg">
          <div 
             className="h-full bg-cyan-500 transition-all duration-300 ease-out flex items-center justify-start px-2"
             style={{ width: `${pPercent}%` }}
          >
             {pPercent > 15 && <span className="text-[9px] font-bold text-slate-950">TEAM 1</span>}
          </div>
          <div 
             className="h-full bg-red-500 transition-all duration-300 ease-out flex items-center justify-end px-2"
             style={{ width: `${100 - pPercent}%` }}
          >
             {(100 - pPercent) > 15 && <span className="text-[9px] font-bold text-slate-950">TEAM 2</span>}
          </div>
       </div>

       {/* Статы левого игрока */}
       {playerInfo && (
          <div className="absolute top-16 left-4 bg-slate-950/85 border border-cyan-800 p-3 w-60 backdrop-blur-sm z-20 pointer-events-none rounded">
            <h2 className="text-cyan-400 font-bold mb-1 tracking-wider text-xs">P1 CORE STATUS</h2>
            <div className="space-y-0.5 text-[10px]">
              <p><span className="text-slate-500">Core:</span> <span className="text-cyan-200">{playerInfo.pillName}</span></p>
              <p><span className="text-slate-500">Integrity:</span> <span className="text-emerald-400">{(playerInfo.integrity * 100).toFixed(1)}%</span></p>
              <p><span className="text-slate-500">Dissonance:</span> <span className="text-orange-300">{playerInfo.shearStress.toFixed(2)}</span></p>
              <p><span className="text-slate-500">Active K:</span> <span className="text-indigo-300">{playerInfo.KActive.toFixed(1)}</span></p>
            </div>
            {playerInfo.aiLog && (
               <p className="text-[8px] text-slate-400 border-t border-slate-800 pt-1 mt-1 leading-tight font-mono">
                  {playerInfo.aiLog}
               </p>
            )}
          </div>
       )}

       {/* Статы правого игрока */}
       {botInfo && (
          <div className="absolute top-16 right-4 bg-slate-950/85 border border-red-900/50 p-3 w-60 backdrop-blur-sm text-right z-20 pointer-events-none rounded">
            <h2 className="text-red-400 font-bold mb-1 tracking-wider text-xs font-bold">P2 CORE STATUS</h2>
            <div className="space-y-0.5 text-[10px]">
              <p><span className="text-red-200">{botInfo.pillName}</span> <span className="text-slate-500">:Core</span></p>
              <p><span className={botInfo.integrity > 0.4 ? "text-emerald-400" : "text-red-500"}>{(botInfo.integrity * 100).toFixed(1)}%</span> <span className="text-slate-500">:Integrity</span></p>
              <p><span className="text-orange-300">{botInfo.shearStress.toFixed(2)}</span> <span className="text-slate-500">:Dissonance</span></p>
              <p><span className="text-indigo-300">{botInfo.KActive.toFixed(1)}</span> <span className="text-slate-500">:Active K</span></p>
            </div>
            {botInfo.aiLog && (
               <p className="text-[8px] text-slate-400 border-t border-slate-800 pt-1 mt-1 leading-tight font-mono text-left">
                  {botInfo.aiLog}
               </p>
            )}
          </div>
       )}

       {/* Панель ручной регулировки параметров */}
       <div className="absolute bottom-12 left-4 bg-slate-950/90 border border-slate-800 p-3 w-72 text-[10px] space-y-2 z-30 max-h-[220px] overflow-y-auto backdrop-blur-md pointer-events-auto rounded">
          <h3 className="text-cyan-400 font-bold uppercase tracking-wider border-b border-slate-800 pb-1">Real-Time Calibration</h3>
          
          <label className="block text-slate-400">Simulation Speed: {settings.timeScale.toFixed(2)}x
             <input type="range" min="0.05" max="1.50" step="0.05" value={settings.timeScale} onChange={e => setSettings({...settings, timeScale: parseFloat(e.target.value)})} className="w-full accent-cyan-400 mt-1" />
          </label>

          <label className="block text-slate-400">Wave Speed (hbar): {settings.hbar.toFixed(0)}
             <input type="range" min="10" max="300" step="5" value={settings.hbar} onChange={e => setSettings({...settings, hbar: parseFloat(e.target.value)})} className="w-full accent-cyan-400 mt-1" />
          </label>

          <label className="block text-slate-400">Injection Power: {settings.injectionIntensity.toFixed(0)}
             <input type="range" min="10" max="300" step="5" value={settings.injectionIntensity} onChange={e => setSettings({...settings, injectionIntensity: parseFloat(e.target.value)})} className="w-full accent-cyan-400 mt-1" />
          </label>

          <label className="block text-slate-400">Tension Tear Threshold: {settings.tensionTear.toFixed(1)}
             <input type="range" min="1.1" max="5.0" step="0.1" value={settings.tensionTear} onChange={e => setSettings({...settings, tensionTear: parseFloat(e.target.value)})} className="w-full accent-cyan-400 mt-1" />
          </label>
       </div>

       <div className="absolute bottom-0 left-0 right-0 bg-slate-950/90 border-t border-slate-800 p-2 flex justify-between px-6 text-[10px] text-slate-500 backdrop-blur-sm z-20 pointer-events-none">
         <span>TIME: {time.toFixed(2)}s</span>
         <span className="text-cyan-500">QUANTUM WAVE ANALYTICS ENGINE</span>
       </div>
    </>
  );
};