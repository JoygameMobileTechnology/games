import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { HITSCAN_MARGIN, STEP, WEAPONS, type WeaponId } from "../src/rules.ts";
import type { Actor } from "../src/game.ts";
import { fixture, place, type HeadlessGame } from "./helpers/game-fixture.ts";

const forward = new THREE.Vector3(0, 0, -1);
const hitscanWeapons = ["machinegun", "shotgun", "rail", "lightning", "chaingun"] as const;
type Trace = { actor?: Actor; distance: number; point: THREE.Vector3 } | null;
type CombatGame = HeadlessGame & {
  raycast: (from: THREE.Vector3, direction: THREE.Vector3, range: number, except?: Actor) => Trace;
};

// Above-map lane: input intent is synthetic, while capsule geometry, targeting,
// spread, auto-trigger, damage, projectile simulation and occlusion stay real.
async function lane(t: TestContext, mode: "ffa" | "tdm" = "ffa") {
  const f = await fixture(4, "ossuary", mode);
  t.after(() => f.dispose());
  const game = f.game as CombatGame;
  for (const [index, actor] of game.actors.entries()) {
    place(game, actor, index * 10, 30, 0);
    actor.health = 1000;
    actor.armor = 0;
    actor.nextThink = actor.nextAttack = Infinity;
    actor.enemy = null;
  }
  game.input.yaw = game.input.pitch = 0;
  game.pickups.forEach((pickup) => { pickup.readyAt = Infinity; });
  game.world.step();
  return { ...f, game };
}

function equip(actor: Actor, weapon: WeaponId) {
  actor.weapon = weapon;
  actor.owned.add(weapon);
  actor.ammo[weapon] = 10;
  actor.lastShot[weapon] = -Infinity;
}

function resetPair(game: CombatGame, target: Actor, x: number, y: number, depth: number) {
  place(game, game.player, 0, 30, 0);
  place(game, target, x, y, -depth);
  target.health = 1000;
  target.armor = 0;
  game.world.step();
}

function exactTrace(game: CombatGame, range = WEAPONS.rail.range, shooter = game.player) {
  return game.raycast(
    new THREE.Vector3(shooter.motion.x, shooter.motion.y + 0.6, shooter.motion.z),
    forward,
    range,
    shooter,
  );
}

function box(game: CombatGame, x: number, z: number, halfWidth: number) {
  const collider = game.world.createCollider(
    RAPIER.ColliderDesc.cuboid(halfWidth, 2, 0.02).setTranslation(x, 30.6, z),
  );
  game.world.step();
  return collider;
}

test("human hitscan accepts small horizontal and vertical edge misses, but rejects the outer edge", async (t) => {
  const { game } = await lane(t);
  const target = game.actors[1];
  // At ten metres the 0.6-degree cone allows ~10.5 cm beyond the capsule.
  assert.ok(Math.abs(HITSCAN_MARGIN.angle - Math.PI / 300) < 1e-12);
  const cases = [
    { name: "right inside", x: 0.43, y: 30.1, hit: true },
    { name: "left inside", x: -0.43, y: 30.1, hit: true },
    { name: "right outside", x: 0.48, y: 30.1, hit: false },
    { name: "left outside", x: -0.48, y: 30.1, hit: false },
    { name: "above inside", x: 0, y: 31.52, hit: true },
    { name: "below inside", x: 0, y: 29.68, hit: true },
    { name: "above outside", x: 0, y: 31.58, hit: false },
    { name: "below outside", x: 0, y: 29.62, hit: false },
  ];
  for (const entry of cases) {
    resetPair(game, target, entry.x, entry.y, 10);
    assert.equal(exactTrace(game), null, `${entry.name}: the ordinary ray must miss`);
    equip(game.player, "rail");
    game.shoot(game.player, forward);
    assert.equal(target.health, entry.hit ? 900 : 1000, entry.name);
    assert.equal(game.player.ammo.rail, 9, "a manual attempt still spends ammunition");
  }
});

test("hitscan forgiveness is capped at fifteen centimetres even at long range", async (t) => {
  const { game } = await lane(t);
  const target = game.actors[1];
  assert.equal(HITSCAN_MARGIN.maxRadius, 0.15);
  for (const [x, expectedHealth] of [[0.49, 900], [0.52, 1000]] as const) {
    resetPair(game, target, x, 30.1, 60);
    assert.equal(exactTrace(game), null);
    equip(game.player, "rail");
    game.shoot(game.player, forward);
    assert.equal(target.health, expectedHealth, `capsule-edge gap ${x - 0.35} at 60 m`);
  }
});

