import React, { useLayoutEffect, useEffect, useRef } from 'react';
import { PlayerAvatar } from './player-profile.jsx';
import { MATCH_TRANSFER_MS } from './matchmaking.js';

export function captureMatchmakingPortraits() {
  return Object.fromEntries(['you', 'ai'].map(actor => {
    const rect = document.querySelector(`[data-matchmaking-portrait="${actor}"]`)?.getBoundingClientRect();
    return [actor, rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null];
  }));
}

function usePausedAnimations(animations, paused) {
  useEffect(() => {
    for (const animation of animations.current) {
      if (animation.playState === 'finished') continue;
      if (paused) animation.pause(); else animation.play();
    }
  }, [paused]);
}

/** A viewport overlay connects the exact face-off rings to the measured HUD rings. */
export function PortraitTransfer({ origins, profile, opponent, paused, gentle }) {
  const root = useRef(null), animations = useRef([]);
  useLayoutEffect(() => {
    const reduced = gentle || matchMedia('(prefers-reduced-motion: reduce)').matches;
    const update = () => {
      const time = animations.current[0]?.currentTime || 0;
      animations.current.forEach(animation => animation.cancel());
      animations.current = ['you', 'ai'].flatMap(actor => {
        const node = root.current.querySelector(`[data-travelling-portrait="${actor}"]`);
        const target = document.querySelector(`[data-score-portrait="${actor}"]`)?.getBoundingClientRect();
        if (!target) return [];
        const from = origins?.[actor] || target;
        Object.assign(node.style, { left: `${target.x}px`, top: `${target.y}px`, width: `${target.width}px`, height: `${target.height}px` });
        const transform = `translate(${from.x - target.x}px,${from.y - target.y}px) scale(${from.width / target.width},${from.height / target.height})`;
        const animation = node.animate(reduced ? [{ opacity: 0 }, { opacity: 1 }] : [{ transform }, { transform: 'translate(0,0) scale(1)' }], { duration: MATCH_TRANSFER_MS, easing: 'cubic-bezier(.32,.04,.22,1)', fill: 'both' });
        animation.currentTime = time;
        if (document.hidden) animation.pause();
        return [animation];
      });
    };
    update();
    window.addEventListener('resize', update);
    return () => { window.removeEventListener('resize', update); animations.current.forEach(animation => animation.cancel()); };
  }, []);
  usePausedAnimations(animations, paused);
  return <div className="portrait-transfer" ref={root} aria-hidden="true">{[['you', profile], ['ai', opponent]].map(([actor, person]) => <div className="travelling-portrait" data-travelling-portrait={actor} key={actor}><PlayerAvatar profile={person} showFlag={false} shape="circle" /></div>)}</div>;
}

export function ScoreFlight({ feedback, paused, gentle, onComplete }) {
  const node = useRef(null), animations = useRef([]), done = useRef(onComplete);
  done.current = onComplete;
  useLayoutEffect(() => {
    const target = document.querySelector(`[data-score-target="${feedback.actor}"]`)?.getBoundingClientRect();
    if (!target) { done.current(); return; }
    const reduced = gentle || matchMedia('(prefers-reduced-motion: reduce)').matches;
    const end = { x: target.x + target.width / 2, y: target.y + target.height / 2 };
    const source = feedback.source || end;
    Object.assign(node.current.style, { left: `${end.x}px`, top: `${end.y}px` });
    const dx = source.x - end.x, dy = source.y - end.y;
    const animation = node.current.animate(reduced ? [{ opacity: 1 }, { opacity: 0 }] : [
      { transform: `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(.85)`, opacity: 0, offset: 0 },
      { transform: `translate(calc(-50% + ${dx * .9}px),calc(-50% + ${dy * .9}px)) scale(1.08)`, opacity: 1, offset: .18 },
      { transform: 'translate(-50%,-50%) scale(.65)', opacity: 1, offset: .86 },
      { transform: 'translate(-50%,-50%) scale(.45)', opacity: 0, offset: 1 },
    ], { duration: 650, easing: 'cubic-bezier(.25,.6,.35,1)', fill: 'both' });
    animations.current = [animation];
    animation.onfinish = () => done.current();
    return () => animation.cancel();
  }, []);
  usePausedAnimations(animations, paused);
  return <div className="duel-score-flight" data-score-flight={feedback.actor} ref={node} aria-hidden="true">+{feedback.points}</div>;
}

/** Tile entry starts on the visible board, and pauses with the match. */
export function TileEntrance({ boardRef, paused, gentle }) {
  const animations = useRef([]);
  useLayoutEffect(() => {
    const reduced = gentle || matchMedia('(prefers-reduced-motion: reduce)').matches;
    animations.current = [...boardRef.current.querySelectorAll('.tile-rotator')].map((node, index) => node.animate(reduced ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, translate: '0 -16px', scale: '.94' }, { opacity: 1, translate: '0 0', scale: '1' }], { duration: reduced ? 160 : 320, delay: reduced ? 0 : 100 + index * 4, fill: 'both', easing: 'cubic-bezier(.2,.7,.3,1)' }));
    return () => animations.current.forEach(animation => animation.cancel());
  }, []);
  usePausedAnimations(animations, paused);
  return null;
}
