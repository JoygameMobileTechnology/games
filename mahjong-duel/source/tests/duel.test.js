import test from 'node:test';
import assert from 'node:assert/strict';
import { createDuelState, getDuelOutcome, resolveDuelAttempt } from '../src/duel.js';
import { createGame, remainingCount } from '../src/engine.js';
import { tileSets } from '../src/tile-data.js';

const tile = (id, x, y = 0, z = 0, matchKey = 'pair') =>
  ({ id, x, y, z, matchKey, removed: false });
const duel = (tiles = [tile('a', 0), tile('b', 2)], extra = {}) =>
  ({ mode: 'duel', ...createDuelState(), tiles, ...extra });

test('a fresh duel starts with one shared board and independent zeroed scores and attempts', () => {
  const first = createDuelState();
  assert.deepEqual(first, { duelVersion: 1, turn: 'you', score: 0, aiScore: 0, attempts: 0, aiAttempts: 0 });
  assert.notStrictEqual(first, createDuelState());
  assert.equal(Object.hasOwn(first, 'tiles'), false, 'the existing game owns the shared board');
  assert.equal(Object.hasOwn(first, 'aiTiles'), false);
});

for (const actor of ['you', 'ai']) {
  const attemptKey = actor === 'you' ? 'attempts' : 'aiAttempts';
  const otherAttemptKey = actor === 'you' ? 'aiAttempts' : 'attempts';
  const scoreKey = actor === 'you' ? 'score' : 'aiScore';
  const otherScoreKey = actor === 'you' ? 'aiScore' : 'score';

  test(`${actor} earns exactly 100 points for a match and retains the turn`, () => {
    const spare = tile('spare', 4, 0, 0, 'other');
    const tiles = Object.freeze([tile('a', 0), tile('b', 2), spare].map(Object.freeze));
    const game = Object.freeze(duel(tiles, { turn: actor, score: 300, aiScore: 200, attempts: 4, aiAttempts: 5, elapsed: 77, combo: 3 }));
    const before = structuredClone(game);
    const next = resolveDuelAttempt(game, ['a', 'b']);
    assert.notStrictEqual(next, game);
    assert.notStrictEqual(next.tiles, tiles);
    assert.equal(remainingCount(next.tiles), 1);
    assert.ok(next.tiles[0].removed && next.tiles[1].removed);
    assert.strictEqual(next.tiles[2], spare);
    assert.equal(next.turn, actor);
    assert.equal(next[scoreKey], game[scoreKey] + 100);
    assert.equal(next[otherScoreKey], game[otherScoreKey]);
    assert.equal(next[attemptKey], game[attemptKey] + 1);
    assert.equal(next[otherAttemptKey], game[otherAttemptKey]);
    assert.equal(next.elapsed, 77);
    assert.equal(next.combo, 3, 'duel scoring does not apply a solo combo bonus');
    assert.deepEqual(game, before, 'resolution never mutates the game or its tiles');
    assert.strictEqual(resolveDuelAttempt(next, ['a', 'b']), next, 'already removed pairs cannot score again');
  });

  test(`${actor} passes the turn after a mismatch without removing tiles or changing scores`, () => {
    const tiles = Object.freeze([tile('a', 0), tile('b', 2, 0, 0, 'different')].map(Object.freeze));
    const game = Object.freeze(duel(tiles, { turn: actor, score: 300, aiScore: 200, attempts: 4, aiAttempts: 5 }));
    const next = resolveDuelAttempt(game, ['a', 'b']);
    assert.deepEqual(next, { ...game, turn: actor === 'you' ? 'ai' : 'you', [attemptKey]: game[attemptKey] + 1 });
    assert.strictEqual(next.tiles, tiles);
    assert.equal(game.turn, actor);
    assert.equal(game[attemptKey], actor === 'you' ? 4 : 5);
  });
}

test('invalid selections, turns and nonduel calls return the original game reference', () => {
  const game = duel();
  for (const ids of [undefined, null, 'ab', [], ['a'], ['a', 'b', 'c'], ['a', 'a'], ['a', 'missing'], ['missing', 'b']]) {
    assert.strictEqual(resolveDuelAttempt(game, ids), game);
  }
  for (const invalid of [null, undefined, {}, { ...game, mode: 'solo' }, { ...game, mode: undefined },
    { ...game, turn: undefined }, { ...game, turn: 'lin' }, { ...game, turn: '' }, { ...game, tiles: null }]) {
    assert.strictEqual(resolveDuelAttempt(invalid, ['a', 'b']), invalid);
  }
  const removed = duel([{ ...tile('a', 0), removed: true }, tile('b', 2)]);
  assert.strictEqual(resolveDuelAttempt(removed, ['a', 'b']), removed);
});

