import React from 'react';
import { Check, Play } from '@phosphor-icons/react';
import { ProgressionPage } from './progression-page.jsx';
import { ProgressionGlyph } from './progression-menu.jsx';
import { RewardItems } from './progression-pages.jsx';
import { DAILY_REWARD_CONFIG, getDailyView } from './daily-rewards.js';
import { getDailyEncouragement } from './daily-encouragement.js';
import './daily-welcome-page.css';
import { t, formatNumber } from './i18n.js';

const format = value => formatNumber(Number(value || 0));

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

  return <ProgressionPage title={t("Daily Rewards")} className={`daily-welcome-page ${gentle ? 'is-gentle' : ''} ${paused ? 'is-paused' : ''}`} onClose={onClose} closeLabel={t("Close daily welcome")}>
    <div className="daily-welcome-hero">
      <div className={`daily-welcome-medallion ${loginNumber >= 1000 ? 'has-long-day' : ''}`} aria-label={t('Day {day} of your login journey', { day: format(loginNumber) })}>
        <ProgressionGlyph name="daily" />
        <strong>{t('Day {day}', { day: format(loginNumber) })}</strong>
      </div>
    </div>
    <section className={`daily-welcome-journey ${firstDay >= 100 ? 'has-long-journey' : ''}`} aria-label={t("Your login journey. Missed days keep your progress.")}>
      <div className="daily-welcome-track-line" aria-hidden="true"><span style={{ '--progress-from': Math.max(0, currentIndex - 1) / 6, '--progress-to': currentIndex / 6 }} /></div>
      <ol className="daily-welcome-track">
        {Array.from({ length: 7 }, (_, index) => {
          const day = firstDay + index, past = index < currentIndex, current = index === currentIndex;
          return <li key={day} className={`${past ? 'is-past' : ''} ${current ? 'is-current' : ''}`} aria-current={current ? 'step' : undefined}>
            <span className="daily-welcome-day-label">{t('Day {day}', { day: format(day) })}</span>
            <span className="daily-welcome-step" aria-label={past ? t('Day {day} completed', { day: format(day) }) : undefined}>{past ? <Check weight="bold" aria-hidden="true" /> : format(day)}</span>
            {current && <span className="daily-welcome-today">{t("Today")}</span>}
          </li>;
        })}
      </ol>
    </section>
    <section className="daily-welcome-rewards" aria-labelledby="daily-welcome-reward-title">
      <h3 id="daily-welcome-reward-title" className="ornament-heading">{t(daily.hasClaim ? 'Today’s rewards' : 'Claimed rewards')}</h3>
      <RewardItems rewards={rewards} named />
    </section>
    <p className="daily-welcome-encouragement"><span>{t(encouragement.line1)}</span><span>{loginNumber > 4096 ? t('Make day {day} your own.', { day: format(loginNumber) }) : t(encouragement.line2)}</span></p>
    <div className="daily-welcome-footer">
      <div className="daily-welcome-claim-state" role="status">{notice && t(notice)}</div>
      <div className="daily-welcome-actions">
        <button type="button" className="progression-primary" disabled={!daily.hasClaim || busy} onClick={onClaim}>{t(daily.hasClaim ? 'Claim rewards' : 'Claimed')}{!daily.hasClaim && <Check size={20} weight="bold" />}</button>
        <button type="button" className="progression-secondary daily-welcome-double" aria-label={t(busy ? 'Please wait…' : 'Claim rewards 2x')} disabled={!daily.hasClaim || busy || adState === 'unavailable'} onClick={onDoubleClaim}><Play weight="fill" aria-hidden="true" /><span><strong>{t(busy ? 'Please wait…' : 'Claim rewards 2x')}</strong><small>{t("Watch ad")}</small></span></button>
      </div>
    </div>
  </ProgressionPage>;
}
