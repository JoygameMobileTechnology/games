import test from "node:test";
import assert from "node:assert/strict";
import { PerspectiveCamera, Vector3 } from "three";
import { trackingMarker } from "../src/tracking.ts";

function camera(width = 844, height = 390) {
  const view = new PerspectiveCamera(90, width / height, 0.1, 200);
  view.updateMatrixWorld(true);
  return view;
}
const near = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`);

test("a front target projects at the reticle and elevated targets project above it", () => {
  const view = camera();
  const center = trackingMarker(view, new Vector3(0, 0, -10), 844, 390)!;
  assert.equal(center.offscreen, false);
  near(center.x, 422);
  near(center.y, 195);
  const high = trackingMarker(view, new Vector3(0, 2, -10), 844, 390)!;
  assert.equal(high.offscreen, false);
  near(high.y, 156);
});

test("offscreen targets clamp inside HUD margins with a directional bearing", () => {
  const view = camera();
  const right = trackingMarker(view, new Vector3(100, 0, -10), 844, 390)!;
  assert.equal(right.offscreen, true);
  near(right.x, 762);
  near(right.y, 195);
  near(right.angle, 0);
  const above = trackingMarker(view, new Vector3(0, 100, -10), 844, 390)!;
  near(above.x, 422);
  near(above.y, 118);
  near(above.angle, -90);
});

test("behind-camera targets retain the correct left/right turn direction", () => {
  const view = camera();
  for (const side of [-1, 1]) {
    const marker = trackingMarker(
      view,
      new Vector3(side * 4, 0, 10),
      844,
      390,
    )!;
    assert.equal(marker.offscreen, true);
    near(marker.x, side < 0 ? 82 : 762);
    near(marker.y, 195);
    near(Math.abs(marker.angle), side < 0 ? 180 : 0);
  }
});

test("exactly 180 degrees behind and the camera plane remain finite and stable", () => {
  const view = camera();
  const behind = trackingMarker(view, new Vector3(0, 0, 10), 844, 390)!;
  near(behind.x, 422);
  near(behind.y, 295);
  near(behind.angle, 90);
  for (const target of [
    new Vector3(1, 0, 0),
    new Vector3(0, 0, 0),
    new Vector3(1e-14, 0, 10),
  ]) {
    const marker = trackingMarker(view, target, 844, 390)!;
    assert.ok([marker.x, marker.y, marker.angle].every(Number.isFinite));
    assert.equal(marker.offscreen, true);
  }
});

test("camera position and yaw transform world-space targets correctly", () => {
  const view = camera();
  view.position.set(20, 3, 10);
  view.rotation.y = Math.PI / 2;
  view.updateMatrixWorld(true);
  const ahead = trackingMarker(view, new Vector3(10, 3, 10), 844, 390)!;
  assert.equal(ahead.offscreen, false);
  near(ahead.x, 422);
  near(ahead.y, 195);
  const rear = trackingMarker(view, new Vector3(30, 3, 10), 844, 390)!;
  assert.equal(rear.offscreen, true);
  near(rear.x, 422);
  near(rear.y, 295);
});

test("projection respects aspect ratio and scales safely to narrow viewports", () => {
  const wide = trackingMarker(camera(), new Vector3(2, 0, -10), 844, 390)!;
  const square = trackingMarker(
    camera(390, 390),
    new Vector3(2, 0, -10),
    390,
    390,
  )!;
  near(wide.x - 422, square.x - 195);
  const tiny = trackingMarker(
    camera(100, 80),
    new Vector3(100, 100, -1),
    100,
    80,
  )!;
  assert.ok(tiny.x >= 30 && tiny.x <= 70);
  assert.ok(tiny.y >= 30.4 && tiny.y <= 56);
  assert.equal(
    trackingMarker(camera(), new Vector3(NaN, 0, 0), 844, 390),
    null,
  );
  assert.equal(trackingMarker(camera(), new Vector3(), 0, 390), null);
});
