import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { FlagMatch, type FlagActor } from "../src/flags.ts";
import { defaultConfig } from "../src/match.ts";
import { fixture, place } from "./helpers/game-fixture.ts";
import type { FlagLayout } from "../src/maps/types.ts";

const v = (x: number, z = 0) => new THREE.Vector3(x, 0.9, z);
const layout: FlagLayout = {
  bases: [v(-10), v(10)],
  neutral: v(0),
  teamSpawns: [[v(-8)], [v(8)]],
};
const actor = (id: number, x: number): FlagActor => ({
  id,
  team: (id % 2) as 0 | 1,
  health: 100,
  motion: { x, y: 0.9, z: 0 },
});

test("CTF steals, blocks capture while own flag is away, returns on friendly touch and captures", () => {
  const flags = new FlagMatch("ctf", layout);
  const players = [actor(0, 10), actor(1, -10)];
  assert.equal(
    flags.update(players, 0).filter((e) => e.type === "pickup").length,
    2,
  );
  players[0].motion.x = -10;
  players[1].motion.x = 0;
  assert.equal(
    flags.update(players, 1).some((e) => e.type === "capture"),
    false,
  );
  assert.deepEqual(flags.scores, [0, 0]);
  assert.equal(flags.drop(1, v(-10), 2)[0].type, "drop");
  const events = flags.update(players, 2);
  assert.deepEqual(
    events.map((e) => e.type),
    ["return", "capture"],
  );
  assert.deepEqual(flags.scores, [1, 0]);
  assert.ok(
    flags.states.every(
      (flag) => flag.status === "home" && flag.carrierId === null,
    ),
  );
});

test("dropped flags can be stolen again, return after thirty seconds and immediately return from void", () => {
  const flags = new FlagMatch("ctf", layout);
  const players = [actor(0, 10), actor(2, 0)];
  flags.update(players, 0);
  flags.drop(0, v(0), 5);
  players[0].motion.x = 4;
  flags.update(players, 6);
  assert.equal(flags.carriedBy(2)?.id, 1);
  flags.drop(2, v(3), 10);
  players[0].motion.x = 6;
  players[1].motion.x = 0;
  flags.update(players, 39.999);
  assert.equal(flags.states[1].status, "dropped");
  flags.update(players, 40);
  assert.equal(flags.states[1].status, "home");
  players[0].motion.x = 10;
  flags.update(players, 41);
  flags.drop(0, v(10), 42, true);
  assert.equal(flags.states[1].status, "home");
  assert.equal(flags.states[1].returnAt, null);
});

test("death fallback drops a flag and a missing carrier safely returns it", () => {
  const flags = new FlagMatch("ctf", layout);
  const player = actor(0, 10);
  flags.update([player], 0);
  player.health = 0;
  flags.update([player], 2);
  assert.equal(flags.states[1].status, "dropped");
  assert.equal(flags.states[1].returnAt, 32);
  player.health = 100;
  flags.update([player], 3);
  flags.update([], 4);
  assert.equal(flags.states[1].status, "home");
});

test("One Flag carries only the neutral flag and scores at the opposing base", () => {
  const flags = new FlagMatch("oneflag", layout);
  const players = [actor(0, 0), actor(2, 0)];
  flags.update(players, 0);
  assert.equal(flags.carriedBy(0)?.id, "neutral");
  assert.equal(flags.carriedBy(2), undefined);
  players[0].motion.x = -10;
  flags.update(players, 1);
  assert.deepEqual(flags.scores, [0, 0]);
  players[0].motion.x = 10;
  assert.equal(flags.update(players, 2).at(-1)?.type, "capture");
  assert.deepEqual(flags.scores, [1, 0]);
  assert.equal(flags.states[0].status, "home");
  assert.deepEqual(
    flags.states[0].position.toArray(),
    layout.neutral.toArray(),
  );
  flags.update(players, 3);
  assert.equal(flags.carriedBy(2)?.id, "neutral");
  flags.drop(2, v(6), 4);
  players[1].motion.x = 0;
  flags.update(players, 34);
  assert.equal(
    flags.states[0].carrierId,
    2,
    "a returned neutral flag is immediately available to a waiting player",
  );
});

