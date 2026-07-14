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

* **Navier-Stokes Fluid Dynamics**: Real-time advection, diffusion, and pressure projection determine how elements flow, swirl, and transfer kinetic energy across the grid.
* **Complex Wave Propagation**: Emitted attacks represent Schrödinger-like wave packet distributions. The interference patterns are visualized through real-time phase calculations on the GPU (via WebGL2 Compute Shaders) or a multithreaded CPU fallback.
* **Kuramoto Phase Coupling**: The 16 physical nodes of each cultivator synchronize their internal oscillation phases. Stronger phase-locking (coupling constant $K$) improves structural stabilization, shielding the cultivator from ambient phase noise.
* **Internal Energy Immunity**: Cultivators are naturally immune to the wave-clash of their own emitted elements. Disruption forces are scaled strictly by the local presence of opposing team fluid densities, making positioning and elemental territory control highly tactical.

---

## 🎮 System Features

### 🌌 Alchemical Cauldron (Campaign Hub)
A non-linear campaign progression divided into distinct **Realms** defined by the complexity of their alchemical systems:
* **Realm I (3 Primordial Elements)**: Standard RGB channels. Designed for initial calibration and manual/low-tier AI tests.
* **Realm II (5 Convergent Phases)**: Wu Xing elemental matrix. Introduces complex pentagonal phase interrelationships.
* **Realm III (7 Astral Elements)**: Full spectrum high-density simulation.
*Players can replay unlocked stages to harvest Alchemical Essence andpermanently smelt stats (Yang Power, Soft-Body Stiffness, or Kuramoto Resonance).*

### 📊 Real-Time AI Diagnostics & Telemetry
The gameplay HUD displays real-time telemetry of each entity's alchemical status:
* **Integrity (Health)**: Calculated dynamically via the Kuramoto order parameter of the active nodes.
* **Dissonance & Shear Stress**: Measures local phase friction and deformation forces.
* **AI Thought Logs**: Displays real-time decision-making metrics for each bot (current target, distance, navigation vector, and chosen elemental style).
* **Top Advantage Bar**: Displays the real-time balance of power on the arena.

### 📈 Post-Match Analytics Dashboard
Upon match completion, a comprehensive analytics panel shows:
* **Battle Outcome**: Detailed summary of Victory or Defeat.
* **Damage Dealt**: Cumulative kinetic disruption force projected onto opposing structures.
* **Damage Ratio**: Visual team distribution bar.
* **MVP Tracking**: Automatically calculates and crowns the most statistically impactful entity.

### 🎛️ Sandbox & Debugging Playground
A fully persistent debugger screen where you can:
* Configure arbitrary matchups (1v1, 3v3, 5v5).
* Adjust the number of active elements (3, 5, or 7) and grid resolution.
* Manually assign AI star ratings (from 0★ manual control up to 5★ automated mastery).
* Connect BLE/UART EEG neurofeedback devices or gamepads.
* Retain all sliders, custom vectors, and configuration states between match iterations.

---

## 🧠 BCI / Neurofeedback Integration

For manual piloting (0-Star mode), Phase Vortex Arena includes an ultra-low latency, zero-delay topological neurofeedback pipeline:
* **Topological ciPLV (Corrected Imaginary Phase Locking Value)**: Raw EEG inputs from 16 high-density electrodes (such as the FreeEEG16-alpha2) are processed on-chip via ESP32-S3 and translated directly to 3 control axes (movement vector and torque) without artificial smoothing.
* **Visual biofeedback**: Centering the camera directly on the player's physical avatar (`CENTERED` camera mode) allows users to instinctively learn how cognitive focus, SMR, and alpha/beta band shifts alter the cultivator's physics in real time.

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
