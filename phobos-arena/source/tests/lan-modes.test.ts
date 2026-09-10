import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { Game, type Actor } from "../src/game.ts";
import { defaultConfig, isFlagMode, isTeamMode, type MatchConfig, type Mode } from "../src/match.ts";
import { idleCommand, type ActorAssignment, type GameCommand } from "../src/lan/types.ts";
import type { MapId } from "../src/maps/types.ts";
import { newMotion, STEP } from "../src/rules.ts";

const modes: Mode[] = ["ffa", "duel", "tdm", "ctf", "oneflag", "juggernaut"];
const command = (seq: number, overrides: Partial<GameCommand> = {}): GameCommand => ({ ...idleCommand(seq), ...overrides });

function seedRandom(t: TestContext, initial: number) {
  const previous = Math.random;
  let seed = initial;
  Math.random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  t.after(() => { Math.random = previous; });
}

async function authority(t: TestContext, mode: Mode, mapId: MapId = isFlagMode(mode) ? "bastion" : "ossuary", overrides: Partial<MatchConfig> = {}) {
  const population = mode === "duel" ? 2 : 4;
  const roster: ActorAssignment[] = Array.from({ length: population }, (_, id) => ({
    id, name: id < 2 ? `Remote human ${id}` : `Arena bot ${id}`, controller: id < 2 ? "human" : "bot",
  }));
  const game = await Game.createAuthority({
    mapId,
    config: { ...defaultConfig(mode), population, scoreLimit: 999, timeLimit: 240, botDifficulties: Array(population - 1).fill("Competitive"), ...overrides },
    roster,
    matchId: `lan-modes-${mapId}-${mode}`,
  });
  t.after(() => game.disposeAuthority());
  return game;
}

/** Scenario setup changes position only; contacts, captures and endings run in authority steps. */
function place(game: Game, actor: Actor, point: { x: number; y: number; z: number }) {
  actor.motion = newMotion(point.x, point.y, point.z);
  actor.previous.set(point.x, point.y, point.z);
  actor.body.setTranslation(actor.motion, true);
  actor.body.setNextKinematicTranslation(actor.motion);
}

test("all six LAN modes advance two human input streams while bots retain their own control and empty slots stay absent", async (t) => {
  seedRandom(t, 7123);
  for (const mode of modes) {
    const game = await authority(t, mode);
    const distance = new Map<number, number>();
    game.actors.slice(0, 2).forEach((actor) => { actor.weapon = "melee"; });
    for (let seq = 1; seq <= 240; seq++) {
      const before = game.actors.map((actor) => ({ ...actor.motion }));
      // Even commands addressed to bot slots must not turn their AI into human control.
      game.stepAuthority(new Map(game.actors.map((actor) => [actor.id, command(seq, {
        x: actor.id < 2 ? (actor.id === 0 ? 1 : -1) : 1,
        pitch: 1.3, fire: actor.id >= 2,
      })])));
      game.actors.forEach((actor) => distance.set(actor.id, (distance.get(actor.id) ?? 0)
        + Math.hypot(actor.motion.x - before[actor.id].x, actor.motion.z - before[actor.id].z)));
    }
    const state = game.snapshot();
    assert.equal(state.config.mode, mode);
    assert.equal(state.actors.length, mode === "duel" ? 2 : 4);
    assert.deepEqual(state.actors.slice(0, 2).map((actor) => actor.ack), [240, 240], `${mode}: both remote humans are acknowledged`);
    assert.ok((distance.get(0) ?? 0) > .5 && (distance.get(1) ?? 0) > .5, `${mode}: both human streams move their actors`);
    assert.deepEqual(state.actors.map((actor) => actor.team), isTeamMode(mode) ? [0, 1, 0, 1] : state.actors.map(() => null));
    assert.equal(state.flags.length, mode === "ctf" ? 2 : mode === "oneflag" ? 1 : 0);
    assert.equal(state.ended, false);
    if (mode !== "duel") {
      assert.ok(game.actors.slice(2).some((actor) => (distance.get(actor.id) ?? 0) > .5), `${mode}: a real bot navigates alongside humans`);
      assert.deepEqual(state.actors.slice(2).map((actor) => [actor.controller, actor.ack]), [["bot", 0], ["bot", 0]]);
      const absent = game.actors[3];
      game.setController({ id: absent.id, name: "Disconnected", controller: "empty" });
      const motion = { ...absent.motion };
      for (let seq = 241; seq <= 252; seq++) game.stepAuthority(new Map([[absent.id, command(seq, { x: 1, fire: true, jump: true, respawn: true })]]));
      const after = game.snapshot();
      assert.deepEqual(absent.motion, motion, `${mode}: packets cannot move an empty slot`);
      assert.equal(absent.collider.isEnabled(), false);
      assert.equal(after.actors[3].controller, "empty");
      assert.equal(after.actors[3].health, 0);
      assert.equal(after.actors[2].controller, "bot");
      if (mode === "juggernaut") assert.notEqual(after.juggernautId, absent.id, "an absent slot cannot keep the role");
    }
    game.disposeAuthority();
  }
});

