import test from 'node:test';
import assert from 'node:assert/strict';
import { ACHIEVEMENTS, ACHIEVEMENT_POINTS_MAX, ACHIEVEMENT_REWARDS_VERSION, THEME_ACHIEVEMENTS_VERSION, FOUR_LEVEL_TRACKS, LEGACY_ACHIEVEMENT_POINTS, PREVIOUS_ACHIEVEMENTS, activeAchievementIdFor, achievementById, evaluateAchievements } from '../src/achievements.js';
import { ACHIEVEMENT_FAMILIES, ACHIEVEMENT_SHELVES, achievementFamilyProgress, familyForAchievement } from '../src/achievement-milestones.js';
import { createProgression, normalizeProgression, loadProgression, saveProgression, reduceProgression, PROGRESSION_STORAGE_KEY, ACHIEVEMENT_MIGRATION_BACKUP_KEY, THEME_EDITION_MIGRATION_BACKUP_KEY } from '../src/progression.js';
import { createCollection } from '../src/collection.js';
import { themeTileSets } from '../src/tile-data.js';

const NOW = Date.UTC(2026, 9, 9, 12);
const fresh = () => createProgression({ seed: 42 });
const storage = () => {
  const values = new Map();
  return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
};
const oldSave = (version = 1) => {
  const state = fresh();
  delete state.themeAchievementsVersion;
  if (version === 1) { delete state.awardedPoints; delete state.achievementRewardsVersion; }
  else state.achievementRewardsVersion = version;
  return state;
};
const historicalReceipts = state => Object.fromEntries(Object.entries(state.unlocked).filter(([id]) => id.startsWith('A')));
const completion = (id, now = NOW + 1) => ({ type: 'complete', eventId: `${id}:complete`, gameId: id, themeId: 'ming-porcelain', rulesetId: 'eastern',
  formationId: 'crown', outcome: 'lose', afterPairs: { you: 14, ai: 16 }, now });

test('74 active milestones belong to 43 stable families with a round 7,500 AP catalogue', () => {
  assert.equal(ACHIEVEMENT_FAMILIES.length, 43);
  assert.equal(new Set(ACHIEVEMENT_FAMILIES.map(family => family.id)).size, 43);
  const milestones = ACHIEVEMENT_FAMILIES.flatMap(family => family.milestones);
  assert.equal(milestones.length, 74);
  assert.deepEqual(milestones.map(item => item.id).sort(), ACHIEVEMENTS.map(item => item.id).sort());
  for (const family of ACHIEVEMENT_FAMILIES) {
    assert.ok(ACHIEVEMENT_SHELVES.some(shelf => shelf.id === family.shelfId && shelf.name === family.category));
    assert.ok(family.artKey && family.description && family.name);
    assert.ok(family.totalLevels <= 4, family.id);
    assert.equal(family.totalPoints, family.milestones.reduce((sum, item) => sum + item.points, 0));
    for (const milestone of family.milestones) {
      assert.equal(milestone.counterKey, family.counterKey);
      assert.strictEqual(familyForAchievement(milestone.id), family);
      assert.deepEqual({ ...milestone, level: undefined }, { ...achievementById[milestone.id], level: undefined });
    }
  }
  assert.equal(ACHIEVEMENT_POINTS_MAX, 7500);
  assert.equal(ACHIEVEMENT_FAMILIES.reduce((sum, family) => sum + family.totalPoints, 0), ACHIEVEMENT_POINTS_MAX);
});

test('the six longer tracks keep four progressively wider levels with rising round rewards', () => {
  const expected = {
    completedDuels: [1, 10, 35, 100], completedWins: [1, 5, 20, 60], personalPairs: [10, 150, 600, 1800],
    bestPairChain: [2, 4, 7, 12], distinctCollectedMatchKeys: [10, 35, 80, 160], distinctLoginDayIds: [1, 7, 21, 60],
  };
  assert.equal(FOUR_LEVEL_TRACKS.length, 6);
  for (const family of ACHIEVEMENT_FAMILIES) {
    const previous = PREVIOUS_ACHIEVEMENTS.filter(item => familyForAchievement(item.id)?.id === family.id);
    if (previous.length > 4) {
      assert.equal(family.totalLevels, 4);
      const targets = family.milestones.map(item => item.target);
      assert.deepEqual(targets, expected[family.counterKey]);
      const gaps = targets.slice(1).map((target, index) => target - targets[index]);
      assert.ok(gaps[1] > gaps[0] && gaps[2] > gaps[1], family.id);
    } else assert.deepEqual(family.milestones.map(item => item.id), previous.map(item => item.id));
    family.milestones.forEach((milestone, index) => {
      assert.equal(milestone.level, index + 1);
      if (index) {
        assert.ok(milestone.target > family.milestones[index - 1].target, family.id);
        assert.ok(milestone.points > family.milestones[index - 1].points, family.id);
      }
    });
  }
  for (const id of ['A041', 'A042', 'A043', 'A044', 'A068', 'A069', 'A070', 'A071']) assert.equal(familyForAchievement(id).totalLevels, 1);
});

