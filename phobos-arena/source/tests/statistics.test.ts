import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { Game, type Actor } from "../src/game.ts";
import { defaultConfig, type Mode } from "../src/match.ts";
import { idleCommand } from "../src/lan/types.ts";
import { settleLanMatch } from "../src/lan/settlement.ts";
import { emptyStatistics, emptyTelemetry, normalizeStatistics, settleStatistics, weaponStatistics } from "../src/statistics.ts";
import { newMotion, STEP, type WeaponId } from "../src/rules.ts";
import type { Profile } from "../src/profile.ts";

async function arena(t: TestContext, mode: Mode = "ffa") {
  const game = await Game.createAuthority({ mapId: mode === "ctf" ? "bastion" : "ossuary",
    config: { ...defaultConfig(mode), population: 4, scoreLimit: 99 }, matchId: `statistics-${mode}`,
    roster: [0, 1, 2, 3].map(id => ({ id, name: `Player ${id}`, controller: id === 3 ? "bot" : "human" })) });
  t.after(() => game.disposeAuthority());
  for (const actor of game.actors) {
    place(game, actor, 20 + actor.id * 20, 30, 0);
    actor.health = 1000; actor.armor = 0; actor.nextThink = actor.nextAttack = Infinity; actor.enemy = null;
  }
  game.world.step();
  return game;
}
function place(game: Game, actor: Actor, x: number, y: number, z: number) {
  actor.motion = newMotion(x, y, z);
  actor.body.setTranslation(actor.motion, true); actor.body.setNextKinematicTranslation(actor.motion);
  actor.collider.setEnabled(true);
}
function equip(actor: Actor, weapon: WeaponId) {
  actor.weapon = weapon; actor.owned.add(weapon); actor.ammo[weapon] = 20; actor.lastShot[weapon] = -Infinity;
}
const forward = new THREE.Vector3(0, 0, -1);
const shoot = (game: Game, actor: Actor, direction = forward) => (game as any).shoot(actor, direction);
const hurt = (game: Game, victim: Actor, damage: number, attacker: Actor | null) => (game as any).hurt(victim, damage, attacker);
const kill = (game: Game, victim: Actor, attacker: Actor | null) => (game as any).kill(victim, attacker);
const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`);

test("remote human rail telemetry counts real headshots, actual health/armor loss, misses and kills", async (t) => {
  const game = await arena(t), shooter = game.actors[1], victim = game.actors[2];
  place(game, shooter, 0, 30, 0); place(game, victim, 0, 30, -4);
  victim.health = 100; victim.armor = 50; game.world.step(); equip(shooter, "rail");
  shoot(game, shooter);
  const stats = shooter.humanTelemetry;
  assert.equal(stats.shots, 1); assert.equal(stats.hits, 1); assert.equal(stats.headshots, 1); assert.equal(stats.kills, 1);
  assert.equal(stats.damageDealt, 150, "overkill damage is excluded, absorbed armor is included");
  assert.equal(victim.humanTelemetry.damageTaken, 150); assert.equal(victim.humanTelemetry.deaths, 1);
  assert.deepEqual(stats.weapons.rail, { shots: 1, hits: 1, headshots: 1, kills: 1, damageDealt: 150 });
  shooter.lastShot.rail = -Infinity; shoot(game, shooter, new THREE.Vector3(0, 1, 0));
  assert.equal(stats.shots, 2); assert.equal(stats.hits, 1);
});

test("shotgun and nailgun volleys count one shot and at most one accuracy hit", async (t) => {
  const game = await arena(t), shooter = game.actors[1], victim = game.actors[2];
  t.mock.method(Math, "random", () => 0.5);
  place(game, shooter, 0, 30, 0); place(game, victim, 0, 30, -3); game.world.step();
  equip(shooter, "shotgun"); shoot(game, shooter);
  assert.equal(shooter.humanTelemetry.shots, 1); assert.equal(shooter.humanTelemetry.hits, 1);
  assert.equal(shooter.humanTelemetry.damageDealt, 110);
  equip(shooter, "nailgun"); shoot(game, shooter);
  for (let step = 0; step < 24; step++) { game.time += STEP; (game as any).updateProjectiles(); }
  assert.equal(shooter.humanTelemetry.shots, 2); assert.equal(shooter.humanTelemetry.hits, 2);
  assert.equal(shooter.humanTelemetry.weapons.nailgun!.damageDealt, 300);
  assert.equal(shooter.humanTelemetry.weapons.nailgun!.hits, 1);
});

test("a multi-victim explosion records one hit, excludes self damage from dealt totals, and retains its firing weapon", async (t) => {
  const game = await arena(t), shooter = game.actors[1], direct = game.actors[2], nearby = game.actors[0];
  place(game, shooter, 0, 30, 0); place(game, direct, 0, 30, -4.5); place(game, nearby, 1.5, 30, -3);
  direct.health = 50; game.world.step(); equip(shooter, "grenade"); shoot(game, shooter);
  const projectile = (game as any).projectiles[0]; projectile.position.set(0, 30, -3);
  shooter.weapon = "machinegun";
  (game as any).detonate(projectile);
  const stats = shooter.humanTelemetry;
  assert.equal(stats.shots, 1); assert.equal(stats.hits, 1);
  assert.equal(stats.damageDealt, 125); assert.equal(stats.damageTaken, 50);
  assert.equal(stats.weapons.grenade!.damageDealt, 125); assert.equal(stats.weapons.grenade!.kills, 1);
  assert.equal(stats.weapons.machinegun, undefined);
});

test("projectile credit follows its firing human segment, never a later bot or fresh human occupant", async (t) => {
  const game = await arena(t), shooter = game.actors[1], victim = game.actors[2];
  place(game, shooter, 0, 30, 0); place(game, victim, 0, 30, -3); game.world.step();
  victim.health = 20;
  equip(shooter, "plasma"); shoot(game, shooter);
  const humanShot = (game as any).projectiles[0]; humanShot.position.set(0, 30, -3);
  const original = shooter.humanTelemetry;
  game.setController({ id: 1, name: "Replacement", controller: "bot" });
  (game as any).detonate(humanShot, victim);
  assert.equal(original.damageDealt, 20); assert.equal(original.hits, 1);
  assert.equal(original.kills, 1); assert.equal(shooter.humanKills, 1, "a delayed human-fired kill remains that human's credit");
  victim.health = 20; victim.collider.setEnabled(true); game.world.step();
  shooter.lastShot.plasma = -Infinity; shoot(game, shooter);
  const botShot = (game as any).projectiles[0]; botShot.position.set(0, 30, -3);
  game.setController({ id: 1, name: "Returned", controller: "human" });
  (game as any).detonate(botShot, victim);
  assert.equal(original.shots, 1); assert.equal(original.damageDealt, 20, "bot-fired damage cannot become human damage after reconnect");
  assert.equal(victim.health, 0); assert.equal(shooter.humanKills, 1, "the bot projectile killed without adding human lifetime credit");
  victim.health = 20; victim.collider.setEnabled(true); game.world.step();
  shooter.lastShot.plasma = -Infinity; shoot(game, shooter);
  const oldShot = (game as any).projectiles[0]; oldShot.position.set(0, 30, -3);
  game.setController({ id: 1, name: "New person", controller: "human" }, true);
  (game as any).detonate(oldShot, victim);
  assert.notEqual(shooter.humanTelemetry, original);
  assert.equal(shooter.humanTelemetry.damageDealt, 0); assert.equal(shooter.humanTelemetry.shots, 0);
  assert.equal(shooter.humanKills, 0);
  assert.equal(original.damageDealt, 40);
});

test("assists require real enemy damage during the preceding five seconds", async (t) => {
  const game = await arena(t), helper = game.actors[0], killer = game.actors[1], victim = game.actors[2], bot = game.actors[3];
  hurt(game, victim, 10, helper); game.time = 5.01; kill(game, victim, killer);
  assert.equal(helper.humanTelemetry.assists, 0, "expired contributions cannot assist");
  victim.health = 20; game.time = 10; hurt(game, victim, 10, helper);
  game.time = 14.99; hurt(game, victim, 10, bot);
  assert.equal(helper.humanTelemetry.assists, 1); assert.equal(bot.humanTelemetry.kills, 0);
  victim.health = 20; victim.power = "immortal"; victim.powerUntil = 100;
  hurt(game, victim, 10, helper); victim.power = null; kill(game, victim, killer);
  assert.equal(helper.humanTelemetry.assists, 1, "immune targets do not create contributions");
  const teamGame = await arena(t, "tdm"), [friend, enemy, teammate] = teamGame.actors;
  hurt(teamGame, teammate, 10, friend); hurt(teamGame, teammate, 10, teammate); kill(teamGame, teammate, enemy);
  assert.equal(friend.humanTelemetry.assists, 0); assert.equal(teammate.humanTelemetry.assists, 0);
  assert.equal(friend.humanTelemetry.damageDealt, 0);
});

test("human participation time survives reconnect but excludes bot and empty-slot intervals", async (t) => {
  const game = await arena(t), actor = game.actors[1];
  for (let i = 0; i < 60; i++) game.stepAuthority(new Map());
  near(actor.humanTelemetry.playTimeSeconds, 0.5);
  const snapshot = game.snapshot();
  game.setController({ id: 1, name: "Bot", controller: "bot" });
  for (let i = 0; i < 60; i++) game.stepAuthority(new Map());
  near(actor.humanTelemetry.playTimeSeconds, 0.5);
  game.setController({ id: 1, name: "Human", controller: "human" });
  for (let i = 0; i < 30; i++) game.stepAuthority(new Map());
  near(actor.humanTelemetry.playTimeSeconds, 0.75);
  near(snapshot.actors[1].humanTelemetry!.playTimeSeconds, 0.5);
  game.setController({ id: 1, name: "Empty", controller: "empty" });
  for (let i = 0; i < 30; i++) game.stepAuthority(new Map());
  near(actor.humanTelemetry.playTimeSeconds, 0.75);
  game.setController({ id: 1, name: "Fresh", controller: "human" }, true);
  assert.equal(actor.humanTelemetry.playTimeSeconds, 0);
});

test("Immortality spends a shot without an accuracy hit, and contact melee records its own attack", async (t) => {
  const game = await arena(t), shooter = game.actors[1], target = game.actors[2];
  place(game, shooter, 0, 30, 0); place(game, target, 0, 30, -4);
  target.power = "immortal"; target.powerUntil = 100; game.world.step();
  equip(shooter, "rail"); shoot(game, shooter);
  assert.equal(shooter.humanTelemetry.shots, 1); assert.equal(shooter.humanTelemetry.hits, 0);
  assert.equal(shooter.humanTelemetry.headshots, 0); assert.equal(shooter.humanTelemetry.damageDealt, 0);
  target.power = null; place(game, target, 0, 30, -0.88); game.world.step(); equip(shooter, "melee");
  game.stepAuthority(new Map([[1, idleCommand(1)]]));
  assert.equal(shooter.humanTelemetry.shots, 2); assert.equal(shooter.humanTelemetry.hits, 1);
  assert.equal(shooter.humanTelemetry.weapons.melee!.shots, 1); assert.equal(shooter.humanTelemetry.weapons.melee!.damageDealt, 50);
});

test("real flag captures and manual returns count only the controlling human", async (t) => {
  const game = await arena(t, "ctf"), carrier = game.actors[1], opponent = game.actors[0];
  const flags = (game as any).flags;
  const update = () => (game as any).flagEvents(flags.update(game.actors, game.time));
  const at = (actor: Actor, point: THREE.Vector3) => place(game, actor, point.x, point.y, point.z);
  at(carrier, flags.states[0].home); update(); at(carrier, flags.states[1].home); update();
  assert.equal(carrier.humanTelemetry.captures, 1);
  at(opponent, flags.states[1].home); update();
  const dropped = new THREE.Vector3(0, 0.9, 0);
  (game as any).flagEvents(flags.drop(opponent.id, dropped, game.time));
  at(opponent, flags.states[0].home); at(carrier, dropped); update();
  assert.equal(carrier.humanTelemetry.returns, 1);
  (game as any).flagEvents([{ type: "return", actorId: null, flag: 1, team: 1 }]);
  assert.equal(carrier.humanTelemetry.returns, 1, "automatic returns have no human owner");
  game.setController({ id: carrier.id, name: "Bot", controller: "bot" });
  at(carrier, flags.states[0].home); update(); at(carrier, flags.states[1].home); update();
  assert.equal(carrier.captures, 2); assert.equal(carrier.humanTelemetry.captures, 1);
});

test("detailed settlement keeps solo, LAN, mode and weapon totals without modifying legacy statistics", () => {
  const profile = { statistics: emptyStatistics(), stats: { kills: 90 }, favor: 100 };
  const telemetry = { ...emptyTelemetry(), kills: 2, deaths: 1, shots: 10, hits: 4, playTimeSeconds: 60 };
  Object.assign(weaponStatistics(telemetry, "rail"), { shots: 10, hits: 4, kills: 2 });
  assert.equal(settleStatistics(profile, { matchId: "solo1", source: "solo", mode: "ffa", outcome: "win", telemetry }), true);
  settleStatistics(profile, { matchId: "lan1", source: "lan", mode: "ctf", outcome: "draw", telemetry });
  assert.equal(profile.statistics.lifetime.completed, 2); assert.equal(profile.statistics.lifetime.wins, 1); assert.equal(profile.statistics.lifetime.draws, 1);
  assert.equal(profile.statistics.solo.kills, 2); assert.equal(profile.statistics.lan.kills, 2);
  assert.equal(profile.statistics.modes.ctf!.completed, 1); assert.equal(profile.statistics.lifetime.weapons.rail!.hits, 8);
  assert.deepEqual(profile.stats, { kills: 90 }); assert.equal(profile.favor, 100);
});

test("partial abandonment upgrades to one completed match after reload without duplicate telemetry", () => {
  const profile = { statistics: emptyStatistics() };
  const partial = { ...emptyTelemetry(), kills: 1, damageDealt: 50, playTimeSeconds: 10 };
  const entry = { matchId: "reconnect", source: "lan" as const, mode: "tdm" as const };
  settleStatistics(profile, { ...entry, outcome: "abandoned", telemetry: partial });
  assert.equal(settleStatistics(profile, { ...entry, outcome: "abandoned", telemetry: partial }), false);
  profile.statistics = normalizeStatistics(JSON.parse(JSON.stringify(profile.statistics)));
  settleStatistics(profile, { ...entry, outcome: "abandoned", telemetry: { ...partial, kills: 2, playTimeSeconds: 15 } });
  assert.equal(profile.statistics.lifetime.abandoned, 1); assert.equal(profile.statistics.lifetime.kills, 2);
  const final = { ...partial, kills: 3, damageDealt: 120, playTimeSeconds: 30 };
  assert.equal(settleStatistics(profile, { ...entry, outcome: "loss", telemetry: final }), true);
  assert.equal(profile.statistics.lifetime.abandoned, 0); assert.equal(profile.statistics.lifetime.completed, 1);
  assert.equal(profile.statistics.lifetime.losses, 1); assert.equal(profile.statistics.lifetime.kills, 3);
  assert.equal(profile.statistics.lifetime.playTimeSeconds, 30); assert.equal(profile.statistics.lifetime.damageDealt, 120);
  assert.equal(settleStatistics(profile, { ...entry, outcome: "loss", telemetry: final }), false);
  assert.equal(settleStatistics(profile, { ...entry, outcome: "abandoned", telemetry: partial }), false);
});

test("saved telemetry normalization rejects unknown modes/weapons and non-finite or negative counters", () => {
  const normalized = normalizeStatistics({ version: 1, lifetime: { shots: -1, hits: 20, damageDealt: Infinity, weapons: { bogus: { shots: 10 } } },
    modes: { bogus: { kills: 100 } }, settled: [{ matchId: "bad", source: "lan", mode: "bogus", outcome: "win" }] });
  assert.equal(normalized.lifetime.shots, 0); assert.equal(normalized.lifetime.hits, 0); assert.equal(normalized.lifetime.damageDealt, 0);
  assert.deepEqual(normalized.lifetime.weapons, {}); assert.deepEqual(normalized.modes, {}); assert.deepEqual(normalized.settled, []);
});

test("LAN final settlement adds authoritative detailed telemetry once for a nonzero human slot", async (t) => {
  const game = await arena(t), shooter = game.actors[1], victim = game.actors[2];
  place(game, shooter, 0, 30, 0); place(game, victim, 0, 30, -4); victim.health = 50;
  game.world.step(); equip(shooter, "rail"); shoot(game, shooter); game.config.scoreLimit = 1;
  game.stepAuthority(new Map([[1, idleCommand(1)]]));
  const snapshot = game.snapshot(); assert.equal(snapshot.ended, true);
  const profile: Profile = { name: "Player", settings: {} as Profile["settings"], stats: { matches: 0, wins: 0, kills: 7, deaths: 0, tournaments: 0, tournamentWins: 0, tournamentDraws: 0 } };
  settleLanMatch(profile, snapshot, 1);
  assert.equal(profile.stats.kills, 8); assert.equal(profile.statistics!.lan.kills, 1);
  assert.equal(profile.statistics!.lan.shots, 1); assert.equal(profile.statistics!.lan.damageDealt, 50);
  const restored = JSON.parse(JSON.stringify(profile)) as Profile;
  settleLanMatch(restored, snapshot, 1);
  assert.equal(restored.stats.kills, 8); assert.equal(restored.statistics!.lan.completed, 1);
  assert.equal(restored.statistics!.lan.damageDealt, 50);
});
