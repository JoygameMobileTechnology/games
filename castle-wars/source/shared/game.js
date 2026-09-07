import { WORLD, RULES, WEAPONS, DEFAULT_WEAPONS, MATERIALS, WEAPON_POOLS } from './content.js';
import { FORMATIONS, selectFormation, formationMetadata } from './formations.js';
import { createVictoryPresentation, presentationEventDuration } from './presentation.js';

const STEP = 1000 / 30;
const EPS = 0.02;
const DEFAULT_CONFIG = { countdownMs: 4000, turnMs: 20000, regulationMs: 240000, transitionMs: 6000, resolutionMs: 2000, waterMs: 650 };
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const overlap = (a, b) => a.x < b.x + b.w - EPS && a.x + a.w > b.x + EPS && a.y < b.y + b.h - EPS && a.y + a.h > b.y + EPS;
const horizontal = (a, b) => a.x < b.x + b.w - EPS && a.x + a.w > b.x + EPS;
const aliveTiles = s => s.tiles.filter(t => t.hp > 0);
const livingUnits = s => s.teams.flatMap(t => t.units).filter(u => u.alive);
const center = b => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
function random(seed) {
  let n = 2166136261;
  for (const c of String(seed)) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
  return () => { n += 0x6d2b79f5; let t = n; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function event(g, type, values = {}) {
  const e = { id: `${g.state.matchId}:e${++g.eventId}`, type, at: g.state.now, ...values };
  g.state.events.push(e);
  if (g.state.events.length > 90) {
    // Preserve readable action effects when a big blast damages many bricks.
    const damageIndex = g.state.events.findIndex(item => item.type === 'damage');
    g.state.events.splice(damageIndex < 0 ? 0 : damageIndex, 1);
  }
  if (presentationEventDuration(e) || type === 'explosion' || type === 'death') {
    // A single large blast can evict its own explosion event from the ordinary
    // stream with masonry damage. Keep only active finale events separately.
    g.presentationEvents = g.presentationEvents.filter(effect => effect.at + Math.max(2500, presentationEventDuration(effect)) > g.state.now);
    g.presentationEvents.push(e);
  }
  return e;
}
function castle(side, formation) {
  const mirror = (x, w) => side ? WORLD.width - x - w : x;
  const tiles = formation.rows.flatMap((line, row) => [...line].flatMap((cell, col) => {
    if (cell !== '#') return [];
    const y = formation.origin.y + row * WORLD.tileSize;
    const material = y >= 610 ? 'reinforced' : 'masonry';
    const hp = MATERIALS[material].hp;
    return [{ id: `s${side}:t${col}:${row}`, side,
      x: mirror(formation.origin.x + col * WORLD.tileSize, WORLD.tileSize), y,
      w: WORLD.tileSize, h: WORLD.tileSize, hp, maxHp: hp, material, falling: false }];
  }));
  const units = formation.units.map(({ x, y, needsArc }, order) => ({ id: `s${side}:u${order}`, side, order,
    x: mirror(x, 32), y, w: 32, h: 40, hp: 100, maxHp: 100, alive: true, needsArc: Boolean(needsArc) }));
  const core = { id: `s${side}:core`, side, x: mirror(formation.core.x, 46), y: formation.core.y, w: 46, h: 52, hp: RULES.coreHp, maxHp: RULES.coreHp };
  return { team: { side, core, units, ammo: Object.fromEntries(DEFAULT_WEAPONS.map(id => [id, -1])), cursor: 0 }, tiles };
}

export function createGame({ id = 'castle-match', seed = 1, firstSide = 0, now = 0, config = {}, formationId, excludeFormationId } = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  for (const [key, value] of Object.entries(cfg)) if (!Number.isFinite(value) || value < 0) throw new Error(`Invalid game config: ${key}`);
  const formation = formationId === undefined ? selectFormation(seed, excludeFormationId) : FORMATIONS.find(f => f.id === formationId);
  if (!formation) throw new Error(`Unknown formation: ${formationId}`);
  const rng = random(seed), a = castle(0, formation), b = castle(1, formation);
  const state = {
    matchId: id, now, formation: formationMetadata(formation), phase: 'countdown', countdownEndsAt: now + cfg.countdownMs,
    turnId: 0, activeSide: firstSide === 1 ? 1 : 0, activeUnitId: null,
    turnDeadline: 0, regulationEndsAt: now + cfg.countdownMs + cfg.regulationMs,
    elapsed: 0, round: 1, completedTurns: 0, waterY: WORLD.height + 20,
    waterRise: 0, suddenDeath: false, suddenTurns: 0, nextWaterY: null,
    lineup: WEAPON_POOLS.map(pool => pool[Math.floor(rng() * pool.length)]), unlockedCount: 0,
    teams: [a.team, b.team], tiles: [...a.tiles, ...b.tiles], projectiles: [], events: [], result: null,
  };
  const windLevel = Math.floor(rng() * 15) - 7;
  state.wind = { acceleration: windLevel * 10, level: windLevel, changesAfterTurns: 2 };
  return { state, config: cfg, rng, lastTick: now, simAt: now, startAt: state.countdownEndsAt, eventId: 0, objectId: 0, pulses: [], presentationEvents: [], chunks: [], bodyMotion: new Map(), damageBudget: new Map(), actionStartedAt: 0, aftermathStartedAt: null, settleAt: 0, waterEndsAt: 0, dirtyStructure: false };
}

export function snapshotGame(g) {
  return JSON.parse(JSON.stringify(g.state));
}

export function endGame(g, winner, reason, interrupted = false, presentDestruction = false) {
  if (g.state.result) return;
  g.state.result = { winner: winner === 0 || winner === 1 ? winner : null, reason, interrupted, endedAt: g.state.now,
    presentation: presentDestruction && !interrupted ? createVictoryPresentation(g.presentationEvents, g.state.now, g.state.teams, g.state.suddenDeath) : null };
  g.state.phase = 'ended'; g.state.projectiles = []; g.pulses = [];
  event(g, 'result', g.state.result);
}

function victory(g, cause = '') {
  if (g.state.result) return true;
  const dead = g.state.teams.map(t => t.core.hp <= 0 || !t.units.some(u => u.alive));
  if (!dead.some(Boolean)) return false;
  if (dead[0] && dead[1]) endGame(g, null, cause === 'water' ? 'Both crews drowned together' : 'Mutual destruction', false, true);
  else {
    const loser = dead[0] ? 0 : 1;
    endGame(g, 1 - loser, g.state.teams[loser].core.hp <= 0 ? 'Enemy core destroyed' : cause === 'water' ? 'Last crew above water' : 'Enemy crew eliminated', false, true);
  }
  return true;
}

function startTurn(g) {
  const s = g.state;
  if (victory(g)) return;
  const team = s.teams[s.activeSide];
  let index = team.cursor % team.units.length;
  for (let k = 0; k < team.units.length && !team.units[index].alive; k++) index = (index + 1) % team.units.length;
  team.cursor = index;
  s.activeUnitId = team.units[index].id;
  s.phase = 'aim'; s.turnId++;
  s.turnDeadline = s.suddenDeath ? s.now + g.config.turnMs : Math.min(s.now + g.config.turnMs, s.regulationEndsAt - g.config.transitionMs);
  s.round = Math.floor(s.completedTurns / 2) + 1;
  event(g, 'turn', { side: s.activeSide, unitId: s.activeUnitId, turnId: s.turnId });
}
function unlock(g) {
  const s = g.state;
  if (s.completedTurns % 2 || s.unlockedCount >= s.lineup.length) return;
  const weaponId = s.lineup[s.unlockedCount++];
  for (const t of s.teams) t.ammo[weaponId] = WEAPONS[weaponId].ammo;
  event(g, 'unlock', { weaponId, step: s.unlockedCount });
}
function finishTurn(g) {
  const s = g.state;
  if (s.result) return;
  const t = s.teams[s.activeSide];
  t.cursor = (t.cursor + 1) % t.units.length;
  s.completedTurns++; unlock(g); s.activeSide = 1 - s.activeSide;
  s.wind.changesAfterTurns = 2 - s.completedTurns % 2;
  if (s.completedTurns % 2 === 0) {
    // Select one of the other fourteen levels so every pair has a visible change.
    const level = (s.wind.level + 7 + 1 + Math.floor(g.rng() * 14)) % 15 - 7;
    s.wind = { acceleration: level * 10, level, changesAfterTurns: 2 };
    event(g, 'wind', { ...s.wind });
  }
  if (s.suddenDeath) {
    s.suddenTurns++; s.waterRise++;
    s.waterY = WORLD.groundY + 28 - s.waterRise * (WORLD.groundY + 56) / 6;
    s.nextWaterY = WORLD.groundY + 28 - (s.waterRise + 1) * (WORLD.groundY + 56) / 6;
    event(g, 'water', { y: s.waterY, value: s.waterRise });
    for (const p of [...s.projectiles]) if (p.y + p.r >= s.waterY) plop(g, p);
    drown(g);
    if (victory(g, 'water')) return;
    if (s.suddenTurns >= 6) { endGame(g, null, 'The flood swallowed both castles'); return; }
    s.phase = 'water'; g.waterEndsAt = s.now + g.config.waterMs;
  } else if (s.now >= s.regulationEndsAt - g.config.transitionMs) s.phase = 'transition';
  else startTurn(g);
}
function startSuddenDeath(g) {
  const s = g.state;
  s.suddenDeath = true; s.nextWaterY = WORLD.groundY + 28 - (WORLD.groundY + 56) / 6;
  event(g, 'water', { y: s.waterY, value: 0, announcement: true });
  startTurn(g);
}

export function getMuzzle(state, unit, angle) {
  const c = center(unit);
  // Only clear the inhabitant's body; nearby castle material remains collidable.
  const radius = Math.min(25, Math.max(unit.w, unit.h) / 2 + 5);
  return { x: c.x + Math.cos(angle) * radius, y: c.y - 3 + Math.sin(angle) * radius };
}
export function launchVelocity(weapon, power, angle) {
  const speed = weapon.speedMin + (weapon.speedMax - weapon.speedMin) * clamp(power, 0, 1);
  return { vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed };
}

/** Identical horizontal wind and vertical gravity for simulation and aiming. */
export function projectileAcceleration(state, projectileOrWeapon) {
  return { ax: state.wind?.acceleration || 0, ay: WORLD.gravity * (projectileOrWeapon.gravityScale || 1) };
}

/** Swept point vs expanded AABB. Earliest fraction and outward contact normal. */
function segmentBox(x, y, nx, ny, b, r = 0) {
  const dx = nx - x, dy = ny - y;
  let lo = 0, hi = 1, normalX = 0, normalY = 0;
  for (const [p, d, min, max, axis] of [[x, dx, b.x - r, b.x + b.w + r, 'x'], [y, dy, b.y - r, b.y + b.h + r, 'y']]) {
    if (Math.abs(d) < 1e-9) { if (p < min || p > max) return null; continue; }
    let near = (min - p) / d, far = (max - p) / d, n = -Math.sign(d);
    if (near > far) [near, far] = [far, near];
    if (near > lo) { lo = near; normalX = axis === 'x' ? n : 0; normalY = axis === 'y' ? n : 0; }
    hi = Math.min(hi, far);
    if (lo > hi) return null;
  }
  return lo >= 0 && lo <= 1 ? { t: lo, nx: normalX, ny: normalY } : null;
}
function firstCollision(s, p, nx, ny, ignored = new Set()) {
  let best = null;
  const consider = (hit, type, target) => { if (hit && (!best || hit.t < best.t - 1e-8 || (Math.abs(hit.t - best.t) < 1e-8 && type === 'water'))) best = { ...hit, type, target }; };
  if (p.y + p.r >= s.waterY) consider({ t: 0, nx: 0, ny: -1 }, 'water');
  else if (ny + p.r >= s.waterY && ny > p.y) consider({ t: (s.waterY - p.r - p.y) / (ny - p.y), nx: 0, ny: -1 }, 'water');
  consider(segmentBox(p.x, p.y, nx, ny, { x: -1000, y: WORLD.groundY, w: WORLD.width + 2000, h: 2000 }, p.r), 'ground');
  for (const tile of s.tiles) if (tile.hp > 0 && !ignored.has(tile.id)) consider(segmentBox(p.x, p.y, nx, ny, tile, p.r), 'tile', tile);
  for (const unit of livingUnits(s)) if (!ignored.has(unit.id) && !(unit.id === p.unitId && (p.age || 0) < 0.12)) consider(segmentBox(p.x, p.y, nx, ny, unit, p.r), 'unit', unit);
  for (const team of s.teams) if (team.core.hp > 0 && !ignored.has(team.core.id)) consider(segmentBox(p.x, p.y, nx, ny, team.core, p.r), 'core', team.core);
  return best;
}
function steer(s, p, dt) {
  if (!p.homing || p.age < 0.4) return;
  const target = livingUnits(s).find(u => u.id === p.targetId);
  if (!target) return;
  const c = center(target), desired = Math.atan2(c.y - p.y, c.x - p.x), heading = Math.atan2(p.vy, p.vx);
  let difference = ((desired - heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  difference = clamp(difference, -Math.PI / 3 * dt, Math.PI / 3 * dt);
  const speed = Math.hypot(p.vx, p.vy);
  p.vx = Math.cos(heading + difference) * speed; p.vy = Math.sin(heading + difference) * speed;
}
export function predictShot(state, unitId, weaponId, angle, power, maxSteps = Math.ceil(RULES.predictionHorizonMs / STEP)) {
  const unit = livingUnits(state).find(u => u.id === unitId), w = WEAPONS[weaponId];
  if (!unit || !w || w.kind !== 'fire') return { x: 0, y: 0, points: [] };
  const p = { ...getMuzzle(state, unit, angle), ...launchVelocity(w, power, angle), r: w.r, unitId, age: 0, homing: w.homing, targetId: state.teams[1 - unit.side].units.find(u => u.alive)?.id };
  const points = [{ x: p.x, y: p.y }];
  const { ax, ay } = projectileAcceleration(state, w);
  for (let i = 0; i < maxSteps; i++) {
    const dt = 1 / 30; steer(state, p, dt);
    const nx = p.x + p.vx * dt + 0.5 * ax * dt * dt, ny = p.y + p.vy * dt + 0.5 * ay * dt * dt;
    const hit = firstCollision(state, p, nx, ny);
    if (hit) { const x = p.x + (nx - p.x) * hit.t, y = p.y + (ny - p.y) * hit.t; points.push({ x, y }); return { x, y, hitId: hit.target?.id, hitType: hit.type, points }; }
    p.x = nx; p.y = ny; p.vx += ax * dt; p.vy += ay * dt; p.age += dt;
    points.push({ x: p.x, y: p.y });
    if (p.x < -80 || p.x > WORLD.width + 80) break;
  }
  return { x: p.x, y: p.y, points };
}
export function previewTrajectory(state, unitId, weaponId, angle, power) {
  return predictShot(state, unitId, weaponId, angle, power, 18).points;
}

export function snapBuild(state, side, x, y) {
  const anchor = side ? WORLD.width : 0;
  return { x: anchor + Math.round((x - anchor) / 28) * 28, y: WORLD.groundY + Math.round((y - WORLD.groundY) / 28) * 28 };
}
export function getBuildBounds(state, side) {
  // The original footprint remains usable after its walls collapse. Two rows
  // above the original roof allow floating cover without unlimited sky towers.
  const castle = state.formation.bounds[side];
  const y = Math.max(0, castle.y - 2 * WORLD.tileSize);
  return { x: castle.x, y, w: castle.w, h: castle.y + castle.h - y };
}
function touches(a, b) {
  return ((Math.abs(a.y + a.h - b.y) < 0.1 || Math.abs(b.y + b.h - a.y) < 0.1) && horizontal(a, b)) ||
    ((Math.abs(a.x + a.w - b.x) < 0.1 || Math.abs(b.x + b.w - a.x) < 0.1) && a.y < b.y + b.h - EPS && a.y + a.h > b.y + EPS);
}
export function validateBuild(state, side, weaponId, x, y) {
  const w = WEAPONS[weaponId];
  const reject = reason => ({ ok: false, reason });
  if (!w || w.kind !== 'build' || ![0, 1].includes(side)) return reject('INVALID_WEAPON');
  if (!Number.isFinite(x) || !Number.isFinite(y)) return reject('INVALID_POSITION');
  const snap = snapBuild(state, side, x, y);
  if (Math.abs(snap.x - x) > 0.1 || Math.abs(snap.y - y) > 0.1) return reject('OFF_GRID');
  const box = { x, y, w: w.footprint.w * 28, h: w.footprint.h * 28 };
  const bounds = getBuildBounds(state, side);
  if (x < bounds.x || x + box.w > bounds.x + bounds.w || y < bounds.y || y + box.h > bounds.y + bounds.h + EPS) return reject('OUTSIDE_BUILD_REGION');
  if (y + box.h >= state.waterY) return reject('UNDERWATER');
  const solids = aliveTiles(state), entities = [...livingUnits(state), ...state.teams.map(t => t.core).filter(c => c.hp > 0)];
  if ([...solids, ...entities].some(t => overlap(box, t))) return reject('OCCUPIED');
  const tiles = [];
  for (let row = 0; row < w.footprint.h; row++) for (let col = 0; col < w.footprint.w; col++) tiles.push({ x: x + col * 28, y: y + row * 28, w: 28, h: 28 });
  return { ok: true, tiles };
}

export function applyAction(g, side, action, now) {
  tickGame(g, now);
  const s = g.state, fail = reason => ({ ok: false, reason });
  if (!action || typeof action !== 'object') return fail('INVALID_ACTION');
  if (s.phase !== 'aim' || s.result) return fail('NOT_AIMING');
  if (side !== s.activeSide) return fail('NOT_YOUR_TURN');
  if (now >= s.turnDeadline) return fail('TURN_EXPIRED');
  const team = s.teams[side], unit = team.units.find(u => u.id === action.unitId && u.alive);
  if (!unit || unit.id !== s.activeUnitId) return fail('WRONG_SHOOTER');
  const w = WEAPONS[action.weaponId];
  if (!w || w.kind !== action.kind) return fail('INVALID_WEAPON');
  if (!(action.weaponId in team.ammo)) return fail('WEAPON_LOCKED');
  if (team.ammo[action.weaponId] === 0) return fail('NO_AMMO');
  let placement;
  if (w.kind === 'fire') {
    if (!Number.isFinite(action.angle) || Math.abs(action.angle) > Math.PI * 2 || !Number.isFinite(action.power) || action.power < 0 || action.power > 1) return fail('INVALID_AIM');
    if (action.targetId !== undefined && (!w.homing || !s.teams[1 - side].units.some(u => u.alive && u.id === action.targetId))) return fail('INVALID_TARGET');
  } else {
    placement = validateBuild(s, side, w.id, action.x, action.y);
    if (!placement.ok) return fail(placement.reason);
  }
  if (team.ammo[w.id] > 0) team.ammo[w.id]--;
  s.phase = 'resolve'; g.actionStartedAt = s.now; g.aftermathStartedAt = null; g.damageBudget.clear(); g.settleAt = s.now;
  if (w.kind === 'build') {
    for (const tile of placement.tiles) s.tiles.push({ ...tile, id: `${s.matchId}:b${++g.objectId}`, side, material: w.material, hp: w.hp, maxHp: w.hp, falling: false, constructed: true, ...(w.floating ? { floating: true } : {}) });
    event(g, 'build', { side, weaponId: w.id, x: action.x, y: action.y, w: w.footprint.w * 28, h: w.footprint.h * 28 });
    g.dirtyStructure = true; g.settleAt = s.now + 350;
  } else {
    const p = { id: `${s.matchId}:p${++g.objectId}`, side, weaponId: w.id, unitId: unit.id, ...getMuzzle(s, unit, action.angle), ...launchVelocity(w, action.power, action.angle), r: w.r, age: 0, penetration: w.penetration || 0, bounces: w.bounces || 0, homing: w.homing || false, targetId: action.targetId || s.teams[1 - side].units.find(u => u.alive)?.id, gravityScale: w.gravityScale || 1, child: false };
    s.projectiles.push(p); event(g, 'launch', { x: p.x, y: p.y, side, weaponId: w.id, unitId: unit.id });
  }
  return { ok: true };
}

function damage(g, target, amount, cause, source = {}) {
  const n = Math.max(0, Math.round(amount));
  if (!n || target.hp <= 0 || target.alive === false) return;
  const lost = Math.min(target.hp, n); target.hp = Math.max(0, target.hp - n);
  event(g, 'damage', { ...center(target), targetId: target.id, side: target.side, value: lost, cause, ...source });
  if (target.hp === 0) {
    if ('alive' in target) {
      target.alive = false;
      const lastShooter = !g.state.teams[target.side].units.some(unit => unit.alive);
      event(g, 'death', { ...center(target), unitId: target.id, side: target.side, cause, ...source, lastShooter });
    }
    else if (target.material) g.dirtyStructure = true;
    else if (g.state.teams.some(team => team.core === target)) event(g, 'core-destroyed', { ...center(target), side: target.side, coreId: target.id });
  }
}
function nearestPoint(b, x, y) { return { x: clamp(x, b.x, b.x + b.w), y: clamp(y, b.y, b.y + b.h) }; }
function blastExposure(snapshot, origin, target, point, structural) {
  const dx = point.x - origin.x, dy = point.y - origin.y, len = Math.hypot(dx, dy);
  if (len < EPS) return 1;
  const ox = origin.x + dx / len * 0.03, oy = origin.y + dy / len * 0.03;
  let transmission = 1;
  for (const tile of snapshot) {
    if (tile.id === target.id || !(segmentBox(ox, oy, point.x, point.y, tile)?.t < 0.999)) continue;
    // The pressure wave cracks nearby masonry through a weakened wall. The
    // original wall still shields inhabitants and cores for this whole blast.
    if (!structural) return 0;
    transmission *= MATERIALS[tile.material]?.blastTransmission ?? 0;
  }
  return transmission;
}
function explode(g, x, y, weaponId, side, override = {}) {
  const s = g.state, w = WEAPONS[weaponId], radius = override.radius || w.radius, power = override.damage ?? w.damage;
  const terrainRadius = radius * RULES.terrainBlastRadiusScale;
  // Surface splash cannot leak beneath water, including targets partly exposed above it.
  if (y >= s.waterY) { event(g, 'plop', { x, y: s.waterY, side, weaponId }); return; }
  const solids = aliveTiles(s).map(t => ({ ...t })), targets = [...aliveTiles(s), ...livingUnits(s), ...s.teams.map(t => t.core).filter(c => c.hp > 0)];
  const blast = event(g, 'explosion', { x, y, radius, terrainRadius, side, weaponId, child: !!override.child, pulse: override.pulse || 0 });
  for (const target of targets) {
    if (target.y >= s.waterY) continue;
    const exposedBox = { ...target, h: Math.min(target.h, s.waterY - target.y - EPS) };
    if (exposedBox.h <= 0) continue;
    const point = nearestPoint(exposedBox, x, y), distance = Math.hypot(point.x - x, point.y - y);
    const structural = Boolean(target.material), reach = structural ? terrainRadius : radius;
    if (distance >= reach) continue;
    const exposure = blastExposure(solids, { x, y }, target, point, structural);
    damage(g, target, power * (1 - distance / reach) * exposure, 'blast', { weaponId, explosionId: blast.id });
  }
  g.settleAt = Math.max(g.settleAt, s.now + 260);
}
function removeProjectile(g, p) { const i = g.state.projectiles.indexOf(p); if (i !== -1) g.state.projectiles.splice(i, 1); }
function plop(g, p) { event(g, 'plop', { x: p.x, y: Math.min(p.y, g.state.waterY), side: p.side, weaponId: p.weaponId }); removeProjectile(g, p); }
function children(g, p, count, satellite = false) {
  const w = WEAPONS[p.weaponId], forward = Math.atan2(p.vy, p.vx);
  const fan = satellite ? [-Math.PI * 0.88, -Math.PI * 0.63, -Math.PI * 0.37, -Math.PI * 0.12] : [-0.65, -0.325, 0, 0.325, 0.65].map(a => forward + a);
  for (let i = 0; i < count; i++) {
    const angle = fan[i], speed = satellite ? 300 : Math.max(300, Math.hypot(p.vx, p.vy) * 0.68);
    g.state.projectiles.push({ ...p, id: `${g.state.matchId}:p${++g.objectId}`, x: p.x + Math.cos(angle) * 12, y: p.y + Math.sin(angle) * 12, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, r: 4, child: true, homing: false, bounces: 0, penetration: 0, damage: satellite ? w.childDamage : w.damage, radius: satellite ? w.childRadius : w.radius });
  }
}
function reboundAnvil(g, p, origin) {
  const w = WEAPONS[p.weaponId];
  const durationMs = w.reboundMs;
  Object.assign(p, { ...origin, vx: 0, vy: 0, bounces: 0, penetration: 0,
    rebound: { ...origin, startedAt: g.state.now, durationMs, height: w.reboundHeight } });
  g.state.projectiles.push(p);
  event(g, 'bounce', { ...origin, side: p.side, weaponId: p.weaponId, rebound: true });
}
function updateAnvilRebound(g, p) {
  const w = WEAPONS[p.weaponId], hop = p.rebound;
  const progress = hop.durationMs ? clamp((g.state.now - hop.startedAt) / hop.durationMs, 0, 1) : 1;
  // Return to the original contact even if its supporting tile was pulverized.
  // This short scripted hop is deliberately vertical and unaffected by wind.
  p.x = hop.x; p.y = hop.y - 4 * hop.height * progress * (1 - progress);
  p.vx = 0; p.vy = hop.durationMs ? -4 * hop.height * (1 - 2 * progress) / (hop.durationMs / 1000) : 0;
  if (p.y + p.r >= g.state.waterY) { plop(g, p); return; }
  if (progress < 1) return;
  removeProjectile(g, p);
  explode(g, hop.x, hop.y, p.weaponId, p.side, { damage: w.reboundDamage, radius: w.radius * w.reboundRadiusScale, child: true });
}
function impact(g, p, hit) {
  const w = WEAPONS[p.weaponId];
  if (hit.type === 'water') { plop(g, p); return; }
  if (p.bounces > 0 && (hit.type === 'tile' || hit.type === 'ground')) {
    p.bounces--;
    const nx = hit.nx || 0, ny = hit.ny || (nx ? 0 : -1), dot = p.vx * nx + p.vy * ny;
    p.vx = (p.vx - 2 * dot * nx) * 0.7; p.vy = (p.vy - 2 * dot * ny) * 0.7;
    p.x += nx * 0.6; p.y += ny * 0.6;
    event(g, 'bounce', { x: p.x, y: p.y, weaponId: p.weaponId }); return;
  }
  removeProjectile(g, p);
  const origin = { x: p.x + (hit.nx || 0) * 0.1, y: p.y + (hit.ny || 0) * 0.1 };
  if (w.pulses && !p.child) {
    for (let i = 0; i < w.pulses; i++) g.pulses.push({ at: g.state.now + w.pulseDelay * i, ...origin, weaponId: p.weaponId, side: p.side, damage: w.damage, radius: w.pulseRadii?.[i] || w.radius, pulse: i + 1 });
  } else explode(g, origin.x, origin.y, p.weaponId, p.side, p.child ? { damage: p.damage, radius: p.radius, child: true } : {});
  if (w.reboundMs && !p.child && !p.rebound) reboundAnvil(g, p, origin);
  if (w.satellites && !p.child) children(g, p, w.satellites, true);
}

function updateProjectiles(g, dt) {
  const s = g.state;
  for (const p of [...s.projectiles]) {
    if (!s.projectiles.includes(p)) continue;
    if (p.rebound) { updateAnvilRebound(g, p); continue; }
    if (p.y + p.r >= s.waterY) { plop(g, p); continue; }
    const w = WEAPONS[p.weaponId];
    steer(s, p, dt);
    const { ax, ay } = projectileAcceleration(s, p);
    let nx = p.x + p.vx * dt + ax * dt * dt / 2, ny = p.y + p.vy * dt + ay * dt * dt / 2;
    p.vx += ax * dt; p.vy += ay * dt; p.age += dt;
    // Drill contacts are individually swept; a fast shot cannot skip multiple walls.
    for (let contacts = 0; contacts < 12; contacts++) {
      const hit = firstCollision(s, p, nx, ny);
      if (!hit) { p.x = nx; p.y = ny; break; }
      p.x += (nx - p.x) * hit.t; p.y += (ny - p.y) * hit.t;
      if (hit.type === 'tile' && p.penetration >= MATERIALS[hit.target.material].resistance) {
        p.penetration -= MATERIALS[hit.target.material].resistance;
        damage(g, hit.target, hit.target.hp, 'penetration', { weaponId: p.weaponId });
        continue;
      }
      impact(g, p, hit); break;
    }
    if (!s.projectiles.includes(p)) continue;
    if (w.split && !p.child && (p.vy >= 0 || p.age >= 1.2)) { removeProjectile(g, p); children(g, p, w.children); event(g, 'split', { x: p.x, y: p.y, weaponId: p.weaponId }); continue; }
    if (p.x < -80 || p.x > WORLD.width + 80) removeProjectile(g, p);
  }
}

function recalculateSupport(g) {
  g.dirtyStructure = false;
  const solids = aliveTiles(g.state).filter(t => !t.falling), seen = new Set();
  for (const tile of solids) {
    if (seen.has(tile.id)) continue;
    const component = [], queue = [tile]; seen.add(tile.id); let anchored = false;
    for (let i = 0; i < queue.length; i++) {
      const a = queue[i]; component.push(a); if (a.floating || a.y + a.h >= WORLD.groundY - 0.1) anchored = true;
      // A grounded core is also a physical resting contact for fallen masonry.
      for (const { core } of g.state.teams) if (core.hp > 0 && horizontal(a, core) && Math.abs(a.y + a.h - core.y) < 0.1) {
        if (core.y + core.h >= WORLD.groundY - 0.1 || solids.some(t => t.id !== a.id && horizontal(core, t) && Math.abs(core.y + core.h - t.y) < 0.1)) anchored = true;
      }
      for (const b of solids) if (!seen.has(b.id) && touches(a, b)) { seen.add(b.id); queue.push(b); }
    }
    if (anchored) continue;
    for (const t of component) t.falling = true;
    const chunk = { id: ++g.objectId, tiles: component, vy: 0, fallen: 0, hits: new Set() };
    g.chunks.push(chunk);
    event(g, 'collapse', { ...center(component[0]), side: component[0].side, value: component.length });
  }
  // Preserve every physical tile when fragmentation exceeds the collision-group cap.
  while (g.chunks.length > 32) {
    g.chunks.sort((a, b) => a.tiles.length - b.tiles.length);
    const a = g.chunks.shift(), b = g.chunks[0]; b.tiles.push(...a.tiles); b.vy = Math.min(a.vy, b.vy); b.fallen = Math.min(a.fallen, b.fallen);
    for (const id of a.hits) b.hits.add(id);
  }
  g.state.tiles = g.state.tiles.filter(t => t.hp > 0);
}
function band(size) { return size >= 6 ? 120 : size >= 3 ? 50 : 10; }
function chunkImpact(g, chunk, target) {
  if (chunk.fallen < 28 - EPS || chunk.hits.has(target.id)) return;
  chunk.hits.add(target.id); damage(g, target, band(chunk.tiles.length), 'rubble');
}
function updateChunks(g, dt, force = false) {
  const s = g.state;
  g.chunks.sort((a, b) => Math.max(...b.tiles.map(t => t.y + t.h)) - Math.max(...a.tiles.map(t => t.y + t.h)));
  for (const chunk of [...g.chunks]) {
    chunk.tiles = chunk.tiles.filter(t => t.hp > 0);
    if (!chunk.tiles.length) { g.chunks.splice(g.chunks.indexOf(chunk), 1); continue; }
    chunk.vy += WORLD.gravity * dt;
    let dy = force ? WORLD.height * 2 : Math.max(0, chunk.vy * dt), collision = null;
    const staticTiles = aliveTiles(s).filter(t => !t.falling);
    const obstacles = [...staticTiles, ...s.teams.map(t => t.core).filter(c => c.hp > 0)];
    for (const tile of chunk.tiles) {
      const groundGap = WORLD.groundY - tile.y - tile.h;
      if (groundGap <= dy) { dy = Math.max(0, groundGap); collision = 'ground'; }
      for (const target of obstacles) if (horizontal(tile, target) && tile.y + tile.h <= target.y + EPS) {
        const gap = target.y - tile.y - tile.h;
        if (gap <= dy) { dy = Math.max(0, gap); collision = target; }
      }
    }
    chunk.fallen += dy;
    for (const tile of chunk.tiles) {
      const swept = { ...tile, h: tile.h + dy };
      for (const unit of livingUnits(s)) if (overlap(swept, unit)) {
        chunkImpact(g, chunk, unit);
        if (unit.alive && tile.y + tile.h + dy > unit.y + EPS) {
          const pushed = { ...unit, y: tile.y + tile.h + dy + EPS };
          if (pushed.y + pushed.h > WORLD.groundY + EPS || staticTiles.some(t => overlap(pushed, t))) damage(g, unit, unit.hp, 'crushed');
          else { unit.y = pushed.y; g.bodyMotion.delete(unit.id); }
        }
      }
      tile.y += dy;
    }
    if (collision) {
      if (typeof collision === 'object') chunkImpact(g, chunk, collision);
      if (typeof collision === 'object' && collision.hp <= 0) { g.dirtyStructure = true; continue; }
      for (const tile of chunk.tiles) { tile.falling = false; tile.rubble = true; }
      g.chunks.splice(g.chunks.indexOf(chunk), 1);
      // Settled physical rubble stays intact; no hidden cosmetic substitution.
      g.dirtyStructure = true;
    }
  }
}
function updateBodies(g, dt, force = false) {
  const s = g.state, tiles = aliveTiles(s);
  for (const body of [...s.teams.map(t => t.core).filter(c => c.hp > 0), ...livingUnits(s)]) {
    let motion = g.bodyMotion.get(body.id);
    const below = tiles.filter(t => horizontal(body, t) && t.y >= body.y + body.h - EPS);
    let floorY = WORLD.groundY;
    for (const tile of below) floorY = Math.min(floorY, tile.y);
    const gap = floorY - body.y - body.h;
    if (gap > EPS && !motion) { motion = { vy: 0, startY: body.y }; g.bodyMotion.set(body.id, motion); }
    if (motion) {
      motion.vy += WORLD.gravity * dt;
      const dy = force ? Math.max(0, gap) : Math.min(Math.max(0, gap), motion.vy * dt);
      body.y += dy;
      if (body.y + body.h >= floorY - EPS) {
        const isUnit = 'alive' in body, limit = isUnit ? 20 : 60, perTile = isUnit ? 5 : 10;
        const amount = Math.min(limit, Math.max(0, (body.y - motion.startY) / 28 - 1) * perTile);
        const used = g.damageBudget.get(body.id) || 0;
        damage(g, body, Math.min(amount, limit - used), isUnit ? 'fall' : 'core-fall');
        g.damageBudget.set(body.id, Math.min(limit, used + Math.round(amount)));
        g.bodyMotion.delete(body.id);
      }
    }
    if ('alive' in body && body.alive) {
      const buried = tiles.some(t => t.rubble && !t.falling && overlap(t, body));
      if (buried) damage(g, body, body.hp, 'crushed');
      if (body.x + body.w < 0 || body.x > WORLD.width || body.y > WORLD.height) damage(g, body, body.hp, 'out-of-bounds');
    }
  }
}
function drown(g) {
  let any = false;
  for (const unit of livingUnits(g.state)) if (unit.y + 7 >= g.state.waterY) { damage(g, unit, unit.hp, 'drowned'); any = true; }
  return any;
}
function settleAll(g) {
  // Downward swept settling shares the regular contacts and impact de-duplication.
  for (let i = 0; i < 12 && (g.chunks.length || g.bodyMotion.size || g.dirtyStructure); i++) {
    if (g.dirtyStructure) recalculateSupport(g);
    updateChunks(g, 1 / 30, true); updateBodies(g, 1 / 30, true);
  }
  if (g.chunks.length) endGame(g, null, 'Host could not resolve castle collapse', true);
}
function physics(g, dt) {
  updateProjectiles(g, dt);
  const due = g.pulses.filter(p => p.at <= g.state.now);
  g.pulses = g.pulses.filter(p => p.at > g.state.now);
  for (const pulse of due) explode(g, pulse.x, pulse.y, pulse.weaponId, pulse.side, pulse);
  if (g.dirtyStructure) recalculateSupport(g);
  updateChunks(g, dt); updateBodies(g, dt);
  const waterDeaths = drown(g);
  victory(g, waterDeaths ? 'water' : '');
}

/** Monotonic authoritative stepper. Real deadlines never slow down with physics. */
export function tickGame(g, now) {
  if (!Number.isFinite(now) || now < g.lastTick) return;
  const s = g.state, old = g.lastTick; g.lastTick = now;
  if (s.result) { s.now = now; return; }
  // A suspended host cannot faithfully reconstruct missed turns or physics.
  // Interrupt every active phase so an idle/aiming host cannot grant fresh time
  // after a suspension beyond the original match's deadlines.
  if (now - old > 10000 && s.phase !== 'countdown') { s.now = now; endGame(g, null, 'Host simulation interrupted', true); return; }
  const advancePhases = () => {
    if (s.result) return;
    if (s.phase === 'countdown' && s.now >= s.countdownEndsAt) {
      if (s.now >= s.regulationEndsAt - g.config.transitionMs) s.phase = 'transition'; else startTurn(g);
    }
    if (s.phase === 'aim' && s.now >= s.turnDeadline) finishTurn(g);
    if (s.phase === 'resolve') {
      // Airborne rockets, satellites, Anvil hops and scheduled pulses all own
      // the current turn until they resolve. Only debris settling is bounded.
      if (s.projectiles.length || g.pulses.length) g.aftermathStartedAt = null;
      else {
        if (g.aftermathStartedAt === null) g.aftermathStartedAt = s.now;
        const aftermathExpired = s.now - g.aftermathStartedAt >= Math.min(g.config.resolutionMs, 2000);
        if (aftermathExpired) { settleAll(g); victory(g); }
        const settled = !g.chunks.length && !g.bodyMotion.size && !g.dirtyStructure && s.now >= g.settleAt;
        if (!s.result && (settled || aftermathExpired)) finishTurn(g);
      }
    }
    if (!s.result && s.phase === 'water' && s.now >= g.waterEndsAt) startTurn(g);
    if (!s.result && !s.suddenDeath && s.now >= s.regulationEndsAt) {
      if (s.phase === 'aim') finishTurn(g);
      // An in-flight shot may outlast regulation. finishTurn enters transition
      // only after every part of that action and its aftermath has completed.
      if (!s.result && s.phase === 'transition') startSuddenDeath(g);
    }
  };
  // Catch up at most 300 fixed ticks, while idle jumps still preserve their deadlines.
  let steps = 0;
  while (g.simAt + STEP <= now && steps++ < 300 && !s.result) {
    g.simAt += STEP; s.now = g.simAt;
    advancePhases();
    if (s.phase === 'resolve') physics(g, STEP / 1000);
  }
  s.now = now;
  if (g.simAt < now - STEP) g.simAt = now;
  advancePhases();
  s.elapsed = Math.max(0, (now - g.startAt) / 1000);
}
