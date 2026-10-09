import { t, formatNumber } from './i18n.js';
import React from 'react';
import { List } from '@phosphor-icons/react';
import { PlayerAvatar } from './player-profile.jsx';
import { StreakFeedback, StreakPortrait } from './streak-feedback.jsx';
import { PAIRS_PER_DUEL, PAIRS_TO_WIN, POINTS_PER_PAIR, DUEL_TOTAL_SCORE } from './game-balance.js';

export function DuelHud({ game, profile, opponentProfile, streakCues, onStreakComplete, paused, gentle, sound, remainingPairs, introPhase, scoreFeedback, onPause }) {
  const opponentName = opponentProfile.name;
  const opponentTurn = game.turn === 'ai';
  return <section className="duel-hud" data-intro={introPhase || undefined} aria-label={t("Duel scoreboard")}>
    <div className="scoreboard duel-scoreboard" data-turn={game.turn}>
      {[['you', profile, game.score], ['ai', opponentProfile, game.aiScore]].map(([actor, person, score], i) => <React.Fragment key={actor}>
        {i === 1 && <div className="duel-center"><button className="duel-pause" aria-label={t("Pause game")} disabled={Boolean(introPhase) || !remainingPairs} onClick={onPause}><List size={24} weight="bold" /></button><span aria-hidden="true">VS</span></div>}
        <div className={`player-score ${actor === 'you' ? 'local-player' : 'opponent'} ${game.turn === actor && introPhase !== 'travel' ? 'active-turn' : ''}`} data-side={actor}>
          <div className="duel-portrait local-avatar-wrap" data-score-portrait={actor}>
            <PlayerAvatar profile={person} showFlag={false} />
            {actor === 'you' && <StreakPortrait cues={streakCues} paused={paused} gentle={gentle} />}
          </div>
          <div className="duel-player-copy"><span className="duel-player-name" title={person.name}>{actor === 'you' ? t('You') : person.name}</span><strong data-score-target={actor} key={scoreFeedback?.actor === actor ? scoreFeedback.id : actor} className={scoreFeedback?.actor === actor ? 'score-received' : ''}>{formatNumber(score)}</strong></div>
          {actor === 'you' && <StreakFeedback cues={streakCues} profile={profile} paused={paused} gentle={gentle} sound={sound} onComplete={onStreakComplete} />}
        </div>
      </React.Fragment>)}
      <div className="duel-progress"><div className="duel-progress-labels"><span>{t('{count} pairs', { count: game.score / POINTS_PER_PAIR })}</span><strong>{t('First to {count}', { count: PAIRS_TO_WIN })}</strong><span>{t('{count} pairs', { count: game.aiScore / POINTS_PER_PAIR })}</span></div><div className="duel-progress-track" role="progressbar" aria-label={t("Duel pair progress")} aria-valuemin={0} aria-valuemax={PAIRS_PER_DUEL} aria-valuenow={(game.score + game.aiScore) / POINTS_PER_PAIR} aria-valuetext={t('You {you} pairs, {name} {opponent} pairs; {remaining} pairs remain', { you: game.score / POINTS_PER_PAIR, name: opponentName, opponent: game.aiScore / POINTS_PER_PAIR, remaining: remainingPairs })}><span className="your-progress" style={{ width: `${game.score / DUEL_TOTAL_SCORE * 100}%` }} /><span className="ghost-progress" style={{ width: `${game.aiScore / DUEL_TOTAL_SCORE * 100}%` }} /><i /></div></div>
    </div>
    <div className={`turn-ribbon ${opponentTurn ? 'ghost-turn' : ''}`} aria-live="polite" aria-atomic="true"><span title={opponentTurn ? t('{name}’s turn', { name: opponentName }) : t("Your turn")}>{introPhase === 'travel' ? t("Getting ready") : opponentTurn ? t('{name}’s turn', { name: opponentName }) : t("Your turn")}</span><small>{t('{count} pairs left', { count: remainingPairs })}</small></div>
    {introPhase === 'ready' && <div className="duel-first-turn" role="status">{t("You play first")}</div>}
    {(game.freezeReady || game.eagleMs > 0) && <div className="duel-booster-status" role="status">{game.freezeReady ? t("Opponent frozen") : ''}{game.freezeReady && game.eagleMs > 0 ? ' · ' : ''}{game.eagleMs > 0 ? t('Eagle Eye {seconds}s', { seconds: Math.ceil(game.eagleMs / 1000) }) : ''}</div>}
  </section>;
}
