import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { Input } from "../src/input.ts";
import { getWeaponSlots } from "../src/weapon-slots.ts";
import type { Settings } from "../src/profile.ts";
import { WEAPON_ORDER, type WeaponId } from "../src/rules.ts";
import { assignControlKey, assignPadButton, defaultControls } from "../src/controls-bindings.ts";

// Minimal browser event surfaces: events reach the real Input listeners. No DOM library,
// browser, private-field access, or replacement of Input's handler implementations.
class Surface extends EventTarget {
  constructor(readonly parent?: Surface) {
    super();
  }
  override dispatchEvent(event: Event): boolean {
    const accepted = super.dispatchEvent(event);
    if (event.bubbles && !event.cancelBubble) this.parent?.dispatchEvent(event);
    return accepted;
  }
}

function harness(t: TestContext, overrides: Partial<Settings> = {}) {
  let nextFrame = 0;
  const frames = new Map<number, FrameRequestCallback>();
  const requestFrame = (callback: FrameRequestCallback) => {
    frames.set(++nextFrame, callback);
    return nextFrame;
  };
  const cancelFrame = (id: number) => frames.delete(id);
  const windowSurface = Object.assign(new Surface(), {
    requestAnimationFrame: requestFrame,
    cancelAnimationFrame: cancelFrame,
  });
  const documentSurface = Object.assign(new Surface(windowSurface), {
    pointerLockElement: null,
    getElementById: () => null,
  });
  const captures: number[] = [];
  const capturedBy = new Map<number, Surface>();
  const rejectedCaptures = new Set<number>();
  const captureMethods = (surface: Surface) => ({
    setPointerCapture(id: number) {
      if (rejectedCaptures.has(id)) throw new DOMException("Pointer is no longer active", "NotFoundError");
      captures.push(id);
      capturedBy.set(id, surface);
    },
    hasPointerCapture: (id: number) => capturedBy.get(id) === surface,
    releasePointerCapture(id: number) {
      if (capturedBy.get(id) === surface) capturedBy.delete(id);
    },
  });
  const canvas = Object.assign(new Surface(documentSurface), {
    requestPointerLock: () => Promise.resolve(),
  });
  Object.assign(canvas, captureMethods(canvas));
  const ui = new Surface(documentSurface);
  let now = 1000;
  const replacements: Record<string, unknown> = {
    window: windowSurface,
    document: documentSurface,
    innerWidth: 1000,
    innerHeight: 500,
    performance: { now: () => now },
    requestAnimationFrame: requestFrame,
    cancelAnimationFrame: cancelFrame,
    matchMedia: () => ({ matches: false }),
    navigator: { getGamepads: () => [] },
  };
  const previous = new Map(
    Object.keys(replacements).map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ]),
  );
  for (const [key, value] of Object.entries(replacements)) {
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value,
    });
  }
  t.after(() => {
    frames.clear();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  });
  const settings: Settings = {
    sensitivity: 1,
    fov: 95,
    railAuto: true,
    shotgunAuto: true,
    volume: 0.45,
    resolution: 1,
    crosshair: "cross",
    crosshairColor: "#f7efe4",
    ...overrides,
  };
  const input = new Input(canvas as unknown as HTMLCanvasElement, settings);
  input.enabled = true;
  const pointer = (
    type: string,
    id: number,
    x: number,
    y: number,
    target: Surface = canvas,
    isPrimary = id === 1,
    pointerType = "touch",
  ) => {
    const event = Object.assign(
      new Event(type, { bubbles: true, cancelable: true }),
      {
        pointerId: id,
        clientX: x,
        clientY: y,
        pointerType,
        isPrimary,
        button: 0,
      },
    );
    if (type === "pointercancel" || type === "lostpointercapture") capturedBy.delete(id);
    target.dispatchEvent(event);
    if (type === "pointerup") capturedBy.delete(id);
    return event;
  };
  const touch = (
    type: "touchstart" | "touchmove" | "touchend" | "touchcancel",
    contacts: { identifier: number; clientX?: number; clientY?: number; target?: Surface }[] = [],
    target: Surface = canvas,
  ) => {
    const touches = contacts.map((contact) => ({ clientX: 0, clientY: 0, target: canvas, ...contact }));
    const event = Object.assign(new Event(type, { bubbles: true, cancelable: true }), {
      touches, targetTouches: touches.filter((contact) => contact.target === target), changedTouches: [],
    });
    target.dispatchEvent(event);
    return event;
  };
  const key = (type: "keydown" | "keyup", code: string, repeat = false) => {
    const event = Object.assign(new Event(type, { cancelable: true }), {
      code,
      repeat,
    });
    windowSurface.dispatchEvent(event);
    return event;
  };
  const tap = (id: number, x: number, y: number, target: Surface = canvas) => {
    pointer("pointerdown", id, x, y, target);
    now += 30;
    pointer("pointerup", id, x, y, target);
  };
  const mouse = (type: string, target: Surface = canvas, button = 0, x = 700, y = 300) => {
    target.dispatchEvent(Object.assign(new Event(type, { bubbles: true }), {
      pointerId: 99,
      pointerType: "mouse",
      button,
      clientX: x,
      clientY: y,
    }));
  };
  return {
    input,
    canvas,
    ui,
    settings,
    captures,
    capturedBy,
    rejectedCaptures,
    frames,
    pointer,
    touch,
    tap,
    key,
    mouse,
    windowSurface,
    documentSurface,
    flushFrames: () => {
      const callbacks = [...frames.values()];
      frames.clear();
      callbacks.forEach((callback) => callback(now));
    },
    weaponButton: (weapon: WeaponId, left = 800) => {
      const button = Object.assign(new Surface(ui), {
        disabled: false,
        hidden: false,
        style: { touchAction: "manipulation" },
        getBoundingClientRect: () => ({ left, right: left + 60, top: 20, bottom: 80 }),
      });
      Object.assign(button, captureMethods(button));
      const dispose = input.bindWeaponButton(button as unknown as HTMLButtonElement, weapon);
      t.after(dispose);
      return { button, dispose };
    },
    lock: (locked = true) => {
      Object.assign(documentSurface, { pointerLockElement: locked ? canvas : null });
      documentSurface.dispatchEvent(new Event("pointerlockchange"));
    },
    advance: (ms: number) => {
      now += ms;
    },
  };
}

function near(actual: number, expected: number) {
  assert.ok(
    Math.abs(actual - expected) < 1e-8,
    `${actual} should equal ${expected}`,
  );
}

