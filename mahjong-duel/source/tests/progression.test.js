import test from 'node:test';
import assert from 'node:assert/strict';
import { ACHIEVEMENTS, ACHIEVEMENT_POINTS_MAX, LEGACY_ACHIEVEMENT_POINTS, NUMERIC_COUNTER_KEYS, SET_COUNTER_KEYS, achievementProgress, getCounter, evaluateAchievements } from '../src/achievements.js';
import { createProgression, normalizeProgression, loadProgression, saveProgression, reduceProgression, consumeRankingPresentation, PROGRESSION_STORAGE_KEY } from '../src/progression.js';
import { createCollection, awardCollectedPair, COLLECTION_STORAGE_KEY } from '../src/collection.js';
import { themeTileSets } from '../src/tile-data.js';
import { rarityForTile } from '../src/rarity.js';
import { DAY_POLICY, getDailyView, dayIdFor, rewardsForLogin, emptyWallet } from '../src/daily-rewards.js';
import { rankingRows, LEAGUES, leagueForWins } from '../src/leaderboards.js';

const NOW = Date.UTC(2026, 8, 28, 12);
const day = number => Date.UTC(2026, 0, number, 12);
const fresh = () => createProgression({ seed: 42 });
const face = themeTileSets['ming-porcelain'].eastern.find(tile => tile.id === 'K01');
const context = { gameId: 'duel-1', themeId: 'ming-porcelain', rulesetId: 'eastern', formationId: 'crown' };
const attempt = (extra = {}) => ({ type: 'attempt', ...context, eventId: 'duel-1:attempt:1', attemptSequence: 1, actor: 'you', matched: true,
  physicalTileIds: ['tile-a', 'tile-b'], matchKey: face.matchKey, rarity: rarityForTile(context.themeId, context.rulesetId, face.id).id,
  beforePairs: { you: 0, ai: 0 }, afterPairs: { you: 1, ai: 0 }, counterDeltas: {}, counterMaxima: {}, now: NOW, ...extra });
const complete = (extra = {}) => ({ type: 'complete', ...context, eventId: 'duel-1:complete', outcome: 'win',
  afterPairs: { you: 21, ai: 19 }, winningSnapshot: { conditionalWins: { noBoosters: true, noMismatch: true, closeFinish: false } }, now: NOW, ...extra });
const login = (state, now) => reduceProgression(state, { type: 'login', now });
const claim = (state, id, now) => reduceProgression(state, { type: 'daily-claim', eventId: id, now });
function storage() {
  const values = new Map([['porcelain:profile', '{"name":"Keep me"}'], ['unrelated', 'keep']]);
  return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}
const legacyRarityFaces = { bamboo: 'C01', granite: 'G02', amethyst: 'K03', gold: 'A11', celestial: 'K01' };
function legacyRarityProgression(rarities = Object.keys(legacyRarityFaces)) {
  const state = fresh();
  for (const rarity of rarities) {
    const tile = themeTileSets['ming-porcelain'].eastern.find(item => item.id === legacyRarityFaces[rarity]);
    state.collection = awardCollectedPair(state.collection, { gameId: 'legacy-save', pairId: [`${rarity}-a`, `${rarity}-b`], matchKey: tile.matchKey, actor: 'you' });
  }
  state.sets.distinctCollectedMatchKeys = Object.keys(state.collection.counts);
  state.sets.distinctCollectedRarityIds = [...rarities];
  return state;
}

 test('catalogue retains all 100 IDs and legacy rewards, with 3,730 points available to new players', () => {
  assert.deepEqual(ACHIEVEMENTS.map(item => item.id), Array.from({ length: 100 }, (_, i) => `A${String(i + 1).padStart(3, '0')}`));
  assert.equal(new Set(ACHIEVEMENTS.map(item => item.id)).size, 100);
  assert.equal(ACHIEVEMENT_POINTS_MAX, 3730);
  assert.equal(Object.values(LEGACY_ACHIEVEMENT_POINTS).reduce((sum, points) => sum + points, 0), 1465);
  assert.equal(ACHIEVEMENTS.reduce((sum, item) => sum + item.points, 0), ACHIEVEMENT_POINTS_MAX);
  for (const item of ACHIEVEMENTS) {
    assert.ok(item.name && item.description.length > 30 && item.category && item.counterKey);
    assert.ok(Number.isSafeInteger(item.target) && item.target > 0);
    assert.ok(Number.isSafeInteger(item.points) && item.points >= LEGACY_ACHIEVEMENT_POINTS[item.id]);
    assert.doesNotMatch(item.counterKey, /points/i);
  }
});