test("flag orders assign defense and attack while intercepting carriers and retrieving dropped own flags", () => {
  const flags = new FlagMatch("ctf", layout);
  const players = [actor(0, -8), actor(1, 5), actor(2, -8), actor(3, 8)];
  assert.deepEqual(
    flags.order(players[0], players)?.position.toArray(),
    layout.bases[1].toArray(),
  );
  assert.equal(flags.order(players[2], players)?.position.x, -5);
  players[1].motion.x = -10;
  flags.update(players, 1);
  assert.equal(flags.order(players[0], players)?.enemyId, 1);
  players[1].motion.x = 0;
  flags.drop(1, v(0), 2);
  assert.equal(flags.order(players[2], players)?.position.x, 0);
});

test("actual flag matches spawn five per side and reject incompatible maps without mutating a match", async () => {
  const run = await fixture(10, "bastion", "ctf");
  try {
    const { game } = run;
    assert.equal(game.actors.length, 10);
    for (const a of game.actors) {
      assert.equal(a.team, a.id % 2);
      assert.equal(Math.sign(a.motion.z), a.team === 0 ? -1 : 1);
    }
    assert.equal(
      new Set(game.actors.map((a) => `${a.motion.x},${a.motion.z}`)).size,
      10,
    );
    const count = game.world.colliders.len();
    game.start({ ...defaultConfig("tdm"), population: 10 });
    assert.equal(
      game.world.colliders.len(),
      count,
      "flags never add colliders or weapon targets",
    );
    assert.equal(game.flagStates.length, 0);
    game.pause();
    game.selectMap("ossuary");
    assert.throws(() => game.start(defaultConfig("ctf")), /does not support/);
    assert.equal(game.config.mode, "tdm");
  } finally {
    run.dispose();
  }
});

test("actual game tracks player captures, death drops, void returns and cleans objective state on restart", async () => {
  const run = await fixture(2, "bastion", "ctf");
  try {
    const { game } = run;
    const bases = game.map.flags!.bases;
    const player = game.player,
      bot = game.actors[1];
    bot.health = 0;
    bot.deadAt = 1000;
    place(game, player, bases[1].x, bases[1].y, bases[1].z);
    game.tick();
    assert.equal(game.flagStates[1].carrierId, 0);
    place(game, player, bases[0].x, bases[0].y, bases[0].z);
    game.tick();
    assert.deepEqual(game.captureScores, [1, 0]);
    assert.equal(player.captures, 1);
    assert.equal(player.kills, 0);
    place(game, player, bases[1].x, bases[1].y, bases[1].z);
    game.tick();
    game.kill(player, null);
    assert.equal(game.flagStates[1].status, "dropped");
    assert.ok(Math.abs(game.flagStates[1].returnAt! - game.time - 30) < 1e-6);
    game.time += 30;
    game.tick();
    assert.equal(game.flagStates[1].status, "home");
    game.spawn(player);
    place(game, player, bases[1].x, bases[1].y, bases[1].z);
    game.tick();
    place(game, player, 80, -30, 80);
    game.tick();
    assert.equal(game.flagStates[1].status, "home");
    game.start({ ...defaultConfig("oneflag"), population: 2 });
    assert.deepEqual(game.captureScores, [0, 0]);
    assert.equal(game.player.captures, 0);
    assert.equal(game.flagStates.length, 1);
    assert.equal(game.flagStates[0].id, "neutral");
  } finally {
    run.dispose();
  }
});