test("a remote Team II human captures and wins through real CTF and One Flag contacts on both LAN flag arenas", async (t) => {
  seedRandom(t, 8301);
  for (const mapId of ["bastion", "conduit"] as const) {
    for (const mode of ["ctf", "oneflag"] as const) {
      const game = await authority(t, mode, mapId, { scoreLimit: 1 });
      // Keep the other participants out of this short contact scenario, without removing their controllers.
      game.actors.forEach((actor, i) => {
        place(game, actor, { x: 60 + i * 6, y: 30, z: 60 });
        actor.weapon = "melee";
        actor.enemy = null;
        actor.nextThink = actor.nextAttack = Infinity;
      });
      const carrier = game.actors[1];
      const flag = game.flagStates.find((item) => item.id === (mode === "ctf" ? 0 : "neutral"))!;
      place(game, carrier, flag.home);
      game.world.step();
      game.stepAuthority(new Map([[carrier.id, command(1)]]));
      const pickedUp = game.snapshot();
      assert.equal(pickedUp.flags.find((item) => item.id === flag.id)?.carrierId, 1, `${mapId}/${mode}: remote slot picks up the objective`);
      assert.deepEqual(pickedUp.captureScores, [0, 0]);
      assert.equal(pickedUp.ended, false);

      // Carrying the objective across the map is scenario positioning; scoring still requires the real goal contact.
      const goal = game.map.flags!.bases[mode === "ctf" ? 1 : 0];
      place(game, carrier, { x: goal.x, y: goal.y + 3, z: goal.z });
      game.world.step();
      game.stepAuthority(new Map([[carrier.id, command(2)]]));
      assert.deepEqual(game.snapshot().captureScores, [0, 0], "horizontal alignment alone must not count as a capture");
      place(game, carrier, goal);
      game.world.step();
      game.stepAuthority(new Map([[carrier.id, command(3)]]));
      const ended = game.snapshot();
      assert.deepEqual(ended.captureScores, [0, 1]);
      assert.equal(ended.actors[1].captures, 1);
      assert.equal(ended.actors[0].captures, 0);
      assert.deepEqual(ended.result, { winnerId: null, winnerTeam: 1, draw: false, reason: "score" });
      assert.equal(ended.ended, true);
      assert.equal(game.active, false);
      assert.ok(ended.events.some((event) => event.type === "notice" && event.text.includes("CAPTURES")));
      const tick = ended.tick;
      game.stepAuthority(new Map([[carrier.id, command(4, { x: 1 })]]));
      assert.equal(game.snapshot().tick, tick, "a completed authority cannot advance or capture again");
      game.disposeAuthority();
    }
  }
});

test("LAN non-flag modes resolve individual, aggregate team and timed Juggernaut scores through the authority loop", async (t) => {
  seedRandom(t, 904);
  for (const mode of ["ffa", "duel", "tdm", "juggernaut"] as const) {
    const game = await authority(t, mode, "ossuary", { scoreLimit: 3 });
    let winner = 1;
    if (mode === "tdm") {
      game.actors[1].kills = 2;
      game.actors[3].kills = 1;
    } else if (mode === "juggernaut") {
      winner = game.juggernautId!;
      game.actors[winner].possession = 3 - 3 * STEP;
    } else game.actors[winner].kills = 3;
    const initialPossession = game.actors[winner].possession;
    for (let tick = 0; tick < 6 && !game.ended; tick++) game.stepAuthority(new Map());
    const state = game.snapshot();
    assert.equal(state.ended, true, `${mode}: reaching the score target ends the match`);
    assert.deepEqual(state.result, {
      winnerId: mode === "tdm" ? null : winner,
      winnerTeam: mode === "tdm" ? 1 : null,
      draw: false,
      reason: "score",
    });
    if (mode === "tdm") assert.ok(state.actors.every((actor) => actor.kills < 3), "team score can win before any individual reaches the target");
    if (mode === "juggernaut") {
      assert.ok(state.actors[winner].possession > initialPossession, "the live holder actually accumulates time");
      assert.ok(state.actors[winner].possession >= 3 - 1e-7);
    }
    game.disposeAuthority();
  }
});

test("LAN Duel reaches its real one-minute target, keeps a tie running, then settles the authoritative leader", async (t) => {
  const game = await authority(t, "duel", "ossuary", { timeLimit: 60 });
  game.actors.forEach((actor) => { actor.weapon = "melee"; });
  for (let tick = 0; tick < Math.ceil(61 / STEP); tick++) game.stepAuthority(new Map());
  const overtime = game.snapshot();
  assert.ok(overtime.time >= 60);
  assert.equal(overtime.ended, false, "a tied room remains live after the configured target");
  assert.deepEqual(overtime.actors.map((actor) => actor.kills), [0, 0]);
  assert.equal(overtime.result, null);
  game.actors[1].kills = 1; // Establish a lead; the production time rule must perform settlement.
  game.stepAuthority(new Map());
  const ended = game.snapshot();
  assert.equal(ended.ended, true);
  assert.deepEqual(ended.result, { winnerId: 1, winnerTeam: null, draw: false, reason: "time" });
  assert.equal(ended.matchId, "lan-modes-ossuary-duel");
});