test("gamepad cycles collected weapons and consumes button edges once", (t) => {
  const { input } = harness(t);
  const buttons = Array.from({ length: 10 }, () => ({ pressed: false }));
  Object.assign(navigator, {
    getGamepads: () => [{ connected: true, axes: [0, 0, 0, 0], buttons }],
  });
  const owned = new Set<WeaponId>(["melee", "machinegun"]);
  buttons[5].pressed = true;
  input.pollPad(1 / 60, "machinegun", owned);
  assert.equal(input.consume().switchTo, "melee");
  input.pollPad(1 / 60, "melee", owned);
  assert.equal(input.consume().switchTo, null);
  buttons[5].pressed = false;
  input.pollPad(1 / 60, "melee", owned);
  buttons[4].pressed = true;
  input.pollPad(1 / 60, "melee", owned);
  assert.equal(input.consume().switchTo, "machinegun");
  buttons[7].pressed = true;
  input.pollPad(1 / 60, "machinegun", owned);
  assert.equal(input.consume().fire, true);
  input.pollPad(1 / 60, "machinegun", owned);
  assert.equal(input.consume().fire, false);
});

test("left movement and right firing remain independent while both thumbs touch", (t) => {
  const { input, pointer, tap } = harness(t);
  pointer("pointerdown", 1, 100, 300);
  pointer("pointermove", 1, 110, 280);
  tap(2, 700, 300);
  let command = input.consume();
  near(Math.hypot(command.x, command.z), 1);
  assert.equal(command.fire, true);
  assert.equal(command.jump, false);
  pointer("pointerdown", 3, 710, 300);
  pointer("pointermove", 3, 750, 310);
  command = input.consume();
  near(Math.hypot(command.x, command.z), 1);
  assert.equal(
    command.fire,
    false,
    "ordinary aim dragging does not fire projectiles",
  );
  assert.notEqual(input.yaw, 0);
  pointer("pointerup", 3, 750, 310);
  pointer("pointerup", 1, 110, 280);
  command = input.consume();
  near(Math.hypot(command.x, command.z), 0);
  assert.equal(
    command.jump,
    false,
    "releasing movement drag is not a jump tap",
  );
});

test("right taps fire once without rotating aim even at different screen locations", (t) => {
  const { input, tap } = harness(t);
  tap(1, 700, 300);
  near(input.yaw, 0);
  near(input.pitch, 0);
  assert.equal(input.consume().fire, true);
  tap(2, 720, 290);
  const command = input.consume();
  assert.equal(command.fire, true);
  near(input.yaw, 0);
  near(input.pitch, 0);
  near(command.forwardX, 0);
  assert.equal(
    input.consume().fire,
    false,
    "the same tap is consumed only once",
  );
});

test("a new right gesture starts at its own location without an aim jump", (t) => {
  const { input, pointer, tap } = harness(t);
  pointer("pointerdown", 1, 650, 280);
  pointer("pointermove", 1, 730, 320);
  pointer("pointerup", 1, 730, 320);
  assert.equal(input.consume().fire, false);
  const beforeYaw = input.yaw,
    beforePitch = input.pitch;
  tap(2, 740, 315);
  near(input.yaw, beforeYaw);
  near(input.pitch, beforePitch);
  assert.equal(input.consume().fire, true);
  pointer("pointerdown", 3, 900, 200);
  near(input.yaw, beforeYaw);
  near(input.pitch, beforePitch);
  pointer("pointermove", 3, 910, 205);
  near(input.yaw - beforeYaw, -0.01 * Math.PI);
  near(input.pitch - beforePitch, -0.01 * Math.PI);
});

test("manual taps preserve aim and right dragging remains unrestricted", (t) => {
  const { input, tap, pointer } = harness(t);
  tap(1, 700, 300);
  input.consume();
  tap(2, 760, 250);
  near(input.yaw, 0);
  near(input.pitch, 0);
  assert.equal(input.consume().fire, true);
  pointer("pointerdown", 3, 700, 300);
  pointer("pointermove", 3, 750, 300);
  near(input.yaw, -0.05 * Math.PI);
});

test("holding the projectile region does not repeatedly produce shots", (t) => {
  const { input, pointer, advance } = harness(t);
  pointer("pointerdown", 1, 700, 300);
  for (let tick = 0; tick < 120; tick++) {
    advance(1000 / 120);
    assert.equal(input.consume().fire, false);
  }
  pointer("pointerup", 1, 700, 300);
  assert.equal(
    input.consume().fire,
    false,
    "a long hold is not recognized as a tap",
  );
});

test("plasma mouse hold persists between consumes and releases outside the canvas", (t) => {
  const { input, mouse, lock, ui } = harness(t);
  input.setActiveWeapon("plasma");
  mouse("pointerdown");
  assert.equal(input.consume().fireHeld, false, "the lock-acquisition click cannot shoot");
  lock();
  mouse("pointerdown");
  assert.equal(input.consume().fire, true);
  for (let tick = 0; tick < 30; tick++) {
    const command = input.consume();
    assert.equal(command.fireHeld, true);
    assert.equal(command.fire, false, "holding does not manufacture repeated tap events");
  }
  mouse("pointerup", ui);
  assert.equal(input.consume().fireHeld, false);
  mouse("pointerdown", undefined, 2);
  assert.equal(input.consume().fireHeld, false, "right click cannot start firing");
});

test("plasma double-tap hold fires without an aim jump, aims while held, and stops on lift", (t) => {
  const { input, pointer, tap, advance } = harness(t);
  input.setActiveWeapon("plasma");
  tap(1, 700, 300);
  let command = input.consume();
  assert.equal(command.fire, true);
  assert.equal(command.fireHeld, false);
  advance(100);
  pointer("pointerdown", 2, 720, 290);
  command = input.consume();
  assert.equal(command.fire, true);
  assert.equal(command.fireHeld, true);
  near(input.yaw, 0);
  near(input.pitch, 0);
  pointer("pointermove", 2, 760, 310);
  near(input.yaw, -0.04 * Math.PI);
  near(input.pitch, -0.04 * Math.PI);
  advance(500);
  command = input.consume();
  assert.equal(command.fireHeld, true);
  assert.equal(command.fire, false);
  const yaw = input.yaw, pitch = input.pitch;
  pointer("pointerup", 2, 760, 310);
  command = input.consume();
  assert.equal(command.fireHeld, false);
  assert.equal(command.fire, false, "the release does not duplicate the activation shot");
  near(input.yaw, yaw);
  near(input.pitch, pitch);
  tap(3, 770, 305);
  near(input.yaw, yaw);
  near(input.pitch, pitch);
  assert.equal(input.consume().fireHeld, false, "a completed hold does not prime another hold");
});

test("a quick plasma second tap emits no extra release shot or rotation", (t) => {
  const { input, tap, pointer } = harness(t);
  input.setActiveWeapon("plasma");
  tap(1, 700, 300);
  input.consume();
  pointer("pointerdown", 2, 720, 300);
  assert.equal(input.consume().fire, true);
  const yaw = input.yaw;
  pointer("pointerup", 2, 720, 300);
  const command = input.consume();
  assert.equal(command.fire, false);
  assert.equal(command.fireHeld, false);
  near(input.yaw, yaw);
});

