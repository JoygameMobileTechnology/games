import test from 'node:test';
import assert from 'node:assert/strict';
import { ACHIEVEMENTS, ACHIEVEMENT_REWARDS_VERSION, achievementById } from '../src/achievements.js';
import { AVATAR_FRAMES, unlockedFrameIds } from '../src/avatar-frames.js';
import { DEFAULT_PROFILE, PROFILE_STORAGE_KEY, loadProfile, saveProfile } from '../src/profile-store.js';
import { createProgression, normalizeProgression, loadProgression, saveProgression, PROGRESSION_STORAGE_KEY, AP_PACING_BACKUP_KEY, AP_REBALANCE_BACKUP_KEY } from '../src/progression.js';

const NOW = Date.UTC(2026, 9, 9, 17);
function oldSave(awardedPoints = { M002: 40, M004: 500 }) {
  return { ...createProgression({ seed: 42 }), achievementRewardsVersion: 4, retainedAvatarFrameIds: undefined,
    awardedPoints, unlocked: Object.fromEntries(Object.keys(awardedPoints).map((id, index) => [id, NOW - 1000 - index])),
    points: Object.values(awardedPoints).reduce((sum, points) => sum + points, 0) };
}
function storage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test('pre-v5 saves retain all earned frames without changing AP, including equipped Jade at 540 AP', () => {
  const target = storage();
  const source = oldSave();
  const profile = { ...DEFAULT_PROFILE, frameId: 'jade' };
  target.setItem(PROGRESSION_STORAGE_KEY, JSON.stringify(source));
  target.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  const state = loadProgression({ storage: target, now: NOW });
  assert.equal(state.achievementRewardsVersion, ACHIEVEMENT_REWARDS_VERSION);
  assert.equal(state.points, 540);
  assert.deepEqual(state.awardedPoints, source.awardedPoints);
  assert.deepEqual(state.retainedAvatarFrameIds, ['bronze', 'porcelain', 'jade']);
  assert.deepEqual(state.newAchievementIds, []);
  assert.deepEqual(loadProfile(target, state.points, state.retainedAvatarFrameIds), profile);
  assert.equal(saveProfile(profile, target, state.points, state.retainedAvatarFrameIds), true);
  assert.equal(saveProgression(state, target), true);
  const reloaded = loadProgression({ storage: target, now: NOW + 1 });
  assert.equal(reloaded.points, 540);
  assert.deepEqual(reloaded.retainedAvatarFrameIds, state.retainedAvatarFrameIds);
  assert.equal(loadProfile(target, reloaded.points, reloaded.retainedAvatarFrameIds).frameId, 'jade');
});

test('each old frame milestone remains available even when its new threshold is higher', () => {
  for (const [awardedPoints, expected] of [
    [{ M003: 150 }, ['bronze']],
    [{ M003: 150, M007: 150 }, ['bronze', 'porcelain']],
    [{ M004: 500 }, ['bronze', 'porcelain', 'jade']],
    [{ M004: 500, M008: 500 }, ['bronze', 'porcelain', 'jade', 'gold']],
    [{ M004: 500, M008: 500, M012: 500 }, AVATAR_FRAMES.map(frame => frame.id)],
  ]) {
    const state = normalizeProgression(oldSave(awardedPoints), { now: NOW });
    assert.deepEqual(state.retainedAvatarFrameIds, expected);
    assert.deepEqual(normalizeProgression(state, { now: NOW + 1 }).retainedAvatarFrameIds, expected);
  }
});

test('legacy frame eligibility uses validated receipts before new rewards, never a cached points total', () => {
  const source = oldSave({ M001: 10, M002: 40 });
  source.points = 1000000;
  source.counters.completedDuels = achievementById.M003.target;
  const state = normalizeProgression(source, { now: NOW });
  assert.equal(state.points, 50 + achievementById.M003.points);
  assert.ok(state.points >= 100 && state.points < AVATAR_FRAMES[0].pointsRequired);
  assert.deepEqual(state.retainedAvatarFrameIds, [], 'newly earned AP must not unlock a removed 100 AP gate');
  assert.deepEqual(state.newAchievementIds, ['M003']);
});

test('fresh v5 profiles earn only the new frame milestones and persist those rights', () => {
  const source = createProgression({ seed: 42 });
  assert.equal(source.achievementRewardsVersion, 5);
  assert.deepEqual(source.retainedAvatarFrameIds, []);
  let points = 0;
  for (const definition of ACHIEVEMENTS) {
    source.unlocked[definition.id] = NOW - 1000;
    source.awardedPoints[definition.id] = definition.points;
    points += definition.points;
    if (points >= AVATAR_FRAMES[0].pointsRequired) break;
  }
  const state = normalizeProgression(source, { now: NOW });
  assert.deepEqual(state.retainedAvatarFrameIds, unlockedFrameIds(points));
  assert.deepEqual(state.retainedAvatarFrameIds, ['bronze']);
  assert.deepEqual(normalizeProgression(state, { now: NOW + 1 }).retainedAvatarFrameIds, ['bronze']);
  const retained = normalizeProgression({ ...createProgression({ seed: 42 }), retainedAvatarFrameIds: ['jade', 'jade', 'invented'] }, { now: NOW });
  assert.deepEqual(retained.retainedAvatarFrameIds, ['jade'], 'only known unique entitlement IDs survive');
});

test('loading keeps a separate untouched v5 backup alongside previous migration backups', () => {
  const target = storage();
  const source = oldSave();
  const raw = JSON.stringify(source);
  target.setItem(AP_REBALANCE_BACKUP_KEY, 'previous-v4-backup');
  target.setItem(PROGRESSION_STORAGE_KEY, raw);
  const state = loadProgression({ storage: target, now: NOW });
  assert.equal(target.getItem(AP_PACING_BACKUP_KEY), raw);
  assert.equal(target.getItem(AP_REBALANCE_BACKUP_KEY), 'previous-v4-backup');
  assert.equal(saveProgression(state, target), true);
  loadProgression({ storage: target, now: NOW + 1 });
  assert.equal(target.getItem(AP_PACING_BACKUP_KEY), raw);
  target.setItem(PROGRESSION_STORAGE_KEY, JSON.stringify({ ...source, points: 999 }));
  loadProgression({ storage: target, now: NOW + 2 });
  assert.equal(target.getItem(AP_PACING_BACKUP_KEY), raw, 'a later old-client save cannot overwrite the original');

  const fresh = storage();
  fresh.setItem(PROGRESSION_STORAGE_KEY, JSON.stringify(createProgression({ seed: 42 })));
  loadProgression({ storage: fresh, now: NOW });
  assert.equal(fresh.getItem(AP_PACING_BACKUP_KEY), null);
  assert.doesNotThrow(() => loadProgression({ storage: { getItem: key => key === PROGRESSION_STORAGE_KEY ? raw : null, setItem() { throw Error('full'); } }, now: NOW }));
});
