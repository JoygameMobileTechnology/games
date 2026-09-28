import test from 'node:test';
import assert from 'node:assert/strict';
import { createDuelState, resolveDuelAttempt } from '../src/duel.js';
import { useBooster, advanceBoosterEffects } from '../src/boosters.js';
import { createDuelTracker, observeFlip, resolveTrackedAttempt, trackBooster, trackAutomaticShuffle, completedDuelEvent, coalesceStreakCues, PAIR_CHAIN_NAMES } from '../src/duel-progress.js';

function harness(extra = {}, trackerExtra = {}) {
  let game = { ...createDuelState(), mode: 'duel', gameId: 'fixture-duel', theme: 'ming-porcelain', ruleset: 'eastern', formationId: 'crown',
    boosters: { shuffle: 5, hint: 5, freeze: 5, eagle: 5 }, freezeReady: false, eagleMs: 0,
    tiles: Array.from({ length: 80 }, (_, n) => ({ id: `t${n}`, matchKey: `face${Math.floor(n / 4)}`, x: n * 2, y: 0, z: 0, removed: false })), ...extra };
  let tracker = { ...createDuelTracker(game), ...trackerExtra };
  return {
    get game() { return game; }, get tracker() { return tracker; },
    patch(value) { game = { ...game, ...value }; },
    flip(id) { tracker = observeFlip(tracker, id); },
    attempt(ids, actor = game.turn, rarity = 'marble') {
      const before = { ...game, turn: actor }, after = resolveDuelAttempt(before, ids);
      const result = resolveTrackedAttempt(tracker, before, after, ids, { rarity, now: 12345 });
      assert.ok(result.event, `valid attempt ${ids} should resolve`); game = after; tracker = result.tracker; return result;
    },
    pair(actor = game.turn, rarity) {
      const first = game.tiles.find(tile => !tile.removed), second = game.tiles.find(tile => !tile.removed && tile.id !== first.id && tile.matchKey === first.matchKey);
      return this.attempt([first.id, second.id], actor, rarity);
    },
    booster(id) {
      const before = { ...game, turn: 'you' }, after = useBooster(before, id), result = trackBooster(tracker, before, after, id);
      assert.ok(result.event, `${id} activation should have a receipt`); tracker = result.tracker; game = after; return { ...result, before, after };
    },
    automaticShuffle() { tracker = trackAutomaticShuffle(tracker); },
  };
}
const hasCue = (result, id) => result.cues.some(cue => cue.id === id);
const delta = (result, id) => result.event.counterDeltas[id] || 0;

test('only authoritative resolved attempts produce stable receipts; invalid/replayed attempts do nothing', () => {
  const h = harness(), initial = h.tracker, before = h.game;
  for (const ids of [[], ['t0'], ['t0', 't0'], ['missing', 't1']]) assert.equal(resolveTrackedAttempt(initial, before, before, ids).event, null);
  h.flip('t0'); assert.equal(h.tracker.attemptSequence, 0); assert.equal(h.tracker.chain, 0);
  const result = h.attempt(['t0', 't1']);
  assert.equal(result.event.eventId, 'fixture-duel:attempt:1');
  assert.equal(result.event.actor, 'you'); assert.equal(result.event.now, 12345);
  assert.deepEqual(result.event.physicalTileIds, ['t0', 't1']);
  assert.equal(Object.hasOwn(result.event.counterDeltas, 'personalPairs'), false, 'durable reducer owns personal-pair increment');
  assert.equal(resolveTrackedAttempt(result.tracker, before, h.game, ['t0', 't1']).event, null, 'same transition cannot count twice');
  assert.equal(initial.attemptSequence, 0, 'tracker transitions do not mutate their input');
});

