import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { WEAPONS, WEAPON_PICKUP_TIER, shouldAutoEquipPickup, type WeaponId } from "../src/rules.ts";
import { Game, type Actor } from "../src/game.ts";
import { Input } from "../src/input.ts";
import { defaultConfig } from "../src/match.ts";
import { idleCommand } from "../src/lan/types.ts";
import type { Profile, Settings } from "../src/profile.ts";
import { fixture, place, type HeadlessGame } from "./helpers/game-fixture.ts";

const settings = (): Settings => ({ sensitivity: 1, fov: 95, railAuto: true, shotgunAuto: true,
  volume: 0, resolution: 1, crosshair: "cross", crosshairColor: "#ffffff", gore: false });
const profile = (): Profile => ({ name: "Pickup tester", settings: settings(), stats: {
  matches: 0, wins: 0, kills: 0, deaths: 0, tournaments: 0, tournamentWins: 0, tournamentDraws: 0,
} });
const forward = new THREE.Vector3(0, 0, -1);
const standard: WeaponId[] = ["rocket", "shotgun", "lightning", "grenade", "plasma", "nailgun", "proximity", "chaingun"];
type PickupGame = Game | HeadlessGame;

function prepare(game: PickupGame) {
  game.actors.forEach((actor, index) => {
    place(game as HeadlessGame, actor, index * 20, 30, 0);
    actor.health = 1000; actor.armor = 0;
    actor.nextThink = actor.nextAttack = Infinity; actor.enemy = null;
  });
  (game as HeadlessGame).pickups.forEach(pickup => { pickup.readyAt = Infinity; });
  game.world.step();
}
async function lane(t: TestContext) {
  const f = await fixture(2);
  t.after(() => f.dispose());
  prepare(f.game);
  return f.game;
}
function equip(actor: Actor, weapon: WeaponId, ammo = 20) {
  actor.weapon = weapon; actor.owned.add(weapon); actor.ammo[weapon] = ammo;
  actor.lastShot[weapon] = -Infinity;
}
function addPickup(game: PickupGame, actor: Actor, weapon: WeaponId) {
  const testGame = game as HeadlessGame;
  const pickup = testGame.createPickup(weapon, new THREE.Vector3(actor.motion.x, actor.motion.y, actor.motion.z));
  testGame.pickups.push(pickup);
  return pickup;
}
function collect(game: PickupGame, actor: Actor, weapon: WeaponId) {
  const pickup = addPickup(game, actor, weapon);
  (game as HeadlessGame).updatePickups();
  return pickup;
}

// Actual mouse listener/hold/release behavior on minimal browser event surfaces.
function mouseInput(t: TestContext) {
  const windowSurface = Object.assign(new EventTarget(), { requestAnimationFrame: () => 1, cancelAnimationFrame: () => {} });
  const canvas = Object.assign(new EventTarget(), { requestPointerLock: () => Promise.resolve() });
  const documentSurface = Object.assign(new EventTarget(), { pointerLockElement: canvas, getElementById: () => null });
  const replacements = { window: windowSurface, document: documentSurface, innerWidth: 1000, innerHeight: 500 };
  const previous = new Map(Object.keys(replacements).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(replacements)) Object.defineProperty(globalThis, key, { configurable: true, value });
  t.after(() => {
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  });
  const input = new Input(canvas as unknown as HTMLCanvasElement, settings()); input.enabled = true;
  const press = (down: boolean) => {
    const event = Object.assign(new Event(down ? "pointerdown" : "pointerup", { cancelable: true }), {
      pointerId: 1, pointerType: "mouse", button: 0, clientX: 800, clientY: 250, isPrimary: true,
    });
    (down ? canvas : windowSurface).dispatchEvent(event);
  };
  return { input, press };
}

