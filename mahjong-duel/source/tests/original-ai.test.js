import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ORIGINAL_PAIR_RECALL, ORIGINAL_MATCH_RECALL, ORIGINAL_MEMORY_DECAY,
  rememberOriginalFaces, playOriginalTurn, decayOriginalMemory,
} from '../src/original-ai.js';
import { createGame, getAvailablePairs, isFree, remainingCount, shuffleBoard } from '../src/engine.js';

const tile = (id, key, x, y = 0, z = 0) => ({ id, faceId: `${key}-face`, matchKey: key, x, y, z, removed: false });
const observation = (key, turn = 0) => ({ key, turn });
const knownFaces = (tiles, turn = 0) => Object.fromEntries(tiles.map(value => [value.id, observation(value.matchKey, turn)]));

test('Original AI exposes the requested independent recall and decay probabilities', () => {
  assert.equal(ORIGINAL_PAIR_RECALL, 0.4);
  assert.equal(ORIGINAL_MATCH_RECALL, 0.35);
  assert.equal(ORIGINAL_MEMORY_DECAY, 0.25);
});

test('every supplied reveal is remembered without a time or tile-count limit', () => {
  const board = Array.from({ length: 40 }, (_, i) => tile(`tile-${i}`, `key-${i}`, i));
  const firstReveals = rememberOriginalFaces(board, {}, ['tile-0', 'tile-1'], 1);
  const laterReveals = rememberOriginalFaces(board, firstReveals, ['tile-2', 'tile-3'], 100);
  assert.deepEqual(laterReveals, {
    'tile-0': observation('key-0', 1), 'tile-1': observation('key-1', 1),
    'tile-2': observation('key-2', 100), 'tile-3': observation('key-3', 100),
  });
  const peek = rememberOriginalFaces(board, laterReveals, board.map(value => value.id), 101);
  assert.equal(Object.keys(peek).length, 40);
  assert.ok(Object.values(peek).every(value => value.turn === 101));
  assert.deepEqual(rememberOriginalFaces(board, peek, [], 1000), peek, 'recording and trimming do not decay memory');
  assert.deepEqual(firstReveals, { 'tile-0': observation('key-0', 1), 'tile-1': observation('key-1', 1) });
});

test('unobserved identities never guide either blind choice', () => {
  const board = [tile('a', 'A', 0), tile('b', 'B', 1), tile('c', 'A', 2), tile('d', 'B', 3)];
  const disguised = board.map((value, i) => ({ ...value, matchKey: `different-${i}`, faceId: `different-face-${i}` }));
  for (let seed = 0; seed < 200; seed++) {
    assert.deepEqual(playOriginalTurn(board, {}, seed).flippedIds, playOriginalTurn(disguised, {}, seed).flippedIds);
  }
});

test('recall inspects only revealed identities, and decay never inspects hidden identities', () => {
  for (let seed = 0; seed < 60; seed++) {
    const reads = [];
    const board = Array.from({ length: 20 }, (_, i) => {
      const value = tile(`tile-${i}`, `pair-${i % 10}`, i);
      const key = value.matchKey;
      for (const property of ['matchKey', 'faceId']) {
        Object.defineProperty(value, property, { enumerable: true, get() {
          reads.push(value.id);
          return property === 'matchKey' ? key : `${key}-face`;
        } });
      }
      return value;
    });
    const memory = Object.fromEntries(Array.from({ length: 16 }, (_, i) => [`tile-${i}`, observation(`pair-${i % 10}`)]));
    const result = playOriginalTurn(board, memory, seed);
    assert.equal(result.flippedIds.length, 2);
    for (const id of reads) assert.ok(result.flippedIds.includes(id), `${id} was never selected`);
    reads.length = 0;
    decayOriginalMemory(board, memory, seed, 1);
    assert.deepEqual(reads, []);
  }
});

