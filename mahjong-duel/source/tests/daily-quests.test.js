import test from 'node:test';
import assert from 'node:assert/strict';
import { DAILY_QUEST_POOL, createDailyQuestState, ensureDailyQuests, getDailyQuestView, normalizeDailyQuests } from '../src/daily-quests.js';
import { dayIdFor } from '../src/daily-rewards.js';
import { createProgression, normalizeProgression, reduceProgression, saveProgression, loadProgression } from '../src/progression.js';
import { themeTileSets } from '../src/tile-data.js';
import { rarityForTile } from '../src/rarity.js';

const NOW = Date.UTC(2026, 8, 30, 10), DAY = dayIdFor(NOW);
const fresh = () => reduceProgression(createProgression({ seed: 42 }), { type: 'login', now: NOW });
function withQuests(ids) {
  const state = fresh();
  state.quests = { dayId: DAY, rerollsUsed: 0, presented: false, entries: ids.map(id => ({ id, progress: 0, claimed: false, startedAt: NOW, uniqueKeys: [], chains: {} })) };
  return state;
}
const entry = (state, id) => state.quests.entries.find(item => item.id === id);
const faceFor = (rarity = 'marble') => themeTileSets['ming-porcelain'].eastern.find(tile => rarityForTile('ming-porcelain', 'eastern', tile.id).id === rarity);
function attempt(index = 1, extras = {}) {
  const face = faceFor(extras.rarity ?? 'marble'), actor = extras.actor ?? 'you', matched = extras.matched ?? true;
  const beforePairs = { you: 0, ai: 0 }, afterPairs = { ...beforePairs, [actor]: Number(matched) };
  return { type: 'attempt', eventId: `game:attempt:${index}`, gameId: 'game', themeId: 'ming-porcelain', rulesetId: 'eastern', formationId: 'crown',
    actor, matched, matchKey: matched ? face.matchKey : null, rarity: matched ? extras.rarity ?? 'marble' : null,
    physicalTileIds: [`${index}:a`, `${index}:b`], attemptSequence: index, beforePairs, afterPairs,
    counterDeltas: {}, counterMaxima: {}, now: NOW + index, ...extras };
}
const action = (type, questId, eventId = type, now = NOW + 100) => ({ type, questId, eventId, dayId: dayIdFor(now), now });
const finish = (outcome = 'win', id = 'game') => ({ type: 'complete', gameId: id, eventId: `${id}:complete`, themeId: 'ming-porcelain', rulesetId: 'eastern', formationId: 'crown',
  outcome, finalPairs: outcome === 'win' ? { you: 21, ai: 19 } : outcome === 'lose' ? { you: 19, ai: 21 } : { you: 20, ai: 20 }, now: NOW + 50 });

test('a large prerequisite-free pool deals three varied quests, with Easy and Medium always present initially', () => {
  assert.ok(DAILY_QUEST_POOL.length >= 30);
  assert.equal(new Set(DAILY_QUEST_POOL.map(quest => quest.id)).size, DAILY_QUEST_POOL.length);
  for (const difficulty of ['easy', 'medium', 'hard']) assert.ok(DAILY_QUEST_POOL.filter(quest => quest.difficulty === difficulty).length >= 10);
  for (const quest of DAILY_QUEST_POOL) {
    assert.ok(quest.reward.gems >= 2 && quest.reward.gems <= 10);
    assert.ok(quest.target > 0 && quest.title && quest.description);
    assert.ok(Number.isSafeInteger(quest.estimatedMinutes) && quest.estimatedMinutes >= 2);
    assert.doesNotMatch(`${quest.metric} ${quest.description}`, /booster|eagle|freeze|shuffle|hint|Dancheong|Stained|Dutch/i);
  }
  const thirdDifficulties = new Set();
  for (let seed = 0; seed < 100; seed++) {
    const quests = ensureDailyQuests(createDailyQuestState(), NOW, seed);
    const definitions = quests.entries.map(item => DAILY_QUEST_POOL.find(quest => quest.id === item.id));
    assert.equal(definitions.length, 3);
    assert.equal(definitions[0].difficulty, 'easy'); assert.equal(definitions[1].difficulty, 'medium');
    assert.equal(new Set(definitions.map(item => item.metric)).size, 3);
    thirdDifficulties.add(definitions[2].difficulty);
    assert.strictEqual(ensureDailyQuests(quests, NOW + 100, seed), quests);
  }
  assert.deepEqual([...thirdDifficulties].sort(), ['easy', 'hard', 'medium']);
});

