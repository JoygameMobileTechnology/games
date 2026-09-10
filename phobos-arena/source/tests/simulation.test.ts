import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { STEP, WEAPON_ORDER } from "../src/rules.ts";
import { defaultConfig, scoreFor } from "../src/match.ts";
import { fixture, place } from "./helpers/game-fixture.ts";

test("real arena runs a thirty-second bot skirmish with stable physics, combat and pickups", async (t) => {
  let seed = 1024;
  t.mock.method(Math, "random", () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  });
  const f = await fixture();
  t.after(() => f.dispose());
  const { game } = f;
  const starts = game.actors.map(
    (actor) =>
      new THREE.Vector3(actor.motion.x, actor.motion.y, actor.motion.z),
  );
  const moved = new Set<number>();
  let collectedWeapon = false;
  for (let tick = 0; tick < 30 / STEP; tick++) {
    if (game.player.health <= 0) game.respawnRequested = true;
    game.tick();
    for (const actor of game.actors) {
      const m = actor.motion;
      assert.ok(
        [m.x, m.y, m.z, m.vx, m.vy, m.vz].every(Number.isFinite),
        `actor ${actor.id} retains finite motion`,
      );
      assert.ok(m.y > 0.7, `actor ${actor.id} stays above the solid floor`);
      assert.ok(
        Math.abs(m.x) < 28 && Math.abs(m.z) < 28,
        "perimeter collision contains actors",
      );
      if (Math.hypot(m.x - starts[actor.id].x, m.z - starts[actor.id].z) > 2)
        moved.add(actor.id);
      if (actor.id && (actor.owned.has("rail") || actor.owned.has("rocket")))
        collectedWeapon = true;
    }
  }
  assert.deepEqual(
    [...moved].filter((id) => id !== 0).sort(),
    [1, 2, 3],
    "every bot navigated away from spawn",
  );
  assert.ok(f.sounds.shot > 0, "bots actually fired through Game.shoot");
  assert.ok(
    game.actors.some((actor) => actor.deaths > 0),
    "combat produced a death",
  );
  assert.ok(collectedWeapon, "bots reached and collected a map weapon");
  assert.ok(
    f.events.some((event) => event.text === "4× DAMAGE IS AVAILABLE"),
    "the first timed objective appeared",
  );
  assert.equal(game.ended, false);
});

test("an early respawn tap waits 0.4 seconds, resets loadout and points toward the arena", async (t) => {
  const f = await fixture(2);
  t.after(() => f.dispose());
  const { game } = f,
    player = game.player,
    bot = game.actors[1];
  bot.nextThink = bot.nextAttack = Infinity;
  game.time = 1;
  player.weapon = "rail";
  player.owned.add("rail");
  player.owned.add("rocket");
  player.ammo.rail = 4;
  player.ammo.rocket = 2;
  player.armor = 100;
  player.power = "quad";
  player.powerUntil = 16;
  player.motion.tier = 4;
  game.input.yaw = 2.3;
  game.input.pitch = 0.8;
  game.kill(player, bot);
  assert.equal(player.health, 0);
  assert.equal(player.collider.isEnabled(), false);
  assert.equal(player.power, null);
  game.respawnRequested = true;
  for (let tick = 0; tick < 47; tick++) game.tick();
  assert.equal(
    player.health,
    0,
    "an early tap cannot bypass the respawn delay",
  );
  for (let tick = 0; tick < 2; tick++) game.tick();
  assert.equal(player.health, 125);
  assert.equal(player.armor, 0);
  assert.equal(player.collider.isEnabled(), true);
  assert.equal(player.weapon, "machinegun");
  assert.deepEqual([...player.owned].sort(), ["machinegun", "melee"]);
  assert.deepEqual(
    player.ammo,
    Object.fromEntries(
      WEAPON_ORDER.map((id) => [
        id,
        id === "melee" ? Infinity : id === "machinegun" ? 100 : 0,
      ]),
    ),
    "respawn clears every collected weapon's ammunition",
  );
  assert.equal(player.motion.tier, 0);
  assert.equal(game.input.dead, false);
  assert.equal(game.input.pitch, 0);
  const towardCenter = new THREE.Vector2(
    -player.motion.x,
    -player.motion.z,
  ).normalize();
  const facing = new THREE.Vector2(
    -Math.sin(game.input.yaw),
    -Math.cos(game.input.yaw),
  );
  assert.ok(
    facing.dot(towardCenter) > 0.9999,
    "respawn faces inward regardless of the pre-death direction",
  );
});

