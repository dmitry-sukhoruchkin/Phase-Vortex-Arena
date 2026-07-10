import React, { useEffect, useRef, useState } from 'react';
import { PhaseVortexArena, Cultivator } from './lib/physics/Arena';
import { WebGLFluidRenderer } from './lib/WebGLRenderer';
import { CONFIG, SEMANTIC_PILLS_DB, PillConfig } from './lib/config';

export default function App() {
  const [gameState, setGameState] = useState<'MENU' | 'ARENA'>('MENU');
  const [arena, setArena] = useState<PhaseVortexArena | null>(null);
  
  const [p1Pill, setP1Pill] = useState<string>("Pure Yang Core");
  const [p2Pill, setP2Pill] = useState<string>("Deep Yin Core");
  const [mode, setMode] = useState<"PvsB" | "BvsB">("PvsB");
  const [teamSize, setTeamSize] = useState<number>(1);
  const [numElements, setNumElements] = useState<number>(3);
  const [gridRes, setGridRes] = useState<number>(80);
  const [useWebGL, setUseWebGL] = useState<boolean>(true);
  const [gpuEnabled, setGpuEnabled] = useState<boolean>(true);
  
  // 11 Интерактивных слайдеров калибровки для нейрофидбека
  const [settings, setSettings] = useState({
     hbar: 120.0,
     decay: 0.9992,
     injectionRadius: 0.05,
     injectionIntensity: 150.0,
     cahnHilliardSharpen: 4.0,
     couplingStrength: 25.0,
     pacStrength: 6.5,
     stripeFreq: 22.0,
     stripeContrast: 1.5,
     springStiffness: 200.0,
     tensionTear: 2.0
  });

  useEffect(() => {
    webglRendererRef.current = null;
  }, [gridRes, numElements, useWebGL, gameState]);

  const [p1CustomVec, setP1CustomVec] = useState<[number, number, number]>([0.577, 0.577, 0.577]);
  const [p2CustomVec, setP2CustomVec] = useState<[number, number, number]>([0.577, 0.577, 0.577]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const webglCanvasRef = useRef<HTMLCanvasElement>(null);
  const webglRendererRef = useRef<WebGLFluidRenderer | null>(null);
  const [playerInfo, setPlayerInfo] = useState<Cultivator | null>(null);
  const [botInfo, setBotInfo] = useState<Cultivator | null>(null);
  const [time, setTime] = useState(0);
  const [fps, setFps] = useState(0);

  const keys = useRef<{ [key: string]: boolean }>({});

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => (keys.current[e.key] = true);
    const handleKeyUp = (e: KeyboardEvent) => (keys.current[e.key] = false);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useEffect(() => {
    if (gameState !== 'ARENA' || !arena) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Инициализация WebGL-рендерера перед запуском игрового цикла
    if (useWebGL && !webglRendererRef.current && webglCanvasRef.current) {
      try {
        webglRendererRef.current = new WebGLFluidRenderer(
          webglCanvasRef.current,
          gridRes,
          numElements
        );
      } catch (e) {
        console.error("Failed to initialize WebGLFluidRenderer:", e);
      }
    }

    let lastTime = performance.now();
    let animationId: number;
    let frames = 0;
    let fpsStart = performance.now();

    const render = () => {
      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000.0, 0.032);
      lastTime = now;
      
      frames++;
      if (now - fpsStart >= 1000) {
         setFps(frames);
         frames = 0;
         fpsStart = now;
      }

      const k = keys.current;
      let vx = 0, vy = 0, tq = 0, freq = 0, spatial = 0;
      if (k['ArrowUp'] || k['w']) vy -= 1;
      if (k['ArrowDown'] || k['s']) vy += 1;
      if (k['ArrowLeft'] || k['a']) vx -= 1;
      if (k['ArrowRight'] || k['d']) vx += 1;
      if (k['q']) tq -= 1;
      if (k['e']) tq += 1;
      if (k['c']) freq += 1;
      if (k['z']) freq -= 1;
      if (k['v']) spatial += 1;
      if (k['x']) spatial -= 1;

      const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      let gp = null;
      for (let i = 0; i < gamepads.length; i++) {
        if (gamepads[i] && gamepads[i]!.connected) {
          gp = gamepads[i];
          break;
        }
      }

      if (gp) {
        if (gp.axes.length >= 2) {
          const ax = gp.axes[0];
          const ay = gp.axes[1];
          if (Math.abs(ax) > 0.15) vx += ax;
          if (Math.abs(ay) > 0.15) vy += ay;
        }
        if (gp.axes.length >= 4) {
          const atq = gp.axes[2];
          if (Math.abs(atq) > 0.15) tq += atq;
        }
        if (gp.buttons.length >= 4) {
          const b1 = gp.buttons[1].value || (gp.buttons[1].pressed ? 1 : 0);
          const b2 = gp.buttons[2].value || (gp.buttons[2].pressed ? 1 : 0);
          freq += b1 - b2;
          
          const b3 = gp.buttons[3].value || (gp.buttons[3].pressed ? 1 : 0);
          const b0 = gp.buttons[0].value || (gp.buttons[0].pressed ? 1 : 0);
          spatial += b3 - b0;
        }
      }

      const mag = Math.hypot(vx, vy);
      if (mag > 1.0) {
        vx /= mag;
        vy /= mag;
      }
      tq = Math.max(-1.0, Math.min(1.0, tq));
      freq = Math.max(-1.0, Math.min(1.0, freq));
      spatial = Math.max(-1.0, Math.min(1.0, spatial));

      if (arena.cultivators[0].isPlayer) {
          arena.cultivators[0].vx = vx;
          arena.cultivators[0].vy = vy;
          arena.cultivators[0].tq = tq;
          arena.cultivators[0].freqVal = freq;
          arena.cultivators[0].spatialVal = spatial;
      }

      arena.step(dt, settings);
      
      if (Math.floor(now / 100) !== Math.floor((now - dt * 1000) / 100)) {
        setPlayerInfo({ ...arena.cultivators[0] });
        setBotInfo({ ...(arena.cultivators.find(c => c.team === 1) || arena.cultivators[1]) });
        setTime(arena.time);
      }

      const colorsPalette = [
         [255, 25, 25],
         [25, 255, 25],
         [25, 75, 255],
         [255, 200, 25],
         [25, 200, 255],
         [200, 25, 255],
         [255, 128, 25],
         [128, 255, 128]
      ];

      // Отрисовка жидкостей на GPU (с передачей COM, угла и кастомных настроек!)
      if (useWebGL && webglRendererRef.current) {
         const p0 = arena.cultivators[0];
         const pxNorm = p0.pos.x / 800.0;
         const pyNorm = p0.pos.y / 800.0;
         webglRendererRef.current.render(arena.fluid.density, arena.time, [pxNorm, pyNorm], p0.angle, 1.35, settings);
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Отрисовка жидкостей на CPU (с точной симуляцией аффинной матрицы для совпадения фонов)
      if (!useWebGL) {
          const id = ctx.createImageData(gridRes, gridRes);
          const data = id.data;
          const tf = arena.time * 12.0;

          for (let i = 0; i < arena.fluid.size; i++) {
             const x = i % gridRes;
             const y = Math.floor(i / gridRes);
             
             // Чтобы убрать «выстреливающие» за край цветные линии на CPU, принудительно зануляем внешние границы
             if (x === 0 || x === gridRes - 1 || y === 0 || y === gridRes - 1) {
                data[i * 4] = 12;
                data[i * 4 + 1] = 12;
                data[i * 4 + 2] = 12;
                data[i * 4 + 3] = 255;
                continue;
             }

             let rSum = 0, gSum = 0, bSum = 0;
             for (let ch = 0; ch < numElements; ch++) {
                const re = arena.fluid.density[ch * 2][i];
                const im = arena.fluid.density[ch * 2 + 1][i];
                const wave = re * Math.cos(tf * (1.0 - ch * 0.12)) - im * Math.sin(tf * (1.0 - ch * 0.12));
                
                // В Python используется чистый модуль волны: R = abs(wave).
                // Мы полностью убираем высокочастотную синусоидальную решетку u_stripeFreq.
                const w = Math.abs(wave) * settings.stripeContrast;
                
                rSum += colorsPalette[ch % colorsPalette.length][0] * w;
                gSum += colorsPalette[ch % colorsPalette.length][1] * w;
                bSum += colorsPalette[ch % colorsPalette.length][2] * w;
             }
             data[i * 4] = Math.min(255, Math.max(12, rSum));
             data[i * 4 + 1] = Math.min(255, Math.max(12, gSum));
             data[i * 4 + 2] = Math.min(255, Math.max(12, bSum));
             data[i * 4 + 3] = 255;
          }
          const offscreen = document.createElement('canvas');
          offscreen.width = gridRes;
          offscreen.height = gridRes;
          offscreen.getContext('2d')!.putImageData(id, 0, 0);

          ctx.save();
          ctx.translate(canvas.width / 2, canvas.height / 2);
          ctx.rotate(-arena.cultivators[0].angle);
          const zoom = 1.35;
          ctx.scale(1.0 / zoom, 1.0 / zoom);
          
          const px = (arena.cultivators[0].pos.x / 800.0) * canvas.width;
          const py = (arena.cultivators[0].pos.y / 800.0) * canvas.height;
          ctx.translate(-px, -py);

          ctx.imageSmoothingEnabled = true;
          ctx.drawImage(offscreen, 0, 0, canvas.width, canvas.height);
          ctx.restore();
      }

      // Отрисовка упругой структуры на холсте с преобразованием координат следящей камеры
      const p0 = arena.cultivators[0];
      const theta = -p0.angle;
      const cos_t = Math.cos(theta);
      const sin_t = Math.sin(theta);
      const zoomFactor = 1.35;

      const getScreenCoords = (wx: number, wy: number) => {
          const dx = wx - p0.pos.x;
          const dy = wy - p0.pos.y;
          const sx = canvas.width / 2.0 + (dx * cos_t + dy * sin_t) / zoomFactor;
          const sy = canvas.height / 2.0 + (-dx * sin_t + dy * cos_t) / zoomFactor;
          return { x: sx, y: sy };
      };

      for (const c of arena.cultivators) {
        for (let i = 0; i < c.nodes.length; i++) {
          const node = c.nodes[i];
          const next = c.nodes[(i + 1) % c.nodes.length];
          
          const sNode = getScreenCoords(node.x, node.y);
          const sNext = getScreenCoords(next.x, next.y);

          ctx.beginPath();
          ctx.moveTo(sNode.x, sNode.y);
          ctx.lineTo(sNext.x, sNext.y);
          if (node.intact) {
            ctx.lineWidth = 2;
            ctx.strokeStyle = `rgba(255, 255, 255, 0.45)`;
          } else {
            ctx.lineWidth = 1;
            ctx.strokeStyle = `rgba(255, 0, 0, 0.45)`;
          }
          ctx.stroke();
        }

        for (const node of c.nodes) {
          const sNode = getScreenCoords(node.x, node.y);

          ctx.beginPath();
          ctx.arc(sNode.x, sNode.y, 5, 0, Math.PI * 2);
          
          let r = c.color[0], g = c.color[1], b = c.color[2];
          if (node.vector[0] > node.vector[1] && node.vector[0] > node.vector[2]) { r=255; g=50; b=0; }
          else if (node.vector[1] > node.vector[0] && node.vector[1] > node.vector[2]) { r=0; g=255; b=50; }
          else if (node.vector[2] > node.vector[0] && node.vector[2] > node.vector[1]) { r=0; g=150; b=255; }
          
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.95)`;
          ctx.fill();
          
          ctx.beginPath();
          ctx.arc(sNode.x, sNode.y, 8, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.55)`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        if (c.domainCharge > 0.05) {
          const sCOM = getScreenCoords(c.pos.x, c.pos.y);
          ctx.beginPath();
          ctx.arc(sCOM.x, sCOM.y, (c.domainCharge * 40 + 20) / zoomFactor, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(255, 0, 255, 0.45)`;
          ctx.lineWidth = 3;
          ctx.stroke();
        }
      }

      animationId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationId);
  }, [gameState, arena, useWebGL, gridRes, numElements, settings]);

  const buildPillConfig = (pillName: string, customVec: [number, number, number] | Float32Array): PillConfig => {
     if (pillName === 'Custom') {
         const norm = Math.max(1e-8, Math.hypot(customVec[0], Math.hypot(customVec[1], customVec[2])));
         return {
            name: "Custom Pill",
            vector: [customVec[0]/norm, customVec[1]/norm, customVec[2]/norm],
            color: [customVec[0]/norm*255, customVec[1]/norm*255, customVec[2]/norm*255],
            desc: "Custom Element Mix"
         };
     }
     return SEMANTIC_PILLS_DB[pillName];
  };

  const renderSliders = (vec: [number, number, number], setVec: (v: [number, number, number]) => void) => (
     <div className="space-y-2 mt-2">
        <label className="flex items-center gap-2 text-xs text-red-400">
           Yang: <input type="range" min="0" max="1" step="0.1" value={vec[0]} onChange={e => setVec([parseFloat(e.target.value), vec[1], vec[2]])} className="w-full accent-red-500" />
        </label>
        <label className="flex items-center gap-2 text-xs text-green-400">
           Catalyst: <input type="range" min="0" max="1" step="0.1" value={vec[1]} onChange={e => setVec([vec[0], parseFloat(e.target.value), vec[2]])} className="w-full accent-green-500" />
        </label>
        <label className="flex items-center gap-2 text-xs text-blue-400">
           Yin: <input type="range" min="0" max="1" step="0.1" value={vec[2]} onChange={e => setVec([vec[0], vec[1], parseFloat(e.target.value)])} className="w-full accent-blue-500" />
        </label>
     </div>
  );

  if (gameState === 'MENU') {
    const pillOptions = [...Object.keys(SEMANTIC_PILLS_DB), "Custom"];
    return (
      <div className="min-h-screen bg-[#0a0c12] text-slate-300 font-mono flex items-center justify-center p-8">
         <div className="bg-slate-950/80 border border-cyan-900/50 p-8 shadow-2xl max-w-2xl w-full">
            <h1 className="text-3xl text-cyan-400 font-bold mb-8 text-center tracking-widest border-b border-slate-800 pb-4">
              PHASE VORTEX ARENA
            </h1>

            <div className="space-y-8">
               <div>
                  <h2 className="text-xl text-slate-200 mb-4">Mode Selection</h2>
                  <div className="flex gap-4 mb-4 items-center">
                    <span className="text-sm font-bold text-slate-400">Settings:</span>
                    <label className="text-xs text-slate-500">Elements:
                        <select className="ml-2 bg-slate-900 border border-slate-700 rounded px-2 py-1" value={numElements} onChange={e => setNumElements(parseInt(e.target.value))}>
                            <option value={3}>3 (RGB)</option>
                            <option value={5}>5 (Wu Xing)</option>
                            <option value={7}>7 (Rainbow)</option>
                        </select>
                    </label>
                    <label className="text-xs text-slate-500">Grid Res:
                        <select className="ml-2 bg-slate-900 border border-slate-700 rounded px-2 py-1" value={gridRes} onChange={e => setGridRes(parseInt(e.target.value))}>
                            <option value={60}>60 (Fast)</option>
                            <option value={80}>80 (Normal)</option>
                            <option value={100}>100 (Detailed)</option>
                        </select>
                    </label>
                    <label className="text-xs text-slate-500 flex items-center gap-2 cursor-pointer border border-slate-700 rounded px-2 py-1">
                        <input type="checkbox" checked={gpuEnabled} onChange={e => setGpuEnabled(e.target.checked)} className="accent-cyan-400" /> GPU Sim (WebGL2)
                    </label>
                  </div>
                  <div className="flex gap-4 mb-4">
                     <button className={`px-4 py-2 border ${teamSize === 1 ? 'border-cyan-400 text-cyan-400 bg-cyan-950/30' : 'border-slate-700 text-slate-500'}`} onClick={() => setTeamSize(1)}>1v1</button>
                     <button className={`px-4 py-2 border ${teamSize === 3 ? 'border-cyan-400 text-cyan-400 bg-cyan-950/30' : 'border-slate-700 text-slate-500'}`} onClick={() => setTeamSize(3)}>3v3</button>
                     <button className={`px-4 py-2 border ${teamSize === 5 ? 'border-cyan-400 text-cyan-400 bg-cyan-950/30' : 'border-slate-700 text-slate-500'}`} onClick={() => setTeamSize(5)}>5v5</button>
                  </div>
                  <div className="flex gap-4">
                     <button 
                        className={`px-4 py-2 border ${mode === 'PvsB' ? 'border-cyan-400 text-cyan-400 bg-cyan-950/30' : 'border-slate-700 text-slate-500'}`}
                        onClick={() => setMode('PvsB')}
                     >
                        Player vs Bot
                     </button>
                     <button 
                        className={`px-4 py-2 border ${mode === 'BvsB' ? 'border-cyan-400 text-cyan-400 bg-cyan-950/30' : 'border-slate-700 text-slate-500'}`}
                        onClick={() => setMode('BvsB')}
                     >
                        Bot vs Bot
                     </button>
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-8">
                 <div>
                    <h2 className="text-lg text-cyan-300 mb-2">Player 1 Core</h2>
                    <select 
                      className="w-full bg-slate-900 border border-slate-700 p-2 text-sm text-cyan-100"
                      value={p1Pill}
                      onChange={(e) => setP1Pill(e.target.value)}
                    >
                      {pillOptions.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                    {p1Pill === "Custom" && renderSliders(p1CustomVec, setP1CustomVec)}
                    <div className="mt-2 text-xs text-slate-500 h-10">
                       {p1Pill === "Custom" ? "Custom Elements" : SEMANTIC_PILLS_DB[p1Pill]?.desc}
                    </div>
                 </div>
                 
                 <div>
                    <h2 className="text-lg text-red-300 mb-2">Player 2 Core (Rogue)</h2>
                    <select 
                      className="w-full bg-slate-900 border border-slate-700 p-2 text-sm text-red-100"
                      value={p2Pill}
                      onChange={(e) => setP2Pill(e.target.value)}
                    >
                      {pillOptions.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                    {p2Pill === "Custom" && renderSliders(p2CustomVec, setP2CustomVec)}
                    <div className="mt-2 text-xs text-slate-500 h-10">
                       {p2Pill === "Custom" ? "Custom Elements" : SEMANTIC_PILLS_DB[p2Pill]?.desc}
                    </div>
                 </div>
               </div>

               <button 
                  className="w-full py-4 bg-cyan-900/40 border border-cyan-500 text-cyan-300 hover:bg-cyan-800/60 hover:text-white transition-colors text-xl font-bold tracking-[0.2em] cursor-pointer"
                  onClick={() => {
                     const v1 = new Float32Array(numElements);
                     v1[0] = 1;
                     const p1Conf = buildPillConfig(p1Pill, p1Pill === 'Custom' ? p1CustomVec : v1);
                     
                     const v2 = new Float32Array(numElements);
                     v2[1 % numElements] = 1;
                     const p2Conf = buildPillConfig(p2Pill, p2Pill === 'Custom' ? p2CustomVec : v2);

                     setArena(new PhaseVortexArena(p1Conf, p2Conf, teamSize, mode, gridRes, numElements, gpuEnabled));
                     setGameState('ARENA');
                  }}
               >
                  INITIALIZE ARENA
               </button>
            </div>
         </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0c12] text-slate-300 font-mono flex flex-col items-center justify-center relative overflow-hidden p-4">
      
      <div className="w-full max-w-[800px] flex justify-between items-center mb-2 px-2 text-xs">
          <div className="text-slate-500">
             FPS: <span className={fps >= 45 ? "text-emerald-400" : "text-orange-400"}>{fps}</span> | ENGINE: {arena?.fluid.gpuActive ? 'WebGL2 GPGPU' : 'Canvas2D CPU Fallback'} ({gridRes}x{gridRes}, {numElements} Elements)
          </div>
          <button 
             className="px-3 py-1 border border-slate-700 hover:bg-slate-800 hover:text-white text-slate-400 cursor-pointer"
             onClick={() => setGameState('MENU')}
          >
             ABORT
          </button>
      </div>

      <div className="relative shadow-2xl shadow-cyan-900/20 border border-slate-800">
        <canvas ref={webglCanvasRef} width={CONFIG.WIDTH} height={CONFIG.HEIGHT} className="absolute inset-0 bg-black pointer-events-auto" style={{ display: useWebGL ? 'block' : 'none' }} />
        <canvas ref={canvasRef} width={CONFIG.WIDTH} height={CONFIG.HEIGHT} className="relative z-10 pointer-events-none" style={{ background: 'transparent' }} />
        
        {playerInfo && (
          <div className="absolute top-4 left-4 bg-slate-950/85 border border-cyan-800 p-4 w-72 backdrop-blur-sm z-20">
            <h2 className="text-cyan-400 font-bold mb-3 tracking-wider">{mode === 'PvsB' ? 'CONNECTOME (P1)' : 'AUTO-CONNECTOME (P1)'}</h2>
            <div className="space-y-1 text-xs">
              <p><span className="text-slate-500">Your Core   :</span> <span className="text-cyan-200">{playerInfo.pillName}</span></p>
              <p><span className="text-slate-500">Integrity   :</span> <span className="text-emerald-400">{(playerInfo.integrity * 100).toFixed(1)}%</span></p>
              <p><span className="text-slate-500">Dissonance  :</span> <span className="text-orange-300">{playerInfo.shearStress.toFixed(2)}</span></p>
              <p><span className="text-slate-500">Coupling (K):</span> {playerInfo.KActive.toFixed(1)}</p>
              <div className="my-2 border-t border-slate-800"></div>
              <p><span className="text-slate-500">Freq Output :</span> <span className="text-cyan-300">{playerInfo.freqVal.toFixed(2)}</span></p>
              <p><span className="text-slate-500">Spat Output :</span> <span className="text-cyan-300">{playerInfo.spatialVal.toFixed(2)}</span></p>
              <p><span className="text-slate-500">Domain Pulse:</span> <span className="text-purple-400">{(playerInfo.domainCharge * 100).toFixed(1)}%</span></p>
            </div>
            {mode === 'PvsB' && (
              <div className="mt-4 pt-2 border-t border-slate-800 text-[10px] text-slate-500">
                Control: WASD to Move, Q/E to Spin, Z/C/X/V to Coherence (Gamepad: Bumpers & Face Buttons)
              </div>
            )}
          </div>
        )}

        {/* ПАНЕЛЬ ТОНКОЙ КАЛИБРОВКИ НЕЙРОФИДБЕКА / СЛАЙДЕРЫ */}
        <div className="absolute bottom-16 left-4 bg-slate-950/90 border border-slate-800 p-4 w-80 text-xs space-y-3 z-30 max-h-[350px] overflow-y-auto backdrop-blur-md">
           <h3 className="text-cyan-400 font-bold uppercase tracking-wider border-b border-slate-800 pb-1">BCI / Calibration Panel</h3>
           
           <label className="block text-slate-400">Wave Speed (Hbar): {settings.hbar.toFixed(0)}
              <input type="range" min="10" max="300" step="5" value={settings.hbar} onChange={e => setSettings({...settings, hbar: parseFloat(e.target.value)})} className="w-full accent-cyan-400 mt-1" />
           </label>

           <label className="block text-slate-400">Decay (Persistence): {settings.decay.toFixed(4)}
              <input type="range" min="0.99" max="1.0" step="0.0001" value={settings.decay} onChange={e => setSettings({...settings, decay: parseFloat(e.target.value)})} className="w-full accent-cyan-400 mt-1" />
           </label>

           <label className="block text-slate-400">Source Area (Radius): {settings.injectionRadius.toFixed(3)}
              <input type="range" min="0.01" max="0.15" step="0.005" value={settings.injectionRadius} onChange={e => setSettings({...settings, injectionRadius: parseFloat(e.target.value)})} className="w-full accent-cyan-400 mt-1" />
           </label>

           <label className="block text-slate-400">Source Power (Amplitude): {settings.injectionIntensity.toFixed(0)}
              <input type="range" min="10" max="300" step="5" value={settings.injectionIntensity} onChange={e => setSettings({...settings, injectionIntensity: parseFloat(e.target.value)})} className="w-full accent-cyan-400 mt-1" />
           </label>

           <label className="block text-slate-400">Cahn-Hilliard Sharpening: {settings.cahnHilliardSharpen.toFixed(1)}
              <input type="range" min="0.0" max="10.0" step="0.5" value={settings.cahnHilliardSharpen} onChange={e => setSettings({...settings, cahnHilliardSharpen: parseFloat(e.target.value)})} className="w-full accent-cyan-400 mt-1" />
           </label>

           <label className="block text-slate-400">Phase Locking Coupling (K): {settings.couplingStrength.toFixed(1)}
              <input type="range" min="5.0" max="100.0" step="1.0" value={settings.couplingStrength} onChange={e => setSettings({...settings, couplingStrength: parseFloat(e.target.value)})} className="w-full accent-cyan-400 mt-1" />
           </label>

           <label className="block text-slate-400">PAC (Theta-Gamma Coupling): {settings.pacStrength.toFixed(1)}
              <input type="range" min="0.0" max="15.0" step="0.5" value={settings.pacStrength} onChange={e => setSettings({...settings, pacStrength: parseFloat(e.target.value)})} className="w-full accent-cyan-400 mt-1" />
           </label>

           <label className="block text-slate-400">Stripe Wave Freq: {settings.stripeFreq.toFixed(0)}
              <input type="range" min="5" max="60" step="1" value={settings.stripeFreq} onChange={e => setSettings({...settings, stripeFreq: parseFloat(e.target.value)})} className="w-full accent-cyan-400 mt-1" />
           </label>

           <label className="block text-slate-400">Stripe Contrast: {settings.stripeContrast.toFixed(1)}
              <input type="range" min="0.5" max="4.0" step="0.1" value={settings.stripeContrast} onChange={e => setSettings({...settings, stripeContrast: parseFloat(e.target.value)})} className="w-full accent-cyan-400 mt-1" />
           </label>

           <label className="block text-slate-400">Softbody Stiffness: {settings.springStiffness.toFixed(0)}
              <input type="range" min="50" max="500" step="10" value={settings.springStiffness} onChange={e => setSettings({...settings, springStiffness: parseFloat(e.target.value)})} className="w-full accent-cyan-400 mt-1" />
           </label>

           <label className="block text-slate-400">Tension Tear Threshold: {settings.tensionTear.toFixed(1)}
              <input type="range" min="1.1" max="5.0" step="0.1" value={settings.tensionTear} onChange={e => setSettings({...settings, tensionTear: parseFloat(e.target.value)})} className="w-full accent-cyan-400 mt-1" />
           </label>
        </div>

        {botInfo && (
          <div className="absolute top-4 right-4 bg-slate-950/85 border border-red-900/50 p-4 w-72 backdrop-blur-sm text-right z-20">
            <h2 className="text-red-400 font-bold mb-3 tracking-wider">ROGUE CULTIVATOR (P2)</h2>
            <div className="space-y-1 text-xs">
              <p><span className="text-red-200">{botInfo.pillName}</span> <span className="text-slate-500">: Rogue Core</span></p>
              <p><span className={botInfo.integrity > 0.4 ? "text-emerald-400" : "text-red-500"}>{(botInfo.integrity * 100).toFixed(1)}%</span> <span className="text-slate-500">: Integrity</span></p>
              <p><span className="text-orange-300">{botInfo.shearStress.toFixed(2)}</span> <span className="text-slate-500">: Dissonance</span></p>
              <p>{botInfo.KActive.toFixed(1)} <span className="text-slate-500">: Coupling (K)</span></p>
              <div className="my-2 border-t border-slate-800"></div>
              <p><span className="text-purple-400">{(botInfo.domainCharge * 100).toFixed(1)}%</span> <span className="text-slate-500">: Domain Pulse</span></p>
            </div>
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 bg-slate-950/90 border-t border-slate-800 p-2 flex justify-between px-6 text-xs text-slate-500 backdrop-blur-sm z-20">
          <span>TIME: {time.toFixed(2)}s</span>
          <span className="text-cyan-500">QUANTUM ALCHEMY REACTOR - PHASE VORTEX ENGINE</span>
        </div>
      </div>
    </div>
  );
}