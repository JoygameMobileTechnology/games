import * as THREE from 'three';
import { CONFIG, PALETTE, xpForLevelUp, upgradeCost, highestTier } from '../config.js';
import { SceneManager } from '../render/scene.js';
import { World } from '../render/world.js';
import { TeamRenderer, P } from '../render/units.js';
import { Particles, DamageNumbers, HpBars, DangerZones, AimLine, ArrowRenderer, Lightning, SpearRenderer, CaltropRenderer, Shockwaves, GroundCracks, COLORS } from '../render/fx.js';
import { GameAudio } from '../audio.js';
import { Input } from '../input.js';
import { loadSave, writeSave } from '../save.js';
import { Grid, clamp, damp, easeOutQuad, easeInOut, moveToward } from '../util/math.js';
import { RNG, seedForLevel } from '../util/rng.js';
import { computeStats } from './stats.js';
import { makeOffer } from './offers.js';
import { EnemySystem } from './enemies.js';
import { ArrowSystem } from './arrows.js';
import { AllySystem } from './allies.js';
import { ObstacleSystem } from './obstacles.js';
import { BonusSystem } from './bonus.js';
import { generateLevel, formationOffsets } from './levelgen.js';
import { typesForLevel } from '../data/enemies.js';
import { CARDS } from '../data/cards.js';
import { UI } from '../ui/ui.js';

const SIM_DT = 1 / 60;
const C_PLAYER = new THREE.Color(PALETTE.player), C_GOLD = new THREE.Color(PALETTE.gold), C_STEEL = new THREE.Color(PALETTE.steel);
const BOW_COLORS = [0x5a3a1e, 0x9aa3ad, 0xc9d1d9, 0xd9a93f, 0xa58bff].map((h) => new THREE.Color(h));
const CAPE_COLORS = [0x8a2b2b, 0x2b5f8a, 0x2b8a4a, 0x8a6a2b, 0x6a2b8a, 0x1b1f26].map((h) => new THREE.Color(h));

export class Game {
  constructor({ canvas, appEl, uiEl }) {
    this.save = loadSave();
    this.sceneM = new SceneManager(canvas, appEl);
    this.scene = this.sceneM.scene; this.camera = this.sceneM.camera;
    this.audio = new GameAudio(); this.audio.enabled = this.save.sound !== false;
    this.input = new Input(appEl);
    this.world = new World(this.scene);
    const s = this.scene;
    this.fx = {
      particles: new Particles(s, CONFIG.perf.maxParticles), numbers: new DamageNumbers(s, CONFIG.perf.maxDamageGlyphs), hpBars: new HpBars(s, CONFIG.perf.maxHpBars),
      danger: new DangerZones(s, 40), aim: new AimLine(s), arrows: new ArrowRenderer(s, CONFIG.arrow.maxActive + 20), lightning: new Lightning(s), spears: new SpearRenderer(s, 10), caltrops: new CaltropRenderer(s, 120), shock: new Shockwaves(s, 14), cracks: new GroundCracks(s, 40),
    };
    this.rend = {
      enemies: new TeamRenderer(s, { capacity: CONFIG.perf.maxEnemies, debrisExtra: CONFIG.perf.maxDebris * 2 }),
      allies: new TeamRenderer(s, { capacity: CONFIG.ally.max, parts: ['head', 'torso', 'armL', 'armR', 'legL', 'legR', 'calfL', 'calfR', 'hood', 'bow', 'shadow'], castShadow: true }),
      brute: new TeamRenderer(s, { capacity: 2, castShadow: true }),
      boss: new TeamRenderer(s, { capacity: 1, castShadow: true }),
      player: new TeamRenderer(s, { capacity: 1, castShadow: true }),
      obstacles: new TeamRenderer(s, { capacity: 4, parts: ['head', 'torso', 'armL', 'armR', 'legL', 'legR', 'calfL', 'calfR', 'sword', 'helmet', 'shadow'], castShadow: true }),
    };
    this.grid = new Grid(3);
    this.enemies = new EnemySystem(this); this.arrows = new ArrowSystem(this); this.allies = new AllySystem(this);
    this.obstacles = new ObstacleSystem(this, s, this.rend.obstacles); this.bonus = new BonusSystem(this);
    this.ui = new UI(this, uiEl);

    this.state = 'main'; this.level = this.save.level || 1; this.time = 0; this.realTime = 0;
    this.timeScale = 1; this.tsRamp = null; this.accum = 0; this.paused = false;
    this.picks = {}; this.stats = computeStats(this.picks, this.save.upg);
    this.player = this._newPlayer();
    this.playerFacing = 1;
    this.shakeAmt = 0; this.camPos = new THREE.Vector3(); this.camLook = new THREE.Vector3(); this.camAngle = 0;
    this.pendingOffers = 0; this.levelUps = 0; this.xp = 0; this.kills = 0; this.levelCoins = 0; this.cardsOpening = false;
    this.god = false; this.debugHooks = null;
    this.lastFrame = performance.now(); this._tick = 0;

    this.input.onDown = () => { this.audio.init(); };
    this.input.onUp = (inp, fresh) => this._onRelease(fresh);
    document.addEventListener('visibilitychange', () => { this.paused = document.hidden && !CONFIG.debug.runHidden; this.lastFrame = performance.now(); if (!document.hidden) this.audio.init(); else if (CONFIG.debug.runHidden) this._schedule(); });
    this.ui.show('main'); this.ui.updateMain();
    this._buildIdleWorld();
    this._schedule();
  }
  _schedule() {
    const id = ++this._tick; // stale callbacks (e.g. a rAF that never fired while hidden) are ignored
    const run = (t) => { if (id !== this._tick) return; this._frame(t); };
    if (document.hidden && CONFIG.debug.runHidden) setTimeout(() => run(performance.now()), 16);
    else requestAnimationFrame(run);
  }

