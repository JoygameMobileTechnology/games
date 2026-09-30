import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AnimatePresence, motion, MotionConfig, useIsPresent } from 'motion/react';
import { ArrowRight, ArrowLeft, ArrowsClockwise, Check, CaretRight, Diamond, FlowerLotus, GearSix, Info, Leaf, Lightbulb, Play, SpeakerHigh, SpeakerSlash, Sparkle, Sword, X, List, Ghost, BookOpen, Snowflake, Eye, Storefront } from '@phosphor-icons/react';
import '@fontsource/cormorant-garamond/latin-400.css';
import '@fontsource/cormorant-garamond/latin-500.css';
import '@fontsource/cormorant-garamond/latin-600.css';
import '@fontsource/manrope/latin-400.css';
import '@fontsource/manrope/latin-500.css';
import '@fontsource/manrope/latin-600.css';
import '@fontsource/manrope/latin-700.css';
import '@fontsource/manrope/latin-800.css';
import { themeTileSets } from './tile-data.js';
import { themes, themeById, defaultTheme } from './themes.js';
import { boardArtStyle } from './board-art.js';
import { boardVariants } from './board-variants.js';
import { BoardSurface } from './board-surface.jsx';
import { themeUiStyle } from './theme-ui.js';
import { ghostName, GHOST_MEMORY_VERSION } from './ghost.js';
import { AI_MODES, normalizeAiMode, playOpponentTurn, rememberOpponentFaces, advanceOpponentMemory } from './opponent-ai.js';
import { ProfileEditor, PlayerAvatar, loadProfile, saveProfile } from './player-profile.jsx';
import { isFrameUnlocked } from './avatar-frames.js';
import { prepareAchievementArtwork } from './achievement-artwork.js';
import { VictoryBloom } from './remake-ui.jsx';
import { ThemeSelectPage } from './theme-select-page.jsx';
import { choosePlayableTheme } from './theme-unlocks.js';
import { loadThemePopulation, updateThemePopulation, saveThemePopulation, UPDATE_INTERVAL_MS } from './theme-population.js';
import { chooseMenuBackground } from './menu-backgrounds.js';
import { MenuScene } from './menu-scene.jsx';
import { playEffect } from './remake-sound.js';
import { flipMemoryTile } from './memory-turn.js';
import { createDuelState, resolveDuelAttempt, getDuelOutcome } from './duel.js';
import { restoreBoosters, canUseBooster, useBooster, advanceBoosterEffects } from './boosters.js';
import { boardMetrics, tilePosition } from './table-layout.js';
import { chooseFormationId } from './formations.js';
import { rarityForTile } from './rarity.js';
import { TileRarity } from './tile-rarity.jsx';
import { loadCollection } from './collection.js';
import { loadProgression, saveProgression, reduceProgression, consumeRankingPresentation } from './progression.js';
import { getDailyView } from './daily-rewards.js';
import { DailyWelcomePage } from './daily-welcome-page.jsx';
import { getDailyQuestView } from './daily-quests.js';
import { DUEL_COIN_REWARDS, SHOP_CURRENCY_PACKS, SHOP_BOOSTER_PACKS } from './economy.js';
import { DailyQuestsPage, ShopPage } from './economy-pages.jsx';
import { CurrencyIcon } from './currency-ui.jsx';
import { requestRewardedAd } from './rewarded-ad.js';
import { createDuelTracker, observeFlip, resolveTrackedAttempt, trackBooster, trackAutomaticShuffle, completedDuelEvent } from './duel-progress.js';
import { createGameId } from './game-id.js';
import { useViewportCompatibility } from './viewport-compat.js';
import { TileBinder } from './tile-binder.jsx';
import { createGame, isFree, getAvailablePairs, shuffleBoard, remainingCount } from './engine.js';
import { chime, tileSmack, unlockAudio } from './sound.js';
import './style.css';
import './board-art.css';
import './fullscreen-board.css';
import './duel-ui.css';
import './remake.css';
import './table-ui.css';
import './viewport-compat.css';
import './phone-ui.css';
import './phone-dialogs.css';
import { ProgressionMenuHeader } from './progression-menu.jsx';
import { DailyRewardsPage, AchievementsPage, LeaderboardsPage } from './progression-pages.jsx';
import { StreakFeedback, StreakPortrait } from './streak-feedback.jsx';
import { AchievementNotifications } from './achievement-toast.jsx';

const store = {
  get(key, fallback) { try { return JSON.parse(localStorage.getItem(`porcelain:${key}`)) ?? fallback; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(`porcelain:${key}`, JSON.stringify(value)); } catch { /* Private browsing can disable storage. */ } },
  remove(key) { try { localStorage.removeItem(`porcelain:${key}`); } catch { /* Private browsing can disable storage. */ } },
};
const facesByTheme = Object.fromEntries(Object.entries(themeTileSets).map(([theme, sets]) => [theme, Object.fromEntries(Object.entries(sets).map(([key, set]) => [key, Object.fromEntries(set.map(face => [face.id, face]))]))]));
const secondsLabel = seconds => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
const fade = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8 }, transition: { duration: 0.28 } };
const GHOST_THINK_MS = 280;
const GHOST_FLIP_MS = 260;
// The resolution timer, tile contact, ring and chip onset share one impact time.
const MATCH_IMPACT_MS = 160;
const MATCH_FLIGHT_MS = 340;
const MATCH_CHIP_MS = 900;

function TileArt({ face, badge = true }) {
  return <><img className="tile-art" src={face.src} alt="" draggable="false" />{badge && ['count', 'tier'].includes(face.family) && face.pipCount > 0 && <span className="tile-rank" aria-hidden="true">{Array.from({length: face.pipCount}, (_, i) => <i key={i} />)}</span>}</>;
}
function IconButton({ label, children, ...props }) { return <button className="icon-button" aria-label={label} title={label} {...props}>{children}</button>; }

