import React from 'react';
import './menu-atmosphere.css';

// Fixed paths and negative delays keep scene changes stable and naturally staggered.
const seasonalParticles = {
  spring: [
    { x: 7, size: 15, duration: 29, delay: -7, drift: 54, turn: 9, angle: -24, opacity: .94 },
    { x: 23, size: 12, duration: 37, delay: -25, drift: -28, turn: 12, angle: 39, opacity: .78 },
    { x: 39, size: 16, duration: 32, delay: -16, drift: 43, turn: 10, angle: -58, opacity: .9 },
    { x: 58, size: 12, duration: 40, delay: -32, drift: -37, turn: 13, angle: 16, opacity: .74 },
    { x: 77, size: 15, duration: 34, delay: -11, drift: 34, turn: 11, angle: 52, opacity: .88 },
    { x: 92, size: 14, duration: 36, delay: -26, drift: -48, turn: 10, angle: -35, opacity: .84 },
    { x: 15, size: 11, duration: 43, delay: -36, drift: 32, turn: 14, angle: 67, opacity: .7 },
    { x: 67, size: 11, duration: 39, delay: -20, drift: -23, turn: 12, angle: -12, opacity: .72 },
    { x: 86, size: 12, duration: 41, delay: -4, drift: 27, turn: 13, angle: 28, opacity: .76 },
    { x: 32, size: 14, duration: 35, delay: -30, drift: -36, turn: 11, angle: 45, opacity: .84 },
    { x: 51, size: 11, duration: 42, delay: -12, drift: 29, turn: 14, angle: -18, opacity: .72 },
    { x: 3, size: 13, duration: 38, delay: -19, drift: 46, turn: 12, angle: 61, opacity: .8 },
  ],
  bamboo: [
    { x: 5, size: 35, duration: 31, delay: -9, drift: 41, turn: 11, angle: -32, opacity: .88 },
    { x: 24, size: 27, duration: 39, delay: -28, drift: -29, turn: 14, angle: 27, opacity: .74 },
    { x: 44, size: 33, duration: 35, delay: -18, drift: 36, turn: 12, angle: -48, opacity: .84 },
    { x: 68, size: 29, duration: 42, delay: -33, drift: -33, turn: 15, angle: 43, opacity: .78 },
    { x: 87, size: 37, duration: 33, delay: -13, drift: -44, turn: 12, angle: -19, opacity: .88 },
    { x: 14, size: 24, duration: 45, delay: -39, drift: 27, turn: 16, angle: 58, opacity: .68 },
    { x: 76, size: 25, duration: 43, delay: -4, drift: 24, turn: 14, angle: 14, opacity: .7 },
    { x: 36, size: 31, duration: 38, delay: -29, drift: -32, turn: 13, angle: -56, opacity: .82 },
    { x: 58, size: 24, duration: 44, delay: -13, drift: 28, turn: 15, angle: 34, opacity: .72 },
    { x: 94, size: 29, duration: 36, delay: -24, drift: -39, turn: 12, angle: 62, opacity: .8 },
  ],
};

const mapleLeaves = [
  { x: 9, size: 35, duration: 25, delay: -5, drift: 37, turn: 8, angle: -22, color: '#cd602d' },
  { x: 28, size: 27, duration: 30, delay: -21, drift: -32, turn: 10, angle: 34, color: '#a93727' },
  { x: 47, size: 32, duration: 28, delay: -12, drift: 43, turn: 9, angle: -46, color: '#d47a36' },
  { x: 65, size: 38, duration: 32, delay: -27, drift: -40, turn: 11, angle: 18, color: '#b54a28' },
  { x: 81, size: 29, duration: 26, delay: -17, drift: 24, turn: 8.5, angle: 56, color: '#c85029' },
  { x: 94, size: 34, duration: 34, delay: -9, drift: -51, turn: 12, angle: -31, color: '#c96b2b' },
  { x: 17, size: 30, duration: 33, delay: -26, drift: 35, turn: 11, angle: 47, color: '#b94a28' },
  { x: 55, size: 27, duration: 31, delay: -4, drift: -28, turn: 10, angle: -15, color: '#d27a32' },
  { x: 74, size: 32, duration: 29, delay: -22, drift: 31, turn: 9, angle: 68, color: '#af3e28' },
];

function MapleLeaf() {
  return <svg viewBox="0 0 64 72" focusable="false" aria-hidden="true">
    <path className="menu-maple-stem" d="M32 44c1 9-4 17-3 24" />
    <path fill="currentColor" d="M32 3 26 20 21 16 23 30 14 24 12 15 8 27 1 25 8 36 5 41 22 45 18 53 31 49 45 54 42 45 59 41 56 36 63 26 55 28 52 16 49 25 39 31 42 16 37 20Z" />
    <path className="menu-maple-light" d="M32 3 31 49 18 53 22 45 5 41 8 36 1 25 8 27 12 15 14 24 23 30 21 16 26 20Z" />
    <path className="menu-maple-veins" d="M31 49 32 10M31 46 13 26M31 46 51 27M30 46 11 39M32 46 53 40M31 37 25 25M32 35 38 24" />
  </svg>;
}

function SeasonalParticle({ kind }) {
  if (kind === 'spring') return <svg viewBox="0 0 18 22" focusable="false" aria-hidden="true">
    <path fill="currentColor" d="M9 3C3-2-1 6 2 13c2 4 5 6 7 8 3-3 7-6 8-11 1-6-3-11-8-7Z" />
    <path fill="#fce8ec" opacity=".55" d="M9 4c-3 5-3 11 0 17-4-4-7-8-7-12 0-5 3-8 7-5Z" />
  </svg>;
  if (kind === 'bamboo') return <svg viewBox="0 0 36 10" focusable="false" aria-hidden="true">
    <path fill="currentColor" d="M1 9C8 1 19-2 35 1 28 7 15 10 1 9Z" />
    <path fill="none" stroke="#bbbf80" strokeWidth=".6" opacity=".5" d="M2 9C12 6 22 3 33 1" />
  </svg>;
  return null;
}

export function MenuAtmosphere({ kind, paused = false }) {
  return <div className={`menu-atmosphere menu-atmosphere--${kind}${paused ? ' is-paused' : ''}`} aria-hidden="true">
    {seasonalParticles[kind]?.map((particle, index) => <span
      className="menu-seasonal-track"
      key={index}
      style={{
        '--particle-x': `${particle.x}%`, '--particle-size': `${particle.size}px`,
        '--particle-duration': `${particle.duration}s`, '--particle-delay': `${particle.delay}s`,
        '--particle-drift': `${particle.drift}px`, '--particle-opacity': particle.opacity,
        '--particle-turn': `${particle.turn ?? 12}s`, '--particle-angle': `${particle.angle ?? 0}deg`,
      }}
    ><span className="menu-seasonal-particle"><SeasonalParticle kind={kind} /></span></span>)}
    {kind === 'autumn' && mapleLeaves.map((leaf, index) => <span
      className="menu-maple-track"
      key={index}
      style={{
        '--maple-x': `${leaf.x}%`, '--maple-size': `${leaf.size}px`,
        '--maple-duration': `${leaf.duration}s`, '--maple-delay': `${leaf.delay}s`,
        '--maple-drift': `${leaf.drift}px`, '--maple-turn': `${leaf.turn}s`,
        '--maple-angle': `${leaf.angle}deg`, '--maple-color': leaf.color,
      }}
    ><span className="menu-maple-leaf"><MapleLeaf /></span></span>)}
  </div>;
}