  _newPlayer() {
    return { x: 0, z: 0, hp: 100, maxHp: 100, speed: 5, invuln: 0, dead: false, phase: 0, yaw: 0, aim: 0, aimPulse: 0, holding: false, holdT: 0, nock: 0, range: 0, atMax: false,
      targetX: 0, vx: 0, pushVx: 0, shieldT: 0, caltropT: 0, guardian: 0, beatT: 0, fallT: 0, flash: 0, squash: 0, dy: 0, pitch: 0, dist: 0, everHeld: false, everShot: false, lockTarget: null };
  }

  // ---------- world / screens ----------
  _buildIdleWorld() {
    const layout = { levelLength: 200, segments: 19, segmentLength: CONFIG.bonus.segmentLength, level: this.level, bestMult: this.save.bestMult || 1, prevMult: this.save.prevMult || 0 };
    this.world.build(layout);
    this.player = this._newPlayer(); this.player.z = 0; this.playerFacing = 1;
    this.enemies.reset(); this.allies.reset(); this.arrows.reset(); this.obstacles.reset(); this.fx.particles.clear(); this.fx.numbers.clear(); this.fx.lightning.clear(); this.fx.cracks.clear();
    this.sceneM.setSunset(0);
    this.camAngle = 0;
  }

  goMain() {
    this.state = 'main'; this.setTimeScale(1, 0); this.timeScale = 1;
    this.level = this.save.level || 1;
    this.ui.show('main'); this.ui.updateMain(); this.ui.bossBar(null); this.ui.showBonusHud(false);
    this._buildIdleWorld();
  }

  startLevel(L = this.level) {
    this.level = L; this.save.level = L;
    this.levelData = generateLevel(L);
    this.eventIdx = 0; this.time = 0; this.xp = 0; this.levelUps = 0; this.pendingOffers = 0; this.kills = 0; this.cardsOpening = false;
    this.idleT = 0; this.idleMax = 0; this.engageFirst = -1; this.fillers = 0; // pacing stats (debug)
    this.picks = {}; this.stats = computeStats(this.picks, this.save.upg);
    this.levelRng = new RNG(seedForLevel(L, 7));
    const len = this.levelData.duration * this.stats.runSpeed;
    const layout = { levelLength: len, segments: L === 1 ? CONFIG.bonus.ftueSegments : CONFIG.bonus.segments, segmentLength: CONFIG.bonus.segmentLength, level: L, bestMult: this.save.bestMult || 1, prevMult: this.save.prevMult || 0 };
    this.world.build(layout);
    this.enemies.reset(); this.allies.reset(); this.arrows.reset(); this.obstacles.reset(); this.fx.particles.clear(); this.fx.numbers.clear(); this.fx.lightning.clear(); this.fx.cracks.clear();
    this.player = this._newPlayer(); this.player.maxHp = this.stats.maxHp; this.player.hp = this.stats.maxHp; this.player.speed = this.stats.runSpeed;
    this.playerFacing = 1; this.camAngle = 0; this.gateT = 0;
    this.levelCoins = 10 + 2 * L;
    this.sceneM.setSunset(0);
    this.state = 'level'; this.setTimeScale(1, 0); this.timeScale = 1;
    this.input.unlock(); this.input.consumeDx(); // a finger still held from the previous screen does not count as a draw
    this.ui.show('hud'); this.ui.showBonusHud(false); this.ui.bossBar(null); this.ui.resetHud();
    if (L === 1) this.ui.hint('Hold to aim');
    else if (this.save.lastStopper && !this.save.lastStopper.victory) this.ui.toast(`Last run: stopped by ${this.save.lastStopper.name}`, 2.5);
    if (!this.save.stats.startedAt) this.save.stats.startedAt = Date.now();
    this.levelStartReal = performance.now();
    writeSave(this.save);
  }

