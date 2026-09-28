import React from 'react';
import { FallingLeaves } from './remake-ui.jsx';
import './menu-atmosphere.css';

// Fixed paths and negative delays keep scene changes stable and naturally staggered.
const fireflies = [
  { y: 59, size: 2, duration: 34, delay: -9, wander: 7, lift: 24, reverse: false, green: false },
  { y: 76, size: 2.5, duration: 43, delay: -30, wander: 9, lift: 18, reverse: true, green: true },
  { y: 68, size: 1.8, duration: 38, delay: -18, wander: 6, lift: 31, reverse: false, green: true },
  { y: 87, size: 2.2, duration: 47, delay: -6, wander: 8, lift: 22, reverse: true, green: false },
  { y: 49, size: 1.7, duration: 41, delay: -25, wander: 10, lift: 28, reverse: false, green: false },
  { y: 81, size: 2.8, duration: 36, delay: -23, wander: 7.5, lift: 16, reverse: false, green: true },
  { y: 63, size: 2, duration: 45, delay: -12, wander: 8.5, lift: 35, reverse: true, green: false },
  { y: 92, size: 1.9, duration: 39, delay: -33, wander: 6.5, lift: 21, reverse: true, green: true },
  { y: 72, size: 2.3, duration: 49, delay: -39, wander: 11, lift: 27, reverse: false, green: false },
  { y: 54, size: 1.6, duration: 44, delay: -3, wander: 9.5, lift: 19, reverse: true, green: true },
];

const mapleLeaves = [
  { x: 9, size: 26, duration: 25, delay: -5, drift: 37, turn: 8, angle: -22, color: '#cd602d' },
  { x: 28, size: 19, duration: 30, delay: -21, drift: -32, turn: 10, angle: 34, color: '#a93727' },
  { x: 47, size: 23, duration: 28, delay: -12, drift: 43, turn: 9, angle: -46, color: '#d47a36' },
  { x: 65, size: 29, duration: 32, delay: -27, drift: -40, turn: 11, angle: 18, color: '#b54a28' },
  { x: 81, size: 21, duration: 26, delay: -17, drift: 24, turn: 8.5, angle: 56, color: '#c85029' },
  { x: 94, size: 25, duration: 34, delay: -9, drift: -51, turn: 12, angle: -31, color: '#c96b2b' },
];

function MapleLeaf() {
  return <svg viewBox="0 0 64 72" focusable="false" aria-hidden="true">
    <path className="menu-maple-stem" d="M32 44c1 9-4 17-3 24" />
    <path fill="currentColor" d="M32 3 26 20 21 16 23 30 14 24 12 15 8 27 1 25 8 36 5 41 22 45 18 53 31 49 45 54 42 45 59 41 56 36 63 26 55 28 52 16 49 25 39 31 42 16 37 20Z" />
    <path className="menu-maple-light" d="M32 3 31 49 18 53 22 45 5 41 8 36 1 25 8 27 12 15 14 24 23 30 21 16 26 20Z" />
    <path className="menu-maple-veins" d="M31 49 32 10M31 46 13 26M31 46 51 27M30 46 11 39M32 46 53 40M31 37 25 25M32 35 38 24" />
  </svg>;
}

export function MenuAtmosphere({ kind, paused = false }) {
  return <div className={`menu-atmosphere menu-atmosphere--${kind}${paused ? ' is-paused' : ''}`} aria-hidden="true">
    {kind === 'bamboo' && <FallingLeaves />}
    {kind === 'fireflies' && fireflies.map((fly, index) => <span
      className={`menu-firefly-track${fly.green ? ' menu-firefly-track--green' : ''}`}
      key={index}
      style={{
        '--fly-y': `${fly.y}%`, '--fly-size': `${fly.size}px`,
        '--fly-duration': `${fly.duration}s`, '--fly-delay': `${fly.delay}s`,
        '--fly-wander': `${fly.wander}s`, '--fly-lift': `${fly.lift}px`,
        '--fly-direction': fly.reverse ? 'reverse' : 'normal',
      }}
    ><i /></span>)}
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