test('an overhead blocker prevents both matching and mismatching attempts for either actor', () => {
  for (const turn of ['you', 'ai']) {
    for (const matchKey of ['pair', 'other']) {
      const game = duel([tile('a', 0), tile('b', 2, 0, 0, matchKey), tile('cover', 0.5, 0.5, 1, 'cover')], { turn });
      assert.strictEqual(resolveDuelAttempt(game, ['a', 'b']), game);
      assert.strictEqual(resolveDuelAttempt(game, ['b', 'a']), game);
    }
  }
});

test('Eastern symbols and Western pictures score only when the same face is matched', () => {
  const fromFace = (face, id, x) => ({ ...face, id, faceId: face.id, x, y: 0, z: 0, removed: false });
  for (const faces of [tileSets.eastern.filter(face => face.family === 'glyph'), tileSets.western]) {
    const [first, second] = faces;
    const pictures = resolveDuelAttempt(duel([fromFace(first, 'a', 0), fromFace(second, 'b', 2)]), ['a', 'b']);
    assert.equal(pictures.score, 0);
    assert.equal(pictures.turn, 'ai', 'different pictures from the same family do not match');
    const copies = resolveDuelAttempt(duel([fromFace(first, 'a', 0), fromFace(first, 'b', 2)]), ['a', 'b']);
    assert.equal(copies.score, 100);
    assert.equal(copies.turn, 'you');
  }
});

test('the outcome waits for a shared empty board and compares scores regardless of the last actor', () => {
  assert.equal(getDuelOutcome(null), null);
  assert.equal(getDuelOutcome({}), null);
  assert.equal(getDuelOutcome({ ...duel([]), mode: 'solo' }), null);
  assert.equal(getDuelOutcome(duel()), null);
  assert.equal(getDuelOutcome(duel([tile('last', 0)], { score: 1000 })), null);
  assert.equal(getDuelOutcome(duel([], { score: 0, aiScore: 0 })), 'tie');
  for (const turn of ['you', 'ai']) {
    for (const [score, aiScore, outcome] of [[400, 200, 'win'], [200, 200, 'tie'], [100, 300, 'lose']]) {
      const before = duel(undefined, { turn, score: score - (turn === 'you' ? 100 : 0), aiScore: aiScore - (turn === 'ai' ? 100 : 0) });
      assert.equal(getDuelOutcome(before), null);
      const finished = resolveDuelAttempt(before, ['a', 'b']);
      assert.equal(finished.turn, turn);
      assert.equal(getDuelOutcome(finished), outcome, `${turn} clearing last does not override ${score}:${aiScore}`);
    }
  }
});

test('a complete seeded board has exactly 4000 shared points with either actor clearing it', () => {
  for (const ruleset of ['eastern', 'western']) {
    for (const actor of ['you', 'ai']) {
      const deal = createGame(ruleset, 203);
      let game = { ...deal, mode: 'duel', ...createDuelState(), turn: actor };
      for (const ids of deal.solution) {
        const next = resolveDuelAttempt(game, ids);
        assert.notStrictEqual(next, game);
        assert.equal(next.turn, actor);
        assert.equal(remainingCount(next.tiles), remainingCount(game.tiles) - 2);
        game = next;
      }
      assert.equal(game.score + game.aiScore, 4000);
      assert.equal(game.attempts + game.aiAttempts, 40);
      assert.equal(getDuelOutcome(game), actor === 'you' ? 'win' : 'lose');
    }
  }
});

test('uncovered memory tiles remain playable with both horizontal sides occupied', () => {
  for (const turn of ['you', 'ai']) {
    const game = duel([
      tile('left-a', 0, 0, 0, 'left'), tile('a', 1, 0), tile('right-a', 2, 0, 0, 'right'),
      tile('left-b', 0, 2, 0, 'left'), tile('b', 1, 2), tile('right-b', 2, 2, 0, 'right'),
    ], { turn });
    const next = resolveDuelAttempt(game, ['a', 'b']);
    assert.notStrictEqual(next, game);
    assert.equal(remainingCount(next.tiles), 4);
    assert.equal(next.turn, turn);
    assert.equal(next.score + next.aiScore, 100);
  }
});
