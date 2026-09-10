import { CHARACTER_IDS, CHARACTER_SKIN_IDS, WEAPON_SKIN_IDS } from "../src/cosmetics.ts";
import { MAP_INFO, supportsMode } from "../src/maps/catalog.ts";
import { MODE_INFO, normalizeConfig, type MatchConfig } from "../src/match.ts";
import { WEAPONS } from "../src/rules.ts";
import { LAN_PROTOCOL, type ClientMessage, type GameCommand, type Hello, type RoomSettings } from "../src/lan/types.ts";

export class ProtocolError extends Error {
  constructor(public code: string, message: string) { super(message); }
}
function invalid(message = "Invalid message."): never { throw new ProtocolError("invalid", message); }
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid();
  return value as Record<string, unknown>;
}
function number(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) invalid("Numbers must be finite.");
  return value;
}
function boolean(value: unknown): boolean {
  if (typeof value !== "boolean") invalid("Expected a boolean.");
  return value;
}
function text(value: unknown, max: number): string {
  if (typeof value !== "string" || !value.length || value.length > max) invalid("Invalid text length.");
  return value;
}
function member<T extends string>(value: unknown, values: readonly T[]): T {
  if (typeof value !== "string" || !values.includes(value as T)) invalid("Unknown selection.");
  return value as T;
}
function hello(value: unknown): Hello {
  const data = record(value), appearance = record(data.appearance);
  const name = text(data.name, 20).trim();
  if (!name || /[\u0000-\u001f\u007f]/.test(name)) invalid("Use a name of 1–20 visible characters.");
  return { name, appearance: {
    character: member(appearance.character, CHARACTER_IDS),
    characterSkin: member(appearance.characterSkin, CHARACTER_SKIN_IDS),
    weaponSkin: member(appearance.weaponSkin, WEAPON_SKIN_IDS),
  } };
}
function settings(value: unknown): RoomSettings {
  const data = record(value), config = record(data.config);
  const mapId = member(data.mapId, Object.keys(MAP_INFO) as (keyof typeof MAP_INFO)[]);
  const mode = member(config.mode, Object.keys(MODE_INFO) as (keyof typeof MODE_INFO)[]);
  if (!supportsMode(mapId, mode)) invalid("This map does not support the selected mode.");
  if (!Array.isArray(config.botDifficulties) || config.botDifficulties.length > 9) invalid("Invalid bot roster.");
  if (!Array.isArray(config.teamColors) || config.teamColors.length !== 2 ||
      !config.teamColors.every(color => typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color))) invalid("Invalid team colors.");
  const clean: MatchConfig = {
    mode, population: number(config.population), timeLimit: number(config.timeLimit), scoreLimit: number(config.scoreLimit),
    botDifficulties: config.botDifficulties.map(value => member(value, ["Easy", "Medium", "Competitive"] as const)),
    teamColors: [...config.teamColors] as [string, string],
  };
  return {
    mapId, config: normalizeConfig(clean, MAP_INFO[mapId].maxPlayers),
    fillBots: boolean(data.fillBots), replaceDisconnected: boolean(data.replaceDisconnected),
  };
}
function command(value: unknown): GameCommand {
  const data = record(value), seq = number(data.seq);
  if (!Number.isSafeInteger(seq) || seq < 0) invalid("Invalid command sequence.");
  let x = Math.max(-1, Math.min(1, number(data.x))), z = Math.max(-1, Math.min(1, number(data.z)));
  const length = Math.hypot(x, z);
  if (length > 1) { x /= length; z /= length; }
  const yaw = number(data.yaw), pitch = number(data.pitch);
  return {
    seq, x, z, yaw: ((yaw + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI,
    pitch: Math.max(-1.5, Math.min(1.5, pitch)),
    jump: boolean(data.jump), fire: boolean(data.fire), fireHeld: boolean(data.fireHeld), respawn: boolean(data.respawn),
    switchTo: data.switchTo === null ? null : member(data.switchTo, Object.keys(WEAPONS) as (keyof typeof WEAPONS)[]),
    railAuto: boolean(data.railAuto), shotgunAuto: boolean(data.shotgunAuto),
  };
}

/** Construct a fresh allowlisted payload; no client object is passed into Game. */
export function parseMessage(value: unknown): ClientMessage {
  const data = record(value);
  switch (data.type) {
    case "create": case "join": {
      if (data.protocol !== LAN_PROTOCOL) throw new ProtocolError("protocol", "Refresh the game: LAN protocol versions differ.");
      const identity = hello(data.hello);
      if (data.type === "create") return { type: "create", protocol: LAN_PROTOCOL, hello: identity, settings: settings(data.settings) };
      const code = text(data.code, 6).toUpperCase();
      if (!/^[A-Z2-9]{6}$/.test(code)) invalid("Room codes contain six letters or digits.");
      const token = data.token === undefined ? undefined : text(data.token, 128);
      return { type: "join", protocol: LAN_PROTOCOL, hello: identity, code, token };
    }
    case "configure": return { type: "configure", settings: settings(data.settings) };
    case "ready": return { type: "ready", ready: boolean(data.ready) };
    case "start": case "lobby": case "leave": return { type: data.type };
    case "idle": return { type: "idle", matchId: text(data.matchId, 100) };
    case "ping": return { type: "ping", at: number(data.at) };
    case "input": {
      if (!Array.isArray(data.commands) || !data.commands.length || data.commands.length > 8) invalid("Send 1–8 commands per batch.");
      const commands = data.commands.map(command);
      if (commands.some((entry, index) => index > 0 && entry.seq <= commands[index - 1].seq)) invalid("Command sequences must increase.");
      return { type: "input", matchId: text(data.matchId, 100), commands };
    }
    default: return invalid("Unknown message type.");
  }
}
