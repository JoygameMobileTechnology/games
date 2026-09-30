import React from 'react';
import { Check, Play } from '@phosphor-icons/react';
import { ProgressionPage } from './progression-page.jsx';
import { ProgressionGlyph } from './progression-menu.jsx';
import { RewardItems } from './progression-pages.jsx';
import { DAILY_REWARD_CONFIG, getDailyView } from './daily-rewards.js';
import { getDailyEncouragement } from './daily-encouragement.js';
import './daily-welcome-page.css';

const format = value => Number(value || 0).toLocaleString();

export function DailyWelcomePage({ progression, now = Date.now(), onClose, onClaim, onDoubleClaim, adState = 'idle', gentle = false, paused = false }) {
  const daily = getDailyView(progression, now), loginNumber = Math.max(1, daily.loginDays);
  const firstDay = Math.floor((loginNumber - 1) / 7) * 7 + 1, currentIndex = (loginNumber - 1) % 7;
  const encouragement = getDailyEncouragement(loginNumber), busy = adState === 'loading';
  const claim = progression.daily.claims[`login:${daily.dayId}`];
  const receipt = progression.daily.claimReceipts[claim?.receiptId];
  const claimedRewards = receipt?.entitlementIds.reduce((total, id) => {
    for (const [key, count] of Object.entries(progression.daily.entitlements[id]?.rewards || {})) total[key] = (total[key] || 0) + count * receipt.multiplier;
    return total;
  }, {});
  const rewards = daily.hasClaim ? daily.rewards : claimedRewards || DAILY_REWARD_CONFIG.weekly[Math.max(0, daily.weeklyDay - 1)];
  const notice = busy ? 'Preparing your double rewards…'
    : !daily.hasClaim ? 'Claimed — see you another day!'
      : adState === 'unavailable' ? '2x unavailable. Standard rewards are ready.'
        : ['failed', 'cancelled'].includes(adState) ? '2x did not complete. You can still claim.'
          : daily.entitlements.length > 1 ? 'Includes your unclaimed rewards.' : null;

  return <ProgressionPage title="Daily Rewards" className={`daily-welcome-page ${gentle ? 'is-gentle' : ''} ${paused ? 'is-paused' : ''}`} onClose={onClose} closeLabel="Close daily welcome">
    <div className="daily-welcome-hero">
      <div className={`daily-welcome-medallion ${loginNumber >= 1000 ? 'has-long-day' : ''}`} aria-label={`Day ${format(loginNumber)} of your login journey`}>
        <ProgressionGlyph name="daily" />
        <strong>Day {format(loginNumber)}</strong>
      </div>
    </div>
    <section className={`daily-welcome-journey ${firstDay >= 100 ? 'has-long-journey' : ''}`} aria-label="Your login journey. Missed days keep your progress.">
      <div className="daily-welcome-track-line" aria-hidden="true"><span style={{ '--progress-from': Math.max(0, currentIndex - 1) / 6, '--progress-to': currentIndex / 6 }} /></div>
      <ol className="daily-welcome-track">
        {Array.from({ length: 7 }, (_, index) => {
          const day = firstDay + index, past = index < currentIndex, current = index === currentIndex;
          return <li key={day} className={`${past ? 'is-past' : ''} ${current ? 'is-current' : ''}`} aria-current={current ? 'step' : undefined}>
            <span className="daily-welcome-day-label">Day {format(day)}</span>
            <span className="daily-welcome-step" aria-label={past ? `Day ${format(day)} completed` : undefined}>{past ? <Check weight="bold" aria-hidden="true" /> : format(day)}</span>
            {current && <span className="daily-welcome-today">Today</span>}
          </li>;
        })}
      </ol>
    </section>
    <section className="daily-welcome-rewards" aria-labelledby="daily-welcome-reward-title">
      <h3 id="daily-welcome-reward-title" className="ornament-heading">{daily.hasClaim ? 'Today’s rewards' : 'Claimed rewards'}</h3>
      <RewardItems rewards={rewards} named />
    </section>
    <p className="daily-welcome-encouragement"><span>{encouragement.line1}</span><span>{encouragement.line2}</span></p>
    <div className="daily-welcome-footer">
      <div className="daily-welcome-claim-state" role="status">{notice}</div>
      <div className="daily-welcome-actions">
        <button type="button" className="progression-primary" disabled={!daily.hasClaim || busy} onClick={onClaim}>{daily.hasClaim ? 'Claim rewards' : 'Claimed'}{!daily.hasClaim && <Check size={20} weight="bold" />}</button>
        <button type="button" className="progression-secondary daily-welcome-double" aria-label={busy ? 'Please wait…' : 'Claim rewards 2x'} disabled={!daily.hasClaim || busy || adState === 'unavailable'} onClick={onDoubleClaim}><Play weight="fill" aria-hidden="true" /><span><strong>{busy ? 'Please wait…' : 'Claim rewards 2x'}</strong><small>Watch ad</small></span></button>
      </div>
    </div>
  </ProgressionPage>;
}
