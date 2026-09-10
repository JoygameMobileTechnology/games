export const CONTROL_ACTIONS = [
  "forward", "backward", "left", "right", "jump", "fire",
  "previousWeapon", "nextWeapon", "weapon1", "weapon2", "weapon3", "weapon4", "weapon5", "pause", "scores",
] as const;
export type ControlAction = typeof CONTROL_ACTIONS[number];
export const PAD_ACTIONS = CONTROL_ACTIONS.filter((action) =>
  !["forward", "backward", "left", "right"].includes(action));
export const AXIS_ACTIONS = ["moveX", "moveY", "lookX", "lookY"] as const;
export type AxisAction = typeof AXIS_ACTIONS[number];
export interface ControlsBindings {
  keys: Record<ControlAction, [string | null, string | null]>;
  buttons: Partial<Record<ControlAction, number | null>>;
  axes: Record<AxisAction, number>;
  invertLookY: boolean;
  deadzone: number;
}
export const CONTROL_LABELS: Record<ControlAction, string> = {
  forward: "Move forward", backward: "Move backward", left: "Strafe left", right: "Strafe right",
  jump: "Jump / respawn", fire: "Fire", previousWeapon: "Previous weapon", nextWeapon: "Next weapon",
  weapon1: "Weapon slot 1", weapon2: "Weapon slot 2", weapon3: "Weapon slot 3", weapon4: "Weapon slot 4",
  weapon5: "Weapon slot 5", pause: "Pause", scores: "Standings",
};
export function defaultControls(): ControlsBindings {
  return {
    keys: {
      forward: ["KeyW", "ArrowUp"], backward: ["KeyS", "ArrowDown"], left: ["KeyA", "ArrowLeft"], right: ["KeyD", "ArrowRight"],
      jump: ["Space", null], fire: ["Mouse0", null], previousWeapon: ["KeyQ", null], nextWeapon: ["KeyE", null],
      weapon1: ["Digit1", null], weapon2: ["Digit2", null], weapon3: ["Digit3", null], weapon4: ["Digit4", null], weapon5: ["Digit5", null],
      pause: ["KeyP", null], scores: ["Tab", null],
    },
    buttons: { jump: 0, fire: 7, previousWeapon: 4, nextWeapon: 5, pause: 9, scores: 8 },
    axes: { moveX: 0, moveY: 1, lookX: 2, lookY: 3 },
    invertLookY: false, deadzone: 0.16,
  };
}
export function validControlKey(value: unknown): value is string {
  return typeof value === "string" && /^(Key[A-Z]|Digit[1-5]|Mouse[0-4]|Arrow(Up|Down|Left|Right)|Space|Tab|Shift(Left|Right)|Control(Left|Right)|CapsLock)$/.test(value);
}
/** Profiles are untrusted; stale/invalid entries fall back without introducing
 * duplicate bindings. Escape is reserved for pause and capture cancellation. */
export function normalizeControls(value: unknown): ControlsBindings {
  const result = defaultControls();
  const source = value && typeof value === "object" ? value as Partial<ControlsBindings> : {};
  for (const action of CONTROL_ACTIONS) {
    const keys = source.keys?.[action];
    if (Array.isArray(keys)) result.keys[action] = [0, 1].map((i) =>
      keys[i] === null || validControlKey(keys[i]) ? keys[i] : result.keys[action][i]) as [string | null, string | null];
    const button = source.buttons?.[action];
    if (PAD_ACTIONS.includes(action) && (button === null || (Number.isInteger(button) && Number(button) >= 0 && Number(button) <= 31)))
      result.buttons[action] = button;
  }
  const usedKeys = new Set<string>();
  const usedButtons = new Set<number>();
  for (const action of CONTROL_ACTIONS) {
    result.keys[action] = result.keys[action].map((key) => {
      if (!key || usedKeys.has(key)) return null;
      usedKeys.add(key); return key;
    }) as [string | null, string | null];
    const button = result.buttons[action];
    if (typeof button === "number") {
      if (usedButtons.has(button)) result.buttons[action] = null;
      else usedButtons.add(button);
    }
  }
  const axes = AXIS_ACTIONS.map((action) => source.axes?.[action]);
  if (axes.every((axis) => Number.isInteger(axis) && Number(axis) >= 0 && Number(axis) <= 7) && new Set(axes).size === 4)
    for (const action of AXIS_ACTIONS) result.axes[action] = source.axes![action];
  result.invertLookY = source.invertLookY === true;
  if (typeof source.deadzone === "number" && Number.isFinite(source.deadzone))
    result.deadzone = Math.min(0.4, Math.max(0.05, source.deadzone));
  return result;
}
export function controlKeyLabel(key: string | null | undefined) {
  if (!key) return "Unbound";
  if (key.startsWith("Key")) return key.slice(3);
  if (key.startsWith("Digit")) return key.slice(5);
  return ({ Mouse0: "Mouse 1", Mouse1: "Mouse 3", Mouse2: "Mouse 2", Mouse3: "Mouse 4", Mouse4: "Mouse 5",
    ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→", ShiftLeft: "L Shift", ShiftRight: "R Shift",
    ControlLeft: "L Ctrl", ControlRight: "R Ctrl", CapsLock: "Caps Lock" } as Record<string, string>)[key] ?? key;
}
export function padButtonLabel(button: number | null | undefined) {
  if (button === null || button === undefined) return "Unbound";
  return ["A / Cross", "B / Circle", "X / Square", "Y / Triangle", "LB / L1", "RB / R1", "LT / L2", "RT / R2", "View / Select", "Menu / Start", "L stick", "R stick", "D-pad up", "D-pad down", "D-pad left", "D-pad right", "Home"][button] ?? `Button ${button}`;
}
export function readGamepad(): Gamepad | null {
  try { return navigator.getGamepads?.().find((pad) => pad?.connected) ?? null; }
  catch { return null; }
}
export function keyConflict(bindings: ControlsBindings, action: ControlAction, slot: number, key: string) {
  for (const other of CONTROL_ACTIONS) for (const position of [0, 1] as const)
    if ((other !== action || position !== slot) && bindings.keys[other][position] === key)
      return { action: other, slot: position };
  return null;
}
export function assignControlKey(bindings: ControlsBindings, action: ControlAction, slot: 0 | 1, key: string | null): ControlsBindings {
  const result = normalizeControls(bindings);
  if (key !== null && !validControlKey(key)) return result;
  const conflict = key === null ? null : keyConflict(result, action, slot, key);
  if (conflict) result.keys[conflict.action][conflict.slot] = result.keys[action][slot];
  result.keys[action][slot] = key;
  return result;
}
export function assignPadButton(bindings: ControlsBindings, action: ControlAction, button: number | null): ControlsBindings {
  const result = normalizeControls(bindings);
  if (!PAD_ACTIONS.includes(action) || (button !== null && (!Number.isInteger(button) || button < 0 || button > 31))) return result;
  const conflict = button === null ? undefined : PAD_ACTIONS.find((other) => other !== action && result.buttons[other] === button);
  if (conflict) result.buttons[conflict] = result.buttons[action] ?? null;
  result.buttons[action] = button;
  return result;
}
