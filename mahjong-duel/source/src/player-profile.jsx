import React, { useId, useState } from 'react';
import { AVATAR_IDS, COUNTRIES, countryFlag, normalizeProfile, profileError } from './profile-store.js';
import { AVATAR_FRAMES, getAvatarFrame, isFrameUnlocked } from './avatar-frames.js';
import './player-profile.css';

export { loadProfile, saveProfile, DEFAULT_PROFILE, COUNTRIES, countryFlag } from './profile-store.js';

export const AVATAR_SHEET = './assets/remake/avatars-presets.png';
const avatarDescriptions = ['Curly hair and teal sweater', 'Wavy hair and rust shirt', 'Black bob and round glasses', 'Short curls and gold shirt', 'Auburn ponytail and blue sweater', 'Dark hair and glasses', 'Silver waves and plum cardigan', 'Silver hair and navy polo'];

function LaurelBranch({ tier, mirrored = false }) {
  const leaves = tier >= 4 ? 6 : tier === 3 ? 4 : 2;
  return <g transform={mirrored ? 'translate(120 0) scale(-1 1)' : undefined}>
    <path className="avatar-frame-stem" d={tier >= 4 ? 'M29 105C9 90 4 65 15 35' : tier === 3 ? 'M27 104C13 93 7 76 10 59' : 'M27 104C19 99 14 91 11 83'} />
    {Array.from({ length: leaves }, (_, index) => <g key={index} transform={`translate(${[20, 13, 9, 8, 10, 14][index]} ${[98, 88, 77, 65, 53, 41][index]}) rotate(${[-42, -27, -15, 0, 16, 32][index]})`}>
      <path className="avatar-frame-leaf" d="M0 0C-9 1-13-5-12-11C-5-10 0-6 0 0ZM0 0C7-3 10-8 7-14C1-11-2-5 0 0Z" />
    </g>)}
  </g>;
}

/** Decorative SVG scales with every existing avatar, including the player's ghost. */
export function AvatarFrame({ frameId, shape = 'rounded' }) {
  const frame = getAvatarFrame(frameId);
  if (!frame) return null;
  if (shape === 'circle') return <svg className={`avatar-frame avatar-frame-${frame.id} avatar-frame-circle`} viewBox="0 0 120 120" aria-hidden="true" focusable="false">
    <circle className="avatar-frame-outer-ring" cx="60" cy="60" r="57" />
    <circle className="avatar-frame-inner-ring" cx="60" cy="60" r="57" />
    {frame.tier >= 2 && <path className="avatar-frame-jewel" d="M60 1L64 6L60 11L56 6ZM60 109L64 114L60 119L56 114Z" />}
    {frame.tier >= 4 && <path className="avatar-frame-jewel" d="M1 60L6 56L11 60L6 64ZM109 60L114 56L119 60L114 64Z" />}
    {frame.tier === 5 && <path className="avatar-frame-spark" d="M21 19L25 21L27 25L23 23ZM93 25L95 21L99 19L97 23ZM21 101L23 97L27 95L25 99ZM93 95L97 97L99 101L95 99Z" />}
  </svg>;
  return <svg className={`avatar-frame avatar-frame-${frame.id}`} viewBox="0 0 120 120" aria-hidden="true" focusable="false">
    <rect className="avatar-frame-outer-ring" x="10" y="10" width="100" height="100" rx="25" />
    <rect className="avatar-frame-inner-ring" x="14" y="14" width="92" height="92" rx="21" />
    <LaurelBranch tier={frame.tier} /><LaurelBranch tier={frame.tier} mirrored />
    {frame.tier >= 2 && <><path className="avatar-frame-flourish" d="M20 24Q22 12 36 14M84 14Q98 12 100 24M20 96Q23 108 36 106M84 106Q98 108 100 96" /><path className="avatar-frame-jewel" d="M60 103L66 110L60 117L54 110Z" /></>}
    {frame.tier >= 4 ? <path className="avatar-frame-crown" d="M44 12L41 2L52 7L60 0L68 7L79 2L76 12Z" /> : <path className="avatar-frame-jewel" d="M60 4L65 10L60 16L55 10Z" />}
    {frame.tier === 5 && <><path className="avatar-frame-star" d="M60 0L62 5L67 7L62 9L60 14L58 9L53 7L58 5ZM5 45L7 50L12 52L7 54L5 59L3 54L0 52L3 50ZM115 45L117 50L120 52L117 54L115 59L113 54L108 52L113 50Z" /><path className="avatar-frame-spark" d="M30 6L32 9L30 12L28 9ZM90 6L92 9L90 12L88 9ZM42 110L44 113L42 116L40 113ZM78 110L80 113L78 116L76 113Z" /></>}
  </svg>;
}

export function PlayerAvatar({ profile, size = 64, showFlag = true, className = '', shape = 'rounded' }) {
  const player = normalizeProfile(profile);
  const frame = getAvatarFrame(player.frameId);
  const index = AVATAR_IDS.indexOf(player.avatarId);
  const country = COUNTRIES.find(item => item.code === player.countryCode);
  const pixels = Number.isFinite(size) ? Math.min(240, Math.max(24, size)) : 64;
  return <span className={`player-avatar ${shape === 'circle' ? 'player-avatar-circle' : ''} ${frame ? `has-frame frame-${frame.id}` : ''} ${className}`} data-avatar-id={player.avatarId} data-frame-id={player.frameId || undefined} style={{ '--avatar-size': `${pixels}px` }}>
    <span className="player-avatar-portrait" role="img" aria-label={`${player.name}'s avatar${frame ? `, ${frame.name} frame` : ''}`} style={{ backgroundImage: `url(${JSON.stringify(AVATAR_SHEET)})`, backgroundPosition: `${index % 4 / 3 * 100}% ${index < 4 ? 0 : 100}%` }} />
    <AvatarFrame frameId={player.frameId} shape={shape} />
    {showFlag && <span className="player-country-flag" role="img" aria-label={country?.name || 'Global'} title={country?.name || 'Global'}>{countryFlag(player.countryCode)}</span>}
  </span>;
}

