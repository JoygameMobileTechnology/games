import test from 'node:test';
import assert from 'node:assert/strict';
import { themes, launchThemeIds, themeById, defaultTheme, rulesetForTheme } from '../src/themes.js';
import { createThemeGame } from '../src/engine.js';
import { rarityForTile } from '../src/rarity.js';
import { boardVariants } from '../src/board-variants.js';
import { themeTileSets } from '../src/tile-data.js';

const expected = ['ming-porcelain', 'dancheong', 'stained-glass', 'dutch-golden-age'];

test('game theme selectors and board artwork expose only the four launch collections', () => {
  assert.deepEqual(launchThemeIds, expected);
  assert.deepEqual(themes.map(theme => theme.id), expected);
  assert.deepEqual(Object.keys(themeById), expected);
  assert.deepEqual(Object.keys(boardVariants), expected);
  assert.equal(defaultTheme.id, 'ming-porcelain');
  assert.equal(Object.keys(themeTileSets).length, 9, 'later catalogue data is preserved');
  for (const id of Object.keys(themeTileSets).filter(id => !expected.includes(id))) {
    assert.equal(themeById[id], undefined, `${id} cannot be selected or restored as an active game theme`);
  }
});

test('theme duels always deal the assigned tiles with the approved rarity mix', () => {
  const editions = ['eastern', 'eastern', 'western', 'western'];
  for (const [index, themeId] of expected.entries()) {
    assert.equal(rulesetForTheme(themeId), editions[index]);
    for (const seed of [1, 42, 1234]) {
      const game = createThemeGame(themeId, seed, 'calm');
      assert.equal(game.ruleset, editions[index]);
      assert.equal(game.theme, themeId);
      assert.equal(game.tiles.length, 60);
      const catalogue = new Set(themeTileSets[themeId][editions[index]].map(tile => tile.matchKey));
      assert.ok(game.tiles.every(tile => catalogue.has(tile.matchKey)));
      const counts = { marble: 0, sapphire: 0, amethyst: 0, gold: 0 };
      for (const tile of game.tiles) counts[rarityForTile(themeId, game.ruleset, tile.faceId).id]++;
      assert.deepEqual(counts, { marble: 32, sapphire: 16, amethyst: 8, gold: 4 });
    }
  }
  assert.throws(() => createThemeGame('neon-shrine'), /Unknown playable theme/);
  assert.throws(() => createThemeGame('toString'), /Unknown playable theme/);
});
