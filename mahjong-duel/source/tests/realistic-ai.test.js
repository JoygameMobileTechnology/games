import test from 'node:test';
import assert from 'node:assert/strict';
import { isFree, removePair, createGame, getAvailablePairs, remainingCount, shuffleBoard } from '../src/engine.js';
import {
  createRealisticState, realisticTuning, planRealisticTurn, chooseRealisticSecond,
  rememberRealisticFaces, decayRealisticMemory, advanceRealisticState,
} from '../src/realistic-ai.js';

const tile = (id, key, x, y = 0, z = 0) => ({ id, matchKey: key, x, y, z, removed: false });
const observation = (key, turn = 0) => ({ key, turn });
const knownFaces = (tiles, turn = 0) => Object.fromEntries(tiles.map(value => [value.id, observation(value.matchKey, turn)]));
const gameFor = (tiles, seed = 0, skill = 0.5, aiMemory = {}) => ({
  tiles, seed, attempts: 0, aiAttempts: 0, aiMemory, realisticState: createRealisticState(seed, skill),
});
const neutralState = skillLevel => ({ ...createRealisticState(0, skillLevel), matchForm: 0, focus: 0 });

function playTwoFlips(game) {
  const plan = planRealisticTurn(game);
  if (!plan.firstId) return { plan, second: null, revealedGame: game };
  const turn = game.attempts + game.aiAttempts;
  const firstMemory = rememberRealisticFaces(game.tiles, game.aiMemory, [plan.firstId], turn, plan.state);
  const next = { ...game, aiMemory: firstMemory, realisticState: plan.state };
  const second = chooseRealisticSecond(next, plan);
  return { plan, second, revealedGame: next };
}

test('only explicit reveals may read faces; planners, decay and form cannot inspect hidden metadata', () => {
  const keys = new Map([['a', 'A'], ['b', 'A'], ['c', 'B'], ['d', 'B']]);
  const permitted = new Set();
  const reads = [];
  const board = [...keys].map(([id, key], index) => {
    const value = tile(id, key, index);
    for (const name of ['matchKey', 'faceId', 'name', 'rarity']) Object.defineProperty(value, name, { get() {
      assert.ok(name === 'matchKey' && permitted.has(id), `forbidden ${name} read on ${id}`);
      reads.push(id);
      return key;
    } });
    return value;
  });
  for (let seed = 0; seed < 60; seed++) {
    let game = gameFor(board, seed, 0.5, { a: observation('A'), b: observation('A') });
    for (const name of ['solution', 'score', 'aiScore']) Object.defineProperty(game, name, { get() { assert.fail(`forbidden ${name} read`); } });
    const plan = planRealisticTurn(game);
    permitted.add(plan.firstId);
    const aiMemory = rememberRealisticFaces(board, game.aiMemory, [plan.firstId], 0, plan.state);
    permitted.clear();
    const second = chooseRealisticSecond({ tiles: board, seed, attempts: 0, aiAttempts: 0, aiMemory, realisticState: plan.state }, plan);
    assert.notEqual(second.secondId, plan.firstId);
    decayRealisticMemory(board, aiMemory, seed, 1, plan.state);
    advanceRealisticState(game, { aiAttempts: 0 });
  }
  assert.equal(reads.length, 60);
});

test('blind choices are unchanged by unseen face identities and allow accidental matches', () => {
  const board = Array.from({ length: 8 }, (_, i) => tile(`t${i}`, `pair${i % 4}`, i));
  const disguised = board.map((value, i) => ({ ...value, matchKey: `unique${i}` }));
  let accidental = 0;
  for (let seed = 0; seed < 500; seed++) {
    const original = playTwoFlips(gameFor(board, seed));
    const changed = playTwoFlips(gameFor(disguised, seed));
    assert.equal(original.plan.firstId, changed.plan.firstId);
    assert.equal(original.second.secondId, changed.second.secondId);
    const first = board.find(value => value.id === original.plan.firstId);
    const second = board.find(value => value.id === original.second.secondId);
    if (first.matchKey === second.matchKey) accidental++;
  }
  assert.ok(accidental > 30 && accidental < 120, `honest random matches: ${accidental}/500`);
});

