// Designs the first five levels: small structures built to show off the crew's parkour — towers far enough apart to
// leap between, staircases of pillars to hop up and down, walls to run along — rather than solid blocks.
// Writes them into levels/catalog.json as levels 1–5; run `npm run build:levels` afterwards to embed them.
const fs = require('node:fs');
const path = require('node:path');
const file = path.resolve(__dirname, '../levels/catalog.json');
const catalog = JSON.parse(fs.readFileSync(file, 'utf8'));

// Catalog palette indices.
const RED = 0, BROWN = 3, ORANGE = 4, YELLOW = 5, LIME = 6, GREEN = 7, TEAL = 9, CYAN = 10, BLUE = 11, NAVY = 12, LILAC = 13, PURPLE = 14, PINK = 15, CREAM = 17, GRAY = 18, SALMON = 20;

// The camera looks from +x/+z, and the trucks park on the +z side, so tall parts go at the back (low z) and low parts
// in front: every jump stays in view.
function level(W, H, D, draw) {
  const cells = new Array(W * H * D).fill(-1);
  const put = (x, y, z, c) => { if (x >= 0 && x < W && y >= 0 && y < H && z >= 0 && z < D) cells[x + z * W + y * W * D] = c; };
  const box = (x0, x1, z0, z1, y0, y1, c) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) put(x, y, z, typeof c === 'function' ? c(x, y, z) : c); };
  draw(box, put);
  return { gridSize: { x: W, y: H, z: D }, cells };
}

const designs = [
  {
    name: 'İkiz Kuleler',
    // Two towers three cells apart: the crew wall-runs up one and leaps across to the other. A stepping-stone pillar
    // in the gap and a low terrace in front give short hops on the way up.
    ...level(11, 6, 9, box => {
      const tower = (x0, mid, low) => box(x0, x0 + 2, 1, 3, 0, 5, (x, y) => y >= 4 ? YELLOW : y >= 2 ? mid : low);
      tower(1, BLUE, RED); tower(7, RED, BLUE);
      box(5, 5, 2, 2, 0, 2, YELLOW);
      box(1, 9, 6, 7, 0, 1, GREEN);
    }),
    columns: 2,
  },
  {
    name: 'Merdiven',
    // Pillars climbing in a loop: up the front row one step at a time, across to the back row and on up to the top.
    ...level(11, 7, 6, box => {
      const band = (x, y) => y >= 6 ? PURPLE : y >= 4 ? PINK : y >= 2 ? TEAL : ORANGE;
      [1, 2, 3, 4].forEach((h, i) => box(i * 3, i * 3 + 1, 4, 5, 0, h - 1, band));
      [7, 6, 5, 4].forEach((h, i) => box(i * 3, i * 3 + 1, 0, 1, 0, h - 1, band));
    }),
    columns: 2,
  },
  {
    name: 'Kale',
    // Four corner towers joined by low walls with a gate in each. The crew runs the walls, wall-runs the towers and
    // leaps from tower to tower across the courtyard.
    ...level(11, 7, 11, box => {
      const mids = [[RED, BLUE], [BLUE, RED]];
      for (const [i, x0] of [0, 8].entries()) for (const [j, z0] of [0, 8].entries())
        box(x0, x0 + 2, z0, z0 + 2, 0, 6, (x, y) => y >= 5 ? YELLOW : y >= 2 ? mids[i][j] : BROWN);
      const wall = (x0, x1, z0, z1) => box(x0, x1, z0, z1, 0, 2, (x, y, z) => y === 0 && (x === 5 || z === 5) ? -1 : CREAM);
      wall(3, 7, 1, 1); wall(3, 7, 9, 9); wall(1, 1, 3, 7); wall(9, 9, 3, 7);
    }),
    columns: 3,
  },
  {
    name: 'Sütun Ormanı',
    // A three-by-three grove of pillars of different heights, two cells apart: nothing but jumps from pillar to pillar.
    ...level(10, 8, 10, box => {
      const heights = [[7, 8, 6], [5, 6, 4], [2, 4, 3]];   // back row first
      const band = (x, y) => y >= 6 ? LILAC : y >= 4 ? LIME : y >= 2 ? CYAN : SALMON;
      heights.forEach((row, r) => row.forEach((h, c) => box(c * 4, c * 4 + 1, r * 4, r * 4 + 1, 0, h - 1, band)));
    }),
    columns: 3,
  },
  {
    name: 'Köprü',
    // Two tall towers joined high up by a narrow bridge on a single pier. Each tower has a pair of stepping pillars in
    // front, three and six high: wall-running eight storeys costs more than hopping up the steps, so the crew leaps
    // its way up, runs the bridge, and leaps tower to tower once the bridge is gone.
    ...level(13, 8, 7, box => {
      const tower = x0 => box(x0, x0 + 2, 1, 3, 0, 7, (x, y) => y >= 6 ? ORANGE : y >= 3 ? NAVY : CREAM);
      tower(0); tower(10);
      box(3, 9, 2, 2, 4, 5, RED);
      box(6, 6, 2, 2, 0, 3, GREEN);
      const steps = (tall, low) => { box(tall, tall + 1, 5, 6, 0, 5, (x, y) => y >= 3 ? TEAL : GREEN); box(low, low + 1, 5, 6, 0, 2, GREEN); };
      steps(0, 3); steps(11, 8);
      box(6, 6, 5, 5, 0, 1, GREEN);
    }),
    columns: 3,
  },
];