test("rocket direct impact is not doubled by splash and Immortality suppresses damage feedback", async (t) => {
  const f = await fixture(2);
  t.after(() => f.dispose());
  const { game } = f,
    shooter = game.player,
    target = game.actors[1];
  place(game, shooter, 0, 0.95, 5);
  place(game, target, 0, 0.95, -5);
  target.health = 250;
  target.armor = 0;
  game.world.step();
  const fireRocket = () => {
    shooter.weapon = "rocket";
    shooter.owned.add("rocket");
    shooter.ammo.rocket = 1;
    shooter.lastShot.rocket = -Infinity;
    game.shoot(shooter, new THREE.Vector3(0, 0, -1));
    assert.equal(game.projectiles.length, 1);
    for (let tick = 0; tick < 120 && game.projectiles.length; tick++) {
      game.time += STEP;
      game.updateProjectiles();
    }
    assert.equal(
      game.projectiles.length,
      0,
      "the real Rapier projectile trace hit its target",
    );
  };
  fireRocket();
  assert.equal(
    target.health,
    150,
    "direct victim receives exactly 100, without that impact’s splash",
  );
  assert.equal(f.sounds.hit, 1);
  assert.equal(f.events.filter((event) => event.kind === "hit").length, 1);

  target.health = 100;
  target.armor = 50;
  target.power = "immortal";
  target.powerUntil = game.time + 15;
  fireRocket();
  assert.equal(target.health, 100);
  assert.equal(target.armor, 50);
  assert.equal(target.deaths, 0);
  assert.equal(
    f.sounds.hit,
    1,
    "no second damage-confirmation sound for an immune hit",
  );
  assert.equal(
    f.events.filter((event) => event.kind === "hit").length,
    1,
    "no damage marker for an immune hit",
  );
});

test("match ends for a four-minute leader; ties enter sudden death and the hard cap produces a draw", async (t) => {
  const f = await fixture(2);
  t.after(() => f.dispose());
  const { game } = f;
  const [player, bot] = game.actors;
  player.kills = 4;
  bot.kills = 3;
  game.time = 239.9;
  game.checkEnd();
  assert.equal(game.ended, false);
  game.time = 240;
  game.checkEnd();
  assert.equal(game.ended, true);
  assert.equal(game.active, false);
  assert.deepEqual(f.outcomes.at(-1), {
    winnerId: player.id,
    winnerTeam: null,
    draw: false,
    reason: "time",
  });
  game.checkEnd();
  game.checkEnd();
  assert.equal(
    f.outcomes.length,
    1,
    "rechecking a finished match emits no duplicate result",
  );

  game.ended = false;
  game.active = true;
  player.kills = bot.kills = 4;
  game.checkEnd();
  assert.equal(game.ended, false);
  assert.equal(game.active, true);
  assert.equal(
    f.events.filter((event) => event.text === "SUDDEN DEATH").length,
    1,
  );
  game.time = 500;
  game.checkEnd();
  assert.equal(game.ended, false);
  assert.equal(
    f.events.filter((event) => event.text === "SUDDEN DEATH").length,
    1,
    "sudden-death announcement is not repeated",
  );
  game.time = 600;
  game.checkEnd();
  assert.equal(game.ended, true);
  assert.equal(game.active, false);
  assert.deepEqual(f.outcomes.at(-1), {
    winnerId: null,
    winnerTeam: null,
    draw: true,
    reason: "cap",
  });

  game.ended = false;
  game.active = true;
  bot.kills = 5;
  game.checkEnd();
  assert.equal(game.ended, true);
  assert.deepEqual(
    f.outcomes.at(-1),
    {
      winnerId: bot.id,
      winnerTeam: null,
      draw: false,
      reason: "cap",
    },
    "the ten-minute cap uses the current score",
  );
});

