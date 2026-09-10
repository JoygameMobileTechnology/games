import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { Game, type Actor } from "../src/game.ts";
import { defaultConfig, type Mode } from "../src/match.ts";
import { idleCommand, type ActorAssignment, type GameCommand } from "../src/lan/types.ts";
import { newMotion, STEP } from "../src/rules.ts";
import type { MapId } from "../src/maps/types.ts";
import type { Profile } from "../src/profile.ts";

const profile = (): Profile => ({ name: "Client", settings: { sensitivity: 1, fov: 95, railAuto: true, shotgunAuto: true, volume: 0, resolution: 1, crosshair: "cross", crosshairColor: "#fff", gore: false }, stats: { matches: 0, wins: 0, kills: 0, deaths: 0, tournaments: 0, tournamentWins: 0, tournamentDraws: 0 } });
async function authority(t: TestContext, mapId: MapId = "ossuary", mode: Mode = "ffa", roster?: ActorAssignment[]) {
  roster ??= [0, 1, 2, 3].map((id) => ({ id, name: `Human ${id}`, controller: "human" }));
  const game = await Game.createAuthority({ mapId, config: { ...defaultConfig(mode), population: roster.length, scoreLimit: 99 }, roster, matchId: `test-${mapId}-${mode}` });
  t.after(() => game.disposeAuthority());
  return game;
}
function place(game: Game, actor: Actor, x: number, y: number, z: number) {
  actor.motion = newMotion(x, y, z);
  actor.previous.set(x, y, z);
  actor.body.setTranslation(actor.motion, true);
  actor.body.setNextKinematicTranslation(actor.motion);
  actor.yaw = actor.pitch = 0;
  actor.nextThink = actor.nextAttack = Infinity;
  actor.enemy = null;
}
function lane(game: Game) {
  game.actors.forEach((actor, i) => { place(game, actor, i * 20, 30, 0); actor.health = 1000; actor.armor = 0; actor.weapon = "melee"; });
  game.world.step();
}
const command = (seq: number, changes: Partial<GameCommand> = {}): GameCommand => ({ ...idleCommand(seq), ...changes });
function replica(t: TestContext, game: Game, localActorId: number) {
  const client = new Game(null, profile());
  t.after(() => client.disposeAuthority());
  client.startReplica(game.snapshot(), localActorId);
  return client;
}
function near(actual: number, expected: number, tolerance = 1e-6) { assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`); }

test("production authority constructs without browser globals and serializes finite state on every arena", async (t) => {
  assert.equal(typeof document, "undefined");
  for (const mapId of ["ossuary", "rift", "bastion", "conduit", "crucible", "reliquary"] as const) {
    const game = await authority(t, mapId, mapId === "bastion" || mapId === "conduit" ? "ctf" : "ffa");
    for (let i = 1; i <= 12; i++) game.stepAuthority(new Map([[1, command(i, { x: 1 })]]));
    const snapshot = game.snapshot();
    assert.equal(snapshot.tick, 12);
    assert.equal(snapshot.actors[1].ack, 12);
    assert.equal(snapshot.actors[1].controller, "human");
    assert.equal(snapshot.actors[0].ammo.melee, -1);
    const check = (value: unknown) => {
      if (typeof value === "number") assert.equal(Number.isFinite(value), true);
      else if (value && typeof value === "object") Object.values(value).forEach(check);
    };
    check(snapshot);
    assert.deepEqual(JSON.parse(JSON.stringify(snapshot)), snapshot);
  }
});

test("remote human slots receive human hitscan tolerance and their individual auto-fire settings", async (t) => {
  const game = await authority(t); lane(game);
  const shooter = game.actors[1], target = game.actors[0];
  place(game, shooter, 0, 30, 0); place(game, target, .43, 30.1, -10);
  shooter.owned.add("rail"); shooter.weapon = "rail"; shooter.ammo.rail = 10;
  game.world.step();
  game.stepAuthority(new Map([[1, command(1, { railAuto: false })]]));
  assert.equal(target.health, 1000);
  game.stepAuthority(new Map([[1, command(2, { railAuto: false, fire: true })]]));
  assert.equal(shooter.ammo.rail, 9);
  assert.equal(target.health, 900, "remote human margin produces body damage");
  const events = game.snapshot().events;
  assert.ok(events.some((event) => event.type === "shot" && event.actorId === 1));
  assert.ok(events.some((event) => event.type === "hit" && event.attackerId === 1 && event.victimId === 0));
  assert.deepEqual(game.snapshot().events, [], "events drain once per published snapshot");
});

test("bot replacement of slot zero uses bot traces and controller transfers preserve the actor", async (t) => {
  const game = await authority(t); lane(game);
  const actor = game.actors[0], target = game.actors[1];
  place(game, actor, 0, 30, 0); place(game, target, .43, 30.1, -10);
  actor.weapon = "rail"; actor.owned.add("rail"); actor.ammo.rail = 10; actor.kills = 4; actor.armor = 65;
  const body = actor.body, collider = actor.collider;
  game.setController({ id: 0, name: "Replacement", controller: "bot" });
  game.world.step();
  (game as any).shoot(actor, new THREE.Vector3(0, 0, -1));
  assert.equal(target.health, 1000, "slot zero bot does not inherit human aim tolerance");
  game.setController({ id: 0, name: "Returned", controller: "human" });
  assert.equal(actor.body, body); assert.equal(actor.collider, collider);
  assert.equal(actor.kills, 4); assert.equal(actor.armor, 65); assert.equal(actor.ammo.rail, 9);
  actor.lastShot.rail = -Infinity;
  (game as any).shoot(actor, new THREE.Vector3(0, 0, -1));
  assert.equal(target.health, 900);
});

test("authority consumes fire edges once per sequence while retaining plasma hold cadence", async (t) => {
  const game = await authority(t); lane(game);
  const actor = game.actors[2];
  actor.owned.add("rocket"); actor.weapon = "rocket"; actor.ammo.rocket = 20;
  for (let i = 0; i < 120; i++) game.stepAuthority(new Map([[2, command(1, { fire: true, fireHeld: true })]]));
  assert.equal(actor.ammo.rocket, 19, "replayed packet cannot become repeated tap fire");
  actor.owned.add("plasma"); actor.weapon = "plasma"; actor.ammo.plasma = 20;
  for (let i = 0; i < 42; i++) game.stepAuthority(new Map([[2, command(2, { fireHeld: true })]]));
  assert.equal(actor.ammo.plasma, 16);
  for (let i = 0; i < 36; i++) game.stepAuthority(new Map([[2, command(3)]]));
  assert.equal(actor.ammo.plasma, 16);
  actor.owned.add("bfg"); actor.ammo.bfg = 4;
  game.stepAuthority(new Map([[2, command(4, { switchTo: "bfg", fire: true, fireHeld: true })]]));
  assert.equal(actor.weapon, "bfg"); assert.equal(actor.ammo.bfg, 4);
});

test("remote human respawn waits for a buffered request and human lifetime counters exclude replacement bot play", async (t) => {
  const game = await authority(t); lane(game);
  const victim = game.actors[2], killer = game.actors[1];
  (game as any).kill(victim, killer);
  assert.equal(killer.humanKills, 1); assert.equal(victim.humanDeaths, 1);
  for (let i = 0; i < 190; i++) game.stepAuthority(new Map());
  assert.equal(victim.health, 0, "remote humans never receive bot automatic respawn");
  const revision = victim.viewRevision;
  game.stepAuthority(new Map([[2, command(1, { respawn: true })]]));
  assert.equal(victim.health, 125); assert.equal(victim.viewRevision, revision + 1);
  game.setController({ id: 1, name: "Bot", controller: "bot" });
  (game as any).kill(victim, killer);
  assert.equal(killer.humanKills, 1); assert.equal(victim.humanDeaths, 2);
  game.stepAuthority(new Map([[2, command(2, { respawn: true })]]));
  for (let i = 0; i < 45; i++) game.stepAuthority(new Map());
  assert.equal(victim.health, 0);
  for (let i = 0; i < 4; i++) game.stepAuthority(new Map());
  assert.ok(victim.health > 0, "buffered respawn succeeds after the delay, including across health-decay ticks");
});

test("empty slots cannot move, collect items or collide and reconnect restores their held state", async (t) => {
  const game = await authority(t); lane(game);
  const actor = game.actors[3]; actor.armor = 73; actor.ammo.machinegun = 54;
  game.setController({ id: 3, name: "Absent", controller: "empty" });
  const before = { ...actor.motion };
  for (let i = 1; i <= 30; i++) game.stepAuthority(new Map([[3, command(i, { x: 1, jump: true })]]));
  assert.deepEqual(actor.motion, before); assert.equal(actor.collider.isEnabled(), false);
  game.setController({ id: 3, name: "Returned", controller: "human" });
  assert.equal(actor.health, 1000); assert.equal(actor.armor, 73); assert.equal(actor.ammo.machinegun, 54);
  assert.equal(actor.collider.isEnabled(), true);
});

test("authority firing retains no transient render effects or actor geometry", async (t) => {
  const game = await authority(t); lane(game);
  const actor = game.actors[1]; actor.weapon = "rail"; actor.ammo.rail = 30; actor.owned.add("rail");
  for (let i = 0; i < 20; i++) { actor.lastShot.rail = -Infinity; (game as any).shoot(actor, new THREE.Vector3(0, 1, 0)); }
  assert.equal((game as any).effects.length, 0);
  assert.equal((game as any).gore, undefined);
  assert.ok(game.actors.every((candidate) => candidate.mesh.children.length === 0));
  assert.equal(game.snapshot().events.filter((event) => event.type === "shot").length, 20);
  game.disposeAuthority(); game.disposeAuthority();
});

test("replica uses its assigned human slot and predicts movement without predicting combat", async (t) => {
  const server = await authority(t); lane(server);
  const client = replica(t, server, 2);
  assert.equal(client.player.id, 2); assert.equal(client.player.mesh.visible, false);
  assert.equal(client.actors[0].mesh.visible, true);
  const start = client.player.motion.x, health = client.actors[0].health;
  const sent: GameCommand[] = []; client.onCommand = (value) => sent.push(value);
  const consume = client.input.consume.bind(client.input);
  client.input.yaw = .25;
  client.input.consume = () => ({ ...consume(), x: 1, z: 0, fire: true });
  for (let i = 0; i < 6; i++) (client as any).predictTick();
  assert.ok(client.player.motion.x > start);
  assert.equal(client.actors[0].health, health);
  assert.equal(sent.length, 6); assert.deepEqual(sent.map((value) => value.seq), [1, 2, 3, 4, 5, 6]);
  assert.ok(sent.every((value) => value.yaw === .25));
  const predicted = { ...client.player.motion };
  for (const value of sent.slice(0, 2)) server.stepAuthority(new Map([[2, value]]));
  client.applySnapshot(server.snapshot());
  near(client.player.motion.x, predicted.x);
  near(client.player.motion.y, predicted.y);
  near(client.input.yaw, .25, 1e-12);
  assert.equal((client as any).pendingCommands.length, 4);
});

test("snapshots update paused replicas and deliver authoritative result and events only once", async (t) => {
  const server = await authority(t); lane(server);
  const client = replica(t, server, 1);
  let ended = 0, kills = 0; client.onEnd = () => ended++; client.onKill = () => kills++;
  client.pause();
  (server as any).kill(server.actors[2], server.actors[1]);
  server.actors[1].kills = server.config.scoreLimit;
  server.stepAuthority(new Map());
  const snapshot = server.snapshot();
  client.applySnapshot(snapshot); client.applySnapshot(snapshot);
  assert.equal(client.active, false); assert.equal(client.ended, true);
  assert.equal(client.player.kills, server.config.scoreLimit);
  assert.equal(ended, 1); assert.equal(kills, 1);
});

test("respawn revisions reset local view while ordinary snapshots preserve immediate aim", async (t) => {
  const server = await authority(t); lane(server);
  const client = replica(t, server, 1);
  client.input.yaw = 1.25; client.input.pitch = .6;
  server.stepAuthority(new Map()); client.applySnapshot(server.snapshot());
  near(client.input.yaw, 1.25); near(client.input.pitch, .6);
  (server as any).kill(server.actors[1], null);
  server.stepAuthority(new Map([[1, command(1, { respawn: true })]]));
  client.applySnapshot(server.snapshot());
  for (let i = 0; i < 49; i++) server.stepAuthority(new Map());
  const snapshot = server.snapshot(); client.applySnapshot(snapshot);
  assert.equal(client.player.health, 125);
  near(client.input.yaw, snapshot.actors[1].yaw); near(client.input.pitch, 0);
  client.stopReplica(); assert.equal(client.isReplica, false); assert.equal(client.active, false);
});

test("client command sequencing resumes above the authoritative acknowledgement", async (t) => {
  const server = await authority(t);
  server.stepAuthority(new Map([[3, command(812)]]));
  const client = replica(t, server, 3);
  let seq = 0; client.onCommand = (value) => { seq = value.seq; };
  (client as any).predictTick(); assert.equal(seq, 813);
});

test("a fresh slot owner resets lifetime counters without altering the ongoing combat state", async (t) => {
  const game = await authority(t); lane(game);
  const actor = game.actors[1];
  actor.humanKills = 7; actor.humanDeaths = 4; actor.kills = 9; actor.deaths = 6;
  actor.armor = 73; actor.ammo.machinegun = 54; actor.ack = 810;
  const before = { motion: { ...actor.motion }, health: actor.health, body: actor.body, owned: [...actor.owned] };
  game.setController({ id: 1, name: "Reconnect", controller: "human" });
  assert.equal(actor.humanKills, 7); assert.equal(actor.humanDeaths, 4);
  game.setController({ id: 1, name: "New owner", controller: "human" }, true);
  assert.equal(actor.humanKills, 0); assert.equal(actor.humanDeaths, 0);
  assert.equal(actor.kills, 9); assert.equal(actor.deaths, 6); assert.equal(actor.health, before.health);
  assert.equal(actor.armor, 73); assert.equal(actor.ammo.machinegun, 54); assert.equal(actor.ack, 810);
  assert.equal(actor.body, before.body); assert.deepEqual(actor.motion, before.motion); assert.deepEqual([...actor.owned], before.owned);
});

test("disconnecting without a replacement grounds carried flags or returns inaccessible roof drops", async (t) => {
  for (const [mapId, position, status] of [
    ["bastion", [8, 3, 0], "dropped"],
    ["conduit", [0, 10, -17], "home"],
  ] as const) {
    const game = await authority(t, mapId, "ctf");
    const actor = game.actors[0], flag = game.flagStates[1];
    flag.carrierId = actor.id; flag.status = "carried";
    place(game, actor, ...position); game.world.step();
    game.setController({ id: actor.id, name: "Absent", controller: "empty" });
    assert.equal(flag.status, status); assert.equal(flag.carrierId, null);
    if (status === "dropped") { near(flag.position.x, 8); near(flag.position.y, .9, .03); near(flag.position.z, 0); }
    else assert.deepEqual(flag.position, flag.home);
  }
});

test("remote held finishes follow initial appearance and later ownership changes without disposing shared weapons", async (t) => {
  const game = await authority(t);
  game.setController({ id: 1, name: "Custom", controller: "human", appearance: { character: "nyx", characterSkin: "original", weaponSkin: "hellfire" } });
  const client = replica(t, game, 0);
  const held = () => client.actors[1].mesh.getObjectByName("held-weapons")!;
  assert.ok(held().children.every((model) => model.userData.skin === "hellfire"));
  let customDisposals = 0, sharedDisposals = 0;
  held().traverse((object) => { const mesh = object as THREE.Mesh; mesh.geometry?.addEventListener("dispose", () => customDisposals++); });
  client.actors[2].mesh.getObjectByName("held-weapons")!.traverse((object) => { const mesh = object as THREE.Mesh; mesh.geometry?.addEventListener("dispose", () => sharedDisposals++); });
  const collider = client.actors[1].collider;
  game.setController({ id: 1, name: "Replacement", controller: "bot", appearance: { character: "grim", characterSkin: "ashen", weaponSkin: "original" } });
  game.stepAuthority(new Map()); client.applySnapshot(game.snapshot());
  assert.ok(customDisposals > 0); assert.equal(sharedDisposals, 0);
  assert.ok(held().children.every((model) => model.userData.skin === "original"));
  game.setController({ id: 1, name: "New finish", controller: "human", appearance: { character: "grim", characterSkin: "ashen", weaponSkin: "frostbound" } });
  game.stepAuthority(new Map()); client.applySnapshot(game.snapshot());
  assert.equal(sharedDisposals, 0, "replacing one actor does not invalidate another actor's shared arena weapon resources");
  assert.ok(held().children.every((model) => model.userData.skin === "frostbound"));
  assert.equal(client.actors[1].collider, collider);
});

test("replica movement audio follows remote transitions and never repeats local prediction during reconciliation", async (t) => {
  const server = await authority(t);
  server.actors.forEach((actor) => { actor.weapon = "melee"; actor.motion.grounded = true; });
  const client = replica(t, server, 0);
  const sounds: string[] = [];
  client.sound.character = (kind, character) => sounds.push(`${kind}:${character}`);
  client.sound.footstep = (character) => sounds.push(`step:${character}`);
  const remote = server.actors[1];
  const remoteSnapshot = (grounded: boolean, vy: number, vx: number) => {
    const snapshot = server.snapshot(); snapshot.tick = (client as any).receivedTick + 1; snapshot.time = client.time + .4;
    Object.assign(snapshot.actors[1].motion, { grounded, vy, vx });
    client.applySnapshot(snapshot); client.applySnapshot(snapshot);
  };
  remoteSnapshot(false, 4, 0);
  remoteSnapshot(true, 0, 5);
  assert.deepEqual(sounds, [`jump:${remote.characterId}`, `land:${remote.characterId}`, `step:${remote.characterId}`]);
  sounds.length = 0;
  client.player.motion.grounded = true;
  client.input.consume = () => ({ x: 0, z: 0, jump: true, fire: false, fireHeld: false, switchTo: null });
  (client as any).predictTick();
  assert.equal(sounds.filter((value) => value === `jump:${client.player.characterId}`).length, 1);
  const snapshot = server.snapshot(); snapshot.tick = (client as any).receivedTick + 1; snapshot.time = client.time;
  client.applySnapshot(snapshot);
  assert.equal(sounds.filter((value) => value === `jump:${client.player.characterId}`).length, 1, "unacknowledged jump replay remains silent");
});

test("omitted human controls suppress automatic and contact attacks while their body keeps simulating", async (t) => {
  const game = await authority(t); lane(game);
  const actor = game.actors[1], target = game.actors[0];
  place(game, actor, 0, 30, 0); place(game, target, 0, 30, -10);
  actor.weapon = "machinegun"; game.world.step();
  const y = actor.motion.y;
  game.stepAuthority(new Map());
  assert.equal(target.health, 1000); assert.ok(actor.motion.y < y);
  game.stepAuthority(new Map([[actor.id, command(1)]]));
  assert.equal(target.health, 993, "explicit active idle input still uses aim-triggered fire");
  actor.weapon = "melee"; place(game, target, 0, 30, -.8); place(game, actor, 0, 30, 0); game.world.step();
  game.stepAuthority(new Map());
  assert.equal(target.health, 993);
  game.stepAuthority(new Map([[actor.id, command(2)]]));
  assert.equal(target.health, 943, "resuming input restores ordinary contact melee");
});

test("queued pre-teleport aim cannot overwrite the reset orientation delivered to replicas", async (t) => {
  const server = await authority(t, "rift"); lane(server);
  const actor = server.actors[1], portal = server.map.teleporters[0];
  place(server, actor, portal.position.x, portal.position.y, portal.position.z); server.world.step();
  const client = replica(t, server, 1), revision = actor.viewRevision;
  server.stepAuthority(new Map([[1, command(1, { yaw: 0, pitch: .15 })]]));
  assert.equal(actor.viewRevision, revision + 1); near(actor.motion.x, portal.destination.x);
  for (let seq = 2; seq <= 6; seq++) server.stepAuthority(new Map([[1, command(seq, { yaw: 0, pitch: .15 })]]));
  near(actor.yaw, 0, 1e-12);
  const snapshot = server.snapshot();
  near(snapshot.actors[1].viewYaw, portal.yaw);
  client.applySnapshot(snapshot);
  near(client.input.yaw, portal.yaw); near(client.input.pitch, .15);
  client.input.yaw = 2.25;
  server.stepAuthority(new Map([[1, command(7, { yaw: 2.25, pitch: .15 })]]));
  client.applySnapshot(server.snapshot()); near(client.input.yaw, 2.25);
  const reconnect = replica(t, server, 1);
  near(reconnect.input.yaw, 2.25, 1e-12, "a reconnect restores current aim rather than the old portal reset");
});
