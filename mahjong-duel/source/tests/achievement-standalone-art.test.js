import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { ACHIEVEMENT_FAMILIES } from '../src/achievement-milestones.js';
import { STANDALONE_TROPHY_ART } from '../src/achievement-standalone-art.js';
import { MILESTONE_TROPHY_ART } from '../src/achievement-milestone-art.js';
import { getMilestoneTrophyUrl, getStandaloneTrophyUrl, getTrophyAtlasUrl } from '../src/achievement-artwork.js';

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

test('milestone families keep distinct subjects and replace the five reused designs', () => {
  assert.deepEqual(Object.fromEntries(ACHIEVEMENT_FAMILIES.filter(family => family.totalLevels > 1).map(family => [family.id, family.artKey])), {
    'completed-duels': 'duelist',
    'duel-wins': 'banner',
    'matched-pairs': 'bamboo',
    'pair-chain': 'ribbon',
    'remembered-pairs': 'heart',
    'duel-recall': 'fan',
    opportunity: 'screen',
    'renewed-focus': 'reed',
    'complete-pictures': 'complete-pictures',
    'lasting-recall': 'lasting-recall',
    'followed-hints': 'followed-hints',
    'picture-collection': 'cabinet',
    formations: 'compass',
    visits: 'lantern',
    'playing-days': 'playing-days',
    settings: 'settings',
  });
  assert.equal(getTrophyAtlasUrl(), './assets/remake/achievement-trophies.png');
  assert.equal(getStandaloneTrophyUrl('duelist'), null);
  assert.equal(getStandaloneTrophyUrl('constructor'), null);
  assert.equal(getMilestoneTrophyUrl('constructor'), null);
  assert.equal(new Set(ACHIEVEMENT_FAMILIES.map(family => family.artKey)).size, 43);
});

test('each replacement milestone image is distinct from every one-time trophy', () => {
  assert.deepEqual(Object.keys(MILESTONE_TROPHY_ART).sort(), ['complete-pictures', 'followed-hints', 'lasting-recall', 'playing-days', 'settings']);
  const hashes = new Set(Object.values(STANDALONE_TROPHY_ART).map(path => createHash('sha256').update(readFileSync(new URL(`../public/${path}`, import.meta.url))).digest('hex')));
  for (const [key, path] of Object.entries(MILESTONE_TROPHY_ART)) {
    assert.equal(getMilestoneTrophyUrl(key), path);
    const image = readFileSync(new URL(`../public/${path}`, import.meta.url));
    assert.equal(image.toString('ascii', 0, 4), 'RIFF');
    assert.equal(image.toString('ascii', 8, 12), 'WEBP');
    const hash = createHash('sha256').update(image).digest('hex');
    assert.ok(!hashes.has(hash), `${key} must have unique artwork`);
    hashes.add(hash);
  }
  assert.equal(hashes.size, 32);
});
