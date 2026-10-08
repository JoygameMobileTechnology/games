import React, { useEffect, useMemo, useState } from 'react';
import { MenuScene } from './menu-scene.jsx';
import { chooseLoadingTiles } from './loading-state.js';
import './loading-screen.css';

const LOGO = './assets/remake/loading-logo.png';
const CYCLE_MS = 1800;
const STEP_MS = CYCLE_MS / 3;

/** Failed or slow artwork must never strand the player on the loading screen. */
function prepareImages(sources) {
  const images = [];
  let timeout;
  const pending = [...new Set(sources)].map(src => new Promise(resolve => {
    const image = new Image();
    images.push(image);
    image.onload = async () => {
      try { await image.decode?.(); } catch { /* An already-loaded image remains usable. */ }
      resolve();
    };
    image.onerror = resolve;
    image.src = src;
  }));
  const ready = Promise.race([
    Promise.all(pending),
    new Promise(resolve => { timeout = setTimeout(resolve, 6000); }),
  ]);
  return {
    ready,
    dispose() {
      clearTimeout(timeout);
      images.forEach(image => { image.onload = null; image.onerror = null; });
    },
  };
}

export function LoadingScreen({ theme, background, startupArtwork = [], gentle = false, onReady, onComplete }) {
  const [leaving, setLeaving] = useState(false);
  const [position, setPosition] = useState(0);
  const tiles = useMemo(() => chooseLoadingTiles(theme.id), [theme.id]);
  useEffect(() => {
    if (leaving || gentle || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = setInterval(() => {
      // Stop at the end of this shuffled set instead of showing an artwork twice.
      setPosition(current => Math.min(current + 1, tiles.length - 3));
    }, STEP_MS);
    return () => clearInterval(timer);
  }, [leaving, gentle, tiles]);
  useEffect(() => {
    let cancelled = false, revealTimer, exitTimer;
    const reduced = gentle || matchMedia('(prefers-reduced-motion: reduce)').matches;
    const started = performance.now();
    const artwork = prepareImages([background.src, LOGO, ...tiles.map(tile => tile.src), ...startupArtwork]);
    artwork.ready.then(() => {
      if (cancelled) return;
      // One readable cycle avoids a flash of loading UI on a warm launch.
      revealTimer = setTimeout(() => {
        onReady();
        setLeaving(true);
        exitTimer = setTimeout(onComplete, reduced ? 0 : 240);
      }, Math.max(0, (reduced ? 200 : CYCLE_MS) - (performance.now() - started)));
    });
    return () => {
      cancelled = true;
      clearTimeout(revealTimer);
      clearTimeout(exitTimer);
      artwork.dispose();
    };
  }, [background.src, tiles, startupArtwork, gentle, onReady, onComplete]);

  return <section className={`launch-loading${gentle ? ' is-gentle gentle-motion' : ''}${leaving ? ' is-leaving' : ''}`} aria-label="Mahjong Duel is loading" data-loading-theme={theme.id}>
    <MenuScene background={background} paused={leaving} />
    <div className="launch-loading-vignette" aria-hidden="true" />
    <img className="launch-loading-logo" src={LOGO} alt="Mahjong Duel" fetchPriority="high" draggable="false" />
    <div className="launch-loading-cue">
      <div className="launch-loading-tiles" aria-hidden="true" data-loading-position={position}>
        {tiles.map((tile, index) => {
          const slot = index - position - 1;
          return <span className={`launch-loading-tile${slot === 0 ? ' is-centered' : ''}${Math.abs(slot) > 1 ? ' is-outside' : ''}`} key={tile.id} data-tile-id={tile.id} style={{ '--loading-slot': slot }}>
            <img src={tile.src} alt="" draggable="false" />
          </span>;
        })}
      </div>
      <p role="status" aria-live="polite">Loading…</p>
    </div>
  </section>;
}
