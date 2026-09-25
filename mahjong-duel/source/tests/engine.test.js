import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BOARD_WIDTH, BOARD_HEIGHT, TILE_COUNT, canMatch, createGame, getAvailablePairs,
  isFree, remainingCount, removePair, shuffleBoard, solveBoard, isCurrentCatalogueDeal,
} from '../src/engine.js';
import { tileSets, themeTileSets } from '../src/tile-data.js';
import { getFormation } from '../src/formations.js';

const tile = (id, x, y, z = 0, matchKey = 'test:pair') =>
  ({ id, faceId: id, x, y, z, matchKey, name: id, removed: false });

function playSolution(tiles, solution) {
  let current = tiles;
  for (const [firstId, secondId] of solution) {
    const first = current.find((value) => value.id === firstId);
    const second = current.find((value) => value.id === secondId);
    assert.ok(isFree(first, current), `${firstId} is free before removal`);
    assert.ok(isFree(second, current), `${secondId} is free before removal`);
    assert.ok(canMatch(first, second), 'solution pair follows the selected matching rules');
    const next = removePair(current, firstId, secondId);
    assert.equal(remainingCount(next), remainingCount(current) - 2);
    current = next;
  }
  assert.equal(remainingCount(current), 0, 'the complete round can be won');
}

test('only an overlapping higher tile blocks a memory flip; horizontal neighbours are allowed', () => {
  const left = tile('left', 0, 1);
  const middle = tile('middle', 1, 1);
  const right = tile('right', 2, 1);
  const row = [left, middle, right];
  assert.equal(isFree(left, row), true);
  assert.equal(isFree(middle, row), true, 'a tile surrounded on both horizontal sides can flip');
  assert.equal(isFree(right, row), true);
  assert.equal(isFree(middle, [left, middle, { ...right, removed: true }]), true);
  assert.equal(isFree(middle, [middle, tile('above', 1.5, 1.5, 1)]), false);
  assert.equal(isFree(middle, [middle, { ...tile('above', 1.5, 1.5, 1), removed: true }]), true, 'removing the overhead tile unlocks the covered face');
  assert.equal(isFree(middle, [middle, tile('near', 2, 1, 1)]), true, 'touching edges do not cover');
  assert.equal(isFree(middle, [middle, tile('up', 1, 0), tile('down', 1, 2)]), true);
  assert.equal(isFree(middle, [{ ...middle, removed: true }]), false, 'stale objects cannot revive tiles');
  assert.equal(isFree(middle, []), false, 'a tile must belong to the current board');
});

test('two uncovered middle tiles can match even when both horizontal sides are occupied', () => {
  const board = [
    tile('left-a', 0, 0, 0, 'left'), tile('middle-a', 1, 0), tile('right-a', 2, 0, 0, 'right'),
    tile('left-b', 0, 1, 0, 'left'), tile('middle-b', 1, 1), tile('right-b', 2, 1, 0, 'right'),
  ];
  const next = removePair(board, 'middle-a', 'middle-b');
  assert.equal(remainingCount(next), 4);
  assert.ok(next.find(value => value.id === 'middle-a').removed);
  assert.ok(next.find(value => value.id === 'middle-b').removed);
});

test('every Eastern and Western kind requires its own exact face, including unranked symbols', () => {
  for (const sets of Object.values(themeTileSets)) {
    for (const faces of Object.values(sets)) {
      assert.equal(faces.length, 40);
      assert.equal(new Set(faces.map(face => face.matchKey)).size, 40);
      assert.equal(faces.reduce((sum, face) => sum + face.copies, 0), 160);
      for (const [index, face] of faces.entries()) {
        assert.equal(face.copies, 4);
        assert.ok(!['season', 'flower'].includes(face.family));
        if (face.family === 'glyph') {
          assert.equal(face.rank, null);
          assert.equal(face.pipCount, 0);
        }
        assert.equal(canMatch(face, faces[(index + 1) % faces.length]), false);
        assert.ok(canMatch(face, { ...face, id: 'other-copy' }));
        assert.equal(canMatch(face, face), false);
      }
    }
  }
  assert.equal(canMatch({ id: 'a' }, { id: 'b' }), false);
});

test('each seeded deal preserves catalogue copy rules and fits portrait bounds', () => {
  for (const ruleset of ['eastern', 'western']) {
    const game = createGame(ruleset, 1234);
    assert.equal(game.theme, 'ming-porcelain');
    assert.equal(TILE_COUNT, 80);
    assert.equal(game.tiles.length, 80);
    assert.equal(game.solution.length, 40);
    assert.equal(new Set(game.tiles.map((value) => value.id)).size, 80);
    assert.equal(new Set(game.tiles.map((value) => value.matchKey)).size, 20);
    assert.equal(new Set(game.tiles.map((value) => value.faceId)).size, 20);
    const positions = values => values.map(({ x, y, z }) => `${x},${y},${z}`).sort();
    assert.deepEqual(positions(game.tiles), positions(getFormation(game.formationId).slots));
    const counts = new Map();
    for (const value of game.tiles) {
      assert.ok(value.x >= 0 && value.x + 1 <= BOARD_WIDTH);
      assert.ok(value.y >= 0 && value.y + 1 <= BOARD_HEIGHT);
      counts.set(value.faceId, (counts.get(value.faceId) || 0) + 1);
    }
    for (const value of game.tiles) {
      assert.equal(counts.get(value.faceId), 4);
    }
    assert.equal(game.tiles.filter((value) => ['season', 'flower'].includes(value.family)).length, 0);
    assert.deepEqual(game, createGame(ruleset, 1234));
    assert.notDeepEqual(game.tiles, createGame(ruleset, 1235).tiles);
  }
});

