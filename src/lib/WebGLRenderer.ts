export class WebGLFluidRenderer {
  gl: WebGLRenderingContext | WebGL2RenderingContext;
  program: WebGLProgram;
  positionBuffer: WebGLBuffer;
  texture: WebGLTexture;
  gridRes: number;
  dataBuffer: Float32Array;
  numElements: number;
  elementColors: Float32Array;
  isWebGL2: boolean;

  constructor(canvas: HTMLCanvasElement, gridRes: number, numElements: number, colors?: number[][]) {
    this.gridRes = gridRes;
    this.numElements = numElements;
    
    const elementColors = colors || [
       [255, 25, 25],
       [25, 255, 25],
       [25, 75, 255],
       [255, 200, 25],
       [25, 200, 255],
       [200, 25, 255],
       [255, 128, 25],
       [128, 255, 128]
    ];

    const glContext = (canvas.getContext('webgl2', { premultipliedAlpha: false }) || 
                       canvas.getContext('webgl', { premultipliedAlpha: false }));
    if (!glContext) throw new Error("WebGL context not supported by hardware");
    this.gl = glContext;
    this.isWebGL2 = 'WebGL2RenderingContext' in window && glContext instanceof WebGL2RenderingContext;

    const gl = this.gl;
    if (!this.isWebGL2) {
       gl.getExtension('OES_texture_float');
    }

    const vsSource = `
      attribute vec2 a_position;
      varying vec2 v_texcoord;
      void main() {
          gl_Position = vec4(a_position, 0.0, 1.0);
          v_texcoord = a_position * 0.5 + 0.5;
          v_texcoord.y = 1.0 - v_texcoord.y;
      }
    `;

    const fsSource = `
      precision mediump float;
      varying vec2 v_texcoord;
      uniform sampler2D u_data;
      uniform float u_time;
      uniform int u_numElements;
      uniform vec3 u_colors[8];
      
      uniform vec2 u_cameraCOM;
      uniform float u_angle;
      uniform float u_zoom;
      uniform int u_gridRes;
      uniform int u_blocks;
      
      uniform float u_stripeFreq;
      uniform float u_stripeContrast;

      vec4 textureBilinear(sampler2D tex, vec2 localUV, int targetBlock) {
          vec2 texSize = vec2(float(u_gridRes), float(u_gridRes));
          vec2 uv = clamp(localUV, 0.5 / texSize, 1.0 - 0.5 / texSize);
          
          vec2 f = fract(uv * texSize - 0.5);
          vec2 centroidUV = (floor(uv * texSize - 0.5) + 0.5) / texSize;
          
          vec2 offset = 1.0 / texSize;
          
          vec4 t00 = texture2D(tex, vec2(centroidUV.x, (centroidUV.y + float(targetBlock)) / float(u_blocks)));
          vec4 t10 = texture2D(tex, vec2(centroidUV.x + offset.x, (centroidUV.y + float(targetBlock)) / float(u_blocks)));
          vec4 t01 = texture2D(tex, vec2(centroidUV.x, (centroidUV.y + offset.y + float(targetBlock)) / float(u_blocks)));
          vec4 t11 = texture2D(tex, vec2(centroidUV.x + offset.x, (centroidUV.y + offset.y + float(targetBlock)) / float(u_blocks)));
          
          return mix(mix(t00, t10, f.x), mix(t01, t11, f.x), f.y);
      }

      void main() {
          vec3 color = vec3(0.047, 0.047, 0.047);
          float tf = u_time * 12.0; // Match the CPU wave frequency exactly
          
          vec2 centered = v_texcoord - 0.5;
          float cos_a = cos(-u_angle);
          float sin_a = sin(-u_angle);
          vec2 rotated = vec2(
              centered.x * cos_a - centered.y * sin_a,
              centered.x * sin_a + centered.y * cos_a
          );
          
          vec2 camCoord = (rotated * u_zoom) + u_cameraCOM;
          
          if (camCoord.x < 0.0 || camCoord.x > 1.0 || camCoord.y < 0.0 || camCoord.y > 1.0) {
              gl_FragColor = vec4(color, 1.0);
              return;
          }
          
          for(int i=0; i<8; i++) {
              if (i >= u_numElements) break;
              
              int pairIdx = i / 2;
              int subIdx = i - pairIdx * 2;
              
              vec4 texData = textureBilinear(u_data, camCoord, pairIdx);
              
              float re = subIdx == 0 ? texData.x : texData.z;
              float im = subIdx == 0 ? texData.y : texData.w;
              
              float tfScale = tf * (1.0 - float(i) * 0.12);
              float wave = re * cos(tfScale) - im * sin(tfScale);
              
              float w = abs(wave) * u_stripeContrast;
              
              color += u_colors[i] * clamp(w, 0.0, 1.0);
          }
          
          gl_FragColor = vec4(min(color, vec3(1.0)), 1.0);
      }
    `;

    const vertexShader = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vertexShader, vsSource);
    gl.compileShader(vertexShader);

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fragmentShader, fsSource);
    gl.compileShader(fragmentShader);

    this.program = gl.createProgram()!;
    gl.attachShader(this.program, vertexShader);
    gl.attachShader(this.program, fragmentShader);
    gl.linkProgram(this.program);

    this.positionBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,  1, -1, -1,  1,
      -1,  1,  1, -1,  1,  1
    ]), gl.STATIC_DRAW);

    this.texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    this.dataBuffer = new Float32Array(gridRes * gridRes * 4 * 4);
    
    this.elementColors = new Float32Array(8 * 3);
    for(let i=0; i<numElements && i<8; i++) {
        const c = elementColors[i % elementColors.length];
        const r = c[0] > 1.0 ? c[0] / 255.0 : c[0];
        const g = c[1] > 1.0 ? c[1] / 255.0 : c[1];
        const b = c[2] > 1.0 ? c[2] / 255.0 : c[2];
        this.elementColors[i*3] = r;
        this.elementColors[i*3+1] = g;
        this.elementColors[i*3+2] = b;
    }
  }

  render(density: Float32Array[], time: number, cameraCOM: [number, number], angle: number, zoom: number, settings: any) {
    const gl = this.gl;
    const res = this.gridRes;

    let ptr = 0;
    const numCells = res * res;
    
    for (let row = 0; row < 4; row++) {
        const el1 = row * 2;
        const el2 = row * 2 + 1;
        
        for (let i = 0; i < numCells; i++) {
            if (el1 < this.numElements) {
                this.dataBuffer[ptr++] = density[el1*2][i];
                this.dataBuffer[ptr++] = density[el1*2+1][i];
            } else {
                this.dataBuffer[ptr++] = 0; this.dataBuffer[ptr++] = 0;
            }
            if (el2 < this.numElements) {
                this.dataBuffer[ptr++] = density[el2*2][i];
                this.dataBuffer[ptr++] = density[el2*2+1][i];
            } else {
                this.dataBuffer[ptr++] = 0; this.dataBuffer[ptr++] = 0;
            }
        }
    }

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.useProgram(this.program);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    
    if (this.isWebGL2) {
       const gl2 = gl as WebGL2RenderingContext;
       gl2.texImage2D(gl2.TEXTURE_2D, 0, gl2.RGBA32F, res, res * 4, 0, gl2.RGBA, gl2.FLOAT, this.dataBuffer);
    } else {
       gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, res, res * 4, 0, gl.RGBA, gl.FLOAT, this.dataBuffer);
    }

    gl.uniform1i(gl.getUniformLocation(this.program, "u_data"), 0);

    const posLoc = gl.getAttribLocation(this.program, "a_position");
    gl.enableVertexAttribArray(posLoc);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const timeLoc = gl.getUniformLocation(this.program, "u_time");
    gl.uniform1f(timeLoc, time);
    
    const numLoc = gl.getUniformLocation(this.program, "u_numElements");
    gl.uniform1i(numLoc, this.numElements);
    
    const colLoc = gl.getUniformLocation(this.program, "u_colors");
    gl.uniform3fv(colLoc, this.elementColors);

    const comLoc = gl.getUniformLocation(this.program, "u_cameraCOM");
    gl.uniform2f(comLoc, cameraCOM[0], cameraCOM[1]);

    const angLoc = gl.getUniformLocation(this.program, "u_angle");
    gl.uniform1f(angLoc, angle);

    const zoomLoc = gl.getUniformLocation(this.program, "u_zoom");
    gl.uniform1f(zoomLoc, zoom);

    const resLoc = gl.getUniformLocation(this.program, "u_gridRes");
    gl.uniform1i(resLoc, this.gridRes);

    const blocksLoc = gl.getUniformLocation(this.program, "u_blocks");
    gl.uniform1i(blocksLoc, 4);
    
    gl.uniform1f(gl.getUniformLocation(this.program, "u_stripeFreq"), settings.stripeFreq);
    gl.uniform1f(gl.getUniformLocation(this.program, "u_stripeContrast"), settings.stripeContrast);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
}