test('rarity achievements use the four current tiers and retain the saved Eagle Eye counter', () => {
  const rareFind = ACHIEVEMENTS.find(item => item.id === 'A072');
  assert.equal(rareFind.description, 'Match a Gold pair while Eagle Eye’s timer is active.');
  assert.equal(rareFind.counterKey, 'goldOrCelestialPairsDuringEagleEye');
  const everyRarity = ACHIEVEMENTS.find(item => item.id === 'A090');
  assert.equal(everyRarity.description, 'Collect at least one picture from every rarity: Marble, Sapphire, Amethyst and Gold.');
  assert.equal(everyRarity.target, 4);
});

test('every achievement evaluator has positive, below-threshold and unrelated-counter cases', () => {
  for (const item of ACHIEVEMENTS) {
    let state = fresh();
    const set = SET_COUNTER_KEYS.includes(item.counterKey);
    const seed = amount => ({ ...state,
      counters: { ...state.counters, ...(!set ? { [item.counterKey]: amount } : {}) },
      sets: { ...state.sets, ...(set ? { [item.counterKey]: Array.from({ length: amount }, (_, i) => `value-${i}`) } : {}) } });
    const before = evaluateAchievements(seed(item.target - 1), NOW);
    assert.equal(Object.hasOwn(before.unlocked, item.id), false, `${item.id}: below threshold`);
    const earned = evaluateAchievements(seed(item.target), NOW);
    assert.equal(earned.unlocked[item.id], NOW, `${item.id}: at threshold`);
    const replay = evaluateAchievements({ ...seed(item.target), ...earned }, NOW + 1);
    assert.equal(replay.unlocked[item.id], NOW, `${item.id}: original timestamp retained`);
    assert.equal(achievementProgress(item, { ...seed(item.target), ...earned }).progress, 1);
    state.counters.unrelated = Number.MAX_SAFE_INTEGER;
    assert.equal(Object.hasOwn(evaluateAchievements(state, NOW).unlocked, item.id), false, `${item.id}: unrelated progress`);
  }
  assert.equal(getCounter(fresh(), 'invented'), 0);
  assert.equal(achievementProgress('A101', fresh()), null);
});

test('collection migration backfills only the eleven permitted collection achievements', () => {
  const counts = Object.fromEntries(Object.values(themeTileSets).flatMap(sets => Object.values(sets).flat()).map(tile => [tile.matchKey, 10]));
  const collection = { ...createCollection(), counts };
  const state = loadProgression({ collection, storage: storage(), now: NOW });
  assert.deepEqual(Object.keys(state.unlocked).sort(), ['A076','A077','A078','A079','A080','A081','A082','A083','A084','A089','A090']);
  assert.equal(getCounter(state, 'distinctCollectedMatchKeys'), 320);
  assert.equal(state.counters.personalPairs, 0);
  assert.equal(state.counters.completedWins, 0);
  assert.equal(state.counters.bestPairChain, 0);
  assert.equal(getCounter(state, 'distinctLoginDayIds'), 0);
  assert.equal(getCounter(state, 'distinctCompletedFormationIds'), 0);
  assert.deepEqual(state.wallet, emptyWallet());
  assert.equal(state.ranking.position, 10000);
});

