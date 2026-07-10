import { FluidSolver } from './Fluid';
import { GPUFluidSolver } from './GPUFluid';
import { CONFIG, SEMANTIC_PILLS_DB, COORDS_16_X, COORDS_16_Y, PillConfig } from '../config';
import { dX, dY, dTQ } from './Coherence';

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  phase: number;
  intact: boolean;
  baseX: number;
  baseY: number;
  vector: [number, number, number];
}

export class Cultivator {
  id: string;
  isPlayer: boolean;
  team: number = 0;
  pillName: string;
  vector: [number, number, number];
  pos: { x: number; y: number };
  angle: number;
  nodes: Node[];
  integrity: number = 1.0;
  shearStress: number = 0.0;
  K: number = 30.0;
  color: [number, number, number];

  vx: number = 0;
  vy: number = 0;
  tq: number = 0;
  
  freqVal: number = 0;
  spatialVal: number = 0;
  domainCharge: number = 0;
  explosionsTriggered: number = 0;
  
  KActive: number = 30.0;
  beamActive: boolean = false;
  beamIntensity: number = 0.0;
  stabilizationFactor: number = 1.0;
  assistProfile: string = "FreeEEG16";
  assistModeActive: boolean = false;
  
  isYang: boolean = false;
  isYin: boolean = false;
  isSlag: boolean = false;
  isPureMastery: boolean = false;

  style: string = "Balanced Triad";
  energyAbsorbed: number = 0;

  constructor(id: string, isPlayer: boolean, x: number, y: number, pill: PillConfig) {
    this.id = id;
    this.isPlayer = isPlayer;
    this.pillName = pill.name;
    this.vector = pill.vector;
    this.color = pill.color;
    this.pos = { x, y };
    this.angle = isPlayer ? 0 : Math.PI;

    this.isYang = this.vector[0] > this.vector[2];
    this.isYin = this.vector[2] > this.vector[0] && this.vector[2] > this.vector[1];
    this.isSlag = false;
    this.isPureMastery = true;

    // Назначаем AI-стиль бота на основе выбранного ядра пилюли
    if (this.pillName.includes("Yang") || this.pillName.includes("Fire")) {
      this.style = Math.random() < 0.5 ? "Aggressive Yang" : "Speed Yang";
    } else if (this.pillName.includes("Yin") || this.pillName.includes("Water")) {
      this.style = Math.random() < 0.5 ? "Defensive Yin" : "Elusive Yin";
    } else if (this.pillName.includes("Turbulent") || this.pillName.includes("Anomaly")) {
      this.style = Math.random() < 0.5 ? "Chaotic Warp" : "Vortex Spinner";
    } else if (this.pillName.includes("Foundation") || this.pillName.includes("Pill")) {
      this.style = Math.random() < 0.5 ? "Balanced Triad" : "Steady Triad";
    } else {
      this.style = "Balanced Triad";
    }

    const sum = this.vector[0] + this.vector[1] + this.vector[2] + 1e-5;
    const vNorm = [this.vector[0]/sum, this.vector[1]/sum, this.vector[2]/sum];
    const numYang = Math.round(vNorm[0] * 16);
    const numCat = Math.round(vNorm[1] * 16);
    const numYin = 16 - numYang - numCat;

    const nodeVectors: [number, number, number][] = [];
    for(let i=0; i<numYang; i++) nodeVectors.push([1.0, 0.0, 0.0]);
    for(let i=0; i<numCat; i++) nodeVectors.push([0.0, 1.0, 0.0]);
    for(let i=0; i<numYin; i++) nodeVectors.push([0.0, 0.0, 1.0]);

    while (nodeVectors.length < 16) nodeVectors.push([0.577, 0.577, 0.577]);

    this.nodes = [];
    const SCALE = 2.0;
    for (let i = 0; i < 16; i++) {
      const bx = COORDS_16_X[i] * SCALE;
      const by = COORDS_16_Y[i] * SCALE;
      this.nodes.push({
        x: x + bx * Math.cos(this.angle) + by * Math.sin(this.angle),
        y: y + -bx * Math.sin(this.angle) + by * Math.cos(this.angle),
        vx: 0,
        vy: 0,
        phase: Math.random() * Math.PI * 2,
        intact: true,
        baseX: bx,
        baseY: by,
        vector: nodeVectors[i],
      });
    }
  }
}

export class PhaseVortexArena {
  fluid: FluidSolver | GPUFluidSolver;
  cultivators: Cultivator[];
  time: number = 0;
  numElements: number = 3;

