import * as THREE from 'three';
import { PALETTE, CONFIG } from '../config.js';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';

const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _c = new THREE.Color();
const _up = new THREE.Vector3(0, 1, 0), _dir = new THREE.Vector3(), _tmp = new THREE.Vector3();

// ---------------- particles ----------------
export class Particles {
  constructor(scene, cap) {
    this.cap = cap; this.n = 0;
    this.x = new Float32Array(cap); this.y = new Float32Array(cap); this.z = new Float32Array(cap);
    this.vx = new Float32Array(cap); this.vy = new Float32Array(cap); this.vz = new Float32Array(cap);
    this.life = new Float32Array(cap); this.max = new Float32Array(cap); this.size = new Float32Array(cap);
    this.grav = new Float32Array(cap); this.drag = new Float32Array(cap);
    this.col = new Float32Array(cap * 3);
    this.rot = new Float32Array(cap);
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, emissive: 0x222222 }), cap);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.setColorAt(0, _c.set(1, 1, 1)); this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false; this.mesh.count = 0; this.mesh.castShadow = false;
    scene.add(this.mesh);
    this.budget = cap;
  }
  emit(x, y, z, vx, vy, vz, life, size, color, grav = 9, drag = 1.5) {
    if (this.n >= Math.min(this.cap, this.budget)) return;
    const i = this.n++;
    this.x[i] = x; this.y[i] = y; this.z[i] = z; this.vx[i] = vx; this.vy[i] = vy; this.vz[i] = vz;
    this.life[i] = life; this.max[i] = life; this.size[i] = size; this.grav[i] = grav; this.drag[i] = drag;
    _c.set(color); this.col[i * 3] = _c.r; this.col[i * 3 + 1] = _c.g; this.col[i * 3 + 2] = _c.b;
    this.rot[i] = Math.random() * 6.28;
  }
  burst(x, y, z, n, color, speed = 4, size = 0.12, life = 0.5, grav = 9, up = 0.5) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, r = speed * (0.4 + Math.random() * 0.6);
      this.emit(x, y, z, Math.cos(a) * r, (Math.random() * 0.6 + up) * speed, Math.sin(a) * r, life * (0.6 + Math.random() * 0.6), size * (0.6 + Math.random() * 0.7), color, grav);
    }
  }
  dust(x, z, n = 5, color = 0xe8e0d0) { for (let i = 0; i < n; i++) this.emit(x + (Math.random() - .5) * 0.5, 0.1, z + (Math.random() - .5) * 0.5, (Math.random() - .5) * 1.5, Math.random() * 1.2 + 0.4, (Math.random() - .5) * 1.5, 0.45, 0.16, color, 1, 2.5); }
  update(dt) {
    let i = 0;
    while (i < this.n) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) { // swap remove
        const j = --this.n;
        if (i !== j) {
          this.x[i] = this.x[j]; this.y[i] = this.y[j]; this.z[i] = this.z[j]; this.vx[i] = this.vx[j]; this.vy[i] = this.vy[j]; this.vz[i] = this.vz[j];
          this.life[i] = this.life[j]; this.max[i] = this.max[j]; this.size[i] = this.size[j]; this.grav[i] = this.grav[j]; this.drag[i] = this.drag[j]; this.rot[i] = this.rot[j];
          this.col[i * 3] = this.col[j * 3]; this.col[i * 3 + 1] = this.col[j * 3 + 1]; this.col[i * 3 + 2] = this.col[j * 3 + 2];
        }
        continue;
      }
      const d = Math.max(0, 1 - this.drag[i] * dt);
      this.vx[i] *= d; this.vz[i] *= d; this.vy[i] = this.vy[i] * d - this.grav[i] * dt;
      this.x[i] += this.vx[i] * dt; this.y[i] += this.vy[i] * dt; this.z[i] += this.vz[i] * dt;
      if (this.y[i] < 0.03 && this.grav[i] > 0) { this.y[i] = 0.03; this.vy[i] *= -0.3; this.vx[i] *= 0.7; this.vz[i] *= 0.7; }
      this.rot[i] += dt * 4;
      i++;
    }
  }
  render() {
    const m = this.mesh;
    for (let i = 0; i < this.n; i++) {
      const t = this.life[i] / this.max[i];
      const s = this.size[i] * (t < 0.3 ? t / 0.3 : 1);
      _p.set(this.x[i], this.y[i], this.z[i]); _q.setFromAxisAngle(_up, this.rot[i]); _s.set(s, s, s);
      m.setMatrixAt(i, _m.compose(_p, _q, _s));
      _c.setRGB(this.col[i * 3], this.col[i * 3 + 1], this.col[i * 3 + 2]); m.setColorAt(i, _c);
    }
    m.count = this.n;
    if (this.n) { m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; }
  }
  clear() { this.n = 0; this.mesh.count = 0; }
}

