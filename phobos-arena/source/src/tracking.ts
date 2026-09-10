import type { PerspectiveCamera, Vector3 } from "three";

export interface TrackingMarker {
  x: number;
  y: number;
  offscreen: boolean;
  angle: number;
}

/** Project a world target into HUD space without a visibility/occlusion test. */
export function trackingMarker(
  camera: PerspectiveCamera,
  position: Pick<Vector3, "x" | "y" | "z">,
  width: number,
  height: number,
  inset = { left: 82, right: 82, top: 118, bottom: 95 },
): TrackingMarker | null {
  if (
    ![width, height, position.x, position.y, position.z].every(
      Number.isFinite,
    ) ||
    width <= 0 ||
    height <= 0
  )
    return null;
  const e = camera.matrixWorldInverse.elements;
  const vx = e[0] * position.x + e[4] * position.y + e[8] * position.z + e[12];
  const vy = e[1] * position.x + e[5] * position.y + e[9] * position.z + e[13];
  const vz = e[2] * position.x + e[6] * position.y + e[10] * position.z + e[14];
  const p = camera.projectionMatrix.elements;
  const centerX = width / 2;
  const centerY = height / 2;
  // Absolute depth keeps targets behind the camera on the correct turn side.
  const depth = Math.max(Math.abs(vz), 1e-6);
  let dx = (vx * p[0] * centerX) / depth;
  let dy = (-vy * p[5] * centerY) / depth;
  if (![dx, dy, vz].every(Number.isFinite)) return null;
  const left = Math.min(inset.left, width * 0.3);
  const right = width - Math.min(inset.right, width * 0.3);
  const top = Math.min(inset.top, height * 0.38);
  const bottom = height - Math.min(inset.bottom, height * 0.3);
  const x = centerX + dx;
  const y = centerY + dy;
  if (vz < 0 && x >= left && x <= right && y >= top && y <= bottom) {
    return { x, y, offscreen: false, angle: 0 };
  }
  // Directly behind has no unique left/right bearing. A stable bottom arrow
  // means turn around and avoids division by zero or floating-point jitter.
  if (Math.hypot(dx, dy) < 1e-5) {
    dx = 0;
    dy = 1;
  }
  const scaleX =
    dx > 0 ? (right - centerX) / dx : dx < 0 ? (left - centerX) / dx : Infinity;
  const scaleY =
    dy > 0 ? (bottom - centerY) / dy : dy < 0 ? (top - centerY) / dy : Infinity;
  const scale = Math.min(scaleX, scaleY);
  return {
    x: centerX + dx * scale,
    y: centerY + dy * scale,
    offscreen: true,
    angle: (Math.atan2(dy, dx) * 180) / Math.PI,
  };
}