  // ---------- time ----------
  setTimeScale(to, dur) { if (dur <= 0) { this.timeScale = to; this.tsRamp = null; } else this.tsRamp = { from: this.timeScale, to, dur, t: 0 }; }
  _frame(now) {
    this._schedule();
    let dt = (now - this.lastFrame) / 1000; this.lastFrame = now;
    const hiddenRun = document.hidden && CONFIG.debug.runHidden; // throttled timers: catch up with many steps
    if (dt > (hiddenRun ? 1.2 : 0.1)) dt = hiddenRun ? 1.2 : 0.1;
    if (this.paused) return;
    this.realTime += dt;
    if (!hiddenRun) this.sceneM.trackFps(dt);
    if (this.tsRamp) { const r = this.tsRamp; r.t += dt; const u = Math.min(1, r.t / r.dur); this.timeScale = r.from + (r.to - r.from) * u; if (u >= 1) this.tsRamp = null; }
    const scale = this.timeScale * (CONFIG.debug.timeScale || 1);
    this.accum += dt * scale;
    let steps = 0; const maxSteps = hiddenRun ? 80 : 5;
    while (this.accum >= SIM_DT && steps < maxSteps) { this._step(SIM_DT); this.accum -= SIM_DT; steps++; }
    if (steps === maxSteps) this.accum = 0;
    this._render(dt);
  }

  // ---------- simulation step ----------
  _step(dt) {
    const st = this.state;
    if (st === 'main') { this.player.phase += dt * 3; this.fx.particles.update(dt); return; }
    this.time += dt;
    const pl = this.player;
    if (pl.invuln > 0) pl.invuln -= dt;
    if (pl.flash > 0) pl.flash = Math.max(0, pl.flash - dt / 0.08);
    pl.squash = damp(pl.squash, 0, 12, dt);
    pl.aimPulse = Math.max(0, pl.aimPulse - dt * 3);
    if (pl.nock > 0) pl.nock -= dt;

    // spatial grid
    this.grid.clear();
    for (const e of this.enemies.list) if (e.alive && !e.airborne) this.grid.insert(e, e.x, e.z); // airborne units can't be hit or targeted

    if (st === 'level') this._stepLevel(dt);
    else if (st === 'gate') this._stepGate(dt);
    else if (st === 'bonus') this._stepBonus(dt);
    else if (st === 'dying') { pl.fallT += dt; if (pl.fallT > 1.3) this._showFail(); }

    if (pl.fallT > 0) { pl.fallT += dt; pl.pitch = Math.min(Math.PI / 2, pl.fallT * 3); }
    this.enemies.update(dt); this.arrows.update(dt); this.allies.update(dt);
    if (st === 'level' || st === 'gate' || st === 'dying') this.obstacles.update(dt, this.camPos.z);
    this.fx.particles.update(dt); this.fx.numbers.update(dt); this.fx.lightning.update(dt); this.fx.shock.update(dt); this.fx.cracks.update(dt);
    if (this.shakeAmt > 0) this.shakeAmt = Math.max(0, this.shakeAmt - dt * 1.6);
  }