test("plasma hold requires a recent nearby tap rather than a single hold or aim drag", (t) => {
  const { input, tap, pointer, advance } = harness(t);
  input.setActiveWeapon("plasma");
  pointer("pointerdown", 1, 700, 300);
  advance(400);
  assert.equal(input.consume().fireHeld, false);
  pointer("pointerup", 1, 700, 300);
  assert.equal(input.consume().fire, false);
  tap(2, 700, 300);
  input.consume();
  advance(301);
  pointer("pointerdown", 3, 700, 300);
  assert.equal(input.consume().fireHeld, false, "expired taps cannot start a hold");
  pointer("pointercancel", 3, 700, 300);
  tap(4, 700, 300);
  input.consume();
  pointer("pointerdown", 5, 749, 300);
  assert.equal(input.consume().fireHeld, false, "the second touch must be within 48 CSS pixels");
  pointer("pointermove", 5, 770, 300);
  pointer("pointerup", 5, 770, 300);
  pointer("pointerdown", 6, 770, 300);
  assert.equal(input.consume().fireHeld, false, "a drag cannot prime a double-tap");
});

for (const event of ["pointercancel", "lostpointercapture"])
  test(`${event} stops plasma touch hold and discards an unconsumed activation shot`, (t) => {
    const { input, tap, pointer } = harness(t);
    input.setActiveWeapon("plasma");
    tap(1, 700, 300);
    input.consume();
    pointer("pointerdown", 2, 720, 300);
    pointer(event, 2, 720, 300);
    let command = input.consume();
    assert.equal(command.fireHeld, false);
    assert.equal(command.fire, false);
    pointer("pointerdown", 3, 720, 300);
    command = input.consume();
    assert.equal(command.fireHeld, false, "cancelled gestures cannot prime a new hold");
  });

test("plasma hold and priming clear on weapon switches, pause and death", (t) => {
  const { input, tap, pointer, mouse, lock } = harness(t);
  for (const cancel of [
    () => { input.setActiveWeapon("rocket"); input.setActiveWeapon("plasma"); },
    () => { input.enabled = false; input.enabled = true; },
    () => { input.dead = true; input.dead = false; },
    () => input.clear(),
  ]) {
    input.clear();
    input.setActiveWeapon("plasma");
    tap(1, 700, 300);
    input.consume();
    cancel();
    pointer("pointerdown", 2, 710, 300);
    assert.equal(input.consume().fireHeld, false, "primed taps cannot cross a state transition");
    pointer("pointerup", 2, 710, 300);
    input.consume();
    pointer("pointerdown", 3, 720, 300);
    assert.equal(input.consume().fireHeld, true);
    input.setActiveWeapon("plasma");
    assert.equal(input.consume().fireHeld, true, "reaffirming the same weapon keeps an active gesture");
    cancel();
    assert.equal(input.consume().fireHeld, false);
    pointer("pointerup", 3, 720, 300);
    assert.equal(input.consume().fire, false, "the old finger cannot tap-fire after cancellation");
    lock();
    mouse("pointerdown");
    assert.equal(input.consume().fireHeld, true);
    cancel();
    assert.equal(input.consume().fireHeld, false, "old mouse holds cannot resume after a transition");
    mouse("pointerup");
  }
});

test("blur and pointer lock loss stop plasma mouse hold and require a new press", (t) => {
  const { input, mouse, lock, windowSurface } = harness(t);
  input.setActiveWeapon("plasma");
  for (const cancel of [
    () => windowSurface.dispatchEvent(new Event("blur")),
    () => lock(false),
  ]) {
    lock();
    mouse("pointerdown");
    assert.equal(input.consume().fireHeld, true);
    cancel();
    const command = input.consume();
    assert.equal(command.fireHeld, false);
    assert.equal(command.fire, false);
    lock();
    assert.equal(input.consume().fireHeld, false);
    mouse("pointerup");
  }
});

test("other weapons retain fresh projectile taps and cannot prime a later plasma hold", (t) => {
  const { input, tap, pointer, mouse, lock } = harness(t);
  for (const weapon of WEAPON_ORDER.filter((id) => id !== "plasma")) {
    input.setActiveWeapon(weapon);
    tap(1, 700, 300);
    assert.equal(input.consume().fire, true);
    pointer("pointerdown", 2, 710, 300);
    const command = input.consume();
    assert.equal(command.fire, false);
    assert.equal(command.fireHeld, false);
    pointer("pointerup", 2, 710, 300);
    assert.equal(input.consume().fire, true);
    lock();
    mouse("pointerdown");
    assert.equal(input.consume().fire, true);
    assert.equal(input.consume().fireHeld, false);
    mouse("pointerup");
  }
  input.setActiveWeapon("plasma");
  pointer("pointerdown", 3, 720, 300);
  assert.equal(input.consume().fireHeld, false);
});

test("plasma sustained touch fire keeps the other thumb free for movement and jumps", (t) => {
  const { input, tap, pointer } = harness(t);
  input.setActiveWeapon("plasma");
  tap(1, 700, 300);
  input.consume();
  pointer("pointerdown", 2, 720, 300);
  pointer("pointerdown", 3, 100, 300);
  pointer("pointermove", 3, 100, 280);
  let command = input.consume();
  assert.equal(command.fireHeld, true);
  near(Math.hypot(command.x, command.z), 1);
  near(input.yaw, 0);
  pointer("pointercancel", 3, 100, 280);
  tap(4, 100, 300);
  command = input.consume();
  assert.equal(command.fireHeld, true);
  assert.equal(command.jump, true);
});

test("UI taps cannot fire, move, jump, or rotate the camera", (t) => {
  const { input, ui, tap } = harness(t);
  tap(1, 700, 300);
  input.consume();
  tap(2, 950, 100, ui);
  tap(3, 100, 100, ui);
  const uiCommand = input.consume();
  assert.equal(uiCommand.fire, false);
  assert.equal(uiCommand.jump, false);
  near(Math.hypot(uiCommand.x, uiCommand.z), 0);
  near(input.yaw, 0);
  tap(4, 720, 300);
  near(input.yaw, 0);
  assert.equal(input.consume().fire, true);
});

test("the second thumb switches weapons with raw pointer events while the movement thumb stays held", (t) => {
  const { input, pointer, captures, weaponButton } = harness(t);
  const { button } = weaponButton("rocket");
  pointer("pointerdown", 1, 100, 300);
  pointer("pointermove", 1, 100, 260);
  const down = pointer("pointerdown", 2, 825, 45, button);
  assert.equal(down.defaultPrevented, true);
  assert.equal(input.consume().switchTo, null, "selection waits for a completed tap");
  pointer("pointerup", 2, 825, 45, button);
  const command = input.consume();
  assert.equal(command.switchTo, "rocket", "a non-primary touch works without any click event");
  assert.equal(command.fire, false);
  assert.equal(command.fireHeld, false);
  assert.equal(command.jump, false);
  near(Math.hypot(command.x, command.z), 1);
  input.setActiveWeapon("rocket");
  near(Math.hypot(input.consume().x, input.consume().z), 1);
  assert.deepEqual(captures, [1, 2], "the HUD captures only its own pointer");
  assert.equal(button.style.touchAction, "none");
  pointer("pointerup", 1, 100, 260);
  near(Math.hypot(input.consume().x, input.consume().z), 0);
});