test('fresh progress presents locked, partial, mastered and standalone families honestly', () => {
  let state = fresh();
  let view = achievementFamilyProgress('completed-duels', state);
  assert.equal(view.level, 0);
  assert.equal(view.nextMilestone.id, 'M001');
  assert.equal(view.currentMilestone, null);
  state.counters.completedDuels = 12;
  state = { ...state, ...evaluateAchievements(state, NOW) };
  view = achievementFamilyProgress('completed-duels', state);
  assert.equal(view.level, 2);
  assert.equal(view.unlockedCount, 2);
  assert.equal(view.currentMilestone.id, 'M002');
  assert.equal(view.nextMilestone.id, 'M003');
  assert.equal(view.target, 35);
  assert.equal(view.progress, 12 / 35);
  assert.equal(view.earnedPoints, 150);
  assert.equal(view.nextRewardPoints, 150);
  assert.equal(view.remainingPoints, view.totalPoints - 150);
  state.counters.completedDuels = 100;
  state = { ...state, ...evaluateAchievements(state, NOW + 1) };
  view = achievementFamilyProgress('completed-duels', state);
  assert.equal(view.level, 4);
  assert.equal(view.complete, true);
  assert.equal(view.nextMilestone, null);
  assert.equal(view.progress, 1);
  assert.equal(view.remainingPoints, 0);
  assert.equal(view.earnedPoints, 500);
  state.counters['conditionalWins.noBoosters'] = 1;
  state = { ...state, ...evaluateAchievements(state, NOW + 2) };
  assert.equal(achievementFamilyProgress(familyForAchievement('A041'), state).complete, true);
  assert.equal(familyForAchievement('constructor'), null);
  assert.equal(achievementFamilyProgress('constructor', state), null);
});

test('original pre-ledger saves retain earned AP, timestamps and receipts without migration payouts', () => {
  const source = oldSave();
  source.counters.completedDuels = 49;
  source.unlocked = { A001: NOW - 4000, A002: NOW - 3000, A003: NOW - 2000, A004: NOW - 1000 };
  source.points = 25;
  source.newAchievementIds = ['A003', 'A004'];
  source.eventReceipts = { 'earlier-duel:complete': NOW - 1000 };
  source.completedGameIds = ['earlier-duel'];
  const migrated = normalizeProgression(source, { now: NOW });
  assert.equal(migrated.achievementRewardsVersion, ACHIEVEMENT_REWARDS_VERSION);
  assert.equal(migrated.points, 25);
  assert.deepEqual(historicalReceipts(migrated), source.unlocked);
  assert.deepEqual(migrated.awardedPoints, { A001: 5, A002: 5, A003: 5, A004: 10, M001: 0, M002: 0, M003: 0 });
  assert.deepEqual(migrated.newAchievementIds, ['M002'], 'legacy pending levels collapse into one active notification');
  for (const key of ['counters', 'completedGameIds']) assert.deepEqual(migrated[key], source[key]);
  assert.equal(migrated.eventReceipts['earlier-duel:complete'], source.eventReceipts['earlier-duel:complete']);
  assert.equal(migrated.unlocked.M001, source.unlocked.A001);
  assert.equal(migrated.unlocked.M002, source.unlocked.A003);
  const view = achievementFamilyProgress('completed-duels', migrated);
  assert.equal(view.level, 3);
  assert.equal(view.earnedPoints, 25);
  assert.equal(view.milestones.reduce((sum, item) => sum + item.awardedPoints, 0), 25);
  assert.equal(view.nextRewardPoints, 200);
  assert.equal(view.remainingPoints, 200);
});