test("Rift bots traverse connected levels and contest resources through actual gameplay", async (t) => {
  let seed = 831;
  t.mock.method(Math, "random", () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  });
  const f = await fixture(4, "rift");
  t.after(() => f.dispose());
  const { game } = f;
  const moved = new Set<number>(),
    elevations = new Set<number>();
  const starts = game.actors.map(
    (a) => new THREE.Vector3(a.motion.x, a.motion.y, a.motion.z),
  );
  let armed = false;
  for (let i = 0; i < 75 / STEP; i++) {
    if (!game.active) break;
    if (game.player.health <= 0) game.respawnRequested = true;
    game.tick();
    for (const actor of game.actors.slice(1)) {
      const p = new THREE.Vector3(
        actor.motion.x,
        actor.motion.y,
        actor.motion.z,
      );
      assert.ok([p.x, p.y, p.z].every(Number.isFinite));
      if (p.distanceTo(starts[actor.id]) > 4) moved.add(actor.id);
      if (actor.motion.grounded) elevations.add(Math.round((p.y - 0.85) / 4));
      if (actor.owned.has("rocket") || actor.owned.has("rail")) armed = true;
    }
  }
  assert.equal(moved.size, 3, "each bot leaves its spawn via real navigation");
  assert.ok(armed, "bots collect weapons on the map");
  assert.ok(
    elevations.has(0) && elevations.has(1) && elevations.has(2),
    `bots physically reach all three levels; saw ${[...elevations]}`,
  );
  assert.ok(f.sounds.shot > 0, "bots fight on the new map");
});

test("all map pads land the player using the actual speed-capped movement loop", async (t) => {
  for (const id of ["ossuary", "rift"] as const) {
    const f = await fixture(2, id);
    t.after(() => f.dispose());
    const { game } = f;
    const bot = game.actors[1];
    bot.health = 0;
    bot.deadAt = Infinity;
    bot.collider.setEnabled(false);
    for (const pad of game.map.jumpPads) {
      const player = game.player;
      place(game, player, pad.position.x, pad.position.y + 0.9, pad.position.z);
      player.health = 125;
      player.padUntil = 0;
      player.portalUntil = 0;
      player.motion.grounded = false;
      game.world.step();
      let landing: THREE.Vector3 | null = null;
      for (let i = 0; i < Math.ceil((pad.flightTime + 0.5) / STEP); i++) {
        game.tick();
        if (!landing && player.padUntil > 0 && player.motion.grounded)
          landing = new THREE.Vector3(
            player.motion.x,
            player.motion.y,
            player.motion.z,
          );
      }
      assert.ok(player.health > 0, `${id}/${pad.id} survives the launch`);
      assert.ok(
        player.motion.grounded,
        `${id}/${pad.id} reaches a walkable landing`,
      );
      assert.ok(landing, `${id}/${pad.id} records an actual collision landing`);
      assert.ok(
        Math.hypot(landing.x - pad.landing.x, landing.z - pad.landing.z) < 1.5,
        `${id}/${pad.id} first lands at its declared route endpoint: ${landing.toArray()}`,
      );
      assert.ok(
        Math.abs(landing.y - pad.landing.y) < 0.25,
        `${id}/${pad.id} reaches the intended floor`,
      );
    }
  }
});

