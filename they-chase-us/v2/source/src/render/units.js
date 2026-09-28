import * as THREE from 'three';
import { PALETTE } from '../config.js';

// Procedural stickman renderer. Every body part and armor piece type of a team is one InstancedMesh.
// A pose is computed from a small visual-state object; the same code serves enemies, allies, guards, the player and the boss.
// Look: "My Little Universe"-style toy stickman. A big perfect-sphere head on a short neck, an egg-shaped body,
// thin tube arms and short legs with rounded ends, no face. The body uses a glossy "gummy" shader whose shadows
// shift toward a deeper, more saturated hue instead of grey.
// Rig: the upper body pivots at the hips; legs are thigh + calf with a knee (runs bend the knee, landings kneel).

export const P = { // piece flags
  HELMET: 1, VISOR: 2, CHEST: 4, PAULDRONS: 8, GAUNTLETS: 16, KNEES: 32, CAPE: 64, TRIM: 128, EYES: 256, BOOTS: 512,
  SHIELD: 1024, SPEAR: 2048, DRUM: 4096, BOW: 8192, SWORD: 16384, HOOD: 32768, CROWN: 65536, ICE: 131072, LEGGINGS: 262144,
};
export const PIECE_FLAG = { helmet: P.HELMET, visor: P.VISOR, chest: P.CHEST, pauldrons: P.PAULDRONS, gauntlets: P.GAUNTLETS, knees: P.KNEES, cape: P.CAPE, boots: P.BOOTS, leggings: P.LEGGINGS };

// body parts (gummy shader, character color) are the first 8 entries
const PARTS = ['head', 'torso', 'armL', 'armR', 'legL', 'legR', 'calfL', 'calfR', 'helmet', 'visor', 'chest', 'pauldronL', 'pauldronR', 'gauntletL', 'gauntletR', 'kneeL', 'kneeR', 'cape', 'eyeL', 'eyeR', 'trim', 'shield', 'spear', 'drum', 'bow', 'sword', 'hood', 'crown', 'ice', 'shadow', 'bootL', 'bootR', 'shinL', 'shinR'];
const IDX = {}; PARTS.forEach((n, i) => (IDX[n] = i));
export const PART = IDX;
const BODY_PARTS = 8;

// body proportions (character space, feet at y=0, facing +Z)
const HIP_Y = 0.6, HIP_X = 0.105, SHOULDER_X = 0.19, SHOULDER_Y = 1.0, HEAD_Y = 1.43, HEAD_R = 0.31;
const THIGH = 0.21, CALF = 0.25, ARM = 0.44;

