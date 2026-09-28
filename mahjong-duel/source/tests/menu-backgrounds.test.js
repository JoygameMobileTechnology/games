import test from 'node:test';
import assert from 'node:assert/strict';
import { menuBackgrounds, chooseMenuBackground } from '../src/menu-backgrounds.js';

test('menu scenes retain their own artwork and atmosphere', () => {
  assert.deepEqual(menuBackgrounds.map(({ id, atmosphere }) => [id, atmosphere]), [
    ['bamboo', 'bamboo'], ['lantern-night', 'fireflies'], ['autumn-daylight', 'autumn'],
  ]);
  assert.equal(new Set(menuBackgrounds.map(background => background.src)).size, 3);
  assert.equal(menuBackgrounds[0].src, './assets/remake/shoji-doors.png');
});

test('every previous scene is excluded before either random endpoint is drawn', () => {
  for (const previous of menuBackgrounds) {
    const alternatives = menuBackgrounds.filter(background => background.id !== previous.id);
    assert.equal(chooseMenuBackground(previous.id, () => 0), alternatives[0]);
    assert.equal(chooseMenuBackground(previous.id, () => 1 - Number.EPSILON), alternatives[1]);
    // Both remaining scenes receive half the random range, including the boundary.
    assert.equal(chooseMenuBackground(previous.id, () => .5 - Number.EPSILON), alternatives[0]);
    assert.equal(chooseMenuBackground(previous.id, () => .5), alternatives[1]);
  }
});

test('fresh or obsolete stored scene IDs allow all three scenes', () => {
  for (const previous of [null, undefined, '', 'retired-menu-background']) {
    for (let index = 0; index < menuBackgrounds.length; index++) {
      assert.equal(chooseMenuBackground(previous, () => (index + .5) / 3), menuBackgrounds[index]);
    }
    assert.equal(chooseMenuBackground(previous, () => 0), menuBackgrounds[0]);
    assert.equal(chooseMenuBackground(previous, () => 1 - Number.EPSILON), menuBackgrounds[2]);
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
