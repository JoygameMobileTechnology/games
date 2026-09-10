import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import type { ArenaLayout, NavEdge, NavNode } from "./maps/types";

interface RouteState {
  goal: string;
  goalPosition: THREE.Vector3;
  nodes: NavNode[];
  cursor: number;
  sampledAt: number;
  sampledPosition: THREE.Vector3;
}

/** Authored traversal graph: links describe real corridors, ramps and shortcuts. */
export class ArenaNavigator {
  readonly nodes: Map<string, NavNode>;
  private adjacency = new Map<string, NavEdge[]>();
  private routes = new Map<string, NavNode[]>();
  private actors = new Map<number, RouteState>();
  constructor(
    readonly layout: ArenaLayout,
    readonly world: RAPIER.World,
  ) {
    this.nodes = new Map(layout.nodes.map((node) => [node.id, node]));
    for (const edge of layout.edges) {
      if (!this.nodes.has(edge.from) || !this.nodes.has(edge.to))
        throw new Error(`Invalid navigation edge ${edge.from} → ${edge.to}`);
      const list = this.adjacency.get(edge.from) || [];
      list.push(edge);
      this.adjacency.set(edge.from, list);
    }
  }
  reset(actorId: number) {
    this.actors.delete(actorId);
  }
  nearest(position: THREE.Vector3, requireWalk = false) {
    const ordered = [...this.nodes.values()].sort(
      (a, b) =>
        this.distance(a.position, position) -
        this.distance(b.position, position),
    );
    return requireWalk
      ? ordered.find((node) => this.canWalk(position, node.position))
      : ordered[0];
  }
  private distance(a: THREE.Vector3, b: THREE.Vector3) {
    return Math.hypot(a.x - b.x, (a.y - b.y) * 2, a.z - b.z);
  }
  path(from: string, to: string): NavNode[] {
    const key = `${from}|${to}`;
    const cached = this.routes.get(key);
    if (cached) return cached;
    const scores = new Map<string, number>([[from, 0]]),
      previous = new Map<string, string>(),
      open = new Set([from]);
    while (open.size) {
      const current = [...open].reduce((a, b) =>
        scores.get(a)! < scores.get(b)! ? a : b,
      );
      open.delete(current);
      if (current === to) {
        const ids = [to];
        while (previous.has(ids[0])) ids.unshift(previous.get(ids[0])!);
        const result = ids.map((id) => this.nodes.get(id)!);
        this.routes.set(key, result);
        return result;
      }
      for (const edge of this.adjacency.get(current) || []) {
        const cost =
          edge.kind === "teleport"
            ? 3
            : edge.kind === "pad"
              ? 10
              : this.nodes
                  .get(current)!
                  .position.distanceTo(this.nodes.get(edge.to)!.position);
        const next = scores.get(current)! + cost;
        if (next < (scores.get(edge.to) ?? Infinity)) {
          scores.set(edge.to, next);
          previous.set(edge.to, current);
          open.add(edge.to);
        }
      }
    }
    return [];
  }
  cost(position: THREE.Vector3, goal: THREE.Vector3) {
    const from = this.nearest(position),
      to = this.nearest(goal);
    if (!from || !to) return Infinity;
    const path = this.path(from.id, to.id);
    if (!path.length) return Infinity;
    return path
      .slice(1)
      .reduce(
        (sum, node, index) =>
          sum + node.position.distanceTo(path[index].position),
        position.distanceTo(from.position),
      );
  }
  steer(
    actorId: number,
    position: THREE.Vector3,
    goal: THREE.Vector3,
    time: number,
  ) {
    let state = this.actors.get(actorId);
    const movedGoal =
      !state || state.goalPosition.distanceToSquared(goal) > 0.25;
    const destination = movedGoal
      ? (this.nearest(goal, true) ?? this.nearest(goal))
      : this.nodes.get(state!.goal);
    if (!destination) {
      this.actors.delete(actorId);
      return position;
    }
    const stuck =
      state &&
      time - state.sampledAt > 2.5 &&
      position.distanceTo(state.sampledPosition) < 0.5;
    if (!state || state.goal !== destination.id || stuck) {
      const start = this.nearest(position, true);
      const route = start ? this.path(start.id, destination.id) : [];
      state = {
        goal: destination.id,
        goalPosition: goal.clone(),
        nodes: route,
        cursor: 0,
        sampledAt: time,
        sampledPosition: position.clone(),
      };
      this.actors.set(actorId, state);
    }
    if (movedGoal) state.goalPosition.copy(goal);
    if (time - state.sampledAt > 2.5) {
      state.sampledAt = time;
      state.sampledPosition.copy(position);
    }
    while (state.cursor < state.nodes.length) {
      const next = state.nodes[state.cursor].position;
      if (
        Math.hypot(next.x - position.x, next.z - position.z) >= 0.65 ||
        Math.abs(next.y - position.y) >= 0.85
      )
        break;
      state.cursor++;
    }
    return (
      state.nodes[state.cursor]?.position ||
      (state.nodes.length ? destination.position : position)
    );
  }
  /** A supported direct walk for a full player body, including ordinary ramps.
   * Ground normals place the capsule above a slope rather than sweeping its feet
   * through the ramp. These probes never add bodies or mutate the physics world.
   */
  canWalk(from: THREE.Vector3, to: THREE.Vector3) {
    const distance = from.distanceTo(to);
    if (!Number.isFinite(distance) || distance > 128) return false;
    const count = Math.max(1, Math.ceil(distance / 0.3));
    const rotation = { x: 0, y: 0, z: 0, w: 1 };
    const capsule = new RAPIER.Capsule(0.5, 0.35);
    let previous: THREE.Vector3 | null = null;
    for (let index = 0; index <= count; index++) {
      const sample = from.clone().lerp(to, index / count);
      const floor = this.world.castRayAndGetNormal(
        new RAPIER.Ray(
          { x: sample.x, y: sample.y + 0.45, z: sample.z },
          { x: 0, y: -1, z: 0 },
        ),
        2,
        true,
        RAPIER.QueryFilterFlags.ONLY_FIXED,
      );
      if (!floor || floor.normal.y < 0.5) return false;
      // The small allowance crosses pad lips and ramp seams below the gameplay
      // controller's 0.28 m autostep; walls and overhead beams still block the body.
      const standingY =
        sample.y + 0.45 - floor.timeOfImpact +
        0.5 + 0.35 / floor.normal.y + 0.1;
      // Do not connect stacked floors or cut across a drop merely because a ray
      // eventually found ground. Small authored steps and ramp profiles remain valid.
      if (Math.abs(standingY - sample.y) > 0.45) return false;
      sample.y = standingY;
      if (
        this.world.intersectionWithShape(
          sample, rotation, capsule, RAPIER.QueryFilterFlags.ONLY_FIXED,
        )
      ) return false;
      if (
        previous && this.world.castShape(
          previous, rotation, sample.clone().sub(previous), capsule,
          0, 1, true, RAPIER.QueryFilterFlags.ONLY_FIXED,
        )
      ) return false;
      previous = sample;
    }
    return true;
  }
  clearLine(from: THREE.Vector3, to: THREE.Vector3) {
    const direction = to.clone().sub(from),
      length = direction.length();
    if (length < 0.05) return true;
    direction.divideScalar(length);
    for (const offset of [-0.32, 0, 0.32]) {
      const start = from
        .clone()
        .add(new THREE.Vector3(direction.z * offset, 0, -direction.x * offset));
      if (
        this.world.castRay(
          new RAPIER.Ray(start, direction),
          length,
          true,
          RAPIER.QueryFilterFlags.ONLY_FIXED,
        )
      )
        return false;
    }
    return true;
  }
  /** Only use free combat strafing where there is body clearance and nearby floor. */
  safeStrafe(position: THREE.Vector3, x: number, z: number) {
    const length = Math.hypot(x, z);
    if (length < 0.001) return false;
    const end = position
      .clone()
      .add(new THREE.Vector3((x / length) * 1.8, 0, (z / length) * 1.8));
    if (!this.clearLine(position, end)) return false;
    if (
      this.world.castShape(
        position,
        { x: 0, y: 0, z: 0, w: 1 },
        end.clone().sub(position),
        new RAPIER.Capsule(0.5, 0.35),
        0,
        1,
        true,
        RAPIER.QueryFilterFlags.ONLY_FIXED,
      )
    )
      return false;
    for (let i = 1; i <= 9; i++) {
      const t = i / 9;
      const sample = position.clone().lerp(end, t);
      sample.y += 0.35;
      const hit = this.world.castRay(
        new RAPIER.Ray(sample, { x: 0, y: -1, z: 0 }),
        1.8,
        true,
        RAPIER.QueryFilterFlags.ONLY_FIXED,
      );
      if (!hit) return false;
    }
    return true;
  }
}
