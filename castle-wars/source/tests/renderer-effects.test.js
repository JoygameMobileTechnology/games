import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createGame, snapshotGame } from '../shared/game.js';
import { COSMIC_EFFECT_MS, CORE_DESTRUCTION_MS, createResultPresentation } from '../shared/presentation.js';

// Browser modules use the HTTP server's absolute imports. Rewrite only their
// module specifiers so these tests run the production drawing code in Node.
const asModule = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
const effectsSource = (await fs.readFile(new URL('../public/cosmic-effects.js', import.meta.url), 'utf8'))
  .replace("'/shared/presentation.js'", JSON.stringify(new URL('../shared/presentation.js', import.meta.url).href));
const effectsURL = asModule(effectsSource);
const { ImpactEffects } = await import(effectsURL);
const rendererSource = (await fs.readFile(new URL('../public/renderer.js', import.meta.url), 'utf8'))
  .replace("'/shared/content.js'", JSON.stringify(new URL('../shared/content.js', import.meta.url).href))
  .replace("'/shared/game.js'", JSON.stringify(new URL('../shared/game.js', import.meta.url).href))
  .replace("'./cosmic-effects.js'", JSON.stringify(effectsURL));
const { ArenaRenderer } = await import(asModule(rendererSource));

function drawingContext() {
  let calls = 0;
  const gradient = { addColorStop(offset) { assert.ok(Number.isFinite(offset) && offset >= 0 && offset <= 1); } };
  const ctx = new Proxy({}, {
    get(target, key) {
      if (key in target) return target[key];
      if (String(key).startsWith('create')) return (...args) => { args.forEach(n => assert.ok(Number.isFinite(n))); return gradient; };
      return (...args) => {
        calls++;
        for (const value of args) if (typeof value === 'number') assert.ok(Number.isFinite(value), `${key} received a non-finite coordinate`);
        if (key === 'arc' || key === 'ellipse') assert.ok(args[2] >= 0, `${key} received a negative radius`);
        if (key === 'ellipse') assert.ok(args[3] >= 0, 'ellipse received a negative vertical radius');
      };
    },
    set(target, key, value) { target[key] = value; return true; },
  });
  return { ctx, get calls() { return calls; } };
}

function effect(kind, suffix = '', at = 1000) {
  return { id: `${kind}:${suffix}`, type: kind === 'core' ? 'core-destroyed' : 'explosion', weaponId: kind === 'core' ? undefined : kind, x: 1580, y: 570, radius: 140, terrainRadius: 252, side: 1, coreId: kind === 'core' ? 's1:core' : undefined, at };
}

function rendererRig(t) {
  const clock = { now: 5000 }, draw = drawingContext(), audioEvents = [];
  t.mock.method(performance, 'now', () => clock.now);
  const globals = { devicePixelRatio: 2, ResizeObserver: class { observe() {} }, requestAnimationFrame() {}, document: { querySelector: () => null } };
  for (const [key, value] of Object.entries(globals)) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
    t.after(() => { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; });
  }
  const canvas = { getContext: () => draw.ctx, getBoundingClientRect: () => ({ width: 844, height: 390, left: 0, top: 0 }) };
  const renderer = new ArenaRenderer(canvas, { event(event) { audioEvents.push(event); } });
  const state = snapshotGame(createGame({ id: 'renderer-finale', seed: 712, now: 1000 }));
  return { renderer, state, clock, audioEvents, draw };
}

for (const kind of ['moon', 'saturn', 'star', 'core']) {
  test(`${kind} draws a complete finite animation in normal and reduced motion`, () => {
    const duration = kind === 'core' ? CORE_DESTRUCTION_MS : COSMIC_EFFECT_MS[kind];
    for (const reduced of [false, true]) {
      const fx = new ImpactEffects(), draw = drawingContext();
      assert.equal(fx.add(effect(kind), 0, 1000), true);
      // Include charge, fracture, afterglow and the exact expiry boundary.
      for (let age = 0; age < duration; age += 20) fx.draw(draw.ctx, 1000 + age, reduced);
      assert.ok(draw.calls > 100, 'the effect should visibly draw throughout its lifetime');
      assert.equal(fx.items.length, 1);
      fx.draw(draw.ctx, 1000 + duration, reduced);
      assert.equal(fx.items.length, 0);
    }
  });
}

