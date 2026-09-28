import test from 'node:test';
import assert from 'node:assert/strict';
import { requestRewardedAd } from '../src/rewarded-ad.js';

test('testing build completes a rewarded ad without a provider or video', async () => {
  assert.deepEqual(await requestRewardedAd({ attemptId: 'daily-1' }), { status: 'completed', attemptId: 'daily-1' });
});

test('production path requires an actual provider completion', async () => {
  const base = { attemptId: 'daily-1', config: { mode: 'production' } };
  assert.equal((await requestRewardedAd(base)).status, 'unavailable');
  for (const status of ['completed', 'cancelled', 'failed', 'unavailable']) {
    assert.equal((await requestRewardedAd({ ...base, provider: { show: async () => ({ status }) } })).status, status);
  }
  assert.equal((await requestRewardedAd({ ...base, provider: { show: async () => { throw Error('offline'); } } })).status, 'failed');
  assert.equal((await requestRewardedAd({ ...base, provider: { show: async () => ({ status: 'opened' }) } })).status, 'failed');
});
