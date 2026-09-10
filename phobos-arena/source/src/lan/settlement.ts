import { rewardMatch } from "../cosmetics";
import type { Profile } from "../profile";
import type { GameSnapshot } from "./types";
import { settleStatistics } from "../statistics";

/** Settle authoritative human-only totals once, even after a reload/reconnect. */
export function settleLanMatch(profile: Profile, state: GameSnapshot, actorId: number) {
  const actor = state.actors.find((item) => item.id === actorId);
  if (!state.ended || !state.result || !actor) return 0;
  profile.settledLanMatches ??= [];
  if (profile.settledLanMatches.includes(state.matchId)) return 0;
  const won = !state.result.draw && (state.result.winnerId === actorId ||
    (state.result.winnerTeam !== null && state.result.winnerTeam === actor.team));
  profile.stats.matches++;
  if (won) profile.stats.wins++;
  const count = (n: number) => Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  profile.stats.kills += count(actor.humanKills);
  profile.stats.deaths += count(actor.humanDeaths);
  if (actor.humanTelemetry && state.config?.mode) settleStatistics(profile, {
    matchId: state.matchId, source: "lan", mode: state.config.mode,
    outcome: state.result.draw ? "draw" : won ? "win" : "loss", telemetry: actor.humanTelemetry,
  });
  const favor = profile.cosmetics ? rewardMatch(profile.cosmetics, state.matchId, won) : 0;
  profile.settledLanMatches.push(state.matchId);
  profile.settledLanMatches = profile.settledLanMatches.slice(-512);
  return favor;
}
