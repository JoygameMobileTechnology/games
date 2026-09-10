import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { buildBastion } from "../src/maps/bastion.ts";
import { buildConduit } from "../src/maps/conduit.ts";
import { ArenaNavigator } from "../src/navigation.ts";
import type { ArenaLayout } from "../src/maps/types.ts";

const ready = RAPIER.init(),
  STEP = 1 / 120;
const rotation = { x: 0, y: 0, z: 0, w: 1 };
const builders = { bastion: buildBastion, conduit: buildConduit };
async function fixture(id: keyof typeof builders) {
  await ready;
  const world = new RAPIER.World({ x: 0, y: -20, z: 0 });
  world.timestep = STEP;
  const scene = new THREE.Scene(),
    map = builders[id](scene, world);
  world.step();
  const walkMap = {
    ...map,
    edges: map.edges.filter((edge) => edge.kind === "walk"),
  };
  return {
    world,
    map,
    navigator: new ArenaNavigator(walkMap, world),
    dispose() {
      const geometry = new Set<THREE.BufferGeometry>(),
        materials = new Set<THREE.Material>();
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.geometry) geometry.add(mesh.geometry);
        for (const material of Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material])
          if (material) materials.add(material);
      });
      geometry.forEach((value) => value.dispose());
      materials.forEach((value) => value.dispose());
      world.free();
    },
  };
}

function walker(world: RAPIER.World, start: THREE.Vector3) {
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
      start.x,
      start.y,
      start.z,
    ),
  );
  const collider = world.createCollider(
    RAPIER.ColliderDesc.capsule(0.5, 0.35),
    body,
  );
  const controller = world.createCharacterController(0.015);
  controller.setMaxSlopeClimbAngle(Math.PI / 3);
  controller.setMinSlopeSlideAngle(Math.PI / 3);
  controller.enableAutostep(0.28, 0.3, false);
  controller.enableSnapToGround(0.16);
  const position = start.clone();
  world.step();
  return {
    position,
    controller,
    move(delta: THREE.Vector3, flying = false) {
      if (flying) controller.disableSnapToGround();
      else controller.enableSnapToGround(0.16);
      controller.computeColliderMovement(
        collider,
        delta,
        RAPIER.QueryFilterFlags.ONLY_FIXED,
      );
      position.add(controller.computedMovement());
      body.setNextKinematicTranslation(position);
      world.step();
    },
    dispose() {
      world.removeCharacterController(controller);
      world.removeRigidBody(body);
      world.step();
    },
  };
}

/** Vertex capacities prove the two routes do not merely share one mandatory choke. */
function independentFlagRoutes(map: ArenaLayout): number {
  const capacity = new Map<string, Map<string, number>>();
  const put = (from: string, to: string, amount: number) => {
    const values = capacity.get(from) ?? new Map<string, number>();
    values.set(to, amount);
    capacity.set(from, values);
    if (!capacity.has(to)) capacity.set(to, new Map());
    if (!capacity.get(to)!.has(from)) capacity.get(to)!.set(from, 0);
  };
  const source = "team-0-flag",
    target = "team-1-flag";
  for (const node of map.nodes)
    put(
      `${node.id}:in`,
      `${node.id}:out`,
      node.id === source || node.id === target ? 10 : 1,
    );
  for (const edge of map.edges.filter((edge) => edge.kind === "walk"))
    put(`${edge.from}:out`, `${edge.to}:in`, 10);
  let flow = 0;
  while (flow < 2) {
    const start = `${source}:out`,
      end = `${target}:in`,
      previous = new Map<string, string>();
    const queue = [start],
      seen = new Set(queue);
    for (let i = 0; i < queue.length && !seen.has(end); i++) {
      for (const [next, amount] of capacity.get(queue[i]) ?? [])
        if (amount > 0 && !seen.has(next)) {
          seen.add(next);
          previous.set(next, queue[i]);
          queue.push(next);
        }
    }
    if (!seen.has(end)) break;
    for (let at = end; at !== start;) {
      const before = previous.get(at)!;
      capacity.get(before)!.set(at, capacity.get(before)!.get(at)! - 1);
      capacity.get(at)!.set(before, (capacity.get(at)!.get(before) ?? 0) + 1);
      at = before;
    }
    flow++;
  }
  return flow;
}

