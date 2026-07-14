// src/components/PostMatchHUD.tsx
import React from 'react';

export interface CultivatorStats {
  id: string;
  name: string;
  team: number;
  damageDealt: number;
  integrity: number;
  isPlayer: boolean;
}

interface PostMatchHUDProps {
  stats: CultivatorStats[];
  matchResult: 'VICTORY' | 'DEFEAT' | null;
  earnedEssence: number;
  isCampaign: boolean;
  onContinue: () => void;
}

export const PostMatchHUD: React.FC<PostMatchHUDProps> = ({
  stats, matchResult, earnedEssence, isCampaign, onContinue
}) => {
  // Находим MVP (юнит с максимальным нанесенным уроном на поле боя)
  let mvp: CultivatorStats | null = null;
  let maxDmg = -1;
  for (const s of stats) {
    if (s.damageDealt > maxDmg) {
      maxDmg = s.damageDealt;
      mvp = s;
    }
  }

  // Общий урон для расчета процентов (Damage Ratio)
  const totalDamage = stats.reduce((acc, curr) => acc + curr.damageDealt, 0) || 1;

  return (
    <div className="min-h-screen bg-[#0a0c12]/95 text-slate-300 font-mono flex items-center justify-center p-8 z-50 relative w-full">
         <div className="bg-slate-950 border-2 border-indigo-900/50 p-8 shadow-2xl max-w-3xl w-full rounded shadow-[0_0_50px_rgba(99,102,241,0.2)]">
            
            {/* Результат матча */}
            <div className="text-center mb-6">
               <h1 className={`text-6xl font-bold tracking-widest uppercase drop-shadow-[0_0_15px_rgba(0,0,0,1)] ${matchResult === 'VICTORY' ? 'text-emerald-400' : 'text-red-500'}`}>
                  {matchResult === 'VICTORY' ? 'Victory!' : 'Defeated'}
               </h1>
               {isCampaign && (
                  <p className="text-yellow-400 font-bold mt-2 text-sm tracking-wider">
                     Reward: +{earnedEssence} Essence Obtained!
                  </p>
               )}
            </div>

            {/* Блок MVP */}
            {mvp && (
               <div className="mb-6 p-4 bg-indigo-950/20 border border-indigo-800/40 rounded flex items-center justify-between">
                  <div>
                     <span className="bg-yellow-500 text-slate-950 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider mr-2">MVP</span>
                     <span className="text-white font-bold">{mvp.name}</span>
                  </div>
                  <div className="text-right">
                     <p className="text-[10px] text-slate-400 uppercase">Max Damage Dealt</p>
                     <p className="text-indigo-300 font-bold text-lg">{mvp.damageDealt.toFixed(0)}</p>
                  </div>
               </div>
            )}

            {/* Таблица аналитики */}
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Valkyrie Damage Statistics</h2>
            <div className="space-y-3 mb-8">
               {stats.map(s => {
                  const percent = (s.damageDealt / totalDamage) * 100;
                  const isPlayerTeam = s.team === 0;
                  return (
                     <div key={s.id} className="p-3 bg-slate-900/80 border border-slate-800 rounded">
                        <div className="flex justify-between items-center mb-1 text-xs">
                           <span className={`font-bold ${isPlayerTeam ? 'text-cyan-400' : 'text-red-400'}`}>
                              {s.name} {s.isPlayer ? '(You)' : ''}
                           </span>
                           <span className="text-slate-400">
                              Dmg: <strong className="text-slate-200">{s.damageDealt.toFixed(0)}</strong> ({percent.toFixed(1)}%)
                           </span>
                        </div>
                        
                        {/* Полоска распределения урона (Damage Ratio) */}
                        <div className="w-full bg-slate-950 h-2 rounded overflow-hidden flex">
                           <div 
                              className={`h-full transition-all duration-500 ${isPlayerTeam ? 'bg-cyan-500' : 'bg-red-500'}`}
                              style={{ width: `${percent}%` }}
                           />
                        </div>
                        
                        {/* Здоровье на момент конца боя */}
                        <div className="flex justify-between items-center mt-1 text-[10px] text-slate-500">
                           <span>Remaining integrity:</span>
                           <span className={s.integrity > 0.4 ? "text-emerald-400" : "text-red-400"}>{(s.integrity * 100).toFixed(1)}%</span>
                        </div>
                     </div>
                  );
               })}
            </div>

            {/* Кнопка продолжения */}
            <button 
               className="w-full py-4 bg-indigo-900/40 border border-indigo-500 hover:bg-indigo-800/50 text-indigo-300 font-bold tracking-widest cursor-pointer uppercase transition-colors"
               onClick={onContinue}
            >
               Continue Journey
            </button>
         </div>
      </div>
  );
};