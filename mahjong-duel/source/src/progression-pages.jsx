import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp, Check, Eye, Info, Leaf, Lightbulb, Play, Snowflake, Sparkle, ArrowsClockwise, CaretRight } from '@phosphor-icons/react';
import { PlayerAvatar } from './player-profile.jsx';
import { playProgressSound } from './sound.js';
import { ProgressionGlyph } from './progression-menu.jsx';
import { ProgressionPage } from './progression-page.jsx';
export { ProgressionPage } from './progression-page.jsx';
export { AchievementsPage } from './achievements-page.jsx';
import { getDailyView, DAILY_REWARD_CONFIG } from './daily-rewards.js';
import { rankingRows, leagueForWins, LEAGUES } from './leaderboards.js';
import { themeTileSets } from './tile-data.js';
import './progression-pages.css';
const craneArt = themeTileSets['ming-porcelain'].eastern.find(tile => tile.id === 'G03').src;

const BOOSTERS = { hint: { name: 'Hint', Icon: Lightbulb }, shuffle: { name: 'Shuffle', Icon: ArrowsClockwise }, freeze: { name: 'Freeze', Icon: Snowflake }, eagle: { name: 'Eagle Eye', Icon: Eye } };
const format = value => Number(value || 0).toLocaleString();

function RewardItems({ rewards, compact = false }) {
  return <div className={`reward-items ${compact ? 'is-compact' : ''}`}>{Object.entries(BOOSTERS).filter(([key]) => rewards?.[key] > 0).map(([key, { Icon, name }]) => <div className="reward-item" key={key} role="img" aria-label={`${name}, ${rewards[key]}`} title={`${name} ×${rewards[key]}`}><span className="reward-coin"><Icon size={compact ? 22 : 30} weight="duotone" /></span><strong>×{format(rewards[key])}</strong>{!compact && <span>{name}</span>}</div>)}</div>;
}
export function DailyRewardsPage({ progression, onClose, onClaim, onDoubleClaim, adState = 'idle', gentle = false }) {
  const daily = getDailyView(progression), busy = adState === 'loading';
  const weeklyReward = DAILY_REWARD_CONFIG.weekly[Math.max(0, daily.weeklyDay - 1)];
  const todayClaim = progression.daily.claims[`login:${daily.dayId}`];
  const receipt = progression.daily.claimReceipts[todayClaim?.receiptId];
  const claimedReward = receipt?.entitlementIds.reduce((total, id) => {
    const reward = progression.daily.entitlements[id]?.rewards;
    for (const key of Object.keys(BOOSTERS)) total[key] += (reward?.[key] || 0) * receipt.multiplier;
    return total;
  }, Object.fromEntries(Object.keys(BOOSTERS).map(key => [key, 0])));
  const displayedReward = daily.hasClaim ? daily.rewards : claimedReward || weeklyReward;
  const exceptional = ['unavailable', 'failed', 'cancelled'].includes(adState);
  return <ProgressionPage title="Daily Rewards" className={`daily-rewards-page ${gentle ? 'is-gentle' : ''}`} onClose={onClose}>
    <div className="daily-topline"><div className="daily-hero"><span className="daily-seal"><ProgressionGlyph name="daily" /></span><div><strong>{format(daily.loginDays)}</strong><span>login {daily.loginDays === 1 ? 'day' : 'days'}</span></div></div></div>
    <section className="daily-journey" aria-labelledby="daily-journey-title"><h3 id="daily-journey-title" className="ornament-heading">{DAILY_REWARD_CONFIG.longEvery}-Day Journey</h3>
      <ol className="daily-long-track">{Array.from({ length: DAILY_REWARD_CONFIG.longEvery }, (_, index) => <li key={index} className={`${index + 1 < daily.longDay ? 'is-past' : ''} ${index + 1 === daily.longDay ? 'is-current' : ''} ${index === DAILY_REWARD_CONFIG.longEvery - 1 ? 'is-grand' : ''}`} aria-current={index + 1 === daily.longDay ? 'step' : undefined}><span>{index + 1}</span>{index + 1 < daily.longDay && <Check size={14} weight="bold" aria-label="Completed" />}</li>)}</ol>
    </section>
    <section className={`daily-claim-panel ${exceptional ? 'has-claim-notice' : ''}`} aria-labelledby="daily-claim-title">
      <h3 id="daily-claim-title" className="ornament-heading">{!daily.hasClaim ? 'Claimed rewards' : daily.entitlements.length > 1 ? 'Your rewards' : `Day ${daily.loginDays} reward`}</h3><RewardItems rewards={displayedReward} />
    </section>
    <section className="daily-grand-section" aria-label="Grand reward progress"><div className="daily-grand-reward"><div className="grand-reward-copy"><strong>Grand reward</strong><progress value={daily.longDay} max={DAILY_REWARD_CONFIG.longEvery} aria-label={`${DAILY_REWARD_CONFIG.longEvery}-day login progress`} /><span>{Object.values(DAILY_REWARD_CONFIG.longReward)[0]} of every booster</span></div><span className="grand-reward-chest" aria-label={`Grand reward on day ${DAILY_REWARD_CONFIG.longEvery}`}><span><ProgressionGlyph name="daily" /></span><strong>Day {DAILY_REWARD_CONFIG.longEvery}</strong></span></div><p>Missed days keep your progress.</p></section>
    <div className={`daily-claim-footer ${exceptional ? 'has-claim-notice' : ''}`}><div className="daily-claim-state" role="status">{busy ? 'Preparing your double rewards…' : !daily.hasClaim ? <><Check size={16} weight="bold" />Claimed — see you another day!</> : adState === 'unavailable' ? '2x unavailable. Standard rewards are ready.' : (adState === 'failed' || adState === 'cancelled') ? '2x did not complete. You can still claim.' : daily.entitlements?.length > 1 ? 'Includes your unclaimed rewards.' : null}</div>
      <div className="daily-claim-actions"><button className="progression-primary" disabled={!daily.hasClaim || busy} onClick={onClaim}>{daily.hasClaim ? 'Claim rewards' : 'Claimed'}{!daily.hasClaim && <Check size={20} weight="bold" />}</button><button className="progression-secondary double-rewards-button" disabled={!daily.hasClaim || busy || adState === 'unavailable'} onClick={onDoubleClaim}><Play size={22} weight="fill" />{busy ? 'Please wait…' : 'Claim rewards 2x'}</button></div>
    </div>
  </ProgressionPage>;
}

