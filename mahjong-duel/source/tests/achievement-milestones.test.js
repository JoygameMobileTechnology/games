import test from 'node:test';
import assert from 'node:assert/strict';
import { ACHIEVEMENTS, ACHIEVEMENT_POINTS_MAX, ACHIEVEMENT_REWARDS_VERSION, LEGACY_ACHIEVEMENT_POINTS, achievementById, evaluateAchievements } from '../src/achievements.js';
import { ACHIEVEMENT_FAMILIES, ACHIEVEMENT_SHELVES, achievementFamilyProgress, familyForAchievement } from '../src/achievement-milestones.js';
import { createProgression, normalizeProgression, loadProgression, saveProgression, reduceProgression, PROGRESSION_STORAGE_KEY } from '../src/progression.js';
import { createCollection } from '../src/collection.js';
import { themeTileSets } from '../src/tile-data.js';

const NOW = Date.UTC(2026, 8, 29, 12);
const fresh = () => createProgression({ seed: 42 });
const storage = () => {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
};
const oldSave = () => {
  const state = fresh();
  delete state.awardedPoints;
  delete state.achievementRewardsVersion;
  return state;
};

test('all 100 original unlocks belong to exactly one of 43 stable counter families', () => {
  assert.equal(ACHIEVEMENT_FAMILIES.length, 43);
  assert.equal(new Set(ACHIEVEMENT_FAMILIES.map(family => family.id)).size, ACHIEVEMENT_FAMILIES.length);
  const milestones = ACHIEVEMENT_FAMILIES.flatMap(family => family.milestones);
  assert.equal(milestones.length, 100);
  assert.deepEqual(milestones.map(item => item.id).sort(), ACHIEVEMENTS.map(item => item.id).sort());
  for (const family of ACHIEVEMENT_FAMILIES) {
    assert.ok(ACHIEVEMENT_SHELVES.some(shelf => shelf.id === family.shelfId && shelf.name === family.category));
    assert.ok(family.artKey && family.description && family.name);
    for (const milestone of family.milestones) {
      assert.equal(milestone.counterKey, family.counterKey);
      assert.strictEqual(familyForAchievement(milestone.id), family);
      assert.deepEqual({ ...milestone, level: undefined }, { ...achievementById[milestone.id], level: undefined });
    }
  }
  assert.equal(ACHIEVEMENT_FAMILIES.reduce((sum, family) => sum + family.totalPoints, 0), ACHIEVEMENT_POINTS_MAX);
});

test('family levels grow in target and reward; distinct conditional actions remain standalone', () => {
  for (const family of ACHIEVEMENT_FAMILIES) {
    family.milestones.forEach((milestone, index) => {
      assert.equal(milestone.level, index + 1);
      assert.ok(milestone.points >= LEGACY_ACHIEVEMENT_POINTS[milestone.id]);
      if (index) {
        assert.ok(milestone.target > family.milestones[index - 1].target, family.id);
        assert.ok(milestone.points > family.milestones[index - 1].points, family.id);
      }
    });
  }
  assert.notEqual(familyForAchievement('A043').id, familyForAchievement('A044').id);
  assert.notEqual(familyForAchievement('A068').id, familyForAchievement('A069').id);
  assert.notEqual(familyForAchievement('A070').id, familyForAchievement('A071').id);
  for (const id of ['A041', 'A042', 'A043', 'A044', 'A068', 'A069', 'A070', 'A071']) {
    assert.equal(familyForAchievement(id).totalLevels, 1);
  }
});