function MatchFlight({ flight, faces, themeId, ruleset, paused, onComplete }) {
  const layer = useRef(null);
  const animations = useRef([]);
  useEffect(() => {
    const nodes = layer.current.querySelectorAll('.flying-tile');
    const impact = MATCH_IMPACT_MS / MATCH_FLIGHT_MS;
    animations.current = [...nodes].map((node, index) => {
      const tile = flight.stones[index];
      const at = (x, y, scale = 1, rotate = 0) => `translate(${x}px,${y}px) scale(${scale}) rotate(${rotate}deg)`;
      const frames = flight.reduced ? [
        { opacity: 1, offset: 0 }, { opacity: 1, offset: impact }, { opacity: 0, offset: 1 },
      ] : [
        { transform: at(0, 0), opacity: 1, offset: 0, easing: 'cubic-bezier(.55,.02,.85,.4)' },
        { transform: at(tile.dx, tile.dy), opacity: 1, offset: impact, easing: 'ease-out' },
        { transform: at(tile.dx - tile.direction * 4, tile.dy - 4, .98, -tile.direction * 3), opacity: 1, offset: .68, easing: 'ease-in' },
        { transform: at(tile.dx - tile.direction * 8, tile.dy - 14, .92, -tile.direction * 5), opacity: 0, offset: 1 },
      ];
      return node.animate(frames, { duration: MATCH_FLIGHT_MS, fill: 'forwards' });
    });
    const ring = layer.current.querySelector('.collision-ring');
    if (!flight.reduced) animations.current.push(ring.animate([
      { transform: 'scale(.3)', opacity: 0, offset: 0 },
      { transform: 'scale(.3)', opacity: 0, offset: impact - .01 },
      { transform: 'scale(.45)', opacity: .8, offset: impact },
      { transform: 'scale(1.65)', opacity: 0, offset: 1 },
    ], { duration: MATCH_FLIGHT_MS, fill: 'forwards' }));
    if (!flight.reduced) {
      layer.current.querySelectorAll('.ceramic-chip').forEach((chip, index) => {
        const angle = index * 2.4;
        const spread = 30 + (index % 5) * 11;
        const x = Math.cos(angle) * spread;
        const y = Math.sin(angle) * spread - 22;
        animations.current.push(chip.animate([
          { opacity: 0, transform: 'translate(0,0) scale(.3)', offset: 0 },
          { opacity: 0, transform: 'translate(0,0) scale(.3)', offset: MATCH_IMPACT_MS / MATCH_CHIP_MS },
          { opacity: 1, transform: `translate(${x * .4}px,${y * .5}px) scale(1) rotate(${index * 38}deg)`, offset: (MATCH_IMPACT_MS + 100) / MATCH_CHIP_MS },
          { opacity: .9, transform: `translate(${x}px,${y + 34}px) scale(.85) rotate(${index * 38 + 90}deg)`, offset: .64 },
          { opacity: 0, transform: `translate(${x * 1.25}px,${y + 118}px) scale(.3) rotate(${index * 38 + 180}deg)`, offset: 1 },
        ], { duration: MATCH_CHIP_MS, fill: 'forwards' }));
      });
    }
    animations.current.at(-1).onfinish = onComplete;
    return () => animations.current.forEach(animation => animation.cancel());
  }, []);
  useEffect(() => {
    animations.current.forEach(animation => {
      // A chip tail outlives the tiles. Do not restart finished tiles on resume.
      if (animation.currentTime >= animation.effect.getComputedTiming().endTime) return;
      if (paused) animation.pause(); else animation.play();
    });
  }, [paused]);
  return <div className="match-flight" ref={layer} aria-hidden="true">
    {flight.stones.map(tile => <div className="flying-tile" key={tile.id} style={{ left: tile.x, top: tile.y, width: tile.width, height: tile.height }}><TileArt face={faces[tile.faceId]} /><TileRarity rarity={rarityForTile(themeId, ruleset, tile.faceId)} /></div>)}
    <span className="collision-ring" style={{ left: flight.centerX, top: flight.centerY }} />
    {!flight.reduced && Array.from({ length: 18 }, (_, i) => <i className="ceramic-chip" key={i} style={{ left: flight.centerX, top: flight.centerY, width: 4 + i % 6, height: 6 + i % 7 }} />)}
  </div>;
}

function TileFan({ faces, theme, sound, gentle }) {
  const last = useRef({ tile: null, time: 0 });
  function strike(node) {
    const now = performance.now();
    if (!node || last.current.tile === node) return;
    const elapsed = now - last.current.time;
    last.current = { tile: node, time: now };
    const index = Number(node.dataset.heroIndex);
    tileSmack(sound, { strength: elapsed < 170 ? .75 : .55, pan: (index - 2) * .22 });
    if (!gentle && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      node.getAnimations().filter(animation => animation.id === 'tile-nudge').forEach(animation => animation.cancel());
      node.animate([{ translate: '0 0' }, { translate: '0 -12px', offset: .3 }, { translate: '0 2px', offset: .75 }, { translate: '0 0' }], { id: 'tile-nudge', duration: 330, easing: 'cubic-bezier(.2,.65,.35,1)' });
    }
  }
  function sweep(event) {
    const node = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-hero-index]');
    if (node && event.currentTarget.contains(node)) strike(node);
    else last.current.tile = null;
  }
  return <section className="menu-fan" aria-label={`${theme.name} tile collection`}>
    <div className="tile-showcase" onPointerDown={event => { unlockAudio(sound); last.current.tile = null; sweep(event); }} onPointerMove={sweep} onPointerLeave={() => { last.current.tile = null; }} onPointerCancel={() => { last.current.tile = null; }}>
      <div className="showcase-halo"><div /><div /></div>
      {faces.map((face, index) => <motion.button key={`${theme.id}-${face.id}`} type="button" data-hero-index={index} aria-label={`Play tile sound ${index + 1}`} className={`hero-tile hero-tile-${index}`} initial={{ opacity: 0, y: 30, rotate: 0 }} animate={{ opacity: 1, y: 0, rotate: [-22, -12, 0, 12, 22][index] }} transition={{ type: 'spring', stiffness: 150, damping: 20, delay: Math.abs(index - 2) * .06 }} onClick={event => { if (event.detail === 0) { last.current.tile = null; strike(event.currentTarget); } }}><TileArt face={face} badge={false} />{index === 2 && <img className="hero-back" src={theme.back} alt="" draggable="false" />}</motion.button>)}
    </div>
  </section>;
}

function Sheet({ title, subtitle, onClose, children }) {
  const panel = useRef(null);
  const isPresent = useIsPresent();
  useEffect(() => {
    if (!isPresent) return;
    const previous = document.activeElement;
    const node = panel.current;
    node?.focus();
    function key(event) {
      // A native tile preview owns focus and Escape until it closes.
      if (node?.querySelector('dialog[open]')) return;
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
      if (event.key === 'Tab') {
        const items = [...node.querySelectorAll('button:not(:disabled), input, select, [tabindex="0"]')];
        const first = items[0], last = items.at(-1);
        if (event.shiftKey && (document.activeElement === first || document.activeElement === node)) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    }
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); previous?.focus(); };
  }, [isPresent]);
  return <motion.div className="sheet-backdrop" inert={!isPresent} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={isPresent ? onClose : undefined}>
    <motion.section className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title" tabIndex={-1} ref={panel} initial={{ y: 70 }} animate={{ y: 0 }} exit={{ y: 70 }} transition={{ type: 'spring', stiffness: 340, damping: 32 }} onClick={e => e.stopPropagation()}>
      <header className="parchment-header"><h2 id="sheet-title">{title}</h2><IconButton label="Close dialog" onClick={onClose}><X size={27} weight="bold" /></IconButton><span className="red-tassel" aria-hidden="true" /></header>
      <div className="parchment-body">{subtitle && <p className="sheet-subtitle">{subtitle}</p>}{children}</div>
    </motion.section>
  </motion.div>;
}

function Rules({ ruleset, aiMode }) {
  return <div className="rules-content">
    <div className="rule-step"><span>01</span><div><h3>Flip. Remember. Match.</h3><p>Every stone starts face down. Flip two uncovered stones. Matches leave the board; different faces turn back over after a short pause. Clear all 40 pairs to finish the board.</p></div></div>
    <div className="rule-step"><span>02</span><div><h3>Work from the top.</h3><p>Only a stone with another stone on top is blocked. Neighbors on either side never stop you from flipping. Remember the faces as you uncover new layers.</p></div></div>
    <div className="rule-step"><span>03</span><div><h3>{ruleset === 'eastern' ? 'Know your families.' : 'Trust the picture.'}</h3><p>{ruleset === 'eastern' ? 'Match two identical faces. Counts and tiers form ordered groups; symbols, kin, and anchors are unranked pictures. Sharing a family does not make two different faces a match.' : 'Every pair must show the exact same picture. Each picture has four identical copies.'}</p></div></div>
    <div className="rule-note"><Ghost size={24} /><p><strong>Your ghost</strong> shares your name and avatar. It is a simulated opponent with imperfect memory. Match for 100 points and play again. Miss, and the turn passes. The highest score when the board is clear wins.</p></div>
    <p className="rules-footnote">First to 21 pairs secures the win; keep playing until all 40 pairs are cleared. Your matches collect artwork in your Collection.</p>
    <p className="rules-footnote"><strong>{aiMode === 'original' ? 'Original AI' : 'Modern AI'}</strong>{' '}{aiMode === 'original' ? 'observes every tile either player reveals. It has a 40% chance of recalling an uncovered known pair, and a 35% chance of recalling a known partner after its first flip. After each pair attempt by either player, each memory has a 25% chance of being forgotten. Otherwise, it guesses among uncovered tiles.' : 'remembers both players’ reveals from the last two completed pair attempts, plus the current attempt. It uses remembered uncovered pairs and partners; otherwise, it guesses among uncovered tiles.'}</p>
    <div className="booster-rules"><h3>Your booster collection</h3><p>Claim Daily Rewards or visit the Shop to get boosters. Unused boosters carry over to your next duel.</p><p><strong>Shuffle</strong> rearranges the stones and clears the opponent’s memory. Automatic board recovery is free.</p><p><strong>Hint</strong> highlights an uncovered matching pair for 1.5 seconds, keeping it face down.</p><p><strong>Freeze</strong> skips the opponent’s next turn after your next miss.</p><p><strong>Eagle Eye</strong> reveals hidden tile rarity glows for 10 seconds.</p></div>
  </div>;
}