test("weapon buttons track each pointer and leave a concurrent aim drag intact", (t) => {
  const { input, pointer, weaponButton } = harness(t);
  const first = weaponButton("rocket", 800).button;
  const second = weaponButton("rail", 870).button;
  pointer("pointerdown", 1, 100, 300);
  pointer("pointermove", 1, 80, 280);
  pointer("pointerdown", 2, 650, 250);
  pointer("pointermove", 2, 675, 255);
  const yaw = input.yaw;
  pointer("pointerdown", 3, 825, 45, first);
  pointer("pointerdown", 4, 890, 45, second);
  pointer("pointercancel", 3, 825, 45, first);
  pointer("pointerup", 4, 890, 45, second);
  const command = input.consume();
  assert.equal(command.switchTo, "rail");
  near(Math.hypot(command.x, command.z), 1);
  assert.equal(command.fire, false);
  near(input.yaw, yaw);
  pointer("pointermove", 2, 685, 255);
  near(input.yaw - yaw, -0.01 * Math.PI);
});

test("cancelled, lost-capture, dragged, hidden and disabled weapon touches never select", (t) => {
  const { input, pointer, weaponButton } = harness(t);
  const { button } = weaponButton("rocket");
  for (const event of ["pointercancel", "lostpointercapture"]) {
    pointer("pointerdown", 2, 825, 45, button);
    pointer(event, 2, 825, 45, button);
    pointer("pointerup", 2, 825, 45, button);
    assert.equal(input.consume().switchTo, null);
  }
  pointer("pointerup", 3, 825, 45, button);
  assert.equal(input.consume().switchTo, null, "release without a HUD press is ignored");
  pointer("pointerdown", 3, 825, 45, button);
  pointer("pointerup", 3, 870, 45, button);
  assert.equal(input.consume().switchTo, null, "release outside the button cancels");
  pointer("pointerdown", 4, 810, 45, button);
  pointer("pointermove", 4, 850, 45, button);
  pointer("pointerup", 4, 810, 45, button);
  assert.equal(input.consume().switchTo, null, "swiping across a button is not a tap");
  for (const field of ["disabled", "hidden"] as const) {
    button[field] = true;
    pointer("pointerdown", 5, 825, 45, button);
    pointer("pointerup", 5, 825, 45, button);
    assert.equal(input.consume().switchTo, null);
    button[field] = false;
  }
  pointer("pointerdown", 6, 825, 45, button);
  button.disabled = true;
  pointer("pointerup", 6, 825, 45, button);
  assert.equal(input.consume().switchTo, null, "availability is checked again on release");
});

test("pause, death, clear and blur discard weapon gestures rather than selecting after resume", (t) => {
  const { input, pointer, weaponButton, windowSurface } = harness(t);
  const { button } = weaponButton("rocket");
  for (const cancel of [
    () => { input.enabled = false; input.enabled = true; },
    () => { input.dead = true; input.dead = false; },
    () => input.clear(),
    () => windowSurface.dispatchEvent(new Event("blur")),
  ]) {
    pointer("pointerdown", 2, 825, 45, button);
    cancel();
    pointer("pointerup", 2, 825, 45, button);
    let command = input.consume();
    assert.equal(command.switchTo, null);
    assert.equal(command.fire, false);
    pointer("pointerdown", 3, 825, 45, button);
    pointer("pointerup", 3, 825, 45, button);
    cancel();
    command = input.consume();
    assert.equal(command.switchTo, null, "a queued selection is also cleared");
  }
  for (const blocked of ["enabled", "dead"] as const) {
    input[blocked] = blocked === "dead";
    pointer("pointerdown", 4, 825, 45, button);
    pointer("pointerup", 4, 825, 45, button);
    assert.equal(input.consume().switchTo, null);
    input[blocked] = blocked === "enabled";
  }
});

test("weapon HUD suppresses pointer click duplicates and keeps mouse, keyboard and assistive activation", (t) => {
  const { input, pointer, mouse, weaponButton } = harness(t);
  const { button } = weaponButton("rail");
  const click = (detail: number, pointerType?: string) => button.dispatchEvent(
    Object.assign(new Event("click", { bubbles: true, cancelable: true }), { detail, pointerType }),
  );
  pointer("pointerdown", 2, 825, 45, button);
  pointer("pointerup", 2, 825, 45, button);
  assert.equal(input.consume().switchTo, "rail");
  click(1, "touch");
  click(0, "touch");
  assert.equal(input.consume().switchTo, null, "touch compatibility clicks cannot double-select");
  click(0);
  assert.equal(input.consume().switchTo, "rail", "keyboard and assistive clicks remain usable");
  mouse("pointerdown", button, 0, 825, 45);
  mouse("pointerup", button, 0, 825, 45);
  assert.equal(input.consume().switchTo, "rail", "a primary mouse click uses the same pointer release path");
  click(1, "mouse");
  assert.equal(input.consume().switchTo, null);
  mouse("pointerdown", button, 2);
  mouse("pointerup", button, 2);
  assert.equal(input.consume().switchTo, null, "secondary mouse buttons do not equip");
  button.disabled = true;
  click(0);
  assert.equal(input.consume().switchTo, null);
});

test("touching the weapon HUD breaks plasma double-tap priming without firing", (t) => {
  const { input, tap, pointer, weaponButton } = harness(t);
  input.setActiveWeapon("plasma");
  const { button, dispose } = weaponButton("plasma");
  tap(1, 700, 300);
  input.consume();
  pointer("pointerdown", 2, 825, 45, button);
  pointer("pointerup", 2, 825, 45, button);
  assert.equal(input.consume().switchTo, "plasma");
  pointer("pointerdown", 3, 710, 300);
  const command = input.consume();
  assert.equal(command.fire, false);
  assert.equal(command.fireHeld, false);
  dispose();
  assert.equal(button.style.touchAction, "manipulation");
  pointer("pointerdown", 4, 825, 45, button);
  pointer("pointerup", 4, 825, 45, button);
  assert.equal(input.consume().switchTo, null);
});

test("Space produces fresh jump commands and ignores keyboard autorepeat", (t) => {
  const { input, key } = harness(t);
  const initial = key("keydown", "Space");
  assert.equal(initial.defaultPrevented, true);
  assert.equal(input.consume().jump, true);
  assert.equal(input.consume().jump, false);
  key("keydown", "Space", true);
  assert.equal(input.consume().jump, false);
  key("keyup", "Space");
  key("keydown", "Space");
  assert.equal(input.consume().jump, true);
});

