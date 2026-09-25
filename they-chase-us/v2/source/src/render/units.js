import * as THREE from 'three';
import { PALETTE } from '../config.js';

// Procedural stickman renderer. Every body part and armor piece type of a team is one InstancedMesh.
// A pose is computed from a small visual-state object; the same code serves enemies, allies, guards, the player and the boss.
// Shapes are soft (spheres / capsules, high segment counts) to match the reference's toy-like look.

export const P = { // piece flags
  HELMET: 1, VISOR: 2, CHEST: 4, PAULDRONS: 8, GAUNTLETS: 16, KNEES: 32, CAPE: 64, TRIM: 128, EYES: 256, BOOTS: 512,
  SHIELD: 1024, SPEAR: 2048, DRUM: 4096, BOW: 8192, SWORD: 16384, HOOD: 32768, CROWN: 65536, ICE: 131072, LEGGINGS: 262144,
};
export const PIECE_FLAG = { helmet: P.HELMET, visor: P.VISOR, chest: P.CHEST, pauldrons: P.PAULDRONS, gauntlets: P.GAUNTLETS, knees: P.KNEES, cape: P.CAPE, boots: P.BOOTS, leggings: P.LEGGINGS };

const PARTS = ['head', 'torso', 'armL', 'armR', 'legL', 'legR', 'helmet', 'visor', 'chest', 'pauldronL', 'pauldronR', 'gauntletL', 'gauntletR', 'kneeL', 'kneeR', 'cape', 'eyeL', 'eyeR', 'trim', 'shield', 'spear', 'drum', 'bow', 'sword', 'hood', 'crown', 'ice', 'shadow', 'bootL', 'bootR', 'shinL', 'shinR'];
const IDX = {}; PARTS.forEach((n, i) => (IDX[n] = i));
export const PART = IDX;

let GEO = null;
function geos() {
  if (GEO) return GEO;
  const cap = (r, l) => { const g = new THREE.CapsuleGeometry(r, l, 6, 14); g.translate(0, -l / 2, 0); return g; };
  const scaled = (g, x, y, z) => { g.scale(x, y, z); return g; };
  GEO = {
    head: new THREE.SphereGeometry(0.30, 24, 16),
    torso: new THREE.CapsuleGeometry(0.235, 0.42, 8, 20),
    arm: cap(0.085, 0.42),
    leg: cap(0.105, 0.42),
    helmet: new THREE.SphereGeometry(0.335, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.6),
    visor: new THREE.SphereGeometry(0.345, 24, 6, Math.PI / 2 - 0.85, 1.7, Math.PI * 0.42, Math.PI * 0.2),
    chest: scaled(new THREE.SphereGeometry(0.3, 22, 14), 1.0, 1.25, 0.95),
    pauldron: scaled(new THREE.SphereGeometry(0.17, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), 1.1, 0.8, 1.1),
    gauntlet: scaled(new THREE.SphereGeometry(0.115, 12, 8), 1, 1.3, 1),
    knee: scaled(new THREE.SphereGeometry(0.125, 12, 8), 1, 1.1, 1),
    cape: (() => { const g = new THREE.CylinderGeometry(0.34, 0.46, 0.8, 18, 1, true, Math.PI - 0.85, 1.7); g.translate(0, -0.4, 0); return g; })(),
    eye: new THREE.SphereGeometry(0.05, 10, 6),
    trim: new THREE.TorusGeometry(0.335, 0.03, 8, 24),
    shield: scaled(new THREE.CapsuleGeometry(0.4, 0.45, 8, 16), 1, 1, 0.18),
    spear: new THREE.CylinderGeometry(0.025, 0.025, 2.0, 8),
    drum: (() => { const g = new THREE.CylinderGeometry(0.28, 0.28, 0.4, 20); g.rotateX(Math.PI / 2); return g; })(),
    bow: new THREE.TorusGeometry(0.42, 0.028, 8, 24, Math.PI),
    sword: (() => { const g = new THREE.CapsuleGeometry(0.05, 1.0, 4, 8); g.scale(1, 1, 0.4); g.translate(0, 0.6, 0); return g; })(),
    hood: new THREE.SphereGeometry(0.34, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.66),
    crown: new THREE.CylinderGeometry(0.17, 0.15, 0.13, 16, 1, true),
    ice: (() => { const g = new THREE.CapsuleGeometry(0.5, 0.95, 8, 16); g.scale(1, 1, 0.8); g.translate(0, 0.98, 0); return g; })(),
    shadow: (() => { const g = new THREE.CircleGeometry(0.5, 24); g.rotateX(-Math.PI / 2); return g; })(),
    boot: scaled(new THREE.SphereGeometry(0.13, 12, 8), 0.85, 0.6, 1.3),
    shin: new THREE.CylinderGeometry(0.115, 0.105, 0.3, 14),
  };
  return GEO;
}
const PART_GEO = { head: 'head', torso: 'torso', armL: 'arm', armR: 'arm', legL: 'leg', legR: 'leg', helmet: 'helmet', visor: 'visor', chest: 'chest', pauldronL: 'pauldron', pauldronR: 'pauldron', gauntletL: 'gauntlet', gauntletR: 'gauntlet', kneeL: 'knee', kneeR: 'knee', cape: 'cape', eyeL: 'eye', eyeR: 'eye', trim: 'trim', shield: 'shield', spear: 'spear', drum: 'drum', bow: 'bow', sword: 'sword', hood: 'hood', crown: 'crown', ice: 'ice', shadow: 'shadow', bootL: 'boot', bootR: 'boot', shinL: 'shin', shinR: 'shin' };
const METAL_PARTS = new Set(['helmet', 'visor', 'chest', 'pauldronL', 'pauldronR', 'gauntletL', 'gauntletR', 'kneeL', 'kneeR', 'shield', 'sword', 'shinL', 'shinR']);

