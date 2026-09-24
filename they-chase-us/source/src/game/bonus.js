import { CONFIG, PALETTE, guardHp, TIER_NAMES } from '../config.js';
import { RNG, seedForLevel } from '../util/rng.js';
import { clamp, damp } from '../util/math.js';

// Multiplier bridge and the Dark Lord (GDD section 9).
export class BonusSystem {
  constructor(game) { this.game = game; this.rows = []; this.phase = 'idle'; this.mult = 1; this.boss = null; }

  start() {
    const g = this.game, L = g.level, w = g.world;
    const rng = new RNG(seedForLevel(L, 99));
    const segs = L === 1 ? CONFIG.bonus.ftueSegments : CONFIG.bonus.segments;
    this.segments = segs; this.rows = []; this.mult = 1; this.phase = 'run'; this.fireT = 0; this.stopper = null; this.stopT = 0; this.boss = null;
    this.slamT = CONFIG.bonus.bossSlam; this.slamWarn = false; this.slamX = 0; this.victoryT = 0; this.bossRoared = false;
    g.enemies.reset();
    for (let s = 1; s <= segs; s++) {
      const z = w.bridgeStart - (s - 1) * CONFIG.bonus.segmentLength - 2 - CONFIG.bonus.segmentLength * 0.75; // row at 75% of the segment
      const n = rng.int(3, 5);
      const tier = Math.min(5, 1 + Math.floor((s - 1) / 4));
      const weak = rng.int(0, n - 1);
      const hp = guardHp(s, L);
      const scale = 1 + CONFIG.bonus.sizeGrowth * (s - 1);
      const guards = [];
      for (let i = 0; i < n; i++) {
        const x = n === 1 ? 0 : -2.9 + (5.8 * i) / (n - 1);
        const isWeak = i === weak;
        const t = isWeak ? Math.max(0, tier - 1) : tier;
        const mult = s + 1;
        const e = g.enemies.spawn('footman', t, x, z, { guard: true, weak: isWeak, hp: isWeak ? hp * CONFIG.bonus.weakHpFrac : hp, scale, segment: s, eyes: mult >= 10, black: mult >= 15, name: t === 0 ? 'Peasant Guard' : TIER_NAMES[t], force: true });
        if (e) { e.speed = 0; guards.push(e); }
      }
      this.rows.push({ s, z, mult: s + 1, guards, passed: false, weakHp: hp * CONFIG.bonus.weakHpFrac });
    }
    this.arenaEntryZ = w.arenaZ;
    // the Dark Lord waits in the arena from the start: visible at the end of the bridge
    const bossHp = this.lastRow.weakHp * CONFIG.bonus.bossHpFactor;
    this.boss = g.enemies.spawn('brute', 5, 0, this.arenaEntryZ - CONFIG.bonus.bossStart, { isBoss: true, hp: bossHp, scale: 2.1, black: true, eyes: true, name: 'The Dark Lord', force: true });
    if (this.boss) { this.boss.pieces = ['helmet', 'chest', 'pauldrons', 'gauntlets', 'knees', 'visor', 'boots', 'cape']; this.boss.k = 8; this.boss.radius = 2.2; this.boss.speed = 0; }
    g.ui.showBonusHud(true);
  }

  get lastRow() { return this.rows[this.rows.length - 1]; }

