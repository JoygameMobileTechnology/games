import React, { useEffect, useId, useRef, useState } from 'react';
import { coalesceStreakCues } from './duel-progress.js';
import { playProgressSound } from './sound.js';
import { PlayerAvatar } from './player-profile.jsx';
import './streak-feedback.css';

function useVisibility() {
  const [hidden, setHidden] = useState(() => document.hidden);
  useEffect(() => { const change = () => setHidden(document.hidden); document.addEventListener('visibilitychange', change); return () => document.removeEventListener('visibilitychange', change); }, []);
  return hidden;
}
function useReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false);
  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const change = () => setReduced(Boolean(query?.matches));
    query?.addEventListener?.('change', change); return () => query?.removeEventListener?.('change', change);
  }, []);
  return reduced;
}
function PairMotif() {
  return <svg className="streak-pair-motif" viewBox="0 0 42 28" aria-hidden="true"><rect x="9" y="6" width="13" height="18" rx="3" transform="rotate(-12 15 15)" /><rect x="21" y="4" width="13" height="18" rx="3" transform="rotate(10 27 13)" /><path d="M15 10v9m-4-4h8m7-4v9m-4-4h8" /></svg>;
}
function CelebrationArtwork({ cue }) {
  const id = useId().replaceAll(':', '');
  const tier = Math.min(cue.count || 8, 15);
  const blueLeaves = [[112, 164, -85, 1.02], [86, 139, -64, 1], [69, 109, -41, .91], [60, 77, -20, .8]];
  const goldLeaves = [[158, 179, -56, .81], [135, 159, -26, .81], [116, 129, -5, .75], [103, 97, 12, .67], [98, 67, 23, .54]];
  const leaves = tier >= 13 ? 5 : tier >= 9 ? 4 : tier >= 5 ? 3 : 2;
  return <svg className="streak-celebration-art" viewBox="0 0 520 220" aria-hidden="true">
    <defs>
      <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fff6c9" /><stop offset=".33" stopColor="#f6d27b" /><stop offset=".63" stopColor="#bb761c" /><stop offset="1" stopColor="#ffe8a0" /></linearGradient>
      <linearGradient id={`${id}-blue`} x1="0" y1="0" x2="1" y2=".6"><stop stopColor="#bfeaff" /><stop offset=".4" stopColor="#5daddc" /><stop offset=".72" stopColor="#1a619c" /><stop offset="1" stopColor="#103b76" /></linearGradient>
      <radialGradient id={`${id}-light`}><stop stopColor="#fffcdf" stopOpacity=".98" /><stop offset=".42" stopColor="#fff2b6" stopOpacity=".82" /><stop offset=".8" stopColor="#fff3c6" stopOpacity=".17" /><stop offset="1" stopColor="#fff5d3" stopOpacity="0" /></radialGradient>
    </defs>
    <ellipse className="streak-radiance" cx="260" cy="111" rx="255" ry="117" fill={`url(#${id}-light)`} />
    <g className="streak-rays" stroke="#ffeeb1" strokeWidth="1.3">{Array.from({ length: tier >= 9 ? 28 : 18 }, (_, i) => {
      const angle = i * Math.PI * 2 / (tier >= 9 ? 28 : 18), inner = 45 + i % 3 * 4, outer = 103 + i % 4 * 8;
      return <path key={i} d={`M${260 + Math.cos(angle) * inner},${108 + Math.sin(angle) * inner * .63}L${260 + Math.cos(angle) * outer * 1.42},${108 + Math.sin(angle) * outer * .9}`} opacity={.3 + i % 3 * .17} />;
    })}</g>
    {[false, true].map(mirror => <g className={`streak-laurel ${mirror ? 'laurel-right' : 'laurel-left'}`} key={String(mirror)} transform={mirror ? 'translate(520 0) scale(-1 1)' : undefined}>
      <path d="M211 189C139 189 82 139 62 49M180 177C135 160 106 112 100 52" fill="none" stroke={`url(#${id}-gold)`} strokeWidth="3" />
      {blueLeaves.slice(0, Math.min(4, leaves)).map(([x, y, r, size], i) => <g className="streak-leaf blue-leaf" key={`blue${i}`} transform={`translate(${x} ${y}) rotate(${r}) scale(${size})`}><path d="M0 0C-5-26 7-49 20-68C27-33 17-12 0 0Z" fill={`url(#${id}-blue)`} stroke="#d8eff9" strokeWidth=".8" /><path d="M0 0Q13-35 20-66" fill="none" stroke="#b4e1fa" strokeWidth=".7" opacity=".8" /></g>)}
      {goldLeaves.slice(0, leaves).map(([x, y, r, size], i) => <g className="streak-leaf gold-leaf" key={`gold${i}`} transform={`translate(${x} ${y}) rotate(${r}) scale(${size})`}><path d="M0 0C-5-26 7-49 20-68C27-33 17-12 0 0Z" fill={`url(#${id}-gold)`} stroke="#fff2bf" strokeWidth=".8" /><path d="M0 0Q13-35 20-66" fill="none" stroke="#fff0b8" strokeWidth=".75" /></g>)}
      {[[38, 163, 9], [43, 38, 7], [83, 15, 5], [144, 203, 5]].slice(0, tier >= 9 ? 4 : 2).map(([x, y, size], i) => <path className="streak-star" key={i} d={`M${x} ${y-size}Q${x+2} ${y-2} ${x+size} ${y}Q${x+2} ${y+2} ${x} ${y+size}Q${x-2} ${y+2} ${x-size} ${y}Q${x-2} ${y-2} ${x} ${y-size}`} fill="#fff6cf" stroke="#ecc46d" strokeWidth=".6" />)}
    </g>)}
  </svg>;
}
export function streakPresentationDuration(cue) {
  if (cue.reinforcement) return 1000;
  if (cue.family === 'chain') return 1150 + Math.round((cue.intensity || 0) * 550);
  return ['turning_win_secured', 'turning_draw_final'].includes(cue.id) ? 1750 : 1400;
}
function SealMotif({ cue }) {
  return <svg className={`streak-seal-motif seal-${cue.variant}`} viewBox="0 0 30 34" aria-hidden="true"><path className="seal-left" d="M14 2C-1 4-1 27 14 31" /><path className="seal-right" d="M16 2C31 4 31 27 16 31" /><path className="seal-core" d="m15 7 7 10-7 10-7-10z" />{cue.id === 'turning_four_to_win' && [0, 1, 2, 3].map(i => <circle key={i} cx={6 + i * 6} cy="33" r="1" />)}</svg>;
}