  _stepLevel(dt) {
    const pl = this.player, st = this.stats, inp = this.input;
    // events
    const ev = this.levelData.events;
    while (this.eventIdx < ev.length && ev[this.eventIdx].t <= this.time) this._runEvent(ev[this.eventIdx++]);
    // pacing: never run empty for long. If nothing is within reach for maxIdle seconds, a small filler pack rushes in.
    let near = false; for (const e of this.enemies.list) if (e.alive && !e.guard && !e.airborne && e.z - pl.z < st.maxRange) { near = true; break; }
    if (near) { if (this.engageFirst < 0) this.engageFirst = this.time; this.idleT = 0; }
    else { this.idleT += dt; if (this.idleT > this.idleMax) this.idleMax = this.idleT; if (this.idleT > CONFIG.level.maxIdle && this.time < this.levelData.duration - 3) { this.idleT = 0; this._spawnFiller(); } }
    // hold / aim / drag
    if (inp.down && !inp.locked && !pl.holding && inp.freshPress && !pl.dead) {
      pl.holding = true; pl.holdT = 0; pl.everHeld = true; this.audio.startDraw(); inp.consumeDx();
      if (this.level === 1 && !pl.everShot) this.ui.hint('Release to shoot');
    }
    if (pl.holding) {
      const dx = inp.consumeDx();
      pl.targetX = clamp(pl.targetX + this.dragSign * (dx / inp.width()) * CONFIG.player.xRange * 2, -CONFIG.player.xRange, CONFIG.player.xRange);
      if (pl.nock <= 0) pl.holdT += dt;
      const u = clamp(pl.holdT / st.drawTime, 0, 1);
      pl.range = CONFIG.player.minRange + (st.maxRange - CONFIG.player.minRange) * easeOutQuad(u);
      pl.atMax = u >= 1;
      this.audio.updateDraw(u);
      pl.lockTarget = this.enemies.nearest(pl.x, pl.z + pl.range, CONFIG.player.aimAssistRadius);
      if (!inp.down) this._onRelease(true);
    } else { pl.targetX = pl.x; inp.consumeDx(); }
    // movement
    pl.x = moveToward(pl.x, pl.targetX, CONFIG.player.lateralMax * dt);
    if (pl.pushVx) { pl.x = clamp(pl.x + pl.pushVx * dt, -CONFIG.player.xRange, CONFIG.player.xRange); pl.pushVx = damp(pl.pushVx, 0, 6, dt); if (Math.abs(pl.pushVx) < 0.05) pl.pushVx = 0; }
    pl.speed = st.runSpeed;
    if (!pl.dead) pl.z -= pl.speed * dt;
    pl.dist = -pl.z;
    pl.phase += dt * pl.speed * 1.9;
    pl.aim = damp(pl.aim, pl.holding ? 1 : 0.25, 10, dt);
    // shield / caltrops
    if (st.shield && pl.shieldT > 0) pl.shieldT -= dt;
    if (st.caltrops) { pl.caltropT -= dt; if (pl.caltropT <= 0) { pl.caltropT = st.caltrops.interval; this.enemies.dropCaltrops(pl.x, pl.z + 3); } }
    // low hp heartbeat
    if (pl.hp / pl.maxHp < CONFIG.player.lowHpVignette) { pl.beatT -= dt; if (pl.beatT <= 0) { pl.beatT = 1; this.audio.heartbeat(); } }
    // FTUE L1: first card on the 3rd kill
    if (this.level === 1 && this.levelUps === 0 && this.pendingOffers === 0 && this.kills >= 3 && !this.cardsOpening) { this.pendingOffers = 1; }
    if (this.pendingOffers > 0 && !this.cardsOpening) this._openCards();
    // gate
    if (pl.z <= this.world.gateZ + 0.2 && !pl.dead) this._enterGate();
  }

  _spawnFiller() {
    const pl = this.player, L = this.level, rng = this.levelRng;
    const n = CONFIG.level.fillerSize + Math.floor(L / 5);
    const types = typesForLevel(L).filter((t) => t === 'footman' || t === 'runner');
    const tier = L <= 2 ? 0 : Math.max(0, highestTier(L) - 2);
    for (let i = 0; i < n; i++) this.enemies.spawn(rng.pick(types), tier, clamp(pl.x + rng.range(-2.5, 2.5), -3.2, 3.2), pl.z + CONFIG.enemy.spawnDistance - CONFIG.level.fillerNear + i * 1.0, { delay: i * 0.12 });
    this.fillers++;
  }