test('saved deal validation retains current exact-picture boards and rejects old bonus-family inventories', () => {
  for (const ruleset of ['eastern', 'western']) {
    const game = createGame(ruleset, 29);
    assert.equal(isCurrentCatalogueDeal(game), true);
    assert.equal(isCurrentCatalogueDeal({ ...game, tiles: game.tiles.map(tile => ({ ...tile, removed: true })) }), true);
    const oldRules = structuredClone(game);
    oldRules.tiles[0] = { ...oldRules.tiles[0], faceId: 'S01', family: 'season', copies: 1, matchKey: 'season' };
    assert.equal(isCurrentCatalogueDeal(oldRules), false, 'old season/flower boards cannot resume');
    const staleKey = structuredClone(game);
    staleKey.tiles[0].matchKey = 'previous-catalogue-key';
    assert.equal(isCurrentCatalogueDeal(staleKey), false, 'obsolete matching keys cannot resume');
    const wrongCopies = structuredClone(game);
    const other = wrongCopies.tiles.find(tile => tile.faceId !== wrongCopies.tiles[0].faceId);
    wrongCopies.tiles[0] = { ...other, id: wrongCopies.tiles[0].id };
    assert.equal(isCurrentCatalogueDeal(wrongCopies), false, 'each chosen face must retain four copies');
  }
  assert.equal(isCurrentCatalogueDeal(null), false);
  assert.equal(isCurrentCatalogueDeal({ theme: 'missing', ruleset: 'eastern', tiles: [] }), false);
});

test('all nine themes keep draw composition, matching rules, layout and solvability consistent', () => {
  assert.equal(Object.keys(themeTileSets).length, 9);
  assert.strictEqual(tileSets, themeTileSets['ming-porcelain'], 'the original catalogue remains a Ming alias');
  for (const ruleset of ['eastern', 'western']) {
    for (const difficulty of ['calm', 'balanced', 'intricate']) {
      const reference = createGame(ruleset, 721, difficulty);
      for (const [theme, sets] of Object.entries(themeTileSets)) {
        const game = createGame(ruleset, 721, difficulty, theme);
        assert.equal(game.theme, theme);
        assert.equal(game.tiles.length, 80);
        assert.equal(new Set(game.tiles.map(value => value.matchKey)).size, 20);
        assert.deepEqual(game.tiles.map(({ id, faceId, x, y, z, family, rank }) => ({ id, faceId, x, y, z, family, rank })),
          reference.tiles.map(({ id, faceId, x, y, z, family, rank }) => ({ id, faceId, x, y, z, family, rank })),
          `${theme} cosmetics do not change the chosen kinds or their positions`);
        for (const face of game.tiles) {
          const definition = sets[ruleset].find(value => value.id === face.faceId);
          assert.equal(face.src, definition.src);
          assert.equal(face.matchKey, definition.matchKey);
        }
        playSolution(game.tiles, game.solution);
      }
    }
  }
});

test('difficulty changes the Eastern draw using the supplied similarity axes', () => {
  const expected = {
    calm: { anchor: 10, count: 3, tier: 3, kin: 4, glyph: 0 },
    balanced: { anchor: 6, count: 6, tier: 5, kin: 3, glyph: 0 },
    intricate: { anchor: 4, count: 6, tier: 5, kin: 1, glyph: 4 },
  };
  for (const difficulty of ['calm', 'balanced', 'intricate']) {
    for (const seed of [0, 1, 14, 52, 999]) {
      const game = createGame('eastern', seed, difficulty);
      assert.equal(game.difficulty, difficulty);
      assert.deepEqual(game, createGame('eastern', seed, difficulty));
      assert.equal(new Set(game.tiles.map((value) => value.matchKey)).size, 20);
      assert.equal(game.tiles.length, 80);
      for (const [family, count] of Object.entries(expected[difficulty])) {
        const faces = game.tiles.filter((value) => value.family === family);
        assert.equal(new Set(faces.map((value) => value.faceId)).size, count, `${difficulty} ${family}`);
      }
      const ranks = (family) => [...new Set(game.tiles.filter((value) => value.family === family).map((value) => value.rank))].sort();
      assert.deepEqual(ranks('count'), difficulty === 'calm' ? [1, 3, 6] : [1, 2, 3, 4, 5, 6]);
      assert.deepEqual(ranks('tier'), difficulty === 'calm' ? [1, 3, 5] : [1, 2, 3, 4, 5]);
    }
  }
  assert.deepEqual(createGame('eastern', 27), createGame('eastern', 27, 'balanced'));
  assert.deepEqual(createGame('western', 27, 'calm').tiles, createGame('western', 27, 'intricate').tiles,
    'Western picture selection has no Eastern difficulty axis');
});