  constructor(p1Config: PillConfig, p2Config: PillConfig, teamSize: number = 1, mode: string = 'PvsB', gridRes: number = 70, numElements: number = 3, gpuEnabled: boolean = true) {
    this.numElements = numElements;
    
    if (gpuEnabled) {
      try {
        this.fluid = new GPUFluidSolver(gridRes, numElements);
      } catch (e) {
        console.warn("GPU Simulation setup failed, falling back to CPU fallback Solver.", e);
        this.fluid = new FluidSolver(gridRes, numElements);
      }
    } else {
      this.fluid = new FluidSolver(gridRes, numElements);
    }

    this.cultivators = [];
    
    for(let i=0; i<teamSize; i++) {
      const isPlayer = (mode === 'PvsB' && i === 0);
      const c = new Cultivator('p'+i, isPlayer, CONFIG.WIDTH * 0.3, CONFIG.HEIGHT * (0.5 + (i - (teamSize-1)/2)*0.15), p1Config);
      c.team = 0;
      this.cultivators.push(c);
    }
    for(let i=0; i<teamSize; i++) {
      const c = new Cultivator('b'+i, false, CONFIG.WIDTH * 0.7, CONFIG.HEIGHT * (0.5 + (i - (teamSize-1)/2)*0.15), p2Config);
      c.team = 1;
      this.cultivators.push(c);
    }
  }

  injectDomainExplosion(pos: {x: number, y: number}, vector: [number, number, number], scale: number, isYang: boolean) {
    const gx = (pos.x / CONFIG.WIDTH) * this.fluid.N;
    const gy = (pos.y / CONFIG.HEIGHT) * this.fluid.N;
    const radius = 5;

    for (let dyG = -radius; dyG <= radius; dyG++) {
      for (let dxG = -radius; dxG <= radius; dxG++) {
        const px = Math.floor(gx) + dxG;
        const py = Math.floor(gy) + dyG;
        if (px > 0 && px < this.fluid.N - 1 && py > 0 && py < this.fluid.N - 1) {
          const idx = this.fluid.IX(px, py);
          const distSq = (gx - px) * (gx - px) + (gy - py) * (gy - py);
          const dist = Math.sqrt(distSq) + 1e-5;
          const mask = Math.exp(-distSq / (4.0 * 4.0)); 

          if (mask > 0.01) {
            for (let ch = 0; ch < this.numElements; ch++) {
                const vectorVal = ch < vector.length ? vector[ch] : 0;
                this.fluid.density_prev[ch * 2][idx] += vectorVal * mask * 50.0;
                this.fluid.density_prev[ch * 2 + 1][idx] += ((Math.random() * 2.0 - 1.0)) * vectorVal * mask * 5.0;
            }
            
            const forceDir = isYang ? 1.0 : -1.0;
            this.fluid.u_prev[idx] += ((px - gx) / dist) * mask * 1200.0 * scale * forceDir;
            this.fluid.v_prev[idx] += ((py - gy) / dist) * mask * 1200.0 * scale * forceDir;
          }
        }
      }
    }
  }