test('five-tier version 1 saves preserve collection, receipts, wallet, ranking and earned achievement history', () => {
  const stored = legacyRarityProgression(), target = storage();
  stored.collection = awardCollectedPair(stored.collection, { gameId: 'legacy-save', pairId: ['celestial-c', 'celestial-d'], matchKey: face.matchKey, actor: 'you' });
  Object.assign(stored.counters, { personalPairs: 6, completedDuels: 1, completedWins: 1,
    maxCollectionCountForOneMatchKey: 2, goldOrCelestialPairsDuringEagleEye: 2, matchedPairsDuringEagleEye: 2 });
  stored.wallet = { shuffle: 3, hint: 8, freeze: 2, eagle: 5 };
  stored.ranking = { seed: 42, position: 9800, wins: 1, leagueId: 'bronze' };
  stored.unlocked = { A001: NOW - 4000, A011: NOW - 3000, A072: NOW - 2000, A090: NOW - 1000 };
  stored.points = 35;
  stored.newAchievementIds = ['A072'];
  stored.eventReceipts = { 'legacy-save:booster': NOW - 5000 };
  stored.attemptCursors = { 'legacy-save': 6 };
  stored.completedGameIds = ['legacy-complete'];
  target.setItem(PROGRESSION_STORAGE_KEY, JSON.stringify(stored));
  let loaded = loadProgression({ storage: target, now: NOW });
  assert.equal(loaded.version, 1);
  for (const key of ['collection', 'counters', 'wallet', 'ranking', 'unlocked', 'newAchievementIds', 'eventReceipts', 'attemptCursors', 'completedGameIds']) {
    assert.deepEqual(loaded[key], stored[key], key);
  }
  assert.deepEqual(loaded.sets.distinctCollectedRarityIds, ['marble', 'sapphire', 'amethyst', 'gold']);
  assert.equal(loaded.points, stored.points);
  assert.strictEqual(reduceProgression(loaded, attempt({ gameId: 'legacy-save', attemptSequence: 6 })), loaded);
  assert.strictEqual(reduceProgression(loaded, complete({ gameId: 'legacy-complete' })), loaded);
  const continued = reduceProgression(loaded, attempt({ counterDeltas: { goldOrCelestialPairsDuringEagleEye: 1, matchedPairsDuringEagleEye: 1 } }));
  assert.equal(continued.counters.goldOrCelestialPairsDuringEagleEye, 3);
  assert.deepEqual(continued.unlocked, stored.unlocked);
  assert.equal(continued.points, stored.points);
  assert.equal(saveProgression(continued, target), true);
  loaded = loadProgression({ storage: target, now: NOW + 1000 });
  assert.deepEqual(loaded, continued);
});

test('an old save missing either Gold or Celestial now unlocks Every Rarity once at four current tiers', () => {
  for (const missing of ['gold', 'celestial']) {
    const stored = legacyRarityProgression(Object.keys(legacyRarityFaces).filter(id => id !== missing)), target = storage();
    target.setItem(PROGRESSION_STORAGE_KEY, JSON.stringify(stored));
    let loaded = loadProgression({ storage: target, now: NOW });
    assert.equal(getCounter(loaded, 'distinctCollectedRarityIds'), 4);
    assert.deepEqual(loaded.unlocked, { A090: NOW });
    assert.deepEqual(loaded.newAchievementIds, ['A090']);
    assert.equal(loaded.points, 15);
    assert.deepEqual(loaded.collection, stored.collection);
    loaded = reduceProgression(loaded, { type: 'achievements-seen', ids: ['A090'] });
    assert.equal(saveProgression(loaded, target), true);
    const reloaded = loadProgression({ storage: target, now: NOW + 1000 });
    assert.deepEqual(reloaded.unlocked, { A090: NOW });
    assert.deepEqual(reloaded.newAchievementIds, []);
    assert.equal(reloaded.points, 15);
  }
});

test('old Gold and Celestial count as one collected tier and stale rarity sets cannot grant Every Rarity', () => {
  const stored = legacyRarityProgression(['bamboo', 'granite', 'gold', 'celestial']), target = storage();
  stored.sets.distinctCollectedRarityIds = Object.keys(legacyRarityFaces);
  target.setItem(PROGRESSION_STORAGE_KEY, JSON.stringify(stored));
  const loaded = loadProgression({ storage: target, now: NOW });
  assert.deepEqual(loaded.collection, stored.collection);
  assert.deepEqual(loaded.sets.distinctCollectedRarityIds, ['marble', 'sapphire', 'gold']);
  assert.deepEqual(achievementProgress('A090', loaded), { current: 3, target: 4, progress: .75, unlocked: false, unlockedAt: null });
  assert.equal(loaded.points, 0);
  const amethyst = themeTileSets['ming-porcelain'].eastern.find(tile => tile.id === legacyRarityFaces.amethyst);
  const next = reduceProgression(loaded, attempt({ matchKey: amethyst.matchKey, rarity: 'amethyst' }));
  assert.equal(getCounter(next, 'distinctCollectedRarityIds'), 4);
  assert.deepEqual(next.unlocked, { A090: NOW });
  assert.equal(next.points, 15);
});

test('a personal pair, collection receipt and event counters commit atomically exactly once', () => {
  const event = attempt({ counterDeltas: { rememberedPairs: 1, delayedRecallPairs: 1 }, counterMaxima: { bestPairChain: 2, maxRememberedPairsInDuel: 1 } });
  const first = fresh(), next = reduceProgression(first, event);
  assert.equal(next.counters.personalPairs, 1);
  assert.equal(next.counters.rememberedPairs, 1);
  assert.equal(next.counters.bestPairChain, 2);
  assert.equal(next.collection.counts[face.matchKey], 1);
  assert.equal(Object.keys(next.collection.receipts).length, 1);
  assert.equal(first.counters.personalPairs, 0);
  assert.strictEqual(reduceProgression(next, event), next);
  assert.strictEqual(reduceProgression(next, { ...event, eventId: 'replayed', attemptSequence: 2 }), next, 'physical pair cannot be repaid with another event identity');
  assert.ok(next.unlocked.A031 && next.unlocked.A051 && next.unlocked.A064);
});

