// src/components/SandboxMenu.tsx
import React from 'react';
import { SEMANTIC_PILLS_DB } from '../lib/config';
import { neuroService } from '../lib/NeuroService';
import { multiplayerService } from '../lib/MultiplayerService';

interface SandboxConfig {
  p1Pill: string;
  p2Pill: string;
  mode: "PvsB" | "BvsB" | "PvsP";
  teamSize: number;
  numElements: number;
  gridRes: number;
  gpuEnabled: boolean;
  p1CustomVec: [number, number, number];
  p2CustomVec: [number, number, number];
  p1Stars: number; // Настройка звезд для игрока
  p2Stars: number; // Настройка звезд для врагов
}

interface SandboxMenuProps {
  config: SandboxConfig;
  setConfig: React.Dispatch<React.SetStateAction<SandboxConfig>>;
  myId: string;
  peerId: string;
  setPeerId: (id: string) => void;
  p2pConnected: boolean;
  onStartMatch: () => void;
  onBack: () => void;
}

export const SandboxMenu: React.FC<SandboxMenuProps> = ({
  config, setConfig, myId, peerId, setPeerId, p2pConnected, onStartMatch, onBack
}) => {
  const pillOptions = [...Object.keys(SEMANTIC_PILLS_DB), "Custom"];

  const renderSliders = (vec: [number, number, number], setVec: (v: [number, number, number]) => void) => (
     <div className="space-y-2 mt-2">
        <label className="flex items-center gap-2 text-xs text-red-400">
           Yang: <input type="range" min="0" max="1" step="0.1" value={vec[0]} onChange={e => setVec([parseFloat(e.target.value), vec[1], vec[2]])} className="w-full accent-red-500" />
        </label>
        <label className="flex items-center gap-2 text-xs text-green-400">
           Catalyst: <input type="range" min="0" max="1" step="0.1" value={vec[1]} onChange={e => setVec([vec[0], parseFloat(e.target.value), vec[2]])} className="w-full accent-green-500" />
        </label>
        <label className="flex items-center gap-2 text-xs text-blue-400">
           Yin: <input type="range" min="0" max="1" step="0.1" value={vec[2]} onChange={e => setVec([vec[0], vec[1], parseFloat(e.target.value)])} className="w-full accent-blue-500" />
        </label>
     </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0c12] text-slate-300 font-mono flex items-center justify-center p-8 z-50 relative w-full">
         <div className="bg-slate-950/80 border border-cyan-900/50 p-8 shadow-2xl max-w-2xl w-full">
            <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-2">
               <h1 className="text-3xl text-cyan-400 font-bold tracking-widest">SANDBOX MODE</h1>
               <button className="px-3 py-1 bg-slate-800 border border-slate-700 text-xs hover:bg-slate-700 cursor-pointer" onClick={onBack}>BACK</button>
            </div>

            <div className="space-y-8">
               <div>
                  <h2 className="text-xl text-slate-200 mb-4">Configurations (Persistent)</h2>
                  <div className="flex gap-4 mb-4 items-center flex-wrap">
                    <label className="text-xs text-slate-500">Elements:
                        <select className="ml-2 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white" value={config.numElements} onChange={e => setConfig(prev => ({...prev, numElements: parseInt(e.target.value)}))}>
                            <option value={3}>3 (RGB)</option>
                            <option value={5}>5 (Wu Xing)</option>
                            <option value={7}>7 (Rainbow)</option>
                        </select>
                    </label>
                    <label className="text-xs text-slate-500">Grid Res:
                        <select className="ml-2 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white" value={config.gridRes} onChange={e => setConfig(prev => ({...prev, gridRes: parseInt(e.target.value)}))}>
                            <option value={60}>60 (Fast)</option>
                            <option value={80}>80 (Normal)</option>
                            <option value={100}>100 (Detailed)</option>
                        </select>
                    </label>
                    <label className="text-xs text-slate-500 flex items-center gap-2 cursor-pointer border border-slate-700 rounded px-2 py-1">
                        <input type="checkbox" checked={config.gpuEnabled} onChange={e => setConfig(prev => ({...prev, gpuEnabled: e.target.checked}))} className="accent-cyan-400" /> GPU Sim (WebGL2)
                    </label>
                  </div>

                  {/* ВЫБОР УРОВНЯ ИИ / АВТОМАТИЗАЦИИ ДЛЯ КАЖДОЙ КОМАНДЫ */}
                  <div className="flex gap-4 mb-4 items-center flex-wrap bg-slate-900/50 p-3 border border-slate-800 rounded">
                    <label className="text-xs text-cyan-400 font-bold">P1 Stars (AI):
                        <select className="ml-2 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white text-xs" value={config.p1Stars} onChange={e => setConfig(prev => ({...prev, p1Stars: parseInt(e.target.value)}))}>
                            <option value={0}>0★ (Manual Control)</option>
                            <option value={1}>1★ (Moving Slime)</option>
                            <option value={2}>2★ (Easy Bot)</option>
                            <option value={3}>3★ (Medium Bot)</option>
                            <option value={4}>4★ (Hard Bot)</option>
                            <option value={5}>5★ (Kuramoto God)</option>
                        </select>
                    </label>

                    <label className="text-xs text-red-400 font-bold">P2 Stars (AI):
                        <select className="ml-2 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white text-xs" value={config.p2Stars} onChange={e => setConfig(prev => ({...prev, p2Stars: parseInt(e.target.value)}))}>
                            <option value={1}>1★ (Dumb Slime)</option>
                            <option value={2}>2★ (Easy Adversary)</option>
                            <option value={3}>3★ (Normal Adversary)</option>
                            <option value={4}>4★ (Hard Adversary)</option>
                            <option value={5}>5★ (Kuramoto God)</option>
                        </select>
                    </label>
                  </div>

                  <div className="flex gap-4 mb-4">
                     <button className={`px-4 py-2 border cursor-pointer ${config.teamSize === 1 ? 'border-cyan-400 text-cyan-400 bg-cyan-950/30' : 'border-slate-700 text-slate-500'}`} onClick={() => setConfig(prev => ({...prev, teamSize: 1}))}>1v1</button>
                     <button className={`px-4 py-2 border cursor-pointer ${config.teamSize === 3 ? 'border-cyan-400 text-cyan-400 bg-cyan-950/30' : 'border-slate-700 text-slate-500'}`} onClick={() => setConfig(prev => ({...prev, teamSize: 3}))}>3v3</button>
                     <button className={`px-4 py-2 border cursor-pointer ${config.teamSize === 5 ? 'border-cyan-400 text-cyan-400 bg-cyan-950/30' : 'border-slate-700 text-slate-500'}`} onClick={() => setConfig(prev => ({...prev, teamSize: 5}))}>5v5</button>
                  </div>
                  <div className="flex gap-4 mb-4">
                     <button 
                        className={`px-4 py-2 border cursor-pointer ${config.mode === 'PvsB' ? 'border-cyan-400 text-cyan-400 bg-cyan-950/30' : 'border-slate-700 text-slate-500'}`}
                        onClick={() => setConfig(prev => ({...prev, mode: 'PvsB'}))}
                     >
                        Player vs Bot
                     </button>
                     <button 
                        className={`px-4 py-2 border cursor-pointer ${config.mode === 'BvsB' ? 'border-cyan-400 text-cyan-400 bg-cyan-950/30' : 'border-slate-700 text-slate-500'}`}
                        onClick={() => setConfig(prev => ({...prev, mode: 'BvsB'}))}
                     >
                        Bot vs Bot
                     </button>
                     <button 
                        className={`px-4 py-2 border cursor-pointer ${config.mode === 'PvsP' ? 'border-cyan-400 text-cyan-400 bg-cyan-950/30' : 'border-slate-700 text-slate-500'}`}
                        onClick={() => setConfig(prev => ({...prev, mode: 'PvsP'}))}
                     >
                        PvsP (P2P)
                     </button>
                  </div>
                  {config.mode === 'PvsP' && (
                     <div className="flex gap-4 mb-4 flex-col text-xs p-2 border border-cyan-800 bg-cyan-950/20">
                       <p className="text-cyan-400">My ID: <span className="font-mono text-white">{myId}</span></p>
                       <div className="flex gap-2">
                         <input type="text" placeholder="Peer ID" value={peerId} onChange={e => setPeerId(e.target.value)} className="bg-slate-900 border border-slate-700 p-1 text-white flex-1" />
                         <button className="bg-cyan-800 px-3 hover:bg-cyan-700 text-white cursor-pointer" onClick={() => multiplayerService.connect(peerId)}>Connect</button>
                       </div>
                       <p className="text-green-400">{p2pConnected ? "Connected to Peer!" : "Waiting..."}</p>
                     </div>
                  )}
                  
                  <div className="flex gap-2 mb-4 mt-4 flex-wrap">
                    <button className="px-3 py-1 border border-indigo-500/50 text-indigo-400 text-xs hover:bg-indigo-900/30 cursor-pointer" onClick={() => neuroService.connectBLE()}>Connect BLE EEG</button>
                    <button className="px-3 py-1 border border-indigo-500/50 text-indigo-400 text-xs hover:bg-indigo-900/30 cursor-pointer" onClick={() => neuroService.connectUART()}>Connect UART EEG</button>
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-8">
                 <div>
                    <h2 className="text-lg text-cyan-300 mb-2">P1 Pill Core</h2>
                    <select 
                      className="w-full bg-slate-900 border border-slate-700 p-2 text-sm text-cyan-100"
                      value={config.p1Pill}
                      onChange={(e) => setConfig(prev => ({...prev, p1Pill: e.target.value}))}
                    >
                      {pillOptions.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                    {config.p1Pill === "Custom" && renderSliders(config.p1CustomVec, (v) => setConfig(prev => ({...prev, p1CustomVec: v})))}
                 </div>
                 
                 <div>
                    <h2 className="text-lg text-red-300 mb-2">P2 Pill Core</h2>
                    <select 
                      className="w-full bg-slate-900 border border-slate-700 p-2 text-sm text-red-100"
                      value={config.p2Pill}
                      onChange={(e) => setConfig(prev => ({...prev, p2Pill: e.target.value}))}
                    >
                      {pillOptions.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                    {config.p2Pill === "Custom" && renderSliders(config.p2CustomVec, (v) => setConfig(prev => ({...prev, p2CustomVec: v})))}
                 </div>
               </div>

               <button 
                  className="w-full py-4 bg-cyan-900/40 border border-cyan-500 text-cyan-300 hover:bg-cyan-800/60 hover:text-white transition-colors text-xl font-bold tracking-[0.2em] cursor-pointer"
                  onClick={onStartMatch}
               >
                  START MATCH
               </button>
            </div>
         </div>
      </div>
  );
};