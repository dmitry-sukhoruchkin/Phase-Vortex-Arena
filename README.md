# 🌊 Phase Vortex Arena – Fractal MOBA Prototype

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![React](https://img.shields.io/badge/React-19-blue)](https://reactjs.org/)
[![WebGL](https://img.shields.io/badge/WebGL-2.0-green)](https://get.webgl.org/)

**Phase Vortex Arena** is a real‑time strategy / MOBA prototype powered by **wave physics** and **fractal interference**. Instead of traditional health bars and damage numbers, everything is driven by complex‑valued fluid dynamics – your attacks are waves, defence is wave absorption, and the battlefield itself is a living interference pattern.

> **Core idea:** no other game uses wave interference as the primary combat mechanic. This is the first attempt to bring **fractal combat** to the MOBA genre, designed for gamepad and touch controls.

---

## 🎮 Gameplay Overview

- **Two teams** (player vs bot, or bot vs bot) compete on a closed arena.
- Each cultivator (hero) is defined by a **Pill** – a 3‑element vector (Yang, Catalyst, Yin) that determines their attack wave shape, defence properties, and passive behaviour.
- **Combat** is all about wave superposition:
  - Fire a **wave packet** (complex amplitude with phase) towards the enemy.
  - When two waves meet, they **interfere** – constructively (extra damage), destructively (damage reduction), or fractally (area‑of‑effect chaos).
  - The visual output is a real‑time **interference pattern** that changes with every move.
- **Physical soft‑body** – each cultivator is a 16‑node spring‑mass system, reacting to fluid forces, collision, and internal tension. Nodes can snap or heal, giving a visceral feel to combat.
- **Deep customisation** – adjust wave speed, damping, source intensity, phase‑locking, and spring stiffness via in‑game sliders.

---

## 🧪 Current State (Alpha)

This repository contains the **web‑based prototype** (React + TypeScript + WebGL2). It currently supports:

- ✅ **Single‑match arena** (PvB or BvB)
- ✅ **Full physics simulation** (CPU fallback + GPU acceleration via WebGL2)
- ✅ **Real‑time wave rendering** with interference patterns
- ✅ **Gamepad and keyboard controls** (WASD, arrows, Q/E for spin, Z/C/X/V for coherence)
- ✅ **9 calibration sliders** for fine‑tuning physics (wave speed, damping, injection radius, sharpening, coupling, etc.)
- ✅ **Spectroscopy HUD** showing integrity, dissonance, coupling (K), and phase radar

❌ **Missing but planned:**
- Labyrinth & Cauldron (smelting) – the full progression loop from the original Python engine
- Multi‑player (local / online)
- Full MOBA map with lanes, jungle, and towers
- Mobile touch controls (currently partially works with gamepad emulation)

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- npm or yarn

### Installation

```bash
git clone https://github.com/neuroidss/phase-vortex-arena.git
cd phase-vortex-arena
npm install
```

### Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

The app automatically uses WebGL2 acceleration if supported; otherwise falls back to a CPU‑based FluidSolver.

---

## 🎛️ Controls

| Action | Keyboard | Gamepad |
|--------|----------|---------|
| Move | WASD / Arrow keys | Left stick |
| Spin (torque) | Q (CCW) / E (CW) | Right stick horizontal |
| Frequency (Freq) | Z / C | Left / Right bumper (LB/RB) |
| Spatial (Shield/Core) | X / V | Face buttons (Y/A or X/B) |
| Menu / Toggle mouse lock | ESC | – |

> **Note:** Gamepad support is auto‑detected. XInput and DirectInput controllers should work.

---

## ⚙️ Calibration Sliders (Physics Tuning)

The bottom‑left panel exposes real‑time tweaks:

- **Wave Speed (hbar)** – propagation speed of wave packets.
- **Decay (persistence)** – how fast waves dissipate.
- **Source Area (radius)** – size of wave injection zone.
- **Source Power (amplitude)** – strength of emitted waves.
- **Cahn‑Hilliard Sharpening** – boundary contrast between phases.
- **Phase‑Locking Coupling (K)** – strength of Kuramoto synchronisation.
- **PAC (Theta‑Gamma Coupling)** – amplitude modulation of high‑frequency by low‑frequency.
- **Stripe Wave Freq** – base wave frequency.
- **Stripe Contrast** – visual contrast of interference fringes.
- **Soft‑body Stiffness** – spring tension.
- **Tension Tear Threshold** – when springs break.

These allow you to drastically change the feel of combat – from slow, defensive duels to explosive, chaotic clashes.

---

## 🧠 How the Physics Works (Briefly)

- The arena is a 2D grid (e.g., 80×80) where each cell stores complex density for each element (Yang, Catalyst, Yin, etc.).
- **Navier‑Stokes** advection and pressure projection handle fluid motion.
- **Wave equation** (Schrödinger‑like) propagates the complex fields; the real part is rendered as colour.
- **Kuramoto coupling** synchronises node phases, influencing integrity.
- **Cahn‑Hilliard** phase separation keeps elements from mixing completely, preserving sharp fractals.

The entire simulation runs on the CPU by default, but WebGL2 compute shaders (via `GPUFluidSolver`) are being developed to achieve 60 fps even on mobile devices.

---

## 🗺️ Future Plans (Roadmap)

1. **Labyrinth & Cauldron** – the full single‑player campaign where you collect essences and craft your own Pill.
2. **Multi‑player** – local split‑screen and online (via WebRTC or WebSocket) PvP.
3. **Full MOBA Map** – three lanes, jungle camps, towers, and base.
4. **Mobile UI** – touch controls and responsive layout.
5. **More Elements** – expand from 3 to 5 or 7 fundamental phases (e.g., Wood, Fire, Earth, Metal, Water) with complex interactions.
6. **Procedural Waveforms** – generate unique Pill behaviours each match for infinite variety.

---

## 🤝 Contributing

We welcome contributions! Please read the [AGENTS.md](AGENTS.md) file for guidelines on code style, neurofeedback (if ever added), and file‑output rules.

- Fork the repo and create a feature branch.
- Open a pull request with a clear description of changes.
- Ensure all tests pass (`npm run lint`).

---

## 📄 License

This project is licensed under the **GNU Affero General Public License v3** – see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgements

- Inspired by the original Python `phase_vortex_labyrinth` engine.
- Built with [React](https://reactjs.org/), [Vite](https://vitejs.dev/), and [Tailwind CSS](https://tailwindcss.com/).
- Physics based on Jos Stam’s stable fluids and the Kuramoto model.

---

## 📬 Contact

For questions or suggestions, please open an issue on GitHub.

**Play the prototype now** – just clone and run!

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%neuroidss%2Fphase-vortex-arena)