test('v2 reward receipts survive; only the next new threshold awards AP and cannot replay', () => {
  const source = oldSave(2);
  source.counters.completedDuels = 34;
  source.unlocked = { A001: NOW - 4000, A002: NOW - 3000, A003: NOW - 2000, A004: NOW - 1000 };
  source.awardedPoints = { A001: 5, A002: 10, A003: 15, A004: 25 };
  const migrated = normalizeProgression(source, { now: NOW });
  assert.equal(migrated.points, 55);
  assert.deepEqual(migrated.newAchievementIds, []);
  const event = completion('next-duel');
  const next = reduceProgression(migrated, event);
  assert.equal(next.points, 205);
  assert.equal(next.awardedPoints.M003, 150);
  assert.equal(next.unlocked.M003, NOW + 1);
  assert.deepEqual(historicalReceipts(next), source.unlocked);
  assert.ok(!Object.hasOwn(next.unlocked, 'A005'), 'retired levels never award again');
  assert.strictEqual(reduceProgression(next, event), next);
  const target = storage();
  saveProgression(next, target);
  const reloaded = loadProgression({ storage: target, now: NOW + 2 });
  assert.deepEqual(reloaded.unlocked, next.unlocked);
  assert.deepEqual(reloaded.awardedPoints, next.awardedPoints);
  assert.equal(reloaded.points, 205);
});

test('sparse highest legacy receipt retains mastery without inventing counters or more AP', () => {
  const source = oldSave();
  source.unlocked = { A010: NOW - 1 };
  const state = normalizeProgression(source, { now: NOW });
  const view = achievementFamilyProgress('completed-duels', state);
  assert.equal(view.level, 4);
  assert.equal(view.unlockedCount, 4);
  assert.equal(view.complete, true);
  assert.equal(view.current, 0);
  assert.equal(view.earnedPoints, 30);
  assert.equal(state.points, 30);
  for (const id of ['M001', 'M002', 'M003', 'M004']) {
    assert.equal(state.unlocked[id], NOW - 1);
    assert.equal(state.awardedPoints[id], 0);
  }
  assert.deepEqual(state.counters, source.counters);
  assert.deepEqual(state.newAchievementIds, []);
  assert.deepEqual(historicalReceipts(state), source.unlocked);
});

test('counter-only historical progress becomes earned new levels with no AP windfall and no repeated migration', () => {
  const source = oldSave(2);
  source.counters.completedDuels = 10;
  const migrated = normalizeProgression(source, { now: NOW });
  assert.equal(migrated.points, 0);
  assert.deepEqual(migrated.awardedPoints, { M001: 0, M002: 0 });
  assert.deepEqual(migrated.newAchievementIds, []);
  assert.deepEqual(normalizeProgression(migrated, { now: NOW + 1 }), migrated);
  migrated.counters.completedDuels = 35;
  const evaluated = evaluateAchievements(migrated, NOW + 1);
  assert.deepEqual(evaluated.newlyUnlocked, ['M003']);
  assert.equal(evaluated.points, 150);
});

test('collection-only import earns the ten current collection milestones and survives reload', () => {
  const counts = Object.fromEntries(Object.values(themeTileSets).flatMap(sets => Object.values(sets).flat()).map(tile => [tile.matchKey, 10]));
  const target = storage();
  const state = loadProgression({ collection: { ...createCollection(), counts }, storage: target, now: NOW });
  assert.equal(Object.keys(state.unlocked).length, 10);
  assert.equal(state.awardedPoints.M018, 100);
  assert.equal(state.awardedPoints.M020, 200);
  assert.equal(state.counters.completedDuels, 0);
  saveProgression(state, target);
  const reloaded = loadProgression({ storage: target, now: NOW + 1 });
  assert.deepEqual(reloaded.awardedPoints, state.awardedPoints);
  assert.deepEqual(reloaded.unlocked, state.unlocked);
  assert.equal(reloaded.points, state.points);
});

test('fully completed original and v2 catalogues preserve 1,465 / 3,730 AP and every mastered family', () => {
  for (const [version, total] of [[1, 1465], [2, 3730]]) {
    const source = oldSave(version);
    source.unlocked = Object.fromEntries(PREVIOUS_ACHIEVEMENTS.map(item => [item.id, NOW - 1]));
    if (version === 2) source.awardedPoints = Object.fromEntries(PREVIOUS_ACHIEVEMENTS.map(item => [item.id, item.points]));
    const migrated = normalizeProgression(source, { now: NOW });
    assert.equal(migrated.points, total);
    assert.deepEqual(historicalReceipts(migrated), source.unlocked);
    assert.deepEqual(migrated.newAchievementIds, []);
    for (const family of ACHIEVEMENT_FAMILIES) assert.equal(achievementFamilyProgress(family, migrated).complete, true);
    assert.equal(normalizeProgression(migrated, { now: NOW + 1 }).points, total);
  }
});

