import { WEAPON_ORDER, type WeaponId } from "./rules";
import type { Settings } from "./profile";
import { CONTROL_ACTIONS, controlKeyLabel, normalizeControls, readGamepad, type ControlAction, type ControlsBindings } from "./controls-bindings";

export const WEAPON_KEYS = ["1", "2", "3", "4", "5"];
export const WEAPON_CODES = ["Digit1", "Digit2", "Digit3", "Digit4", "Digit5"];
const PLASMA_DOUBLE_TAP_MS = 300;
const PLASMA_DOUBLE_TAP_DISTANCE = 48;

interface Finger {
  id: number;
  pointerType: string;
  x: number;
  y: number;
  startX: number;
  startY: number;
  at: number;
  moved: number;
  canTap: boolean;
  firedOnDown: boolean;
}
export class Input {
  yaw = 0;
  pitch = 0;
  private activeWeapon: WeaponId = "machinegun";
  private mouseFireHeld = false;
  private controls: ControlsBindings;
  private blockedKeys = new Set<string>();
  private blockedPadButtons = new Set<number>();
  private waitForPadNeutral = false;
  private previousPadIndex: number | undefined;
  private cycleDirection = 0;
  private touchFireId: number | null = null;
  private plasmaTap: { x: number; y: number; at: number } | null = null;
  private interactionRevision = 0;
  private _enabled = false;
  get enabled() {
    return this._enabled;
  }
  set enabled(value: boolean) {
    this._enabled = value;
    if (!value) this.clearFiringIntent();
  }
  setActiveWeapon(weapon: WeaponId) {
    if (weapon === this.activeWeapon) return;
    this.activeWeapon = weapon;
    this.clearFiringIntent();
  }
  jump = false;
  fire = false;
  switchTo: WeaponId | null = null;
  private slots: readonly WeaponId[] = Object.freeze(["melee", "machinegun"]);
  get weaponSlots(): readonly WeaponId[] {
    return this.slots;
  }
  setWeaponSlots(slots: readonly WeaponId[]) {
    this.slots = Object.freeze([...slots]);
    this.switchTo = null;
  }
  weaponKeyLabel(index: number) {
    const action = `weapon${index + 1}` as ControlAction;
    return this.controls.keys[action] ? controlKeyLabel(this.controls.keys[action][0] ?? this.controls.keys[action][1]) : "";
  }
  setBindings(value: unknown) {
    // An input held across a rebind must be released before it can act again.
    for (const key of this.keys) this.blockedKeys.add(key);
    this.padButtons.forEach((pressed, index) => { if (pressed) this.blockedPadButtons.add(index); });
    readGamepad()?.buttons.forEach((button, index) => { if (button.pressed) this.blockedPadButtons.add(index); });
    this.waitForPadNeutral = true;
    this.controls = normalizeControls(value);
    this.clear();
  }
  private keys = new Set<string>();
  private left: Finger | null = null;
  private right: Finger | null = null;
  private padButtons: boolean[] = [];
  private padX = 0;
  private padY = 0;
  onPause = () => {};
  onScores = () => {};
  onRespawn = () => {};
  onGesture = () => {};
  private _dead = false;
  get dead() {
    return this._dead;
  }
  set dead(value: boolean) {
    this._dead = value;
    if (value) this.clearFiringIntent();
  }
  constructor(
    private canvas: HTMLCanvasElement | null,
    private settings: Settings,
  ) {
    this.controls = normalizeControls((settings as Settings & { controls?: ControlsBindings }).controls);
    if (!canvas) return;
    window.addEventListener("keydown", (e) => {
      if (!this.enabled || e.altKey || e.metaKey) return;
      if (e.code === "Escape") {
        if (!e.repeat) this.onPause();
        return;
      }
      const action = this.keyAction(e.code);
      if (action) e.preventDefault();
      if (this.blockedKeys.has(e.code)) return;
      if (e.repeat && !this.keys.has(e.code)) return;
      if (!e.repeat && !this.keys.has(e.code) && action) this.triggerAction(action);
      if (this.enabled) this.keys.add(e.code);
    });
    window.addEventListener("keyup", (e) => { this.keys.delete(e.code); this.blockedKeys.delete(e.code); });
    window.addEventListener("blur", () => {
      this.clear();
      if (this.enabled) this.onPause();
    });
    document.addEventListener("pointerlockchange", () => {
      if (document.pointerLockElement !== canvas) this.clearFiringIntent();
      if (!document.pointerLockElement && this.enabled && !this.dead)
        this.onPause();
    });
    document.addEventListener("mousemove", (e) => {
      if (this.enabled && document.pointerLockElement === canvas)
        this.look(e.movementX * 0.0025, e.movementY * 0.0025);
    });
    // Native selection/loupe gestures are independent of CSS pan/zoom control.
    // Only the gameplay surface owns these TouchEvents; menu scrolling and name
    // editing never pass through this listener.
    const preventNativeGesture = (event: Event) => {
      if (this.enabled && event.cancelable) event.preventDefault();
    };
    canvas.addEventListener("touchstart", preventNativeGesture, { passive: false });
    canvas.addEventListener("touchmove", preventNativeGesture, { passive: false });
    canvas.addEventListener("selectstart", preventNativeGesture);
    canvas.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      if (!this.enabled) return;
      if (this.left) finishTouch(this.left, true);
      if (this.right) finishTouch(this.right, true);
    });
    canvas.addEventListener("pointerdown", (e) => {
      if (!this.enabled) return;
      this.onGesture();
      if (this.dead) {
        this.onRespawn();
        return;
      }
      if (e.pointerType === "mouse") {
        const code = `Mouse${e.button}`;
        if (document.pointerLockElement === canvas && !this.blockedKeys.has(code)) {
          const action = this.keyAction(code);
          if (!this.keys.has(code) && action) this.triggerAction(action);
          this.keys.add(code);
          this.mouseFireHeld = action === "fire" && this.activeWeapon === "plasma";
        } else if (e.button === 0) this.lockMouse();
        return;
      }
      e.preventDefault();
      if (e.pointerType === "touch") {
        // A new primary touch starts a new physical touch session. An old owner
        // here means the browser swallowed its terminal PointerEvent.
        for (const previous of [this.left, this.right]) {
          if (!previous || previous.pointerType !== "touch") continue;
          const sameSide = e.clientX < innerWidth * 0.5
            ? previous === this.left : previous === this.right;
          if (e.isPrimary || (sameSide && !canvas.hasPointerCapture(previous.id)))
            finishTouch(previous, true);
        }
      }
      // The browser can cancel a touch between dispatch and capture acquisition.
      try { canvas.setPointerCapture(e.pointerId); } catch { return; }
      const finger = {
        id: e.pointerId,
        pointerType: e.pointerType,
        x: e.clientX,
        y: e.clientY,
        startX: e.clientX,
        startY: e.clientY,
        at: performance.now(),
        moved: 0,
        canTap: true,
        firedOnDown: false,
      };
      if (e.clientX < innerWidth * 0.5 && !this.left) this.left = finger;
      else if (e.clientX >= innerWidth * 0.5 && !this.right) {
        this.right = finger;
        const previous = this.plasmaTap;
        this.plasmaTap = null;
        if (
          this.activeWeapon === "plasma" &&
          previous &&
          finger.at - previous.at <= PLASMA_DOUBLE_TAP_MS &&
          Math.hypot(finger.x - previous.x, finger.y - previous.y) <=
            PLASMA_DOUBLE_TAP_DISTANCE
        ) {
          // Fire once on the second down, then allow unrestricted aiming while
          // held. A fresh touch begins at its own origin without rotating the aim.
          this.fire = true;
          finger.firedOnDown = true;
          this.touchFireId = finger.id;
        }
      }
      this.drawSticks();
    });
    canvas.addEventListener("pointermove", (e) => {
      const finger =
        this.left?.id === e.pointerId
          ? this.left
          : this.right?.id === e.pointerId
            ? this.right
            : null;
      if (!this.enabled || !finger) return;
      if (finger === this.right)
        this.look(
          ((e.clientX - finger.x) / innerWidth) * Math.PI,
          ((e.clientY - finger.y) / innerHeight) * Math.PI,
        );
      finger.x = e.clientX;
      finger.y = e.clientY;
      finger.moved = Math.max(
        finger.moved,
        Math.hypot(finger.x - finger.startX, finger.y - finger.startY),
      );
      this.drawSticks();
    });
    const finishTouch = (finger: Finger, cancelled: boolean, x = finger.x, y = finger.y) => {
      if (finger !== this.left && finger !== this.right) return;
      const tap =
        !cancelled && this.enabled && !this.dead && finger.canTap &&
        finger.moved < 12 && performance.now() - finger.at < 260;
      if (finger === this.left) {
        if (tap) this.jump = true;
        this.left = null;
      } else {
        if (tap && !finger.firedOnDown) {
          this.fire = true;
          if (this.activeWeapon === "plasma")
            this.plasmaTap = { x, y, at: performance.now() };
        }
        if (cancelled) this.clearFiringIntent();
        if (this.touchFireId === finger.id) this.touchFireId = null;
        this.right = null;
      }
      if (cancelled) {
        // Clear ownership before release: lostpointercapture can follow it.
        try {
          if (canvas.hasPointerCapture(finger.id)) canvas.releasePointerCapture(finger.id);
        } catch { /* Already released by the browser. */ }
      }
      this.drawSticks();
    };
    const release = (e: PointerEvent, cancelled: boolean) => {
      if (e.pointerType === "mouse") {
        const code = `Mouse${e.button}`;
        this.keys.delete(code);
        this.blockedKeys.delete(code);
        if (this.keyAction(code) === "fire" || cancelled) {
          this.mouseFireHeld = false;
          if (cancelled) this.fire = false;
        }
        return;
      }
      const finger = this.left?.id === e.pointerId ? this.left
        : this.right?.id === e.pointerId ? this.right : null;
      if (finger) finishTouch(finger, cancelled, e.clientX, e.clientY);
    };
    let reconcileFrame: number | null = null;
    const reconcileTouches = (event: TouchEvent) => {
      const fingers = [this.left, this.right].filter(
        (finger): finger is Finger => finger?.pointerType === "touch",
      );
      const noTouches = event.touches.length === 0;
      if (reconcileFrame !== null) window.cancelAnimationFrame(reconcileFrame);
      reconcileFrame = null;
      if (!fingers.length) return;
      // PointerEvents normally finish the gesture first. Wait until the next
      // frame so touchend/pointerup ordering cannot erase a valid tap or prime.
      reconcileFrame = window.requestAnimationFrame(() => {
        reconcileFrame = null;
        for (const finger of fingers) {
          // Object identity protects a new gesture, even if its ID is reused.
          if (finger !== this.left && finger !== this.right) continue;
          if (noTouches || !canvas.hasPointerCapture(finger.id))
            finishTouch(finger, true);
        }
      });
    };
    // Native touch identifiers and pointer IDs are unrelated. Use an empty
    // touch list or lost capture, never identifier equality, to find orphans.
    window.addEventListener("touchend", reconcileTouches, { passive: true });
    window.addEventListener("touchcancel", reconcileTouches, { passive: true });
    // Window catches mouse releases outside the canvas and captured touch releases.
    window.addEventListener("pointerup", (e) => release(e, false));
    window.addEventListener("pointercancel", (e) => release(e, true));
    canvas.addEventListener("lostpointercapture", (e) => release(e, true));
  }
  /** Explicit HUD pointer gestures work for the second thumb while the first
   * remains captured by the movement canvas. No synthesized click is required. */
  bindWeaponButton(button: HTMLButtonElement, weapon: WeaponId) {
    const eventWindow = window;
    const pointers = new Map<number, {
      x: number; y: number; moved: number; revision: number; type: string;
    }>();
    const previousTouchAction = button.style.touchAction;
    button.style.touchAction = "none";
    const available = () => this.enabled && !this.dead && !button.disabled && !button.hidden;
    const down = (event: PointerEvent) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      if (!available()) return;
      this.plasmaTap = null;
      pointers.set(event.pointerId, {
        x: event.clientX, y: event.clientY, moved: 0,
        revision: this.interactionRevision, type: event.pointerType,
      });
      try { button.setPointerCapture(event.pointerId); }
      catch { pointers.delete(event.pointerId); }
    };
    const move = (event: PointerEvent) => {
      const pointer = pointers.get(event.pointerId);
      if (pointer) pointer.moved = Math.max(pointer.moved,
        Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y));
    };
    const up = (event: PointerEvent) => {
      const pointer = pointers.get(event.pointerId);
      pointers.delete(event.pointerId);
      if (!pointer) return;
      event.preventDefault();
      event.stopPropagation();
      const rect = button.getBoundingClientRect();
      const moved = Math.max(pointer.moved,
        Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y));
      if (event.button === 0 && available() && pointer.revision === this.interactionRevision &&
        (pointer.type === "mouse" || moved <= 18) &&
        event.clientX >= rect.left && event.clientX <= rect.right &&
        event.clientY >= rect.top && event.clientY <= rect.bottom)
        this.switchTo = weapon;
    };
    const cancel = (event: PointerEvent) => pointers.delete(event.pointerId);
    const blur = () => pointers.clear();
    const click = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      // Pointer releases already selected once. Keyboard/assistive activation
      // has no pointer type and a zero click count, so it remains accessible.
      if (event.detail === 0 && !(event as PointerEvent).pointerType && available())
        this.switchTo = weapon;
    };
    const preventNativeGesture = (event: Event) => {
      if (available() && event.cancelable) event.preventDefault();
    };
    button.addEventListener("touchstart", preventNativeGesture, { passive: false });
    button.addEventListener("touchmove", preventNativeGesture, { passive: false });
    button.addEventListener("selectstart", preventNativeGesture);
    button.addEventListener("contextmenu", preventNativeGesture);
    button.addEventListener("pointerdown", down);
    button.addEventListener("pointermove", move);
    button.addEventListener("pointerup", up);
    button.addEventListener("pointercancel", cancel);
    button.addEventListener("lostpointercapture", cancel);
    button.addEventListener("click", click);
    eventWindow.addEventListener("blur", blur);
    return () => {
      pointers.clear();
      button.style.touchAction = previousTouchAction;
      button.removeEventListener("touchstart", preventNativeGesture);
      button.removeEventListener("touchmove", preventNativeGesture);
      button.removeEventListener("selectstart", preventNativeGesture);
      button.removeEventListener("contextmenu", preventNativeGesture);
      button.removeEventListener("pointerdown", down);
      button.removeEventListener("pointermove", move);
      button.removeEventListener("pointerup", up);
      button.removeEventListener("pointercancel", cancel);
      button.removeEventListener("lostpointercapture", cancel);
      button.removeEventListener("click", click);
      eventWindow.removeEventListener("blur", blur);
    };
  }
  private clearFiringIntent() {
    this.interactionRevision++;
    for (const code of this.controls.keys.fire) if (code && this.keys.has(code)) {
      this.blockedKeys.add(code);
      this.keys.delete(code);
    }
    const fireButton = this.controls.buttons.fire;
    if (typeof fireButton === "number" && this.padButtons[fireButton]) this.blockedPadButtons.add(fireButton);
    this.mouseFireHeld = false;
    this.touchFireId = null;
    this.plasmaTap = null;
    this.fire = false;
    this.switchTo = null;
    this.cycleDirection = 0;
    if (this.right) this.right.canTap = false;
  }
  private look(x: number, y: number) {
    this.yaw -= x * this.settings.sensitivity;
    this.pitch = Math.max(
      -1.5,
      Math.min(1.5, this.pitch - y * this.settings.sensitivity),
    );
  }
  lockMouse() {
    if (!this.canvas) return;
    if (matchMedia("(pointer:fine)").matches) {
      const result = this.canvas.requestPointerLock();
      result?.catch(() => {});
    }
  }
  clear() {
    this.clearFiringIntent();
    this.keys.clear();
    this.left = this.right = null;
    this.jump = this.fire = false;
    this.switchTo = null;
    this.padX = this.padY = 0;
    this.drawSticks();
  }
  private keyAction(code: string) {
    return CONTROL_ACTIONS.find((action) => this.controls.keys[action].includes(code));
  }
  private held(action: ControlAction) {
    return this.controls.keys[action].some((code) => code !== null && this.keys.has(code));
  }
  private triggerAction(action: ControlAction) {
    if (action === "pause") { this.onPause(); return; }
    if (action === "scores") { this.onScores(); return; }
    if (this.dead) {
      if (action === "jump" || action === "fire") this.onRespawn();
      return;
    }
    if (action === "jump") this.jump = true;
    if (action === "fire") this.fire = true;
    if (action === "previousWeapon") this.cycleDirection = -1;
    if (action === "nextWeapon") this.cycleDirection = 1;
    if (action.startsWith("weapon")) this.switchTo = this.slots[Number(action.slice(6)) - 1] ?? null;
  }
  pollPad(
    dt: number,
    weapon: WeaponId,
    owned: ReadonlySet<WeaponId> = new Set(WEAPON_ORDER),
  ) {
    const pad = readGamepad();
    this.padX = this.padY = 0;
    if (!pad) {
      this.padButtons = [];
      this.blockedPadButtons.clear();
      this.previousPadIndex = undefined;
    } else if (this.enabled) {
      if (this.previousPadIndex !== undefined && pad.index !== this.previousPadIndex) this.padButtons = [];
      this.previousPadIndex = pad.index;
      const rawAxis = (i: number) => Math.max(-1, Math.min(1, pad.axes[i] || 0));
      const axis = (i: number) => Math.abs(rawAxis(i)) > this.controls.deadzone ? rawAxis(i) : 0;
      if (this.waitForPadNeutral && Object.values(this.controls.axes).every((i) => axis(i) === 0)) this.waitForPadNeutral = false;
      if (!this.waitForPadNeutral) {
        this.padX = axis(this.controls.axes.moveX);
        this.padY = axis(this.controls.axes.moveY);
        this.look(axis(this.controls.axes.lookX) * dt * 2.8,
          axis(this.controls.axes.lookY) * dt * 2.8 * (this.controls.invertLookY ? -1 : 1));
      }
      pad.buttons.forEach((button, i) => {
        if (!button.pressed) this.blockedPadButtons.delete(i);
        const action = CONTROL_ACTIONS.find((candidate) => this.controls.buttons[candidate] === i);
        if (button.pressed && !this.blockedPadButtons.has(i)) {
          if (!this.padButtons[i] && action) this.triggerAction(action);
        }
        this.padButtons[i] = button.pressed;
      });
    }
    if (this.enabled && this.cycleDirection) {
      const available = WEAPON_ORDER.filter((id) => owned.has(id));
      if (available.length) this.switchTo = available[(available.indexOf(weapon) + this.cycleDirection + available.length) % available.length];
    }
    this.cycleDirection = 0;
  }
  consume() {
    let x =
      Number(this.held("right")) -
      Number(this.held("left")) +
      this.padX;
    let y =
      Number(this.held("backward")) -
      Number(this.held("forward")) +
      this.padY;
    if (this.left && this.left.moved > 1) {
      x += this.left.x - this.left.startX;
      y += this.left.y - this.left.startY;
    }
    const length = Math.hypot(x, y);
    if (length) {
      x /= length;
      y /= length;
    }
    const result = {
      x: x * Math.cos(this.yaw) + y * Math.sin(this.yaw),
      z: -x * Math.sin(this.yaw) + y * Math.cos(this.yaw),
      forwardX: -Math.sin(this.yaw),
      forwardZ: -Math.cos(this.yaw),
      jump: this.jump,
      fire: this.fire,
      fireHeld: this.enabled && !this.dead &&
        (this.mouseFireHeld || this.touchFireId !== null || (this.activeWeapon === "plasma" && this.held("fire"))),
      switchTo: this.switchTo,
    };
    this.jump = this.fire = false;
    this.switchTo = null;
    return result;
  }
  private drawSticks() {
    if (!this.canvas) return;
    for (const [id, finger] of [
      ["move-stick", this.left],
      ["aim-stick", this.right],
    ] as const) {
      const el = document.getElementById(id);
      if (!el) continue;
      el.style.display = finger ? "block" : "none";
      if (finger) {
        el.style.left = `${finger.startX}px`;
        el.style.top = `${finger.startY}px`;
        const dx = finger.x - finger.startX,
          dy = finger.y - finger.startY,
          scale = Math.min(1, 32 / Math.max(1, Math.hypot(dx, dy)));
        (el.firstElementChild as HTMLElement).style.transform =
          `translate(${dx * scale}px,${dy * scale}px)`;
      }
    }
  }
}
