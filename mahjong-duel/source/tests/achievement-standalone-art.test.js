import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { ACHIEVEMENT_FAMILIES } from '../src/achievement-milestones.js';
import { STANDALONE_TROPHY_ART } from '../src/achievement-standalone-art.js';
import { getStandaloneTrophyUrl, getTrophyAtlasUrl } from '../src/achievement-artwork.js';

test('every one-time achievement has its own unique trophy image', () => {
  const standalones = ACHIEVEMENT_FAMILIES.filter(family => family.totalLevels === 1);
  assert.equal(standalones.length, 27);
  assert.deepEqual(Object.keys(STANDALONE_TROPHY_ART).sort(), standalones.map(family => family.id).sort());
  assert.equal(new Set(Object.values(STANDALONE_TROPHY_ART)).size, standalones.length);
  const imageHashes = new Set();
  for (const family of standalones) {
    assert.equal(family.artKey, family.id);
    assert.equal(getStandaloneTrophyUrl(family.artKey), `./assets/remake/achievement-standalone/${family.id}.webp`);
    const image = readFileSync(new URL(`../public/${STANDALONE_TROPHY_ART[family.artKey]}`, import.meta.url));
    assert.equal(image.toString('ascii', 0, 4), 'RIFF');
    assert.equal(image.toString('ascii', 8, 12), 'WEBP');
    imageHashes.add(createHash('sha256').update(image).digest('hex'));
  }
  assert.equal(imageHashes.size, standalones.length, 'each image must have distinct artwork, not just a distinct filename');
});

test('progressive achievements keep their existing illustrated subjects', () => {
  assert.deepEqual(Object.fromEntries(ACHIEVEMENT_FAMILIES.filter(family => family.totalLevels > 1).map(family => [family.id, family.artKey])), {
    'completed-duels': 'duelist',
    'duel-wins': 'banner',
    'matched-pairs': 'bamboo',
    'pair-chain': 'ribbon',
    'remembered-pairs': 'heart',
    'duel-recall': 'fan',
    opportunity: 'screen',
    'renewed-focus': 'reed',
    'complete-pictures': 'cabinet',
    'lasting-recall': 'heart',
    'followed-hints': 'compass',
    'picture-collection': 'cabinet',
    formations: 'compass',
    visits: 'lantern',
    'playing-days': 'duelist',
    settings: 'screen',
  });
  assert.equal(getTrophyAtlasUrl(), './assets/remake/achievement-trophies.png');
  assert.equal(getStandaloneTrophyUrl('duelist'), null);
  assert.equal(getStandaloneTrophyUrl('constructor'), null);
});
