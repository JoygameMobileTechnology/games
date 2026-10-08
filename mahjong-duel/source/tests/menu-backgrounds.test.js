import test from 'node:test';
import assert from 'node:assert/strict';
import { statSync } from 'node:fs';
import { menuBackgrounds, chooseMenuBackground } from '../src/menu-backgrounds.js';

test('menu scenes retain their own artwork and atmosphere', () => {
  assert.deepEqual(menuBackgrounds, [
    { id: 'autumn-daylight', src: './assets/remake/menu-backgrounds/autumn-daylight.webp', atmosphere: 'autumn' },
    { id: 'spring-blossom', src: './assets/remake/menu-backgrounds/spring-blossom.webp', atmosphere: 'spring' },
    { id: 'bamboo-garden', src: './assets/remake/menu-backgrounds/bamboo-garden.webp', atmosphere: 'bamboo' },
  ]);
  assert.equal(new Set(menuBackgrounds.map(background => background.src)).size, 3);
});

test('every menu scene points to existing nonempty public artwork', () => {
  for (const { id, src } of menuBackgrounds) {
    const artwork = statSync(new URL(`../public/${src}`, import.meta.url));
    assert.ok(artwork.isFile() && artwork.size > 0, `${id} must have published artwork`);
  }
});

test('every previous scene is excluded across the full random range', () => {
  for (const previous of menuBackgrounds) {
    const alternatives = menuBackgrounds.filter(background => background.id !== previous.id);
    for (let index = 0; index < alternatives.length; index++) {
      // Each remaining scene receives half of the range, including boundaries.
      for (const random of [index / alternatives.length, (index + .5) / alternatives.length, (index + 1) / alternatives.length - Number.EPSILON]) {
        const next = chooseMenuBackground(previous.id, () => random);
        assert.equal(next, alternatives[index]);
        assert.notEqual(next.id, previous.id);
      }
    }
  }
});

test('fresh or obsolete stored scene IDs allow all three current scenes', () => {
  for (const previous of [null, undefined, '', 'bamboo', 'lantern-night', 'winter-garden', 'retired-menu-background']) {
    for (let index = 0; index < menuBackgrounds.length; index++) {
      assert.equal(chooseMenuBackground(previous, () => (index + .5) / menuBackgrounds.length), menuBackgrounds[index]);
    }
    assert.equal(chooseMenuBackground(previous, () => 0), menuBackgrounds[0]);
    assert.equal(chooseMenuBackground(previous, () => 1 - Number.EPSILON), menuBackgrounds.at(-1));
  }
});

test('repeated launches never repeat consecutively and do not mutate the scene catalogue', () => {
  const original = structuredClone(menuBackgrounds);
  let previous = null;
  for (let launch = 0; launch < 120; launch++) {
    const next = chooseMenuBackground(previous, () => (launch % 10) / 10);
    assert.ok(menuBackgrounds.includes(next));
    assert.notEqual(next.id, previous);
    previous = next.id;
  }
  assert.deepEqual(menuBackgrounds, original);
});
