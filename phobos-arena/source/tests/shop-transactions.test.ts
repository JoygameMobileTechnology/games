import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { ShopUI } from "../src/shop-ui.ts";
import { defaultCosmetics, type CosmeticsState } from "../src/cosmetics.ts";
import { getProfile, saveProfile } from "../src/profile.ts";
import { fixture } from "./helpers/game-fixture.ts";

function storage(t: TestContext) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const values = new Map<string, string>();
  const control = { fail: false, writes: 0 };
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (control.fail) throw new Error("Quota exceeded");
      values.set(key, value);
      control.writes++;
    },
  } });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, "localStorage", previous);
    else Reflect.deleteProperty(globalThis, "localStorage");
  });
  return control;
}

// Omit only the DOM/WebGL showroom. Run the real ShopUI transaction method,
// persistence boundary and Game.applyCosmetics rather than duplicating its rules.
function transactionUI(state: CosmeticsState, changed: () => boolean) {
  const feedback = { textContent: "" };
  const ui = Object.create(ShopUI.prototype) as {
    category: string; selected: string; state: CosmeticsState;
    disposed: boolean; changed: () => boolean; activate: () => void;
    element: () => typeof feedback; render: () => void;
  };
  Object.assign(ui, { state, changed, disposed: false, element: () => feedback, render: () => {} });
  return {
    feedback,
    select(id: string) {
      ui.category = id.split(":")[0];
      ui.selected = id;
      ui.activate();
    },
  };
}

test("sequential shop unlocks and equips keep the same profile state and survive reload", async (t) => {
  const stored = storage(t);
  const f = await fixture(2);
  t.after(() => f.dispose());
  const profile = f.game.profile;
  profile.cosmetics = { ...defaultCosmetics(), favor: 1000 };
  const state = profile.cosmetics;
  const ui = transactionUI(state, () => {
    const saved = saveProfile(profile);
    if (saved) f.game.applyCosmetics();
    return saved;
  });
  ui.select("character:vesper");
  assert.equal(profile.cosmetics, state, "game application preserves the shop's state reference");
  assert.equal(f.game.player.characterId, "vesper");
  assert.equal(state.favor, 750);
  ui.select("character-skin:bloodrite");
  ui.select("weapon-skin:ossified");
  assert.equal(state.favor, 475, "each distinct purchase charges exactly once");
  assert.equal(state.characterSkin, "bloodrite");
  assert.equal(state.weaponSkin, "ossified");
  ui.select("character:mordant");
  ui.select("character:vesper");
  assert.equal(state.favor, 475, "equipping an owned item does not charge again");
  assert.equal(stored.writes, 5);
  assert.deepEqual(getProfile().cosmetics, state, "reload restores balance, ownership and equipment together");
});

test("shop rejects insufficient Favor before saving or applying cosmetics", (t) => {
  const stored = storage(t);
  const state = { ...defaultCosmetics(), favor: 249 };
  const before = structuredClone(state);
  let applied = false;
  const ui = transactionUI(state, () => { applied = true; return true; });
  ui.select("character:vesper");
  assert.deepEqual(state, before);
  assert.equal(applied, false);
  assert.equal(stored.writes, 0);
  assert.match(ui.feedback.textContent, /Need 1 more Favor/);
});

test("a failed shop save rolls back both a new purchase and an owned-item equip", async (t) => {
  const stored = storage(t);
  const f = await fixture(2);
  t.after(() => f.dispose());
  const profile = f.game.profile;
  profile.cosmetics = { ...defaultCosmetics(), favor: 800 };
  const state = profile.cosmetics;
  const ui = transactionUI(state, () => {
    const saved = saveProfile(profile);
    if (saved) f.game.applyCosmetics();
    return saved;
  });
  ui.select("character:vesper");
  const before = structuredClone(state);
  const visibleModel = f.game.player.mesh;
  stored.fail = true;
  ui.select("character-skin:bloodrite");
  assert.deepEqual(state, before, "failed purchase restores Favor and ownership");
  ui.select("character:mordant");
  assert.deepEqual(state, before, "failed equip restores the previous selection");
  assert.equal(f.game.player.mesh, visibleModel, "failed persistence never replaces the applied model");
  assert.equal(profile.cosmetics, state);
  assert.equal(stored.writes, 1);
  assert.match(ui.feedback.textContent, /Nothing was spent or equipped/);
  assert.deepEqual(getProfile().cosmetics, before, "the last successful profile remains reloadable");
});
