import test from 'node:test';
import assert from 'node:assert/strict';
import { GHOST_MEMORY_TURNS, GHOST_MEMORY_VERSION, ghostName, playGhostTurn, rememberGhostFaces } from '../src/ghost.js';
import { createGame, getAvailablePairs, isFree, remainingCount, shuffleBoard } from '../src/engine.js';

const tile = (id, key, x, y = 0, z = 0) => ({ id, faceId: `${key}-face`, matchKey: key, x, y, z, removed: false });
const observation = (key, turn = 0) => ({ key, turn });
const knownFaces = (tiles, turn = 0) => Object.fromEntries(tiles.map(value => [value.id, observation(value.matchKey, turn)]));

test('memory uses version-three timestamps and a two-attempt window', () => {
  assert.equal(GHOST_MEMORY_VERSION, 3);
  assert.equal(GHOST_MEMORY_TURNS, 2);
});

test('the opponent name is the player profile with a Ghost suffix', () => {
  assert.equal(ghostName({ name: 'Alex' }), 'Alex’s Ghost');
  assert.equal(ghostName({ name: '  Can   Kalsin  ' }), 'Can Kalsin’s Ghost');
  assert.equal(ghostName({ name: 'Élodie' }), 'Élodie’s Ghost');
  for (const profile of [null, {}, { name: '' }, { name: '  ' }, { name: 42 }]) {
    assert.equal(ghostName(profile), 'Player’s Ghost');
  }
});

test('unobserved pictures cannot influence blind ghost choices', () => {
  const original = [tile('a', 'A', 0), tile('b', 'B', 1), tile('c', 'A', 2), tile('d', 'B', 3)];
  const disguised = original.map((value, index) => ({ ...value, matchKey: `unique-${index}`, faceId: `different-${index}` }));
  for (let seed = 0; seed < 100; seed += 1) {
    assert.deepEqual(playGhostTurn(original, {}, seed).flippedIds, playGhostTurn(disguised, {}, seed).flippedIds);
  }
});

test('ghost recall and memory trimming never inspect unselected face metadata', () => {
  for (let seed = 0; seed < 30; seed += 1) {
    const reads = [];
    const board = Array.from({ length: 20 }, (_, i) => {
      const value = tile(`tile-${i}`, `pair-${i % 10}`, i);
      const key = value.matchKey;
      for (const property of ['matchKey', 'faceId']) {
        Object.defineProperty(value, property, { enumerable: true, get() { reads.push(value.id); return property === 'matchKey' ? key : `${key}-face`; } });
      }
      return value;
    });
    const memory = Object.fromEntries(Array.from({ length: 16 }, (_, i) => [`tile-${i}`, observation(`pair-${i % 10}`)]));
    const result = playGhostTurn(board, memory, seed);
    assert.equal(result.flippedIds.length, 2);
    assert.ok(reads.length >= 2);
    for (const id of reads) assert.ok(result.flippedIds.includes(id), `unselected ${id} remained private`);
    for (const id of Object.keys(result.memory)) assert.ok(Object.hasOwn(memory, id) || result.flippedIds.includes(id));
  }
});

test('a discovered available pair is always taken, with no deliberate mistakes', () => {
  const board = [tile('a', 'A', 0), tile('b', 'B', 1), tile('c', 'A', 2),
    tile('d', 'D', 3), tile('e', 'E', 4), tile('f', 'F', 5), tile('g', 'G', 6), tile('h', 'H', 7)];
  let remembered = 0;
  for (let seed = 0; seed < 200; seed += 1) {
    const memory = { a: observation('A'), c: observation('A') };
    const result = playGhostTurn(board, memory, seed, 2);
    assert.deepEqual(result, playGhostTurn(board, memory, seed, 2));
    if (result.flippedIds.includes('a') && result.flippedIds.includes('c')) remembered += 1;
  }
  assert.equal(remembered, 200);
});

test('a blind first reveal immediately uses an actually remembered partner', () => {
  const board = [tile('a', 'A', 0), tile('b', 'B', 1), tile('c', 'A', 2), tile('d', 'D', 3)];
  let found = 0;
  for (let seed = 0; seed < 200; seed++) {
    const result = playGhostTurn(board, { a: observation('A') }, seed);
    if (result.flippedIds[0] !== 'c') continue;
    assert.equal(result.flippedIds[1], 'a');
    assert.equal(result.matched, true);
    found++;
  }
  assert.ok(found > 20);
});