test('effect limits preserve both core finales amid satellite showers', () => {
  const fx = new ImpactEffects();
  fx.add({ ...effect('core', 'left'), side: 0, x: 240 }, 0, 1000);
  fx.add(effect('core', 'right'), 0, 1000);
  for (let i = 0; i < 60; i++) fx.add({ ...effect('saturn', String(i)), child: true, x: 1100 + i }, 0, 1000);
  assert.ok(fx.items.length <= 10);
  assert.equal(fx.items.filter(item => item.kind === 'core').length, 2);
  const draw = drawingContext();
  fx.draw(draw.ctx, 2000);
  assert.ok(draw.calls > 0);
  fx.draw(draw.ctx, 4200);
  assert.equal(fx.items.length, 0);
});

test('Pocket Star merges its pulses without suppressing another impact or replaying duplicates', () => {
  const fx = new ImpactEffects();
  for (let i = 0; i < 5; i++) assert.equal(fx.add({ ...effect('star', String(i), 1000 + i * 150), pulse: i }, 0, 1000 + i * 150), true);
  assert.equal(fx.items.length, 1);
  assert.equal(fx.items[0].pulses.length, 5);
  assert.equal(fx.items[0].expires, 1600 + COSMIC_EFFECT_MS.star);
  assert.equal(fx.add({ ...effect('star', '4', 1600), pulse: 4 }, 0, 1700), false);
  assert.equal(fx.items[0].pulses.length, 5);
  fx.add({ ...effect('star', 'elsewhere'), x: 240 }, 0, 1700);
  assert.equal(fx.items.length, 2);
});

test('wall-clock expiry and recovered age do not depend on rendering every frame', () => {
  const fx = new ImpactEffects(), draw = drawingContext();
  assert.equal(fx.add(effect('core'), 2700, 10000), true);
  fx.draw(draw.ctx, 10499);
  assert.equal(fx.items.length, 1);
  fx.draw(draw.ctx, 10500);
  assert.equal(fx.items.length, 0);
  assert.equal(fx.add(effect('moon'), COSMIC_EFFECT_MS.moon, 12000), false, 'a fully elapsed effect must not replay');
  fx.add(effect('saturn'), 0, 12000);
  fx.draw(draw.ctx, 12001);
  fx.draw(draw.ctx, 30000); // Returning to a phone tab after a long suspension.
  assert.equal(fx.items.length, 0);
  fx.reset();
  assert.equal(fx.add(effect('core'), 0, 30000), true, 'a new event stream can reuse identifiers');
});

test('renderer deduplicates normal events and finale metadata across repeated snapshots', t => {
  const { renderer, state, clock, audioEvents } = rendererRig(t);
  renderer.setState(state, { screen: 'game' });
  const moon = effect('moon'), core = effect('core');
  const ended = { ...state, now: 1000, phase: 'ended', events: [moon, core, { id: 'result', type: 'result', at: 1000 }], result: { winner: 0, presentation: createResultPresentation([moon, core], 1000) } };
  renderer.setState(ended, { screen: 'game' });
  assert.equal(renderer.impacts.items.length, 2);
  assert.deepEqual(audioEvents.map(event => event.type), ['explosion', 'core-destroyed']);
  const originalStarts = renderer.impacts.items.map(item => item.started);
  clock.now += 100;
  renderer.setState({ ...ended, now: 1100 }, { screen: 'game' });
  renderer.setState({ ...ended, now: 1100 }, { screen: 'game' });
  assert.equal(renderer.impacts.items.length, 2);
  assert.deepEqual(renderer.impacts.items.map(item => item.started), originalStarts);
  assert.equal(audioEvents.length, 2, 'repeated result snapshots must not restart sounds');
  renderer.event({ type: 'result', winner: 0 });
  assert.equal(audioEvents.length, 2, 'result music is owned by the delayed UI reveal');
});

test('renderer reconnects midway through both core finales without replaying their charge sounds', t => {
  const { renderer, state, clock, audioEvents, draw } = rendererRig(t);
  const left = { ...effect('core', 'left'), side: 0, x: 240 }, right = effect('core', 'right');
  // The event list is empty to prove recovery uses durable result metadata.
  const ended = { ...state, now: 3000, phase: 'ended', events: [], result: { winner: null, presentation: createResultPresentation([left, right], 1000) } };
  renderer.setState(ended, { screen: 'game' });
  assert.equal(renderer.impacts.items.length, 2);
  assert.equal(audioEvents.length, 0);
  for (const item of renderer.impacts.items) {
    assert.equal(item.started, clock.now - 2000);
    assert.equal(item.expires - clock.now, 1200);
  }
  renderer.draw(clock.now, .016);
  assert.ok(draw.calls > 0);
  clock.now += 1200;
  renderer.draw(clock.now, .016);
  assert.equal(renderer.impacts.items.length, 0);
  renderer.setState({ ...ended, now: 4200 }, { screen: 'result' });
  assert.equal(renderer.impacts.items.length, 0);
  assert.equal(audioEvents.length, 0);
});

