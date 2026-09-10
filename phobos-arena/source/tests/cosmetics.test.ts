import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { COSMETIC_ITEMS, CHARACTERS, CHARACTER_SKINS, WEAPON_SKINS, defaultCosmetics, normalizeCosmetics, purchaseCosmetic, equipCosmetic, rewardMatch } from "../src/cosmetics.ts";
import { getProfile, saveProfile } from "../src/profile.ts";
import { makeWeaponModel } from "../src/weapon-models.ts";
import { WEAPON_ORDER } from "../src/rules.ts";
import { getWeaponSlots } from "../src/weapon-slots.ts";
import { fixture } from "./helpers/game-fixture.ts";

test("Favor rewards completion and victory once per match, including separate tournament rounds", () => {
  const state = defaultCosmetics();
  assert.equal(rewardMatch(state, "round-1", false), 25);
  assert.equal(rewardMatch(state, "round-1", true), 0, "a repeated or altered result cannot reward twice");
  assert.equal(rewardMatch(state, "round-2", true), 100);
  assert.equal(rewardMatch(state, "round-3", false), 25);
  assert.equal(state.favor, 150);
  assert.equal(rewardMatch(state, "", true), 0);
  assert.equal(defaultCosmetics().favor, 0, "uncompleted matches receive nothing");
});

test("Favor unlocks are atomic, permanent and cosmetic, and duplicate buys cannot spend twice", () => {
  const state = defaultCosmetics(), original = structuredClone(state);
  assert.equal(purchaseCosmetic(state, "character:seraph").ok, false);
  assert.deepEqual(state, original, "an unaffordable purchase changes nothing");
  assert.equal(equipCosmetic(state, "character:seraph"), false);
  assert.equal(purchaseCosmetic(state, "missing").ok, false);
  for (let i = 0; i < 5; i++) rewardMatch(state, `win-${i}`, true);
  assert.equal(purchaseCosmetic(state, "character:seraph").ok, true);
  assert.equal(state.favor, 0);
  assert.equal(equipCosmetic(state, "character:seraph"), true);
  assert.equal(purchaseCosmetic(state, "character:seraph").ok, false);
  assert.equal(state.character, "seraph");
  assert.equal(state.owned.filter(id => id === "character:seraph").length, 1);
  assert.equal(equipCosmetic(state, "character:mordant"), true, "starter remains owned");
  assert.ok(COSMETIC_ITEMS.every(item => Number.isInteger(item.price) && item.price >= 0));
  assert.equal(new Set(COSMETIC_ITEMS.map(item => item.id)).size, COSMETIC_ITEMS.length);
});

test("legacy and malformed local profiles receive safe starter cosmetics without erasing valid ownership", () => {
  assert.deepEqual(normalizeCosmetics(undefined), defaultCosmetics());
  const malformed = normalizeCosmetics({favor: NaN, owned: [null, "hacked", "character:vesper", "character:vesper"], character: "seraph", weaponSkin: "hacked"});
  assert.equal(malformed.favor, 0);
  assert.equal(malformed.character, "mordant", "a locked selection cannot become equipped");
  assert.equal(malformed.owned.filter(id => id === "character:vesper").length, 1);
  const state = defaultCosmetics();
  state.favor = 1000;
  purchaseCosmetic(state, "character:vesper");
  equipCosmetic(state, "character:vesper");
  purchaseCosmetic(state, "weapon-skin:ossified");
  equipCosmetic(state, "weapon-skin:ossified");
  assert.deepEqual(normalizeCosmetics(JSON.parse(JSON.stringify(state))), state);
});

