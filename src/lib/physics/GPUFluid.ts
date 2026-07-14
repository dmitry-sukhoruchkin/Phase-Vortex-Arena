// src/lib/physics/GPUFluid.ts
import { dX, dY, dTQ } from './Coherence';

class GPGPUBlob {
  gl: WebGL2RenderingContext;
  textures: WebGLTexture[] = [];
  framebuffers: WebGLFramebuffer[] = [];
  writeIndex: number = 0;
  width: number;
  height: number;

  constructor(gl: WebGL2RenderingContext, w: number, h: number) {
    this.gl = gl;
    this.width = w;
    this.height = h;

    for (let i = 0; i < 2; i++) {
      const tex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      const fbo = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);

      this.textures.push(tex);
      this.framebuffers.push(fbo);
    }
  }

  get readTex() { return this.textures[1 - this.writeIndex]; }
  get writeFBO() { return this.framebuffers[this.writeIndex]; }

  swap() { this.writeIndex = 1 - this.writeIndex; }
}

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error("Shader compilation error: " + log);
  }
  return shader;
}

function createProgram(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
  const vShader = compileShader(gl, gl.VERTEX_SHADER, vs);
  const fShader = compileShader(gl, gl.FRAGMENT_SHADER, fs);
  const program = gl.createProgram()!;
  gl.attachShader(program, vShader);
  gl.attachShader(program, fShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error("Program linking error: " + gl.getProgramInfoLog(program));
  }
  return program;
}

export class GPUFluidSolver {
  N: number;
  size: number;
  dt: number = 0.1;
  numElements: number;
  blocks: number;

  u: Float32Array;
  v: Float32Array;
  playerDensity: Float32Array;
  botDensity: Float32Array;
  wall_density: Float32Array;
  density: Float32Array[];

  u_prev: Float32Array;
  v_prev: Float32Array;
  density_prev: Float32Array[];
  time: number = 0;
  gpuActive: boolean = true;

  private gl!: WebGL2RenderingContext;
  private velocityBuffer!: GPGPUBlob;
  private densityBuffer!: GPGPUBlob;
  private divBuffer!: WebGLFramebuffer;
  private divTexture!: WebGLTexture;
  private pressureBuffer!: GPGPUBlob;
  private quadBuffer!: WebGLBuffer;

  private advectVelocityProgram!: WebGLProgram;
  private advectProgram!: WebGLProgram;
  private injectSourcesProgram!: WebGLProgram;
  private injectElementWavesProgram!: WebGLProgram;
  private divergenceProgram!: WebGLProgram;
  private jacobiProgram!: WebGLProgram;
  private gradientProgram!: WebGLProgram;

  private cpuVelocityBuffer!: Float32Array;
  private cpuDensityBuffer!: Float32Array;

  constructor(N: number, numElements: number) {
    this.N = N;
    this.size = N * N;
    this.numElements = numElements;
    this.blocks = Math.ceil(numElements / 2);

    this.u = new Float32Array(this.size);
    this.v = new Float32Array(this.size);
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

    this.u_prev = new Float32Array(this.size);
    this.v_prev = new Float32Array(this.size);
    this.density_prev = Array.from({ length: numElements * 2 }, () => new Float32Array(this.size));
    this.density = Array.from({ length: numElements * 2 }, () => new Float32Array(this.size));

    this.initGPGPU();
  }

  private initGPGPU() {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2', { premultipliedAlpha: false });
    if (!gl) {
      throw new Error("WebGL2 not supported on this hardware configuration.");
    }
    this.gl = gl;

    gl.getExtension('EXT_color_buffer_float');

    this.velocityBuffer = new GPGPUBlob(gl, this.N, this.N);
    this.densityBuffer = new GPGPUBlob(gl, this.N, this.N * this.blocks);
    this.pressureBuffer = new GPGPUBlob(gl, this.N, this.N);

    this.divTexture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.divTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, this.N, this.N, 0, gl.RGBA, gl.FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    this.divBuffer = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.divBuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.divTexture, 0);

