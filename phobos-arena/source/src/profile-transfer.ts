import { normalizeProfile, saveProfile, type Profile } from "./profile";

export const MAX_BACKUP_BYTES = 4_000_000;
const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);

/** Reconnect secrets live in sessionStorage and are intentionally absent from this format. */
export function exportProfile(profile: Profile): string {
  return JSON.stringify({ format: "phobos-profile", version: 1, exportedAt: new Date().toISOString(), profile: normalizeProfile(profile) });
}

export function readProfileBackup(text: string): Profile {
  if (new TextEncoder().encode(text).byteLength > MAX_BACKUP_BYTES) throw new Error("Backup is too large. Choose a Phobos profile file under 4 MB.");
  let backup: unknown;
  try { backup = JSON.parse(text); } catch { throw new Error("This file is not a readable JSON backup."); }
  if (!isRecord(backup) || backup.format !== "phobos-profile" || backup.version !== 1)
    throw new Error("Choose a supported Phobos profile backup (version 1).");
  const value = backup.profile;
  if (!isRecord(value) || typeof value.name !== "string" || !value.name.trim() || !isRecord(value.settings) || !isRecord(value.stats) || !isRecord(value.cosmetics))
    throw new Error("The backup is missing its name, settings, statistics or cosmetics.");
  return normalizeProfile(value);
}

/** Persist before replacing live state. Keep Settings identity used by the input adapter. */
export function restoreProfile(current: Profile, incoming: Profile, persist: (profile: Profile) => boolean = saveProfile): boolean {
  const candidate = normalizeProfile(incoming);
  if (!candidate.name || !persist(candidate)) return false;
  const settings = current.settings;
  Object.assign(settings, candidate.settings);
  Object.assign(current, candidate, { settings });
  return true;
}
