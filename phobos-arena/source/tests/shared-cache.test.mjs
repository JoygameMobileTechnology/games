import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

async function activateWorker(game, initialCaches) {
  const source = await readFile(new URL(`../../../${game}/sw.js`, import.meta.url), 'utf8');
  const listeners = new Map();
  const stored = new Set(initialCaches);
  const deleted = [];
  const claimedWith = [];
  let skipWaitingCalls = 0;
  runInNewContext(source, {
    caches: {
      async keys() { return [...stored]; },
      async delete(key) { deleted.push(key); return stored.delete(key); },
    },
    self: {
      addEventListener(type, listener) { listeners.set(type, listener); },
      async skipWaiting() { skipWaitingCalls++; },
      clients: { async claim() { claimedWith.push([...stored].sort()); } },
    },
  }, { filename: `${game}/sw.js` });
  const waits = [];
  assert.equal(typeof listeners.get('activate'), 'function');
  listeners.get('activate')({ waitUntil(promise) { waits.push(promise); } });
  assert.equal(waits.length, 1, 'activation remains one lifecycle promise');
  await Promise.all(waits);
  return { remaining: [...stored].sort(), deleted: deleted.sort(), claimedWith, skipWaitingCalls };
}

const phobosAndUnrelated = ['phobos-v3-current', 'phobos-v3-previous', 'hub-assets', 'another-game-v1'];
const cases = [
  {
    game: 'terra-bellum',
    current: ['tb-v1-shell', 'tb-v1-assets', 'tb-v1-extra'],
    obsolete: ['tb-v0-shell', 'tb-v0-assets', 'tb-legacy'],
    neighbors: ['pmvs-v2', 'pmvs-v1', 'tbx-assets', 'tb', ...phobosAndUnrelated],
  },
  {
    game: 'pacman-vs',
    current: ['pmvs-v2'],
    obsolete: ['pmvs-v1', 'pmvs-v0-shell', 'pmvs-legacy'],
    neighbors: ['tb-v1-shell', 'tb-v1-assets', 'tb-v0-shell', 'pmvsx-assets', 'pmvs', ...phobosAndUnrelated],
  },
];

for (const { game, current, obsolete, neighbors } of cases) {
  test(`${game} activation deletes only its obsolete caches and preserves neighboring games`, async () => {
    const expected = [...current, ...neighbors].sort();
    const result = await activateWorker(game, [...current, ...obsolete, ...neighbors]);
    assert.deepEqual(result.deleted, [...obsolete].sort());
    assert.deepEqual(result.remaining, expected);
    assert.deepEqual(result.claimedWith, [expected], 'clients are claimed once, after cleanup completes');
    assert.equal(result.skipWaitingCalls, 0, 'activation does not change the install lifecycle');
  });
}
