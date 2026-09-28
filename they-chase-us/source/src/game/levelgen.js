import { CONFIG, hpBudget, highestTier, obstacleEvents, TIER_MULT } from '../config.js';
import { ENEMY_TYPES, typesForLevel } from '../data/enemies.js';
import { obstaclesForLevel } from '../data/obstacles.js';
import { RNG, seedForLevel } from '../util/rng.js';

const W = CONFIG.player.roadWidth;
const FTUE_DURATION = [40, 50, 60, 65, 70, 70, 75, 75];

// Builds the deterministic event list of a level: waves, trickle singles, obstacles, the Brute and FTUE hints.
export function generateLevel(L) {
  const rng = new RNG(seedForLevel(L));
  const ftue = L <= 8;
  const duration = ftue ? FTUE_DURATION[L - 1] : CONFIG.level.normalDuration;
  const budget = hpBudget(L) * (ftue ? CONFIG.balance.ftueBudgetBase + CONFIG.balance.ftueBudgetPerLevel * L : 1);
  const types = typesForLevel(L);
  const events = [];
  const hi = ftue ? [0, 0, 1, 1, 1, 1, 1, 2][L - 1] : highestTier(L);

  const tierFor = (type) => {
    let t;
    if (ftue) {
      if (L <= 2) t = 0;
      else if (L === 3) t = rng.chance(0.5) ? 1 : 0;
      else if (L <= 6) t = rng.chance(0.55) ? 1 : 0;
      else if (L === 7) t = 1;
      else t = rng.chance(0.4) ? 2 : 1;
    } else {
      const r = rng.next();
      t = r < 0.25 ? hi : r < 0.7 ? hi - 1 : hi - 2;
      t = Math.max(0, t);
    }
    if (type === 'shieldbearer') t = Math.min(5, t + 1);
    return t;
  };

  // ---- waves ----
  const waves = [];
  let t = 0.5; // the first wave is already coming when the run starts
  const gapMin = ftue ? CONFIG.level.waveGapMinFtue : CONFIG.level.waveGapMin, gapMax = ftue ? CONFIG.level.waveGapMaxFtue : CONFIG.level.waveGapMax;
  while (t < duration - 5) {
    const ph = t < CONFIG.level.phases.warmup ? 'warmup' : t < CONFIG.level.phases.rise ? 'rise' : t < CONFIG.level.phases.peak ? 'peak' : 'finale';
    const w = ph === 'warmup' ? 0.6 : ph === 'rise' ? 1.0 : ph === 'peak' ? 1.6 : 1.4;
    waves.push({ t, ph, w });
    t += rng.range(gapMin, gapMax);
  }
  const totalW = waves.reduce((s, w) => s + w.w, 0);
  const waveBudget = budget * 0.85;
  for (const wv of waves) {
    const share = waveBudget * wv.w / totalW;
    // template
    const avail = types;
    const tmpl = [];
    if (avail.includes('runner') && wv.ph !== 'warmup' && rng.chance(0.25)) tmpl.push('swarm');
    if (avail.includes('shieldbearer') && wv.ph !== 'warmup' && rng.chance(0.4)) tmpl.push('shield');
    if ((avail.includes('spear_thrower') || avail.includes('drummer')) && wv.ph !== 'warmup' && rng.chance(0.5)) tmpl.push('backline');
    if (avail.includes('runner')) tmpl.push('mixed');
    tmpl.push('foot');
    const kind = rng.pick(tmpl);
    const units = [];
    let spent = 0;
    const add = (type) => { const tier = tierFor(type); const hp = ENEMY_TYPES[type].hp * TIER_MULT[tier]; units.push({ type, tier }); spent += hp; };
    if (kind === 'shield') { const n = rng.int(1, 3); for (let i = 0; i < n; i++) add('shieldbearer'); }
    if (kind === 'backline') {
      const bl = ['spear_thrower', 'drummer'].filter((x) => avail.includes(x));
      const n = rng.int(1, 2); for (let i = 0; i < n; i++) add(rng.pick(bl));
    }
    let guard = 0;
    while (spent < share && units.length < 16 && guard++ < 40) {
      if (kind === 'swarm') add('runner');
      else if (kind === 'mixed') add(rng.chance(0.5) ? 'runner' : 'footman');
      else add('footman');
    }
    if (units.length < 2) add('footman');
    const formation = rng.pick(kind === 'swarm' ? ['blob', 'row', 'wedge'] : kind === 'shield' ? ['row', 'wedge'] : ['column', 'row', 'wedge', 'blob']);
    events.push({ t: wv.t, kind: 'wave', units, formation, x: rng.range(-2.2, 2.2) });
  }
  // ---- trickle singles ----
  // 15% of the budget, spread evenly between waves
  const trickleTypes = types.filter((x) => x === 'footman' || x === 'runner');
  const trickleN = Math.max(1, Math.floor((budget * 0.15) / (ENEMY_TYPES.footman.hp * TIER_MULT[Math.max(0, hi - 1)])));
  const trickleGap = (duration - 11) / trickleN;
  for (let i = 0; i < trickleN; i++) {
    const tt = 3 + i * trickleGap + rng.range(-1, 1);
    const type = rng.pick(trickleTypes);
    events.push({ t: tt, kind: 'single', type, tier: tierFor(type), x: rng.range(-3, 3) });
  }
  // ---- brute ----
  if (L >= 6) events.push({ t: duration * CONFIG.enemy.bruteArrivalFrac, kind: 'brute', x: rng.range(-1.5, 1.5) });

  // ---- obstacles ----
  const obs = [];
  const allowed = obstaclesForLevel(L);
  const pushObs = (tt, type) => {
    const o = { t: tt, kind: 'obstacle', type, side: rng.sign() };
    if (type === 'stone_wall') { if (rng.chance(0.35)) { o.x = 0; o.w = 2.7 + rng.range(0, 0.3); } else { o.w = rng.range(2.7, 4); o.x = o.side * (W / 2 - o.w / 2); } }
    else if (type === 'floor_spikes') { o.x = rng.range(-2.6, 2.6); o.w = 2.5; }
    else if (type === 'pendulum_axe') { o.x = 0; }
    else if (type === 'giant_sentinel') { o.x = 0; }
    else if (type === 'rolling_log') { o.x = o.side * W / 4; }
    obs.push(o);
  };
  if (ftue) {
    const plan = { 1: [], 2: [[15, 'stone_wall'], [30, 'stone_wall']], 3: [[14, 'floor_spikes'], [26, 'stone_wall'], [40, 'floor_spikes']],
      4: [[12, 'stone_wall'], [24, 'floor_spikes'], [40, 'stone_wall'], [52, 'floor_spikes']],
      5: [[14, 'pendulum_axe'], [26, 'floor_spikes'], [38, 'stone_wall'], [50, 'pendulum_axe']],
      6: [[14, 'giant_sentinel'], [26, 'floor_spikes'], [40, 'pendulum_axe'], [52, 'stone_wall']],
      7: [[12, 'floor_spikes'], [22, 'giant_sentinel'], [34, 'stone_wall'], [46, 'pendulum_axe'], [58, 'floor_spikes']],
      8: [[14, 'rolling_log'], [24, 'floor_spikes'], [34, 'stone_wall'], [44, 'rolling_log'], [54, 'giant_sentinel'], [64, 'pendulum_axe']] }[L];
    for (const [tt, type] of plan) pushObs(tt, type);
  } else {
    const n = Math.floor(obstacleEvents(L));
    let tt = 10; let lastSide = 0;
    for (let i = 0; i < n && tt < duration - 8; i++) {
      const type = rng.pick(allowed);
      pushObs(tt, type);
      const o = obs[obs.length - 1];
      if (o.side === lastSide && rng.chance(0.5)) { o.side = -o.side; if (type === 'stone_wall' && o.x !== 0) o.x = -o.x; if (type === 'rolling_log') o.x = -o.x; }
      lastSide = o.side;
      tt += CONFIG.obstacle.minGap + rng.range(0.5, 3.5);
    }
  }
  events.push(...obs);

  // ---- FTUE hints ----
  const hints = { 2: [[1.5, 'Drag to dodge']], 3: [[2, 'Armor breaks as HP drops']], 4: [[2, 'Aim behind the shields']], 5: [[2, 'Dodge the spears sideways']], 6: [[2, 'A Brute is coming']], 7: [[2, 'Shoot the Drummers first']], 8: [[2, 'Lure them into traps']] }[L] || [];
  for (const [tt, text] of hints) events.push({ t: tt, kind: 'hint', text });

  events.sort((a, b) => a.t - b.t);
  return { level: L, duration, budget, events, ftue };
}

// spawn offsets for a formation of n units: returns [{dx, dz}]
export function formationOffsets(formation, n, rng) {
  const out = [];
  for (let i = 0; i < n; i++) {
    let dx = 0, dz = 0;
    switch (formation) {
      case 'column': dx = (rng.next() - 0.5) * 0.6; dz = i * 1.3; break;
      case 'row': dx = (i - (n - 1) / 2) * Math.min(1.2, 6 / Math.max(1, n - 1)); dz = (rng.next() - 0.5) * 0.6 + Math.floor(i / 6) * 1.4; break;
      case 'wedge': { const k = Math.floor((i + 1) / 2), s = i % 2 ? 1 : -1; dx = s * k * 0.9; dz = k * 1.1; break; }
      default: dx = (rng.next() - 0.5) * 4.5; dz = rng.next() * 4;
    }
    out.push({ dx, dz });
  }
  return out;
}
