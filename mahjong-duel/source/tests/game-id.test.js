import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { createGameId } from '../src/game-id.js';

const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

test('game IDs use native UUIDs when available', () => {
  assert.match(createGameId(webcrypto), uuidV4);
});

test('HTTP fallback generates distinct UUIDs without randomUUID', () => {
  const httpCrypto = { getRandomValues: values => webcrypto.getRandomValues(values) };
  const ids = Array.from({ length: 100 }, () => createGameId(httpCrypto));
  ids.forEach(id => assert.match(id, uuidV4));
  assert.equal(new Set(ids).size, ids.length);
});
