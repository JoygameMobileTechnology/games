import { MODE_INFO, type Mode } from "./match";
import { WEAPONS, type WeaponId } from "./rules";

export type StatisticsSource = "solo" | "lan";
export type StatisticsOutcome = "win" | "loss" | "draw" | "abandoned";
export interface WeaponStatistics { shots: number; hits: number; kills: number; headshots: number; damageDealt: number }
/** One shot is one fired attack/volley; a hit means it dealt enemy damage at least once. */
export interface MatchTelemetry {
  kills: number; deaths: number; assists: number; headshots: number; shots: number; hits: number;
  damageDealt: number; damageTaken: number; captures: number; returns: number; playTimeSeconds: number;
  weapons: Partial<Record<WeaponId, WeaponStatistics>>;
}
export interface StatisticsTotals extends MatchTelemetry {
  completed: number; wins: number; losses: number; draws: number; abandoned: number;
}
export interface StatisticsRecord {
  matchId: string; source: StatisticsSource; mode: Mode; outcome: StatisticsOutcome;
  /** Only incomplete records need their previous contribution for later replacement. */
  telemetry?: MatchTelemetry;
}
export interface PlayerStatistics {
  version: 1; lifetime: StatisticsTotals; solo: StatisticsTotals; lan: StatisticsTotals;
  modes: Partial<Record<Mode, StatisticsTotals>>; settled: StatisticsRecord[];
}
export interface StatisticsSettlement extends Omit<StatisticsRecord, "telemetry"> { telemetry: MatchTelemetry }
const counters = ["kills", "deaths", "assists", "headshots", "shots", "hits", "damageDealt", "damageTaken", "captures", "returns", "playTimeSeconds"] as const;
const results = ["completed", "wins", "losses", "draws", "abandoned"] as const;
const weaponCounters = ["shots", "hits", "kills", "headshots", "damageDealt"] as const;
const bounded = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(1e12, value)) : 0;
const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