test("all five human hitscan weapons auto-trigger and resolve near-edge hits", async (t) => {
  const { game } = await lane(t);
  const target = game.actors[1];
  t.mock.method(Math, "random", () => 0.5);
  for (const weapon of hitscanWeapons) {
    resetPair(game, target, 0.43, 30.1, 10);
    assert.equal(exactTrace(game, WEAPONS[weapon].range), null);
    equip(game.player, weapon);
    game.tick();
    assert.equal(game.player.ammo[weapon], 9, `${weapon}: near-edge auto-trigger`);
    const damage = WEAPONS[weapon].damage * (weapon === "shotgun" ? 11 : 1);
    assert.equal(target.health, 1000 - damage, `${weapon}: triggered bullets must connect`);
    assert.equal(game.input.yaw, 0, "targeting forgiveness does not move horizontal aim");
    assert.equal(game.input.pitch, 0, "targeting forgiveness does not move vertical aim");
  }
});

test("manual rail and shotgun use the same margin while their auto-fire is disabled", async (t) => {
  const { game } = await lane(t);
  const target = game.actors[1];
  t.mock.method(Math, "random", () => 0.5);
  game.profile.settings.railAuto = false;
  game.profile.settings.shotgunAuto = false;
  const consume = game.input.consume;
  for (const weapon of ["rail", "shotgun"] as const) {
    resetPair(game, target, 0.43, 30.1, 10);
    equip(game.player, weapon);
    game.input.consume = consume;
    game.tick();
    assert.equal(game.player.ammo[weapon], 10, `${weapon}: waits for manual fire`);
    assert.equal(target.health, 1000);
    game.input.consume = () => ({ ...consume(), fire: true });
    game.tick();
    assert.equal(game.player.ammo[weapon], 9);
    assert.equal(target.health, weapon === "rail" ? 900 : 890);
  }
});

test("exact hits take priority over a nearer off-axis enemy and retain real rail headshots", async (t) => {
  const { game, events } = await lane(t);
  const [player, target, nearer] = game.actors;
  resetPair(game, target, 0, 30.1, 10);
  place(game, nearer, 0.39, 30.1, -5);
  game.world.step();
  assert.equal(exactTrace(game)?.actor, target);
  equip(player, "rail");
  game.shoot(player, forward);
  assert.equal(target.health, 800, "the original head-height ray keeps its 200 damage");
  assert.equal(nearer.health, 1000, "a nearer margin candidate cannot steal an exact hit");
  assert.equal(events.filter((event) => event.text === "HEADSHOT").length, 1);

  place(game, nearer, 20, 30, 0);
  resetPair(game, target, 0.43, 30.1, 10);
  equip(player, "rail");
  game.shoot(player, forward);
  assert.equal(target.health, 900, "a corrected head-height hit receives body damage only");
  assert.equal(events.filter((event) => event.text === "HEADSHOT").length, 1);
});

test("solid cover on either the original or corrected ray prevents assisted auto-fire and damage", async (t) => {
  const { game } = await lane(t);
  const target = game.actors[1];
  for (const entry of [
    { name: "wide wall", x: 0, halfWidth: 2, originalBlocked: true },
    // The corrected ray passes x~=0.042 at z=-5; the original ray stays at x=0.
    { name: "corrected path only", x: 0.042, halfWidth: 0.009, originalBlocked: false },
    { name: "original path only", x: 0, halfWidth: 0.009, originalBlocked: true },
  ]) {
    resetPair(game, target, 0.43, 30.1, 10);
    const cover = box(game, entry.x, -5, entry.halfWidth);
    assert.equal(exactTrace(game) !== null, entry.originalBlocked, `${entry.name}: setup`);
    equip(game.player, "rail");
    game.tick();
    assert.equal(game.player.ammo.rail, 10, `${entry.name}: no auto-trigger through cover`);
    game.shoot(game.player, forward);
    assert.equal(game.player.ammo.rail, 9);
    assert.equal(target.health, 1000, `${entry.name}: no manual damage through cover`);
    game.world.removeCollider(cover, true);
  }
  resetPair(game, target, 0.43, 30.1, 10);
  equip(game.player, "rail");
  game.tick();
  assert.equal(target.health, 900, "the same target is reachable after removing cover");
});

