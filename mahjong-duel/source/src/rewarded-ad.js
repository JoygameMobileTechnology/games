// Testing build: exercise the exact reward receipt flow without presenting a video.
// A production provider must report completion; opening an ad never grants a reward.
export const REWARDED_AD_CONFIG = Object.freeze({ mode: 'test', testOutcome: 'completed' });
const outcomes = new Set(['completed', 'cancelled', 'failed', 'unavailable']);

export async function requestRewardedAd({ attemptId, provider, config = REWARDED_AD_CONFIG } = {}) {
  if (!attemptId) return { status: 'failed' };
  try {
    const result = provider
      ? await provider.show({ placement: 'daily-rewards', attemptId })
      : config.mode === 'test' ? { status: config.testOutcome } : { status: 'unavailable' };
    const status = typeof result === 'string' ? result : result?.status;
    return { status: outcomes.has(status) ? status : 'failed', attemptId };
  } catch {
    return { status: 'failed', attemptId };
  }
}