test("left tap emits one forward jump with no need for the right thumb", (t) => {
  const { input, tap } = harness(t);
  tap(1, 100, 300);
  const command = input.consume();
  assert.equal(command.jump, true);
  assert.equal(command.fire, false);
  near(command.forwardX, 0);
  near(command.forwardZ, -1);
  assert.equal(input.consume().jump, false);
});

test("cancelled right touch cannot fire or rotate the next touch", (t) => {
  const { input, tap, pointer } = harness(t);
  tap(1, 700, 300);
  input.consume();
  pointer("pointerdown", 2, 850, 350);
  pointer("pointercancel", 2, 850, 350);
  assert.equal(input.consume().fire, false);
  tap(3, 720, 300);
  near(input.yaw, 0);
  assert.equal(input.consume().fire, true);
});

test("cancelled left touch cannot jump and releases its movement ownership", (t) => {
  const { input, pointer, tap } = harness(t);
  pointer("pointerdown", 1, 100, 300);
  pointer("pointermove", 1, 100, 280);
  pointer("pointercancel", 1, 100, 280);
  let command = input.consume();
  assert.equal(command.jump, false);
  near(Math.hypot(command.x, command.z), 0);
  tap(2, 120, 320);
  command = input.consume();
  assert.equal(command.jump, true);
});

test("native gameplay gesture guards prevent selection without swallowing menu touch scrolling", (t) => {
  const { input, canvas, ui, touch } = harness(t);
  for (const type of ["touchstart", "touchmove"] as const) {
    assert.equal(touch(type, [{ identifier: 501 }]).defaultPrevented, true);
    assert.equal(touch(type, [{ identifier: 601, target: ui }], ui).defaultPrevented, false);
  }
  for (const type of ["selectstart", "contextmenu"]) {
    const gameplay = new Event(type, { bubbles: true, cancelable: true });
    canvas.dispatchEvent(gameplay);
    assert.equal(gameplay.defaultPrevented, true);
    const menu = new Event(type, { bubbles: true, cancelable: true });
    ui.dispatchEvent(menu);
    assert.equal(menu.defaultPrevented, false);
  }
  input.enabled = false;
  for (const type of ["touchstart", "touchmove"] as const)
    assert.equal(touch(type, [{ identifier: 701 }]).defaultPrevented, false);
});

test("native touchend without pointerup releases an orphan movement thumb without creating a jump", (t) => {
  const { input, pointer, touch, flushFrames } = harness(t);
  pointer("pointerdown", 1, 100, 300);
  pointer("pointermove", 1, 100, 260);
  near(input.consume().z, -1);
  touch("touchend");
  flushFrames();
  let command = input.consume();
  near(Math.hypot(command.x, command.z), 0);
  assert.equal(command.jump, false);
  assert.equal(command.fire, false);
  pointer("pointerdown", 2, 100, 300);
  pointer("pointermove", 2, 100, 340);
  command = input.consume();
  near(command.z, 1);
});

test("native touchcancel without pointer cancellation stops both movement and an unconsumed plasma activation", (t) => {
  const { input, pointer, tap, touch, flushFrames } = harness(t);
  input.setActiveWeapon("plasma");
  tap(1, 700, 300);
  input.consume();
  pointer("pointerdown", 2, 705, 300);
  pointer("pointerdown", 3, 100, 300);
  pointer("pointermove", 3, 100, 260);
  touch("touchcancel");
  flushFrames();
  const command = input.consume();
  near(Math.hypot(command.x, command.z), 0);
  assert.equal(command.jump, false);
  assert.equal(command.fire, false);
  assert.equal(command.fireHeld, false);
  pointer("pointerdown", 4, 705, 300);
  assert.equal(input.consume().fireHeld, false, "an interrupted hold cannot prime the next gesture");
});

test("partial native cancellation releases only the uncaptured thumb and ignores Touch identifier numbering", (t) => {
  const { input, pointer, tap, touch, capturedBy, flushFrames } = harness(t);
  input.setActiveWeapon("plasma");
  pointer("pointerdown", 1, 100, 300);
  pointer("pointermove", 1, 100, 260);
  tap(2, 700, 300);
  input.consume();
  pointer("pointerdown", 3, 705, 300);
  input.consume();
  // The browser lost this capture without delivering lostpointercapture.
  capturedBy.delete(3);
  touch("touchcancel", [{ identifier: 9001, clientX: 100, clientY: 260 }]);
  flushFrames();
  const command = input.consume();
  near(command.z, -1);
  assert.equal(command.fireHeld, false);
  assert.equal(command.fire, false);
  assert.equal(command.jump, false);
  pointer("pointerdown", 4, 720, 300);
  pointer("pointermove", 4, 730, 300);
  near(input.yaw, -.01 * Math.PI);
});

test("native release of another contact preserves both captured gameplay thumbs with unrelated Touch identifiers", (t) => {
  const { input, pointer, tap, touch, ui, flushFrames } = harness(t);
  input.setActiveWeapon("plasma");
  pointer("pointerdown", 1, 100, 300);
  pointer("pointermove", 1, 100, 260);
  tap(2, 700, 300);
  input.consume();
  pointer("pointerdown", 3, 705, 300);
  input.consume();
  touch("touchend", [
    { identifier: 8001, clientX: 100, clientY: 260 },
    { identifier: 8002, clientX: 705, clientY: 300 },
  ], ui);
  flushFrames();
  const command = input.consume();
  near(command.z, -1);
  assert.equal(command.fireHeld, true);
  assert.equal(command.fire, false);
  assert.equal(command.jump, false);
});

for (const order of ["pointer-first", "touch-first"] as const)
  test(`normal taps preserve one shot, plasma priming and one jump with ${order} native release ordering`, (t) => {
    const { input, pointer, touch, flushFrames } = harness(t);
    input.setActiveWeapon("plasma");
    const release = (id: number, x: number) => {
      if (order === "touch-first") touch("touchend");
      pointer("pointerup", id, x, 300);
      if (order === "pointer-first") touch("touchend");
      flushFrames();
    };
    pointer("pointerdown", 30, 700, 300);
    release(30, 700);
    assert.equal(input.consume().fire, true);
    assert.equal(input.consume().fire, false, "the native event does not duplicate the tap");
    pointer("pointerdown", 31, 705, 300);
    let command = input.consume();
    assert.equal(command.fireHeld, true, "normal cleanup preserves the first plasma tap");
    assert.equal(command.fire, true);
    pointer("pointercancel", 31, 705, 300);
    input.consume();
    pointer("pointerdown", 32, 100, 300);
    release(32, 100);
    command = input.consume();
    assert.equal(command.jump, true);
    assert.equal(command.fire, false);
    assert.equal(input.consume().jump, false);
  });

