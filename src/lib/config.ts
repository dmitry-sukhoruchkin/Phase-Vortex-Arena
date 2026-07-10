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
  GRID_RES: 100, // Optimized for 60fps JS performance
  NODE_COUNT: 16,
};

export const COORDS_16_X = [10.14, 7.43, 2.75, 2.72, -2.72, -2.75, -7.42, -10.14, -10.14, -7.43, -2.75, -2.72, 2.72, 2.75, 7.43, 10.14];
export const COORDS_16_Y = [-2.72, -7.43, -4.77, -10.15, -10.14, -4.77, -7.42, -2.73, 2.72, 7.43, 4.76, 10.14, 10.15, 4.77, 7.42, 2.71];
