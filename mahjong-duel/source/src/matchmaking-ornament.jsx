import React from 'react';

function CloudCurls() {
  return <g>
    <path fill="#d8b75e" fillOpacity=".24" d="M27 73C16 74 9 68 10 59c0-8 7-13 15-12-2-10 5-18 15-18 2-10 10-17 20-16 10-1 19 6 21 16 11-1 19 7 18 17 9 0 14 6 13 14-1 9-8 14-19 13-10-1-18-5-33-5s-24 5-33 5Z" />
    <path fill="#f5df9d" fillOpacity=".38" d="M35 67c-9 2-17-3-16-10 0-6 7-9 13-6-3-9 2-16 11-16 1-9 9-15 17-13 9-2 17 4 18 13 9 0 15 7 12 16 7-3 14 0 14 6 0 8-8 12-18 10-8-2-16-5-26-5s-17 3-25 5Z" />
    <g fill="none" stroke="#fff8d8" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
      <path d="M28 63c-7 2-12-2-11-7 1-5 7-6 10-3 3 3 1 7-3 7" />
      <path d="M37 59c-7-2-9-9-5-14 3-4 10-4 13 0 3 4 0 9-4 8" />
      <path d="M47 34c0-7 6-12 13-11 7-1 13 4 13 11" />
      <path d="M43 35c4-2 9 0 10 4 1 4-2 7-5 6" />
      <path d="M77 35c-4-2-9 0-10 4-1 4 2 7 5 6" />
      <path d="M83 59c7-2 9-9 5-14-3-4-10-4-13 0-3 4 0 9 4 8" />
      <path d="M92 63c7 2 12-2 11-7-1-5-7-6-10-3-3 3-1 7 3 7" />
      <path d="M44 63c5-3 10-3 16-3s11 0 16 3" strokeOpacity=".7" />
    </g>
    <path fill="none" stroke="#c99b3d" strokeOpacity=".23" strokeWidth=".8" strokeLinecap="round" d="M38 27c4-8 11-13 22-12 11-1 18 4 22 12" />
  </g>;
}

function Sparkle({ x, y }) {
  return <g transform={`translate(${x} ${y})`}>
    <path fill="#e4bc54" fillOpacity=".24" d="M0-13 3-3 9 0 3 3 0 13-3 3-9 0-3-3Z" />
    <path fill="#f8dc84" d="M0-10 2-2 6 0 2 2 0 10-2 2-6 0-2-2Z" />
    <path fill="#fffbe1" d="M0-6 1-1 3.5 0 1 1 0 6-1 1-3.5 0-1-1Z" />
  </g>;
}

/** Cloud-scroll flourishes frame the existing VS seal without covering its face. */
export function VersusOrnament() {
  return <svg className="matchmaking-versus-ornament" viewBox="0 0 120 220" aria-hidden="true" focusable="false">
    <CloudCurls />
    <g transform="translate(0 220) scale(1 -1)"><CloudCurls /></g>
    <Sparkle x={14} y={62} />
    <Sparkle x={106} y={62} />
    <Sparkle x={14} y={158} />
    <Sparkle x={106} y={158} />
  </svg>;
}