test('decisions always respect public geometry, including an unavailable planned partner', () => {
  const board = [tile('under', 'A', 0), tile('partner', 'A', 1), tile('cover', 'B', 0, 0, 1), tile('other', 'B', 2)];
  for (let seed = 0; seed < 80; seed++) {
    const game = gameFor(board, seed, 0.8, knownFaces(board));
    const { plan, second, revealedGame } = playTwoFlips(game);
    assert.ok(isFree(board.find(value => value.id === plan.firstId), board));
    assert.ok(isFree(board.find(value => value.id === second.secondId), board));
    assert.notEqual(plan.firstId, second.secondId);
    assert.notEqual(plan.firstId, 'under');
    assert.notEqual(second.secondId, 'under');
    const stale = chooseRealisticSecond({ ...revealedGame, aiAttempts: 1 }, plan);
    assert.equal(stale.secondId, null);
    const removed = board.map(value => value.id === second.secondId ? { ...value, removed: true } : value);
    assert.notEqual(chooseRealisticSecond({ ...revealedGame, tiles: removed }, plan).secondId, second.secondId);
  }
  const blocked = [tile('bottom', 'A', 0), tile('top', 'A', 0, 0, 1)];
  assert.equal(planRealisticTurn(gameFor(blocked)).firstId, null);
  assert.equal(planRealisticTurn(gameFor(blocked)).needsShuffle, true);
  assert.equal(planRealisticTurn(gameFor([])).needsShuffle, false);
});

test('higher skill increases known-pair recall while failed recall can choose every tile', () => {
  const board = Array.from({ length: 8 }, (_, i) => tile(`t${i}`, i < 2 ? 'pair' : `unique${i}`, i));
  const memory = { t0: observation('pair'), t1: observation('pair') };
  let low = 0, high = 0, failedRecallMatches = 0;
  const firstGuesses = new Set();
  for (let seed = 0; seed < 3000; seed++) {
    const lowGame = gameFor(board, seed, 0, memory);
    const highGame = gameFor(board, seed, 1, memory);
    // Equal neutral form isolates long-term skill from each match's luck.
    lowGame.realisticState = { ...neutralState(0), seed };
    highGame.realisticState = { ...neutralState(1), seed };
    const lowTurn = playTwoFlips(lowGame);
    const highTurn = playTwoFlips(highGame);
    low += Number(lowTurn.plan.recalledPair);
    high += Number(highTurn.plan.recalledPair);
    if (!lowTurn.plan.recalledPair) {
      firstGuesses.add(lowTurn.plan.firstId);
      if (lowTurn.plan.firstId === 't0' && lowTurn.second.secondId === 't1' ||
          lowTurn.plan.firstId === 't1' && lowTurn.second.secondId === 't0') failedRecallMatches++;
    }
  }
  assert.ok(low / 3000 > 0.27 && low / 3000 < 0.33);
  assert.ok(high / 3000 > 0.87 && high / 3000 < 0.93);
  assert.equal(firstGuesses.size, board.length);
  assert.ok(failedRecallMatches > 100, 'failed pair recall still permits a remembered or lucky second choice');
});

test('second-card recall uses the newly visible first face and failed recall guesses honestly', () => {
  const board = Array.from({ length: 8 }, (_, i) => tile(`t${i}`, i < 2 ? 'pair' : `unique${i}`, i));
  const seconds = new Set();
  let recalled = 0, chanceMatches = 0;
  for (let seed = 0; seed < 3000; seed++) {
    const state = { ...neutralState(0), seed };
    const game = { ...gameFor(board, seed), realisticState: state, aiMemory: { t0: observation('pair'), t1: observation('pair') } };
    const plan = { firstId: 't0', rememberedSecondId: null, recalledPair: false, turnIndex: 0, state };
    const result = chooseRealisticSecond(game, plan);
    recalled += Number(result.recalledPartner);
    if (!result.recalledPartner) {
      seconds.add(result.secondId);
      chanceMatches += Number(result.secondId === 't1');
    }
  }
  assert.ok(recalled / 3000 > 0.42 && recalled / 3000 < 0.48);
  assert.equal(seconds.size, 7);
  assert.ok(chanceMatches > 150);
});

test('memory has capacity, expiry, refresh, probabilistic fading and explicit shuffle reset', () => {
  const board = Array.from({ length: 30 }, (_, i) => tile(`t${i}`, `key${i}`, i));
  const state = neutralState(0.5);
  const tuning = realisticTuning(state);
  assert.equal(tuning.memoryCapacity, 12);
  assert.equal(tuning.memoryLifetime, 8);
  const memory = rememberRealisticFaces(board, {}, board.map(value => value.id), 1, state);
  assert.equal(Object.keys(memory).length, 12);
  assert.equal(memory.t0, undefined);
  assert.deepEqual(memory.t29, observation('key29', 1));
  const refreshed = rememberRealisticFaces(board, memory, ['t18'], 3, state);
  assert.deepEqual(refreshed.t18, observation('key18', 3));
  assert.equal(Object.keys(rememberRealisticFaces(board, refreshed, [], 10, state)).length, 1);
  assert.deepEqual(rememberRealisticFaces(board, refreshed, [], 12, state), {});
  assert.deepEqual(rememberRealisticFaces(board, {}, [], 3, state), {}, 'reset memory stays empty after shuffle');
  const removed = board.map(value => ({ ...value, removed: true }));
  assert.deepEqual(rememberRealisticFaces(removed, memory, [], 1, state), {});
  let lost = 0;
  for (let seed = 0; seed < 1000; seed++) {
    const decayed = decayRealisticMemory(board, memory, seed, 2, state);
    assert.deepEqual(decayed, decayRealisticMemory(board, memory, seed, 2, state));
    lost += Object.keys(memory).length - Object.keys(decayed).length;
  }
  assert.ok(Math.abs(lost / 12000 - tuning.memoryDecay) < 0.02);
  assert.equal(Object.keys(memory).length, 12, 'memory inputs are not mutated');
});