/** A bounded local-owned HUD composition. Pause retains visual time; audio never replays. */
export function StreakFeedback({ cues, profile, paused = false, sound = true, gentle = false, onComplete }) {
  const hidden = useVisibility(), reduced = useReducedMotion();
  const timer = useRef({ remaining: 0, completed: true }), callback = useRef(onComplete), stopSound = useRef(() => {});
  callback.current = onComplete;
  const primaryCues = coalesceStreakCues(cues);
  useEffect(() => {
    const accepted = coalesceStreakCues(cues);
    timer.current = { remaining: Math.max(0, ...accepted.map(streakPresentationDuration)), completed: false };
    if (!accepted.length) return;
    stopSound.current = playProgressSound(accepted[0], sound && !paused && !document.hidden);
    return () => stopSound.current();
    // A batch starts exactly once for its array identity; mute/pause never replay it.
  }, [cues]);
  useEffect(() => {
    if (!sound || paused || hidden) stopSound.current();
  }, [sound, paused, hidden]);
  useEffect(() => {
    if (!cues?.length || paused || hidden || timer.current.completed) return;
    const batch = timer.current, start = performance.now();
    const id = setTimeout(() => { if (batch.completed) return; batch.completed = true; callback.current?.(cues); }, batch.remaining);
    return () => { clearTimeout(id); batch.remaining = Math.max(0, batch.remaining - (performance.now() - start)); };
  }, [cues, paused, hidden]);
  if (!primaryCues.length) return null;
  const [primary, secondary] = primaryCues;
  const duration = streakPresentationDuration(primary);
  return <div className={`streak-feedback streak-primary-${primary.family} ${gentle || reduced ? 'streak-gentle' : ''} ${paused || hidden ? 'streak-paused' : ''}`} role="status" aria-label={`${profile?.name || 'You'}: ${primary.name}${primary.family === 'chain' ? `, ${primary.count} consecutive pairs` : `, ${primary.subtitle}`}`} aria-live="polite" aria-atomic="true" data-streak-id={primary.id} data-streak-owner="you" style={{ '--streak-duration': `${duration}ms`, '--streak-intensity': primary.family === 'chain' ? primary.intensity : primary.intensity / 3, '--streak-tier': Math.min(primary.count || 8, 15) }}>
    <div key={primary.eventId} className={`streak-primary ${primary.reinforcement ? 'streak-reinforcement' : ''} ${primary.peak ? 'streak-peak' : ''}`}>
      <CelebrationArtwork cue={primary} />
      {primary.family === 'turning' && <div className="streak-banner-seal"><SealMotif cue={primary} /></div>}
      <div className="streak-player-signature"><PlayerAvatar profile={profile} showFlag={false} /><span>{profile?.name || 'You'}</span></div>
      <div className="streak-copy"><b className="streak-title">{primary.name}</b><div className="streak-subtitle">{primary.family === 'chain' ? <><PairMotif /><small><strong>{primary.count}</strong> pairs in a row</small></> : <small>{primary.subtitle}</small>}</div></div>
      {secondary && <div className={`streak-secondary secondary-${secondary.family}`} key={secondary.eventId}><i aria-hidden="true">✦</i><b>{secondary.name}</b>{secondary.family === 'chain' && <small>{secondary.count} pairs</small>}</div>}
    </div>
  </div>;
}

/** Root wraps the existing local portrait; the seal never replaces or covers it. */
export function StreakPortrait({ cues, paused = false, gentle = false }) {
  const reduced = useReducedMotion(), hidden = useVisibility();
  const primary = coalesceStreakCues(cues)[0];
  if (primary?.family !== 'turning') return null;
  return <div key={primary.eventId} className={`streak-portrait-ring ${gentle || reduced ? 'streak-gentle' : ''} ${paused || hidden ? 'streak-paused' : ''}`} aria-hidden="true" style={{ '--streak-duration': `${streakPresentationDuration(primary)}ms` }}><SealMotif cue={primary} /></div>;
}
