import * as THREE from 'three';
import { CONFIG, PALETTE } from '../config.js';
import { P } from '../render/units.js';
import { damp } from '../util/math.js';

const C_ALLY = new THREE.Color(PALETTE.ally);
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

// Allies: small hooded archers in a springy cluster around the player. Only cards add them.
export class AllySystem {
  constructor(game) { this.game = game; this.list = []; this.slots = []; for (let k = 0; k < CONFIG.ally.max; k++) this.slots.push(this._slot(k)); }
  reset() { this.list.length = 0; }
  _slot(k) { const r = CONFIG.ally.baseRing + CONFIG.ally.ringStep * Math.sqrt(k); const a = k * GOLDEN + 1.2; return { r, a }; }
  get aliveCount() { let n = 0; for (const a of this.list) if (a.alive) n++; return n; }

  // Ensure `count` living allies (Recruit card). New ones appear beside the player.
  setCount(count) {
    let alive = this.aliveCount;
    const pl = this.game.player;
    while (alive < count) {
      const slot = this._freeSlot();
      this.list.push({ x: pl.x + (Math.random() - .5) * 1.5, z: pl.z + (Math.random() - .5) * 1.5, vx: 0, vz: 0, alive: true, deathT: 0, phase: Math.random() * 6, slot, fireDelay: -1, ftx: 0, ftz: 0, pitch: 0, dy: 0, dvy: 0, yaw: 0 });
      alive++;
      this.game.fx.particles.burst(pl.x, 0.8, pl.z, 6, PALETTE.ally, 2.5, 0.1, 0.4);
    }
  }
  _freeSlot() { const used = new Set(this.list.filter((a) => a.alive).map((a) => a.slot)); for (let k = 0; k < CONFIG.ally.max; k++) if (!used.has(k)) return k; return 0; }

  fireAt(tx, tz) {
    for (const a of this.list) if (a.alive) { a.fireDelay = Math.random() * CONFIG.ally.staggerMax; a.ftx = tx; a.ftz = tz; }
  }

  kill(a, cause) {
    if (!a.alive) return;
    a.alive = false; a.deathT = 0; a.dvy = 2.5;
    this.game.fx.particles.burst(a.x, 0.8, a.z, 6, PALETTE.ally, 3, 0.1, 0.45);
    this.game.onAllyDied(a, cause);
  }

  update(dt) {
    const g = this.game, pl = g.player;
    const tight = 1 - g.stats.formationTight;
    const facing = g.playerFacing; // +1 level (face +Z), -1 bonus
    for (let i = this.list.length - 1; i >= 0; i--) {
      const a = this.list[i];
      if (!a.alive) {
        a.deathT += dt; a.pitch = Math.min(Math.PI / 2, a.pitch + dt * 5); a.dy += a.dvy * dt; a.dvy -= 10 * dt; if (a.dy < 0) a.dy = 0;
        a.z += 0.5 * dt * facing; // slides slightly
        if (a.deathT > 0.8) this.list.splice(i, 1);
        continue;
      }
      const s = this.slots[a.slot];
      const tx = pl.x + Math.cos(s.a) * s.r * tight, tz = pl.z + Math.sin(s.a) * s.r * tight * 0.9 + 0.3 * facing;
      a.vx += (tx - a.x) * CONFIG.ally.spring * dt; a.vz += (tz - a.z) * CONFIG.ally.spring * dt;
      a.vx *= Math.pow(CONFIG.ally.damping, dt * 60); a.vz *= Math.pow(CONFIG.ally.damping, dt * 60);
      a.x += a.vx * dt; a.z += a.vz * dt;
      const lim = CONFIG.player.xRange + 0.5; if (a.x > lim) a.x = lim; if (a.x < -lim) a.x = -lim;
      a.phase += dt * (pl.speed * 1.9 + Math.hypot(a.vx, a.vz) * 1.5);
      a.yaw = facing > 0 ? 0 : Math.PI;
      if (a.fireDelay >= 0) { a.fireDelay -= dt; if (a.fireDelay < 0) { a.fireDelay = -1; g.arrows.fireAllyArrow(a.x, a.z, a.ftx, a.ftz); } }
    }
  }

  render(rend) {
    rend.begin();
    const v = _v;
    for (const a of this.list) {
      v.x = a.x; v.y = a.dy; v.z = a.z; v.scale = 0.82; v.yaw = a.yaw; v.pitch = a.pitch; v.roll = 0; v.color = C_ALLY; v.metal = null;
      v.phase = a.phase; v.run = a.alive ? 1 : 0; v.armRaise = 0; v.aim = a.fireDelay >= 0 ? 1 : 0.35; v.flags = P.HOOD | P.BOW; v.flash = 0; v.squash = 0; v.frozen = false; v.shadowScale = 1;
      rend.draw(v);
    }
    rend.end();
  }
}
const _v = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, scale: 1, color: null, metal: null, phase: 0, run: 1, armRaise: 0, aim: 0, flags: 0, flash: 0, squash: 0, frozen: false, shadowScale: 1, capeColor: null };
