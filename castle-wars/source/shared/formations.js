import { WORLD, ARENA } from './content.js';

/** Pre-designed structures: each # is destructible masonry, each dot is open air.
 * Blueprints describe the left team; the engine mirrors all physical geometry.
 * Origins align to the terrain construction grid, including the ground plane.
 */
export const FORMATIONS = Object.freeze([
  {
    id: 'twin-keeps', name: 'Twin Keeps',
    description: 'Two unequal watchtowers joined by a firing bridge over a great vaulted hall.',
    origin: { x: 84, y: 190 },
    rows: [
      '#.............',
      '#....#........',
      '######........',
      '##..##........',
      '#....#........',
      '#....#....#..#',
      '#....#....####',
      '##..##....#..#',
      '##############',
      '#....#....#..#',
      '#....##..##..#',
      '#.....####...#',
      '##..........##',
      '##..........##',
      '###........###',
      '####......####',
      '##############',
      '##...#..#...##',
      '##...#..#...##',
      '##############',
    ],
    units: [{ x: 281, y: 374, needsArc: true }, { x: 392, y: 318, needsArc: true }, { x: 152, y: 206, needsArc: true }],
    core: { x: 257, y: 670 },
    flags: [{ x: 98, y: 190 }, { x: 462, y: 330 }],
  },
  {
    id: 'bridge-fort', name: 'Bridge Fort',
    description: 'A broad defensive viaduct, three deep archways and gatehouses around an open courtyard.',
    origin: { x: 84, y: 302 },
    rows: [
      '#.............',
      '#..#..........',
      '####..........',
      '#..#......#..#',
      '#..#......####',
      '#..#......#..#',
      '##############',
      '###..####..###',
      '##....##....##',
      '#.....##.....#',
      '#.....##.....#',
      '##....##....##',
      '##############',
      '##...#..#...##',
      '##...#..#...##',
      '##############',
    ],
    units: [{ x: 272, y: 430, needsArc: true }, { x: 116, y: 318, needsArc: true }, { x: 392, y: 374, needsArc: true }],
    core: { x: 257, y: 670 },
    flags: [{ x: 98, y: 302 }, { x: 462, y: 386 }],
  },
  {
    id: 'crown-citadel', name: 'Crown Citadel',
    description: 'A crowned central keep with an elevated rear outpost, nested halls and a low forward battery.',
    origin: { x: 84, y: 190 },
    rows: [
      '......#...#...',
      '......#####...',
      '###...#...#...',
      '#.#...#...#...',
      '#.#########...',
      '#.#..##...##..',
      '#.#..#.....#..',
      '#.##########..',
      '#.#..#.....#..',
      '#.#..##...##..',
      '###########...',
      '##...#....#...',
      '##############',
      '##..##..##..##',
      '##..##..##..##',
      '##############',
      '####.####.####',
      '##...#..#...##',
      '##...#..#...##',
      '##############',
    ],
    units: [{ x: 109, y: 206, needsArc: true }, { x: 296, y: 178, needsArc: true }, { x: 440, y: 486, needsArc: false }],
    core: { x: 257, y: 670 },
    flags: [{ x: 266, y: 190 }],
  },
].map(formation => Object.freeze({ ...formation,
  rows: Object.freeze(formation.rows), origin: Object.freeze(formation.origin),
  units: Object.freeze(formation.units.map(Object.freeze)), core: Object.freeze(formation.core),
  flags: Object.freeze(formation.flags.map(Object.freeze)),
})));

/** Layout selection uses an independent seed stream so it cannot alter the arsenal. */
export function selectFormation(seed = 1, excludeFormationId) {
  const choices = FORMATIONS.filter(f => f.id !== excludeFormationId);
  let hash = 2166136261;
  for (const character of `formation:${seed}`) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return choices[(hash >>> 0) % choices.length];
}

export function formationMetadata(formation) {
  const { x, y } = formation.origin;
  const occupied = formation.rows.flatMap((row, r) => [...row].flatMap((cell, c) => cell === '#' ? [{ x: x + c * WORLD.tileSize, y: y + r * WORLD.tileSize }] : []));
  const left = Math.min(...occupied.map(t => t.x)), top = Math.min(...occupied.map(t => t.y));
  const right = Math.max(...occupied.map(t => t.x + WORLD.tileSize)), bottom = Math.max(...occupied.map(t => t.y + WORLD.tileSize));
  const bounds = [{ x: left, y: top, w: right - left, h: bottom - top }, { x: WORLD.width - right, y: top, w: right - left, h: bottom - top }];
  return { id: formation.id, name: formation.name, description: formation.description, bounds,
    islands: ARENA.islands.map(island => ({ ...island })),
    flags: [0, 1].flatMap(side => formation.flags.map(flag => ({ side, x: side ? WORLD.width - flag.x : flag.x, y: flag.y }))),
  };
}
