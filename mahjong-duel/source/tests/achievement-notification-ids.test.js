import test from 'node:test';
import assert from 'node:assert/strict';
import { newAchievementNotificationIds } from '../src/achievement-notification-ids.js';
import { createProgression, normalizeProgression, reduceProgression } from '../src/progression.js';

const NOW = Date.UTC(2026, 9, 9, 12);
const oldSave = () => {
  const state = createProgression({ seed: 42 });
  state.achievementRewardsVersion = 2;
  state.counters.completedDuels = 34;
  state.unlocked = { A001: NOW - 4, A002: NOW - 3, A003: NOW - 2, A004: NOW - 1 };
  state.awardedPoints = { A001: 5, A002: 10, A003: 15, A004: 25 };
  return state;
};

test('migration receipts and remapped pending achievements never become fresh notifications', () => {
  const previous = oldSave();
  previous.newAchievementIds = ['A003', 'A004'];
  const next = normalizeProgression(previous, { now: NOW });
  assert.ok(Object.hasOwn(next.unlocked, 'M001'));
  assert.ok(Object.hasOwn(next.unlocked, 'M002'));
  assert.deepEqual(next.newAchievementIds, ['M002']);
  assert.deepEqual(newAchievementNotificationIds(previous, next), []);
});

test('a real post-migration milestone is announced once despite older pending achievements', () => {
  const source = oldSave();
  source.newAchievementIds = ['A004'];
  const previous = normalizeProgression(source, { now: NOW });
  const next = reduceProgression(previous, {
    type: 'complete', eventId: 'duel35:complete', gameId: 'duel35', themeId: 'ming-porcelain',
    rulesetId: 'eastern', formationId: 'crown', outcome: 'lose', afterPairs: { you: 14, ai: 16 }, now: NOW + 1,
  });
  assert.equal(next.awardedPoints.M003, 150);
  assert.deepEqual(newAchievementNotificationIds(previous, next), ['M003']);
  assert.deepEqual(newAchievementNotificationIds(next, next), []);
});

test('pending legacy IDs suppress their mapped current level and candidates must be earned', () => {
  const previous = { unlocked: {}, newAchievementIds: ['A004'] };
  const next = { unlocked: { M002: NOW, M003: NOW }, newAchievementIds: ['M002', 'M003', 'M003', 'M004', 'unknown'] };
  assert.deepEqual(newAchievementNotificationIds(previous, next), ['M003']);
});
