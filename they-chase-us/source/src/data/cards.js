// 35 cards + Full Plate set bonus (GDD section 8). `val` maps rarity -> main value.
// text(val, picksOwned) returns the one-line in-game text for the offered rarity.
const pct = (v) => `${Math.round(v * 100)}%`;

export const CARDS = {
  // ---- Arrow ----
  sharp_tip: { name: 'Sharp Tip', cat: 'arrow', icon: '➶', rar: ['C', 'R', 'E'], val: { C: 0.15, R: 0.25, E: 0.40 }, max: 6,
    text: (v) => `Arrow damage +${pct(v)}` },
  multishot: { name: 'Multishot', cat: 'arrow', icon: '⋔', rar: ['R', 'E'], val: { R: 1, E: 2 }, max: 6, // capped by 7 arrows total
    text: (v) => (v === 1 ? '+1 arrow' : `+${v} arrows`) },
  long_range: { name: 'Long Range', cat: 'arrow', icon: '⟶', rar: ['C', 'R'], val: { C: 0.15, R: 0.25 }, max: 4,
    text: (v) => `Max range +${pct(v)}` },
  explosive_tip: { name: 'Explosive Tip', cat: 'arrow', icon: '✸', rar: ['R'], val: { R: 1 }, max: 4,
    text: (v, n) => (n === 0 ? 'Arrows deal 50% damage in a 1.2 m area' : 'Blast area +0.4 m, blast damage +10%') },
  headshot: { name: 'Headshot', cat: 'arrow', icon: '◎', rar: ['C', 'R'], val: { C: 0.10, R: 0.15 }, max: 99, // capped at 50% crit
    text: (v) => `Crit chance +${pct(v)}. Crits deal ×2` },
  full_draw: { name: 'Full Draw', cat: 'arrow', icon: '⤒', rar: ['R'], val: { R: 1 }, max: 3,
    text: (v, n) => (n === 0 ? 'Arrows released at max range deal +60% damage' : 'Max-range arrows deal +40% more') },
  ricochet: { name: 'Ricochet', cat: 'arrow', icon: '↯', rar: ['R'], val: { R: 1 }, max: 3,
    text: (v, n) => (n === 0 ? 'Arrows bounce to the nearest enemy (60% damage)' : '+1 bounce') },
  arrow_rain: { name: 'Arrow Rain', cat: 'arrow', icon: '☂', rar: ['E'], val: { E: 1 }, max: 3,
    text: (v, n) => (n === 0 ? 'Every 6th shot, 12 arrows rain on the target' : 'Rain 1 shot sooner, +4 arrows') },
  knockback: { name: 'Knockback', cat: 'arrow', icon: '⇤', rar: ['C'], val: { C: 1 }, max: 3,
    text: (v, n) => (n === 0 ? 'Hit enemies are knocked back 1.5 m' : 'Knockback +1 m') },
  execute: { name: 'Execute', cat: 'arrow', icon: '☠', rar: ['R'], val: { R: 1 }, max: 3,
    text: (v, n) => (n === 0 ? 'Enemies below 12% HP die instantly. Half on Brutes' : 'Execute threshold +4%') },

  // ---- Element ----
  frost_arrow: { name: 'Frost Arrow', cat: 'element', element: 'frost', starter: true, icon: '❄', rar: ['R'], val: { R: 1 }, max: 1,
    text: () => 'Arrows freeze for 0.8 s and deal +30% frost damage' },
  deep_freeze: { name: 'Deep Freeze', cat: 'element', element: 'frost', icon: '❆', rar: ['C'], val: { C: 0.4 }, max: 4,
    text: (v) => `Freeze duration +${v} s` },
  shatter: { name: 'Shatter', cat: 'element', element: 'frost', icon: '✧', rar: ['R'], val: { R: 1 }, max: 1,
    text: () => 'Frozen enemies freeze nearby enemies when they die' },
  fire_arrow: { name: 'Fire Arrow', cat: 'element', element: 'fire', starter: true, icon: '♨', rar: ['R'], val: { R: 1 }, max: 1,
    text: () => 'Arrows burn for 2 s: 30% of arrow damage per second' },
  long_burn: { name: 'Long Burn', cat: 'element', element: 'fire', icon: '♨', rar: ['C'], val: { C: 1 }, max: 4,
    text: (v) => `Burn duration +${v} s` },
  wildfire: { name: 'Wildfire', cat: 'element', element: 'fire', icon: '✺', rar: ['R'], val: { R: 1 }, max: 1,
    text: () => 'Burning enemies spread fire to nearby enemies when they die' },
  lightning_arrow: { name: 'Lightning Arrow', cat: 'element', element: 'lightning', starter: true, icon: '⚡', rar: ['R'], val: { R: 1 }, max: 1,
    text: () => 'Arrows chain to 2 enemies (70% damage)' },
  chain: { name: 'Chain', cat: 'element', element: 'lightning', icon: '⛓', rar: ['C'], val: { C: 1 }, max: 5,
    text: () => '+1 chain' },
  thunderstruck: { name: 'Thunderstruck', cat: 'element', element: 'lightning', icon: '⚡', rar: ['R'], val: { R: 1 }, max: 1,
    text: () => 'Chained enemies are stunned for 0.3 s' },
  elemental_power: { name: 'Elemental Power', cat: 'element', element: 'any', icon: '✦', rar: ['C', 'R'], val: { C: 0.25, R: 0.40 }, max: 4,
    text: (v) => `Elemental damage +${pct(v)}` },

  // ---- Ally ----
  recruit: { name: 'Recruit', cat: 'ally', icon: '♟', rar: ['C', 'R', 'E'], val: { C: 1, R: 2, E: 3 }, max: 99, // capped by 20 soldiers
    text: (v) => `+${v} soldier${v > 1 ? 's' : ''}` },
  guardian: { name: 'Guardian', cat: 'ally', icon: '⛨', rar: ['R'], val: { R: 1 }, max: 3,
    text: () => 'Takes the first obstacle hit, then falls' },
  tight_formation: { name: 'Tight Formation', cat: 'ally', icon: '⧈', rar: ['C'], val: { C: 0.25 }, max: 2,
    text: (v) => `Formation is ${pct(v)} tighter` },
  standard_bearer: { name: 'Standard Bearer', cat: 'ally', icon: '⚑', rar: ['C'], val: { C: 0.30 }, max: 5,
    text: (v) => `Ally arrow damage +${pct(v)}` },
  shared_element: { name: 'Shared Element', cat: 'ally', icon: '✶', rar: ['E'], val: { E: 1 }, max: 1,
    text: () => 'Ally arrows carry your element' },

  // ---- Armor ----
  helmet: { name: 'Helmet', cat: 'armor', icon: '⛑', rar: ['R'], val: { R: 1 }, max: 1, text: () => '+25 max HP, heal 25 HP' },
  chestplate: { name: 'Chestplate', cat: 'armor', icon: '▣', rar: ['R'], val: { R: 1 }, max: 1, text: () => 'Enemy damage −20%' },
  gauntlets: { name: 'Gauntlets', cat: 'armor', icon: '✊', rar: ['R'], val: { R: 1 }, max: 1, text: () => 'Bow draw 15% faster' },
  leggings: { name: 'Leggings', cat: 'armor', icon: '⫿', rar: ['R'], val: { R: 1 }, max: 1, text: () => 'Obstacle damage −40%' },
  boots: { name: 'Boots', cat: 'armor', icon: '⩓', rar: ['R'], val: { R: 1 }, max: 1, text: () => 'Backward run speed +6%' },

  // ---- General ----
  shield: { name: 'Shield', cat: 'general', icon: '⛊', rar: ['R'], val: { R: 1 }, max: 3,
    text: (v, n) => (n === 0 ? 'Blocks one obstacle or spear hit for the squad. Recharges in 8 s' : 'Shield recharges 2 s faster') },
  caltrops: { name: 'Caltrops', cat: 'general', icon: '✵', rar: ['C', 'R'], val: { C: 1, R: 2 }, max: 4,
    text: (v, n) => (n === 0
      ? (v === 1 ? 'Every 4 s, caltrops: 1.5× arrow damage, 40% slow' : 'Every 3.5 s, caltrops: 2× arrow damage, 40% slow')
      : (v === 1 ? 'Caltrops +50% damage, 0.5 s sooner' : 'Caltrops +100% damage, 1 s sooner')) },
  lifesteal: { name: 'Lifesteal', cat: 'general', icon: '♥', rar: ['C'], val: { C: 1 }, max: 4,
    text: (v, n) => (n === 0 ? '+1 HP per kill' : '+1 more HP per kill') },
  wisdom: { name: 'Wisdom', cat: 'general', icon: '✎', rar: ['C'], val: { C: 0.2 }, max: 3,
    text: (v) => `+${pct(v)} XP` },
  healing_potion: { name: 'Healing Potion', cat: 'general', icon: '⚗', rar: ['C'], val: { C: 0.3 }, max: 999,
    text: (v) => `Instantly heal ${pct(v)} HP` },
};

for (const id in CARDS) CARDS[id].id = id;

export const RARITY_NAME = { C: 'Common', R: 'Rare', E: 'Epic' };
export const ELEMENT_STARTERS = ['frost_arrow', 'fire_arrow', 'lightning_arrow'];
export const ARMOR_IDS = ['helmet', 'chestplate', 'gauntlets', 'leggings', 'boots'];
export const CARD_IDS = Object.keys(CARDS);
