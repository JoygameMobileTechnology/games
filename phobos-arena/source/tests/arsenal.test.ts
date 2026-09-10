import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import {
  MOVE,
  STEP,
  WEAPONS,
  WEAPON_ORDER,
  type WeaponId,
} from "../src/rules.ts";
import { defaultConfig } from "../src/match.ts";
import { getWeaponSlots } from "../src/weapon-slots.ts";
import { ArenaNavigator } from "../src/navigation.ts";
import type { Actor } from "../src/game.ts";
import { fixture, place, type HeadlessGame } from "./helpers/game-fixture.ts";

const forward = new THREE.Vector3(0, 0, -1);
const near = (actual: number, expected: number, tolerance = 1e-6) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${actual} should equal ${expected}`,
  );

// A combat lane above the authored map isolates weapon behavior from architecture.
// Actor colliders, traces, projectile integration, damage and triggers remain real.
async function lane(
  t: TestContext,
  mode: "ffa" | "tdm" | "juggernaut" = "ffa",
) {
  const f = await fixture(4, "ossuary", mode);
  t.after(() => f.dispose());
  for (const [index, actor] of f.game.actors.entries()) {
    place(f.game, actor, index * 10, 30, 0);
    actor.health = 1000;
    actor.armor = 0;
    actor.nextThink = actor.nextAttack = Infinity;
    actor.enemy = null;
  }
  f.game.input.yaw = f.game.input.pitch = 0;
  f.game.pickups.forEach((pickup) => {
    pickup.readyAt = Infinity;
  });
  f.game.world.step();
  return f;
}

function equip(actor: Actor, weapon: WeaponId, ammo = 10) {
  actor.weapon = weapon;
  actor.owned.add(weapon);
  actor.ammo[weapon] = ammo;
  actor.lastShot[weapon] = -Infinity;
}

function advanceProjectiles(game: HeadlessGame, seconds: number) {
  const end = game.time + seconds;
  while (game.time + 1e-9 < end) {
    game.time += STEP;
    game.updateProjectiles();
  }
}

function wall(game: HeadlessGame, x = 0, y = 30, z = -3) {
  const collider = game.world.createCollider(
    RAPIER.ColliderDesc.cuboid(3, 3, 0.05).setTranslation(x, y, z),
  );
  game.world.step();
  return collider;
}

test("shotgun fires eleven body-damage pellets, spends one shell and respects its switch cooldown", async (t) => {
  t.mock.method(Math, "random", () => 0.5);
  const { game, events } = await lane(t);
  const [player, target] = game.actors;
  place(game, target, 0, 30, -2);
  game.world.step();
  equip(player, "shotgun", 3);
  game.shoot(player, forward);
  assert.equal(
    target.health,
    890,
    "eleven connecting pellets deal 110 total at head height too",
  );
  assert.equal(player.ammo.shotgun, 2, "a pellet volley costs one shell");
  assert.equal(
    events.some((event) => event.text === "HEADSHOT"),
    false,
  );
  assert.equal(game.projectiles.length, 0, "pellets resolve immediately");
  game.switchWeapon("machinegun");
  game.switchWeapon("shotgun");
  game.time = 0.999;
  game.shoot(player, forward);
  assert.equal(
    player.ammo.shotgun,
    2,
    "switching cannot refresh the shotgun cooldown",
  );
  game.time = 1;
  game.shoot(player, forward);
  assert.equal(target.health, 780);
  assert.equal(player.ammo.shotgun, 1);
});

test("shotgun auto-fire can be disabled while a manual tap still shoots", async (t) => {
  t.mock.method(Math, "random", () => 0.5);
  const { game } = await lane(t);
  const [player, target] = game.actors;
  place(game, target, 0, 30, -2);
  equip(player, "shotgun", 3);
  game.world.step();
  game.profile.settings.shotgunAuto = false;
  game.tick();
  assert.equal(player.ammo.shotgun, 3);
  const original = game.input.consume;
  game.input.consume = () => ({ ...original(), fire: true });
  game.tick();
  assert.equal(player.ammo.shotgun, 2, "manual fire remains available");
  game.input.consume = original;
  game.profile.settings.shotgunAuto = true;
  player.lastShot.shotgun = -Infinity;
  game.tick();
  assert.equal(player.ammo.shotgun, 1, "auto-fire resumes when enabled");
});

test("lightning auto-fire respects its short range, solid cover and teammates", async (t) => {
  const { game } = await lane(t, "tdm");
  const player = game.player;
  const enemy = game.actors.find((actor) => actor.team !== player.team)!;
  const friend = game.actors.find(
    (actor) => actor !== player && actor.team === player.team,
  )!;
  equip(player, "lightning", 20);
  const attempt = () => {
    player.lastShot.lightning = -Infinity;
    game.world.step();
    game.tick();
  };
  place(game, enemy, 0, 30, -20);
  attempt();
  assert.equal(
    player.ammo.lightning,
    20,
    "an out-of-range crosshair target does not consume ammunition",
  );
  game.shoot(player, forward);
  assert.equal(enemy.health, 1000, "the actual trace is also range-limited");
  place(game, enemy, 0, 30, -8);
  const cover = wall(game);
  attempt();
  assert.equal(player.ammo.lightning, 19, "solid cover prevents auto-fire");
  game.world.removeCollider(cover, true);
  place(game, friend, 0, 30, -4);
  attempt();
  assert.equal(player.ammo.lightning, 19, "a teammate stops the auto-fire ray");
  assert.equal(friend.health, 1000);
  place(game, friend, 10, 30, 0);
  attempt();
  assert.equal(player.ammo.lightning, 18);
  assert.equal(
    enemy.health,
    992,
    "the unobstructed opponent receives eight damage",
  );
});

test("chaingun retains seven damage in TDM and cannot damage the teammate in its trace", async (t) => {
  t.mock.method(Math, "random", () => 0.5);
  const { game } = await lane(t, "tdm");
  const player = game.player;
  const enemy = game.actors.find((actor) => actor.team !== player.team)!;
  const friend = game.actors.find(
    (actor) => actor !== player && actor.team === player.team,
  )!;
  place(game, enemy, 0, 30, -4);
  game.world.step();
  equip(player, "chaingun");
  game.shoot(player, forward);
  assert.equal(
    enemy.health,
    993,
    "machinegun's TDM damage reduction does not apply to chaingun",
  );
  place(game, friend, 0, 30, -2);
  game.world.step();
  game.time = 0.03;
  game.shoot(player, forward);
  assert.equal(
    player.ammo.chaingun,
    8,
    "chaingun is ready again after thirty milliseconds",
  );
  assert.equal(friend.health, 1000);
  assert.equal(enemy.health, 993);
});

test("continuous chaingun fire preserves thirty-millisecond cadence on the 120 Hz simulation clock", async (t) => {
  const { game } = await lane(t);
  equip(game.player, "chaingun", 100);
  for (let tick = 0; tick < 120; tick++) {
    game.time = tick * STEP;
    game.shoot(game.player, forward);
  }
  assert.equal(
    game.player.ammo.chaingun,
    66,
    "one shot at zero and 33 more by 0.99 seconds; no tick-rounding slowdown",
  );
});

test("nailgun launches fifteen travelling nails for one ammo, with no splash or headshot bonus", async (t) => {
  t.mock.method(Math, "random", () => 0.5);
  const { game, events } = await lane(t);
  const [player, target, nearby] = game.actors;
  place(game, target, 0, 30, -3);
  place(game, nearby, 0.8, 30, -3);
  game.world.step();
  equip(player, "nailgun", 2);
  game.shoot(player, forward);
  assert.equal(game.projectiles.length, 15);
  assert.equal(player.ammo.nailgun, 1);
  assert.equal(target.health, 1000, "nails do not resolve as hitscan");
  for (const nail of game.projectiles) near(nail.velocity.length(), 30);
  advanceProjectiles(game, 0.2);
  assert.equal(game.projectiles.length, 0);
  assert.equal(
    target.health,
    700,
    "fifteen connected nails deal 300, including at head height",
  );
  assert.equal(
    nearby.health,
    1000,
    "a missed nearby actor receives no nail splash",
  );
  assert.equal(
    events.some((event) => event.text === "HEADSHOT"),
    false,
  );
  place(game, target, 10, 30, -3);
  game.time = 1;
  game.shoot(player, forward);
  advanceProjectiles(game, 3.1);
  assert.equal(
    game.projectiles.length,
    0,
    "missed nails expire after their travel lifetime",
  );
});

for (const [weapon, direct, splashRadius] of [
  ["plasma", 20, 0.5],
  ["bfg", 1000, 3],
] as const) {
  test(`${weapon} travels at fifty units per second and never adds splash to its direct victim`, async (t) => {
    const { game } = await lane(t);
    const [player, target] = game.actors;
    target.health = 2000;
    place(game, target, 0, 30, -4);
    game.world.step();
    equip(player, weapon, 2);
    game.shoot(player, forward);
    assert.equal(game.projectiles.length, 1);
    near(game.projectiles[0].velocity.length(), 50);
    near(game.projectiles[0].radius, splashRadius);
    assert.equal(target.health, 2000);
    advanceProjectiles(game, 0.15);
    assert.equal(game.projectiles.length, 0);
    assert.equal(target.health, 2000 - direct);
    assert.equal(player.ammo[weapon], 1);
  });
}

test("plasma and BFG wall impacts apply their own distance-limited splash", async (t) => {
  for (const [weapon, nearX, farX, maximum] of [
    ["plasma", 0.43, 1, 15],
    ["bfg", 1, 4, 100],
  ] as const) {
    const { game } = await lane(t);
    const [player, nearby, outside] = game.actors;
    // Offset the capsules from the firing ray while keeping the first actor's
    // center within the explosion radius on the shooter's side of the wall.
    place(game, nearby, nearX, 30.6, -2.85);
    place(game, outside, farX, 30.6, -2.85);
    wall(game);
    equip(player, weapon);
    game.shoot(player, forward);
    advanceProjectiles(game, 0.15);
    assert.equal(game.projectiles.length, 0);
    assert.ok(nearby.health < 1000, `${weapon} has an actual splash effect`);
    assert.ok(
      nearby.health > 1000 - maximum,
      `${weapon} damage falls off from its maximum`,
    );
    assert.equal(
      outside.health,
      1000,
      `${weapon} does not damage beyond its radius`,
    );
  }
});

test("all projectile weapons wait for a manual command instead of crosshair auto-fire", async (t) => {
  const { game } = await lane(t);
  const [player, target] = game.actors;
  place(game, target, 0, 30, -8);
  game.world.step();
  const original = game.input.consume;
  for (const weapon of WEAPON_ORDER.filter(
    (id) => WEAPONS[id].trigger === "projectile",
  )) {
    equip(player, weapon, 2);
    game.input.consume = original;
    game.tick();
    assert.equal(player.ammo[weapon], 2, `${weapon} must wait for a tap`);
    game.input.consume = () => ({ ...original(), fire: true });
    game.tick();
    assert.equal(
      player.ammo[weapon],
      1,
      `${weapon} accepts the manual fire command`,
    );
    game.clearEffects();
  }
  game.input.consume = original;
});

test("new weapons enforce the GDD fire cadence and stop firing when their ammunition is exhausted", async (t) => {
  const { game } = await lane(t);
  const deadlines: [WeaponId, number][] = [
    ["shotgun", 1],
    ["lightning", 0.05],
    ["grenade", 0.8],
    ["plasma", 0.1],
    ["bfg", 2.5],
    ["nailgun", 1],
    ["proximity", 0.8],
    ["chaingun", 0.03],
  ];
  for (const [weapon, deadline] of deadlines) {
    equip(game.player, weapon, 2);
    game.time = 0;
    game.shoot(game.player, forward);
    assert.equal(game.player.ammo[weapon], 1, `${weapon} fires when ready`);
    game.time = deadline - 0.0001;
    game.shoot(game.player, forward);
    assert.equal(
      game.player.ammo[weapon],
      1,
      `${weapon} rejects early repeat fire`,
    );
    game.time = deadline;
    game.shoot(game.player, forward);
    assert.equal(
      game.player.ammo[weapon],
      0,
      `${weapon} repeats at its specified interval`,
    );
    game.time = deadline * 2;
    game.shoot(game.player, forward);
    assert.equal(
      game.player.ammo[weapon],
      0,
      `${weapon} never consumes negative ammunition`,
    );
    game.clearEffects();
  }
});

test("grenades bounce from world geometry, lose speed and explode on their 2.5 second fuse", async (t) => {
  const { game } = await lane(t);
  const [player, target] = game.actors;
  game.world.createCollider(
    RAPIER.ColliderDesc.cuboid(60, 0.1, 60).setTranslation(0, 27.9, 0),
  );
  wall(game, 0, 30, -3);
  equip(player, "grenade");
  game.shoot(player, forward);
  const grenade = game.projectiles[0];
  near(grenade.velocity.length(), 17.5);
  advanceProjectiles(game, 0.25);
  assert.equal(
    game.projectiles.length,
    1,
    "a wall impact does not detonate the grenade",
  );
  assert.ok(
    grenade.velocity.z > 0,
    "the wall reflects travel away from its face",
  );
  assert.ok(grenade.velocity.z < 17.5, "the bounce dissipates forward speed");
  advanceProjectiles(game, 2.2);
  assert.equal(
    game.projectiles.length,
    1,
    "grenade remains before its fuse deadline",
  );
  place(
    game,
    target,
    grenade.position.x + 1,
    grenade.position.y + 0.8,
    grenade.position.z,
  );
  game.world.step();
  advanceProjectiles(game, 0.1);
  assert.equal(game.projectiles.length, 0);
  assert.ok(
    target.health < 1000,
    "the fuse blast damages a nearby unobstructed opponent",
  );
  assert.ok(target.health > 900, "splash falls off with distance");
});

test("a grenade hitting an actor detonates immediately for one direct hit", async (t) => {
  const { game } = await lane(t);
  const [player, target] = game.actors;
  // The launcher gives grenades an upward lob; put the target in that arc.
  place(game, target, 0, 30.5, -2);
  game.world.step();
  equip(player, "grenade");
  game.shoot(player, forward);
  advanceProjectiles(game, 0.2);
  assert.equal(game.projectiles.length, 0);
  assert.equal(
    target.health,
    900,
    "direct impact is not duplicated by that grenade's splash",
  );
});

test("Cinder's six-unit blast reaches past its old radius with linear damage falloff", async (t) => {
  const { game } = await lane(t);
  const [player, close, distant, edge] = game.actors;
  place(game, player, -15, 30, 0);
  place(game, close, 1.5, 30, 0);
  place(game, distant, 0, 30, 4.5);
  place(game, edge, 0, 30, -6);
  game.world.step();
  equip(player, "grenade");
  game.shoot(player, forward);
  const grenade = game.projectiles[0];
  near(grenade.radius, 6);
  grenade.position.set(0, 30, 0);
  grenade.expires = game.time + STEP;
  advanceProjectiles(game, STEP);
  assert.equal(close.health, 925, "one-quarter radius retains 75% damage");
  assert.equal(distant.health, 975, "three-quarter radius retains 25% damage");
  assert.equal(edge.health, 1000, "damage reaches zero at the outer edge");
});

test("Cinder's wider blast still respects cover, friendly-fire rules and Immortality", async (t) => {
  const { game } = await lane(t, "tdm");
  const player = game.player;
  const friend = game.actors.find(
    (a) => a !== player && a.team === player.team,
  )!;
  const [covered, immortal] = game.actors.filter((a) => a.team !== player.team);
  place(game, player, -15, 30, 0);
  place(game, friend, 4.5, 30, 0);
  place(game, covered, 0, 30, -4.5);
  place(game, immortal, 0, 30, 4.5);
  immortal.power = "immortal";
  immortal.powerUntil = 10;
  wall(game, 0, 30, -2);
  equip(player, "grenade");
  game.shoot(player, forward);
  game.projectiles[0].position.set(0, 30, 0);
  game.projectiles[0].expires = game.time + STEP;
  advanceProjectiles(game, STEP);
  for (const actor of [friend, covered, immortal])
    assert.equal(actor.health, 1000);
  assert.equal(
    immortal.motion.vy,
    0,
    "Immortality also prevents blast knockback",
  );
});

test("Absolution directly kills a fully stacked Juggernaut through armor and resistance", async (t) => {
  const { game } = await lane(t, "juggernaut");
  const [player, target] = game.actors;
  place(game, target, 0, 30, -4);
  target.health = target.armor = 200;
  game.juggernautId = target.id;
  game.world.step();
  equip(player, "bfg");
  game.shoot(player, forward);
  near(
    (game.projectiles[0].mesh.geometry as THREE.IcosahedronGeometry).parameters
      .radius,
    0.5,
  );
  advanceProjectiles(game, 0.15);
  assert.equal(target.health, 0);
  assert.equal(target.armor, 0);
  assert.equal(target.deaths, 1);
  assert.equal(game.juggernautId, player.id);
});

test("Absolution's direct impact preserves Immortality and team damage exclusions", async (t) => {
  for (const protection of ["immortal", "friend"] as const) {
    const { game } = await lane(t, protection === "friend" ? "tdm" : "ffa");
    const player = game.player;
    const target =
      protection === "friend"
        ? game.actors.find((a) => a !== player && a.team === player.team)!
        : game.actors[1];
    place(game, target, 0, 30, -4);
    target.health = target.armor = 200;
    if (protection === "immortal") {
      target.power = "immortal";
      target.powerUntil = 10;
    }
    game.world.step();
    equip(player, "bfg");
    game.shoot(player, forward);
    advanceProjectiles(game, 0.15);
    assert.equal(game.projectiles.length, 0);
    assert.equal(target.health, 200, protection);
    assert.equal(target.armor, 200, protection);
    assert.equal(target.deaths, 0, protection);
  }
});

test("Absolution retains its 2.5-second cooldown when switching away and back", async (t) => {
  const { game } = await lane(t);
  const player = game.player;
  equip(player, "bfg", 3);
  game.shoot(player, forward);
  game.switchWeapon("machinegun");
  game.switchWeapon("bfg");
  game.time = 2.5 - STEP;
  game.shoot(player, forward);
  assert.equal(player.ammo.bfg, 2);
  assert.equal(game.projectiles.length, 1);
  game.time = 2.5;
  game.shoot(player, forward);
  assert.equal(player.ammo.bfg, 1);
  assert.equal(game.projectiles.length, 2);
});

test("Absolution's larger collision volume hits an actor its center line misses", async (t) => {
  const { game } = await lane(t);
  const [player, target] = game.actors;
  place(game, target, 0.7, 30.6, -4);
  target.health = 2000;
  game.world.step();
  equip(player, "bfg");
  game.shoot(player, forward);
  advanceProjectiles(game, 0.15);
  assert.equal(game.projectiles.length, 0);
  assert.equal(target.health, 1000, "an edge contact delivers one direct hit");
});

test("Absolution's swept edge cannot pass through thin world geometry between ticks", async (t) => {
  const { game } = await lane(t);
  // The bolt center misses this wall, but its outer 0.5-unit radius intersects it.
  game.world.createCollider(
    RAPIER.ColliderDesc.cuboid(0.02, 2, 0.005).setTranslation(0.45, 30.6, -2.13),
  );
  game.world.step();
  equip(game.player, "bfg");
  game.shoot(game.player, forward);
  const projectile = game.projectiles[0];
  // Stress the sweep across ten units in one tick; live bolts remain 50 units/s.
  projectile.velocity.set(0, 0, -1200);
  advanceProjectiles(game, STEP);
  assert.equal(game.projectiles.length, 0);
  assert.ok(
    projectile.position.z > -2.13,
    "the swept sphere strikes before its center passes the wall",
  );
  assert.ok(
    projectile.position.z < -1.5,
    "the owner's collider is excluded from the sweep",
  );
});

test("a proximity mine arms on a surface, ignores its owner and team, requires enemy sight and delays its blast", async (t) => {
  const { game } = await lane(t, "tdm");
  const player = game.player;
  const enemy = game.actors.find((actor) => actor.team !== player.team)!;
  const friend = game.actors.find(
    (actor) => actor !== player && actor.team === player.team,
  )!;
  game.world.createCollider(
    RAPIER.ColliderDesc.cuboid(10, 0.1, 10).setTranslation(0, 27.9, 0),
  );
  game.world.step();
  equip(player, "proximity");
  game.shoot(player, new THREE.Vector3(0, -1, 0));
  while (!game.projectiles[0].stuck && game.time < 0.2)
    advanceProjectiles(game, STEP);
  const mine = game.projectiles[0];
  assert.ok(mine.stuck, "the projectile attached to actual world collision");
  near(mine.velocity.length(), 0);
  near(mine.armAt, game.time + 1); // Arming starts one second after attachment.
  assert.equal(player.health, 1000, "initial collision has no damage");
  place(game, friend, 1, 29, 0);
  place(game, enemy, 0, 29, -2);
  game.world.step();
  const armedAt = mine.armAt;
  game.time = armedAt - STEP;
  game.updateProjectiles();
  assert.equal(
    mine.detonateAt,
    null,
    "an enemy in range cannot bypass the arming delay",
  );
  place(game, enemy, 10, 30, 0);
  game.world.step();
  game.time = armedAt + STEP;
  game.updateProjectiles();
  assert.equal(
    mine.detonateAt,
    null,
    "owner and nearby teammate do not trigger it",
  );
  place(game, enemy, 0, 29, -2);
  const cover = wall(game, 0, 29, -1);
  game.updateProjectiles();
  assert.equal(
    mine.detonateAt,
    null,
    "solid world geometry shields a nearby enemy",
  );
  game.world.removeCollider(cover, true);
  game.world.step();
  game.updateProjectiles();
  assert.notEqual(mine.detonateAt, null);
  near(mine.detonateAt!, game.time + 0.5);
  game.time = mine.detonateAt! - STEP;
  game.updateProjectiles();
  assert.equal(enemy.health, 1000, "the trigger has an actual escape window");
  game.time = mine.detonateAt! + STEP;
  game.updateProjectiles();
  assert.equal(game.projectiles.length, 0);
  assert.ok(enemy.health < 1000);
  assert.ok(
    player.health < 1000,
    "a triggered mine retains self-damage to its owner",
  );
  assert.equal(
    friend.health,
    1000,
    "friendly-fire-off also protects against the blast",
  );
});

test("proximity projectiles pass through actors without impact damage before attaching to the world", async (t) => {
  const { game } = await lane(t);
  const [player, target] = game.actors;
  place(game, target, 0, 30, -1);
  wall(game);
  equip(player, "proximity");
  game.shoot(player, forward);
  advanceProjectiles(game, 0.25);
  assert.equal(target.health, 1000);
  assert.equal(game.projectiles.length, 1);
  assert.ok(game.projectiles[0].stuck);
  assert.ok(
    game.projectiles[0].position.z < -2.8,
    "attachment happens at the wall behind the actor",
  );
  assert.equal(
    game.projectiles[0].detonateAt,
    null,
    "impact does not bypass the arming period",
  );
});

test("proximity mines survive owner death, expire, limit each owner to four, and clear on restart", async (t) => {
  const { game, sounds } = await lane(t);
  const player = game.player;
  equip(player, "proximity", 10);
  const launched = [];
  for (let index = 0; index < 5; index++) {
    game.time = index;
    game.shoot(player, new THREE.Vector3(0, 1, 0));
    launched.push(game.projectiles.at(-1)!);
  }
  assert.equal(game.projectiles.length, 4);
  assert.equal(
    launched[0].mesh.parent,
    null,
    "the fifth silently removes the oldest",
  );
  assert.equal(sounds.blast ?? 0, 0, "replacement does not detonate it");
  game.kill(player, game.actors[1]);
  assert.equal(
    game.projectiles.length,
    4,
    "existing traps survive their owner's death",
  );
  game.time = 35;
  game.updateProjectiles();
  assert.equal(
    game.projectiles.length,
    0,
    "mines expire instead of persisting forever",
  );
  game.spawn(player, 0);
  equip(player, "proximity");
  game.shoot(player, new THREE.Vector3(0, 1, 0));
  const mesh = game.projectiles[0].mesh;
  game.start(defaultConfig("ffa"));
  assert.equal(game.projectiles.length, 0);
  assert.equal(mesh.parent, null, "a new match does not retain trap meshes");
});

test("a Juggernaut hunter deploys collected mines despite loaded machinegun ammo, then resumes direct fire at four mines", async (t) => {
  t.mock.method(Math, "random", () => 0.5);
  const f = await fixture(2, "ossuary", "juggernaut");
  t.after(() => f.dispose());
  const { game } = f;
  const [holder, hunter] = game.actors;
  game.juggernautId = holder.id;
  game.time = 12; // This bot's occasional mine-deployment interval.
  holder.health = 1000;
  holder.ammo.machinegun = 0;
  place(game, holder, -5, 0.95, -5);
  place(game, hunter, -5, 0.95, 5);
  hunter.owned.add("proximity");
  hunter.ammo.proximity = 5;
  hunter.nextThink = hunter.nextAttack = 0;
  game.world.step();
  game.botIntent(hunter);
  assert.equal(
    hunter.weapon,
    "proximity",
    "loaded starting ammo must not permanently suppress mine use",
  );
  assert.equal(hunter.enemy, holder);
  assert.ok(
    hunter.target.distanceTo(
      new THREE.Vector3(holder.motion.x, holder.motion.y, holder.motion.z),
    ) < 0.01,
  );
  game.tick();
  assert.equal(
    hunter.ammo.proximity,
    4,
    "the actual bot attack loop launches its selected mine",
  );
  assert.equal(hunter.ammo.machinegun, 100);
  assert.equal(
    game.projectiles.filter((p) => p.kind === "proximity" && p.owner === hunter)
      .length,
    1,
  );

  // Fill the remaining slots through real launches, without forging trap state.
  for (let index = 0; index < 3; index++) {
    game.time += 0.81;
    game.shoot(hunter, forward);
  }
  assert.equal(
    game.projectiles.filter((p) => p.kind === "proximity" && p.owner === hunter)
      .length,
    4,
  );
  hunter.nextThink = hunter.nextAttack = 0;
  game.botIntent(hunter);
  assert.equal(
    hunter.weapon,
    "machinegun",
    "a full mine deployment returns to an available direct weapon",
  );
  assert.equal(
    hunter.enemy,
    holder,
    "equipment choice preserves Juggernaut pursuit",
  );
  assert.ok(
    hunter.target.distanceTo(
      new THREE.Vector3(holder.motion.x, holder.motion.y, holder.motion.z),
    ) < 0.01,
  );
  game.tick();
  assert.equal(
    hunter.ammo.machinegun,
    99,
    "the bot actually resumes direct fire",
  );
  assert.equal(
    hunter.ammo.proximity,
    1,
    "the full mine loadout does not churn its oldest trap",
  );
});

test("every pickup weapon grants its own ammo, caps it at 200, and uses mode-specific respawns", async (t) => {
  for (const mode of ["ffa", "tdm"] as const) {
    const { game } = await lane(t, mode);
    const player = game.player;
    const weapons = WEAPON_ORDER.filter(
      (id) => id !== "melee" && id !== "machinegun",
    );
    for (const [index, weapon] of weapons.entries()) {
      const position = new THREE.Vector3(index * 4, 40, 0);
      const pickup = game.createPickup(weapon, position);
      game.pickups.push(pickup);
      place(game, player, position.x, position.y, position.z);
      game.time = index;
      game.updatePickups();
      assert.ok(player.owned.has(weapon), `${weapon} joins the inventory`);
      assert.equal(player.ammo[weapon], WEAPONS[weapon].pickupAmmo);
      assert.equal(pickup.readyAt, game.time + (mode === "tdm" ? 30 : 5));
      game.updatePickups();
      assert.equal(
        player.ammo[weapon],
        WEAPONS[weapon].pickupAmmo,
        "a hidden pickup cannot be collected twice",
      );
      player.ammo[weapon] = 199;
      game.time = pickup.readyAt;
      game.updatePickups();
      assert.equal(
        player.ammo[weapon],
        200,
        "the respawn is collectible and preserves the ammo cap",
      );
      assert.notEqual(
        player.power,
        weapon,
        "new weapon IDs cannot fall into the power-up branch",
      );
    }
  }
});

test("curated maps keep their chosen weapon counts, resource placements and separated pickups", async (t) => {
  const expected = {
    ossuary: {
      weapons: ["rail", "rocket", "shotgun"],
      resources: [
        ["armor", -25, 4.7, 0],
        ["armor", 25, 4.7, 0],
        ["health", 0, 0.7, -22],
        ["health", 0, 0.7, 22],
        ["health", 21, 0.7, 0],
        ["health", -21, 4.7, 5],
        ["ammo", -16, 0.7, 10],
        ["ammo", 16, 0.7, -10],
        ["ammo", -7, 8.7, 0],
        ["ammo", 7, 8.7, 0],
      ],
    },
    rift: {
      weapons: ["lightning", "rail", "rail", "rocket", "rocket"],
      resources: [
        ["health", -24, 0.75, -8],
        ["health", 21, 4.75, -4],
        ["health", -3, 4.75, 16],
        ["armor", -22, 0.75, 14],
        ["armor", 7, 8.75, -24],
        ["ammo", -23, 0.75, -10],
        ["ammo", 21, 4.75, 3],
        ["ammo", -2.8, 4.75, 3],
      ],
    },
  };
  for (const map of ["ossuary", "rift"] as const) {
    const f = await fixture(2, map);
    t.after(() => f.dispose());
    const pickups = f.game.map.pickups;
    const weapons = pickups.filter((pickup) =>
      WEAPON_ORDER.includes(pickup.kind as WeaponId),
    );
    assert.equal(
      pickups.length,
      13,
      `${map} retains thirteen authored pickups`,
    );
    assert.deepEqual(
      weapons.map((pickup) => pickup.kind).sort(),
      expected[map].weapons,
      `${map} has exactly the curated per-weapon pickup counts`,
    );
    assert.deepEqual(
      getWeaponSlots(pickups),
      [
        "melee",
        "machinegun",
        "rocket",
        "rail",
        map === "ossuary" ? "shotgun" : "lightning",
      ],
      `${map} actual pickups derive the expected five keyboard slots`,
    );
    assert.deepEqual(
      pickups
        .filter((pickup) => ["health", "armor", "ammo"].includes(pickup.kind))
        .map((pickup) => [pickup.kind, ...pickup.position.toArray()]),
      expected[map].resources,
      `${map} health, armor and ammunition placements remain unchanged`,
    );
    for (const [index, first] of pickups.entries()) {
      for (const second of pickups.slice(index + 1)) {
        assert.ok(
          first.position.distanceTo(second.position) >= 1.8,
          `${map}: ${first.kind} and ${second.kind} pickup regions overlap`,
        );
      }
    }
  }
});

test("Ossuary gives every spawn a balanced walking route to its first map weapon", async (t) => {
  const f = await fixture(2, "ossuary");
  t.after(() => f.dispose());
  const { game } = f;
  const navigator = new ArenaNavigator(
    {
      ...game.map,
      edges: game.map.edges.filter((edge) => edge.kind === "walk"),
    },
    game.world,
  );
  const weapons = game.map.pickups.filter((pickup) =>
    WEAPON_ORDER.includes(pickup.kind as WeaponId),
  );
  // These are steady base-speed walking route estimates. Acceleration, combat,
  // bunny hops, jump pads, teleports and other special shortcuts are excluded.
  const seconds = game.map.spawns.map(
    (spawn) =>
      Math.min(
        ...weapons.map((weapon) => navigator.cost(spawn, weapon.position)),
      ) / MOVE.speed,
  );
  for (const [spawn, estimate] of seconds.entries()) {
    assert.ok(
      Number.isFinite(estimate) && estimate <= 4,
      `spawn ${spawn} first-weapon walking estimate must be within four seconds; saw ${estimate.toFixed(3)} s`,
    );
  }
  for (const [left, right] of [
    [0, 1],
    [2, 3],
    [4, 5],
    [6, 7],
  ]) {
    assert.ok(
      Math.abs(seconds[left] - seconds[right]) <= 0.1,
      `mirrored spawns ${left}/${right} must have comparable first-weapon walking routes; saw ${seconds[left].toFixed(3)}/${seconds[right].toFixed(3)} s`,
    );
  }
});
