import test from 'node:test';
import assert from 'node:assert/strict';
import { createRealisticSample, normalizeRealisticSkill, recordRealisticAttempt, evolveRealisticSkill } from '../src/realistic-skill.js';
import { DUEL_TOTAL_SCORE, POINTS_PER_PAIR, TILES_PER_DUEL } from '../src/game-balance.js';

const profile = () => normalizeRealisticSkill();
const attempt = (extra = {}) => ({
  mode: 'duel', aiMode: 'realistic', gameId: 'duel-1', turn: 'you',
  attempts: 0, aiAttempts: 0, score: 0, aiScore: 0, realisticSample: createRealisticSample(), ...extra,
});
const completed = (extra = {}) => ({
  ...attempt(), tiles: Array.from({ length: TILES_PER_DUEL }, () => ({ removed: true })),
  attempts: 20, aiAttempts: 20, score: 1500, aiScore: DUEL_TOTAL_SCORE - 1500,
  realisticSample: { attempts: 20, matches: 15, hinted: false }, ...extra,
});

test('missing, malformed and future profiles normalize to a safe neutral starting skill', () => {
  const expected = { version: 1, level: 0.5, completedGames: 0, lastGameId: null };
  for (const value of [undefined, null, [], false, 'bad', {}, { version: 2, level: 1 }, { version: 1, level: NaN, completedGames: -1, lastGameId: '' }]) {
    assert.deepEqual(normalizeRealisticSkill(value), expected);
  }
  assert.deepEqual(normalizeRealisticSkill({ version: 1, level: '0.8', completedGames: 3.5, lastGameId: {} }), expected);
  assert.equal(normalizeRealisticSkill({ version: 1, level: -5 }).level, 0);
  assert.equal(normalizeRealisticSkill({ version: 1, level: 5 }).level, 1);
  assert.deepEqual(normalizeRealisticSkill({ version: 1, level: 0.7, completedGames: 8, lastGameId: 'past' }),
    { version: 1, level: 0.7, completedGames: 8, lastGameId: 'past' });
  assert.notStrictEqual(createRealisticSample(), createRealisticSample());
});

test('only resolved human attempts count, using public score and attempt changes', () => {
  const before = Object.freeze(attempt());
  const match = { ...before, attempts: 1, score: POINTS_PER_PAIR };
  const miss = { ...before, attempts: 1, turn: 'ai' };
  assert.deepEqual(recordRealisticAttempt(before, match), { attempts: 1, matches: 1, hinted: false });
  assert.deepEqual(recordRealisticAttempt(before, miss), { attempts: 1, matches: 0, hinted: false });
  assert.deepEqual(before.realisticSample, createRealisticSample(), 'the input stays immutable');
  for (const after of [null, before, { ...match, attempts: 2 }, { ...match, aiAttempts: 1 },
    { ...match, aiScore: 100 }, { ...match, score: 200 }, { ...match, gameId: 'different' },
    { ...match, mode: 'solo' }, { ...match, aiMode: 'modern' }]) {
    assert.deepEqual(recordRealisticAttempt(before, after), createRealisticSample());
  }
  for (const extra of [{ turn: 'ai' }, { mode: 'solo' }, { aiMode: 'modern' }, { aiMode: 'original' }, { gameId: null }]) {
    assert.deepEqual(recordRealisticAttempt({ ...before, ...extra }, { ...match, ...extra }), createRealisticSample());
  }
});

test('a hint excludes exactly the next human attempt, even after its highlight expires', () => {
  const before = attempt({ realisticSample: { attempts: 4, matches: 2, hinted: true }, hintEffect: null });
  const aiTurn = { ...before, turn: 'ai' };
  assert.equal(recordRealisticAttempt(aiTurn, { ...aiTurn, aiAttempts: 1, aiScore: 100 }).hinted, true);
  for (const score of [0, POINTS_PER_PAIR]) {
    const after = { ...before, attempts: 1, score };
    const sample = recordRealisticAttempt(before, after);
    assert.deepEqual(sample, { attempts: 4, matches: 2, hinted: false });
    const next = { ...after, realisticSample: sample };
    assert.deepEqual(recordRealisticAttempt(next, { ...next, attempts: 2, score: score + POINTS_PER_PAIR }),
      { attempts: 5, matches: 3, hinted: false });
  }
});

test('Freeze, Eagle Eye and shuffles do not change the observed accuracy of valid human attempts', () => {
  for (const extra of [{ freezeReady: true }, { eagleMs: 10000 }, { shuffles: 3 }]) {
    const before = attempt(extra);
    assert.deepEqual(recordRealisticAttempt(before, { ...before, attempts: 1, freezeReady: false }),
      { attempts: 1, matches: 0, hinted: false });
  }
});

