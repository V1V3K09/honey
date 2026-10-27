// Web Audio API Synthesizer — Zero External Audio Assets Required!
class SoundEffects {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  constructor() {
    // AudioContext will be initialized on first user gesture
  }

  private initContext(): AudioContext | null {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  // Tactile button click / paper pop
  public playPop() {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(780, now + 0.06);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.08);
  }

  // Punchy cake boss hit
  public playHit(critical: boolean = false) {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = critical ? 'triangle' : 'square';
    const startFreq = critical ? 480 : 180;
    const endFreq = critical ? 920 : 60;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.12);

    gain.gain.setValueAtTime(critical ? 0.25 : 0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.14);
  }

  // Celebratory birthday victory fanfare
  public playVictory() {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    const notes = [261.63, 329.63, 392.0, 523.25, 659.25, 783.99]; // C major arpeggio
    const now = ctx.currentTime;

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.09);

      gain.gain.setValueAtTime(0.18, now + idx * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.09);
      osc.stop(now + idx * 0.09 + 0.35);
    });
  }

  // Camera milestone whoosh
  public playWhoosh() {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(280, now + 0.1);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.22);

    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.24);
  }

  // Rocket retro-thruster continuous roar
  public startRocketThruster(): { stop: () => void } {
    if (this.isMuted) return { stop: () => {} };
    const ctx = this.initContext();
    if (!ctx) return { stop: () => {} };

    try {
      const now = ctx.currentTime;

      // 1. Procedural White Noise Buffer for Rocket Combustion
      const sampleRate = ctx.sampleRate;
      const bufferSize = sampleRate * 2;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      noiseSource.loop = true;

      // 2. Resonant Lowpass Filter for Deep Exhaust Roar
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(160, now);
      filter.frequency.exponentialRampToValueAtTime(380, now + 1.2);
      filter.Q.setValueAtTime(2.8, now);

      // 3. Sub-bass engine rumble oscillator (48Hz with pitch jitter)
      const rumbleOsc = ctx.createOscillator();
      rumbleOsc.type = 'sawtooth';
      rumbleOsc.frequency.setValueAtTime(46, now);

      const lfo = ctx.createOscillator();
      lfo.frequency.setValueAtTime(12, now);
      const lfoGain = ctx.createGain();
      lfoGain.gain.setValueAtTime(5, now);
      lfo.connect(rumbleOsc.frequency);

      const rumbleGain = ctx.createGain();
      rumbleGain.gain.setValueAtTime(0.08, now);
      rumbleOsc.connect(rumbleGain);

      // 4. Master thruster volume
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.01, now);
      masterGain.gain.linearRampToValueAtTime(0.22, now + 0.35);

      noiseSource.connect(filter);
      filter.connect(masterGain);
      rumbleGain.connect(masterGain);
      masterGain.connect(ctx.destination);

      noiseSource.start(now);
      rumbleOsc.start(now);
      lfo.start(now);

      return {
        stop: () => {
          try {
            const stopNow = ctx.currentTime;
            masterGain.gain.setValueAtTime(masterGain.gain.value, stopNow);
            masterGain.gain.exponentialRampToValueAtTime(0.0001, stopNow + 0.16);
            setTimeout(() => {
              try {
                noiseSource.stop();
                rumbleOsc.stop();
                lfo.stop();
                noiseSource.disconnect();
                filter.disconnect();
                rumbleOsc.disconnect();
                lfo.disconnect();
                masterGain.disconnect();
              } catch {
                // cleanup safety
              }
            }, 200);
          } catch {
            // cleanup safety
          }
        }
      };
    } catch (e) {
      console.warn('AudioContext thruster initiation error:', e);
      return { stop: () => {} };
    }
  }

  // Rocket touchdown impact thump + pneumatic depressurization hiss
  public playTouchdown() {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      // 1. Heavy physical impact thud
      const impactOsc = ctx.createOscillator();
      const impactGain = ctx.createGain();
      impactOsc.type = 'sine';
      impactOsc.frequency.setValueAtTime(115, now);
      impactOsc.frequency.exponentialRampToValueAtTime(26, now + 0.28);

      impactGain.gain.setValueAtTime(0.32, now);
      impactGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      impactOsc.connect(impactGain);
      impactGain.connect(ctx.destination);
      impactOsc.start(now);
      impactOsc.stop(now + 0.3);

      // 2. High-pressure steam / thruster cutoff hiss (psssshh)
      const bufferSize = Math.floor(ctx.sampleRate * 0.45);
      const hissBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = hissBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const hissSource = ctx.createBufferSource();
      hissSource.buffer = hissBuffer;

      const hissFilter = ctx.createBiquadFilter();
      hissFilter.type = 'bandpass';
      hissFilter.frequency.setValueAtTime(2800, now);
      hissFilter.frequency.exponentialRampToValueAtTime(700, now + 0.4);
      hissFilter.Q.setValueAtTime(1.8, now);

      const hissGain = ctx.createGain();
      hissGain.gain.setValueAtTime(0.24, now);
      hissGain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);

      hissSource.connect(hissFilter);
      hissFilter.connect(hissGain);
      hissGain.connect(ctx.destination);

      hissSource.start(now);
      hissSource.stop(now + 0.45);
    } catch (e) {
      console.warn('AudioContext touchdown error:', e);
    }
  }
}

export const sfx = new SoundEffects();