test("wallet, ownership and equipped appearance survive profile save/reload", (t) => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  let data = JSON.stringify({name: "Existing operator", settings: {volume: 0.2, flick: true}, stats: {kills: 42}});
  Object.defineProperty(globalThis, "localStorage", {configurable: true, value: {getItem: () => data, setItem: (_key: string, value: string) => {data = value;}}});
  t.after(() => { if (previous) Object.defineProperty(globalThis, "localStorage", previous); else Reflect.deleteProperty(globalThis, "localStorage"); });
  const profile = getProfile();
  assert.equal(profile.stats.kills, 42);
  assert.equal(profile.settings.volume, 0.2);
  assert.equal("flick" in profile.settings, false, "retired Flick setting is dropped without resetting the profile");
  const state = profile.cosmetics!;
  rewardMatch(state, "a", true); rewardMatch(state, "b", false);
  assert.ok(purchaseCosmetic(state, "weapon-skin:ossified").ok);
  equipCosmetic(state, "weapon-skin:ossified");
  assert.equal(saveProfile(profile), true);
  assert.deepEqual(getProfile().cosmetics, state);
  Object.defineProperty(globalThis, "localStorage", {configurable: true, value: {setItem: () => {throw new Error("quota");}}});
  assert.equal(saveProfile(profile), false, "shop can roll back a failed save");
});

test("all weapon finishes preserve every weapon silhouette and identifying energy color", () => {
  for (const weapon of WEAPON_ORDER) {
    let bounds: number[] | null = null;
    let energy: number | undefined;
    for (const skin of WEAPON_SKINS) {
      const model = makeWeaponModel(weapon, skin.id);
      const box = new THREE.Box3().setFromObject(model);
      const current = [...box.min.toArray(), ...box.max.toArray()];
      if (bounds) assert.deepEqual(current, bounds);
      bounds = current;
      const materials = new Set<THREE.Material>();
      model.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        const material = object.material as THREE.MeshStandardMaterial;
        materials.add(material);
        if (material.name === "weapon-energy") {
          if (energy !== undefined) assert.equal(material.color.getHex(), energy);
          energy = material.color.getHex();
        }
        object.geometry.dispose();
      });
      materials.forEach(material => material.dispose());
      if (weapon !== "melee") assert.ok(model.children.length <= 4);
    }
  }
});

test("equipping each character preserves the real player's collision, motion, damage and inventory", async (t) => {
  const f = await fixture(8, "bastion", "tdm");
  t.after(() => f.dispose());
  const {game} = f, player = game.player;
  game.profile.cosmetics = defaultCosmetics();
  game.profile.cosmetics.owned = COSMETIC_ITEMS.map(item => item.id);
  const state = game.profile.cosmetics;
  const before = {motion: {...player.motion}, health: player.health, armor: player.armor, collider: player.collider.handle, radius: player.collider.radius(), halfHeight: player.collider.halfHeight(), ammo: {...player.ammo}, owned: [...player.owned]};
  for (const character of CHARACTERS) {
    equipCosmetic(state, `character:${character.id}`);
    equipCosmetic(state, `character-skin:${CHARACTER_SKINS[2].id}`);
    game.applyCosmetics();
    assert.equal(game.profile.cosmetics, state, "shop keeps its live state reference after repeated equips");
    assert.equal(player.characterId, character.id);
    assert.deepEqual({motion: {...player.motion}, health: player.health, armor: player.armor, collider: player.collider.handle, radius: player.collider.radius(), halfHeight: player.collider.halfHeight(), ammo: {...player.ammo}, owned: [...player.owned]}, before);
    assert.ok(player.mesh.getObjectByName("juggernaut-glow"));
    player.mesh.traverse(object => {
      const material = (object as THREE.Mesh).material as THREE.MeshStandardMaterial;
      if (material?.name === "body-armor") assert.equal(material.color.getHexString(), game.config.teamColors[player.team!].slice(1));
    });
  }
  assert.equal(new Set(game.actors.map(actor => actor.characterId)).size, 7, "the roster displays all seven appearances");
  const id = game.matchId;
  game.start(game.config);
  assert.notEqual(game.matchId, id, "rematches and tournament rounds have distinct reward identities");
  assert.equal(game.player.characterId, "seraph", "equipped appearance carries into the next match");
});