for (const id of ["bastion", "conduit"] as const) {
  test(`${id}: ten safe flag spawns, mirrored resources and two independent ordinary flag routes`, async (t) => {
    const f = await fixture(id);
    t.after(() => f.dispose());
    const { map, navigator, world } = f,
      flags = map.flags!;
    assert.equal(map.spawns.length, 10);
    assert.deepEqual(
      flags.teamSpawns.map((points) => points.length),
      [5, 5],
    );
    assert.equal(
      new Set(map.nodes.map((node) => node.id)).size,
      map.nodes.length,
    );
    assert.ok(map.powerPosition.distanceTo(flags.neutral) >= 3);
    assert.equal(
      independentFlagRoutes(map),
      2,
      "both teams have two vertex-independent walk routes to the other flag",
    );
    for (const from of map.nodes)
      for (const to of map.nodes)
        assert.ok(
          navigator.path(from.id, to.id).length,
          `${from.id} cannot walk to ${to.id}`,
        );
    const positions = [
      ...map.nodes.map((node) => node.position),
      ...map.spawns,
      ...flags.bases,
      flags.neutral,
      ...map.pickups.map((pickup) =>
        pickup.position.clone().add(new THREE.Vector3(0, 0.2, 0)),
      ),
      map.powerPosition.clone().add(new THREE.Vector3(0, 0.2, 0)),
    ];
    for (const position of positions) {
      assert.ok(
        world.castRay(
          new RAPIER.Ray(position, { x: 0, y: -1, z: 0 }),
          1.25,
          true,
        ),
        `unsupported ${position.toArray()}`,
      );
      assert.equal(
        world.intersectionWithShape(
          position,
          rotation,
          new RAPIER.Capsule(0.5, 0.35),
        ),
        null,
        `obstructed ${position.toArray()}`,
      );
      assert.ok(
        map.nodes.some((node) => node.position.distanceTo(position) < 1),
        `no node at ${position.toArray()}`,
      );
    }
    const roles = new Set(
      map.pickups
        .filter((p) => !["health", "armor", "ammo"].includes(p.kind))
        .map((p) => p.kind),
    );
    assert.equal(roles.size, 3);
    for (const pickup of map.pickups) {
      const mirror = pickup.position.clone();
      mirror.z *= -1;
      assert.ok(
        map.pickups.some(
          (other) =>
            other.kind === pickup.kind &&
            other.position.distanceTo(mirror) < 1e-6,
        ),
        `${pickup.kind} has no mirrored counterpart`,
      );
    }
    for (let i = 0; i < 5; i++) {
      const north = flags.teamSpawns[0][i],
        south = flags.teamSpawns[1][i];
      assert.deepEqual([north.x, north.y, -north.z], south.toArray());
      const cost = (start: THREE.Vector3, end: THREE.Vector3) =>
        navigator.cost(start, end);
      assert.ok(
        Math.abs(cost(north, flags.neutral) - cost(south, flags.neutral)) <
          1e-6,
        "neutral flag approach distances match",
      );
      assert.ok(
        Math.abs(
          cost(north, map.powerPosition) - cost(south, map.powerPosition),
        ) < 1e-6,
        "power approach distances match",
      );
      for (const role of roles) {
        const nearest = (start: THREE.Vector3) =>
          Math.min(
            ...map.pickups
              .filter((p) => p.kind === role)
              .map((p) => cost(start, p.position)),
          );
        assert.ok(
          Math.abs(nearest(north) - nearest(south)) < 1e-6,
          `${role} approach differs between spawn pair ${i}`,
        );
      }
    }
  });

  test(`${id}: every walk link is continuously supported and traversable by the gameplay controller`, async (t) => {
    const f = await fixture(id);
    t.after(() => f.dispose());
    const failures: string[] = [];
    for (const edge of f.map.edges.filter((edge) => edge.kind === "walk")) {
      const from = f.navigator.nodes.get(edge.from)!.position,
        to = f.navigator.nodes.get(edge.to)!.position;
      const distance = from.distanceTo(to),
        samples = Math.max(1, Math.ceil(distance / 0.2));
      for (let i = 0; i <= samples; i++) {
        const p = from.clone().lerp(to, i / samples);
        if (
          !f.world.castRay(new RAPIER.Ray(p, { x: 0, y: -1, z: 0 }), 1.25, true)
        ) {
          failures.push(`${edge.from} → ${edge.to}: gap at ${p.toArray()}`);
          break;
        }
      }
      const actor = walker(f.world, from);
      let reached = false;
      try {
        for (let i = 0; i < 12; i++) actor.move(new THREE.Vector3(0, -0.06, 0));
        for (let i = 0; i < Math.ceil(distance / 4 / STEP) * 2 + 120; i++) {
          const delta = to.clone().sub(actor.position),
            horizontal = Math.hypot(delta.x, delta.z);
          if (horizontal < 0.22 && Math.abs(delta.y) < 0.35) {
            reached = true;
            break;
          }
          if (actor.position.y < Math.min(from.y, to.y) - 1) break;
          const speed = Math.min(4 * STEP, horizontal);
          actor.move(
            new THREE.Vector3(
              horizontal ? (delta.x / horizontal) * speed : 0,
              -0.002,
              horizontal ? (delta.z / horizontal) * speed : 0,
            ),
          );
        }
        if (!reached)
          failures.push(
            `${edge.from} → ${edge.to}: stopped at ${actor.position.toArray()}`,
          );
      } finally {
        actor.dispose();
      }
    }
    assert.deepEqual(failures, []);
  });

  if (id === "bastion")
    test(`${id}: optional pad shortcuts physically reach their supported landings`, async (t) => {
      const f = await fixture(id);
      t.after(() => f.dispose());
      for (const pad of f.map.jumpPads) {
        const actor = walker(
          f.world,
          pad.position.clone().add(new THREE.Vector3(0, 0.85, 0)),
        );
        const velocity = pad.velocity.clone();
        let intercepted = false;
        try {
          for (let i = 0; i < 12; i++)
            actor.move(new THREE.Vector3(0, -0.06, 0));
          for (let i = 0; i < Math.ceil(pad.flightTime / STEP); i++) {
            velocity.y -= 20 * STEP;
            actor.move(velocity.clone().multiplyScalar(STEP), velocity.y > 0);
            for (let c = 0; c < actor.controller.numComputedCollisions(); c++) {
              const normal = actor.controller.computedCollision(c)!.normal1;
              if (normal.y < -0.5 || Math.abs(normal.y) < 0.7)
                intercepted = true;
            }
          }
          assert.equal(intercepted, false, `${pad.id} hits a wall or ceiling`);
          assert.ok(
            Math.hypot(
              actor.position.x - pad.landing.x,
              actor.position.z - pad.landing.z,
            ) < 0.8,
          );
          assert.ok(Math.abs(actor.position.y - pad.landing.y) < 0.45);
        } finally {
          actor.dispose();
        }
      }
    });
}
