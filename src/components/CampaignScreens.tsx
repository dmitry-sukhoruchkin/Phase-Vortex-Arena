import React from 'react';
import { CAMPAIGN_LEVELS, AUTOBATTLER_CONFIG } from '../lib/config';

interface CampaignScreensProps {
  gameState: 'CAMPAIGN_HUB' | 'POST_MATCH';
  campaignLevel: number;
  essence: number;
  matchResult: 'VICTORY' | 'DEFEAT' | null;
  upgrades: { power: number; defense: number; focus: number };
  isCampaignMatch: boolean;
  onBuyUpgrade: (stat: 'power' | 'defense' | 'focus') => void;
  onEnterArena: () => void;
  onReturnToHub: () => void;
  onReturnToSandbox: () => void;
}

export const CampaignScreens: React.FC<CampaignScreensProps> = ({
  gameState, campaignLevel, essence, matchResult, upgrades, isCampaignMatch, 
  onBuyUpgrade, onEnterArena, onReturnToHub, onReturnToSandbox
}) => {
  
  const currentLvlData = CAMPAIGN_LEVELS[Math.min(campaignLevel - 1, CAMPAIGN_LEVELS.length - 1)];

  if (gameState === 'POST_MATCH') {
    const isVictory = matchResult === 'VICTORY';
    const earned = isVictory ? currentLvlData.reward : 10;

    return (
      <div className="min-h-screen bg-[#0a0c12] text-slate-300 flex flex-col items-center justify-center p-8 z-50 relative">
         <h1 className={`text-6xl font-bold mb-4 ${isVictory ? 'text-emerald-500' : 'text-red-500'}`}>
           {isVictory ? 'VICTORY' : 'DEFEAT'}
         </h1>
         {isCampaignMatch && <p className="text-xl mb-8 text-cyan-300">Essence Absorbed: +{earned}</p>}
         
         <button 
            className="px-8 py-3 bg-cyan-900 border border-cyan-500 text-white font-bold hover:bg-cyan-700 cursor-pointer"
            onClick={isCampaignMatch ? onReturnToHub : onReturnToSandbox}
         >
            {isCampaignMatch ? 'RETURN TO CAULDRON (HUB)' : 'RETURN TO SANDBOX'}
         </button>
      </div>
    );
  }

  // CAMPAIGN_HUB
  const upgradeCost = AUTOBATTLER_CONFIG.upgradeBaseCost;

  return (
    <div className="min-h-screen bg-[#0a0c12] text-slate-300 flex flex-col items-center justify-center p-8 z-50 relative">
       <div className="bg-slate-950/80 border border-cyan-900/50 p-8 shadow-2xl max-w-3xl w-full">
          <div className="flex justify-between items-center mb-8 border-b border-slate-800 pb-4">
             <h1 className="text-3xl text-cyan-400 font-bold tracking-widest">THE CAULDRON</h1>
             <div className="flex gap-4">
                <button className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white cursor-pointer text-sm" onClick={onReturnToSandbox}>EXIT TO MAIN MENU</button>
                <div className="text-xl text-yellow-400 font-bold">Essence: {essence}</div>
             </div>
          </div>

          <div className="grid grid-cols-2 gap-8 mb-8">
             <div className="space-y-4">
                <h2 className="text-xl text-slate-200">Upgrade Cultivator</h2>
                
                <div className="flex justify-between items-center bg-slate-900 p-3 border border-slate-700">
                   <div>
                      <p className="text-red-400 font-bold">Power (Lvl {upgrades.power})</p>
                      <p className="text-xs text-slate-500">Boosts Wave Injection</p>
                   </div>
                   <button className="px-3 py-1 bg-slate-800 border border-slate-600 hover:border-cyan-400 disabled:opacity-50 cursor-pointer" 
                           onClick={() => onBuyUpgrade('power')} disabled={essence < upgradeCost}>
                      Cost: {upgradeCost}
                   </button>
                </div>

                <div className="flex justify-between items-center bg-slate-900 p-3 border border-slate-700">
                   <div>
                      <p className="text-emerald-400 font-bold">Defense (Lvl {upgrades.defense})</p>
                      <p className="text-xs text-slate-500">Increases Node Stiffness</p>
                   </div>
                   <button className="px-3 py-1 bg-slate-800 border border-slate-600 hover:border-cyan-400 disabled:opacity-50 cursor-pointer" 
                           onClick={() => onBuyUpgrade('defense')} disabled={essence < upgradeCost}>
                      Cost: {upgradeCost}
                   </button>
                </div>

                <div className="flex justify-between items-center bg-slate-900 p-3 border border-slate-700">
                   <div>
                      <p className="text-purple-400 font-bold">Focus (Lvl {upgrades.focus})</p>
                      <p className="text-xs text-slate-500">Increases Phase Coupling</p>
                   </div>
                   <button className="px-3 py-1 bg-slate-800 border border-slate-600 hover:border-cyan-400 disabled:opacity-50 cursor-pointer" 
                           onClick={() => onBuyUpgrade('focus')} disabled={essence < upgradeCost}>
                      Cost: {upgradeCost}
                   </button>
                </div>
             </div>

             <div className="bg-slate-900 p-6 border border-red-900/50 flex flex-col justify-center items-center text-center">
                <h2 className="text-2xl text-red-400 font-bold mb-2">NEXT BATTLE</h2>
                <p className="text-lg text-white mb-2">{currentLvlData.name}</p>
                <p className="text-sm text-slate-400 mb-6">Enemy Core: {currentLvlData.pill}</p>
                
                <button 
                   className="w-full py-3 bg-red-900/50 border border-red-500 text-red-200 hover:bg-red-800 font-bold tracking-wider cursor-pointer"
                   onClick={onEnterArena}
                >
                   ENTER ARENA
                </button>
             </div>
          </div>
       </div>
    </div>
  );
};