let GEO = null;
function geos() {
  if (GEO) return GEO;
  const cap = (r, l) => { const g = new THREE.CapsuleGeometry(r, l, 6, 14); g.translate(0, -l / 2, 0); return g; };
  const scaled = (g, x, y, z) => { g.scale(x, y, z); return g; };
  // egg body + neck as one surface of revolution; origin at the hip line
  const prof = [[0, -0.11], [0.09, -0.095], [0.155, -0.06], [0.2, -0.01], [0.224, 0.05], [0.232, 0.12], [0.226, 0.2], [0.208, 0.28], [0.18, 0.35], [0.145, 0.41], [0.108, 0.45], [0.085, 0.475], [0.076, 0.5], [0.074, 0.56], [0.05, 0.59], [0, 0.6]];
  const torso = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 28);
  GEO = {
    head: new THREE.SphereGeometry(HEAD_R, 28, 18),
    torso,
    arm: cap(0.06, ARM),
    thigh: cap(0.094, THIGH),
    calf: cap(0.084, CALF),
    helmet: new THREE.SphereGeometry(HEAD_R + 0.035, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.6),
    visor: new THREE.SphereGeometry(HEAD_R + 0.045, 24, 6, Math.PI / 2 - 0.85, 1.7, Math.PI * 0.42, Math.PI * 0.2),
    chest: scaled(new THREE.SphereGeometry(0.245, 22, 14), 1.0, 1.12, 0.96),
    pauldron: scaled(new THREE.SphereGeometry(0.14, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), 1.1, 0.8, 1.1),
    gauntlet: scaled(new THREE.SphereGeometry(0.085, 12, 8), 1, 1.3, 1),
    knee: scaled(new THREE.SphereGeometry(0.105, 12, 8), 1, 1.1, 1),
    cape: (() => { const g = new THREE.CylinderGeometry(0.2, 0.3, 0.62, 18, 1, true, Math.PI - 0.85, 1.7); g.translate(0, -0.31, 0); return g; })(),
    eye: new THREE.SphereGeometry(0.05, 10, 6),
    trim: new THREE.TorusGeometry(HEAD_R + 0.035, 0.03, 8, 24),
    shield: scaled(new THREE.CapsuleGeometry(0.36, 0.4, 8, 16), 1, 1, 0.18),
    spear: new THREE.CylinderGeometry(0.025, 0.025, 2.0, 8),
    drum: (() => { const g = new THREE.CylinderGeometry(0.26, 0.26, 0.36, 20); g.rotateX(Math.PI / 2); return g; })(),
    bow: new THREE.TorusGeometry(0.42, 0.028, 8, 24, Math.PI),
    sword: (() => { const g = new THREE.CapsuleGeometry(0.05, 1.0, 4, 8); g.scale(1, 1, 0.4); g.translate(0, 0.6, 0); return g; })(),
    hood: new THREE.SphereGeometry(HEAD_R + 0.04, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.66),
    crown: new THREE.CylinderGeometry(0.17, 0.15, 0.13, 16, 1, true),
    ice: (() => { const g = new THREE.CapsuleGeometry(0.5, 0.95, 8, 16); g.scale(1, 1, 0.8); g.translate(0, 0.98, 0); return g; })(),
    shadow: (() => { const g = new THREE.CircleGeometry(0.5, 24); g.rotateX(-Math.PI / 2); return g; })(),
    boot: scaled(new THREE.SphereGeometry(0.11, 12, 8), 0.85, 0.6, 1.3),
    shin: new THREE.CylinderGeometry(0.095, 0.088, 0.28, 14),
  };
  return GEO;
}
const PART_GEO = { head: 'head', torso: 'torso', armL: 'arm', armR: 'arm', legL: 'thigh', legR: 'thigh', calfL: 'calf', calfR: 'calf', helmet: 'helmet', visor: 'visor', chest: 'chest', pauldronL: 'pauldron', pauldronR: 'pauldron', gauntletL: 'gauntlet', gauntletR: 'gauntlet', kneeL: 'knee', kneeR: 'knee', cape: 'cape', eyeL: 'eye', eyeR: 'eye', trim: 'trim', shield: 'shield', spear: 'spear', drum: 'drum', bow: 'bow', sword: 'sword', hood: 'hood', crown: 'crown', ice: 'ice', shadow: 'shadow', bootL: 'boot', bootR: 'boot', shinL: 'shin', shinR: 'shin' };
const METAL_PARTS = new Set(['helmet', 'visor', 'chest', 'pauldronL', 'pauldronR', 'gauntletL', 'gauntletR', 'kneeL', 'kneeR', 'shield', 'sword', 'shinL', 'shinR']);

// ---------- gummy toy shader for the body parts ----------
const GUMMY_VERT = /* glsl */`
#include <common>
#include <fog_pars_vertex>
varying vec3 vN;
varying vec3 vW;
varying vec3 vCol;
void main() {
  mat4 m = modelMatrix;
  #ifdef USE_INSTANCING
    m = modelMatrix * instanceMatrix;
  #endif
  vec4 w = m * vec4(position, 1.0);
  vW = w.xyz;
  vN = normalize(mat3(m) * normal);
  vCol = vec3(1.0);
  #ifdef USE_INSTANCING_COLOR
    vCol = instanceColor;
  #endif
  vec4 mvPosition = viewMatrix * w;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const GUMMY_FRAG = /* glsl */`