test('known pairs use 40% recall and can still be found by an honest guess', () => {
  const count = 20;
  const board = Array.from({ length: count }, (_, i) => tile(`tile-${i}`, i < 2 ? 'pair' : `other-${i}`, i));
  const memory = { 'tile-0': observation('pair'), 'tile-1': observation('pair') };
  let matches = 0;
  const firstGuesses = new Set();
  const samples = 12000;
  for (let seed = 0; seed < samples; seed++) {
    const result = playOriginalTurn(board, memory, seed);
    if (result.matched) matches++;
    firstGuesses.add(result.flippedIds[0]);
  }
  // After the 40% gate fails, either pair member can be guessed first; its partner
  // is then recalled 35% of the time or found by chance amongst the other tiles.
  const expected = 0.4 + 0.6 * (2 / count) * (0.35 + 0.65 / (count - 1));
  assert.ok(Math.abs(matches / samples - expected) < 0.015, `${matches / samples} versus ${expected}`);
  assert.equal(firstGuesses.size, count, 'failed recall never excludes remembered tiles from guesses');
});

test('a newly revealed first tile recalls its known partner 35% of the time, with random matches still allowed', () => {
  const count = 8;
  const board = Array.from({ length: count }, (_, i) => tile(`tile-${i}`, i < 2 ? 'pair' : `other-${i}`, i));
  const memory = { 'tile-0': observation('pair') };
  let revealedPartner = 0, matches = 0;
  const seconds = new Set();
  for (let seed = 0; seed < 24000; seed++) {
    const result = playOriginalTurn(board, memory, seed);
    if (result.flippedIds[0] !== 'tile-1') continue;
    revealedPartner++;
    if (result.matched) matches++;
    seconds.add(result.flippedIds[1]);
  }
  const expected = 0.35 + 0.65 / (count - 1);
  assert.ok(revealedPartner > 2500);
  assert.ok(Math.abs(matches / revealedPartner - expected) < 0.025, `${matches / revealedPartner} versus ${expected}`);
  assert.equal(seconds.size, count - 1, 'a failed recall guesses without secretly ruling out a match');
});

test('memory decays independently at 25% per record and has no blanket expiry', () => {
  const board = Array.from({ length: 40 }, (_, i) => tile(`tile-${i}`, `key-${i}`, i));
  const memory = knownFaces(board, 1);
  const before = structuredClone(memory);
  const deleted = Object.fromEntries(board.map(value => [value.id, 0]));
  const samples = 1000;
  for (let seed = 0; seed < samples; seed++) {
    const result = decayOriginalMemory(board, memory, seed, 500);
    assert.deepEqual(result, decayOriginalMemory(board, memory, seed, 500));
    assert.ok(Object.keys(result).length > 0 && Object.keys(result).length < board.length);
    for (const value of board) if (!Object.hasOwn(result, value.id)) deleted[value.id]++;
  }
  for (const value of Object.values(deleted)) assert.ok(value / samples > 0.2 && value / samples < 0.3);
  assert.deepEqual(memory, before);
});

test('planning a turn refreshes its two reveals but never applies turn decay', () => {
  const board = Array.from({ length: 30 }, (_, i) => tile(`tile-${i}`, `key-${i}`, i));
  const memory = knownFaces(board, 2);
  const result = playOriginalTurn(board, memory, 123, 400);
  assert.equal(result.matched, false);
  assert.equal(Object.keys(result.memory).length, 30);
  for (const [id, value] of Object.entries(result.memory)) {
    assert.equal(value.turn, result.flippedIds.includes(id) ? 400 : 2);
  }
  assert.deepEqual(result, playOriginalTurn(board, memory, 123, 400));
});

test('malformed, future and removed records are pruned without discarding old valid observations', () => {
  const values = ['A', null, {}, { key: '', turn: 3 }, { key: 'A', turn: 3.5 },
    { key: 'A', turn: -1 }, { key: 'A', turn: 7 }, { key: 'A', turn: '5' }, observation('A', 0)];
  const board = values.map((value, i) => tile(`tile-${i}`, 'A', i));
  board.push({ ...tile('gone', 'A', 10), removed: true });
  const memory = { ...Object.fromEntries(values.map((value, i) => [`tile-${i}`, value])), gone: observation('A'), missing: observation('A') };
  for (const value of board) Object.defineProperty(value, 'matchKey', { get() { assert.fail('a hidden face was read'); } });
  assert.deepEqual(rememberOriginalFaces(board, memory, [], 5), { 'tile-8': observation('A', 0) });
});

