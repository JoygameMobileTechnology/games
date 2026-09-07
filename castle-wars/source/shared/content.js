/** All authoritative balance values. Pixel units; positive Y points down. */
export const WORLD = Object.freeze({ width: 2000, height: 900, groundY: 750, tileSize: 28, gravity: 520, buildCeiling: 134 });
// Forecast work is bounded for previews/AI; live projectiles have no flight timer.
export const RULES = Object.freeze({ predictionHorizonMs: 12000, terrainBlastRadiusScale: 1.8, coreHp: 120 });
/** Shared geometry anchors keep scenery and construction aligned with physical tiles. */
export const ARENA = Object.freeze({
  castle: Object.freeze({ left: 140, top: 162, width: 336, bottom: 750 }),
  buildRegions: Object.freeze([{ min: 84, max: 616 }, { min: WORLD.width - 616, max: WORLD.width - 84 }]),
  islands: Object.freeze([{ left: 84, right: 532 }, { left: WORLD.width - 532, right: WORLD.width - 84 }]),
  flags: Object.freeze([{ x: 196, y: 162 }, { x: WORLD.width - 196, y: 162 }]),
});
const shot = (id, name, short, pool, ammo, damage, radius, extra = {}) => ({
  id, name, short, pool, ammo, damage, radius: radius * WORLD.tileSize,
  kind: 'fire', speedMin: 360, speedMax: 1060, r: 5, color: '#ffca58', icon: '↗',
  description: short, ...extra,
});
const kit = (id, name, short, pool, w, h, hp, extra = {}) => ({
  id, name, short, pool, ammo: 1, kind: 'build', footprint: { w, h }, hp, floating: true,
  color: '#8fdfad', icon: '▦', description: short, ...extra,
});
export const WEAPONS = Object.freeze({
  basic: shot('basic', 'Basic Rocket', 'Reliable blast. Infinite rockets.', 0, -1, 60, 1.5),
  lob: shot('lob', 'Lob Rocket', 'A floatier arc. Infinite rockets.', 0, -1, 60, 1.5, { gravityScale: 0.72, speedMin: 330, speedMax: 970, color: '#a5d8ef', icon: '⌒' }),
  anvil: shot('anvil', 'Anvil Rocket', 'Heavy impact. Hops back for a smaller blast.', 1, 2, 90, 1.8, { speedMax: 1040, r: 9, reboundHeight: 60, reboundMs: 700, reboundDamage: 45, reboundRadiusScale: 0.65, color: '#b8c3d1', icon: '▼' }),
  pinball: shot('pinball', 'Pinball Payload', 'Two bounces, then BOING!', 1, 2, 85, 1.9, { bounces: 2, color: '#fa97c9', icon: '●' }),
  bridge: kit('bridge', 'Bridge Kit', 'Three floating bricks. Span a breach.', 2, 3, 1, 45, { material: 'bridge', icon: '═' }),
  barricade: kit('barricade', 'Barricade Kit', 'Floating cover inside your castle.', 2, 1, 3, 45, { material: 'bridge', icon: '▥' }),
  drill: shot('drill', 'Drill Comet', 'Drills through three resistance.', 3, 1, 130, 1.8, { penetration: 3, color: '#d6b5ff', icon: '»' }),
  seeker: shot('seeker', 'Signal Seeker', 'Chases an enemy after launch.', 3, 2, 140, 2, { homing: true, color: '#ed9fc4', icon: '◎' }),
  terrain: kit('terrain', 'Terrain Kit', 'Four tough floating bricks.', 4, 2, 2, 70, { material: 'terrain', icon: '▧' }),
  fortress: kit('fortress', 'Fortress Kit', 'Six floating bricks of emergency castle.', 4, 3, 2, 55, { material: 'terrain', icon: '▩' }),
  firework: shot('firework', 'Firework Flock', 'Five tiny rockets. Big personality.', 5, 1, 55, 1.2, { children: 5, split: true, color: '#ff9974', icon: '✣' }),
  excavator: shot('excavator', 'Excavator Express', 'Eight resistance. No brakes.', 5, 1, 280, 2.8, { penetration: 8, r: 8, color: '#ffb15c', icon: '≫' }),
  accordion: shot('accordion', 'Accordion Apocalypse', 'Three expanding shockwaves.', 5, 1, 100, 2, { pulses: 3, pulseDelay: 250, pulseRadii: [2, 2.8, 3.6].map(n => n * 28), color: '#c5c0ff', icon: '≋' }),
  star: shot('star', 'Pocket Star', 'Five pulses of miniature sunshine.', 6, 1, 100, 4, { pulses: 5, pulseDelay: 150, color: '#fff0ad', icon: '✦' }),
  moon: shot('moon', 'The Entire Moon', 'Yes. The entire moon.', 6, 1, 600, 5, { r: 19, speedMax: 1020, color: '#e1e8f2', icon: '☾' }),
  saturn: shot('saturn', 'Saturn Delivery', 'One planet. Four satellite rockets.', 6, 1, 220, 2.5, { satellites: 4, childDamage: 100, childRadius: 1.8 * 28, r: 12, color: '#f4c595', icon: '⊙' }),
});
export const DEFAULT_WEAPONS = Object.freeze(['basic', 'lob']);
export const MATERIALS = Object.freeze({
  masonry: { hp: 18, resistance: 1, blastTransmission: 0.6 },
  reinforced: { hp: 65, resistance: 3, blastTransmission: 0.3 },
  bridge: { hp: 45, resistance: 1, blastTransmission: 0.4 },
  terrain: { hp: 70, resistance: 2, blastTransmission: 0.25 },
});
export const WEAPON_POOLS = Object.freeze(Array.from({ length: 6 }, (_, i) => Object.keys(WEAPONS).filter(id => WEAPONS[id].pool === i + 1)));