test('a new match clears pending core effects and their deduplication history', t => {
  const { renderer, state, audioEvents } = rendererRig(t);
  renderer.setState(state, { screen: 'game' });
  const core = effect('core');
  renderer.setState({ ...state, events: [core] }, { screen: 'game' });
  assert.equal(renderer.impacts.items.length, 1);
  renderer.setState({ ...state, matchId: 'rematch', events: [] }, { screen: 'game' });
  assert.equal(renderer.impacts.items.length, 0);
  assert.equal(renderer.impacts.seen.size, 0);
  assert.equal(audioEvents.length, 1);
});


test('destroyed cores stop drawing the intact golden sprite beneath or after their finale', t => {
  const { renderer, state, clock, draw } = rendererRig(t);
  for (const team of state.teams) {
    const beforeLiving = draw.calls;
    renderer.core(team.core, team.side, clock.now);
    assert.ok(draw.calls > beforeLiving, 'a surviving core remains visible');
    const beforeDestroyed = draw.calls;
    renderer.core({ ...team.core, hp: 0 }, team.side, clock.now);
    renderer.core({ ...team.core, hp: -1 }, team.side, clock.now + CORE_DESTRUCTION_MS);
    assert.equal(draw.calls, beforeDestroyed, 'only the destruction effect may render a dead core');
  }
});

test('the active shooter loses its aiming halo when combat ends', t => {
  const { renderer, state, clock } = rendererRig(t);
  const activeUnitId = state.teams[0].units[0].id;
  const calls = [];
  t.mock.method(renderer, 'shooter', (unit, side, active) => { calls.push({ id: unit.id, active }); });
  renderer.setState({ ...state, activeUnitId }, { screen: 'game' });
  renderer.draw(clock.now, .016);
  assert.equal(calls.filter(call => call.active).length, 1);
  calls.length = 0;
  renderer.setState({ ...state, activeUnitId, phase: 'ended', result: { winner: 0 } }, { screen: 'game' });
  renderer.draw(clock.now, .016);
  assert.ok(calls.length > 0, 'surviving shooters should remain on the battlefield');
  assert.ok(calls.every(call => !call.active), 'the finale must not suggest another shot can be taken');
});

function fatalPresentation(event = effect('basic'), at = 1000) {
  const deaths = [{ id: 'fatal-death', type: 'death', unitId: 's1:u2', side: 1, cause: 'blast', x: event.x + 20, y: event.y - 15, at }];
  return { startsAt: at, endsAt: at + 2000, explosions: [], cores: [], finish: { at, endsAt: at + 2000, event, deaths } };
}

test('fatal effects slow the killing impact itself and expire at exactly two seconds', t => {
  for (const kind of ['basic', 'anvil', 'moon', 'saturn', 'star']) {
    const fx = new ImpactEffects(), draw = drawingContext();
    const presentation = fatalPresentation(effect(kind));
    fx.addFinish(presentation.finish, 0, 5000);
    const method = ['moon', 'saturn', 'star'].includes(kind) ? kind : 'blast';
    const samples = [];
    t.mock.method(fx, method, (_ctx, item, ageOrNow, progress) => samples.push({
      age: kind === 'star' ? (ageOrNow - item.started) / 1000 : ageOrNow, progress,
    }));
    fx.draw(draw.ctx, 6000);
    assert.deepEqual(samples[0], { age: .35, progress: .5 }, `${kind} must advance only 350 ms halfway through its finale`);
    fx.draw(draw.ctx, 6999);
    assert.equal(fx.items.length, 1);
    fx.draw(draw.ctx, 7000);
    assert.equal(fx.items.length, 0);
  }
});

test('fatal basic and cosmic effects draw finite normal and reduced-motion frames for their full interval', () => {
  for (const kind of ['basic', 'anvil', 'moon', 'saturn', 'star']) for (const reduced of [false, true]) {
    const fx = new ImpactEffects(), draw = drawingContext();
    fx.addFinish(fatalPresentation(effect(kind)).finish, 0, 5000);
    for (let age = 0; age < 2000; age += 20) {
      const before = draw.calls;
      fx.draw(draw.ctx, 5000 + age, reduced);
      assert.ok(draw.calls > before, `${kind} should keep drawing at ${age} ms`);
    }
    assert.equal(fx.items.length, 1);
    fx.draw(draw.ctx, 7000, reduced);
    assert.equal(fx.items.length, 0);
  }
});

