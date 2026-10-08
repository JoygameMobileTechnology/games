import test from 'node:test';
import assert from 'node:assert/strict';
import { ACHIEVEMENT_FAMILIES } from '../src/achievement-milestones.js';
import { getTrophyGlory } from '../src/achievement-trophy-state.js';

test('locked trophies stay grayscale and unlocked one-time trophies receive their complete finish', () => {
  for (const family of ACHIEVEMENT_FAMILIES) {
    assert.equal(getTrophyGlory(0, family.totalLevels), 0, family.id);
    if (family.totalLevels === 1) assert.equal(getTrophyGlory(1, family.totalLevels), 5, family.id);
  }
});

test('milestone trophies retain increasing glory and reach their full finish only at mastery', () => {
  for (const family of ACHIEVEMENT_FAMILIES.filter(item => item.totalLevels > 1)) {
    let previous = 0;
    for (let level = 1; level <= family.totalLevels; level += 1) {
      const glory = getTrophyGlory(level, family.totalLevels);
      assert.ok(glory >= previous, `${family.id}, level ${level}`);
      if (level === 1) assert.equal(glory, 1, family.id);
      if (level < family.totalLevels) assert.ok(glory < 5, family.id);
      else assert.equal(glory, 5, family.id);
      previous = glory;
    }
  }
});
