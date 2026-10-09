import test from 'node:test';
import assert from 'node:assert/strict';
import { AVATAR_FRAMES, getAvatarFrame, isFrameUnlocked, unlockedFrameIds, resolveFrameId } from '../src/avatar-frames.js';
import { DEFAULT_PROFILE, PROFILE_STORAGE_KEY, loadProfile, normalizeProfile, profileError, saveProfile } from '../src/profile-store.js';

function storage(profile) {
  const values = new Map([['unrelated', 'keep']]);
  if (profile) values.set(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test('every frame unlocks at its earned AP boundary without spending points', () => {
  for (const frame of AVATAR_FRAMES) {
    assert.equal(isFrameUnlocked(frame.id, frame.pointsRequired - 1), false, frame.id);
    assert.equal(resolveFrameId(frame.id, frame.pointsRequired - 1), '', frame.id);
    assert.equal(isFrameUnlocked(frame.id, frame.pointsRequired), true, frame.id);
    assert.equal(resolveFrameId(frame.id, frame.pointsRequired), frame.id);
    assert.ok(unlockedFrameIds(frame.pointsRequired).includes(frame.id));
    assert.equal(getAvatarFrame(frame.id), frame);
  }
  assert.deepEqual(unlockedFrameIds(6500), AVATAR_FRAMES.map(frame => frame.id), 'the final milestone makes every frame available');
});

test('missing, invalid, and unknown frame eligibility stays unframed', () => {
  assert.equal(isFrameUnlocked('', 0), true);
  assert.equal(getAvatarFrame('invented'), null);
  assert.equal(isFrameUnlocked('invented', 9999), false);
  for (const points of [undefined, null, '1400', -1, Infinity, NaN, 1400.5]) {
    assert.equal(isFrameUnlocked('celestial', points), false);
    assert.equal(resolveFrameId('celestial', points), '');
  }
  assert.deepEqual(unlockedFrameIds(0), []);
});

test('legacy profiles load without a frame while preserving their details', () => {
  const legacy = { version: 1, name: 'Ada', avatarId: 'avatar-7', countryCode: 'TR' };
  assert.deepEqual(loadProfile(storage(legacy), 1400), { ...legacy, frameId: '' });
  assert.deepEqual(loadProfile(storage()), DEFAULT_PROFILE);
  assert.equal(normalizeProfile({ ...legacy, frameId: 'invented' }, 9999).frameId, '');
});

test('equipped frame persists with a profile and is revalidated on reload', () => {
  const target = storage();
  const profile = { ...DEFAULT_PROFILE, name: 'Ada', frameId: 'jade' };
  assert.equal(saveProfile(profile, target, 3000), true);
  assert.deepEqual(loadProfile(target, 3000), profile);
  assert.equal(loadProfile(target, 2999).frameId, '', 'a stale saved selection cannot equip a locked frame');
  assert.equal(loadProfile(target).frameId, '', 'unknown ownership defaults to no frame');
  assert.equal(target.values.get('unrelated'), 'keep');
  assert.equal(saveProfile({ ...profile, frameId: '' }, target, 3000), true);
  assert.equal(loadProfile(target, 3000).frameId, '', 'unequipping survives reload');
});

test('locked frame saves fail without replacing a valid profile', () => {
  const existing = { ...DEFAULT_PROFILE, name: 'Ada', frameId: 'bronze' };
  const target = storage(existing);
  const locked = { ...existing, frameId: 'gold' };
  assert.match(profileError(locked, 4999), /unlock this frame/);
  assert.equal(saveProfile(locked, target, 4999), false);
  assert.deepEqual(loadProfile(target, 500), existing);
  assert.equal(saveProfile({ ...existing, frameId: 'invented' }, target, 9999), false);
  assert.equal(saveProfile(locked, { setItem() { throw new Error('blocked'); } }, 5000), false);
});


test('retained frame rights work through profile validation and persistence', () => {
  const retained = ['bronze', 'porcelain', 'jade'];
  const profile = { ...DEFAULT_PROFILE, name: 'Ada', frameId: 'jade' };
  const target = storage(profile);
  assert.equal(isFrameUnlocked('jade', 540), false, 'new profiles use the new threshold');
  assert.equal(isFrameUnlocked('jade', 540, retained), true);
  assert.equal(resolveFrameId('jade', 540, retained), 'jade');
  assert.deepEqual(unlockedFrameIds(540, retained), retained);
  assert.equal(profileError(profile, 540, retained), '');
  assert.deepEqual(normalizeProfile(profile, 540, retained), profile);
  assert.deepEqual(loadProfile(target, 540, retained), profile);
  assert.equal(saveProfile(profile, target, 540, retained), true);
  assert.equal(loadProfile(target, 540, retained).frameId, 'jade');
  assert.equal(saveProfile({ ...profile, frameId: 'porcelain' }, target, 540, retained), true, 'every previously earned frame remains selectable');
  assert.equal(saveProfile({ ...profile, frameId: 'gold' }, target, 540, retained), false);
  assert.equal(isFrameUnlocked('invented', 540, ['invented']), false);
  assert.deepEqual(unlockedFrameIds(0, ['jade', 'jade', 'invented']), ['jade']);
  assert.deepEqual(unlockedFrameIds(0, { jade: true }), []);
});