    this.quadBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,  1, -1, -1,  1,
      -1,  1,  1, -1,  1,  1
    ]), gl.STATIC_DRAW);

    const vsSource = `#version 300 es
      in vec2 a_position;
      out vec2 v_texcoord;
      void main() {
          gl_Position = vec4(a_position, 0.0, 1.0);
          v_texcoord = a_position * 0.5 + 0.5;
      }
    `;

    const advectVelocityFS = `#version 300 es
      precision highp float;
      precision highp sampler2D;
      in vec2 v_texcoord;
      out vec4 fragColor;
      uniform sampler2D u_velocity;
      uniform float u_dt;
      uniform vec2 u_texelSize;
      void main() {
          vec2 vel = texture(u_velocity, v_texcoord).xy;
          vec2 offset = vel * u_dt * u_texelSize;
          vec2 targetUV = clamp(v_texcoord - offset, 0.5 * u_texelSize, 1.0 - 0.5 * u_texelSize);
          vec4 state = texture(u_velocity, targetUV);
          fragColor = vec4(state.xy * 0.96, state.zw * 0.992); 
      }
    `;

    const advectDensityFS = `#version 300 es
      precision highp float;
      precision highp sampler2D;
      in vec2 v_texcoord;
      out vec4 fragColor;
      uniform sampler2D u_field;
      uniform sampler2D u_velocity;
      uniform float u_dt;
      uniform vec2 u_texelSize;
      uniform int u_blocks;
      void main() {
          float blockHeight = 1.0 / float(u_blocks);
          int blockIdx = int(v_texcoord.y / blockHeight);
          float localY = mod(v_texcoord.y, blockHeight) * float(u_blocks);
          vec2 localUV = vec2(v_texcoord.x, localY);

          vec2 vel = texture(u_velocity, localUV).xy;
          vec2 offset = vel * u_dt * u_texelSize;
          vec2 targetLocalUV = clamp(localUV - offset, 0.5 * u_texelSize, 1.0 - 0.5 * u_texelSize);
          vec2 globalUV = vec2(targetLocalUV.x, (targetLocalUV.y + float(blockIdx)) / float(u_blocks));
          fragColor = texture(u_field, globalUV);
      }
    `;

    const injectSourcesFS = `#version 300 es
      precision highp float;
      precision highp sampler2D;
      in vec2 v_texcoord;
      out vec4 fragColor;

      uniform sampler2D u_velocity;
      uniform vec2 u_playerCOM;
      uniform vec2 u_botCOM;
      uniform vec3 u_playerIntent; 
      uniform vec3 u_botIntent;
      uniform float u_dt;

      void main() {
          vec4 state = texture(u_velocity, v_texcoord);
          vec2 uv = v_texcoord;

          float distP = length(uv - u_playerCOM);
          float distB = length(uv - u_botCOM);

          float weightP = exp(-distP * distP / 0.003);
          float weightB = exp(-distB * distB / 0.003);

          vec2 normalP = normalize(uv - u_playerCOM + 1e-5);
          vec2 tangentP = vec2(-normalP.y, normalP.x);
          vec2 forceP = u_playerIntent.xy * 2500.0 + tangentP * u_playerIntent.z * 600.0;

          vec2 normalB = normalize(uv - u_botCOM + 1e-5);
          vec2 tangentB = vec2(-normalB.y, normalB.x);
          vec2 forceB = u_botIntent.xy * 1200.0 + tangentB * u_botIntent.z * 300.0;

          state.xy += (forceP * weightP + forceB * weightB) * u_dt;

          float dGenP = exp(-distP * distP / 0.0006) * 4.0;
          float dGenB = exp(-distB * distB / 0.0006) * 4.0;

          state.z = clamp(state.z + dGenP * u_dt * 15.0, 0.0, 3.0);
          state.w = clamp(state.w + dGenB * u_dt * 15.0, 0.0, 3.0);

          fragColor = state;
      }
    `;

    const injectElementWavesFS = `#version 300 es
      precision highp float;
      precision highp sampler2D;
      in vec2 v_texcoord;
      out vec4 fragColor;

      uniform sampler2D u_density;
      uniform vec2 u_playerCOM;
      uniform vec2 u_botCOM;
      uniform vec3 u_playerVector;
      uniform vec3 u_botVector;
      uniform float u_time;
      uniform float u_dt;
      uniform int u_blocks;
      
      uniform float u_injectionRadius;
      uniform float u_injectionIntensity;

      void main() {
          vec4 state = texture(u_density, v_texcoord);
          
          float blockHeight = 1.0 / float(u_blocks);
          int blockIdx = int(v_texcoord.y / blockHeight);
          float localY = mod(v_texcoord.y, blockHeight) * float(u_blocks);
          vec2 localUV = vec2(v_texcoord.x, localY);

          float distP = length(localUV - u_playerCOM);
          float distB = length(localUV - u_botCOM);

          float weightP = exp(-distP * distP / u_injectionRadius);
          float weightB = exp(-distB * distB / u_injectionRadius);

          int el1 = blockIdx * 2;
          int el2 = blockIdx * 2 + 1;

          float tf = u_time * 12.0;

          if (el1 < 3) {
              float waveP = cos(tf * (1.0 - float(el1) * 0.12)) * u_playerVector[el1];
              float waveB = cos(tf * (1.0 - float(el1) * 0.12)) * u_botVector[el1];
              state.xy += vec2(waveP * weightP + waveB * weightB) * u_dt * u_injectionIntensity;
          }
          if (el2 < 3) {
              float waveP = cos(tf * (1.0 - float(el2) * 0.12)) * u_playerVector[el2];
              float waveB = cos(tf * (1.0 - float(el2) * 0.12)) * u_botVector[el2];
              state.zw += vec2(waveP * weightP + waveB * weightB) * u_dt * u_injectionIntensity;
          }

          fragColor = state;
      }
    `;

    const divergenceFS = `#version 300 es
      precision highp float;
      precision highp sampler2D;
      in vec2 v_texcoord;
      out vec4 fragColor;
      uniform sampler2D u_velocity;
      uniform vec2 u_texelSize;
      void main() {
          vec2 uv = v_texcoord;
          vec2 dx = vec2(u_texelSize.x, 0.0);
          vec2 dy = vec2(0.0, u_texelSize.y);
          float u_right = texture(u_velocity, uv + dx).x;
          float u_left  = texture(u_velocity, uv - dx).x;
          float v_up    = texture(u_velocity, uv + dy).y;
          float v_down  = texture(u_velocity, uv - dy).y;
          float div = -0.5 * (u_right - u_left + v_up - v_down);
          fragColor = vec4(div, 0.0, 0.0, 1.0);
      }
    `;

    const jacobiFS = `#version 300 es
      precision highp float;
      precision highp sampler2D;
      in vec2 v_texcoord;
      out vec4 fragColor;
      uniform sampler2D u_pressure;
      uniform sampler2D u_div;
      uniform vec2 u_texelSize;
      void main() {
          vec2 uv = v_texcoord;
          vec2 dx = vec2(u_texelSize.x, 0.0);
          vec2 dy = vec2(0.0, u_texelSize.y);
          float p_left  = texture(u_pressure, uv - dx).x;
          float p_right = texture(u_pressure, uv + dx).x;
          float p_down  = texture(u_pressure, uv - dy).x;
          float p_up    = texture(u_pressure, uv + dy).x;
          float div     = texture(u_div, uv).x;
          float p_next  = 0.25 * (p_left + p_right + p_down + p_up - div);
          fragColor = vec4(p_next, 0.0, 0.0, 1.0);
      }
    `;

    const gradientFS = `#version 300 es
      precision highp float;
      precision highp sampler2D;
      in vec2 v_texcoord;
      out vec4 fragColor;
      uniform sampler2D u_velocity;
      uniform sampler2D u_pressure;
      uniform vec2 u_texelSize;
      void main() {
          vec2 uv = v_texcoord;
          vec2 dx = vec2(u_texelSize.x, 0.0);
          vec2 dy = vec2(0.0, u_texelSize.y);
          float p_left  = texture(u_pressure, uv - dx).x;
          float p_right = texture(u_pressure, uv + dx).x;
          float p_down  = texture(u_pressure, uv - dy).x;
          float p_up    = texture(u_pressure, uv + dy).x;
          vec4 state = texture(u_velocity, uv);
          state.x -= 0.5 * (p_right - p_left);
          state.y -= 0.5 * (p_up - p_down);
          fragColor = state;
      }
    `;

    this.advectVelocityProgram = createProgram(gl, vsSource, advectVelocityFS);
    this.advectProgram = createProgram(gl, vsSource, advectDensityFS);
    this.injectSourcesProgram = createProgram(gl, vsSource, injectSourcesFS);
    this.injectElementWavesProgram = createProgram(gl, vsSource, injectElementWavesFS);
    this.divergenceProgram = createProgram(gl, vsSource, divergenceFS);
    this.jacobiProgram = createProgram(gl, vsSource, jacobiFS);
    this.gradientProgram = createProgram(gl, vsSource, gradientFS);

    this.cpuVelocityBuffer = new Float32Array(this.N * this.N * 4);
    this.cpuDensityBuffer = new Float32Array(this.N * this.N * this.blocks * 4);

    this.uploadData();
  }

  uploadData() {
    const gl = this.gl;
    const N = this.N;

    const velData = new Float32Array(N * N * 4);
    for (let i = 0; i < N * N; i++) {
      velData[i * 4] = this.u[i];
      velData[i * 4 + 1] = this.v[i];
      velData[i * 4 + 2] = this.playerDensity[i];
      velData[i * 4 + 3] = this.botDensity[i];
    }
    gl.bindTexture(gl.TEXTURE_2D, this.velocityBuffer.textures[0]);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, N, N, 0, gl.RGBA, gl.FLOAT, velData);
    gl.bindTexture(gl.TEXTURE_2D, this.velocityBuffer.textures[1]);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, N, N, 0, gl.RGBA, gl.FLOAT, velData);

    const densData = new Float32Array(N * N * this.blocks * 4);
    for (let b = 0; b < this.blocks; b++) {
      const el1 = b * 2;
      const el2 = b * 2 + 1;
      const offset = b * N * N * 4;
      for (let i = 0; i < N * N; i++) {
        if (el1 < this.numElements) {
          densData[offset + i * 4] = this.density[el1 * 2][i];
          densData[offset + i * 4 + 1] = this.density[el1 * 2 + 1][i];
        }
        if (el2 < this.numElements) {
          densData[offset + i * 4 + 2] = this.density[el2 * 2][i];
          densData[offset + i * 4 + 3] = this.density[el2 * 2 + 1][i];
        }
      }
    }
    gl.bindTexture(gl.TEXTURE_2D, this.densityBuffer.textures[0]);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, N, N * this.blocks, 0, gl.RGBA, gl.FLOAT, densData);
    gl.bindTexture(gl.TEXTURE_2D, this.densityBuffer.textures[1]);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, N, N * this.blocks, 0, gl.RGBA, gl.FLOAT, densData);
  }

  IX(x: number, y: number): number {
    x = Math.max(0, Math.min(x, this.N - 1));
    y = Math.max(0, Math.min(y, this.N - 1));
    return x + y * this.N;
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

  step(dt: number, pCOM: [number, number], bCOM: [number, number], pIntent: [number, number, number], bIntent: [number, number, number], pVector: [number, number, number], bVector: [number, number, number], settings?: any) {
    const gl = this.gl;
    const N = this.N;
    const activeSettings = settings || { hbar: 120.0, decay: 0.9992, injectionRadius: 0.05, injectionIntensity: 150.0, cahnHilliardSharpen: 4.0, couplingStrength: 25.0, pacStrength: 6.5 };

    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    let loc = gl.getAttribLocation(this.advectVelocityProgram, "a_position");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    gl.useProgram(this.injectSourcesProgram);
    gl.uniform2f(gl.getUniformLocation(this.injectSourcesProgram, "u_playerCOM"), pCOM[0], pCOM[1]);
    gl.uniform2f(gl.getUniformLocation(this.injectSourcesProgram, "u_botCOM"), bCOM[0], bCOM[1]);
    gl.uniform3f(gl.getUniformLocation(this.injectSourcesProgram, "u_playerIntent"), pIntent[0], pIntent[1], pIntent[2]);
    gl.uniform3f(gl.getUniformLocation(this.injectSourcesProgram, "u_botIntent"), bIntent[0], bIntent[1], bIntent[2]);
    gl.uniform1f(gl.getUniformLocation(this.injectSourcesProgram, "u_dt"), dt);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.velocityBuffer.writeFBO);
    gl.viewport(0, 0, N, N);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.velocityBuffer.readTex);
    gl.uniform1i(gl.getUniformLocation(this.injectSourcesProgram, "u_velocity"), 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    this.velocityBuffer.swap();

    // ИСПРАВЛЕНИЕ: Берем интенсивность напрямую из настроек (как было изначально)
    gl.useProgram(this.injectElementWavesProgram);
    gl.uniform2f(gl.getUniformLocation(this.injectElementWavesProgram, "u_playerCOM"), pCOM[0], pCOM[1]);
    gl.uniform2f(gl.getUniformLocation(this.injectElementWavesProgram, "u_botCOM"), bCOM[0], bCOM[1]);
    gl.uniform3f(gl.getUniformLocation(this.injectElementWavesProgram, "u_playerVector"), pVector[0], pVector[1], pVector[2]);
    gl.uniform3f(gl.getUniformLocation(this.injectElementWavesProgram, "u_botVector"), bVector[0], bVector[1], bVector[2]);
    gl.uniform1f(gl.getUniformLocation(this.injectElementWavesProgram, "u_time"), this.time);
    gl.uniform1f(gl.getUniformLocation(this.injectElementWavesProgram, "u_dt"), dt);
    gl.uniform1i(gl.getUniformLocation(this.injectElementWavesProgram, "u_blocks"), this.blocks);
    
    gl.uniform1f(gl.getUniformLocation(this.injectElementWavesProgram, "u_injectionRadius"), activeSettings.injectionRadius);
    gl.uniform1f(gl.getUniformLocation(this.injectElementWavesProgram, "u_injectionIntensity"), activeSettings.injectionIntensity);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.densityBuffer.writeFBO);
    gl.viewport(0, 0, N, N * this.blocks);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.densityBuffer.readTex);
    gl.uniform1i(gl.getUniformLocation(this.injectElementWavesProgram, "u_density"), 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    this.densityBuffer.swap();

    gl.useProgram(this.advectVelocityProgram);
    gl.uniform1f(gl.getUniformLocation(this.advectVelocityProgram, "u_dt"), dt);
    gl.uniform2f(gl.getUniformLocation(this.advectVelocityProgram, "u_texelSize"), 1.0 / N, 1.0 / N);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.velocityBuffer.writeFBO);
    gl.viewport(0, 0, N, N);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.velocityBuffer.readTex);
    gl.uniform1i(gl.getUniformLocation(this.advectVelocityProgram, "u_velocity"), 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    this.velocityBuffer.swap();

    gl.useProgram(this.divergenceProgram);
    gl.uniform2f(gl.getUniformLocation(this.divergenceProgram, "u_texelSize"), 1.0 / N, 1.0 / N);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.divBuffer);
    gl.viewport(0, 0, N, N);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.velocityBuffer.readTex);
    gl.uniform1i(gl.getUniformLocation(this.divergenceProgram, "u_velocity"), 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    gl.useProgram(this.jacobiProgram);
    gl.uniform2f(gl.getUniformLocation(this.jacobiProgram, "u_texelSize"), 1.0 / N, 1.0 / N);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.divTexture);
    gl.uniform1i(gl.getUniformLocation(this.jacobiProgram, "u_div"), 1);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.pressureBuffer.writeFBO);
    gl.clearColor(0,0,0,0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    this.pressureBuffer.swap();

    for (let k = 0; k < 40; k++) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.pressureBuffer.writeFBO);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.pressureBuffer.readTex);
      gl.uniform1i(gl.getUniformLocation(this.jacobiProgram, "u_pressure"), 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      this.pressureBuffer.swap();
    }

    gl.useProgram(this.gradientProgram);
    gl.uniform2f(gl.getUniformLocation(this.gradientProgram, "u_texelSize"), 1.0 / N, 1.0 / N);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.velocityBuffer.writeFBO);
    gl.viewport(0, 0, N, N);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.velocityBuffer.readTex);
    gl.uniform1i(gl.getUniformLocation(this.gradientProgram, "u_velocity"), 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.pressureBuffer.readTex);
    gl.uniform1i(gl.getUniformLocation(this.gradientProgram, "u_pressure"), 1);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    this.velocityBuffer.swap();

    loc = gl.getAttribLocation(this.advectProgram, "a_position");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    gl.useProgram(this.advectProgram);
    gl.uniform1f(gl.getUniformLocation(this.advectProgram, "u_dt"), dt);
    gl.uniform2f(gl.getUniformLocation(this.advectProgram, "u_texelSize"), 1.0 / N, 1.0 / N);
    gl.uniform1i(gl.getUniformLocation(this.advectProgram, "u_blocks"), this.blocks);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.densityBuffer.writeFBO);
    gl.viewport(0, 0, N, N * this.blocks);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.densityBuffer.readTex);
    gl.uniform1i(gl.getUniformLocation(this.advectProgram, "u_field"), 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.velocityBuffer.readTex);
    gl.uniform1i(gl.getUniformLocation(this.advectProgram, "u_velocity"), 1);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    this.densityBuffer.swap();

    this.time += dt;
    this.downloadData();
  }

  downloadData() {
    const gl = this.gl;
    const N = this.N;

    const latestVelocityFBO = this.velocityBuffer.framebuffers[1 - this.velocityBuffer.writeIndex];
    gl.bindFramebuffer(gl.FRAMEBUFFER, latestVelocityFBO);
    gl.readPixels(0, 0, N, N, gl.RGBA, gl.FLOAT, this.cpuVelocityBuffer);
    for (let i = 0; i < N * N; i++) {
      this.u[i] = this.cpuVelocityBuffer[i * 4];
      this.v[i] = this.cpuVelocityBuffer[i * 4 + 1];
      this.playerDensity[i] = this.cpuVelocityBuffer[i * 4 + 2];
      this.botDensity[i] = this.cpuVelocityBuffer[i * 4 + 3];
    }

    const latestDensityFBO = this.densityBuffer.framebuffers[1 - this.densityBuffer.writeIndex];
    gl.bindFramebuffer(gl.FRAMEBUFFER, latestDensityFBO);
    gl.readPixels(0, 0, N, N * this.blocks, gl.RGBA, gl.FLOAT, this.cpuDensityBuffer);

    for (let b = 0; b < this.blocks; b++) {
      const el1 = b * 2;
      const el2 = b * 2 + 1;
      const offset = b * N * N * 4;
      for (let i = 0; i < N * N; i++) {
        if (el1 < this.numElements) {
          this.density[el1 * 2][i] = this.cpuDensityBuffer[offset + i * 4];
          this.density[el1 * 2 + 1][i] = this.cpuDensityBuffer[offset + i * 4 + 1];
        }
        if (el2 < this.numElements) {
          this.density[el2 * 2][i] = this.cpuDensityBuffer[offset + i * 4 + 2];
          this.density[el2 * 2 + 1][i] = this.cpuDensityBuffer[offset + i * 4 + 3];
        }
      }
    }
  }
}