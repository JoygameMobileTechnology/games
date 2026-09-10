import * as THREE from "three";
import type { FlagLayout } from "./maps/types";
import type { FlagMode, Team } from "./match";

export type FlagId = Team | "neutral";
export interface FlagState {
  id: FlagId;
  team: Team | null;
  home: THREE.Vector3;
  position: THREE.Vector3;
  status: "home" | "carried" | "dropped";
  carrierId: number | null;
  returnAt: number | null;
}
export interface FlagActor {
  id: number;
  team: Team | null;
  health: number;
  motion: { x: number; y: number; z: number };
}
export interface FlagEvent {
  type: "pickup" | "drop" | "return" | "capture";
  flag: FlagId;
  actorId: number | null;
  team: Team | null;
}
export interface FlagOrder {
  position: THREE.Vector3;
  enemyId: number | null;
  carrying: boolean;
  /** Tactical staging may wait nearby; pickups and captures require contact. */
  arrivalRadius?: number;
}
const enemyTeam = (team: Team): Team => (team === 0 ? 1 : 0);
const positionOf = (actor: FlagActor) =>
  new THREE.Vector3(actor.motion.x, actor.motion.y, actor.motion.z);
const touching = (actor: FlagActor, position: THREE.Vector3) =>
  Math.hypot(actor.motion.x - position.x, actor.motion.z - position.z) <=
    1.15 && Math.abs(actor.motion.y - position.y) <= 1.4;

