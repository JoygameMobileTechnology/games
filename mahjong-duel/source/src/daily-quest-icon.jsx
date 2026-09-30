import React, { useId } from 'react';
import './daily-quest-icon.css';

const METRIC_ART = {
  pairs: 'pairs',
  attempts: 'attempts',
  opening: 'opening',
  unique: 'gallery',
  chain: 'chain',
  duels: 'duel',
  wins: 'trophy',
  'counter:rememberedPairs': 'memory',
  'counter:matchesAfterOwnPreviousAttemptMissed': 'recovery',
  'rarity:marble': 'marble',
  'rarity:sapphire': 'sapphire',
  'rarity:amethyst': 'amethyst',
  'rarity:gold': 'gold',
};

/** Each quest family has a small illustrated object, shared across its milestones. */
export function DailyQuestIcon({ metric, className = '' }) {
  const id = `quest-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const paint = name => `url(#${id}-${name})`;
  const art = METRIC_ART[metric] || 'pairs';
  const tile = (x, y, angle = 0, symbol = 'bamboo', scale = 1) => (
    <g transform={`translate(${x} ${y}) rotate(${angle}) scale(${scale})`}>
      <rect x="-20" y="-30" width="40" height="62" rx="7" fill="#145f39" stroke="#754318" strokeWidth="1.7" />
      <rect x="-20" y="-33" width="40" height="61" rx="7" fill={paint('ivory')} stroke="#b48742" strokeWidth="1.6" />
      <rect x="-17.5" y="-30.5" width="35" height="55.5" rx="5" fill="none" stroke="#fffdf0" strokeWidth="1.7" />
      {symbol === 'bamboo' && <g fill={paint('green')} stroke="#0e6037" strokeWidth=".55">
        {[-17, -1, 15].map(y => <g key={y} transform={`translate(0 ${y})`}>
          <path d="M-3-7Q-5-8-5-5L-3-2V3L-5 6Q-5 8-2 7H2Q5 8 5 6L3 3V-2L5-5Q5-8 3-7Z" />
          <path d="M-1-5V5" fill="none" stroke="#b2e39b" strokeWidth="1" />
        </g>)}
      </g>}
      {symbol === 'lotus' && <g transform="translate(0 -1)" fill={paint('blue')} stroke="#184a86" strokeWidth=".75">
        <path d="M0 13C-18 7-17-6-12-9C-5-6-1 1 0 13Z" />
        <path d="M0 13C18 7 17-6 12-9C5-6 1 1 0 13Z" />
        <path d="M0 13C-9 3-9-10 0-18C9-10 9 3 0 13Z" />
        <path d="M0 13Q-10 18-15 9Q-4 7 0 13ZM0 13Q10 18 15 9Q4 7 0 13Z" />
        <path d="M0 10V-11" stroke="#addef9" fill="none" />
      </g>}
      {symbol === 'dots' && <g fill={paint('red')} stroke="#8d3d26" strokeWidth=".5">
        {[[-7,-14],[7,-14],[0,0],[-7,14],[7,14]].map(([cx,cy])=><g key={`${cx}:${cy}`}><circle cx={cx} cy={cy} r="4.8"/><circle cx={cx-.9} cy={cy-1.1} r="1.5" fill="#ffe8bc" stroke="none"/></g>)}
      </g>}
      {symbol === 'back' && <g>
        <rect x="-13" y="-24" width="26" height="43" rx="3" fill={paint('green')} stroke="#1b6543" />
        <path d="M0-17 8-2 0 13-8-2Z" fill="none" stroke="#c6d79a" strokeWidth="1.2" />
        <path d="M0-10 4-2 0 6-4-2Z" fill="#c6d79a" />
      </g>}
    </g>
  );
  const star = (x, y, scale = 1) => <path transform={`translate(${x} ${y}) scale(${scale})`} d="M0-8 2-2 8 0 2 2 0 8-2 2-8 0-2-2Z" fill="#fff2a7" stroke="#d89b30" strokeWidth=".65" />;
  const pair = () => <>{tile(36, 50, -19)}{tile(75, 49, 17)}</>;
  const gemstone = color => color === 'marble' ? <g transform="translate(75 76)">
    <circle r="19" fill={paint('marble')} stroke="#8c8980" strokeWidth="1.4" />
    <path d="M-15-11Q-5-6-8 1T1 12L5 18M-4-18Q-9-6 3-3T15 11" fill="none" stroke="#afafa4" strokeWidth="1.2" opacity=".65" />
    <path d="M-11-11Q-2-18 9-11" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
  </g> : color === 'gold' ? <g transform="translate(75 77)">
    <path d="M-21 10-13-12H13L22 10 14 16H-13Z" fill={paint('gold')} stroke="#a65d12" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M-13-12-7 5H15L13-12M-7 5-13 16M15 5 14 16" fill="none" stroke="#dc8d15" strokeWidth="1.3" />
    <path d="M-10-9H10L12-2H-8Z" fill="#ffef93" opacity=".85" />
    {star(-3,-5,.5)}
  </g> : <g transform="translate(75 76)">
    <path d="M0-23 20 0 0 23-20 0Z" fill={paint(color === 'sapphire' ? 'blue' : 'purple')} stroke={color === 'sapphire' ? '#12548c' : '#673194'} strokeWidth="1.8" strokeLinejoin="round" />
    <path d="M0-23-11 0 0 14 11 0ZM-20 0H-11M20 0H11M0 23V14" fill={color === 'sapphire' ? '#a9e7ff' : '#e4bbff'} fillOpacity=".32" stroke={color === 'sapphire' ? '#7dcdf5' : '#c481f0'} strokeWidth="1" />
    <path d="M0-18 8-3" stroke="#fff0ff" strokeWidth="2.4" strokeLinecap="round" opacity=".85" />
  </g>;

  return <svg className={`daily-quest-icon ${className}`} viewBox="0 0 112 112" fill="none" aria-hidden="true" focusable="false" data-quest-art={art}>
    <defs>
      <linearGradient id={`${id}-ivory`} x1="0" x2="1" y1="0" y2="1"><stop stopColor="#fffef5" /><stop offset=".53" stopColor="#fff3ce" /><stop offset="1" stopColor="#dcc690" /></linearGradient>
      <linearGradient id={`${id}-gold`} x1="0" x2=".8" y1="0" y2="1"><stop stopColor="#fff5a0" /><stop offset=".24" stopColor="#ffd750" /><stop offset=".52" stopColor="#efa51e" /><stop offset=".76" stopColor="#ffe170" /><stop offset="1" stopColor="#ba6412" /></linearGradient>
      <linearGradient id={`${id}-green`} x1="0" x2="1" y1="0" y2="1"><stop stopColor="#45aa59" /><stop offset=".46" stopColor="#157845" /><stop offset="1" stopColor="#075d39" /></linearGradient>
      <linearGradient id={`${id}-blue`} x1="0" x2=".85" y1="0" y2="1"><stop stopColor="#84d7ff" /><stop offset=".36" stopColor="#298fe9" /><stop offset="1" stopColor="#094693" /></linearGradient>
      <linearGradient id={`${id}-purple`} x1="0" x2=".85" y1="0" y2="1"><stop stopColor="#e0a6ff" /><stop offset=".4" stopColor="#a14bd4" /><stop offset="1" stopColor="#57218c" /></linearGradient>
      <linearGradient id={`${id}-red`} x1="0" x2="1" y1="0" y2="1"><stop stopColor="#ec8058" /><stop offset="1" stopColor="#ad3a26" /></linearGradient>
      <linearGradient id={`${id}-wood`} x1="0" x2="0" y1="0" y2="1"><stop stopColor="#af692c" /><stop offset=".5" stopColor="#643315" /><stop offset="1" stopColor="#361e10" /></linearGradient>
      <radialGradient id={`${id}-marble`} cx=".3" cy=".25" r=".8"><stop stopColor="#fffdf7" /><stop offset=".4" stopColor="#e4e3d9" /><stop offset=".83" stopColor="#acafa8" /><stop offset="1" stopColor="#7c837d" /></radialGradient>
    </defs>
    <ellipse cx="57" cy="98" rx="38" ry="5" fill="#77481d" opacity=".11" />
    <g className="daily-quest-icon-object">
      {(art === 'pairs' || art === 'chain' || art === 'memory') && pair()}
      {art === 'chain' && <g transform="translate(56 65) rotate(-37)" stroke={paint('gold')} strokeWidth="6">
        <rect x="-21" y="-8" width="27" height="16" rx="8" fill="none" stroke="#a36219" strokeWidth="8" />
        <rect x="-3" y="-8" width="27" height="16" rx="8" fill="none" stroke="#a36219" strokeWidth="8" />
        <rect x="-21" y="-8" width="27" height="16" rx="8" />
        <rect x="-3" y="-8" width="27" height="16" rx="8" />
        <path d="M-14-8H-5M5-8H14" stroke="#fff2a9" strokeWidth="2" strokeLinecap="round" />
      </g>}
      {art === 'memory' && <g transform="translate(56 79)">
        <path d="M-26 0Q0-27 26 0Q0 27-26 0Z" fill={paint('gold')} stroke="#935520" strokeWidth="1.5" />
        <path d="M-19 0Q0-17 19 0Q0 17-19 0Z" fill="#fff9df" />
        <circle r="8" fill={paint('green')} /><circle r="3.5" fill="#123d2c" /><circle cx="-2" cy="-3" r="2" fill="#f2ffe9" />
      </g>}
      {art === 'attempts' && <>{tile(36,51,-15,'back')}{tile(76,49,15)}<path d="M38 89Q57 104 79 87" stroke={paint('gold')} strokeWidth="6" strokeLinecap="round" /><path d="m77 79 10 5-9 10Z" fill={paint('gold')} stroke="#ae741b" /></>}
      {art === 'opening' && <>
        <g stroke="#d5a046" strokeWidth="2" strokeLinecap="round"><path d="M56 9V2M83 19l5-6M94 42l8-1M29 18l-5-6M20 40l-8-1" /></g>
        {tile(55,56,-8,'lotus',1.18)}{star(83,23,1.2)}{star(27,76,.8)}
      </>}
      {art === 'gallery' && <>{tile(30,60,-23,'bamboo',.88)}{tile(80,60,22,'dots',.88)}{tile(55,48,0,'lotus',1.03)}<path d="M31 90h51l-4 7H35Z" fill={paint('gold')} stroke="#b38137" /></>}
      {art === 'duel' && <>{tile(34,44,-15,'lotus',.93)}{tile(77,44,15,'bamboo',.93)}<path d="M29 89h57l-5 11H34Z" fill={paint('wood')} stroke="#764721" strokeWidth="1.5" /><path d="M56 64 74 72 72 90 56 101 40 90 38 72Z" fill={paint('gold')} stroke="#9e651e" strokeWidth="1.5" /><path d="m46 81 7 7 13-15" stroke="#246a36" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" /></>}
      {art === 'recovery' && <>
        {tile(55,49,-9,'bamboo',1.06)}
        <path d="M29 69C13 98 76 111 91 75" fill="none" stroke="#9e5f18" strokeWidth="8" strokeLinecap="round" />
        <path d="M29 68C13 96 76 109 91 74" fill="none" stroke={paint('gold')} strokeWidth="6" strokeLinecap="round" />
        <path d="m79 72 18-9 1 21Z" fill={paint('gold')} stroke="#9e5f18" strokeWidth="1.3" strokeLinejoin="round" />
        {star(26,24,.85)}
      </>}
      {['marble','sapphire','amethyst','gold'].includes(art) && <>{tile(46,47,-13,'lotus',1.1)}{gemstone(art)}{star(89,45,.65)}</>}
      {art === 'trophy' && <>
        <path d="M30 26H12V39Q12 59 35 60M82 26h18v13Q100 59 77 60" stroke="#9c5616" strokeWidth="9" strokeLinejoin="round" />
        <path d="M30 26H12V39Q12 59 35 60M82 26h18v13Q100 59 77 60" stroke={paint('gold')} strokeWidth="5" strokeLinejoin="round" />
        <path d="M24 20H88L83 49Q78 66 62 70V80H50V70Q34 66 29 49Z" fill={paint('gold')} stroke="#a05a12" strokeWidth="2" />
        <ellipse cx="56" cy="20" rx="32" ry="9" fill="#fbbf31" stroke="#9e5a13" strokeWidth="2" />
        <ellipse cx="56" cy="19" rx="27" ry="5.4" fill="#b96814" /><path d="M31 19Q55 8 81 19" stroke="#fff5a8" strokeWidth="2" strokeLinecap="round" />
        <path d="m56 31 5 10 11 2-8 8 2 11-10-5-10 5 2-11-8-8 11-2Z" fill="#fff1a0" stroke="#d38917" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M49 75h14l7 10H42Z" fill={paint('gold')} stroke="#ac6b1c" strokeWidth="1.5" />
        <path d="M34 88q0-5 6-5h32q6 0 6 5v10H34Z" fill={paint('wood')} stroke="#8e5825" strokeWidth="2" />
        <path d="M37 86H75M38 95H74" stroke="#e0a84c" strokeWidth="1.3" /><path d="M35 30q1 20 9 26" fill="none" stroke="#fff3a0" strokeWidth="2.5" strokeLinecap="round" />
      </>}
    </g>
  </svg>;
}