  _runEvent(ev) {
    const pl = this.player, rng = this.levelRng;
    const zBase = pl.z + CONFIG.enemy.spawnDistance - (ev.close ? 1.5 : 0);
    if (ev.kind === 'wave') {
      const offs = formationOffsets(ev.formation, ev.units.length, rng);
      ev.units.forEach((u, i) => {
        const back = (u.type === 'spear_thrower' || u.type === 'drummer') ? 3 : 0;
        this.enemies.spawn(u.type, u.tier, clamp(ev.x + offs[i].dx, -3.2, 3.2), zBase + offs[i].dz * CONFIG.level.formationDepth + back + rng.range(0, 1), { delay: i * 0.07 + rng.range(0, 0.25) }); // meteor-shower stagger
      });
      if (this.level >= 2 && this.time > 4) this.ui.toast(ev.units.length >= 8 ? 'Big wave!' : '', 0);
    } else if (ev.kind === 'single') this.enemies.spawn(ev.type, ev.tier, ev.x, zBase + rng.range(0, 3));
    else if (ev.kind === 'brute') { this.enemies.spawn('brute', 5, ev.x, zBase + 2); this.ui.toast('BRUTE!', 1.6); this.audio.roar(); }
    else if (ev.kind === 'obstacle') {
      const warn = ev.type === 'rolling_log' ? CONFIG.obstacle.warnTimeLog : CONFIG.obstacle.warnTime;
      const ahead = ev.type === 'rolling_log' ? CONFIG.obstacle.enterAhead + warn * (pl.speed + 4) : CONFIG.obstacle.enterAhead + warn * pl.speed;
      const o = this.obstacles.spawn(ev, pl.z - ahead); o.warnT = warn;
      if (this.level <= 8 && !this.seenObs) this.seenObs = new Set();
      if (this.level <= 8 && !this.seenObs.has(ev.type)) { this.seenObs.add(ev.type); this.ui.toast(o.def.name, 1.4); }
    } else if (ev.kind === 'hint') this.ui.toast(ev.text, 2.2);
  }

  _onRelease(fresh) {
    const pl = this.player;
    if (!pl.holding) return;
    pl.holding = false; this.audio.stopDraw();
    if (!fresh && this.state !== 'level') return;
    if (this.state !== 'level' || pl.dead) return;
    const tz = pl.z + pl.range;
    this.arrows.firePlayerVolley(pl.x, 1.3, pl.z, pl.x, tz, pl.atMax, pl.lockTarget);
    pl.nock = CONFIG.player.nockTime; pl.aimPulse = 1; pl.everShot = true;
    if (this.level === 1) this.ui.hint(null);
  }

  // ---------- cards ----------
  _openCards() {
    this.cardsOpening = true;
    const pl = this.player;
    if (pl.holding) this._onRelease(true);
    this.setTimeScale(0, CONFIG.levelup.slowIn);
    this.input.lock();
    this.audio.levelUp();
    setTimeout(() => { if (this.state === 'level') { this.state = 'cards'; this._showOffer(); } }, CONFIG.levelup.slowIn * 1000);
  }
  _showOffer() {
    const offer = makeOffer({ level: this.level, levelUps: this.levelUps, picks: this.picks, stats: this.stats, hpFrac: this.player.hp / this.player.maxHp });
    this.ui.showCards(offer, (id, rarity) => this._pickCard(id, rarity));
    this.levelUps++;
  }
  _pickCard(id, rarity) {
    this.applyCard(id, rarity);
    this.pendingOffers = Math.max(0, this.pendingOffers - 1);
    if (this.pendingOffers > 0) { this._showOffer(); return; }
    this.ui.hideCards();
    this.state = 'level'; this.cardsOpening = false;
    this.input.unlock();
    this.setTimeScale(1, CONFIG.levelup.slowOut);
  }
  applyCard(id, rarity) {
    const pl = this.player;
    if (!this.picks[id]) this.picks[id] = [];
    this.picks[id].push(rarity);
    const prevMax = pl.maxHp;
    this.stats = computeStats(this.picks, this.save.upg);
    pl.maxHp = this.stats.maxHp; pl.hp += pl.maxHp - prevMax;
    if (id === 'helmet') pl.hp = Math.min(pl.maxHp, pl.hp + 25);
    if (id === 'healing_potion') pl.hp = Math.min(pl.maxHp, pl.hp + pl.maxHp * 0.3);
    if (id === 'recruit') this.allies.setCount(this.stats.allies);
    if (id === 'guardian') pl.guardian = this.stats.guardian;
    if (!this.save.seen.includes(id)) this.save.seen.push(id);
    this.fx.particles.burst(pl.x, 1.2, pl.z, 24, PALETTE.gold, 4.5, 0.12, 0.6, 3, 0.2);
    this.audio.cardPick();
    if (this.stats.fullPlate && !this.fullPlateShown) { this.fullPlateShown = true; this.ui.toast('FULL PLATE!', 1.5); }
  }

