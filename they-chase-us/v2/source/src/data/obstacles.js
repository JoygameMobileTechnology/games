// Obstacle table (section 6). playerDmg is base; scaled by level. enemyFrac = fraction of max HP (bruteFrac for Brute).
export const OBSTACLE_TYPES = {
  stone_wall:     { id: 'stone_wall',     name: 'Stone Wall',     playerDmg: 20, enemyFrac: 0,    bruteFrac: 0,    firstLevel: 2, stun: 1.0 },
  floor_spikes:   { id: 'floor_spikes',   name: 'Floor Spikes',   playerDmg: 15, enemyFrac: 0.35, bruteFrac: 0.10, firstLevel: 3, rattle: 0.6, up: 0.8, down: 1.2, size: 2.5 },
  pendulum_axe:   { id: 'pendulum_axe',   name: 'Pendulum Axe',   playerDmg: 20, enemyFrac: 0.50, bruteFrac: 0.15, firstLevel: 5, period: 2.4 },
  giant_sentinel: { id: 'giant_sentinel', name: 'Giant Sentinel', playerDmg: 25, enemyFrac: 0.50, bruteFrac: 0.20, firstLevel: 6, windup: 0.7, swing: 0.3, recover: 1.2, sweep: 0.6 },
  rolling_log:    { id: 'rolling_log',    name: 'Rolling Log',    playerDmg: 20, enemyFrac: 0.60, bruteFrac: 0.20, firstLevel: 8, speed: 4 },
};
export const OBSTACLE_ORDER = ['stone_wall', 'floor_spikes', 'pendulum_axe', 'giant_sentinel', 'rolling_log'];
export function obstaclesForLevel(L) { return OBSTACLE_ORDER.filter((id) => OBSTACLE_TYPES[id].firstLevel <= L); }