test('skill rises and falls gradually after complete games, with a maximum 0.035 change', () => {
  const up = evolveRealisticSkill(profile(), completed());
  const down = evolveRealisticSkill(profile(), completed({ realisticSample: { attempts: 20, matches: 0, hinted: false } }));
  assert.equal(up.level, 0.535);
  assert.ok(Math.abs(down.level - 0.465) < Number.EPSILON);
  assert.equal(up.completedGames, 1);
  let improving = profile(), declining = profile();
  for (let i = 0; i < 20; i++) {
    const nextUp = evolveRealisticSkill(improving, completed({ gameId: `improving-${i}` }));
    const nextDown = evolveRealisticSkill(declining, completed({ gameId: `declining-${i}`, realisticSample: { attempts: 20, matches: 0 } }));
    assert.ok(nextUp.level > improving.level && nextUp.level - improving.level <= 0.035 + Number.EPSILON);
    assert.ok(nextDown.level < declining.level && declining.level - nextDown.level <= 0.035 + Number.EPSILON);
    improving = nextUp; declining = nextDown;
  }
  assert.ok(improving.level > 0.9 && improving.level < 1);
  assert.ok(declining.level < 0.1 && declining.level > 0);
});

test('the target uses unassisted match accuracy and moves 12% of the remaining gap near it', () => {
  const game = completed({ attempts: 25, realisticSample: { attempts: 25, matches: 13, hinted: false } });
  // 52% accuracy maps to a level of (0.52 - 0.10) / 0.65, then eases from 0.5.
  const expected = 0.5 + (((13 / 25 - 0.10) / 0.65) - 0.5) * 0.12;
  assert.equal(evolveRealisticSkill(profile(), game).level, expected);
  const atFloor = normalizeRealisticSkill({ version: 1, level: 0 });
  const atCeiling = normalizeRealisticSkill({ version: 1, level: 1 });
  assert.equal(evolveRealisticSkill(atFloor, completed({ realisticSample: { attempts: 20, matches: 2 } })).level, 0);
  assert.equal(evolveRealisticSkill(atCeiling, completed()).level, 1);
});

test('the winner and score gap do not control adaptation', () => {
  const sample = { attempts: 30, matches: 9, hinted: false };
  const lost = completed({ score: 900, aiScore: 2100, attempts: 30, aiAttempts: 25, realisticSample: sample });
  const won = completed({ score: 2100, aiScore: 900, attempts: 30, realisticSample: sample });
  assert.equal(evolveRealisticSkill(profile(), lost).level, evolveRealisticSkill(profile(), won).level);
});

test('unfinished, abandoned, old-mode and malformed games never update the profile', () => {
  const saved = normalizeRealisticSkill({ version: 1, level: 0.7, completedGames: 8, lastGameId: 'past' });
  const game = completed();
  for (const value of [null, {}, { ...game, aiMode: 'modern' }, { ...game, aiMode: 'original' },
    { ...game, mode: 'solo' }, { ...game, gameId: '' }, { ...game, score: 1499, aiScore: 1501 },
    { ...game, score: 1400 }, { ...game, attempts: 0 }, { ...game, aiAttempts: 0 },
    { ...game, tiles: [] }, { ...game, tiles: game.tiles.slice(1) },
    { ...game, tiles: [{ removed: false }, ...game.tiles.slice(1)] }]) {
    assert.deepEqual(evolveRealisticSkill(saved, value), saved);
  }
});

test('fewer than eight unassisted attempts finish once without changing the learned level', () => {
  const game = completed({ realisticSample: { attempts: 7, matches: 7, hinted: false } });
  const next = evolveRealisticSkill(profile(), game);
  assert.deepEqual(next, { ...profile(), completedGames: 1, lastGameId: game.gameId });
  assert.deepEqual(evolveRealisticSkill(next, game), next);
  assert.equal(evolveRealisticSkill(profile(), completed({ realisticSample: { attempts: 8, matches: 8 } })).level, 0.535);
  for (const sample of [undefined, {}, { attempts: 20, matches: 21 }, { attempts: 21, matches: 15 }, { attempts: 20, matches: 16 }]) {
    assert.equal(evolveRealisticSkill(profile(), completed({ realisticSample: sample })).level, 0.5);
  }
});

test('JSON persistence preserves the learning history and makes finish replay idempotent', () => {
  const game = completed();
  const learned = evolveRealisticSkill(profile(), game);
  const restored = normalizeRealisticSkill(JSON.parse(JSON.stringify(learned)));
  assert.deepEqual(restored, learned);
  assert.deepEqual(evolveRealisticSkill(restored, JSON.parse(JSON.stringify(game))), learned);
  const next = evolveRealisticSkill(restored, { ...game, gameId: 'duel-2' });
  assert.equal(next.completedGames, 2);
  assert.ok(next.level > learned.level);
});

test('learning needs no hidden face identities or solution and never edits the frozen match level', () => {
  const game = completed({ realisticState: Object.freeze({ skill: 0.5 }) });
  Object.defineProperty(game, 'solution', { get() { throw new Error('Hidden solution read'); } });
  for (const tile of game.tiles) {
    for (const key of ['faceId', 'matchKey']) Object.defineProperty(tile, key, { get() { throw new Error('Hidden tile read'); } });
    Object.freeze(tile);
  }
  Object.freeze(game.tiles); Object.freeze(game.realisticSample); Object.freeze(game);
  assert.equal(evolveRealisticSkill(profile(), game).level, 0.535);
  assert.equal(game.realisticState.skill, 0.5);
});
