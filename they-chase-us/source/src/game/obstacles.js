import * as THREE from 'three';
import { CONFIG, PALETTE, obstacleDamageMult } from '../config.js';
import { OBSTACLE_TYPES } from '../data/obstacles.js';
import { P } from '../render/units.js';
import { clamp } from '../util/math.js';

const W = CONFIG.player.roadWidth;
const MAT = {
  stone: new THREE.MeshStandardMaterial({ color: 0x8e8a80, roughness: 0.95 }),
  spikeBase: new THREE.MeshStandardMaterial({ color: 0x6f6a60, roughness: 0.9 }),
  spike: new THREE.MeshStandardMaterial({ color: 0xc9d1d9, roughness: 0.35, metalness: 0.8 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x6b4a2b, roughness: 0.9 }),
  iron: new THREE.MeshStandardMaterial({ color: 0x6d7580, roughness: 0.4, metalness: 0.8 }),
  blade: new THREE.MeshStandardMaterial({ color: 0xd8dee6, roughness: 0.3, metalness: 0.9 }),
  log: new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.9 }),
  logEnd: new THREE.MeshStandardMaterial({ color: 0xd9b077, roughness: 0.9 }),
  shadow: new THREE.MeshBasicMaterial({ color: 0x1b2430, transparent: true, opacity: 0.35, depthWrite: false }),
};
const C_SENT = new THREE.Color(0x6f6a60);

// Obstacles damage the player, kill allies instantly and also hit enemies. Each obstacle owns its meshes (built from primitives).
export class ObstacleSystem {
  constructor(game, scene, unitRenderer) {
    this.game = game; this.scene = scene; this.units = unitRenderer;
    this.list = [];
    this.group = new THREE.Group(); scene.add(this.group);
  }

  reset() { for (const o of this.list) this._free(o); this.list.length = 0; }
  _free(o) { if (o.mesh) { this.group.remove(o.mesh); o.mesh.traverse((m) => { if (m.geometry && !m.userData.keep) m.geometry.dispose(); }); o.mesh = null; } }

  // ev: { type, x, side, w } spawned at world z
  spawn(ev, z) {
    const def = OBSTACLE_TYPES[ev.type];
    const o = { type: ev.type, def, x: ev.x || 0, z, side: ev.side || 1, w: ev.w || 3, t: 0, phase: 'idle', pt: 0, alive: true, hitPlayer: false, hits: new Set(), mesh: null, gapX: 0, len: 1.2, shadow: null };
    switch (ev.type) {
      case 'stone_wall': this._buildWall(o); break;
      case 'floor_spikes': this._buildSpikes(o); break;
      case 'pendulum_axe': this._buildAxe(o); break;
      case 'giant_sentinel': this._buildSentinel(o); break;
      case 'rolling_log': this._buildLog(o); break;
    }
    if (o.mesh) { o.mesh.position.set(o.x, 0, o.z); this.group.add(o.mesh); }
    this.list.push(o);
    return o;
  }