test('opponent matches and local mismatches cannot grant personal or collection achievements', () => {
  const first = fresh();
  const opponent = reduceProgression(first, attempt({ actor: 'ai', afterPairs: { you: 0, ai: 1 }, counterDeltas: { rememberedPairs: 1 }, counterMaxima: { bestPairChain: 10 } }));
  assert.equal(opponent.counters.personalPairs, 0); assert.deepEqual(opponent.collection, first.collection); assert.deepEqual(opponent.unlocked, {});
  const mismatch = reduceProgression(first, attempt({ matched: false, afterPairs: { you: 0, ai: 0 }, matchKey: null, rarity: null, counterDeltas: { rememberedPairs: 1 } }));
  assert.equal(mismatch.counters.rememberedPairs, 0); assert.equal(mismatch.attemptCursors['duel-1'], 1);
});

test('invalid attempts and unknown or unsafe counter payloads are exact no-ops', () => {
  const state = fresh();
  for (const extra of [{ physicalTileIds: ['a', 'a'] }, { actor: 'other' }, { matched: 'yes' }, { attemptSequence: -1 }, { attemptSequence: 1.5 },
    { counterDeltas: { invented: 1 } }, { counterDeltas: { rememberedPairs: -1 } }, { counterDeltas: { rememberedPairs: Infinity } },
    { counterMaxima: { completedWins: 10 } }, { themeId: 'neon-shrine' }, { rulesetId: 'missing' }, { formationId: 'missing' },
    { rarity: 'marble' }, { rarity: 'celestial' }, { afterPairs: { you: 2, ai: 0 } }, { matchKey: 'unknown' }]) assert.strictEqual(reduceProgression(state, attempt(extra)), state);
});

test('only complete boards settle rankings and conditional wins use the winning snapshot', () => {
  const state = fresh();
  assert.strictEqual(reduceProgression(state, complete({ afterPairs: { you: 21, ai: 0 } })), state);
  assert.strictEqual(reduceProgression(state, complete({ outcome: 'lose' })), state);
  const next = reduceProgression(state, complete({ conditionalWins: { closeFinish: true } }));
  assert.equal(next.counters.completedDuels, 1); assert.equal(next.counters.completedWins, 1);
  assert.equal(next.counters['conditionalWins.closeFinish'], 0, '21–0 secured followed by 21–19 finish is not Close Finish');
  assert.equal(next.counters['conditionalWins.noBoosters'], 1);
  assert.equal(next.counters['conditionalWins.noMismatch'], 1);
  assert.equal(next.ranking.position, 9800);
  assert.equal(next.pendingRankingPresentation.previousPosition, 10000);
  assert.strictEqual(reduceProgression(next, complete()), next);
  assert.strictEqual(reduceProgression(next, complete({ eventId: 'another-completion' })), next);
});

test('every conditional counter requires its exact frozen true fact and a completed win', () => {
  for (const key of NUMERIC_COUNTER_KEYS.filter(key => key.startsWith('conditionalWins.'))) {
    const flag = key.slice('conditionalWins.'.length), state = fresh();
    const event = complete({ winningSnapshot: { conditionalWins: { [flag]: true } } });
    const next = reduceProgression(state, event);
    assert.equal(next.counters[key], 1, key);
    assert.equal(reduceProgression(state, { ...event, winningSnapshot: { conditionalWins: { [flag]: false } } }).counters[key], 0);
    assert.equal(reduceProgression(state, { ...event, outcome: 'lose', afterPairs: { you: 19, ai: 21 } }).counters[key], 0);
  }
});

test('multiple same-day completions settle immediately; losses and draws preserve rank and league', () => {
  let state = reduceProgression(fresh(), complete());
  state = reduceProgression(state, complete({ gameId: 'duel-2', eventId: 'duel-2:complete' }));
  assert.equal(state.ranking.position, 9604); assert.equal(state.counters.completedWins, 2);
  for (const [gameId, outcome, afterPairs] of [['duel-3', 'lose', { you: 19, ai: 21 }], ['duel-4', 'tie', { you: 20, ai: 20 }]]) {
    state = reduceProgression(state, complete({ gameId, eventId: `${gameId}:complete`, outcome, afterPairs }));
    assert.equal(state.ranking.position, 9604); assert.equal(state.pendingRankingPresentation.improved, false);
  }
  assert.equal(state.counters.completedDuels, 4); assert.equal(state.counters.completedWins, 2);
  assert.equal(getCounter(state, 'distinctDuelCompletionDayIds'), 1);
});

