import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { buildArena } from "./arena";
import { MAP_INFO, supportsMode } from "./maps/catalog";
import {
  FlagMatch,
  FlagVisuals,
  type FlagState,
  type FlagEvent,
} from "./flags";
import { ArenaMechanisms } from "./mechanisms";
import type { ArenaLayout, MapId } from "./maps/types";
import { ArenaNavigator } from "./navigation";
import { JuggernautAura } from "./juggernaut-aura";
import { makeCharacterModel } from "./characters";
import { GoreEffects } from "./gore";
import { CHARACTER_IDS, CHARACTERS, normalizeCosmetics, type CharacterId, type CharacterSkinId } from "./cosmetics";
import { makeWeaponModel, makeWeaponPickup } from "./weapon-models";
import { WeaponSwitchAnimation } from "./weapon-switch";
import {
  STEP,
  HITSCAN_MARGIN,
  WEAPONS,
  WEAPON_ORDER,
  isWeaponId,
  shouldAutoEquipPickup,
  weaponRecord,
  damage,
  land,
  newMotion,
  powerEvent,
  readyToFire,
  stepMotion,
  type Motion,
  type MoveIntent,
  type Power,
  type WeaponId,
} from "./rules";
import { Input } from "./input";
import { getWeaponSlots } from "./weapon-slots";
import { Sound } from "./audio";
import type { Profile } from "./profile";
import { emptyTelemetry, weaponStatistics, type MatchTelemetry } from "./statistics";
import { idleCommand, type ActorAssignment, type Appearance, type ControllerKind, type GameCommand, type GameEvent, type GameSnapshot, type ActorSnapshot } from "./lan/types";

import {
  areEnemies,
  canDamage,
  chooseJuggernaut,
  defaultConfig,
  isFlagMode,
  isTeamMode,
  matchResult,
  normalizeConfig,
  type Difficulty,
  type MatchConfig,
  type MatchResult,
  type Team,
} from "./match";

export type { Difficulty } from "./match";
export interface Actor {
  id: number;
  controlKind: ControllerKind;
  humanKills: number;
  humanDeaths: number;
  humanTelemetry: MatchTelemetry;
  damageContributors: Map<number, { telemetry: MatchTelemetry; at: number }>;
  appearance: Appearance;
  pitch: number;
  ack: number;
  viewRevision: number;
  viewYaw: number;
  viewPitch: number;
  respawnRequested: boolean;
  suspendedHealth?: number;
  name: string;
  characterId: CharacterId;
  footstepAt: number;
  motion: Motion;
  previous: THREE.Vector3;
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  controller: RAPIER.KinematicCharacterController;
  mesh: THREE.Group;
  health: number;
  armor: number;
  weapon: WeaponId;
  ammo: Record<WeaponId, number>;
  owned: Set<WeaponId>;
  lastShot: Record<WeaponId, number>;
  kills: number;
  deaths: number;
  captures: number;
  team: Team | null;
  possession: number;
  difficulty: Difficulty;
  deadAt: number;
  power: Power | null;
  powerUntil: number;
  nextThink: number;
  nextAttack: number;
  target: THREE.Vector3;
  enemy: Actor | null;
  yaw: number;
  padUntil: number;
  portalUntil: number;
}
interface Pickup {
  kind: "health" | "armor" | "ammo" | Power | WeaponId;
  position: THREE.Vector3;
  mesh: THREE.Group;
  readyAt: number;
  objective?: boolean;
}
interface AttackCredit {
  telemetry: MatchTelemetry | null;
  weapon: WeaponId;
  hit: boolean;
}
interface Projectile {
  id: number;
  kind: WeaponId;
  born: number;
  gravity: number;
  splash: number;
  radius: number;
  stuck: boolean;
  armAt: number;
  detonateAt: number | null;
  owner: Actor;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  mesh: THREE.Mesh;
  expires: number;
  multiplier: number;
  credit?: AttackCredit;
}
interface Effect {
  object: THREE.Object3D;
  until: number;
  start: number;
  explosion?: boolean;
}
// Keep the cannon's visible bolt and swept collision volume the same size.
const BFG_PROJECTILE_RADIUS = 0.5;
const BFG_PROJECTILE_SHAPE = new RAPIER.Ball(BFG_PROJECTILE_RADIUS);
const PROJECTILE_ROTATION = { x: 0, y: 0, z: 0, w: 1 };
let matchSequence = 0;
let authorityPhysicsReady: Promise<unknown> | undefined;
const finiteWire = (value: number) => Number.isFinite(value) ? value : value < 0 ? -1e9 : 1e9;
const wireVector = (value: { x: number; y: number; z: number }) => ({ x: value.x, y: value.y, z: value.z });
type PendingGameEvent = GameEvent extends infer Event ? Event extends { id: number } ? Omit<Event, "id"> : never : never;
const BOT_SKILL = {
  Easy: { think: 0.5, aim: 0.105, cadence: 0.32, speed: 0.68, jump: 0.025 },
  Medium: { think: 0.3, aim: 0.065, cadence: 0.2, speed: 0.82, jump: 0.08 },
  Competitive: { think: 0.18, aim: 0.035, cadence: 0.12, speed: 1, jump: 0.15 },
};