test('fatal metadata claims explosion and death events before the ordinary renderer sees them', t => {
  const { renderer, state, clock, audioEvents } = rendererRig(t);
  renderer.setState(state, { screen: 'game' });
  const blast = effect('basic'), presentation = fatalPresentation(blast);
  const ended = { ...state, now: 1000, phase: 'ended', events: [blast, ...presentation.finish.deaths], result: { winner: 0, presentation } };
  renderer.setState(ended, { screen: 'game' });
  assert.equal(renderer.impacts.items.length, 1);
  assert.equal(renderer.impacts.items[0].finish, true);
  assert.equal(renderer.blasts.length, 0, 'there must be no fast copy beneath the slow blast');
  assert.equal(renderer.particles.length, 0, 'normal death and explosion particles are owned by the slow effect');
  assert.equal(renderer.labels.length, 0);
  assert.deepEqual(audioEvents.map(event => event.type), ['explosion']);
  const started = renderer.impacts.items[0].started;
  clock.now += 100;
  renderer.setState({ ...ended, now: 1100 }, { screen: 'game' });
  renderer.setState({ ...ended, now: 1100 }, { screen: 'game' });
  assert.equal(renderer.impacts.items.length, 1);
  assert.equal(renderer.impacts.items[0].started, started);
  assert.equal(audioEvents.length, 1);
});

test('late fatal metadata replaces an already displayed ordinary blast without repeating its sound', t => {
  const { renderer, state, clock, audioEvents } = rendererRig(t);
  renderer.setState(state, { screen: 'game' });
  const blast = effect('basic');
  renderer.setState({ ...state, now: 1000, events: [blast] }, { screen: 'game' });
  assert.equal(renderer.blasts.length, 1);
  assert.ok(renderer.particles.length > 0);
  clock.now += 100;
  renderer.setState({ ...state, now: 1100, phase: 'ended', events: [blast], result: { winner: 0, presentation: fatalPresentation(blast) } }, { screen: 'game' });
  assert.equal(renderer.blasts.length, 0);
  assert.equal(renderer.particles.length, 0);
  assert.equal(renderer.labels.length, 0);
  assert.equal(renderer.impacts.items.length, 1);
  assert.equal(renderer.impacts.items[0].expires - clock.now, 1900);
  assert.equal(audioEvents.length, 1);
});

test('a fatal Pocket Star pulse replaces its merged corona and keeps only one slowed effect', () => {
  const fx = new ImpactEffects();
  const first = effect('star', 'first'), fatal = { ...effect('star', 'fatal', 1150), pulse: 2 };
  fx.add(first, 0, 5000); fx.add(fatal, 0, 5150);
  assert.equal(fx.items.length, 1);
  assert.equal(fx.items[0].pulses.length, 2);
  const finish = fatalPresentation(fatal, 1150).finish;
  assert.equal(fx.addFinish(finish, 100, 5250), true);
  assert.equal(fx.items.length, 1);
  assert.equal(fx.items[0].id, fatal.id);
  assert.equal(fx.items[0].finish, true);
  assert.equal(fx.items[0].pulses.length, 1);
  assert.equal(fx.addFinish(finish, 200, 5350), false);
  assert.equal(fx.add(fatal, 200, 5350), false);
});

test('reconnecting midway through a fatal impact resumes its slowed age without replaying sound', t => {
  const { renderer, state, clock, audioEvents, draw } = rendererRig(t);
  // The original impact predates the authoritative finish start. The finish
  // clock, not event.at, controls slow playback and the result deadline.
  const blast = effect('basic', 'resume', 900), presentation = fatalPresentation(blast, 1000);
  renderer.setState({ ...state, now: 2500, phase: 'ended', events: [], result: { winner: 0, presentation } }, { screen: 'game' });
  assert.equal(renderer.impacts.items.length, 1);
  assert.equal(renderer.impacts.items[0].started, clock.now - 1500);
  assert.equal(renderer.impacts.items[0].expires - clock.now, 500);
  assert.equal(audioEvents.length, 0);
  const samples = [];
  t.mock.method(renderer.impacts, 'blast', (_ctx, _item, age, progress) => samples.push({ age, progress }));
  renderer.impacts.draw(draw.ctx, clock.now);
  assert.deepEqual(samples[0], { age: .525, progress: .75 });
  clock.now += 500;
  renderer.impacts.draw(draw.ctx, clock.now);
  assert.equal(renderer.impacts.items.length, 0);
  renderer.setState({ ...state, now: 3000, phase: 'ended', events: [blast], result: { winner: 0, presentation } }, { screen: 'result' });
  assert.equal(renderer.impacts.items.length, 0);
  assert.equal(renderer.blasts.length, 0);
  assert.equal(audioEvents.length, 0);
});