test('first place never goes to zero and a held first place can promote without climbing', () => {
  const state = fresh(); state.counters.completedWins = 9; state.counters.completedDuels = 9;
  state.ranking = { ...state.ranking, position: 1, wins: 9 };
  const next = reduceProgression(state, complete());
  assert.equal(next.ranking.position, 1); assert.equal(next.ranking.leagueId, 'silver');
  assert.equal(next.pendingRankingPresentation.improved, false); assert.equal(next.pendingRankingPresentation.promoted, true);
  assert.deepEqual(LEAGUES.map(item => item.minWins), [0, 10, 30, 75, 150, 300]);
  assert.equal(leagueForWins(1000).id, 'grandmaster');
});

test('ranking presentation is consumed once and cold load never revives it', () => {
  const earned = reduceProgression(fresh(), complete()), target = storage();
  assert.equal(saveProgression(earned, target), true);
  const loaded = loadProgression({ storage: target, now: NOW + 86400000 });
  assert.deepEqual(loaded.ranking, earned.ranking); assert.equal(loaded.pendingRankingPresentation, null);
  assert.equal(earned.pendingRankingPresentation.position, 9800);
  const viewed = consumeRankingPresentation(earned);
  assert.equal(viewed.pendingRankingPresentation, null); assert.deepEqual(viewed.ranking, earned.ranking);
  assert.strictEqual(consumeRankingPresentation(viewed), viewed);
});

test('stable simulated rows stay ordered, nonnegative, profile-independent and never duplicate the player', () => {
  const state = reduceProgression(fresh(), complete());
  const rows = rankingRows(state, { name: 'Before', avatarId: 'avatar-2' });
  const other = rankingRows(JSON.parse(JSON.stringify(state)), { name: 'After', avatarId: 'avatar-5' });
  assert.deepEqual(rows.filter(row => !row.isPlayer), other.filter(row => !row.isPlayer));
  assert.equal(rows.filter(row => row.isPlayer).length, 1);
  assert.equal(other.find(row => row.isPlayer).name, 'After');
  for (let i = 0; i < rows.length; i++) {
    assert.ok(rows[i].wins >= 0); if (i) { assert.ok(rows[i].position > rows[i - 1].position); assert.ok(rows[i].wins <= rows[i - 1].wins); }
  }
  assert.equal(rankingRows(state, undefined, { view: 'top' }).length, 10);
  assert.equal(rankingRows(state, undefined, { view: 'top' }).filter(row => row.isPlayer).length, 0);
});

test('completed variety sets count exact launch theme/ruleset/formations and completion days', () => {
  let state = fresh(), index = 0;
  for (const themeId of ['ming-porcelain', 'dancheong', 'stained-glass', 'dutch-golden-age']) for (const rulesetId of ['eastern', 'western']) {
    index++; state = reduceProgression(state, complete({ gameId: `game-${index}`, eventId: `done-${index}`, themeId, rulesetId,
      formationId: index % 2 ? 'crown' : 'fan', now: day(index) }));
  }
  assert.equal(getCounter(state, 'distinctCompletedThemeRulesetCombinations'), 8);
  assert.equal(getCounter(state, 'distinctCompletedRulesetIds'), 2);
  assert.equal(getCounter(state, 'distinctCompletedFormationIds'), 2);
  assert.equal(getCounter(state, 'distinctDuelCompletionDayIds'), 8);
  assert.ok(state.unlocked.A088 && state.unlocked.A099 && state.unlocked.A100);
});

test('one UTC qualifying visit per day earns durable entitlement; claims and missed days never add visits', () => {
  let state = login(fresh(), day(1));
  assert.equal(getDailyView(state, day(1)).shouldAutoOpen, true);
  state = reduceProgression(state, { type: 'daily-presented', dayId: dayIdFor(day(1)), now: day(1) });
  assert.equal(getDailyView(state, day(1)).shouldAutoOpen, false);
  assert.strictEqual(login(state, day(1) + 1000), state);
  state = claim(state, 'claim-1', day(1)); assert.equal(state.wallet.hint, 1);
  assert.strictEqual(claim(state, 'claim-1', day(1)), state);
  assert.strictEqual(claim(state, 'other-claim', day(1)), state);
  state = login(state, day(7));
  assert.equal(getDailyView(state, day(7)).loginDays, 2);
  assert.equal(getDailyView(state, day(7)).weeklyDay, 2);
  assert.equal(state.wallet.shuffle, 0);
  assert.equal(getCounter(state, 'distinctLoginDayIds'), 2);
  assert.equal(state.ranking.position, 10000);
  assert.equal(dayIdFor(Date.parse('2026-09-28T23:30:00-03:00')), '2026-09-29');
  assert.equal(DAY_POLICY.id, 'utc');
});

