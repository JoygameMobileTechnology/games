import test from "node:test";
import assert from "node:assert/strict";
import { STEP } from "../src/rules.ts";
import { areEnemies, type Mode } from "../src/match.ts";
import type { Actor } from "../src/game.ts";
import { fixture, place } from "./helpers/game-fixture.ts";

test("killed actors stop blocking movement and become solid again after respawn", async (t) => {
  const f = await fixture(2);
  t.after(() => f.dispose());
  const { game } = f;
  const [walker, blocker] = game.actors;
  const move = (game as unknown as { moveActor: (actor: Actor) => void })
    .moveActor.bind(game);
  place(game, blocker, 0, 0.9, 0);
  const walkThrough = () => {
    place(game, walker, 0, 0.9, 2);
    game.world.step();
    for (let tick = 0; tick < 48; tick++) {
      walker.motion.vz = -8;
      walker.motion.vy = -0.1;
      move(walker);
      game.world.step();
    }
    return walker.motion.z;
  };

  const livingStop = walkThrough();
  assert.ok(livingStop > 0.5, `the living opponent blocks the capsule (z=${livingStop})`);
  game.kill(blocker, walker);
  assert.equal(blocker.collider.isEnabled(), false);
  const deadStop = walkThrough();
  assert.ok(
    deadStop < -1,
    `the disabled corpse must not leave an invisible movement obstacle (z=${deadStop})`,
  );
  game.spawn(blocker);
  place(game, blocker, 0, 0.9, 0);
  assert.equal(blocker.collider.isEnabled(), true);
  assert.ok(walkThrough() > 0.5, "respawning restores player collision");
});

const nonFlagModes = ["ffa", "duel", "tdm", "juggernaut"] as const satisfies readonly Mode[];

for (const [index, mode] of nonFlagModes.entries()) {
  test(`${mode} bots retain navigation, enemy selection and real combat`, async (t) => {
    let seed = 9100 + index;
    t.mock.method(Math, "random", () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    });
    const f = await fixture(mode === "duel" ? 2 : 4, "ossuary", mode);
    t.after(() => f.dispose());
    const { game } = f;
    game.config.scoreLimit = 999;
    const starts = game.actors.map((actor) => ({ ...actor.motion }));
    const moved = new Set<number>();
    const acquiredEnemy = new Set<number>();
    let damageOccurred = false;
    let botFired = false;
    let holderWasHunted = false;
    assert.deepEqual(game.flagStates, [], "non-flag modes have no flag objectives");

    for (let tick = 0; tick < 24 / STEP; tick++) {
      if (game.player.health <= 0) game.respawnRequested = true;
      const healthBefore = game.actors.map((actor) => actor.health);
      game.tick();
      for (const actor of game.actors) {
        const m = actor.motion;
        assert.ok(
          [m.x, m.y, m.z, m.vx, m.vy, m.vz, actor.target.x, actor.target.y, actor.target.z]
            .every(Number.isFinite),
          `actor ${actor.id} keeps finite motion and navigation targets`,
        );
        assert.ok(m.y > 0.7, `actor ${actor.id} remains supported in the enclosed arena`);
        assert.ok(Math.abs(m.x) < 28 && Math.abs(m.z) < 28, "walls contain movement");
        if (actor.health < healthBefore[actor.id]) damageOccurred = true;
        if (actor.id === 0) continue;
        if (Object.values(actor.lastShot).some((time) => time > 0)) botFired = true;
        if (Math.hypot(m.x - starts[actor.id].x, m.z - starts[actor.id].z) > 2)
          moved.add(actor.id);
        if (actor.enemy && actor.enemy.health > 0) {
          assert.ok(areEnemies(game.config, actor, actor.enemy), "bots never select a teammate");
          acquiredEnemy.add(actor.id);
          if (mode === "juggernaut" && actor.id !== game.juggernautId && actor.enemy.id === game.juggernautId)
            holderWasHunted = true;
        }
      }
    }

    assert.equal(moved.size, game.actors.length - 1, "every bot leaves its spawn area");
    assert.ok(acquiredEnemy.size > 0, "bots acquire real opponents");
    assert.ok(botFired, "real weapon simulation fires shots, including outside audio range");
    assert.ok(damageOccurred || game.actors.some((actor) => actor.deaths > 0), "combat damages a player");
    assert.equal(game.ended, false, "the bounded run stays within its round limits");
    if (mode === "juggernaut") {
      assert.ok(holderWasHunted, "hunters select the active role holder");
      assert.ok(game.actors.some((actor) => actor.possession > 0), "the holder continues earning points");
    }
  });
}
