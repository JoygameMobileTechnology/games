import { CONFIG } from '../config.js';
import { CARDS, ARMOR_IDS } from '../data/cards.js';

// Derives the full build from card picks + meta upgrade levels. Percentages of the same stat add.
export function computeStats(picks, upg) {
  const P = CONFIG.player, M = CONFIG.meta;
  const n = (id) => (picks[id] ? picks[id].length : 0);
  const sum = (id) => (picks[id] ? picks[id].reduce((s, r) => s + CARDS[id].val[r], 0) : 0);
  const has = (id) => n(id) > 0;

  const armorCount = ARMOR_IDS.filter(has).length;
  const fullPlate = armorCount === 5;
  const element = has('frost_arrow') ? 'frost' : has('fire_arrow') ? 'fire' : has('lightning_arrow') ? 'lightning' : null;
  const elemPower = sum('elemental_power');
  const metaAtk = P.attackInterval - M.atkPerLevel * Math.min(M.atkCap, upg.atk || 0);
  const attackInterval = Math.max(P.attackFloor, metaAtk * (has('gauntlets') ? 0.85 : 1));
  const metaDmg = P.baseArrowDamage + M.dmgPerLevel * Math.min(M.dmgCap, upg.dmg || 0);

  const s = {
    maxHp: P.baseHp + M.hpPerLevel * (upg.hp || 0) + (has('helmet') ? 25 : 0),
    runSpeed: P.runSpeed * (1 + (has('boots') ? 0.06 : 0)),
    attackInterval, drawTime: attackInterval,
    arrowDamage: metaDmg * (1 + sum('sharp_tip')),
    arrows: Math.min(7, 1 + sum('multishot')),
    maxRange: P.autoRange * (1 + sum('long_range')),
    explosive: has('explosive_tip') ? { radius: 1.2 + 0.4 * (n('explosive_tip') - 1), pct: 0.5 + 0.1 * (n('explosive_tip') - 1) } : null,
    critChance: Math.min(0.5, sum('headshot')),
    fullDrawBonus: has('full_draw') ? 0.6 + 0.4 * (n('full_draw') - 1) : 0,
    ricochet: n('ricochet'),
    arrowRain: has('arrow_rain') ? { every: Math.max(2, 6 - (n('arrow_rain') - 1)), count: 12 + 4 * (n('arrow_rain') - 1) } : null,
    knockback: has('knockback') ? 1.5 + (n('knockback') - 1) : 0,
    execute: has('execute') ? 0.12 + 0.04 * (n('execute') - 1) : 0,
    element, elemPower,
    freezeDuration: 0.8 + sum('deep_freeze'),
    frostBonus: 0.3 * (1 + elemPower),
    shatter: has('shatter'),
    burnDuration: 2 + sum('long_burn'),
    burnPct: 0.3 * (1 + elemPower),
    wildfire: has('wildfire'),
    chainCount: 2 + sum('chain'),
    chainPct: 0.7 * (1 + elemPower),
    thunderstruck: has('thunderstruck'),
    allies: Math.min(CONFIG.ally.max, sum('recruit')),
    guardian: n('guardian'),
    formationTight: sum('tight_formation'),
    allyDamage: CONFIG.ally.arrowDamage * (1 + sum('standard_bearer')),
    sharedElement: has('shared_element'),
    enemyDamageMult: 1 - (has('chestplate') ? 0.2 : 0) - (fullPlate ? 0.2 : 0),
    obstacleDamageMult: 1 - (has('leggings') ? 0.4 : 0) - (fullPlate ? 0.2 : 0),
    projectileDamageMult: 1 - (fullPlate ? 0.2 : 0),
    fullPlate, armorCount,
    shield: has('shield') ? { recharge: Math.max(2, 8 - 2 * (n('shield') - 1)) } : null,
    caltrops: has('caltrops') ? { interval: Math.max(1.5, 4 - 0.5 * (sum('caltrops') - 1)), dmgMult: 1.5 + 0.5 * (sum('caltrops') - 1) } : null,
    lifesteal: n('lifesteal'),
    xpMult: 1 + sum('wisdom'),
    armor: { helmet: has('helmet'), chestplate: has('chestplate'), gauntlets: has('gauntlets'), leggings: has('leggings'), boots: has('boots') },
  };
  s.fireInterval = s.attackInterval;
  return s;
}

export function emptyPicks() { return {}; }