test("teleporter waits for an occupied exit, then transports and preserves horizontal speed", async (t) => {
  const f = await fixture(2, "rift");
  t.after(() => f.dispose());
  const { game } = f,
    player = game.player,
    blocker = game.actors[1];
  const portal = game.map.teleporters[0];
  blocker.nextThink = blocker.nextAttack = Infinity;
  place(game, player, portal.position.x, portal.position.y, portal.position.z);
  place(
    game,
    blocker,
    portal.destination.x,
    portal.destination.y,
    portal.destination.z,
  );
  game.world.step();
  game.tick();
  assert.ok(
    Math.hypot(
      player.motion.x - portal.position.x,
      player.motion.z - portal.position.z,
    ) < 0.2,
    "occupied arrival does not overlap another player",
  );
  blocker.health = 0;
  blocker.deadAt = Infinity;
  blocker.collider.setEnabled(false);
  player.motion.vx = 5;
  player.motion.vz = 0;
  player.motion.grounded = false;
  game.tick();
  assert.ok(
    Math.hypot(
      player.motion.x - portal.destination.x,
      player.motion.z - portal.destination.z,
    ) < 0.2,
  );
  assert.ok(
    Math.abs(Math.hypot(player.motion.vx, player.motion.vz) - 5) < 0.01,
  );
  assert.equal(game.input.yaw, portal.yaw);
  assert.ok(
    player.portalUntil > game.time,
    "arrival cooldown prevents immediate bouncing",
  );
});

test("restarting Duel, eight-player TDM and six-player Juggernaut disposes old physics and actor meshes", async (t) => {
  const f = await fixture(2, "ossuary", "duel");
  t.after(() => f.dispose());
  const { game } = f;
  const staticColliders = game.world.colliders.len() - 2;
  let previous = [...game.actors];
  assert.equal(game.world.characterControllers.size, 2);
  for (const [mode, population] of [
    ["tdm", 8],
    ["juggernaut", 6],
  ] as const) {
    game.actors[0].kills = 12;
    const config = defaultConfig(mode);
    config.population = population;
    config.botDifficulties = Array.from({ length: population - 1 }, (_, i) =>
      i % 2 ? "Competitive" : "Easy",
    );
    game.start(config);
    assert.equal(game.actors.length, population);
    assert.equal(
      game.world.bodies.len(),
      population,
      "only current player bodies remain",
    );
    assert.equal(game.world.colliders.len(), staticColliders + population);
    assert.equal(
      game.world.characterControllers.size,
      population,
      "controllers do not accumulate across restarts",
    );
    assert.ok(
      previous.every((actor) => actor.mesh.parent === null),
      "old actor meshes leave the scene",
    );
    assert.ok(game.actors.every((actor) => actor.mesh.parent === game.scene));
    assert.ok(
      game.actors.every(
        (actor) =>
          actor.kills === 0 && actor.deaths === 0 && actor.possession === 0,
      ),
    );
    assert.equal(
      new Set(game.actors.map((actor) => actor.name)).size,
      population,
    );
    assert.deepEqual(
      game.actors.slice(1).map((actor) => actor.difficulty),
      config.botDifficulties,
    );
    if (mode === "tdm") {
      assert.equal(game.actors.filter((actor) => actor.team === 0).length, 4);
      assert.equal(game.actors.filter((actor) => actor.team === 1).length, 4);
    } else {
      assert.ok(game.actors.every((actor) => actor.team === null));
      assert.ok(game.actors.some((actor) => actor.id === game.juggernautId));
    }
    previous = [...game.actors];
  }
});

test("TDM ends on aggregate team score and emits its result only once", async (t) => {
  const f = await fixture(4, "ossuary", "tdm");
  t.after(() => f.dispose());
  const { game } = f;
  game.config.scoreLimit = 8;
  const first = game.actors.filter((actor) => actor.team === 0);
  const second = game.actors.filter((actor) => actor.team === 1);
  first[0].kills = first[1].kills = 4;
  second[0].kills = 7;
  game.checkEnd();
  assert.deepEqual(f.outcomes, [
    { winnerId: null, winnerTeam: 0, draw: false, reason: "score" },
  ]);
  assert.equal(game.active, false);
  game.checkEnd();
  game.checkEnd();
  assert.equal(f.outcomes.length, 1);
});