test('day30 bonus doubles with the weekly reward; day31 remains weekly day3', () => {
  let state = fresh();
  for (let i = 1; i <= 29; i++) { state = login(state, day(i)); state = claim(state, `claim-${i}`, day(i)); }
  state = login(state, day(30));
  assert.deepEqual(getDailyView(state, day(30)).rewards, { shuffle: 6, hint: 5, freeze: 5, eagle: 5 });
  const wallet = { ...state.wallet };
  state = reduceProgression(state, { type: 'daily-ad-start', eventId: 'ad-start', attemptId: 'ad-30', now: day(30) });
  state = reduceProgression(state, { type: 'daily-ad-complete', eventId: 'ad-complete', attemptId: 'ad-30', status: 'completed', now: day(30) });
  for (const [id, amount] of Object.entries({ shuffle: 12, hint: 10, freeze: 10, eagle: 10 })) assert.equal(state.wallet[id], wallet[id] + amount);
  const repeat = reduceProgression(state, { type: 'daily-ad-complete', eventId: 'ad-again', attemptId: 'ad-30', status: 'completed', now: day(30) });
  assert.strictEqual(repeat, state);
  state = login(state, day(31));
  assert.equal(getDailyView(state, day(31)).weeklyDay, 3); assert.equal(getDailyView(state, day(31)).longDay, 1);
  assert.deepEqual(rewardsForLogin(7), { shuffle: 2, hint: 2, freeze: 2, eagle: 2 });
});

test('rewarded ad doubles its captured entitlement snapshot only, even across a day boundary', () => {
  let state = login(fresh(), day(1));
  state = reduceProgression(state, { type: 'daily-ad-start', eventId: 'start-ad', attemptId: 'ad-one', now: day(1) });
  state = login(state, day(2));
  state = reduceProgression(state, { type: 'daily-ad-complete', eventId: 'complete-ad', attemptId: 'ad-one', status: 'completed', now: day(2) });
  assert.equal(state.wallet.hint, 2); assert.equal(state.wallet.shuffle, 0);
  assert.deepEqual(getDailyView(state, day(2)).rewards, { shuffle: 1, hint: 0, freeze: 0, eagle: 0 });
  assert.equal(getCounter(state, 'distinctLoginDayIds'), 2);
});

test('cancelled, failed and unavailable ads leave the standard claim available without granting inventory', () => {
  for (const status of ['cancelled', 'failed', 'unavailable']) {
    let state = login(fresh(), day(1));
    state = reduceProgression(state, { type: 'daily-ad-start', eventId: `start-${status}`, attemptId: status, now: day(1) });
    state = reduceProgression(state, { type: 'daily-ad-complete', eventId: `end-${status}`, attemptId: status, status, now: day(1) });
    assert.equal(state.wallet.hint, 0); assert.equal(getDailyView(state, day(1)).hasClaim, true);
    assert.equal(claim(state, `claim-${status}`, day(1)).wallet.hint, 1);
  }
});

test('standard claim during an ad prevents double payment, and unclaimed rewards survive reload', () => {
  let state = login(fresh(), day(1)), target = storage();
  state = reduceProgression(state, { type: 'daily-ad-start', eventId: 'start', attemptId: 'ad', now: day(1) });
  saveProgression(state, target); state = loadProgression({ storage: target, now: day(2) });
  assert.equal(getDailyView(state, day(2)).hasClaim, true); assert.equal(state.wallet.hint, 0);
  state = claim(state, 'standard', day(2));
  state = reduceProgression(state, { type: 'daily-ad-complete', eventId: 'ad-success', attemptId: 'ad', status: 'completed', now: day(2) });
  assert.equal(state.wallet.hint, 1);
});