export class Game {
  readonly renderer!: THREE.WebGLRenderer;
  private authority = false;
  isReplica = false;
  localActorId: number | null = 0;
  onCommand: ((command: GameCommand) => void) | null = null;
  private assignments = new Map<number, ActorAssignment>();
  private authorityCommands = new Map<number, GameCommand>();
  private simulationTick = 0;
  private nextProjectileId = 0;
  private nextEventId = 0;
  private networkEvents: GameEvent[] = [];
  private result: MatchResult | null = null;
  private commandSequence = 0;
  private pendingCommands: { command: GameCommand; time: number }[] = [];
  private receivedTick = -1;
  private receivedEvent = 0;
  private receivedAt = 0;
  private remoteFrom = new Map<number, THREE.Vector3>();
  private predictionTime = 0;
  private disposedAuthority = false;
  private authorityProjectileMesh = new THREE.Mesh();
  private silentGore = { hit() {}, death() {}, setEnabled() {} };
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(95, 1, 0.08, 180);
  world = new RAPIER.World({ x: 0, y: -20, z: 0 });
  map: ArenaLayout;
  private navigation?: ArenaNavigator;
  private gore?: GoreEffects;
  private heldWeaponTemplates?: Map<WeaponId, THREE.Group>;
  matchId = "";
  private flagApproaches?: WeakMap<
    Actor,
    {
      navigation: ArenaNavigator;
      from: THREE.Vector3;
      goal: THREE.Vector3;
      at: number;
      clear: boolean;
    }
  >;
  private mechanisms?: ArenaMechanisms;
  private flags?: FlagMatch;
  private flagVisuals?: FlagVisuals;
  captureScores: [number, number] = [0, 0];
  get flagStates(): readonly FlagState[] {
    return this.flags?.states ?? [];
  }
  readonly input: Input;
  readonly sound = new Sound();
  readonly actors: Actor[] = [];
  player!: Actor;
  active = false;
  started = false;
  ended = false;
  time = 0;
  difficulty: Difficulty = "Medium";
  config: MatchConfig = defaultConfig();
  juggernautId: number | null = null;
  fps = 0;
  frameMs = 0;
  lowFps = 0;
  drawCalls = 0;
  triangles = 0;
  onEvent: (text: string, kind?: string) => void = () => {};
  onKill: (killer: Actor | null, victim: Actor) => void = () => {};
  onEnd: (result: MatchResult) => void = () => {};
  onUpdate = () => {};
  onFrame = () => {};
  onPause = () => {};
  private colliders = new Map<number, Actor>();
  private pickups: Pickup[] = [];
  private projectiles: Projectile[] = [];
  private effects: Effect[] = [];
  private powerIndex = 0;
  private warningIndex = 1;
  private objective: Pickup;
  private accumulator = 0;
  private lastFrame = 0;
  private hudAt = 0;
  private frameSamples: number[] = [];
  private viewScene = new THREE.Scene();
  private viewCamera = new THREE.PerspectiveCamera(60, 1, 0.01, 10);
  private gun = new THREE.Group();
  private gunModels = new Map<WeaponId, THREE.Group>();
  private weaponSwitch = new WeaponSwitchAnimation();
  private recoil = 0;
  private muzzle!: THREE.Mesh;
  private muzzleUntil = 0;
  private respawnRequested = false;
  private deathLook = 0;
  private lastSecond = 0;
  private suddenAnnounced = false;
  constructor(
    canvas: HTMLCanvasElement | null,
    readonly profile: Profile,
    options: { authority?: boolean; mapId?: MapId } = {},
  ) {
    this.authority = options.authority === true;
    this.localActorId = this.authority ? null : 0;
    this.world.timestep = STEP;
    this.map = buildArena(this.scene, this.world, options.mapId);
    this.mechanisms = new ArenaMechanisms(this.scene, this.world, this.map);
    this.input = new Input(canvas, profile.settings);
    this.input.setWeaponSlots(getWeaponSlots(this.map.pickups));
    this.input.onPause = () => this.onPause();
    this.input.onRespawn = () => { this.respawnRequested = true; };
    this.input.onGesture = () => this.sound.unlock();
    this.pickups = this.map.pickups.map((p) => this.createPickup(p.kind, p.position));
    this.objective = this.createPickup("quad", this.map.powerPosition, true);
    this.pickups.push(this.objective);
    if (!canvas) return;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
      alpha: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.renderer.info.autoReset = false;
    this.viewScene.add(new THREE.HemisphereLight(0xd3e1f2, 0x341410, 3));
    const gunLight = new THREE.DirectionalLight(0xff9165, 5);
    gunLight.position.set(-2, 3, 2);
    this.viewScene.add(gunLight);
    this.gun.position.set(0.32, -0.28, -0.6);
    this.gun.scale.setScalar(0.72);
    this.viewScene.add(this.gun);
    for (const id of WEAPON_ORDER) {
      const model = this.makeGun(id);
      this.gunModels.set(id, model);
      this.gun.add(model);
    }
    this.muzzle = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.09, 0),
      new THREE.MeshBasicMaterial({ color: 0xffd894 }),
    );
    this.muzzle.position.set(0.32, -0.25, -0.99);
    this.viewScene.add(this.muzzle);
    window.addEventListener("resize", () => this.resize());
    this.applySettings();
    this.renderer.setAnimationLoop((time) => this.frame(time));
  }
  static async createAuthority(options: { mapId: MapId; config: MatchConfig; roster: ActorAssignment[]; matchId: string }): Promise<Game> {
    await (authorityPhysicsReady ??= RAPIER.init());
    const profile: Profile = {
      name: "Server",
      settings: { sensitivity: 1, fov: 95, railAuto: true, shotgunAuto: true, volume: 0, resolution: 1, crosshair: "cross", crosshairColor: "#ffffff", gore: false },
      stats: { matches: 0, wins: 0, kills: 0, deaths: 0, tournaments: 0, tournamentWins: 0, tournamentDraws: 0 },
    };
    const game = new Game(null, profile, { authority: true, mapId: options.mapId });
    for (const assignment of options.roster) game.assignments.set(assignment.id, { ...assignment });
    game.start(options.config);
    game.matchId = options.matchId;
    return game;
  }
  stepAuthority(commands: Map<number, GameCommand>): void {
    if (!this.authority || this.disposedAuthority || !this.active || this.ended) return;
    this.authorityCommands = commands;
    this.tick();
  }
  startReplica(snapshot: GameSnapshot, localActorId: number): void {
    this.stopReplica();
    this.active = false;
    this.selectMap(snapshot.mapId);
    this.localActorId = localActorId;
    this.assignments = new Map(snapshot.actors.map((actor) => [actor.id, actor]));
    this.isReplica = true;
    this.start(snapshot.config);
    this.matchId = snapshot.matchId;
    this.commandSequence = snapshot.actors.find((actor) => actor.id === localActorId)?.ack ?? 0;
    this.applySnapshot(snapshot);
  }
  applySnapshot(snapshot: GameSnapshot): void {
    if (!this.isReplica || snapshot.matchId !== this.matchId || snapshot.tick <= this.receivedTick) return;
    const first = this.receivedTick < 0;
    this.receivedTick = snapshot.tick;
    this.receivedAt = performance.now() / 1000;
    const endedBefore = this.ended;
    this.time = snapshot.time;
    this.config = snapshot.config;
    this.simulationTick = snapshot.tick;
    this.juggernautId = snapshot.juggernautId;
    this.captureScores = [...snapshot.captureScores];
    const movementAudio: { actor: Actor; kind: "jump" | "land" | "step" }[] = [];
    for (const state of snapshot.actors) {
      const actor = this.actors.find((candidate) => candidate.id === state.id);
      if (!actor) continue;
      const oldRevision = actor.viewRevision;
      const wasGrounded = actor.motion.grounded;
      const wasAlive = actor.health > 0;
      const oldPosition = new THREE.Vector3(actor.motion.x, actor.motion.y, actor.motion.z);
      this.remoteFrom.set(actor.id, first ? new THREE.Vector3(state.motion.x, state.motion.y, state.motion.z) : actor.mesh.position.clone());
      if (state.appearance && JSON.stringify(actor.appearance) !== JSON.stringify(state.appearance)) {
        actor.appearance = { ...state.appearance };
        actor.characterId = state.appearance.character;
        if (!this.authority) {
          const old = actor.mesh;
          const mesh = this.makeDemon(actor.characterId, actor.appearance.characterSkin, state.team === null ? undefined : snapshot.config.teamColors[state.team]);
          const held = old.getObjectByName("held-weapons");
          if (held) {
            old.remove(held);
            // Original finishes share immutable arena templates; custom finishes
            // belong to this actor and are released when their appearance changes.
            held.children.forEach((model) => { if (!model.userData.sharedHeld) this.disposeVisual(model); });
          }
          if (!this.isLocal(actor)) mesh.add(this.makeHeldWeapons(actor.appearance, state.weapon));
          mesh.userData.heldWeapon = state.weapon;
          mesh.position.copy(old.position);
          this.scene.remove(old);
          this.disposeVisual(old);
          this.scene.add(mesh);
          actor.mesh = mesh;
        }
      }
      actor.name = state.name;
      actor.controlKind = state.controller;
      actor.motion = { ...state.motion };
      actor.yaw = state.yaw;
      actor.pitch = state.pitch;
      actor.health = state.health;
      actor.armor = state.armor;
      actor.weapon = state.weapon;
      actor.ammo = weaponRecord((id) => state.ammo[id] === -1 ? Infinity : state.ammo[id]);
      actor.owned = new Set(state.owned);
      actor.lastShot = { ...state.lastShot };
      actor.kills = state.kills;
      actor.deaths = state.deaths;
      actor.humanKills = state.humanKills;
      actor.humanDeaths = state.humanDeaths;
      if (state.humanTelemetry) actor.humanTelemetry = state.humanTelemetry;
      actor.captures = state.captures;
      actor.team = state.team;
      actor.possession = state.possession;
      actor.deadAt = state.deadAt;
      actor.power = state.power;
      actor.powerUntil = state.powerUntil;
      actor.padUntil = state.padUntil;
      actor.portalUntil = state.portalUntil;
      actor.ack = state.ack;
      actor.viewRevision = state.viewRevision;
      actor.viewYaw = state.viewYaw ?? state.yaw;
      actor.viewPitch = state.viewPitch ?? state.pitch;
      actor.body.setTranslation(actor.motion, true);
      actor.body.setNextKinematicTranslation(actor.motion);
      actor.collider.setEnabled(actor.health > 0 && actor.controlKind !== "empty");
      actor.mesh.visible = !this.isLocal(actor) && actor.health > 0 && actor.controlKind !== "empty";
      actor.previous.copy(oldPosition);
      if (!first && !this.isLocal(actor) && wasAlive && actor.health > 0 && oldRevision === state.viewRevision) {
        if (wasGrounded && !actor.motion.grounded && actor.motion.vy > 0) movementAudio.push({ actor, kind: "jump" });
        if (!wasGrounded && actor.motion.grounded && this.time > actor.deadAt + .5) movementAudio.push({ actor, kind: "land" });
        if (actor.motion.grounded && Math.hypot(actor.motion.vx, actor.motion.vz) > 2.5 && this.time >= actor.footstepAt) {
          movementAudio.push({ actor, kind: "step" });
          actor.footstepAt = this.time + .32;
        }
      }
      if (this.isLocal(actor)) {
        this.player = actor;
        this.commandSequence = Math.max(this.commandSequence, state.ack);
        this.pendingCommands = this.pendingCommands.filter((pending) => pending.command.seq > state.ack);
        const resetView = first || oldRevision !== state.viewRevision;
        if (resetView) {
          this.input.yaw = first ? state.yaw : actor.viewYaw;
          this.input.pitch = first ? state.pitch : actor.viewPitch;
          this.pendingCommands = [];
          this.input.clear();
        }
        if (actor.health <= 0) this.pendingCommands = [];
        this.input.dead = actor.health <= 0;
        if (first || (!wasAlive && actor.health > 0)) this.weaponSwitch?.reset(actor.weapon);
      }
    }
    for (const { actor, kind } of movementAudio) {
      if (kind === "step") this.sound.footstep(actor.characterId, ...this.audioAt(actor));
      else this.sound.character(kind, actor.characterId, ...this.audioAt(actor));
    }
    this.pickups.forEach((pickup, index) => {
      const state = snapshot.pickups[index];
      if (!state) return;
      const changed = pickup.kind !== state.kind;
      pickup.kind = state.kind as Pickup["kind"];
      pickup.readyAt = state.readyAt;
      if (changed && pickup.objective) pickup.mesh.traverse((object) => {
        const material = (object as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
        if (material?.color) { material.color.set(state.kind === "quad" ? 0xff6d3e : 0x76a8ff); material.emissive?.copy(material.color); }
      });
    });
    this.flags?.states.forEach((flag) => {
      const state = snapshot.flags.find((candidate) => candidate.id === flag.id);
      if (state) { flag.position.copy(state.position); flag.home.copy(state.home); flag.status = state.status; flag.carrierId = state.carrierId; flag.returnAt = state.returnAt; }
    });
    this.mechanisms?.parts.forEach((part, index) => {
      const state = snapshot.mechanisms[index];
      if (state) { part.position.copy(state.position); part.openness = state.openness; part.delta.set(0, 0, 0); part.collider.setTranslation(part.position); part.mesh.position.copy(part.position); }
    });
    const projectileIds = new Set(snapshot.projectiles.map((projectile) => projectile.id));
    for (const projectile of [...this.projectiles]) if (!projectileIds.has(projectile.id)) this.removeProjectile(projectile);
    for (const state of snapshot.projectiles) {
      let projectile = this.projectiles.find((candidate) => candidate.id === state.id);
      if (!projectile) {
        const owner = this.actors.find((actor) => actor.id === state.ownerId);
        if (!owner) continue;
        const mesh = new THREE.Mesh(
          state.kind === "proximity" ? new THREE.CylinderGeometry(.17, .22, .1, 6) : new THREE.IcosahedronGeometry(state.kind === "bfg" ? BFG_PROJECTILE_RADIUS : state.kind === "nailgun" ? .045 : .12, 0),
          new THREE.MeshBasicMaterial({ color: WEAPONS[state.kind].color }),
        );
        if (state.kind === "nailgun") mesh.scale.set(1, 1, 3.5);
        this.scene.add(mesh);
        projectile = { ...state, owner, position: new THREE.Vector3(), velocity: new THREE.Vector3(), mesh, gravity: 0, splash: 0, armAt: Infinity, detonateAt: null, multiplier: 1 };
        this.projectiles.push(projectile);
      }
      projectile.position.copy(state.position);
      projectile.velocity.copy(state.velocity);
      projectile.stuck = state.stuck;
      projectile.mesh.position.copy(state.position);
      if (state.velocity.x || state.velocity.y || state.velocity.z) projectile.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), projectile.velocity.clone().normalize());
    }
    this.world.step();
    const serverTime = this.time;
    for (const pending of this.pendingCommands) this.predictMovement(pending.command, pending.time);
    this.time = serverTime;
    this.predictionTime = snapshot.time + this.pendingCommands.length * STEP;
    if (this.player) {
      this.player.previous.set(this.player.motion.x, this.player.motion.y, this.player.motion.z);
      this.input.setActiveWeapon(this.player.weapon);
    }
    for (const event of snapshot.events) {
      if (event.id <= this.receivedEvent) continue;
      this.receivedEvent = event.id;
      this.playNetworkEvent(event);
    }
    this.ended = snapshot.ended;
    this.result = snapshot.result;
    if (this.ended && !endedBefore) {
      this.pause();
      if (snapshot.result) this.onEnd(snapshot.result);
    }
  }
  stopReplica(): void {
    this.isReplica = false;
    this.active = false;
    this.input.clear();
    this.pendingCommands = [];
    this.receivedTick = -1;
    this.receivedEvent = 0;
    this.remoteFrom.clear();
    this.assignments.clear();
    this.localActorId = 0;
  }
  private predictTick(): void {
    if (!this.player || this.ended) return;
    const controls = this.input.consume();
    const command: GameCommand = { ...controls, seq: ++this.commandSequence,
      yaw: this.input.yaw, pitch: this.input.pitch, respawn: this.respawnRequested,
      railAuto: this.profile.settings.railAuto, shotgunAuto: this.profile.settings.shotgunAuto !== false };
    this.respawnRequested = false;
    this.predictionTime += STEP;
    this.time += STEP;
    this.player.previous.set(this.player.motion.x, this.player.motion.y, this.player.motion.z);
    this.predictMovement(command, this.predictionTime, false);
    this.pendingCommands.push({ command, time: this.predictionTime });
    if (this.pendingCommands.length > 240) this.pendingCommands.shift();
    this.onCommand?.(command);
    this.gore?.update(this.time, STEP);
  }
  private predictMovement(command: GameCommand, at: number, replay = true): void {
    const actor = this.player;
    if (!actor || actor.health <= 0 || actor.controlKind !== "human") return;
    if (command.switchTo && actor.owned.has(command.switchTo)) actor.weapon = command.switchTo;
    actor.yaw = command.yaw;
    actor.pitch = command.pitch;
    const savedTime = this.time;
    this.time = at;
    this.mechanisms?.begin(this.actors, at, STEP);
    this.advanceActor(actor, { ...command, forwardX: -Math.sin(command.yaw), forwardZ: -Math.cos(command.yaw) }, true, replay);
    this.world.step();
    this.time = savedTime;
  }
  private playNetworkEvent(event: GameEvent): void {
    if (event.type === "notice") { this.notice(event.text, event.kind, event.actorId); return; }
    if (event.type === "impact") { this.puff(new THREE.Vector3().copy(event.point), event.color, event.radius); return; }
    if (event.type === "shot") {
      const actor = this.actors.find((candidate) => candidate.id === event.actorId);
      if (!actor) return;
      this.sound.shot(event.weapon, !this.isLocal(actor));
      if (this.isLocal(actor)) { this.recoil = event.weapon === "melee" ? .18 : event.weapon === "rail" ? .11 : event.weapon === "rocket" || event.weapon === "bfg" ? .14 : .035; this.muzzleUntil = this.time + .045; }
      if (event.segments?.length) {
        const object = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(event.segments.map((point) => new THREE.Vector3().copy(point))), new THREE.LineBasicMaterial({ color: event.weapon === "rail" ? "#7effe7" : WEAPONS[event.weapon].color, transparent: true, opacity: .8 }));
        this.scene.add(object);
        this.effects.push({ object, start: this.time, until: this.time + (event.weapon === "rail" ? .3 : .08) });
      }
      return;
    }
    const victim = this.actors.find((actor) => actor.id === event.victimId);
    const attacker = this.actors.find((actor) => actor.id === event.attackerId) ?? null;
    if (!victim) return;
    if (event.type === "hit") {
      if (attacker && this.isLocal(attacker) && attacker !== victim) { this.sound.hit(); this.onEvent("", "hit"); }
      if (this.isLocal(victim)) { this.sound.hurt(); this.onEvent("", "hurt"); }
      this.goreEffects().hit(new THREE.Vector3().copy(event.point), new THREE.Vector3(0, 1, 0), event.amount, this.time);
      this.sound.character("hurt", victim.characterId, ...this.audioAt(victim));
    } else {
      if (this.isLocal(victim)) { this.input.clear(); this.deathLook = this.input.yaw; this.sound.kill(); }
      this.goreEffects().death(new THREE.Vector3(victim.motion.x, victim.motion.y, victim.motion.z), new THREE.Vector3(0, 1, 0), this.time);
      this.sound.character("death", victim.characterId, ...this.audioAt(victim));
      this.onKill(attacker, victim);
    }
  }
  setController(assignment: ActorAssignment, resetHumanStats = false): void {
    this.assignments.set(assignment.id, { ...assignment });
    const actor = this.actors.find((candidate) => candidate.id === assignment.id);
    if (!actor) return;
    if (assignment.controller === "empty" && actor.controlKind !== "empty") {
      actor.suspendedHealth = actor.health;
      actor.health = 0;
      actor.collider.setEnabled(false);
      this.dropCarriedFlag(actor);
    } else if (actor.controlKind === "empty" && assignment.controller !== "empty") {
      actor.health = actor.suspendedHealth ?? 125;
      actor.suspendedHealth = undefined;
      actor.collider.setEnabled(actor.health > 0);
    }
    if (resetHumanStats) {
      actor.humanKills = actor.humanDeaths = 0;
      actor.humanTelemetry = emptyTelemetry();
    }
    actor.name = assignment.name;
    actor.controlKind = assignment.controller;
    actor.respawnRequested = false;
    actor.enemy = null;
    actor.nextThink = this.time;
    if (assignment.appearance) actor.appearance = { ...assignment.appearance };
    actor.characterId = actor.appearance.character;
    actor.mesh.visible = actor.controlKind !== "empty" && actor.health > 0 && !this.isLocal(actor);
    this.navigation?.reset(actor.id);
  }
  snapshot(): GameSnapshot {
    const actors: ActorSnapshot[] = this.actors.map((actor) => ({
      id: actor.id, name: actor.name, controller: actor.controlKind, appearance: { ...actor.appearance },
      motion: Object.fromEntries(Object.entries(actor.motion).map(([key, value]) => [key, typeof value === "number" ? finiteWire(value) : value])) as unknown as Motion,
      yaw: actor.yaw, pitch: actor.pitch, health: actor.health, armor: actor.armor,
      weapon: actor.weapon, ammo: weaponRecord((id) => actor.ammo[id] === Infinity ? -1 : actor.ammo[id]), owned: [...actor.owned],
      lastShot: weaponRecord((id) => finiteWire(actor.lastShot[id])), kills: actor.kills, deaths: actor.deaths,
      captures: actor.captures, humanKills: actor.humanKills, humanDeaths: actor.humanDeaths, team: actor.team, possession: actor.possession, deadAt: finiteWire(actor.deadAt),
      humanTelemetry: structuredClone(actor.humanTelemetry),
      power: actor.power, powerUntil: actor.powerUntil, padUntil: actor.padUntil, portalUntil: actor.portalUntil,
      ack: actor.ack, viewRevision: actor.viewRevision, viewYaw: actor.viewYaw ?? actor.yaw, viewPitch: actor.viewPitch ?? actor.pitch,
    }));
    return {
      matchId: this.matchId, tick: this.simulationTick, time: this.time, mapId: this.map.id,
      config: structuredClone(this.config), actors,
      pickups: this.pickups.map((pickup) => ({ kind: pickup.kind, readyAt: finiteWire(pickup.readyAt) })),
      projectiles: this.projectiles.map((projectile) => ({ id: projectile.id, kind: projectile.kind, ownerId: projectile.owner.id,
        position: wireVector(projectile.position), velocity: wireVector(projectile.velocity), radius: projectile.radius,
        stuck: projectile.stuck, born: projectile.born, expires: projectile.expires })),
      flags: this.flagStates.map((flag) => ({ ...flag, home: wireVector(flag.home), position: wireVector(flag.position) })),
      mechanisms: this.mechanisms?.parts.map((part) => ({ position: wireVector(part.position), openness: part.openness })) ?? [],
      juggernautId: this.juggernautId, captureScores: [...this.captureScores], ended: this.ended,
      result: this.result ? { ...this.result } : null, events: this.networkEvents.splice(0),
    };
  }
  disposeAuthority(): void {
    if (this.disposedAuthority) return;
    this.disposedAuthority = true;
    this.active = false;
    this.clearEffects();
    this.clearFlags();
    this.disposeActors();
    const textures = new Set<THREE.Texture>();
    this.scene.traverse((object) => {
      const material = (object as THREE.Mesh).material;
      for (const entry of Array.isArray(material) ? material : material ? [material] : []) {
        const map = (entry as THREE.MeshStandardMaterial).map;
        if (map) textures.add(map);
      }
    });
    this.disposeVisual(this.scene);
    textures.forEach((texture) => texture.dispose());
    this.authorityProjectileMesh.geometry.dispose();
    (this.authorityProjectileMesh.material as THREE.Material).dispose();
    this.scene.clear();
    this.world.free();
    this.networkEvents = [];
    this.authorityCommands.clear();
  }
  private isLocal(actor: Actor): boolean {
    return this.localActorId !== null && actor.id === (this.localActorId ?? 0);
  }
  private isHuman(actor: Actor): boolean {
    return actor.controlKind === "human" || (!actor.controlKind && actor.id === 0);
  }
  private emit(event: PendingGameEvent): void {
    if (this.authority) {
      this.networkEvents.push({ ...event, id: ++this.nextEventId } as GameEvent);
      if (this.networkEvents.length > 512) this.networkEvents.shift();
    }
  }
  private notice(text: string, kind?: string, actorId?: number): void {
    if (this.authority) this.emit({ type: "notice", text, ...(kind === undefined ? {} : { kind }), ...(actorId === undefined ? {} : { actorId }) });
    else if (actorId === undefined || actorId === (this.localActorId ?? 0)) this.onEvent(text, kind);
  }
  selectMap(id: MapId) {
    if (this.active || this.map.id === id) return;
    this.clearEffects();
    this.gore?.dispose();
    this.gore = undefined;
    this.clearFlags();
    this.disposeActors();
    const geometries = new Set<THREE.BufferGeometry>(),
      materials = new Set<THREE.Material>(),
      textures = new Set<THREE.Texture>();
    this.scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.geometry) geometries.add(mesh.geometry);
      const list = Array.isArray(mesh.material)
        ? mesh.material
        : mesh.material
          ? [mesh.material]
          : [];
      list.forEach((material) => {
        materials.add(material);
        const texture = (material as THREE.MeshStandardMaterial).map;
        if (texture) textures.add(texture);
      });
    });
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    textures.forEach((t) => t.dispose());
    this.scene.clear();
    this.world.free();
    this.world = new RAPIER.World({ x: 0, y: -20, z: 0 });
    this.world.timestep = STEP;
    this.actors.length = 0;
    this.colliders.clear();
    this.navigation = undefined;
    this.juggernautId = null;
    this.map = buildArena(this.scene, this.world, id);
    this.mechanisms = new ArenaMechanisms(this.scene, this.world, this.map);
    this.input.setWeaponSlots(getWeaponSlots(this.map.pickups));
    this.pickups = this.map.pickups.map((p) =>
      this.createPickup(p.kind, p.position),
    );
    this.objective = this.createPickup("quad", this.map.powerPosition, true);
    this.pickups.push(this.objective);
    this.started = false;
    this.ended = false;
    this.time = 0;
    this.world.step();
  }
  applySettings() {
    if (this.authority) return;
    this.camera.fov = this.profile.settings.fov;
    this.camera.updateProjectionMatrix();
    this.sound.volume = this.profile.settings.volume;
    this.gore?.setEnabled(this.profile.settings.gore !== false);
    // Fixed, user-selected resolution. Never adapt quality to FPS or inferred temperature.
    this.renderer.setPixelRatio(
      Math.min(devicePixelRatio, 2) * this.profile.settings.resolution,
    );
    this.resize();
  }
  /** Rebuild only appearance; live actor motion, inventory and collision stay intact. */
  applyCosmetics() {
    if (this.profile.cosmetics)
      Object.assign(this.profile.cosmetics, normalizeCosmetics(this.profile.cosmetics));
    else this.profile.cosmetics = normalizeCosmetics(null);
    const equipped = this.profile.cosmetics;
    if (this.player && this.actors.includes(this.player)) {
      const old = this.player.mesh;
      const mesh = this.makeDemon(equipped.character, equipped.characterSkin,
        this.player.team === null ? undefined : this.config.teamColors[this.player.team]);
      mesh.position.copy(old.position);
      mesh.quaternion.copy(old.quaternion);
      mesh.visible = old.visible;
      this.scene.remove(old);
      this.disposeVisual(old);
      this.scene.add(mesh);
      this.player.mesh = mesh;
      this.player.characterId = equipped.character;
    }
    if (this.gunModels?.size) {
      for (const [id, old] of this.gunModels) {
        this.gun.remove(old);
        this.disposeVisual(old);
        const model = makeWeaponModel(id, equipped.weaponSkin);
        this.gunModels.set(id, model);
        this.gun.add(model);
      }
    }
  }
  private disposeVisual(group: THREE.Object3D) {
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    group.traverse(object => {
      const mesh = object as THREE.Mesh;
      if (mesh.geometry) geometries.add(mesh.geometry);
      const list = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
      list.forEach(material => materials.add(material));
    });
    geometries.forEach(geometry => geometry.dispose());
    materials.forEach(material => material.dispose());
  }
  private audioAt(actor: Actor): [number, number] {
    if (!this.player || this.isLocal(actor)) return [0, 0];
    const dx = actor.motion.x - this.player.motion.x;
    const dz = actor.motion.z - this.player.motion.z;
    const distance = Math.hypot(dx, actor.motion.y - this.player.motion.y, dz);
    const yaw = this.input.yaw;
    return [distance, Math.max(-1, Math.min(1, (dx * Math.cos(yaw) - dz * Math.sin(yaw)) / Math.max(1, distance)))];
  }
  private goreEffects() {
    if (this.authority) return this.silentGore;
    const effects = (this.gore ??= new GoreEffects(this.scene, this.world));
    effects.setEnabled(this.profile.settings.gore !== false);
    return effects;
  }
  private resize() {
    this.renderer.setSize(innerWidth, innerHeight);
    this.camera.aspect = this.viewCamera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.viewCamera.updateProjectionMatrix();
  }
  start(config: MatchConfig | Difficulty = this.config) {
    const requested =
      typeof config === "string"
        ? { ...defaultConfig(), botDifficulties: Array(7).fill(config) }
        : config;
    const normalized = normalizeConfig(
      requested,
      MAP_INFO[this.map.id].maxPlayers,
    );
    if (
      !supportsMode(this.map.id, normalized.mode) ||
      (isFlagMode(normalized.mode) && !this.map.flags)
    )
      throw new Error(
        `${this.map.name} does not support ${normalized.mode}. Choose a compatible arena.`,
      );
    this.config = normalized;
    // Allocate cosmetic pools before play; hits only reuse their private state.
    this.goreEffects();
    this.matchId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID() : `local-${Date.now()}-${++matchSequence}`;
    this.difficulty = this.config.botDifficulties[0] ?? "Competitive";
    this.time = 0;
    this.simulationTick = 0;
    this.result = null;
    this.nextProjectileId = 0;
    this.lastSecond = 0;
    this.powerIndex = 0;
    this.warningIndex = 1;
    this.ended = false;
    this.started = true;
    this.suddenAnnounced = false;
    this.respawnRequested = false;
    this.clearEffects();
    this.clearFlags();
    this.mechanisms?.reset();
    this.disposeActors();
    this.prepareHeldWeapons();
    this.juggernautId = null;
    for (let i = 0; i < this.config.population; i++)
      this.actors.push(this.createActor(i));
    this.player = this.actors.find((actor) => this.isLocal(actor)) ?? this.actors[0];
    this.actors.forEach((actor, i) => this.spawn(actor, i));
    if (!this.authority) this.player.name = this.profile.name;
    if (isFlagMode(this.config.mode) && this.map.flags) {
      this.flags = new FlagMatch(this.config.mode, this.map.flags);
      this.captureScores = this.flags.scores;
      if (!this.authority) this.flagVisuals = new FlagVisuals(
        this.scene,
        this.flags.states,
        this.config.teamColors,
        this.map.flags,
      );
    }
    this.pickups.forEach((p) => {
      p.readyAt = p.objective ? Infinity : 0;
      p.mesh.visible = !p.objective;
    });
    this.world.step();
    this.resume();
    this.notice(this.map.name.toUpperCase(), "location");
    if (this.config.mode === "juggernaut")
      this.assignJuggernaut(chooseJuggernaut(this.actors));
  }
  pause() {
    this.active = false;
    this.input.enabled = false;
    this.input.clear();
    if (typeof document !== "undefined" && document.pointerLockElement) document.exitPointerLock();
  }
  resume() {
    this.active = true;
    this.accumulator = 0;
    this.input.clear();
    this.input.enabled = true;
    this.input.dead = this.player?.health <= 0;
    if (!this.authority && typeof window !== "undefined") { this.sound.unlock(); this.input.lockMouse(); }
  }
  toMenu() {
    if (this.isReplica) this.stopReplica();
    this.pause();
    this.started = false;
    this.clearEffects();
    this.clearFlags();
  }
  private clearFlags() {
    this.flagVisuals?.dispose();
    this.flagVisuals = undefined;
    this.flags = undefined;
    this.captureScores = [0, 0];
  }
  private flagEvents(events: readonly FlagEvent[]) {
    for (const event of events) {
      const actor = this.actors.find(
        (candidate) => candidate.id === event.actorId,
      );
      const label =
        event.flag === "neutral"
          ? "NEUTRAL FLAG"
          : `TEAM ${event.flag === 0 ? "I" : "II"} FLAG`;
      if (event.type === "capture") {
        if (actor) {
          actor.captures++;
          if (this.isHuman(actor)) actor.humanTelemetry.captures++;
        }
        this.notice(`TEAM ${event.team === 0 ? "I" : "II"} CAPTURES`, "flag");
        this.sound.tone(440, 0.35, 0.15, 880, "triangle");
      } else if (event.type === "pickup")
        this.notice(`${actor?.name ?? "OPERATOR"} TOOK ${label}`, "flag");
      else {
        if (event.type === "return" && actor && this.isHuman(actor)) actor.humanTelemetry.returns++;
        this.notice(
          `${label} ${event.type === "drop" ? "DROPPED" : "RETURNED"}`,
          "flag",
        );
      }
    }
  }
  switchWeapon(id: WeaponId) {
    if (!this.player || !this.player.owned.has(id) || this.player.health <= 0)
      return;
    this.equipWeapon(this.player, id);
  }
  private equipWeapon(actor: Actor, id: WeaponId) {
    if (actor.weapon === id) return;
    actor.weapon = id;
    if (this.isLocal(actor)) {
      this.input.setActiveWeapon(id);
      this.recoil = 0.05;
    }
  }
  private disposeActors() {
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    for (const actor of this.actors) {
      this.scene.remove(actor.mesh);
      actor.mesh.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.geometry) geometries.add(mesh.geometry);
        const list = Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material];
        list.forEach((material) => {
          if (material) materials.add(material);
        });
      });
      this.world.removeCharacterController(actor.controller);
      this.world.removeRigidBody(actor.body);
      this.navigation?.reset(actor.id);
    }
    for (const template of this.heldWeaponTemplates?.values() ?? []) {
      template.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.geometry) geometries.add(mesh.geometry);
        const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        list.forEach((material) => { if (material) materials.add(material); });
      });
    }
    this.heldWeaponTemplates?.clear();
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    this.actors.length = 0;
    this.colliders.clear();
  }
  private prepareHeldWeapons() {
    if (this.authority) return;
    // At most five unique geometry/material sources per arena. Bot groups share
    // these immutable resources; rendering never builds models or consumes RNG.
    const templates = (this.heldWeaponTemplates ??= new Map());
    for (const id of getWeaponSlots(this.map.pickups)) {
      const model = makeWeaponModel(id);
      model.name = `held-${id}`;
      model.userData.weapon = id;
      templates.set(id, model);
    }
  }
  private makeHeldWeapons(appearance: Appearance, selected: WeaponId = "machinegun"): THREE.Group {
    const held = new THREE.Group();
    held.name = "held-weapons";
    held.scale.setScalar(.7);
    held.position.set(.31, -.02, -.24);
    for (const [weapon, source] of this.heldWeaponTemplates ?? []) {
      const shared = appearance.weaponSkin === "original";
      const model = shared ? source.clone(true) : makeWeaponModel(weapon, appearance.weaponSkin);
      model.name = `held-${weapon}`;
      model.userData.weapon = weapon;
      model.userData.sharedHeld = shared;
      model.visible = weapon === selected;
      held.add(model);
    }
    return held;
  }
  private assignJuggernaut(id: number | null) {
    if (this.juggernautId === id) return;
    this.juggernautId = id;
    this.actors.forEach((actor) => {
      actor.nextThink = this.time;
    });
    const holder = this.actors.find((actor) => actor.id === id);
    if (holder)
      this.notice(
        this.isLocal(holder)
          ? "YOU ARE THE JUGGERNAUT"
          : `${holder.name} IS THE JUGGERNAUT`,
        "juggernaut",
      );
  }
  private createActor(id: number): Actor {
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased(),
    );
    const collider = this.world.createCollider(
      RAPIER.ColliderDesc.capsule(0.5, 0.35),
      body,
    );
    const controller = this.world.createCharacterController(0.015);
    controller.setMaxSlopeClimbAngle(Math.PI / 3);
    controller.setMinSlopeSlideAngle(Math.PI / 3);
    controller.enableAutostep(0.28, 0.3, false);
    controller.enableSnapToGround(0.16);
    const assignment = this.assignments?.get(id);
    const controllerKind = assignment?.controller ?? (this.authority ? "empty" : id === 0 ? "human" : "bot");
    const equipped = normalizeCosmetics(this.profile.cosmetics);
    const appearance: Appearance = assignment?.appearance ?? { character: id === 0 ? equipped.character : CHARACTER_IDS[id % CHARACTER_IDS.length], characterSkin: id === 0 ? equipped.characterSkin : "original", weaponSkin: id === 0 ? equipped.weaponSkin : "original" };
    const characterId = appearance.character;
    const mesh = this.makeDemon(characterId, appearance.characterSkin);
    if (!this.authority && id !== (this.localActorId ?? 0)) {
      mesh.add(this.makeHeldWeapons(appearance));
      mesh.userData.heldWeapon = "machinegun";
    }
    this.scene.add(mesh);
    mesh.visible = id !== this.localActorId && controllerKind !== "empty";
    const actor: Actor = {
      id, controlKind: controllerKind, humanKills: 0, humanDeaths: 0, appearance, pitch: 0, ack: 0, viewRevision: 0, viewYaw: 0, viewPitch: 0, respawnRequested: false,
      humanTelemetry: emptyTelemetry(), damageContributors: new Map(),
      name: assignment?.name ?? (id === 0 ? this.profile.name : `${CHARACTERS[id % CHARACTER_IDS.length].name.toUpperCase()}${id >= CHARACTER_IDS.length ? ` ${Math.floor(id / CHARACTER_IDS.length) + 1}` : ""}`),
      characterId,
      footstepAt: 0,
      motion: newMotion(0, 1, 0),
      previous: new THREE.Vector3(),
      body,
      collider,
      controller,
      mesh,
      health: 125,
      armor: 0,
      weapon: "machinegun",
      ammo: weaponRecord((id) =>
        id === "melee" ? Infinity : id === "machinegun" ? 100 : 0,
      ),
      owned: new Set(["melee", "machinegun"]),
      lastShot: weaponRecord(-Infinity),
      kills: 0,
      deaths: 0,
      captures: 0,
      team: isTeamMode(this.config.mode) ? ((id % 2) as Team) : null,
      possession: 0,
      difficulty: this.config.botDifficulties[id - 1] ?? "Competitive",
      deadAt: -Infinity,
      power: null,
      powerUntil: 0,
      nextThink: 0,
      nextAttack: 0,
      target: new THREE.Vector3(),
      enemy: null,
      yaw: 0,
      padUntil: 0,
      portalUntil: 0,
    };
    if (actor.team !== null) {
      mesh.traverse((object) => {
        const material = (object as THREE.Mesh).material as
          THREE.MeshStandardMaterial | undefined;
        if (material?.name === "body-armor")
          material.color.set(this.config.teamColors[actor.team!]);
      });
    }
    this.colliders.set(collider.handle, actor);
    return actor;
  }
  private spawn(actor: Actor, index?: number) {
    const spawns =
      actor.team !== null && this.map.flags
        ? this.map.flags.teamSpawns[actor.team]
        : this.map.spawns;
    let point =
      spawns[
        index === undefined
          ? 0
          : actor.team !== null && this.map.flags
            ? Math.floor(index / 2) % spawns.length
            : index % spawns.length
      ];
    if (index === undefined) {
      let best = -1;
      for (const spawn of spawns) {
        const distance = Math.min(
          ...this.actors
            .filter((a) => a !== actor && a.health > 0)
            .map((a) => Math.hypot(spawn.x - a.motion.x, spawn.z - a.motion.z)),
        );
        if (distance > best) {
          best = distance;
          point = spawn;
        }
      }
    }
    actor.motion = newMotion(point.x, point.y + 0.05, point.z);
    actor.previous.copy(point);
    actor.body.setTranslation(actor.motion, true);
    actor.body.setNextKinematicTranslation(actor.motion);
    actor.collider.setEnabled(true);
    actor.health = 125;
    actor.armor = 0;
    actor.power = null;
    actor.powerUntil = 0;
    actor.weapon = "machinegun";
    actor.owned = new Set(["melee", "machinegun"]);
    actor.ammo = weaponRecord((id) =>
      id === "melee" ? Infinity : id === "machinegun" ? 100 : 0,
    );
    actor.lastShot = weaponRecord(-Infinity);
    actor.damageContributors.clear();
    actor.enemy = null;
    actor.nextThink = this.time;
    actor.nextAttack = this.time + 0.8;
    actor.padUntil = 0;
    actor.portalUntil = 0;
    actor.footstepAt = this.time + 0.3;
    this.navigation?.reset(actor.id);
    actor.mesh.visible = !this.isLocal(actor) && actor.controlKind !== "empty";
    actor.yaw = Math.atan2(point.x, point.z);
    actor.pitch = 0;
    actor.viewRevision = (actor.viewRevision ?? 0) + 1;
    actor.viewYaw = actor.yaw;
    actor.viewPitch = actor.pitch;
    actor.respawnRequested = false;
    if (actor.controlKind === "empty") { actor.suspendedHealth = actor.health; actor.health = 0; actor.collider.setEnabled(false); }
    actor.target.copy(
      this.map.waypoints[(actor.id * 3) % this.map.waypoints.length],
    );
    if (this.isLocal(actor)) {
      this.input.setActiveWeapon(actor.weapon);
      this.weaponSwitch?.reset(actor.weapon);
      this.input.dead = false;
      this.respawnRequested = false;
      this.input.pitch = 0;
      this.input.yaw = Math.atan2(point.x, point.z);
    }
  }
  private frame(milliseconds: number) {
    const elapsed = this.lastFrame
      ? (milliseconds - this.lastFrame) / 1000
      : STEP;
    this.lastFrame = milliseconds;
    if (elapsed > 0 && elapsed < 0.5) {
      this.frameSamples.push(elapsed * 1000);
      if (this.frameSamples.length > 180) this.frameSamples.shift();
    }
    if (this.active) {
      this.input.pollPad(
        Math.min(elapsed, 0.1),
        this.player.weapon,
        this.player.owned,
      );
      this.accumulator += Math.min(elapsed, 0.1);
      while (this.active && this.accumulator >= STEP) {
        if (this.isReplica) this.predictTick();
        else this.tick();
        this.accumulator -= STEP;
        if (!this.active) {
          this.accumulator = 0;
          break;
        }
      }
      if (!this.active) this.accumulator = 0;
    }
    this.draw(
      Math.min(elapsed, 0.1),
      this.accumulator / STEP,
      milliseconds / 1000,
    );
    this.onFrame();
    if (milliseconds > this.hudAt + 100) {
      this.hudAt = milliseconds;
      if (this.frameSamples.length) {
        this.frameMs =
          this.frameSamples.reduce((a, b) => a + b, 0) /
          this.frameSamples.length;
        this.fps = Math.round(1000 / this.frameMs);
        const sorted = [...this.frameSamples].sort((a, b) => b - a);
        this.lowFps = Math.round(
          1000 / sorted[Math.floor(sorted.length * 0.01)],
        );
      }
      this.onUpdate();
    }
  }
  private tick() {
    if (this.ended) return;
    this.time += STEP;
    this.simulationTick = (this.simulationTick ?? 0) + 1;
    this.mechanisms?.begin(this.actors, this.time, STEP);
    if (this.config.mode === "juggernaut") {
      const holder = this.actors.find(
        (actor) => actor.id === this.juggernautId && actor.health > 0,
      );
      if (holder) holder.possession += STEP;
      else this.assignJuggernaut(chooseJuggernaut(this.actors));
    }
    const commands = new Map<number, GameCommand>();
    const localControls = this.authority ? null : this.input.consume();
    for (const actor of this.actors) {
      if (!this.isHuman(actor)) continue;
      actor.humanTelemetry.playTimeSeconds += STEP;
      const incoming = this.authority ? this.authorityCommands.get(actor.id) : this.isLocal(actor) && localControls ? {
        ...localControls, seq: 0, yaw: this.input.yaw, pitch: this.input.pitch,
        respawn: this.respawnRequested, railAuto: this.profile.settings.railAuto,
        shotgunAuto: this.profile.settings.shotgunAuto !== false,
      } : undefined;
      const command = { ...idleCommand(actor.ack, actor.yaw, actor.pitch), ...incoming };
      if (this.authority && command.seq <= actor.ack) {
        command.jump = command.fire = command.respawn = false;
        command.switchTo = null;
      }
      actor.ack = Math.max(actor.ack, command.seq);
      actor.yaw = command.yaw;
      actor.pitch = command.pitch;
      if (command.respawn && actor.health <= 0) actor.respawnRequested = true;
      if (command.switchTo && actor.health > 0 && actor.owned.has(command.switchTo) && actor.weapon !== command.switchTo) {
        this.equipWeapon(actor, command.switchTo);
        command.fire = command.fireHeld = false;
      }
      commands.set(actor.id, command);
    }
    if (Math.floor(this.time) > this.lastSecond) {
      this.lastSecond = Math.floor(this.time);
      this.actors.forEach((a) => {
        if (a.health > 100) a.health--;
        if (a.armor > 100) a.armor--;
      });
    }
    for (const actor of this.actors) {
      actor.previous.set(actor.motion.x, actor.motion.y, actor.motion.z);
      if (actor.controlKind === "empty") continue;
      if (actor.health <= 0) {
        if (
          this.isHuman(actor) &&
          actor.respawnRequested &&
          this.time - actor.deadAt >= 0.4
        )
          this.spawn(actor);
        else if (!this.isHuman(actor) && this.time - actor.deadAt >= 1.5)
          this.spawn(actor);
        continue;
      }
      if (actor.power && this.time >= actor.powerUntil) {
        actor.power = null;
        this.notice("Power-up expired", undefined, actor.id);
      }
      const command = commands.get(actor.id);
      const intent = command ? { ...command, forwardX: -Math.sin(command.yaw), forwardZ: -Math.cos(command.yaw) } : this.botIntent(actor);
      this.advanceActor(actor, intent);
    }
    this.world.step();
    for (const actor of this.actors) {
      if (actor.health <= 0) continue;
      // Missing authority input means paused, disconnected or stale. Keep the
      // human body in the simulation, but do not generate attacks on its behalf.
      if (this.authority && this.isHuman(actor) && !this.authorityCommands.has(actor.id)) continue;
      if (actor.weapon === "melee") {
        const victim = this.actors.find(
          (a) =>
            a !== actor &&
            a.health > 0 &&
            areEnemies(this.config, actor, a) &&
            Math.hypot(
              a.motion.x - actor.motion.x,
              a.motion.z - actor.motion.z,
            ) <= 0.91 &&
            Math.abs(a.motion.y - actor.motion.y) < 1.2 &&
            this.canSee(actor, a),
        );
        if (victim && this.shootReady(actor)) {
          actor.lastShot.melee = this.time;
          this.hurt(victim, 50 * this.multiplier(actor), actor, true, this.beginAttack(actor, "melee"));
          this.emit({ type: "shot", actorId: actor.id, weapon: "melee", origin: wireVector(this.eye(actor)) });
          if (this.isLocal(actor)) {
            this.recoil = 0.18;
            this.sound.shot("melee");
          }
        }
      } else if (this.isHuman(actor)) {
        const controls = commands.get(actor.id)!;
        const forward = this.direction(actor.yaw, actor.pitch);
        const definition = WEAPONS[actor.weapon];
        const hit = definition.trigger === "hitscan" ? this.humanHitscanTrace(
          this.eye(actor),
          forward,
          definition.range,
          actor,
        ) : null;
        const manualHitscan =
          (actor.weapon === "rail" && !controls.railAuto) ||
          (actor.weapon === "shotgun" &&
            controls.shotgunAuto === false);
        const auto = definition.trigger === "hitscan" && !manualHitscan;
        if (
          auto &&
          hit?.actor &&
          hit.actor.health > 0 &&
          areEnemies(this.config, actor, hit.actor)
        )
          this.shoot(actor, forward);
        else if (
          (controls.fire || (actor.weapon === "plasma" && controls.fireHeld)) &&
          (definition.trigger === "projectile" || manualHitscan)
        )
          this.shoot(actor, forward);
      } else if (
        actor.enemy &&
        actor.enemy.health > 0 &&
        areEnemies(this.config, actor, actor.enemy) &&
        this.time >= actor.nextAttack &&
        this.canSee(actor, actor.enemy)
      ) {
        const skill = BOT_SKILL[actor.difficulty];
        const aim = this.eye(actor.enemy).sub(this.eye(actor));
        const distance = aim.length();
        aim.x += (Math.random() - 0.5) * distance * skill.aim * 2;
        aim.y += (Math.random() - 0.5) * distance * skill.aim * 2;
        aim.z += (Math.random() - 0.5) * distance * skill.aim * 2;
        this.shoot(actor, aim.normalize());
        actor.nextAttack = this.time + skill.cadence;
      }
    }
    this.updateProjectiles();
    this.gore?.update(this.time, STEP);
    this.updatePickups();
    if (this.flags) this.flagEvents(this.flags.update(this.actors, this.time));
    this.checkEnd();
  }
  private advanceActor(actor: Actor, intent: MoveIntent, prediction = false, silent = false) {
    const wasGrounded = actor.motion.grounded;
    stepMotion(actor.motion, intent, this.time, STEP);
    if (!silent && wasGrounded && !actor.motion.grounded)
      this.sound.character("jump", actor.characterId, ...this.audioAt(actor));
    this.mechanisms?.carry(actor);
    this.moveActor(actor);
    if (!silent && !wasGrounded && actor.motion.grounded && this.time > actor.deadAt + 0.5)
      this.sound.character("land", actor.characterId, ...this.audioAt(actor));
    if (!silent && actor.motion.grounded && Math.hypot(actor.motion.vx, actor.motion.vz) > 2.5 && this.time >= actor.footstepAt) {
      this.sound.footstep(actor.characterId, ...this.audioAt(actor));
      actor.footstepAt = this.time + 0.32;
    }
    if (actor.motion.y < this.map.killY) {
      if (!prediction) this.kill(actor, null);
      return;
    }
    for (const pad of this.map.jumpPads) {
      if (
        this.time > actor.padUntil &&
        Math.hypot(
          actor.motion.x - pad.position.x,
          actor.motion.z - pad.position.z,
        ) < 1 &&
        Math.abs(actor.motion.y - pad.position.y) < 1.5
      ) {
        actor.motion.vx = pad.velocity.x;
        actor.motion.vy = pad.velocity.y;
        actor.motion.vz = pad.velocity.z;
        actor.motion.grounded = false;
        actor.padUntil = this.time + pad.flightTime + 0.3;
        this.navigation?.reset(actor.id);
        if (!silent && this.isLocal(actor)) this.sound.tone(100, 0.3, 0.16, 600, "triangle");
      }
    }
    for (const portal of this.map.teleporters) {
      if (
        this.time < actor.portalUntil ||
        Math.hypot(
          actor.motion.x - portal.position.x,
          actor.motion.z - portal.position.z,
        ) > 0.8 ||
        Math.abs(actor.motion.y - portal.position.y) > 1.1
      )
        continue;
      // Teleporter exit clearance includes other players. A blocked exit waits;
      // it does not place two capsule bodies inside one another.
      if (
        this.actors.some(
          (other) =>
            other !== actor &&
            other.health > 0 &&
            Math.hypot(
              other.motion.x - portal.destination.x,
              other.motion.y - portal.destination.y,
              other.motion.z - portal.destination.z,
            ) < 0.8,
        )
      )
        continue;
      const speed = Math.hypot(actor.motion.vx, actor.motion.vz);
      Object.assign(actor.motion, {
        x: portal.destination.x,
        y: portal.destination.y,
        z: portal.destination.z,
        vx: -Math.sin(portal.yaw) * speed,
        vy: 0,
        vz: -Math.cos(portal.yaw) * speed,
        grounded: false,
      });
      actor.previous.copy(portal.destination);
      actor.body.setNextKinematicTranslation(actor.motion);
      actor.portalUntil = this.time + 1.3;
      actor.yaw = portal.yaw;
      if (!prediction) {
        actor.viewRevision = (actor.viewRevision ?? 0) + 1;
        actor.viewYaw = portal.yaw;
        actor.viewPitch = actor.pitch;
      }
      this.navigation?.reset(actor.id);
      if (this.isLocal(actor)) {
        if (!prediction || !silent) this.input.yaw = portal.yaw;
        if (!silent) this.sound.tone(220, 0.3, 0.16, 880, "triangle");
      }
      break;
    }
  }
  private moveActor(actor: Actor) {
    const m = actor.motion,
      controller = actor.controller;
    if (m.vy > 0) controller.disableSnapToGround();
    else controller.enableSnapToGround(0.16);
    controller.computeColliderMovement(
      actor.collider,
      {
        x: m.vx * STEP,
        y: m.vy * STEP,
        z: m.vz * STEP,
      },
      undefined,
      undefined,
      (collider) =>
        (this.colliders.get(collider.handle)?.health ?? 1) > 0 &&
        (this.mechanisms?.blocks(actor, collider) ?? true),
    );
    const movement = controller.computedMovement();
    m.x += movement.x;
    m.y += movement.y;
    m.z += movement.z;
    for (let i = 0; i < controller.numComputedCollisions(); i++) {
      const collision = controller.computedCollision(i);
      if (!collision) continue;
      const n = collision.normal1;
      if (Math.abs(n.y) < 0.7) {
        const into = m.vx * n.x + m.vz * n.z;
        if (into < 0) {
          m.vx -= into * n.x;
          m.vz -= into * n.z;
        }
      }
      if (n.y < -0.5 && m.vy > 0) m.vy = 0;
    }
    if (controller.computedGrounded() && m.vy <= 0) land(m, this.time);
    else if (m.grounded) {
      m.grounded = false;
    }
    this.mechanisms?.settle(actor, this.time);
    actor.body.setNextKinematicTranslation(m);
  }
  private botIntent(actor: Actor) {
    const skill = BOT_SKILL[actor.difficulty],
      m = actor.motion;
    const nav = (this.navigation ??= new ArenaNavigator(this.map, this.world));
    const position = new THREE.Vector3(m.x, m.y, m.z);
    const juggernaut =
      this.config.mode === "juggernaut"
        ? this.actors.find(
            (candidate) =>
              candidate.id === this.juggernautId && candidate.health > 0,
          )
        : undefined;
    const isJuggernaut = juggernaut === actor;
    const huntingJuggernaut = Boolean(juggernaut && !isJuggernaut);
    const flagOrder = this.flags?.order(actor, this.actors);
    if (this.time >= actor.nextThink) {
      actor.nextThink = this.time + skill.think;
      const enemies = this.actors
        .filter(
          (a) =>
            a !== actor && a.health > 0 && areEnemies(this.config, actor, a),
        )
        .sort(
          (a, b) =>
            Math.hypot(a.motion.x - m.x, a.motion.z - m.z) -
            Math.hypot(b.motion.x - m.x, b.motion.z - m.z),
        );
      actor.enemy =
        flagOrder?.enemyId !== undefined && flagOrder.enemyId !== null
          ? (this.actors.find(
              (candidate) =>
                candidate.id === flagOrder.enemyId && candidate.health > 0,
            ) ?? null)
          : juggernaut && !isJuggernaut
            ? juggernaut
            : (enemies.find((a) => this.canSee(actor, a)) ?? null);
      // The role is always the hunter's destination, even without line of sight,
      // health or ammunition. Normal collision and visibility still gate attacks.
      if (flagOrder) actor.target.copy(flagOrder.position);
      else if (juggernaut && !isJuggernaut) {
        actor.target.set(
          juggernaut.motion.x,
          juggernaut.motion.y,
          juggernaut.motion.z,
        );
      } else {
        const needed = this.pickups.filter(
          (p) =>
            p.readyAt <= this.time &&
            ((p.objective && !actor.power) ||
              (p.kind === "armor" && actor.armor < 100) ||
              (isWeaponId(p.kind) &&
                p.kind !== "melee" &&
                (!actor.owned.has(p.kind) ||
                  actor.ammo[p.kind] <
                    Math.max(3, WEAPONS[p.kind].pickupAmmo * 0.15))) ||
              (p.kind === "health" &&
                actor.health < (isJuggernaut ? 100 : 75)) ||
              (p.kind === "ammo" && actor.ammo.machinegun < 25)),
        );
        const candidates = needed
          .map((p) => ({
            pickup: p,
            cost:
              nav.cost(position, p.position) *
              (p.objective
                ? 0.45
                : p.kind === "health" && (actor.health < 40 || isJuggernaut)
                  ? 0.35
                  : 1),
          }))
          .filter((p) => Number.isFinite(p.cost))
          .sort((a, b) => a.cost - b.cost);
        if (candidates[0]) actor.target.copy(candidates[0].pickup.position);
        else if (position.distanceTo(actor.target) < 1.8) {
          actor.target.copy(
            this.map.waypoints[
              Math.floor(Math.random() * this.map.waypoints.length)
            ],
          );
        }
      }
      if (actor.enemy) {
        const distance = position.distanceTo(
          new THREE.Vector3(
            actor.enemy.motion.x,
            actor.enemy.motion.y,
            actor.enemy.motion.z,
          ),
        );
        const choices: WeaponId[] =
          distance > 25
            ? [
                "rail",
                "machinegun",
                "chaingun",
                "bfg",
                "plasma",
                "rocket",
                "nailgun",
                "grenade",
                "shotgun",
                "lightning",
                "proximity",
              ]
            : distance < 5
              ? [
                  "shotgun",
                  "lightning",
                  "chaingun",
                  "plasma",
                  "nailgun",
                  "machinegun",
                  "rail",
                  "bfg",
                  "rocket",
                  "grenade",
                  "proximity",
                ]
              : [
                  "bfg",
                  "rocket",
                  "lightning",
                  "plasma",
                  "chaingun",
                  "nailgun",
                  "rail",
                  "shotgun",
                  "grenade",
                  "machinegun",
                  "proximity",
                ];
        actor.weapon =
          choices.find(
            (id) =>
              actor.owned.has(id) &&
              actor.ammo[id] > 0 &&
              distance <= WEAPONS[id].range,
          ) ?? "melee";
        // Occasionally seed the visible approach, then return to direct weapons.
        // This changes equipment only; a hunter still routes and aims at the holder.
        if (
          actor.owned.has("proximity") &&
          actor.ammo.proximity > 0 &&
          distance > 4 &&
          distance < 14 &&
          (Math.floor(this.time / 4) + actor.id) % 4 === 0 &&
          this.canSee(actor, actor.enemy) &&
          this.projectiles.filter(
            (p) => p.kind === "proximity" && p.owner === actor,
          ).length < 4
        )
          actor.weapon = "proximity";
      }
    }
    // Think and retarget during launches, but preserve the authored ballistic arc.
    if (!m.grounded && this.time < actor.padUntil)
      return {
        x: 0,
        z: 0,
        forwardX: -Math.sin(actor.yaw),
        forwardZ: -Math.cos(actor.yaw),
        jump: false,
      };
    const waypoint = nav.steer(actor.id, position, actor.target, this.time);
    let x = waypoint.x - m.x,
      z = waypoint.z - m.z;
    if (flagOrder) {
      const cache = (this.flagApproaches ??= new WeakMap());
      let approach = cache.get(actor);
      if (
        !approach ||
        approach.navigation !== nav ||
        this.time < approach.at ||
        this.time - approach.at >= 0.25 ||
        approach.from.distanceToSquared(position) > 1 ||
        approach.goal.distanceToSquared(flagOrder.position) > 0.25
      ) {
        approach = {
          navigation: nav,
          from: position.clone(),
          goal: flagOrder.position.clone(),
          at: this.time,
          clear: nav.canWalk(position, flagOrder.position),
        };
        cache.set(actor, approach);
      }
      // Complete off-node objectives only over a supported body-clear segment.
      // Recheck the next short segment each tick as actors move or are knocked back.
      const distance = position.distanceTo(flagOrder.position);
      const next = position.clone().lerp(
        flagOrder.position,
        Math.min(1, 1.8 / Math.max(distance, 0.001)),
      );
      if (approach.clear && nav.canWalk(position, next)) {
        x = flagOrder.position.x - m.x;
        z = flagOrder.position.z - m.z;
        if (flagOrder.arrivalRadius && distance < flagOrder.arrivalRadius)
          x = z = 0;
      }
    }
    if (actor.enemy) {
      const dx = actor.enemy.motion.x - m.x,
        dz = actor.enemy.motion.z - m.z;
      actor.yaw = Math.atan2(-dx, -dz);
      // Finish a melee pursuit at the player, not at the graph's nearest node.
      // The same support and capsule checks used for dodging keep this approach
      // out of walls and voids; other elevations still use authored routes.
      if (
        huntingJuggernaut &&
        actor.weapon === "melee" &&
        Math.abs(actor.enemy.motion.y - m.y) < 1.2 &&
        this.canSee(actor, actor.enemy) &&
        nav.safeStrafe(position, dx, dz)
      ) {
        x = dx;
        z = dz;
      }
      // Resource travel keeps priority. Dodge briefly only on a clear supported
      // section; the old unlimited strafe wandered off bridges and into walls.
      if (
        m.grounded &&
        !flagOrder &&
        (!huntingJuggernaut ||
          (actor.weapon !== "melee" && this.canSee(actor, actor.enemy))) &&
        Math.hypot(dx, dz) < 12 &&
        Math.sin(this.time * 1.6 + actor.id) > 0.65
      ) {
        const side = Math.sin(this.time * 0.8 + actor.id * 2) > 0 ? 1 : -1;
        const sx = -dz * side,
          sz = dx * side;
        if (nav.safeStrafe(position, sx, sz)) {
          x = sx;
          z = sz;
        }
      }
    } else actor.yaw = Math.atan2(-x, -z);
    if (flagOrder && m.grounded)
      ({ x, z } = this.flagTraffic(actor, nav, x, z));
    const moving = Math.sin(this.time * 2 + actor.id) < skill.speed;
    return {
      x: moving ? x : 0,
      z: moving ? z : 0,
      forwardX: -Math.sin(actor.yaw),
      forwardZ: -Math.cos(actor.yaw),
      jump: false,
    };
  }
  /** Keep flag routes moving around bodies without changing targets or collision. */
  private flagTraffic(actor: Actor, nav: ArenaNavigator, x: number, z: number) {
    const length = Math.hypot(x, z);
    if (length < 0.05) return { x, z };
    const m = actor.motion,
      fx = x / length,
      fz = z / length,
      rx = fz,
      rz = -fx;
    const blockers = this.actors.filter((other) => {
      if (
        other === actor || other.health <= 0 || !other.collider.isEnabled() ||
        Math.abs(other.motion.y - m.y) > 1.1 ||
        (other === actor.enemy && actor.weapon === "melee")
      ) return false;
      const dx = other.motion.x - m.x, dz = other.motion.z - m.z;
      const ahead = dx * fx + dz * fz;
      return ahead > 0 && ahead < 1.6 && Math.abs(dx * rx + dz * rz) < 0.85;
    });
    if (!blockers.length) return { x, z };
    // A consistent side lets head-on actors pass instead of mirroring each dodge.
    // If that side is blocked, wait for oncoming traffic to pass on its own right.
    const oncoming = blockers.some(other => other.motion.vx * fx + other.motion.vz * fz < -0.5);
    const position = new THREE.Vector3(m.x, m.y, m.z);
    for (const side of oncoming ? [1] : [1, -1]) {
      const sx = fx * 0.25 + rx * side, sz = fz * 0.25 + rz * side;
      if (!nav.safeStrafe(position, sx, sz)) continue;
      const scale = 1.1 / Math.hypot(sx, sz);
      const endX = m.x + sx * scale, endZ = m.z + sz * scale;
      if (this.actors.some((other) =>
        other !== actor && other.health > 0 && other.collider.isEnabled() &&
        Math.abs(other.motion.y - m.y) < 1.1 &&
        Math.hypot(other.motion.x - endX, other.motion.z - endZ) < 0.8
      )) continue;
      return { x: sx, z: sz };
    }
    return { x: 0, z: 0 };
  }
  private eye(actor: Actor) {
    return new THREE.Vector3(
      actor.motion.x,
      actor.motion.y + 0.6,
      actor.motion.z,
    );
  }
  private aimDirection() { return this.direction(this.input.yaw, this.input.pitch); }
  private direction(yaw: number, pitch: number) {
    return new THREE.Vector3(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
  }
  private raycast(
    from: THREE.Vector3,
    dir: THREE.Vector3,
    range: number,
    except?: Actor,
  ) {
    const result = this.world.castRay(
      new RAPIER.Ray(from, dir),
      range,
      true,
      undefined,
      undefined,
      except?.collider,
      except?.body,
    );
    return result
      ? {
          actor: this.colliders.get(result.collider.handle),
          distance: result.timeOfImpact,
          point: from.clone().addScaledVector(dir, result.timeOfImpact),
        }
      : null;
  }
  private canSee(from: Actor, target: Actor) {
    const start = this.eye(from),
      toward = this.eye(target).sub(start),
      length = toward.length();
    return (
      this.raycast(start, toward.normalize(), length + 0.5, from)?.actor ===
      target
    );
  }
  /** Forgive near-edge human hits without moving aim or modifying physics hitboxes. */
  private humanHitscanTrace(from: THREE.Vector3, dir: THREE.Vector3, range: number, shooter: Actor) {
    const direct = this.raycast(from, dir, range, shooter);
    // Exact hits (including teammates) always win over nearby candidates.
    if (direct?.actor) return { ...direct, assisted: false };
    const limit = Math.min(range, direct?.distance ?? range);
    const ray = new THREE.Ray(from, dir);
    const rayPoint = new THREE.Vector3(), axisPoint = new THREE.Vector3();
    const candidates: { actor: Actor; point: THREE.Vector3; error: number; depth: number }[] = [];
    for (const target of this.actors) {
      if (target.health <= 0 || !areEnemies(this.config, shooter, target) || !target.collider.isEnabled()) continue;
      const radius = target.collider.radius(), halfHeight = target.collider.halfHeight();
      const center = target.collider.translation();
      const separation = Math.sqrt(ray.distanceSqToSegment(
        new THREE.Vector3(center.x, center.y - halfHeight, center.z),
        new THREE.Vector3(center.x, center.y + halfHeight, center.z),
        rayPoint, axisPoint,
      ));
      const depth = rayPoint.clone().sub(from).dot(dir);
      if (depth <= 0 || depth - radius > limit || separation <= 1e-8) continue;
      const gap = Math.max(0, separation - radius);
      const margin = Math.min(HITSCAN_MARGIN.maxRadius, Math.tan(HITSCAN_MARGIN.angle) * depth);
      if (gap > margin + 1e-8) continue;
      // Aim just inside the nearest real capsule surface, never at its center.
      const point = axisPoint.clone().lerp(rayPoint, Math.min(1, radius * 0.99 / separation));
      candidates.push({ actor: target, point, error: gap / depth, depth });
    }
    candidates.sort((a, b) => a.error - b.error || a.depth - b.depth || a.actor.id - b.actor.id);
    for (const candidate of candidates) {
      const correction = candidate.point.clone().sub(from).normalize();
      const confirmed = this.raycast(from, correction, range, shooter);
      // The real trace must reach this enemy first, before the original ray's cover.
      if (confirmed?.actor === candidate.actor && confirmed.distance <= limit + 1e-6)
        return { ...confirmed, assisted: true };
    }
    return direct ? { ...direct, assisted: false } : null;
  }
  private shootReady(actor: Actor) {
    return readyToFire(
      this.time,
      actor.lastShot[actor.weapon],
      actor.weapon,
      actor.ammo[actor.weapon],
    );
  }
  private multiplier(actor: Actor) {
    const quad = actor.power === "quad" && actor.powerUntil > this.time ? 4 : 1;
    return (
      quad *
      (this.config.mode === "juggernaut" && this.juggernautId === actor.id
        ? 2
        : 1)
    );
  }
  private spreadAim(aim: THREE.Vector3, slope: number, circular = true) {
    const right = new THREE.Vector3()
      .crossVectors(
        aim,
        Math.abs(aim.y) > 0.98
          ? new THREE.Vector3(0, 0, 1)
          : new THREE.Vector3(0, 1, 0),
      )
      .normalize();
    const up = new THREE.Vector3().crossVectors(right, aim).normalize();
    let x = Math.random() * 2 - 1,
      y = Math.random() * 2 - 1;
    if (circular) {
      const length = Math.hypot(x, y);
      if (length > 1) {
        x /= length;
        y /= length;
      }
    }
    return aim
      .clone()
      .addScaledVector(right, x * slope)
      .addScaledVector(up, y * slope)
      .normalize();
  }
  private beginAttack(actor: Actor, weapon: WeaponId): AttackCredit {
    const telemetry = this.isHuman(actor) ? actor.humanTelemetry : null;
    if (telemetry) { telemetry.shots++; weaponStatistics(telemetry, weapon).shots++; }
    // Projectile ownership follows the human who fired, even across bot takeover
    // or a fresh occupant of that slot. Bot-fired projectiles retain null credit.
    return { telemetry, weapon, hit: false };
  }
  private shoot(actor: Actor, aim: THREE.Vector3) {
    if (!this.shootReady(actor)) return;
    const weapon = actor.weapon,
      definition = WEAPONS[weapon];
    const credit = definition.trigger === "contact" ? undefined : this.beginAttack(actor, weapon);
    // Thirty milliseconds is not an integer number of 120 Hz ticks. Carry the
    // sub-tick remainder during continuous chaingun fire instead of rounding its rate.
    const scheduled = actor.lastShot[weapon] + definition.cooldown;
    actor.lastShot[weapon] =
      weapon === "chaingun" && this.time - scheduled < STEP + 1e-8
        ? scheduled
        : this.time;
    actor.ammo[weapon]--;
    const start = this.eye(actor),
      boost = this.multiplier(actor);
    if (this.isLocal(actor)) {
      this.recoil =
        weapon === "rail"
          ? 0.11
          : weapon === "rocket" || weapon === "bfg"
            ? 0.14
            : weapon === "shotgun"
              ? 0.12
              : 0.035;
      this.muzzleUntil = this.time + 0.045;
    }
    if (!this.authority && (this.isLocal(actor) || this.eye(this.player).distanceTo(start) < 22))
      this.sound.shot(weapon, !this.isLocal(actor));
    if (definition.trigger === "projectile") {
      if (weapon === "proximity") {
        const mines = this.projectiles.filter(
          (p) => p.kind === "proximity" && p.owner === actor,
        );
        if (mines.length >= 4) this.removeProjectile(mines[0]);
      }
      const count = weapon === "nailgun" ? 15 : 1;
      for (let i = 0; i < count; i++) {
        const direction =
          weapon === "nailgun"
            ? this.spreadAim(aim, Math.tan(Math.PI / 30))
            : aim.clone();
        if (weapon === "grenade" || weapon === "proximity") direction.y += 0.2;
        direction.normalize();
        const speed =
          weapon === "rocket"
            ? 22.5
            : weapon === "nailgun"
              ? 30
              : weapon === "grenade" || weapon === "proximity"
                ? 17.5
                : 50;
        const radius =
          weapon === "grenade"
            ? 6
            : weapon === "proximity"
              ? 3.75
              : weapon === "plasma"
                ? 0.5
                : weapon === "nailgun"
                  ? 0
                  : 3;
        const mesh = this.authority ? this.authorityProjectileMesh : new THREE.Mesh(
          weapon === "proximity"
            ? new THREE.CylinderGeometry(0.17, 0.22, 0.1, 6)
            : new THREE.IcosahedronGeometry(
                weapon === "bfg"
                  ? BFG_PROJECTILE_RADIUS
                  : weapon === "nailgun"
                    ? 0.045
                    : 0.12,
                0,
              ),
          new THREE.MeshBasicMaterial({ color: definition.color }),
        );
        if (weapon === "nailgun") {
          mesh.scale.set(1, 1, 3.5);
          mesh.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 0, 1),
            direction,
          );
        }
        mesh.position.copy(start);
        if (!this.authority) this.scene.add(mesh);
        this.projectiles.push({
          id: this.nextProjectileId = (this.nextProjectileId ?? 0) + 1,
          kind: weapon,
          born: this.time,
          owner: actor,
          credit,
          position: start.clone(),
          velocity: direction.multiplyScalar(speed),
          mesh,
          expires:
            this.time +
            (weapon === "grenade"
              ? 2.5
              : weapon === "nailgun"
                ? 3
                : weapon === "proximity"
                  ? 30
                  : 10),
          multiplier: boost,
          gravity: weapon === "grenade" || weapon === "proximity" ? 20 : 0,
          splash: weapon === "plasma" ? 15 : weapon === "nailgun" ? 0 : 100,
          radius,
          stuck: false,
          armAt: Infinity,
          detonateAt: null,
        });
      }
      this.emit({ type: "shot", actorId: actor.id, weapon, origin: wireVector(start) });
      return;
    }
    if (definition.trigger === "contact") return;
    const count = weapon === "shotgun" ? 11 : 1;
    const segments: THREE.Vector3[] = [],
      feedback = new Set<Actor>();
    const muzzle = start
      .clone()
      .add(
        new THREE.Vector3(
          Math.cos(actor.yaw) * 0.24,
          -0.2,
          -Math.sin(actor.yaw) * 0.24,
        ),
      );
    for (let pellet = 0; pellet < count; pellet++) {
      let direction = aim.clone();
      if (weapon === "machinegun") {
        direction.x += (Math.random() - 0.5) * 0.017;
        direction.y += (Math.random() - 0.5) * 0.017;
        direction.z += (Math.random() - 0.5) * 0.017;
        direction.normalize();
      } else if (weapon === "shotgun")
        direction = this.spreadAim(aim, 700 / 8192, false);
      else if (weapon === "chaingun")
        direction = this.spreadAim(aim, Math.tan((2.5 * Math.PI) / 180));
      const hit = this.isHuman(actor)
        ? this.humanHitscanTrace(start, direction, definition.range, actor)
        : this.raycast(start, direction, definition.range, actor);
      const end =
        hit?.point ??
        start.clone().addScaledVector(direction, definition.range);
      segments.push(muzzle, end);
      if (hit?.actor) {
        const headshot =
          weapon === "rail" && !("assisted" in hit && hit.assisted) && hit.point.y > hit.actor.motion.y + 0.48;
        const amount =
          (weapon === "machinegun" && this.config.mode === "tdm"
            ? 5
            : definition.damage) *
          boost *
          (headshot ? 2 : 1);
        const dealt = this.hurt(hit.actor, amount, actor, !feedback.has(hit.actor), credit);
        if (headshot && dealt > 0 && credit?.telemetry && areEnemies(this.config, actor, hit.actor)) {
          credit.telemetry.headshots++;
          weaponStatistics(credit.telemetry, weapon).headshots++;
        }
        feedback.add(hit.actor);
        if (headshot && canDamage(this.config, hit.actor, actor))
          this.notice("HEADSHOT", "combat", actor.id);
      } else if (hit && pellet === 0)
        this.puff(end, weapon === "lightning" ? 0xa9d8ff : 0xffad77, 0.16);
    }
    this.emit({ type: "shot", actorId: actor.id, weapon, origin: wireVector(start), segments: segments.map(wireVector) });
    if (this.authority) return;
    const trace = new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints(segments),
      new THREE.LineBasicMaterial({
        color:
          weapon === "rail"
            ? 0x7effe7
            : weapon === "lightning"
              ? 0xbde7ff
              : 0xffc798,
        transparent: true,
        opacity: weapon === "lightning" ? 1 : 0.8,
      }),
    );
    this.scene.add(trace);
    this.effects.push({
      object: trace,
      start: this.time,
      until:
        this.time +
        (weapon === "rail" ? 0.3 : weapon === "lightning" ? 0.06 : 0.055),
    });
  }
  private removeProjectile(projectile: Projectile) {
    const index = this.projectiles.indexOf(projectile);
    if (index < 0) return;
    this.scene.remove(projectile.mesh);
    if (!this.authority) {
      projectile.mesh.geometry.dispose();
      (projectile.mesh.material as THREE.Material).dispose();
    }
    this.projectiles.splice(index, 1);
  }
  private detonate(projectile: Projectile, direct?: Actor) {
    if (direct && WEAPONS[projectile.kind].damage > 0)
      this.hurt(
        direct,
        WEAPONS[projectile.kind].damage * projectile.multiplier,
        projectile.owner,
        true,
        projectile.credit,
      );
    if (projectile.splash > 0) {
      for (const actor of this.actors) {
        if (
          actor.health <= 0 ||
          actor === direct ||
          !canDamage(this.config, actor, projectile.owner)
        )
          continue;
        const toward = new THREE.Vector3(
          actor.motion.x,
          actor.motion.y,
          actor.motion.z,
        ).sub(projectile.position);
        const length = toward.length();
        if (length >= projectile.radius || length < 0.01) continue;
        const direction = toward.clone().normalize();
        const obstruction = this.raycast(
          projectile.position.clone().addScaledVector(direction, 0.04),
          direction,
          length,
        );
        if (obstruction && obstruction.actor !== actor) continue;
        const amount =
          Math.round(projectile.splash * (1 - length / projectile.radius)) *
          projectile.multiplier;
        this.hurt(actor, amount, projectile.owner, true, projectile.credit);
        if (!(actor.power === "immortal" && actor.powerUntil > this.time)) {
          actor.motion.vx += direction.x * amount * 0.04;
          actor.motion.vz += direction.z * amount * 0.04;
          actor.motion.vy += Math.max(0, direction.y) * amount * 0.06;
          actor.motion.grounded = false;
        }
      }
    }
    this.puff(
      projectile.position,
      new THREE.Color(WEAPONS[projectile.kind].color).getHex(),
      projectile.kind === "nailgun"
        ? 0.14
        : projectile.kind === "plasma"
          ? 0.45
          : 1.5,
    );
    if (
      projectile.splash >= 100 &&
      this.eye(this.player).distanceTo(projectile.position) < 35
    )
      this.sound.blast(0.18, 0.28, 400);
    this.removeProjectile(projectile);
  }
  private updateProjectiles() {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      if (this.time + 1e-8 >= p.expires) {
        if (p.kind === "grenade") this.detonate(p);
        else this.removeProjectile(p);
        continue;
      }
      if (p.position.y < this.map.killY - 5) {
        this.removeProjectile(p);
        continue;
      }
      if (p.kind === "proximity" && p.stuck) {
        if (p.detonateAt !== null && this.time + 1e-8 >= p.detonateAt) {
          this.detonate(p);
          continue;
        }
        if (this.time + 1e-8 >= p.armAt && p.detonateAt === null) {
          const enemy = this.actors.find((actor) => {
            if (actor.health <= 0 || !areEnemies(this.config, p.owner, actor))
              return false;
            const toward = new THREE.Vector3(
              actor.motion.x,
              actor.motion.y,
              actor.motion.z,
            ).sub(p.position);
            const length = toward.length();
            return (
              length < 3.75 &&
              length > 0.01 &&
              !this.world.castRay(
                new RAPIER.Ray(p.position, toward.divideScalar(length)),
                length,
                true,
                RAPIER.QueryFilterFlags.ONLY_FIXED,
              )
            );
          });
          if (enemy) {
            p.detonateAt = this.time + 0.5;
            if (this.eye(this.player).distanceTo(p.position) < 25)
              this.sound.tone(880, 0.15, 0.1, 440);
          }
        }
        p.mesh.scale.setScalar(
          p.detonateAt !== null ? 1 + Math.sin(this.time * 36) * 0.18 : 1,
        );
        (p.mesh.material as THREE.MeshBasicMaterial).color.set(
          this.time >= p.armAt ? WEAPONS.proximity.color : "#756765",
        );
        continue;
      }
      if (p.stuck) continue;
      p.velocity.y -= p.gravity * STEP;
      const distance = p.velocity.length() * STEP;
      if (distance < 1e-8) continue;
      const direction = p.velocity.clone().normalize();
      // The enlarged cannon bolt must strike with its edge, including between
      // simulation ticks. Other projectiles retain their existing ray collision.
      const sphereHit =
        p.kind === "bfg"
          ? this.world.castShape(
              p.position,
              PROJECTILE_ROTATION,
              direction,
              BFG_PROJECTILE_SHAPE,
              0,
              distance,
              true,
              undefined,
              undefined,
              p.owner.collider,
              p.owner.body,
            )
          : null;
      const hit =
        p.kind === "bfg"
          ? sphereHit && {
              collider: sphereHit.collider,
              timeOfImpact: sphereHit.time_of_impact,
              normal: sphereHit.normal1,
            }
          : this.world.castRayAndGetNormal(
              new RAPIER.Ray(p.position, direction),
              distance,
              true,
              p.kind === "proximity"
                ? RAPIER.QueryFilterFlags.ONLY_FIXED
                : undefined,
              undefined,
              p.owner.collider,
              p.owner.body,
            );
      if (hit) {
        p.position.addScaledVector(direction, hit.timeOfImpact);
        const actor = this.colliders.get(hit.collider.handle);
        const normal = new THREE.Vector3(
          hit.normal.x,
          hit.normal.y,
          hit.normal.z,
        );
        if (p.kind === "proximity") {
          p.position.addScaledVector(normal, 0.065);
          p.velocity.set(0, 0, 0);
          p.stuck = true;
          p.armAt = this.time + 1;
          p.mesh.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            normal,
          );
        } else if (p.kind === "grenade" && !actor) {
          p.position.addScaledVector(normal, 0.13);
          p.velocity.reflect(normal).multiplyScalar(0.65);
          if (normal.y > 0.5 && p.velocity.length() < 1.5) {
            p.velocity.set(0, 0, 0);
            p.stuck = true;
          }
        } else {
          this.detonate(p, actor);
          continue;
        }
      } else p.position.addScaledVector(p.velocity, STEP);
      p.mesh.position.copy(p.position);
    }
  }
  private hurt(
    victim: Actor,
    amount: number,
    attacker: Actor | null,
    feedback = true,
    credit?: AttackCredit,
  ) {
    if (victim.health <= 0 || !canDamage(this.config, victim, attacker)) return 0;
    const resistance =
      this.config.mode === "juggernaut" && this.juggernautId === victim.id
        ? 0.5
        : 1;
    const result = damage(
      victim.health,
      victim.armor,
      amount * resistance,
      victim.power === "immortal" && victim.powerUntil > this.time,
    );
    victim.health = result.health;
    victim.armor = result.armor;
    if (result.dealt > 0) {
      if (this.isHuman(victim)) victim.humanTelemetry.damageTaken += result.dealt;
      const telemetry = credit ? credit.telemetry : attacker && this.isHuman(attacker) ? attacker.humanTelemetry : null;
      if (attacker && telemetry && areEnemies(this.config, attacker, victim)) {
        telemetry.damageDealt += result.dealt;
        weaponStatistics(telemetry, credit?.weapon ?? attacker.weapon).damageDealt += result.dealt;
        if (credit && !credit.hit) {
          credit.hit = true;
          telemetry.hits++;
          weaponStatistics(telemetry, credit.weapon).hits++;
        }
        const contribution = victim.damageContributors.get(attacker.id);
        if (contribution?.telemetry === telemetry) contribution.at = this.time;
        else victim.damageContributors.set(attacker.id, { telemetry, at: this.time });
      }
    }
    if (
      feedback &&
      result.dealt > 0 &&
      attacker && this.isLocal(attacker) &&
      victim !== attacker
    ) {
      this.sound.hit();
      this.notice("", "hit");
    }
    if (feedback && result.dealt > 0) {
      this.emit({ type: "hit", victimId: victim.id, attackerId: attacker?.id ?? null, amount: result.dealt, point: { x: victim.motion.x, y: victim.motion.y + 0.3, z: victim.motion.z } });
      const point = new THREE.Vector3(victim.motion.x, victim.motion.y + 0.3, victim.motion.z);
      const direction = attacker && attacker !== victim
        ? point.clone().sub(new THREE.Vector3(attacker.motion.x, attacker.motion.y + 0.3, attacker.motion.z)).normalize()
        : new THREE.Vector3(0, 1, 0);
      this.goreEffects().hit(point, direction, result.dealt, this.time);
      this.sound.character("hurt", victim.characterId, ...this.audioAt(victim));
      if (this.isLocal(victim)) {
        this.sound.hurt();
        this.notice("", "hurt");
      }
    }
    if (victim.health <= 0) this.kill(victim, attacker, credit);
    return result.dealt;
  }
  private dropCarriedFlag(actor: Actor) {
    if (this.flags?.carriedBy(actor.id)) {
      const position = new THREE.Vector3(
        actor.motion.x,
        actor.motion.y,
        actor.motion.z,
      );
      const floor = this.world.castRay(
        new RAPIER.Ray(position, { x: 0, y: -1, z: 0 }),
        100,
        true,
        RAPIER.QueryFilterFlags.ONLY_FIXED,
      );
      let lost = position.y < this.map.killY || !floor;
      if (floor) position.y += 0.9 - floor.timeOfImpact;
      if (!lost) {
        const nav = (this.navigation ??= new ArenaNavigator(this.map, this.world));
        const connections = [...this.map.nodes].sort(
          (a, b) =>
            a.position.distanceToSquared(position) -
            b.position.distanceToSquared(position),
        );
        // A ray can hit a roof with no playable approach. Such flags return home
        // instead of sending every objective bot toward an unreachable surface.
        lost = !connections.some((node) => nav.canWalk(node.position, position));
      }
      this.flagEvents(this.flags.drop(actor.id, position, this.time, lost));
    }
  }
  private kill(victim: Actor, attacker: Actor | null, credit?: AttackCredit) {
    this.dropCarriedFlag(victim);
    victim.health = 0;
    victim.deadAt = this.time;
    victim.deaths++;
    if (this.isHuman(victim)) { victim.humanDeaths++; victim.humanTelemetry.deaths++; }
    const telemetry = credit ? credit.telemetry : attacker && this.isHuman(attacker) ? attacker.humanTelemetry : null;
    if (attacker && telemetry && areEnemies(this.config, attacker, victim)) {
      telemetry.kills++;
      weaponStatistics(telemetry, credit?.weapon ?? attacker.weapon).kills++;
      if (telemetry === attacker.humanTelemetry) attacker.humanKills++;
    }
    for (const [id, contribution] of victim.damageContributors) {
      if (id !== attacker?.id && id !== victim.id && this.time - contribution.at <= 5)
        contribution.telemetry.assists++;
    }
    victim.damageContributors.clear();
    victim.power = null;
    victim.powerUntil = 0;
    victim.collider.setEnabled(false);
    victim.mesh.visible = false;
    if (attacker && attacker !== victim)
      attacker.kills += areEnemies(this.config, attacker, victim) ? 1 : -1;
    else victim.kills--;
    if (this.config.mode === "juggernaut" && this.juggernautId === victim.id) {
      this.assignJuggernaut(
        attacker && attacker !== victim && attacker.health > 0
          ? attacker.id
          : chooseJuggernaut(this.actors, victim.id),
      );
    }
    if (this.isLocal(victim)) {
      this.input.clear();
      this.input.dead = true;
      this.respawnRequested = false;
      this.deathLook = this.input.yaw;
      this.sound.kill();
    }
    if (attacker && this.isLocal(attacker) && victim !== attacker)
      this.notice(`FRAGGED ${victim.name}`, "combat");
    if (victim.motion.y >= this.map.killY) {
      const direction = attacker && attacker !== victim
        ? new THREE.Vector3(victim.motion.x - attacker.motion.x, 0.5, victim.motion.z - attacker.motion.z).normalize()
        : new THREE.Vector3(0, 1, 0);
      this.goreEffects().death(new THREE.Vector3(victim.motion.x, victim.motion.y, victim.motion.z), direction, this.time);
      this.sound.gore(...this.audioAt(victim));
    }
    this.sound.character("death", victim.characterId, ...this.audioAt(victim));
    this.emit({ type: "kill", victimId: victim.id, attackerId: attacker?.id ?? null });
    this.onKill(attacker, victim);
  }
  private createPickup(
    kind: Pickup["kind"],
    position: THREE.Vector3,
    objective = false,
  ): Pickup {
    const group = new THREE.Group();
    if (this.authority) return { kind, position: position.clone(), mesh: group, readyAt: objective ? Infinity : 0, objective };
    group.position.copy(position);
    this.scene.add(group);
    const colors = {
      health: 0xf86858,
      armor: 0xf5b955,
      ammo: 0xd4cbbc,
      quad: 0xff6d3e,
      immortal: 0x76a8ff,
    };
    const color = isWeaponId(kind) ? WEAPONS[kind].color : colors[kind];
    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.8,
      roughness: 0.35,
      metalness: 0.65,
    });
    if (isWeaponId(kind)) {
      const model = makeWeaponPickup(kind);
      model.rotation.y = Math.PI / 3;
      group.add(model);
    } else {
      const core = new THREE.Mesh(
        objective
          ? new THREE.OctahedronGeometry(0.6)
          : kind === "health"
            ? new THREE.BoxGeometry(0.22, 0.7, 0.22)
            : new THREE.OctahedronGeometry(0.32),
        mat,
      );
      group.add(core);
      if (kind === "health")
        group.add(new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.22, 0.22), mat));
    }
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(objective ? 0.86 : 0.5, 0.022, 4, 24),
      mat,
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.4;
    group.add(ring);
    if (objective) {
      const ring2 = ring.clone();
      ring2.rotation.x = 0.7;
      ring2.position.y = 0;
      group.add(ring2);
    }
    return {
      kind,
      position: position.clone(),
      mesh: group,
      readyAt: objective ? Infinity : 0,
      objective,
    };
  }
  private updatePickups() {
    while (this.time + 1e-8 >= powerEvent(this.powerIndex).at) {
      const event = powerEvent(this.powerIndex++);
      this.objective.kind = event.power;
      this.objective.readyAt = this.time;
      this.objective.mesh.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          const material = obj.material as THREE.MeshStandardMaterial;
          material.color.set(event.power === "quad" ? 0xff6d3e : 0x76a8ff);
          material.emissive.copy(material.color);
        }
      });
      this.notice(
        event.power === "quad"
          ? "4× DAMAGE IS AVAILABLE"
          : "IMMORTALITY IS AVAILABLE",
        "power",
      );
      this.sound.tone(180, 0.4, 0.2, 720, "triangle");
    }
    if (this.time >= powerEvent(this.warningIndex).at - 15) {
      this.notice("POWER-UP IN 15 SECONDS", "power");
      this.sound.tone(440, 0.4, 0.14, 220);
      this.warningIndex++;
    }
    for (const pickup of this.pickups) {
      if (pickup.readyAt > this.time) continue;
      for (const actor of this.actors) {
        if (
          actor.health <= 0 ||
          Math.hypot(
            actor.motion.x - pickup.position.x,
            actor.motion.z - pickup.position.z,
          ) > 0.9 ||
          Math.abs(actor.motion.y - pickup.position.y) > 1.3
        )
          continue;
        if (pickup.kind === "health") {
          if (actor.health >= 100) continue;
          actor.health = Math.min(100, actor.health + 25);
          pickup.readyAt = this.time + 35;
        } else if (pickup.kind === "armor") {
          if (actor.armor >= 200) continue;
          actor.armor = Math.min(200, actor.armor + 50);
          pickup.readyAt = this.time + 25;
        } else if (isWeaponId(pickup.kind)) {
          actor.owned.add(pickup.kind);
          actor.ammo[pickup.kind] =
            pickup.kind === "melee"
              ? Infinity
              : Math.min(
                  200,
                  actor.ammo[pickup.kind] + WEAPONS[pickup.kind].pickupAmmo,
                );
          if (this.isHuman(actor) && shouldAutoEquipPickup(actor.weapon, pickup.kind)) {
            this.equipWeapon(actor, pickup.kind);
          }
          pickup.readyAt = this.time + (this.config.mode === "tdm" ? 30 : 5);
        } else if (pickup.kind === "ammo") {
          actor.ammo.machinegun = Math.min(200, actor.ammo.machinegun + 50);
          pickup.readyAt = this.time + 40;
        } else {
          actor.power = pickup.kind;
          actor.powerUntil = this.time + 15;
          pickup.readyAt = Infinity;
        }
        if (this.authority || this.isLocal(actor)) {
          this.sound.pickup();
          const label = isWeaponId(pickup.kind)
            ? WEAPONS[pickup.kind].name
            : pickup.kind === "quad"
              ? "4× DAMAGE · 15 SECONDS"
              : pickup.kind === "immortal"
                ? "IMMORTALITY · 15 SECONDS"
                : pickup.kind === "health"
                  ? "+25 HEALTH"
                  : pickup.kind === "armor"
                    ? "+50 ARMOR"
                    : "+50 REPEATER AMMO";
          this.notice(
            label.toUpperCase(),
            pickup.objective ? "power" : "pickup", actor.id,
          );
        }
        break;
      }
    }
  }
  private checkEnd() {
    if (this.ended) return;
    const result = matchResult(
      this.config,
      this.actors,
      this.time,
      this.captureScores,
    );
    if (result) {
      this.ended = true;
      this.result = result;
      this.pause();
      this.onEnd(result);
    } else if (this.time >= this.config.timeLimit && !this.suddenAnnounced) {
      this.suddenAnnounced = true;
      this.notice("SUDDEN DEATH", "power");
    }
  }
  private draw(dt: number, alpha: number, realTime: number) {
    if (this.started && this.player) {
      const m = this.player.motion;
      this.camera.position.lerpVectors(
        this.player.previous,
        new THREE.Vector3(m.x, m.y, m.z),
        alpha,
      );
      this.camera.position.y += this.player.health > 0 ? 0.6 : -0.35;
      this.camera.rotation.order = "YXZ";
      this.camera.rotation.set(
        this.player.health > 0 ? this.input.pitch : -0.08,
        this.player.health > 0 ? this.input.yaw : this.deathLook,
        0,
      );
    } else {
      this.camera.position.copy(this.map.camera.position);
      this.camera.position.x += Math.sin(realTime * 0.1) * 0.7;
      this.camera.lookAt(this.map.camera.target);
    }
    for (const actor of this.actors) {
      if (this.isLocal(actor) || actor.health <= 0 || actor.controlKind === "empty") continue;
      actor.mesh.position.lerpVectors(
        this.isReplica ? this.remoteFrom.get(actor.id) ?? actor.previous : actor.previous,
        new THREE.Vector3(actor.motion.x, actor.motion.y, actor.motion.z),
        this.isReplica ? Math.min(1, Math.max(0, (performance.now() / 1000 - this.receivedAt) * 20)) : alpha,
      );
      actor.mesh.rotation.y = actor.yaw;
      const stride =
        Math.sin(this.time * 13 + actor.id) *
        Math.min(0.55, Math.hypot(actor.motion.vx, actor.motion.vz) * 0.07);
      actor.mesh.getObjectByName("left-leg")!.rotation.x = stride;
      actor.mesh.getObjectByName("right-leg")!.rotation.x = -stride;
      const leftArm = actor.mesh.getObjectByName("left-arm"), rightArm = actor.mesh.getObjectByName("right-arm");
      if (leftArm) leftArm.rotation.x = -stride * 0.3;
      if (rightArm) rightArm.rotation.x = stride * 0.2 - 0.22;
      if (actor.mesh.userData.heldWeapon !== actor.weapon) {
        const held = actor.mesh.getObjectByName("held-weapons");
        held?.children.forEach((model) => {
          model.visible = model.userData.weapon === actor.weapon;
        });
        actor.mesh.userData.heldWeapon = actor.weapon;
      }
      const roleGlow = actor.mesh.getObjectByName(
        "juggernaut-glow",
      ) as JuggernautAura;
      roleGlow.visible =
        this.config.mode === "juggernaut" && actor.id === this.juggernautId;
      if (roleGlow.visible)
        roleGlow.animate(
          this.time,
          this.renderer.domElement.height,
          actor.power,
        );
      const aura = actor.mesh.getObjectByName("aura") as THREE.Mesh;
      aura.visible = Boolean(actor.power) && !roleGlow.visible;
      if (actor.power)
        (aura.material as THREE.MeshBasicMaterial).color.set(
          actor.power === "quad" ? 0xff784c : 0x86b4ff,
        );
    }
    for (const pickup of this.pickups) {
      pickup.mesh.visible = pickup.readyAt <= this.time;
      pickup.mesh.position.y =
        pickup.position.y + Math.sin(realTime * 2 + pickup.position.x) * 0.12;
      pickup.mesh.rotation.y = realTime * (pickup.objective ? 0.65 : 1);
    }
    if (this.isReplica) {
      const ahead = Math.min(.1, Math.max(0, performance.now() / 1000 - this.receivedAt));
      for (const projectile of this.projectiles) {
        projectile.mesh.position.copy(projectile.position);
        if (!projectile.stuck) {
          projectile.mesh.position.addScaledVector(projectile.velocity, ahead);
          if (projectile.kind === "grenade" || projectile.kind === "proximity") projectile.mesh.position.y -= 10 * ahead * ahead;
        }
      }
    }
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const effect = this.effects[i];
      if (this.time > effect.until) {
        this.disposeEffect(effect);
        this.effects.splice(i, 1);
      } else if (effect.explosion) {
        const t = (this.time - effect.start) / (effect.until - effect.start);
        effect.object.scale.setScalar(1 + t * 2);
        (
          (effect.object as THREE.Mesh).material as THREE.MeshBasicMaterial
        ).opacity = (1 - t) * 0.6;
      }
    }
    this.flagVisuals?.draw(this.actors, alpha, this.time);
    this.renderer.info.reset();
    this.renderer.autoClear = true;
    this.renderer.render(this.scene, this.camera);
    if (this.started && !this.ended && this.player?.health > 0) {
      const speed = Math.hypot(this.player.motion.vx, this.player.motion.vz);
      const switchPose = this.weaponSwitch.update(this.player.weapon, dt);
      this.recoil *= Math.exp(-dt * 18);
      this.gun.position.set(
        0.32 + Math.sin(this.time * 7) * 0.006 * speed,
        -0.29 + Math.abs(Math.cos(this.time * 7)) * 0.003 * speed + switchPose.offsetY,
        -0.6 + this.recoil + switchPose.offsetZ,
      );
      this.gun.rotation.x = this.recoil * 0.7 + switchPose.tiltX;
      this.gunModels.forEach(
        (model, id) => (model.visible = id === switchPose.visibleWeapon),
      );
      this.muzzle.visible = this.time < this.muzzleUntil && switchPose.visibleWeapon === this.player.weapon;
      this.renderer.autoClear = false;
      this.renderer.clearDepth();
      this.renderer.render(this.viewScene, this.viewCamera);
    }
    this.drawCalls = this.renderer.info.render.calls;
    this.triangles = this.renderer.info.render.triangles;
  }
  private tracer(
    from: THREE.Vector3,
    to: THREE.Vector3,
    color: number,
    duration: number,
  ) {
    if (this.authority) return;
    const geometry = new THREE.BufferGeometry().setFromPoints([from, to]);
    const line = new THREE.Line(
      geometry,
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.8 }),
    );
    this.scene.add(line);
    this.effects.push({
      object: line,
      start: this.time,
      until: this.time + duration,
    });
  }
  private puff(position: THREE.Vector3, color: number, size: number) {
    this.emit({ type: "impact", point: wireVector(position), color, radius: size });
    if (this.authority) return;
    const mesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(size * 0.4, 0),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
      }),
    );
    mesh.position.copy(position);
    this.scene.add(mesh);
    this.effects.push({
      object: mesh,
      start: this.time,
      until: this.time + 0.22,
      explosion: true,
    });
  }
  private disposeEffect(effect: Effect) {
    this.scene.remove(effect.object);
    const object = effect.object as THREE.Mesh;
    object.geometry.dispose();
    (object.material as THREE.Material).dispose();
  }
  private clearEffects() {
    this.gore?.clear();
    this.effects.forEach((e) => this.disposeEffect(e));
    this.effects = [];
    this.projectiles.forEach((p) => {
      this.scene.remove(p.mesh);
      if (!this.authority) { p.mesh.geometry.dispose(); (p.mesh.material as THREE.Material).dispose(); }
    });
    this.projectiles = [];
  }
  private makeDemon(id: CharacterId = "mordant", skin: CharacterSkinId = "original", teamColor?: string) {
    if (this.authority) return new THREE.Group();
    const group = makeCharacterModel(id, { skin, teamColor });
    const aura = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.15, 1),
      new THREE.MeshBasicMaterial({
        color: 0xff784c,
        wireframe: true,
        transparent: true,
        opacity: 0.2,
      }),
    );
    aura.name = "aura";
    aura.visible = false;
    group.add(aura);
    group.add(new JuggernautAura(group));
    return group;
  }
  private makeGun(id: WeaponId) {
    return makeWeaponModel(id, normalizeCosmetics(this.profile.cosmetics).weaponSkin);
  }
}