test('legacy notification IDs resolve to valid current families and dedupe into active levels', () => {
  for (const previous of PREVIOUS_ACHIEVEMENTS) {
    const current = activeAchievementIdFor(previous.id);
    assert.ok(ACHIEVEMENTS.some(item => item.id === current));
    assert.strictEqual(familyForAchievement(previous.id), familyForAchievement(current));
  }
  assert.equal(activeAchievementIdFor('A010'), 'M004');
  assert.equal(activeAchievementIdFor('A004'), 'M002');
  assert.equal(activeAchievementIdFor('constructor'), null);
});

test('ledger rejects invented/malformed rewards while preserving both generations of valid receipts', () => {
  const source = oldSave(2);
  source.unlocked = { A001: NOW, A002: NOW, A003: NOW, A004: NOW, A005: -1 };
  source.awardedPoints = JSON.parse('{"A001":9999,"A002":10,"A003":-5,"A004":10,"A005":40,"A010":200,"constructor":1000,"__proto__":1000}');
  const state = normalizeProgression(source, { now: NOW });
  assert.equal(state.points, 30);
  assert.deepEqual(historicalReceipts(state), { A001: NOW, A002: NOW, A003: NOW, A004: NOW });
  assert.deepEqual(state.awardedPoints, { A001: 5, A002: 10, A003: 5, A004: 10, M001: 0, M002: 0 });
  assert.equal(Object.getPrototypeOf(state.awardedPoints), Object.prototype);
});

test('loading an established old save keeps its raw rollback backup once and never overwrites it', () => {
  const source = oldSave(2), target = storage();
  source.counters.completedDuels = 10;
  source.unlocked = { A001: NOW - 1 };
  source.awardedPoints = { A001: 5 };
  const raw = JSON.stringify(source, null, 2);
  target.setItem(PROGRESSION_STORAGE_KEY, raw);
  const state = loadProgression({ storage: target, now: NOW });
  assert.equal(target.getItem(ACHIEVEMENT_MIGRATION_BACKUP_KEY), raw);
  saveProgression(state, target);
  loadProgression({ storage: target, now: NOW + 1 });
  assert.equal(target.getItem(ACHIEVEMENT_MIGRATION_BACKUP_KEY), raw);
  source.counters.completedDuels = 35;
  target.setItem(PROGRESSION_STORAGE_KEY, JSON.stringify(source));
  loadProgression({ storage: target, now: NOW + 2 });
  assert.equal(target.getItem(ACHIEVEMENT_MIGRATION_BACKUP_KEY), raw);
});

test('backup skips empty/current profiles and unavailable backup storage cannot prevent migration', () => {
  for (const state of [oldSave(), fresh()]) {
    const target = storage();
    target.setItem(PROGRESSION_STORAGE_KEY, JSON.stringify(state));
    loadProgression({ storage: target, now: NOW });
    assert.equal(target.getItem(ACHIEVEMENT_MIGRATION_BACKUP_KEY), null);
  }
  const source = oldSave();
  source.unlocked = { A010: NOW - 1 };
  const blocked = { getItem: key => key === PROGRESSION_STORAGE_KEY ? JSON.stringify(source) : null, setItem() { throw Error('quota'); } };
  assert.equal(loadProgression({ storage: blocked, now: NOW }).points, 30);
});


test('theme achievements replace edition choices with an attainable cultural journey', () => {
  assert.equal(familyForAchievement('A088').name, 'Across Continents');
  assert.equal(familyForAchievement('A099').name, 'Grand Tour');
  assert.equal(familyForAchievement('A100').name, 'Grand Tour');
  assert.notEqual(achievementById.A088.counterKey, achievementById.A099.counterKey);
  assert.deepEqual(familyForAchievement('A099').milestones.map(item => item.target), [2, 4]);
  assert.match(achievementById.A088.description, /Ming Porcelain or Dancheong.*Stained Glass or Dutch Golden Age/);
  for (const definition of ACHIEVEMENTS) assert.doesNotMatch(definition.description, /both editions|theme and ruleset/);
  assert.deepEqual(familyForAchievement('M017').milestones.map(item => item.target), [10, 35, 80, 160]);
});