test('all fourteen chain names escalate; opponent moves, shuffles and boosters preserve chain; local Freeze miss resets', () => {
  const h = harness();
  assert.deepEqual(h.pair().cues, []);
  for (let count = 2; count <= 16; count++) {
    const result = h.pair('you'), cue = result.cues.find(item => item.family === 'chain');
    assert.equal(cue.name, PAIR_CHAIN_NAMES[Math.min(count, 15) - 2]); assert.equal(cue.count, count);
    assert.equal(cue.peak, count === 15); assert.equal(cue.reinforcement, count > 15);
    assert.equal(result.event.counterMaxima.bestPairChain, count);
  }
  const before = h.tracker.chain;
  h.pair('ai'); h.attempt(['t34', 't36'], 'ai'); h.automaticShuffle(); h.booster('shuffle'); h.booster('freeze');
  assert.equal(h.tracker.chain, before);
  const missed = h.attempt(['t34', 't36'], 'you');
  assert.equal(missed.tracker.chain, 0); assert.equal(missed.event.boosterState.freezeConsumed, true);
  assert.deepEqual(missed.cues, []);
  assert.equal(h.pair('you').tracker.chain, 1);
});

test('memory takes a pre-first-flip snapshot, credits actual earlier human/opponent flips, and uses physical identities', () => {
  const fresh = harness(); fresh.flip('t0'); fresh.flip('t1');
  const selfObserved = fresh.attempt(['t0', 't1']);
  assert.equal(delta(selfObserved, 'rememberedPairs'), 0); assert.equal(delta(selfObserved, 'pairsWithNeitherFacePreviouslyObserved'), 1);
  const h = harness(); h.attempt(['t0', 't4'], 'you'); h.attempt(['t1', 't5'], 'ai');
  const recall = h.attempt(['t0', 't1'], 'you');
  assert.equal(delta(recall, 'rememberedPairs'), 1); assert.equal(recall.event.counterMaxima.maxRememberedPairsInDuel, 1);
  assert.equal(delta(recall, 'matchesImmediatelyAfterOpponentMiss'), 1); assert.equal(delta(recall, 'matchesAfterOwnPreviousAttemptMissed'), 1);
  assert.equal(delta(recall, 'delayedRecallPairs'), 0);
  const unseenCopies = h.attempt(['t2', 't3'], 'you');
  assert.equal(delta(unseenCopies, 'rememberedPairs'), 0); assert.equal(delta(unseenCopies, 'pairsWithNeitherFacePreviouslyObserved'), 1);
  assert.equal(unseenCopies.event.counterMaxima.maxFullyCollectedFaceKeysInDuel, 1);
  assert.equal(unseenCopies.event.counterMaxima.maxDistinctMatchedFaceKeysInDuel, 1);
  const opponent = h.attempt(['t4', 't5'], 'ai');
  assert.deepEqual(opponent.event.counterDeltas, {}); assert.deepEqual(opponent.event.counterMaxima, {});
});

test('delayed recall requires three intervening completed attempts since EACH latest earlier observation', () => {
  const h = harness(); h.attempt(['t0', 't4']); h.attempt(['t1', 't5'], 'ai');
  for (let i = 0; i < 3; i++) h.attempt(['t8', 't12'], i % 2 ? 'ai' : 'you');
  const result = h.attempt(['t0', 't1'], 'you'); assert.equal(delta(result, 'delayedRecallPairs'), 1);
  const refreshed = harness(); refreshed.attempt(['t0', 't4']); refreshed.attempt(['t1', 't5'], 'ai');
  for (let i = 0; i < 4; i++) refreshed.attempt(['t8', 't12'], 'ai');
  refreshed.attempt(['t0', 't4'], 'ai');
  assert.equal(delta(refreshed.attempt(['t0', 't1'], 'you'), 'delayedRecallPairs'), 0, 'latest sighting replaces an older one');
});

test('manual and automatic shuffles erase positional evidence and pending Hint/Shuffle checks, not chain or Freeze follow-through', () => {
  for (const kind of ['manual', 'automatic']) {
    const h = harness(); h.attempt(['t0', 't4']); h.attempt(['t1', 't5'], 'ai'); h.booster('hint');
    if (kind === 'manual') h.booster('shuffle'); else h.automaticShuffle();
    const pair = h.attempt(['t0', 't1'], 'you');
    assert.equal(pair.event.arrangementVersion, 1); assert.equal(delta(pair, 'rememberedPairs'), 0);
    assert.equal(delta(pair, 'successfullyFollowedHints'), 0);
  }
  const h = harness(); h.booster('freeze'); h.attempt(['t0', 't4'], 'you'); h.automaticShuffle();
  assert.equal(delta(h.pair('you'), 'freezeSavesFollowedByImmediateMatch'), 1);
});

