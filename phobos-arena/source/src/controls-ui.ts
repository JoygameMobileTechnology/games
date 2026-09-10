import {
  AXIS_ACTIONS, CONTROL_ACTIONS, CONTROL_LABELS, PAD_ACTIONS, assignControlKey, assignPadButton,
  controlKeyLabel, defaultControls, keyConflict, normalizeControls, padButtonLabel, readGamepad, validControlKey,
  type AxisAction, type ControlAction, type ControlsBindings,
} from "./controls-bindings";
import "./controls.css";

/** A settings section with local persistence supplied by the owning profile UI.
 * Capture listeners are removed when the panel is closed, including mid-capture. */
export function mountControlsUI(
  container: HTMLElement,
  initial: unknown,
  onChange: (bindings: ControlsBindings) => boolean,
) {
  let bindings = normalizeControls(initial);
  let capture: { action: ControlAction; slot: 0 | 1; pad: boolean; released: boolean } | null = null;
  let pending: (() => void) | null = null;
  let disposed = false;
  let suppressContextMenu = false;
  let frame = 0;
  const axisLabels: Record<AxisAction, string> = {
    moveX: "Move horizontal", moveY: "Move vertical", lookX: "Look horizontal", lookY: "Look vertical",
  };
  container.innerHTML = `<section class="bindings-console" aria-label="Input bindings">
    <div class="bindings-heading"><h3>KEYBOARD, MOUSE & CONTROLLER</h3><button type="button" data-bind-reset>RESET BINDINGS</button></div>
    <p class="setting-note">Select a binding to change it. Conflicts can swap places. Escape always pauses the game and cancels capture. Number shortcuts stop at 5; each map keeps the same five slots. Touch controls stay unchanged.</p>
    <div class="bindings-feedback" role="status" aria-live="polite"><span data-bind-message>Bindings save on this browser.</span><button type="button" data-bind-swap hidden>SWAP BINDINGS</button><button type="button" data-bind-cancel hidden>CANCEL</button></div>
    <details open><summary>KEYBOARD / MOUSE <small>PRIMARY + ALTERNATE</small></summary>
      <div class="bindings-grid">${CONTROL_ACTIONS.map((action) => `<div class="binding-row"><span>${CONTROL_LABELS[action]}</span><div class="binding-pair">${([0, 1] as const).map((slot) => `<span class="binding-cell"><button type="button" data-key-action="${action}" data-key-slot="${slot}" aria-label="${CONTROL_LABELS[action]} ${slot ? "alternate" : "primary"} binding"></button><button type="button" class="binding-clear" data-key-clear="${action}" data-key-slot="${slot}" aria-label="Clear ${CONTROL_LABELS[action]} ${slot ? "alternate" : "primary"}">×</button></span>`).join("")}</div></div>`).join("")}</div>
    </details>
    <details><summary>CONTROLLER <small>BUTTONS & STICKS</small></summary>
      <p class="setting-note" data-pad-status>Connect a controller and press a button to detect it.</p>
      <p class="setting-note">Select a button binding, release all buttons, then press the desired controller button. Controller fire uses a fresh press for every shot. Button names follow the standard browser controller layout; other controllers can use the numbered inputs.</p>
      <div class="bindings-grid">${PAD_ACTIONS.map((action) => `<div class="binding-row"><span>${CONTROL_LABELS[action]}</span><span class="binding-cell"><button type="button" data-pad-action="${action}" aria-label="Controller ${CONTROL_LABELS[action]} binding"></button><button type="button" class="binding-clear" data-pad-clear="${action}" aria-label="Clear controller ${CONTROL_LABELS[action]}">×</button></span></div>`).join("")}</div>
      <div class="bindings-axes">${AXIS_ACTIONS.map((action) => `<label>${axisLabels[action]}<select data-pad-axis="${action}" aria-label="Controller ${axisLabels[action]}">${Array.from({ length: 8 }, (_, i) => `<option value="${i}">Axis ${i}${i < 4 ? ` · ${["Left X", "Left Y", "Right X", "Right Y"][i]}` : ""}</option>`).join("")}</select></label>`).join("")}
      <label>Stick dead zone<select data-pad-deadzone aria-label="Controller dead zone">${[0.05, 0.1, 0.16, 0.2, 0.25, 0.3, 0.4].map((value) => `<option value="${value}">${Math.round(value * 100)}%</option>`).join("")}</select></label>
      <label class="binding-invert">Invert vertical look<input type="checkbox" data-pad-invert/></label></div>
      <p class="setting-note">Choosing an occupied axis swaps those axes. Defaults use the left stick to move and the right stick to look. Return both sticks to center after changing bindings.</p>
    </details>
  </section>`;
  const get = <T extends Element>(selector: string) => container.querySelector<T>(selector)!;
  const message = get<HTMLElement>("[data-bind-message]");
  const cancel = get<HTMLButtonElement>("[data-bind-cancel]");
  const swap = get<HTMLButtonElement>("[data-bind-swap]");
  const status = get<HTMLElement>("[data-pad-status]");
  const feedback = (text: string) => {
    message.textContent = text;
    cancel.hidden = !capture && !pending;
    swap.hidden = !pending;
    if (pending) swap.focus();
    container.querySelectorAll<HTMLElement>("[data-key-action], [data-pad-action]").forEach((button) => {
      const active = capture && (capture.pad ? button.dataset.padAction === capture.action
        : button.dataset.keyAction === capture.action && Number(button.dataset.keySlot) === capture.slot);
      button.classList.toggle("binding-capturing", !!active);
    });
  };
  const refresh = () => {
    container.querySelectorAll<HTMLButtonElement>("[data-key-action]").forEach((button) => {
      button.textContent = controlKeyLabel(bindings.keys[button.dataset.keyAction as ControlAction][Number(button.dataset.keySlot)]);
    });
    container.querySelectorAll<HTMLButtonElement>("[data-pad-action]").forEach((button) => {
      button.textContent = padButtonLabel(bindings.buttons[button.dataset.padAction as ControlAction]);
    });
    container.querySelectorAll<HTMLSelectElement>("[data-pad-axis]").forEach((select) => {
      select.value = String(bindings.axes[select.dataset.padAxis as AxisAction]);
    });
    const deadzone = get<HTMLSelectElement>("[data-pad-deadzone]");
    if (![...deadzone.options].some((option) => Number(option.value) === bindings.deadzone)) {
      const option = document.createElement("option"); option.value = String(bindings.deadzone);
      option.textContent = `${Math.round(bindings.deadzone * 100)}%`; deadzone.append(option);
    }
    deadzone.value = String(bindings.deadzone);
    get<HTMLInputElement>("[data-pad-invert]").checked = bindings.invertLookY;
  };
  const apply = (next: ControlsBindings) => {
    capture = null; pending = null;
    if (onChange(next)) {
      bindings = normalizeControls(next); refresh();
      feedback("Bindings saved. Release held keys and center both sticks before resuming.");
    } else { refresh(); feedback("Could not save bindings. Free browser storage and try again."); }
  };
  const stopCapture = () => { capture = null; pending = null; feedback("Binding change cancelled."); };
  const selectKey = (key: string) => {
    if (!capture || capture.pad) return;
    if (!validControlKey(key)) {
      feedback("Choose a letter, 1–5, arrow, Space, Tab, Shift, Ctrl, Caps Lock or a mouse button. Escape cancels."); return;
    }
    const { action, slot } = capture;
    const conflict = keyConflict(bindings, action, slot, key);
    capture = null;
    if (conflict) {
      pending = () => apply(assignControlKey(bindings, action, slot, key));
      feedback(`${controlKeyLabel(key)} is assigned to ${CONTROL_LABELS[conflict.action]}. Swap it with ${CONTROL_LABELS[action]}?`);
    } else apply(assignControlKey(bindings, action, slot, key));
  };
  const keydown = (event: KeyboardEvent) => {
    if (!capture && !pending) return;
    if (event.code === "Escape") {
      event.preventDefault(); event.stopImmediatePropagation(); stopCapture(); return;
    }
    // The conflict buttons retain ordinary Tab/Enter keyboard navigation.
    if (!capture) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (!event.repeat && !event.altKey && !event.metaKey) selectKey(event.code);
  };
  const pointerdown = (event: PointerEvent) => {
    if (!capture || capture.pad || event.pointerType !== "mouse") return;
    // Controls must remain clickable while capture is open, especially Cancel.
    if (event.target instanceof Element && event.target.closest("button, input, select, a, summary")) return;
    suppressContextMenu = event.button === 2;
    event.preventDefault(); event.stopImmediatePropagation(); selectKey(`Mouse${event.button}`);
  };
  const contextmenu = (event: MouseEvent) => {
    if (capture || suppressContextMenu) event.preventDefault();
    suppressContextMenu = false;
  };
  const click = (event: MouseEvent) => {
    const button = (event.target as Element).closest<HTMLButtonElement>("button");
    if (!button || !container.contains(button)) return;
    if (button.hasAttribute("data-bind-cancel")) { stopCapture(); return; }
    if (button.hasAttribute("data-bind-swap")) { pending?.(); return; }
    if (button.hasAttribute("data-bind-reset")) { apply(defaultControls()); return; }
    if (button.dataset.keyClear) { apply(assignControlKey(bindings, button.dataset.keyClear as ControlAction, Number(button.dataset.keySlot) as 0 | 1, null)); return; }
    if (button.dataset.padClear) { apply(assignPadButton(bindings, button.dataset.padClear as ControlAction, null)); return; }
    if (button.dataset.keyAction || button.dataset.padAction) {
      pending = null;
      capture = { action: (button.dataset.keyAction ?? button.dataset.padAction) as ControlAction, slot: Number(button.dataset.keySlot || 0) as 0 | 1, pad: !!button.dataset.padAction, released: false };
      feedback(capture.pad ? `Release all controller buttons, then press one for ${CONTROL_LABELS[capture.action]}. Escape cancels.`
        : `Press a key or click a blank area with the desired mouse button for ${CONTROL_LABELS[capture.action]}. Escape cancels.`);
    }
  };
  const change = (event: Event) => {
    const target = event.target as HTMLInputElement;
    const next = normalizeControls(bindings);
    if (target.dataset.padAxis) {
      const action = target.dataset.padAxis as AxisAction, axis = Number(target.value);
      const other = AXIS_ACTIONS.find((candidate) => candidate !== action && next.axes[candidate] === axis);
      if (other) next.axes[other] = next.axes[action];
      next.axes[action] = axis;
    } else if (target.hasAttribute("data-pad-deadzone")) next.deadzone = Number(target.value);
    else if (target.hasAttribute("data-pad-invert")) next.invertLookY = target.checked;
    else return;
    apply(next);
  };
  const blur = () => { if (capture || pending) stopCapture(); };
  const poll = () => {
    if (disposed) return;
    const pad = readGamepad();
    const description = pad ? `Connected: ${pad.id}. ${pad.axes.length} axes · ${pad.buttons.length} buttons.`
      : "Connect a controller and press a button to detect it. On browsers that restrict controller access on local HTTP, use keyboard or touch.";
    if (status.textContent !== description) status.textContent = description;
    if (capture?.pad && pad) {
      const button = pad.buttons.findIndex((value) => value.pressed);
      if (button === -1) capture.released = true;
      else if (capture.released && button <= 31) {
        const action = capture.action;
        const conflict = PAD_ACTIONS.find((candidate) => candidate !== action && bindings.buttons[candidate] === button);
        capture = null;
        if (conflict) {
          pending = () => apply(assignPadButton(bindings, action, button));
          feedback(`${padButtonLabel(button)} is assigned to ${CONTROL_LABELS[conflict]}. Swap it with ${CONTROL_LABELS[action]}?`);
        } else apply(assignPadButton(bindings, action, button));
      }
    }
    frame = window.requestAnimationFrame(poll);
  };
  container.addEventListener("click", click);
  container.addEventListener("change", change);
  window.addEventListener("keydown", keydown, true);
  window.addEventListener("pointerdown", pointerdown, true);
  window.addEventListener("contextmenu", contextmenu);
  window.addEventListener("blur", blur);
  refresh(); poll();
  return () => {
    disposed = true; capture = null; pending = null; window.cancelAnimationFrame(frame);
    container.removeEventListener("click", click); container.removeEventListener("change", change);
    window.removeEventListener("keydown", keydown, true); window.removeEventListener("pointerdown", pointerdown, true);
    window.removeEventListener("contextmenu", contextmenu); window.removeEventListener("blur", blur);
  };
}
