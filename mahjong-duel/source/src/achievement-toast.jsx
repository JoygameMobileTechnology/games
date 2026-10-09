import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { achievementById, activeAchievementIdFor, isAchievementId } from './achievements.js';
import { familyForAchievement } from './achievement-milestones.js';
import { playProgressSound } from './sound.js';
import './achievement-toast.css';

export const ACHIEVEMENT_TOAST_MS = 3800;

function Medal() {
  return <svg className="achievement-toast-medal" viewBox="0 0 56 58" aria-hidden="true">
    <path className="achievement-medal-ribbon" d="m16 32-6 22 10-5 6 7 4-23m-2 0 5 23 6-7 10 5-7-22" />
    <circle className="achievement-medal-rim" cx="28" cy="24" r="21" />
    <circle className="achievement-medal-face" cx="28" cy="24" r="16.5" />
    <path className="achievement-medal-star" d="m28 12 3.8 7.7 8.5 1.2-6.1 6 1.4 8.4-7.6-4-7.6 4 1.4-8.4-6.1-6 8.5-1.2z" />
    <path className="achievement-medal-glint" d="M10 9v8m-4-4h8m30 19v6m-3-3h6" />
  </svg>;
}

/** The parent owns the immutable FIFO queue. Completion acknowledges only this batch ID. */
export function AchievementNotifications({ batches = [], onComplete, paused = false, sound = true, gentle = false }) {
  const [hidden, setHidden] = useState(() => typeof document !== 'undefined' && document.hidden);
  const callback = useRef(onComplete), timer = useRef(null), soundPlayed = useRef(new Set()), stopSound = useRef(() => {});
  callback.current = onComplete;
  const batch = batches.find(value => typeof value?.id === 'string' && value.id &&
    Array.isArray(value.achievementIds) && value.achievementIds.some(isAchievementId));
  const id = batch?.id;
  const ids = [...new Set((batch?.achievementIds ?? []).map(activeAchievementIdFor).filter(Boolean))];
  const definitions = ids.map(value => achievementById[value]);
  const duration = ACHIEVEMENT_TOAST_MS + (ids.length > 1 ? 500 : 0);
  const held = paused || hidden;

  useEffect(() => {
    const change = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', change);
    return () => document.removeEventListener('visibilitychange', change);
  }, []);
  useEffect(() => {
    timer.current = id ? { id, remaining: duration, completed: false } : null;
    return () => stopSound.current();
  }, [id]);
  useEffect(() => {
    if (!id || held) { stopSound.current(); return; }
    if (!soundPlayed.current.has(id)) {
      // Muted arrivals are acknowledged silently; unmuting never replays old unlocks.
      soundPlayed.current.add(id);
      stopSound.current = playProgressSound('achievement', sound);
    } else if (!sound) stopSound.current();
  }, [id, held, sound]);
  useEffect(() => {
    const active = timer.current;
    if (!active || active.completed || held) return;
    const start = performance.now();
    const timeout = setTimeout(() => {
      if (active.completed || timer.current !== active) return;
      active.completed = true;
      callback.current?.(active.id);
    }, active.remaining);
    return () => {
      clearTimeout(timeout);
      active.remaining = Math.max(0, active.remaining - (performance.now() - start));
    };
  }, [id, held]);

  if (!id || !definitions.length || typeof document === 'undefined') return null;
  // A burst may cross several levels of one trophy. Announce its highest new level.
  const displayed = [...definitions.reduce((families, definition) => {
    const family = familyForAchievement(definition.id);
    const key = family?.id || definition.id;
    const previous = families.get(key);
    if (!previous || definition.target > previous.target) families.set(key, definition);
    return families;
  }, new Map()).values()];
  const more = displayed.length - 1;
  const names = displayed.map(definition => {
    const family = familyForAchievement(definition.id);
    const level = family?.milestones.find(item => item.id === definition.id)?.level;
    return family ? `${family.name}${family.totalLevels > 1 ? ` · Level ${level}` : ''}` : definition.name;
  });
  const announcement = `Achievement unlocked: ${names.join('; ')}.`;
  return createPortal(<div className={`achievement-toast-stage ${held ? 'is-paused' : ''} ${gentle ? 'is-gentle' : ''}`}
    aria-live="polite" aria-atomic="true" role="status" aria-label={announcement} data-achievement-batch={id}>
    <div className="achievement-toast" key={id} style={{ '--achievement-duration': `${duration}ms` }}>
      <Medal />
      <div className="achievement-toast-copy"><div className="achievement-toast-heading"><span>Achievement unlocked</span>{more > 0 && <b>+{more} more</b>}</div>
        <strong title={names.join('\n')}>{names[0]}</strong></div>
      <span className="achievement-toast-timer" aria-hidden="true" />
    </div>
  </div>, document.body);
}
