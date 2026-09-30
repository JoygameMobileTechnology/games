import test from 'node:test';
import assert from 'node:assert/strict';
import { rankGainForWin, createRanking, normalizeRanking, advanceRanking } from '../src/leaderboards.js';

test('victories make large early jumps that taper toward the top', () => {
  for (const [position, gain] of [[10000, 1500], [8500, 1175], [5000, 530], [1000, 47], [100, 2], [10, 1], [2, 1], [1, 0]]) {
    assert.equal(rankGainForWin(position), gain, `gain at #${position}`);
  }
  let previousGain = 0;
  for (let position = 1; position <= 10000; position++) {
    const gain = rankGainForWin(position);
    assert.ok(Number.isInteger(gain) && gain >= previousGain, 'approaching first never increases the jump');
    assert.ok(gain < position, 'a win cannot move past first');
    if (position > 1) assert.ok(gain >= 1, 'every win below first advances');
    previousGain = gain;
  }
});

test('new curve applies to future victories without recalculating a saved rank', () => {
  const saved = normalizeRanking({ ...createRanking(42), position: 9800 }, 1);
  assert.equal(saved.position, 9800);
  const { ranking, presentation } = advanceRanking(saved, { outcome: 'win', wins: 2, eventId: 'next:complete', gameId: 'next' });
  assert.equal(ranking.position, 8345);
  assert.equal(presentation.previousPosition, 9800);
  assert.equal(presentation.position, 8345);
  assert.equal(presentation.improved, true);
  for (const outcome of ['tie', 'lose']) {
    assert.equal(advanceRanking(saved, { outcome, wins: 1 }).ranking.position, 9800);
  }
});