/** Objective state has no colliders: flags cannot trigger weapons or block shots. */
export class FlagMatch {
  readonly scores: [number, number] = [0, 0];
  readonly states: FlagState[];
  constructor(
    readonly mode: FlagMode,
    readonly layout: FlagLayout,
  ) {
    const ids: FlagId[] = mode === "ctf" ? [0, 1] : ["neutral"];
    this.states = ids.map((id) => {
      const home = (
        id === "neutral" ? layout.neutral : layout.bases[id]
      ).clone();
      return {
        id,
        team: id === "neutral" ? null : id,
        home,
        position: home.clone(),
        status: "home",
        carrierId: null,
        returnAt: null,
      };
    });
  }
  carriedBy(id: number) {
    return this.states.find((flag) => flag.carrierId === id);
  }
  private returnHome(flag: FlagState) {
    flag.position.copy(flag.home);
    flag.status = "home";
    flag.carrierId = null;
    flag.returnAt = null;
  }
  drop(
    actorId: number,
    position: THREE.Vector3,
    time: number,
    outOfBounds = false,
  ): FlagEvent[] {
    const flag = this.carriedBy(actorId);
    if (!flag) return [];
    if (outOfBounds) {
      this.returnHome(flag);
      return [
        { type: "return", flag: flag.id, actorId: null, team: flag.team },
      ];
    }
    flag.position.copy(position);
    flag.status = "dropped";
    flag.carrierId = null;
    flag.returnAt = time + 30;
    return [{ type: "drop", flag: flag.id, actorId, team: flag.team }];
  }
  update(actors: readonly FlagActor[], time: number): FlagEvent[] {
    const events: FlagEvent[] = [];
    for (const flag of this.states) {
      if (flag.status === "carried") {
        const carrier = actors.find((actor) => actor.id === flag.carrierId);
        if (!carrier || carrier.health <= 0) {
          events.push(
            ...this.drop(
              flag.carrierId!,
              flag.position.clone(),
              time,
              !carrier,
            ),
          );
        } else flag.position.copy(positionOf(carrier));
      }
      if (
        flag.status === "dropped" &&
        flag.returnAt !== null &&
        time + 1e-8 >= flag.returnAt
      ) {
        this.returnHome(flag);
        events.push({
          type: "return",
          flag: flag.id,
          actorId: null,
          team: flag.team,
        });
      }
      if (flag.status === "carried") continue;
      for (const actor of actors) {
        if (
          actor.health <= 0 ||
          actor.team === null ||
          !touching(actor, flag.position)
        )
          continue;
        if (flag.team === actor.team) {
          if (flag.status === "dropped") {
            this.returnHome(flag);
            events.push({
              type: "return",
              flag: flag.id,
              actorId: actor.id,
              team: actor.team,
            });
          }
          continue;
        }
        if (this.carriedBy(actor.id)) continue;
        flag.status = "carried";
        flag.carrierId = actor.id;
        flag.returnAt = null;
        flag.position.copy(positionOf(actor));
        events.push({
          type: "pickup",
          flag: flag.id,
          actorId: actor.id,
          team: actor.team,
        });
        break;
      }
    }
    for (const flag of this.states) {
      if (flag.carrierId === null) continue;
      const carrier = actors.find(
        (actor) => actor.id === flag.carrierId && actor.health > 0,
      );
      if (!carrier || carrier.team === null) continue;
      const goal =
        this.layout.bases[
          this.mode === "ctf" ? carrier.team : enemyTeam(carrier.team)
        ];
      const ownSafe =
        this.mode !== "ctf" ||
        this.states.find((candidate) => candidate.team === carrier.team)
          ?.status === "home";
      if (!ownSafe || !touching(carrier, goal)) continue;
      this.scores[carrier.team]++;
      events.push({
        type: "capture",
        flag: flag.id,
        actorId: carrier.id,
        team: carrier.team,
      });
      this.returnHome(flag);
    }
    return events;
  }
  /** Carriers run the objective; team roles defend, intercept or attack authored bases. */
  order(actor: FlagActor, actors: readonly FlagActor[]): FlagOrder | null {
    if (actor.team === null || actor.health <= 0) return null;
    const team = actor.team,
      opponent = enemyTeam(team),
      carried = this.carriedBy(actor.id);
    const own = this.states.find((flag) => flag.team === team);
    const enemyCarrierFlag = this.mode === "ctf" ? own : this.states[0];
    const enemyCarrier = actors.find(
      (candidate) =>
        candidate.health > 0 &&
        candidate.team !== team &&
        candidate.id === enemyCarrierFlag?.carrierId,
    );
    if (enemyCarrier)
      return {
        position: positionOf(enemyCarrier),
        enemyId: enemyCarrier.id,
        carrying: Boolean(carried),
      };
    if (own?.status === "dropped")
      return {
        position: own.position.clone(),
        enemyId: null,
        carrying: Boolean(carried),
      };
    if (carried)
      return {
        position:
          this.layout.bases[this.mode === "ctf" ? team : opponent].clone(),
        enemyId: null,
        carrying: true,
      };
    if (this.mode === "ctf" && Math.floor(actor.id / 2) % 3 === 1) {
      const guard = this.layout.bases[team].clone();
      const inward = this.layout.neutral.clone().sub(guard).setY(0).normalize();
      guard.addScaledVector(inward, 5);
      // A five-player team has two defenders. Give each a separate waiting slot.
      const lateral = new THREE.Vector3(inward.z, 0, -inward.x);
      guard.addScaledVector(lateral, Math.floor(actor.id / 6) % 2 ? 2 : -2);
      const invader = actors
        .filter(
          (candidate) =>
            candidate.health > 0 &&
            candidate.team !== team &&
            positionOf(candidate).distanceTo(this.layout.bases[team]) < 12,
        )
        .sort(
          (a, b) =>
            positionOf(a).distanceTo(guard) - positionOf(b).distanceTo(guard),
        )[0];
      return {
        position: invader ? positionOf(invader) : guard,
        enemyId: invader?.id ?? null,
        carrying: false,
        arrivalRadius: invader ? undefined : 1,
      };
    }
    const target =
      this.mode === "oneflag"
        ? this.states[0]
        : this.states.find((flag) => flag.team === opponent)!;
    if (target.carrierId !== null) {
      const destination =
        this.layout.bases[this.mode === "ctf" ? team : opponent].clone();
      const inward = this.layout.neutral.clone().sub(destination).setY(0).normalize();
      destination.addScaledVector(
        new THREE.Vector3(inward.z, 0, -inward.x),
        (Math.floor(actor.id / 2) - 2) * 2,
      );
      return {
        position: destination,
        enemyId: null,
        carrying: false,
        arrivalRadius: 1,
      };
    }
    return {
      position: target.position.clone(),
      enemyId: null,
      carrying: false,
    };
  }
}

