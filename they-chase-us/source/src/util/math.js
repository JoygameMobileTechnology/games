export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
export const remap = (v, a, b, c, d) => lerp(c, d, clamp01(invLerp(a, b, v)));
// frame-rate independent exponential smoothing
export const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
export const easeOutQuad = (t) => 1 - (1 - t) * (1 - t);
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeInQuad = (t) => t * t;
export const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
export const easeOutBack = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
export const dist2 = (ax, az, bx, bz) => { const dx = ax - bx, dz = az - bz; return dx * dx + dz * dz; };
export const dist = (ax, az, bx, bz) => Math.sqrt(dist2(ax, az, bx, bz));
export const sign = (v) => (v < 0 ? -1 : v > 0 ? 1 : 0);
export const moveToward = (v, target, maxDelta) => (Math.abs(target - v) <= maxDelta ? target : v + sign(target - v) * maxDelta);
export const fmt = (n) => Math.round(n).toLocaleString('en-US');
export const TAU = Math.PI * 2;

// Simple uniform spatial grid for XZ neighbor queries.
export class Grid {
  constructor(cell = 3) { this.cell = cell; this.map = new Map(); }
  clear() { this.map.clear(); }
  key(x, z) { return ((Math.floor(x / this.cell) + 4096) << 14) | ((Math.floor(z / this.cell) + 8192) & 0x3fff); }
  insert(item, x, z) {
    const k = this.key(x, z);
    let a = this.map.get(k);
    if (!a) { a = []; this.map.set(k, a); }
    a.push(item);
  }
  // visit all items in cells overlapping the circle (x,z,r)
  query(x, z, r, fn) {
    const c = this.cell;
    const x0 = Math.floor((x - r) / c), x1 = Math.floor((x + r) / c);
    const z0 = Math.floor((z - r) / c), z1 = Math.floor((z + r) / c);
    for (let i = x0; i <= x1; i++) {
      for (let j = z0; j <= z1; j++) {
        const a = this.map.get(((i + 4096) << 14) | ((j + 8192) & 0x3fff));
        if (a) for (let k = 0; k < a.length; k++) fn(a[k]);
      }
    }
  }
}
