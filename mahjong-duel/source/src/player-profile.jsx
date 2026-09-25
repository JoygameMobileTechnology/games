import React, { useId, useState } from 'react';
import { AVATAR_IDS, COUNTRIES, countryFlag, normalizeProfile, profileError } from './profile-store.js';
import './player-profile.css';

export { loadProfile, saveProfile, DEFAULT_PROFILE, COUNTRIES, countryFlag } from './profile-store.js';

const AVATAR_SHEET = './assets/remake/avatars-presets.png';
const avatarDescriptions = ['Curly hair and teal sweater', 'Wavy hair and rust shirt', 'Black bob and round glasses', 'Short curls and gold shirt', 'Auburn ponytail and blue sweater', 'Dark hair and glasses', 'Silver waves and plum cardigan', 'Silver hair and navy polo'];

export function PlayerAvatar({ profile, size = 64, showFlag = true, className = '' }) {
  const player = normalizeProfile(profile);
  const index = AVATAR_IDS.indexOf(player.avatarId);
  const country = COUNTRIES.find(item => item.code === player.countryCode);
  const pixels = Number.isFinite(size) ? Math.min(240, Math.max(24, size)) : 64;
  return <span className={`player-avatar ${className}`} data-avatar-id={player.avatarId} style={{ '--avatar-size': `${pixels}px` }}>
    <span className="player-avatar-portrait" role="img" aria-label={`${player.name}'s avatar`} style={{ backgroundImage: `url(${JSON.stringify(AVATAR_SHEET)})`, backgroundPosition: `${index % 4 / 3 * 100}% ${index < 4 ? 0 : 100}%` }} />
    {showFlag && <span className="player-country-flag" role="img" aria-label={country?.name || 'Global'} title={country?.name || 'Global'}>{countryFlag(player.countryCode)}</span>}
  </span>;
}

/** Render inside the parent's Sheet. The parent owns persistence and dismissal. */
export function ProfileEditor({ profile, onSave }) {
  const [draft, setDraft] = useState(() => normalizeProfile(profile));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const id = useId();
  const setField = (field, value) => { setDraft(previous => ({ ...previous, [field]: value })); setError(''); };
  const nameLength = Array.from(draft.name).length;
  const countryName = COUNTRIES.find(country => country.code === draft.countryCode)?.name || 'Global player';
  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    const problem = profileError(draft);
    if (problem) { setError(problem); return; }
    setSaving(true);
    try {
      if (typeof onSave !== 'function' || await onSave(normalizeProfile(draft)) === false) setError('Your profile could not be saved. Please try again.');
    } catch { setError('Your profile could not be saved. Please try again.'); }
    finally { setSaving(false); }
  }
  return <form className="profile-editor" onSubmit={submit} noValidate aria-label="Player profile">
    <div className="profile-preview"><PlayerAvatar profile={draft} size={82} /><div><strong>{draft.name.trim() || 'Your name'}</strong><span>{countryName}</span></div></div>
    <div className="profile-field">
      <label htmlFor={`${id}-name`}>Player name <span>{nameLength}/16</span></label>
      <input id={`${id}-name`} name="playerName" type="text" value={draft.name} maxLength={32} autoComplete="off" autoCapitalize="words" spellCheck={false} placeholder="Enter your name" aria-invalid={Boolean(error && profileError(draft).includes('name'))} aria-describedby={error ? `${id}-error` : undefined} onChange={event => setField('name', Array.from(event.target.value).slice(0, 16).join(''))} />
    </div>
    <fieldset className="profile-avatar-field"><legend>Choose your avatar</legend><div className="profile-avatar-grid">{AVATAR_IDS.map((avatarId, index) => <button key={avatarId} type="button" className={`profile-avatar-option ${draft.avatarId === avatarId ? 'is-selected' : ''}`} aria-label={`Avatar ${index + 1}: ${avatarDescriptions[index]}`} aria-pressed={draft.avatarId === avatarId} onClick={() => setField('avatarId', avatarId)}><PlayerAvatar profile={{ ...draft, avatarId }} size={72} showFlag={false} />{draft.avatarId === avatarId && <span className="profile-avatar-check" aria-hidden="true">✓</span>}</button>)}</div></fieldset>
    <div className="profile-field"><label htmlFor={`${id}-country`}>Country</label><div className="profile-country-control"><span aria-hidden="true">{countryFlag(draft.countryCode)}</span><select id={`${id}-country`} name="countryCode" value={draft.countryCode} onChange={event => setField('countryCode', event.target.value)}><option value="">Global</option>{COUNTRIES.map(country => <option key={country.code} value={country.code}>{country.name}</option>)}</select><span className="profile-country-chevron" aria-hidden="true">⌄</span></div></div>
    {error && <p className="profile-error" role="alert" id={`${id}-error`}>{error}</p>}
    <button className="profile-save-button" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save profile'}</button>
  </form>;
}
