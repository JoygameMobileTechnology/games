import test from 'node:test';
import assert from 'node:assert/strict';
import { playMemoryTurn } from '../src/memory-ai.js';
import { createGame, getAvailablePairs, isFree, remainingCount, shuffleBoard } from '../src/engine.js';
import { tileSets } from '../src/tile-data.js';

const tile = (id, key, x, y = 0, z = 0) => ({ id, faceId: `${key}-face`, matchKey: key, x, y, z, removed: false });

test('blind choices do not depend on any unrevealed face identities or matching keys', () => {
  const original = [tile('a', 'A', 0), tile('b', 'B', 1), tile('c', 'A', 2), tile('d', 'B', 3)];
  const disguised = original.map((value, index) => ({ ...value, matchKey: `unique-${index}`, faceId: `different-${index}` }));
  for (let seed = 0; seed < 50; seed += 1) {
    assert.deepEqual(playMemoryTurn(original, {}, seed).flippedIds, playMemoryTurn(disguised, {}, seed).flippedIds);
  }
});

test('a turn only reads matching keys or face metadata from the two selected tiles', () => {
  for (const seed of [0, 1, 5, 23]) {
    const keyReads = [], faceReads = [];
    const board = Array.from({ length: 8 }, (_, i) => {
      const value = tile(`tile-${i}`, `pair-${i % 4}`, i);
      const key = value.matchKey;
      Object.defineProperty(value, 'matchKey', { enumerable: true, get() { keyReads.push(value.id); return key; } });
      Object.defineProperty(value, 'faceId', { enumerable: true, get() { faceReads.push(value.id); return `${key}-face`; } });
      return value;
    });
    const result = playMemoryTurn(board, {}, seed);
    assert.equal(result.flippedIds.length, 2);
    assert.ok(keyReads.length >= 2);
    for (const id of [...keyReads, ...faceReads]) assert.ok(result.flippedIds.includes(id), `hidden ${id} was never consulted`);
  }
});

test('a mismatch teaches both faces and the next reveal can recall its matching partner', () => {
  const board = [tile('a', 'A', 0), tile('b', 'B', 1), tile('c', 'A', 2), tile('d', 'B', 3)];
  let first;
  for (let seed = 0; seed < 20; seed += 1) {
    const attempt = playMemoryTurn(board, {}, seed);
    if (!attempt.matched) { first = attempt; break; }
  }
  assert.ok(first);
  assert.equal(Object.keys(first.memory).length, 2);
  for (const id of first.flippedIds) assert.equal(first.memory[id], board.find(value => value.id === id).matchKey);
  const second = playMemoryTurn(first.tiles, first.memory, 921);
  assert.equal(second.matched, true);
  assert.equal(Object.hasOwn(first.memory, second.flippedIds[0]), false, 'exploration begins with an unseen tile');
  assert.equal(Object.hasOwn(first.memory, second.flippedIds[1]), true, 'second flip recalls a previously seen matching tile');
  assert.equal(remainingCount(second.tiles), 2);
  for (const id of second.flippedIds) assert.equal(Object.hasOwn(second.memory, id), false, 'removed tile memories are pruned');
  const third = playMemoryTurn(second.tiles, second.memory, 81);
  assert.equal(third.matched, true);
  assert.equal(remainingCount(third.tiles), 0);
  assert.deepEqual(third.memory, {});
  assert.equal(third.needsShuffle, false);
});

test('a known matching pair is selected before exploring unknown tiles', () => {
  const board = [tile('a', 'A', 0), tile('b', 'B', 1), tile('c', 'A', 2), tile('d', 'B', 3)];
  for (let seed = 0; seed < 10; seed += 1) {
    const result = playMemoryTurn(board, { a: 'A', c: 'A' }, seed);
    assert.deepEqual(new Set(result.flippedIds), new Set(['a', 'c']));
    assert.equal(result.matched, true);
  }
});

