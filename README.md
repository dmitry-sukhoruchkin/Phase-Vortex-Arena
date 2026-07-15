# 🌊 Phase Vortex Arena

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![React](https://img.shields.io/badge/React-19-blue)](https://reactjs.org/)
[![WebGL](https://img.shields.io/badge/WebGL-2.0-green)](https://get.webgl.org/)

**Phase Vortex Arena** is a real-time, physics-driven alchemical auto-battler prototype. Rather than utilizing abstract numerical statistics, traditional health bars, or hitboxes, the entire combat loop and progression are resolved through non-linear fluid dynamics, multi-elemental wave interference, and soft-body spring-mass systems.

This project is built as a highly customizable, data-driven debugger and playground, optimized for both autonomous multi-agent simulation (AI vs. AI) and real-time brain-computer interface (BCI/EEG) topological neurofeedback control.

**Live Demo:** 
- [https://neuroidss.github.io/Phase-Vortex-Arena/](https://neuroidss.github.io/Phase-Vortex-Arena/)

---

## 🔬 Core Gameplay & Vision

In Phase Vortex Arena, players act as **Alchemical Managers**. Instead of directly controlling micro-movements, you synthesize, upgrade, and deploy cultivators defined by their **Pill spectral vectors** (Yang, Catalyst, Yin). The physical engine then autonomously resolves the battle.

### The Alchemical Auto-Battler Loop:
1. **Pill Smelting & Progression**: Customize your cultivator's spectral parameters. Your elemental layout determines how the soft-body reacts to fluid velocities, generates wave packets, and parries opposing forces.
2. **Autonomous Battle Resolution**: Cultivators are deployed onto a closed arena. High-tier AI drivers (ranging from 1★ to 5★ star tiers) calculate attack trajectories, target selection, and optimal wave emissions in real time.
3. **Wave Superposition & Interference**: Attacks propagate through a real-time Navier-Stokes grid as complex-valued wave fields. When friendly and hostile waves meet, they interfere.
   * *Constructive/Destructive Interference*: Opposing phases can amplify damage or damp each other out.
   * *Resonant Solitons*: Ideal alchemical configurations generate highly coherent standing waves that sweep enemies across the field.
4. **Hydrodynamic Damage & Tear**: Cultivators are simulated as 16-node soft-body spring-mass rings. When hit by opposing fluid velocities or clashing wave gradients, they suffer strain. If the strain exceeds the tension threshold, springs snap, causing loss of structural integrity until collapse.

---

## 🛠️ Mathematical & Physical Architecture

The game simulation merges three distinct physical paradigms:

*   **Navier-Stokes Fluid Dynamics**: Real-time advection, diffusion, and pressure projection determine how elements flow, swirl, and transfer kinetic energy across the grid. The GPGPU solver executes a 40-step Jacobi Poisson pressure projection matching the exact mathematical coordinates and boundaries of the high-fidelity CPU engine.
*   **Complex Wave Propagation**: Emitted attacks represent Schrödinger-like wave packet distributions. The interference patterns are visualized through real-time phase calculations on the GPU (via WebGL2 Compute Shaders) or a multithreaded CPU fallback.
*   **Kuramoto Phase Coupling**: The 16 physical nodes of each cultivator synchronize their internal oscillation phases. Stronger phase-locking (coupling constant $K$) improves structural stabilization, shielding the cultivator from ambient phase noise.
*   **Internal Energy Immunity**: Cultivators are naturally immune to the wave-clash of their own emitted elements. Disruption forces are scaled strictly by the local presence of opposing team fluid densities, making positioning and elemental territory control highly tactical.

---

## 🌀 Non-Linear Spectral Rendering (Wave Interference Fringes)

To prevent elements from blending into a homogeneous, flat, white visual soup when densities overlap, the rendering engine (both WebGL2 on GPU and 2D Context on CPU fallbacks) implements non-linear wave visualization:

*   **Inigo Quilez Cosine Colormap**: Maps multi-spectral alchemical channels onto a highly saturated procedural color spectrum:
    $$\text{Color}(t) = 0.5 + 0.5 \cdot \cos(2\pi \cdot (t + [0.0, 0.33, 0.67]))$$
*   **Oscillating Wave Interference Fringes**: The total wave energy of overlapping elements is passed through a sinusoidal modulation wave:
    $$\text{Fringes} = 0.4 + 0.6 \cdot |\sin(\text{WaveSum} \cdot 12.0)|$$
*   **Gamma Compression**: Color values are enhanced via power compression ($C^{0.6}$), elevating faint background currents while breaking up high-density areas into highly structured, detailed, concentric "fractal-like" contour bands instead of solid white.

---

## ⚔️ Sun Tzu-Style Strategic Parity & Elemental Rock-Paper-Scissors

A core goal of Phase Vortex Arena is to ensure that equal-skill matchups (e.g., 5★ AI vs 5★ AI) are resolved deterministically through alchemical squad building and pill smelting. Battles are decided before they even begin ("as taught by Sun Tzu") by exploiting the elemental Rock-Paper-Scissors (RPS) mechanics built directly into the physical equations of motion:

### 🧬 The Primordial RPS Cycle
The three primary components of any cultivator's spectral vector govern their defensive resilience and offensive advantages:
*   **Yang (Fire / Red / Index 0)**: Out-powers and incinerates **Yin (Water / Blue / Index 2)**. Aggressive Yang forces project high-frequency kinetic shockwaves that boil away Yin's protective structures.
*   **Yin (Water / Blue / Index 2)**: Dissipates, parries, and slows **SMR Catalyst (Qi / Earth / Green / Index 1)**. Yin's high-viscosity fluid absorption traps the green catalyst, dampening its physical acceleration and restoring broken springs.
*   **SMR Catalyst (Qi / Earth / Green / Index 1)**: Traps, wraps, and overruns **Yang (Fire / Red / Index 0)**. Catalyst profiles absorb Yang's thermal convection to grow non-Newtonian polymer lattices, catching fast attackers in sticky, high-drag webs.

### 🧮 Mathematical Resolution of Build Dominance
When equal-tier cultivators clash, the physical damage calculations scale directly with their structural alignment:
*   **RPS Advantage Multiplier**: When a cultivator possesses an elemental advantage over an opponent's core profile, the incoming disruption forces are scaled down to $0.70\times$ (30% damage reduction), and its outgoing forces are amplified.
*   **RPS Disadvantage Multiplier**: Conversely, facing an elemental disadvantage scales up incoming damage to $1.45\times$ (45% damage increase).
*   **Tactical Predictability**: If two 5★ automated entities of equal level face each other, the win probability is no longer a 50/50 coin toss. A properly calibrated counter-build (e.g., a pure Yin parry core against a pure Yang charger) will statistically defeat its target with highly predictable, reproducible outcome metrics, rewarding strategic managerial planning.

---

## 🎮 System Features

### 🌌 Alchemical Workshop & Cauldron Hub
A non-linear campaign progression divided into distinct **Realms** defined by the complexity of their alchemical systems:
*   **Realm I (3 Primordial Elements)**: Standard RGB channels. Designed for initial calibration and manual/low-tier AI tests.
*   **Realm II (5 Convergent Phases)**: Wu Xing elemental matrix. Introduces complex pentagonal phase interrelationships.
*   **Realm III (7 Astral Elements)**: Full spectrum high-density simulation.
*   **Persistent Squad Management**: Unlock, deploy, and configure up to 4 autonomic alchemical companions.
*   **Pill Smelting Cauldron**: Use continuous sliders to calibrate the Yang, Catalyst, and Yin unit-vector configurations of individual teammates in real-time, procedurally morphing their visual colors.
*   **Targeted Upgrades**: Spend Alchemical Essence harvested from victories to upgrade individual teammate stats (Yang Power, Stiffness, or Kuramoto Resonance) and autonomic intelligence (Stars 1★ to 5★).

### 📊 Real-Time AI Diagnostics & Telemetry
The gameplay HUD displays real-time telemetry of each entity's alchemical status:
*   **Integrity (Health)**: Calculated dynamically via the Kuramoto order parameter of the active nodes.
*   **Dissonance & Shear Stress**: Measures local phase friction and deformation forces.
*   **AI Thought Logs**: Displays real-time decision-making metrics for each bot (current target, distance, navigation vector, and chosen elemental style).
*   **Top Advantage Bar**: Displays the real-time balance of power on the arena.

### 📈 Post-Match Analytics Dashboard
Upon match completion, a comprehensive analytics panel shows:
*   **Battle Outcome**: Detailed summary of Victory or Defeat.
*   **Damage Dealt**: Cumulative kinetic disruption force projected onto opposing structures.
*   **Damage Ratio**: Visual team distribution bar.
*   **MVP Tracking**: Automatically calculates and crowns the most statistically impactful entity.

### 🎛️ Sandbox & Debugging Playground
A fully persistent debugger screen where you can:
*   Configure arbitrary matchups (1v1, 3v3, 5v5).
*   Adjust the number of active elements (3, 5, or 7) and grid resolution.
*   Manually assign AI star ratings (from 0★ manual control up to 5★ automated mastery).
*   Connect BLE/UART EEG neurofeedback devices or gamepads.
*   Retain all sliders, custom vectors, and configuration states between match iterations.

---

## 🧠 BCI / Neurofeedback Integration

For manual piloting (0-Star mode), Phase Vortex Arena includes an ultra-low latency, zero-delay topological neurofeedback pipeline:
*   **Topological ciPLV (Corrected Imaginary Phase Locking Value)**: Raw EEG inputs from 16 high-density electrodes (such as the FreeEEG16-alpha2) are processed on-chip via ESP32-S3 and translated directly to 3 control axes (movement vector and torque) without artificial smoothing.
*   **Visual biofeedback**: Centering the camera directly on the player's physical avatar (`CENTERED` camera mode) allows users to instinctively learn how cognitive focus, SMR, and alpha/beta band shifts alter the cultivator's physics in real time.

---

## 🚀 Getting Started

### Installation
```bash
git clone https://github.com/neuroidss/phase-vortex-arena.git
cd phase-vortex-arena
npm install
```

### Run Local Development Server
```bash
npm run dev
```
The application will launch on `http://localhost:3000`. By default, it uses GPU acceleration if WebGL2 is supported; otherwise, it seamlessly falls back to the CPU fluid solver.