test('old edition history converts by theme identity, preserves AP and silently grandfathers new goals', () => {
  const source = oldSave(3);
  source.sets.distinctCompletedThemeRulesetCombinations = ['ming-porcelain:western', 'dancheong:western'];
  source.sets.distinctCompletedRulesetIds = ['western'];
  source.unlocked = { M001: NOW - 1000 };
  source.awardedPoints = { M001: 5 };
  source.counters.completedDuels = 2;
  const migrated = normalizeProgression(source, { now: NOW });
  assert.equal(migrated.themeAchievementsVersion, THEME_ACHIEVEMENTS_VERSION);
  assert.deepEqual(migrated.sets.distinctCompletedThemeIds, ['ming-porcelain', 'dancheong']);
  assert.deepEqual(migrated.sets.distinctCompletedCulturalRegions, ['east-asia']);
  assert.deepEqual(migrated.sets.distinctCompletedThemeRulesetCombinations, source.sets.distinctCompletedThemeRulesetCombinations);
  assert.equal(migrated.unlocked.A088, undefined);
  assert.equal(migrated.awardedPoints.A099, 0);
  assert.equal(migrated.points, 5);
  assert.deepEqual(migrated.newAchievementIds, []);
  assert.deepEqual(normalizeProgression(migrated, { now: NOW + 1 }), migrated);
  const third = reduceProgression(migrated, { ...completion('glass'), themeId: 'stained-glass', rulesetId: 'western' });
  assert.equal(third.awardedPoints.A088, 150);
  assert.equal(third.points, 155);
  assert.deepEqual(third.newAchievementIds, ['A088']);
  const fourth = reduceProgression(third, { ...completion('dutch'), themeId: 'dutch-golden-age', rulesetId: 'western' });
  assert.equal(fourth.awardedPoints.A100, 100);
  assert.equal(fourth.points, 255);
});

test('past edition achievements remain earned even if the new theme condition was not reached', () => {
  const source = oldSave(3);
  source.sets.distinctCompletedThemeRulesetCombinations = ['ming-porcelain:eastern', 'ming-porcelain:western'];
  source.sets.distinctCompletedRulesetIds = ['eastern', 'western'];
  source.unlocked = { A088: NOW - 2000, A099: NOW - 1000, A100: NOW - 500 };
  source.awardedPoints = { A088: 10, A099: 15, A100: 25 };
  const migrated = normalizeProgression(source, { now: NOW });
  assert.deepEqual(migrated.unlocked, source.unlocked);
  assert.deepEqual(migrated.awardedPoints, source.awardedPoints);
  assert.equal(migrated.points, 50);
  assert.equal(achievementFamilyProgress('both-traditions', migrated).complete, true);
  assert.equal(achievementFamilyProgress('settings', migrated).complete, true);
  assert.equal(migrated.sets.distinctCompletedCulturalRegions.length, 1);
});

test('a newly reachable gallery level carries no migration payout and cannot repay on reload', () => {
  const source = oldSave(3);
  const tiles = themeTileSets['ming-porcelain'].eastern;
  source.collection.counts = Object.fromEntries(tiles.slice(0, 35).map(tile => [tile.matchKey, 1]));
  source.unlocked = { M017: NOW - 1 };
  source.awardedPoints = { M017: 5 };
  // The per-theme badge was already awarded in a real save with 35 pictures.
  source.unlocked.A081 = NOW - 1; source.awardedPoints.A081 = 10;
  source.unlocked.A090 = NOW - 1; source.awardedPoints.A090 = 15;
  const migrated = normalizeProgression(source, { now: NOW });
  assert.equal(migrated.awardedPoints.M018, 0);
  assert.equal(migrated.points, 30);
  assert.deepEqual(migrated.newAchievementIds, []);
  assert.equal(normalizeProgression(migrated, { now: NOW + 1 }).points, 30);
});

test('the fixed-theme transition keeps its own untouched rollback save once', () => {
  const source = oldSave(3), target = storage();
  source.counters.completedDuels = 2;
  const raw = JSON.stringify(source, null, 2);
  target.setItem(PROGRESSION_STORAGE_KEY, raw);
  const migrated = loadProgression({ storage: target, now: NOW });
  assert.equal(target.getItem(THEME_EDITION_MIGRATION_BACKUP_KEY), raw);
  saveProgression(migrated, target);
  loadProgression({ storage: target, now: NOW + 1 });
  assert.equal(target.getItem(THEME_EDITION_MIGRATION_BACKUP_KEY), raw);
});


test('replacement collection receipts preserve zero AP if merged counterparts already qualify', () => {
  const source = oldSave(3);
  source.collection.counts = { [themeTileSets['ming-porcelain'].eastern[0].matchKey]: 10 };
  const migrated = normalizeProgression(source, { now: NOW });
  assert.equal(migrated.awardedPoints.A089, 0);
  assert.equal(migrated.points, 0);
  assert.deepEqual(migrated.newAchievementIds, []);
  assert.equal(normalizeProgression(migrated, { now: NOW + 1 }).points, 0);
});
