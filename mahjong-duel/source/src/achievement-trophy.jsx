import React, { useId } from 'react';
import { getTrophyAtlasUrl } from './achievement-artwork.js';

const subjects = ['duelist', 'bamboo', 'banner', 'ribbon', 'heart', 'fan', 'reed', 'scales', 'steps', 'cabinet', 'flower', 'screen', 'lantern', 'compass', 'eagle', 'cup'];

/** One illustrated subject; each earned level adds another pair of laurel leaves. */
export function AchievementTrophy({ artKey = 'cup', level = 0, totalLevels = 1, preview = false }) {
  const id = useId().replace(/:/g, '');
  const index = Math.max(0, subjects.indexOf(artKey));
  const glory = level === 0 ? 0 : Math.min(5, 1 + Math.floor((level - 1) * 4 / Math.max(1, totalLevels - 1)));
  const leaves = totalLevels > 1 ? Math.min(level, 10) : 0;
  return <span className={`achievement-trophy glory-${glory} ${preview ? 'is-preview' : ''}`} data-glory={glory} aria-hidden="true">
    <svg className="trophy-ornament" viewBox="0 0 240 240">
      <defs><linearGradient id={`laurel-${id}`} x1="0" x2="1" y1="0" y2="1"><stop stopColor="#fff2b4" /><stop offset=".45" stopColor="#e6b547" /><stop offset="1" stopColor="#97521b" /></linearGradient></defs>
      {leaves > 0 && <g fill={`url(#laurel-${id})`} stroke="#9d601f" strokeWidth=".8">{[-1, 1].map(side => <g key={side} transform={`translate(120 0) scale(${side} 1)`}>
        <path d="M8 220 Q-100 199-92 80" fill="none" strokeWidth="2" />
        {Array.from({ length: leaves }, (_, i) => <g key={i} transform={`translate(${-25 - 67 * Math.sin((i + 1) / 11 * Math.PI / 2)} ${214 - i * 13}) rotate(${-65 + i * 5})`}><path d="M0 0 Q-23-2-21-24 Q-3-21 0 0Z" /><path d="M0 0 Q12-18 25-13 Q16 1 0 0Z" /></g>)}
      </g>)}</g>}
      {glory >= 4 && <path fill={`url(#laurel-${id})`} stroke="#a86b23" d="m98 24-6-17 19 9 9-14 9 14 19-9-6 17z" />}
      {glory === 5 && <g fill="#fff4b9"><path d="m27 57 3 9 9 3-9 3-3 9-3-9-9-3 9-3zM207 106l3 9 9 3-9 3-3 9-3-9-9-3 9-3z" /></g>}
    </svg>
    <span className={`trophy-illustration sprite-row-${Math.floor(index / 4)}`} style={{ backgroundImage: `url("${getTrophyAtlasUrl()}")`, backgroundPosition: `${(index % 4) * 100 / 3}% ${Math.floor(index / 4) * 100 / 3}%` }} />
    {level === 0 && <span className="trophy-lock"><svg viewBox="0 0 24 24"><path d="M7 10V7a5 5 0 0 1 10 0v3M6 10h12v11H6z" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" /><circle cx="12" cy="15" r="1.5" /></svg></span>}
  </span>;
}
