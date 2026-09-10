import type { MatchConfig, MatchResult, Team } from "../match";
import type { MapId } from "../maps/types";
import type { Motion, Power, WeaponId } from "../rules";
import type { CharacterId, CharacterSkinId, WeaponSkinId } from "../cosmetics";
import type { MatchTelemetry } from "../statistics";

export const LAN_PROTOCOL = 1;
export const INPUT_TIMEOUT_MS = 300;
export const RECONNECT_MS = 60_000;
export const SNAPSHOT_HZ = 20;
export type ControllerKind = "human" | "bot" | "empty";
export interface Appearance { character: CharacterId; characterSkin: CharacterSkinId; weaponSkin: WeaponSkinId }
/** One existing 120 Hz physics step. The transport batches commands at 60 Hz. */
export interface GameCommand {
  seq: number;
  x: number; z: number; yaw: number; pitch: number;
  jump: boolean; fire: boolean; fireHeld: boolean; respawn: boolean;
  switchTo: WeaponId | null;
  railAuto: boolean; shotgunAuto: boolean;
}
export const idleCommand = (seq = 0, yaw = 0, pitch = 0): GameCommand => ({
  seq, x: 0, z: 0, yaw, pitch, jump: false, fire: false, fireHeld: false,
  respawn: false, switchTo: null, railAuto: true, shotgunAuto: true,
});
export interface ActorAssignment { id: number; name: string; controller: ControllerKind; appearance?: Appearance }
/** Numeric wire values are finite; use +/-1e9 for time sentinels and -1 for infinite ammo. */
export interface ActorSnapshot extends ActorAssignment {
  motion: Motion; yaw: number; pitch: number; health: number; armor: number;
  weapon: WeaponId; ammo: Record<WeaponId, number>; owned: WeaponId[];
  lastShot: Record<WeaponId, number>; kills: number; deaths: number; captures: number;
  team: Team | null; possession: number; deadAt: number; power: Power | null;
  powerUntil: number; padUntil: number; portalUntil: number;
  ack: number; viewRevision: number; viewYaw: number; viewPitch: number;
  humanKills: number; humanDeaths: number;
  humanTelemetry?: MatchTelemetry;
}
export interface VectorState { x: number; y: number; z: number }
export interface ProjectileSnapshot {
  id: number; kind: WeaponId; ownerId: number; position: VectorState; velocity: VectorState;
  radius: number; stuck: boolean; born: number; expires: number;
}
export interface FlagSnapshot {
  id: Team | "neutral"; team: Team | null; home: VectorState; position: VectorState;
  status: "home" | "carried" | "dropped"; carrierId: number | null; returnAt: number | null;
}
export type GameEvent =
  | { id: number; type: "notice"; text: string; kind?: string; actorId?: number }
  | { id: number; type: "shot"; actorId: number; weapon: WeaponId; origin: VectorState; segments?: VectorState[] }
  | { id: number; type: "hit"; victimId: number; attackerId: number | null; amount: number; point: VectorState }
  | { id: number; type: "kill"; victimId: number; attackerId: number | null }
  | { id: number; type: "impact"; point: VectorState; color: number; radius: number };
export interface GameSnapshot {
  matchId: string; tick: number; time: number; mapId: MapId; config: MatchConfig;
  actors: ActorSnapshot[]; pickups: { kind: string; readyAt: number }[];
  projectiles: ProjectileSnapshot[]; flags: FlagSnapshot[];
  mechanisms: { position: VectorState; openness: number }[];
  juggernautId: number | null; captureScores: [number, number];
  ended: boolean; result: MatchResult | null; events: GameEvent[];
}
export interface RoomSettings { mapId: MapId; config: MatchConfig; fillBots: boolean; replaceDisconnected: boolean }
export interface RoomSlot extends ActorAssignment {
  connected: boolean; ready: boolean; reservedUntil: number | null;
}
export interface RoomState {
  code: string; ownerId: number; phase: "lobby" | "playing" | "results";
  settings: RoomSettings; slots: RoomSlot[]; matchId: string | null; revision: number;
}
export interface Hello { name: string; appearance: Appearance }
export type ClientMessage =
  | { type: "create"; protocol: number; hello: Hello; settings: RoomSettings }
  | { type: "join"; protocol: number; hello: Hello; code: string; token?: string }
  | { type: "configure"; settings: RoomSettings }
  | { type: "ready"; ready: boolean }
  | { type: "start" }
  | { type: "lobby" }
  | { type: "leave" }
  | { type: "input"; matchId: string; commands: GameCommand[] }
  | { type: "idle"; matchId: string }
  | { type: "ping"; at: number };
export type ServerMessage =
  | { type: "welcome"; protocol: number; code: string; token: string; slotId: number; resumed: boolean; room: RoomState }
  | { type: "room"; room: RoomState }
  | { type: "snapshot"; state: GameSnapshot }
  | { type: "error"; code: string; message: string }
  | { type: "pong"; at: number };
export interface ServerInfo { protocol: number; version: string; addresses: string[]; reconnectSeconds: number }
