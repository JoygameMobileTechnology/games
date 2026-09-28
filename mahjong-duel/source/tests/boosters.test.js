import test from 'node:test';
import assert from 'node:assert/strict';
import { restoreBoosters, useBooster, canUseBooster, advanceBoosterEffects } from '../src/boosters.js';
import { createDuelState, resolveDuelAttempt, getDuelOutcome } from '../src/duel.js';
import { isFree, canMatch } from '../src/engine.js';
import { boardMetrics, tilePosition } from '../src/table-layout.js';

const tile = (id, matchKey, x, z = 0) => ({ id, matchKey, x, y: 0, z, removed: false });
const game = () => restoreBoosters({ mode: 'duel', ...createDuelState(), boosters: { shuffle: 2, hint: 2, freeze: 2, eagle: 2 }, tiles: [tile('a', 'A', 0), tile('b', 'A', 1), tile('c', 'C', 2), tile('d', 'C', 3)], aiMemory: {} });

test('provided earned booster inventory is player-only and cannot overspend', () => {
  const first = game();
  assert.deepEqual(first.boosters, { shuffle: 2, hint: 2, freeze: 2, eagle: 2 });
  for (const id of Object.keys(first.boosters)) {
    assert.equal(useBooster({ ...first, turn: 'ai' }, id).boosters[id], 2);
    const used = useBooster(first, id);
    assert.equal(used.boosters[id], 1);
    assert.equal(first.boosters[id], 2);
    const empty = { ...first, boosters: { ...first.boosters, [id]: 0 } };
    assert.equal(canUseBooster(empty, id), false);
    assert.strictEqual(useBooster(empty, id), empty);
  }
});

test('restoring earned booster charges preserves safe counts without a refill or arbitrary cap', () => {
  const first = game();
  assert.deepEqual(restoreBoosters({ ...first, boosters: { shuffle: 0, hint: 2, freeze: 3, eagle: 19 } }).boosters,
    { shuffle: 0, hint: 2, freeze: 3, eagle: 19 }, 'existing games do not refill on reload');
  assert.deepEqual(restoreBoosters({ ...first, boosters: { shuffle: -1, hint: 21, freeze: 2.5 } }).boosters,
    { shuffle: 0, hint: 21, freeze: 0, eagle: 0 });
});

test('Hint picks a legal exact pair without revealing faces or changing ghost memory and expires at 1.5s', () => {
  const first = game();
  const hinted = useBooster(first, 'hint');
  assert.equal(hinted.hintEffect.remainingMs, 1500);
  const pair = hinted.hintEffect.ids.map(id => first.tiles.find(tile => tile.id === id));
  assert.ok(pair.every(tile => isFree(tile, first.tiles)) && canMatch(...pair));
  assert.strictEqual(hinted.tiles, first.tiles); assert.strictEqual(hinted.aiMemory, first.aiMemory);
  assert.strictEqual(useBooster(hinted, 'hint'), hinted);
  assert.equal(advanceBoosterEffects(hinted, 1499).hintEffect.remainingMs, 1);
  assert.equal(advanceBoosterEffects(hinted, 1500).hintEffect, null);
  const blocked = { ...first, boosters: { shuffle: 2, hint: 2, freeze: 2, eagle: 2 }, tiles: [tile('a', 'A', 0), tile('b', 'A', 0, 1)] };
  assert.strictEqual(useBooster(blocked, 'hint'), blocked, 'no pair means no charge');
});

test('Eagle Eye lasts ten seconds without teaching identities, cannot stack and resumes remaining duration', () => {
  const first = game(), lit = useBooster(first, 'eagle');
  assert.equal(lit.eagleMs, 10000); assert.strictEqual(lit.aiMemory, first.aiMemory);
  assert.strictEqual(useBooster(lit, 'eagle'), lit);
  const saved = restoreBoosters(JSON.parse(JSON.stringify(advanceBoosterEffects(lit, 4300))));
  assert.equal(saved.eagleMs, 5700); assert.equal(saved.boosters.eagle, 1);
  assert.equal(advanceBoosterEffects(saved, 5700).eagleMs, 0);
});

test('Freeze survives matches, skips precisely the next ghost handoff and never gives points for a miss', () => {
  const first = useBooster(game(), 'freeze');
  assert.strictEqual(useBooster(first, 'freeze'), first);
  const match = resolveDuelAttempt(first, ['a', 'b']);
  assert.equal(match.freezeReady, true); assert.equal(match.score, 100); assert.equal(match.turn, 'you');
  const miss = resolveDuelAttempt(first, ['a', 'c']);
  assert.equal(miss.freezeReady, false); assert.equal(miss.score, 0); assert.equal(miss.turn, 'you');
  assert.equal(miss.attempts, 1); assert.equal(miss.aiAttempts, 0); assert.strictEqual(miss.tiles, first.tiles);
  assert.equal(resolveDuelAttempt(miss, ['a', 'c']).turn, 'ai');
  assert.equal(canUseBooster(miss, 'freeze'), true);
});

test('21 pairs secures a lead without ending the remaining board', () => {
  const first = { ...game(), score: 2100, aiScore: 1800 };
  assert.equal(getDuelOutcome(first), null);
  assert.equal(getDuelOutcome({ ...first, tiles: first.tiles.map(tile => ({ ...tile, removed: true })) }), 'win');
});

test('close-up projection includes every layer and remains stable when pairs are removed', () => {
  const tiles = [tile('a', 'A', 0, 4), { ...tile('b', 'B', 5), y: 7 }];
  const metrics = boardMetrics(tiles);
  assert.deepEqual(boardMetrics(tiles.map(tile => ({ ...tile, removed: true }))), metrics);
  for (const tile of tiles) {
    const style = tilePosition(tile, metrics);
    assert.ok(parseFloat(style.left) >= 0 && parseFloat(style.top) >= 0);
    assert.ok(parseFloat(style.left) + parseFloat(style.width) <= 100);
    assert.ok(parseFloat(style.top) + parseFloat(style.height) <= 100);
    assert.ok(Math.abs(parseFloat(style.height) * metrics.height / (parseFloat(style.width) * metrics.width) - 1.3) < 1e-8);
  }
});

test('fresh games without an earned wallet receive no testing stock', () => {
  const { boosters, ...plain } = game();
  assert.deepEqual(restoreBoosters(plain).boosters, { shuffle: 0, hint: 0, freeze: 0, eagle: 0 });
  assert.deepEqual(restoreBoosters({ ...plain, boosters: { hint: 5000, shuffle: Number.MAX_SAFE_INTEGER, eagle: Infinity, freeze: 1.5 } }).boosters, { hint: 5000, shuffle: Number.MAX_SAFE_INTEGER, eagle: 0, freeze: 0 });
});