  // ---------- damage / death ----------
  damagePlayer(amount, cause, o = {}) {
    const pl = this.player;
    if (pl.dead || this.god || CONFIG.debug.god || this.state === 'gate' || this.state === 'bonus') return;
    if (o.shieldable && this.stats.shield && pl.shieldT <= 0) { pl.shieldT = this.stats.shield.recharge; this.audio.shieldBlock(); this.fx.particles.burst(pl.x, 1.2, pl.z, 16, PALETTE.frost, 3, 0.1, 0.5); this.ui.toast('Blocked!', 0.8); return; }
    if (o.guardianable && pl.guardian > 0) { pl.guardian--; this.audio.shieldBlock(); this.fx.particles.burst(pl.x, 1, pl.z, 12, PALETTE.ally, 3, 0.1, 0.5); this.ui.toast('Guardian fell', 0.9); return; }
    if (!o.noInvuln && pl.invuln > 0) return;
    pl.hp -= amount;
    if (o.silent) { pl.latchHurtT = (pl.latchHurtT || 0) - (o.dt || 0); if (pl.latchHurtT <= 0) { pl.latchHurtT = CONFIG.player.latchHurtFlash; this.ui.flash(); pl.flash = 0.7; pl.squash = 0.12; this.audio.hurt(); } }
    if (!o.silent) { this.ui.flash(); this.shake(0.25); pl.squash = 0.2; pl.flash = 1; this.audio.hurt(); this.audio.impact(); this.fx.numbers.spawn(pl.x, 2.2, pl.z, String(Math.round(amount)), COLORS.hurt, 1.1); }
    if (!o.noInvuln) pl.invuln = CONFIG.player.invulnTime;
    if (pl.hp <= 0) { pl.hp = 0; this._die(cause); }
  }
  _die(cause) {
    const pl = this.player; pl.dead = true; pl.fallT = 0.001; this.deathCause = cause;
    this.state = 'dying'; this.setTimeScale(0.35, 0.2); this.audio.death(); this.audio.stopDraw(); pl.holding = false;
    this.fx.aim.hide();
  }
  _showFail() {
    this.state = 'fail'; this.setTimeScale(1, 0);
    const kept = Math.floor(this.levelCoins * CONFIG.meta.failKeepFrac);
    this.save.coins += kept;
    const suggest = (this.deathCause === 'enemy') ? ((this.save.upg.speed || 0) <= (this.save.upg.atk || 0) ? 'speed' : 'atk') : 'hp';
    this.save.suggest = suggest;
    this.save.stats.playTime = (this.save.stats.playTime || 0) + (performance.now() - this.levelStartReal) / 1000;
    writeSave(this.save);
    const pct = clamp(this.player.dist / -this.world.gateZ, 0, 1);
    this.ui.showFail({ pct, kept, suggest, cause: this.deathCause });
  }

  // ---------- gate & bonus ----------
  _enterGate() {
    this.state = 'gate'; this.gateT = 0; this.player.holding = false; this.audio.stopDraw(); this.fx.aim.hide();
    this.ui.hint(null);
    // chasers crash into the gate
    for (const e of this.enemies.list) if (e.alive && !e.guard) { e.speed = 0; if (e.state === 'latched') { e.state = 'run'; e.latch = null; } }
    this.audio.gateDrop();
  }
  _stepGate(dt) {
    const pl = this.player; this.gateT += dt;
    pl.z -= pl.speed * dt; pl.phase += dt * pl.speed * 1.9; pl.targetX = damp(pl.targetX, 0, 3, dt); pl.x = moveToward(pl.x, pl.targetX, CONFIG.player.lateralMax * dt);
    this.world.setGateDrop(clamp(this.gateT / 0.45, 0, 1));
    if (this.gateT > 0.45 && !this.gateSlammed) { this.gateSlammed = true; this.shake(0.4); this.fx.particles.burst(0, 0.5, this.world.gateZ, 30, 0xd9d2c4, 4, 0.16, 0.7); for (const e of this.enemies.list) if (e.alive && !e.guard) this.enemies.kill(e, { src: 'gate', silent: true }); }
    const u = clamp((this.gateT - 0.3) / CONFIG.camera.turnTime, 0, 1);
    this.camAngle = easeInOut(u) * Math.PI;
    if (u > 0.5) { this.playerFacing = -1; pl.yaw = Math.PI; }
    if (this.gateT >= 0.3 + CONFIG.camera.turnTime + 0.1) { this.gateSlammed = false; this.state = 'bonus'; this.bonus.start(); this.ui.toast('MULTIPLIER BRIDGE', 1.4); }
  }
  _stepBonus(dt) {
    const pl = this.player, inp = this.input;
    if (inp.down && !inp.locked) { const dx = inp.consumeDx(); pl.targetX = clamp(pl.targetX + this.dragSign * (dx / inp.width()) * CONFIG.player.xRange * 2, -CONFIG.player.xRange, CONFIG.player.xRange); }
    else { inp.consumeDx(); pl.targetX = pl.x; }
    if (this.bonus.phase !== 'stopped' && this.bonus.phase !== 'victory') pl.x = moveToward(pl.x, pl.targetX, CONFIG.player.lateralMax * dt);
    pl.speed = this.bonus.phase === 'run' ? CONFIG.player.bonusRunSpeed : 0;
    pl.phase += dt * pl.speed * 1.9;
    pl.aim = damp(pl.aim, 0.6 + pl.aimPulse * 0.4, 12, dt);
    this.bonus.update(dt);
  }
  endBonus(mult, stopper) {
    this.state = 'results'; this.setTimeScale(1, 0);
    const reward = Math.round(this.levelCoins * mult);
    this.save.coins += reward;
    this.save.prevMult = mult;
    if (mult > (this.save.bestMult || 1)) this.save.bestMult = mult;
    this.save.lastStopper = stopper;
    this.save.level = this.level + 1; this.save.suggest = null;
    this.save.stats.levels = (this.save.stats.levels || 0) + 1;
    this.save.stats.playTime = (this.save.stats.playTime || 0) + (performance.now() - this.levelStartReal) / 1000;
    if (stopper && stopper.victory) { this.save.stats.bossKilled = true; writeSave(this.save); this.ui.showEnd({ reward, mult, picks: this.picks, time: this.save.stats.playTime, levels: this.save.stats.levels }); return; }
    writeSave(this.save);
    this.ui.showResults({ mult, coins: this.levelCoins, reward, stopper });
  }