  update(dt) {
    const g = this.game, pl = g.player, st = g.stats, L = g.level;
    if (this.phase === 'stopped') { this.stopT += dt; if (this.stopT > 1.4) { this.phase = 'done'; g.endBonus(this.mult, this.stopper); } return; }
    if (this.phase === 'victory') { this.victoryT += dt; if (this.victoryT > 2.6) { this.phase = 'done'; g.endBonus(CONFIG.bonus.bossMultiplier, { name: 'The Dark Lord', tier: 5, hp: 0, victory: true }); } return; }
    if (this.phase === 'done') return;

    // sideways control only
    if (this.phase === 'run') pl.z -= CONFIG.player.bonusRunSpeed * dt;
    // sunset toward the arena
    const distArena = pl.z - this.arenaEntryZ;
    g.sceneM.setSunset(clamp(1 - distArena / 60, 0, 1));

    // auto-fire at the guard in range closest to the player's X
    this.fireT -= dt;
    if (this.fireT <= 0) {
      let best = null, bs = 1e9;
      for (const e of g.enemies.list) {
        if (!e.alive) continue;
        const dz = pl.z - e.z; if (dz < 0.5 || dz > st.maxRange) continue;
        const score = Math.abs(e.x - pl.x) * 3 + dz * 0.2;
        if (score < bs) { bs = score; best = e; }
      }
      if (best) {
        this.fireT = st.fireInterval;
        const dz = pl.z - best.z;
        g.arrows.firePlayerVolley(pl.x, 1.3, pl.z, best.x, best.z, dz > 0.9 * st.maxRange, best);
        pl.aimPulse = 1;
      } else this.fireT = 0.1;
    }

    // rows: pass & collide
    for (const r of this.rows) {
      if (!r.passed && pl.z < r.z - 0.7) { r.passed = true; this.mult = r.mult; g.ui.multPop(r.mult); g.audio.arch(); g.fx.particles.burst(pl.x, 1.5, pl.z, 12, PALETTE.gold, 3, 0.1, 0.5); }
      for (const e of r.guards) {
        if (!e.alive) continue;
        const rr = e.radius + 0.55;
        if (Math.abs(e.x - pl.x) < rr && Math.abs(e.z - pl.z) < rr) { this._stop(e); return; }
        for (const a of g.allies.list) if (a.alive && Math.abs(e.x - a.x) < e.radius + 0.35 && Math.abs(e.z - a.z) < e.radius + 0.35) g.allies.kill(a, 'guard');
      }
    }

    // arena (levels 1-2 have the short bridge only: the run ends after the last row)
    if (this.phase === 'run' && L < 3 && this.lastRow.passed && pl.z < this.lastRow.z - 6) { this.phase = 'done'; g.endBonus(this.mult, null); return; }
    if (this.phase === 'run' && pl.z <= this.arenaEntryZ) {
      this.phase = 'arena'; pl.z = this.arenaEntryZ;
      g.audio.roar(); g.shake(0.5); g.ui.bossBar(1, 'The Dark Lord');
    }
    if (this.phase === 'arena' && this.boss) {
      const b = this.boss;
      if (!b.alive) { if (!this.victoryStarted) { this.victoryStarted = true; this.phase = 'victory'; g.setTimeScale(0.25, 0.1); g.audio.victory(); g.shake(0.6); g.ui.bossBar(null); } return; }
      b.z += CONFIG.bonus.bossSpeed * dt; b.phase += dt * 1.5;
      g.ui.bossBar(b.hp / b.maxHp, 'The Dark Lord');
      if (b.z >= pl.z - 2.6) { this._stop(b, true); return; }
      // slam
      const enraged = b.hp / b.maxHp < CONFIG.bonus.bossEnrageHp;
      this.slamT -= dt;
      if (!this.slamWarn && this.slamT <= CONFIG.bonus.bossSlamWarn) { this.slamWarn = true; this.slamX = pl.x; }
      if (this.slamT <= 0) {
        this.slamT = enraged ? CONFIG.bonus.bossSlamEnraged : CONFIG.bonus.bossSlam; this.slamWarn = false;
        const hw = CONFIG.player.roadWidth * CONFIG.bonus.bossSlamWidth / 2;
        g.audio.impact(); g.shake(0.45); g.fx.particles.burst(this.slamX, 0.3, pl.z, 24, 0x6b7280, 5, 0.16, 0.6);
        for (const a of g.allies.list) if (a.alive && Math.abs(a.x - this.slamX) < hw && Math.abs(a.z - pl.z) < 3) g.allies.kill(a, 'boss');
        if (Math.abs(pl.x - this.slamX) < hw) { this._stop(b, true); return; }
      }
    }
  }

  _stop(guard, isBoss = false) {
    const g = this.game;
    this.phase = 'stopped'; this.stopT = 0;
    this.stopper = { name: guard.name, tier: guard.tier, hp: Math.round(guard.hp), segment: guard.segment, isBoss };
    g.player.fallT = 0.001; g.audio.death(); g.shake(0.4);
    for (const a of g.allies.list) if (a.alive) g.allies.kill(a, 'guard');
    g.setTimeScale(0.4, 0.1);
    g.ui.bossBar(null);
  }

  render(danger) {
    if (this.phase === 'arena' && this.slamWarn) {
      const hw = CONFIG.player.roadWidth * CONFIG.bonus.bossSlamWidth;
      danger.rect(this.slamX, this.game.player.z - 0.5, hw, 6);
    }
  }
}