test("pickup priority has five tiers and promotes only strictly higher weapons", () => {
  const tiers = WEAPON_PICKUP_TIER, promotes = shouldAutoEquipPickup;
  assert.deepEqual(tiers, { melee: 0, machinegun: 1, rocket: 2, shotgun: 2, lightning: 2, grenade: 2,
    plasma: 2, nailgun: 2, proximity: 2, chaingun: 2, rail: 3, bfg: 4 });
  for (const weapon of standard) {
    assert.equal(promotes("machinegun", weapon), true, weapon);
    assert.equal(promotes("rocket", weapon), false, `same-tier ${weapon}`);
    assert.equal(promotes(weapon, "rail"), true);
  }
  assert.equal(promotes("melee", "machinegun"), true);
  assert.equal(promotes("rail", "bfg"), true);
  assert.equal(promotes("bfg", "rail"), false);
  assert.equal(promotes("rail", "rail"), false);
});

test("collecting any higher-tier weapon immediately selects it and still grants its normal ammo", async (t) => {
  const game = await lane(t), player = game.player;
  for (const weapon of [...standard, "rail", "bfg"] as WeaponId[]) {
    equip(player, "machinegun"); player.owned.delete(weapon); player.ammo[weapon] = 0;
    const pickup = collect(game, player, weapon);
    assert.equal(player.weapon, weapon, `${weapon} is selected during collection`);
    assert.equal(player.owned.has(weapon), true);
    assert.equal(player.ammo[weapon], WEAPONS[weapon].pickupAmmo);
    assert.equal(pickup.readyAt, 5, "the existing FFA pickup cycle remains unchanged");
  }
  equip(player, "melee"); collect(game, player, "machinegun");
  assert.equal(player.weapon, "machinegun");
});

test("same-tier and lower-tier pickups retain the selected weapon while supplying ammo", async (t) => {
  const game = await lane(t), player = game.player;
  const cases: [WeaponId, WeaponId][] = [
    ["rocket", "plasma"], ["plasma", "shotgun"], ["lightning", "proximity"],
    ["rail", "rocket"], ["bfg", "rail"], ["bfg", "machinegun"], ["bfg", "melee"], ["rail", "rail"],
  ];
  for (const [current, picked] of cases) {
    equip(player, current); player.ammo[picked] = 1;
    collect(game, player, picked);
    assert.equal(player.weapon, current, `${current} remains selected over ${picked}`);
    assert.equal(player.ammo[picked], picked === "melee" ? Infinity : 1 + WEAPONS[picked].pickupAmmo);
  }
});

test("an already-owned higher weapon is selected on refill, including at the ammo cap", async (t) => {
  const game = await lane(t), player = game.player;
  equip(player, "rail", 2); equip(player, "rocket");
  collect(game, player, "rail");
  assert.equal(player.weapon, "rail"); assert.equal(player.ammo.rail, 2 + WEAPONS.rail.pickupAmmo);
  equip(player, "plasma", 200); equip(player, "machinegun");
  collect(game, player, "plasma");
  assert.equal(player.weapon, "plasma"); assert.equal(player.ammo.plasma, 200);
});

test("pickup selection preserves each weapon's existing firing cooldown", async (t) => {
  const game = await lane(t), player = game.player;
  for (const [weapon, cooldown] of [["rail", 1.5], ["bfg", 2.5]] as const) {
    game.time = 1; equip(player, weapon);
    game.shoot(player, forward);
    assert.equal(player.lastShot[weapon], 1);
    game.switchWeapon("machinegun"); game.time = 1.1;
    collect(game, player, weapon);
    const ammo = player.ammo[weapon];
    assert.equal(player.weapon, weapon);
    assert.equal(player.lastShot[weapon], 1, "collecting cannot refresh a fired weapon");
    game.shoot(player, forward); assert.equal(player.ammo[weapon], ammo);
    game.time = 1 + cooldown; game.shoot(player, forward);
    assert.equal(player.ammo[weapon], ammo - 1, "normal firing resumes at the original cooldown boundary");
  }
});