test('one progress view covers locked, partial, mastered and standalone families', () => {
  let state = fresh();
  let view = achievementFamilyProgress('completed-duels', state);
  assert.equal(view.level, 0);
  assert.equal(view.current, 0);
  assert.equal(view.nextMilestone.id, 'A001');
  assert.equal(view.currentMilestone, null);
  assert.equal(view.progress, 0);
  state.counters.completedDuels = 7;
  state = { ...state, ...evaluateAchievements(state, NOW) };
  view = achievementFamilyProgress('completed-duels', state);
  assert.equal(view.level, 2);
  assert.equal(view.unlockedCount, 2);
  assert.equal(view.currentMilestone.id, 'A002');
  assert.equal(view.nextMilestone.id, 'A003');
  assert.equal(view.current, 7);
  assert.equal(view.target, 10);
  assert.equal(view.progress, 0.7);
  assert.equal(view.earnedPoints, 15);
  assert.equal(view.nextRewardPoints, 15);
  assert.equal(view.remainingPoints, view.totalPoints - 15);
  state.counters.completedDuels = 1200;
  state = { ...state, ...evaluateAchievements(state, NOW + 1) };
  view = achievementFamilyProgress('completed-duels', state);
  assert.equal(view.level, 10);
  assert.equal(view.complete, true);
  assert.equal(view.nextMilestone, null);
  assert.equal(view.nextRewardPoints, 0);
  assert.equal(view.progress, 1);
  assert.equal(view.remainingPoints, 0);
  assert.equal(view.earnedPoints, view.totalPoints);
  state.counters['conditionalWins.noBoosters'] = 1;
  state = { ...state, ...evaluateAchievements(state, NOW + 2) };
  view = achievementFamilyProgress(familyForAchievement('A041'), state);
  assert.equal(view.totalLevels, 1);
  assert.equal(view.complete, true);
  assert.equal(view.currentMilestone.description, achievementById.A041.description);
  assert.equal(familyForAchievement('constructor'), null);
  assert.equal(achievementFamilyProgress('constructor', state), null);
});

test('legacy unlocks retain their AP and timestamps, while the next earned tier uses its new reward', () => {
  const source = oldSave();
  source.counters.completedDuels = 49;
  source.unlocked = { A001: NOW - 4000, A002: NOW - 3000, A003: NOW - 2000, A004: NOW - 1000 };
  source.points = 25;
  source.newAchievementIds = ['A004'];
  source.eventReceipts = { 'earlier-duel:complete': NOW - 1000 };
  source.completedGameIds = ['earlier-duel'];
  const migrated = normalizeProgression(source, { now: NOW });
  assert.equal(migrated.achievementRewardsVersion, ACHIEVEMENT_REWARDS_VERSION);
  assert.equal(migrated.points, 25);
  assert.deepEqual(migrated.awardedPoints, { A001: 5, A002: 5, A003: 5, A004: 10 });
  assert.deepEqual(migrated.eventReceipts, { ...source.eventReceipts, 'starter-boosters:v1': NOW });
  for (const key of ['unlocked', 'counters', 'newAchievementIds', 'completedGameIds']) assert.deepEqual(migrated[key], source[key], key);
  const event = { type: 'complete', eventId: 'next-duel:complete', gameId: 'next-duel', themeId: 'ming-porcelain', rulesetId: 'eastern',
    formationId: 'crown', outcome: 'lose', afterPairs: { you: 14, ai: 16 }, now: NOW + 1 };
  const next = reduceProgression(migrated, event);
  assert.equal(next.awardedPoints.A005, 40);
  assert.equal(next.points, 65);
  assert.equal(next.unlocked.A004, source.unlocked.A004);
  assert.equal(next.unlocked.A005, NOW + 1);
  assert.strictEqual(reduceProgression(next, event), next);
  const view = achievementFamilyProgress('completed-duels', next);
  assert.equal(view.earnedPoints, 65);
  assert.equal(view.milestones[1].awardedPoints, 5);
  assert.equal(view.milestones[1].points, 10);
  const target = storage();
  assert.equal(saveProgression(next, target), true);
  const reloaded = loadProgression({ storage: target, now: NOW + 2 });
  assert.deepEqual(reloaded.awardedPoints, next.awardedPoints);
  assert.deepEqual(reloaded.unlocked, next.unlocked);
  assert.deepEqual(reloaded.counters, next.counters);
  assert.equal(reloaded.points, 65);
});