test("TDM hitscan ignores teammates, bots choose enemies, and map weapons use a thirty-second respawn", async (t) => {
  t.mock.method(Math, "random", () => 0.5);
  const f = await fixture(4, "ossuary", "tdm");
  t.after(() => f.dispose());
  const { game } = f,
    player = game.player;
  const friend = game.actors.find(
    (actor) => actor !== player && actor.team === player.team,
  )!;
  const enemy = game.actors.find((actor) => actor.team !== player.team)!;
  const other = game.actors.find(
    (actor) => actor !== player && actor !== friend && actor !== enemy,
  )!;
  for (const actor of game.actors.slice(1))
    actor.nextThink = actor.nextAttack = Infinity;
  place(game, player, -5, 0.95, 5);
  place(game, friend, -5, 0.95, 0);
  place(game, enemy, -5, 0.95, -5);
  place(game, other, 16, 0.95, 18);
  game.input.yaw = game.input.pitch = 0;
  game.world.step();
  game.tick();
  assert.equal(
    player.ammo.machinegun,
    100,
    "aiming at a teammate does not start auto-fire",
  );
  assert.equal(friend.health, 125);
  game.shoot(player, new THREE.Vector3(0, 0, -1));
  assert.equal(
    friend.health,
    125,
    "even an explicit weapon trace cannot damage a teammate",
  );

  place(game, friend, 5, 0.95, 0);
  player.lastShot.machinegun = -Infinity;
  game.world.step();
  game.tick();
  assert.equal(
    enemy.health,
    120,
    "TDM's machinegun deals five damage instead of seven",
  );
  place(game, friend, -5, 0.95, 0);
  place(game, player, -5, 0.95, 3);
  friend.nextThink = 0;
  game.world.step();
  game.botIntent(friend);
  assert.equal(
    friend.enemy,
    enemy,
    "a closer teammate is excluded from the bot's target selection",
  );

  const rocket = game.pickups.find((pickup) => pickup.kind === "rocket")!;
  game.time = 2;
  place(
    game,
    player,
    rocket.position.x,
    rocket.position.y + 0.2,
    rocket.position.z,
  );
  game.updatePickups();
  assert.ok(player.owned.has("rocket"));
  assert.equal(
    rocket.readyAt,
    32,
    "TDM weapon timing is applied by real pickup collection",
  );
});

test("TDM rockets cannot hurt or push teammates but still damage opponents and their owner", async (t) => {
  const f = await fixture(4, "ossuary", "tdm");
  t.after(() => f.dispose());
  const { game } = f,
    shooter = game.player;
  const friend = game.actors.find(
    (actor) => actor !== shooter && actor.team === shooter.team,
  )!;
  const enemy = game.actors.find((actor) => actor.team !== shooter.team)!;
  const other = game.actors.find(
    (actor) => actor !== shooter && actor !== friend && actor !== enemy,
  )!;
  place(game, other, 16, 0.95, 18);
  const fire = () => {
    shooter.weapon = "rocket";
    shooter.owned.add("rocket");
    shooter.ammo.rocket = 1;
    shooter.lastShot.rocket = -Infinity;
    game.world.step();
    game.shoot(shooter, new THREE.Vector3(0, 0, -1));
    for (let i = 0; game.projectiles.length && i < 120; i++) {
      game.time += STEP;
      game.updateProjectiles();
    }
    assert.equal(
      game.projectiles.length,
      0,
      "a real projectile impact resolved",
    );
  };
  place(game, shooter, -5, 0.95, 5);
  place(game, friend, -5, 0.95, 0);
  place(game, enemy, -5, 0.95, -5);
  friend.health = 200;
  friend.armor = 50;
  fire();
  assert.deepEqual(
    [friend.health, friend.armor],
    [200, 50],
    "a direct rocket hit respects friendly fire off",
  );

  place(game, shooter, -5, 0.95, 2.4);
  place(game, enemy, -5, 0.95, 0);
  place(game, friend, -4, 0.95, 0.8);
  shooter.health = enemy.health = 250;
  shooter.armor = enemy.armor = 0;
  fire();
  assert.equal(
    enemy.health,
    150,
    "the direct enemy receives one hundred damage",
  );
  assert.ok(
    shooter.health < 250,
    "the owner's nearby explosion retains self-damage",
  );
  assert.ok(
    Math.hypot(shooter.motion.vx, shooter.motion.vy, shooter.motion.vz) > 0,
    "self splash retains rocket-jump force",
  );
  assert.deepEqual(
    [friend.health, friend.armor],
    [200, 50],
    "nearby teammates also ignore splash",
  );
  assert.deepEqual(
    [friend.motion.vx, friend.motion.vy, friend.motion.vz],
    [0, 0, 0],
    "friendly explosions do not push teammates",
  );

  // Positive control: identical positions, only the allegiance changes. This
  // proves the friendly-fire assertion is not accidentally passing due to cover.
  friend.team = enemy.team;
  place(game, shooter, -5, 0.95, 2.4);
  enemy.health = 250;
  fire();
  assert.ok(
    friend.health < 200 || friend.armor < 50,
    "the same unobstructed splash damages an opponent",
  );
  assert.ok(
    Math.hypot(friend.motion.vx, friend.motion.vy, friend.motion.vz) > 0,
    "opponent splash retains knockback",
  );
});

