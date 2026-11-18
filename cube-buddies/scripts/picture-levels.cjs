// Picture levels: a pixel-art picture laid flat on the plaza and built from real cubes. Seen from the camera it reads
// as a 2D picture (rows run away from the camera, the last row is nearest the trucks), but every cell is a column of
// cubes with its own height, so the crew still has walls to run up and steps to hop.
// Writes the pictures to the front of levels/catalog.json; run `npm run build:levels` afterwards to embed them.
const fs = require('node:fs');
const path = require('node:path');
const file = path.resolve(__dirname, '../levels/catalog.json');

// Catalog palette indices.
const RED = 0, BROWN = 2, ORANGE = 4, YELLOW = 5, GREEN = 7, DEEP_GREEN = 8, PURPLE = 14, CREAM = 17;

const pictures = [
  {
    name: 'Ejder Hazinesi',
    // A little dragon sitting on its hoard. `art` is the picture as seen from above; `relief` is how many cubes each
    // cell is stacked. The head and belly stand proud, the wing and the outline sit lower, the gold is a low rim.
    legend: { P: PURPLE, G: DEEP_GREEN, L: GREEN, B: BROWN, C: CREAM, Y: YELLOW, O: ORANGE, R: RED },
    art: [
      '......PP...PP.....YY.',
      'YY...PCCP.PCCP....YO.',
      'YO...PCCPPPCCPP......',
      '....PGGGGGGGGGGP.....',
      '...PGGGGGGGGGGGGP....',
      '...PGGGGGGGCRGGGPPP..',
      '...PGGGGGGGRRGGGGGGP.',
      '...PGGGGGGGGGGGGGBGGP',
      '...PGGGGGGGGGGGGGGGGP',
      '...PGGGGGGGGBBBBBBBBP',
      '...PPGGGGGGGGGGGGGGP.',
      '....PPGGGGGGGPPPPPP..',
      '..PP.PGGGGGGCCP......',
      '.PLLPPGGGGGCCCCP...YY',
      'PLLLLPGGGGCCCCCCP..OY',
      'PLLLLLGGGGCCCCCCCP...',
      'PLLLLLGGGGCCCCCCCCP..',
      '.PLLLGGGGPPPPCCCCCP..',
      '.PLLGGGGGGGGGPCCCCP..',
      '..PGGGGGGPPPCCCCCCP..',
      '..PGGGGGGGCCCCCCCCP..',
      '.PPGGGGGGGGCCCCCCGP..',
      'PGGPGGGGGBGGCCCCGGPP.',
      'PGGGPGGGGBGGGGGGBGGGP',
      'YPGGGPGGGCCBGGGBCCGGP',
      'YYPPPPPPPPPPYYYPPPPPY',
      'OYYYYRYYYYYYYYYYYRYYO',
      'OOYYYYYYOYYRYYYYYYYOO',
      '.OOOYYYOOOYYYYOOOYOO.',
    ],
    relief: [
      '......22...22.....32.',
      '23...2442.2442....23.',
      '32...2332223322......',
      '....122222222221.....',
      '...12333333333221....',
      '...1233333333322111..',
      '...12333333333222221.',
      '...123333333332222221',
      '...123333333332222221',
      '...122222222222222221',
      '...11222222222222221.',
      '....112222222111111..',
      '..11.1222222321......',
      '.122112222233321...32',
      '12222122223333321..23',
      '122222222233333321...',
      '1222222222333333321..',
      '.122222221111333321..',
      '.122222233333133321..',
      '..12222221113333321..',
      '..12222222333333321..',
      '.112222222233333321..',
      '12212222212233332211.',
      '122212222122222212221',
      '212221222221222122221',
      '221111111111222111112',
      '222223222222222223222',
      '222222222223222222222',
      '.1111111111111111111.',
    ],
    // What is under the picture's top cubes. The dragon sits on its hoard, so its seat and feet rest on gold; the belly
    // plates, wing, horns and the lines of the face lie on the green body. Taking the picture apart uncovers those.
    under(x, y, z, h, top) {
      if (y === h - 1 || top === PURPLE) return top;
      if (top === YELLOW || top === ORANGE || (top === RED && z > 11)) return YELLOW;
      if (z >= 21 && y === 0) return YELLOW;
      if (top === DEEP_GREEN) return top;
      return y === 0 || top !== CREAM ? DEEP_GREEN : top;
    },
    columns: 4,
  },
];

