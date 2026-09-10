import type * as THREE from "three";
import type { WeaponId } from "../rules";

export type MapId = "ossuary" | "rift" | "bastion" | "conduit" | "crucible" | "reliquary";
export interface FlagLayout {
  bases: [THREE.Vector3, THREE.Vector3];
  neutral: THREE.Vector3;
  teamSpawns: [THREE.Vector3[], THREE.Vector3[]];
}
export interface ArenaMechanism {
  id: string;
  kind: "door" | "platform";
  position: THREE.Vector3;
  size: THREE.Vector3;
  travel: THREE.Vector3;
  /** Round-trip period in seconds for platforms; opening duration for doors. */
  period: number;
  triggerRadius?: number;
}
export type TravelKind = "walk" | "pad" | "teleport" | "drop";
export interface NavNode {
  id: string;
  position: THREE.Vector3;
}
export interface NavEdge {
  from: string;
  to: string;
  kind: TravelKind;
}
export interface JumpPad {
  id: string;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  landing: THREE.Vector3;
  flightTime: number;
}
export interface Teleporter {
  id: string;
  position: THREE.Vector3;
  destination: THREE.Vector3;
  yaw: number;
}
export interface ArenaLayout {
  id: MapId;
  name: string;
  subtitle: string;
  spawns: THREE.Vector3[];
  waypoints: THREE.Vector3[];
  pickups: {
    kind: "health" | "armor" | "ammo" | Exclude<WeaponId, "melee">;
    position: THREE.Vector3;
  }[];
  powerPosition: THREE.Vector3;
  jumpPads: JumpPad[];
  teleporters: Teleporter[];
  nodes: NavNode[];
  edges: NavEdge[];
  killY: number;
  camera: { position: THREE.Vector3; target: THREE.Vector3 };
  flags?: FlagLayout;
  mechanisms?: ArenaMechanism[];
}