test("Juggernaut outgoing damage stacks with Quad and resistance is applied before armor", async (t) => {
  t.mock.method(Math, "random", () => 0.5);
  const f = await fixture(4, "ossuary", "juggernaut");
  t.after(() => f.dispose());
  const { game } = f,
    holder = game.player,
    target = game.actors[1];
  game.juggernautId = holder.id;
  place(game, holder, -5, 0.95, 5);
  place(game, target, -5, 0.95, -5);
  target.health = 500;
  target.armor = 0;
  game.world.step();
  game.shoot(holder, new THREE.Vector3(0, 0, -1));
  assert.equal(target.health, 486, "the holder deals 2× machinegun damage");
  holder.power = "quad";
  holder.powerUntil = 15;
  holder.lastShot.machinegun = -Infinity;
  game.shoot(holder, new THREE.Vector3(0, 0, -1));
  assert.equal(
    target.health,
    430,
    "Quad and the role combine to deal 8× damage",
  );

  holder.health = 200;
  holder.armor = 100;
  game.hurt(holder, 100, target);
  assert.deepEqual(
    [holder.health, holder.armor],
    [184, 66],
    "fifty incoming damage is divided between armor and health",
  );
  holder.power = "immortal";
  holder.powerUntil = game.time + 15;
  const damageSounds = f.sounds.hurt;
  game.hurt(holder, 10000, target);
  assert.deepEqual([holder.health, holder.armor], [184, 66]);
  assert.equal(
    f.sounds.hurt,
    damageSounds,
    "an immune hit emits no hurt confirmation",
  );
});

test("Juggernaut retains fractional holding time across role transfers and void death bypasses Immortality", async (t) => {
  const f = await fixture(4, "ossuary", "juggernaut");
  t.after(() => f.dispose());
  const { game } = f,
    player = game.player,
    bot = game.actors[1];
  const keepQuiet = () => {
    for (const actor of game.actors) {
      actor.nextThink = actor.nextAttack = Infinity;
      actor.ammo.machinegun = 0;
      if (actor.health > 0) actor.health = 10000;
    }
  };
  const advance = (ticks: number) => {
    for (let i = 0; i < ticks; i++) game.tick();
  };
  game.juggernautId = player.id;
  keepQuiet();
  advance(90);
  assert.ok(Math.abs(player.possession - 0.75) < 1e-8);
  assert.equal(scoreFor(game.config, player), 0);
  game.kill(player, bot);
  assert.equal(
    game.juggernautId,
    bot.id,
    "the living killer inherits the role",
  );
  keepQuiet();
  advance(60);
  assert.ok(Math.abs(bot.possession - 0.5) < 1e-8);
  game.spawn(player, 0);
  game.kill(bot, player);
  assert.equal(game.juggernautId, player.id);
  keepQuiet();
  advance(60);
  assert.ok(
    Math.abs(player.possession - 1.25) < 1e-8,
    "respawn and reacquisition retain the earlier fractional time",
  );
  assert.equal(scoreFor(game.config, player), 1);
  assert.equal(bot.kills, 1, "frags remain separate statistics");
  assert.equal(
    scoreFor(game.config, bot),
    0,
    "a kill itself grants no possession point",
  );

  player.power = "immortal";
  player.powerUntil = game.time + 15;
  place(game, player, 0, game.map.killY - 2, 0);
  game.world.step();
  game.tick();
  assert.equal(
    player.health,
    0,
    "falling out of the map kills an immortal holder",
  );
  assert.equal(player.power, null);
  assert.notEqual(game.juggernautId, player.id);
  assert.ok(
    game.actors.some(
      (actor) => actor.id === game.juggernautId && actor.health > 0,
    ),
    "environmental death chooses another living holder",
  );
});