uniform vec3 uSunDir;
uniform vec3 uSunCol;
varying vec3 vN;
varying vec3 vW;
varying vec3 vCol;
#include <common>
#include <fog_pars_fragment>
void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(cameraPosition - vW);
  vec3 base = vCol;
  // shadow tone: darker and more saturated, hue-shifted (yellow -> orange, green -> deep green), never grey
  vec3 dark = pow(base, vec3(1.75)) * 0.7 + base * 0.05;
  float lit = smoothstep(-0.45, 0.9, dot(N, uSunDir));      // soft wrap light
  vec3 col = mix(dark, base, lit);
  col *= 0.9 + 0.18 * (N.y * 0.5 + 0.5);                     // sky fill from above
  float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 2.2);   // saturated silhouette edges
  col = mix(col, dark * 0.85, fres * 0.55);
  vec3 H = normalize(uSunDir + V);                           // glossy vinyl: broad sheen + small bright highlight
  float nh = max(dot(N, H), 0.0);
  col += uSunCol * (pow(nh, 18.0) * 0.14 + pow(nh, 90.0) * 0.32);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

let MATS = null;
function mats() {
  if (MATS) return MATS;
  const body = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uSunDir: { value: new THREE.Vector3(6, 14, -8).normalize() }, uSunCol: { value: new THREE.Color(0xfff1dc) } }]),
    vertexShader: GUMMY_VERT, fragmentShader: GUMMY_FRAG, fog: true, toneMapped: false, // vivid toy colors, not ACES-flattened
  });
  MATS = {
    body,
    cloth: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.62, metalness: 0.0 }),
    cape: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, metalness: 0.0, side: THREE.DoubleSide }),
    metal: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0.85 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0.9 }),
    eye: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    wood: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 }),
    ice: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.55, depthWrite: false }),
    shadow: new THREE.MeshBasicMaterial({ color: 0x1b2430, transparent: true, opacity: 0.28, depthWrite: false }),
  };
  return MATS;
}
const PART_MAT = { head: 'body', torso: 'body', armL: 'body', armR: 'body', legL: 'body', legR: 'body', calfL: 'body', calfR: 'body', cape: 'cape', eyeL: 'eye', eyeR: 'eye', trim: 'gold', crown: 'gold', spear: 'wood', drum: 'wood', bow: 'wood', hood: 'cloth', ice: 'ice', shadow: 'shadow', bootL: 'cloth', bootR: 'cloth' };

// keep the body shader's key light in sync with the scene sun (direction and sunset color)
export function setCharacterLight(dir, color) {
  const u = mats().body.uniforms;
  u.uSunDir.value.copy(dir).normalize();
  if (color) u.uSunCol.value.copy(color);
}

const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _root = new THREE.Matrix4();
const _upper = new THREE.Matrix4(), _headM = new THREE.Matrix4(), _t1 = new THREE.Matrix4(), _t2 = new THREE.Matrix4();
const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _e = new THREE.Euler();
const _white = new THREE.Color(0xffffff);
const C_RED = new THREE.Color(0xff2a2a), C_GOLD = new THREE.Color(PALETTE.gold), C_WOOD = new THREE.Color(0x5a3a1e), C_FROST = new THREE.Color(PALETTE.frost), C_STEEL = new THREE.Color(PALETTE.steel), C_BOOT = new THREE.Color(0x4a2f1a), C_DRUM = new THREE.Color(0x8a4b2a);
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

// local part transform helper: parent * T(pos) * R(euler) * S(scale)
function local(out, parent, x, y, z, rx, ry, rz, sx = 1, sy = 1, sz = 1) {
  _p.set(x, y, z); _e.set(rx, ry, rz); _q.setFromEuler(_e); _s.set(sx, sy, sz);
  return out.multiplyMatrices(parent, _m2.compose(_p, _q, _s));
}

/**
 * Visual state v: { x,y,z, yaw,pitch,roll, scale, color:Color, metal:Color, phase, run(0..1), armRaise(0..1), aim(0..1), flags:int,
 *                   flash(0..1), squash, fall(0..1 airborne), land(0..1 landing crouch), look(0..1 head up in the crouch) }
 * Writes a Matrix4 per part into out[] (only parts present get `used[i]=true`).
 * Three poses are blended: base (run / idle / aim / raise), mid-air (arms out, one knee tucked) and the superhero landing
 * (right knee and right fist on the ground, left foot planted in front, left arm swept back, head bowed then raised).
 */