test('mutual fatal explosions retain both impact locations without duplicating casualties', () => {
  const fx = new ImpactEffects(), first = effect('basic', 'left'), second = { ...effect('lob', 'right'), x: 250, side: 0 };
  const finish = fatalPresentation(first).finish;
  finish.events = [first, second];
  finish.deaths.push({ id: 'other-death', unitId: 's0:u2', side: 0, x: 250, y: 550, cause: 'blast', at: 1000 });
  fx.addFinish(finish, 0, 5000);
  assert.equal(fx.items.length, 2);
  assert.deepEqual(fx.items.map(item => item.x), [first.x, second.x]);
  assert.equal(fx.items.reduce((sum, item) => sum + item.deaths.length, 0), 2);
});

test('nonfatal ordinary blasts retain their normal effect speed', t => {
  const { renderer, state, audioEvents } = rendererRig(t);
  renderer.setState(state, { screen: 'game' });
  renderer.setState({ ...state, now: 1000, events: [effect('basic')] }, { screen: 'game' });
  assert.equal(renderer.impacts.items.length, 0);
  assert.equal(renderer.blasts.length, 1);
  const initialLife = renderer.blasts[0].life;
  renderer.effects(.3);
  assert.ok(Math.abs(renderer.blasts[0].life - (initialLife - .3)) < 1e-9);
  assert.equal(audioEvents.length, 1);
});

test('a drowning finale shows brief bubbles without explosion, slow motion, or duplicate death effects', t => {
  const { renderer, state, clock, audioEvents } = rendererRig(t);
  renderer.setState(state, { screen: 'game' });
  const death = { id: 'drowned-last', type: 'death', unitId: 's1:u2', side: 1, cause: 'drowned', x: 1580, y: 580, at: 1000 };
  const presentation = { startsAt: 1000, endsAt: 2000, cores: [], explosions: [], drowning: { at: 1000, endsAt: 2000, deaths: [death] } };
  const ended = { ...state, now: 1000, phase: 'ended', events: [death], result: { winner: 0, presentation } };
  renderer.setState(ended, { screen: 'game' });
  assert.equal(renderer.impacts.items.length, 1);
  assert.equal(renderer.impacts.items[0].kind, 'drowning');
  assert.ok(!renderer.impacts.items[0].finish);
  assert.equal(renderer.blasts.length, 0);
  assert.equal(renderer.particles.length, 0);
  assert.equal(audioEvents.length, 0, 'drowning finale audio is owned by the UI');
  renderer.draw(clock.now, .016);
  clock.now += 500;
  renderer.setState({ ...ended, now: 1500 }, { screen: 'game' });
  assert.equal(renderer.impacts.items.length, 1);
  renderer.reduced = true;
  renderer.draw(clock.now, .016);
  clock.now += 500;
  renderer.draw(clock.now, .016);
  assert.equal(renderer.impacts.items.length, 0);
});

test('anvil rebounds draw once above their fireball while ordinary shots keep their layer and interpolation', t => {
  const { renderer, state, clock } = rendererRig(t), order = [];
  const ordinary = { id: 'rocket', weaponId: 'basic', side: 0, x: 800, y: 400, vx: 200, vy: 100, r: 5 };
  const anvil = { id: 'hopping-anvil', weaponId: 'anvil', side: 0, x: 1600, y: 560, vx: 0, vy: -100, r: 9,
    rebound: { x: 1600, y: 600, startedAt: 1000, durationMs: 800, height: 60 } };
  renderer.setState({ ...state, projectiles: [ordinary, anvil] }, { screen: 'game' });
  clock.now += 100;
  renderer.setState({ ...state, projectiles: [{ ...ordinary, x: 820, y: 410 }, { ...anvil, y: 540 }] }, { screen: 'game' });
  t.mock.method(renderer, 'projectile', projectile => order.push({ kind: projectile.id, x: projectile.x, y: projectile.y }));
  t.mock.method(renderer, 'effects', () => order.push({ kind: 'fireball' }));
  t.mock.method(renderer.impacts, 'draw', () => order.push({ kind: 'cosmic-effects' }));
  clock.now += 50;
  renderer.draw(clock.now, .016);
  assert.deepEqual(order, [
    { kind: 'rocket', x: 810, y: 405 },
    { kind: 'fireball' },
    { kind: 'cosmic-effects' },
    { kind: 'hopping-anvil', x: 1600, y: 550 },
  ]);
});
