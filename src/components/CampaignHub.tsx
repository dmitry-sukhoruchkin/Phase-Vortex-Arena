// src/components/CampaignHub.tsx
import React, { useState } from 'react';
import { CAMPAIGN_REALMS, CampaignManager } from '../lib/campaign';

export interface Teammate {
  id: string;
  name: string;
  stars: number;         // 0 = Manual Player, 1-5 = Auto AI Tier
  vector: [number, number, number]; // [Yang, Catalyst, Yin] balance
  color: [number, number, number];  // Procedural RGB values
  power: number;         // Upgrade levels
  defense: number;
  focus: number;
  isActive: boolean;
  isUnlocked: boolean;
  essenceCostToUnlock: number;
}

interface CampaignHubProps {
  teammates: Teammate[];
  setTeammates: React.Dispatch<React.SetStateAction<Teammate[]>>;
  maxRealmReached: number;
  essence: number;
  setEssence: React.Dispatch<React.SetStateAction<number>>;
  campaignGpu: boolean;
  setCampaignGpu: (val: boolean) => void;
  onEnterRealm: (index: number) => void;
  onBack: () => void;
}

export const CampaignHub: React.FC<CampaignHubProps> = ({
  teammates = [], setTeammates, maxRealmReached, essence, setEssence, campaignGpu, setCampaignGpu, onEnterRealm, onBack
}) => {
  const [selectedTeammateId, setSelectedTeammateId] = useState<string>('player');

  // Defensive fallback to prevent rendering crashes on uninitialized lists
  const selectedTeammate = (teammates || []).find(t => t.id === selectedTeammateId) || (teammates || [])[0] || {
    id: 'player',
    name: "The Grand Ascendant (You)",
    stars: 0,
    vector: [0.577, 0.577, 0.577] as [number, number, number],
    color: [255, 200, 255] as [number, number, number],
    power: 0,
    defense: 0,
    focus: 0,
    isActive: true,
    isUnlocked: true,
    essenceCostToUnlock: 0
  };

  const handleUpgrade = (stat: 'power' | 'defense' | 'focus') => {
    const cost = 150;
    if (essence >= cost) {
       setEssence(e => e - cost);
       setTeammates(prev => (prev || []).map(t => {
          if (t.id === selectedTeammateId) {
             return { ...t, [stat]: t[stat] + 1 };
          }
          return t;
       }));
    }
  };

  const handleUnlockTeammate = (id: string, cost: number) => {
    if (essence >= cost) {
       setEssence(e => e - cost);
       setTeammates(prev => (prev || []).map(t => {
          if (t.id === id) {
             return { ...t, isUnlocked: true, isActive: true };
          }
          return t;
       }));
    }
  };

  const toggleTeammateActive = (id: string) => {
    if (id === 'player') return; // Player is permanently deployed
    setTeammates(prev => (prev || []).map(t => {
       if (t.id === id) {
          return { ...t, isActive: !t.isActive };
       }
       return t;
    }));
  };

  const handleStarUpgrade = () => {
    const cost = 250;
    if (essence >= cost && selectedTeammate.stars < 5) {
       setEssence(e => e - cost);
       setTeammates(prev => (prev || []).map(t => {
          if (t.id === selectedTeammateId) {
             const nextStars = t.stars === 0 ? 1 : Math.min(5, t.stars + 1);
             return { ...t, stars: nextStars };
          }
          return t;
       }));
    }
  };

  const handlePillSmelt = (axis: 0 | 1 | 2, val: number) => {
     setTeammates(prev => (prev || []).map(t => {
        if (t.id === selectedTeammateId) {
           const nextVec = [...t.vector] as [number, number, number];
           nextVec[axis] = val;
           const norm = Math.max(1e-8, Math.hypot(nextVec[0], nextVec[1], nextVec[2]));
           const finalVec: [number, number, number] = [nextVec[0]/norm, nextVec[1]/norm, nextVec[2]/norm];
           const finalColor: [number, number, number] = [
              Math.round(finalVec[0] * 255),
              Math.round(finalVec[1] * 255),
              Math.round(finalVec[2] * 255)
           ];
           return {
              ...t,
              vector: finalVec,
              color: finalColor
           };
        }
        return t;
     }));
  };

  return (
    <div className="min-h-screen bg-[#0a0c12] text-slate-300 font-mono flex items-center justify-center p-8 z-50 relative w-full">
         <div className="bg-slate-950/80 border border-cyan-900/50 p-6 shadow-2xl max-w-5xl w-full rounded">
            
            {/* Header Area */}
            <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4">
               <div>
                  <h1 className="text-3xl text-cyan-400 font-bold tracking-widest uppercase">ALCHEMICAL WORKSHOP</h1>
                  <p className="text-xs text-slate-400 mt-1">Configure, upgrade, and smelt your soul-bound alchemical companions</p>
               </div>
               <div className="flex gap-4 items-center">
                  <button className="px-3 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs cursor-pointer rounded" onClick={onBack}>MAIN MENU</button>
                  <div className="text-sm bg-yellow-950/20 border border-yellow-800/40 text-yellow-400 px-3 py-1.5 rounded font-bold">Essence: {essence}</div>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               
               {/* COLUMN 1: Alchemical Squad & Smelting Lab */}
               <div className="space-y-4">
                  <h2 className="text-lg text-slate-200 border-b border-slate-800 pb-1 font-bold">Squad Roster & Presets</h2>
                  
                  {/* Tabs to select active teammate */}
                  <div className="flex gap-2 overflow-x-auto pb-2 border-b border-slate-900">
                     {(teammates || []).map(t => {
                        const isSelected = t.id === selectedTeammateId;
                        return (
                           <button 
                              key={t.id}
                              className={`px-3 py-1.5 text-[10px] uppercase font-bold border rounded whitespace-nowrap cursor-pointer transition-all ${
                                 isSelected 
                                    ? 'bg-cyan-900/30 border-cyan-400 text-cyan-200' 
                                    : t.isUnlocked 
                                       ? 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-600' 
                                       : 'bg-slate-950 border-slate-900 text-slate-600 opacity-60'
                              }`}
                              onClick={() => setSelectedTeammateId(t.id)}
                           >
                              {t.name} {!t.isUnlocked && "🔒"} {t.isActive && t.isUnlocked && "⚔️"}
                           </button>
                        );
                     })}
                  </div>

                  {/* Smelting Lab interface for the selected teammate */}
                  {selectedTeammate?.isUnlocked ? (
                     <div className="p-4 bg-slate-900/50 border border-slate-800 rounded space-y-4">
                        <div className="flex justify-between items-start border-b border-slate-800 pb-2">
                           <div>
                              <h3 className="text-white font-bold text-xs uppercase">{selectedTeammate?.name}</h3>
                              <p className="text-[9px] text-slate-400">
                                 AI stars: <span className="text-yellow-400 font-bold">{selectedTeammate?.stars > 0 ? `${selectedTeammate?.stars}★` : "0★ (Manual)"}</span>
                              </p>
                           </div>
                           
                           {/* Active deployment checkbox */}
                           {selectedTeammate?.id !== 'player' && (
                              <label className="flex items-center gap-2 text-[10px] text-cyan-400 font-bold cursor-pointer">
                                 <input 
                                    type="checkbox" 
                                    checked={selectedTeammate?.isActive} 
                                    onChange={() => toggleTeammateActive(selectedTeammate?.id)}
                                    className="accent-cyan-400"
                                 />
                                 Deploy to Squad
                              </label>
                           )}
                        </div>

                        {/* Vector Sliders (Alchemical Smelting) */}
                        <div className="space-y-3 bg-black/40 p-3 rounded border border-slate-950">
                           <h4 className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Pill Spectral Smelting</h4>
                           
                           <div className="flex items-center gap-4">
                              {/* Visual preview circle of the procedural color */}
                              <div 
                                 className="w-12 h-12 rounded-full border border-slate-800 shadow-[0_0_15px_rgba(255,255,255,0.05)] shrink-0 transition-all duration-300"
                                 style={{ backgroundColor: `rgb(${selectedTeammate?.color?.[0] ?? 255}, ${selectedTeammate?.color?.[1] ?? 255}, ${selectedTeammate?.color?.[2] ?? 255})` }}
                              />
                              <div className="space-y-2 flex-1">
                                 <label className="flex items-center gap-2 text-[9px] text-red-400">
                                    Yang: 
                                    <input 
                                       type="range" 
                                       min="0.01" 
                                       max="1" 
                                       step="0.05" 
                                       value={selectedTeammate?.vector?.[0] ?? 0.577} 
                                       onChange={e => handlePillSmelt(0, parseFloat(e.target.value))}
                                       className="w-full accent-red-500" 
                                    />
                                 </label>
                                 <label className="flex items-center gap-2 text-[9px] text-green-400">
                                    Catalyst: 
                                    <input 
                                       type="range" 
                                       min="0.01" 
                                       max="1" 
                                       step="0.05" 
                                       value={selectedTeammate?.vector?.[1] ?? 0.577} 
                                       onChange={e => handlePillSmelt(1, parseFloat(e.target.value))}
                                       className="w-full accent-green-500" 
                                    />
                                 </label>
                                 <label className="flex items-center gap-2 text-[9px] text-blue-400">
                                    Yin: 
                                    <input 
                                       type="range" 
                                       min="0.01" 
                                       max="1" 
                                       step="0.05" 
                                       value={selectedTeammate?.vector?.[2] ?? 0.577} 
                                       onChange={e => handlePillSmelt(2, parseFloat(e.target.value))}
                                       className="w-full accent-blue-500" 
                                    />
                                 </label>
                              </div>
                           </div>
                        </div>

                        {/* Individual Stat Upgrades */}
                        <div className="space-y-2">
                           <h4 className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Alchemical Upgrades</h4>
                           
                           <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px]">
                              <div className="flex justify-between items-center bg-slate-950 p-2 rounded border border-slate-900">
                                 <div>
                                    <p className="text-red-400 font-bold">Yang Power (Lvl {selectedTeammate?.power ?? 0})</p>
                                    <p className="text-[8px] text-slate-500">Boosts wave intensity</p>
                                 </div>
                                 <button className="px-2 py-1 bg-indigo-950 border border-indigo-700 text-[9px] text-indigo-300 font-bold hover:bg-indigo-900 disabled:opacity-50 cursor-pointer" onClick={() => handleUpgrade('power')} disabled={essence < 150}>
                                    Smelt (150)
                                 </button>
                              </div>

                              <div className="flex justify-between items-center bg-slate-950 p-2 rounded border border-slate-900">
                                 <div>
                                    <p className="text-emerald-400 font-bold">Stiffness (Lvl {selectedTeammate?.defense ?? 0})</p>
                                    <p className="text-[8px] text-slate-500">Boosts spring tension</p>
                                 </div>
                                 <button className="px-2 py-1 bg-indigo-950 border border-indigo-700 text-[9px] text-indigo-300 font-bold hover:bg-indigo-900 disabled:opacity-50 cursor-pointer" onClick={() => handleUpgrade('defense')} disabled={essence < 150}>
                                    Smelt (150)
                                 </button>
                              </div>

                              <div className="flex justify-between items-center bg-slate-950 p-2 rounded border border-slate-900">
                                 <div>
                                    <p className="text-purple-400 font-bold">Resonance (Lvl {selectedTeammate?.focus ?? 0})</p>
                                    <p className="text-[8px] text-slate-500">Improves phase-coupling</p>
                                 </div>
                                 <button className="px-2 py-1 bg-indigo-950 border border-indigo-700 text-[9px] text-indigo-300 font-bold hover:bg-indigo-900 disabled:opacity-50 cursor-pointer" onClick={() => handleUpgrade('focus')} disabled={essence < 150}>
                                    Smelt (150)
                                 </button>
                              </div>

                              {/* Upgrade AI Smartness / Stars */}
                              <div className="flex justify-between items-center bg-slate-950 p-2 rounded border border-slate-900">
                                 <div>
                                    <p className="text-yellow-400 font-bold">AI Autonomic (Stars: {selectedTeammate?.stars ?? 0}★)</p>
                                    <p className="text-[8px] text-slate-500">Smart pathfinding/tactics</p>
                                 </div>
                                 <button 
                                    className="px-2 py-1 bg-yellow-950/20 border border-yellow-800 text-[9px] text-yellow-300 font-bold hover:bg-yellow-900/50 disabled:opacity-30 cursor-pointer" 
                                    onClick={handleStarUpgrade} 
                                    disabled={essence < 250 || (selectedTeammate?.stars ?? 0) >= 5}
                                 >
                                    Upgrade (250)
                                 </button>
                              </div>
                           </div>
                        </div>

                     </div>
                  ) : (
                     // Locked companion layout (synthesis screen)
                     <div className="p-8 bg-slate-950 border border-red-900/30 rounded flex flex-col items-center text-center space-y-4">
                        <div className="text-3xl opacity-50">🔒</div>
                        <div>
                           <h3 className="text-slate-200 font-bold uppercase">{selectedTeammate?.name}</h3>
                           <p className="text-[10px] text-slate-500 mt-1 max-w-xs">Synthesize this autonomic companion and bind its connectome to your alchemical workshop.</p>
                        </div>
                        <button 
                           className="px-6 py-2 bg-red-950/30 border border-red-700 hover:bg-red-900 hover:text-white text-red-400 font-bold text-xs cursor-pointer tracking-wider rounded uppercase disabled:opacity-40 transition-colors"
                           onClick={() => handleUnlockTeammate(selectedTeammate?.id, selectedTeammate?.essenceCostToUnlock ?? 150)}
                           disabled={essence < (selectedTeammate?.essenceCostToUnlock ?? 150)}
                        >
                           Smelt Connectome ({selectedTeammate?.essenceCostToUnlock ?? 150} Essence)
                        </button>
                     </div>
                  )}

                  {/* GPU toggle option */}
                  <div className="p-3 bg-slate-900/50 border border-slate-800 rounded flex justify-between items-center">
                     <span className="text-xs text-slate-400 font-bold">GPU Acceleration (WebGL2)</span>
                     <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={campaignGpu} onChange={(e) => setCampaignGpu(e.target.checked)} className="sr-only peer" />
                        <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-600 peer-checked:after:bg-cyan-300"></div>
                     </label>
                  </div>
               </div>

               {/* COLUMN 2: Non-Linear Campaign / Realm Map */}
               <div className="space-y-4">
                  <h2 className="text-lg text-slate-200 border-b border-slate-800 pb-1 font-bold">Realm Maps</h2>
                  <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                     {CAMPAIGN_REALMS.map((realm, idx) => {
                        const isUnlocked = idx <= maxRealmReached + 1; 
                        const isCompleted = idx <= maxRealmReached;
                        
                        return (
                           <div key={realm.id} className={`p-3 border rounded flex justify-between items-center transition-all ${isCompleted ? 'border-emerald-900/40 bg-emerald-950/10' : isUnlocked ? 'border-cyan-900/50 bg-cyan-950/5' : 'border-slate-800 bg-slate-950/20 opacity-40'}`}>
                              <div className="text-left space-y-0.5">
                                 <p className="text-xs font-bold text-white uppercase">{realm.name}</p>
                                 <p className="text-[10px] text-slate-400 truncate max-w-xs">{realm.description}</p>
                                 <div className="flex gap-2 text-[8px] text-slate-500">
                                    <span>Elements: <strong className="text-cyan-500">{realm.numElements}</strong></span>
                                    <span>Max Size: <strong className="text-indigo-400">{realm.teamSize}v{realm.teamSize}</strong></span>
                                    <span>Reward: <strong className="text-yellow-500">+{realm.reward}</strong></span>
                                 </div>
                              </div>
                              {isUnlocked ? (
                                 <button className="px-3 py-2 bg-cyan-900/40 border border-cyan-500 text-[10px] text-cyan-200 hover:bg-cyan-700 cursor-pointer rounded tracking-wider uppercase font-bold" onClick={() => onEnterRealm(idx)}>
                                    {isCompleted ? "Replay" : "Enter"}
                                 </button>
                              ) : (
                                 <span className="text-[10px] text-red-500 uppercase font-bold">Locked</span>
                              )}
                           </div>
                        );
                     })}
                  </div>
               </div>

            </div>
         </div>
      </div>
  );
};