test('Hint follows only its exact next valid LOCAL pair, independently of visual expiry; reactivation replaces marker', () => {
  const h = harness(), activation = h.booster('hint');
  assert.equal(trackBooster(h.tracker, activation.before, activation.after, 'hint').event, null);
  h.patch(advanceBoosterEffects(h.game, 1600));
  h.attempt(['t8', 't12'], 'ai');
  const followed = h.attempt(activation.after.hintEffect.ids, 'you');
  assert.equal(delta(followed, 'successfullyFollowedHints'), 1); assert.equal(delta(followed, 'rememberedPairs'), 0);
  assert.equal(delta(h.pair('you'), 'successfullyFollowedHints'), 0);
  const miss = harness(); miss.booster('hint'); miss.attempt(['t0', 't4'], 'you');
  assert.equal(delta(miss.attempt(['t0', 't1'], 'you'), 'successfullyFollowedHints'), 0);
  const replaced = harness(); replaced.booster('hint'); replaced.patch({ hintEffect: null });
  const newer = replaced.booster('hint'); assert.equal(replaced.tracker.hintMarker.eventId, newer.event.eventId);
});

test('Freeze and paid Shuffle run windows credit first/third matches once and cancel on a local mismatch', () => {
  for (const id of ['freeze', 'shuffle']) {
    const h = harness(), prefix = id === 'freeze' ? 'freezeSavesFollowedBy' : 'paidShufflesFollowedBy';
    h.booster(id); if (id === 'freeze') h.attempt(['t0', 't4'], 'you');
    assert.equal(delta(h.pair('you'), `${prefix}ImmediateMatch`), 1);
    h.attempt(['t8', 't12'], 'ai');
    assert.equal(delta(h.pair('you'), `${prefix}ThreePairRun`), 0);
    assert.equal(delta(h.pair('you'), `${prefix}ThreePairRun`), 1);
    assert.equal(delta(h.pair('you'), `${prefix}ThreePairRun`), 0);
    const canceled = harness(); canceled.booster(id); if (id === 'freeze') canceled.attempt(['t0', 't4'], 'you');
    canceled.attempt(['t0', 't4'], 'you');
    assert.equal(delta(canceled.pair('you'), `${prefix}ImmediateMatch`), 0);
  }
  const twice = harness(); twice.booster('shuffle'); twice.booster('shuffle');
  assert.equal(delta(twice.pair('you'), 'paidShufflesFollowedByImmediateMatch'), 1, 'new activation replaces old pending receipt');
});

test('Eagle Eye credits only local active-timer matches of their real rarity and never creates memory evidence', () => {
  const h = harness(); h.booster('eagle');
  assert.deepEqual(h.tracker.observations, {});
  const gold = h.pair('you', 'gold'); assert.equal(delta(gold, 'matchedPairsDuringEagleEye'), 1); assert.equal(delta(gold, 'goldOrCelestialPairsDuringEagleEye'), 1);
  assert.equal(delta(h.pair('you', { id: 'gold' }), 'goldOrCelestialPairsDuringEagleEye'), 1);
  for (const rarity of ['marble', 'sapphire', 'amethyst', 'celestial']) {
    const ordinary = h.pair('you', rarity);
    assert.equal(delta(ordinary, 'matchedPairsDuringEagleEye'), 1);
    assert.equal(delta(ordinary, 'goldOrCelestialPairsDuringEagleEye'), 0, rarity);
  }
  const opponent = h.pair('ai', 'gold');
  assert.equal(delta(opponent, 'matchedPairsDuringEagleEye'), 0);
  assert.equal(delta(opponent, 'goldOrCelestialPairsDuringEagleEye'), 0);
  h.patch({ eagleMs: 0 }); assert.equal(delta(h.pair('you', 'gold'), 'goldOrCelestialPairsDuringEagleEye'), 0);
});