test("Juggernaut bots pursue the visible holder ahead of a closer ordinary opponent", async (t) => {
  const f = await fixture(4, "ossuary", "juggernaut");
  t.after(() => f.dispose());
  const { game } = f,
    ordinary = game.player,
    hunter = game.actors[1],
    holder = game.actors[2],
    other = game.actors[3];
  place(game, hunter, -5, 0.95, 0);
  place(game, ordinary, -5, 0.95, 3);
  place(game, holder, -5, 0.95, -7);
  place(game, other, 16, 0.95, 18);
  game.juggernautId = holder.id;
  hunter.nextThink = 0;
  game.world.step();
  game.botIntent(hunter);
  assert.equal(hunter.enemy, holder);
  assert.ok(
    hunter.target.distanceTo(
      new THREE.Vector3(holder.motion.x, holder.motion.y, holder.motion.z),
    ) < 0.1,
    "the bot's authored-route destination follows the objective holder",
  );
});

for (const difficulty of ["Easy", "Medium", "Competitive"] as const) {
  test(`${difficulty} hunters pursue a hidden Juggernaut despite low health, no ammunition and nearby resources`, async (t) => {
    t.mock.method(Math, "random", () => 0.5);
    const f = await fixture(4, "ossuary", "juggernaut");
    t.after(() => f.dispose());
    const { game } = f;
    const [ordinary, hunter, holder, other] = game.actors;
    game.time = 4;
    game.juggernautId = holder.id;
    for (const actor of game.actors) {
      actor.nextThink = actor.nextAttack = Infinity;
      actor.enemy = null;
    }
    place(game, hunter, -5, 0.95, 9);
    place(game, ordinary, -5, 0.95, 6);
    place(game, holder, -16, 0.95, 9);
    place(game, other, 16, 0.95, 18);
    hunter.difficulty = difficulty;
    hunter.health = 10;
    hunter.armor = 0;
    hunter.ammo.machinegun = hunter.ammo.rocket = hunter.ammo.rail = 0;
    hunter.motion.grounded = true;
    hunter.nextThink = 0;
    game.pickups.forEach((pickup) => {
      pickup.readyAt = Infinity;
    });
    const health = game.createPickup("health", new THREE.Vector3(-3, 0.7, 9));
    const ammo = game.createPickup("ammo", new THREE.Vector3(-4, 0.7, 9));
    game.pickups.push(health, ammo);
    game.world.step();
    assert.equal(
      game.canSee(hunter, holder),
      false,
      "the cathedral partition blocks the holder",
    );
    assert.equal(
      game.canSee(hunter, ordinary),
      true,
      "a closer ordinary opponent is visible",
    );
    game.botIntent(hunter);
    assert.equal(
      hunter.enemy,
      holder,
      "the hidden role remains the combat target",
    );
    assert.equal(
      hunter.weapon,
      "melee",
      "an empty hunter equips its infinite-ammo claw",
    );
    assert.ok(
      hunter.target.distanceTo(
        new THREE.Vector3(holder.motion.x, holder.motion.y, holder.motion.z),
      ) < 0.01,
    );
    assert.notEqual(
      hunter.target.x,
      health.position.x,
      "critical health does not divert the hunter",
    );
    assert.ok(
      Math.abs(hunter.yaw - Math.PI / 2) < 0.001,
      "aim tracks the holder rather than the closer opponent",
    );

    // With ammunition restored, an otherwise-ready shot still obeys the wall.
    hunter.ammo.machinegun = 100;
    hunter.nextThink = hunter.nextAttack = 0;
    game.tick();
    assert.equal(
      hunter.ammo.machinegun,
      100,
      "role awareness cannot fire through solid geometry",
    );
    assert.equal(f.sounds.shot ?? 0, 0);

    // Moving the target into the nave provides a positive control for that gate.
    place(game, ordinary, -2, 0.95, 6);
    place(game, holder, -5, 0.95, 0);
    hunter.nextThink = hunter.nextAttack = 0;
    game.world.step();
    assert.equal(game.canSee(hunter, holder), true);
    game.tick();
    assert.equal(
      hunter.ammo.machinegun,
      99,
      "the same hunter fires once visibility is restored",
    );

    // A transfer cancels the old reaction deadline even during an authored launch.
    hunter.nextThink = Infinity;
    hunter.ammo.machinegun = 0;
    hunter.motion.grounded = false;
    hunter.padUntil = game.time + 2;
    Object.assign(hunter.motion, { vx: 3, vy: 8, vz: -2 });
    game.kill(holder, ordinary);
    assert.equal(game.juggernautId, ordinary.id);
    const intent = game.botIntent(hunter) as {
      x: number;
      z: number;
      jump: boolean;
    };
    assert.equal(
      hunter.enemy,
      ordinary,
      "the new holder takes priority immediately after transfer",
    );
    assert.ok(
      hunter.target.distanceTo(
        new THREE.Vector3(
          ordinary.motion.x,
          ordinary.motion.y,
          ordinary.motion.z,
        ),
      ) < 0.01,
    );
    assert.deepEqual(
      [intent.x, intent.z, intent.jump],
      [0, 0, false],
      "retargeting preserves pad flight",
    );
    assert.deepEqual(
      [hunter.motion.vx, hunter.motion.vy, hunter.motion.vz],
      [3, 8, -2],
    );

    game.kill(ordinary, hunter);
    hunter.motion.grounded = true;
    hunter.padUntil = 0;
    game.botIntent(hunter);
    assert.equal(game.juggernautId, hunter.id);
    assert.notEqual(
      hunter.enemy,
      hunter,
      "the current holder never hunts itself",
    );
    assert.ok(
      hunter.target.distanceTo(health.position) < 0.01,
      "the holder can pursue recovery resources",
    );
  });
}

test("an empty hunter closes beyond the last navigation node and reaches the Juggernaut with melee", async (t) => {
  const f = await fixture(2, "ossuary", "juggernaut");
  t.after(() => f.dispose());
  const { game } = f,
    holder = game.player,
    hunter = game.actors[1];
  game.juggernautId = holder.id;
  place(game, holder, -5, 0.95, 9);
  place(game, hunter, -5, 0.95, 5);
  holder.health = 1000;
  holder.ammo.machinegun = 0;
  hunter.health = 10;
  hunter.ammo.machinegun = hunter.ammo.rocket = hunter.ammo.rail = 0;
  hunter.nextThink = 0;
  game.world.step();
  for (let step = 0; step < 240 && !(f.sounds.hurt > 0); step++) game.tick();
  assert.equal(hunter.weapon, "melee");
  assert.ok(f.sounds.hurt > 0, "actual contact combat damaged the holder");
  assert.ok(
    holder.health < 980,
    "the result is melee damage, not only overhealth decay",
  );
  assert.ok(
    Math.hypot(
      hunter.motion.x - holder.motion.x,
      hunter.motion.z - holder.motion.z,
    ) <= 0.91,
  );
});
