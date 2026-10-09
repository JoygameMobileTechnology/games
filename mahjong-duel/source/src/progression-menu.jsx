import { t, formatNumber } from './i18n.js';
import React from 'react';
import { Check, ClipboardText, GearSix, Leaf } from '@phosphor-icons/react';
import { PlayerAvatar } from './player-profile.jsx';
import { CurrencyBalance } from './currency-ui.jsx';
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
export function ProgressionMenuHeader({ profile, currencies = {}, loginDays = 0, questsReady = false, onProfile, onDaily, onAchievements, onSettings, onLeaderboards, onQuests }) {
  return <>
    <header className="home-toolbar progression-toolbar">
      <div className="progression-player"><button className="profile-launch" onClick={onProfile} aria-label={t("Edit profile")} title={profile.name}><PlayerAvatar profile={profile} /><span>{profile.name}</span></button><CurrencyBalance currencies={currencies} compact /></div>
      <div className="home-utilities progression-utilities">
        <button className="icon-button daily-menu-control" aria-label={t('Daily Rewards, {count} login days', { count: loginDays })} title={t("Daily Rewards")} onClick={onDaily}><ProgressionGlyph name="daily" /><span className="daily-menu-count" aria-hidden="true">{shortDays(loginDays)}</span></button>
        <button className="icon-button achievements-menu-control" aria-label={t("Achievements")} title={t("Achievements")} onClick={onAchievements}><ProgressionGlyph name="achievements" /></button>
        <button className="icon-button" aria-label={t("Settings")} title={t("Settings")} onClick={onSettings}><GearSix weight="fill" size={27} /></button>
      </div>
    </header>
    <div className="home-brand progression-brand"><span className="brand-leaf" aria-hidden="true"><Leaf weight="fill" /></span><button className="icon-button quests-menu-control" aria-label={t("Daily Quests")} aria-description={questsReady ? t("Rewards ready to claim") : undefined} title={questsReady ? t("Daily Quests — rewards ready to claim") : t("Daily Quests")} onClick={onQuests}><ClipboardText weight="duotone" aria-hidden="true" />{Boolean(questsReady) && <span className="quest-ready-badge" aria-hidden="true"><Check weight="bold" /></span>}</button><h1><span>Mahjong</span><strong>DUEL</strong></h1><button className="icon-button leaderboard-menu-control" aria-label={t("Leaderboards")} title={t("Leaderboards")} onClick={onLeaderboards}><ProgressionGlyph name="leaderboards" /></button></div>
  </>;
}