test('blind exploration can repeat a known singleton instead of strategically avoiding it', () => {
  const board = Array.from({ length: 8 }, (_, i) => tile(`tile-${i}`, `unique-${i}`, i));
  const firstChoices = new Set(), secondChoices = new Set();
  for (let seed = 0; seed < 200; seed++) {
    const result = playGhostTurn(board, { 'tile-0': observation('unique-0') }, seed);
    firstChoices.add(result.flippedIds[0]); secondChoices.add(result.flippedIds[1]);
  }
  assert.equal(firstChoices.size, 8);
  assert.equal(secondChoices.size, 8);
});

test('observations survive two completed attempts and expire at the third', () => {
  const board = Array.from({ length: 8 }, (_, i) => tile(`tile-${i}`, `unique-${i}`, i));
  let memory = rememberGhostFaces(board, {}, ['tile-0', 'tile-1'], 4);
  memory = rememberGhostFaces(board, memory, ['tile-2', 'tile-3'], 5);
  memory = rememberGhostFaces(board, memory, ['tile-4'], 6);
  assert.deepEqual(memory, {
    'tile-0': observation('unique-0', 4), 'tile-1': observation('unique-1', 4),
    'tile-2': observation('unique-2', 5), 'tile-3': observation('unique-3', 5),
    'tile-4': observation('unique-4', 6),
  });
  memory = rememberGhostFaces(board, memory, [], 7);
  assert.deepEqual(Object.keys(memory), ['tile-2', 'tile-3', 'tile-4']);
  assert.deepEqual(rememberGhostFaces(board, memory, [], 9), {});
  assert.equal(Object.hasOwn(memory, 'tile-5'), false, 'unrevealed faces never become observations');
});

test('a repeated reveal refreshes its age without advancing the attempt index', () => {
  const board = [tile('a', 'A', 0), tile('b', 'B', 1), tile('c', 'C', 2)];
  const original = rememberGhostFaces(board, {}, ['a', 'b'], 1);
  const before = structuredClone(original);
  let memory = rememberGhostFaces(board, original, ['a'], 3);
  memory = rememberGhostFaces(board, memory, ['c'], 3);
  assert.deepEqual(memory, { b: observation('B', 1), a: observation('A', 3), c: observation('C', 3) });
  assert.deepEqual(rememberGhostFaces(board, memory, [], 4), { a: observation('A', 3), c: observation('C', 3) });
  assert.deepEqual(original, before, 'refresh leaves the previous memory unchanged');
});

test('Peek can teach every exposed face without a tile-count cap', () => {
  const board = Array.from({ length: 30 }, (_, i) => tile(`tile-${i}`, `unique-${i}`, i));
  const memory = rememberGhostFaces(board, {}, board.map(value => value.id), 7);
  const before = structuredClone(memory);
  assert.equal(Object.keys(memory).length, 30);
  assert.ok(Object.values(memory).every(value => value.turn === 7));
  const result = playGhostTurn(board, memory, 81, 9);
  assert.equal(result.matched, false);
  assert.strictEqual(result.tiles, board);
  assert.equal(Object.keys(result.memory).length, 30);
  for (const [id, value] of Object.entries(result.memory)) {
    assert.equal(value.turn, result.flippedIds.includes(id) ? 9 : 7);
  }
  assert.deepEqual(Object.keys(rememberGhostFaces(board, result.memory, [], 10)), result.flippedIds);
  assert.deepEqual(memory, before);
});

test('expired identities cannot influence a blind choice, even if they once formed a pair', () => {
  const board = [tile('a', 'A', 0), tile('b', 'B', 1), tile('c', 'A', 2), tile('d', 'D', 3)];
  const memory = { a: observation('A', 4), c: observation('A', 4) };
  for (let seed = 0; seed < 100; seed++) {
    assert.deepEqual(playGhostTurn(board, memory, seed, 7), playGhostTurn(board, {}, seed, 7));
  }
});