  step(dt: number, settings?: any) {
    this.time += dt;
    const activeSettings = settings || { hbar: 120.0, decay: 0.9992, injectionRadius: 0.05, injectionIntensity: 150.0, cahnHilliardSharpen: 4.0, couplingStrength: 25.0, pacStrength: 6.5, springStiffness: 200.0, tensionTear: 2.0 };

    // 1. Обработка ИИ ботов (эмуляция контроллера со стилями из Python-сборок)
    for (const c of this.cultivators) {
      if (!c.isPlayer) {
        let opp = this.cultivators.find(o => o.team !== c.team) || c;
        let distOpp = Infinity;
        for (const o of this.cultivators) {
          if (o.team !== c.team) {
            const d = Math.hypot(c.pos.x - o.pos.x, c.pos.y - o.pos.y);
            if (d < distOpp) { distOpp = d; opp = o; }
          }
        }
        const dx = opp.pos.x - c.pos.x;
        const dy = opp.pos.y - c.pos.y;
        const dist = Math.hypot(dx, dy) + 0.001;
        const dir_x = dx / dist;
        const dir_y = dy / dist;

        const difficulty_mult = 1.0;

        if (c.style === "Aggressive Yang") {
          c.vx = dir_x * 0.9 * difficulty_mult;
          c.vy = dir_y * 0.9 * difficulty_mult;
          c.tq = Math.sin(this.time * 5.0) * 0.3;
          c.freqVal = 1.0;
          c.spatialVal = 1.0;
        } else if (c.style === "Speed Yang") {
          const tangent_x = -dir_y;
          const tangent_y = dir_x;
          c.vx = (dir_x * 0.4 + tangent_x * 0.8) * difficulty_mult;
          c.vy = (dir_y * 0.4 + tangent_y * 0.8) * difficulty_mult;
          c.tq = 0.5 * difficulty_mult;
          c.freqVal = 0.8;
          c.spatialVal = 0.6;
        } else if (c.style === "Defensive Yin") {
          if (dist < 220.0) {
            c.vx = -dir_x * 0.6 * difficulty_mult;
            c.vy = -dir_y * 0.6 * difficulty_mult;
            c.spatialVal = -0.8;
          } else {
            c.vx = dir_x * 0.2 * difficulty_mult;
            c.vy = dir_y * 0.2 * difficulty_mult;
            c.spatialVal = -0.3;
          }
          c.tq = 0.0;
          c.freqVal = -1.0;
        } else if (c.style === "Elusive Yin") {
          if (dist < 300.0) {
            c.vx = -dir_x * 0.9 * difficulty_mult;
            c.vy = -dir_y * 0.9 * difficulty_mult;
            c.spatialVal = -0.5;
          } else {
            c.vx = (Math.random() * 2.0 - 1.0) * 0.2;
            c.vy = (Math.random() * 2.0 - 1.0) * 0.2;
            c.spatialVal = -0.3;
          }
          c.tq = Math.sin(this.time * 2.0) * 0.4;
          c.freqVal = -1.0;
        } else if (c.style === "Balanced Triad" || c.style === "Steady Triad") {
          if (dist < 180.0) {
            c.vx = -dir_x * 0.5 * difficulty_mult;
            c.vy = -dir_y * 0.5 * difficulty_mult;
            c.spatialVal = 0.0;
          } else {
            c.vx = dir_x * 0.6 * difficulty_mult;
            c.vy = dir_y * 0.6 * difficulty_mult;
            c.spatialVal = 0.0;
          }
          c.tq = Math.sin(this.time) * 0.3;
          c.freqVal = 0.0;
        } else if (c.style === "Vortex Spinner") {
          c.vx = dir_x * 0.3 * difficulty_mult;
          c.vy = dir_y * 0.3 * difficulty_mult;
          c.tq = 1.0 * difficulty_mult;
          c.freqVal = 0.5;
          c.spatialVal = -0.2;
        } else if (c.style === "Chaotic Warp") {
          c.vx = (Math.random() * 2.0 - 1.0) * 0.95 * difficulty_mult;
          c.vy = (Math.random() * 2.0 - 1.0) * 0.95 * difficulty_mult;
          c.tq = (Math.random() * 2.0 - 1.0) * 0.8 * difficulty_mult;
          c.freqVal = Math.sin(this.time * 12.0);
          c.spatialVal = Math.cos(this.time * 8.0);
        } else {
          c.vx = dir_x * 0.5 * difficulty_mult;
          c.vy = dir_y * 0.5 * difficulty_mult;
          c.tq = 0.0;
          c.freqVal = 0.0;
          c.spatialVal = 0.0;
        }
      }
    }

    // 2. Оценка когнитивной синхронизации и режима работы лазеров (Связь K и пучка)
    for (const c of this.cultivators) {
      if (c.isPlayer) {
        const target_f = c.vector[0] * 1.0 + c.vector[2] * (-1.0);
        const focusSimilarity = Math.max(0.01, 1.0 - Math.abs(c.freqVal - target_f) / 2.0);
        
        c.KActive = c.K + focusSimilarity * 48.0;
        c.stabilizationFactor = focusSimilarity;

        // Генерация пучка волновой синхронизации (размытие фаз соперника)
        if (focusSimilarity > 0.65 && c.freqVal > 0.3) {
          const beam_multiplier = c.isPureMastery ? 2.0 : 1.0;
          c.beamActive = true;
          c.beamIntensity = (focusSimilarity - 0.65) * 18.0 * beam_multiplier;

          let closest_opp: Cultivator | null = null;
          let min_dist = Infinity;
          for (const other of this.cultivators) {
            if (other.team !== c.team) {
              const d = Math.hypot(c.pos.x - other.pos.x, c.pos.y - other.pos.y);
              if (d < min_dist) {
                min_dist = d;
                closest_opp = other;
              }
            }
          }

          if (closest_opp) {
            closest_opp.domainCharge = Math.max(0.0, closest_opp.domainCharge - dt * c.beamIntensity * 1.5);
            for (const node of closest_opp.nodes) {
              const scramble_drift = (Math.random() * 2.0 - 1.0) * c.beamIntensity * 1.2;
              node.phase += scramble_drift * dt;
            }
          }
        } else {
          c.beamActive = false;
          c.beamIntensity = 0.0;
        }

        if (c.spatialVal < -0.3) {
          c.assistProfile = "Shield Assist";
        } else if (c.spatialVal > 0.3) {
          c.assistProfile = "Core Assist";
        } else {
          c.assistProfile = "Mesh Assist";
        }
      } else {
        // Симметричный расчёт стабилизации для ботов
        const target_f = c.vector[0] * 1.0 + c.vector[2] * (-1.0);
        const focusSimilarity = Math.max(0.01, 1.0 - Math.abs(c.freqVal - target_f) / 2.0);
        c.KActive = c.K + 25.0 + focusSimilarity * 25.0;
        c.stabilizationFactor = 0.5 + focusSimilarity * 0.2;
        c.beamActive = false;
        c.beamIntensity = 0.0;
        c.assistProfile = "Bot Logic Autopilot";
      }
    }

    const pCOM: [number, number] = [this.cultivators[0].pos.x / 800.0, this.cultivators[0].pos.y / 800.0];
    const bCOM: [number, number] = [this.cultivators[1].pos.x / 800.0, this.cultivators[1].pos.y / 800.0];
    const pIntent: [number, number, number] = [this.cultivators[0].vx, this.cultivators[0].vy, this.cultivators[0].tq];
    const bIntent: [number, number, number] = [this.cultivators[1].vx, this.cultivators[1].vy, this.cultivators[1].tq];

    if (this.fluid instanceof GPUFluidSolver) {
       this.fluid.step(dt, pCOM, bCOM, pIntent, bIntent, this.cultivators[0].vector, this.cultivators[1].vector, activeSettings);
    } else {
       const N = this.fluid.N;
       for (const c of this.cultivators) {
          const forward = -c.vy;
          const strafe = c.vx;
          const worldVx = -Math.sin(c.angle) * forward + Math.cos(c.angle) * strafe;
          const worldVy = -Math.cos(c.angle) * forward - Math.sin(c.angle) * strafe;
          
          const C = new Float32Array(16 * 16);
          for(let i=0; i<16; i++) {
             for(let j=0; j<16; j++) {
                C[i*16 + j] = dX[i*16 + j] * worldVx * 0.05 + 
                              dY[i*16 + j] * worldVy * 0.05 + 
                              dTQ[i*16 + j] * c.tq * 1.5;
             }
          }

          const node_radial_amp = new Float32Array(16);
          const node_tangent_amp = new Float32Array(16);
          for(let i=0; i<16; i++) {
             for(let j=0; j<16; j++) {
                const phase_diff = c.nodes[i].phase - c.nodes[j].phase;
                node_radial_amp[i] += C[i * 16 + j] * Math.cos(phase_diff);
                node_tangent_amp[i] += C[i * 16 + j] * Math.sin(phase_diff);
             }
          }

          // ГЕНЕРАЦИЯ ШИРОКИХ ЭЛЕМЕНТНЫХ ВОЛН НА CPU ПРИ ФОЛБЭКЕ (Точное соответствие интенсивности 30.0 из Python)
          const cx_grid = Math.floor((c.pos.x / CONFIG.WIDTH) * N);
          const cy_grid = Math.floor((c.pos.y / CONFIG.HEIGHT) * N);
          const radius_wave = Math.floor(N * activeSettings.injectionRadius * 3.0); 
          const tf = this.time * 12.0;
          const phase_cos = Math.cos(tf);
          const phase_sin = Math.sin(tf);

          const intensity = 30.0;

          for (let y = -radius_wave; y <= radius_wave; y++) {
            for (let x = -radius_wave; x <= radius_wave; x++) {
              const gx = (cx_grid + x + N) % N;
              const gy = (cy_grid + y + N) % N;
              const distSq = x * x + y * y;
              const weight = Math.exp(-distSq / (radius_wave * radius_wave * 0.4));
              
              if (weight > 0.01) {
                const idx = gx + gy * N;
                for (let ch = 0; ch < this.numElements; ch++) {
                  const vectorVal = c.vector[ch];
                  this.fluid.density[ch * 2][idx] += vectorVal * phase_cos * weight * intensity * dt;
                  this.fluid.density[ch * 2 + 1][idx] += vectorVal * phase_sin * weight * intensity * dt;
                }
              }
            }
          }

          for (let i = 0; i < 16; i++) {
            const radX = c.nodes[i].x - c.pos.x;
            const radY = c.nodes[i].y - c.pos.y;
            const dist = Math.hypot(radX, radY) + 1e-5;
            const normalX = radX / dist;
            const normalY = radY / dist;
            const tangentX = -normalY;
            const tangentY = normalX;

            let thrustMult = c.isPlayer ? 1500.0 : 85.0;
            const thrustX = (node_radial_amp[i] * normalX + node_tangent_amp[i] * tangentX) * thrustMult;
            const thrustY = (node_radial_amp[i] * normalY + node_tangent_amp[i] * tangentY) * thrustMult;

            const pin_gx = Math.floor((c.nodes[i].x / CONFIG.WIDTH) * N);
            const pin_gy = Math.floor((c.nodes[i].y / CONFIG.HEIGHT) * N);

            for (let y = -2; y <= 2; y++) {
              for (let x = -2; x <= 2; x++) {
                const gx = (pin_gx + x + N) % N;
                const gy = (pin_gy + y + N) % N;
                const weight = Math.exp(-(x * x + y * y) / 2.0);
                const idx = gx + gy * N;
                
                this.fluid.u_prev[idx] += thrustX * weight;
                this.fluid.v_prev[idx] += thrustY * weight;
              }
            }
          }
       }
       this.fluid.step(dt, pCOM, bCOM, pIntent, bIntent, activeSettings);
    }

    const N = this.fluid.N;
    let sumXP = 0, sumYP = 0, totalP = 0;
    let sumXB = 0, sumYB = 0, totalB = 0;

    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
         const idx = x + y * N;
         const pDens = this.fluid.playerDensity[idx];
         const bDens = this.fluid.botDensity[idx];

         sumXP += x * pDens;
         sumYP += y * pDens;
         totalP += pDens;

         sumXB += x * bDens;
         sumYB += y * bDens;
         totalB += bDens;
      }
    }

    if (totalP > 0.01) {
       this.cultivators[0].pos.x = (sumXP / totalP) * (800.0 / N);
       this.cultivators[0].pos.y = (sumYP / totalP) * (800.0 / N);
    }
    if (totalB > 0.01) {
       this.cultivators[1].pos.x = (sumXB / totalB) * (800.0 / N);
       this.cultivators[1].pos.y = (sumYB / totalB) * (800.0 / N);
    }

    for (const c of this.cultivators) {
      const u_right = this.fluid.sample(this.fluid.u, c.pos.x + 15, c.pos.y);
      const u_left  = this.fluid.sample(this.fluid.u, c.pos.x - 15, c.pos.y);
      const v_up    = this.fluid.sample(this.fluid.v, c.pos.x, c.pos.y + 15);
      const v_down  = this.fluid.sample(this.fluid.v, c.pos.x, c.pos.y - 15);

      const curl = (v_up - v_down) - (u_right - u_left);
      c.angle += curl * 0.1 * dt + c.tq * 2.0 * dt;
    }

    // --- УПРУГАЯ СИМУЛЯЦИЯ МЯГКИХ ТЕЛ ---
    for (const c of this.cultivators) {
      const cos_p = Math.cos(c.angle);
      const sin_p = Math.sin(c.angle);
      const base_scale = 1.25;
      
      const scale = c.spatialVal < 0 
        ? (base_scale - c.spatialVal * 1.25) 
        : (base_scale - c.spatialVal * 0.45);

      const ideal_x = new Float32Array(16);
      const ideal_y = new Float32Array(16);
      for (let i = 0; i < 16; i++) {
        ideal_x[i] = c.pos.x + (c.nodes[i].baseX * cos_p + c.nodes[i].baseY * sin_p) * scale * 1.5;
        ideal_y[i] = c.pos.y + (-c.nodes[i].baseX * sin_p + c.nodes[i].baseY * cos_p) * scale * 1.5;
      }

      const f_spring_x = new Float32Array(16);
      const f_spring_y = new Float32Array(16);
      let activeCount = 0;

      for (let i = 0; i < 16; i++) {
        const idx_I = i;
        const idx_J = (i + 1) % 16;
        const node_I = c.nodes[idx_I];
        const node_J = c.nodes[idx_J];

        if (node_I.intact) activeCount++;

        const dx_spring = node_J.x - node_I.x;
        const dy_spring = node_J.y - node_I.y;
        const d_curr = Math.hypot(dx_spring, dy_spring) + 1e-5;

        const d_rest = Math.hypot(ideal_x[idx_J] - ideal_x[idx_I], ideal_y[idx_J] - ideal_y[idx_I]) + 1e-5;
        const strain = d_curr / d_rest;
        
        const T_tear = c.spatialVal >= 0 ? (2.0 + c.spatialVal * 98.0) : (2.0 + (c.spatialVal + 1.0) * 1.5) * (activeSettings.tensionTear / 2.0);

        let intact = node_I.intact && node_J.intact;
        if (strain > T_tear) {
          node_I.intact = false;
          intact = false;
        }

        if (intact) {
          const k_neighbor = activeSettings.springStiffness * (Math.max(0.0, c.spatialVal) + 1.0);
          const f_mag = k_neighbor * (d_curr - d_rest);
          const fx = (dx_spring / d_curr) * f_mag;
          const fy = (dy_spring / d_curr) * f_mag;

          f_spring_x[idx_I] += fx;
          f_spring_y[idx_I] += fy;
          f_spring_x[idx_J] -= fx;
          f_spring_y[idx_J] -= fy;
        }
      }

      let cosSum = 0, sinSum = 0;
      let dissonanceSum = 0;

      // Получаем противника для оценки противовеса RPS
      const opponent = this.cultivators.find(o => o.team !== c.team) || c;

      for (let i = 0; i < 16; i++) {
        const node = c.nodes[i];

        const shape_pull = c.spatialVal >= 0 ? (15.0 + c.spatialVal * 35.0) : (15.0 + c.spatialVal * 10.0);
        const fx_restore = (ideal_x[i] - node.x) * shape_pull;
        const fy_restore = (ideal_y[i] - node.y) * shape_pull;

        const slip_factor = Math.max(0.65, Math.min(1.0, 0.85 + c.spatialVal * 0.15));
        const fl_u = this.fluid.sample(this.fluid.u, node.x, node.y) * 80.0;
        const fl_v = this.fluid.sample(this.fluid.v, node.x, node.y) * 80.0;

        const w_center = this.fluid.sample(this.fluid.wall_density, node.x, node.y);
        const w_right  = this.fluid.sample(this.fluid.wall_density, node.x + 10, node.y);
        const w_left   = this.fluid.sample(this.fluid.wall_density, node.x - 10, node.y);
        const w_down   = this.fluid.sample(this.fluid.wall_density, node.x, node.y + 10);
        const w_up     = this.fluid.sample(this.fluid.wall_density, node.x, node.y - 10);
        
        const grad_x = w_right - w_left;
        const grad_y = w_down - w_up;
        const grad_norm = Math.hypot(grad_x, grad_y) + 1e-5;
        const dir_out_x = -grad_x / grad_norm;
        const dir_out_y = -grad_y / grad_norm;
        
        const fx_wall = dir_out_x * w_center * 3500.0;
        const fy_wall = dir_out_y * w_center * 3500.0;

        const r_re = this.fluid.sample(this.fluid.density[0], node.x, node.y);
        const r_im = this.fluid.sample(this.fluid.density[1], node.x, node.y);
        const g_re = this.fluid.sample(this.fluid.density[2], node.x, node.y);
        const g_im = this.fluid.sample(this.fluid.density[3], node.x, node.y);
        const b_re = this.fluid.sample(this.fluid.density[4], node.x, node.y);
        const b_im = this.fluid.sample(this.fluid.density[5], node.x, node.y);

        const ampR = Math.hypot(r_re, r_im);
        const ampG = Math.hypot(g_re, g_im);
        const ampB = Math.hypot(b_re, b_im);
        const localM = Math.hypot(ampR, Math.hypot(ampG, ampB));
        const norm = Math.max(1e-8, localM);

        const similarity = (ampR / norm) * node.vector[0] + (ampG / norm) * node.vector[1] + (ampB / norm) * node.vector[2];
        const dissonance = Math.max(0, Math.min(1.0, 1.0 - similarity));

        // ВЫЧИСЛЕНИЕ ПРОСТРАНСТВЕННОГО ГРАДИЕНТА СТОЛКНОВЕНИЯ ВОЛН (\nabla W_RGB)
        const tf = this.time * 12.0;
        const R_wave = r_re * Math.cos(tf) - r_im * Math.sin(tf);
        const G_wave = g_re * Math.cos(tf * 0.5) - g_im * Math.sin(tf * 0.5);
        const B_wave = b_re * Math.cos(tf * 0.25) - b_im * Math.sin(tf * 0.25);

        const dx = 10;
        const R_wave_dx = this.fluid.sample(this.fluid.density[0], node.x + dx, node.y) * Math.cos(tf) - 
                          this.fluid.sample(this.fluid.density[1], node.x + dx, node.y) * Math.sin(tf);
        const R_wave_dy = this.fluid.sample(this.fluid.density[0], node.x, node.y + dx) * Math.cos(tf) - 
                          this.fluid.sample(this.fluid.density[1], node.x, node.y + dx) * Math.sin(tf);

        const B_wave_dx = this.fluid.sample(this.fluid.density[4], node.x + dx, node.y) * Math.cos(tf * 0.25) - 
                          this.fluid.sample(this.fluid.density[5], node.x + dx, node.y) * Math.sin(tf * 0.25);
        const B_wave_dy = this.fluid.sample(this.fluid.density[4], node.x, node.y + dx) * Math.cos(tf * 0.25) - 
                          this.fluid.sample(this.fluid.density[5], node.x, node.y + dx) * Math.sin(tf * 0.25);

        const G_wave_dx = this.fluid.sample(this.fluid.density[2], node.x + dx, node.y) * Math.cos(tf * 0.5) - 
                          this.fluid.sample(this.fluid.density[3], node.x + dx, node.y) * Math.sin(tf * 0.5);
        const G_wave_dy = this.fluid.sample(this.fluid.density[2], node.x, node.y + dx) * Math.cos(tf * 0.5) - 
                          this.fluid.sample(this.fluid.density[3], node.x, node.y + dx) * Math.sin(tf * 0.5);

        const grad_R_x = (R_wave_dx - R_wave) / dx;
        const grad_R_y = (R_wave_dy - R_wave) / dx;
        const grad_R = Math.hypot(grad_R_x, grad_R_y);

        const grad_B_x = (B_wave_dx - B_wave) / dx;
        const grad_B_y = (B_wave_dy - B_wave) / dx;
        const grad_B = Math.hypot(grad_B_x, grad_B_y);

        const grad_G_x = (G_wave_dx - G_wave) / dx;
        const grad_G_y = (G_wave_dy - G_wave) / dx;
        const grad_G = Math.hypot(grad_G_x, grad_G_y);

        const clash = grad_R * Math.abs(B_wave) + grad_B * Math.abs(R_wave) +
                      grad_R * Math.abs(G_wave) + grad_G * Math.abs(R_wave) +
                      grad_G * Math.abs(B_wave) + grad_B * Math.abs(G_wave);

        let proximity_damage = 0.0;
        for (const other of this.cultivators) {
          if (other !== c) {
            const d_opp = Math.hypot(c.pos.x - other.pos.x, c.pos.y - other.pos.y);
            proximity_damage += Math.max(0, (220.0 - d_opp) / 220.0) * 1.8;
          }
        }

        // Проверка RPS-превосходства элементов узла над ядром противника (из Python-конфига)
        let rps_mult = 1.0;
        let maxIdx = 0;
        if (node.vector[1] > node.vector[maxIdx]) maxIdx = 1;
        if (node.vector[2] > node.vector[maxIdx]) maxIdx = 2;

        let opp_core = 0;
        if (opponent.vector[1] > opponent.vector[opp_core]) opp_core = 1;
        if (opponent.vector[2] > opponent.vector[opp_core]) opp_core = 2;

        const has_advantage = (maxIdx === 0 && opp_core === 1) || 
                              (maxIdx === 1 && opp_core === 2) || 
                              (maxIdx === 2 && opp_core === 0);
                              
        const has_disadvantage = (maxIdx === 1 && opp_core === 0) || 
                                 (maxIdx === 2 && opp_core === 1) || 
                                 (maxIdx === 0 && opp_core === 2);
                                 
        if (has_advantage) rps_mult = 0.70; // Сниженный урон (RPS_DISADVANTAGE_MULTIPLIER)
        if (has_disadvantage) rps_mult = 1.45; // Увеличенный урон (RPS_ADVANTAGE_MULTIPLIER)

        const disruption_force = (dissonance * localM * 4.0 + clash * 38.0 + proximity_damage) * rps_mult;
        const jitter_force = Math.min(14.0, (disruption_force * (100.0 / (c.K + 1e-5)) * 0.35) * (1.0 - c.stabilizationFactor * 0.70));

        // Режим поглощения вибраций (Parry / Поглощение для Инь щита)
        let is_absorbing = false;
        if ((c.isYin || !c.isYang) && !c.isSlag) {
          if (c.spatialVal < -0.3) {
            is_absorbing = true;
          }
        }

        if (is_absorbing) {
          c.energyAbsorbed += jitter_force * 0.12 * (c.stabilizationFactor + 0.1) * dt;
          if (c.energyAbsorbed >= 12.0) {
            const brokenNode = c.nodes.find(n => !n.intact);
            if (brokenNode) {
              brokenNode.intact = true;
            }
            c.energyAbsorbed = 0.0;
          }
        }

        const prevNode = c.nodes[(i - 1 + 16) % 16];
        const nextNode = c.nodes[(i + 1) % 16];
        const coupling = Math.sin(nextNode.phase - node.phase) + Math.sin(prevNode.phase - node.phase);
        const K = Math.min(35.0, c.KActive);

        const scramble_rate = (dissonance * localM * 1.5 + (16 - activeCount) * 0.15 + clash * 6.5) * rps_mult;
        const phase_noise = (Math.random() * 2.0 - 1.0) * scramble_rate;

        node.phase += (14.0 * 2 * Math.PI * dt) + K * 0.5 * coupling * dt + phase_noise * dt;

        // Влияние закрутки (torque) и перемещения на смещение фаз Курамото
        if (!c.assistModeActive) {
          const tq_drift = c.tq * 0.20 * dt; 
          node.phase += tq_drift * (i / 16.0);
          
          if (Math.abs(c.vx) > 0.05 || Math.abs(c.vy) > 0.05) {
            const angle_intent = Math.atan2(-c.vy, c.vx);
            const node_angle = Math.atan2(node.baseY, node.baseX);
            const projection = Math.cos(node_angle - angle_intent);
            node.phase += projection * 0.15 * dt; 
          }
        }

        cosSum += Math.cos(node.phase);
        sinSum += Math.sin(node.phase);
        dissonanceSum += dissonance;

        // Физическое приращение скорости
        const radX = node.x - c.pos.x;
        const radY = node.y - c.pos.y;
        const dist = Math.hypot(radX, radY) + 1e-5;
        const normalX = radX / dist;
        const normalY = radY / dist;
        const tangentX = -normalY;
        const tangentY = normalX;

        node.vx = fl_u * slip_factor + fx_wall + fx_restore + f_spring_x[i] * 0.15 + tangentX * c.tq * 100.0;
        node.vy = fl_v * slip_factor + fy_wall + fy_restore + f_spring_y[i] * 0.15 + tangentY * c.tq * 100.0;

        const jitter_angle = Math.random() * Math.PI * 2;
        node.vx += Math.cos(jitter_angle) * (is_absorbing ? jitter_force * 0.08 : jitter_force) * 10.0;
        node.vy += Math.sin(jitter_angle) * (is_absorbing ? jitter_force * 0.08 : jitter_force) * 10.0;

        node.vx = Math.max(-180.0, Math.min(180.0, node.vx));
        node.vy = Math.max(-180.0, Math.min(180.0, node.vy));

        if (node.intact) {
          node.x += node.vx * dt;
          node.y += node.vy * dt;
        }

        node.x = Math.max(30.0, Math.min(770.0, node.x));
        node.y = Math.max(30.0, Math.min(770.0, node.y));
      }

      // Position-Based Dynamics (PBD) защита от дрейфа при разрыве пружин
      for (let i = 0; i < 16; i++) {
        const node = c.nodes[i];
        const idealX = c.pos.x + (node.baseX * cos_p + node.baseY * sin_p) * scale * 1.5;
        const idealY = c.pos.y + (-node.baseX * sin_p + node.baseY * cos_p) * scale * 1.5;

        const diff_x = node.x - idealX;
        const diff_y = node.y - idealY;
        const dist_to_ideal = Math.hypot(diff_x, diff_y) + 1e-5;

        const max_allowed_drift = scale * (c.spatialVal >= 0 ? (5.0 + (1.0 - c.spatialVal) * 15.0) : (20.0 - c.spatialVal * 15.0)) * 1.5;
        if (dist_to_ideal > max_allowed_drift) {
          node.x = idealX + (diff_x / dist_to_ideal) * max_allowed_drift;
          node.y = idealY + (diff_y / dist_to_ideal) * max_allowed_drift;
        }
      }

      c.shearStress = dissonanceSum / 16.0;
      c.integrity = Math.max(0.01, Math.min(1.0, Math.hypot(cosSum, sinSum) / 16.0));
    }
  }
}