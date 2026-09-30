import test from 'node:test';
import assert from 'node:assert/strict';
import { AVATAR_IDS, COUNTRIES, profileError } from '../src/profile-store.js';
import { MATCH_FOUND_DELAY_MS, OPPONENT_ROSTER, chooseOpponent, matchmakingDelay } from '../src/matchmaking.js';

test('the simulated roster contains 1000 unique valid profiles using every existing portrait', () => {
  assert.equal(OPPONENT_ROSTER.length, 1000);
  assert.equal(new Set(OPPONENT_ROSTER.map(opponent => opponent.id)).size, OPPONENT_ROSTER.length);
  assert.equal(new Set(OPPONENT_ROSTER.map(opponent => opponent.name.toLowerCase())).size, OPPONENT_ROSTER.length);
  assert.deepEqual(new Set(OPPONENT_ROSTER.map(opponent => opponent.avatarId)), new Set(AVATAR_IDS));
  const countries = new Set(COUNTRIES.map(country => country.code));
  for (const opponent of OPPONENT_ROSTER) {
    assert.equal(profileError(opponent), '', opponent.name);
    assert.equal(opponent.version, 1);
    assert.equal(opponent.frameId, '');
    assert.ok(opponent.name.length > 0 && opponent.name.length <= 16, opponent.name);
    assert.ok(AVATAR_IDS.includes(opponent.avatarId), opponent.name);
    assert.ok(countries.has(opponent.countryCode), opponent.name);
    assert.doesNotMatch(opponent.name, /ghost/i);
  }
  assert.equal(OPPONENT_ROSTER[0].id, 'opponent-001');
  assert.equal(OPPONENT_ROSTER.at(-1).id, 'opponent-1000');
});

test('opponent selection excludes the previous match, player name, and player portrait', () => {
  const player = { name: `  ${OPPONENT_ROSTER[0].name.toUpperCase()}  `, avatarId: AVATAR_IDS[1] };
  const previousId = OPPONENT_ROSTER[2].id;
  const selected = new Set();
  for (let index = 0; index <= 1000; index += 1) {
    const opponent = chooseOpponent({ player, previousId, random: () => index / 1000 });
    assert.notEqual(opponent.id, previousId);
    assert.notEqual(opponent.name.toLowerCase(), player.name.trim().toLowerCase());
    assert.notEqual(opponent.avatarId, player.avatarId);
    selected.add(opponent.id);
  }
  assert.equal(selected.size, 873, 'every eligible opponent can be selected');
});

test('selection handles random boundaries and never mutates the preset roster', () => {
  const before = structuredClone(OPPONENT_ROSTER);
  assert.equal(chooseOpponent({ random: () => 0 }).id, OPPONENT_ROSTER[0].id);
  assert.equal(chooseOpponent({ random: () => 1 }).id, OPPONENT_ROSTER.at(-1).id);
  for (const value of [-1, 2, NaN, Infinity]) {
    assert.ok(OPPONENT_ROSTER.some(opponent => opponent.id === chooseOpponent({ random: () => value }).id));
  }
  const opponent = chooseOpponent({ random: () => 0 });
  opponent.name = 'Changed locally';
  opponent.avatarId = AVATAR_IDS[3];
  assert.deepEqual(OPPONENT_ROSTER, before);
  assert.ok(Object.isFrozen(OPPONENT_ROSTER));
  assert.ok(OPPONENT_ROSTER.every(Object.isFrozen));
});

test('search timing draws a fresh integer from two through four seconds', () => {
  assert.equal(matchmakingDelay(() => 0), 2000);
  assert.equal(matchmakingDelay(() => 0.5), 3000);
  assert.equal(matchmakingDelay(() => 1 - Number.EPSILON), 4000);
  assert.equal(matchmakingDelay(() => 1), 4000);
  assert.equal(MATCH_FOUND_DELAY_MS, 1500);
  for (const value of [-1, 0, 0.12345, 0.333, 0.9, 1, 2, NaN, Infinity]) {
    const delay = matchmakingDelay(() => value);
    assert.ok(Number.isInteger(delay));
    assert.ok(delay >= 2000 && delay <= 4000);
  }
  let calls = 0;
  const random = () => calls++ === 0 ? 0 : 0.999;
  assert.notEqual(matchmakingDelay(random), matchmakingDelay(random));
  assert.equal(calls, 2);
});
