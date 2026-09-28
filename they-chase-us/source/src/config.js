// Every balance number lives here. The debug panel (?debug=1) edits this object live.
export const PALETTE = {
  skyTop: 0x7fd6f2, skyBottom: 0xe6f7ff, sea: 0x3cc7cf,
  road: 0xf5f0e6, chevron: 0xd6e4f2, parapet: 0xe4ae45,
  castleWall: 0xe8e2d6, roofTile: 0xc8614a, slate: 0x6f7d8c,
  player: 0xffc62e, ally: 0x4cd964, enemy: 0xe0413a, // player: toy-stickman yellow (the gummy shader shades it toward orange)
  iron: 0x9aa3ad, steel: 0xc9d1d9, blackSteel: 0x3a3f47, gold: 0xd9a93f,
  frost: 0x7fe3ff, fire: 0xff7a2e, lightning: 0xa58bff, crit: 0xffd84a,
  danger: 0xff3b3b,
  bridgeStone: 0x5c6470, carpet: 0x9b2a2a,
};

export const CONFIG = {
  // --- player ---
  player: {
    baseHp: 100,
    baseArrowDamage: 10,
    runSpeed: 5.0,          // m/s backward run (level)
    bonusRunSpeed: 4.5,     // m/s forward run (bridge), fixed
    lateralMax: 9,          // m/s max follow speed
    roadWidth: 8,
    xRange: 3.3,
    minRange: 1.5,
    maxRange: 14,
    drawTime: 1.2,          // s from min to max range
    drawTimeFloor: 0.6,
    hitRadius: 0.6,
    invulnTime: 0.6,
    nockTime: 0.12,
    aimAssistRadius: 1.2,
    multishotSpacing: 0.8,
    lowHpVignette: 0.3,
    contactRadius: 0.9,
    maxLatched: 3,          // enemies that can bite the player at once; the rest queue behind
    latchHurtFlash: 0.6,    // s between hurt flashes while being bitten
  },
  arrow: {
    flightBase: 0.32, flightPerMeter: 0.022, // flight time = base + perMeter*dist
    apexBase: 0.15, apexPerMeter: 0.03, // nearly flat: arrows fly at body height and hit what is in the way
    ricochetRange: 6,
    rainRadius: 2.0,
    maxActive: 150,
    bodyHeight: 1.75,       // an arrow below this (× enemy scale) hits the body it passes through
    bodyRadius: 0.22,       // extra XZ tolerance for mid-flight hits
  },
  ally: {
    max: 20,
    arrowDamage: 5,
    staggerMax: 0.12,
    scatter: 1.0,
    baseRing: 0.9,          // formation radius for first ring
    ringStep: 0.75,
    spring: 14,
    damping: 0.82,
    latchKillTime: 0.6,
  },
  camera: {
    fov: 68,
    back: 7.0,              // distance ahead of the player (in travel direction) in level phase
    height: 9.5,
    lookAhead: 1.5,         // look target relative to the player, toward the chasers
    followX: 0.4,
    turnTime: 0.8,
    bonusBack: 11,          // bridge: further back and looking ahead so the distant boss is in view
    bonusHeight: 12,
    bonusLookAhead: 9,
    arenaBackExtra: 4,      // boss arena: pull back/up a bit more so the 8 m boss fits
    arenaHeightExtra: 6,
    arenaLookExtra: 5,
  },
  fog: { levelNear: 35, levelFar: 75, bonusNear: 60, bonusFar: 340 }, // the bridge opens up so the arena is visible from afar
  xp: { base: 6, perLevel: 6 },
  rarity: { common: 0.6, rare: 0.3, epic: 0.1, epicFromLevelUp: 3, ownedWeightBonus: 0.5 },
  levelup: { slowIn: 0.25, inputLock: 0.3, slowOut: 0.3 },
  enemy: {
    spawnDistance: 10,       // chasers touch down this far behind the player (front of a wave), superhero landing
    dropHeight: 9,          // m above the landing spot where the fall starts (above the top of the screen)
    dropBack: 4,            // m further back at the start of the fall: a steep dive toward the player
    dropDur: 0.55,          // s of fall (accelerating)
    landHold: 0.2,          // s holding the knee-and-fist pose; the head snaps up at the end
    landRise: 0.25,         // s to stand up into the run
    lateralSpeed: 2.0,
    separation: 0.9,
    radius: 0.45,
    speedGrowthPerLevel: 0.008,
    speedGrowthCap: 0.30,
    hpBarHold: 1.8,
    hpBarFade: 0.3,
    debrisLife: 1.5,
    shieldShadowDepth: 1.5,
    shieldShadowDamage: 0.2,
    spearInterval: 3.0,
    spearWarn: 0.8,
    spearDamage: 15,
    spearSpeed: 14,
    drummerRadius: 5,
    drummerBoost: 0.35,
    bruteKnockbackResist: 0.5,
    bruteArrivalFrac: 0.6,
    frozenFallback: 0,      // (frozen enemies simply stop; relative fallback = player speed)
  },
  balance: {
    hpBudgetBase: 900,
    budgetGrowth: 1.06,
    obstacleDamageGrowth: 0.03,
    xpTierBonus: 0.5,
    ftueBudgetBase: 0.28,    // FTUE levels use (base + perLevel*L) of the HP budget
    ftueBudgetPerLevel: 0.03,
  },
  obstacle: {
    minGap: 4.0,
    minGapFtue: 6.0,
    safePath: 2.5,
    oppositeGap: 1.2,
    warnTime: 1.5,
    warnTimeLog: 2.0,
    enterAhead: 9,          // m ahead of the player where an obstacle enters the screen (bottom edge)
  },
  bonus: {
    segmentLength: 12,
    segments: 19,
    guardHpBase: 30,
    guardSegGrowth: 1.28,
    guardLevelGrowth: 1.03,
    weakHpFrac: 0.6,
    raiseDistance: 8,
    fireRateFactor: 0.6,
    bossHpFactor: 6,
    bossStart: 16,
    bossSpeed: 1.0,
    bossSlam: 3.5,
    bossSlamEnraged: 2.5,
    bossSlamWarn: 1.0,
    bossSlamWidth: 0.4,
    bossEnrageHp: 0.5,
    bossMultiplier: 30,
    arenaMultiplier: 20,
    sizeGrowth: 0.03,
    ftueSegments: 4,
  },
  meta: {
    hpPerLevel: 5,
    speedPerLevel: 0.006, speedCap: 30,
    atkPerLevel: 0.0144, atkCap: 28,
    costBase: 40, costGrowth: 1.2,
    incomeBase: 10, incomePerLevel: 2,
    failKeepFrac: 0.5,
  },
  level: {
    normalDuration: 75,
    waveGapMin: 4.5, waveGapMax: 6.5,
    waveGapMinFtue: 5.5, waveGapMaxFtue: 7.5,
    firstCardTime: 9,
    maxIdle: 1.5,           // s without anything in reach before a filler pack drops in
    fillerSize: 2,
    fillerNear: 1,          // fillers land this much closer than spawnDistance
    formationDepth: 0.7,    // depth spread of wave formations (1 = template values)
    phases: { warmup: 10, rise: 40, peak: 60 },
  },
  perf: { maxEnemies: 80, maxParticles: 800, maxDebris: 60, maxDamageGlyphs: 240, maxHpBars: 96 },
  debug: { god: false, timeScale: 1, showFps: true, runHidden: false },
};

