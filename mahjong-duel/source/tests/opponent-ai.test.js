import test from 'node:test';
import assert from 'node:assert/strict';
import { AI_MODES, normalizeAiMode, playOpponentTurn, rememberOpponentFaces, advanceOpponentMemory } from '../src/opponent-ai.js';
import { playGhostTurn, rememberGhostFaces } from '../src/ghost.js';
import { createDuelState, resolveDuelAttempt } from '../src/duel.js';
import { createGame, getAvailablePairs, isFree, remainingCount, shuffleBoard } from '../src/engine.js';

const tile = (id, key, x) => ({ id, faceId: `${key}-face`, matchKey: key, x, y: 0, z: 0, removed: false });

test('Modern AI is the default and preserves existing decisions and memory exactly', () => {
  assert.deepEqual(AI_MODES.map(mode => mode.label), ['Modern AI', 'Original AI']);
  for (const value of [undefined, null, '', 'obsolete', 1, {}, 'modern']) assert.equal(normalizeAiMode(value), 'modern');
  assert.equal(normalizeAiMode('original'), 'original');
  const tiles = [tile('a', 'A', 0), tile('b', 'B', 1), tile('c', 'A', 2), tile('d', 'D', 3)];
  for (const aiMode of [undefined, 'modern']) for (let seed = 0; seed < 100; seed++) {
    const game = { tiles, seed, aiMode, attempts: 3, aiAttempts: 2,
      aiMemory: { a: { key: 'A', turn: 3 }, c: { key: 'A', turn: 4 }, d: { key: 'D', turn: 0 } } };
    assert.deepEqual(playOpponentTurn(game), playGhostTurn(tiles, game.aiMemory, seed + 2 * 97 + 3 * 13, 5));
    assert.deepEqual(rememberOpponentFaces(game, ['b']), rememberGhostFaces(tiles, game.aiMemory, ['b'], 5));
    assert.deepEqual(advanceOpponentMemory(game), rememberGhostFaces(tiles, game.aiMemory, [], 5));
  }
});

test('Original records both players immediately, then decays after matches, misses and Freeze attempts', () => {
  const tiles = Array.from({ length: 16 }, (_, i) => tile(`t${i}`, i < 2 ? 'pair' : `K${i}`, i));
  for (const actor of ['you', 'ai']) for (const kind of ['match', 'miss', 'freeze']) {
    if (kind === 'freeze' && actor === 'ai') continue;
    let deleted = 0;
    for (let seed = 0; seed < 150; seed++) {
      let game = { ...createDuelState(), mode: 'duel', aiMode: 'original', seed, tiles,
        turn: actor, freezeReady: kind === 'freeze', aiMemory: { t15: { key: 'K15', turn: 0 } } };
      const ids = kind === 'match' ? ['t0', 't1'] : ['t2', 't3'];
      for (const id of ids) {
        game = { ...game, aiMemory: rememberOpponentFaces(game, [id]) };
        assert.ok(game.aiMemory[id], 'each actual flip is logged before resolution');
        assert.ok(game.aiMemory.t15, 'revealing a face does not trigger decay');
      }
      const resolved = resolveDuelAttempt(game, ids);
      assert.equal(resolved.attempts + resolved.aiAttempts, 1);
      const memory = advanceOpponentMemory(resolved);
      if (!memory.t15) deleted++;
      if (kind === 'match') {
        assert.equal(resolved.turn, actor);
        for (const id of ids) assert.equal(Object.hasOwn(memory, id), false, 'removed tile records are pruned');
      } else if (kind === 'freeze') assert.equal(resolved.turn, 'you');
      else assert.notEqual(resolved.turn, actor);
    }
    assert.ok(deleted > 20 && deleted < 60, `${actor} ${kind} decays records even without a handoff: ${deleted}/150`);
  }
});

test('both opponents finish shared-board duels with human reveals and shuffle resets', () => {
  for (const aiMode of ['modern', 'original']) for (const ruleset of ['eastern', 'western']) {
    let game = { ...createGame(ruleset, 48, 'calm'), ...createDuelState(), mode: 'duel', aiMode, aiMemory: {} };
    let moves = 0, shuffles = 0;
    while (remainingCount(game.tiles) && moves < 1600) {
      if (!getAvailablePairs(game.tiles).length) {
        game = { ...game, tiles: shuffleBoard(game.tiles, 1000 + moves).tiles, aiMemory: {} };
        shuffles++;
      }
      // Force one manual shuffle after observations have accumulated, too.
      if (moves === 3) {
        game = { ...game, tiles: shuffleBoard(game.tiles, 203).tiles, aiMemory: {} };
        shuffles++;
        assert.deepEqual(rememberOpponentFaces(game, []), {}, 'shuffle cannot restore prior positions');
      }
      const free = game.tiles.filter(value => isFree(value, game.tiles));
      const ids = game.turn === 'ai' ? playOpponentTurn(game).flippedIds
        : [free[moves % free.length].id, free[(moves + 1) % free.length].id];
      assert.equal(ids.length, 2);
      for (const id of ids) assert.ok(isFree(game.tiles.find(value => value.id === id), game.tiles));
      for (const id of ids) game = { ...game, aiMemory: rememberOpponentFaces(game, [id]) };
      const resolved = resolveDuelAttempt(game, ids);
      assert.notEqual(resolved, game, 'both actors submit legal attempts');
      game = { ...resolved, aiMemory: advanceOpponentMemory(resolved) };
      moves++;
    }
    assert.equal(remainingCount(game.tiles), 0, `${aiMode} ${ruleset} finishes after ${moves} attempts`);
    assert.equal(game.score + game.aiScore, 4000);
    assert.deepEqual(game.aiMemory, {});
    assert.ok(shuffles >= 1);
  }
});