test('100 deals of every Eastern difficulty and Western rules have complete legal solutions', () => {
  for (const [ruleset, difficulty] of [['eastern', 'calm'], ['eastern', 'balanced'], ['eastern', 'intricate'], ['western', 'balanced']]) {
    for (let seed = 0; seed < 100; seed += 1) {
      const game = createGame(ruleset, seed, difficulty);
      playSolution(game.tiles, game.solution);
    }
  }
});

test('invalid removal attempts do not mutate or change the board', () => {
  const game = createGame('eastern', 40);
  const before = structuredClone(game.tiles);
  const freePair = getAvailablePairs(game.tiles)[0];
  assert.strictEqual(removePair(game.tiles, 'missing', freePair[0].id), game.tiles);
  assert.strictEqual(removePair(game.tiles, freePair[0].id, freePair[0].id), game.tiles);
  const blocked = game.tiles.find((value) => !isFree(value, game.tiles));
  const sameFace = game.tiles.find((value) => value.id !== blocked.id && value.matchKey === blocked.matchKey);
  assert.strictEqual(removePair(game.tiles, blocked.id, sameFace.id), game.tiles);
  const next = removePair(game.tiles, freePair[0].id, freePair[1].id);
  assert.equal(remainingCount(next), 78);
  assert.strictEqual(removePair(next, freePair[0].id, freePair[1].id), next);
  assert.deepEqual(game.tiles, before);
});

test('shuffling arbitrary legal progress preserves exact identities and creates a winning path', () => {
  for (const [ruleset, difficulty] of [['eastern', 'calm'], ['eastern', 'balanced'], ['eastern', 'intricate'], ['western', 'balanced']]) {
    for (let seed = 0; seed < 30; seed += 1) {
      let { tiles } = createGame(ruleset, seed, difficulty);
      for (let move = 0; move < 12; move += 1) {
        const pairs = getAvailablePairs(tiles);
        if (!pairs.length) break;
        const pair = pairs[(seed + move * 3) % pairs.length];
        tiles = removePair(tiles, pair[0].id, pair[1].id);
      }
      const before = structuredClone(tiles);
      const result = shuffleBoard(tiles, seed + 2000);
      assert.deepEqual(tiles, before, 'shuffle is immutable');
      for (let i = 0; i < tiles.length; i += 1) {
        const original = tiles[i];
        const moved = result.tiles[i];
        assert.equal(moved.id, original.id);
        assert.equal(moved.faceId, original.faceId);
        assert.equal(moved.matchKey, original.matchKey);
        assert.equal(moved.removed, original.removed);
        if (original.removed) assert.strictEqual(moved, original);
      }
      playSolution(result.tiles, result.solution);
      assert.deepEqual(result, shuffleBoard(tiles, seed + 2000), 'shuffle is seeded');
    }
  }
});

test('shuffle rescues an unpeelable surviving stack and handles completed boards', () => {
  const stacked = [tile('bottom', 0, 0), tile('top', 0, 0, 1)];
  assert.equal(getAvailablePairs(stacked).length, 0);
  const rescued = shuffleBoard(stacked, 42);
  assert.equal(rescued.reflowed, true);
  playSolution(rescued.tiles, rescued.solution);
  const finished = stacked.map((value) => ({ ...value, removed: true }));
  assert.deepEqual(shuffleBoard(finished, 42), { tiles: finished, solution: [], reflowed: false });
});

test('malformed matching populations and duplicate IDs are rejected before shuffling', () => {
  assert.throws(() => shuffleBoard([tile('a', 0, 0)], 1), /even number/);
  assert.throws(() => shuffleBoard([tile('a', 0, 0), tile('a', 1, 0)], 1), /unique identity/);
  assert.throws(() => shuffleBoard([tile('a', NaN, 0), tile('b', 1, 0)], 1), /finite numbers/);
  assert.throws(() => createGame('not-a-ruleset', 1), /Unknown ruleset/);
  assert.throws(() => createGame('toString', 1), /Unknown ruleset/);
  assert.throws(() => createGame('eastern', 1, 'unknown'), /Unknown difficulty/);
  assert.throws(() => createGame('eastern', 1, 'toString'), /Unknown difficulty/);
  assert.throws(() => createGame('eastern', Infinity), /finite integer/);
  assert.throws(() => createGame('eastern', 1, 'calm', 'missing-theme'), /Unknown theme/);
  assert.throws(() => createGame('eastern', 1, 'calm', 'toString'), /Unknown theme/);
});

test('bounded solver distinguishes a complete win from impossible and exhausted searches', () => {
  const solvable = [tile('a', 0, 0), tile('b', 1, 0), tile('c', 0, 1), tile('d', 1, 1)];
  playSolution(solvable, solveBoard(solvable));
  assert.deepEqual(solveBoard([]), []);
  assert.equal(solveBoard([tile('a', 0, 0), tile('b', 0, 0, 1)]), null);
  assert.equal(solveBoard(solvable, { maxStates: 0 }), null);
});
