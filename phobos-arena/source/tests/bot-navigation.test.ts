import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { ArenaNavigator } from "../src/navigation.ts";
import { fixture, place } from "./helpers/game-fixture.ts";

test("Bastion bots recover from all four outer ramp pockets using supported body-clear entries", async (t) => {
  for (const side of [-1, 1]) {
    for (const sign of [-1, 1]) {
      const f = await fixture(2, "bastion", "ctf");
      try {
        const { game } = f;
        // Keep combat and the inactive player's body away from the route under test.
        place(game, game.player, 0, -100, 0);
        game.kill(game.player, null);
        game.player.deadAt = Infinity;
        const actor = game.actors[1];
        const start = new THREE.Vector3(side * 26, 0.88, sign * 25);
        place(game, actor, start.x, start.y, start.z);
        actor.motion.grounded = true;
        game.world.step();
        const nav = new ArenaNavigator(game.map, game.world);
        const oldEntry = new THREE.Vector3(side * 14, 0.9, sign * 25);
        assert.equal(nav.clearLine(start, oldEntry), true);
        assert.equal(nav.canWalk(start, oldEntry), false,
          "seeing below the ramp does not prove that the player's head fits");
        const connector = nav.nearest(start, true);
        assert.ok(connector?.id.endsWith("outer-recovery"));
        assert.equal(nav.canWalk(start, connector.position), true);
        let reachedInnerGround = false;
        for (let tick = 0; tick < 8 * 120; tick++) {
          game.tick();
          if (Math.abs(actor.motion.x) < 18.5) reachedInnerGround = true;
          assert.ok(actor.motion.y > game.map.killY);
        }
        assert.equal(reachedInnerGround, true,
          `bot did not leave the ramp pocket on side ${side}, end ${sign}`);
        assert.ok(start.distanceTo(new THREE.Vector3(
          actor.motion.x, actor.motion.y, actor.motion.z,
        )) > 10, "normal Game movement continues onto its flag route");
      } finally {
        f.dispose();
      }
    }
  }
});

test("direct walk checks preserve every authored ordinary ramp and pad approach", async () => {
  for (const id of ["ossuary", "rift", "bastion", "conduit", "crucible", "reliquary"] as const) {
    const f = await fixture(2, id);
    try {
      const { game } = f;
      // The door is a deliberate temporary obstruction, rather than a bad graph edge.
      const movingDoor = (game as any).mechanisms?.parts.find(
        (part: any) => part.definition.kind === "door",
      );
      if (movingDoor) {
        movingDoor.collider.setTranslation(
          movingDoor.definition.position.clone().add(movingDoor.definition.travel),
        );
      }
      game.world.step();
      const nav = new ArenaNavigator(game.map, game.world);
      const failures = game.map.edges.filter((edge) => edge.kind === "walk")
        .filter((edge) => !nav.canWalk(
          nav.nodes.get(edge.from)!.position, nav.nodes.get(edge.to)!.position,
        ))
        .map((edge) => `${edge.from} → ${edge.to}`);
      assert.deepEqual(failures, [], `${id}: ${failures.join(", ")}`);
    } finally {
      f.dispose();
    }
  }
});

test("unreachable or unsupported entry returns no connector and never steers into masonry", async (t) => {
  const f = await fixture(2, "conduit", "ctf");
  t.after(() => f.dispose());
  const nav = new ArenaNavigator(f.game.map, f.game.world);
  for (const point of [new THREE.Vector3(0, 0.9, 17), new THREE.Vector3(40, 0.9, 0)]) {
    assert.equal(nav.nearest(point, true), undefined);
    for (const time of [0, 1, 3, 6])
      assert.deepEqual(nav.steer(90, point, f.game.map.flags!.bases[0], time), point);
  }
  assert.equal(nav.canWalk(new THREE.Vector3(0, 9.18, -17),
    f.game.map.flags!.bases[0]), false, "a reactor roof is not connected to the floor below");
});

test("direct walk rejects a body-height obstacle that center rays miss", async (t) => {
  const f = await fixture(2, "bastion", "ctf");
  t.after(() => f.dispose());
  const { game } = f;
  const nav = new ArenaNavigator(game.map, game.world);
  const start = new THREE.Vector3(0, 0.9, -5), end = new THREE.Vector3(0, 0.9, 5);
  assert.equal(nav.canWalk(start, end), true);
  game.world.createCollider(RAPIER.ColliderDesc.cuboid(2, 0.15, 0.3)
    .setTranslation(0, 1.6, 0));
  game.world.step();
  assert.equal(nav.clearLine(start, end), true);
  assert.equal(nav.canWalk(start, end), false);
});
