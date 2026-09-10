import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { bindUiViewport } from "../src/ui-viewport.ts";

// Real event listeners with a controlled animation frame queue; no private hooks.
function harness(t: TestContext, withVisualViewport = true) {
  const viewport = Object.assign(new EventTarget(), {
    width: 844,
    height: 390,
    offsetLeft: 0,
    offsetTop: 0,
  });
  let nextFrame = 0;
  const frames = new Map<number, FrameRequestCallback>();
  const cancelled: number[] = [];
  const host = Object.assign(new EventTarget(), {
    innerWidth: 1280,
    innerHeight: 720,
    visualViewport: withVisualViewport ? viewport : null,
    requestAnimationFrame(callback: FrameRequestCallback) {
      frames.set(++nextFrame, callback);
      return nextFrame;
    },
    cancelAnimationFrame(id: number) {
      cancelled.push(id);
      frames.delete(id);
    },
  });
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, value: host });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, "window", previous);
    else Reflect.deleteProperty(globalThis, "window");
  });
  const properties = new Map<string, string>();
  const classes = new Set<string>();
  let writes = 0;
  const root = {
    style: {
      setProperty(name: string, value: string) {
        properties.set(name, value);
        writes++;
      },
    },
    classList: {
      toggle(name: string, enabled: boolean) {
        if (enabled) classes.add(name);
        else classes.delete(name);
      },
    },
  } as unknown as HTMLElement;
  const dispose = bindUiViewport(root);
  t.after(dispose);
  return {
    host, viewport, frames, cancelled, properties, classes, dispose,
    writes: () => writes,
    flush() {
      const callbacks = [...frames.values()];
      frames.clear();
      callbacks.forEach((callback) => callback(0));
    },
  };
}

test("initial layout falls back without VisualViewport and window resizes use the latest dimensions once", (t) => {
  const h = harness(t, false);
  assert.equal(h.properties.get("--ui-width"), "1280px");
  assert.equal(h.properties.get("--ui-height"), "720px");
  assert.equal(h.properties.get("--ui-left"), "0px");
  assert.equal(h.properties.get("--ui-top"), "0px");
  assert.equal(h.classes.size, 0);
  assert.equal(h.frames.size, 0, "initial sizing is synchronous");
  h.host.innerWidth = 667;
  h.host.innerHeight = 375;
  h.host.dispatchEvent(new Event("resize"));
  h.host.innerWidth = 568;
  h.host.innerHeight = 320;
  h.host.dispatchEvent(new Event("resize"));
  assert.equal(h.frames.size, 1);
  assert.equal(h.writes(), 4);
  h.flush();
  assert.equal(h.properties.get("--ui-width"), "568px");
  assert.equal(h.properties.get("--ui-height"), "320px");
  assert.equal(h.classes.has("compact-ui"), true);
  assert.equal(h.classes.has("narrow-ui"), false);
  assert.equal(h.writes(), 8);
});

test("visual viewport keyboard resizing and scrolling preserve fractional size and nonzero origin", (t) => {
  const h = harness(t);
  assert.equal(h.properties.get("--ui-width"), "844px");
  assert.equal(h.classes.has("compact-ui"), true);
  Object.assign(h.viewport, { width: 390.5, height: 181.25, offsetLeft: 4.75, offsetTop: 83.5 });
  h.viewport.dispatchEvent(new Event("resize"));
  h.viewport.dispatchEvent(new Event("scroll"));
  h.host.dispatchEvent(new Event("resize"));
  assert.equal(h.frames.size, 1, "all viewport surfaces share one frame");
  h.flush();
  assert.equal(h.properties.get("--ui-width"), "390.5px");
  assert.equal(h.properties.get("--ui-height"), "181.25px");
  assert.equal(h.properties.get("--ui-left"), "4.75px");
  assert.equal(h.properties.get("--ui-top"), "83.5px");
  assert.equal(h.classes.has("narrow-ui"), true);
  h.viewport.offsetTop = 106.25;
  h.viewport.dispatchEvent(new Event("scroll"));
  h.flush();
  assert.equal(h.properties.get("--ui-top"), "106.25px");
  // Portrait menus need narrow controls even on larger phones; landscape may not.
  Object.assign(h.viewport, { width: 600, height: 800 });
  h.viewport.dispatchEvent(new Event("resize"));
  h.flush();
  assert.equal(h.classes.has("narrow-ui"), true);
  Object.assign(h.viewport, { width: 1200, height: 800 });
  h.viewport.dispatchEvent(new Event("resize"));
  h.flush();
  assert.equal(h.classes.size, 0, "returning to desktop clears compact classes");
});

test("invalid viewport readings cannot produce invalid CSS or zero-size UI", (t) => {
  const h = harness(t);
  Object.assign(h.viewport, { width: NaN, height: 0, offsetLeft: -4, offsetTop: Infinity });
  h.viewport.dispatchEvent(new Event("resize"));
  h.flush();
  assert.equal(h.properties.get("--ui-width"), "1280px");
  assert.equal(h.properties.get("--ui-height"), "720px");
  assert.equal(h.properties.get("--ui-left"), "0px");
  assert.equal(h.properties.get("--ui-top"), "0px");
  Object.assign(h.host, { innerWidth: -1, innerHeight: NaN });
  Object.assign(h.viewport, { width: Infinity, height: -10, offsetLeft: NaN });
  h.host.dispatchEvent(new Event("resize"));
  h.flush();
  assert.equal(h.properties.get("--ui-width"), "1px");
  assert.equal(h.properties.get("--ui-height"), "1px");
  assert.equal(h.properties.get("--ui-left"), "0px");
});

test("disposal cancels scheduled layout work and stops all viewport event sources", (t) => {
  const h = harness(t);
  h.viewport.dispatchEvent(new Event("scroll"));
  assert.equal(h.frames.size, 1);
  const scheduled = [...h.frames.values()][0];
  h.dispose();
  h.dispose();
  assert.equal(h.cancelled.length, 1);
  assert.equal(h.frames.size, 0);
  Object.assign(h.viewport, { width: 300, offsetTop: 200 });
  h.host.dispatchEvent(new Event("resize"));
  h.viewport.dispatchEvent(new Event("resize"));
  h.viewport.dispatchEvent(new Event("scroll"));
  assert.equal(h.frames.size, 0);
  scheduled(0); // A callback already in flight must also leave disposed UI alone.
  assert.equal(h.writes(), 4);
  assert.equal(h.properties.get("--ui-width"), "844px");
});
