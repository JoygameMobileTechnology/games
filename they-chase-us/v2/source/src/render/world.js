import * as THREE from 'three';
import { PALETTE, CONFIG } from '../config.js';
import { RNG } from '../util/rng.js';

// Static world for one level: road, parapets, sea, islands, castle gate, multiplier bridge, boss arena.
// Travel direction is -Z. Level runs from z=0 to z=-levelLength, then the gate, bridge segments and the arena.

const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _c = new THREE.Color();

function chevronTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#' + PALETTE.road.toString(16).padStart(6, '0'); g.fillRect(0, 0, 256, 512);
  g.fillStyle = '#' + PALETTE.chevron.toString(16).padStart(6, '0');
  // chevron pointing to -Z (bottom of texture = -Z when v grows along +Z)
  g.beginPath(); g.moveTo(0, 300); g.lineTo(128, 180); g.lineTo(256, 300); g.lineTo(256, 400); g.lineTo(128, 280); g.lineTo(0, 400); g.closePath(); g.fill();
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4; t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

function bridgeTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#5c6470'; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 3;
  for (let y = 0; y < 256; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); const off = (y / 64) % 2 ? 64 : 0; for (let x = off; x < 256; x += 128) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 64); g.stroke(); } }
  // carpet
  g.fillStyle = '#9b2a2a'; g.fillRect(104, 0, 48, 256); g.fillStyle = '#d9a93f'; g.fillRect(104, 0, 4, 256); g.fillRect(148, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

function labelTexture(text, color, sub) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 256, 128);
  g.font = 'bold 84px "Lilita One", "Arial Black", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 12; g.strokeStyle = '#1b2430'; g.strokeText(text, 128, sub ? 52 : 64);
  g.fillStyle = color; g.fillText(text, 128, sub ? 52 : 64);
  if (sub) { g.font = 'bold 30px "Lilita One", "Arial Black", sans-serif'; g.lineWidth = 6; g.strokeText(sub, 128, 104); g.fillStyle = '#fff'; g.fillText(sub, 128, 104); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

export function archColor(n) { // ×2 green -> yellow -> orange -> red -> purple ×20
  const stops = [[2, 0x4cd964], [6, 0xffd84a], [10, 0xff8a2e], [15, 0xff3b3b], [20, 0xb46cff]];
  for (let i = 0; i < stops.length - 1; i++) {
    const [a, ca] = stops[i], [b, cb] = stops[i + 1];
    if (n <= b) { const t = (n - a) / (b - a); return _c.set(ca).lerp(new THREE.Color(cb), Math.max(0, Math.min(1, t))).getHex(); }
  }
  return 0xb46cff;
}

const MAT = {
  stone: new THREE.MeshStandardMaterial({ color: 0xe8e2d6, roughness: 0.9 }),
  roadSide: new THREE.MeshStandardMaterial({ color: 0xd9d2c4, roughness: 0.9 }),
  parapet: new THREE.MeshStandardMaterial({ color: PALETTE.parapet, roughness: 0.8 }),
  darkStone: new THREE.MeshStandardMaterial({ color: 0x4a515c, roughness: 0.9 }),
  bridgeSide: new THREE.MeshStandardMaterial({ color: 0x3f4650, roughness: 0.9 }),
  roof: new THREE.MeshStandardMaterial({ color: PALETTE.roofTile, roughness: 0.8 }),
  slate: new THREE.MeshStandardMaterial({ color: PALETTE.slate, roughness: 0.8 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x6b4a2b, roughness: 0.85 }),
  iron: new THREE.MeshStandardMaterial({ color: 0x3a3f47, roughness: 0.5, metalness: 0.7 }),
  gold: new THREE.MeshStandardMaterial({ color: PALETTE.gold, roughness: 0.35, metalness: 0.85 }),
  sea: new THREE.MeshStandardMaterial({ color: PALETTE.sea, roughness: 0.35, metalness: 0.05 }),
  cloud: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.92 }),
  island: new THREE.MeshStandardMaterial({ color: 0x8fc46a, roughness: 1 }),
  pine: new THREE.MeshStandardMaterial({ color: 0x3f8f57, roughness: 1 }),
  flame: new THREE.MeshBasicMaterial({ color: 0xffa640 }),
  red: new THREE.MeshStandardMaterial({ color: 0xc8322a, roughness: 0.8 }),
  flagBest: new THREE.MeshStandardMaterial({ color: 0xffd84a, roughness: 0.8, side: THREE.DoubleSide }),
  flagPrev: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, side: THREE.DoubleSide, transparent: true, opacity: 0.45 }),
};