function App() {
  const [screen, setScreen] = useState('menu');
  const [menuBackground] = useState(() => chooseMenuBackground(store.get('menuBackground', null)));
  useEffect(() => { store.set('menuBackground', menuBackground.id); }, [menuBackground]);
  const [pageHidden, setPageHidden] = useState(() => document.hidden);
  const [themePopulation, setThemePopulation] = useState(() => loadThemePopulation());
  useEffect(() => {
    saveThemePopulation(themePopulation);
    const refresh = () => setThemePopulation(current => updateThemePopulation(current));
    const onVisible = () => { if (!document.hidden) refresh(); };
    const timeout = setTimeout(refresh, Math.max(0, themePopulation.updatedAt + UPDATE_INTERVAL_MS - Date.now()));
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearTimeout(timeout); document.removeEventListener('visibilitychange', onVisible); };
  }, [themePopulation]);
  const [launchProgress] = useState(() => {
    const previous = loadProgression({ collection: loadCollection() });
    const next = reduceProgression(previous, { type: 'login', now: Date.now() });
    const achievementIds = Object.keys(next.unlocked).filter(id => !Object.hasOwn(previous.unlocked, id));
    return { progression: next, notifications: achievementIds.length ? [{ id: achievementIds.join(':'), achievementIds }] : [] };
  });
  const [profile, setProfile] = useState(() => loadProfile(undefined, launchProgress.progression.points));
  const [progression, setProgression] = useState(launchProgress.progression);
  const [achievementBatches, setAchievementBatches] = useState(launchProgress.notifications);
  const progressionRef = useRef(progression);
  const collection = progression.collection;
  const [page, setPage] = useState(() => getDailyView(progression).shouldAutoOpen ? 'daily-welcome' : getDailyQuestView(progression).shouldAutoOpen ? 'login-quests' : null);
  const [economyNow, setEconomyNow] = useState(() => Date.now());
  useEffect(() => {
    if (screen !== 'menu' || page || pageHidden) return;
    const prepare = () => { void prepareAchievementArtwork(); };
    if (typeof window.requestIdleCallback === 'function') {
      const idle = window.requestIdleCallback(prepare, { timeout: 1000 });
      return () => window.cancelIdleCallback(idle);
    }
    const timer = window.setTimeout(prepare, 100);
    return () => window.clearTimeout(timer);
  }, [screen, page, pageHidden]);
  const [adState, setAdState] = useState('idle');
  const pageOpener = useRef('.duel-launch');
  const adBusy = useRef(false);
  const purchaseBusy = useRef(false);
  const [rankingPresentation, setRankingPresentation] = useState(null);
  const tracker = useRef(null);
  const [streakCues, setStreakCues] = useState([]);
  function commitProgress(next) {
    const achievementIds = Object.keys(next.unlocked).filter(id => !Object.hasOwn(progressionRef.current.unlocked, id));
    progressionRef.current = next;
    saveProgression(next);
    setProgression(next);
    if (achievementIds.length) setAchievementBatches(current => [...current, { id: achievementIds.join(':'), achievementIds }]);
    return next;
  }
  function progressEvent(event) {
    if (!event) return progressionRef.current;
    const before = progressionRef.current;
    const next = reduceProgression(before, event);
    return next === before ? before : commitProgress(next);
  }
  useEffect(() => {
    saveProgression(progressionRef.current);
  }, []);
  const dailyDayId = getDailyView(progression, economyNow).dayId;
  const questDayId = getDailyQuestView(progression, economyNow).dayId;
  useEffect(() => {
    if (page === 'daily' || page === 'daily-welcome') progressEvent({ type: 'daily-presented', dayId: dailyDayId, now: economyNow });
    if (page === 'quests' || page === 'login-quests') progressEvent({ type: 'quests-presented', dayId: questDayId, now: economyNow });
  }, [page, dailyDayId, questDayId]);
  useEffect(() => {
    const refresh = () => {
      if (document.hidden) return;
      const now = Date.now();
      setEconomyNow(now);
      progressEvent({ type: 'login', now });
    };
    const onVisible = () => { if (!document.hidden) refresh(); };
    const timer = setInterval(refresh, 60_000);
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, []);
  useEffect(() => { saveProfile(profile, undefined, progressionRef.current.points); }, []);
  const [entering, setEntering] = useState(false);
  const [boardThemeId, setBoardThemeId] = useState(() => themeById[store.get('boardTheme', store.get('theme', defaultTheme.id))] ? store.get('boardTheme', store.get('theme', defaultTheme.id)) : defaultTheme.id);
  const [themeId, setThemeId] = useState(() => themeById[store.get('theme', defaultTheme.id)] ? store.get('theme', defaultTheme.id) : defaultTheme.id);
  const [ruleset, setRuleset] = useState(() => store.get('ruleset', 'eastern') === 'western' ? 'western' : 'eastern');
  const [aiMode, setAiMode] = useState(() => normalizeAiMode(store.get('aiMode', 'modern')));
  const mode = 'duel';
  const [sound, setSound] = useState(() => store.get('sound', true));
  const [pips, setPips] = useState(() => store.get('pips', true));
  const difficulty = 'calm';
  const [gentle, setGentle] = useState(() => store.get('gentle', false));
  const [sheet, setSheet] = useState(null);
  const [game, setGame] = useState(null);
  const table = useMemo(() => boardMetrics(game?.tiles), [game?.tiles]);
  const [selected, setSelected] = useState(null);
  const [flippedIds, setFlippedIds] = useState([]);
  const [pending, setPending] = useState(null);
  const [flight, setFlight] = useState(null);
  const boardRef = useRef(null);
  const [boardReady, setBoardReady] = useState(false);
  useViewportCompatibility(boardRef, boardReady, table.width / table.height);
  const attachBoard = useCallback(node => { boardRef.current = node; setBoardReady(Boolean(node)); }, []);
  const pendingTime = useRef({ key: null, ms: 0 });
  const [toast, setToast] = useState(null);
  const [burst, setBurst] = useState(null);
  const [result, setResult] = useState(null);
  useEffect(() => {
    if (!result) return;
    const panel = document.querySelector('.result-card');
    const buttons = [...panel.querySelectorAll('button')];
    buttons[0]?.focus();
    const trap = event => {
      if (event.key !== 'Tab') return;
      if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === buttons.at(-1)) { event.preventDefault(); buttons[0]?.focus(); }
    };
    document.addEventListener('keydown', trap);
    return () => document.removeEventListener('keydown', trap);
  }, [result]);
  // Duels last only for this visit; discard snapshots from older builds.
  useEffect(() => { store.remove('session'); }, []);
  const lock = useRef(false);
  const gameRef = useRef(game); gameRef.current = game;
  function commitGame(next) { gameRef.current = next; setGame(next); }
  const playSound = kind => chime(kind, sound);
  const announce = message => setToast({ message, id: Date.now() });
  useEffect(() => { store.set('ruleset', ruleset); }, [ruleset]);
  useEffect(() => { store.set('aiMode', aiMode); }, [aiMode]);
  useEffect(() => { store.set('theme', themeId); }, [themeId]);
  useEffect(() => { store.set('boardTheme', boardThemeId); }, [boardThemeId]);
  useEffect(() => { store.set('sound', sound); }, [sound]);
  useEffect(() => {
    const unlock = () => unlockAudio(sound);
    document.addEventListener('pointerdown', unlock, { passive: true });
    document.addEventListener('keydown', unlock);
    return () => { document.removeEventListener('pointerdown', unlock); document.removeEventListener('keydown', unlock); };
  }, [sound]);
  useEffect(() => { store.set('gentle', gentle); }, [gentle]);
  useEffect(() => { store.set('pips', pips); }, [pips]);
  useEffect(() => { store.set('difficulty', difficulty); }, [difficulty]);
  useEffect(() => { if (toast) { const timeout = setTimeout(() => setToast(null), 2700); return () => clearTimeout(timeout); } }, [toast]);
  useEffect(() => { if (burst) { const timeout = setTimeout(() => setBurst(null), 850); return () => clearTimeout(timeout); } }, [burst]);

  useEffect(() => {
    const pauseOnHide = () => {
      setPageHidden(document.hidden);
      if (document.hidden && screen === 'game' && !result && remainingCount(gameRef.current?.tiles || [])) setSheet(current => current || 'pause');
    };
    document.addEventListener('visibilitychange', pauseOnHide);
    return () => document.removeEventListener('visibilitychange', pauseOnHide);
  }, [screen, result]);
  useEffect(() => {
    if (screen !== 'game' || sheet || result || entering) return;
    const interval = setInterval(() => setGame(current => current ? { ...current, elapsed: current.elapsed + 1 } : current), 1000);
    return () => clearInterval(interval);
  }, [screen, sheet, result, entering]);
  useEffect(() => {
    if (!boardReady || screen !== 'game' || sheet || result || entering || (!game?.hintEffect && !game?.eagleMs)) return;
    let last = performance.now();
    const tick = () => {
      const now = performance.now(), elapsed = now - last; last = now;
      setGame(current => advanceBoosterEffects(current, elapsed));
    };
    const interval = setInterval(tick, 100);
    return () => { clearInterval(interval); };
  }, [screen, sheet, result, entering, boardReady, Boolean(game?.hintEffect), Boolean(game?.eagleMs)]);
  // Record the completed board immediately; presentation waits for the final impact/cue.
  useEffect(() => {
    if (screen !== 'game' || !game || remainingCount(game.tiles)) return;
    const outcome = getDuelOutcome(game);
    progressEvent(completedDuelEvent(tracker.current, game, outcome, Date.now()));
    if (result || flight || streakCues.length || pending || sheet || pageHidden) return;
    setResult(outcome); setSelected(null);
    playEffect(outcome === 'win' ? 'win' : 'turn', sound);
  }, [game, screen, result, flight, streakCues, pending, sheet, pageHidden]);

  // Both players use this board. Rescue a blocked deal without consuming a turn.
  useEffect(() => {
    if (screen !== 'game' || sheet || result || pending || flippedIds.length || game?.mode !== 'duel' || !remainingCount(game.tiles)) return;
    if (!getAvailablePairs(game.tiles).length) {
      const shuffled = shuffleBoard(game.tiles, game.seed + game.shuffles + 1, { formationId: game.formationId });
      tracker.current = trackAutomaticShuffle(tracker.current);
      commitGame({ ...gameRef.current, tiles: shuffled.tiles, shuffles: gameRef.current.shuffles + 1, aiMemory: {}, hintEffect: null });
      announce('No open pairs. The shared board has been shuffled.');
    }
  }, [game?.tiles, game?.mode, screen, sheet, result, pending, flippedIds.length]);

  useEffect(() => {
    if (!boardReady || screen !== 'game' || sheet || result || entering || pending || flippedIds.length || game?.mode !== 'duel' || game.turn !== 'ai' || !remainingCount(game.tiles) || !getAvailablePairs(game.tiles).length) return;
    const timeout = setTimeout(() => {
      const current = gameRef.current;
      const choice = playOpponentTurn(current);
      if (choice.flippedIds.length !== 2) return;
      const first = choice.flippedIds[0];
      setFlippedIds([first]); setSelected(first);
      rememberFaces([first]); playSound('tap');
      beginResolution({ kind: 'ai-reveal', ids: choice.flippedIds, actor: 'ai' }, GHOST_FLIP_MS);
    }, GHOST_THINK_MS);
    return () => clearTimeout(timeout);
  }, [game?.turn, game?.tiles, screen, sheet, result, pending, flippedIds.length, boardReady, entering]);

  useEffect(() => {
    if (!pending || !boardReady || sheet || result || entering || screen !== 'game') return;
    const key = pending.key;
    const duration = pendingTime.current.ms;
    const started = performance.now();
    pendingTime.current.started = started;
    const timeout = setTimeout(() => {
      if (pendingTime.current.key !== key) return;
      const current = gameRef.current;
      if (pending.kind === 'ai-reveal') {
        const turn = flipMemoryTile(current.tiles, [pending.ids[0]], pending.ids[1], current.difficulty);
        setFlippedIds(turn.revealed); rememberFaces([pending.ids[1]]); playSound('tap');
        beginResolution({ kind: 'pair', ids: turn.revealed, matched: turn.match, actor: 'ai' }, turn.duration);
        return;
      }
      if (pending.kind === 'pair' && pending.matched) {
        launchMatch(pending.ids);
        beginResolution({ kind: 'collision', ids: pending.ids, matched: true, actor: pending.actor }, MATCH_IMPACT_MS);
        return;
      }
      if (pending.kind === 'collision' || pending.kind === 'pair') {
        const resolved = resolveDuelAttempt(current, pending.ids);
        if (resolved !== current) {
          const tile = current.tiles.find(value => value.id === pending.ids[0]);
          const transition = resolveTrackedAttempt(tracker.current, current, resolved, pending.ids, {
            rarity: rarityForTile(current.theme, current.ruleset, tile.faceId).id, now: Date.now(),
          });
          tracker.current = transition.tracker;
          progressEvent(transition.event);
          if (transition.cues.length) setStreakCues(transition.cues);
          commitGame({ ...resolved, aiMemory: advanceOpponentMemory(resolved) });
          if (pending.kind === 'collision') {
            setBurst({ id: Date.now(), points: 100, x: flight?.burstX, y: flight?.burstY });
            tileSmack(sound, { strength: 1 });
            if (!transition.cues.length) playEffect('match', sound);
          } else {
            announce(pending.actor === 'ai' ? 'Your turn' : current.freezeReady ? 'Opponent frozen. Play again!' : 'Opponent’s turn');
            if (pending.actor === 'ai' && !transition.cues.length) playEffect('turn', sound);
          }
        }
      }
      setFlippedIds([]); setSelected(null); setPending(null); lock.current = false;
      pendingTime.current = { key: null, ms: 0 };
    }, duration);
    return () => {
      clearTimeout(timeout);
      if (pendingTime.current.key === key) {
        pendingTime.current.ms = Math.max(0, duration - (performance.now() - started));
        pendingTime.current.started = null;
      }
    };
  }, [pending, screen, sheet, result, sound, boardReady, entering]);

  function rememberFaces(ids) {
    for (const id of ids) tracker.current = observeFlip(tracker.current, id);
    const current = gameRef.current;
    commitGame({ ...current, aiMemory: rememberOpponentFaces(current, ids) });
  }

  function resetTurn() {
    pendingTime.current = { key: null, ms: 0 };
    setFlippedIds([]); setSelected(null); setPending(null); setFlight(null); lock.current = false;
  }
  function launchMatch(ids) {
    const board = boardRef.current;
    const rect = board.getBoundingClientRect();
    const scale = rect.width / board.clientWidth;
    const stones = ids.map(id => {
      const node = board.querySelector(`[data-tile-id="${id}"]`);
      const bounds = node.getBoundingClientRect();
      return { id, faceId: gameRef.current.tiles.find(tile => tile.id === id).faceId, x: (bounds.left - rect.left) / scale, y: (bounds.top - rect.top) / scale, width: bounds.width / scale, height: bounds.height / scale };
    }).sort((a, b) => a.x - b.x || a.y - b.y);
    const centerX = stones.reduce((sum, tile) => sum + tile.x + tile.width / 2, 0) / 2;
    const centerY = stones.reduce((sum, tile) => sum + tile.y + tile.height / 2, 0) / 2;
    const meetingX = Math.max(stones[0].width, Math.min(board.clientWidth - stones[1].width, centerX));
    setFlight({ key: performance.now(), ids, centerX: meetingX, centerY, burstX: meetingX + board.offsetLeft, burstY: centerY + board.offsetTop, reduced: gentle || matchMedia('(prefers-reduced-motion: reduce)').matches, stones: stones.map((tile, i) => ({ ...tile, dx: meetingX - (i === 0 ? tile.width : 0) - tile.x, dy: centerY - tile.height / 2 - tile.y, direction: i === 0 ? 1 : -1 })) });
  }
  function beginResolution(details, duration) {
    const key = performance.now();
    pendingTime.current = { key, ms: duration };
    lock.current = true;
    setPending({ key, ...details });
  }

  function start(requestedTheme) {
    const chosenTheme = choosePlayableTheme(progressionRef.current.collection, ruleset, requestedTheme);
    if (!chosenTheme) return;
    const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    const formationId = chooseFormationId(seed, { excludeIds: [store.get('lastFormation', null)] });
    const deal = createGame(ruleset, seed, difficulty, chosenTheme, { formationId });
    setThemeId(chosenTheme); setBoardThemeId(chosenTheme);
    store.set('lastFormation', deal.formationId);
    const next = restoreBoosters({ ...deal, gameId: createGameId(), ruleset, aiMode, boardTheme: chosenTheme, mode: 'duel',
      boosters: { ...progressionRef.current.wallet }, aiMemory: {}, ghostMemoryVersion: GHOST_MEMORY_VERSION, elapsed: 0, score: 0, hints: 0, shuffles: 0, flips: 0, attempts: 0, ...createDuelState() });
    tracker.current = createDuelTracker(next);
    commitGame(next); setScreen('game'); setResult(null); resetTurn(); setStreakCues([]); setBurst(null); setSheet(null); setPage(null); setToast(null);
    setEntering(!gentle && !matchMedia('(prefers-reduced-motion: reduce)').matches); playEffect('doors', sound);
    try { const promise = window.screen.orientation?.lock?.('portrait'); promise?.catch(() => {}); } catch { /* Portrait canvas is retained when orientation locking is unsupported. */ }
  }
  function leaveDuel() {
    resetTurn(); tracker.current = null; commitGame(null); setResult(null); setStreakCues([]); setBurst(null); setToast(null); setEntering(false); setSheet(null); setScreen('menu');
  }
  function tap(tile) {
    if (lock.current || pending || sheet || result || entering) return;
    const current = gameRef.current;
    if (current.mode === 'duel' && current.turn !== 'you') return;
    if (!isFree(tile, current.tiles)) { playSound('error'); announce('Remove the stone on top first.'); return; }
    const turn = flipMemoryTile(current.tiles, flippedIds, tile.id, current.difficulty);
    if (!turn) return;
    playSound('tap');
    setFlippedIds(turn.revealed);
    setSelected(turn.revealed[0]);
    tracker.current = observeFlip(tracker.current, tile.id);
    commitGame({ ...current, flips: (current.flips || 0) + 1, aiMemory: rememberOpponentFaces(current, [tile.id]) });
    if (turn.revealed.length === 2) beginResolution({ kind: 'pair', ids: turn.revealed, matched: turn.match, actor: 'you' }, turn.duration);
  }
  function activateBooster(id) {
    if (pending || sheet || result || entering || lock.current || (flippedIds.length && ['shuffle', 'hint'].includes(id))) return;
    const current = gameRef.current;
    const next = useBooster(current, id);
    if (next === current) return;
    const activation = trackBooster(tracker.current, current, next, id);
    tracker.current = activation.tracker;
    progressEvent(activation.event);
    if (id === 'shuffle') {
      const shuffled = shuffleBoard(current.tiles, Date.now(), { formationId: current.formationId });
      commitGame({ ...next, boosters: { ...progressionRef.current.wallet }, tiles: shuffled.tiles, shuffles: current.shuffles + 1, aiMemory: {}, hintEffect: null });
      resetTurn(); playEffect('shuffle', sound);
    } else { commitGame({ ...next, boosters: { ...progressionRef.current.wallet } }); playEffect('confirm', sound); }
    announce({ shuffle: 'A fresh arrangement.', hint: 'A matching pair is glowing.', freeze: 'Opponent’s next turn is frozen.', eagle: 'Rarities revealed for 10 seconds.' }[id]);
  }
  const uncoveredCount = useMemo(() => game ? game.tiles.filter(tile => isFree(tile, game.tiles)).length : 0, [game?.tiles]);
  const activeTheme = themeById[screen === 'game' ? game.theme : themeId] || defaultTheme;
  const faces = facesByTheme[activeTheme.id];
  const freeCount = game ? remainingCount(game.tiles) : 80;
  const dragon = faces.western.W01;
  const selectedTile = game?.tiles.find(t => t.id === selected);
  const opponentTurn = game?.mode === 'duel' && game.turn === 'ai';

  const surfaceTheme = themeById[screen === 'game' ? game.boardTheme || game.theme : boardThemeId] || activeTheme;
  const opponentName = ghostName(profile);
  function updateProfile(next) {
    if (!saveProfile(next, undefined, progressionRef.current.points)) { announce('Profile updated for this visit. Browser storage is unavailable.'); }
    setProfile(next); setSheet(null); playEffect('confirm', sound);
  }
  function equipAchievementFrame(frameId) {
    if (!isFrameUnlocked(frameId, progressionRef.current.points)) return;
    const next = { ...profile, frameId };
    if (!saveProfile(next, undefined, progressionRef.current.points)) announce('Frame equipped for this visit. Browser storage is unavailable.');
    setProfile(next); playEffect('confirm', sound);
  }
  function closeSheet() {
    setSheet(current => {
      if (current === 'rules') return 'settings';
      if (current === 'settings' && screen === 'game') return 'pause';
      if (current === 'restart' || current === 'leave') return 'pause';
      return null;
    });
    playSound('tap');
  }
  function openSheet(value) { setSheet(value); playSound('tap'); }

  function openPage(value) {
    pageOpener.current = { daily: '.daily-menu-control', quests: '.quests-menu-control', shop: '.shop-launch', achievements: '[aria-label="Achievements"]', collection: '.binder-launch', leaderboards: '.leaderboard-menu-control', 'theme-select': '.duel-launch' }[value];
    if (value === 'daily' || value === 'quests') {
      const now = Date.now();
      progressEvent({ type: 'login', now });
      setEconomyNow(now);
      if (value === 'daily') setAdState('idle');
    }
    setRankingPresentation(null);
    setPage(value); playSound('tap');
  }
  function returnToMenu() {
    setPage(null);
    requestAnimationFrame(() => document.querySelector(pageOpener.current || '.duel-launch')?.focus({ preventScroll: true }));
  }
  function finishDailyPage() {
    const current = progressEvent({ type: 'login', now: Date.now() });
    if (getDailyQuestView(current).shouldAutoOpen) {
      pageOpener.current = '.quests-menu-control';
      setPage(page === 'daily-welcome' ? 'login-quests' : 'quests');
    } else returnToMenu();
  }
  function closePage() {
    if (page === 'daily' || page === 'daily-welcome') finishDailyPage();
    else returnToMenu();
    setRankingPresentation(null); playSound('tap');
  }
  function claimDaily() {
    if (adBusy.current || !getDailyView(progressionRef.current).hasClaim) return;
    progressEvent({ type: 'daily-claim', eventId: `claim:${createGameId()}`, now: Date.now() });
    finishDailyPage(); playEffect('confirm', sound); announce('Daily rewards collected.');
  }
  async function doubleDaily() {
    if (adBusy.current || !getDailyView(progressionRef.current).hasClaim) return;
    adBusy.current = true; setAdState('loading');
    const attemptId = `ad:${createGameId()}`;
    progressEvent({ type: 'daily-ad-start', eventId: `${attemptId}:start`, attemptId, now: Date.now() });
    const result = await requestRewardedAd({ attemptId });
    progressEvent({ type: 'daily-ad-complete', eventId: `${attemptId}:complete`, attemptId, status: result.status, now: Date.now() });
    adBusy.current = false; setAdState(result.status);
    if (result.status === 'completed') {
      finishDailyPage(); playEffect('confirm', sound); announce('Double daily rewards collected.');
    }
  }
  function claimQuest(questId, dayId) {
    const now = Date.now(), before = progressionRef.current;
    const next = progressEvent({ type: 'quest-claim', questId, dayId, eventId: `quest-claim:${createGameId()}`, now });
    setEconomyNow(now);
    const claimed = next.currencies.coins > before.currencies.coins || next.currencies.gems > before.currencies.gems;
    if (claimed) playEffect('confirm', sound);
    return { ok: claimed, message: claimed ? 'Quest reward collected.' : 'This reward is not available. Check today’s quests.' };
  }
  function rerollQuest(questId, dayId) {
    const now = Date.now(), before = progressionRef.current;
    const next = progressEvent({ type: 'quest-reroll', questId, dayId, eventId: `quest-reroll:${createGameId()}`, now });
    setEconomyNow(now);
    const replaced = next !== before && next.quests !== before.quests && getDailyQuestView(next, now).rerollsLeft === 0;
    if (replaced) playEffect('confirm', sound);
    return { ok: replaced, message: replaced ? 'New quest ready. Your daily reroll is used.' : 'This quest cannot be rerolled. Check today’s quests.' };
  }
  function buyBoosters(productId) {
    const product = SHOP_BOOSTER_PACKS.find(item => item.id === productId);
    if (!product) return { ok: false, message: 'This pack is unavailable.' };
    const before = progressionRef.current;
    const next = progressEvent({ type: 'shop-buy', productId, eventId: `shop:${createGameId()}`, now: Date.now() });
    const bought = next !== before && next.wallet !== before.wallet;
    if (bought) playEffect('confirm', sound);
    return { ok: bought, message: bought ? `${product.name} added to your boosters.` : 'Not enough Coins or Gems for this pack.' };
  }
  async function purchaseCurrency(productId) {
    const product = SHOP_CURRENCY_PACKS.find(item => item.id === productId);
    if (!product || purchaseBusy.current) return { ok: false, message: 'This purchase is unavailable.' };
    purchaseBusy.current = true;
    try {
      // Testing build: confirmation grants a local receipt; no payment provider is contacted.
      const transactionId = `test-purchase:${createGameId()}`;
      await Promise.resolve();
      const before = progressionRef.current;
      const next = progressEvent({ type: 'shop-purchase-simulated', productId, transactionId, eventId: transactionId, now: Date.now() });
      const bought = next !== before && next.currencies !== before.currencies;
      if (bought) playEffect('confirm', sound);
      return { ok: bought, message: bought ? `${product.name} added. Test purchase—no money charged.` : 'Purchase could not be completed.' };
    } finally { purchaseBusy.current = false; }
  }
  function continueResult() {
    const current = progressionRef.current;
    const presentation = current.pendingRankingPresentation;
    commitProgress(consumeRankingPresentation(current));
    progressEvent({ type: 'achievements-seen', ids: [...current.newAchievementIds] });
    leaveDuel(); pageOpener.current = '.duel-launch'; setRankingPresentation(presentation); setPage('leaderboards');
  }

  return <MotionConfig reducedMotion={gentle ? 'always' : 'user'}><div className={`world remake ${screen === 'menu' ? 'at-home' : 'at-table'} ${gentle ? 'gentle-motion' : ''} ${pips ? '' : 'hide-pips'}`} data-theme={activeTheme.id} data-board-theme={surfaceTheme.id} style={{ '--theme-accent': activeTheme.accent, '--theme-ink': activeTheme.ink, '--theme-surface': activeTheme.surface, '--theme-tint': activeTheme.tint, ...boardArtStyle(surfaceTheme.id), ...themeUiStyle(surfaceTheme.id) }}>
    <BoardSurface variants={boardVariants[surfaceTheme.id]} />
    {screen === 'menu' && <MenuScene background={menuBackground} paused={Boolean(page || sheet || pageHidden)} />}
    <main className={`app-shell ${screen === 'game' ? 'is-playing' : ''} ${page ? 'has-progression-page' : screen === 'menu' ? 'has-main-menu' : ''}`}>
      {page ? <>
        {page === 'theme-select' && <ThemeSelectPage collection={collection} ruleset={ruleset} initialTheme={themeId} populationCounts={themePopulation.counts} onClose={closePage} onPlay={start} />}
        {page === 'collection' && <TileBinder collection={collection} initialTheme={themeId} initialRuleset={ruleset} onClose={closePage} />}
        {page === 'daily-welcome' && <DailyWelcomePage progression={progression} now={economyNow} onClose={closePage} onClaim={claimDaily} onDoubleClaim={doubleDaily} adState={adState} gentle={gentle} paused={pageHidden} />}
        {page === 'daily' && <DailyRewardsPage progression={progression} onClose={closePage} onClaim={claimDaily} onDoubleClaim={doubleDaily} adState={adState} gentle={gentle} />}
        {(page === 'quests' || page === 'login-quests') && <DailyQuestsPage progression={progression} now={economyNow} onClose={closePage} onClaim={claimQuest} onReroll={rerollQuest} showLoginAction={page === 'login-quests'} />}
        {page === 'shop' && <ShopPage progression={progression} onClose={closePage} onBuy={buyBoosters} onPurchase={purchaseCurrency} />}
        {page === 'achievements' && <AchievementsPage progression={progression} profile={profile} onEquipFrame={equipAchievementFrame} onClose={closePage} gentle={gentle} />}
        {page === 'leaderboards' && <LeaderboardsPage progression={progression} profile={profile} onClose={closePage} presentation={rankingPresentation} sound={sound} gentle={gentle} />}
      </> : <>
      <AnimatePresence mode="wait">
        {screen === 'menu' ? <motion.div className="home-screen progression-home" inert={Boolean(sheet || result)} key="menu" {...fade}>
          <ProgressionMenuHeader profile={profile} loginDays={getDailyView(progression).loginDays} currencies={progression.currencies}
            onQuests={() => openPage('quests')} questsReady={getDailyQuestView(progression, economyNow).quests.filter(quest => quest.completed && !quest.claimed).length}
            onProfile={() => openSheet('profile')} onDaily={() => openPage('daily')}
            onAchievements={() => openPage('achievements')}
            onSettings={() => openSheet('settings')} onLeaderboards={() => openPage('leaderboards')} />
          <div className="home-collection" hidden aria-hidden="true"><TileFan faces={[faces.western.W28, faces.western.W07, dragon, faces.western.W16, faces.western.W08]} theme={activeTheme} sound={sound} gentle={gentle} /></div>
          <section className="home-actions" aria-label="Play Duel">
            <motion.button className="duel-launch" whileTap={{ y: 4, scale: .985 }} onClick={() => openPage('theme-select')}><Sword weight="fill" size={31} /><span>Play Duel</span><ArrowRight size={25} weight="bold" /></motion.button>
            <div className="home-links"><button className="binder-launch" onClick={() => openPage('collection')}><BookOpen size={23} weight="duotone" />Collection</button></div>
            <button className="shop-launch" onClick={() => openPage('shop')}><Storefront size={23} weight="duotone" />Shop</button>
          </section>
        </motion.div> : <motion.div key="game" className={`game-screen ${streakCues.length ? 'has-streak' : ''}`} inert={Boolean(sheet || result || entering)} {...fade}>
          <header className="game-header"><IconButton label="Pause game" disabled={!freeCount} onClick={() => openSheet('pause')}><List size={26} weight="bold" /></IconButton></header>
          <div className="scoreboard duel-scoreboard" data-turn={game.turn}>
            <div className={`player-score local-player ${!opponentTurn ? 'active-turn' : ''}`}><div className="local-avatar-wrap"><PlayerAvatar profile={profile} /><StreakPortrait cues={streakCues} paused={Boolean(sheet || result || entering)} gentle={gentle} /></div><div><span>{profile.name}</span><strong>{game.score.toLocaleString()}</strong></div><StreakFeedback cues={streakCues} profile={profile} paused={Boolean(sheet || result || entering)} sound={sound} gentle={gentle} onComplete={completedCues => setStreakCues(current => current === completedCues ? [] : current)} /></div>
            <div className="score-versus" aria-hidden="true">VS</div>
            <div className={`player-score opponent ${opponentTurn ? 'active-turn' : ''}`}><div><span className="opponent-name" title={opponentName}><span>{profile.name}’s</span> Ghost</span><strong>{game.aiScore.toLocaleString()}</strong></div><span className="ghost-portrait"><PlayerAvatar profile={profile} /><Ghost weight="fill" size={15} /></span></div>
            <div className="duel-progress"><div className="duel-progress-labels"><span>{game.score / 100} pairs</span><strong>{game.score >= 2100 ? 'You secured the win' : game.aiScore >= 2100 ? 'Ghost secured the win' : 'First to 21'}</strong><span>{game.aiScore / 100} pairs</span></div><div className="duel-progress-track" role="progressbar" aria-label="Duel pair progress" aria-valuemin={0} aria-valuemax={40} aria-valuenow={(game.score + game.aiScore) / 100} aria-valuetext={`You ${game.score / 100} pairs, ghost ${game.aiScore / 100} pairs; ${freeCount / 2} pairs remain`}><span className="your-progress" style={{ width: `${game.score / 4000 * 100}%` }} /><span className="ghost-progress" style={{ width: `${game.aiScore / 4000 * 100}%` }} /><i /></div></div>
          </div>
          <div className={`turn-ribbon ${opponentTurn ? 'ghost-turn' : ''}`} aria-live="polite"><span>{opponentTurn ? 'Ghost’s turn' : 'Your turn'}</span><small>{freeCount / 2} pairs left{game.freezeReady ? ' · Ghost frozen' : ''}{game.eagleMs > 0 ? ` · Eagle Eye ${Math.ceil(game.eagleMs / 1000)}s` : ''}</small></div>
          <div className="board-space" style={{ '--board-ratio': table.width / table.height }}><div className="board-frame">
            <div className="game-board" ref={attachBoard} role="group" aria-label={`${game.ruleset} Mahjong board, ${freeCount} tiles left`}>
              <AnimatePresence>{game.tiles.filter(tile => !tile.removed).map((tile, index) => {
                const free = isFree(tile, game.tiles), faceUp = flippedIds.includes(tile.id), active = selected === tile.id && faceUp, inFlight = flight?.ids.includes(tile.id);
                const rarity = rarityForTile(game.theme, game.ruleset, tile.faceId);
                const hinted = game.hintEffect?.ids.includes(tile.id), eagle = game.eagleMs > 0 && !faceUp;
                return <motion.button layout="position" key={tile.id} data-tile-id={tile.id} data-free={free} data-face-up={faceUp} data-rarity={rarity.id} data-rarity-visible={faceUp || eagle} className={`game-tile ${free ? 'free' : 'blocked'} ${active ? 'tile-selected' : ''} ${inFlight ? 'tile-in-flight' : ''} ${hinted ? 'hinted' : ''} ${eagle ? 'eagle-lit' : ''}`} aria-label={faceUp ? `${tile.name}, ${rarity.label}, revealed` : `Hidden stone, row ${tile.y + 1}, column ${tile.x + 1}, layer ${tile.z + 1}, ${free ? 'uncovered' : 'covered'}${eagle ? `, ${rarity.label}` : ''}`} aria-pressed={faceUp} aria-disabled={!free || opponentTurn || (game.mode === 'duel' && Boolean(pending))} tabIndex={free && !opponentTurn && !(game.mode === 'duel' && pending) ? 0 : -1} style={{ ...tilePosition(tile, table), '--rarity-color': rarity.color, '--shine-delay': `${-(index % 11) * .7}s`, zIndex: tile.z * 100 + Math.floor(tile.y * 10) + (active ? 80 : 0) }} initial={{ opacity: 0, scale: 0.86, y: -20 }} animate={{ opacity: 1, scale: active ? 1.035 : 1, y: active ? -3 : 0 }} exit={{ opacity: 0, transition: { duration: 0 } }} transition={{ duration: 0.18, delay: screen === 'game' && game.elapsed < 1 ? index * 0.004 : 0 }} onClick={() => tap(tile)}><span className="tile-rotator">
                    <span className="tile-side tile-back" aria-hidden="true"><img className="tile-art" src={activeTheme.back} alt="" draggable="false" /></span>
                    <span className="tile-side tile-front" aria-hidden={!faceUp}><TileArt face={faces[game.ruleset][tile.faceId]} /></span>
                  </span>{(faceUp || eagle) && <TileRarity rarity={rarity} />}{active && <span className="selected-dot" />}</motion.button>;
              })}</AnimatePresence>
              {flight && <MatchFlight key={flight.key} flight={flight} faces={faces[game.ruleset]} themeId={game.theme} ruleset={game.ruleset} paused={Boolean(sheet || result || pageHidden)} onComplete={() => setFlight(current => current?.key === flight.key ? null : current)} />}
            </div>
            <AnimatePresence>{burst && <motion.div key={burst.id} className="match-burst" style={{ left: burst.x, top: burst.y === undefined ? undefined : burst.y - 48 }} initial={{ opacity: 0, scale: 0.7, y: 18 }} animate={{ opacity: 1, scale: 1, y: -10 }} exit={{ opacity: 0, y: -40 }}><Sparkle weight="fill" size={19} /><strong>+{burst.points}</strong>{burst.combo > 1 && <span>{burst.combo}×</span>}</motion.div>}</AnimatePresence>
          </div></div>
          <div className="board-status" aria-live="polite">{pending?.kind === 'peek' ? <span>Remember these faces…</span> : (pending?.kind === 'pair' || pending?.kind === 'collision') ? <span>{pending.matched ? 'Match! Play again.' : 'Remember these faces…'}</span> : selectedTile ? <span>{selectedTile.name}<small> · remember its identical match</small></span> : <span>{uncoveredCount} uncovered<span className="status-dot">·</span>{freeCount} stones remaining</span>}</div>
          <div className="game-tools" aria-label="Boosters">{[
            ['shuffle', 'Shuffle', ArrowsClockwise], ['hint', 'Hint', Lightbulb], ['freeze', 'Freeze', Snowflake], ['eagle', 'Eagle Eye', Eye],
          ].map(([id, label, Icon]) => <button key={id} aria-label={`${label}, ${game.boosters[id]} uses left`} onClick={() => activateBooster(id)} disabled={!canUseBooster(game, id) || Boolean(pending) || (flippedIds.length > 0 && ['shuffle', 'hint'].includes(id))} className={id === 'freeze' && game.freezeReady || id === 'eagle' && game.eagleMs > 0 ? 'booster-active' : ''}><span className="tool-medallion"><Icon size={27} weight="duotone" /><small>{game.boosters[id]}</small></span><span>{label}</span></button>)}</div>
        </motion.div>}
      </AnimatePresence>
      <AnimatePresence>{toast && <motion.div className="toast" role="status" key={toast.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}>{toast.message}</motion.div>}</AnimatePresence>
      <AnimatePresence>{sheet && <Sheet key={sheet} title={{ rules: 'How to play', settings: 'Settings', profile: 'Profile', pause: 'Paused', restart: 'New duel', leave: 'Leave duel?' }[sheet]} onClose={closeSheet}>
        {sheet === 'profile' && <ProfileEditor profile={profile} achievementPoints={progression.points} onSave={updateProfile} />}
        {sheet === 'rules' && <><Rules ruleset={screen === 'game' ? game.ruleset : ruleset} aiMode={screen === 'game' ? game.aiMode : aiMode} /><button className="primary-button" onClick={closeSheet}>Got it <Check size={22} weight="bold" /></button></>}
        {sheet === 'settings' && <div className="settings-content">
          <section className="settings-ruleset" aria-labelledby="settings-ai-heading">
            <h3 id="settings-ai-heading" className="settings-ruleset-heading">Opponent AI</h3>
            {screen === 'game' && <p className="settings-ruleset-note">Applies to your next duel. Playing now: {AI_MODES.find(value => value.id === normalizeAiMode(game.aiMode)).label}.</p>}
            <div className="settings-ruleset-switch" role="group" aria-label="Opponent AI" aria-describedby="settings-ai-description">{AI_MODES.map(value => <button key={value.id} className={aiMode === value.id ? 'active' : ''} aria-pressed={aiMode === value.id} onClick={() => { setAiMode(value.id); playSound('tap'); }}>{value.label}</button>)}</div>
            <p id="settings-ai-description" className="settings-ruleset-note">{AI_MODES.find(value => value.id === aiMode).description}</p>
          </section>
          <section className="settings-ruleset" aria-labelledby="settings-ruleset-heading">
            <h3 id="settings-ruleset-heading" className="settings-ruleset-heading">Ruleset</h3>
            {screen === 'game' && <p className="settings-ruleset-note">Applies to your next duel.</p>}
            <div className="settings-ruleset-switch" role="group" aria-label="Ruleset">{['eastern', 'western'].map(value => <button key={value} className={ruleset === value ? 'active' : ''} aria-pressed={ruleset === value} onClick={() => { setRuleset(value); playSound('tap'); }}>{value === 'eastern' ? <FlowerLotus size={21} weight="duotone" /> : <Diamond size={21} weight="duotone" />}{value === 'eastern' ? 'Eastern' : 'Western'}</button>)}</div>
          </section><label className="setting-row"><span><SpeakerHigh size={25} weight="fill" /><span><strong>Sound</strong><small>Tiles, buttons & celebrations</small></span></span><input type="checkbox" role="switch" checked={sound} onChange={e => { setSound(e.target.checked); chime('tap', e.target.checked); }} /><span className="toggle" /></label><label className="setting-row"><span><Sparkle size={25} weight="fill" /><span><strong>Gentle motion</strong><small>Fewer animated effects</small></span></span><input type="checkbox" role="switch" checked={gentle} onChange={e => setGentle(e.target.checked)} /><span className="toggle" /></label><label className="setting-row"><span><Diamond size={25} weight="fill" /><span><strong>Rank pips</strong><small>Help identify count & tier tiles</small></span></span><input type="checkbox" role="switch" checked={pips} onChange={e => setPips(e.target.checked)} /><span className="toggle" /></label><button className="secondary-button settings-rules-button" onClick={() => openSheet('rules')}><span><Info size={21} weight="bold" />Rules</span><CaretRight size={21} /></button><button className="primary-button" onClick={closeSheet}>Done <Check size={22} weight="bold" /></button></div>}
        {sheet === 'pause' && <div className="pause-content"><div className="pause-flower"><FlowerLotus size={70} weight="duotone" /></div><button className="primary-button" onClick={closeSheet}>Continue <Play size={21} weight="fill" /></button><button className="secondary-button" onClick={() => openSheet('settings')}>Settings <GearSix size={21} /></button><button className="secondary-button" onClick={() => openSheet('restart')}>New duel <ArrowsClockwise size={21} /></button><button className="plain-button" onClick={() => openSheet('leave')}>Leave duel</button></div>}
        {sheet === 'restart' && <div className="pause-content"><p className="restart-copy">End this duel and choose a theme for your next board?</p><button className="primary-button" onClick={() => { leaveDuel(); openPage('theme-select'); }}>Choose a theme <ArrowsClockwise size={22} /></button><button className="plain-button" onClick={() => setSheet('pause')}>Keep this duel</button></div>}
        {sheet === 'leave' && <div className="pause-content"><p className="restart-copy">Leaving ends this duel. Tiles you collected stay in your binder.</p><button className="primary-button" onClick={leaveDuel}>Leave duel <ArrowRight size={22} /></button><button className="plain-button" onClick={() => setSheet('pause')}>Keep playing</button></div>}
      </Sheet>}</AnimatePresence>
      <AnimatePresence>{result && <motion.div className="result-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><motion.section className="result-card" role="dialog" aria-modal="true" aria-label="Game results" initial={{ y: 25, scale: .9 }} animate={{ y: 0, scale: 1 }} transition={{ type: 'spring', damping: 20 }}><VictoryBloom /><h2>{result === 'win' ? 'Victory!' : result === 'tie' ? 'A perfect tie!' : 'Well played!'}</h2><p>{result === 'win' ? 'You outmatched your ghost.' : result === 'tie' ? 'A memory match, perfectly balanced.' : 'Your ghost takes this round.'}</p><div className="result-stats"><div><span>You</span><strong>{game.score.toLocaleString()}</strong></div><div><span>Ghost</span><strong>{game.aiScore.toLocaleString()}</strong></div><div><span>Your pairs</span><strong>{game.score / 100}</strong></div></div><div className="result-currency-reward"><CurrencyIcon kind="coins" /><strong>+{DUEL_COIN_REWARDS[result]} Coins</strong><span>Added to your balance</span></div><div className="result-memory"><PlayerAvatar profile={profile} /><span>{(80 - freeCount) / 2} pairs cleared<small>Every duel starts with a fresh board.</small></span></div>{progression.newAchievementIds.length > 0 && <p className="result-achievement-summary">{progression.newAchievementIds.length} achievement{progression.newAchievementIds.length === 1 ? '' : 's'} unlocked</p>}<button className="primary-button" onClick={continueResult}>Continue <ArrowRight size={25} weight="bold" /></button></motion.section></motion.div>}</AnimatePresence>
      </>}
    </main>
    <AchievementNotifications batches={achievementBatches} onComplete={id => setAchievementBatches(current => current.filter(batch => batch.id !== id))} paused={Boolean(sheet || entering || pageHidden)} sound={sound} gentle={gentle} />
    {entering && <MenuScene background={menuBackground} opening onComplete={() => setEntering(false)} />}
  </div></MotionConfig>;
}

createRoot(document.getElementById('root')).render(<App />);
