import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { Game, type Actor } from "../../src/game.ts";
import { buildArena } from "../../src/arena.ts";
import { MAP_INFO } from "../../src/maps/catalog.ts";
import type { MapId } from "../../src/maps/types.ts";
import { ArenaMechanisms } from "../../src/mechanisms.ts";
import { STEP, type Power, type WeaponId } from "../../src/rules.ts";
import {
  defaultConfig,
  normalizeConfig,
  type MatchResult,
  type Mode,
} from "../../src/match.ts";

const physicsReady = RAPIER.init();
type PickupKind = "health" | "armor" | "ammo" | WeaponId | Power;
type TestPickup = {
  kind: PickupKind;
  position: THREE.Vector3;
  mesh: THREE.Group;
  readyAt: number;
  objective?: boolean;
};
export type TestProjectile = {
  kind: WeaponId;
  owner: Actor;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  mesh: THREE.Mesh;
  expires: number;
  born: number;
  multiplier: number;
  gravity: number;
  splash: number;
  radius: number;
  stuck: boolean;
  armAt: number;
  detonateAt: number | null;
};

// Run the real Game methods and Rapier arena while omitting only browser-owned
// rendering, DOM input and audio setup. No combat or movement method is replaced.
export type HeadlessGame = Omit<Game, "renderer" | "input" | "sound"> & {
  input: {
    yaw: number;
    pitch: number;
    dead: boolean;
    clear: () => void;
    lockMouse: () => void;
    setWeaponSlots: (...args: unknown[]) => void;
    setActiveWeapon: (...args: unknown[]) => void;
    consume: () => object;
  };
  sound: Record<string, (...args: unknown[]) => void>;
  pickups: TestPickup[];
  objective: TestPickup;
  projectiles: TestProjectile[];
  respawnRequested: boolean;
  suddenAnnounced: boolean;
  createActor: (id: number) => Actor;
  spawn: (actor: Actor, index?: number) => void;
  createPickup: (
    kind: PickupKind,
    position: THREE.Vector3,
    objective?: boolean,
  ) => TestPickup;
  tick: () => void;
  kill: (victim: Actor, attacker: Actor | null) => void;
  shoot: (actor: Actor, aim: THREE.Vector3) => void;
  updateProjectiles: () => void;
  updatePickups: () => void;
  botIntent: (actor: Actor) => object;
  canSee: (actor: Actor, target: Actor) => boolean;
  hurt: (victim: Actor, amount: number, attacker: Actor | null) => void;
  checkEnd: () => void;
  clearEffects: () => void;
};

export async function fixture(
  population = 4,
  mapId: MapId = "ossuary",
  mode: Mode = "ffa",
) {
  await physicsReady;
  const world = new RAPIER.World({ x: 0, y: -20, z: 0 });
  world.timestep = STEP;
  const scene = new THREE.Scene();
  const map = buildArena(scene, world, mapId);
  const sounds: Record<string, number> = {};
  const events: { text: string; kind?: string }[] = [];
  const outcomes: MatchResult[] = [];
  const config = normalizeConfig(
    { ...defaultConfig(mode), population },
    MAP_INFO[map.id].maxPlayers,
  );
  const game = Object.create(Game.prototype) as HeadlessGame;
  Object.assign(game, {
    world,
    scene,
    map,
    mechanisms: new ArenaMechanisms(scene, world, map),
    profile: {
      name: "Test operator",
      settings: { railAuto: true, shotgunAuto: true },
    },
    actors: [],
    colliders: new Map(),
    pickups: [],
    projectiles: [],
    effects: [],
    time: 0,
    lastSecond: 0,
    powerIndex: 0,
    warningIndex: 1,
    difficulty: "Medium",
    config,
    juggernautId: null,
    active: true,
    started: true,
    ended: false,
    respawnRequested: false,
    suddenAnnounced: false,
    input: {
      yaw: 0,
      pitch: 0,
      dead: false,
      clear: () => {},
      lockMouse: () => {},
      setWeaponSlots: () => {},
      setActiveWeapon: () => {},
      consume: () => ({
        x: 0,
        z: 0,
        forwardX: 0,
        forwardZ: -1,
        jump: false,
        fire: false,
        switchTo: null,
      }),
    },
    sound: new Proxy(
      {},
      {
        get: (_, key) => () => {
          sounds[String(key)] = (sounds[String(key)] ?? 0) + 1;
        },
      },
    ),
    onEvent: (text: string, kind?: string) => events.push({ text, kind }),
    onKill: () => {},
    onEnd: (result: MatchResult) => outcomes.push(result),
    // Pause's browser cursor release is outside the simulation under test.
    pause: () => {
      game.active = false;
    },
  });
  game.pickups = map.pickups.map((p) => game.createPickup(p.kind, p.position));
  game.objective = game.createPickup("quad", map.powerPosition, true);
  game.pickups.push(game.objective);
  game.start(config);
  return {
    game,
    sounds,
    events,
    outcomes,
    dispose() {
      game.clearEffects();
      (game as any).clearFlags();
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        mesh.geometry?.dispose();
        const materials = Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material];
        materials.forEach((material) => material?.dispose());
      });
      game.world.free();
    },
  };
}

export function place(
  game: HeadlessGame,
  actor: Actor,
  x: number,
  y: number,
  z: number,
) {
  Object.assign(actor.motion, { x, y, z, vx: 0, vy: 0, vz: 0 });
  actor.body.setTranslation(actor.motion, true);
  actor.body.setNextKinematicTranslation(actor.motion);
}