test("equipping after changing maps cannot resurrect an orphan player model", async (t) => {
  const f = await fixture(2);
  t.after(() => f.dispose());
  const { game } = f;
  const characters = () => game.scene.children.filter((object) => object.name.startsWith("character-"));
  game.pause();
  game.selectMap("rift");
  assert.equal(game.actors.length, 0);
  game.profile.cosmetics = defaultCosmetics();
  game.applyCosmetics();
  assert.equal(characters().length, 0, "a stale player reference cannot add a scene model");
  game.start(game.config);
  assert.equal(characters().length, game.actors.length);
  assert.ok(characters().every((mesh) => game.actors.some((actor) => actor.mesh === mesh)));
});

test("bot weapon rendering reuses the arena's shared models without consuming gameplay randomness", async (t) => {
  const f = await fixture(4);
  t.after(() => f.dispose());
  const { game } = f;
  const slots = getWeaponSlots(game.map.pickups);
  const first = game.actors[1].mesh.getObjectByName("held-weapons")!;
  const second = game.actors[2].mesh.getObjectByName("held-weapons")!;
  assert.equal(first.children.length, slots.length);
  assert.ok(first.children.length <= 5);
  const originalModels = [...first.children];
  for (const id of slots) {
    const a = first.children.find((model) => model.userData.weapon === id)!;
    const b = second.children.find((model) => model.userData.weapon === id)!;
    assert.notEqual(a, b, "bots own independent pose/visibility groups");
    const aMeshes: THREE.Mesh[] = [], bMeshes: THREE.Mesh[] = [];
    a.traverse((object) => { if (object instanceof THREE.Mesh) aMeshes.push(object); });
    b.traverse((object) => { if (object instanceof THREE.Mesh) bMeshes.push(object); });
    assert.ok(aMeshes.length > 0);
    aMeshes.forEach((mesh, i) => {
      assert.equal(mesh.geometry, bMeshes[i].geometry);
      assert.equal(mesh.material, bMeshes[i].material);
    });
  }
  // Exercise the real draw method with only the browser renderer replaced.
  Object.assign(game, {
    camera: new THREE.PerspectiveCamera(),
    renderer: {
      domElement: { height: 720 },
      info: { reset() {}, render: { calls: 0, triangles: 0 } },
      render() {},
    },
    started: false,
  });
  t.mock.method(Math, "random", () => { throw new Error("draw must not advance gameplay RNG"); });
  for (const id of [...slots, ...slots].reverse()) {
    game.actors[1].weapon = id;
    (game as any).draw(1 / 60, 1, 0);
    assert.deepEqual(first.children, originalModels);
    assert.deepEqual(first.children.filter((model) => model.visible).map((model) => model.userData.weapon), [id]);
  }
});

test("shared held weapon resources are disposed exactly once on restart and map change", async (t) => {
  const f = await fixture(4);
  t.after(() => f.dispose());
  const { game } = f;
  for (const transition of [
    () => game.start(game.config),
    () => { game.pause(); game.selectMap("rift"); },
  ]) {
    const resources = new Set<THREE.BufferGeometry | THREE.Material>();
    for (const actor of game.actors.slice(1)) {
      actor.mesh.getObjectByName("held-weapons")!.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        resources.add(object.geometry);
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) resources.add(material);
      });
    }
    const disposals = new Map([...resources].map((resource) => [resource, 0]));
    for (const resource of resources)
      resource.addEventListener("dispose", () => disposals.set(resource, disposals.get(resource)! + 1));
    transition();
    assert.ok(resources.size > 0);
    assert.ok([...disposals.values()].every((count) => count === 1));
  }
  assert.equal(game.actors.length, 0);
  game.start(game.config);
  assert.equal(game.scene.children.filter((object) => object.name.startsWith("character-")).length, game.actors.length);
});
