export const FORMATION_WIDTH = 6;
export const FORMATION_HEIGHT = 7.5;

// A number is a centered, solid row; a string describes deliberate openings.
// Coordinates are tile units. Every tier has an even population, allowing the
// engine to peel highest-tier pairs completely before moving down a tier.
// The 60-tile layouts retain the original base silhouettes and layer counts;
// upper tiers are thinned by hand so their remaining stones stay supported.
function layer(rows, z, y = 0, rowStep = 1) {
  return rows.flatMap((row, index) => {
    const cells = typeof row === 'number' ? '1'.repeat(row) : row;
    return [...cells].flatMap((cell, column) => cell === '1'
      ? [{ x: (FORMATION_WIDTH - cells.length) / 2 + column, y: y + index * rowStep, z }]
      : []);
  });
}

function formation(id, name, description, tiers) {
  const slots = tiers.flat().map((slot, index) => Object.freeze({ ...slot, id: `${id}-${index}`, removed: false }));
  const minX = Math.min(...slots.map(slot => slot.x));
  const minY = Math.min(...slots.map(slot => slot.y));
  const maxX = Math.max(...slots.map(slot => slot.x + 1));
  const maxY = Math.max(...slots.map(slot => slot.y + 1));
  const layers = Math.max(...slots.map(slot => slot.z)) + 1;
  return Object.freeze({ id, name, description, slots: Object.freeze(slots), bounds: Object.freeze({ minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY, layers }) });
}

export const FORMATIONS = Object.freeze([
  formation('crown', 'Crown', 'A broad stepped crown rising to a two-stone crest.', [
    layer([4, 6, 6, 6, 6, 6, 4], 0),
    layer([2, 2, 3, 3, 2, 2], 1, .5),
    layer([2, 2, 2], 2, 2),
    layer([2], 3, 3),
  ]),
  formation('terrace', 'Terrace', 'Two broad, shallow terraces with chamfered corners.', [
    layer([6, 6, 6, 6, 6, 6, 6], 0),
    layer([3, 6, 6, 3], 1, 1.5),
  ]),
  formation('turtle', 'Turtle', 'A rounded shell with five tightly nested tiers.', [
    layer([2, 4, 6, 6, 6, 4, 2], 0),
    layer([2, 3, 4, 3, 2], 1, 1),
    layer([2, 2, 2, 2], 2, 1.5),
    layer([2, 2, 2], 3, 2),
    layer([2], 4, 3.25),
  ]),
  formation('diamond', 'Diamond', 'Pointed ends surround a wide, layered central jewel.', [
    layer([1, 3, 5, 6, 5, 3, 1], 0),
    layer([2, 2, 4, 4, 2, 2], 1, .5),
    layer([2, 2, 4, 2, 2], 2, 1),
    layer([2, 4, 2], 3, 2),
  ]),
  formation('twin-towers', 'Twin Towers', 'Two separated pillars rise along the sides of a courtyard.', [
    layer([6, 6, 6, 6, 6, 6, 6], 0),
    layer(['1....1', '1....1', '1....1', '1....1', '1....1'], 1, 1),
    layer(['1....1', '1....1', '1....1'], 2, 2),
    layer(['1....1'], 3, 3),
  ]),
  formation('moon-gate', 'Moon Gate', 'Raised rails and lintels frame an open central window.', [
    layer([6, 6, 6, 6, 6, 6, 6], 0),
    layer(['1111', '1..1', '1..1', '1111'], 1, 1.5),
    layer(['1..1', '1..1', '1..1'], 2, 1.5, 1.5),
  ]),
  formation('crossroads', 'Crossroads', 'A wide cross narrows into a raised central ridge.', [
    layer([2, 2, 6, 6, 6, 2, 2], 0),
    layer([2, 2, 2, 6, 2, 2, 2], 1, .25),
    layer([2, 2, 2, 2, 2], 2, 1.25),
    layer([2, 2, 2], 3, 2.25),
  ]),
  formation('hourglass', 'Hourglass', 'Broad ends meet at a narrow waist beneath four tiers.', [
    layer([6, 6, 4, 2, 4, 6, 6], 0),
    layer([4, 2, 2, 2, 4], 1, 1),
    layer([2, 2, 2, 2], 2, 1.5),
    layer([2, 2], 3, 2.5),
  ]),
  formation('serpent', 'Serpent', 'A winding staircase travels from side to side.', [
    layer(['1111..', '11111.', '.11111', '111111', '11111.', '.11111', '..1111'], 0),
    layer(['111...', '.111..', '..111.', '.111..'], 1, 1.5),
    layer(['.11...', '..11..', '...11.', '..11..'], 2, 1.75),
    layer(['..11..', '...11.', '..11..'], 3, 2),
  ]),
  formation('lotus', 'Lotus', 'Four spreading petals surround an elongated heart.', [
    layer([2, 6, 6, 4, 6, 6, 2], 0),
    layer([2, 4, 4, 4, 2], 1, .75),
    layer([2, 2, 2, 2], 2, 1.25),
    layer([2, 2], 3, 2.5),
  ]),
  formation('bridge', 'Bridge', 'Four piers support a broad central crossing.', [
    layer(['11..11', '11..11', '111111', '111111', '111111', '11..11', '11..11'], 0),
    layer([4, 6, 4], 1, 2),
    layer([2, 6, 2], 2, 2),
    layer([2], 3, 3),
  ]),
  formation('fan', 'Fan', 'A broad fan tapers toward a narrow handle.', [
    layer([6, 6, 6, 6, 4, 2, 2], 0),
    layer([4, 4, 2, 2, 2], 1, .5),
    layer([4, 2, 2, 2], 2, 1),
    layer([2, 2], 3, 1.5),
  ]),
]);

export const FORMATION_IDS = Object.freeze(FORMATIONS.map(value => value.id));
const byId = new Map(FORMATIONS.map(value => [value.id, value]));

export function getFormation(id) {
  if (!byId.has(id)) throw new RangeError(`Unknown formation: ${id}`);
  return byId.get(id);
}

/** Deterministic selection; history policy belongs to the caller. */
export function chooseFormationId(seed, { excludeIds = [] } = {}) {
  if (!Number.isFinite(seed) || !Number.isInteger(seed)) throw new TypeError('A formation seed must be a finite integer.');
  if (!Array.isArray(excludeIds)) throw new TypeError('Excluded formation IDs must be an array.');
  const candidates = FORMATION_IDS.filter(id => !excludeIds.includes(id));
  if (!candidates.length) throw new RangeError('At least one formation must remain available.');
  let value = (seed >>> 0) + 0x6d2b79f5;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return candidates[Math.floor(((value ^ (value >>> 14)) >>> 0) / 0x100000000 * candidates.length)];
}
