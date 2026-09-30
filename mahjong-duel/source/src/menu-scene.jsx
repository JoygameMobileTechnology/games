import React, { useEffect, useId, useLayoutEffect, useRef } from 'react';
import { useReducedMotion } from 'motion/react';
import { DoorScene } from './remake-ui.jsx';
import { MenuAtmosphere } from './menu-atmosphere.jsx';
import './menu-scene.css';

function SceneOpening({ background, paused, onComplete }) {
  const root = useRef(null), completed = useRef(false), id = useId().replace(/:/g, '');
  const reduced = useReducedMotion(), night = background.id === 'lantern-night';
  // Autumn's sunlight comes through the trees at the far left of the artwork.
  const x = night ? 525 : 66, y = night ? 305 : 647;
  const complete = () => { if (!completed.current) { completed.current = true; onComplete?.(); } };

  useEffect(() => { if (reduced) complete(); }, [reduced, onComplete]);
  useLayoutEffect(() => {
    const node = root.current;
    const resize = () => {
      // Both supplied artworks are 851 × 1848. Keep the effect attached to the
      // painted sun/moon through cover cropping and rotation. Wide screens pan
      // the artwork just enough to bring an otherwise cropped light into view.
      const width = node.clientWidth, height = node.clientHeight;
      const scale = Math.max(width / 851, height / 1848);
      const artWidth = 851 * scale, artHeight = 1848 * scale;
      const left = (width - artWidth) / 2, top = (height - artHeight) / 2;
      const lightX = left + x * scale, lightY = top + y * scale;
      const targetLeft = lightX < width * .04 || lightX > width * .96
        ? Math.min(0, Math.max(width - artWidth, width * (lightX < width * .04 ? .08 : .92) - x * scale)) : left;
      const targetTop = lightY < height * .16 || lightY > height * .7
        ? Math.min(0, Math.max(height - artHeight, height * .28 - y * scale)) : top;
      for (const [key, value] of Object.entries({ 'art-width': artWidth, 'art-height': artHeight, 'art-left': left, 'art-top': top, 'pan-x': targetLeft - left, 'pan-y': targetTop - top, 'light-x': targetLeft + x * scale, 'light-y': targetTop + y * scale })) {
        node.style.setProperty(`--scene-${key}`, `${value}px`);
      }
    };
    resize();
    const observer = new ResizeObserver(resize); observer.observe(node);
    return () => observer.disconnect();
  }, [x, y]);

  return <div ref={root} className={`menu-scene menu-scene-transition menu-scene--${night ? 'moon' : 'sun'}${paused ? ' is-paused' : ''}`} data-menu-background={background.id} aria-hidden="true"
    onAnimationEnd={event => { if (event.target === event.currentTarget && event.animationName === 'menu-scene-exit') complete(); }}>
    <div className="menu-scene-picture">
      <img className="menu-scene-art" src={background.src} alt="" draggable="false" />
      <svg className="menu-scene-effects" viewBox="0 0 851 1848" aria-hidden="true" focusable="false">
        <defs>
          <radialGradient id={`${id}-halo`}><stop stopColor={night ? '#e3efff' : '#fffce0'} stopOpacity=".95" /><stop offset=".2" stopColor={night ? '#c9e1ff' : '#ffe59a'} stopOpacity=".65" /><stop offset=".55" stopColor={night ? '#b4d1ff' : '#ffc566'} stopOpacity=".2" /><stop offset="1" stopColor={night ? '#b4d1ff' : '#ffc566'} stopOpacity="0" /></radialGradient>
          <radialGradient id={`${id}-moon`} cx="62%" cy="68%"><stop stopColor="#fffef0" /><stop offset=".72" stopColor="#fff6d6" /><stop offset="1" stopColor="#efdcb1" /></radialGradient>
          <mask id={`${id}-phase`} maskUnits="userSpaceOnUse" x={x - 46} y={y - 46} width="92" height="92">
            <circle cx={x} cy={y} r="44" fill="white" />
            <circle className="menu-moon-shadow" cx={x} cy={y} r="47" fill="black" transform="translate(-13 -12)" />
          </mask>
          <filter id={`${id}-moon-glow`} filterUnits="userSpaceOnUse" x={x - 160} y={y - 160} width="320" height="320" colorInterpolationFilters="sRGB">
            <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="edge" />
            <feGaussianBlur in="SourceGraphic" stdDeviation="24" result="bloom" />
            <feMerge><feMergeNode in="bloom" /><feMergeNode in="edge" /><feMergeNode in="edge" /></feMerge>
          </filter>
          <filter id={`${id}-moon-radiance`} filterUnits="userSpaceOnUse" x={x - 80} y={y - 80} width="160" height="160" colorInterpolationFilters="sRGB">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="rim" />
            <feMerge><feMergeNode in="rim" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {night ? <>
          {/* Blur the illuminated crescent after masking, so its curve emits the light. */}
          <g className="menu-moon-glow" filter={`url(#${id}-moon-glow)`}>
            <g className="menu-moon-light-shape" mask={`url(#${id}-phase)`}>
              <circle cx={x} cy={y} r="44" fill="#fff8d8" />
            </g>
          </g>
          <g className="menu-moon-radiance" filter={`url(#${id}-moon-radiance)`}>
            <g className="menu-moon-disc" mask={`url(#${id}-phase)`}>
              <circle cx={x} cy={y} r="44" fill={`url(#${id}-moon)`} />
            </g>
          </g>
        </> : <>
          <g className="menu-sun-halo" style={{ transformOrigin: `${x}px ${y}px` }}>
            <circle cx={x} cy={y} r="320" fill={`url(#${id}-halo)`} />
          </g>
          <g className="menu-sun-core" style={{ transformOrigin: `${x}px ${y}px` }}>
            <circle cx={x} cy={y} r="18" fill="#fffde7" />
            <ellipse cx={x} cy={y} rx="220" ry="8" fill={`url(#${id}-halo)`} />
            <ellipse cx={x} cy={y} rx="8" ry="150" fill={`url(#${id}-halo)`} />
          </g>
        </>}
      </svg>
    </div>
    <MenuAtmosphere kind={background.atmosphere} paused />
    <div className="menu-scene-flash" />
  </div>;
}

export function MenuScene({ background, paused = false, opening = false, onComplete }) {
  if (opening) return background.id === 'bamboo' ? <DoorScene opening onComplete={onComplete} /> : <SceneOpening background={background} paused={paused} onComplete={onComplete} />;

  return <div className="menu-scene" data-menu-background={background.id} aria-hidden="true">
    <img className="menu-scene-art" src={background.src} alt="" draggable="false" fetchPriority="high" />
    <MenuAtmosphere kind={background.atmosphere} paused={paused} />
  </div>;
}