test("bots complete real CTF return trips and One Flag deliveries on both authored maps", async () => {
  const random = Math.random;
  try {
    for (const map of ["bastion", "conduit"] as const) {
      for (const mode of ["ctf", "oneflag"] as const) {
        let seed = 739;
        Math.random = () =>
          (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
        const run = await fixture(2, map, mode);
        try {
          const { game } = run;
          game.start({
            ...defaultConfig(mode),
            population: 2,
            scoreLimit: 1,
            timeLimit: 600,
            botDifficulties: ["Competitive"],
          });
          // Only the human waits at its authored spawn. The bot uses unmodified
          // intent, navigation, collisions, combat and flag touches throughout.
          for (let tick = 0; tick < 60 * 120 && !game.ended; tick++) {
            game.respawnRequested = true;
            game.tick();
          }
          assert.deepEqual(
            game.captureScores,
            [0, 1],
            `${map} ${mode} bot completes the objective route`,
          );
          assert.equal(game.actors[1].captures, 1);
          assert.equal(run.outcomes.length, 1);
          assert.equal(run.outcomes[0].winnerTeam, 1);
          game.tick();
          assert.equal(run.outcomes.length, 1);
          assert.ok(
            game.actors.every((a) =>
              [
                a.motion.x,
                a.motion.y,
                a.motion.z,
                a.motion.vx,
                a.motion.vy,
                a.motion.vz,
              ].every(Number.isFinite),
            ),
          );
        } finally {
          run.dispose();
        }
      }
    }
  } finally {
    Math.random = random;
  }
});

test("a full offline roster scores captures while fighting on the raised neutral-flag route", async () => {
  const random = Math.random;
  let seed = 813;
  Math.random = () =>
    (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  const run = await fixture(6, "conduit", "oneflag");
  try {
    const { game } = run;
    game.start({
      ...defaultConfig("oneflag"),
      scoreLimit: 99,
      timeLimit: 600,
      botDifficulties: Array(5).fill("Competitive"),
    });
    for (
      let tick = 0;
      tick < 120 * 120 && game.captureScores[0] + game.captureScores[1] === 0;
      tick++
    ) {
      game.respawnRequested = true;
      game.tick();
    }
    assert.ok(
      game.captureScores[0] + game.captureScores[1] > 0,
      "six actors produce a capture through real bot play",
    );
    assert.ok(
      game.actors.some((a) => a.kills > 0),
      "combat stays enabled during the objective run",
    );
  } finally {
    run.dispose();
    Math.random = random;
  }
});

test("ten-player flag matches on both maps retain finite movement and reachable grounded drops", async () => {
  const random = Math.random;
  try {
    for (const map of ["bastion", "conduit"] as const) {
      for (const mode of ["ctf", "oneflag"] as const) {
        let seed = 901;
        Math.random = () =>
          (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
        const run = await fixture(10, map, mode);
        try {
          const { game } = run;
          for (let tick = 0; tick < 10 * 120; tick++) {
            game.respawnRequested = true;
            game.tick();
          }
          assert.equal(game.actors.length, 10);
          assert.equal(game.world.characterControllers.size, 10);
          assert.ok(
            game.actors.every((a) =>
              [
                a.motion.x,
                a.motion.y,
                a.motion.z,
                a.motion.vx,
                a.motion.vy,
                a.motion.vz,
              ].every(Number.isFinite),
            ),
          );
          game.start({ ...defaultConfig(mode), population: 10 });
          for (const bot of game.actors.slice(1)) {
            bot.health = 0;
            bot.deadAt = 1000;
            bot.collider.setEnabled(false);
          }
          const source =
            mode === "ctf" ? game.map.flags!.bases[1] : game.map.flags!.neutral;
          place(game, game.player, source.x, source.y, source.z);
          game.tick();
          const carried = game.flagStates.find((flag) => flag.carrierId === 0)!;
          assert.ok(carried);
          const landing = game.map.flags!.neutral;
          place(game, game.player, landing.x, landing.y + 8, landing.z);
          game.kill(game.player, null);
          assert.equal(carried.status, "dropped");
          const floor = game.world.castRay(
            new RAPIER.Ray(carried.position, { x: 0, y: -1, z: 0 }),
            3,
            true,
            RAPIER.QueryFilterFlags.ONLY_FIXED,
          );
          assert.ok(
            floor && Math.abs(floor.timeOfImpact - 0.9) < 0.02,
            "airborne death places the flag at reachable floor height",
          );
          game.spawn(game.player);
          place(
            game,
            game.player,
            carried.position.x,
            carried.position.y,
            carried.position.z,
          );
          game.tick();
          assert.equal(
            carried.carrierId,
            0,
            "the grounded drop can actually be touched and reclaimed",
          );
        } finally {
          run.dispose();
        }
      }
    }
  } finally {
    Math.random = random;
  }
});