test("orphan movement cleanup preserves a normally completed projectile tap and plasma priming", (t) => {
  const { input, pointer, tap, touch, flushFrames } = harness(t);
  input.setActiveWeapon("plasma");
  pointer("pointerdown", 1, 100, 300);
  pointer("pointermove", 1, 100, 260);
  tap(2, 700, 300);
  touch("touchend");
  flushFrames();
  const command = input.consume();
  near(Math.hypot(command.x, command.z), 0);
  assert.equal(command.fire, true, "releasing a stale movement finger cannot erase a real fire tap");
  assert.equal(command.jump, false);
  pointer("pointerdown", 3, 705, 300);
  assert.equal(input.consume().fireHeld, true);
});

test("deferred native cleanup cannot cancel a fresh finger created after the interrupted gesture", (t) => {
  const { input, pointer, touch, flushFrames } = harness(t);
  pointer("pointerdown", 1, 100, 300);
  pointer("pointermove", 1, 100, 260);
  touch("touchend");
  pointer("pointercancel", 1, 100, 260);
  pointer("pointerdown", 2, 100, 300);
  pointer("pointermove", 2, 100, 340);
  flushFrames();
  let command = input.consume();
  near(command.z, 1);
  assert.equal(command.jump, false);
  pointer("pointermove", 2, 140, 300);
  command = input.consume();
  near(command.x, 1);
});

test("a new primary touch recovers a stale canvas session even when no terminal native event arrived", (t) => {
  const { input, canvas, pointer } = harness(t);
  pointer("pointerdown", 11, 100, 300, canvas, true);
  pointer("pointermove", 11, 100, 260);
  pointer("pointerdown", 12, 700, 300);
  pointer("pointerdown", 21, 700, 300, canvas, true);
  pointer("pointermove", 21, 720, 300);
  const command = input.consume();
  near(Math.hypot(command.x, command.z), 0);
  near(input.yaw, -.02 * Math.PI);
  assert.equal(command.jump, false);
  assert.equal(command.fire, false);
});

test("a fresh same-side secondary touch evicts only lost capture and preserves the opposite plasma hold", (t) => {
  const { input, pointer, tap, capturedBy } = harness(t);
  input.setActiveWeapon("plasma");
  tap(1, 700, 300);
  input.consume();
  pointer("pointerdown", 2, 705, 300);
  input.consume();
  pointer("pointerdown", 3, 100, 300);
  pointer("pointermove", 3, 100, 260);
  capturedBy.delete(3);
  pointer("pointerdown", 4, 100, 300);
  pointer("pointermove", 4, 100, 340);
  let command = input.consume();
  near(command.z, 1);
  assert.equal(command.fireHeld, true);
  assert.equal(command.fire, false);
  pointer("pointerdown", 5, 100, 300);
  pointer("pointermove", 5, 100, 250);
  command = input.consume();
  near(command.z, 1);
  assert.equal(command.fireHeld, true, "an extra contact cannot evict a genuinely held finger");
});

test("rejected canvas capture abandons the contact and a later gesture still works", (t) => {
  const { input, pointer, rejectedCaptures } = harness(t);
  rejectedCaptures.add(40);
  pointer("pointerdown", 40, 100, 300);
  pointer("pointermove", 40, 100, 260);
  pointer("pointerup", 40, 100, 260);
  let command = input.consume();
  near(Math.hypot(command.x, command.z), 0);
  assert.equal(command.jump, false);
  assert.equal(command.fire, false);
  pointer("pointerdown", 41, 100, 300);
  pointer("pointermove", 41, 100, 340);
  command = input.consume();
  near(command.z, 1);
});

test("rejected HUD capture discards pending selection without disturbing the movement thumb", (t) => {
  const { input, pointer, weaponButton, rejectedCaptures } = harness(t);
  const { button } = weaponButton("rocket");
  pointer("pointerdown", 1, 100, 300);
  pointer("pointermove", 1, 100, 260);
  rejectedCaptures.add(50);
  pointer("pointerdown", 50, 825, 45, button);
  pointer("pointerup", 50, 825, 45, button);
  const command = input.consume();
  near(command.z, -1);
  assert.equal(command.switchTo, null);
  assert.equal(command.fire, false);
  assert.equal(command.jump, false);
  pointer("pointerdown", 51, 825, 45, button);
  pointer("pointerup", 51, 825, 45, button);
  assert.equal(input.consume().switchTo, "rocket");
});

test("a canvas context-menu interruption releases both thumbs without firing or jumping", (t) => {
  const { input, canvas, pointer, tap, capturedBy } = harness(t);
  input.setActiveWeapon("plasma");
  pointer("pointerdown", 1, 100, 300);
  pointer("pointermove", 1, 100, 260);
  tap(2, 700, 300);
  input.consume();
  pointer("pointerdown", 3, 705, 300);
  const event = new Event("contextmenu", { bubbles: true, cancelable: true });
  canvas.dispatchEvent(event);
  const command = input.consume();
  assert.equal(event.defaultPrevented, true);
  near(Math.hypot(command.x, command.z), 0);
  assert.equal(command.fire, false);
  assert.equal(command.fireHeld, false);
  assert.equal(command.jump, false);
  assert.equal(capturedBy.has(1), false);
  assert.equal(capturedBy.has(3), false);
});

test("native weapon HUD guards stay scoped to usable buttons and are removed on disposal", (t) => {
  const { input, touch, weaponButton } = harness(t);
  const { button, dispose } = weaponButton("rail");
  for (const type of ["touchstart", "touchmove"] as const) {
    assert.equal(touch(type, [{ identifier: 3001, target: button }], button).defaultPrevented, true);
    button.disabled = true;
    assert.equal(touch(type, [{ identifier: 3001, target: button }], button).defaultPrevented, false);
    button.disabled = false;
  }
  for (const type of ["selectstart", "contextmenu"]) {
    const event = new Event(type, { bubbles: true, cancelable: true });
    button.dispatchEvent(event);
    assert.equal(event.defaultPrevented, true);
  }
  assert.equal(input.consume().switchTo, null);
  dispose();
  for (const type of ["touchstart", "touchmove"] as const)
    assert.equal(touch(type, [{ identifier: 3001, target: button }], button).defaultPrevented, false);
  for (const type of ["selectstart", "contextmenu"]) {
    const event = new Event(type, { bubbles: true, cancelable: true });
    button.dispatchEvent(event);
    assert.equal(event.defaultPrevented, false);
  }
});

