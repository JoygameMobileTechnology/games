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
        for (const swatch of [rarity.color, rarity.ink, rarity.tint]) assert.match(swatch, /^#[0-9a-f]{6}$/i);
        counts[rarity.id]++; total++;
      }
      assert.deepEqual(counts, { marble: 22, sapphire: 10, amethyst: 5, gold: 3 }, `${theme} ${ruleset}`);
    }
  }
  assert.equal(total, 720);
});

test('rarity metadata matches the four cosmetic tiers', () => {
  assert.deepEqual(RARITIES.map(({ id, label, code, order }) => ({ id, label, code, order })), [
    { id: 'marble', label: 'Marble', code: 'M', order: 0 },
    { id: 'sapphire', label: 'Sapphire', code: 'S', order: 1 },
    { id: 'amethyst', label: 'Amethyst', code: 'A', order: 2 },
    { id: 'gold', label: 'Gold', code: 'AU', order: 3 },
  ]);
  assert.ok(Object.isFrozen(RARITIES));
  for (const rarity of RARITIES) {
    assert.ok(!Object.hasOwn(rarity, 'points'), 'rarity must not change scoring');
    assert.ok(!Object.hasOwn(rarity, 'weight'), 'rarity must not change draw odds');
  }
});

test('Gold includes the former Celestial signature artwork of each launch theme', () => {
  const showpieces = [
    ['ming-porcelain', 'eastern', 'K01'], ['ming-porcelain', 'western', 'W01'],
    ['dancheong', 'eastern', 'A01'], ['dancheong', 'western', 'W33'],
    ['stained-glass', 'eastern', 'A13'], ['stained-glass', 'western', 'W01'],
    ['dutch-golden-age', 'eastern', 'K06'], ['dutch-golden-age', 'western', 'W36'],
  ];
  for (const identity of showpieces) assert.equal(rarityForTile(...identity).id, 'gold', identity.join(':'));
  assert.equal(rarityForTile('ming-porcelain', 'western', 'W34').id, 'gold');
  assert.equal(rarityForTile('brass-meridian', 'western', 'W01').id, 'sapphire');
  assert.equal(rarityForTile('stained-glass', 'eastern', 'A12').id, 'gold');
  assert.equal(rarityForTile('guo-xi', 'eastern', 'A12').id, 'marble');
  assert.equal(rarityForTile('missing', 'eastern', 'C01'), null);
  assert.equal(rarityForTile('ming-porcelain', 'western', 'C01'), null);
  assert.equal(rarityForTile('ming-porcelain', 'eastern', 'F01'), null);
});
