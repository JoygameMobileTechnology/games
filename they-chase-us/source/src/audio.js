// All sound is procedural WebAudio. No audio files.
export class GameAudio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.master = null;
    this.noise = null;
    this.drawOsc = null; this.drawGain = null;
    this.lastHit = 0; this.hitCount = 0;
    this.heartTimer = 0;
  }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -12; comp.ratio.value = 6; comp.knee.value = 10;
      this.master = this.ctx.createGain();
      this.master.gain.value = this.enabled ? 0.55 : 0;
      this.master.connect(comp); comp.connect(this.ctx.destination);
      // white noise buffer, 1 s
      const len = this.ctx.sampleRate;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noise = buf;
    } catch (e) { this.ctx = null; }
  }

  setEnabled(v) {
    this.enabled = v;
    if (this.master) this.master.gain.setTargetAtTime(v ? 0.55 : 0, this.ctx.currentTime, 0.02);
  }

  get t() { return this.ctx ? this.ctx.currentTime : 0; }
  ok() { return !!this.ctx && this.enabled; }

  // ---- primitives ----
  tone({ type = 'sine', f0 = 440, f1 = f0, dur = 0.1, vol = 0.3, attack = 0.005, decay = dur, delay = 0, detune = 0 }) {
    if (!this.ok()) return;
    const c = this.ctx, t0 = c.currentTime + delay;
    const o = c.createOscillator(); const g = c.createGain();
    o.type = type; o.detune.value = detune;
    o.frequency.setValueAtTime(f0, t0);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + attack + decay + 0.02);
  }

  burst({ dur = 0.1, vol = 0.3, hp = 200, lp = 8000, delay = 0, q = 0.7 }) {
    if (!this.ok()) return;
    const c = this.ctx, t0 = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = this.noise; s.loop = true;
    const fH = c.createBiquadFilter(); fH.type = 'highpass'; fH.frequency.value = hp; fH.Q.value = q;
    const fL = c.createBiquadFilter(); fL.type = 'lowpass'; fL.frequency.value = lp; fL.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(fH); fH.connect(fL); fL.connect(g); g.connect(this.master);
    s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.02);
  }

  // ---- game sounds ----
  // Bow draw: a quiet low hum (two sines a few Hz apart give a slow, gentle vibration) that creeps up as the string tightens.
  startDraw() {
    if (!this.ok()) return;
    this.stopDraw();
    const c = this.ctx;
    const o1 = c.createOscillator(); o1.type = 'sine'; o1.frequency.value = 72;
    const o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.value = 74.5;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260; lp.Q.value = 0.4;
    const g = c.createGain(); g.gain.value = 0.0001; g.gain.setTargetAtTime(0.03, c.currentTime, 0.15);
    o1.connect(lp); o2.connect(lp); lp.connect(g); g.connect(this.master); o1.start(); o2.start();
    this.drawOsc = o1; this.drawOsc2 = o2; this.drawGain = g; this.drawLp = lp;
  }
  updateDraw(p) { // p 0..1: 72 -> 104 Hz, filter opens a little
    if (!this.drawOsc) return;
    const t = this.ctx.currentTime;
    this.drawOsc.frequency.setTargetAtTime(72 + 32 * p, t, 0.06);
    this.drawOsc2.frequency.setTargetAtTime(74.5 + 33 * p, t, 0.06);
    this.drawLp.frequency.setTargetAtTime(260 + 160 * p, t, 0.06);
  }
  stopDraw() {
    if (!this.drawOsc) return;
    const c = this.ctx, g = this.drawGain;
    g.gain.setTargetAtTime(0.0001, c.currentTime, 0.03);
    this.drawOsc.stop(c.currentTime + 0.15); this.drawOsc2.stop(c.currentTime + 0.15);
    this.drawOsc = null; this.drawOsc2 = null; this.drawGain = null; this.drawLp = null;
  }
  release(count = 1) {
    this.stopDraw();
    this.burst({ dur: 0.12, vol: 0.25, hp: 1200, lp: 6000 });
    this.tone({ type: 'sine', f0: 900, f1: 300, dur: 0.08, vol: 0.12 });
    if (count > 1) this.burst({ dur: 0.15, vol: 0.12, hp: 800, lp: 4000, delay: 0.03 });
  }
  hit() {
    const now = performance.now();
    if (now - this.lastHit < 40) return; // throttle
    this.lastHit = now;
    this.tone({ type: 'square', f0: 220, f1: 80, dur: 0.07, vol: 0.12 });
    this.burst({ dur: 0.05, vol: 0.15, hp: 300, lp: 3000 });
  }
  crit() {
    this.tone({ type: 'sine', f0: 1200, f1: 1800, dur: 0.1, vol: 0.18 });
    this.tone({ type: 'square', f0: 300, f1: 90, dur: 0.1, vol: 0.12 });
  }
  clank() {
    this.tone({ type: 'square', f0: 2400, f1: 1800, dur: 0.06, vol: 0.06 });
    this.tone({ type: 'triangle', f0: 3100, f1: 2500, dur: 0.12, vol: 0.05, delay: 0.01 });
    this.burst({ dur: 0.08, vol: 0.12, hp: 2500, lp: 9000 });
  }
  freeze() { this.tone({ type: 'sine', f0: 1800, f1: 2600, dur: 0.18, vol: 0.1 }); this.tone({ type: 'sine', f0: 2400, f1: 3400, dur: 0.16, vol: 0.06, delay: 0.04 }); }
  burn() { this.burst({ dur: 0.25, vol: 0.12, hp: 600, lp: 2500 }); }
  lightning() { this.burst({ dur: 0.08, vol: 0.2, hp: 3000, lp: 12000 }); this.tone({ type: 'sawtooth', f0: 1500, f1: 200, dur: 0.1, vol: 0.1 }); }
  levelUp() {
    const n = [523, 659, 784, 1046];
    n.forEach((f, i) => this.tone({ type: 'triangle', f0: f, dur: 0.25, vol: 0.14, delay: i * 0.07 }));
  }
  cardPick() { this.tone({ type: 'triangle', f0: 660, f1: 990, dur: 0.15, vol: 0.14 }); this.burst({ dur: 0.1, vol: 0.06, hp: 2000, lp: 8000 }); }
  coin(i = 0) { this.tone({ type: 'sine', f0: 1500, f1: 2200, dur: 0.09, vol: 0.08, delay: i * 0.04 }); }
  impact() {
    this.tone({ type: 'sine', f0: 120, f1: 40, dur: 0.25, vol: 0.35 });
    this.burst({ dur: 0.2, vol: 0.25, hp: 100, lp: 1500 });
  }
  hurt() { this.tone({ type: 'sawtooth', f0: 300, f1: 120, dur: 0.15, vol: 0.12 }); }
  roar() {
    this.tone({ type: 'sawtooth', f0: 90, f1: 55, dur: 0.9, vol: 0.3 });
    this.tone({ type: 'square', f0: 130, f1: 70, dur: 0.8, vol: 0.12, delay: 0.05 });
    this.burst({ dur: 0.7, vol: 0.2, hp: 80, lp: 900 });
  }
  heartbeat() { this.tone({ type: 'sine', f0: 70, f1: 45, dur: 0.12, vol: 0.3 }); this.tone({ type: 'sine', f0: 65, f1: 40, dur: 0.12, vol: 0.22, delay: 0.18 }); }
  gateDrop() { this.tone({ type: 'sine', f0: 150, f1: 50, dur: 0.5, vol: 0.35 }); this.burst({ dur: 0.4, vol: 0.3, hp: 100, lp: 1200 }); this.clank(); }
  arch() { this.tone({ type: 'triangle', f0: 880, f1: 1320, dur: 0.18, vol: 0.14 }); }
  death() { this.tone({ type: 'sawtooth', f0: 200, f1: 40, dur: 0.8, vol: 0.2 }); this.burst({ dur: 0.5, vol: 0.15, hp: 100, lp: 800 }); }
  victory() { [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone({ type: 'triangle', f0: f, dur: 0.5, vol: 0.14, delay: i * 0.12 })); }
  spear() { this.burst({ dur: 0.2, vol: 0.14, hp: 900, lp: 5000 }); }
  ui() { this.tone({ type: 'sine', f0: 700, f1: 900, dur: 0.06, vol: 0.08 }); }
  shieldBlock() { this.tone({ type: 'sine', f0: 500, f1: 900, dur: 0.15, vol: 0.14 }); this.clank(); }
  execute() { this.tone({ type: 'square', f0: 160, f1: 60, dur: 0.12, vol: 0.15 }); this.burst({ dur: 0.08, vol: 0.14, hp: 500, lp: 4000 }); }
}