function useRankPresentation(presentation, gentle) {
  const [elapsed, setElapsed] = useState(0), [reduced, setReduced] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false);
  const climbMs = presentation?.improved ? 2000 : 0, promotionMs = presentation?.promoted ? 1500 : 0, total = climbMs + promotionMs;
  useEffect(() => { const media = window.matchMedia?.('(prefers-reduced-motion: reduce)'); const change = () => setReduced(Boolean(media?.matches)); media?.addEventListener?.('change', change); return () => media?.removeEventListener?.('change', change); }, []);
  useEffect(() => {
    if (!presentation || gentle || reduced) { setElapsed(total); return; }
    let elapsedMs = 0, last = null, frame;
    const tick = now => { if (!document.hidden) { if (last !== null) elapsedMs += now - last; setElapsed(Math.min(total, elapsedMs)); } last = document.hidden ? null : now; if (elapsedMs < total) frame = requestAnimationFrame(tick); };
    const resetClock = () => { last = null; };
    document.addEventListener('visibilitychange', resetClock);
    setElapsed(0); frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); document.removeEventListener('visibilitychange', resetClock); };
  }, [presentation?.eventId, gentle, reduced, total]);
  return { elapsed, climbMs, total, reduced: gentle || reduced, climbing: elapsed < climbMs, promoting: promotionMs > 0 && elapsed >= climbMs && elapsed < total };
}
function RankingPlayer({ row, profile, position }) {
  return <><span className="ranking-position">#{format(position ?? row.position)}</span><PlayerAvatar profile={row.isPlayer ? profile : { name: row.name, avatarId: row.avatarId, countryCode: '' }} showFlag={false} size={42} /><span className="ranking-name" title={row.name}><strong>{row.name}</strong>{row.isPlayer && <small>You</small>}</span><span className="ranking-wins"><strong>{format(row.wins)}</strong></span></>;
}
/** A distinct lift, a confident pass over neighbouring cards, then a firm landing. */
function rankFlight(progress, distance) {
  if (progress < .18) { const t = progress / .18, lift = 1 - (1 - t) ** 3; return { y: distance - 9 * lift, scale: 1 + .072 * lift, rotate: -1.3 * lift, depth: lift, phase: 'lift' }; }
  if (progress < .77) { const t = (progress - .18) / .59, move = t < .5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2; return { y: (distance - 9) * (1 - move) - 11 * move, scale: 1.072, rotate: -1.3 + 1.8 * move, depth: 1, phase: 'climb' }; }
  if (progress < .88) { const t = (progress - .77) / .11; return { y: -11 + 17 * t * t, scale: 1.072 - .085 * t * t, rotate: .5 * (1 - t), depth: 1 - .8 * t, phase: 'land' }; }
  const t = Math.min(1, (progress - .88) / .12), settle = Math.exp(-5 * t) * Math.cos(t * Math.PI * 3);
  return { y: 6 * settle * (1 - t), scale: 1 - .013 * settle * (1 - t), rotate: 0, depth: .2 * (1 - t), phase: 'settle' };
}
export function LeaderboardsPage({ progression, profile, onClose, presentation = null, sound = true, gentle = false }) {
  const [view, setView] = useState('around'), [flightBox, setFlightBox] = useState(null);
  const rankingList = useRef(null), table = useRef(null);
  const animation = useRankPresentation(presentation, gentle);
  useLayoutEffect(() => {
    const list = rankingList.current, wrapper = table.current, row = list?.querySelector('.is-player');
    if (!list || !wrapper || !row) { setFlightBox(null); return; }
    const measure = () => {
      const initial = row.getBoundingClientRect(), listRect = list.getBoundingClientRect();
      const centeredInset = Math.max(0, (list.clientHeight - initial.height) / 2);
      const flightInset = Math.min(initial.height, Math.max(0, list.clientHeight - initial.height * 2 - 12));
      list.scrollTop += initial.top - listRect.top - (presentation?.improved ? flightInset : centeredInset);
      const target = row.getBoundingClientRect(), frame = wrapper.getBoundingClientRect(), currentList = list.getBoundingClientRect();
      setFlightBox({ x: target.left - frame.left, y: target.top - frame.top, width: target.width, height: target.height,
        distance: Math.max(0, Math.min(target.height * 2.6, currentList.bottom - target.bottom - 12)) });
    };
    measure(); const observer = new ResizeObserver(measure); observer.observe(list); observer.observe(wrapper);
    return () => observer.disconnect();
  }, [view, presentation?.eventId]);
  const playedCues = useRef(new Set());
  const cue = animation.reduced ? null : animation.climbing ? 'rank' : animation.promoting ? 'promotion' : null;
  useEffect(() => {
    if (!cue || !presentation?.eventId) return;
    const key = `${presentation.eventId}:${cue}`;
    if (playedCues.current.has(key)) return;
    playedCues.current.add(key);
    const cancel = playProgressSound(cue, sound && !document.hidden);
    const visibility = () => { if (document.hidden) cancel(); };
    document.addEventListener('visibilitychange', visibility);
    return () => { cancel(); document.removeEventListener('visibilitychange', visibility); };
  }, [presentation?.eventId, cue, sound]);
  const ranking = progression.ranking, league = leagueForWins(ranking.wins);
  const previousLeague = LEAGUES.find(value => value.id === presentation?.previousLeagueId) || league;
  const promotionProgress = Math.max(0, Math.min(1, (animation.elapsed - animation.climbMs) / 1500));
  const shownLeague = presentation?.promoted && animation.elapsed < animation.climbMs + 650 ? previousLeague : league;
  const climbProgress = animation.climbMs ? Math.min(1, animation.elapsed / animation.climbMs) : 1;
  const counting = Math.max(0, Math.min(1, (climbProgress - .18) / .61));
  const easing = 1 - (1 - counting) ** 3;
  const position = animation.climbing ? Math.round(presentation.previousPosition + (ranking.position - presentation.previousPosition) * easing) : ranking.position;
  const rows = rankingRows(progression, profile, { view }), localRow = rows.find(row => row.isPlayer);
  const nextLeague = LEAGUES.find(value => value.minWins > shownLeague.minWins);
  const progressBase = shownLeague.minWins, progressTarget = nextLeague ? nextLeague.minWins - progressBase : 1;
  const flight = rankFlight(climbProgress, flightBox?.distance || 0), floating = animation.climbing && flightBox && localRow;
  return <ProgressionPage title="Leaderboards" className={`leaderboards-page ${animation.reduced ? 'is-gentle' : ''}`} onClose={onClose}>
    <div className="ranking-overview"><div className={`league-hero ${animation.promoting ? 'is-promoting' : ''}`} style={{ '--league-color': shownLeague.color, '--promotion-rise': `${-Math.sin(promotionProgress * Math.PI) * 20}px`, '--promotion-scale': 1 + Math.sin(promotionProgress * Math.PI) * .17 }}><span className="league-medallion"><span className="league-wing wing-left"><Leaf weight="fill" /></span><span className="league-wing wing-right"><Leaf weight="fill" /></span><span className="league-porcelain"><img src={craneArt} alt="Blue porcelain crane" /></span></span><h3>{shownLeague.name} League</h3></div>
      <div className="ranking-summary"><span><small>Your position</small><strong>#{format(position)}</strong></span><span><small>Total wins</small><strong>{format(ranking.wins)}</strong></span></div>
      <div className="league-journey"><div><span>{shownLeague.name} · {format(shownLeague.minWins)}</span><progress className="league-progress" value={nextLeague ? Math.min(progressTarget, ranking.wins - progressBase) : 1} max={progressTarget} aria-label="Progress to next league" /><span>{nextLeague ? `${nextLeague.name} · ${format(nextLeague.minWins)}` : 'Complete'}</span></div><p>{nextLeague ? ranking.wins >= nextLeague.minWins ? `${nextLeague.name} unlocked` : `${format(nextLeague.minWins - ranking.wins)} wins to ${nextLeague.name}` : 'You have reached the highest league'}</p></div>
    </div>
    {presentation && <div className="ranking-outcome" role="status">{animation.climbing ? <><ArrowUp size={18} weight="bold" />Moving up {format(presentation.previousPosition - ranking.position)} places</> : animation.promoting ? <><Sparkle size={18} weight="fill" />Welcome to {league.name}</> : presentation.improved ? <><Check size={18} weight="bold" />Your new position is #{format(ranking.position)}</> : <><Check size={18} weight="bold" />Position held at #{format(ranking.position)}</>}</div>}
    <div className="ranking-board"><div className="progression-tabs ranking-tabs" role="group" aria-label="Leaderboard view">{[['top', 'Top players'], ['around', 'Around you']].map(([value, label]) => <button key={value} aria-pressed={view === value} onClick={() => setView(value)} disabled={animation.climbing || animation.promoting}>{label}</button>)}</div>
      <div className="ranking-table" ref={table}><div className="ranking-table-head" aria-hidden="true"><span>Rank</span><span>Player</span><span>Wins</span></div>
        <ol ref={rankingList} className={`ranking-rows ${animation.climbing ? 'is-climbing' : ''}`} aria-label={view === 'around' ? 'Players around you' : 'Top players'}>{rows.map(row => <li key={row.id} className={`ranking-row ${row.isPlayer ? 'is-player' : ''} ${row.isPlayer && floating ? 'is-placeholder' : ''}`}><RankingPlayer row={row} profile={profile} position={row.isPlayer ? position : row.position} /></li>)}</ol>
        {floating && <div className="ranking-floating-layer" aria-hidden="true"><div className="ranking-row ranking-float-row is-player" data-flight-phase={flight.phase} style={{ left: flightBox.x, top: flightBox.y, width: flightBox.width, height: flightBox.height, '--flight-y': `${flight.y}px`, '--flight-scale': flight.scale, '--flight-rotate': `${flight.rotate}deg`, '--flight-depth': flight.depth }}><RankingPlayer row={localRow} profile={profile} position={position} /></div></div>}
      </div>
      {view === 'top' && !localRow && <button className="ranking-your-position" onClick={() => setView('around')}><PlayerAvatar profile={profile} size={35} showFlag={false} /><span>Your position <strong>#{format(ranking.position)}</strong></span><CaretRight size={20} /></button>}
    </div>
    <div className="ranking-footer"><p><Info size={13} />Local simulated standings</p>{presentation?.newAchievementIds?.length > 0 && <span>{presentation.newAchievementIds.length} new {presentation.newAchievementIds.length === 1 ? 'achievement' : 'achievements'} · View in Achievements</span>}</div>
  </ProgressionPage>;
}