test("teammates block both exact and corrected paths without becoming assist targets", async (t) => {
  const { game } = await lane(t, "tdm");
  const player = game.player;
  const target = game.actors.find((actor) => actor.team !== player.team)!;
  const friend = game.actors.find((actor) => actor !== player && actor.team === player.team)!;
  for (const x of [0, 0.37]) {
    resetPair(game, target, 0.43, 30.1, 10);
    place(game, friend, x, 30.1, -5);
    game.world.step();
    assert.equal(exactTrace(game)?.actor ?? null, x === 0 ? friend : null, `friend at x=${x}`);
    equip(player, "rail");
    game.tick();
    assert.equal(player.ammo.rail, 10, `friend at x=${x} prevents auto-fire`);
    game.shoot(player, forward);
    assert.equal(target.health, 1000);
    assert.equal(friend.health, 1000, "friendly-fire immunity is unchanged");
  }
  place(game, target, 10, 30, -10);
  place(game, friend, 0.43, 30.1, -10);
  place(game, player, 0, 30, 0);
  game.world.step();
  equip(player, "rail");
  game.tick();
  assert.equal(player.ammo.rail, 10, "a nearby teammate alone never activates auto-fire");
});

test("lightning checks real surface range for direct and assisted hits", async (t) => {
  const { game } = await lane(t);
  const target = game.actors[1];
  for (const entry of [
    { name: "exact surface in range, center beyond", x: 0, depth: 19.4, hit: true },
    { name: "exact surface out of range", x: 0, depth: 19.6, hit: false },
    { name: "assisted surface in range, center beyond", x: 0.43, depth: 19.23, hit: true },
    { name: "assisted surface out of range", x: 0.43, depth: 19.33, hit: false },
  ]) {
    resetPair(game, target, entry.x, 30.1, entry.depth);
    equip(game.player, "lightning");
    game.tick();
    assert.equal(game.player.ammo.lightning, entry.hit ? 9 : 10, `${entry.name}: trigger`);
    assert.equal(target.health, entry.hit ? 992 : 1000, `${entry.name}: damage`);
    if (!entry.hit) {
      game.shoot(game.player, forward);
      assert.equal(target.health, 1000, `${entry.name}: manual trace cannot extend range`);
    }
  }
});

test("an immortal near-edge enemy still triggers hitscan and consumes ammo without damage", async (t) => {
  const { game } = await lane(t);
  const target = game.actors[1];
  resetPair(game, target, 0.43, 30.1, 10);
  target.power = "immortal";
  target.powerUntil = 100;
  equip(game.player, "rail");
  game.tick();
  assert.equal(game.player.ammo.rail, 9);
  assert.equal(target.health, 1000);
  assert.equal(target.power, "immortal");
});

test("nonzero shotgun and chaingun spread can miss after the near-edge auto-trigger", async (t) => {
  const { game } = await lane(t);
  const target = game.actors[1];
  // A deterministic left/down sample directs each projectile-sized trace outside
  // the margin; recentering the spread or using the trigger hit for damage fails.
  t.mock.method(Math, "random", () => 0.05);
  for (const weapon of ["shotgun", "chaingun"] as const) {
    resetPair(game, target, 0.43, 30.1, 10);
    equip(game.player, weapon);
    game.tick();
    assert.equal(game.player.ammo[weapon], 9, `${weapon}: the unsprayed trigger qualifies`);
    assert.equal(target.health, 1000, `${weapon}: spread is resolved independently`);
  }
});

test("bots retain exact rays for all five hitscan weapons at the same near-edge angle", async (t) => {
  const { game } = await lane(t);
  const [, bot, target] = game.actors;
  t.mock.method(Math, "random", () => 0.5);
  place(game, game.player, 30, 30, 0);
  place(game, bot, 0, 30, 0);
  place(game, target, 0.43, 30.1, -10);
  game.world.step();
  for (const weapon of hitscanWeapons) {
    assert.equal(exactTrace(game, WEAPONS[weapon].range, bot), null);
    equip(bot, weapon);
    game.shoot(bot, forward);
    assert.equal(bot.ammo[weapon], 9);
    assert.equal(target.health, 1000, `${weapon}: human tolerance must not improve bot aim`);
  }
});

test("projectile aiming stays exact and melee keeps its contact distance", async (t) => {
  const { game } = await lane(t);
  const target = game.actors[1];
  resetPair(game, target, 0.43, 30.1, 10);
  equip(game.player, "plasma");
  game.tick();
  assert.equal(game.player.ammo.plasma, 10, "a projectile weapon never uses hitscan auto-trigger");
  game.shoot(game.player, forward);
  assert.equal(game.projectiles.length, 1);
  assert.equal(game.projectiles[0].velocity.x, 0);
  assert.equal(game.projectiles[0].velocity.y, 0);
  while (game.time < 0.3) {
    game.time += STEP;
    game.updateProjectiles();
  }
  assert.equal(target.health, 1000, "the projectile passes the same near-edge target without correction");

  resetPair(game, target, 0, 30, 1);
  equip(game.player, "melee");
  game.tick();
  assert.equal(target.health, 1000, "melee does not acquire extra reach");
  resetPair(game, target, 0, 30, 0.88);
  game.tick();
  assert.equal(target.health, 950, "ordinary equipped contact melee still works");
});
