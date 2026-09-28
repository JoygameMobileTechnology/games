import React from 'react';
import { GearSix, Leaf, Palette } from '@phosphor-icons/react';
import { PlayerAvatar } from './player-profile.jsx';
import dailyGlyph from './assets/menu-icons/daily-rewards.svg?raw';
import achievementGlyph from './assets/menu-icons/achievements.svg?raw';
import leaderboardGlyph from './assets/menu-icons/leaderboards.svg?raw';
import './progression-menu.css';

const glyphs = { daily: dailyGlyph, achievements: achievementGlyph, leaderboards: leaderboardGlyph };
/** The supplied, local vectors remain editable and inherit the wooden control's ink. */
export function ProgressionGlyph({ name, className = '' }) {
  return <span className={`progression-glyph ${className}`} aria-hidden="true" dangerouslySetInnerHTML={{ __html: glyphs[name].replaceAll('#ffe6a4', 'currentColor') }} />;
}
function shortDays(days) { return days >= 1000000 ? `${Math.floor(days / 1000000)}m` : days >= 1000 ? `${Math.floor(days / 1000)}k` : String(days); }
export function ProgressionMenuHeader({ profile, loginDays = 0, onProfile, onDaily, onAchievements, onThemes, onSettings, onLeaderboards }) {
  return <>
    <header className="home-toolbar progression-toolbar">
      <button className="profile-launch" onClick={onProfile} aria-label="Edit profile" title={profile.name}><PlayerAvatar profile={profile} /><span>{profile.name}</span></button>
      <div className="home-utilities progression-utilities">
        <button className="icon-button daily-menu-control" aria-label={`Daily Rewards, ${loginDays.toLocaleString()} login days`} title="Daily Rewards" onClick={onDaily}><ProgressionGlyph name="daily" /><span className="daily-menu-count" aria-hidden="true">{shortDays(loginDays)}</span></button>
        <button className="icon-button" aria-label="Achievements" title="Achievements" onClick={onAchievements}><ProgressionGlyph name="achievements" /></button>
        <button className="icon-button" aria-label="Choose tile theme" title="Choose tile theme" onClick={onThemes}><Palette weight="fill" size={27} /></button>
        <button className="icon-button" aria-label="Settings" title="Settings" onClick={onSettings}><GearSix weight="fill" size={27} /></button>
      </div>
    </header>
    <div className="home-brand progression-brand"><span className="brand-leaf" aria-hidden="true"><Leaf weight="fill" /></span><h1><span>Mahjong</span><strong>DUEL</strong></h1><button className="icon-button leaderboard-menu-control" aria-label="Leaderboards" title="Leaderboards" onClick={onLeaderboards}><ProgressionGlyph name="leaderboards" /></button></div>
  </>;
}