interface VisualActor extends FlagActor {
  previous: THREE.Vector3;
  yaw: number;
}
export class FlagVisuals {
  private groups: {
    flag: FlagState;
    flagMesh: THREE.Group;
    stand: THREE.Group;
  }[] = [];
  private goals: THREE.Group[] = [];
  constructor(
    readonly scene: THREE.Scene,
    states: readonly FlagState[],
    colors: readonly [string, string],
    layout: FlagLayout,
  ) {
    for (const flag of states) {
      const color = flag.team === null ? "#f2ead4" : colors[flag.team];
      const material = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.7,
        roughness: 0.45,
        side: THREE.DoubleSide,
      });
      const metal = new THREE.MeshStandardMaterial({
        color: "#aead9c",
        metalness: 0.75,
        roughness: 0.35,
      });
      const group = new THREE.Group();
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.05, 1.65, 5),
        metal,
      );
      pole.position.y = 0.4;
      group.add(pole);
      const cloth = new THREE.Mesh(
        new THREE.PlaneGeometry(0.9, 0.55),
        material,
      );
      cloth.position.set(0.44, 0.9, 0);
      group.add(cloth);
      const mark = new THREE.MeshBasicMaterial({
        color: "#151518",
        side: THREE.DoubleSide,
      });
      for (let stripe = 0; stripe < (flag.team === 1 ? 2 : 1); stripe++) {
        const glyph = new THREE.Mesh(
          new THREE.PlaneGeometry(0.065, 0.32),
          mark,
        );
        glyph.position.set(0.37 + stripe * 0.17, 0.9, 0.008);
        if (flag.team === null) glyph.rotation.z = Math.PI / 4;
        group.add(glyph);
      }
      const stand = new THREE.Group();
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.9, 0.055, 5, 28),
        material,
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = -0.78;
      stand.add(ring);
      stand.position.copy(flag.home);
      scene.add(group, stand);
      this.groups.push({ flag, flagMesh: group, stand });
    }
    // One Flag has no colored home flags, so each scoring base needs its own
    // permanent team marker. Roman bars match the HUD's I/II team identities.
    if (states.some((flag) => flag.id === "neutral")) {
      for (const team of [0, 1] as const) {
        const goal = new THREE.Group();
        const material = new THREE.MeshBasicMaterial({ color: colors[team] });
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(1.15, 0.055, 5, 32),
          material,
        );
        ring.rotation.x = Math.PI / 2;
        ring.position.y = -0.79;
        goal.add(ring);
        const beacon = new THREE.Mesh(
          new THREE.TorusGeometry(0.55, 0.045, 5, 24),
          material,
        );
        beacon.position.y = 1.8;
        goal.add(beacon);
        for (let stripe = 0; stripe <= team; stripe++) {
          const bar = new THREE.Mesh(
            new THREE.BoxGeometry(0.07, 0.65, 0.07),
            material,
          );
          bar.position.set((stripe - team / 2) * 0.24, 1.8, 0);
          goal.add(bar);
        }
        goal.position.copy(layout.bases[team]);
        const inward = layout.neutral.clone().sub(goal.position);
        goal.rotation.y = Math.atan2(inward.x, inward.z);
        scene.add(goal);
        this.goals.push(goal);
      }
    }
  }
  draw(actors: readonly VisualActor[], alpha: number, time: number) {
    for (const { flag, flagMesh } of this.groups) {
      const carrier = actors.find((actor) => actor.id === flag.carrierId);
      flagMesh.visible = carrier?.id !== 0;
      if (carrier) {
        flagMesh.position.lerpVectors(
          carrier.previous,
          positionOf(carrier),
          alpha,
        );
        flagMesh.position.add(
          new THREE.Vector3(
            Math.sin(carrier.yaw) * 0.45,
            0.7,
            Math.cos(carrier.yaw) * 0.45,
          ),
        );
        flagMesh.rotation.y = carrier.yaw;
      } else {
        flagMesh.position.copy(flag.position);
        flagMesh.position.y += Math.sin(time * 2) * 0.06;
        flagMesh.rotation.y = Math.sin(time * 0.7) * 0.2;
      }
    }
  }
  dispose() {
    const geometries = new Set<THREE.BufferGeometry>(),
      materials = new Set<THREE.Material>();
    for (const root of [
      ...this.groups.flatMap(({ flagMesh, stand }) => [flagMesh, stand]),
      ...this.goals,
    ]) {
      this.scene.remove(root);
      root.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.geometry) geometries.add(mesh.geometry);
        const list = Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material];
        list.forEach((material) => {
          if (material) materials.add(material);
        });
      });
    }
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    this.groups = [];
    this.goals = [];
  }
}