export const TIER_MULT = [1.0, 1.5, 2.2, 3.2, 4.5, 6.5];
// pieces per tier (visual): 0 none,1 helmet,2 +chest,3 +pauldrons,4 +gauntlets+knees,5 +visor
export const TIER_PIECES = [
  [],
  ['helmet'],
  ['helmet', 'chest'],
  ['helmet', 'chest', 'pauldrons'],
  ['helmet', 'chest', 'pauldrons', 'gauntlets', 'knees'],
  ['helmet', 'chest', 'pauldrons', 'gauntlets', 'knees', 'visor'],
];
// shedding order: outside in (knees, gauntlets, pauldrons, chest, visor, helmet last)
export const SHED_ORDER = ['boots', 'knees', 'gauntlets', 'pauldrons', 'cape', 'chest', 'visor', 'helmet'];
export const TIER_METAL = [PALETTE.iron, PALETTE.iron, PALETTE.iron, PALETTE.steel, PALETTE.steel, PALETTE.blackSteel];
export const TIER_NAMES = ['Peasant', 'Iron Guard', 'Iron Guard', 'Steel Guard', 'Steel Guard', 'Black Knight'];

export function xpForLevelUp(n) { return CONFIG.xp.base + CONFIG.xp.perLevel * n; }
export function upgradeCost(n) { return Math.round(CONFIG.meta.costBase * Math.pow(CONFIG.meta.costGrowth, n)); }
export function guardHp(s, L) {
  return CONFIG.bonus.guardHpBase * Math.pow(CONFIG.bonus.guardSegGrowth, s - 1) * Math.pow(CONFIG.bonus.guardLevelGrowth, L - 1);
}
export function highestTier(L) { return Math.min(5, 1 + Math.floor(L / 4)); }
export function enemySpeedMult(L) { return 1 + Math.min(CONFIG.enemy.speedGrowthCap, CONFIG.enemy.speedGrowthPerLevel * (L - 1)); }
export function hpBudget(L) { return CONFIG.balance.hpBudgetBase * Math.pow(CONFIG.balance.budgetGrowth, L - 1); }
export function obstacleEvents(L) { return Math.min(14, 4 + 0.5 * L); }
export function obstacleDamageMult(L) { return 1 + CONFIG.balance.obstacleDamageGrowth * (L - 1); }
