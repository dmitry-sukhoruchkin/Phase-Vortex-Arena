// src/lib/campaign.ts
import { PillConfig, SEMANTIC_PILLS_DB } from './config';

export interface RealmConfig {
  id: number;
  name: string;
  description: string;
  isPrologue: boolean;
  teamSize: number;
  numElements: number;     // СТИХИИ (3, 5, 7) - определяют Реалм!
  playerStars: number;     // 0 = ручное управление игрока, >0 = автобаттлер
  companionStars: number;  
  enemyStars: number;      
  playerPill: string;
  enemyPill: string;
  durationLimit?: number;  
  reward: number;          
}

export const CAMPAIGN_REALMS: RealmConfig[] = [
  // --- PROLOGUE ---
  {
    id: -1,
    name: "PROLOGUE: The Infinite Dao",
    description: "Оцените предел альхимии. Clashing of 5-Star Autonomic Entities in 7 elements frequency storm. Вы скоро лишитесь этой силы.",
    isPrologue: true,
    teamSize: 5,
    numElements: 7, 
    playerStars: 5, 
    companionStars: 5,
    enemyStars: 5,
    playerPill: "Turbulent Anomaly",
    enemyPill: "Pure Yang Core",
    durationLimit: 12.0,
    reward: 50
  },
  
  // --- REALM I: 3 Primordial Elements (RGB) ---
  {
    id: 0,
    name: "REALM I: Level 1-1 (Mortal Domain)",
    description: "Начало пути. Вы — ручной 0-звездочный слайм в 3-стихийном реалме. Протараньте вражеского бота.",
    isPrologue: false,
    teamSize: 1,
    numElements: 3,
    playerStars: 0, 
    companionStars: 0,
    enemyStars: 1,  
    playerPill: "Foundation Pill",
    enemyPill: "Deep Yin Core",
    reward: 100
  },
  {
    id: 1,
    name: "REALM I: Level 1-2 (The Dual Spirit)",
    description: "Первое слияние. 1-звездочный ИИ-напарник бьется за вас в 3 стихиях. Враг стал чуть сообразительнее.",
    isPrologue: false,
    teamSize: 2,
    numElements: 3,
    playerStars: 0, 
    companionStars: 1, 
    enemyStars: 2,     
    playerPill: "Pure Yang Core",
    enemyPill: "Deep Yin Core",
    reward: 150
  },
  {
    id: 2,
    name: "REALM I: Level 1-3 (3v3 Automation)",
    description: "Достигните полной 3-звездочной автоматизации. Расслабьтесь и наблюдайте за соревнованием билдов.",
    isPrologue: false,
    teamSize: 3,
    numElements: 3, 
    playerStars: 3, 
    companionStars: 3,
    enemyStars: 3,
    playerPill: "Foundation Pill",
    enemyPill: "Turbulent Anomaly",
    reward: 200
  },

  // --- REALM II: 5 Convergent Phases (Wu Xing) ---
  {
    id: 3,
    name: "REALM II: Level 2-1 (Metal & Wood Rise)",
    description: "Вы перешли в Реалм 5 Стихий (Система У-Син). ИИ настраивает более глубокие фазовые уравнения.",
    isPrologue: false,
    teamSize: 2,
    numElements: 5,
    playerStars: 4, 
    companionStars: 4,
    enemyStars: 4,
    playerPill: "Turbulent Anomaly",
    enemyPill: "Pure Yang Core",
    reward: 300
  },
  {
    id: 4,
    name: "REALM II: Level 2-2 (Five Elements Clash)",
    description: "Полномасштабный 3v3 автобой в 5 стихиях. Проверьте надежность ваших алхимических перков.",
    isPrologue: false,
    teamSize: 3,
    numElements: 5,
    playerStars: 4, 
    companionStars: 4,
    enemyStars: 5, // Сильный ИИ противника
    playerPill: "Foundation Pill",
    enemyPill: "Deep Yin Core",
    reward: 400
  },

  // --- REALM III: 7 Rainbow Frequencies ---
  {
    id: 5,
    name: "REALM III: Boss Level (7 Astral Elements)",
    description: "Предел симуляции — Реалм 7 Стихий. Полный хаос фрактальных интерференций. Только лучшие билды устоят.",
    isPrologue: false,
    teamSize: 5,
    numElements: 7,
    playerStars: 5, 
    companionStars: 5,
    enemyStars: 5,
    playerPill: "Foundation Pill",
    enemyPill: "Turbulent Anomaly",
    reward: 600
  }
];

export class CampaignManager {
  static getRealm(index: number): RealmConfig | null {
    if (index < 0 || index >= CAMPAIGN_REALMS.length) return null;
    return CAMPAIGN_REALMS[index];
  }
}