// ---------------- glyph atlas for damage numbers ----------------
const GLYPHS = '0123456789+-×%!.KM';
function glyphAtlas() {
  const cell = 64, c = document.createElement('canvas'); c.width = cell * GLYPHS.length; c.height = 96;
  const g = c.getContext('2d');
  g.font = `bold 66px "Lilita One", "Arial Black", Impact, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let i = 0; i < GLYPHS.length; i++) {
    const x = i * cell + cell / 2;
    g.lineWidth = 9; g.strokeStyle = '#1b2430'; g.lineJoin = 'round'; g.strokeText(GLYPHS[i], x, 50);
    g.fillStyle = '#ffffff'; g.fillText(GLYPHS[i], x, 50);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
  return t;
}

export class DamageNumbers {
  constructor(scene, capGlyphs) {
    this.cap = capGlyphs;
    this.tex = glyphAtlas();
    const base = new THREE.PlaneGeometry(1, 1);
    const geo = new THREE.InstancedBufferGeometry(); geo.index = base.index; geo.attributes.position = base.attributes.position; geo.attributes.uv = base.attributes.uv;
    this.aPos = new THREE.InstancedBufferAttribute(new Float32Array(capGlyphs * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aGlyph = new THREE.InstancedBufferAttribute(new Float32Array(capGlyphs * 2), 2).setUsage(THREE.DynamicDrawUsage);
    this.aColor = new THREE.InstancedBufferAttribute(new Float32Array(capGlyphs * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aAnim = new THREE.InstancedBufferAttribute(new Float32Array(capGlyphs * 2), 2).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aPos', this.aPos); geo.setAttribute('aGlyph', this.aGlyph); geo.setAttribute('aColor', this.aColor); geo.setAttribute('aAnim', this.aAnim);
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: this.tex }, camRight: { value: new THREE.Vector3(1, 0, 0) }, camUp: { value: new THREE.Vector3(0, 1, 0) }, nGlyph: { value: GLYPHS.length } },
      vertexShader: `attribute vec3 aPos; attribute vec2 aGlyph; attribute vec3 aColor; attribute vec2 aAnim;
        uniform vec3 camRight; uniform vec3 camUp; uniform float nGlyph;
        varying vec2 vUv; varying vec3 vColor; varying float vAlpha;
        void main(){ float cell = 1.0/nGlyph; vUv = vec2((uv.x)*cell + aGlyph.x*cell, uv.y);
          float w = 0.42*aAnim.x, h = 0.62*aAnim.x;
          vec3 world = aPos + camRight*((position.x + aGlyph.y)*w) + camUp*(position.y*h);
          vColor = aColor; vAlpha = aAnim.y; gl_Position = projectionMatrix * viewMatrix * vec4(world,1.0); }`,
      fragmentShader: `uniform sampler2D map; varying vec2 vUv; varying vec3 vColor; varying float vAlpha;
        void main(){ vec4 t = texture2D(map, vUv); if (t.a < 0.02) discard; gl_FragColor = vec4(t.rgb*vColor, t.a*vAlpha); }`,
      transparent: true, depthWrite: false, depthTest: false,
    });
    this.mesh = new THREE.Mesh(geo, mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 20;
    geo.instanceCount = 0;
    scene.add(this.mesh);
    this.items = []; // { x,y,z, vy, t, life, scale, color:Color, glyphs:[], w }
    this.geo = geo;
  }
  spawn(x, y, z, text, color, big = 1) {
    if (this.items.length > 70) this.items.shift();
    const glyphs = [];
    for (const ch of text) { const gi = GLYPHS.indexOf(ch); if (gi >= 0) glyphs.push(gi); }
    this.items.push({ x, y, z, vx: (Math.random() - .5) * 1.2, vy: 2.6, t: 0, life: 0.75, scale: big, color: new THREE.Color(color), glyphs });
  }
  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i]; it.t += dt; if (it.t >= it.life) { this.items.splice(i, 1); continue; }
      it.y += it.vy * dt; it.x += it.vx * dt; it.vy -= 4.5 * dt;
    }
  }
  render(camera) {
    const mat = this.mesh.material; camera.matrixWorld.extractBasis(mat.uniforms.camRight.value, mat.uniforms.camUp.value, _tmp);
    let n = 0;
    const pos = this.aPos.array, gl = this.aGlyph.array, col = this.aColor.array, an = this.aAnim.array;
    for (const it of this.items) {
      const u = it.t / it.life;
      const pop = u < 0.15 ? 0.6 + (u / 0.15) * 0.7 : u < 0.3 ? 1.3 - ((u - 0.15) / 0.15) * 0.3 : 1;
      const scale = pop * it.scale;
      const alpha = u > 0.65 ? 1 - (u - 0.65) / 0.35 : 1;
      const len = it.glyphs.length, off = -(len - 1) / 2;
      for (let k = 0; k < len && n < this.cap; k++) {
        pos[n * 3] = it.x; pos[n * 3 + 1] = it.y; pos[n * 3 + 2] = it.z;
        gl[n * 2] = it.glyphs[k]; gl[n * 2 + 1] = off + k;
        col[n * 3] = it.color.r; col[n * 3 + 1] = it.color.g; col[n * 3 + 2] = it.color.b;
        an[n * 2] = scale; an[n * 2 + 1] = alpha; n++;
      }
    }
    this.geo.instanceCount = n;
    if (n) { this.aPos.needsUpdate = true; this.aGlyph.needsUpdate = true; this.aColor.needsUpdate = true; this.aAnim.needsUpdate = true; }
  }
  clear() { this.items.length = 0; this.geo.instanceCount = 0; }
}

// ---------------- HP bars (instanced billboards) ----------------
export class HpBars {
  constructor(scene, cap) {
    this.cap = cap;
    const base = new THREE.PlaneGeometry(1, 1);
    const geo = new THREE.InstancedBufferGeometry(); geo.index = base.index; geo.attributes.position = base.attributes.position; geo.attributes.uv = base.attributes.uv;
    this.aPos = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aData = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4).setUsage(THREE.DynamicDrawUsage); // fill, lost, alpha, width
    geo.setAttribute('aPos', this.aPos); geo.setAttribute('aData', this.aData);
    const mat = new THREE.ShaderMaterial({
      uniforms: { camRight: { value: new THREE.Vector3(1, 0, 0) }, camUp: { value: new THREE.Vector3(0, 1, 0) } },
      vertexShader: `attribute vec3 aPos; attribute vec4 aData; uniform vec3 camRight; uniform vec3 camUp; varying vec2 vUv; varying vec4 vData;
        void main(){ vUv = uv; vData = aData; vec3 world = aPos + camRight*(position.x*aData.w) + camUp*(position.y*0.14); gl_Position = projectionMatrix * viewMatrix * vec4(world,1.0); }`,
      fragmentShader: `varying vec2 vUv; varying vec4 vData;
        void main(){ vec3 c = vec3(0.12,0.14,0.18); float bx = 0.025/vData.w; if (vUv.x > bx && vUv.x < 1.0-bx && vUv.y > 0.16 && vUv.y < 0.84) {
          float x = (vUv.x - bx)/(1.0-2.0*bx); c = x < vData.x ? vec3(0.92,0.2,0.16) : (x < vData.y ? vec3(1.0,0.85,0.25) : vec3(0.28,0.3,0.34)); }
          gl_FragColor = vec4(c, vData.z); }`,
      transparent: true, depthWrite: false, depthTest: false,
    });
    this.mesh = new THREE.Mesh(geo, mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 19; geo.instanceCount = 0;
    scene.add(this.mesh); this.geo = geo; this.n = 0;
  }
  begin(camera) { this.n = 0; camera.matrixWorld.extractBasis(this.mesh.material.uniforms.camRight.value, this.mesh.material.uniforms.camUp.value, _tmp); }
  add(x, y, z, fill, lost, alpha, width = 1.1) {
    if (this.n >= this.cap) return; const n = this.n++;
    this.aPos.array[n * 3] = x; this.aPos.array[n * 3 + 1] = y; this.aPos.array[n * 3 + 2] = z;
    this.aData.array[n * 4] = fill; this.aData.array[n * 4 + 1] = lost; this.aData.array[n * 4 + 2] = alpha; this.aData.array[n * 4 + 3] = width;
  }
  end() { this.geo.instanceCount = this.n; if (this.n) { this.aPos.needsUpdate = true; this.aData.needsUpdate = true; } }
}

// ---------------- danger zones (flat red rects) ----------------
export class DangerZones {
  constructor(scene, cap = 32) {
    const geo = new THREE.PlaneGeometry(1, 1); geo.rotateX(-Math.PI / 2);
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, depthWrite: false }), cap);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.mesh.setColorAt(0, _c.set(1, 1, 1)); this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false; this.mesh.count = 0; this.mesh.renderOrder = 2; scene.add(this.mesh); this.n = 0; this.cap = cap;
  }
  begin() { this.n = 0; }
  rect(x, z, w, l, color = PALETTE.danger, y = 0.03) {
    if (this.n >= this.cap) return; _p.set(x, y, z); _q.identity(); _s.set(w, 1, l);
    this.mesh.setMatrixAt(this.n, _m.compose(_p, _q, _s)); this.mesh.setColorAt(this.n, _c.set(color)); this.n++;
  }
  end() { this.mesh.count = this.n; if (this.n) { this.mesh.instanceMatrix.needsUpdate = true; this.mesh.instanceColor.needsUpdate = true; } }
}

// ---------------- aim guide: one fat dashed ground line + landing ring per arrow of the volley ----------------
export class AimLine {
  constructor(scene) {
    this.N = 24; this.MAX = 7;
    const mkMat = (color) => new LineMaterial({ color, linewidth: 5, dashed: true, dashSize: 0.5, gapSize: 0.3, transparent: true, opacity: 0.92, depthTest: true, depthWrite: false });
    this.matDark = mkMat(0x232830); this.matLock = mkMat(0xd8352b);
    this.lines = [];
    for (let i = 0; i < this.MAX; i++) {
      const geo = new LineGeometry(); geo.setPositions(new Float32Array(this.N * 3));
      const l = new Line2(geo, this.matDark); l.frustumCulled = false; l.renderOrder = 15; l.visible = false; scene.add(l); this.lines.push(l);
    }
    this.pos = new Float32Array(this.N * 3);
    const ringMat = () => new THREE.MeshBasicMaterial({ color: 0x232830, transparent: true, opacity: 0.85, depthTest: false, side: THREE.DoubleSide });
    const fillMat = () => new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, depthTest: false });
    // main ring (center arrow; shows the blast radius when owned)
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.7, 1, 40), ringMat()); this.ring.rotation.x = -Math.PI / 2; this.ring.renderOrder = 15; this.ring.visible = false; scene.add(this.ring);
    this.ringInner = new THREE.Mesh(new THREE.CircleGeometry(0.7, 40), fillMat()); this.ringInner.rotation.x = -Math.PI / 2; this.ringInner.renderOrder = 14; this.ringInner.visible = false; scene.add(this.ringInner);
    this.dot = new THREE.Mesh(new THREE.CircleGeometry(0.12, 16), ringMat()); this.dot.rotation.x = -Math.PI / 2; this.dot.renderOrder = 16; this.dot.visible = false; scene.add(this.dot);
    // small rings for the side arrows
    this.side = [];
    for (let i = 0; i < this.MAX - 1; i++) {
      const r = new THREE.Mesh(new THREE.RingGeometry(0.62, 1, 32), ringMat()); r.rotation.x = -Math.PI / 2; r.renderOrder = 15; r.visible = false; r.scale.set(0.3, 0.3, 1); scene.add(r);
      const f = new THREE.Mesh(new THREE.CircleGeometry(0.62, 32), fillMat()); f.rotation.x = -Math.PI / 2; f.renderOrder = 14; f.visible = false; f.scale.set(0.3, 0.3, 1); scene.add(f);
      this.side.push({ r, f });
    }
  }
  setResolution(w, h) { this.matDark.resolution.set(w, h); this.matLock.resolution.set(w, h); }
  // start: Vector3 on the ground in front of the feet; ends: [{ x, z, locked }] with the center arrow first
  show(start, ends, radius, atMax, time) {
    const a = this.pos;
    for (let i = 0; i < this.MAX; i++) {
      const l = this.lines[i], e = ends[i];
      if (!e) { l.visible = false; continue; }
      for (let k = 0; k < this.N; k++) { const t = k / (this.N - 1); a[k * 3] = start.x + (e.x - start.x) * t; a[k * 3 + 1] = start.y; a[k * 3 + 2] = start.z + (e.z - start.z) * t; }
      l.geometry.setPositions(a); l.computeLineDistances(); l.material = e.locked ? this.matLock : this.matDark; l.visible = true;
    }
    const c = ends[0]; const col = c.locked ? 0xd8352b : 0x232830;
    const pulse = atMax ? 1 + 0.12 * Math.sin(time * 14) : 1; const r = radius * pulse;
    this.ring.material.color.set(col); this.dot.material.color.set(col);
    this.ring.position.set(c.x, 0.045, c.z); this.ring.scale.set(r, r, 1); this.ringInner.position.set(c.x, 0.04, c.z); this.ringInner.scale.set(r, r, 1); this.dot.position.set(c.x, 0.05, c.z);
    this.ring.visible = true; this.ringInner.visible = true; this.dot.visible = true;
    for (let i = 0; i < this.side.length; i++) {
      const s = this.side[i], e = ends[i + 1];
      if (!e) { s.r.visible = false; s.f.visible = false; continue; }
      s.r.material.color.set(e.locked ? 0xd8352b : 0x232830); s.r.position.set(e.x, 0.045, e.z); s.f.position.set(e.x, 0.04, e.z); s.r.visible = true; s.f.visible = true;
    }
  }
  // v2: a dashed arc at the auto-attack reach, opening toward the chasers (+Z)
  showArc(cx, cz, R, hot, halfRoad = 3.65) {
    if (!this.matArc) {
      const mk = (op) => new LineMaterial({ color: 0x232830, linewidth: 2.2, dashed: true, dashSize: 0.35, gapSize: 0.35, transparent: true, opacity: op, depthTest: true, depthWrite: false });
      this.matArc = mk(0.32); this.matArcHot = mk(0.55);
    }
    this.matArc.resolution.copy(this.matDark.resolution); this.matArcHot.resolution.copy(this.matDark.resolution);
    // angular span limited so the arc stays on the road: cx + R*sin(t) within +-halfRoad
    const lim = (x) => Math.asin(Math.max(-1, Math.min(1, x / R)));
    const t0 = Math.max(-1.1, lim(-halfRoad - cx)), t1 = Math.min(1.1, lim(halfRoad - cx));
    const a = this.pos, l = this.lines[0];
    for (let k = 0; k < this.N; k++) { const t = t0 + (t1 - t0) * k / (this.N - 1); a[k * 3] = cx + R * Math.sin(t); a[k * 3 + 1] = 0.05; a[k * 3 + 2] = cz + R * Math.cos(t); }
    l.geometry.setPositions(a); l.computeLineDistances(); l.material = hot ? this.matArcHot : this.matArc; l.visible = t1 > t0;
    for (let i = 1; i < this.MAX; i++) this.lines[i].visible = false;
    this.ring.visible = false; this.ringInner.visible = false; this.dot.visible = false; for (const s of this.side) { s.r.visible = false; s.f.visible = false; }
  }
  hide() { for (const l of this.lines) l.visible = false; this.ring.visible = false; this.ringInner.visible = false; this.dot.visible = false; for (const s of this.side) { s.r.visible = false; s.f.visible = false; } }
}

// ---------------- arrows ----------------
// dark rounded shaft + bright fletching (two instanced meshes) so arrows read on the light road
export class ArrowRenderer {
  constructor(scene, cap) {
    const shaft = new THREE.CylinderGeometry(0.035, 0.035, 0.85, 8); shaft.rotateX(Math.PI / 2);
    const fletch = new THREE.BoxGeometry(0.16, 0.05, 0.22); fletch.translate(0, 0, -0.3);
    const mk = (geo, mat) => { const m = new THREE.InstancedMesh(geo, mat, cap); m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.setColorAt(0, _c.set(1, 1, 1)); m.instanceColor.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; m.count = 0; scene.add(m); return m; };
    this.shaft = mk(shaft, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 }));
    this.fletch = mk(fletch, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, emissive: 0x222222 }));
    this.n = 0; this.cap = cap;
  }
  begin() { this.n = 0; }
  add(x, y, z, dx, dy, dz, color) {
    if (this.n >= this.cap) return;
    _p.set(x, y, z); _dir.set(dx, dy, dz).normalize(); _q.setFromUnitVectors(_fwd, _dir); _s.set(1, 1, 1);
    _m.compose(_p, _q, _s);
    this.shaft.setMatrixAt(this.n, _m); this.fletch.setMatrixAt(this.n, _m);
    _c.set(color); this.fletch.setColorAt(this.n, _c);
    _c.multiplyScalar(0.3); this.shaft.setColorAt(this.n, _c);
    this.n++;
  }
  end() { for (const m of [this.shaft, this.fletch]) { m.count = this.n; if (this.n) { m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; } } }
}
const _fwd = new THREE.Vector3(0, 0, 1);

// ---------------- lightning bolts ----------------
export class Lightning {
  constructor(scene, maxSegs = 400) {
    this.max = maxSegs;
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(maxSegs * 6), 3));
    this.lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: PALETTE.lightning, transparent: true, opacity: 0.95, depthTest: false }));
    this.lines.frustumCulled = false; this.lines.renderOrder = 16; scene.add(this.lines);
    this.bolts = []; // { pts: Float32Array, life }
  }
  add(ax, ay, az, bx, by, bz) {
    const segs = 6, pts = new Float32Array(segs * 6);
    let px = ax, py = ay, pz = az;
    for (let i = 0; i < segs; i++) {
      const t = (i + 1) / segs, j = i === segs - 1 ? 0 : 0.35;
      const nx = ax + (bx - ax) * t + (Math.random() - .5) * j, ny = ay + (by - ay) * t + (Math.random() - .5) * j + (i < segs - 1 ? 0.2 : 0), nz = az + (bz - az) * t + (Math.random() - .5) * j;
      pts.set([px, py, pz, nx, ny, nz], i * 6); px = nx; py = ny; pz = nz;
    }
    this.bolts.push({ pts, life: 0.16 });
  }
  update(dt) { for (let i = this.bolts.length - 1; i >= 0; i--) { this.bolts[i].life -= dt; if (this.bolts[i].life <= 0) this.bolts.splice(i, 1); } }
  render() {
    const a = this.lines.geometry.attributes.position.array; let n = 0;
    for (const b of this.bolts) { if (n + b.pts.length > a.length) break; a.set(b.pts, n); n += b.pts.length; }
    this.lines.geometry.setDrawRange(0, n / 3); this.lines.geometry.attributes.position.needsUpdate = true; this.lines.visible = n > 0;
  }
  clear() { this.bolts.length = 0; }
}

// ---------------- spears (enemy projectiles) ----------------
export class SpearRenderer {
  constructor(scene, cap = 8) {
    const geo = new THREE.CylinderGeometry(0.035, 0.035, 2.2, 6); geo.rotateX(Math.PI / 2);
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 0.8 }), cap);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.mesh.frustumCulled = false; this.mesh.count = 0; scene.add(this.mesh); this.n = 0; this.cap = cap;
  }
  begin() { this.n = 0; }
  add(x, y, z, dx, dy, dz) { if (this.n >= this.cap) return; _p.set(x, y, z); _dir.set(dx, dy, dz).normalize(); _q.setFromUnitVectors(_fwd, _dir); _s.set(1, 1, 1); this.mesh.setMatrixAt(this.n++, _m.compose(_p, _q, _s)); }
  end() { this.mesh.count = this.n; if (this.n) this.mesh.instanceMatrix.needsUpdate = true; }
}

// ---------------- caltrops ----------------
export class CaltropRenderer {
  constructor(scene, cap = 120) {
    this.mesh = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(0.14), new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.5, metalness: 0.6 }), cap);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.mesh.frustumCulled = false; this.mesh.count = 0; scene.add(this.mesh); this.n = 0; this.cap = cap;
  }
  begin() { this.n = 0; }
  patch(x, z, seed) { // 10 spikes scattered around (x,z)
    for (let i = 0; i < 10 && this.n < this.cap; i++) {
      const a = seed * 7.1 + i * 2.39, r = 0.25 + ((i * 37 + seed * 11) % 10) / 10 * 0.9;
      _p.set(x + Math.cos(a) * r, 0.1, z + Math.sin(a) * r); _q.setFromAxisAngle(_up, a); _s.set(1, 1, 1);
      this.mesh.setMatrixAt(this.n++, _m.compose(_p, _q, _s));
    }
  }
  end() { this.mesh.count = this.n; if (this.n) this.mesh.instanceMatrix.needsUpdate = true; }
}

// ---------------- landing shockwaves: expanding fading ground rings ----------------
export class Shockwaves {
  constructor(scene, cap = 14) {
    this.items = [];
    const geo = new THREE.RingGeometry(0.72, 1, 36); geo.rotateX(-Math.PI / 2);
    for (let i = 0; i < cap; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xbfb39c, transparent: true, opacity: 0, depthWrite: false }));
      m.visible = false; m.renderOrder = 3; scene.add(m); this.items.push({ m, t: 1, dur: 0.45, size: 2 });
    }
  }
  spawn(x, z, size = 2.2) {
    const it = this.items.find((s) => s.t >= s.dur) || this.items[0];
    it.t = 0; it.size = size; it.m.position.set(x, 0.03, z); it.m.visible = true;
  }
  update(dt) {
    for (const it of this.items) {
      if (it.t >= it.dur) { it.m.visible = false; continue; }
      it.t += dt; const u = Math.min(1, it.t / it.dur); const s = it.size * (0.25 + 0.75 * Math.sqrt(u));
      it.m.scale.set(s, 1, s); it.m.material.opacity = 0.6 * (1 - u);
    }
  }
}

// ---------------- ground cracks: star decals under landings, fading out (per-instance alpha via instanceColor.r) ----------------
function crackTexture() {
  const S = 256, cv = document.createElement('canvas'); cv.width = S; cv.height = S;
  const g = cv.getContext('2d'); g.translate(S / 2, S / 2); g.lineCap = 'round';
  const grd = g.createRadialGradient(0, 0, 4, 0, 0, 56); grd.addColorStop(0, 'rgba(70,62,52,0.55)'); grd.addColorStop(1, 'rgba(70,62,52,0)');
  g.fillStyle = grd; g.beginPath(); g.arc(0, 0, 56, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(52,46,40,0.95)';
  const crack = (a, r0, len, w0) => {
    let r = r0, x = Math.cos(a) * r, y = Math.sin(a) * r;
    while (r < len) {
      const r1 = r + 9 + Math.random() * 10; a += (Math.random() - 0.5) * 0.5;
      const x1 = Math.cos(a) * r1, y1 = Math.sin(a) * r1;
      g.lineWidth = Math.max(1.2, w0 * (1 - r / len)); g.beginPath(); g.moveTo(x, y); g.lineTo(x1, y1); g.stroke();
      if (Math.random() < 0.18 && w0 > 2) crack(a + (Math.random() < 0.5 ? 0.6 : -0.6), r1, r1 + (len - r1) * 0.6, w0 * 0.5);
      x = x1; y = y1; r = r1;
    }
  };
  for (let i = 0; i < 9; i++) crack((i / 9) * Math.PI * 2 + (Math.random() - 0.5) * 0.4, 8, 72 + Math.random() * 48, 6);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export class GroundCracks {
  constructor(scene, cap = 40) {
    const geo = new THREE.PlaneGeometry(1, 1); geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ map: crackTexture(), transparent: true, depthWrite: false });
    mat.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', 'diffuseColor.a *= vColor.r;'); };
    this.mesh = new THREE.InstancedMesh(geo, mat, cap); this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.setColorAt(0, _c.setRGB(1, 1, 1)); this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false; this.mesh.count = 0; this.mesh.renderOrder = 2; scene.add(this.mesh);
    this.items = []; this.cap = cap;
  }
  spawn(x, z, size) { if (this.items.length >= this.cap) this.items.shift(); this.items.push({ x, z, size, rot: Math.random() * Math.PI * 2, t: 0, life: 1.5 }); }
  update(dt) { for (let i = this.items.length - 1; i >= 0; i--) { const it = this.items[i]; it.t += dt; if (it.t >= it.life) this.items.splice(i, 1); } }
  render() {
    const m = this.mesh; let n = 0;
    for (const it of this.items) {
      const u = it.t / it.life, a = u < 0.55 ? 1 : 1 - (u - 0.55) / 0.45, grow = 0.8 + 0.2 * Math.min(1, it.t / 0.06);
      _p.set(it.x, 0.02, it.z); _q.setFromAxisAngle(_up, it.rot); _s.set(it.size * grow, 1, it.size * grow);
      m.setMatrixAt(n, _m.compose(_p, _q, _s)); m.setColorAt(n, _c.setRGB(a * 0.9, 1, 1)); n++;
    }
    m.count = n; if (n) { m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; }
  }
  clear() { this.items.length = 0; this.mesh.count = 0; }
}

export const COLORS = {
  normal: 0xffffff, crit: PALETTE.crit, frost: PALETTE.frost, fire: PALETTE.fire, lightning: PALETTE.lightning, heal: 0x7cf29a, hurt: 0xff5a5a,
};
