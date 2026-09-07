/* SlitherDrop — game module: Three.js rendering, input, HUD, audio. */
(function () {
  'use strict';
  const THREE = window.THREE;
  const Core = window.SDCore;
  const LEVELS = window.SDLevels.LEVELS;
  const TIERS = window.SDLevels.TIERS;

  // ------------------------------------------------------------------ palette & styles
  const COLORS = {
    R: 0xef3e4a, B: 0x3daaf0, G: 0x63c63f, Y: 0xf9c932, P: 0x9a5ce6, O: 0xf7912e,
  };
  const rgbOf = hex => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
  const mixRgb = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const css = (c, a) => a === undefined ? 'rgb(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ')' : 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a + ')';
  const WHITE = [255, 255, 255], BLACK = [0, 0, 0];
  const STYLE = {};
  for (const k in COLORS) {
    const base = rgbOf(COLORS[k]);
    STYLE[k] = {
      base, light: mixRgb(base, WHITE, 0.42), dark: mixRgb(base, BLACK, 0.3), outline: mixRgb(base, BLACK, 0.48),
      pip: mixRgb(base, WHITE, 0.2), pipDark: mixRgb(base, BLACK, 0.4), hex: COLORS[k],
    };
  }
  const PIT = { base: [28, 30, 42], top: [12, 13, 20], bottom: [58, 62, 82] };

  // ------------------------------------------------------------------ board metrics
  const PAD = 0.14;        // slate margin around the cells
  const RIM = 0.36;        // light frame width
  const SLAB_H = 0.55;     // board thickness
  const SLATE_Y = -0.05;   // slate surface (recessed below the frame top at y=0)
  const DECAL_Y = SLATE_Y + 0.006;
  const CAM_TILT = 0.50;   // radians from vertical, toward the player
  const CAM_FOV = 34;
  const BURST_DUR = 0.55;
  const SWALLOW_DUR = 0.42;

  // ------------------------------------------------------------------ DOM
  const $ = id => document.getElementById(id);
  const app = $('app'), canvas = $('gl');
  const ui = {
    hud: $('hud'), levelPill: $('level-pill'), levelTitle: $('level-title'), levelTier: $('level-tier'),
    timerPill: $('timer-pill'), timerText: $('timer-text'), hint: $('hint'), toast: $('toast'), hand: $('hand'),
    ovLevels: $('ov-levels'), ovWin: $('ov-win'), ovLose: $('ov-lose'), levelGrid: $('level-grid'), winSub: $('win-sub'),
    rotate: $('rotate'), btnSound: $('btn-sound'), btnFull: $('btn-full'),
  };

  // ------------------------------------------------------------------ persistence
  const store = {
    load() { try { return JSON.parse(localStorage.getItem('sd_progress') || '{}'); } catch (e) { return {}; } },
    save(p) { try { localStorage.setItem('sd_progress', JSON.stringify(p)); } catch (e) { /* ignore */ } },
  };
  const progress = Object.assign({ done: {}, last: 0, muted: false }, store.load());

  // ------------------------------------------------------------------ audio (synthesized)
  const Sfx = {
    ctx: null, master: null,
    ensure() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = progress.muted ? 0 : 0.8;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    },
    setMuted(m) { progress.muted = m; store.save(progress); if (this.master) this.master.gain.value = m ? 0 : 0.8; },
    tone(o) {
      if (!this.ctx) return;
      const c = this.ctx, t0 = c.currentTime + (o.delay || 0);
      const osc = c.createOscillator(), g = c.createGain();
      osc.type = o.type || 'sine';
      osc.frequency.setValueAtTime(o.f0, t0);
      if (o.f1) osc.frequency.exponentialRampToValueAtTime(o.f1, t0 + o.dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(o.vol || 0.3, t0 + (o.attack || 0.006));
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
      osc.connect(g).connect(this.master);
      osc.start(t0); osc.stop(t0 + o.dur + 0.02);
    },
    noise(o) {
      if (!this.ctx) return;
      const c = this.ctx, t0 = c.currentTime + (o.delay || 0);
      const len = Math.floor(c.sampleRate * o.dur), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = c.createBufferSource(); src.buffer = buf;
      const filt = c.createBiquadFilter(); filt.type = o.filter || 'bandpass'; filt.Q.value = o.q || 0.8;
      filt.frequency.setValueAtTime(o.f0 || 1200, t0);
      if (o.f1) filt.frequency.exponentialRampToValueAtTime(o.f1, t0 + o.dur);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(o.vol || 0.2, t0 + (o.attack || 0.01));
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
      src.connect(filt).connect(g).connect(this.master);
      src.start(t0); src.stop(t0 + o.dur + 0.02);
    },
    grab() { this.tone({ f0: 380, f1: 520, dur: 0.07, vol: 0.12, type: 'triangle' }); },
    pop() {
      this.tone({ f0: 480, f1: 980, dur: 0.11, vol: 0.28, type: 'sine' });
      this.noise({ f0: 2400, f1: 900, dur: 0.07, vol: 0.1 });
    },
    swallow() { this.tone({ f0: 330, f1: 95, dur: 0.26, vol: 0.22, type: 'triangle', delay: 0.05 }); },
    burst() {
      this.noise({ f0: 2600, f1: 380, dur: 0.38, vol: 0.22, q: 0.6 });
      this.tone({ f0: 784, dur: 0.45, vol: 0.18, type: 'sine', delay: 0.12 });
      this.tone({ f0: 1175, dur: 0.55, vol: 0.16, type: 'sine', delay: 0.2 });
      this.tone({ f0: 1568, dur: 0.6, vol: 0.1, type: 'sine', delay: 0.26 });
    },
    click() { this.noise({ f0: 700, f1: 300, dur: 0.05, vol: 0.12, filter: 'lowpass', q: 1 }); },
    tick() { this.tone({ f0: 1300, dur: 0.045, vol: 0.09, type: 'square' }); },
    timeUp() {
      this.tone({ f0: 420, f1: 200, dur: 0.5, vol: 0.2, type: 'sawtooth' });
      this.tone({ f0: 300, f1: 140, dur: 0.6, vol: 0.16, type: 'sawtooth', delay: 0.25 });
    },
    win() {
      const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
      notes.forEach((f, i) => this.tone({ f0: f, dur: 0.38, vol: 0.2, type: 'triangle', delay: i * 0.11 }));
      [1046.5, 1318.5, 1568].forEach(f => this.tone({ f0: f, dur: 0.9, vol: 0.12, type: 'sine', delay: 0.62 }));
      this.noise({ f0: 3000, f1: 800, dur: 0.5, vol: 0.08, delay: 0.55 });
    },
  };

  // ------------------------------------------------------------------ renderer / scene
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(CAM_FOV, 1, 0.5, 100);
  scene.add(camera);

  // r155+ uses physical light units: intensities are ~PI times the legacy values.
  const hemi = new THREE.HemisphereLight(0xffffff, 0x8f9bb6, 1.7);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff5e8, 2.0);
  sun.position.set(-4.5, 11, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.025;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 40;
  scene.add(sun);
  scene.add(sun.target);
  const fill = new THREE.DirectionalLight(0xcfe0ff, 0.4);
  fill.position.set(5, 6, -6);
  scene.add(fill);

  const board = new THREE.Group();
  scene.add(board);
  const fxGroup = new THREE.Group();
  scene.add(fxGroup);

  // ------------------------------------------------------------------ helpers
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOutBack = t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
  const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
  const easeInCubic = t => t * t * t;

  function roundedRectPath(target, w, h, r) {
    const x = -w / 2, y = -h / 2;
    target.moveTo(x + r, y);
    target.lineTo(x + w - r, y);
    target.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
    target.lineTo(x + w, y + h - r);
    target.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
    target.lineTo(x + r, y + h);
    target.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
    target.lineTo(x, y + r);
    target.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
    return target;
  }

  function disposeGroup(g) {
    g.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
      }
    });
    while (g.children.length) g.remove(g.children[0]);
  }

  // ------------------------------------------------------------------ slate texture
  function makeSlateTexture(cols, rows) {
    const px = 128;
    const w = Math.round((cols + 2 * PAD) * px), h = Math.round((rows + 2 * PAD) * px);
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#8f9db4';
    ctx.fillRect(0, 0, w, h);
    // soft per-cell texture: faint lighter squares with a hint of vignette
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x = (PAD + c) * px, y = (PAD + r) * px;
      const g = ctx.createLinearGradient(x, y, x + px, y + px);
      g.addColorStop(0, 'rgba(255,255,255,0.045)');
      g.addColorStop(1, 'rgba(20,30,60,0.05)');
      ctx.fillStyle = g;
      ctx.fillRect(x, y, px, px);
    }
    // fine noise
    for (let i = 0; i < w * h / 90; i++) {
      ctx.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(20,30,60,0.05)';
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    // grid lines (lighter than the cells, like the reference)
    ctx.strokeStyle = '#a7b3c8';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    for (let c = 0; c <= cols; c++) {
      const x = (PAD + c) * px;
      ctx.beginPath(); ctx.moveTo(x, PAD * px); ctx.lineTo(x, h - PAD * px); ctx.stroke();
    }
    for (let r = 0; r <= rows; r++) {
      const y = (PAD + r) * px;
      ctx.beginPath(); ctx.moveTo(PAD * px, y); ctx.lineTo(w - PAD * px, y); ctx.stroke();
    }
    // inner shadow under the frame edge
    const sh = 0.32 * px;
    const grads = [
      [0, 0, 0, sh, [0, 0, w, sh]], [0, h, 0, h - sh, [0, h - sh, w, sh]],
      [0, 0, sh, 0, [0, 0, sh, h]], [w, 0, w - sh, 0, [w - sh, 0, sh, h]],
    ];
    for (const [x0, y0, x1, y1, rect] of grads) {
      const g = ctx.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, 'rgba(25,35,70,0.28)');
      g.addColorStop(1, 'rgba(25,35,70,0)');
      ctx.fillStyle = g;
      ctx.fillRect(rect[0], rect[1], rect[2], rect[3]);
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return tex;
  }

  function makeShadowTexture(aspect) {
    const w = 512, h = Math.round(512 * aspect);
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d');
    const m = 70;
    ctx.filter = 'blur(26px)';
    ctx.fillStyle = 'rgba(25,32,70,0.62)';
    ctx.beginPath();
    const r = 40, x = m, y = m, rw = w - 2 * m, rh = h - 2 * m;
    ctx.moveTo(x + r, y); ctx.arcTo(x + rw, y, x + rw, y + rh, r); ctx.arcTo(x + rw, y + rh, x, y + rh, r);
    ctx.arcTo(x, y + rh, x, y, r); ctx.arcTo(x, y, x + rw, y, r); ctx.closePath();
    ctx.fill();
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  // ------------------------------------------------------------------ hole decal layer (canvas -> texture)
  class HoleLayer {
    constructor(cols, rows, px, order) {
      this.px = px;
      this.w = Math.round((cols + 2 * PAD) * px);
      this.h = Math.round((rows + 2 * PAD) * px);
      this.canvas = document.createElement('canvas');
      this.canvas.width = this.w; this.canvas.height = this.h;
      this.ctx = this.canvas.getContext('2d');
      this.tex = new THREE.CanvasTexture(this.canvas);
      this.tex.colorSpace = THREE.SRGBColorSpace;
      this.tex.generateMipmaps = false;
      this.tex.minFilter = THREE.LinearFilter;
      this.tex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      const geo = new THREE.PlaneGeometry(cols + 2 * PAD, rows + 2 * PAD);
      const mat = new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, alphaTest: 0.02, depthWrite: true });
      this.mesh = new THREE.Mesh(geo, mat);
      this.mesh.rotation.x = -Math.PI / 2;
      this.mesh.position.y = DECAL_Y + order * 0.004;
      this.mesh.renderOrder = 10 + order;
      this.dirty = true;
    }
    clear() { this.ctx.clearRect(0, 0, this.w, this.h); }
    commit() { this.tex.needsUpdate = true; }
    toPx(cx, cy) { return [(cx + 0.5 + PAD) * this.px, (cy + 0.5 + PAD) * this.px]; }

    buildPath(pts, rEnd, rBody, hw, dx, dy) {
      const ctx = this.ctx, n = pts.length;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const r = (i === 0 || i === n - 1) ? rEnd : rBody;
        const x = pts[i][0] + dx, y = pts[i][1] + dy;
        ctx.moveTo(x + r, y);
        ctx.arc(x, y, r, 0, Math.PI * 2, false);
      }
      for (let i = 0; i < n - 1; i++) {
        const ax = pts[i][0] + dx, ay = pts[i][1] + dy, bx = pts[i + 1][0] + dx, by = pts[i + 1][1] + dy;
        let vx = bx - ax, vy = by - ay;
        const len = Math.hypot(vx, vy);
        if (len < 1e-4) continue;
        vx /= len; vy /= len;
        const nx = -vy * hw, ny = vx * hw;
        const p = [[ax + nx, ay + ny], [bx + nx, by + ny], [bx - nx, by - ny], [ax - nx, ay - ny]];
        let area = 0;
        for (let k = 0; k < 4; k++) { const q = p[(k + 1) % 4]; area += p[k][0] * q[1] - q[0] * p[k][1]; }
        if (area < 0) p.reverse();
        ctx.moveTo(p[0][0], p[0][1]);
        for (let k = 1; k < 4; k++) ctx.lineTo(p[k][0], p[k][1]);
        ctx.closePath();
      }
    }

    shadedFill(pathFn, base, top, bottom, k) {
      const ctx = this.ctx;
      ctx.save();
      pathFn(0, 0); ctx.clip();
      ctx.fillStyle = bottom; ctx.fillRect(0, 0, this.w, this.h);
      ctx.save();
      pathFn(0, -k); ctx.clip();
      ctx.fillStyle = top; ctx.fillRect(0, 0, this.w, this.h);
      pathFn(0, k); ctx.fillStyle = base; ctx.fill();
      ctx.restore();
      ctx.restore();
    }

    paint(vis, time) {
      const ctx = this.ctx, px = this.px, hole = vis.hole, st = STYLE[hole.color];
      const n = vis.segs.length;
      const pts = vis.segs.map(p => this.toPx(p[0], p[1]));
      if (vis.nudge) {
        const d = Core.DIRS[vis.nudge.dir];
        const k = Math.sin(Math.PI * Math.min(1, vis.nudge.t / 0.26)) * 0.13 * px;
        const i = vis.nudge.end === 0 ? 0 : n - 1;
        pts[i] = [pts[i][0] + d[0] * k, pts[i][1] + d[1] * k];
      }
      let s = 1, flash = 0, alpha = 1;
      if (vis.burst) {
        const t = clamp(vis.burst.t / BURST_DUR, 0, 1);
        s = 1 + 0.2 * Math.sin(Math.PI * Math.min(1, t * 1.4));
        flash = clamp(t * 1.8, 0, 1);
        if (t > 0.62) { const f = (t - 0.62) / 0.38; alpha = 1 - f; s *= 1 - 0.55 * f; }
      }
      if (vis.spawn !== undefined) alpha *= clamp(vis.spawn, 0, 1);
      if (alpha <= 0) return;
      const R = v => v * px * s;
      const path = (rEnd, rBody, hw) => (dx, dy) => this.buildPath(pts, R(rEnd), R(rBody), R(hw), dx, dy);
      const mixF = (c, t) => css(mixRgb(c, WHITE, t));
      ctx.save();
      // halo
      ctx.globalAlpha = alpha * (vis.grabbed ? 0.34 : 0.2);
      path(0.565, 0.475, 0.475)(0, 0); ctx.fillStyle = css(st.base); ctx.fill();
      ctx.globalAlpha = alpha;
      // dark outline ring
      path(0.478, 0.397, 0.397)(0, 0); ctx.fillStyle = mixF(st.outline, flash); ctx.fill();
      // rim with top highlight / bottom shade
      this.shadedFill(path(0.452, 0.372, 0.372), mixF(vis.grabbed ? mixRgb(st.base, WHITE, 0.12) : st.base, flash), mixF(st.light, flash), mixF(st.dark, flash), 0.05 * px);
      // pit (dark shadow band at the top edge, lit far wall at the bottom edge)
      const pitPath = path(0.352, 0.278, 0.278);
      this.shadedFill(pitPath, mixF(PIT.base, flash * 0.9), mixF(PIT.top, flash * 0.9), mixF(PIT.bottom, flash * 0.9), 0.065 * px);
      // depth gradient across the whole pit (darker toward the top edge)
      if (flash < 0.5) {
        let minY = 1e9, maxY = -1e9;
        for (const p of pts) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
        minY -= 0.36 * px; maxY += 0.36 * px;
        ctx.save(); pitPath(0, 0); ctx.clip();
        const g = ctx.createLinearGradient(0, minY, 0, maxY);
        g.addColorStop(0, 'rgba(0,0,0,' + (0.45 * (1 - flash * 2)) + ')');
        g.addColorStop(0.55, 'rgba(0,0,0,0)');
        g.addColorStop(1, 'rgba(120,130,170,' + (0.14 * (1 - flash * 2)) + ')');
        ctx.fillStyle = g; ctx.fillRect(0, minY, this.w, maxY - minY);
        ctx.restore();
      }
      // pips: swallowed stickmen peeking out, filling from the far end
      for (let k = 0; k < hole.filled && k < n; k++) {
        const p = pts[n - 1 - k];
        const bob = Math.sin(time * 2.4 + k * 1.3) * 0.012 * px;
        ctx.beginPath(); ctx.arc(p[0], p[1] + bob, 0.125 * px * s, 0, Math.PI * 2);
        ctx.fillStyle = mixF(st.pip, flash); ctx.fill();
        ctx.lineWidth = 0.022 * px; ctx.strokeStyle = mixF(st.pipDark, flash); ctx.stroke();
        ctx.fillStyle = '#22242f';
        ctx.beginPath(); ctx.arc(p[0] - 0.045 * px, p[1] + bob - 0.02 * px, 0.022 * px, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(p[0] + 0.045 * px, p[1] + bob - 0.02 * px, 0.022 * px, 0, Math.PI * 2); ctx.fill();
      }
      // grab ring on the leading end
      if (vis.grabbed && !vis.burst) {
        const i = vis.grabEnd === 0 ? 0 : n - 1;
        const pulse = 0.03 * Math.sin(time * 9);
        ctx.beginPath(); ctx.arc(pts[i][0], pts[i][1], (0.54 + pulse) * px, 0, Math.PI * 2);
        ctx.lineWidth = 0.045 * px; ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.stroke();
      }
      // wiggle rings when the player touched the middle of the hole
      if (vis.wiggle > 0) {
        const a = Math.min(1, vis.wiggle / 0.45);
        ctx.lineWidth = 0.04 * px; ctx.strokeStyle = 'rgba(255,255,255,' + (0.85 * a) + ')';
        const ends = n === 1 ? [0] : [0, n - 1];
        for (const i of ends) {
          ctx.beginPath(); ctx.arc(pts[i][0], pts[i][1], (0.5 + 0.08 * Math.sin(time * 14)) * px, 0, Math.PI * 2); ctx.stroke();
        }
      }
      ctx.restore();
    }
  }

  // ------------------------------------------------------------------ stickmen
  const STICK_GEO = {
    head: new THREE.SphereGeometry(0.185, 24, 16),
    body: new THREE.CapsuleGeometry(0.125, 0.3, 6, 16),
    arm: new THREE.CapsuleGeometry(0.046, 0.22, 4, 10),
    leg: new THREE.CapsuleGeometry(0.054, 0.18, 4, 10),
    eye: new THREE.SphereGeometry(0.044, 12, 8),
    glint: new THREE.SphereGeometry(0.015, 8, 6),
  };
  const STICK_SCALE = 0.88;
  const STICK_MAT = {};
  for (const k in COLORS) {
    STICK_MAT[k] = new THREE.MeshStandardMaterial({ color: COLORS[k], roughness: 0.62, metalness: 0, emissive: COLORS[k], emissiveIntensity: 0.07 });
  }
  const EYE_MAT = new THREE.MeshStandardMaterial({ color: 0x1b1d26, roughness: 0.35 });
  const GLINT_MAT = new THREE.MeshBasicMaterial({ color: 0xffffff });

  function makeStickman(color) {
    const mat = STICK_MAT[color];
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);
    const mk = (geo, m, x, y, z, rz) => {
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.set(x, y, z);
      if (rz) mesh.rotation.z = rz;
      mesh.castShadow = true;
      body.add(mesh);
      return mesh;
    };
    mk(STICK_GEO.leg, mat, -0.08, 0.15, 0);
    mk(STICK_GEO.leg, mat, 0.08, 0.15, 0);
    mk(STICK_GEO.body, mat, 0, 0.5, 0);
    mk(STICK_GEO.arm, mat, -0.175, 0.5, 0.03, 0.38);
    mk(STICK_GEO.arm, mat, 0.175, 0.5, 0.03, -0.38);
    const head = mk(STICK_GEO.head, mat, 0, 0.9, 0);
    const eyes = new THREE.Group();
    eyes.position.set(0, 0.92, 0.135);
    const eL = new THREE.Mesh(STICK_GEO.eye, EYE_MAT); eL.position.set(-0.068, 0, 0.02);
    const eR = new THREE.Mesh(STICK_GEO.eye, EYE_MAT); eR.position.set(0.068, 0, 0.02);
    const gL = new THREE.Mesh(STICK_GEO.glint, GLINT_MAT); gL.position.set(-0.053, 0.017, 0.056);
    const gR = new THREE.Mesh(STICK_GEO.glint, GLINT_MAT); gR.position.set(0.083, 0.017, 0.056);
    eyes.add(eL, eR, gL, gR);
    body.add(eyes);
    head.castShadow = true;
    body.scale.setScalar(STICK_SCALE);
    body.rotation.x = 0.24; // lean toward the camera so bodies and faces read from above
    return { root, body, eyes };
  }

  // ------------------------------------------------------------------ particles
  class Particles {
    constructor(geo, max, roughness) {
      this.max = max;
      this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: roughness || 0.5, metalness: 0 }), max);
      this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.mesh.frustumCulled = false;
      this.mesh.castShadow = false;
      this.items = [];
      this.dummy = new THREE.Object3D();
      this.color = new THREE.Color();
      for (let i = 0; i < max; i++) { this.dummy.scale.setScalar(0); this.dummy.updateMatrix(); this.mesh.setMatrixAt(i, this.dummy.matrix); this.mesh.setColorAt(i, this.color.setHex(0xffffff)); }
      this.mesh.instanceMatrix.needsUpdate = true;
      this.mesh.instanceColor.needsUpdate = true;
    }
    spawn(p) {
      if (this.items.length >= this.max) this.items.shift();
      this.items.push(Object.assign({ life: 0, rot: new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6), rotVel: new THREE.Vector3((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12), gravity: 9, drag: 0.6, scale: 1 }, p));
    }
    update(dt) {
      const d = this.dummy;
      const alive = [];
      for (const it of this.items) {
        it.life += dt;
        if (it.life >= it.ttl) continue;
        it.vel.y -= it.gravity * dt;
        it.vel.multiplyScalar(Math.max(0, 1 - it.drag * dt));
        it.pos.addScaledVector(it.vel, dt);
        if (it.floor !== undefined && it.pos.y < it.floor) { it.pos.y = it.floor; it.vel.y *= -0.35; it.vel.x *= 0.7; it.vel.z *= 0.7; }
        it.rot.x += it.rotVel.x * dt; it.rot.y += it.rotVel.y * dt; it.rot.z += it.rotVel.z * dt;
        alive.push(it);
      }
      this.items = alive;
      for (let i = 0; i < this.max; i++) {
        const it = this.items[i];
        if (it) {
          const k = it.life / it.ttl;
          const s = it.scale * (k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1);
          d.position.copy(it.pos); d.rotation.copy(it.rot); d.scale.setScalar(Math.max(0.0001, s));
          d.updateMatrix(); this.mesh.setMatrixAt(i, d.matrix);
          this.mesh.setColorAt(i, this.color.setHex(it.color));
        } else {
          d.scale.setScalar(0); d.updateMatrix(); this.mesh.setMatrixAt(i, d.matrix);
        }
      }
      this.mesh.instanceMatrix.needsUpdate = true;
      this.mesh.instanceColor.needsUpdate = true;
    }
  }
  const sparks = new Particles(new THREE.SphereGeometry(0.055, 8, 6), 220, 0.45);
  const confetti = new Particles(new THREE.BoxGeometry(0.16, 0.02, 0.1), 220, 0.7);
  fxGroup.add(sparks.mesh, confetti.mesh);

  const ripples = [];
  const RIPPLE_GEO = new THREE.RingGeometry(0.4, 0.5, 48);
  function ripple(x, z, colorHex, size) {
    let r = ripples.find(o => !o.active);
    if (!r) {
      const mesh = new THREE.Mesh(RIPPLE_GEO, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false }));
      mesh.rotation.x = -Math.PI / 2;
      mesh.renderOrder = 20;
      fxGroup.add(mesh);
      r = { mesh, active: false, t: 0 };
      ripples.push(r);
    }
    r.active = true; r.t = 0; r.size = size || 1;
    r.mesh.visible = true;
    r.mesh.material.color.setHex(colorHex);
    r.mesh.position.set(x, DECAL_Y + 0.012, z);
  }
  function updateRipples(dt) {
    for (const r of ripples) {
      if (!r.active) continue;
      r.t += dt;
      const k = r.t / 0.55;
      if (k >= 1) { r.active = false; r.mesh.visible = false; continue; }
      const s = (0.6 + k * 1.9) * r.size;
      r.mesh.scale.set(s, s, s);
      r.mesh.material.opacity = 0.85 * (1 - k);
    }
  }

  // ------------------------------------------------------------------ game state
  let level = null, levelIndex = 0, state = null;
  let cols = 0, rows = 0;
  let slateTex = null, staticLayer = null, dynamicLayer = null;
  let stickVis = new Map();   // "c,r" -> visual
  let holeVis = new Map();    // hole.id -> visual
  let drag = null;
  let inputEnabled = false;
  let timeLeft = 0, timerRunning = false, lastTickSecond = -1, lostPending = false, wonPending = false, finished = false;
  let introT = -1;
  let time = 0;
  let boardPoints = [];
  let handAnim = null;
  let staticDirty = true;
  let toastTimer = null;
  let stuckShown = false;

  const cellX = c => c - (cols - 1) / 2;
  const cellZ = r => r - (rows - 1) / 2;

  function buildBoard() {
    disposeGroup(board);
    if (slateTex) slateTex.dispose();
    const innerW = cols + 2 * PAD, innerH = rows + 2 * PAD;
    const outerW = innerW + 2 * RIM, outerH = innerH + 2 * RIM;

    // frame (light rim with a rounded hole for the slate)
    const outer = roundedRectPath(new THREE.Shape(), outerW, outerH, 0.55);
    outer.holes.push(roundedRectPath(new THREE.Path(), innerW, innerH, 0.24));
    const bevel = 0.035;
    const frameGeo = new THREE.ExtrudeGeometry(outer, { depth: SLAB_H, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 12 });
    const frame = new THREE.Mesh(frameGeo, new THREE.MeshStandardMaterial({ color: 0xe9edf5, roughness: 0.9, metalness: 0 }));
    frame.rotation.x = Math.PI / 2;
    frame.position.y = -bevel;
    frame.castShadow = true; frame.receiveShadow = true;
    board.add(frame);

    // slate block (side walls of the recess) + textured top
    const innerShape = roundedRectPath(new THREE.Shape(), innerW, innerH, 0.24);
    const blockGeo = new THREE.ExtrudeGeometry(innerShape, { depth: SLAB_H - 0.05, bevelEnabled: false, curveSegments: 12 });
    const block = new THREE.Mesh(blockGeo, new THREE.MeshStandardMaterial({ color: 0x7c89a1, roughness: 0.95 }));
    block.rotation.x = Math.PI / 2;
    block.position.y = SLATE_Y;
    block.castShadow = true;
    board.add(block);

    slateTex = makeSlateTexture(cols, rows);
    const top = new THREE.Mesh(new THREE.PlaneGeometry(innerW, innerH), new THREE.MeshStandardMaterial({ map: slateTex, roughness: 0.96, metalness: 0 }));
    top.rotation.x = -Math.PI / 2;
    top.position.y = SLATE_Y + 0.002;
    top.receiveShadow = true;
    board.add(top);

    // soft drop shadow under the floating board
    const shTex = makeShadowTexture(outerH / outerW);
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(outerW * 1.42, outerH * 1.42), new THREE.MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2;
    sh.position.set(0.32, -SLAB_H - 0.5, 0.45);
    sh.renderOrder = -1;
    board.add(sh);

    // decal layers for holes
    const px = cols <= 5 ? 128 : 96;
    staticLayer = new HoleLayer(cols, rows, px, 0);
    dynamicLayer = new HoleLayer(cols, rows, px, 1);
    board.add(staticLayer.mesh, dynamicLayer.mesh);

    // camera-fit bounds
    const hw = outerW / 2, hh = outerH / 2;
    boardPoints = [];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      boardPoints.push(new THREE.Vector3(sx * hw, 0, sz * hh));
      boardPoints.push(new THREE.Vector3(sx * hw, -SLAB_H - 0.1, sz * hh));
      boardPoints.push(new THREE.Vector3(sx * (cols / 2), 0.95, sz * (rows / 2)));
    }
    // shadow camera
    const ext = Math.max(cols, rows) / 2 + 1.8;
    sun.shadow.camera.left = -ext; sun.shadow.camera.right = ext;
    sun.shadow.camera.top = ext; sun.shadow.camera.bottom = -ext;
    sun.shadow.camera.updateProjectionMatrix();
  }

  function buildStickmen() {
    stickVis = new Map();
    let i = 0;
    for (const [k, color] of state.sticks) {
      const [c, r] = k.split(',').map(Number);
      const sm = makeStickman(color);
      sm.root.position.set(cellX(c), SLATE_Y, cellZ(r));
      sm.root.rotation.y = (Math.random() - 0.5) * 0.5;
      board.add(sm.root);
      stickVis.set(k, Object.assign(sm, {
        c, r, color, phase: Math.random() * Math.PI * 2, blinkT: 1.5 + Math.random() * 3, blink: 0,
        shake: 0, swallow: null, spawn: -0.25 - i * 0.045, doomed: false,
      }));
      i++;
    }
  }

  function buildHoleVis() {
    holeVis = new Map();
    for (const h of state.holes) {
      holeVis.set(h.id, { hole: h, segs: h.cells.map(p => [p[0], p[1]]), from: null, to: null, t: 0, anim: false, queue: [], nudge: null, wiggle: 0, burst: null, grabbed: false, grabEnd: 0, dynamic: false, gone: false, spawn: 0 });
    }
    staticDirty = true;
  }

  // ------------------------------------------------------------------ camera
  const camRight = new THREE.Vector3(), camUp = new THREE.Vector3(), tmpV = new THREE.Vector3();
  const camTarget = new THREE.Vector3(0, 0, 0);
  let camDist = 12;
  function placeCamera(target, dist) {
    camera.position.set(target.x, target.y + dist * Math.cos(CAM_TILT), target.z + dist * Math.sin(CAM_TILT));
    camera.lookAt(target);
    camera.updateMatrixWorld();
  }
  function projectBounds() {
    let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    for (const p of boardPoints) {
      tmpV.copy(p).project(camera);
      minX = Math.min(minX, tmpV.x); maxX = Math.max(maxX, tmpV.x);
      minY = Math.min(minY, tmpV.y); maxY = Math.max(maxY, tmpV.y);
    }
    return { minX, maxX, minY, maxY };
  }
  function fitCamera() {
    const W = app.clientWidth || 1, H = app.clientHeight || 1;
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    if (!boardPoints.length) return;
    const hudH = ui.hud.offsetHeight + 14;
    const bottomPad = 26;
    const ndcTop = 1 - 2 * hudH / H, ndcBottom = -1 + 2 * bottomPad / H;
    const side = 12;
    const ndcL = -1 + 2 * side / W, ndcR = 1 - 2 * side / W;
    const availW = ndcR - ndcL, availH = ndcTop - ndcBottom;
    const cx = (ndcL + ndcR) / 2, cy = ndcBottom + (ndcTop - ndcBottom) * 0.535; // a touch above center reads better on tall phones
    camTarget.set(0, -0.2, 0);
    camDist = 12;
    for (let it = 0; it < 7; it++) {
      placeCamera(camTarget, camDist);
      let b = projectBounds();
      const s = Math.max((b.maxX - b.minX) / availW, (b.maxY - b.minY) / availH);
      camDist *= s;
      placeCamera(camTarget, camDist);
      b = projectBounds();
      const dx = (b.minX + b.maxX) / 2 - cx, dy = (b.minY + b.maxY) / 2 - cy;
      const halfH = camDist * Math.tan(THREE.MathUtils.degToRad(CAM_FOV) / 2), halfW = halfH * camera.aspect;
      camera.matrixWorld.extractBasis(camRight, camUp, tmpV);
      camTarget.addScaledVector(camRight, dx * halfW).addScaledVector(camUp, dy * halfH);
    }
    placeCamera(camTarget, camDist);
  }

  // ------------------------------------------------------------------ layout / resize
  function isCoarse() { return window.matchMedia('(pointer: coarse)').matches; }
  function resize() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const coarse = isCoarse();
    let w = vw, h = vh, framed = false;
    if (!coarse && vw / vh > 0.7) { w = Math.round(Math.min(vh * 0.5625, vw)); framed = true; }
    app.style.width = w + 'px';
    app.style.height = h + 'px';
    app.classList.toggle('framed', framed);
    renderer.setSize(w, h, false);
    ui.rotate.classList.toggle('hidden', !(coarse && vw > vh));
    fitCamera();
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 120));

  // ------------------------------------------------------------------ HUD helpers
  function fmtTime(s) { s = Math.max(0, Math.ceil(s)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }
  function updateTimerUI() {
    ui.timerText.textContent = fmtTime(timeLeft);
    ui.timerPill.classList.toggle('warn', timerRunning && timeLeft <= 10.5 && timeLeft > 0);
  }
  function toast(msg, ms) {
    ui.toast.textContent = msg;
    ui.toast.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ui.toast.classList.add('hidden'), ms || 1800);
  }
  function show(el, on) { el.classList.toggle('hidden', !on); }

  // ------------------------------------------------------------------ level select
  function buildLevelGrid() {
    ui.levelGrid.innerHTML = '';
    LEVELS.forEach((lv, i) => {
      const b = document.createElement('button');
      b.className = 'lvl' + (i === levelIndex ? ' current' : '');
      const t = TIERS[lv.tier];
      const base = new THREE.Color(t.color);
      const c1 = base.clone().lerp(new THREE.Color(0xffffff), 0.25).getStyle();
      const c2 = base.getStyle();
      const c3 = base.clone().lerp(new THREE.Color(0x000000), 0.35).getStyle();
      b.style.setProperty('--c1', c1); b.style.setProperty('--c2', c2); b.style.setProperty('--c3', c3);
      b.innerHTML = '<span class="num">' + (i + 1) + '</span><small>' + t.label + '</small>' + (progress.done[i] ? '<span class="done">✓</span>' : '');
      b.addEventListener('click', () => { Sfx.ensure(); Sfx.grab(); show(ui.ovLevels, false); loadLevel(i); });
      ui.levelGrid.appendChild(b);
    });
  }
  function openLevels() {
    buildLevelGrid();
    show(ui.ovWin, false); show(ui.ovLose, false);
    show(ui.ovLevels, true);
    inputEnabled = false; timerRunning = false; drag = null;
    ui.timerPill.classList.add('paused');
  }

  // ------------------------------------------------------------------ load level
  function loadLevel(i) {
    levelIndex = clamp(i, 0, LEVELS.length - 1);
    level = LEVELS[levelIndex];
    progress.last = levelIndex; store.save(progress);
    state = new Core.State(level);
    cols = level.cols; rows = level.rows;
    drag = null; finished = false; wonPending = false; lostPending = false; stuckShown = false;
    timeLeft = level.time; timerRunning = false; lastTickSecond = -1;
    ui.timerPill.classList.remove('paused');
    updateTimerUI();
    ui.levelTitle.textContent = 'Level ' + (levelIndex + 1);
    ui.levelTier.textContent = TIERS[level.tier].label;
    ui.levelPill.dataset.tier = level.tier;
    show(ui.ovWin, false); show(ui.ovLose, false); show(ui.toast, false);
    if (level.hint) { ui.hint.textContent = level.hint; show(ui.hint, true); } else show(ui.hint, false);

    buildBoard();
    buildStickmen();
    buildHoleVis();
    for (const v of holeVis.values()) v.spawn = -0.15;
    sparks.items.length = 0; confetti.items.length = 0;
    for (const r of ripples) { r.active = false; r.mesh.visible = false; }
    fitCamera();
    board.position.y = -3;
    introT = 0;
    inputEnabled = false;
    handAnim = levelIndex === 0 ? { t: 0 } : null;
    show(ui.hand, false);
  }

  // ------------------------------------------------------------------ visuals: hole animation events
  function makeDynamic(vis) { if (!vis.dynamic) { vis.dynamic = true; staticDirty = true; } }
  function settle(vis) { if (vis.dynamic) { vis.dynamic = false; staticDirty = true; } }

  function onCollect(ev, vis) {
    const k = Core.key(ev.cell[0], ev.cell[1]);
    const sv = stickVis.get(k);
    if (sv && !sv.swallow) sv.swallow = { t: 0 };
    const x = cellX(ev.cell[0]), z = cellZ(ev.cell[1]);
    ripple(x, z, STYLE[ev.color].hex, 0.8);
    for (let i = 0; i < 9; i++) {
      const a = Math.random() * Math.PI * 2, sp = 1.2 + Math.random() * 1.6;
      sparks.spawn({ pos: new THREE.Vector3(x, SLATE_Y + 0.15, z), vel: new THREE.Vector3(Math.cos(a) * sp, 2.6 + Math.random() * 2.2, Math.sin(a) * sp), ttl: 0.5 + Math.random() * 0.3, color: COLORS[ev.color], scale: 0.7 + Math.random() * 0.7, floor: SLATE_Y + 0.05 });
    }
    Sfx.pop(); Sfx.swallow();
  }

  function onSatisfied(vis) {
    vis.burst = { t: 0 };
    makeDynamic(vis);
    const st = STYLE[vis.hole.color];
    let cx = 0, cz = 0;
    for (const p of vis.segs) { cx += cellX(p[0]); cz += cellZ(p[1]); }
    cx /= vis.segs.length; cz /= vis.segs.length;
    ripple(cx, cz, 0xffffff, 1.2 + vis.segs.length * 0.25);
    for (const p of vis.segs) {
      const x = cellX(p[0]), z = cellZ(p[1]);
      for (let i = 0; i < 8; i++) {
        const a = Math.random() * Math.PI * 2, sp = 1.5 + Math.random() * 2.2;
        sparks.spawn({ pos: new THREE.Vector3(x, SLATE_Y + 0.1, z), vel: new THREE.Vector3(Math.cos(a) * sp, 3.5 + Math.random() * 3, Math.sin(a) * sp), ttl: 0.7 + Math.random() * 0.4, color: Math.random() < 0.3 ? 0xffffff : st.hex, scale: 0.8 + Math.random() * 0.9, floor: SLATE_Y + 0.05 });
      }
    }
    Sfx.burst();
    if (drag && drag.vis === vis) endDrag();
  }

  function fireEvents(vis, events) {
    for (const ev of events) {
      if (ev.type === 'collect') onCollect(ev, vis);
      else if (ev.type === 'satisfied') onSatisfied(vis);
    }
  }

  function spawnConfetti() {
    const palette = Object.values(COLORS);
    const spread = Math.max(cols, rows) / 2 + 1;
    for (let i = 0; i < 140; i++) {
      confetti.spawn({
        pos: new THREE.Vector3((Math.random() - 0.5) * spread * 2, 4 + Math.random() * 3, (Math.random() - 0.5) * spread * 2 - 1),
        vel: new THREE.Vector3((Math.random() - 0.5) * 2, -0.5 - Math.random() * 1.5, (Math.random() - 0.5) * 2),
        ttl: 2.4 + Math.random() * 1.2, color: palette[i % palette.length], scale: 0.8 + Math.random() * 0.8, gravity: 2.2, drag: 0.9, floor: SLATE_Y + 0.02,
      });
    }
  }

  function completeLevel() {
    finished = true; inputEnabled = false; timerRunning = false; drag = null;
    progress.done[levelIndex] = true; store.save(progress);
    updateTimerUI();
    spawnConfetti();
    Sfx.win();
    setTimeout(() => {
      const spare = Math.max(0, Math.ceil(timeLeft));
      ui.winSub.textContent = level.name + ' cleared with ' + fmtTime(spare) + ' to spare';
      $('btn-next').textContent = levelIndex < LEVELS.length - 1 ? 'Next' : 'Levels';
      show(ui.ovWin, true);
    }, 900);
  }

  function failLevel() {
    finished = true; inputEnabled = false; timerRunning = false; drag = null;
    timeLeft = 0; updateTimerUI();
    ui.timerPill.classList.remove('warn');
    Sfx.timeUp();
    setTimeout(() => show(ui.ovLose, true), 700);
  }

  // ------------------------------------------------------------------ input
  const raycaster = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -SLATE_Y);
  const ndc = new THREE.Vector2(), hit = new THREE.Vector3();
  let lastNudge = 0;

  function pointerToCell(e) {
    const rect = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    if (!raycaster.ray.intersectPlane(plane, hit)) return null;
    return { fc: hit.x - board.position.x + (cols - 1) / 2, fr: hit.z - board.position.z + (rows - 1) / 2 };
  }

  function startTimerIfNeeded() {
    if (!timerRunning && !finished) {
      timerRunning = true;
      ui.timerPill.classList.remove('paused');
      show(ui.hint, false); handAnim = null; show(ui.hand, false);
    }
  }

  function applyStep(hole, end, dir) {
    const res = state.step(hole, end, dir);
    if (!res.ok) return res;
    const vis = holeVis.get(hole.id);
    const kf = { cells: hole.cells.map(p => [p[0], p[1]]), events: [] };
    if (res.collected) {
      kf.events.push({ type: 'collect', cell: res.target, color: res.collected });
      const sv = stickVis.get(Core.key(res.target[0], res.target[1]));
      if (sv) sv.doomed = true;
    }
    if (res.satisfied) kf.events.push({ type: 'satisfied' });
    vis.queue.push(kf);
    makeDynamic(vis);
    startTimerIfNeeded();
    return res;
  }

  function nudge(vis, end, dir, res) {
    const now = performance.now();
    if (now - lastNudge < 260) return;
    lastNudge = now;
    vis.nudge = { dir, end, t: 0 };
    makeDynamic(vis);
    if (res && res.reason === 'stick') {
      const sv = stickVis.get(Core.key(res.target[0], res.target[1]));
      if (sv) sv.shake = 0.35;
    }
    Sfx.click();
  }

  function onPointerDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    Sfx.ensure();
    if (!inputEnabled || drag) return;
    const p = pointerToCell(e);
    if (!p) return;
    let best = null, bestD = 0.75;
    for (const vis of holeVis.values()) {
      if (vis.gone || vis.burst || !vis.hole.alive) continue;
      const n = vis.segs.length;
      const ends = n === 1 ? [0] : [0, 1];
      for (const end of ends) {
        const s = vis.segs[end === 0 ? 0 : n - 1];
        const d = Math.hypot(s[0] - p.fc, s[1] - p.fr);
        if (d < bestD) { bestD = d; best = { vis, end }; }
      }
    }
    if (!best) {
      // touched the middle of a hole? show where to grab
      const c = Math.round(p.fc), r = Math.round(p.fr);
      const occ = state.holeAt(c, r);
      if (occ) { const v = holeVis.get(occ.hole.id); v.wiggle = 0.45; makeDynamic(v); Sfx.click(); }
      return;
    }
    drag = { vis: best.vis, hole: best.vis.hole, end: best.end, pointerId: e.pointerId };
    best.vis.grabbed = true; best.vis.grabEnd = best.end;
    makeDynamic(best.vis);
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    Sfx.grab();
    handAnim = null; show(ui.hand, false);
  }

  function onPointerMove(e) {
    if (!drag || e.pointerId !== drag.pointerId || !inputEnabled) return;
    const p = pointerToCell(e);
    if (!p) return;
    const hole = drag.hole, end = drag.end, vis = drag.vis;
    if (!hole.alive) { endDrag(); return; }
    const target = [clamp(Math.round(p.fc), 0, cols - 1), clamp(Math.round(p.fr), 0, rows - 1)];
    const lead = state.leadCell(hole, end);
    if (target[0] === lead[0] && target[1] === lead[1]) return;
    const path = Core.findPath(state, hole, end, target, 10);
    if (path && path.length) {
      for (const dir of path) {
        const res = applyStep(hole, end, dir);
        if (!res.ok || res.satisfied) break;
      }
      return;
    }
    // no full route: step greedily toward the finger, or push against the obstacle
    const dx = target[0] - lead[0], dy = target[1] - lead[1];
    const prim = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'R' : 'L') : (dy > 0 ? 'D' : 'U');
    const sec = Math.abs(dx) >= Math.abs(dy) ? (dy > 0 ? 'D' : dy < 0 ? 'U' : null) : (dx > 0 ? 'R' : dx < 0 ? 'L' : null);
    let res = state.canStep(hole, end, prim);
    if (res.ok) { applyStep(hole, end, prim); return; }
    if (sec) {
      const r2 = state.canStep(hole, end, sec);
      if (r2.ok) { applyStep(hole, end, sec); return; }
    }
    const fx = p.fc - lead[0], fy = p.fr - lead[1];
    const along = prim === 'R' ? fx : prim === 'L' ? -fx : prim === 'D' ? fy : -fy;
    if (along > 0.55) nudge(vis, end, prim, res);
  }

  function endDrag() {
    if (!drag) return;
    const vis = drag.vis;
    vis.grabbed = false;
    if (!vis.anim && vis.queue.length === 0 && !vis.burst) settle(vis);
    drag = null;
    if (inputEnabled && !finished && !state.isWon() && !state.hasMoves() && !stuckShown) {
      stuckShown = true;
      toast('No moves left. Restart the level.', 2600);
    }
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', e => { if (drag && e.pointerId === drag.pointerId) endDrag(); });
  canvas.addEventListener('pointercancel', e => { if (drag && e.pointerId === drag.pointerId) endDrag(); });
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  // ------------------------------------------------------------------ buttons
  $('btn-restart').addEventListener('click', () => { Sfx.ensure(); Sfx.grab(); loadLevel(levelIndex); });
  $('btn-levels').addEventListener('click', () => { Sfx.ensure(); Sfx.grab(); openLevels(); });
  $('btn-win-levels').addEventListener('click', () => { Sfx.grab(); openLevels(); });
  $('btn-lose-levels').addEventListener('click', () => { Sfx.grab(); openLevels(); });
  $('btn-next').addEventListener('click', () => { Sfx.grab(); if (levelIndex < LEVELS.length - 1) { show(ui.ovWin, false); loadLevel(levelIndex + 1); } else openLevels(); });
  $('btn-retry').addEventListener('click', () => { Sfx.grab(); show(ui.ovLose, false); loadLevel(levelIndex); });
  ui.btnSound.classList.toggle('muted', !!progress.muted);
  ui.btnSound.addEventListener('click', () => {
    Sfx.ensure();
    Sfx.setMuted(!progress.muted);
    ui.btnSound.classList.toggle('muted', !!progress.muted);
    if (!progress.muted) Sfx.grab();
  });
  const fsOk = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
  if (!fsOk || !isCoarse()) ui.btnFull.classList.add('hidden');
  ui.btnFull.addEventListener('click', () => {
    Sfx.ensure();
    const el = document.documentElement;
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      const p = el.requestFullscreen ? el.requestFullscreen() : el.webkitRequestFullscreen && el.webkitRequestFullscreen();
      if (p && p.then) p.then(() => { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('portrait').catch(() => {}); }).catch(() => {});
    } else {
      (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    }
    setTimeout(resize, 300);
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && timerRunning) { timerRunning = false; ui.timerPill.classList.add('paused'); } });

  // ------------------------------------------------------------------ main loop
  let lastT = performance.now();
  function frame(now, manual) {
    if (!manual) requestAnimationFrame(frame);
    let dt = (now - lastT) / 1000;
    lastT = now;
    if (dt > 0.1) dt = 0.1;
    if (dt < 0) dt = 0;
    time += dt;

    if (!level) { renderer.render(scene, camera); return; }

    // intro
    if (introT >= 0) {
      introT += dt;
      const k = clamp(introT / 0.7, 0, 1);
      board.position.y = -3 * (1 - easeOutBack(k)) * (1 - k * 0.2) - (k < 1 ? 0 : 0);
      if (k >= 1) { board.position.y = 0; introT = -1; }
      if (introT > 0.45 && !inputEnabled && !finished && ui.ovLevels.classList.contains('hidden')) inputEnabled = true;
    }
    fxGroup.position.y = board.position.y;

    // timer
    if (timerRunning && !finished) {
      timeLeft -= dt;
      const sec = Math.ceil(timeLeft);
      if (timeLeft <= 10.5 && sec !== lastTickSecond && timeLeft > 0) { lastTickSecond = sec; Sfx.tick(); }
      if (timeLeft <= 0) { timeLeft = 0; failLevel(); }
      updateTimerUI();
    }

    // stickmen
    for (const [k, sv] of stickVis) {
      const b = sv.body;
      if (sv.spawn < 1) {
        sv.spawn += dt * 2.6;
        const s = sv.spawn <= 0 ? 0 : easeOutBack(clamp(sv.spawn, 0, 1));
        sv.root.scale.setScalar(Math.max(0.0001, s));
        sv.root.visible = sv.spawn > 0;
      }
      if (sv.swallow) {
        sv.swallow.t += dt;
        const k2 = sv.swallow.t / SWALLOW_DUR;
        if (k2 < 0.28) {
          const a = k2 / 0.28;
          b.scale.set(STICK_SCALE *(1 - 0.22 * a), STICK_SCALE *(1 + 0.42 * a), STICK_SCALE *(1 - 0.22 * a));
        } else {
          const a = clamp((k2 - 0.28) / 0.72, 0, 1), e = easeInCubic(a);
          sv.root.position.y = SLATE_Y - 0.7 * e;
          const s = STICK_SCALE * Math.max(0.03, 1 - 0.97 * e);
          b.scale.set(s, STICK_SCALE * Math.max(0.03, 1.42 - 1.39 * a), s);
          b.rotation.y = a * Math.PI * 2.2;
          sv.root.visible = a < 0.97;
        }
        if (sv.swallow.t >= SWALLOW_DUR) { board.remove(sv.root); stickVis.delete(k); }
        continue;
      }
      const bob = Math.sin(time * 3.1 + sv.phase);
      b.scale.set(STICK_SCALE *(1 - 0.02 * bob), STICK_SCALE *(1 + 0.035 * bob), STICK_SCALE *(1 - 0.02 * bob));
      b.rotation.z = 0.035 * Math.sin(time * 1.7 + sv.phase);
      if (sv.shake > 0) { sv.shake -= dt; b.rotation.z += Math.sin(sv.shake * 70) * 0.22 * (sv.shake / 0.35); }
      sv.blinkT -= dt;
      if (sv.blinkT <= 0) { sv.blinkT = 2.2 + Math.random() * 3.5; sv.blink = 0.13; }
      if (sv.blink > 0) { sv.blink -= dt; sv.eyes.scale.y = sv.blink > 0 ? 0.12 : 1; } else sv.eyes.scale.y = 1;
    }

    // holes
    let anyDynamic = false;
    for (const vis of Array.from(holeVis.values())) {
      if (vis.gone) continue;
      if (vis.spawn < 1) { vis.spawn += dt * 2.2; makeDynamic(vis); if (vis.spawn >= 1) { vis.spawn = 1; if (!vis.grabbed && !vis.anim && !vis.queue.length) settle(vis); } }
      if (vis.nudge) { vis.nudge.t += dt; if (vis.nudge.t > 0.26) { vis.nudge = null; if (!vis.grabbed && !vis.anim && !vis.queue.length && !vis.burst) settle(vis); } }
      if (vis.wiggle > 0) { vis.wiggle -= dt; if (vis.wiggle <= 0) { vis.wiggle = 0; if (!vis.grabbed && !vis.anim && !vis.queue.length && !vis.burst) settle(vis); } }
      if (!vis.anim && vis.queue.length) {
        vis.from = vis.segs.map(p => [p[0], p[1]]);
        vis.to = vis.queue.shift();
        vis.t = 0; vis.anim = true;
      }
      if (vis.anim) {
        const speed = Math.min(36, 11 * (1 + 0.6 * vis.queue.length));
        vis.t += dt * speed;
        if (vis.t >= 1) {
          vis.segs = vis.to.cells.map(p => [p[0], p[1]]);
          vis.anim = false;
          const evs = vis.to.events;
          vis.to = null;
          fireEvents(vis, evs);
          if (!vis.queue.length && !vis.grabbed && !vis.burst && !vis.nudge) settle(vis);
        } else {
          for (let i = 0; i < vis.segs.length; i++) {
            vis.segs[i][0] = lerp(vis.from[i][0], vis.to.cells[i][0], vis.t);
            vis.segs[i][1] = lerp(vis.from[i][1], vis.to.cells[i][1], vis.t);
          }
        }
      }
      if (vis.burst) {
        vis.burst.t += dt;
        if (vis.burst.t >= BURST_DUR) {
          vis.gone = true; vis.dynamic = false; staticDirty = true;
          holeVis.delete(vis.hole.id);
          if (state.isWon() && !finished) completeLevel();
        }
      }
      if (vis.dynamic && !vis.gone) anyDynamic = true;
    }

    // decal layers
    if (staticDirty) {
      staticLayer.clear();
      for (const vis of holeVis.values()) if (!vis.dynamic && !vis.gone) staticLayer.paint(vis, time);
      staticLayer.commit();
      staticDirty = false;
    }
    dynamicLayer.clear();
    if (anyDynamic) for (const vis of holeVis.values()) if (vis.dynamic && !vis.gone) dynamicLayer.paint(vis, time);
    dynamicLayer.commit();

    // tutorial hand
    if (handAnim && inputEnabled && !drag) {
      handAnim.t += dt;
      const T = handAnim.t % 2.4;
      const h0 = level.holes[0];
      const from = h0.cells[0], to = [from[0], from[1] - 3];
      let a, k;
      if (T < 0.35) { a = T / 0.35; k = 0; }
      else if (T < 1.55) { a = 1; k = easeOutCubic((T - 0.35) / 1.2); }
      else if (T < 1.9) { a = 1 - (T - 1.55) / 0.35; k = 1; }
      else { a = 0; k = 1; }
      tmpV.set(cellX(lerp(from[0], to[0], k)), SLATE_Y + 0.4, cellZ(lerp(from[1], to[1], k)) + 0.12).project(camera);
      const rect = canvas.getBoundingClientRect();
      ui.hand.style.left = ((tmpV.x + 1) / 2 * rect.width) + 'px';
      ui.hand.style.top = ((1 - tmpV.y) / 2 * rect.height) + 'px';
      ui.hand.style.opacity = a;
      show(ui.hand, a > 0.01);
    } else if (!handAnim) show(ui.hand, false);

    sparks.update(dt);
    confetti.update(dt);
    updateRipples(dt);
    renderer.render(scene, camera);
  }

  // ------------------------------------------------------------------ debug hooks (drive frames manually, used by automated visual checks)
  let debugNow = 0;
  window.__sdDebug = {
    tick(ms, n) {
      for (let i = 0; i < (n || 1); i++) frame(lastT + ms, true);
    },
    summary() {
      return {
        level: levelIndex + 1, sticks: state ? state.sticks.size : -1, holes: state ? state.aliveHoles().length : -1,
        timeLeft: Math.round(timeLeft * 10) / 10, timerRunning, inputEnabled, finished, won: !!(state && state.isWon()), dragging: !!drag,
        dynamic: [...holeVis.values()].filter(v => v.dynamic).length, holeCells: state ? state.holes.map(h => h.alive ? h.cells.map(p => p.join(',')).join(' ') : 'x') : [],
        ovWin: !ui.ovWin.classList.contains('hidden'), ovLose: !ui.ovLose.classList.contains('hidden'), ovLevels: !ui.ovLevels.classList.contains('hidden'),
      };
    },
    load(i) { show(ui.ovLevels, false); loadLevel(i); },
    step(h, end, dir) { return applyStep(state.holes[h], end, dir); },
    setTime(t) { timeLeft = t; },
    resumeTimer() { timerRunning = true; },
    cellToScreen(c, r) {
      tmpV.set(cellX(c) + board.position.x, SLATE_Y + board.position.y, cellZ(r) + board.position.z).project(camera);
      const rect = canvas.getBoundingClientRect();
      return [rect.left + (tmpV.x + 1) / 2 * rect.width, rect.top + (1 - tmpV.y) / 2 * rect.height];
    },
  };

  // ------------------------------------------------------------------ boot
  resize();
  buildLevelGrid();
  levelIndex = clamp(progress.last || 0, 0, LEVELS.length - 1);
  loadLevel(levelIndex);
  openLevels();
  requestAnimationFrame(frame);
})();