export function computePose(v, out, used) {
  for (let i = 0; i < PARTS.length; i++) used[i] = false;
  const sq = v.squash || 0;
  _p.set(v.x, v.y, v.z); _e.set(v.pitch || 0, v.yaw || 0, v.roll || 0); _q.setFromEuler(_e);
  const sc = v.scale || 1; _s.set(sc * (1 + sq), sc * (1 - sq), sc * (1 + sq));
  _root.compose(_p, _q, _s);
  const f = v.flags || 0;
  const wL = clamp01(v.land || 0), wF = clamp01(v.fall || 0) * (1 - wL), wB = Math.max(0, 1 - wL - wF);
  const look = v.look || 0;
  const ph = v.phase || 0, run = (v.run == null ? 1 : v.run) * wB;
  const sn = Math.sin(ph), cs = Math.cos(ph);
  const swing = sn * 0.8 * run;
  const bob = Math.abs(sn) * 0.06 * run;
  const raise = v.armRaise || 0, aim = v.aim || 0;

  // hips + upper-body pivot: lean while running, forward bend in the landing, slight lean back in the air
  const hipY = HIP_Y + bob - 0.26 * wL;
  const pitchU = 0.12 * run + 0.7 * wL - 0.1 * wF;
  _t1.makeTranslation(0, hipY, 0); _t2.makeRotationX(pitchU); _t1.multiply(_t2); _t2.makeTranslation(0, -HIP_Y, 0); _t1.multiply(_t2);
  _upper.multiplyMatrices(_root, _t1);
  const setU = (name, x, y, z, rx = 0, ry = 0, rz = 0) => { const i = IDX[name]; local(out[i], _upper, x, y, z, rx, ry, rz); used[i] = true; };
  const setOn = (name, parent, x, y, z, rx = 0, ry = 0, rz = 0) => { const i = IDX[name]; local(out[i], parent, x, y, z, rx, ry, rz); used[i] = true; };

  // head: bows at impact, then snaps up to look at you before standing
  local(_headM, _upper, 0, HEAD_Y, 0.02, 0.18 * wL - 0.95 * look * wL, 0, 0);
  out[IDX.head].copy(_headM); used[IDX.head] = true;
  setU('torso', 0, HIP_Y, 0);

  // arms: base (swing / raise / aim), mid-air spread, landing (right fist planted, left arm swept back and out)
  let aL = -swing * 0.8, aR = swing * 0.8;
  if (raise > 0) { aL = aL * (1 - raise) - 2.6 * raise; aR = aR * (1 - raise) - 2.6 * raise; }
  if (aim > 0) { aL = aL * (1 - aim) - 1.55 * aim; aR = aR * (1 - aim) - 1.3 * aim; }
  setU('armL', -SHOULDER_X, SHOULDER_Y, 0, aL * wB - 0.35 * wF + 0.6 * wL, 0, 0.16 * wB + 1.25 * wF + 0.8 * wL);
  { // the planted arm stretches a little in the crouch so the fist really reaches the ground (stylized)
    const i = IDX.armR; local(out[i], _upper, SHOULDER_X, SHOULDER_Y - 0.06 * wL, 0, aR * wB - 0.35 * wF - 0.78 * wL, 0, -0.16 * wB - 1.25 * wF - 0.2 * wL, 1, 1 + 0.14 * wL, 1); used[i] = true;
  }

  // legs: thigh + calf. Running bends the knee on the recovery swing; air tucks the left knee; landing kneels on the right.
  const kL = run * (0.15 + 1.15 * Math.max(0, -cs)), kR = run * (0.15 + 1.15 * Math.max(0, cs));
  local(out[IDX.legL], _root, -HIP_X, hipY, 0, swing - 0.9 * wF - 1.5 * wL, 0, 0); used[IDX.legL] = true;
  local(out[IDX.legR], _root, HIP_X, hipY, 0, -swing + 0.25 * wF + 0.15 * wL, 0, 0); used[IDX.legR] = true;
  setOn('calfL', out[IDX.legL], 0, -THIGH, 0, kL + 1.5 * wF + 1.55 * wL);
  setOn('calfR', out[IDX.legR], 0, -THIGH, 0, kR + 0.5 * wF + 1.45 * wL);

  if (f & P.HELMET) setOn('helmet', _headM, 0, 0.01, 0);
  if (f & P.VISOR) setOn('visor', _headM, 0, 0, 0);
  if (f & P.CHEST) setU('chest', 0, 0.84, 0.01);
  if (f & P.PAULDRONS) { setU('pauldronL', -0.2, 1.03, 0, 0, 0, 0.35); setU('pauldronR', 0.2, 1.03, 0, 0, 0, -0.35); }
  if (f & P.GAUNTLETS) { setOn('gauntletL', out[IDX.armL], 0, -0.38, 0); setOn('gauntletR', out[IDX.armR], 0, -0.38, 0); }
  if (f & P.KNEES) { setOn('kneeL', out[IDX.calfL], 0, 0, 0.03); setOn('kneeR', out[IDX.calfR], 0, 0, 0.03); }
  if (f & P.LEGGINGS) { setOn('shinL', out[IDX.calfL], 0, -0.14, 0); setOn('shinR', out[IDX.calfR], 0, -0.14, 0); }
  if (f & P.BOOTS) { setOn('bootL', out[IDX.calfL], 0, -0.3, 0.04); setOn('bootR', out[IDX.calfR], 0, -0.3, 0.04); }
  if (f & P.CAPE) { // world-space target angle minus the upper-body pitch: flutters when running, flares up in the air, drapes in the crouch
    const capeW = (-0.12 - Math.sin(ph * 0.5) * 0.08 * run - 0.12 * run) * wB - 1.2 * wF + 0.6 * wL;
    setU('cape', 0, 1.03, -0.06, capeW - pitchU);
  }
  if (f & P.EYES) { setOn('eyeL', _headM, -0.1, 0.02, 0.28); setOn('eyeR', _headM, 0.1, 0.02, 0.28); }
  if (f & P.TRIM) setOn('trim', _headM, 0, -0.06, 0, Math.PI / 2);
  if (f & P.SHIELD) setU('shield', -0.14, 0.8, 0.36);
  if (f & P.SPEAR) setOn('spear', out[IDX.armR], 0.07, -0.38, 0.18, Math.PI / 2 - 0.3);
  if (f & P.DRUM) setU('drum', 0, 0.74, 0.3);
  if (f & P.BOW) setOn('bow', out[IDX.armL], 0, -0.44, 0.05, 0, Math.PI / 2, 0);
  if (f & P.SWORD) setOn('sword', out[IDX.armR], 0, -0.44, 0.05, raise > 0.5 ? -0.3 : -1.4);
  if (f & P.HOOD) setOn('hood', _headM, 0, 0, -0.04, -0.15);
  if (f & P.CROWN) setOn('crown', _headM, 0, HEAD_R, 0);
  if (f & P.ICE) setOn('ice', _root, 0, 0, 0);
  // shadow: flat at ground, unaffected by pitch/roll or bob
  {
    const i = IDX.shadow; _p.set(v.x, 0.015, v.z); _q.identity(); const ss = sc * (v.shadowScale || 1); _s.set(ss, 1, ss);
    out[i].compose(_p, _q, _s); used[i] = true;
  }
}