// Deal the crates by dry-running the level the way the game deals unknown levels: always a colour that has uncovered
// cubes, taking the topmost first, so playing the columns in order clears the structure.
function deal({ gridSize: { x: W, z: D }, cells }, columns, seed) {
  let s = seed;
  const rand = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const live = new Map();
  cells.forEach((c, i) => { if (c >= 0) live.set(`${i % W},${Math.floor(i / (W * D))},${Math.floor(i / W) % D}`, { x: i % W, y: Math.floor(i / (W * D)), z: Math.floor(i / W) % D, c }); });
  const open = b => !live.has(`${b.x},${b.y + 1},${b.z}`);
  const seq = []; let last = -1;
  while (live.size) {
    const n = new Map(); for (const b of live.values()) if (open(b)) n.set(b.c, (n.get(b.c) || 0) + 1);
    let c = -1, alt = -1;
    for (const [k, v] of n) { if (c < 0 || v > n.get(c)) c = k; if (v >= 4 && k !== last && (alt < 0 || v > n.get(alt))) alt = k; }
    if (alt >= 0) c = alt;
    // A colour that is nearly used up goes in one crate rather than leaving a one- or two-cube truck behind.
    let left = 0; for (const b of live.values()) if (b.c === c) left++;
    const want = left <= 24 ? left : 10 + Math.floor(rand() * 9); let got = 0;
    while (got < want) {
      let best = null; for (const b of live.values()) if (b.c === c && open(b) && (!best || b.y > best.y)) best = b;
      if (!best) break; live.delete(`${best.x},${best.y},${best.z}`); got++;
    }
    const prev = seq[seq.length - 1];
    if (prev && prev.color === c && prev.count + got <= 24) prev.count += got; else seq.push({ color: c, count: got });
    last = c;
  }
  const out = Array.from({ length: columns }, () => []);
  seq.forEach((p, i) => out[i % columns].push({ color: p.color, count: p.count, mechanics: [], direction: 0, iceCount: 5 }));
  return out;
}

designs.forEach((d, i) => {
  const old = catalog.levels[i];
  catalog.levels[i] = { ...old, name: d.name, difficulty: 0, gridSize: d.gridSize, cells: d.cells, columns: deal(d, d.columns, 7 + i * 31) };
  const n = d.cells.filter(c => c >= 0).length;
  console.log(`${i + 1}. ${d.name}: ${d.gridSize.x}×${d.gridSize.y}×${d.gridSize.z}, ${n} cubes, ${catalog.levels[i].columns.map(c => c.length).join('+')} crates`);
});
// The catalog keeps camera angles written as floats (-30.0); keep it that way so only levels 1–5 change.
fs.writeFileSync(file, JSON.stringify(catalog).replace(/"cameraAngle":(-?\d+)([,}])/g, '"cameraAngle":$1.0$2') + '\n');