test('progress comes only from accepted personal matches, ignoring ghost, misses, invalid data and replay', () => {
  let state = withQuests(['easy-pairs-3', 'medium-marble-8', 'hard-recall-10']);
  for (const invalid of [attempt(1, { themeId: 'missing' }), attempt(1, { afterPairs: { you: 4, ai: 0 } }), attempt(1, { counterDeltas: { rememberedPairs: -1 } })]) {
    assert.strictEqual(reduceProgression(state, invalid), state);
  }
  state = reduceProgression(state, attempt(1, { actor: 'ai' }));
  state = reduceProgression(state, attempt(2, { matched: false, counterDeltas: { rememberedPairs: 1 } }));
  assert.ok(state.quests.entries.every(item => item.progress === 0));
  const firstMatch = attempt(3, { counterDeltas: { rememberedPairs: 1 } });
  state = reduceProgression(state, firstMatch);
  assert.deepEqual(state.quests.entries.map(item => item.progress), [1, 1, 1]);
  assert.strictEqual(reduceProgression(state, firstMatch), state);
  assert.strictEqual(reduceProgression(state, { ...firstMatch, eventId: 'replay', attemptSequence: 4 }), state);
  assert.strictEqual(reduceProgression(state, { ...attempt(4), eventId: firstMatch.eventId }), state);
  state = reduceProgression(state, attempt(4)); state = reduceProgression(state, attempt(5));
  assert.equal(entry(state, 'easy-pairs-3').progress, 3);
  assert.deepEqual(state.currencies, { coins: 0, gems: 0 }, 'completion alone does not auto-claim a quest');
});

test('rarity, unique artwork and memory goals follow validated events without old collection credit', () => {
  let state = withQuests(['easy-variety-3', 'medium-gold-1', 'hard-recall-10']);
  state.counters.personalPairs = 1000; state.counters.rememberedPairs = 100;
  state.collection.counts[faceFor('gold').matchKey] = 30;
  state = normalizeProgression(state, { now: NOW });
  assert.ok(state.quests.entries.every(item => item.progress === 0));
  state = reduceProgression(state, attempt(1)); state = reduceProgression(state, attempt(2));
  assert.equal(entry(state, 'easy-variety-3').progress, 1);
  state = reduceProgression(state, attempt(3, { rarity: 'gold', counterDeltas: { rememberedPairs: 1 } }));
  assert.equal(entry(state, 'easy-variety-3').progress, 2);
  assert.equal(entry(state, 'medium-gold-1').progress, 1);
  assert.equal(entry(state, 'hard-recall-10').progress, 1);
});

test('attempt goals count personal misses and matches but never opponent attempts', () => {
  let state = withQuests(['easy-attempts-6', 'medium-marble-8', 'hard-recall-10']);
  state = reduceProgression(state, attempt(1, { actor: 'ai' }));
  assert.equal(entry(state, 'easy-attempts-6').progress, 0);
  state = reduceProgression(state, attempt(2, { matched: false }));
  state = reduceProgression(state, attempt(3));
  assert.equal(entry(state, 'easy-attempts-6').progress, 2);
});

test('chain quests count only attempts after their assignment and reset after a personal miss', () => {
  let state = withQuests(['easy-chain-2', 'medium-pairs-12', 'hard-gold-3']);
  state = reduceProgression(state, attempt(1, { counterMaxima: { bestPairChain: 15 } }));
  assert.equal(entry(state, 'easy-chain-2').progress, 1, 'a historical duel maximum is not retroactive quest progress');
  state = reduceProgression(state, attempt(2, { matched: false }));
  state = reduceProgression(state, attempt(3));
  assert.equal(entry(state, 'easy-chain-2').progress, 1);
  state = reduceProgression(state, attempt(4));
  assert.equal(entry(state, 'easy-chain-2').progress, 2);
});

test('completed duels count all outcomes, wins count only wins, and incomplete boards never count', () => {
  let state = withQuests(['easy-duel-1', 'medium-win-1', 'hard-duel-4']);
  assert.strictEqual(reduceProgression(state, { ...finish(), finalPairs: { you: 21, ai: 0 } }), state);
  state = reduceProgression(state, finish('lose', 'one'));
  assert.deepEqual(state.quests.entries.map(item => item.progress), [1, 0, 1]);
  state = reduceProgression(state, finish('tie', 'two'));
  assert.deepEqual(state.quests.entries.map(item => item.progress), [1, 0, 2]);
  state = reduceProgression(state, finish('win', 'three'));
  assert.deepEqual(state.quests.entries.map(item => item.progress), [1, 1, 3]);
  assert.strictEqual(reduceProgression(state, finish('win', 'three')), state);
});

test('quest rewards claim once, preserve duplicate-count progression and survive reload', () => {
  let state = withQuests(['easy-pairs-3', 'medium-marble-8', 'hard-recall-10']);
  const claim = action('quest-claim', 'easy-pairs-3');
  assert.strictEqual(reduceProgression(state, claim), state);
  for (let index = 1; index <= 3; index++) state = reduceProgression(state, attempt(index));
  const before = structuredClone(state.collection);
  state = reduceProgression(state, claim);
  assert.deepEqual(state.currencies, { coins: 0, gems: 2 });
  assert.deepEqual(state.collection, before);
  assert.equal(getDailyQuestView(state, NOW).quests[0].claimed, true);
  assert.strictEqual(reduceProgression(state, { ...claim, eventId: 'claim-again' }), state);
  const values = new Map(), storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
  saveProgression(state, storage);
  const restored = loadProgression({ storage, now: NOW + 200 });
  assert.deepEqual(restored.quests, state.quests); assert.deepEqual(restored.currencies, state.currencies);
  assert.strictEqual(reduceProgression(restored, { ...claim, eventId: 'after-reload' }), restored);
});