test('Turning Points use local-perspective crossings, genuine prior opponent lead, threshold limits and episode rearming', () => {
  const opening = harness(); assert.equal(hasCue(opening.pair('you'), 'turning_comeback_lead'), false);
  const comeback = harness(); comeback.pair('ai');
  assert.equal(hasCue(comeback.pair('you'), 'turning_equalize'), true);
  assert.equal(hasCue(comeback.pair('you'), 'turning_comeback_lead'), true);
  comeback.pair('ai'); assert.equal(hasCue(comeback.pair('you'), 'turning_comeback_lead'), false, 'restoring own lead is not a comeback');
  const lead = harness(); for (let i = 0; i < 4; i++) lead.pair('you');
  assert.equal(hasCue(lead.pair('you'), 'turning_lead_five'), true);
  lead.pair('ai'); assert.equal(hasCue(lead.pair('you'), 'turning_lead_five'), false, 'same lead episode latches');
  for (let i = 0; i < 5; i++) lead.pair('ai');
  for (let i = 0; i < 4; i++) lead.pair('you');
  assert.equal(hasCue(lead.pair('you'), 'turning_lead_five'), true, 'opponent-created tie rearms local event');
  const deficit = harness(); for (let i = 0; i < 5; i++) deficit.pair('ai');
  assert.equal(hasCue(deficit.pair('you'), 'turning_recover_four'), true);
  deficit.pair('ai'); assert.equal(hasCue(deficit.pair('you'), 'turning_recover_four'), false);
  const composed = harness({ score: 1600, aiScore: 1900 }); assert.equal(hasCue(composed.pair('you'), 'turning_four_to_win'), true);
  const cannotWin = harness({ score: 1600, aiScore: 2000 }); assert.equal(hasCue(cannotWin.pair('you'), 'turning_four_to_win'), false);
  const resolute = harness({ score: 1700, aiScore: 1900 });
  const cue = resolute.pair('ai').cues.find(item => item.id === 'turning_draw_only');
  assert.equal(cue.owner, 'you'); assert.equal(cue.subtitle, 'Match the remaining pairs to draw');
});

test('victory freezes qualification at 21; cleanup still earns pairs/chains but cannot rewrite or create winning facts', () => {
  const h = harness(); for (let i = 0; i < 20; i++) h.pair('you');
  const secured = h.pair('you'); assert.equal(hasCue(secured, 'turning_win_secured'), true);
  assert.equal(completedDuelEvent(h.tracker, h.game, 'win'), null, '21 is not board completion');
  const snapshot = structuredClone(h.tracker.winningSnapshot);
  assert.equal(snapshot.conditionalWins.noMismatch, true); assert.equal(snapshot.conditionalWins.noBoosters, true);
  assert.equal(snapshot.conditionalWins.frontRunner, true); assert.equal(snapshot.conditionalWins.chainFinishFive, true);
  h.booster('hint'); h.attempt(['t42', 't44'], 'you');
  while (h.game.tiles.some(tile => !tile.removed)) {
    const result = h.pair('ai'); assert.equal(result.cues.length, 0, 'no comparative cues or opponent chain during cleanup');
  }
  assert.deepEqual(h.tracker.winningSnapshot, snapshot);
  const complete = completedDuelEvent(h.tracker, h.game, 'win', 99);
  assert.equal(complete.eventId, 'fixture-duel:complete'); assert.deepEqual(complete.afterPairs, { you: 21, ai: 19 });
  assert.equal(complete.conditionalWins.closeFinish, false, 'cleanup cannot make a false close finish true');
  assert.equal(complete.conditionalWins.noBoosters, true); assert.equal(complete.conditionalWins.noMismatch, true);
  assert.deepEqual(completedDuelEvent(h.tracker, h.game, 'win', 99), complete, 'completion replay has stable identity');
  assert.equal(completedDuelEvent(h.tracker, h.game, 'tie'), null);
});

