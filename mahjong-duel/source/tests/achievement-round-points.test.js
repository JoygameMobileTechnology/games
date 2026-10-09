import test from 'node:test';
import assert from 'node:assert/strict';
import { ACHIEVEMENTS, ACHIEVEMENT_POINTS_MAX, ACHIEVEMENT_REWARDS_VERSION, achievementById, evaluateAchievements, V4_ACHIEVEMENT_POINTS } from '../src/achievements.js';
import { ACHIEVEMENT_FAMILIES, achievementFamilyProgress } from '../src/achievement-milestones.js';
import { createProgression, normalizeProgression, loadProgression, saveProgression, AP_REBALANCE_BACKUP_KEY, PROGRESSION_STORAGE_KEY } from '../src/progression.js';

const NOW = Date.UTC(2026, 9, 9, 15);
const v3Save = () => ({ ...createProgression({ seed: 42 }), achievementRewardsVersion: 3 });
function storage() {
  const values = new Map();
  return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test('every prospective reward is a fixed round amount with increasing tiers', () => {
  for (const item of ACHIEVEMENTS) {
    assert.ok(item.points > 0 && item.points % 50 === 0, `${item.id}: ${item.points}`);
  }
  assert.equal(ACHIEVEMENT_POINTS_MAX, 7500);
  for (const family of ACHIEVEMENT_FAMILIES) {
    for (let level = 1; level < family.milestones.length; level++) {
      assert.equal(family.milestones[level].points - family.milestones[level - 1].points, 50, family.id);
    }
  }
});

test('v3 historical rewards and zero migration receipts survive the rebalance exactly', () => {
  const source = v3Save();
  source.awardedPoints = { A004: 25, M001: 0, M002: 35, M003: 165, M004: 490, M017: 0, M018: 0, M019: 0, M020: 55, A088: 0, A099: 15 };
  source.unlocked = Object.fromEntries(Object.keys(source.awardedPoints).map((id, index) => [id, NOW - 1000 - index]));
  source.points = Object.values(source.awardedPoints).reduce((sum, value) => sum + value, 0);
  const migrated = normalizeProgression(source, { now: NOW });
  assert.equal(migrated.achievementRewardsVersion, ACHIEVEMENT_REWARDS_VERSION);
  assert.deepEqual(migrated.unlocked, source.unlocked);
  assert.deepEqual(migrated.awardedPoints, source.awardedPoints);
  assert.equal(migrated.points, source.points);
  assert.deepEqual(migrated.newAchievementIds, []);
  const reloaded = normalizeProgression(migrated, { now: NOW + 1 });
  assert.deepEqual(reloaded.awardedPoints, source.awardedPoints);
  assert.equal(reloaded.points, source.points);
});

test('old receipts cannot turn a future 200 AP reward into a clipped 190 AP reward', () => {
  const source = v3Save();
  // A profile earned original and v2 receipts before the v3 level-two and
  // level-three rewards. These 310 AP exceed the new first-three-level total.
  source.awardedPoints = { A001: 5, A002: 5, A005: 40, A006: 60, M001: 0, M002: 35, M003: 165 };
  source.unlocked = Object.fromEntries(Object.keys(source.awardedPoints).map((id, index) => [id, NOW - 1000 - index]));
  source.counters.completedDuels = 99;
  const migrated = normalizeProgression(source, { now: NOW });
  const view = achievementFamilyProgress('completed-duels', migrated);
  assert.equal(view.earnedPoints, 310);
  assert.equal(view.totalPoints - view.earnedPoints, 190);
  assert.equal(view.nextRewardPoints, achievementById.M004.points);
  assert.equal(view.nextRewardPoints, 200);
  assert.equal(view.remainingPoints, 200);

  const ready = { ...migrated, counters: { ...migrated.counters, completedDuels: 100 } };
  const award = evaluateAchievements(ready, NOW + 1, ['M004']);
  assert.equal(award.awardedPoints.M004, 200);
  assert.equal(award.points, migrated.points + 200);
  assert.deepEqual(award.newlyUnlocked, ['M004']);
  const replay = evaluateAchievements({ ...ready, ...award }, NOW + 2, ['M004']);
  assert.equal(replay.points, award.points);
  assert.deepEqual(replay.awardedPoints, award.awardedPoints);
  assert.deepEqual(replay.newlyUnlocked, []);
});

test('v3 to v5 repricing does not silently consume a newly attained milestone', () => {
  const source = v3Save();
  source.counters.completedDuels = achievementById.M003.target;
  source.unlocked = { M001: NOW - 2000, M002: NOW - 1000 };
  source.awardedPoints = { M001: 5, M002: 35 };
  const migrated = normalizeProgression(source, { now: NOW });
  assert.equal(migrated.awardedPoints.M003, achievementById.M003.points);
  assert.equal(migrated.points, 40 + achievementById.M003.points);
  assert.deepEqual(migrated.newAchievementIds, ['M003']);
});

test('loading keeps one untouched pre-rebalance backup and never reapplies old rewards', () => {
  const target = storage();
  const source = v3Save();
  source.unlocked = { M001: NOW - 2000, M002: NOW - 1000, M003: NOW - 500 };
  source.awardedPoints = { M001: 5, M002: 35, M003: 165 };
  source.counters.completedDuels = 35;
  const raw = JSON.stringify(source);
  target.setItem(PROGRESSION_STORAGE_KEY, raw);
  const migrated = loadProgression({ storage: target, now: NOW });
  assert.equal(target.getItem(AP_REBALANCE_BACKUP_KEY), raw);
  assert.equal(saveProgression(migrated, target), true);
  const reloaded = loadProgression({ storage: target, now: NOW + 1 });
  assert.deepEqual(reloaded.awardedPoints, source.awardedPoints);
  assert.equal(reloaded.points, 205);
  assert.equal(target.getItem(AP_REBALANCE_BACKUP_KEY), raw);
  target.setItem(PROGRESSION_STORAGE_KEY, JSON.stringify({ ...source, counters: { ...source.counters, completedDuels: 36 } }));
  loadProgression({ storage: target, now: NOW + 2 });
  assert.equal(target.getItem(AP_REBALANCE_BACKUP_KEY), raw, 'an older client cannot overwrite the original backup');

  const emptyTarget = storage();
  emptyTarget.setItem(PROGRESSION_STORAGE_KEY, JSON.stringify(v3Save()));
  loadProgression({ storage: emptyTarget, now: NOW });
  assert.equal(emptyTarget.getItem(AP_REBALANCE_BACKUP_KEY), null, 'fresh empty profiles do not need a backup');
});


test('the entire v4 catalogue remains earned at its original 4,000 AP after v5 and reload', () => {
  const source = { ...createProgression({ seed: 42 }), achievementRewardsVersion: 4 };
  source.awardedPoints = { ...V4_ACHIEVEMENT_POINTS };
  source.unlocked = Object.fromEntries(Object.keys(source.awardedPoints).map((id, index) => [id, NOW - 1000 - index]));
  source.points = 4000;
  assert.equal(Object.values(source.awardedPoints).reduce((sum, points) => sum + points, 0), 4000);
  const migrated = normalizeProgression(source, { now: NOW });
  assert.deepEqual(migrated.awardedPoints, source.awardedPoints);
  assert.deepEqual(migrated.unlocked, source.unlocked);
  assert.equal(migrated.points, 4000);
  assert.deepEqual(migrated.newAchievementIds, []);
  assert.deepEqual(normalizeProgression(migrated, { now: NOW + 1 }), migrated);
});

test('v4 to v5 repricing awards a newly reached level instead of grandfathering it for zero AP', () => {
  const source = { ...createProgression({ seed: 42 }), achievementRewardsVersion: 4 };
  source.unlocked = { M001: NOW - 2000, M002: NOW - 1000 };
  source.awardedPoints = { M001: 10, M002: 40 };
  source.counters.completedDuels = 35;
  const migrated = normalizeProgression(source, { now: NOW });
  assert.equal(migrated.awardedPoints.M003, 150);
  assert.equal(migrated.points, 200);
  assert.deepEqual(migrated.newAchievementIds, ['M003']);
  assert.deepEqual(normalizeProgression(migrated, { now: NOW + 1 }), migrated);
});