/** Render inside the parent's Sheet. The parent owns persistence and dismissal. */
export function ProfileEditor({ profile, achievementPoints = 0, retainedFrameIds = [], onSave }) {
  const [draft, setDraft] = useState(() => normalizeProfile(profile, achievementPoints, retainedFrameIds));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const id = useId();
  const setField = (field, value) => { setDraft(previous => ({ ...previous, [field]: value })); setError(''); };
  const nameLength = Array.from(draft.name).length;
  const countryName = COUNTRIES.find(country => country.code === draft.countryCode)?.name || 'Global player';
  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    const problem = profileError(draft, achievementPoints, retainedFrameIds);
    if (problem) { setError(problem); return; }
    setSaving(true);
    try {
      if (typeof onSave !== 'function' || await onSave(normalizeProfile(draft, achievementPoints, retainedFrameIds)) === false) setError('Your profile could not be saved. Please try again.');
    } catch { setError('Your profile could not be saved. Please try again.'); }
    finally { setSaving(false); }
  }
  return <form className="profile-editor" onSubmit={submit} noValidate aria-label="Player profile">
    <div className="profile-preview"><PlayerAvatar profile={draft} size={82} /><div><strong>{draft.name.trim() || 'Your name'}</strong><span>{countryName}</span></div></div>
    <div className="profile-field">
      <label htmlFor={`${id}-name`}>Player name <span>{nameLength}/16</span></label>
      <input id={`${id}-name`} name="playerName" type="text" value={draft.name} maxLength={32} autoComplete="off" autoCapitalize="words" spellCheck={false} placeholder="Enter your name" aria-invalid={Boolean(error && profileError(draft).includes('name'))} aria-describedby={error ? `${id}-error` : undefined} onChange={event => setField('name', Array.from(event.target.value).slice(0, 16).join(''))} />
    </div>
    <fieldset className="profile-avatar-field"><legend>Choose your avatar</legend><div className="profile-avatar-grid">{AVATAR_IDS.map((avatarId, index) => <button key={avatarId} type="button" className={`profile-avatar-option ${draft.avatarId === avatarId ? 'is-selected' : ''}`} aria-label={`Avatar ${index + 1}: ${avatarDescriptions[index]}`} aria-pressed={draft.avatarId === avatarId} onClick={() => setField('avatarId', avatarId)}><PlayerAvatar profile={{ ...draft, avatarId, frameId: '' }} size={72} showFlag={false} />{draft.avatarId === avatarId && <span className="profile-avatar-check" aria-hidden="true">✓</span>}</button>)}</div></fieldset>
    <fieldset className="profile-frame-field"><legend>Avatar frame <span>{achievementPoints.toLocaleString()} AP earned</span></legend><p>Unlock frames with Achievement Points. Your points stay yours.</p><div className="profile-frame-grid">
      {[{ id: '', name: 'No frame', pointsRequired: 0 }, ...AVATAR_FRAMES].map(frame => {
        const unlocked = isFrameUnlocked(frame.id, achievementPoints, retainedFrameIds);
        const selected = draft.frameId === frame.id;
        return <button key={frame.id || 'none'} type="button" className={`profile-frame-option ${selected ? 'is-selected' : ''} ${unlocked ? '' : 'is-locked'}`} disabled={!unlocked} aria-label={`${frame.name}${unlocked ? selected ? ', equipped' : ', available' : `, unlock at ${frame.pointsRequired.toLocaleString()} Achievement Points`}`} aria-pressed={selected} onClick={() => setField('frameId', frame.id)}>
          <PlayerAvatar profile={{ ...draft, frameId: frame.id }} size={48} showFlag={false} /><strong>{frame.name}</strong><span>{selected ? 'Equipped' : unlocked ? 'Available' : `${frame.pointsRequired.toLocaleString()} AP`}</span>
          {!unlocked && <svg className="profile-frame-lock" viewBox="0 0 16 18" aria-hidden="true"><path d="M4 7V5a4 4 0 0 1 8 0v2M2 7h12v9H2Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><circle cx="8" cy="11" r="1" fill="currentColor" /></svg>}
        </button>;
      })}
    </div></fieldset>
    <div className="profile-field"><label htmlFor={`${id}-country`}>Country</label><div className="profile-country-control"><span aria-hidden="true">{countryFlag(draft.countryCode)}</span><select id={`${id}-country`} name="countryCode" value={draft.countryCode} onChange={event => setField('countryCode', event.target.value)}><option value="">Global</option>{COUNTRIES.map(country => <option key={country.code} value={country.code}>{country.name}</option>)}</select><span className="profile-country-chevron" aria-hidden="true">⌄</span></div></div>
    {error && <p className="profile-error" role="alert" id={`${id}-error`}>{error}</p>}
    <button className="profile-save-button" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save profile'}</button>
  </form>;
}