export class TeamRenderer {
  /**
   * @param scene THREE.Scene
   * @param opts { capacity, parts: array of part names to allocate (default all), castShadow, blobShadow, debrisExtra }
   */
  constructor(scene, opts) {
    const g = geos(), m = mats();
    this.capacity = opts.capacity;
    this.parts = opts.parts || PARTS.slice();
    this.meshes = new Array(PARTS.length).fill(null);
    this.counts = new Int32Array(PARTS.length);
    this.group = new THREE.Group(); scene.add(this.group);
    for (const name of this.parts) {
      if (name === 'shadow' && opts.blobShadow === false) continue;
      const geo = g[PART_GEO[name]];
      const matName = PART_MAT[name] || (METAL_PARTS.has(name) ? 'metal' : 'cloth');
      const cap = (name === 'shadow') ? this.capacity : this.capacity + (opts.debrisExtra || 0);
      const im = new THREE.InstancedMesh(geo, m[matName], cap);
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      im.castShadow = !!opts.castShadow && name !== 'shadow' && name !== 'ice';
      im.receiveShadow = false;
      im.frustumCulled = false;
      im.count = 0;
      im.setColorAt(0, _white);
      im.instanceColor.setUsage(THREE.DynamicDrawUsage);
      if (name === 'ice') im.renderOrder = 5;
      this.meshes[IDX[name]] = im; this.group.add(im);
    }
    this.mats = new Array(PARTS.length); for (let i = 0; i < PARTS.length; i++) this.mats[i] = new THREE.Matrix4();
    this.used = new Array(PARTS.length).fill(false);
  }

