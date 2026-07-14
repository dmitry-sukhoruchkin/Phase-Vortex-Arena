// src/components/CampaignHub.tsx
import React from 'react';
import { CAMPAIGN_REALMS, CampaignManager } from '../lib/campaign';

interface CampaignHubProps {
  maxRealmReached: number;
  essence: number;
  campaignGpu: boolean;
  setCampaignGpu: (val: boolean) => void;
  upgrades: { power: number; defense: number; focus: number };
  onBuyUpgrade: (stat: 'power' | 'defense' | 'focus') => void;
  onEnterRealm: (index: number) => void;
  onBack: () => void;
}

export const CampaignHub: React.FC<CampaignHubProps> = ({
  maxRealmReached, essence, campaignGpu, setCampaignGpu, upgrades, onBuyUpgrade, onEnterRealm, onBack
}) => {
  const upgradeCost = 150; // Стоимость прокачки алхимии

  return (
    <div className="min-h-screen bg-[#0a0c12] text-slate-300 font-mono flex items-center justify-center p-8 z-50 relative w-full">
         <div className="bg-slate-950/80 border border-cyan-900/50 p-8 shadow-2xl max-w-4xl w-full">
            <div className="flex justify-between items-center mb-8 border-b border-slate-800 pb-4">
               <div>
                  <h1 className="text-3xl text-cyan-400 font-bold tracking-widest">ALCHEMICAL CODRON</h1>
                  <p className="text-xs text-slate-400 mt-1">Upgrade your connectome structure</p>
               </div>
               <div className="flex gap-4 items-center">
                  <button className="px-3 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs cursor-pointer" onClick={onBack}>MAIN MENU</button>
                  <div className="text-xl text-yellow-400 font-bold">Essence: {essence}</div>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               {/* Alchemy Upgrades (Влияют на ваши 0-Star manual бои!) */}
               <div className="space-y-4">
                  <h2 className="text-xl text-slate-200 border-b border-slate-800 pb-1">Permanent Alchemy Upgrades</h2>
                  
                  <div className="flex justify-between items-center bg-slate-900 p-3 border border-slate-800 rounded">
                     <div>
                        <p className="text-red-400 font-bold">Yang Infusion (Lvl {upgrades.power})</p>
                        <p className="text-[10px] text-slate-500">Increases wave power and collision speed.</p>
                     </div>
                     <button className="px-3 py-2 bg-indigo-900/50 border border-indigo-500 text-xs hover:bg-indigo-800 cursor-pointer disabled:opacity-50" 
                             onClick={() => onBuyUpgrade('power')} disabled={essence < upgradeCost}>
                        Smelt ({upgradeCost})
                     </button>
                  </div>

                  <div className="flex justify-between items-center bg-slate-900 p-3 border border-slate-800 rounded">
                     <div>
                        <p className="text-emerald-400 font-bold">Soft-Body Templication (Lvl {upgrades.defense})</p>
                        <p className="text-[10px] text-slate-500">Significantly increases spring stiffness and HP.</p>
                     </div>
                     <button className="px-3 py-2 bg-indigo-900/50 border border-indigo-500 text-xs hover:bg-indigo-800 cursor-pointer disabled:opacity-50" 
                             onClick={() => onBuyUpgrade('defense')} disabled={essence < upgradeCost}>
                        Smelt ({upgradeCost})
                     </button>
                  </div>

                  <div className="flex justify-between items-center bg-slate-900 p-3 border border-slate-800 rounded">
                     <div>
                        <p className="text-purple-400 font-bold">Kuramoto Resonance (Lvl {upgrades.focus})</p>
                        <p className="text-[10px] text-slate-500">Provides better stabilization against wave noise.</p>
                     </div>
                     <button className="px-3 py-2 bg-indigo-900/50 border border-indigo-500 text-xs hover:bg-indigo-800 cursor-pointer disabled:opacity-50" 
                             onClick={() => onBuyUpgrade('focus')} disabled={essence < upgradeCost}>
                        Smelt ({upgradeCost})
                     </button>
                  </div>

                  {/* Специфический переключатель GPU для кампании */}
                  <div className="p-3 bg-slate-900 border border-slate-800 rounded flex justify-between items-center">
                     <span className="text-xs text-slate-400 font-bold">Campaign GPU Acceleration</span>
                     <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={campaignGpu} onChange={(e) => setCampaignGpu(e.target.checked)} className="sr-only peer" />
                        <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-600 peer-checked:after:bg-cyan-300"></div>
                     </label>
                  </div>
               </div>

               {/* Нелинейный выбор уровней (Мапа) */}
               <div className="space-y-4">
                  <h2 className="text-xl text-slate-200 border-b border-slate-800 pb-1">Realm Map</h2>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                     {CAMPAIGN_REALMS.map((realm, idx) => {
                        const isUnlocked = idx <= maxRealmReached + 1; // Unlocked if preceding is completed
                        const isCompleted = idx <= maxRealmReached;
                        
                        return (
                           <div key={realm.id} className={`p-3 border rounded flex justify-between items-center ${isCompleted ? 'border-emerald-900/40 bg-emerald-950/10' : isUnlocked ? 'border-cyan-900/50 bg-cyan-950/5' : 'border-slate-800 bg-slate-950/20 opacity-40'}`}>
                              <div className="text-left">
                                 <p className="text-xs font-bold text-white">{realm.name}</p>
                                 <p className="text-[10px] text-slate-400 truncate max-w-xs">{realm.description}</p>
                              </div>
                              {isUnlocked ? (
                                 <button className="px-3 py-1 bg-cyan-900/60 border border-cyan-500 text-[10px] text-cyan-200 hover:bg-cyan-700 cursor-pointer" onClick={() => onEnterRealm(idx)}>
                                    {isCompleted ? "Replay" : "Enter"}
                                 </button>
                              ) : (
                                 <span className="text-[10px] text-red-500">Locked</span>
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