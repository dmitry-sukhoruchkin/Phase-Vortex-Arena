export class FluidSolver {
  N: number;
  size: number;
  dt: number = 0.1;
  diff: number = 0.0;
  visc: number = 0.0;
  
  numElements: number;

  u: Float32Array;
  v: Float32Array;
  u_prev: Float32Array;
  v_prev: Float32Array;

  playerDensity: Float32Array;
  botDensity: Float32Array;
  wall_density: Float32Array;
  
  density: Float32Array[];
  density_prev: Float32Array[];
  
  time: number = 0;
  clashField: Float32Array;

  gpuActive: boolean = false;

  private tempDensity: Float32Array[];
  private tempAmp: Float32Array;
  private tempLaplacian: Float32Array;

  constructor(N: number, numElements: number) {
    this.N = N;
    this.size = N * N;
    this.numElements = numElements;
    
    this.u = new Float32Array(this.size);
    this.v = new Float32Array(this.size);
    this.u_prev = new Float32Array(this.size);
    this.v_prev = new Float32Array(this.size);
    this.clashField = new Float32Array(this.size);

    this.playerDensity = new Float32Array(this.size);
    this.botDensity = new Float32Array(this.size);
    this.wall_density = new Float32Array(this.size);
    
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        if (x === 0 || x === N - 1 || y === 0 || y === N - 1) {
          this.wall_density[x + y * N] = 1.0;
        }
      }
    }
    
    this.playerDensity[Math.floor(N * 0.3) + Math.floor(N * 0.5) * N] = 2.0;
    this.botDensity[Math.floor(N * 0.7) + Math.floor(N * 0.5) * N] = 2.0;
    
    this.density = Array.from({ length: numElements * 2 }, () => new Float32Array(this.size));
    this.density_prev = Array.from({ length: numElements * 2 }, () => new Float32Array(this.size));

    this.tempDensity = Array.from({ length: numElements * 2 }, () => new Float32Array(this.size));
    this.tempAmp = new Float32Array(this.size);
    this.tempLaplacian = new Float32Array(this.size);
  }

  IX(x: number, y: number): number {
    x = Math.max(0, Math.min(x, this.N - 1));
    y = Math.max(0, Math.min(y, this.N - 1));
    return x + y * this.N;
  }

  addSource(x: Float32Array, s: Float32Array, dt: number) {
    for (let i = 0; i < this.size; i++) {
      x[i] += s[i] * dt;
    }
  }

  setBnd(b: number, x: Float32Array) {
    const N = this.N;
    for (let i = 1; i < N - 1; i++) {
      x[this.IX(0, i)] = b === 1 ? -x[this.IX(1, i)] : x[this.IX(1, i)];
      x[this.IX(N - 1, i)] = b === 1 ? -x[this.IX(N - 2, i)] : x[this.IX(N - 2, i)];
      x[this.IX(i, 0)] = b === 2 ? -x[this.IX(i, 1)] : x[this.IX(i, 1)];
      x[this.IX(i, N - 1)] = b === 2 ? -x[this.IX(i, N - 2)] : x[this.IX(i, N - 2)];
    }
    x[this.IX(0, 0)] = 0.5 * (x[this.IX(1, 0)] + x[this.IX(0, 1)]);
    x[this.IX(0, N - 1)] = 0.5 * (x[this.IX(1, N - 1)] + x[this.IX(0, N - 2)]);
    x[this.IX(N - 1, 0)] = 0.5 * (x[this.IX(N - 2, 0)] + x[this.IX(N - 1, 1)]);
    x[this.IX(N - 1, N - 1)] = 0.5 * (x[this.IX(N - 2, N - 1)] + x[this.IX(N - 1, N - 2)]);
  }

  linSolve(b: number, x: Float32Array, x0: Float32Array, a: number, c: number) {
    const N = this.N;
    for (let k = 0; k < 10; k++) {
      for (let i = 1; i < N - 1; i++) {
        for (let j = 1; j < N - 1; j++) {
          x[this.IX(i, j)] =
            (x0[this.IX(i, j)] +
              a *
                (x[this.IX(i - 1, j)] +
                 x[this.IX(i + 1, j)] +
                 x[this.IX(i, j - 1)] +
                 x[this.IX(i, j + 1)])) / c;
        }
      }
      this.setBnd(b, x);
    }
  }

  diffuse(b: number, x: Float32Array, x0: Float32Array, diff: number, dt: number) {
    const a = dt * diff * (this.N - 2) * (this.N - 2);
    this.linSolve(b, x, x0, a, 1 + 4 * a);
  }

  advect(b: number, d: Float32Array, d0: Float32Array, u: Float32Array, v: Float32Array, dt: number) {
    const N = this.N;
    const dt0 = dt * (N - 2);
    for (let i = 1; i < N - 1; i++) {
      for (let j = 1; j < N - 1; j++) {
        let x = i - dt0 * u[this.IX(i, j)];
        let y = j - dt0 * v[this.IX(i, j)];
        
        if (x < 0.5) x = 0.5;
        if (x > N - 1.5) x = N - 1.5;
        const i0 = Math.floor(x);
        const i1 = i0 + 1;
        
        if (y < 0.5) y = 0.5;
        if (y > N - 1.5) y = N - 1.5;
        const j0 = Math.floor(y);
        const j1 = j0 + 1;
        
        const s1 = x - i0;
        const s0 = 1.0 - s1;
        const t1 = y - j0;
        const t0 = 1.0 - t1;
        
        d[this.IX(i, j)] =
          s0 * (t0 * d0[this.IX(i0, j0)] + t1 * d0[this.IX(i0, j1)]) +
          s1 * (t0 * d0[this.IX(i1, j0)] + t1 * d0[this.IX(i1, j1)]);
      }
    }
    this.setBnd(b, d);
  }

  project(u: Float32Array, v: Float32Array, p: Float32Array, div: Float32Array) {
    const N = this.N;
    for (let i = 1; i < N - 1; i++) {
      for (let j = 1; j < N - 1; j++) {
        div[this.IX(i, j)] =
          -0.5 * (u[this.IX(i + 1, j)] - u[this.IX(i - 1, j)] + v[this.IX(i, j + 1)] - v[this.IX(i, j - 1)]);
        p[this.IX(i, j)] = 0;
      }
    }
    this.setBnd(0, div);
    this.setBnd(0, p);
    for (let k = 0; k < 10; k++) {
      for (let i = 1; i < N - 1; i++) {
        for (let j = 1; j < N - 1; j++) {
          p[this.IX(i, j)] =
            (div[this.IX(i, j)] + p[this.IX(i - 1, j)] + p[this.IX(i + 1, j)] + p[this.IX(i, j - 1)] + p[this.IX(i, j + 1)]) / 4;
        }
      }
      this.setBnd(0, p);
    }
    for (let i = 1; i < N - 1; i++) {
      for (let j = 1; j < N - 1; j++) {
        u[this.IX(i, j)] -= 0.5 * (p[this.IX(i + 1, j)] - p[this.IX(i - 1, j)]);
        v[this.IX(i, j)] -= 0.5 * (p[this.IX(i, j + 1)] - p[this.IX(i, j - 1)]);
      }
    }
    this.setBnd(1, u);
    this.setBnd(2, v);
  }

  sample(field: Float32Array, x: number, y: number): number {
    const N = this.N;
    let gx = (x / 800) * N;
    let gy = (y / 800) * N;
    gx = Math.max(0.5, Math.min(N - 1.5, gx));
    gy = Math.max(0.5, Math.min(N - 1.5, gy));
    const i0 = Math.floor(gx);
    const j0 = Math.floor(gy);
    const i1 = i0 + 1;
    const j1 = j0 + 1;
    const s1 = gx - i0;
    const s0 = 1.0 - s1;
    const t1 = gy - j0;
    const t0 = 1.0 - t1;
    return s0 * (t0 * field[this.IX(i0, j0)] + t1 * field[this.IX(i0, j1)]) +
           s1 * (t0 * field[this.IX(i1, j0)] + t1 * field[this.IX(i1, j1)]);
  }

  applyPhaseCoupling(dt: number, settings: any) {
    if (this.numElements < 3) return;
    const size = this.size;
    for (let i = 0; i < size; i++) {
      const r_re = this.density[0][i];
      const r_im = this.density[1][i];
      const g_re = this.density[2][i];
      const g_im = this.density[3][i];
      const b_re = this.density[4][i];
      const b_im = this.density[5][i];

      const amp_R = Math.hypot(r_re, r_im) + 1e-8;
      const amp_G = Math.hypot(g_re, g_im) + 1e-8;
      const amp_B = Math.hypot(b_re, b_im) + 1e-8;

      const phase_R = Math.atan2(r_im, r_re);
      const phase_B = Math.atan2(b_im, b_re);

      const phase_diff = phase_R - phase_B;
      const lock_in_force = amp_G * Math.sin(phase_diff) * settings.couplingStrength * dt;

      const amp_R_new = amp_R * (1.0 + settings.pacStrength * amp_B * Math.cos(phase_B) * dt * 2.0);

      const phase_R_new = phase_R - lock_in_force;
      const phase_B_new = phase_B + lock_in_force;

      this.density[0][i] = amp_R_new * Math.cos(phase_R_new);
      this.density[1][i] = amp_R_new * Math.sin(phase_R_new);
      this.density[4][i] = amp_B * Math.cos(phase_B_new);
      this.density[5][i] = amp_B * Math.sin(phase_B_new);
    }
  }

  sharpenDensity(dt: number, settings: any) {
    const N = this.N;
    const tempAmp = this.tempAmp;
    const tempLap = this.tempLaplacian;

    for (let c = 0; c < this.numElements; c++) {
      const re = this.density[c * 2];
      const im = this.density[c * 2 + 1];
      
      for (let i = 0; i < this.size; i++) {
        tempAmp[i] = Math.hypot(re[i], im[i]);
      }

      for (let y = 1; y < N - 1; y++) {
        for (let x = 1; x < N - 1; x++) {
          const idx = this.IX(x, y);
          tempLap[idx] = tempAmp[this.IX(x - 1, y)] + tempAmp[this.IX(x + 1, y)] +
                         tempAmp[this.IX(x, y - 1)] + tempAmp[this.IX(x, y + 1)] - 4.0 * tempAmp[idx];
        }
      }

      for (let i = 0; i < this.size; i++) {
        const amp = tempAmp[i];
        if (amp > 0.12) {
          const sharpening = (amp * (amp - 0.3) * (1.0 - amp) + 0.10 * tempLap[i]) * settings.cahnHilliardSharpen * dt;
          const origPhase = Math.atan2(im[i], re[i]);
          const newAmp = Math.max(0.0, Math.min(2.5, amp + sharpening));
          re[i] = newAmp * Math.cos(origPhase);
          im[i] = newAmp * Math.sin(origPhase);
        }
      }
    }
  }

  schrodingerStep(dt: number, settings: any) {
     // Шаг Шрёдингера полностью удален, так как его не существовало в Python-версии,
     // и его явная схема приводила к неустранимой численной нестабильности сетки.
  }

  step(dt: number, pCOM: [number, number], bCOM: [number, number], pIntent: [number, number, number], bIntent: [number, number, number], settings?: any) {
    const activeSettings = settings || { hbar: 120.0, decay: 0.9992, cahnHilliardSharpen: 4.0, couplingStrength: 25.0, pacStrength: 6.5 };
    
    this.addSource(this.u, this.u_prev, dt);
    this.addSource(this.v, this.v_prev, dt);
    this.u_prev.fill(0);
    this.v_prev.fill(0);

    for (let c = 0; c < this.numElements * 2; c++) {
      this.addSource(this.density[c], this.density_prev[c], dt);
      this.density_prev[c].fill(0);
    }

    const tempU = new Float32Array(this.u);
    const tempV = new Float32Array(this.v);
    this.advect(1, this.u, tempU, tempU, tempV, dt);
    this.advect(2, this.v, tempV, tempU, tempV, dt);
    this.project(this.u, this.v, this.u_prev, this.v_prev);
    
    const maxVelocity = 120.0;
    for (let i = 0; i < this.size; i++) {
      let uVal = this.u[i];
      let vVal = this.v[i];
      if (isNaN(uVal) || !isFinite(uVal)) uVal = 0.0;
      if (isNaN(vVal) || !isFinite(vVal)) vVal = 0.0;
      this.u[i] = Math.max(-maxVelocity, Math.min(maxVelocity, uVal * 0.95));
      this.v[i] = Math.max(-maxVelocity, Math.min(maxVelocity, vVal * 0.95));
    }

    const tempP = new Float32Array(this.playerDensity);
    const tempB = new Float32Array(this.botDensity);
    this.advect(0, this.playerDensity, tempP, this.u, this.v, dt);
    this.advect(0, this.botDensity, tempB, this.u, this.v, dt);

    let px_grid = Math.floor(pCOM[0] * this.N);
    let py_grid = Math.floor(pCOM[1] * this.N);
    let bx_grid = Math.floor(bCOM[0] * this.N);
    let by_grid = Math.floor(bCOM[1] * this.N);
    this.playerDensity[px_grid + py_grid * this.N] = Math.min(3.0, this.playerDensity[px_grid + py_grid * this.N] + 2.0 * dt);
    this.botDensity[bx_grid + by_grid * this.N] = Math.min(3.0, this.botDensity[bx_grid + by_grid * this.N] + 2.0 * dt);

    for (let i = 0; i < this.size; i++) {
      this.playerDensity[i] *= 0.99;
      this.botDensity[i] *= 0.99;
    }

    const decayCoeff = 0.995;
    for (let c = 0; c < this.numElements * 2; c++) {
      const tempD = new Float32Array(this.density[c]);
      this.advect(0, this.density[c], tempD, this.u, this.v, dt);
      for (let i = 0; i < this.size; i++) {
        let dVal = this.density[c][i];
        if (isNaN(dVal) || !isFinite(dVal)) dVal = 0.0;
        this.density[c][i] = Math.max(-3.0, Math.min(3.0, dVal * decayCoeff));
      }
    }
    
    this.applyPhaseCoupling(dt, activeSettings);
    this.sharpenDensity(dt, activeSettings);
    // Шаг Шрёдингера закомментирован навсегда для стабильности фонов
    // this.schrodingerStep(dt, activeSettings);
    this.time += dt;
  }
}