test('winning snapshot captures ten-pair recovery, actual leader changes through ties and all four booster types', () => {
  const h = harness(); for (let i = 0; i < 10; i++) h.pair('ai');
  for (const id of ['hint', 'freeze', 'eagle', 'shuffle']) h.booster(id);
  for (let i = 0; i < 11; i++) h.pair('you'); // first actual leader change
  h.pair('ai'); h.pair('ai'); // second, tie itself does not change leader
  h.pair('you'); h.pair('you'); // third
  assert.equal(h.tracker.leadChanges, 3);
  while (h.game.score < 2100) h.pair('you');
  const facts = h.tracker.winningSnapshot.conditionalWins;
  for (const key of ['recoverFive', 'recoverTen', 'opponentFirst', 'threeLeadChanges', 'allFourBoosters']) assert.equal(facts[key], true, key);
  assert.equal(facts.exactlyOneBooster, false); assert.equal(facts.frontRunner, false);
});

test('final draw is local-owned regardless of last actor; opponent securing 21 emits no streak', () => {
  for (const lastActor of ['you', 'ai']) {
    const h = harness();
    for (let i = 0; i < 20; i++) h.pair(lastActor === 'you' ? 'ai' : 'you');
    for (let i = 0; i < 19; i++) h.pair(lastActor);
    const last = h.pair(lastActor);
    const cue = last.cues.find(item => item.id === 'turning_draw_final');
    assert.equal(cue.owner, 'you'); assert.equal(hasCue(last, 'turning_equalize'), false);
    assert.equal(completedDuelEvent(h.tracker, h.game, 'tie').outcome, 'tie');
  }
  const loss = harness(); for (let i = 0; i < 20; i++) loss.pair('ai');
  assert.deepEqual(loss.pair('ai').cues, []);
  for (let i = 0; i < 19; i++) assert.ok(loss.pair('you').cues.every(cue => cue.family === 'chain'));
});

test('presentation admits only local ownership, deduplicates, and coalesces to highest-priority primary plus one secondary', () => {
  const h = harness({ score: 2000 }), result = h.pair('you');
  const cues = [
    { family: 'chain', id: 'chain_15', name: 'Phenomenal', count: 15, eventId: 'chain', actor: 'you', owner: 'you' },
    { family: 'turning', id: 'turning_comeback_lead', eventId: 'comeback', actor: 'you', owner: 'you' },
    { family: 'turning', id: 'turning_draw_only', eventId: 'resolute', actor: 'you', owner: 'you' },
    ...result.cues,
  ];
  assert.equal(coalesceStreakCues(cues)[0].id, 'turning_win_secured');
  assert.equal(coalesceStreakCues(cues)[1].id, 'turning_draw_only');
  assert.equal(coalesceStreakCues([...cues, ...cues]).length, 2);
  assert.deepEqual(coalesceStreakCues(cues.map(cue => ({ ...cue, actor: 'ai' }))), []);
  assert.deepEqual(coalesceStreakCues(cues.map(cue => ({ ...cue, owner: 'ai' }))), []);
});

test('close-finish, exactly-one-booster and mismatch limits reflect the 21st pair precisely', () => {
  const h = harness(); h.booster('hint');
  for (let i = 0; i < 3; i++) h.attempt(['t0', 't4'], 'you');
  for (let i = 0; i < 19; i++) h.pair('ai');
  for (let i = 0; i < 21; i++) h.pair('you');
  const facts = completedDuelEvent(h.tracker, h.game, 'win').winningSnapshot.conditionalWins;
  assert.equal(facts.closeFinish, true); assert.equal(facts.exactlyOneBooster, true);
  assert.equal(facts.noMismatch, false); assert.equal(facts.atMostTwoMisses, false);
  assert.equal(facts.noBoosters, false); assert.equal(facts.allFourBoosters, false);
});

test('one known tile is neither full recall nor a wholly fresh pair; automatic recovery cancels a paid Shuffle run', () => {
  const h = harness(); h.attempt(['t0', 't4']);
  const oneKnown = h.attempt(['t0', 't1'], 'you');
  assert.equal(delta(oneKnown, 'rememberedPairs'), 0); assert.equal(delta(oneKnown, 'pairsWithNeitherFacePreviouslyObserved'), 0);
  h.booster('shuffle'); h.pair('you'); h.pair('you'); h.automaticShuffle();
  const third = h.pair('you');
  assert.equal(delta(third, 'paidShufflesFollowedByThreePairRun'), 0);
  assert.equal(third.tracker.chain, 4, 'shuffle does not affect pair-chain continuity');
});