test('earned wallet has no cap, spends only successful events and ignores test-stock migration', () => {
  const target = storage();
  target.values.set('porcelain:session', JSON.stringify({ boosters: { shuffle: 20, hint: 20, freeze: 20, eagle: 20 } }));
  let state = loadProgression({ storage: target, now: NOW });
  assert.deepEqual(state.wallet, emptyWallet());
  state.wallet.hint = 500;
  const event = { type: 'booster', eventId: 'spend-1', gameId: 'duel-1', boosterId: 'hint', now: NOW };
  state = reduceProgression(state, event); assert.equal(state.wallet.hint, 499);
  assert.strictEqual(reduceProgression(state, event), state);
  assert.strictEqual(reduceProgression(state, { ...event, eventId: 'spend-ai', actor: 'ai' }), state);
  assert.strictEqual(reduceProgression(state, { ...event, eventId: 'empty', boosterId: 'freeze' }), state);
  saveProgression(state, target); assert.equal(loadProgression({ storage: target, now: NOW }).wallet.hint, 499);
  assert.equal(target.values.get('porcelain:profile'), '{"name":"Keep me"}');
});

test('envelope saves precede legacy mirror; retries neither lose collection nor duplicate receipts', () => {
  const state = reduceProgression(fresh(), attempt()), target = storage();
  let mirrorFailures = 1;
  const flaky = { getItem: target.getItem, setItem(key, value) { if (key === COLLECTION_STORAGE_KEY && mirrorFailures--) throw Error('mirror failed'); target.setItem(key, value); } };
  assert.equal(saveProgression(state, flaky), true);
  const loaded = loadProgression({ storage: target, now: NOW });
  assert.equal(loaded.collection.counts[face.matchKey], 1); assert.equal(loaded.counters.personalPairs, 1);
  assert.strictEqual(reduceProgression(loaded, attempt()), loaded);
  assert.equal(saveProgression(loaded, target), true);
  assert.equal(JSON.parse(target.getItem(COLLECTION_STORAGE_KEY)).counts[face.matchKey], 1);
  const blocked = { setItem() { throw Error('quota'); } };
  assert.equal(saveProgression(state, blocked), false);
});

test('legacy collection reconciliation takes maximum known counts, preserves receipts and never invents play history', () => {
  let collection = awardCollectedPair(createCollection(), { gameId: 'legacy', pairId: ['a','b'], matchKey: face.matchKey, actor: 'you' });
  const stored = fresh(); stored.collection = collection;
  collection = awardCollectedPair(collection, { gameId: 'legacy', pairId: ['c','d'], matchKey: face.matchKey, actor: 'you' });
  const next = normalizeProgression(stored, { collection, now: NOW });
  assert.equal(next.collection.counts[face.matchKey], 2); assert.equal(next.counters.personalPairs, 0);
  assert.equal(Object.keys(next.collection.receipts).length, 2);
  assert.equal(normalizeProgression(next, { collection, now: NOW }).collection.counts[face.matchKey], 2);
});

test('damaged progression JSON still recovers the independently saved legacy binder', () => {
  const target = storage();
  const collection = awardCollectedPair(createCollection(), { gameId: 'legacy', pairId: ['a','b'], matchKey: face.matchKey, actor: 'you' });
  target.setItem(COLLECTION_STORAGE_KEY, JSON.stringify(collection));
  target.setItem(PROGRESSION_STORAGE_KEY, '{damaged');
  const state = loadProgression({ storage: target, now: NOW });
  assert.equal(state.collection.counts[face.matchKey], 1);
  assert.deepEqual(state.collection.receipts, collection.receipts);
  assert.equal(state.counters.personalPairs, 0);
  assert.equal(state.counters.completedWins, 0);
  assert.deepEqual(state.wallet, emptyWallet());
});

test('malformed progression is safe, validates known sets/IDs/counters and recomputes points', () => {
  const dirty = fresh();
  dirty.counters = { completedWins: -1, completedDuels: 2.5, bestPairChain: Infinity, bogus: 999, personalPairs: 10 };
  dirty.wallet = { hint: 50, shuffle: -2, freeze: 1.5, eagle: Number.MAX_SAFE_INTEGER + 1 };
  dirty.sets = { distinctCompletedFormationIds: ['crown','crown','unknown'], distinctCompletedRulesetIds: ['eastern','foo'],
    distinctCompletedThemeRulesetCombinations: ['ming-porcelain:eastern', 'neon-shrine:eastern'], distinctLoginDayIds: ['2026-99-88'] };
  dirty.points = 99999; dirty.unlocked = { A021: NOW, A999: NOW, A001: -1 };
  const state = normalizeProgression(dirty, { now: NOW });
  assert.equal(state.counters.completedWins, 0); assert.equal(state.counters.completedDuels, 0); assert.equal(state.counters.bestPairChain, 0);
  assert.equal(state.counters.bogus, undefined); assert.equal(state.points, 5);
  assert.deepEqual(state.wallet, { shuffle: 0, hint: 50, freeze: 0, eagle: 0 });
  assert.deepEqual(state.sets.distinctCompletedFormationIds, ['crown']);
  assert.deepEqual(state.sets.distinctCompletedRulesetIds, ['eastern']);
  assert.equal(getCounter(state, 'distinctCompletedThemeRulesetCombinations'), 1);
  assert.equal(getCounter(state, 'distinctLoginDayIds'), 0);
  const target = storage();
  for (const raw of ['bad json','null','[]',JSON.stringify({ ...dirty, version: 999 })]) {
    target.values.set(PROGRESSION_STORAGE_KEY, raw);
    const loaded = loadProgression({ storage: target, now: NOW });
    assert.equal(loaded.points, 0); assert.deepEqual(loaded.wallet, emptyWallet());
  }
  assert.doesNotThrow(() => loadProgression({ storage: { getItem() { throw Error('blocked'); } } }));
});

