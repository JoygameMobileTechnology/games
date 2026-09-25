import test from 'node:test';
import assert from 'node:assert/strict';
import { themeTileSets } from '../src/tile-data.js';
import { RARITIES, rarityForTile } from '../src/rarity.js';

test('all 720 faces have a curated rarity with progressively smaller tiers', () => {
  let total = 0;
  for (const [theme, sets] of Object.entries(themeTileSets)) {
    for (const [ruleset, tiles] of Object.entries(sets)) {
      const counts = Object.fromEntries(RARITIES.map(value => [value.id, 0]));
      for (const tile of tiles) {
        const rarity = rarityForTile(theme, ruleset, tile.id);
        assert.ok(RARITIES.includes(rarity));
        assert.ok(Object.isFrozen(rarity));
        assert.match(rarity.color, /^#[0-9a-f]{6}$/i);
        counts[rarity.id]++; total++;
      }
      assert.deepEqual(counts, { common: 22, rare: 10, epic: 6, legendary: 2 }, `${theme} ${ruleset}`);
    }
  }
  assert.equal(total, 720);
});

test('curation follows themed artwork rather than assigning a global face-ID tier', () => {
  assert.equal(rarityForTile('ming-porcelain', 'western', 'W01').id, 'legendary');
  assert.equal(rarityForTile('brass-meridian', 'western', 'W01').id, 'rare');
  assert.equal(rarityForTile('stained-glass', 'eastern', 'A12').id, 'legendary');
  assert.equal(rarityForTile('guo-xi', 'eastern', 'A12').id, 'common');
  assert.deepEqual(RARITIES.map(value => value.order), [0, 1, 2, 3]);
  assert.equal(rarityForTile('missing', 'eastern', 'C01'), null);
  assert.equal(rarityForTile('ming-porcelain', 'western', 'C01'), null);
  assert.equal(rarityForTile('ming-porcelain', 'eastern', 'F01'), null);
});
