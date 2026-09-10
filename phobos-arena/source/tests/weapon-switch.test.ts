import test from "node:test";
import assert from "node:assert/strict";
import { WeaponSwitchAnimation, WEAPON_LOWER_SECONDS, WEAPON_RAISE_SECONDS, WEAPON_SWITCH_MAX_DELTA } from "../src/weapon-switch.ts";

function near(actual: number, expected: number) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ≈ ${expected}`);
}

test("weapon selection keeps the old mesh until fully lowered, then raises the new mesh", () => {
  const animation = new WeaponSwitchAnimation("machinegun");
  const pose = animation.update("rocket", 0);
  assert.equal(pose.visibleWeapon, "machinegun"); near(pose.amount, 0);
  animation.update("rocket", WEAPON_LOWER_SECONDS / 2);
  assert.equal(pose.visibleWeapon, "machinegun"); near(pose.amount, 0.5);
  animation.update("rocket", WEAPON_LOWER_SECONDS / 2);
  assert.equal(pose.visibleWeapon, "rocket"); near(pose.amount, 1);
  animation.update("rocket", WEAPON_RAISE_SECONDS / 2); near(pose.amount, 0.5);
  animation.update("rocket", WEAPON_RAISE_SECONDS / 2); near(pose.amount, 0);
  near(pose.offsetY, 0); near(pose.offsetZ, 0); near(pose.tiltX, 0);
});

for (const fps of [30, 60, 120]) test(`weapon change settles in 150 ms within one frame at ${fps} FPS`, () => {
  const animation = new WeaponSwitchAnimation("machinegun");
  animation.update("rail", 0);
  let elapsed = 0, oldFrames = 0, newFrames = 0;
  for (let i = 0; i < Math.ceil(0.15 * fps + 1e-8); i++) {
    const pose = animation.update("rail", 1 / fps);
    elapsed += 1 / fps;
    if (pose.visibleWeapon === "machinegun") oldFrames++;
    else newFrames++;
    assert.ok(pose.amount >= 0 && pose.amount <= 1);
    if (elapsed < 0.15 - 1e-8) assert.ok(pose.amount > 0);
  }
  assert.ok(oldFrames > 0 && newFrames > 0);
  assert.equal(animation.visibleWeapon, "rail"); near(animation.amount, 0);
  assert.ok(elapsed <= 0.15 + 1 / fps + 1e-8);
});

test("the result is reused and reselecting the same weapon never animates", () => {
  const animation = new WeaponSwitchAnimation("melee");
  const first = animation.update("melee", 1 / 60);
  for (let i = 0; i < 120; i++) {
    assert.equal(animation.update("melee", 1 / 60), first);
    near(first.amount, 0);
  }
});

test("a rapid selection while lowering skips the intermediate weapon without jumping pose", () => {
  const animation = new WeaponSwitchAnimation("machinegun");
  animation.update("rocket", 0.02);
  const amount = animation.amount;
  animation.update("rail", 0); near(animation.amount, amount);
  assert.equal(animation.visibleWeapon, "machinegun");
  animation.update("rail", 0.04);
  assert.equal(animation.visibleWeapon, "rail"); near(animation.amount, 1);
});

test("returning to the visible weapon while lowering reverses smoothly and performs no swap", () => {
  const animation = new WeaponSwitchAnimation("machinegun");
  animation.update("rocket", 0.03); near(animation.amount, 0.5);
  animation.update("machinegun", 0); near(animation.amount, 0.5);
  animation.update("machinegun", 0.02);
  assert.ok(animation.amount < 0.5 && animation.amount > 0);
  animation.update("machinegun", 0.03);
  near(animation.amount, 0); assert.equal(animation.visibleWeapon, "machinegun");
});

test("selection during raising lowers from the current pose before changing meshes", () => {
  const animation = new WeaponSwitchAnimation("machinegun");
  animation.update("rocket", 0.03); animation.update("rocket", 0.03);
  animation.update("rocket", 0.045); near(animation.amount, 0.5);
  animation.update("rail", 0); near(animation.amount, 0.5);
  assert.equal(animation.visibleWeapon, "rocket");
  animation.update("rail", 0.015); near(animation.amount, 0.75);
  assert.equal(animation.visibleWeapon, "rocket");
  animation.update("rail", 0.015); near(animation.amount, 1);
  assert.equal(animation.visibleWeapon, "rail");
});

test("rapid reversals preserve finite continuous pose and settle on the last selection", () => {
  const animation = new WeaponSwitchAnimation("machinegun");
  for (let i = 0; i < 60; i++) {
    const selected = i % 3 === 0 ? "machinegun" : i % 3 === 1 ? "rail" : "rocket";
    const before = animation.amount;
    animation.update(selected, 0); near(animation.amount, before);
    const pose = animation.update(selected, 1 / 120);
    assert.ok(Number.isFinite(pose.amount) && pose.amount >= 0 && pose.amount <= 1);
  }
  for (let i = 0; i < 24; i++) animation.update("plasma", 1 / 120);
  assert.equal(animation.visibleWeapon, "plasma"); near(animation.amount, 0);
});

test("spawn and reconnect reset discard pending animation and show their actual weapon immediately", () => {
  const animation = new WeaponSwitchAnimation("machinegun");
  const pose = animation.update("rocket", 0.03);
  assert.equal(animation.reset("plasma"), pose);
  assert.equal(pose.visibleWeapon, "plasma"); near(pose.amount, 0);
  animation.update("plasma", 0.02); near(pose.amount, 0);
});

test("invalid or stalled render deltas do not teleport the pose or skip a whole switch", () => {
  const animation = new WeaponSwitchAnimation("machinegun");
  for (const dt of [NaN, Infinity, -1]) {
    animation.update("rocket", dt); near(animation.amount, 0);
  }
  const comparison = new WeaponSwitchAnimation("machinegun");
  comparison.update("rocket", WEAPON_SWITCH_MAX_DELTA);
  animation.update("rocket", 10);
  near(animation.amount, comparison.amount);
  assert.equal(animation.visibleWeapon, "machinegun");
});