test('turns are immutable, remove only legal matches, and discard invalid or removed memories', () => {
  const board = Object.freeze([tile('a', 'A', 0), tile('b', 'B', 1), { ...tile('gone', 'A', 2), removed: true }].map(Object.freeze));
  const memory = Object.freeze({ gone: observation('A', 3), missing: observation('A', 3), a: Object.freeze(observation('A', 3)), b: null });
  const result = playGhostTurn(board, memory, 0, 4);
  assert.strictEqual(result.tiles, board);
  assert.deepEqual(new Set(result.flippedIds), new Set(['a', 'b']));
  assert.deepEqual(result.memory, { a: observation('A', 4), b: observation('B', 4) });
  assert.deepEqual(memory, { gone: observation('A', 3), missing: observation('A', 3), a: observation('A', 3), b: null });
  const paired = [tile('a', 'A', 0), tile('b', 'A', 1)];
  const matched = playGhostTurn(paired, knownFaces(paired), 0);
  assert.equal(matched.matched, true);
  assert.equal(remainingCount(matched.tiles), 0);
  assert.deepEqual(matched.memory, {});
  assert.equal(matched.needsShuffle, false);
  assert.ok(paired.every(value => !value.removed));
  for (const seed of [Infinity, NaN, 1.5, '1']) assert.throws(() => playGhostTurn(board, {}, seed), /finite integer/);
  for (const index of [Infinity, NaN, 1.5, '1', -1]) {
    assert.throws(() => playGhostTurn(board, {}, 0, index), /non-negative integer/);
    assert.throws(() => rememberGhostFaces(board, {}, [], index), /non-negative integer/);
  }
});

test('legacy, malformed, future and stale observations are discarded without reading hidden faces', () => {
  const values = ['A', null, {}, { key: '', turn: 3 }, { key: 'A', turn: 3.5 },
    { key: 'A', turn: -1 }, { key: 'A', turn: 7 }, { key: 'A', turn: 2 }, { key: 'A', turn: '5' }];
  const board = values.map((value, i) => tile(`tile-${i}`, 'A', i));
  const memory = Object.fromEntries(values.map((value, i) => [`tile-${i}`, value]));
  for (const value of board) Object.defineProperty(value, 'matchKey', { get() { assert.fail('a hidden identity was inspected'); } });
  assert.deepEqual(rememberGhostFaces(board, memory, [], 5), {});
});

test('covered tiles remain inaccessible and shuffle advice uses observed knowledge only', () => {
  const stack = [tile('under', 'A', 0), tile('partner', 'A', 1), tile('cover', 'B', 0, 0, 1), tile('other-cover', 'B', 2)];
  const memory = knownFaces(stack);
  for (let seed = 0; seed < 30; seed += 1) {
    const result = playGhostTurn(stack, memory, seed);
    assert.equal(result.flippedIds.length, 2);
    assert.ok(!result.flippedIds.includes('under'));
    for (const id of result.flippedIds) assert.ok(isFree(stack.find(value => value.id === id), stack));
    assert.equal(remainingCount(result.tiles), stack.length - (result.matched ? 2 : 0));
  }
  const distinct = Array.from({ length: 4 }, (_, i) => tile(`id-${i}`, `key-${i}`, i));
  assert.equal(playGhostTurn(distinct, {}, 8).needsShuffle, false);
  const known = knownFaces(distinct);
  assert.equal(playGhostTurn(distinct, known, 8).needsShuffle, true);
  const blocked = [tile('bottom', 'A', 0), tile('top', 'A', 0, 0, 1)];
  assert.deepEqual(playGhostTurn(blocked, {}, 18).flippedIds, []);
  assert.equal(playGhostTurn(blocked, {}, 18).needsShuffle, true);
});

test('two-attempt memory finishes legal Eastern and Western rounds with shared-board rescue', () => {
  for (const ruleset of ['eastern', 'western']) {
    let { tiles } = createGame(ruleset, 91, 'calm');
    let memory = {}, attempts = 0;
    while (remainingCount(tiles) && attempts < 1000) {
      if (!getAvailablePairs(tiles).length) {
        tiles = shuffleBoard(tiles, 91 + attempts).tiles;
        memory = {};
      }
      const result = playGhostTurn(tiles, memory, 91 + attempts, attempts);
      assert.equal(result.flippedIds.length, 2);
      for (const id of result.flippedIds) assert.ok(isFree(tiles.find(value => value.id === id), tiles));
      assert.equal(remainingCount(result.tiles), remainingCount(tiles) - (result.matched ? 2 : 0));
      assert.ok(Object.values(result.memory).every(value => value.turn >= attempts - GHOST_MEMORY_TURNS && value.turn <= attempts));
      tiles = result.tiles; attempts += 1;
      memory = rememberGhostFaces(tiles, result.memory, [], attempts);
    }
    assert.equal(remainingCount(tiles), 0, `${ruleset} finishes with bounded observed memory`);
  }
});
