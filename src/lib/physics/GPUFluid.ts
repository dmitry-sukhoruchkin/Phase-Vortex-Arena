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

  private tempAmp!: Float32Array;
  private tempLaplacian!: Float32Array;

  private velocitySourcesTex!: WebGLTexture;
  private densitySourcesTex!: WebGLTexture;

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

    this.tempAmp = new Float32Array(this.size);
    this.tempLaplacian = new Float32Array(this.size);

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

    this.velocitySourcesTex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.velocitySourcesTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    this.densitySourcesTex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.densitySourcesTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

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

      // Manual bilinear interpolation to avoid checkered grid noise
      vec4 textureBilinear(sampler2D tex, vec2 uv, vec2 texelSize) {
          vec2 coord = uv / texelSize - 0.5;
          vec2 i0 = floor(coord);
          vec2 f = coord - i0;
          
          vec2 uv00 = (i0 + 0.5) * texelSize;
          vec2 uv10 = uv00 + vec2(texelSize.x, 0.0);
          vec2 uv01 = uv00 + vec2(0.0, texelSize.y);
          vec2 uv11 = uv00 + texelSize;
          
          uv00 = clamp(uv00, 0.5 * texelSize, 1.0 - 0.5 * texelSize);
          uv10 = clamp(uv10, 0.5 * texelSize, 1.0 - 0.5 * texelSize);
          uv01 = clamp(uv01, 0.5 * texelSize, 1.0 - 0.5 * texelSize);
          uv11 = clamp(uv11, 0.5 * texelSize, 1.0 - 0.5 * texelSize);
          
          vec4 t00 = texture(tex, uv00);
          vec4 t10 = texture(tex, uv10);
          vec4 t01 = texture(tex, uv01);
          vec4 t11 = texture(tex, uv11);
          
          return mix(mix(t00, t10, f.x), mix(t01, t11, f.x), f.y);
      }

      void main() {
          vec2 vel = texture(u_velocity, v_texcoord).xy;
          vec2 offset = vel * u_dt * u_texelSize;
          vec2 targetUV = clamp(v_texcoord - offset, 0.5 * u_texelSize, 1.0 - 0.5 * u_texelSize);
          vec4 state = textureBilinear(u_velocity, targetUV, u_texelSize);
          fragColor = vec4(state.xy * 0.95, state.zw * 0.99); 
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

      // Block-bounded manual bilinear interpolation to prevent inter-channel bleeding
      vec4 textureBlockBilinear(sampler2D tex, vec2 localUV, int blockIdx, int numBlocks, vec2 texelSize) {
          vec2 coord = vec2(localUV.x / texelSize.x, localUV.y / (texelSize.y * float(numBlocks))) - 0.5;
          vec2 i0 = floor(coord);
          vec2 f = coord - i0;

          float y0 = clamp((i0.y + 0.5) * texelSize.y * float(numBlocks), 0.5 * texelSize.y * float(numBlocks), 1.0 - 0.5 * texelSize.y * float(numBlocks));
          float y1 = clamp(y0 + texelSize.y * float(numBlocks), 0.5 * texelSize.y * float(numBlocks), 1.0 - 0.5 * texelSize.y * float(numBlocks));

          vec2 gUV00 = vec2((i0.x + 0.5) * texelSize.x, (y0 + float(blockIdx)) / float(numBlocks));
          vec2 gUV10 = vec2(gUV00.x + texelSize.x, (y0 + float(blockIdx)) / float(numBlocks));
          vec2 gUV01 = vec2(gUV00.x, (y1 + float(blockIdx)) / float(numBlocks));
          vec2 gUV11 = vec2(gUV00.x + texelSize.x, (y1 + float(blockIdx)) / float(numBlocks));

          gUV00.x = clamp(gUV00.x, 0.5 * texelSize.x, 1.0 - 0.5 * texelSize.x);
          gUV10.x = clamp(gUV10.x, 0.5 * texelSize.x, 1.0 - 0.5 * texelSize.x);
          gUV01.x = clamp(gUV01.x, 0.5 * texelSize.x, 1.0 - 0.5 * texelSize.x);
          gUV11.x = clamp(gUV11.x, 0.5 * texelSize.x, 1.0 - 0.5 * texelSize.x);

          vec4 t00 = texture(tex, gUV00);
          vec4 t10 = texture(tex, gUV10);
          vec4 t01 = texture(tex, gUV01);
          vec4 t11 = texture(tex, gUV11);

          return mix(mix(t00, t10, f.x), mix(t01, t11, f.x), f.y);
      }

      void main() {
          float blockHeight = 1.0 / float(u_blocks);
          int blockIdx = int(v_texcoord.y / blockHeight);
          float localY = mod(v_texcoord.y, blockHeight) * float(u_blocks);
          vec2 localUV = vec2(v_texcoord.x, localY);

          vec2 vel = texture(u_velocity, localUV).xy;
          vec2 offset = vel * u_dt * u_texelSize;
          vec2 targetLocalUV = clamp(localUV - offset, 0.5 * u_texelSize, 1.0 - 0.5 * u_texelSize);
          
          fragColor = textureBlockBilinear(u_field, targetLocalUV, blockIdx, u_blocks, u_texelSize) * 0.995;
      }
    `;

    const injectSourcesFS = `#version 300 es
      precision highp float;
      precision highp sampler2D;
      in vec2 v_texcoord;
      out vec4 fragColor;

      uniform sampler2D u_velocity;
      uniform sampler2D u_velocitySources;
      uniform float u_dt;

      void main() {
          vec4 state = texture(u_velocity, v_texcoord);
          vec4 src = texture(u_velocitySources, v_texcoord);

          state.xy += src.xy * u_dt;

          state.z = clamp(state.z + src.z * u_dt, 0.0, 3.0);
          state.w = clamp(state.w + src.w * u_dt, 0.0, 3.0);

          fragColor = state;
      }
    `;

    const injectElementWavesFS = `#version 300 es
      precision highp float;
      precision highp sampler2D;
      in vec2 v_texcoord;
      out vec4 fragColor;

      uniform sampler2D u_density;
      uniform sampler2D u_densitySources;
      uniform float u_dt;

      void main() {
          vec4 state = texture(u_density, v_texcoord);
          vec4 src = texture(u_densitySources, v_texcoord);
          
          state += src * u_dt;

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
          // Correct sign for pressure Poisson solver (matches CPU solver and strict fluid physics)
          float p_next  = 0.25 * (p_left + p_right + p_down + p_up + div);
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

  uploadDensity() {
    const gl = this.gl;
    const N = this.N;

    const densData = new Float32Array(N * N * this.blocks * 4);
    for (let b = 0; b < this.blocks; b++) {
      const el1 = b * 2;
      const el2 = b * 2 + 1;
      const offset = b * N * N * 4;
      
      for (let y = 0; y < N; y++) {
        const canvasY = y;
        const webglY = N - 1 - y;
        const canvasOffset = canvasY * N;
        const webglOffset = webglY * N;
        
        for (let x = 0; x < N; x++) {
          const canvasIdx = x + canvasOffset;
          const webglIdx = x + webglOffset;
          
          if (el1 < this.numElements) {
            densData[offset + webglIdx * 4] = this.density[el1 * 2][canvasIdx];
            densData[offset + webglIdx * 4 + 1] = this.density[el1 * 2 + 1][canvasIdx];
          }
          if (el2 < this.numElements) {
            densData[offset + webglIdx * 4 + 2] = this.density[el2 * 2][canvasIdx];
            densData[offset + webglIdx * 4 + 3] = this.density[el2 * 2 + 1][canvasIdx];
          }
        }
      }
    }
    gl.bindTexture(gl.TEXTURE_2D, this.densityBuffer.textures[0]);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, N, N * this.blocks, 0, gl.RGBA, gl.FLOAT, densData);
    gl.bindTexture(gl.TEXTURE_2D, this.densityBuffer.textures[1]);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, N, N * this.blocks, 0, gl.RGBA, gl.FLOAT, densData);
  }

  uploadSources(pCOM: [number, number], bCOM: [number, number]) {
    const gl = this.gl;
    const N = this.N;

    const velSrcData = new Float32Array(N * N * 4);
    const px_grid = Math.floor(pCOM[0] * N);
    const py_grid = Math.floor(pCOM[1] * N);
    const bx_grid = Math.floor(bCOM[0] * N);
    const by_grid = Math.floor(bCOM[1] * N);

    const pIdx = px_grid + py_grid * N;
    const bIdx = bx_grid + by_grid * N;

    for (let y = 0; y < N; y++) {
      const canvasY = y;
      const webglY = N - 1 - y;
      const canvasOffset = canvasY * N;
      const webglOffset = webglY * N;

      for (let x = 0; x < N; x++) {
        const canvasIdx = x + canvasOffset;
        const webglIdx = x + webglOffset;

        velSrcData[webglIdx * 4] = this.u_prev[canvasIdx];
        velSrcData[webglIdx * 4 + 1] = -this.v_prev[canvasIdx]; 
        velSrcData[webglIdx * 4 + 2] = (canvasIdx === pIdx) ? 15.0 : 0.0; 
        velSrcData[webglIdx * 4 + 3] = (canvasIdx === bIdx) ? 15.0 : 0.0; 
      }
    }

    gl.bindTexture(gl.TEXTURE_2D, this.velocitySourcesTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, N, N, 0, gl.RGBA, gl.FLOAT, velSrcData);

    const densSrcData = new Float32Array(N * N * this.blocks * 4);
    for (let b = 0; b < this.blocks; b++) {
      const el1 = b * 2;
      const el2 = b * 2 + 1;
      const offset = b * N * N * 4;

      for (let y = 0; y < N; y++) {
        const canvasY = y;
        const webglY = N - 1 - y;
        const canvasOffset = canvasY * N;
        const webglOffset = webglY * N;

        for (let x = 0; x < N; x++) {
          const canvasIdx = x + canvasOffset;
          const webglIdx = x + webglOffset;

          if (el1 < this.numElements) {
            densSrcData[offset + webglIdx * 4] = this.density_prev[el1 * 2][canvasIdx];
            densSrcData[offset + webglIdx * 4 + 1] = this.density_prev[el1 * 2 + 1][canvasIdx];
          }
          if (el2 < this.numElements) {
            densSrcData[offset + webglIdx * 4 + 2] = this.density_prev[el2 * 2][canvasIdx];
            densSrcData[offset + webglIdx * 4 + 3] = this.density_prev[el2 * 2 + 1][canvasIdx];
          }
        }
      }
    }

    gl.bindTexture(gl.TEXTURE_2D, this.densitySourcesTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, N, N * this.blocks, 0, gl.RGBA, gl.FLOAT, densSrcData);
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

      tempLap.fill(0);

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

  step(dt: number, pCOM: [number, number], bCOM: [number, number], pIntent: [number, number, number], bIntent: [number, number, number], settings?: any) {
    const gl = this.gl;
    const N = this.N;
    const activeSettings = settings || { hbar: 120.0, decay: 0.9992, injectionRadius: 0.05, injectionIntensity: 150.0, cahnHilliardSharpen: 4.0, couplingStrength: 25.0, pacStrength: 6.5 };

    this.uploadSources(pCOM, bCOM);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    let loc = gl.getAttribLocation(this.injectSourcesProgram, "a_position");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    gl.useProgram(this.injectSourcesProgram);
    gl.uniform1f(gl.getUniformLocation(this.injectSourcesProgram, "u_dt"), dt);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.velocityBuffer.writeFBO);
    gl.viewport(0, 0, N, N);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.velocityBuffer.readTex);
    gl.uniform1i(gl.getUniformLocation(this.injectSourcesProgram, "u_velocity"), 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.velocitySourcesTex);
    gl.uniform1i(gl.getUniformLocation(this.injectSourcesProgram, "u_velocitySources"), 1);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    this.velocityBuffer.swap();

    gl.useProgram(this.injectElementWavesProgram);
    gl.uniform1f(gl.getUniformLocation(this.injectElementWavesProgram, "u_dt"), dt);
    gl.uniform1i(gl.getUniformLocation(this.injectElementWavesProgram, "u_blocks"), this.blocks);
    gl.uniform1i(gl.getUniformLocation(this.injectElementWavesProgram, "u_numElements"), this.numElements);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.densityBuffer.writeFBO);
    gl.viewport(0, 0, N, N * this.blocks);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.densityBuffer.readTex);
    gl.uniform1i(gl.getUniformLocation(this.injectElementWavesProgram, "u_density"), 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.densitySourcesTex);
    gl.uniform1i(gl.getUniformLocation(this.injectElementWavesProgram, "u_densitySources"), 1);

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

    this.applyPhaseCoupling(dt, activeSettings);
    this.sharpenDensity(dt, activeSettings);

    for (let c = 0; c < this.numElements * 2; c++) {
      this.setBnd(0, this.density[c]);
    }
    this.setBnd(0, this.playerDensity);
    this.setBnd(0, this.botDensity);

    this.uploadDensity();
  }

  downloadData() {
    const gl = this.gl;
    const N = this.N;

    const latestVelocityFBO = this.velocityBuffer.framebuffers[1 - this.velocityBuffer.writeIndex];
    gl.bindFramebuffer(gl.FRAMEBUFFER, latestVelocityFBO);
    gl.readPixels(0, 0, N, N, gl.RGBA, gl.FLOAT, this.cpuVelocityBuffer);
    
    for (let y = 0; y < N; y++) {
      const canvasY = y;
      const webglY = N - 1 - y;
      const canvasOffset = canvasY * N;
      const webglOffset = webglY * N;
      
      for (let x = 0; x < N; x++) {
        const canvasIdx = x + canvasOffset;
        const webglIdx = x + webglOffset;
        
        this.u[canvasIdx] = this.cpuVelocityBuffer[webglIdx * 4];
        this.v[canvasIdx] = -this.cpuVelocityBuffer[webglIdx * 4 + 1]; 
        this.playerDensity[canvasIdx] = this.cpuVelocityBuffer[webglIdx * 4 + 2];
        this.botDensity[canvasIdx] = this.cpuVelocityBuffer[webglIdx * 4 + 3];
      }
    }

    const latestDensityFBO = this.densityBuffer.framebuffers[1 - this.densityBuffer.writeIndex];
    gl.bindFramebuffer(gl.FRAMEBUFFER, latestDensityFBO);
    gl.readPixels(0, 0, N, N * this.blocks, gl.RGBA, gl.FLOAT, this.cpuDensityBuffer);

    for (let b = 0; b < this.blocks; b++) {
      const el1 = b * 2;
      const el2 = b * 2 + 1;
      const offset = b * N * N * 4;
      
      for (let y = 0; y < N; y++) {
        const canvasY = y;
        const webglY = N - 1 - y;
        const canvasOffset = canvasY * N;
        const webglOffset = webglY * N;
        
        for (let x = 0; x < N; x++) {
          const canvasIdx = x + canvasOffset;
          const webglIdx = x + webglOffset;
          
          if (el1 < this.numElements) {
            this.density[el1 * 2][canvasIdx] = this.cpuDensityBuffer[offset + webglIdx * 4];
            this.density[el1 * 2 + 1][canvasIdx] = this.cpuDensityBuffer[offset + webglIdx * 4 + 1];
          }
          if (el2 < this.numElements) {
            this.density[el2 * 2][canvasIdx] = this.cpuDensityBuffer[offset + webglIdx * 4 + 2];
            this.density[el2 * 2 + 1][canvasIdx] = this.cpuDensityBuffer[offset + webglIdx * 4 + 3];
          }
        }
      }
    }
  }
}