import { AVATAR_IDS, DEFAULT_PROFILE } from './profile-store.js';

export const RANKING_CONFIG = Object.freeze({ initialPosition: 10000, winRate: .02, aroundRows: 7, topRows: 10 });
export const LEAGUES = Object.freeze([
  { id: 'bronze', name: 'Bronze', minWins: 0, color: '#b77943' },
  { id: 'silver', name: 'Silver', minWins: 10, color: '#96a6b2' },
  { id: 'gold', name: 'Gold', minWins: 30, color: '#d5aa41' },
  { id: 'jade', name: 'Jade', minWins: 75, color: '#4a9877' },
  { id: 'master', name: 'Master', minWins: 150, color: '#8d6db9' },
  { id: 'grandmaster', name: 'Grandmaster', minWins: 300, color: '#c7654f' },
].map(Object.freeze));
const safeCount = value => Number.isSafeInteger(value) && value >= 0;

export function leagueForWins(wins) {
  const count = safeCount(wins) ? wins : 0;
  return [...LEAGUES].reverse().find(league => count >= league.minWins);
}
export function createRanking(seed = 1) {
  return { seed: safeCount(seed) ? seed >>> 0 : 1, position: RANKING_CONFIG.initialPosition, wins: 0, leagueId: LEAGUES[0].id };
}
export function normalizeRanking(value, completedWins = 0, seed = 1) {
  const ranking = createRanking(seed);
  if (value && safeCount(value.seed)) ranking.seed = value.seed >>> 0;
  if (Number.isSafeInteger(value?.position) && value.position >= 1 && value.position <= RANKING_CONFIG.initialPosition) ranking.position = value.position;
  ranking.wins = safeCount(completedWins) ? completedWins : 0;
  ranking.leagueId = leagueForWins(ranking.wins).id;
  return ranking;
}
export function advanceRanking(ranking, { outcome, wins, eventId, gameId, newAchievementIds = [] }) {
  const previousPosition = ranking.position;
  const previousLeagueId = ranking.leagueId;
  const gain = outcome === 'win' ? Math.max(1, Math.round(previousPosition * RANKING_CONFIG.winRate)) : 0;
  const position = Math.max(1, previousPosition - gain);
  const leagueId = leagueForWins(wins).id;
  return {
    ranking: { ...ranking, position, wins, leagueId },
    presentation: { eventId, gameId, outcome, previousPosition, position, previousLeagueId, leagueId,
      improved: position < previousPosition, promoted: leagueId !== previousLeagueId, wins, newAchievementIds: [...newAchievementIds] },
  };
}
function hash(seed, slot) {
  let value = (seed ^ Math.imul(slot, 0x9e3779b1)) >>> 0;
  value = Math.imul(value ^ value >>> 16, 0x85ebca6b);
  value = Math.imul(value ^ value >>> 13, 0xc2b2ae35);
  return (value ^ value >>> 16) >>> 0;
}
const firstNames = ['Amber', 'Jun', 'Mira', 'Noor', 'Kai', 'Emi', 'Theo', 'Lina', 'Ren', 'Ada', 'Sora', 'Finn', 'Lumi', 'Ari', 'Iris', 'Nico'];
const lastNames = ['Cedar', 'River', 'Lotus', 'Maple', 'Fern', 'Willow', 'Jade', 'Birch', 'Reed', 'Pine', 'Dawn', 'Vale', 'Brook', 'Sage', 'Moss', 'Elm'];

/** Slots have stable fictional identities; standings deliberately simulate a local population. */
export function rankingRows(state, profile = DEFAULT_PROFILE, { view = 'around' } = {}) {
  const ranking = state?.ranking ?? state;
  if (!ranking || !Number.isSafeInteger(ranking.position)) return [];
  const count = view === 'top' ? RANKING_CONFIG.topRows : RANKING_CONFIG.aroundRows;
  const start = view === 'top' ? 1 : Math.max(1, Math.min(RANKING_CONFIG.initialPosition - count + 1, ranking.position - Math.floor(count / 2)));
  return Array.from({ length: count }, (_, index) => {
    const position = start + index;
    if (position === ranking.position) return { id: 'local-player', position, name: profile.name || DEFAULT_PROFILE.name,
      avatarId: AVATAR_IDS.includes(profile.avatarId) ? profile.avatarId : DEFAULT_PROFILE.avatarId, wins: ranking.wins, isPlayer: true };
    const identity = hash(ranking.seed, position);
    const distance = Math.ceil((ranking.position - position) / Math.max(1, Math.round(ranking.position * RANKING_CONFIG.winRate)));
    return { id: `competitor-${position}`, position,
      name: `${firstNames[identity % firstNames.length]} ${lastNames[(identity >>> 8) % lastNames.length]}`,
      avatarId: AVATAR_IDS[(identity >>> 16) % AVATAR_IDS.length], wins: Math.max(0, ranking.wins + distance), isPlayer: false };
  });
}
