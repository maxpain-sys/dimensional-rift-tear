
export class AudioEngine {
  constructor() {
    this.ok = false;
    this.muted = false;
  }

  init() {
    if (this.ok) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.8;
      this.master.connect(this.ctx.destination);

      const len = 2 * this.ctx.sampleRate;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;

      // low reality-rumble hum
      this.humGain = this.ctx.createGain();
      this.humGain.gain.value = 0;
      this.humLP = this.ctx.createBiquadFilter();
      this.humLP.type = 'lowpass';
      this.humLP.frequency.value = 160;
      const o1 = this.ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 48;
      const o2 = this.ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = 48.7;
      o1.connect(this.humLP); o2.connect(this.humLP);
      this.humLP.connect(this.humGain); this.humGain.connect(this.master);
      o1.start(); o2.start();

      // airy noise bed
      this.nz = this.ctx.createBufferSource();
      this.nz.buffer = buf; this.nz.loop = true;
      this.bp = this.ctx.createBiquadFilter();
      this.bp.type = 'bandpass'; this.bp.Q.value = 0.8; this.bp.frequency.value = 600;
      this.nzGain = this.ctx.createGain();
      this.nzGain.gain.value = 0;
      this.nz.connect(this.bp); this.bp.connect(this.nzGain); this.nzGain.connect(this.master);
      this.nz.start();

      this.ok = true;
    } catch (e) {
      console.warn('audio unavailable:', e);
    }
  }

  setTear(open, energy) {
    if (!this.ok) return;
    const t = this.ctx.currentTime;
    this.humGain.gain.setTargetAtTime(open * 0.12, t, 0.08);
    this.humLP.frequency.setTargetAtTime(110 + open * 220, t, 0.1);
    this.nzGain.gain.setTargetAtTime(open * 0.05 + energy * 0.12, t, 0.06);
    this.bp.frequency.setTargetAtTime(350 + energy * 2400, t, 0.05);
  }

  burst(dur, f0, f1, gain) {
    if (!this.ok || this.muted) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.Q.value = 1;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + dur + 0.05);
  }

  rip(e) {
    this.burst(0.28, 300 + e * 400, 2600 + e * 1500, 0.5);
  }

  snap() {
    this.burst(0.16, 1800, 250, 0.55);
    if (!this.ok || this.muted) return;
    try {
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(38, t + 0.18);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.5, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + 0.25);
    } catch (e) { /* best effort */ }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.ok) this.master.gain.value = this.muted ? 0 : 0.8;
    return this.muted;
  }
}