  // ---------- callbacks ----------
  onEnemyKilled(e, o) {
    if (e.guard || e.isBoss) { this.kills++; this.levelCoins++; return; }
    this.kills++; this.levelCoins++;
    const pl = this.player;
    if (this.stats.lifesteal) pl.hp = Math.min(pl.maxHp, pl.hp + this.stats.lifesteal);
    if (this.state === 'level' || this.state === 'cards') this.ui.spawnOrb(e.x, 1.2 * e.scale, e.z, e.xpValue * this.stats.xpMult);
  }
  onAllyDied() { }
  addXp(v) {
    if (this.state !== 'level' && this.state !== 'cards') return;
    this.xp += v;
    while (this.xp >= xpForLevelUp(this.levelUps + this.pendingOffers + 1)) { this.xp -= xpForLevelUp(this.levelUps + this.pendingOffers + 1); this.pendingOffers++; }
  }
  shake(a) { this.shakeAmt = Math.max(this.shakeAmt, a); }
  // screen-right in world X: the level camera faces +Z (world +X is screen-left), the bonus camera faces -Z
  get dragSign() { return this.playerFacing > 0 ? -1 : 1; }

  // ---------- meta ----------
  buyUpgrade(id) {
    const lvl = this.save.upg[id] || 0;
    const cap = id === 'speed' ? CONFIG.meta.speedCap : id === 'atk' ? CONFIG.meta.atkCap : Infinity;
    if (lvl >= cap) return false;
    const cost = upgradeCost(lvl);
    if (this.save.coins < cost) return false;
    this.save.coins -= cost; this.save.upg[id] = lvl + 1; this.save.suggest = null;
    writeSave(this.save); this.audio.coin(); this.stats = computeStats(this.picks, this.save.upg);
    this.ui.updateMain();
    return true;
  }
  toggleSound() { this.audio.init(); this.audio.setEnabled(!this.audio.enabled); this.save.sound = this.audio.enabled; writeSave(this.save); this.ui.updateMain(); }