test('achievement acknowledgement only removes the displayed ID snapshot', () => {
  const state = fresh(); state.newAchievementIds = ['A001','A011','A021'];
  const next = reduceProgression(state, { type: 'achievements-seen', ids: ['A001','A011'] });
  assert.deepEqual(next.newAchievementIds, ['A021']);
  assert.strictEqual(reduceProgression(next, { type: 'achievements-seen', ids: ['A001','A999'] }), next);
});

test('inherited object-member IDs cannot enter achievement, receipt or daily entitlement maps', () => {
  const reserved = ['constructor', 'toString', '__proto__', 'hasOwnProperty', 'valueOf'];
  const dirty = login(fresh(), NOW);
  const entitlementId = getDailyView(dirty, NOW).entitlements[0].id;
  dirty.unlocked = JSON.parse(`{"constructor":${NOW},"toString":${NOW},"__proto__":${NOW},"A001":${NOW}}`);
  dirty.newAchievementIds = [...reserved, ['A001'], 'A001'];
  dirty.eventReceipts = Object.fromEntries(reserved.map(id => [id, NOW]));
  dirty.attemptCursors = Object.fromEntries(reserved.map(id => [id, 1]));
  dirty.completedGameIds = [...reserved];
  dirty.daily.claimReceipts = Object.fromEntries(reserved.map(id => [id, { multiplier: 2, at: NOW, entitlementIds: [entitlementId] }]));
  dirty.daily.claimReceipts.fake = { multiplier: 2, at: NOW, entitlementIds: [...reserved, [entitlementId]] };
  dirty.daily.adAttempts = Object.fromEntries(reserved.map(id => [id, { status: 'pending', startedAt: NOW, entitlementIds: [entitlementId] }]));
  dirty.daily.adAttempts.safe = { status: 'pending', startedAt: NOW, entitlementIds: [...reserved, [entitlementId]] };
  dirty.daily.activeAdAttemptId = '__proto__';
  const state = normalizeProgression(dirty, { now: NOW });
  assert.deepEqual(state.unlocked, { A001: NOW });
  assert.equal(state.points, 5);
  assert.deepEqual(state.newAchievementIds, ['A001']);
  assert.deepEqual(state.eventReceipts, {});
  assert.deepEqual(state.attemptCursors, {});
  assert.deepEqual(state.completedGameIds, []);
  assert.deepEqual(state.daily.claimReceipts, {});
  assert.deepEqual(state.daily.claims, {});
  assert.deepEqual(Object.keys(state.daily.adAttempts), ['safe']);
  assert.deepEqual(state.daily.adAttempts.safe.entitlementIds, []);
  assert.equal(getDailyView(state, NOW).adAttempt, null);
  assert.equal(getDailyView(state, NOW).hasClaim, true);
  assert.equal(evaluateAchievements(dirty, NOW).points, 5);
  for (const id of reserved) {
    assert.equal(achievementProgress(id, state), null);
    assert.strictEqual(reduceProgression(state, { type: 'daily-claim', eventId: id, now: NOW }), state);
    assert.strictEqual(reduceProgression(state, { type: 'daily-ad-start', eventId: `safe:${id}`, attemptId: id, now: NOW }), state);
    assert.strictEqual(reduceProgression(state, attempt({ gameId: id })), state);
  }
  const claimed = claim(state, 'valid-claim', NOW);
  assert.equal(claimed.wallet.hint, 1);
  assert.equal(getDailyView(claimed, NOW).hasClaim, false);
  assert.equal(Object.getPrototypeOf(claimed.daily.claims), Object.prototype);
});
