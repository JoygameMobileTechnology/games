import test from 'node:test';
import assert from 'node:assert/strict';
import { themeTileSets } from '../src/tile-data.js';
import { tileDescription } from '../src/tile-descriptions.js';

test('every collectible face has a compact, single-sentence cultural note', () => {
  let total = 0;
  for (const [theme, editions] of Object.entries(themeTileSets)) {
    for (const [ruleset, tiles] of Object.entries(editions)) {
      const seen = new Set();
      for (const tile of tiles) {
        const note = tileDescription(theme, ruleset, tile.id);
        const label = `${theme}/${ruleset}/${tile.id} (${tile.name})`;
        assert.equal(typeof note, 'string', `Missing description: ${label}`);
        assert.ok(note.endsWith('.'), `Sentence needs a full stop: ${label}`);
        assert.equal((note.match(/[.!?]/g) || []).length, 1, `Expected one sentence: ${label}`);
        const words = note.split(/\s+/).length;
        assert.ok(words >= 8 && words <= 40, `Description should fit the small inspector: ${label} (${words} words)`);
        assert.ok(!/undefined|null|<[^>]+>/.test(note), `Invalid description: ${label}`);
        assert.ok(!seen.has(note), `Different faces in one edition need distinct descriptions: ${label}`);
        seen.add(note);
        total++;
      }
    }
  }
  assert.equal(total, 720);
});

test('notes explain theme-specific meaning and distinguish imagined interpretations', () => {
  const porcelainCrane = tileDescription('ming-porcelain', 'western', 'W17');
  const neonCrane = tileDescription('neon-shrine', 'western', 'W16');
  assert.match(porcelainCrane, /immortals.*longevity/);
  assert.match(neonCrane, /peace.*Sadako Sasaki/);
  assert.notEqual(porcelainCrane, neonCrane);
  assert.match(tileDescription('neon-shrine', 'western', 'W07'), /protection and good fortune/);
  assert.match(tileDescription('brass-meridian', 'western', 'W02'), /celestial angles.*mariners/);
  assert.match(tileDescription('brass-meridian', 'western', 'W33'), /imagined brass owl.*automaton/);
  assert.match(tileDescription('ming-porcelain', 'eastern', 'T06'), /prosperity.*renewal/);
  assert.match(tileDescription('xia-gui', 'eastern', 'C02'), /Two lotus blossoms.*integrity/);
  assert.match(tileDescription('guo-xi', 'eastern', 'T01'), /one-tier pagoda.*Buddhist sanctuary/);
  assert.match(tileDescription('guo-xi', 'eastern', 'T06'), /six-tier pagoda.*Buddhist sanctuaries/);
});

test('identical subjects can share a note across editions, while invalid faces reveal no substitute', () => {
  assert.equal(tileDescription('neon-shrine', 'eastern', 'A01'), tileDescription('neon-shrine', 'western', 'W05'));
  assert.equal(tileDescription('missing', 'eastern', 'C01'), null);
  assert.equal(tileDescription('ming-porcelain', 'missing', 'C01'), null);
  assert.equal(tileDescription('ming-porcelain', 'western', 'C01'), null);
  assert.equal(tileDescription('ming-porcelain', 'eastern', 'W01'), null);
  assert.equal(tileDescription('ming-porcelain', 'eastern', 'A99'), null);
});
