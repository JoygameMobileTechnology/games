import test from 'node:test';
import assert from 'node:assert/strict';
import { themes, launchThemeIds, themeById, defaultTheme } from '../src/themes.js';
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