test("bots collect weapons without human auto-selection and retain their distance-based choice", async (t) => {
  const game = await lane(t), bot = game.actors[1], target = game.player;
  place(game, bot, 0, 30, 0); place(game, target, 0, 30, -30); game.world.step();
  equip(bot, "machinegun"); collect(game, bot, "rail");
  assert.equal(bot.weapon, "machinegun", "collection itself does not override bot strategy");
  assert.equal(bot.owned.has("rail"), true); assert.ok(bot.ammo.rail > 0);
  bot.nextThink = 0; game.botIntent(bot);
  assert.equal(bot.weapon, "rail", "the existing long-range decision can select the new weapon");
});

test("a local upgrade cancels the real held-fire gesture until release and repress", async (t) => {
  const game = await lane(t), player = game.player;
  game.profile.settings = settings();
  const { input, press } = mouseInput(t);
  game.input = input;
  player.owned.add("plasma"); player.ammo.plasma = 20; game.switchWeapon("plasma");
  press(true);
  const before = input.consume(); assert.equal(before.fireHeld, true); assert.equal(before.fire, true);
  collect(game, player, "bfg");
  assert.equal(player.weapon, "bfg");
  assert.equal(input.consume().fireHeld, false);
  const ammo = player.ammo.bfg;
  game.tick();
  assert.equal(player.ammo.bfg, ammo, "a held input cannot become a new cannon shot after selection");
  press(false); press(true); game.tick();
  assert.equal(player.ammo.bfg, ammo - 1, "a fresh press still fires");
});

test("nonzero LAN pickup selection reaches replicas without firing on held or repeated snapshots", async (t) => {
  const authority = await Game.createAuthority({ mapId: "ossuary", config: { ...defaultConfig("ffa"), population: 4 }, matchId: "pickup-lan",
    roster: [0, 1, 2, 3].map(id => ({ id, name: `Slot ${id}`, controller: id < 2 ? "human" : "bot" })) });
  t.after(() => authority.disposeAuthority()); prepare(authority);
  const actor = authority.actors[1]; equip(actor, "plasma");
  const replica = new Game(null, profile()); t.after(() => replica.disposeAuthority());
  replica.startReplica(authority.snapshot(), 1);
  const { input, press } = mouseInput(t);
  (replica as unknown as { input: Input }).input = input;
  input.setActiveWeapon(replica.player.weapon); press(true);
  assert.equal(replica.input.consume().fireHeld, true);
  addPickup(authority, actor, "bfg");
  authority.stepAuthority(new Map([[1, { ...idleCommand(1), fireHeld: true }]]));
  const snapshot = authority.snapshot();
  assert.equal(snapshot.actors[1].weapon, "bfg");
  const ammo = snapshot.actors[1].ammo.bfg;
  assert.equal(ammo, WEAPONS.bfg.pickupAmmo);
  replica.applySnapshot(snapshot); replica.applySnapshot(snapshot);
  assert.equal(replica.player.id, 1); assert.equal(replica.player.weapon, "bfg");
  assert.equal(replica.input.consume().fireHeld, false);
  authority.stepAuthority(new Map([[1, { ...idleCommand(2), fireHeld: true }]]));
  const repeated = authority.snapshot(); replica.applySnapshot(repeated);
  assert.equal(actor.ammo.bfg, ammo, "queued plasma holds cannot fire the newly selected cannon");
  assert.equal(repeated.events.some(event => event.type === "shot" && event.weapon === "bfg"), false);
  assert.equal(replica.input.consume().fire, false);
  press(false); press(true);
  const fresh = replica.input.consume(); assert.equal(fresh.fire, true);
  authority.stepAuthority(new Map([[1, { ...idleCommand(3), fire: fresh.fire, fireHeld: fresh.fireHeld }]]));
  assert.equal(actor.ammo.bfg, ammo - 1);
});