export class World {
  constructor(scene) {
    this.scene = scene;
    this.group = null;
    this.chevron = chevronTexture();
    this.bridgeTex = bridgeTexture();
    this.clouds = null; this.cloudData = [];
    this.gate = null; this.arches = []; this.torches = [];
    this.roadW = CONFIG.player.roadWidth;
  }

  dispose() {
    if (!this.group) return;
    this.group.traverse((o) => { if (o.geometry && !o.userData.shared) o.geometry.dispose(); if (o.material && o.material.map && o.userData.ownTex) o.material.map.dispose(); });
    this.scene.remove(this.group); this.group = null; this.arches = []; this.torches = [];
  }

  // layout: { levelLength, segments, segmentLength, level, bestMult, prevMult }
  build(layout) {
    this.dispose();
    const g = new THREE.Group(); this.group = g; this.scene.add(g);
    const W = this.roadW;
    const L = layout.levelLength;
    const gateZ = -L;
    const bridgeStart = gateZ - 14; // pad after the gate so the first row is not in your face
    const bridgeLen = layout.segments * layout.segmentLength + 10;
    const arenaZ = bridgeStart - bridgeLen - 14;
    this.gateZ = gateZ; this.bridgeStart = bridgeStart; this.arenaZ = arenaZ; this.layout = layout;
    const rng = new RNG(layout.level * 7919 + 13);

    // ---- level road ----
    const startPad = 40;
    const roadLen = L + startPad + 6;
    const roadGeo = new THREE.PlaneGeometry(W, roadLen); roadGeo.rotateX(-Math.PI / 2);
    const tex = this.chevron.clone(); tex.needsUpdate = true; tex.repeat.set(1, roadLen / 8);
    const road = new THREE.Mesh(roadGeo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }));
    road.position.set(0, 0, startPad - roadLen / 2); road.receiveShadow = true; g.add(road);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(W + 1.2, 1.4, roadLen), MAT.roadSide);
    slab.position.set(0, -0.71, startPad - roadLen / 2); g.add(slab);
    // parapets (ochre) with crenellations
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, roadLen), MAT.parapet);
      rail.position.set(side * (W / 2 + 0.3), 0.25, startPad - roadLen / 2); rail.receiveShadow = true; g.add(rail);
    }
    const nCren = Math.floor(roadLen / 1.6);
    const cren = new THREE.InstancedMesh(new THREE.BoxGeometry(0.6, 0.35, 0.8), MAT.parapet, nCren * 2);
    let ci = 0;
    for (let i = 0; i < nCren; i++) for (const side of [-1, 1]) {
      _p.set(side * (W / 2 + 0.3), 0.67, startPad - i * 1.6 - 0.4); _q.identity(); _s.set(1, 1, 1);
      cren.setMatrixAt(ci++, _m.compose(_p, _q, _s));
    }
    cren.count = ci; g.add(cren);

    // ---- castle gate ----
    this.gate = this._buildGate(gateZ); g.add(this.gate.group);

    // ---- bridge ----
    const bLen = arenaZ - bridgeStart; // negative
    const bridgeGeo = new THREE.PlaneGeometry(W, -bLen + 8); bridgeGeo.rotateX(-Math.PI / 2);
    const btex = this.bridgeTex.clone(); btex.needsUpdate = true; btex.repeat.set(1, (-bLen + 8) / 4);
    const bridge = new THREE.Mesh(bridgeGeo, new THREE.MeshStandardMaterial({ map: btex, roughness: 0.95 }));
    bridge.position.set(0, 0.001, bridgeStart + 4 + bLen / 2 - 4); bridge.receiveShadow = true; g.add(bridge);
    const bslab = new THREE.Mesh(new THREE.BoxGeometry(W + 1.2, 1.6, -bLen + 8), MAT.bridgeSide);
    bslab.position.set(0, -0.8, bridgeStart + 4 + bLen / 2 - 4); g.add(bslab);
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, -bLen + 8), MAT.darkStone);
      rail.position.set(side * (W / 2 + 0.3), 0.35, bridgeStart + 4 + bLen / 2 - 4); g.add(rail);
    }
    // segment markers painted on the road (no arches: they blocked the view), short torch posts at the parapets
    this.arches = [];
    const flameGeo = new THREE.SphereGeometry(0.16, 10, 8);
    const bandGeo = new THREE.PlaneGeometry(W, 0.5); bandGeo.rotateX(-Math.PI / 2);
    const lblGeo = new THREE.PlaneGeometry(4.2, 2.1); lblGeo.rotateX(-Math.PI / 2);
    for (let s = 1; s <= layout.segments; s++) {
      const z = bridgeStart - (s - 1) * layout.segmentLength - 2;
      const mult = s + 1;
      const col = archColor(mult);
      const band = new THREE.Mesh(bandGeo, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.85 }));
      band.position.set(0, 0.012, z + 1.6); g.add(band);
      const hex = '#' + col.toString(16).padStart(6, '0');
      const lbl = new THREE.Mesh(lblGeo, new THREE.MeshBasicMaterial({ map: labelTexture('×' + mult, hex), transparent: true }));
      lbl.position.set(0, 0.015, z - 0.2); lbl.userData.ownTex = true; g.add(lbl);
      for (const side of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.4, 8), MAT.wood); post.position.set(side * (W / 2 + 0.3), 1.35, z); g.add(post);
        const f = new THREE.Mesh(flameGeo, MAT.flame); f.position.set(side * (W / 2 + 0.3), 2.2, z); g.add(f); this.torches.push(f);
        if (mult >= 10) { // banners on the parapets after ×10
          const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.6, 6), MAT.wood); pole.position.set(side * (W / 2 + 0.3), 1.9, z + 4); g.add(pole);
          const b = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.4), new THREE.MeshStandardMaterial({ color: mult >= 15 ? 0x1b1f26 : 0x9b2a2a, side: THREE.DoubleSide, roughness: 0.9 }));
          b.position.set(side * (W / 2 + 0.3) - side * 0.36, 2.5, z + 4); g.add(b);
        }
      }
      this.arches.push({ z, mult, group: null });
    }
    // flags: best & previous
    const flagFor = (mult, mat, label, color) => {
      if (mult < 2) return;
      const s = Math.min(layout.segments, mult - 1);
      const z = bridgeStart - (s - 1) * layout.segmentLength - 2 - layout.segmentLength * 0.5;
      const grp = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.2, 6), MAT.wood); pole.position.set(0, 1.6, 0); grp.add(pole);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.8), mat); flag.position.set(0.7, 2.7, 0); grp.add(flag);
      const lbl = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.1), new THREE.MeshBasicMaterial({ map: labelTexture(label, color, null), transparent: true, side: THREE.DoubleSide }));
      lbl.position.set(0.7, 3.5, 0); lbl.userData.ownTex = true; grp.add(lbl); // faces +Z: readable for the player running toward -Z
      grp.position.set(-(W / 2 - 0.9), 0, z); g.add(grp);
      return { flag, grp };
    };
    this.bestFlag = flagFor(layout.bestMult, MAT.flagBest, 'BEST ×' + layout.bestMult, '#ffd84a');
    if (layout.prevMult >= 2 && layout.prevMult !== layout.bestMult) this.prevFlag = flagFor(layout.prevMult, MAT.flagPrev, '×' + layout.prevMult, '#ffffff');

    // ---- arena ----
    const arena = new THREE.Mesh(new THREE.CylinderGeometry(9.5, 10, 1.6, 28), MAT.darkStone);
    arena.position.set(0, -0.8, arenaZ - 8); arena.receiveShadow = true; g.add(arena);
    const arenaTop = new THREE.Mesh(new THREE.CircleGeometry(9.5, 28), new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.95 }));
    arenaTop.rotation.x = -Math.PI / 2; arenaTop.position.set(0, 0.002, arenaZ - 8); arenaTop.receiveShadow = true; g.add(arenaTop);
    // throne gate behind
    const tg = new THREE.Group();
    for (const side of [-1, 1]) { const tw = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.6, 26, 12), MAT.darkStone); tw.position.set(side * 7.5, 13, 0); tg.add(tw); const cone = new THREE.Mesh(new THREE.ConeGeometry(2.9, 5, 12), MAT.red); cone.position.set(side * 7.5, 28.5, 0); tg.add(cone); }
    const wall = new THREE.Mesh(new THREE.BoxGeometry(16, 18, 2), MAT.darkStone); wall.position.set(0, 9, 0); tg.add(wall);
    const door = new THREE.Mesh(new THREE.BoxGeometry(6, 11, 0.5), MAT.iron); door.position.set(0, 5.5, 1); tg.add(door);
    const gem = new THREE.Mesh(new THREE.SphereGeometry(1.6, 14, 10), new THREE.MeshBasicMaterial({ color: 0xff3b3b })); gem.position.set(0, 14.5, 1.3); tg.add(gem); this.torches.push(gem); // the glowing eye of the gate: a landmark from the far end of the bridge
    tg.position.set(0, 0, arenaZ - 18); g.add(tg);
    for (const side of [-1, 1]) { const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.8, 1.6, 10), MAT.darkStone); ped.position.set(side * 6.5, 0.8, arenaZ - 13); g.add(ped); const fire = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 8), MAT.flame); fire.position.set(side * 6.5, 2.2, arenaZ - 13); g.add(fire); this.torches.push(fire); } // braziers: the arena reads from far away
    for (const side of [-1, 1]) { const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.8, 1.6, 10), MAT.darkStone); ped.position.set(side * 6.5, 0.8, arenaZ - 13); g.add(ped); const fire = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 8), MAT.flame); fire.position.set(side * 6.5, 2.2, arenaZ - 13); g.add(fire); this.torches.push(fire); }

    // ---- sea, clouds, islands ----
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1600), MAT.sea);
    sea.rotation.x = -Math.PI / 2; sea.position.set(0, -28, (arenaZ) / 2); g.add(sea);
    this._buildScenery(g, rng, startPad + 20, arenaZ - 60);
    this._buildClouds(g, rng, startPad + 20, arenaZ - 60);
    return { gateZ, bridgeStart, arenaZ };
  }

  _buildGate(z) {
    const grp = new THREE.Group(); const W = this.roadW;
    const stone = MAT.stone;
    for (const side of [-1, 1]) {
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.6, 9, 12), stone); tower.position.set(side * (W / 2 + 1.2), 4.5, 0); tower.castShadow = true; grp.add(tower);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(1.8, 2.4, 12), MAT.roof); roof.position.set(side * (W / 2 + 1.2), 10.2, 0); grp.add(roof);
      const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 5), MAT.wood); flagPole.position.set(side * (W / 2 + 1.2), 12, 0); grp.add(flagPole);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.5), MAT.red); flag.position.set(side * (W / 2 + 1.2) + 0.45, 12.4, 0); grp.add(flag);
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(W + 1.6, 2.2, 2.4), stone); lintel.position.set(0, 6.6, 0); lintel.castShadow = true; grp.add(lintel);
    const cren = new THREE.InstancedMesh(new THREE.BoxGeometry(0.7, 0.5, 2.4), stone, 8);
    for (let i = 0; i < 8; i++) { _p.set(-W / 2 + 0.5 + i * (W / 7), 7.95, 0); cren.setMatrixAt(i, _m.compose(_p, _q.identity(), _s.set(1, 1, 1))); }
    grp.add(cren);
    // portcullis: grid of bars, starts raised inside the lintel
    const port = new THREE.Group();
    const barGeo = new THREE.BoxGeometry(0.12, 5.6, 0.12);
    const bars = new THREE.InstancedMesh(barGeo, MAT.iron, 12 + 5);
    let bi = 0;
    for (let i = 0; i < 12; i++) { _p.set(-W / 2 + 0.4 + i * (W - 0.8) / 11, 2.8, 0); bars.setMatrixAt(bi++, _m.compose(_p, _q.identity(), _s.set(1, 1, 1))); }
    for (let j = 0; j < 5; j++) { _p.set(0, 0.4 + j * 1.3, 0); _q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2); bars.setMatrixAt(bi++, _m.compose(_p, _q, _s.set(1, W / 5.6, 1))); }
    _q.identity();
    port.add(bars);
    port.position.y = 5.6; // raised
    grp.add(port);
    grp.position.set(0, 0, z);
    return { group: grp, portcullis: port, z };
  }

  _buildScenery(g, rng, zStart, zEnd) {
    // islands with castles/towers/pines on both sides, low poly, instanced by primitive
    const boxes = [], cones = [], cyls = [], pines = [], trunks = [], islands = [];
    const push = (arr, x, y, z, sx, sy, sz, color, ry = 0) => arr.push({ x, y, z, sx, sy, sz, color, ry });
    let z = zStart;
    while (z > zEnd) {
      for (const side of [-1, 1]) {
        if (rng.chance(0.75)) {
          const dist = rng.range(13, 40);
          const cx = side * dist, cz = z + rng.range(-8, 8);
          const r = rng.range(5, 12);
          const y = rng.range(-9, -3);
          push(islands, cx, y, cz, r, rng.range(2, 5), r * rng.range(0.7, 1.2), rng.pick([0x8fc46a, 0x7fb75f, 0xa4c97c]), rng.range(0, 6.28));
          const top = y + 1.5;
          const kind = rng.next();
          if (kind < 0.45) { // castle
            const w = rng.range(3, 6), h = rng.range(2.5, 5);
            push(boxes, cx, top + h / 2, cz, w, h, w * rng.range(0.6, 1), PALETTE.castleWall, rng.range(0, 1));
            const n = rng.int(1, 3);
            for (let i = 0; i < n; i++) {
              const tx = cx + rng.range(-w / 2, w / 2), tz = cz + rng.range(-w / 2, w / 2), th = h + rng.range(1.5, 4);
              push(cyls, tx, top + th / 2, tz, 0.9, th, 0.9, PALETTE.castleWall);
              push(cones, tx, top + th + 1, tz, 1.2, 2, 1.2, rng.chance(0.6) ? PALETTE.roofTile : PALETTE.slate);
            }
          } else if (kind < 0.7) { // tower
            const th = rng.range(5, 10);
            push(cyls, cx, top + th / 2, cz, 1.3, th, 1.3, PALETTE.castleWall);
            push(cones, cx, top + th + 1.4, cz, 1.8, 2.8, 1.8, PALETTE.slate);
          } else if (kind < 0.85) { // windmill
            const th = rng.range(4, 6);
            push(cyls, cx, top + th / 2, cz, 1.2, th, 1.2, 0xe8e2d6);
            push(cones, cx, top + th + 0.8, cz, 1.5, 1.6, 1.5, PALETTE.roofTile);
            push(boxes, cx, top + th, cz + 1.4, 5, 0.3, 0.1, 0xf5f0e6, 0);
            push(boxes, cx, top + th, cz + 1.4, 0.3, 5, 0.1, 0xf5f0e6, 0);
          }
          // pines
          const np = rng.int(2, 6);
          for (let i = 0; i < np; i++) {
            const px = cx + rng.range(-r * 0.7, r * 0.7), pz = cz + rng.range(-r * 0.6, r * 0.6);
            const ph = rng.range(1.5, 3.5);
            push(trunks, px, top - 0.6 + ph * 0.25, pz, 0.15, ph * 0.5, 0.15, 0x6b4a2b);
            push(pines, px, top - 0.4 + ph * 0.5 + ph * 0.25, pz, ph * 0.45, ph, ph * 0.45, rng.pick([0x3f8f57, 0x35804c, 0x4c9b60]));
          }
        }
      }
      z -= rng.range(14, 24);
    }
    const inst = (geo, list, mat) => {
      if (!list.length) return;
      const im = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach((it, i) => {
        _p.set(it.x, it.y, it.z); _q.setFromAxisAngle(_up, it.ry || 0); _s.set(it.sx, it.sy, it.sz);
        im.setMatrixAt(i, _m.compose(_p, _q, _s)); im.setColorAt(i, _c.set(it.color));
      });
      im.userData.shared = true; g.add(im);
    };
    const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 });
    inst(_geo.box, boxes, white); inst(_geo.cone, cones, white); inst(_geo.cyl, cyls, white); inst(_geo.cone, pines, white); inst(_geo.cyl, trunks, white); inst(_geo.island, islands, white);
  }

  _buildClouds(g, rng, zStart, zEnd) {
    const n = 40; this.cloudData = [];
    const im = new THREE.InstancedMesh(_geo.cloud, MAT.cloud, n); im.userData.shared = true;
    for (let i = 0; i < n; i++) {
      const d = { x: rng.range(-70, 70), y: rng.range(-24, -10), z: rng.range(zEnd, zStart), sx: rng.range(4, 10), sy: rng.range(1.2, 2.4), sz: rng.range(3, 6), v: rng.range(0.4, 1.2) };
      this.cloudData.push(d);
    }
    this.clouds = im; g.add(im);
    this._writeClouds();
  }
  _writeClouds() {
    const im = this.clouds; if (!im) return;
    this.cloudData.forEach((d, i) => { _p.set(d.x, d.y, d.z); _s.set(d.sx, d.sy, d.sz); im.setMatrixAt(i, _m.compose(_p, _q.identity(), _s)); });
    im.instanceMatrix.needsUpdate = true;
  }

  update(dt, time, camZ = 1e9) {
    if (this.clouds) {
      for (const d of this.cloudData) { d.x += d.v * dt; if (d.x > 80) d.x = -80; }
      this._writeClouds();
    }
    for (let i = 0; i < this.torches.length; i++) { const f = this.torches[i]; const s = 0.85 + 0.3 * Math.sin(time * 11 + i * 1.7) * Math.sin(time * 7.3 + i); f.scale.set(s, s * 1.3, s); }
    if (this.bestFlag) this.bestFlag.flag.rotation.y = Math.sin(time * 2) * 0.25;
    if (this.prevFlag) this.prevFlag.flag.rotation.y = Math.sin(time * 2.3) * 0.25;
  }

  // portcullis drop animation: t 0..1
  setGateDrop(t) { if (this.gate) this.gate.portcullis.position.y = 5.6 * (1 - t); }
}

const _up = new THREE.Vector3(0, 1, 0);
const _geo = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cone: new THREE.ConeGeometry(1, 1, 8),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 10),
  island: new THREE.CylinderGeometry(1, 0.7, 1, 12),
  cloud: new THREE.SphereGeometry(1, 10, 7),
};
