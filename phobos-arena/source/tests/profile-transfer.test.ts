import test from "node:test";
import assert from "node:assert/strict";
import { normalizeProfile } from "../src/profile.ts";
import { exportProfile, readProfileBackup, restoreProfile } from "../src/profile-transfer.ts";
import { emptyTelemetry, settleStatistics } from "../src/statistics.ts";
import { WEAPON_ORDER } from "../src/rules.ts";

const operator = () => normalizeProfile({ name: "Keeper", stats: { matches: 11, wins: 4, kills: 25 }, settings: { sensitivity: 1.4 }, cosmetics: { favor: 300, owned: ["character:vesper"], character: "vesper", rewardedMatches: ["round-1"] }, settledLanMatches: ["lan-1"] });
test("backup round trip retains cosmetics, rewards, name, settings and legacy records without reconnect credentials", () => {
  const profile = operator();
  const encoded = exportProfile(Object.assign(profile, { token: "secret", session: { reconnect: "secret" } }));
  assert.equal(encoded.includes("secret"), false);
  assert.deepEqual(readProfileBackup(encoded), normalizeProfile(profile));
});
test("malformed or unsupported backups are rejected without silently wiping the profile", () => {
  for (const text of ["null", "[]", "{", '{"format":"other","version":1}', '{"format":"phobos-profile","version":2}', '{"format":"phobos-profile","version":1,"profile":{}}', " ".repeat(4_000_001)]) assert.throws(() => readProfileBackup(text));
});
test("normalization drops retired and injected fields and bounds unsafe renderer/stat settings", () => {
  const profile = normalizeProfile({ name: "\u0000 Keeper ", settings: { sensitivity: "fast", fov: 10000, volume: -9, resolution: 500, crosshair: "<img>", crosshairColor: "red;position:fixed", flick: true }, stats: { matches: -5, wins: Infinity, kills: 4.9, injected: 99 }, settledLanMatches: ["", "x", "x", {}, "z".repeat(101)] });
  assert.equal(profile.name, "Keeper"); assert.equal(profile.settings.fov, 115); assert.equal(profile.settings.volume, 0);
  assert.equal(profile.settings.sensitivity, 1); assert.equal(profile.settings.resolution, 1); assert.equal(profile.settings.crosshair, "cross");
  assert.equal(profile.stats.matches, 0); assert.equal(profile.stats.wins, 0); assert.equal(profile.stats.kills, 4);
  assert.deepEqual(profile.settledLanMatches, ["x"]); assert.equal("flick" in profile.settings, false); assert.equal("injected" in profile.stats, false);
});
test("failed restore preserves live profile; successful restore preserves settings object identity", () => {
  const current = operator(), before = structuredClone(current), settings = current.settings;
  const incoming = normalizeProfile({ ...operator(), name: "Traveler", settings: { fov: 110 }, cosmetics: { favor: 50 } });
  assert.equal(restoreProfile(current, incoming, () => false), false); assert.deepEqual(current, before);
  let persisted: unknown;
  assert.equal(restoreProfile(current, incoming, p => { persisted = structuredClone(p); return true; }), true);
  assert.equal(current.settings, settings); assert.equal(current.name, "Traveler"); assert.equal(settings.fov, 110); assert.equal(current.cosmetics?.favor, 50);
  assert.deepEqual(current, persisted);
});
test("a full supported match ledger and custom controls survive export and restore", () => {
  const profile = operator();
  profile.settings.controls!.keys.weapon1 = ["KeyF", null];
  const telemetry = emptyTelemetry();
  for (const id of WEAPON_ORDER) telemetry.weapons[id] = { shots: 99999, hits: 55555, kills: 44444, headshots: 33333, damageDealt: 123456789 };
  telemetry.playTimeSeconds = 123.456;
  for (let i = 0; i < 512; i++) settleStatistics(profile, { matchId: `${i}-${"x".repeat(90)}`, source: "solo", mode: "ffa", outcome: "abandoned", telemetry });
  const restored = readProfileBackup(exportProfile(profile));
  assert.equal(restored.statistics!.settled.length, 512);
  assert.deepEqual(restored.statistics, normalizeProfile(profile).statistics);
  assert.equal(restored.settings.controls!.keys.weapon1[0], "KeyF");
});
