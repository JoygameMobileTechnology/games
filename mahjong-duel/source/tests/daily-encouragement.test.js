import test from 'node:test';
import assert from 'node:assert/strict';
import { getDailyEncouragement } from '../src/daily-encouragement.js';

test('daily encouragement never repeats over a long history, including after the curated pairings', () => {
  const seen = new Set();
  let previous;
  for (let day = 1; day <= 100_000; day++) {
    const message = getDailyEncouragement(day);
    const text = `${message.line1}\n${message.line2}`;
    assert.ok(!seen.has(text), `Repeated encouragement on login day ${day}`);
    assert.notEqual(message.line1, previous?.line1, `Repeated opening on consecutive day ${day}`);
    assert.notEqual(message.line2, previous?.line2, `Repeated invitation on consecutive day ${day}`);
    seen.add(text);
    previous = message;
  }
});

test('messages are short and varied, with a stable result when a saved login count is reused', () => {
  const openings = new Set(), invitations = new Set();
  for (let day = 1; day <= 4096; day++) {
    const message = getDailyEncouragement(day);
    assert.deepEqual(getDailyEncouragement(day), message);
    for (const line of Object.values(message)) {
      assert.equal(typeof line, 'string');
      assert.ok(line.length > 0 && line.length <= 40, `${day}: ${line}`);
      assert.equal(line, line.trim());
    }
    openings.add(message.line1);
    invitations.add(message.line2);
  }
  assert.equal(openings.size, 64);
  assert.equal(invitations.size, 64);
  assert.deepEqual(getDailyEncouragement(365), getDailyEncouragement(365), 'missed calendar days do not affect the login-count message');
});

test('invalid counts use the first greeting and valid large counts remain distinct', () => {
  const first = getDailyEncouragement(1);
  for (const value of [undefined, null, NaN, Infinity, -Infinity, 0, -1, 1.5, '3', {}, [], Number.MAX_SAFE_INTEGER + 1]) {
    assert.deepEqual(getDailyEncouragement(value), first);
  }
  const last = getDailyEncouragement(Number.MAX_SAFE_INTEGER);
  assert.notDeepEqual(last, getDailyEncouragement(Number.MAX_SAFE_INTEGER - 1));
  assert.equal(last.line2, `Make day ${Number.MAX_SAFE_INTEGER} your own.`);
  const modified = getDailyEncouragement(3);
  modified.line1 = 'Changed by the caller';
  assert.notEqual(getDailyEncouragement(3).line1, modified.line1);
});
