// Spatialized Web Audio API procedural synthesizer (no external audio files)
class SoundEngine {
  private ctx: AudioContext | null = null;
  private humOsc: OscillatorNode | null = null;
  private humGain: GainNode | null = null;
  private humFilter: BiquadFilterNode | null = null;
  private muted = false;
  private lastRattle = 0;

  private ensureContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  public unlock(): void {
    const ctx = this.ensureContext();
    if (!ctx || this.humOsc) return;

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 54;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 135;

    const gain = ctx.createGain();
    gain.gain.value = 0;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start();

    this.humOsc = osc;
    this.humFilter = filter;
    this.humGain = gain;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.humGain && this.ctx) {
      this.humGain.gain.setTargetAtTime(
        muted ? 0 : 0.022,
        this.ctx.currentTime,
        0.1
      );
    }
  }

  public updateAmbientHum(activeMachines: number, speed: number): void {
    if (!this.ctx || !this.humGain || !this.humFilter) return;
    const targetGain =
      this.muted || speed === 0
        ? 0
        : Math.min(0.04, 0.005 + activeMachines * 0.001);
    this.humGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.25);
    this.humFilter.frequency.setTargetAtTime(
      110 + Math.min(180, activeMachines * 4),
      this.ctx.currentTime,
      0.25
    );
  }

  private computeSpatial(
    worldX: number,
    worldZ: number,
    listenerX: number,
    listenerZ: number
  ) {
    const dx = worldX - listenerX;
    const dz = worldZ - listenerZ;
    const dist = Math.hypot(dx, dz);
    const pan = Math.max(-1, Math.min(1, dx / 22));
    const atten = Math.max(0.05, 1 - dist / 45);
    return { pan, atten };
  }

  public playPlace(
    worldX: number,
    worldZ: number,
    listenerX: number,
    listenerZ: number
  ): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const { pan, atten } = this.computeSpatial(
      worldX,
      worldZ,
      listenerX,
      listenerZ
    );

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(72, ctx.currentTime + 0.09);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.14 * atten, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);

    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;

    osc.connect(gain);
    gain.connect(panner);
    panner.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.11);
  }

  public playBeltRattle(
    worldX: number,
    worldZ: number,
    listenerX: number,
    listenerZ: number
  ): void {
    const now = performance.now();
    if (now - this.lastRattle < 420) return;
    this.lastRattle = now;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const { pan, atten } = this.computeSpatial(
      worldX,
      worldZ,
      listenerX,
      listenerZ
    );

    const bufferSize = Math.floor(ctx.sampleRate * 0.045);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 620;

    const gain = ctx.createGain();
    gain.gain.value = 0.04 * atten;

    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(panner);
    panner.connect(ctx.destination);
    noise.start();
  }

  public playBreakdownAlarm(
    worldX: number,
    worldZ: number,
    listenerX: number,
    listenerZ: number
  ): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const { pan, atten } = this.computeSpatial(
      worldX,
      worldZ,
      listenerX,
      listenerZ
    );

    [0, 0.14].forEach((delay, idx) => {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = idx === 0 ? 740 : 560;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.08 * atten, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        ctx.currentTime + delay + 0.11
      );

      const panner = ctx.createStereoPanner();
      panner.pan.value = pan;

      osc.connect(gain);
      gain.connect(panner);
      panner.connect(ctx.destination);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.12);
    });
  }

  public playChime(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.07, ctx.currentTime + i * 0.07);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        ctx.currentTime + i * 0.07 + 0.28
      );
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.07);
      osc.stop(ctx.currentTime + i * 0.07 + 0.3);
    });
  }
}

export const soundEngine = new SoundEngine();
