import test from "node:test";
import assert from "node:assert/strict";
import {
  CONTROL_ACTIONS, PAD_ACTIONS, assignControlKey, assignPadButton, controlKeyLabel, defaultControls,
  keyConflict, normalizeControls, validControlKey,
} from "../src/controls-bindings.ts";

test("default bindings use only reachable numeric slots and preserve established controller buttons", () => {
  const bindings = defaultControls();
  assert.deepEqual(CONTROL_ACTIONS.flatMap((action) => bindings.keys[action]).filter((key) => key?.startsWith("Digit")), ["Digit1", "Digit2", "Digit3", "Digit4", "Digit5"]);
  assert.equal(bindings.buttons.fire, 7);
  assert.equal(bindings.buttons.jump, 0);
  assert.deepEqual(bindings.axes, { moveX: 0, moveY: 1, lookX: 2, lookY: 3 });
  assert.deepEqual(normalizeControls(undefined), bindings);
});

test("keyboard conflicts swap the displaced action without losing either binding", () => {
  const original = defaultControls();
  assert.deepEqual(keyConflict(original, "weapon3", 0, "KeyQ"), { action: "previousWeapon", slot: 0 });
  const next = assignControlKey(original, "weapon3", 0, "KeyQ");
  assert.equal(next.keys.weapon3[0], "KeyQ");
  assert.equal(next.keys.previousWeapon[0], "Digit3");
  assert.equal(original.keys.weapon3[0], "Digit3");
  assert.equal(controlKeyLabel(next.keys.weapon3[0]), "Q");
});

test("alternate bindings swap across slots and can be explicitly cleared", () => {
  const next = assignControlKey(defaultControls(), "forward", 1, "Space");
  assert.deepEqual(next.keys.forward, ["KeyW", "Space"]);
  assert.deepEqual(next.keys.jump, ["ArrowUp", null]);
  const cleared = assignControlKey(next, "forward", 1, null);
  assert.deepEqual(cleared.keys.forward, ["KeyW", null]);
  assert.deepEqual(normalizeControls(JSON.parse(JSON.stringify(cleared))), cleared);
});

test("controller conflicts swap instead of triggering two actions from the same button", () => {
  const next = assignPadButton(defaultControls(), "jump", 7);
  assert.equal(next.buttons.jump, 7);
  assert.equal(next.buttons.fire, 0);
  const directSlot = assignPadButton(next, "weapon5", 7);
  assert.equal(directSlot.buttons.weapon5, 7);
  assert.equal(directSlot.buttons.jump, null);
  assert.equal(PAD_ACTIONS.filter((action) => directSlot.buttons[action] === 7).length, 1);
});

test("binding normalization rejects distant numeric keys, malformed indices and duplicated input", () => {
  for (const code of ["Digit0", "Digit6", "Digit9", "Numpad1", "Minus", "Equal", "Escape", "F5", "MetaLeft", "", "Mouse8"])
    assert.equal(validControlKey(code), false, code);
  const invalid = defaultControls() as unknown as Record<string, unknown>;
  invalid.keys = { ...defaultControls().keys, weapon1: ["Digit0", null], jump: ["KeyW", "Mouse99"] };
  invalid.buttons = { jump: 31, fire: 31, nextWeapon: -4 };
  invalid.axes = { moveX: 1, moveY: 1, lookX: 8, lookY: "3" };
  invalid.deadzone = Infinity;
  const normalized = normalizeControls(invalid);
  assert.equal(normalized.keys.weapon1[0], "Digit1");
  assert.deepEqual(normalized.keys.jump, [null, null]);
  assert.equal(normalized.buttons.fire, null);
  assert.equal(normalized.buttons.nextWeapon, 5);
  assert.deepEqual(normalized.axes, defaultControls().axes);
  assert.equal(normalized.deadzone, 0.16);
});

test("valid controller axis assignments and a clamped dead zone survive profile round-trip", () => {
  const next = defaultControls();
  next.axes = { moveX: 2, moveY: 3, lookX: 0, lookY: 1 };
  next.invertLookY = true; next.deadzone = 2;
  const saved = normalizeControls(JSON.parse(JSON.stringify(next)));
  assert.deepEqual(saved.axes, next.axes);
  assert.equal(saved.invertLookY, true);
  assert.equal(saved.deadzone, 0.4);
  assert.equal(normalizeControls({ deadzone: -1 }).deadzone, 0.05);
});