test("native touch reconciliation leaves active pen movement and mouse hold alone", (t) => {
  const { input, canvas, pointer, touch, mouse, lock, flushFrames } = harness(t);
  pointer("pointerdown", 70, 100, 300, canvas, true, "pen");
  pointer("pointermove", 70, 100, 260, canvas, true, "pen");
  touch("touchend");
  flushFrames();
  near(input.consume().z, -1);
  pointer("pointerup", 70, 100, 260, canvas, true, "pen");
  input.setActiveWeapon("plasma");
  lock();
  mouse("pointerdown");
  input.consume();
  touch("touchcancel");
  flushFrames();
  assert.equal(input.consume().fireHeld, true);
  mouse("pointerup");
  assert.equal(input.consume().fireHeld, false);
});

test("dead player touch and fresh Space request respawn without gameplay actions", (t) => {
  const { input, tap, key } = harness(t);
  let respawns = 0;
  input.dead = true;
  input.onRespawn = () => {
    respawns++;
  };
  tap(1, 700, 300);
  key("keydown", "Space");
  key("keydown", "Space", true);
  assert.equal(respawns, 2);
  const command = input.consume();
  assert.equal(command.fire, false);
  assert.equal(command.jump, false);
});

test("map weapon slots ignore pickup ordering, duplicates and resources", () => {
  const kinds = [
    "shotgun",
    "health",
    "rail",
    "rocket",
    "ammo",
    "rocket",
    "armor",
  ];
  const expected = ["melee", "machinegun", "rocket", "rail", "shotgun"];
  assert.deepEqual(getWeaponSlots(kinds.map((kind) => ({ kind }))), expected);
  assert.deepEqual(
    getWeaponSlots([...kinds].reverse().map((kind) => ({ kind }))),
    expected,
  );
  assert.deepEqual(
    getWeaponSlots([]),
    ["melee", "machinegun"],
    "spawn equipment remains available without map pickups",
  );
});

test("both maps use stable number keys one through five and ignore unused arsenal keys", (t) => {
  const { input, key } = harness(t);
  const codes = ["Digit1", "Digit2", "Digit3", "Digit4", "Digit5"];
  for (const specialty of ["shotgun", "lightning"] as const) {
    const slots = getWeaponSlots([
      { kind: specialty },
      { kind: "rail" },
      { kind: "rocket" },
      { kind: "rocket" },
    ]);
    input.setWeaponSlots(slots);
    assert.deepEqual(slots, [
      "melee",
      "machinegun",
      "rocket",
      "rail",
      specialty,
    ]);
    for (const [index, code] of codes.entries()) {
      key("keydown", code);
      assert.equal(
        input.consume().switchTo,
        slots[index],
        `${specialty}: ${code}`,
      );
      assert.equal(
        input.consume().switchTo,
        null,
        "selection is consumed once",
      );
      key("keyup", code);
    }
    for (const code of [
      "Digit6",
      "Digit7",
      "Digit8",
      "Digit9",
      "Digit0",
      "Minus",
      "Equal",
    ]) {
      key("keydown", code);
      assert.equal(
        input.consume().switchTo,
        null,
        `${code} cannot select an absent map slot`,
      );
      key("keyup", code);
    }
  }
});

test("changing maps replaces slot five and clears a queued selection from the old map", (t) => {
  const { input, key } = harness(t);
  const ossuary = getWeaponSlots([
    { kind: "rocket" },
    { kind: "rail" },
    { kind: "shotgun" },
  ]);
  const rift = getWeaponSlots([
    { kind: "rocket" },
    { kind: "rail" },
    { kind: "lightning" },
  ]);
  input.setWeaponSlots(ossuary);
  key("keydown", "Digit5");
  key("keyup", "Digit5");
  input.setWeaponSlots(rift);
  assert.equal(
    input.consume().switchTo,
    null,
    "an old queued shotgun selection cannot enter the new map",
  );
  key("keydown", "Digit5");
  assert.equal(input.consume().switchTo, "lightning");
  key("keyup", "Digit5");
  input.setWeaponSlots(ossuary);
  key("keydown", "Digit5");
  assert.equal(
    input.consume().switchTo,
    "shotgun",
    "returning to the first map restores its specialty",
  );
});

test("controller cycles the complete collected arsenal and skips uncollected later slots", (t) => {
  const { input } = harness(t);
  input.setWeaponSlots(
    getWeaponSlots([{ kind: "rocket" }, { kind: "rail" }, { kind: "shotgun" }]),
  );
  const buttons = Array.from({ length: 10 }, () => ({ pressed: false }));
  Object.assign(navigator, {
    getGamepads: () => [{ connected: true, axes: [0, 0, 0, 0], buttons }],
  });
  const owned = new Set(WEAPON_ORDER);
  let current: WeaponId = "melee";
  const cycle = (button: 4 | 5) => {
    buttons[button].pressed = true;
    input.pollPad(1 / 60, current, owned);
    const next = input.consume().switchTo;
    buttons[button].pressed = false;
    if (next) current = next;
    input.pollPad(1 / 60, current, owned);
    input.consume();
    return next;
  };
  for (const expected of [...WEAPON_ORDER.slice(1), "melee"])
    assert.equal(cycle(5), expected);
  assert.equal(cycle(4), "chaingun", "left shoulder wraps into slot twelve");
  owned.delete("proximity");
  owned.delete("nailgun");
  assert.equal(cycle(4), "bfg", "uncollected late slots are skipped");
});

test("rebound movement and slots use actual keyboard events and update visible shortcut labels", (t) => {
  const { input, key } = harness(t);
  input.setWeaponSlots(["melee", "machinegun", "rocket", "rail", "plasma"]);
  let controls = assignControlKey(defaultControls(), "forward", 0, "KeyF");
  controls = assignControlKey(controls, "weapon5", 0, "KeyQ");
  input.setBindings(controls);
  key("keydown", "KeyW"); near(input.consume().z, 0);
  key("keydown", "KeyF"); near(input.consume().z, -1);
  key("keyup", "KeyF"); near(input.consume().z, 0);
  key("keydown", "KeyQ"); assert.equal(input.consume().switchTo, "plasma");
  assert.equal(input.weaponKeyLabel(4), "Q");
  key("keydown", "Digit5");
  input.pollPad(1 / 60, "plasma", new Set(["melee", "machinegun", "plasma"]));
  assert.equal(input.consume().switchTo, "machinegun", "displaced Q now cycles previous on 5");
});

test("rebinding clears held movement, pending jumps and mouse fire until fresh input", (t) => {
  const { input, key, mouse, lock } = harness(t);
  input.setActiveWeapon("plasma"); lock();
  key("keydown", "KeyW"); key("keydown", "Space"); mouse("pointerdown");
  input.setBindings(defaultControls());
  let command = input.consume();
  near(command.z, 0); assert.equal(command.jump, false); assert.equal(command.fire, false); assert.equal(command.fireHeld, false);
  key("keydown", "KeyW", true); near(input.consume().z, 0);
  mouse("pointerdown"); assert.equal(input.consume().fireHeld, false);
  key("keyup", "KeyW"); key("keydown", "KeyW"); near(input.consume().z, -1);
  mouse("pointerup"); mouse("pointerdown"); assert.equal(input.consume().fireHeld, true);
});

