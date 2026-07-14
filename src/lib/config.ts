export interface PillConfig {
  name: string;
  vector: [number, number, number];
  color: [number, number, number];
  desc?: string;
}

export const SEMANTIC_PILLS_DB: Record<string, PillConfig> = {
  "Foundation Pill": { name: "Foundation Pill",
    vector: [0.577, 0.577, 0.577],
    color: [255, 200, 255],
    desc: "Balanced Triad (Resonant SMR focus)"
  },
  "Pure Yang Core": { name: "Pure Yang Core",
    vector: [0.894, 0.447, 0.0],
    color: [255, 100, 0],
    desc: "Aggressive Yang (Fiery Gamma charges)"
  },
  "Deep Yin Core": { name: "Deep Yin Core",
    vector: [0.0, 0.447, 0.894],
    color: [0, 150, 255],
    desc: "Defensive Yin (Defensive Water parries)"
  },
  "Turbulent Anomaly": { name: "Turbulent Anomaly",
    vector: [0.707, 0.0, 0.707],
    color: [200, 0, 255],
    desc: "Chaotic Warp (Mixed Elements)"
  }
};

export const ALCHEMY_ENTITIES_CONFIG = [
  { type: 'yang_essence', name: 'YANG ESSENCE', freq: 80.0, rgb: 0, color: [255, 50, 0] },
  { type: 'yin_essence', name: 'YIN ESSENCE', freq: 6.0, rgb: 4, color: [0, 100, 255] },
  { type: 'smr_catalyst', name: 'SMR CATALYST', freq: 14.0, rgb: 2, color: [0, 255, 50] }
];

export const CONFIG = {
  WIDTH: 800,
  HEIGHT: 800,
  GRID_RES: 100,
  NODE_COUNT: 16,
};

export const COORDS_16_X = [10.14, 7.43, 2.75, 2.72, -2.72, -2.75, -7.42, -10.14, -10.14, -7.43, -2.75, -2.72, 2.72, 2.75, 7.43, 10.14];
export const COORDS_16_Y = [-2.72, -7.43, -4.77, -10.15, -10.14, -4.77, -7.42, -2.73, 2.72, 7.43, 4.76, 10.14, 10.15, 4.77, 7.42, 2.71];

// --- CAMPAIGN & AUTOBATTLER CONFIGURATION ---

export interface CampaignLevel {
  level: number;
  name: string;
  pill: string;
  enemyPowerMult: number;
  reward: number;
}

export const CAMPAIGN_LEVELS: CampaignLevel[] = [
  { level: 1, name: "Realm 0: Kinetic Slime", pill: "Deep Yin Core", enemyPowerMult: 0.2, reward: 50 },
  { level: 2, name: "Realm 1: Water Spirit", pill: "Deep Yin Core", enemyPowerMult: 0.5, reward: 100 },
  { level: 3, name: "Realm 2: Fire Demon", pill: "Pure Yang Core", enemyPowerMult: 1.0, reward: 150 },
  { level: 4, name: "Realm 3: Chaos Vortex", pill: "Turbulent Anomaly", enemyPowerMult: 1.5, reward: 250 },
  { level: 5, name: "Realm 4: Triad Master (BOSS)", pill: "Foundation Pill", enemyPowerMult: 2.5, reward: 500 },
];

export const AUTOBATTLER_CONFIG = {
  upgradeBaseCost: 50,
  physicsScaling: {
    power: { 
      baseIntensity: 50.0, 
      stepIntensity: 25.0 
    },
    defense: { 
      baseTension: 1.2, 
      stepTension: 0.4,   
      baseStiffness: 100.0, 
      stepStiffness: 30.0 
    },
    focus: { 
      baseCoupling: 15.0, 
      stepCoupling: 5.0    
    }
  }
};