  // ---------- render ----------
  _render(dt) {
    const pl = this.player, sm = this.sceneM, cam = this.camera;
    this.world.update(dt, this.realTime, this.camPos.z);
    // camera
    const C = CONFIG.camera;
    const followX = pl.x * C.followX;
    const th = this.camAngle;
    // arena: pull back and up so the 8 m boss fits
    const arena = this.state === 'bonus' && (this.bonus.phase === 'arena' || this.bonus.phase === 'victory') ? 1 : 0;
    this.camArena = damp(this.camArena || 0, arena, 2.5, dt);
    const back = C.back + (C.bonusBack - C.back) * (th / Math.PI) + C.arenaBackExtra * this.camArena;
    const h = C.height + (C.bonusHeight - C.height) * (th / Math.PI) + C.arenaHeightExtra * this.camArena;
    const la = C.lookAhead + (C.bonusLookAhead - C.lookAhead) * (th / Math.PI) + C.arenaLookExtra * this.camArena;
    const cx = followX - Math.sin(th) * 0, cz = pl.z - Math.cos(th) * back;
    const lx = followX, lz = pl.z + Math.cos(th) * la;
    const k = this.state === 'main' ? 1 : 1 - Math.exp(-10 * dt);
    this.camPos.x += (cx - this.camPos.x) * k; this.camPos.y += (h - this.camPos.y) * k; this.camPos.z += (cz - this.camPos.z) * k;
    this.camLook.x += (lx - this.camLook.x) * k; this.camLook.y = 0.6; this.camLook.z += (lz - this.camLook.z) * k;
    const sh = this.shakeAmt * this.shakeAmt;
    cam.position.set(this.camPos.x + (Math.random() - .5) * sh * 0.8, this.camPos.y + (Math.random() - .5) * sh * 0.5, this.camPos.z);
    cam.lookAt(this.camLook);
    sm.updateSun(pl.x, pl.z);
    const F = CONFIG.fog, bk = th / Math.PI; this.scene.fog.near = F.levelNear + (F.bonusNear - F.levelNear) * bk; this.scene.fog.far = F.levelFar + (F.bonusFar - F.levelFar) * bk;
    this.fx.aim.setResolution(sm.width, sm.height);

    // player
    const r = this.rend.player; r.begin();
    const v = this._pv; v.x = pl.x; v.y = pl.dy; v.z = pl.z; v.yaw = this.playerFacing > 0 ? 0 : Math.PI; v.pitch = pl.dead || pl.fallT > 0 ? -pl.pitch : 0; v.roll = 0; v.scale = 1;
    v.color = this.stats.fullPlate ? _cFull.copy(C_PLAYER).lerp(C_GOLD, 0.5 + 0.3 * Math.sin(this.realTime * 6)) : C_PLAYER; v.metal = this.stats.fullPlate ? C_GOLD : C_STEEL;
    v.phase = pl.phase; v.run = this.state === 'main' ? 0.25 : (pl.speed > 0 ? 1 : 0); v.armRaise = 0; v.aim = pl.aim; v.flash = pl.flash; v.squash = pl.squash; v.frozen = false; v.shadowScale = 1;
    let f = P.BOW; // same body as the enemies: bare head, no hood or crown
    const A = this.stats.armor; if (A.helmet) f |= P.HELMET; if (A.chestplate) f |= P.CHEST; if (A.gauntlets) f |= P.GAUNTLETS; if (A.leggings) f |= P.LEGGINGS; if (A.boots) f |= P.BOOTS;
    const spd = this.save.upg.speed || 0; if (spd >= 5) { f |= P.CAPE; v.capeColor = CAPE_COLORS[Math.min(5, Math.floor(spd / 5))]; } else v.capeColor = null;
    v.bowColor = BOW_COLORS[Math.min(4, Math.floor((this.save.upg.atk || 0) / 5))];
    v.flags = f; if (pl.invuln > 0 && Math.floor(this.realTime * 20) % 2 === 0 && !pl.dead) v.flash = 0.5;
    r.draw(v); r.end();

    // aim line
    if (pl.holding && this.state === 'level') {
      // guides drawn on the road, from just in front of the feet to each arrow's landing point (same fan as the volley); red when that arrow will lock on
      const n = this.stats.arrows, sp = CONFIG.player.multishotSpacing, ends = [];
      for (let i = 0; i < n; i++) { const x = pl.x + (i - (n - 1) / 2) * sp, z = pl.z + pl.range; ends.push({ x, z, locked: !!this.enemies.nearest(x, z, CONFIG.player.aimAssistRadius) }); }
      ends.unshift(ends.splice(Math.floor((n - 1) / 2), 1)[0]); // center arrow first
      const rad = this.stats.explosive ? this.stats.explosive.radius : 0.55;
      this.fx.aim.show(_s.set(pl.x, 0.06, pl.z + 1.0), ends, rad, pl.atMax, this.realTime);
    } else this.fx.aim.hide();

    // systems
    this.fx.danger.begin();
    this.enemies.render(this.rend.enemies, this.rend.brute, this.rend.boss, this.fx, cam);
    this.allies.render(this.rend.allies);
    this.arrows.render(this.fx.arrows);
    this.obstacles.render(this.fx.danger);
    this.bonus.render(this.fx.danger);
    this.fx.danger.end();
    this.fx.particles.render(); this.fx.numbers.render(cam); this.fx.lightning.render(); this.fx.cracks.render();
    this.ui.update(dt);
    sm.render();
  }
  _pv = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, scale: 1, color: null, metal: null, phase: 0, run: 1, armRaise: 0, aim: 0, flags: 0, flash: 0, squash: 0, frozen: false, shadowScale: 1, capeColor: null, bowColor: null };
}
const _s = new THREE.Vector3(), _e = new THREE.Vector3(), _cFull = new THREE.Color();
