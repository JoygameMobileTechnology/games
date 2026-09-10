import assert from "node:assert/strict";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import type { ArenaLayout } from "../../src/maps/types.ts";
import { ArenaNavigator } from "../../src/navigation.ts";

const ready = RAPIER.init();
const dt = 1 / 120;
const identity = { x: 0, y: 0, z: 0, w: 1 };
export async function arenaFixture(
  build: (scene: THREE.Scene, world: RAPIER.World) => ArenaLayout,
) {
  await ready;
  const scene = new THREE.Scene(),
    world = new RAPIER.World({ x: 0, y: -20, z: 0 });
  world.timestep = dt;
  const map = build(scene, world);
  world.step();
  return {
    scene,
    world,
    map,
    nav: new ArenaNavigator(map, world),
    dispose: () => world.free(),
  };
}
export function supported(world: RAPIER.World, p: THREE.Vector3) {
  return world.castRay(
    new RAPIER.Ray(p, { x: 0, y: -1, z: 0 }),
    1.25,
    true,
    RAPIER.QueryFilterFlags.ONLY_FIXED,
  );
}
export function checkCoverage(f: Awaited<ReturnType<typeof arenaFixture>>) {
  const { map, nav, world } = f;
  assert.equal(map.spawns.length, 8);
  const resources = [
    ...map.pickups.map((item) => item.position),
    map.powerPosition,
  ];
  for (let i = 0; i < resources.length; i++)
    for (let j = i + 1; j < resources.length; j++)
      assert.ok(
        resources[i].distanceTo(resources[j]) >= 1.8,
        `Resources ${i}/${j} overlap`,
      );
  for (const [i, spawn] of map.spawns.entries())
    for (const [j, position] of resources.entries())
      assert.ok(
        spawn.distanceTo(position) >= 2,
        `Spawn ${i} touches resource ${j}`,
      );
  assert.equal(new Set(map.nodes.map((n) => n.id)).size, map.nodes.length);
  for (const from of map.nodes)
    for (const to of map.nodes)
      assert.ok(
        nav.path(from.id, to.id).length,
        `${from.id} cannot reach ${to.id}`,
      );
  for (const node of map.nodes) {
    assert.ok(supported(world, node.position), `${node.id} unsupported`);
    assert.equal(
      world.intersectionWithShape(
        node.position,
        identity,
        new RAPIER.Capsule(0.5, 0.35),
        RAPIER.QueryFilterFlags.ONLY_FIXED,
      ),
      null,
      `${node.id} overlaps masonry`,
    );
  }
  for (const p of [
    ...map.spawns,
    ...map.pickups.map((i) => i.position),
    map.powerPosition,
  ]) {
    const node = nav.nearest(p)!;
    assert.ok(
      node && node.position.distanceTo(p) < 0.3,
      `Item/spawn ${p.toArray()} has no exact node`,
    );
  }
}
export function checkWalks(f: Awaited<ReturnType<typeof arenaFixture>>) {
  const { map, nav, world } = f;
  const failures: string[] = [];
  for (const edge of map.edges.filter((e) => e.kind === "walk")) {
    const a = nav.nodes.get(edge.from)!.position,
      target = nav.nodes.get(edge.to)!.position;
    const label = `${edge.from} -> ${edge.to}`;
    const distance = a.distanceTo(target);
    const samples = Math.max(1, Math.ceil(distance / 0.2));
    for (let i = 0; i <= samples; i++)
      if (!supported(world, a.clone().lerp(target, i / samples))) {
        failures.push(`${label}: floor gap`);
        break;
      }
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
        a.x,
        a.y,
        a.z,
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
    const current = a.clone();
    const move = (delta: THREE.Vector3) => {
      controller.computeColliderMovement(
        collider,
        delta,
        RAPIER.QueryFilterFlags.ONLY_FIXED,
      );
      current.add(controller.computedMovement());
      body.setNextKinematicTranslation(current);
      world.step();
    };
    world.step();
    for (let i = 0; i < 12; i++) move(new THREE.Vector3(0, -0.06, 0));
    let reached = false;
    for (let tick = 0; tick < (distance / 4 / dt) * 2 + 120; tick++) {
      const delta = target.clone().sub(current),
        horizontal = Math.hypot(delta.x, delta.z);
      if (horizontal < 0.22 && Math.abs(delta.y) < 0.35) {
        reached = true;
        break;
      }
      if (current.y < Math.min(a.y, target.y) - 1) break;
      const step = Math.min(4 * dt, horizontal);
      move(
        new THREE.Vector3(
          horizontal ? (delta.x / horizontal) * step : 0,
          -0.002,
          horizontal ? (delta.z / horizontal) * step : 0,
        ),
      );
    }
    if (!reached)
      failures.push(
        `${label}: stopped ${current.toArray().map((n) => n.toFixed(2))}`,
      );
    world.removeCharacterController(controller);
    world.removeRigidBody(body);
    world.step();
  }
  assert.deepEqual(failures, [], failures.join("\n"));
}