export function emptyTelemetry(): MatchTelemetry {
  return { kills: 0, deaths: 0, assists: 0, headshots: 0, shots: 0, hits: 0, damageDealt: 0, damageTaken: 0,
    captures: 0, returns: 0, playTimeSeconds: 0, weapons: {} };
}
export function weaponStatistics(telemetry: MatchTelemetry, weapon: WeaponId): WeaponStatistics {
  return telemetry.weapons[weapon] ??= { shots: 0, hits: 0, kills: 0, headshots: 0, damageDealt: 0 };
}
export function emptyStatisticsTotals(): StatisticsTotals {
  return { ...emptyTelemetry(), completed: 0, wins: 0, losses: 0, draws: 0, abandoned: 0 };
}
export function emptyStatistics(): PlayerStatistics {
  return { version: 1, lifetime: emptyStatisticsTotals(), solo: emptyStatisticsTotals(), lan: emptyStatisticsTotals(), modes: {}, settled: [] };
}
export function normalizeTelemetry(value: unknown): MatchTelemetry {
  const input = object(value), result = emptyTelemetry();
  for (const key of counters) result[key] = bounded(input[key]);
  result.hits = Math.min(result.hits, result.shots);
  for (const weapon of Object.keys(WEAPONS) as WeaponId[]) {
    const saved = object(input.weapons)[weapon];
    if (!saved || typeof saved !== "object") continue;
    const stats = weaponStatistics(result, weapon), fields = object(saved);
    for (const key of weaponCounters) stats[key] = bounded(fields[key]);
    stats.hits = Math.min(stats.hits, stats.shots);
  }
  return result;
}
function normalizeTotals(value: unknown): StatisticsTotals {
  const input = object(value), totals = { ...emptyStatisticsTotals(), ...normalizeTelemetry(input) };
  for (const key of results) totals[key] = Math.floor(bounded(input[key]));
  return totals;
}
export function normalizeStatistics(value: unknown): PlayerStatistics {
  const input = object(value), result = emptyStatistics();
  if (input.version !== 1) return result;
  result.lifetime = normalizeTotals(input.lifetime); result.solo = normalizeTotals(input.solo); result.lan = normalizeTotals(input.lan);
  for (const mode of Object.keys(MODE_INFO) as Mode[])
    if (Object.hasOwn(object(input.modes), mode)) result.modes[mode] = normalizeTotals(object(input.modes)[mode]);
  if (Array.isArray(input.settled)) {
    const seen = new Set<string>();
    for (const value of input.settled.slice(-512)) {
      const record = object(value);
      if (typeof record.matchId !== "string" || !record.matchId.length || record.matchId.length > 128 || seen.has(record.matchId) ||
          (record.source !== "solo" && record.source !== "lan") || typeof record.mode !== "string" || !Object.hasOwn(MODE_INFO, record.mode) ||
          !["win", "loss", "draw", "abandoned"].includes(String(record.outcome))) continue;
      seen.add(record.matchId);
      result.settled.push({ matchId: record.matchId, source: record.source, mode: record.mode as Mode, outcome: record.outcome as StatisticsOutcome,
        ...(record.outcome === "abandoned" ? { telemetry: normalizeTelemetry(record.telemetry) } : {}) });
    }
  }
  return result;
}
function contribute(total: StatisticsTotals, telemetry: MatchTelemetry, outcome: StatisticsOutcome, direction: 1 | -1) {
  for (const key of counters) total[key] = Math.max(0, total[key] + telemetry[key] * direction);
  const outcomeKey = outcome === "abandoned" ? "abandoned" : outcome === "win" ? "wins" : outcome === "loss" ? "losses" : "draws";
  total[outcomeKey] = Math.max(0, total[outcomeKey] + direction);
  if (outcome !== "abandoned") total.completed = Math.max(0, total.completed + direction);
  for (const weapon of Object.keys(telemetry.weapons) as WeaponId[]) {
    const source = telemetry.weapons[weapon]!, target = weaponStatistics(total, weapon);
    for (const key of weaponCounters) target[key] = Math.max(0, target[key] + source[key] * direction);
  }
}
/** Detailed totals only: existing legacy counters and cosmetic rewards are owned by their current callers. */
export function settleStatistics(profile: { statistics?: PlayerStatistics }, entry: StatisticsSettlement): boolean {
  if (!entry.matchId || entry.matchId.length > 128 || !Object.hasOwn(MODE_INFO, entry.mode) ||
      (entry.source !== "solo" && entry.source !== "lan") || !["win", "loss", "draw", "abandoned"].includes(entry.outcome)) return false;
  const statistics = profile.statistics ??= emptyStatistics();
  const previous = statistics.settled.find(record => record.matchId === entry.matchId);
  if (previous && (previous.outcome !== "abandoned" || previous.source !== entry.source || previous.mode !== entry.mode)) return false;
  const telemetry = normalizeTelemetry(entry.telemetry);
  if (previous?.telemetry && entry.outcome === "abandoned" && telemetry.playTimeSeconds <= previous.telemetry.playTimeSeconds) return false;
  const totals = [statistics.lifetime, statistics[entry.source], statistics.modes[entry.mode] ??= emptyStatisticsTotals()];
  for (const total of totals) {
    if (previous?.telemetry) contribute(total, previous.telemetry, "abandoned", -1);
    contribute(total, telemetry, entry.outcome, 1);
  }
  const record: StatisticsRecord = { matchId: entry.matchId, source: entry.source, mode: entry.mode, outcome: entry.outcome,
    ...(entry.outcome === "abandoned" ? { telemetry } : {}) };
  if (previous) statistics.settled.splice(statistics.settled.indexOf(previous), 1);
  statistics.settled.push(record);
  if (statistics.settled.length > 512) statistics.settled.splice(0, statistics.settled.length - 512);
  return true;
}