  _buildWall(o) {
    const g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.BoxGeometry(o.w, 2.2, 1.2), MAT.stone); m.position.y = 1.1; m.castShadow = true; m.receiveShadow = true; g.add(m);
    for (let i = 0; i < Math.floor(o.w / 0.8); i++) { const c = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 1.2), MAT.stone); c.position.set(-o.w / 2 + 0.4 + i * 0.8, 2.37, 0); g.add(c); }
    o.mesh = g;
    // gap center for enemy pathing
    const left = -W / 2, right = W / 2;
    const gapL = (o.x - o.w / 2) - left, gapR = right - (o.x + o.w / 2);
    o.gapX = gapL > gapR ? (left + (o.x - o.w / 2)) / 2 : ((o.x + o.w / 2) + right) / 2;
  }
  _buildSpikes(o) {
    const g = new THREE.Group(); const s = o.def.size;
    const base = new THREE.Mesh(new THREE.BoxGeometry(s, 0.12, s), MAT.spikeBase); base.position.y = 0.06; base.receiveShadow = true; g.add(base);
    const spikes = new THREE.Group();
    const geo = new THREE.ConeGeometry(0.11, 0.9, 6);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const sp = new THREE.Mesh(geo, MAT.spike); sp.position.set(-s / 2 + 0.31 + i * (s - 0.62) / 3, 0.45, -s / 2 + 0.31 + j * (s - 0.62) / 3); sp.castShadow = true; spikes.add(sp); }
    spikes.position.y = -0.95; g.add(spikes); o.spikes = spikes; o.mesh = g; o.len = s; o.w = s;
    o.phase = 'down'; o.pt = Math.random() * o.def.down;
  }
  _buildAxe(o) {
    const g = new THREE.Group();
    for (const side of [-1, 1]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6.2, 0.5), MAT.wood); post.position.set(side * (W / 2 + 0.2), 3.1, 0); post.castShadow = true; g.add(post); }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(W + 1.4, 0.4, 0.5), MAT.wood); beam.position.y = 6.2; g.add(beam);
    o.gantry = [beam, ...g.children.slice(0, 2)]; // hidden while the camera passes under it
    const arm = new THREE.Group(); arm.position.y = 6.0;
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 4.6, 8), MAT.iron); rod.position.y = -2.3; arm.add(rod);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.9, 0.25), MAT.iron); head.position.y = -4.7; arm.add(head);
    const blade = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.12, 16, 1, false, 0, Math.PI), MAT.blade); blade.rotation.x = Math.PI / 2; blade.rotation.z = Math.PI; blade.position.y = -4.9; blade.castShadow = true; arm.add(blade);
    g.add(arm); o.arm = arm; o.L = 4.9;
    const sh = new THREE.Mesh(new THREE.CircleGeometry(0.9, 16), MAT.shadow); sh.rotation.x = -Math.PI / 2; sh.position.y = 0.025; g.add(sh); o.shadow = sh;
    o.mesh = g; o.x = 0; o.len = 1.6; o.t = Math.random() * o.def.period;
  }
  _buildSentinel(o) {
    o.x = o.side * (W / 2 + 1.8); o.phase = 'idle'; o.scale = 3.2; o.armRaise = 0; o.len = 2.6;
    o.w = W * o.def.sweep; o.zoneX = o.side * (W / 2 - o.w / 2); // sweep 60% of the road from its side
    const sh = new THREE.Mesh(new THREE.CircleGeometry(1.4, 16), MAT.shadow); sh.rotation.x = -Math.PI / 2; sh.position.set(0, 0.02, 0); o.mesh = sh; // blob shadow only; body via unit renderer
  }
  _buildLog(o) {
    const g = new THREE.Group();
    const len = W / 2;
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, len, 14), MAT.log); log.rotation.z = Math.PI / 2; log.castShadow = true; g.add(log);
    for (const s of [-1, 1]) { const end = new THREE.Mesh(new THREE.CircleGeometry(0.62, 14), MAT.logEnd); end.position.x = s * (len / 2 + 0.001); end.rotation.y = s * Math.PI / 2; g.add(end); }
    g.position.y = 0.75; o.mesh = g; o.logMesh = log; o.w = len; o.len = 1.5; o.x = o.side * W / 4; o.roll = 0;
  }

  // enemy steering helper: a wall within 5 m ahead of the enemy (toward -Z) overlapping its x
  wallAhead(e) {
    for (const o of this.list) {
      if (o.type !== 'stone_wall' || !o.alive) continue;
      const dz = e.z - o.z;
      if (dz > 0 && dz < 5 && Math.abs(e.x - o.x) < o.w / 2 + e.radius + 0.3) return o;
    }
    return null;
  }

  _hitPlayer(o, dmgBase) {
    const g = this.game;
    if (g.player.invuln > 0) return false;
    const dmg = dmgBase * obstacleDamageMult(g.level) * g.stats.obstacleDamageMult;
    g.damagePlayer(dmg, 'obstacle', { shieldable: true, guardianable: true });
    return true;
  }

  _hitEnemy(e, o, frac, bruteFrac, flingLow) {
    const en = this.game.enemies;
    if (o.hits.has(e.id) && e.obstacleCd > 0) return;
    o.hits.add(e.id); e.obstacleCd = 0.8;
    if (flingLow && e.tier <= 2 && !e.def.boss) { en.kill(e, { src: 'obstacle', flingBig: true }); return; }
    const f = e.def.boss ? bruteFrac : frac;
    en.damage(e, e.maxHp * f, { src: 'normal' });
  }

  _killAlliesIn(x, z, hw, hl) {
    const al = this.game.allies;
    for (const a of al.list) if (a.alive && Math.abs(a.x - x) < hw + 0.3 && Math.abs(a.z - z) < hl + 0.3) al.kill(a, 'obstacle');
  }

  update(dt, camZ = 1e9) {
    const g = this.game, pl = g.player, en = g.enemies;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const o = this.list[i];
      o.t += dt;
      if (o.warnT > 0) o.warnT -= dt;
      switch (o.type) {
        case 'stone_wall': {
          // player
          if (Math.abs(pl.z - o.z) < 0.6 + 0.45 && Math.abs(pl.x - o.x) < o.w / 2 + 0.4 && !o.hitPlayer) {
            o.hitPlayer = true;
            this._hitPlayer(o, o.def.playerDmg);
            const pushDir = pl.x >= o.x ? 1 : -1; // push to the nearer free side
            const target = o.gapX; g.player.x = clamp(target, -CONFIG.player.xRange, CONFIG.player.xRange); g.player.pushVx = pushDir * 2;
          }
          this._killAlliesIn(o.x, o.z, o.w / 2, 0.6);
          for (const e of en.list) if (e.alive && !e.guard && Math.abs(e.x - o.x) < o.w / 2 + e.radius * 0.6 && e.z - o.z < 0.8 + e.radius && e.z > o.z - 0.6) {
            if (e.wallStun <= 0 && e.obstacleCd <= 0) { e.wallStun = o.def.stun; e.obstacleCd = o.def.stun + 0.2; e.z = o.z + 0.8 + e.radius; g.fx.particles.dust(e.x, e.z, 3); }
          }
          break;
        }
        case 'floor_spikes': {
          o.pt += dt; const d = o.def;
          if (o.phase === 'down' && o.pt >= d.down) { o.phase = 'rattle'; o.pt = 0; }
          else if (o.phase === 'rattle' && o.pt >= d.rattle) { o.phase = 'up'; o.pt = 0; o.hits.clear(); }
          else if (o.phase === 'up' && o.pt >= d.up) { o.phase = 'down'; o.pt = 0; }
          const up = o.phase === 'up';
          o.spikes.position.y = up ? Math.min(0, -0.95 + o.pt / 0.08 * 0.95) : (o.phase === 'rattle' ? -0.95 + Math.sin(o.t * 60) * 0.05 : Math.max(-0.95, 0 - o.pt / 0.3 * 0.95));
          if (up) {
            const hw = o.w / 2;
            if (!o.hitPlayer && Math.abs(pl.x - o.x) < hw + 0.2 && Math.abs(pl.z - o.z) < hw + 0.2) { if (this._hitPlayer(o, d.playerDmg)) o.hitPlayer = true; }
            this._killAlliesIn(o.x, o.z, hw, hw);
            for (const e of en.list) if (e.alive && !e.guard && Math.abs(e.x - o.x) < hw + e.radius * 0.5 && Math.abs(e.z - o.z) < hw + e.radius * 0.5) this._hitEnemy(e, o, d.enemyFrac, d.bruteFrac, false);
          } else if (o.phase === 'down') { o.hitPlayer = false; }
          break;
        }
        case 'pendulum_axe': {
          const d = o.def; const th = 1.05 * Math.sin(o.t / d.period * Math.PI * 2);
          o.arm.rotation.z = th; o.bladeX = Math.sin(th) * o.L; o.bladeLow = Math.abs(th) < 0.36;
          const hide = Math.abs(o.z - camZ) < 3.5; for (const m of o.gantry) m.visible = !hide;
          o.shadow.position.x = o.bladeX; o.shadow.scale.setScalar(1 - Math.abs(th) * 0.4);
          if (o.bladeLow) {
            const bx = o.bladeX;
            if (!o.hitPlayer && Math.abs(pl.x - bx) < 1.0 && Math.abs(pl.z - o.z) < 0.9) { if (this._hitPlayer(o, d.playerDmg)) o.hitPlayer = true; }
            this._killAlliesIn(bx, o.z, 0.9, 0.7);
            for (const e of en.list) if (e.alive && !e.guard && Math.abs(e.x - bx) < 0.9 + e.radius * 0.5 && Math.abs(e.z - o.z) < 0.8 + e.radius * 0.5) this._hitEnemy(e, o, d.enemyFrac, d.bruteFrac, false);
          } else o.hitPlayer = false;
          break;
        }
        case 'giant_sentinel': {
          const d = o.def;
          const anyNear = Math.abs(pl.z - o.z) < 7 || en.list.some((e) => e.alive && Math.abs(e.z - o.z) < 5);
          if (o.phase === 'idle') { if (Math.abs(pl.z - o.z) < 7.5 + pl.speed * d.windup || (anyNear && pl.z < o.z)) { o.phase = 'windup'; o.pt = 0; } }
          else {
            o.pt += dt;
            if (o.phase === 'windup' && o.pt >= d.windup) { o.phase = 'swing'; o.pt = 0; o.hits.clear(); o.hitPlayer = false; g.audio.impact(); }
            else if (o.phase === 'swing' && o.pt >= d.swing) { o.phase = 'recover'; o.pt = 0; }
            else if (o.phase === 'recover' && o.pt >= d.recover) { o.phase = anyNear ? 'windup' : 'idle'; o.pt = 0; }
          }
          o.armRaise = o.phase === 'windup' ? Math.min(1, o.pt / d.windup) : o.phase === 'swing' ? 1 - o.pt / d.swing : o.phase === 'recover' ? 0 : 0.2;
          if (o.phase === 'swing') {
            const hw = o.w / 2, hl = o.len / 2;
            if (!o.hitPlayer && Math.abs(pl.x - o.zoneX) < hw && Math.abs(pl.z - o.z) < hl + 0.3) { if (this._hitPlayer(o, d.playerDmg)) o.hitPlayer = true; }
            this._killAlliesIn(o.zoneX, o.z, hw, hl);
            for (const e of en.list) if (e.alive && !e.guard && Math.abs(e.x - o.zoneX) < hw + e.radius * 0.5 && Math.abs(e.z - o.z) < hl + e.radius * 0.5) this._hitEnemy(e, o, d.enemyFrac, d.bruteFrac, true);
          }
          break;
        }
        case 'rolling_log': {
          const d = o.def;
          o.z += d.speed * dt; o.roll -= d.speed / 0.75 * dt; o.logMesh.rotation.x = o.roll; o.mesh.position.z = o.z;
          const hw = o.w / 2;
          if (!o.hitPlayer && Math.abs(pl.x - o.x) < hw + 0.3 && Math.abs(pl.z - o.z) < 1.0) { if (this._hitPlayer(o, d.playerDmg)) o.hitPlayer = true; }
          this._killAlliesIn(o.x, o.z, hw, 0.8);
          for (const e of en.list) if (e.alive && !e.guard && Math.abs(e.x - o.x) < hw + e.radius * 0.5 && Math.abs(e.z - o.z) < 0.9 + e.radius * 0.5) this._hitEnemy(e, o, d.enemyFrac, d.bruteFrac, false);
          if (o.z > pl.z + 45) o.alive = false;
          break;
        }
      }
      if (o.type !== 'rolling_log' && o.z > pl.z + 45) o.alive = false; // far behind the chasers
      if (!o.alive) { this._free(o); this.list.splice(i, 1); }
    }
  }

  render(danger) {
    const pl = this.game.player;
    this.units.begin();
    for (const o of this.list) {
      if (o.type === 'floor_spikes' && (o.phase === 'rattle' || o.phase === 'up')) danger.rect(o.x, o.z, o.w, o.w);
      else if (o.type === 'pendulum_axe' && Math.abs(o.arm.rotation.z) < 0.6) danger.rect(o.bladeX, o.z, 2.0, 1.6);
      else if (o.type === 'giant_sentinel') {
        if (o.phase === 'windup' || o.phase === 'swing') danger.rect(o.zoneX, o.z, o.w, o.len);
        const v = _v; v.x = o.x; v.y = 0; v.z = o.z; v.scale = o.scale; v.yaw = -o.side * Math.PI / 2; v.pitch = 0; v.roll = 0; v.color = C_SENT; v.metal = null; v.phase = o.t * 0.5; v.run = 0;
        v.armRaise = o.armRaise; v.aim = 0; v.flags = P.SWORD | P.HELMET; v.flash = 0; v.squash = o.phase === 'swing' ? -0.08 : 0; v.frozen = false; v.shadowScale = 0;
        this.units.draw(v);
      }
    }
    this.units.end();
  }

  // for the HUD warning: obstacles that will enter the screen soon
  warnings() { return this.list.filter((o) => o.alive && o.warnT > 0); }
}
const _v = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, scale: 1, color: null, metal: null, phase: 0, run: 0, armRaise: 0, aim: 0, flags: 0, flash: 0, squash: 0, frozen: false, shadowScale: 1, capeColor: null };