test('covered remembered tiles stay inaccessible until uncovered', () => {
  const board = [tile('under', 'A', 0), tile('partner', 'A', 1), tile('cover', 'B', 0, 0, 1), tile('other', 'B', 2)];
  const memory = knownFaces(board);
  for (let seed = 0; seed < 100; seed++) {
    const result = playOriginalTurn(board, memory, seed);
    assert.equal(result.flippedIds.length, 2);
    assert.ok(!result.flippedIds.includes('under'));
    for (const id of result.flippedIds) assert.ok(isFree(board.find(value => value.id === id), board));
    assert.deepEqual(result.memory.under, observation('A'), 'being covered does not erase a previously seen face');
  }
  const blocked = [tile('bottom', 'A', 0), tile('top', 'A', 0, 0, 1)];
  const result = playOriginalTurn(blocked, {}, 18);
  assert.deepEqual(result.flippedIds, []);
  assert.equal(result.needsShuffle, true);
  const distinct = Array.from({ length: 4 }, (_, i) => tile(`tile-${i}`, `key-${i}`, i));
  assert.equal(playOriginalTurn(distinct, {}, 8).needsShuffle, false, 'unseen tiles cannot trigger a strategic shuffle');
  assert.equal(playOriginalTurn(distinct, knownFaces(distinct), 8).needsShuffle, true);
});

test('Original turns are immutable and remove only a legal matching pair', () => {
  const board = Object.freeze([tile('a', 'A', 0), tile('b', 'A', 1)].map(Object.freeze));
  const memory = Object.freeze({ a: Object.freeze(observation('A')), b: Object.freeze(observation('A')) });
  const result = playOriginalTurn(board, memory, 0);
  assert.equal(result.matched, true);
  assert.equal(remainingCount(result.tiles), 0);
  assert.deepEqual(result.memory, {});
  assert.equal(result.needsShuffle, false);
  assert.ok(board.every(value => !value.removed));
  assert.equal(Object.keys(memory).length, 2);
  for (const seed of [Infinity, NaN, 1.5, '1']) {
    assert.throws(() => playOriginalTurn(board, {}, seed), /finite integer/);
    assert.throws(() => decayOriginalMemory(board, {}, seed), /finite integer/);
  }
  for (const index of [Infinity, NaN, 1.5, '1', -1]) {
    assert.throws(() => playOriginalTurn(board, {}, 0, index), /non-negative integer/);
    assert.throws(() => decayOriginalMemory(board, {}, 0, index), /non-negative integer/);
    assert.throws(() => rememberOriginalFaces(board, {}, [], index), /non-negative integer/);
  }
});

test('Original AI completes legal Eastern and Western boards with shared-board shuffle resets', () => {
  for (const ruleset of ['eastern', 'western']) {
    let { tiles } = createGame(ruleset, 91, 'calm');
    let memory = {}, attempts = 0;
    while (remainingCount(tiles) && attempts < 2000) {
      if (!getAvailablePairs(tiles).length) {
        tiles = shuffleBoard(tiles, 91 + attempts).tiles;
        memory = {};
      }
      const result = playOriginalTurn(tiles, memory, 91 + attempts, attempts);
      assert.equal(result.flippedIds.length, 2);
      for (const id of result.flippedIds) assert.ok(isFree(tiles.find(value => value.id === id), tiles));
      assert.equal(remainingCount(result.tiles), remainingCount(tiles) - (result.matched ? 2 : 0));
      tiles = result.tiles;
      attempts++;
      memory = decayOriginalMemory(tiles, result.memory, 9173 + attempts, attempts);
    }
    assert.equal(remainingCount(tiles), 0, `${ruleset} finishes with probabilistic recall and decay`);
  }
});
