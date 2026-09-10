import { normalizeCosmetics, type CosmeticsState } from "./cosmetics";
import { normalizeStatistics, type PlayerStatistics } from "./statistics";
import { normalizeControls, type ControlsBindings } from "./controls-bindings";

export interface Settings {
  sensitivity: number;
  fov: number;
  railAuto: boolean;
  shotgunAuto: boolean;
  volume: number;
  resolution: number;
  crosshair: "cross" | "dot" | "ring";
  crosshairColor: string;
  gore?: boolean;
  controls?: ControlsBindings;
}
export interface Profile {
  name: string;
  settings: Settings;
  cosmetics?: CosmeticsState;
  settledLanMatches?: string[];
  statistics?: PlayerStatistics;
  stats: { matches: number; wins: number; kills: number; deaths: number; tournaments: number; tournamentWins: number; tournamentDraws: number };
}
export const defaults: Settings = {
  sensitivity: 1,
  fov: 95,
  railAuto: true,
  shotgunAuto: true,
  volume: 0.45,
  resolution: 1,
  crosshair: "cross",
  crosshairColor: "#f7efe4",
  gore: true,
};
export let storageAvailable = true;
const record = (value: unknown): Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const finite = (value: unknown, fallback: number, min: number, max: number) => typeof value === "number" && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
const count = (value: unknown) => Math.floor(finite(value, 0, 0, Number.MAX_SAFE_INTEGER));
const ids = (value: unknown) => Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === "string" && id.length > 0 && id.length <= 100))].slice(-512) : [];

/** Storage and backup data share one allowlist; malformed settings never reach rendering/input. */
export function normalizeProfile(value: unknown): Profile {
  const saved = record(value), settings = record(saved.settings), stats = record(saved.stats);
  return {
    name: typeof saved.name === "string" ? saved.name.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 20) : "",
    settings: {
      sensitivity: finite(settings.sensitivity, defaults.sensitivity, .25, 2.5),
      fov: Math.round(finite(settings.fov, defaults.fov, 70, 115)),
      railAuto: typeof settings.railAuto === "boolean" ? settings.railAuto : defaults.railAuto,
      shotgunAuto: typeof settings.shotgunAuto === "boolean" ? settings.shotgunAuto : defaults.shotgunAuto,
      volume: finite(settings.volume, defaults.volume, 0, 1),
      resolution: [.65, .8, 1].includes(settings.resolution as number) ? settings.resolution as number : defaults.resolution,
      crosshair: ["cross", "dot", "ring"].includes(settings.crosshair as string) ? settings.crosshair as Settings["crosshair"] : defaults.crosshair,
      crosshairColor: typeof settings.crosshairColor === "string" && /^#[0-9a-f]{6}$/i.test(settings.crosshairColor) ? settings.crosshairColor : defaults.crosshairColor,
      gore: typeof settings.gore === "boolean" ? settings.gore : true,
      controls: normalizeControls(settings.controls),
    },
    cosmetics: normalizeCosmetics(saved.cosmetics),
    settledLanMatches: ids(saved.settledLanMatches),
    statistics: normalizeStatistics(saved.statistics),
    stats: {
      matches: count(stats.matches), wins: count(stats.wins), kills: count(stats.kills), deaths: count(stats.deaths),
      tournaments: count(stats.tournaments), tournamentWins: count(stats.tournamentWins), tournamentDraws: count(stats.tournamentDraws),
    },
  };
}
export function getProfile(): Profile {
  try {
    const saved = JSON.parse(
      localStorage.getItem("phobos.profile.v1") || "null",
    );
    storageAvailable = true;
    return normalizeProfile(saved);
  } catch {
    storageAvailable = false;
    return normalizeProfile(null);
  }
}
export function saveProfile(profile: Profile) {
  try {
    localStorage.setItem("phobos.profile.v1", JSON.stringify(profile));
    storageAvailable = true;
    return true;
  } catch {
    storageAvailable = false;
    return false;
  }
}