let MATS = null;
function mats() {
  if (MATS) return MATS;
  MATS = {
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
const PART_MAT = { cape: 'cape', eyeL: 'eye', eyeR: 'eye', trim: 'gold', crown: 'gold', spear: 'wood', drum: 'wood', bow: 'wood', hood: 'cloth', ice: 'ice', shadow: 'shadow', bootL: 'cloth', bootR: 'cloth' };

const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _root = new THREE.Matrix4();
const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _e = new THREE.Euler();
const _c = new THREE.Color(), _white = new THREE.Color(0xffffff);
const C_RED = new THREE.Color(0xff2a2a), C_GOLD = new THREE.Color(PALETTE.gold), C_WOOD = new THREE.Color(0x5a3a1e), C_FROST = new THREE.Color(PALETTE.frost), C_STEEL = new THREE.Color(PALETTE.steel), C_BOOT = new THREE.Color(0x4a2f1a), C_DRUM = new THREE.Color(0x8a4b2a);

// local part transform helper: root * T(pos) * R(euler) * S(scale)
function local(out, root, x, y, z, rx, ry, rz, sx = 1, sy = 1, sz = 1) {
  _p.set(x, y, z); _e.set(rx, ry, rz); _q.setFromEuler(_e); _s.set(sx, sy, sz);
  return out.multiplyMatrices(root, _m2.compose(_p, _q, _s));
}

/**
 * Visual state v: { x,y,z, yaw,pitch,roll, scale, color:Color, metal:Color, phase, run(0..1), armRaise(0..1), aim(0..1), flags:int, flash(0..1), squash }
 * Writes a Matrix4 per part into out[] (only parts present get `used[i]=true`).
 */
export function computePose(v, out, used) {
  for (let i = 0; i < PARTS.length; i++) used[i] = false;
  const sq = v.squash || 0;
  _p.set(v.x, v.y, v.z); _e.set(v.pitch || 0, v.yaw || 0, v.roll || 0); _q.setFromEuler(_e);
  const sc = v.scale || 1; _s.set(sc * (1 + sq), sc * (1 - sq), sc * (1 + sq));
  _root.compose(_p, _q, _s);
  const ph = v.phase || 0, run = v.run == null ? 1 : v.run;
  const swing = Math.sin(ph) * 0.85 * run;
  const bob = Math.abs(Math.sin(ph)) * 0.06 * run;
  const lean = 0.12 * run;
  const raise = v.armRaise || 0; // 0 down .. 1 both arms up
  const aim = v.aim || 0;        // arms forward for bow
  const f = v.flags || 0;
  const set = (name, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => { const i = IDX[name]; local(out[i], _root, x, y + bob, z, rx, ry, rz, sx, sy, sz); used[i] = true; };

  set('head', 0, 1.42, 0.02, lean * 0.5);
  set('torso', 0, 0.95, 0, lean);
  // arms: swing opposite to legs; raise lifts them up/forward; aim brings them forward
  let aL = -swing * 0.8, aR = swing * 0.8;
  if (raise > 0) { aL = aL * (1 - raise) - 2.6 * raise; aR = aR * (1 - raise) - 2.6 * raise; }
  if (aim > 0) { aL = aL * (1 - aim) - 1.55 * aim; aR = aR * (1 - aim) - 1.3 * aim; }
  set('armL', -0.30, 1.22, 0, aL, 0, 0.14);
  set('armR', 0.30, 1.22, 0, aR, 0, -0.14);
  set('legL', -0.13, 0.6, 0, swing);
  set('legR', 0.13, 0.6, 0, -swing);
  if (f & P.HELMET) set('helmet', 0, 1.43, 0.02, lean * 0.5);
  if (f & P.VISOR) set('visor', 0, 1.42, 0.02, lean * 0.5);
  if (f & P.CHEST) set('chest', 0, 1.0, 0, lean);
  if (f & P.PAULDRONS) { set('pauldronL', -0.34, 1.3, 0, 0, 0, 0.35); set('pauldronR', 0.34, 1.3, 0, 0, 0, -0.35); }
  if (f & P.GAUNTLETS) { // near hand: along the arm direction
    const gl = IDX.gauntletL, gr = IDX.gauntletR;
    local(out[gl], out[IDX.armL], 0, -0.36, 0, 0, 0, 0); used[gl] = true;
    local(out[gr], out[IDX.armR], 0, -0.36, 0, 0, 0, 0); used[gr] = true;
  }
  if (f & P.KNEES) { local(out[IDX.kneeL], out[IDX.legL], 0, -0.3, 0.02); used[IDX.kneeL] = true; local(out[IDX.kneeR], out[IDX.legR], 0, -0.3, 0.02); used[IDX.kneeR] = true; }
  if (f & P.LEGGINGS) { local(out[IDX.shinL], out[IDX.legL], 0, -0.36, 0); used[IDX.shinL] = true; local(out[IDX.shinR], out[IDX.legR], 0, -0.36, 0); used[IDX.shinR] = true; }
  if (f & P.BOOTS) { local(out[IDX.bootL], out[IDX.legL], 0, -0.5, 0.04); used[IDX.bootL] = true; local(out[IDX.bootR], out[IDX.legR], 0, -0.5, 0.04); used[IDX.bootR] = true; }
  if (f & P.CAPE) set('cape', 0, 1.3, 0, -0.12 - Math.sin(ph * 0.5) * 0.08 * run - lean);
  if (f & P.EYES) { set('eyeL', -0.1, 1.44, 0.27); set('eyeR', 0.1, 1.44, 0.27); }
  if (f & P.TRIM) set('trim', 0, 1.36, 0.02, Math.PI / 2 + lean * 0.5);
  if (f & P.SHIELD) set('shield', -0.15, 0.95, 0.5, 0, 0, 0);
  if (f & P.SPEAR) local(out[IDX.spear], out[IDX.armR], 0.08, -0.4, 0.2, Math.PI / 2 - 0.3, 0, 0), used[IDX.spear] = true;
  if (f & P.DRUM) set('drum', 0, 0.85, 0.42);
  if (f & P.BOW) local(out[IDX.bow], out[IDX.armL], 0, -0.44, 0.05, 0, Math.PI / 2, 0), used[IDX.bow] = true;
  if (f & P.SWORD) local(out[IDX.sword], out[IDX.armR], 0, -0.44, 0.05, raise > 0.5 ? -0.3 : -1.4, 0, 0), used[IDX.sword] = true;
  if (f & P.HOOD) set('hood', 0, 1.42, -0.02, lean * 0.5 - 0.15);
  if (f & P.CROWN) set('crown', 0, 1.72, 0.02, lean * 0.5);
  if (f & P.ICE) set('ice', 0, 0, 0);
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
      if (i <= 5) col = cloth;
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
