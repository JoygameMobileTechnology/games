import * as THREE from 'three';
import { CONFIG, PALETTE, TIER_MULT, TIER_PIECES, SHED_ORDER, TIER_METAL, TIER_NAMES, enemySpeedMult } from '../config.js';
import { ENEMY_TYPES } from '../data/enemies.js';
import { P, piecesToFlags } from '../render/units.js';
import { COLORS } from '../render/fx.js';
import { clamp, damp, TAU } from '../util/math.js';

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

const C_ENEMY = new THREE.Color(PALETTE.enemy);
const C_BOSS = new THREE.Color(0x2b1f2e);
const METALS = TIER_METAL.map((h) => new THREE.Color(h));
const C_BLACK = new THREE.Color(PALETTE.blackSteel);

export class EnemySystem {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.debris = [];
    this.spears = [];     // { x, y, z, laneX, startX, t, alive }
    this.caltrops = [];   // { x, z, life, hit:Set, seed }
    this.nextId = 1;
    this.volleyJumps = 0;
    this.backlineAlive = 0;
  }

  reset() { this.list.length = 0; this.debris.length = 0; this.spears.length = 0; this.caltrops.length = 0; this.nextId = 1; }

  get aliveCount() { let n = 0; for (const e of this.list) if (e.alive) n++; return n; }

  spawn(typeId, tier, x, z, opts = {}) {
    if (this.aliveCount >= CONFIG.perf.maxEnemies && !opts.force) return null;
    const def = ENEMY_TYPES[typeId] || ENEMY_TYPES.footman;
    const L = this.game.level;
    const visualTier = def.boss ? 5 : clamp(tier, 0, 5);
    const maxHp = opts.hp != null ? opts.hp : def.hp * (def.boss ? 1 : TIER_MULT[visualTier]);
    const e = {
      id: this.nextId++, def, type: typeId, tier: visualTier, hp: maxHp, maxHp, x, z, vx: 0, vz: 0,
      speed: def.speed * enemySpeedMult(L), radius: def.radius * (opts.scale || 1), scale: def.scale * (opts.scale || 1),
      state: opts.guard ? 'guard' : 'run', latch: null, latchT: 0,
      frozen: 0, burn: 0, burnDps: 0, burnTick: 0, stun: 0, slow: 0, kbCd: 0, flash: 0, squash: 0, hitT: 99, lostFrac: 1,
      pieces: TIER_PIECES[visualTier].slice(), shed: 0, k: TIER_PIECES[visualTier].length,
      phase: Math.random() * 6.28, chainMark: -1, spearT: 1.5 + Math.random() * 2, warn: 0, laneX: 0,
      holdDist: def.holdMin ? def.holdMin + Math.random() * (def.holdMax - def.holdMin) : 0,
      alive: true, dead: false, deathT: 0, dvx: 0, dvy: 0, dvz: 0, dy: 0, spin: 0, pitch: 0, roll: 0,
      guard: !!opts.guard, weak: !!opts.weak, armRaise: 0, segment: opts.segment || 0,
      metal: opts.black ? C_BLACK : METALS[visualTier], eyes: visualTier >= 5 || !!opts.eyes, black: !!opts.black,
      name: opts.name || (def.boss ? def.name : (visualTier === 0 ? def.name : TIER_NAMES[visualTier])),
      obstacleCd: 0, wallStun: 0, xpValue: def.xp * (1 + CONFIG.balance.xpTierBonus * visualTier), isBoss: !!opts.isBoss, drummed: false,
      yawFacing: opts.guard || opts.isBoss ? 0 : Math.PI,
    };
    if (!e.guard && !e.isBoss && !opts.noDrop) { // superhero drop-in: falls in the player's frame onto a spot 'rel' m behind the player
      const E = CONFIG.enemy, pz = this.game.player.z, big = !!def.boss;
      e.entry = { t: -(opts.delay || 0), rel: z - pz, x1: x, x0: x + (Math.random() - 0.5) * 1.6, h0: E.dropHeight * (big ? 1.25 : 1), back: E.dropBack, dur: E.dropDur * (big ? 1.2 : 1), landedAt: -1, whoosh: false };
      e.airborne = true; e.land = 0; e.look = 0; e.dy = e.entry.h0; e.x = e.entry.x0; e.z = pz + e.entry.rel + e.entry.back;
    }
    this.list.push(e);
    return e;
  }

  // superhero landing: steep accelerating dive -> impact (squash, dust ring, cracks, thud) -> knee-and-fist hold, head snaps up -> rise into the run
  _updateEntry(e, dt) {
    const en = e.entry, g = this.game, E = CONFIG.enemy, pl = g.player;
    en.t += dt;
    if (en.t < 0) { e.z = pl.z + en.rel + en.back; return; } // waiting for its turn in the shower
    if (en.landedAt < 0) {
      const u = Math.min(1, en.t / en.dur);
      if (!en.whoosh) { en.whoosh = true; g.audio.whoosh(); }
      e.dy = en.h0 * (1 - u * u);
      e.z = pl.z + en.rel + en.back * (1 - u); // tracks the player, so the landing distance is exact
      e.x = en.x0 + (en.x1 - en.x0) * u;
      e.land = 0.55 * smooth(0.62, 1, u);      // brace: knees come up, fist reaches down
      e.squash = -0.18 * (1 - u * 0.6);        // stretched by speed
      if (e.dy < 7 && Math.random() < 0.8) g.fx.particles.emit(e.x + (Math.random() - 0.5) * 0.3, e.dy + 1.1 * e.scale, e.z, 0, 0, 0, 0.14, 0.09, 0xffffff, 0, 0); // speed streak
      if (u >= 1) this._touchdown(e);
      return;
    }
    const k = en.t - en.landedAt;
    if (k < E.landHold) { e.land = 1; e.look = smooth(E.landHold * 0.4, E.landHold, k); return; }
    const r = (k - E.landHold) / E.landRise;
    e.land = 1 - smooth(0, 1, r); e.look = 1;
    if (r >= 1) { e.entry = null; e.land = 0; e.look = 0; }
  }

  _touchdown(e) {
    const en = e.entry, g = this.game, big = !!e.def.boss, s = e.scale;
    en.landedAt = en.t; e.airborne = false; e.dy = 0; e.land = 1; e.look = 0; e.squash = 0.22;
    e.z = g.player.z + en.rel; e.x = en.x1;
    const n = big ? 22 : 12;
    for (let i = 0; i < n; i++) { // dust ring hugging the ground
      const a = (i / n) * TAU + Math.random() * 0.4, sp = (big ? 5.5 : 3.4) * (0.7 + Math.random() * 0.5);
      g.fx.particles.emit(e.x + Math.cos(a) * 0.25 * s, 0.12, e.z + Math.sin(a) * 0.25 * s, Math.cos(a) * sp, 0.5 + Math.random() * 1.1, Math.sin(a) * sp, 0.45 + Math.random() * 0.2, 0.16 * s, 0xd9d0bf, 5, 3.2);
    }
    g.fx.particles.burst(e.x, 0.2, e.z, big ? 10 : 4, 0x8f887c, big ? 5 : 3, 0.08, 0.5, 14, 0.9); // stone chips
    g.fx.shock.spawn(e.x, e.z, big ? 5 : 2.4);
    g.fx.cracks.spawn(e.x, e.z, big ? 3.6 : 1.8);
    g.audio.land(big);
    if (big) g.shake(0.55); else if (Math.hypot(e.x - g.player.x, e.z - g.player.z) < 9) g.shake(0.22);
  }

  // ---------- damage & status ----------
  damage(e, amount, o = {}) {
    if (!e.alive || amount <= 0) return false;
    const g = this.game;
    e.hp -= amount;
    if (e.hitT > 0.08) { e.flash = e.isBoss ? 0.35 : 1; e.squash = e.isBoss ? 0.06 : 0.22; } // rapid hits don't keep it white
    e.hitT = 0;
    const src = o.src || 'normal';
    if (!o.silent) {
      const col = src === 'crit' ? COLORS.crit : src === 'frost' ? COLORS.frost : src === 'fire' ? COLORS.fire : src === 'lightning' ? COLORS.lightning : COLORS.normal;
      g.fx.numbers.spawn(e.x + (Math.random() - .5) * 0.4, 1.9 * e.scale, e.z, String(Math.max(1, Math.round(amount))), col, src === 'crit' ? 1.35 : e.isBoss ? 1.6 : 1);
    }
    if (src === 'crit') g.audio.crit(); else if (src === 'normal') g.audio.hit();
    this._shed(e);
    if (e.hp <= 0) { this.kill(e, o); return true; }
    if (o.execute && !e.guard && !e.isBoss) {
      const th = e.def.boss ? o.execute * 0.5 : o.execute;
      if (e.hp / e.maxHp < th) { g.fx.numbers.spawn(e.x, 2.2 * e.scale, e.z, '!', COLORS.crit, 1.4); g.audio.execute(); this.kill(e, { src: 'execute' }); return true; }
    }
    if (o.knockback && e.kbCd <= 0 && !e.guard && !e.isBoss) {
      const res = e.def.boss ? CONFIG.enemy.bruteKnockbackResist : 0;
      e.z += o.knockback * (1 - res); e.kbCd = 0.3;
    }
    return false;
  }

  _shed(e) {
    while (e.shed < e.k && e.hp / e.maxHp <= 1 - (e.shed + 1) / (e.k + 1)) {
      // next piece to drop in outside-in order
      let piece = null;
      for (const p of SHED_ORDER) if (e.pieces.includes(p)) { piece = p; break; }
      if (!piece) break;
      e.pieces.splice(e.pieces.indexOf(piece), 1); e.shed++;
      this._dropDebris(e, piece);
      this.game.audio.clank();
    }
  }

  _dropDebris(e, piece, scatter = false) {
    if (this.debris.length >= CONFIG.perf.maxDebris) this.debris.shift();
    const sides = (piece === 'pauldrons' || piece === 'gauntlets' || piece === 'knees' || piece === 'boots') ? [-1, 1] : [0];
    const yBase = { helmet: 1.55, visor: 1.45, chest: 1.0, pauldrons: 1.3, gauntlets: 0.85, knees: 0.4, boots: 0.1 }[piece] || 1;
    for (const side of sides) {
      const back = e.guard || e.isBoss ? -1 : 1; // push away from the player
      this.debris.push({
        part: piece, side, x: e.x + side * 0.3 * e.scale, y: yBase * e.scale, z: e.z,
        vx: (Math.random() - .5) * 3 + side * 1.5, vy: 3.5 + Math.random() * 2.5 + (scatter ? 2 : 0), vz: back * (2 + Math.random() * 3),
        rx: 0, ry: Math.random() * 6, rz: 0, wx: (Math.random() - .5) * 12, wz: (Math.random() - .5) * 12,
        life: CONFIG.enemy.debrisLife + 0.5, scale: e.scale, metal: e.metal,
      });
    }
  }

  applyFreeze(e, dur) { if (!e.alive || e.guard) { if (e.guard && e.alive) e.frozen = Math.max(e.frozen, dur); return; } if (e.frozen <= 0) this.game.audio.freeze(); e.frozen = Math.max(e.frozen, dur); }
  applyBurn(e, dur, dps) { if (!e.alive) return; if (e.burn <= 0) { this.game.audio.burn(); e.burnTick = 0.5; } e.burn = Math.max(e.burn, dur); e.burnDps = Math.max(e.burnDps, dps); }
  stun(e, dur) { if (!e.alive) return; e.stun = Math.max(e.stun, dur); }

  kill(e, o = {}) {
    if (!e.alive) return;
    e.alive = false; e.dead = true; e.deathT = 0; e.state = 'dead';
    const away = e.guard || e.isBoss ? -1 : 1;
    e.dvz = away * (4 + Math.random() * 3); e.dvy = 4 + Math.random() * 2; e.dvx = (Math.random() - .5) * 3; e.spin = (Math.random() - .5) * 10;
    if (o.flingBig) { e.dvy += 4; e.dvz += away * 6; }
    // remaining armor scatters
    for (const p of e.pieces.slice()) this._dropDebris(e, p, true);
    e.pieces.length = 0;
    const g = this.game;
    g.fx.particles.burst(e.x, 1.0 * e.scale, e.z, e.isBoss ? 60 : 8, PALETTE.enemy, 3.5, 0.13, 0.6);
    // status spreads
    if (e.frozen > 0 && g.stats.shatter) {
      for (const n of this.list) if (n !== e && n.alive && !n.airborne && Math.abs(n.x - e.x) < 2.5 && Math.abs(n.z - e.z) < 2.5) { this.applyFreeze(n, 0.5); }
      g.fx.particles.burst(e.x, 1, e.z, 14, PALETTE.frost, 4, 0.12, 0.5);
    }
    if (e.burn > 0 && g.stats.wildfire) {
      for (const n of this.list) if (n !== e && n.alive && !n.airborne && Math.abs(n.x - e.x) < 2.5 && Math.abs(n.z - e.z) < 2.5) this.applyBurn(n, e.burn, e.burnDps);
      g.fx.particles.burst(e.x, 1, e.z, 14, PALETTE.fire, 4, 0.12, 0.5);
    }
    g.onEnemyKilled(e, o);
  }

  // ---------- update ----------
  update(dt) {
    const g = this.game, pl = g.player, st = g.stats;
    const allies = g.allies.list;
    const grid = g.grid;
    // drummer aura
    const drummers = [];
    for (const e of this.list) { e.drummed = false; if (e.alive && e.type === 'drummer' && e.frozen <= 0 && e.stun <= 0) drummers.push(e); }
    if (drummers.length) for (const e of this.list) if (e.alive) for (const d of drummers) if (d !== e && Math.abs(e.x - d.x) < CONFIG.enemy.drummerRadius && Math.abs(e.z - d.z) < CONFIG.enemy.drummerRadius) { e.drummed = true; break; }
    const anyAllies = g.allies.aliveCount > 0;

    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i];
      // timers
      if (e.flash > 0) e.flash = Math.max(0, e.flash - dt / 0.06);
      if (e.squash !== 0) e.squash = damp(e.squash, 0, 14, dt);
      e.hitT += dt; e.lostFrac = damp(e.lostFrac, e.hp / e.maxHp, 6, dt);
      if (e.dead) {
        e.deathT += dt; e.dy += e.dvy * dt; e.dvy -= 14 * dt; e.z += e.dvz * dt; e.x += e.dvx * dt; e.pitch += e.spin * dt; e.roll += e.spin * 0.4 * dt;
        if (e.dy < -1.5) e.dy = -1.5;
        if (e.deathT > (e.isBoss ? 4 : 1.0)) this.list.splice(i, 1);
        continue;
      }
      if (e.entry) { this._updateEntry(e, dt); continue; }
      if (e.kbCd > 0) e.kbCd -= dt;
      if (e.frozen > 0) e.frozen -= dt;
      if (e.stun > 0) e.stun -= dt;
      if (e.slow > 0) e.slow -= dt;
      if (e.obstacleCd > 0) e.obstacleCd -= dt;
      if (e.burn > 0) {
        e.burn -= dt; e.burnTick -= dt;
        if (e.burnTick <= 0) { e.burnTick += 0.5; if (this.damage(e, e.burnDps * 0.5, { src: 'fire' })) continue; }
        if (Math.random() < 0.35) g.fx.particles.emit(e.x + (Math.random() - .5) * 0.5, 0.6 + Math.random() * 1.2 * e.scale, e.z + (Math.random() - .5) * 0.4, 0, 1.5 + Math.random(), 0, 0.35, 0.13, Math.random() < 0.5 ? PALETTE.fire : 0xffc040, -2, 1);
      }
      if (e.guard || e.isBoss) { this._updateGuard(e, dt); continue; }

      const moveMult = (e.frozen > 0 || e.stun > 0 || e.wallStun > 0) ? 0 : (e.slow > 0 ? 0.6 : 1) * (e.drummed ? 1 + CONFIG.enemy.drummerBoost : 1);
      if (e.wallStun > 0) e.wallStun -= dt;
      const dist = e.z - pl.z;
      let targetX = pl.x;
      let vz;
      if (e.state === 'latched') {
        const t = e.latch;
        if (t === 'player') {
          e.z = pl.z + 0.85 * (0.5 + 0.5 * e.scale); targetX = pl.x; vz = 0;
          if (moveMult > 0) g.damagePlayer(e.def.dps * st.enemyDamageMult * dt, 'enemy', { silent: true, noInvuln: true, dt });
          e.x = damp(e.x, pl.x, 8, dt);
          e.phase += dt * 6;
        } else if (t && t.alive) {
          e.z = t.z + 0.5; e.x = damp(e.x, t.x, 10, dt); vz = 0;
          if (moveMult > 0) { e.latchT += dt; if (e.latchT >= CONFIG.ally.latchKillTime) { g.allies.kill(t, 'enemy'); e.state = 'run'; e.latch = null; } }
          e.phase += dt * 6;
        } else { e.state = 'run'; e.latch = null; }
        if (e.state === 'latched') { e.vz = 0; continue; }
      }
      if (e.def.holdMin) { // back-line holders
        if (dist > e.def.holdMax + 1) vz = -e.speed;
        else if (dist < e.def.holdMin - 1) vz = -pl.speed * 0.65;
        else vz = -pl.speed - (e.holdDist - dist) * 0.3;
        vz *= moveMult;
        if (e.type === 'spear_thrower') this._spearAI(e, dt, dist);
        targetX = pl.x + Math.sin(e.id * 1.3 + g.time * 0.4) * 2.2;
      } else {
        vz = -e.speed * moveMult;
      }
      // obstacle avoidance: stone walls
      const wall = g.obstacles.wallAhead(e);
      if (wall) targetX = wall.gapX;
      // lateral steering with separation
      let sep = 0;
      grid.query(e.x, e.z, 1.2, (n) => { if (n !== e && n.alive) { const dx = e.x - n.x, dz = e.z - n.z; const d2 = dx * dx + dz * dz; const r = (e.radius + n.radius) * 0.95; if (d2 < r * r && d2 > 1e-4) { const d = Math.sqrt(d2); sep += (dx / d) * (r - d) * 6; } } });
      const steer = clamp(targetX - e.x, -1, 1) * CONFIG.enemy.lateralSpeed * (moveMult > 0 ? 1 : 0);
      e.vx = steer + sep;
      e.x = clamp(e.x + e.vx * dt, -CONFIG.player.xRange - 0.4, CONFIG.player.xRange + 0.4);
      e.z += vz * dt; e.vz = vz;
      e.phase += dt * (moveMult > 0 ? Math.abs(vz) * 1.9 / e.scale : 0);
      // contact: allies first, then the player
      if (moveMult > 0 && e.state === 'run') {
        if (anyAllies) {
          for (const a of allies) {
            if (!a.alive) continue;
            const dx = a.x - e.x, dz = a.z - e.z;
            if (dx * dx + dz * dz < (e.radius + 0.45) * (e.radius + 0.45)) { e.state = 'latched'; e.latch = a; e.latchT = 0; break; }
          }
        } else if (dist < CONFIG.player.contactRadius + e.radius * 0.5 && Math.abs(e.x - pl.x) < 0.9 + e.radius * 0.5) {
          let latched = 0; for (const o of this.list) if (o.alive && o.state === 'latched' && o.latch === 'player') latched++;
          if (latched < CONFIG.player.maxLatched) { e.state = 'latched'; e.latch = 'player'; e.latchT = 0; }
          else e.z = Math.max(e.z, pl.z + 1.9 + e.radius); // queue behind the biters
        }
      }
      // caltrops
      for (const c of this.caltrops) {
        if (c.hit.has(e.id)) continue;
        if (Math.abs(e.x - c.x) < 1.2 && Math.abs(e.z - c.z) < 1.2) { c.hit.add(e.id); e.slow = 2; this.damage(e, st.arrowDamage * (st.caltrops ? st.caltrops.dmgMult : 1.5), { src: 'normal' }); }
      }
      if (e.z < pl.z - 6) { this.list.splice(i, 1); } // passed far ahead, gone
    }
    // spears
    this._updateSpears(dt);
    // debris physics
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i]; d.life -= dt; if (d.life <= 0) { this.debris.splice(i, 1); continue; }
      d.vy -= 12 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt; d.rx += d.wx * dt; d.rz += d.wz * dt;
      if (d.y < 0.08) { d.y = 0.08; d.vy *= -0.35; d.vx *= 0.6; d.vz *= 0.6; d.wx *= 0.5; d.wz *= 0.5; if (Math.abs(d.vy) < 0.5) { d.vy = 0; d.wx = 0; d.wz = 0; } }
    }
    for (let i = this.caltrops.length - 1; i >= 0; i--) { const c = this.caltrops[i]; c.life -= dt; if (c.life <= 0 || c.z < pl.z - 5) this.caltrops.splice(i, 1); }
  }

  _updateGuard(e, dt) {
    const pl = this.game.player;
    const near = pl.z - e.z < CONFIG.bonus.raiseDistance && pl.z > e.z;
    const idleBoss = e.isBoss && this.game.bonus.phase === 'run'; // the Dark Lord waits with his sword up
    e.armRaise = damp(e.armRaise, near || idleBoss ? 1 : 0, 8, dt);
    e.phase += dt * 2;
  }

  _spearAI(e, dt, dist) {
    const g = this.game;
    if (dist > e.def.holdMax + 4 || dist < 4) return;
    e.spearT -= dt;
    if (e.warn === 0 && e.spearT <= CONFIG.enemy.spearWarn) { e.warn = 1; e.laneX = g.player.x; }
    if (e.spearT <= 0) {
      e.spearT = CONFIG.enemy.spearInterval; e.warn = 0;
      this.spears.push({ x: e.x, y: 1.6, z: e.z, startX: e.x, laneX: e.laneX, t: 0, alive: true, hitAllies: new Set() });
      g.audio.spear();
    }
  }

  _updateSpears(dt) {
    const g = this.game, pl = g.player;
    for (let i = this.spears.length - 1; i >= 0; i--) {
      const s = this.spears[i];
      s.t += dt;
      const prevZ = s.z;
      s.z -= CONFIG.enemy.spearSpeed * dt;
      s.x = s.startX + (s.laneX - s.startX) * Math.min(1, s.t / 0.35);
      const total = 1.6; s.y = 1.2 + Math.sin(Math.min(1, s.t / total) * Math.PI) * 2.0;
      // allies in the lane
      for (const a of g.allies.list) if (a.alive && Math.abs(a.x - s.x) < 0.5 && a.z <= prevZ && a.z > s.z) { g.allies.kill(a, 'spear'); }
      // player
      if (pl.z <= prevZ && pl.z > s.z && Math.abs(pl.x - s.x) < 0.65) {
        g.damagePlayer(CONFIG.enemy.spearDamage * g.stats.projectileDamageMult, 'spear', { shieldable: true });
      }
      if (s.z < pl.z - 8) this.spears.splice(i, 1);
    }
  }

  // ---------- helpers ----------
  nearest(x, z, r, filter) {
    let best = null, bd = r * r;
    this.game.grid.query(x, z, r, (e) => { if (!e.alive || (filter && !filter(e))) return; const dx = e.x - x, dz = e.z - z, d2 = dx * dx + dz * dz; if (d2 < bd) { bd = d2; best = e; } });
    return best;
  }
  forEachWithin(x, z, r, fn) { const r2 = r * r; this.game.grid.query(x, z, r, (e) => { if (!e.alive) return; const dx = e.x - x, dz = e.z - z; if (dx * dx + dz * dz <= r2) fn(e); }); }

  dropCaltrops(x, z) { this.caltrops.push({ x, z, life: 7, hit: new Set(), seed: Math.random() * 100 }); this.game.fx.particles.burst(x, 0.3, z, 8, 0x444a55, 2.5, 0.1, 0.4); }

  // ---------- render ----------
  render(rend, bruteRend, bossRend, fx, camera) {
    const g = this.game, t = g.time;
    rend.begin(); bruteRend.begin(); bossRend.begin();
    fx.hpBars.begin(camera);
    for (const e of this.list) {
      if (e.entry && e.entry.t < 0) continue; // not dropped in yet
      const v = _v;
      v.x = e.x; v.y = e.dy; v.z = e.z; v.scale = e.scale;
      v.yaw = e.yawFacing; v.pitch = e.dead ? e.pitch : (e.stun > 0 ? Math.sin(t * 30) * 0.08 : 0); v.roll = e.dead ? e.roll : 0;
      v.color = e.isBoss ? C_BOSS : C_ENEMY; v.metal = e.metal;
      v.phase = e.phase; v.run = e.dead || e.frozen > 0 || e.stun > 0 || e.guard || e.isBoss ? 0 : 1;
      v.armRaise = e.armRaise; v.aim = 0; v.flash = e.flash; v.squash = e.squash; v.frozen = e.frozen > 0;
      v.fall = e.airborne ? 1 : 0; v.land = e.land || 0; v.look = e.look || 0;
      v.shadowScale = e.dead ? 0.6 : e.airborne ? 0.3 + 0.7 * (1 - Math.min(1, e.dy / e.entry.h0)) : 1 + 0.2 * v.land;
      let f = piecesToFlags(e.pieces);
      if ((e.tier >= 4 || e.black) && !e.isBoss) f |= P.CAPE;
      if (e.eyes) f |= P.EYES;
      if (e.tier >= 5 && e.pieces.includes('helmet')) f |= P.TRIM;
      if (e.type === 'shieldbearer') f |= P.SHIELD;
      if (e.type === 'spear_thrower') f |= P.SPEAR;
      if (e.type === 'drummer') f |= P.DRUM;
      if (e.guard || e.isBoss) f |= P.SWORD;
      if (e.frozen > 0 && !e.dead) f |= P.ICE;
      v.flags = f; v.capeColor = e.black ? _capeBlack : (e.isBoss ? _capeBoss : null);
      if (e.isBoss) bossRend.draw(v); else if (e.def.boss) bruteRend.draw(v); else rend.draw(v);
      if (e.alive && e.hitT < CONFIG.enemy.hpBarHold + CONFIG.enemy.hpBarFade && !e.isBoss) {
        const a = e.hitT < CONFIG.enemy.hpBarHold ? 1 : 1 - (e.hitT - CONFIG.enemy.hpBarHold) / CONFIG.enemy.hpBarFade;
        fx.hpBars.add(e.x, 2.05 * e.scale, e.z, e.hp / e.maxHp, e.lostFrac, a, 1.0 * Math.sqrt(e.scale));
      }
      // flames on shoulders for black guards
      if (e.black && e.alive && Math.random() < 0.2) fx.particles.emit(e.x + (Math.random() < 0.5 ? -0.35 : 0.35) * e.scale, 1.45 * e.scale, e.z, 0, 1.2, 0, 0.3, 0.12, PALETTE.fire, -2, 1);
      // spear warning lane
      if (e.warn && e.alive) fx.danger.rect(e.laneX, (e.z + g.player.z) / 2, 0.5, Math.abs(e.z - g.player.z) + 2);
    }
    for (const d of this.debris) { if (d.life < 0.5) { /* fade: sink */ d.y -= 0.0; } rend.drawDebris(d); }
    rend.end(); bruteRend.end(); bossRend.end();
    fx.hpBars.end();
    fx.spears.begin();
    for (const s of this.spears) fx.spears.add(s.x, s.y, s.z, s.laneX - s.startX === 0 ? 0 : 0.0, -0.35, -1);
    fx.spears.end();
    fx.caltrops.begin();
    for (const c of this.caltrops) fx.caltrops.patch(c.x, c.z, c.seed);
    fx.caltrops.end();
  }
}
const _v = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, scale: 1, color: null, metal: null, phase: 0, run: 1, armRaise: 0, aim: 0, flags: 0, flash: 0, squash: 0, frozen: false, shadowScale: 1, capeColor: null };
const _capeBlack = new THREE.Color(0x14161c), _capeBoss = new THREE.Color(0x3a0f1a);
