// Enemy type table (section 5). HP is T0; tier multiplies it. Speed is ground speed at L1 (raised ~10% over the GDD so chasers close in).
export const ENEMY_TYPES = {
  footman:       { id: 'footman',       name: 'Footman',       hp: 20,  speed: 7.0, dps: 8,  xp: 2,  scale: 1.0,  firstLevel: 1, radius: 0.45 },
  runner:        { id: 'runner',        name: 'Runner',        hp: 10,  speed: 8.2, dps: 5,  xp: 1,  scale: 0.78, firstLevel: 2, radius: 0.35 },
  shieldbearer:  { id: 'shieldbearer',  name: 'Shieldbearer',  hp: 60,  speed: 6.6, dps: 10, xp: 5,  scale: 1.08, firstLevel: 4, radius: 0.55 },
  spear_thrower: { id: 'spear_thrower', name: 'Spear Thrower', hp: 30,  speed: 7.6, dps: 6,  xp: 4,  scale: 1.0,  firstLevel: 5, radius: 0.45, holdMin: 9, holdMax: 13 },
  drummer:       { id: 'drummer',       name: 'Drummer',       hp: 40,  speed: 7.4, dps: 4,  xp: 5,  scale: 1.0,  firstLevel: 7, radius: 0.5,  holdMin: 11, holdMax: 15 },
  brute:         { id: 'brute',         name: 'Brute',         hp: 400, speed: 6.3, dps: 25, xp: 25, scale: 2.1,  firstLevel: 6, radius: 0.95, boss: true },
};

export const ENEMY_ORDER = ['footman', 'runner', 'shieldbearer', 'spear_thrower', 'drummer', 'brute'];

// Which regular types may appear at a given level (FTUE table, section 11)
export function typesForLevel(L) {
  return ENEMY_ORDER.filter((id) => id !== 'brute' && ENEMY_TYPES[id].firstLevel <= L);
}
