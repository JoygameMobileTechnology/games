import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { buildCrucible } from "../src/maps/crucible.ts";
import { buildReliquary } from "../src/maps/reliquary.ts";
import { getWeaponSlots } from "../src/weapon-slots.ts";
import {
  arenaFixture,
  checkCoverage,
  checkWalks,
  supported,
} from "./helpers/arena-validation.ts";

for (const [id, build, roster] of [
  [
    "crucible",
    buildCrucible,
    ["melee", "machinegun", "shotgun", "grenade", "bfg"],
  ],
  [
    "reliquary",
    buildReliquary,
    ["melee", "machinegun", "rocket", "plasma", "proximity"],
  ],
] as const) {
  test(`${id}: eight supported spawns and all resources belong to a connected three-level graph`, async (t) => {
    const f = await arenaFixture(build);
    t.after(f.dispose);
    checkCoverage(f);
    assert.deepEqual(getWeaponSlots(f.map.pickups), roster);
    assert.ok(f.map.nodes.some((n) => n.position.y > 8));
    assert.ok(f.map.nodes.some((n) => n.position.y > 4 && n.position.y < 5));
  });
  test(`${id}: every walking edge is continuously supported and traversed by the gameplay capsule`, async (t) => {
    const f = await arenaFixture(build);
    t.after(f.dispose);
    checkWalks(f);
  });
}

test("Crucible freight lift has a clear 4x4 shaft and supported alternate docks on both floors", async (t) => {
  const f = await arenaFixture(buildCrucible);
  t.after(f.dispose);
  const lift = f.map.mechanisms![0];
  assert.equal(lift.kind, "platform");
  assert.ok(lift.size.x >= 4 && lift.size.z >= 4);
  for (const y of [0, 2, 4, 6, 8]) {
    assert.equal(
      f.world.intersectionWithShape(
        new THREE.Vector3(0, y + 0.9, -18),
        { x: 0, y: 0, z: 0, w: 1 },
        new RAPIER.Capsule(0.5, 0.35),
        RAPIER.QueryFilterFlags.ONLY_FIXED,
      ),
      null,
    );
  }
  for (const y of [0, 8])
    assert.ok(supported(f.world, new THREE.Vector3(0, y + 0.9, -14)));
  assert.equal(f.map.pickups.filter((p) => p.kind === "bfg").length, 1);
});

test("Reliquary gate and portals leave their approach/arrival capsules clear", async (t) => {
  const f = await arenaFixture(buildReliquary);
  t.after(f.dispose);
  const door = f.map.mechanisms![0];
  assert.equal(door.kind, "door");
  assert.equal(door.triggerRadius, 4);
  assert.ok(door.size.z >= 5 && door.size.y >= 4);
  for (const portal of f.map.teleporters)
    for (const position of [portal.position, portal.destination]) {
      assert.ok(supported(f.world, position));
      assert.equal(
        f.world.intersectionWithShape(
          position,
          { x: 0, y: 0, z: 0, w: 1 },
          new RAPIER.Capsule(0.5, 0.35),
          RAPIER.QueryFilterFlags.ONLY_FIXED,
        ),
        null,
      );
    }
});