// A first guess at the relief, printed by `node scripts/picture-levels.cjs --relief` to be pasted in and tuned by hand:
// each colour has a base height, and cells deeper inside the silhouette stand a little taller.
function guessRelief(p) {
  const W = p.art[0].length, D = p.art.length, at = (x, z) => x < 0 || z < 0 || x >= W || z >= D ? '.' : p.art[z][x];
  const depth = p.art.map(r => [...r].map(c => c === '.' ? 0 : 9));
  for (let pass = 0; pass < 9; pass++) for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) if (depth[z][x]) {
    let m = 9; for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) m = Math.min(m, at(x + dx, z + dz) === '.' ? 0 : depth[z + dz][x + dx]);
    depth[z][x] = Math.min(depth[z][x], m + 1);
  }
  const base = { P: 1, G: 2, L: 2, B: 2, C: 2, Y: 1, O: 1, R: 2 };
  return p.art.map((r, z) => [...r].map((c, x) => c === '.' ? '.' : String(Math.min(6, base[c] + Math.min(1, depth[z][x] - 1)))).join(''));
}

function build(p) {
  const W = p.art[0].length, D = p.art.length, relief = p.relief || guessRelief(p);
  if (p.art.some(r => r.length !== W) || relief.length !== D || relief.some(r => r.length !== W)) throw new Error(`${p.name}: ragged rows`);
  const H = Math.max(...relief.flatMap(r => [...r].map(c => +c || 0)));
  const cells = new Array(W * H * D).fill(-1);
  for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
    const c = p.art[z][x], h = +relief[z][x] || 0;
    if ((c === '.') !== (h === 0)) throw new Error(`${p.name}: art and relief disagree at ${x},${z}`);
    for (let y = 0; y < h; y++) cells[x + z * W + y * W * D] = p.under ? p.under(x, y, z, h, p.legend[c]) : p.legend[c];
  }
  return { gridSize: { x: W, y: H, z: D }, cells };
}

// Deal the trucks by dry-running the level: always a colour that has uncovered cubes, taking the topmost first, so
// playing the columns in order clears the picture.
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
    for (const [k, v] of n) { if (c < 0 || v > n.get(c)) c = k; if (v >= 6 && k !== last && (alt < 0 || v > n.get(alt))) alt = k; }
    if (alt >= 0) c = alt;
    // A colour that is nearly used up goes in one truck rather than leaving a one- or two-cube truck behind.
    let left = 0; for (const b of live.values()) if (b.c === c) left++;
    const want = left <= 30 ? left : 12 + Math.floor(rand() * 17); let got = 0;
    while (got < want) {
      let best = null; for (const b of live.values()) if (b.c === c && open(b) && (!best || b.y > best.y)) best = b;
      if (!best) break; live.delete(`${best.x},${best.y},${best.z}`); got++;
    }
    const prev = seq[seq.length - 1];
    if (prev && prev.color === c && prev.count + got <= 30) prev.count += got; else seq.push({ color: c, count: got });
    last = c;
  }
  const out = Array.from({ length: columns }, () => []);
  // Each round of trucks is dealt one column further along than the last, so a colour that comes up every other truck
  // (the dragon is mostly green) does not fill whole columns on its own.
  seq.forEach((p, i) => out[(i + Math.floor(i / columns)) % columns].push({ color: p.color, count: p.count, mechanics: [], direction: 0, iceCount: 5 }));
  return out;
}

module.exports = { pictures, build, deal, guessRelief };

if (require.main === module) {
  if (process.argv.includes('--relief')) { for (const p of pictures) console.log(p.name + '\n' + guessRelief(p).map(r => `      '${r}',`).join('\n')); return; }
  const catalog = JSON.parse(fs.readFileSync(file, 'utf8'));
  // Pictures sit at the front of the catalog. The levels that were already there keep their order and move back, and
  // the repeat sequence (which names levels by number) moves with them.
  const had = catalog.levels.filter(l => l.picture).length, shift = pictures.length - had;
  const rest = catalog.levels.filter(l => !l.picture);
  const made = pictures.map((p, i) => {
    const grid = build(p), n = grid.cells.filter(c => c >= 0).length, columns = deal(grid, p.columns, 97 + i * 31);
    console.log(`${i + 1}. ${p.name}: ${grid.gridSize.x}×${grid.gridSize.y}×${grid.gridSize.z}, ${n} cubes, ${columns.map(c => c.length).join('+')} trucks`);
    return { id: 0, name: p.name, difficulty: 0, ...grid, columns, links: [], blockers: [], garages: [], cameraAngle: -30, intentTier: 0, picture: true };
  });
  catalog.levels = [...made, ...rest].map((l, i) => ({ ...l, id: i + 1 }));
  catalog.progression = { loopStart: catalog.progression.loopStart + shift, loopSkip: catalog.progression.loopSkip.map(n => n + shift) };
  // The catalog keeps camera angles written as floats (-30.0); keep it that way so only the pictures change.
  fs.writeFileSync(file, JSON.stringify(catalog).replace(/"cameraAngle":(-?\d+)([,}])/g, '"cameraAngle":$1.0$2') + '\n');
}