test('a sparse legacy unlock shows its highest earned level without inventing missing milestones', () => {
  const source = oldSave();
  source.unlocked = { A010: NOW - 1 };
  source.points = 30;
  const state = normalizeProgression(source, { now: NOW });
  const view = achievementFamilyProgress('completed-duels', state);
  assert.equal(view.level, 10);
  assert.equal(view.currentMilestone.level, 10);
  assert.equal(view.unlockedCount, 1);
  assert.equal(view.complete, false);
  assert.equal(view.nextMilestone.id, 'A001');
  assert.equal(view.current, 0);
  assert.equal(view.earnedPoints, 30);
  assert.deepEqual(state.unlocked, source.unlocked);
  assert.deepEqual(state.newAchievementIds, []);
  assert.deepEqual(state.counters, source.counters);
});

test('counter backfill awards missing milestones once and never reprices existing unlocks', () => {
  const source = oldSave();
  source.counters.completedDuels = 10;
  source.unlocked = { A001: NOW - 1000, A002: NOW - 500 };
  source.points = 10;
  const migrated = normalizeProgression(source, { now: NOW });
  assert.deepEqual(migrated.awardedPoints, { A001: 5, A002: 5, A003: 15 });
  assert.equal(migrated.points, 25);
  assert.deepEqual(migrated.newAchievementIds, ['A003']);
  const again = normalizeProgression(migrated, { now: NOW + 1 });
  assert.deepEqual(again, migrated);
  const evaluated = evaluateAchievements(migrated, NOW + 1);
  assert.deepEqual(evaluated.newlyUnlocked, []);
  assert.equal(evaluated.points, 25);
});

test('collection-only backfill grants current rewards and its saved ledger survives reload', () => {
  const counts = Object.fromEntries(Object.values(themeTileSets).flatMap(sets => Object.values(sets).flat()).map(tile => [tile.matchKey, 10]));
  const target = storage();
  const state = loadProgression({ collection: { ...createCollection(), counts }, storage: target, now: NOW });
  assert.equal(Object.keys(state.unlocked).length, 11);
  assert.equal(state.awardedPoints.A077, 10);
  assert.equal(state.awardedPoints.A080, 40);
  assert.equal(state.counters.completedDuels, 0);
  assert.equal(state.counters.personalPairs, 0);
  saveProgression(state, target);
  const reloaded = loadProgression({ storage: target, now: NOW + 1 });
  assert.deepEqual(reloaded.awardedPoints, state.awardedPoints);
  assert.deepEqual(reloaded.unlocked, state.unlocked);
  assert.equal(reloaded.points, state.points);
});

test('the entire completed legacy catalogue keeps exactly 1,465 earned AP after migration', () => {
  const source = oldSave();
  source.unlocked = Object.fromEntries(ACHIEVEMENTS.map(item => [item.id, NOW - 1]));
  source.points = 1465;
  const target = storage();
  target.setItem(PROGRESSION_STORAGE_KEY, JSON.stringify(source));
  const migrated = loadProgression({ storage: target, now: NOW });
  assert.equal(migrated.points, 1465);
  assert.deepEqual(migrated.unlocked, source.unlocked);
  assert.deepEqual(migrated.awardedPoints, LEGACY_ACHIEVEMENT_POINTS);
  assert.deepEqual(migrated.newAchievementIds, []);
  for (const family of ACHIEVEMENT_FAMILIES) assert.equal(achievementFamilyProgress(family, migrated).complete, true);
  saveProgression(migrated, target);
  assert.equal(loadProgression({ storage: target, now: NOW + 1 }).points, 1465);
});

test('ledger validation rejects invented, malformed and unearned points without resetting legitimate history', () => {
  const source = fresh();
  source.unlocked = { A001: NOW, A002: NOW, A003: NOW, A004: NOW, A005: -1 };
  source.awardedPoints = JSON.parse('{"A001":9999,"A002":10,"A003":-5,"A004":10,"A005":40,"A010":200,"constructor":1000,"__proto__":1000}');
  source.points = 99999;
  const state = normalizeProgression(source, { now: NOW });
  assert.deepEqual(state.awardedPoints, { A001: 5, A002: 10, A003: 5, A004: 10 });
  assert.equal(state.points, 30);
  assert.deepEqual(Object.keys(state.unlocked), ['A001', 'A002', 'A003', 'A004']);
  assert.equal(Object.getPrototypeOf(state.awardedPoints), Object.prototype);
});