  begin() { this.counts.fill(0); }

  _push(i, matrix, color) {
    const im = this.meshes[i]; if (!im) return;
    const n = this.counts[i]; if (n >= im.instanceMatrix.count) return;
    im.setMatrixAt(n, matrix); im.setColorAt(n, color); this.counts[i] = n + 1;
  }

  draw(v) {
    computePose(v, this.mats, this.used);
    const flash = v.flash || 0;
    const cloth = _cCloth.copy(v.color); if (flash > 0) cloth.lerp(_white, flash);
    const metal = _cMetal.copy(v.metal || C_STEEL); if (flash > 0) metal.lerp(_white, flash);
    const hood = _cHood.copy(v.color).multiplyScalar(0.8); if (flash > 0) hood.lerp(_white, flash);
    if (v.frozen) { cloth.lerp(C_FROST, 0.35); }
    for (let i = 0; i < PARTS.length; i++) {
      if (!this.used[i] || !this.meshes[i]) continue;
      const name = PARTS[i];
      let col;
      if (i < BODY_PARTS) col = cloth;
      else if (METAL_PARTS.has(name)) col = name === 'sword' ? C_STEEL : metal;
      else if (name === 'eyeL' || name === 'eyeR') col = C_RED;
      else if (name === 'trim' || name === 'crown') col = C_GOLD;
      else if (name === 'spear') col = C_WOOD;
      else if (name === 'bow') col = v.bowColor || C_WOOD;
      else if (name === 'drum') col = C_DRUM;
      else if (name === 'hood') col = hood;
      else if (name === 'cape') col = v.capeColor || _cCape.copy(v.color).multiplyScalar(0.6);
      else if (name === 'bootL' || name === 'bootR') col = C_BOOT;
      else if (name === 'ice') col = C_FROST;
      else if (name === 'shadow') col = _white;
      else col = cloth;
      this._push(i, this.mats[i], col);
    }
  }

  // debris: { part: 'helmet'|'chest'|..., x,y,z, rx,ry,rz, scale, metal:Color, side }
  drawDebris(d) {
    let name = d.part;
    if (name === 'pauldrons') name = d.side < 0 ? 'pauldronL' : 'pauldronR';
    else if (name === 'gauntlets') name = d.side < 0 ? 'gauntletL' : 'gauntletR';
    else if (name === 'knees') name = d.side < 0 ? 'kneeL' : 'kneeR';
    else if (name === 'boots') name = d.side < 0 ? 'bootL' : 'bootR';
    const i = IDX[name]; if (i == null || !this.meshes[i]) return;
    _p.set(d.x, d.y, d.z); _e.set(d.rx, d.ry, d.rz); _q.setFromEuler(_e); _s.set(d.scale, d.scale, d.scale);
    this._push(i, _m.compose(_p, _q, _s), d.metal || C_STEEL);
  }

  end() {
    for (let i = 0; i < PARTS.length; i++) {
      const im = this.meshes[i]; if (!im) continue;
      im.count = this.counts[i];
      if (im.count > 0) { im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; }
    }
  }

  setVisible(v) { this.group.visible = v; }
}
const _cCloth = new THREE.Color(), _cMetal = new THREE.Color(), _cHood = new THREE.Color(), _cCape = new THREE.Color();

export function piecesToFlags(pieces) { let f = 0; for (const p of pieces) f |= PIECE_FLAG[p] || 0; return f; }
export const ALL_PARTS = PARTS;
