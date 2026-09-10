import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { ArenaNavigator } from "../src/navigation.ts";
import { STEP, stepMotion } from "../src/rules.ts";
import { fixture, place } from "./helpers/game-fixture.ts";

test("flag traffic passes head-on bodies in a real Conduit corridor", async (t) => {
  const f = await fixture(4, "conduit", "ctf");
  t.after(() => f.dispose());
  const { game } = f;
  const [a, b] = game.actors.slice(1);
  game.kill(game.player, null);
  game.kill(game.actors[3], null);
  place(game, a, 12, 0.88, -5);
  place(game, b, 12, 0.88, 5);
  const nav = new ArenaNavigator(game.map, game.world);
  let closest = Infinity;
  for (let tick = 0; tick < 4 / STEP; tick++) {
    for (const [actor, direction] of [[a, 1], [b, -1]] as const) {
      const intent = (game as any).flagTraffic(actor, nav, 12 - actor.motion.x, direction * 15 - actor.motion.z);
      stepMotion(actor.motion, { ...intent, forwardX: 0, forwardZ: direction, jump: false }, tick * STEP, STEP);
      (game as any).moveActor(actor);
    }
    game.world.step();
    closest = Math.min(closest, Math.hypot(a.motion.x - b.motion.x, a.motion.z - b.motion.z));
    assert.ok([a, b].every(actor => actor.motion.x > 7.6 && actor.motion.x < 17), "yield stays inside the actual corridor boundaries");
    assert.ok(a.motion.y > 0.8 && b.motion.y > 0.8, "yield stays on supported ground");
  }
  assert.ok(a.motion.z > 5 && b.motion.z < -5, "both actors passed and continued their original routes");
  assert.ok(closest > 0.65, "living bodies remain solid");
});

test("flag traffic steps around a stationary player without changing its target", async (t) => {
  const f = await fixture(2, "conduit", "oneflag");
  t.after(() => f.dispose());
  const { game } = f, bot = game.actors[1];
  place(game, game.player, 12, 0.88, 0);
  place(game, bot, 12, 0.88, -4);
  bot.target.set(12, 0.9, 10);
  const target = bot.target.clone(), nav = new ArenaNavigator(game.map, game.world);
  for (let tick = 0; tick < 3 / STEP; tick++) {
    const intent = (game as any).flagTraffic(bot, nav, target.x - bot.motion.x, target.z - bot.motion.z);
    stepMotion(bot.motion, { ...intent, forwardX: 0, forwardZ: 1, jump: false }, tick * STEP, STEP);
    (game as any).moveActor(bot);
    game.world.step();
  }
  assert.ok(bot.motion.z > 5, "bot makes progress beyond the blocking player");
  assert.deepEqual(bot.target, target, "traffic does not retarget objectives");
  assert.equal(game.player.motion.x, 12);
  assert.equal(game.player.motion.z, 0);
});

for (const map of ["bastion", "conduit"] as const) {
  test(`${map}: duplicate CTF defenders settle in separate guard positions`, async (t) => {
    let seed = 907;
    t.mock.method(Math, "random", () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    const f = await fixture(10, map, "ctf");
    t.after(() => f.dispose());
    const { game } = f, guards = [game.actors[2], game.actors[8]];
    for (const actor of game.actors) {
      if (guards.includes(actor)) { actor.nextAttack = Infinity; actor.difficulty = "Competitive"; }
      else { game.kill(actor, null); actor.deadAt = Infinity; }
    }
    const base = game.map.flags!.bases[0];
    guards.forEach((actor, index) => place(game, actor, index ? 0.5 : -0.5, 0.88, base.z + 1));
    let atRest: THREE.Vector3[] = [];
    for (let tick = 0; tick < 10 / STEP; tick++) {
      game.tick();
      if (tick === Math.round(7 / STEP)) atRest = guards.map(a => new THREE.Vector3(a.motion.x, a.motion.y, a.motion.z));
    }
    guards.forEach((actor, index) => {
      const order = (game as any).flags.order(actor, game.actors);
      const actual = new THREE.Vector3(actor.motion.x, actor.motion.y, actor.motion.z);
      assert.ok(actual.distanceTo(order.position) < 1.4, "defender reached its own guard position");
      assert.ok(actual.distanceTo(atRest[index]) < 0.25, "defender waits instead of pushing a shared point");
    });
    assert.ok(Math.hypot(guards[0].motion.x - guards[1].motion.x, guards[0].motion.z - guards[1].motion.z) > 2);
  });
}
