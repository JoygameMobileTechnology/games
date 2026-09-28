import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowUp, BookOpen, Cards, Check, Crown, Eye, Info, Leaf, Lightbulb, LinkSimple, LockKey, MagnifyingGlass, Play, Snowflake, Sparkle, Sword, Trophy, ArrowsClockwise, CaretRight } from '@phosphor-icons/react';
import { PlayerAvatar } from './player-profile.jsx';
import { playProgressSound } from './sound.js';
import { ProgressionGlyph } from './progression-menu.jsx';
import { ACHIEVEMENTS, achievementProgress } from './achievements.js';
import { getDailyView, DAILY_REWARD_CONFIG } from './daily-rewards.js';
import { rankingRows, leagueForWins, LEAGUES } from './leaderboards.js';
import { themeTileSets } from './tile-data.js';
import './progression-pages.css';
const craneArt = themeTileSets['ming-porcelain'].eastern.find(tile => tile.id === 'G03').src;

const BOOSTERS = { hint: { name: 'Hint', Icon: Lightbulb }, shuffle: { name: 'Shuffle', Icon: ArrowsClockwise }, freeze: { name: 'Freeze', Icon: Snowflake }, eagle: { name: 'Eagle Eye', Icon: Eye } };
const CATEGORY_ICONS = { 'Completed duels': Sword, Wins: Trophy, Pairs: Cards, 'Pair chains': LinkSimple, 'Conditional wins': Crown, Memory: Eye, Boosters: Lightbulb, 'Collection & variety': BookOpen, Participation: Leaf };
const format = value => Number(value || 0).toLocaleString();
const categories = [...new Set(ACHIEVEMENTS.map(value => value.category))];

export function ProgressionPage({ title, className = '', onClose, children, bodyRef, closeLabel = 'Back to main menu' }) {
  const id = useId(), root = useRef(null), heading = useRef(null), onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement;
    heading.current?.focus({ preventScroll: true });
    const keydown = event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onCloseRef.current(); }
      if (event.key !== 'Tab') return;
      const controls = [...root.current.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex="0"]')].filter(node => node.tabIndex >= 0 && node.getClientRects().length);
      if (!controls.length) return;
      // Safari may skip buttons during native Tab navigation; keep page navigation consistent.
      const current = controls.indexOf(document.activeElement);
      const next = current < 0 ? (event.shiftKey ? controls.length - 1 : 0) : (current + (event.shiftKey ? -1 : 1) + controls.length) % controls.length;
      event.preventDefault(); controls[next].focus();
    };
    const node = root.current; node.addEventListener('keydown', keydown);
    return () => { node.removeEventListener('keydown', keydown); if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, []);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [title]);
  return <section className={`progression-page ${className}`} ref={root} role="dialog" aria-modal="true" aria-labelledby={id}>
    <header className="progression-page-header"><button className="icon-button" type="button" aria-label={closeLabel} onClick={onClose}><ArrowLeft size={27} weight="bold" /></button><h2 id={id} ref={heading} tabIndex={-1}>{title}</h2><span aria-hidden="true" /></header>
    <div className="progression-page-scroll" ref={bodyRef}><div className="progression-page-content">{children}</div></div>
  </section>;
}
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

