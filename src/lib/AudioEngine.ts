import * as Tone from 'tone';

export class AudioEngine {
  synth: Tone.PolySynth;
  filter: Tone.Filter;
  reverb: Tone.Reverb;
  isStarted = false;
  droneSynth: Tone.Synth;
  lfo: Tone.LFO;

  constructor() {
    this.filter = new Tone.Filter(800, 'lowpass').toDestination();
    this.reverb = new Tone.Reverb(3).connect(this.filter);
    this.synth = new Tone.PolySynth(Tone.Synth).connect(this.reverb);
    this.synth.set({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.1, decay: 0.2, sustain: 0.5, release: 1 }
    });

    this.droneSynth = new Tone.Synth({
      oscillator: { type: 'fmsine', modulationType: 'sawtooth' },
      envelope: { attack: 1, decay: 0, sustain: 1, release: 2 }
    }).connect(this.filter);
    this.droneSynth.volume.value = -12; // lower volume for drone

    this.lfo = new Tone.LFO(0.5, 200, 800).connect(this.filter.frequency);
  }

  async start() {
    if (this.isStarted) return;
    await Tone.start();
    this.droneSynth.triggerAttack("C2");
    this.lfo.start();
    this.isStarted = true;
  }

  update(playerSpeed: number, dissonance: number, coherence: number) {
    if (!this.isStarted) return;
    
    // playerSpeed -> filter cutoff or drone pitch
    this.droneSynth.frequency.rampTo(65.41 + Math.abs(playerSpeed) * 5, 0.1); 
    
    // dissonance -> modulation index / distortion
    this.synth.set({
       oscillator: { type: dissonance > 0.5 ? 'sawtooth' : 'sine' }
    });

    // coherence -> LFO speed
    this.lfo.frequency.rampTo(0.1 + coherence * 5, 0.1);
  }

  triggerPulse(intensity: number) {
    if (!this.isStarted) return;
    const notes = ["C3", "E3", "G3", "B3"];
    const note = notes[Math.floor(Math.random() * notes.length)];
    this.synth.triggerAttackRelease(note, "8n", undefined, intensity);
  }
}

export const audioEngine = new AudioEngine();