test('one free reroll changes difficulty and starts at zero, without requiring the initial mix afterwards', () => {
  let state = withQuests(['easy-pairs-3', 'medium-marble-8', 'hard-recall-10']);
  state = reduceProgression(state, attempt(1));
  const previous = getDailyQuestView(state, NOW).quests[0];
  const rerolled = reduceProgression(state, action('quest-reroll', previous.id));
  const view = getDailyQuestView(rerolled, NOW + 100);
  assert.notEqual(view.quests[0].difficulty, previous.difficulty);
  assert.notEqual(view.quests[0].id, previous.id);
  assert.equal(view.quests[0].progress, 0);
  assert.equal(view.quests.filter(item => item.difficulty === 'easy').length, 0);
  assert.equal(view.rerollsLeft, 0);
  assert.strictEqual(reduceProgression(rerolled, action('quest-reroll', view.quests[1].id, 'second-reroll')), rerolled);
  const loaded = normalizeProgression(rerolled, { now: NOW + 200 });
  assert.deepEqual(loaded.quests, rerolled.quests);
  const lateOldAttempt = reduceProgression(loaded, attempt(2, { now: NOW + 2 }));
  assert.equal(getDailyQuestView(lateOldAttempt, NOW + 200).quests[0].progress, 0);
});

test('finished quests cannot be rerolled and old day actions cannot claim or reroll a new board', () => {
  let state = withQuests(['easy-opening-1', 'medium-marble-8', 'hard-recall-10']);
  state = reduceProgression(state, attempt());
  assert.strictEqual(reduceProgression(state, action('quest-reroll', 'easy-opening-1')), state);
  const tomorrow = NOW + 86400000;
  const next = reduceProgression(state, { type: 'login', now: tomorrow });
  assert.equal(next.quests.dayId, dayIdFor(tomorrow));
  assert.equal(getDailyQuestView(next, tomorrow).rerollsLeft, 1);
  assert.ok(next.quests.entries.every(item => item.progress === 0 && !item.claimed));
  assert.strictEqual(reduceProgression(next, { ...action('quest-claim', 'easy-opening-1'), now: tomorrow }), next);
  assert.strictEqual(reduceProgression(next, { ...action('quest-reroll', next.quests.entries[0].id), now: tomorrow }), next);
  assert.equal(reduceProgression(next, attempt(2, { now: NOW + 200 })).quests, next.quests);
});

test('UTC rollover resets daily progress and presentation; same-day reopen preserves them', () => {
  let state = fresh();
  assert.equal(getDailyQuestView(state, NOW).shouldAutoOpen, true);
  state = reduceProgression(state, { type: 'quests-presented', dayId: DAY, now: NOW });
  assert.equal(getDailyQuestView(state, NOW).shouldAutoOpen, false);
  const restored = normalizeProgression(state, { now: NOW + 1000 });
  assert.equal(getDailyQuestView(restored, NOW + 1000).shouldAutoOpen, false);
  const midnight = Date.parse('2026-10-01T00:00:00Z');
  const newDay = reduceProgression(restored, { type: 'login', now: midnight });
  assert.equal(getDailyQuestView(newDay, midnight).shouldAutoOpen, true);
  assert.equal(getDailyQuestView(newDay, midnight).dayId, '2026-10-01');
  assert.equal(getDailyQuestView(newDay, midnight).resetAt, Date.parse('2026-10-02T00:00:00Z'));
  const snapshot = structuredClone(newDay.quests);
  assert.equal(ensureDailyQuests(newDay.quests, NOW, newDay.ranking.seed), newDay.quests);
  assert.deepEqual(newDay.quests, snapshot);
});

test('malformed quest storage recovers safely and invalid claim identifiers are exact no-ops', () => {
  for (const malformed of [null, [], {}, { dayId: 'wrong', entries: [] }, { dayId: DAY, entries: [{ id: 'missing' }, {}, {}] }]) {
    assert.deepEqual(normalizeDailyQuests(malformed), createDailyQuestState());
  }
  const state = withQuests(['easy-pairs-3', 'medium-marble-8', 'hard-recall-10']);
  state.quests.entries[0].progress = Infinity; state.quests.entries[0].claimed = true;
  state.quests.entries[1].chains = JSON.parse('{"__proto__":999,"game":2}');
  const normalized = normalizeDailyQuests(state.quests);
  assert.equal(normalized.entries[0].progress, 0); assert.equal(normalized.entries[0].claimed, false);
  assert.deepEqual(normalized.entries[1].chains, { game: 2 });
  for (const event of [action('quest-claim', '__proto__'), action('quest-reroll', 'missing'), action('quest-claim', 'easy-pairs-3', '__proto__')]) {
    assert.strictEqual(reduceProgression(state, event), state);
  }
});
