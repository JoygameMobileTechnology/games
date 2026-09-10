import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { FlagMatch, type FlagActor } from "../src/flags.ts";
import { ArenaNavigator } from "../src/navigation.ts";
import { fixture, place, type HeadlessGame } from "./helpers/game-fixture.ts";
import type { FlagMode } from "../src/match.ts";
import type { MapId } from "../src/maps/types.ts";

function takePlayerFlag(game: HeadlessGame, mode: FlagMode) {
  const source = mode === "ctf"
    ? game.map.flags!.bases[1]
    : game.map.flags!.neutral;
  place(game, game.player, source.x, source.y, source.z);
  game.tick();
  const flag = game.flagStates.find((candidate) => candidate.carrierId === 0);
  assert.ok(flag, "the actual player touched and collected the flag");
  return flag;
}

for (const mode of ["ctf", "oneflag"] as const) {
  test(`${mode}: a bot retrieves the off-node Bastion drop before its timeout`, async (t) => {
    const run = await fixture(2, "bastion", mode);
    t.after(() => run.dispose());
    const { game } = run, bot = game.actors[1];
    bot.nextAttack = Infinity;
    bot.difficulty = "Competitive";
    const flag = takePlayerFlag(game, mode);
    // This clear ground is eight units from the original nearest graph node.
    // The old five-unit final-approach condition stranded the bot at that node.
    place(game, game.player, 8, 0.9, 0);
    game.kill(game.player, null);
    game.player.deadAt = 1000;
    assert.equal(flag.status, "dropped");
    const drop = flag.position.clone();
    const deadline = game.time + 25;
    while (game.time < deadline && flag.status === "dropped") game.tick();
    assert.notEqual(flag.status, "dropped", "contact occurs before the 30-second auto-return");
    assert.ok(
      Math.hypot(bot.motion.x - drop.x, bot.motion.z - drop.z) <= 1.15,
      "the bot physically reaches the dropped flag",
    );
    assert.ok(Math.abs(bot.motion.y - drop.y) < 1.4);
    if (mode === "ctf") assert.equal(flag.status, "home");
    else assert.equal(flag.carrierId, bot.id);
  });

  test(`${mode}: an unconnected Conduit roof drop returns home immediately`, async (t) => {
    const run = await fixture(2, "conduit", mode);
    t.after(() => run.dispose());
    const { game } = run;
    game.actors[1].nextAttack = Infinity;
    const flag = takePlayerFlag(game, mode);
    // A carrier killed above a reactor would otherwise strand the flag at y=9.18.
    place(game, game.player, 0, 10, -17);
    game.kill(game.player, null);
    assert.equal(flag.status, "home");
    assert.equal(flag.returnAt, null);
    assert.equal(flag.carrierId, null);
    assert.deepEqual(flag.position.toArray(), flag.home.toArray());
    assert.deepEqual(game.captureScores, [0, 0], "a safety return never scores");
  });
}

for (const [mapId, locations] of [
  ["bastion", [[8, 0.9, 0], [10, 4.9, 0]]],
  ["conduit", [[14, 0.9, -8], [2, 3.9, 0]]],
] as [MapId, number[][]][]) {
  for (const mode of ["ctf", "oneflag"] as const)
    test(`${mapId} ${mode}: reachable ground and upper-deck drops stay where they landed`, async (t) => {
      const run = await fixture(2, mapId, mode);
      t.after(() => run.dispose());
      const { game } = run;
      const bot = game.actors[1];
      bot.health = 0;
      bot.deadAt = 1000;
      bot.collider.setEnabled(false);
      const nav = new ArenaNavigator(game.map, game.world);
      for (const [x, y, z] of locations) {
        game.spawn(game.player);
        const flag = takePlayerFlag(game, mode);
        place(game, game.player, x, y + 1, z);
        game.kill(game.player, null);
        assert.equal(flag.status, "dropped");
        assert.ok(flag.position.distanceTo(new THREE.Vector3(x, y, z)) < 0.02);
        assert.ok(
          game.map.nodes.some((node) => nav.canWalk(node.position, flag.position)),
          "the drop has a real walking connection from the authored graph",
        );
        game.time += 31;
        game.tick();
        assert.equal(flag.status, "home", "the ordinary dropped-flag timer is preserved");
      }
    });
}

for (const mapId of ["bastion", "conduit"] as const)
  test(`${mapId}: defenders and escorts have distinct supported waiting positions`, async (t) => {
    const run = await fixture(10, mapId, "ctf");
    t.after(() => run.dispose());
    const { game } = run, layout = game.map.flags!;
    const nav = new ArenaNavigator(game.map, game.world);
    const actors: FlagActor[] = Array.from({ length: 10 }, (_, id) => ({
      id,
      team: id % 2 as 0 | 1,
      health: 100,
      motion: { x: 50, y: 0.9, z: 50 },
    }));
    const flags = new FlagMatch("ctf", layout);
    for (const team of [0, 1] as const) {
      const guards = [actors[2 + team], actors[8 + team]]
        .map((actor) => flags.order(actor, actors)!);
      assert.ok(guards[0].position.distanceTo(guards[1].position) >= 4);
      for (const guard of guards) {
        assert.equal(guard.arrivalRadius, 1);
        assert.ok(nav.canWalk(layout.bases[team], guard.position));
      }
    }
    for (const mode of ["ctf", "oneflag"] as const) {
      const escortFlags = new FlagMatch(mode, layout);
      const source = mode === "ctf" ? layout.bases[1] : layout.neutral;
      actors[0].motion = { x: source.x, y: source.y, z: source.z };
      escortFlags.update([actors[0]], 0);
      const waiting = actors.filter((actor) => actor.id > 0 && actor.team === 0)
        .map((actor) => escortFlags.order(actor, actors)!);
      for (const order of waiting) {
        assert.equal(order.arrivalRadius, 1);
        const base = mode === "ctf" ? layout.bases[0] : layout.bases[1];
        assert.ok(nav.canWalk(base, order.position));
      }
      for (let i = 0; i < waiting.length; i++)
        for (let j = i + 1; j < waiting.length; j++)
          assert.ok(waiting[i].position.distanceTo(waiting[j].position) >= 2);
    }
  });
