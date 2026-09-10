import test from "node:test";
import assert from "node:assert/strict";
import { STEP, type WeaponId } from "../src/rules.ts";
import { fixture, place } from "./helpers/game-fixture.ts";

test("Wraith held intent sustains its cadence and release stops the actual simulation", async t => {
  const f = await fixture(2);
  t.after(() => f.dispose());
  const { game } = f, player = game.player;
  for (const [i, actor] of game.actors.entries()) {
    place(game, actor, i * 20, 30, 0);
    actor.nextAttack = actor.nextThink = Infinity;
    actor.enemy = null;
  }
  player.owned.add("plasma"); player.ammo.plasma = 20;
  game.switchWeapon("plasma");
  const idle = game.input.consume;
  let held = true;
  game.input.consume = () => ({ ...idle(), fireHeld: held });
  for (let i = 0; i < .35 / STEP; i++) game.tick();
  assert.equal(player.ammo.plasma, 16, "four shots at the 100 ms cadence");
  held = false;
  for (let i = 0; i < .3 / STEP; i++) game.tick();
  assert.equal(player.ammo.plasma, 16, "release does not append a shot");
  held = true; player.ammo.plasma = 1;
  for (let i = 0; i < .35 / STEP; i++) game.tick();
  assert.equal(player.ammo.plasma, 0, "held fire stops at empty ammo");
});

test("held intent never repeats another projectile weapon or refreshes Wraith cooldown", async t => {
  const f = await fixture(2);
  t.after(() => f.dispose());
  const { game } = f, player = game.player;
  game.actors.forEach((actor, i) => {
    place(game, actor, i * 20, 30, 0);
    actor.nextAttack = actor.nextThink = Infinity;
  });
  const idle = game.input.consume;
  let tap = false;
  game.input.consume = () => ({ ...idle(), fire: tap, fireHeld: true });
  for (const weapon of ["rocket", "grenade", "bfg", "nailgun", "proximity"] as WeaponId[]) {
    player.owned.add(weapon); player.ammo[weapon] = 10;
    game.switchWeapon(weapon);
    for (let i = 0; i < 15; i++) game.tick();
    assert.equal(player.ammo[weapon], 10, `${weapon} ignores hold`);
    tap = true; game.tick(); tap = false;
    assert.equal(player.ammo[weapon], 9, `${weapon} retains a fresh shot`);
  }
  player.owned.add("plasma"); player.ammo.plasma = 10;
  game.switchWeapon("plasma"); game.tick();
  assert.equal(player.ammo.plasma, 9);
  game.switchWeapon("machinegun"); game.switchWeapon("plasma"); game.tick();
  assert.equal(player.ammo.plasma, 9, "switching cannot reset the plasma cooldown");
});

test("switching in the same tick discards the old Wraith activation snapshot", async t => {
  const f = await fixture(2); t.after(() => f.dispose());
  const { game } = f, player = game.player;
  player.owned.add("plasma"); player.owned.add("bfg");
  player.ammo.plasma = player.ammo.bfg = 5;
  game.switchWeapon("plasma");
  const idle = game.input.consume;
  game.input.consume = () => ({ ...idle(), fire: true, fireHeld: true, switchTo: "bfg" });
  game.tick();
  assert.equal(player.weapon, "bfg");
  assert.equal(player.ammo.bfg, 5, "the old touch/mouse activation cannot fire the new cannon");
  game.input.consume = () => ({ ...idle(), fire: true, fireHeld: false });
  game.tick();
  assert.equal(player.ammo.bfg, 4, "a fresh command still fires normally");
});
