// src/App.tsx
import React, { useEffect, useRef, useState } from 'react';
import { PhaseVortexArena, Cultivator } from './lib/physics/Arena';
import { WebGLFluidRenderer } from './lib/WebGLRenderer';
import { CONFIG, SEMANTIC_PILLS_DB } from './lib/config';
import { TouchControls } from './lib/TouchControls';
import { neuroService } from './lib/NeuroService';
import { multiplayerService } from './lib/MultiplayerService';
import { audioEngine } from './lib/AudioEngine';
import { CampaignManager } from './lib/campaign';

import { CampaignHub, Teammate } from './components/CampaignHub';
import { SandboxMenu } from './components/SandboxMenu';
import { PostMatchHUD, CultivatorStats } from './components/PostMatchHUD';
import { ArenaHUD } from './components/ArenaHUD';

export default function App() {
  const [gameState, setGameState] = useState<'MENU' | 'SANDBOX_MENU' | 'ARENA' | 'CAMPAIGN_HUB' | 'POST_MATCH'>('MENU');
  
  // --- STATE: PERSISTENT SANDBOX SETTINGS ---
  const [sandboxConfig, setSandboxConfig] = useState({
     p1Pill: "Pure Yang Core",
     p2Pill: "Deep Yin Core",
     mode: "PvsB" as "PvsB" | "BvsB" | "PvsP",
     teamSize: 1,
     numElements: 3,
     gridRes: 80,
     gpuEnabled: true,
     p1CustomVec: [0.577, 0.577, 0.577] as [number, number, number],
     p2CustomVec: [0.577, 0.577, 0.577] as [number, number, number],
     p1Stars: 0,
     p2Stars: 3
  });

  // --- STATE: PERSISTENT TEAMMATES & ALLIES ---
  const [teammates, setTeammates] = useState<Teammate[]>([
    { 
       id: 'player', 
       name: "The Grand Ascendant (You)", 
       stars: 0, 
       vector: [0.577, 0.577, 0.577], 
       color: [255, 200, 255], 
       power: 0, 
       defense: 0, 
       focus: 0, 
       isActive: true, 
       isUnlocked: true, 
       essenceCostToUnlock: 0 
    },
    { 
       id: 'companion_1', 
       name: "Yin Disciple", 
       stars: 1, 
       vector: [0.0, 0.447, 0.894], 
       color: [0, 150, 255], 
       power: 0, 
       defense: 0, 
       focus: 0, 
       isActive: true, 
       isUnlocked: false, 
       essenceCostToUnlock: 150 
    },
    { 
       id: 'companion_2', 
       name: "Yang Berserker", 
       stars: 2, 
       vector: [0.894, 0.447, 0.0], 
       color: [255, 100, 0], 
       power: 0, 
       defense: 0, 
       focus: 0, 
       isActive: false, 
       isUnlocked: false, 
       essenceCostToUnlock: 300 
    },
    { 
       id: 'companion_3', 
       name: "SMR Catalyst", 
       stars: 3, 
       vector: [0.0, 0.894, 0.447], 
       color: [0, 255, 50], 
       power: 0, 
       defense: 0, 
       focus: 0, 
       isActive: false, 
       isUnlocked: false, 
       essenceCostToUnlock: 450 
    },
    { 
       id: 'companion_4', 
       name: "Vortex Sage", 
       stars: 4, 
       vector: [0.577, 0.577, 0.577], 
       color: [200, 0, 255], 
       power: 0, 
       defense: 0, 
       focus: 0, 
       isActive: false, 
       isUnlocked: false, 
       essenceCostToUnlock: 600 
    }
  ]);

  // --- STATE: CAMPAIGN PROGRESSION ---
  const [campaignIndex, setCampaignIndex] = useState<number>(-1);
  const [maxRealmReached, setMaxRealmReached] = useState<number>(-1); 
  const [essence, setEssence] = useState<number>(0);
  const [campaignGpu, setCampaignGpu] = useState<boolean>(true);
  const [realmWon, setRealmWon] = useState<boolean>(false);

  // --- ARENA VARIABLES ---
  const [arena, setArena] = useState<PhaseVortexArena | null>(null);
  const [mode, setMode] = useState<"PvsB" | "BvsB" | "PvsP">("PvsB");
  const [numElements, setNumElements] = useState<number>(3);
  const [gridRes, setGridRes] = useState<number>(80);
  const [useWebGL, setUseWebGL] = useState<boolean>(true);
  
  const [cameraMode, setCameraMode] = useState<'CENTERED' | 'FIXED'>('CENTERED');

  const DEFAULT_SETTINGS = {
     hbar: 120.0, decay: 0.9992, injectionRadius: 0.05, injectionIntensity: 150.0,
     cahnHilliardSharpen: 4.0, couplingStrength: 25.0, pacStrength: 6.5,
     stripeFreq: 22.0, stripeContrast: 1.5, springStiffness: 200.0, tensionTear: 2.0,
     timeScale: 0.20
  };
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  const [matchResult, setMatchResult] = useState<'VICTORY' | 'DEFEAT' | null>(null);
  const [endMatchStats, setEndMatchStats] = useState<CultivatorStats[]>([]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const webglCanvasRef = useRef<HTMLCanvasElement>(null);
  const webglRendererRef = useRef<WebGLFluidRenderer | null>(null);
  const [playerInfo, setPlayerInfo] = useState<Cultivator | null>(null);
  const [botInfo, setBotInfo] = useState<Cultivator | null>(null);
  const [time, setTime] = useState(0);
  const [fps, setFps] = useState(0);
  const [touchMove, setTouchMove] = useState({ dx: 0, dy: 0 });
  const touchKeys = useRef<{ [key: string]: boolean }>({});
  
  const [myId, setMyId] = useState('');
  const [peerId, setPeerId] = useState('');
  const [p2pConnected, setP2pConnected] = useState(false);
  const peerInputRef = useRef<{ vx: number, vy: number, tq: number, freq: number, spatial: number } | null>(null);

  const keys = useRef<{ [key: string]: boolean }>({});

  useEffect(() => {
    webglRendererRef.current = null;
  }, [gridRes, numElements, useWebGL, gameState]);

  useEffect(() => {
    const id = Math.random().toString(36).substring(7);
    setMyId(id);
    multiplayerService.init(id);
    multiplayerService.onPlayerJoined = () => setP2pConnected(true);
    multiplayerService.onStateUpdate = (id, data) => { peerInputRef.current = data; };
    neuroService.onData = (data) => {
      touchKeys.current['c'] = data.attention > 0.6;
      touchKeys.current['z'] = data.meditation > 0.6;
    };

    const handleKeyDown = (e: KeyboardEvent) => (keys.current[e.key] = true);
    const handleKeyDownHandled = (e: KeyboardEvent) => (keys.current[e.key] = true);
    const handleKeyUp = (e: KeyboardEvent) => (keys.current[e.key] = false);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // --- ENGINE RUN: CAMPAIGN LOADER WITH DYNAMIC PLAYER SQUAD ---
  const loadCampaignRealm = (index: number) => {
    const realm = CampaignManager.getRealm(index);
    if (!realm) {
      setGameState('CAMPAIGN_HUB');
      setCampaignIndex(-1);
      return;
    }
    
    setCampaignIndex(index);
    setRealmWon(false);

    // Symmetrically resolve safe fallback arrays for teammates list
    const safeTeammates = teammates && teammates.length > 0 ? teammates : [
      { 
         id: 'player', 
         name: "The Grand Ascendant (You)", 
         stars: 0, 
         vector: [0.577, 0.577, 0.577] as [number, number, number], 
         color: [255, 200, 255] as [number, number, number], 
         power: 0, 
         defense: 0, 
         focus: 0, 
         isActive: true, 
         isUnlocked: true, 
         essenceCostToUnlock: 0 
      }
    ];

    // Assemble Player's custom squad up to the level's allowed teamSize safely
    const activeAllies = safeTeammates.filter(t => t && t.isActive && t.id !== 'player');
    const deployedTeammates: Teammate[] = [safeTeammates[0]]; 

    for (let i = 0; i < realm.teamSize - 1; i++) {
      if (i < activeAllies.length) {
         deployedTeammates.push(activeAllies[i]);
      } else {
         const unlockedAllies = safeTeammates.filter(t => t && t.isUnlocked && t.id !== 'player' && !deployedTeammates.includes(t));
         if (unlockedAllies.length > 0) {
            deployedTeammates.push(unlockedAllies[0]);
         } else {
            // Dummy alchemical fallback teammate to pad the squad array safely
            deployedTeammates.push({
               id: `dummy_${i}`,
               name: `Alchemical Proxy ${i + 1}`,
               stars: 1,
               vector: [0.577, 0.577, 0.577],
               color: [255, 255, 255],
               power: 0,
               defense: 0,
               focus: 0,
               isActive: false,
               isUnlocked: true,
               essenceCostToUnlock: 0
            });
         }
      }
    }

    const playerParams = deployedTeammates.map((t, idx) => {
       const safeT = t || {
          name: "Alchemical Proxy",
          vector: [0.577, 0.577, 0.577] as [number, number, number],
          color: [255, 255, 255] as [number, number, number],
          stars: 1,
          power: 0,
          defense: 0,
          focus: 0
       };
       return {
          name: safeT.name || "Alchemical Proxy",
          vector: safeT.vector || [0.577, 0.577, 0.577],
          color: safeT.color || [255, 255, 255],
          stars: idx === 0 ? realm.playerStars : (safeT.stars || 1), 
          isPlayer: idx === 0 && realm.playerStars === 0,
          powerLvl: safeT.power || 0,
          defenseLvl: safeT.defense || 0,
          focusLvl: safeT.focus || 0
       };
    });

    // Assemble Hardcoded Enemy Team for the level with safe element properties
    const enemyConfig = SEMANTIC_PILLS_DB[realm.enemyPill] || SEMANTIC_PILLS_DB["Foundation Pill"];
    const enemyParams = Array(realm.teamSize).fill(null).map((_, idx) => ({
       name: `${realm.enemyPill} Core ${idx + 1}`,
       vector: enemyConfig.vector || [0.577, 0.577, 0.577],
       color: enemyConfig.color || [255, 200, 255],
       stars: realm.enemyStars,
       isPlayer: false,
       powerLvl: idx, 
       defenseLvl: idx,
       focusLvl: idx
    }));

    const playMode = realm.playerStars > 0 ? 'BvsB' : 'PvsB';
    setCameraMode(realm.playerStars > 0 ? 'FIXED' : 'CENTERED');
    setSettings(DEFAULT_SETTINGS); 

    const newArena = new PhaseVortexArena(
       playerParams,
       enemyParams,
       80,
       realm.numElements,
       campaignGpu
    );
    
    setArena(newArena);
    setMode(playMode);
    setGridRes(80);
    setNumElements(realm.numElements);
    setUseWebGL(campaignGpu);
    setGameState('ARENA');
    audioEngine.start();
  };

  // --- ENGINE RUN: SANDBOX LOADER ---
  const startSandboxMatch = () => {
    const buildPillConfig = (pillName: string, customVec: [number, number, number]): PillConfig => {
       if (pillName === 'Custom') {
           const norm = Math.max(1e-8, Math.hypot(customVec[0], Math.hypot(customVec[1], customVec[2])));
           return {
              name: "Custom Pill",
              vector: [customVec[0]/norm, customVec[1]/norm, customVec[2]/norm],
              color: [Math.round(customVec[0]/norm*255), Math.round(customVec[1]/norm*255), Math.round(customVec[2]/norm*255)],
              desc: "Custom Element Mix"
           };
       }
       return SEMANTIC_PILLS_DB[pillName];
    };

    setCampaignIndex(-1);
    const p1Conf = buildPillConfig(sandboxConfig.p1Pill, sandboxConfig.p1CustomVec);
    const p2Conf = buildPillConfig(sandboxConfig.p2Pill, sandboxConfig.p2CustomVec);

    const playerParams = Array(sandboxConfig.teamSize).fill(null).map((_, i) => ({
       name: i === 0 ? "Player (You)" : `Ally ${i}`,
       vector: p1Conf.vector || [0.577, 0.577, 0.577],
       color: p1Conf.color || [255, 255, 255],
       stars: i === 0 ? sandboxConfig.p1Stars : 3,
       isPlayer: (sandboxConfig.mode === 'PvsB' || sandboxConfig.mode === 'PvsP') && i === 0,
       powerLvl: 0,
       defenseLvl: 0,
       focusLvl: 0
    }));

    const enemyParams = Array(sandboxConfig.teamSize).fill(null).map((_, i) => ({
       name: `Adversary ${i + 1}`,
       vector: p2Conf.vector || [0.577, 0.577, 0.577],
       color: p2Conf.color || [255, 255, 255],
       stars: sandboxConfig.p2Stars,
       isPlayer: false,
       powerLvl: 0,
       defenseLvl: 0,
       focusLvl: 0
    }));

    setCameraMode(sandboxConfig.p1Stars > 0 ? 'FIXED' : 'CENTERED');

    const newArena = new PhaseVortexArena(
       playerParams,
       enemyParams,
       sandboxConfig.gridRes,
       sandboxConfig.numElements,
       sandboxConfig.gpuEnabled
    );
    
    setArena(newArena);
    setMode(sandboxConfig.mode);
    setGridRes(sandboxConfig.gridRes);
    setNumElements(sandboxConfig.numElements);
    setUseWebGL(sandboxConfig.gpuEnabled);
    setGameState('ARENA');
    audioEngine.start();
  };

  // --- MAIN RENDER LOOP ---
  useEffect(() => {
    if (gameState !== 'ARENA' || !arena) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (useWebGL && !webglRendererRef.current && webglCanvasRef.current) {
      try {
        webglRendererRef.current = new WebGLFluidRenderer(webglCanvasRef.current, gridRes, numElements);
      } catch (e) {
        console.error("Failed to initialize WebGLFluidRenderer:", e);
      }
    }

    let lastTime = performance.now();
    let animationId: number;
    let frames = 0;
    let fpsStart = performance.now();
    let isMatchOver = false;

    const render = () => {
      if (isMatchOver) return;
      const now = performance.now();
      
      const dt = Math.min((now - lastTime) / 1000.0, 0.032);
      const simDt = dt * settings.timeScale;
      lastTime = now;
      
      frames++;
      if (now - fpsStart >= 1000) {
         setFps(frames);
         frames = 0;
         fpsStart = now;
      }

      // Input Collection
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
      
      vx += touchMove.dx;
      vy += touchMove.dy;
      if (touchKeys.current['c']) freq += 1;
      if (touchKeys.current['z']) freq -= 1;
      
      if (mode === 'PvsP' && p2pConnected) {
         multiplayerService.broadcast({ vx, vy, tq, freq, spatial });
      }

      const mag = Math.hypot(vx, vy);
      if (mag > 1.0) { vx /= mag; vy /= mag; }
      tq = Math.max(-1.0, Math.min(1.0, tq));
      freq = Math.max(-1.0, Math.min(1.0, freq));
      spatial = Math.max(-1.0, Math.min(1.0, spatial));

      if (arena.cultivators[0] && arena.cultivators[0].isPlayer && arena.cultivators[0].stars === 0) {
          arena.cultivators[0].vx = vx;
          arena.cultivators[0].vy = vy;
          arena.cultivators[0].tq = tq;
          arena.cultivators[0].freqVal = freq;
          arena.cultivators[0].spatialVal = spatial;
      }

      if (mode === 'PvsP' && arena.cultivators[1]) {
          const peerInput = peerInputRef.current;
          if (peerInput) {
             arena.cultivators[1].vx = peerInput.vx;
             arena.cultivators[1].vy = peerInput.vy;
             arena.cultivators[1].tq = peerInput.tq;
             arena.cultivators[1].freqVal = peerInput.freq;
             arena.cultivators[1].spatialVal = peerInput.spatial;
          }
          arena.cultivators[1].isPlayer = true; 
      }
      
      arena.step(simDt, settings);
      
      if (Math.floor(now / 100) !== Math.floor((now - dt * 1000) / 100)) {
        const p1 = arena.cultivators[0];
        const p2 = arena.cultivators.find(c => c.team === 1) || arena.cultivators[1];
        setPlayerInfo(p1 ? { ...p1 } : null);
        setBotInfo(p2 ? { ...p2 } : null);
        setTime(arena.time);
        if (p1) audioEngine.update(p1.vx, p1.shearStress, p1.KActive);

        const team0Alive = arena.cultivators.some(c => c.team === 0 && !c.isDead);
        const team1Alive = arena.cultivators.some(c => c.team === 1 && !c.isDead);

        if (!team0Alive || !team1Alive || (campaignIndex === 0 && arena.time > 12.0)) {
           isMatchOver = true;
           
           const stats: CultivatorStats[] = arena.cultivators.map(c => ({
              id: c.id,
              name: c.pillName + (c.isPlayer ? " (You)" : ""),
              team: c.team,
              damageDealt: c.damageDealt,
              integrity: c.integrity,
              isPlayer: c.isPlayer
           }));
           setEndMatchStats(stats);

           let won = team0Alive && !team1Alive;
           if (campaignIndex === 0) won = true; 

           setMatchResult(won ? 'VICTORY' : 'DEFEAT');
           setGameState('POST_MATCH');
           return;
        }
      }

      if (useWebGL && webglRendererRef.current && arena.cultivators[0]) {
         const p0 = arena.cultivators[0];
         const pxNorm = cameraMode === 'CENTERED' ? p0.pos.x / 800.0 : 0.5;
         const pyNorm = cameraMode === 'CENTERED' ? p0.pos.y / 800.0 : 0.5;
         const angle = cameraMode === 'CENTERED' ? p0.angle : 0.0;
         const zoom = cameraMode === 'CENTERED' ? 1.35 : 1.0;
         webglRendererRef.current.render(arena.fluid.density, arena.time, [pxNorm, pyNorm], angle, zoom, settings);
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      if (!useWebGL && arena.cultivators[0]) {
          const id = ctx.createImageData(gridRes, gridRes);
          const data = id.data;
          const tf = arena.time * 12.0;

          for (let i = 0; i < arena.fluid.size; i++) {
             const x = i % gridRes;
             const y = Math.floor(i / gridRes);
             
             if (x === 0 || x === gridRes - 1 || y === 0 || y === gridRes - 1) {
                data[i * 4] = 12; data[i * 4 + 1] = 12; data[i * 4 + 2] = 12; data[i * 4 + 3] = 255;
                continue;
             }

             let accumR = 0;
             let accumG = 0;
             let accumB = 0;

             for (let ch = 0; ch < numElements; ch++) {
                const re = arena.fluid.density[ch * 2][i];
                const im = arena.fluid.density[ch * 2 + 1][i];
                const wave = re * Math.cos(tf * (1.0 - ch * 0.12)) - im * Math.sin(tf * (1.0 - ch * 0.12));
                const w = Math.max(0.0, Math.min(1.0, Math.abs(wave) * settings.stripeContrast));
                
                // Symmetrical Inigo Quilez procedural cosine colormap mapped to CPU renderer
                const t = ch / numElements;
                const col_r = 0.5 + 0.5 * Math.cos(2 * Math.PI * (t + 0.0));
                const col_g = 0.5 + 0.5 * Math.cos(2 * Math.PI * (t + 0.33));
                const col_b = 0.5 + 0.5 * Math.cos(2 * Math.PI * (t + 0.67));

                accumR += col_r * w;
                accumG += col_g * w;
                accumB += col_b * w;
             }

             // Apply non-linear wave interference fringes (sine-wave contours) on CPU
             const waveSum = Math.hypot(accumR, Math.hypot(accumG, accumB));
             const fringes = 0.4 + 0.6 * Math.abs(Math.sin(waveSum * 12.0));

             // Apply Gamma compression (pow 0.6) and fringes modulation
             let finalR = Math.pow(accumR, 0.6) * fringes;
             let finalG = Math.pow(accumG, 0.6) * fringes;
             let finalB = Math.pow(accumB, 0.6) * fringes;

             // Symmetrically blend back to base background (12, 12, 12) at zero alchemical energy
             const blendCoeff = Math.max(0.0, Math.min(1.0, waveSum * 5.0));
             data[i * 4]     = Math.round(12 * (1.0 - blendCoeff) + Math.max(0, Math.min(255, finalR * 255)) * blendCoeff);
             data[i * 4 + 1] = Math.round(12 * (1.0 - blendCoeff) + Math.max(0, Math.min(255, finalG * 255)) * blendCoeff);
             data[i * 4 + 2] = Math.round(12 * (1.0 - blendCoeff) + Math.max(0, Math.min(255, finalB * 255)) * blendCoeff);
             data[i * 4 + 3] = 255;
          }
          const offscreen = document.createElement('canvas');
          offscreen.width = gridRes;
          offscreen.height = gridRes;
          offscreen.getContext('2d')!.putImageData(id, 0, 0);

          ctx.save();
          ctx.translate(canvas.width / 2, canvas.height / 2);
          ctx.rotate(cameraMode === 'CENTERED' ? -arena.cultivators[0].angle : 0.0);
          const zoom = cameraMode === 'CENTERED' ? 1.35 : 1.0;
          ctx.scale(1.0 / zoom, 1.0 / zoom);
          
          const px = cameraMode === 'CENTERED' ? (arena.cultivators[0].pos.x / 800.0) * canvas.width : 400;
          const py = cameraMode === 'CENTERED' ? (arena.cultivators[0].pos.y / 800.0) * canvas.height : 400;
          ctx.translate(-px, -py);

          ctx.imageSmoothingEnabled = true;
          ctx.drawImage(offscreen, 0, 0, canvas.width, canvas.height);
          ctx.restore();
      }

      const p0 = arena.cultivators[0];
      if (p0) {
        const theta = cameraMode === 'CENTERED' ? -p0.angle : 0.0;
        const cos_t = Math.cos(theta);
        const sin_t = Math.sin(theta);
        const camX = cameraMode === 'CENTERED' ? p0.pos.x : 400;
        const camY = cameraMode === 'CENTERED' ? p0.pos.y : 400;
        const zoomFactor = cameraMode === 'CENTERED' ? 1.35 : 1.0;

        const getScreenCoords = (wx: number, wy: number) => {
            const dx = wx - camX;
            const dy = wy - camY;
            return {
               x: canvas.width / 2.0 + (dx * cos_t - dy * sin_t) / zoomFactor,
               y: canvas.height / 2.0 + (dx * sin_t + dy * cos_t) / zoomFactor
            };
        };

        for (const c of arena.cultivators) {
          if (c.isDead) continue;

          for (let i = 0; i < c.nodes.length; i++) {
            const node = c.nodes[i];
            const next = c.nodes[(i + 1) % c.nodes.length];
            const sNode = getScreenCoords(node.x, node.y);
            const sNext = getScreenCoords(next.x, next.y);

            ctx.beginPath();
            ctx.moveTo(sNode.x, sNode.y);
            ctx.lineTo(sNext.x, sNext.y);
            ctx.lineWidth = node.intact ? 2 : 1;
            ctx.strokeStyle = node.intact ? `rgba(255, 255, 255, 0.45)` : `rgba(255, 0, 0, 0.45)`;
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
      }

      animationId = requestAnimationFrame(render);
    };

    render();
    return () => { isMatchOver = true; cancelAnimationFrame(animationId); };
  }, [gameState, arena, useWebGL, gridRes, numElements, settings, campaignIndex, cameraMode]);

  // --- RENDERING SCREENS ---

  if (gameState === 'MENU') {
    return (
      <div className="min-h-screen bg-[#0a0c12] text-slate-300 font-mono flex items-center justify-center p-8 z-50 relative">
         <div className="bg-slate-950/80 border border-cyan-900/50 p-8 shadow-2xl max-w-2xl w-full text-center">
            <h1 className="text-4xl text-cyan-400 font-bold mb-8 tracking-widest border-b border-slate-800 pb-4">
              PHASE VORTEX ARENA
            </h1>
            <p className="mb-8 text-slate-400">Tactical Alchemical Wave Simulator</p>
            <div className="space-y-4">
               <button className="w-full py-4 bg-indigo-900/50 border border-indigo-500 text-white font-bold hover:bg-indigo-700 cursor-pointer text-sm" onClick={() => setGameState('CAMPAIGN_HUB')}>
                  ALCHEMICAL CAMPAIGN
               </button>
               <button className="w-full py-4 bg-cyan-900/30 border border-cyan-800 text-cyan-200 font-bold hover:bg-cyan-800/50 cursor-pointer text-sm" onClick={() => setGameState('SANDBOX_MENU')}>
                  SANDBOX / DEBUGGER
               </button>
            </div>
         </div>
      </div>
    );
  }

  if (gameState === 'SANDBOX_MENU') {
    return <SandboxMenu 
              config={sandboxConfig}
              setConfig={setSandboxConfig}
              myId={myId}
              peerId={peerId}
              setPeerId={setPeerId}
              p2pConnected={p2pConnected}
              onStartMatch={startSandboxMatch}
              onBack={() => setGameState('MENU')}
           />;
  }

  if (gameState === 'CAMPAIGN_HUB') {
    return (
       <CampaignHub 
          teammates={teammates}
          setTeammates={setTeammates}
          maxRealmReached={maxRealmReached}
          essence={essence}
          setEssence={setEssence}
          campaignGpu={campaignGpu}
          setCampaignGpu={setCampaignGpu}
          onEnterRealm={loadCampaignRealm}
          onBack={() => setGameState('MENU')}
       />
    );
  }

  if (gameState === 'POST_MATCH') {
    return (
       <PostMatchHUD 
          stats={endMatchStats}
          matchResult={matchResult}
          earnedEssence={campaignIndex >= 0 ? CampaignManager.getRealm(campaignIndex)?.reward || 50 : 0}
          isCampaign={campaignIndex >= 0}
          onContinue={() => {
             if (campaignIndex >= 0) {
                const currentRealm = CampaignManager.getRealm(campaignIndex);
                const isVictory = matchResult === 'VICTORY';
                
                if (isVictory) {
                   setEssence(e => e + (currentRealm?.reward || 50));
                   if (campaignIndex > maxRealmReached) {
                      setMaxRealmReached(campaignIndex); 
                   }
                }
                setGameState('CAMPAIGN_HUB');
             } else {
                setGameState('SANDBOX_MENU'); 
             }
          }}
       />
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0c12] text-slate-300 font-mono flex flex-col items-center justify-center relative overflow-hidden">
      <div className="relative w-full max-w-[800px] h-[800px] shadow-2xl border border-slate-800 flex justify-center">
        <canvas ref={webglCanvasRef} width={CONFIG.WIDTH} height={CONFIG.HEIGHT} className="absolute inset-0 bg-black pointer-events-auto" style={{ display: useWebGL ? 'block' : 'none' }} />
        <canvas ref={canvasRef} width={CONFIG.WIDTH} height={CONFIG.HEIGHT} className="relative z-10 pointer-events-none" style={{ background: 'transparent' }} />
        
        <ArenaHUD 
          playerInfo={playerInfo}
          botInfo={botInfo}
          mode={mode}
          time={time}
          fps={fps}
          engineText={`ENGINE: ${arena?.fluid.gpuActive ? 'WebGL2 GPGPU' : 'CPU'} (${gridRes}x${gridRes})`}
          settings={settings}
          setSettings={setSettings}
          cameraMode={cameraMode}
          setCameraMode={setCameraMode}
          onAbort={() => setGameState(campaignIndex >= 0 ? 'CAMPAIGN_HUB' : 'SANDBOX_MENU')}
        />

        {(!arena?.cultivators[0] || arena.cultivators[0].stars === 0) && (
           <TouchControls 
             onMove={(dx, dy) => setTouchMove({dx, dy})} 
             onAction={(action, active) => { touchKeys.current[action] = active; }} 
           />
        )}
      </div>
    </div>
  );
}