test('both flip delays vary reproducibly and timing is independent of recall random draws', () => {
  const board = [tile('a', 'A', 0), tile('b', 'A', 1), tile('c', 'B', 2), tile('d', 'B', 3)];
  const firstDelays = new Set(), secondDelays = new Set();
  let hesitations = 0;
  for (let seed = 0; seed < 200; seed++) {
    const game = gameFor(board, seed);
    const result = playTwoFlips(game);
    assert.deepEqual(result, playTwoFlips(game));
    assert.ok(result.plan.thinkMs >= 650 && result.plan.thinkMs <= 2600);
    assert.ok(result.second.delayMs >= 220 && result.second.delayMs <= 1500);
    firstDelays.add(result.plan.thinkMs);
    secondDelays.add(result.second.delayMs);
    hesitations += Number(result.plan.thinkMs > 1800);
    const firstKnown = { ...game, aiMemory: { a: observation('A') } };
    const differentChoices = planRealisticTurn(firstKnown);
    assert.equal(differentChoices.thinkMs, result.plan.thinkMs, 'same confidence and seed retain the independent timing draw');
  }
  assert.ok(firstDelays.size > 150);
  assert.ok(secondDelays.size > 150);
  assert.ok(hesitations > 0);
});

test('good and bad matches and correlated attention runs are outcome independent', () => {
  const forms = Array.from({ length: 200 }, (_, seed) => createRealisticState(seed).matchForm);
  assert.ok(forms.some(value => value < -0.12));
  assert.ok(forms.some(value => value > 0.12));
  let state = createRealisticState(193);
  let sameSign = 0, positive = 0, negative = 0;
  for (let index = 0; index < 400; index++) {
    const base = { realisticState: state, aiAttempts: index + 1, seed: 193 };
    const success = advanceRealisticState({ ...base, aiScore: 100, score: 0 }, { aiAttempts: index });
    const failure = advanceRealisticState({ ...base, aiScore: 0, score: 100 }, { aiAttempts: index });
    assert.deepEqual(success, failure);
    assert.equal(success.skillLevel, 0.5);
    assert.equal(success.matchForm, state.matchForm);
    assert.ok(Math.abs(success.focus) <= 0.14);
    sameSign += Number(Math.sign(success.focus) === Math.sign(state.focus));
    positive += Number(success.focus > 0.04);
    negative += Number(success.focus < -0.04);
    state = success;
  }
  assert.ok(sameSign > 270, 'attention tends to persist across adjacent attempts');
  assert.ok(positive > 30 && negative > 30, 'attention contains both strong and weak runs');
  assert.deepEqual(advanceRealisticState({ realisticState: state, aiAttempts: 400 }, { aiAttempts: 400 }), state);
});

test('Realistic AI can finish legal boards while shared shuffles clear remembered positions', () => {
  for (const ruleset of ['eastern', 'western']) {
    let game = gameFor(createGame(ruleset, 91, 'calm').tiles, 91);
    while (remainingCount(game.tiles) && game.aiAttempts < 1600) {
      if (!getAvailablePairs(game.tiles).length) game = { ...game, tiles: shuffleBoard(game.tiles, 91 + game.aiAttempts).tiles, aiMemory: {} };
      const { plan, second, revealedGame } = playTwoFlips(game);
      assert.ok(plan.firstId && second.secondId);
      const memory = rememberRealisticFaces(game.tiles, revealedGame.aiMemory, [second.secondId], game.aiAttempts, plan.state);
      const nextTiles = removePair(game.tiles, plan.firstId, second.secondId);
      const next = { ...game, tiles: nextTiles, aiAttempts: game.aiAttempts + 1 };
      const state = advanceRealisticState(next, game);
      game = { ...next, realisticState: state, aiMemory: decayRealisticMemory(nextTiles, memory, 91, next.aiAttempts, state) };
    }
    assert.equal(remainingCount(game.tiles), 0, `${ruleset} completed in ${game.aiAttempts} attempts`);
  }
});
