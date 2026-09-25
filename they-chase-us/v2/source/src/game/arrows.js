import { CONFIG, PALETTE } from '../config.js';
import { COLORS } from '../render/fx.js';

// Arrows fly on analytic parabolas and resolve on landing (aim assist, shield shadow, area, chain, ricochet, rain).
export class ArrowSystem {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.volleyId = 0;
    this.shots = 0; // player shots for Arrow Rain
  }
  reset() { this.list.length = 0; this.volleyId = 0; this.shots = 0; }

  flightTime(d) { return CONFIG.arrow.flightBase + CONFIG.arrow.flightPerMeter * d; }

  _predict(e, sx, sz, ex, ez) {
    // one iteration of predictive aim on a moving enemy
    let d = Math.hypot(ex - sx, ez - sz);
    let T = this.flightTime(d);
    const px = e.x + e.vx * T * 0.5, pz = e.z + (e.vz || 0) * T;
    d = Math.hypot(px - sx, pz - sz); T = this.flightTime(d);
    return { x: px, z: e.z + (e.vz || 0) * T, T };
  }

  _spawn(a) {
    if (this.list.length >= CONFIG.arrow.maxActive) { // drop the oldest stuck arrow first
      const i = this.list.findIndex((x) => x.stuck); if (i >= 0) this.list.splice(i, 1); else this.list.shift();
    }
    a.t = 0; a.stuck = false; a.stuckT = 0; a.x = a.sx; a.y = a.sy; a.z = a.sz; a.px = a.sx; a.py = a.sy; a.pz = a.sz;
    const d = Math.hypot(a.ex - a.sx, a.ez - a.sz);
    if (a.dur == null) a.dur = this.flightTime(d);
    if (a.apex == null) a.apex = CONFIG.arrow.apexBase + CONFIG.arrow.apexPerMeter * d;
    a.color = a.color || (a.fx.element ? PALETTE[a.fx.element] : (a.owner === 'ally' ? 0xdbe9ff : 0xffffff));
    this.list.push(a);
    return a;
  }

  playerEffects(atMax) {
    const s = this.game.stats;
    return { element: s.element, frostBonus: s.frostBonus, freezeDur: s.freezeDuration, burnDur: s.burnDuration, burnPct: s.burnPct, chainCount: s.chainCount, chainPct: s.chainPct, thunder: s.thunderstruck, explosive: s.explosive, knockback: s.knockback, execute: s.execute, ricochet: s.ricochet, fullDraw: atMax ? s.fullDrawBonus : 0, crit: s.critChance, lifesteal: s.lifesteal };
  }
  allyEffects() {
    const s = this.game.stats;
    if (!s.sharedElement || !s.element) return { element: null, crit: 0 };
    return { element: s.element, frostBonus: s.frostBonus, freezeDur: s.freezeDuration, burnDur: s.burnDuration, burnPct: s.burnPct, chainCount: 1, chainPct: s.chainPct, thunder: false, crit: 0 };
  }

  // Player volley: n arrows fanned 0.8 m apart at the landing point. Each arrow gets its own aim assist.
  firePlayerVolley(sx, sy, sz, tx, tz, atMax, lockTarget) {
    const g = this.game, s = g.stats;
    const n = s.arrows; const fx = this.playerEffects(atMax);
    const vid = ++this.volleyId; g.enemies.volleyJumps = 0;
    this.shots++;
    const dmg = s.arrowDamage * (1 + fx.fullDraw);
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * CONFIG.player.multishotSpacing;
      let ex = tx + off, ez = tz, target = null;
      let e = (i === Math.floor((n - 1) / 2) && lockTarget && lockTarget.alive) ? lockTarget : g.enemies.nearest(ex, ez, CONFIG.player.aimAssistRadius);
      if (e) { const p = this._predict(e, sx, sz, ex, ez); ex = p.x; ez = p.z; target = e; }
      this._spawn({ owner: 'player', sx, sy, sz, ex, ey: 0.15, ez, dmg, crit: Math.random() < fx.crit, fx, target, volley: vid, bounces: fx.ricochet });
    }
    g.audio.release(n);
    // Arrow Rain
    if (s.arrowRain && this.shots % s.arrowRain.every === 0) this.fireRain(tx, tz, s.arrowRain.count, fx, vid);
    // allies fire at the landing point
    g.allies.fireAt(tx, tz);
  }

  fireRain(tx, tz, count, fx, vid) {
    const g = this.game;
    const rfx = { ...fx, explosive: null, ricochet: 0, isRain: true };
    for (let i = 0; i < count; i++) {
      const a = Math.random() * 6.283, r = Math.random() * CONFIG.arrow.rainRadius;
      const ex = tx + Math.cos(a) * r, ez = tz + Math.sin(a) * r;
      const e = g.enemies.nearest(ex, ez, 0.8);
      this._spawn({ owner: 'player', sx: ex + (Math.random() - .5) * 2, sy: 9, sz: ez - 3 + Math.random(), ex, ey: 0.15, ez, dmg: g.stats.arrowDamage, crit: Math.random() < fx.crit, fx: rfx, target: e, volley: vid, bounces: 0, dur: 0.55 + Math.random() * 0.35, apex: 0.5, delay: Math.random() * 0.3 });
    }
  }

  fireAllyArrow(sx, sz, tx, tz) {
    const g = this.game;
    const ex = tx + (Math.random() - .5) * 2 * CONFIG.ally.scatter, ez = tz + (Math.random() - .5) * 2 * CONFIG.ally.scatter;
    const e = g.enemies.nearest(ex, ez, 0.9);
    let fex = ex, fez = ez;
    if (e) { const p = this._predict(e, sx, sz, ex, ez); fex = p.x; fez = p.z; }
    this._spawn({ owner: 'ally', sx, sy: 1.2, sz, ex: fex, ey: 0.15, ez: fez, dmg: g.stats.allyDamage, crit: false, fx: this.allyEffects(), target: e, volley: this.volleyId, bounces: 0 });
  }

  fireRicochet(fromX, fromZ, e, dmg, bounces, fx, vid, exclude) {
    const p = this._predict(e, fromX, fromZ, e.x, e.z);
    this._spawn({ owner: 'player', sx: fromX, sy: 0.9, sz: fromZ, ex: p.x, ey: 0.15, ez: p.z, dmg, crit: Math.random() < (fx.crit || 0), fx: { ...fx, explosive: null }, target: e, volley: vid, bounces, isRicochet: true, exclude, apex: 0.3 + 0.03 * Math.hypot(p.x - fromX, p.z - fromZ) });
  }

  update(dt) {
    const g = this.game;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const a = this.list[i];
      if (a.delay > 0) { a.delay -= dt; continue; }
      if (a.stuck) { a.stuckT += dt; if (a.stuckT > 0.6) this.list.splice(i, 1); continue; }
      a.px = a.x; a.py = a.y; a.pz = a.z;
      a.t += dt;
      const u = Math.min(1, a.t / a.dur);
      a.x = a.sx + (a.ex - a.sx) * u; a.z = a.sz + (a.ez - a.sz) * u; a.y = a.sy + (a.ey - a.sy) * u + 4 * a.apex * u * (1 - u);
      if (Math.random() < 0.5 && a.fx.element) g.fx.particles.emit(a.x, a.y, a.z, 0, 0, 0, 0.25, 0.08, a.color, 0, 0);
      // mid-flight: the shaft passes through a body -> that enemy takes the hit (enemies at your feet are no longer flown over)
      if (u < 1) {
        const BH = CONFIG.arrow.bodyHeight, BR = CONFIG.arrow.bodyRadius;
        const e = g.enemies.nearest(a.x, a.z, 1.2, (n) => n !== a.exclude && a.y < BH * n.scale && Math.hypot(n.x - a.x, n.z - a.z) < n.radius + BR);
        if (e) { this._impact(a, e, a.x, a.z); a.stuck = true; a.stuckT = 0.3; continue; }
      }
      if (u >= 1) { this._land(a); a.stuck = true; a.y = 0.1; }
    }
  }

  _land(a) {
    const g = this.game, en = g.enemies;
    let primary = (a.target && a.target.alive) ? a.target : en.nearest(a.ex, a.ez, CONFIG.player.hitRadius + 0.3);
    if (primary && !primary.alive) primary = null;
    let dmgMult = 1;
    // shield shadow: landing within 1.5 m behind a living shieldbearer hits the shield for 20%
    const sb = en.nearest(a.ex, a.ez, 2.2, (e) => e.type === 'shieldbearer' && e.alive && a.ez > e.z - 0.3 && a.ez <= e.z + CONFIG.enemy.shieldShadowDepth && Math.abs(a.ex - e.x) < e.radius + 0.5);
    if (sb && primary !== sb) { primary = sb; dmgMult = CONFIG.enemy.shieldShadowDamage; g.fx.particles.burst(sb.x, 1.0, sb.z - 0.3, 4, 0xffffff, 2, 0.08, 0.3); g.audio.clank(); }
    else if (sb && primary === sb && a.ez > sb.z + 0.2) { dmgMult = CONFIG.enemy.shieldShadowDamage; }
    if (primary) { this._impact(a, primary, a.ex, a.ez, dmgMult); return; }
    g.fx.particles.dust(a.ex, a.ez, 4);
    if (a.fx.explosive) this._blast(a, a.ex, a.ez, null);
  }

  // a direct hit on `e` at (x,z): damage + effects, area blast, ricochet
  _impact(a, e, x, z, dmgMult = 1) {
    const g = this.game, en = g.enemies;
    this.hit(e, a, dmgMult);
    if (a.fx.explosive) this._blast(a, x, z, e);
    if (a.bounces > 0) {
      const next = en.nearest(x, z, CONFIG.arrow.ricochetRange, (n) => n !== e && n.alive);
      if (next) this.fireRicochet(x, z, next, a.dmg * 0.6, a.bounces - 1, a.fx, a.volley, e);
    }
  }
  _blast(a, x, z, primary) {
    const g = this.game, ex = a.fx.explosive;
    g.fx.particles.burst(x, 0.3, z, 10, 0xffb060, 3, 0.12, 0.4);
    g.enemies.forEachWithin(x, z, ex.radius, (e) => { if (e !== primary) this.hit(e, a, ex.pct, true); });
  }

  hit(e, a, mult = 1, isBlast = false) {
    const g = this.game, en = g.enemies, fx = a.fx;
    let dmg = a.dmg * mult;
    const crit = a.crit && !isBlast;
    if (crit) dmg *= 2;
    const fromZ = a.sz;
    if (crit) { g.fx.particles.burst(e.x, 1.4 * e.scale, e.z, 6, PALETTE.crit, 3, 0.1, 0.35); g.shake(0.12); }
    g.fx.particles.dust(e.x, e.z, 3);
    if (a.owner === 'player') e.chainMark = a.volley;
    const killed = en.damage(e, dmg, { src: crit ? 'crit' : 'normal', knockback: (!isBlast && fx.knockback) || 0, execute: fx.execute || 0 });
    if (killed) return;
    if (!fx.element) return;
    if (fx.element === 'frost') {
      if (fx.frostBonus && en.damage(e, dmg * fx.frostBonus, { src: 'frost' })) return;
      en.applyFreeze(e, fx.freezeDur);
    } else if (fx.element === 'fire') {
      en.applyBurn(e, fx.burnDur, a.dmg * fx.burnPct);
    } else if (fx.element === 'lightning' && !isBlast) {
      this.chainFrom(e, a, dmg);
    }
  }

  chainFrom(start, a, dmg) {
    const g = this.game, en = g.enemies, fx = a.fx;
    let cur = start;
    for (let j = 0; j < fx.chainCount; j++) {
      if (en.volleyJumps >= 30) break;
      const next = en.nearest(cur.x, cur.z, 4, (e) => e !== cur && e.chainMark !== a.volley);
      if (!next) break;
      next.chainMark = a.volley; en.volleyJumps++;
      g.fx.lightning.add(cur.x, 1.3 * cur.scale, cur.z, next.x, 1.3 * next.scale, next.z);
      g.audio.lightning();
      const killed = en.damage(next, dmg * fx.chainPct, { src: 'lightning' });
      if (!killed && fx.thunder) en.stun(next, 0.3);
      cur = next;
    }
  }

  render(rend) {
    rend.begin();
    for (const a of this.list) {
      if (a.delay > 0) continue;
      let dx = a.x - a.px, dy = a.y - a.py, dz = a.z - a.pz;
      if (a.stuck) { dx = a.ex - a.sx; dz = a.ez - a.sz; dy = -1.2; }
      if (dx * dx + dy * dy + dz * dz < 1e-8) { dz = 1; }
      rend.add(a.x, a.y, a.z, dx, dy, dz, a.color);
    }
    rend.end();
  }
}