function AchievementArtwork({ achievement, unlocked, large = false }) {
  const Icon = CATEGORY_ICONS[achievement.category] || Sparkle;
  return <span className={`achievement-artwork ${unlocked ? 'is-unlocked' : 'is-locked'} ${large ? 'is-large' : ''}`} aria-hidden="true"><span className="achievement-art-ring"><Icon size={large ? 72 : 31} weight="duotone" /></span><span className="achievement-art-state">{unlocked ? <Check size={large ? 22 : 13} weight="bold" /> : <LockKey size={large ? 22 : 13} weight="fill" />}</span></span>;
}
export function AchievementsPage({ progression, onClose, gentle = false }) {
  const [search, setSearch] = useState(''), [category, setCategory] = useState('all'), [filter, setFilter] = useState('all'), [selectedId, setSelectedId] = useState(null);
  const body = useRef(null), listScroll = useRef(0), opener = useRef(null);
  const entries = useMemo(() => ACHIEVEMENTS.map(definition => ({ definition, ...achievementProgress(definition, progression) })), [progression]);
  const unlockedCount = entries.filter(value => value.unlocked).length;
  const visible = entries.filter(({ definition, unlocked, current }) => (category === 'all' || definition.category === category) && (filter === 'all' || filter === 'unlocked' && unlocked || filter === 'progress' && !unlocked && current > 0) && `${definition.name} ${definition.description}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const selected = entries.find(value => value.definition.id === selectedId);
  const closeDetail = () => { setSelectedId(null); requestAnimationFrame(() => { if (body.current) body.current.scrollTop = listScroll.current; opener.current?.focus({ preventScroll: true }); }); };
  return <ProgressionPage title={selected ? 'Achievement details' : 'Achievements'} className={`achievements-page ${gentle ? 'is-gentle' : ''}`} bodyRef={body} closeLabel={selected ? 'Back to achievements' : 'Back to main menu'} onClose={selected ? closeDetail : onClose}>
    <div className="achievement-list-pane" hidden={Boolean(selected)}><div className="achievement-summary"><span><small>Achievement Points</small><strong>{format(progression.points)}</strong></span><span><strong>{unlockedCount}<small> / 100</small></strong><small>Unlocked</small></span></div>
    <div className="achievement-controls"><label className="achievement-search"><MagnifyingGlass size={21} /><input aria-label="Search achievements" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search achievements" /></label><fieldset className="achievement-category-browser"><legend>Browse categories</legend><div className="achievement-category-grid">{['all', ...categories].map(value => {
      const Icon = CATEGORY_ICONS[value] || Sparkle;
      const count = value === 'all' ? entries.length : entries.filter(entry => entry.definition.category === value).length;
      const label = value === 'all' ? 'All achievements' : value === 'Conditional wins' ? 'Win challenges' : value === 'Collection & variety' ? 'Collection' : value;
      return <button key={value} type="button" aria-label={`${label}, ${count} achievements`} aria-pressed={category === value} onClick={() => setCategory(value)}><Icon size={21} weight="duotone" /><span>{label}</span><small>{count}</small></button>;
    })}</div></fieldset><div className="progression-tabs" role="group" aria-label="Achievement status">{[['all', 'All'], ['progress', 'In progress'], ['unlocked', 'Unlocked']].map(([value, label]) => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div></div>
    <p className="achievement-results-count" aria-live="polite">{visible.length} {visible.length === 1 ? 'achievement' : 'achievements'}</p><ul className="achievement-list">{visible.map(entry => { const { definition, current, target, unlocked } = entry; return <li key={definition.id}><button className={`achievement-entry ${unlocked ? 'is-unlocked' : ''}`} onClick={event => { opener.current = event.currentTarget; listScroll.current = body.current?.scrollTop || 0; setSelectedId(definition.id); if (body.current) body.current.scrollTop = 0; }} aria-label={`${definition.name}, ${unlocked ? 'Unlocked' : 'Locked'}, ${format(current)} of ${format(target)}`}><AchievementArtwork achievement={definition} unlocked={unlocked} /><span className="achievement-entry-copy"><strong>{definition.name}</strong><span>{definition.description}</span><progress value={Math.min(current, target)} max={target} aria-label={`${definition.name} progress`} /><span className="achievement-entry-meta"><span>{format(Math.min(current, target))} / {format(target)}</span><span>{unlocked ? 'Unlocked' : 'Locked'} · {definition.points} AP</span></span></span><CaretRight size={17} /></button></li>; })}</ul>{visible.length === 0 && <div className="progression-empty"><MagnifyingGlass size={35} /><h3>No matching achievements</h3><p>Try a different search or filter.</p><button className="progression-secondary" onClick={() => { setSearch(''); setCategory('all'); setFilter('all'); }}>Show all achievements</button></div>}</div>
    {selected && <article className="achievement-detail"><span className="achievement-category-note">{selected.definition.category}</span><AchievementArtwork achievement={selected.definition} unlocked={selected.unlocked} large /><h3>{selected.definition.name}</h3><span className={`achievement-detail-status ${selected.unlocked ? 'is-unlocked' : ''}`}>{selected.unlocked ? <Check weight="bold" /> : <LockKey weight="fill" />}{selected.unlocked ? 'Unlocked' : 'Locked'}</span><p>{selected.definition.description}</p><progress value={Math.min(selected.current, selected.target)} max={selected.target} aria-label={`${selected.definition.name} progress`} /><strong className="achievement-detail-progress">{format(Math.min(selected.current, selected.target))} / {format(selected.target)}</strong><div className="achievement-point-reward"><Sparkle size={27} weight="fill" /><strong>{selected.definition.points}</strong><span>Achievement Points{selected.unlocked ? ' earned' : ' on unlock'}</span></div>{selected.unlockedAt && <small className="achievement-unlock-date">Unlocked {new Date(selected.unlockedAt).toLocaleDateString()}</small>}<button className="progression-secondary" onClick={closeDetail}>Back to achievements</button></article>}
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