test("a key captured while paused cannot start movement from autorepeat after resuming", (t) => {
  const { input, key } = harness(t);
  input.enabled = false;
  input.setBindings(assignControlKey(defaultControls(), "forward", 0, "KeyF"));
  input.enabled = true;
  key("keydown", "KeyF", true); near(input.consume().z, 0);
  key("keyup", "KeyF"); key("keydown", "KeyF"); near(input.consume().z, -1);
});

test("rebound keyboard and mouse fire retain Wraith hold and release rules", (t) => {
  const { input, key, mouse, lock, canvas } = harness(t);
  input.setBindings(assignControlKey(defaultControls(), "fire", 0, "KeyF"));
  input.setActiveWeapon("plasma"); lock();
  mouse("pointerdown"); assert.equal(input.consume().fire, false);
  key("keydown", "KeyF"); assert.equal(input.consume().fireHeld, true);
  assert.equal(input.consume().fire, false);
  key("keyup", "KeyF"); assert.equal(input.consume().fireHeld, false);
  input.setBindings(assignControlKey(defaultControls(), "fire", 0, "Mouse2"));
  mouse("pointerup"); mouse("pointerdown", canvas, 2);
  assert.equal(input.consume().fireHeld, true);
  mouse("pointerup", canvas, 2); assert.equal(input.consume().fireHeld, false);
  input.setActiveWeapon("rocket"); mouse("pointerdown", canvas, 2);
  const shot = input.consume(); assert.equal(shot.fire, true); assert.equal(shot.fireHeld, false);
  assert.equal(input.consume().fire, false);
});

test("keyboard Wraith hold cannot survive a weapon change or death", (t) => {
  const { input, key } = harness(t);
  input.setBindings(assignControlKey(defaultControls(), "fire", 0, "KeyF"));
  input.setActiveWeapon("plasma"); key("keydown", "KeyF");
  assert.equal(input.consume().fireHeld, true);
  input.setActiveWeapon("rocket"); input.setActiveWeapon("plasma");
  key("keydown", "KeyF", true); assert.equal(input.consume().fireHeld, false);
  key("keyup", "KeyF"); key("keydown", "KeyF"); assert.equal(input.consume().fireHeld, true);
  input.dead = true; input.dead = false; assert.equal(input.consume().fireHeld, false);
});

test("custom keyboard pause and standings actions fire once; Escape remains available", (t) => {
  const { input, key } = harness(t);
  input.setBindings(assignControlKey(assignControlKey(defaultControls(), "pause", 0, "KeyC"), "scores", 0, "KeyV"));
  let pauses = 0, scores = 0;
  input.onPause = () => pauses++; input.onScores = () => scores++;
  key("keydown", "KeyC"); key("keydown", "KeyC", true);
  key("keydown", "KeyV"); key("keydown", "Tab"); key("keydown", "Escape");
  assert.equal(pauses, 2); assert.equal(scores, 1);
  assert.equal(input.consume().jump, false);
});

test("custom pad buttons, direct weapon slots and fresh-press Wraith fire work without altering axes", (t) => {
  const { input } = harness(t);
  const buttons = Array.from({ length: 16 }, () => ({ pressed: false }));
  Object.assign(navigator, { getGamepads: () => [{ index: 0, connected: true, axes: [0, 0, 0, 0], buttons }] });
  let controls = assignPadButton(defaultControls(), "fire", 2);
  controls = assignPadButton(controls, "weapon5", 3);
  input.setWeaponSlots(["melee", "machinegun", "rocket", "rail", "plasma"]);
  input.setBindings(controls); input.setActiveWeapon("plasma");
  input.pollPad(1 / 60, "plasma");
  buttons[2].pressed = true; input.pollPad(1 / 60, "plasma");
  let command = input.consume(); assert.equal(command.fire, true); assert.equal(command.fireHeld, false);
  input.pollPad(1 / 60, "plasma"); command = input.consume(); assert.equal(command.fire, false); assert.equal(command.fireHeld, false);
  buttons[3].pressed = true; input.pollPad(1 / 60, "plasma"); assert.equal(input.consume().switchTo, "plasma");
  buttons[2].pressed = false; input.pollPad(1 / 60, "plasma");
  buttons[2].pressed = true; input.pollPad(1 / 60, "plasma"); assert.equal(input.consume().fire, true);
});

test("pad rebinding blocks buttons held during capture and moving sticks until released and centered", (t) => {
  const { input } = harness(t);
  const buttons = Array.from({ length: 16 }, () => ({ pressed: false }));
  const axes = [0, -1, 0, 0];
  Object.assign(navigator, { getGamepads: () => [{ index: 0, connected: true, axes, buttons }] });
  buttons[2].pressed = true;
  input.setBindings(assignPadButton(defaultControls(), "jump", 2));
  input.pollPad(1 / 60, "machinegun");
  let command = input.consume(); near(command.z, 0); assert.equal(command.jump, false);
  buttons[2].pressed = false; axes[1] = 0; input.pollPad(1 / 60, "machinegun"); input.consume();
  buttons[2].pressed = true; axes[1] = -1; input.pollPad(1 / 60, "machinegun");
  command = input.consume(); near(command.z, -1); assert.equal(command.jump, true);
});

test("swapped controller axes, inversion and dead zone affect only the selected control axes", (t) => {
  const { input } = harness(t);
  const axes = [0, 0, 0, 0];
  Object.assign(navigator, { getGamepads: () => [{ index: 0, connected: true, axes, buttons: [] }] });
  const controls = defaultControls(); controls.axes = { moveX: 2, moveY: 3, lookX: 0, lookY: 1 }; controls.invertLookY = true; controls.deadzone = 0.25;
  input.setBindings(controls); input.pollPad(1 / 60, "machinegun");
  axes[2] = 0.2; input.pollPad(1 / 60, "machinegun"); near(input.consume().x, 0);
  axes[2] = 0.8; input.pollPad(1 / 60, "machinegun"); near(input.consume().x, 1);
  axes[1] = 0.5; input.pollPad(1 / 60, "machinegun"); assert.ok(input.pitch > 0); near(input.yaw, 0);
});

test("unavailable controller access leaves keyboard and touch usable", (t) => {
  const { input, key, pointer } = harness(t);
  Object.assign(navigator, { getGamepads: () => { throw new DOMException("Unavailable", "SecurityError"); } });
  input.setBindings(defaultControls()); key("keydown", "KeyW"); input.pollPad(1 / 60, "machinegun");
  near(input.consume().z, -1); key("keyup", "KeyW");
  pointer("pointerdown", 1, 100, 300); pointer("pointermove", 1, 100, 260);
  input.pollPad(1 / 60, "machinegun"); near(input.consume().z, -1);
});