test('AI ignores covered memories, then uses them after the covering pair is removed', () => {
  const board = [tile('under', 'A', 0), tile('partner', 'A', 1), tile('cover', 'B', 0, 0, 1), tile('cover-partner', 'B', 2)];
  const memory = { under: 'A', partner: 'A', cover: 'B', 'cover-partner': 'B' };
  const first = playMemoryTurn(board, memory, 27);
  assert.deepEqual(new Set(first.flippedIds), new Set(['cover', 'cover-partner']));
  for (const id of first.flippedIds) assert.ok(isFree(board.find(value => value.id === id), board));
  assert.equal(first.memory.under, 'A');
  const second = playMemoryTurn(first.tiles, first.memory, 27);
  assert.deepEqual(new Set(second.flippedIds), new Set(['under', 'partner']));
  assert.equal(remainingCount(second.tiles), 0);
});

test('learned Eastern symbol keys select an identical picture and leave a different symbol', () => {
  const [first, second] = tileSets.eastern.filter(value => value.family === 'glyph');
  const board = [
    { ...first, id: 'symbol-a', faceId: first.id, x: 0, y: 0, z: 0, removed: false },
    { ...first, id: 'symbol-b', faceId: first.id, x: 1, y: 0, z: 0, removed: false },
    { ...second, id: 'other-symbol', faceId: second.id, x: 2, y: 0, z: 0, removed: false },
  ];
  const memory = Object.fromEntries(board.map(value => [value.id, value.matchKey]));
  const result = playMemoryTurn(board, memory, 71);
  assert.deepEqual(new Set(result.flippedIds), new Set(['symbol-a', 'symbol-b']));
  assert.equal(result.matched, true);
  assert.equal(remainingCount(result.tiles), 1);
  assert.equal(result.memory['other-symbol'], second.matchKey);
});

test('turns are seeded, immutable, and retain only valid memories of live observed tiles', () => {
  const board = Object.freeze([tile('a', 'A', 0), tile('b', 'B', 1), { ...tile('gone', 'A', 2), removed: true }].map(Object.freeze));
  const memory = Object.freeze({ gone: 'A', missing: 'A', a: 'A', b: null });
  const first = playMemoryTurn(board, memory, 0);
  assert.deepEqual(first, playMemoryTurn(board, memory, 0));
  assert.strictEqual(first.tiles, board, 'a mismatch leaves board identity unchanged');
  assert.deepEqual(first.memory, { a: 'A', b: 'B' });
  assert.deepEqual(memory, { gone: 'A', missing: 'A', a: 'A', b: null });
  assert.throws(() => playMemoryTurn(board, {}, Infinity), /finite integer/);
});

test('shuffle advice uses only uncovered geometry and remembered knowledge', () => {
  const board = Array.from({ length: 6 }, (_, i) => tile(`id-${i}`, `key-${i}`, i));
  assert.equal(playMemoryTurn(board, {}, 8).needsShuffle, false, 'unseen uncovered faces can still be explored');
  const known = Object.fromEntries(board.map(value => [value.id, value.matchKey]));
  assert.equal(playMemoryTurn(board, known, 8).needsShuffle, true, 'all uncovered tiles are known and none match');
  const stacked = [tile('bottom', 'A', 0), tile('top', 'A', 0, 0, 1)];
  const result = playMemoryTurn(stacked, {}, 18);
  assert.deepEqual(result.flippedIds, []);
  assert.deepEqual(result.memory, {});
  assert.equal(result.needsShuffle, true);
  assert.equal(playMemoryTurn([], {}, 18).needsShuffle, false);
});

test('a memory opponent completes full rounds through legal discovery and rescue shuffles', () => {
  for (const ruleset of ['eastern', 'western']) {
    for (let seed = 0; seed < 4; seed += 1) {
      let { tiles } = createGame(ruleset, seed);
      let memory = {};
      let turn = 0;
      while (remainingCount(tiles) && turn < 350) {
        const before = tiles;
        const result = playMemoryTurn(tiles, memory, seed * 1000 + turn);
        for (const id of result.flippedIds) assert.ok(isFree(before.find(value => value.id === id), before));
        assert.equal(remainingCount(result.tiles), remainingCount(before) - (result.matched ? 2 : 0));
        tiles = result.tiles;
        memory = result.memory;
        if (result.needsShuffle && remainingCount(tiles)) {
          assert.equal(getAvailablePairs(tiles).length, 0, 'knowledge-based rescue request agrees with actual board state');
          tiles = shuffleBoard(tiles, seed * 1000 + turn).tiles;
          memory = {};
        }
        turn += 1;
      }
      assert.equal(remainingCount(tiles), 0, `${ruleset} seed ${seed} finishes through remembered flips`);
    }
  }
});
