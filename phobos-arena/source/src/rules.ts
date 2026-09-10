// One world unit = 40 Quake units. Simulation runs independently of rendering.
export const MOVE = {
  speed: 8,
  maxSpeed: 16,
  hopGain: 1.6,
  gravity: 20,
  jump: 6.75,
  groundAccel: 10,
  airAccel: 1,
  friction: 6,
  stopSpeed: 2.5,
  early: 0.1,
  late: 0.08,
  reset: 0.25,
};
export const STEP = 1 / 120;
// Human hitscan tolerance only: a small angular margin, bounded at long range.
export const HITSCAN_MARGIN = { angle: (0.6 * Math.PI) / 180, maxRadius: 0.15 };
export type WeaponId =
  | "melee"
  | "machinegun"
  | "rocket"
  | "rail"
  | "shotgun"
  | "lightning"
  | "grenade"
  | "plasma"
  | "bfg"
  | "nailgun"
  | "proximity"
  | "chaingun";
export interface WeaponDefinition {
  name: string;
  short: string;
  damage: number;
  cooldown: number;
  startingAmmo: number;
  color: string;
  trigger: "contact" | "hitscan" | "projectile";
  range: number;
  pickupAmmo: number;
}
export const WEAPONS: Record<WeaponId, WeaponDefinition> = {
  melee: {
    name: "Rift claw",
    short: "CLAW",
    damage: 50,
    cooldown: 0.4,
    startingAmmo: Infinity,
    color: "#ffc7b5",
    trigger: "contact",
    range: 0.91,
    pickupAmmo: Infinity,
  },
  machinegun: {
    name: "Iron repeater",
    short: "REPEATER",
    damage: 7,
    cooldown: 0.1,
    startingAmmo: 100,
    color: "#eee4d4",
    trigger: "hitscan",
    range: 120,
    pickupAmmo: 40,
  },
  rocket: {
    name: "Hellfire launcher",
    short: "HELLFIRE",
    damage: 100,
    cooldown: 0.8,
    startingAmmo: 10,
    color: "#ff784c",
    trigger: "projectile",
    range: 225,
    pickupAmmo: 10,
  },
  rail: {
    name: "Spine lance",
    short: "LANCE",
    damage: 100,
    cooldown: 1.5,
    startingAmmo: 10,
    color: "#60e5d6",
    trigger: "hitscan",
    range: 120,
    pickupAmmo: 10,
  },
  shotgun: {
    name: "Scatter reliquary",
    short: "SCATTER",
    damage: 10,
    cooldown: 1,
    startingAmmo: 10,
    color: "#f2bf72",
    trigger: "hitscan",
    range: 120,
    pickupAmmo: 10,
  },
  lightning: {
    name: "Storm tether",
    short: "TETHER",
    damage: 8,
    cooldown: 0.05,
    startingAmmo: 100,
    color: "#a9d8ff",
    trigger: "hitscan",
    range: 19.2,
    pickupAmmo: 100,
  },
  grenade: {
    name: "Cinder lobber",
    short: "CINDER",
    damage: 100,
    cooldown: 0.8,
    startingAmmo: 10,
    color: "#92b557",
    trigger: "projectile",
    range: 43.75,
    pickupAmmo: 10,
  },
  plasma: {
    name: "Wraith caster",
    short: "WRAITH",
    damage: 20,
    cooldown: 0.1,
    startingAmmo: 50,
    color: "#bd8eff",
    trigger: "projectile",
    range: 500,
    pickupAmmo: 50,
  },
  bfg: {
    name: "Absolution cannon",
    short: "ABSOLUTION",
    damage: 1000,
    cooldown: 2.5,
    startingAmmo: 20,
    color: "#e9e579",
    trigger: "projectile",
    range: 500,
    pickupAmmo: 20,
  },
  nailgun: {
    name: "Impaler",
    short: "IMPALER",
    damage: 20,
    cooldown: 1,
    startingAmmo: 10,
    color: "#c7c5d6",
    trigger: "projectile",
    range: 90,
    pickupAmmo: 10,
  },
  proximity: {
    name: "Grave seed",
    short: "GRAVE",
    damage: 0,
    cooldown: 0.8,
    startingAmmo: 5,
    color: "#ec78ad",
    trigger: "projectile",
    range: 525,
    pickupAmmo: 5,
  },
  chaingun: {
    name: "Oblivion chain",
    short: "OBLIVION",
    damage: 7,
    cooldown: 0.03,
    startingAmmo: 80,
    color: "#e69068",
    trigger: "hitscan",
    range: 102.4,
    pickupAmmo: 80,
  },
};
/** Human pickup convenience only; damage and bot weapon utility are independent. */
export const WEAPON_PICKUP_TIER: Readonly<Record<WeaponId, number>> = {
  melee: 0,
  machinegun: 1,
  rocket: 2,
  shotgun: 2,
  lightning: 2,
  grenade: 2,
  plasma: 2,
  nailgun: 2,
  proximity: 2,
  chaingun: 2,
  rail: 3,
  bfg: 4,
};
export function shouldAutoEquipPickup(current: WeaponId, pickup: WeaponId): boolean {
  return WEAPON_PICKUP_TIER[pickup] > WEAPON_PICKUP_TIER[current];
}

export const WEAPON_ORDER: WeaponId[] = [
  "melee",
  "machinegun",
  "rocket",
  "rail",
  "shotgun",
  "lightning",
  "grenade",
  "plasma",
  "bfg",
  "nailgun",
  "proximity",
  "chaingun",
];
export function isWeaponId(value: string): value is WeaponId {
  return Object.hasOwn(WEAPONS, value);
}
export function weaponRecord<T>(
  value: T | ((id: WeaponId) => T),
): Record<WeaponId, T> {
  return Object.fromEntries(
    WEAPON_ORDER.map((id) => [
      id,
      typeof value === "function" ? (value as (id: WeaponId) => T)(id) : value,
    ]),
  ) as Record<WeaponId, T>;
}
export interface Motion {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  grounded: boolean;
  tier: number;
  landedAt: number;
  groundedSince: number;
  chain: boolean;
  missApplied: boolean;
  pendingJump: number;
}
export interface MoveIntent {
  x: number;
  z: number;
  forwardX: number;
  forwardZ: number;
  jump: boolean;
}
export function newMotion(x: number, y: number, z: number): Motion {
  return {
    x,
    y,
    z,
    vx: 0,
    vy: 0,
    vz: 0,
    grounded: false,
    tier: 0,
    landedAt: -Infinity,
    groundedSince: -Infinity,
    chain: false,
    missApplied: false,
    pendingJump: -Infinity,
  };
}
export const airControl = (tier: number) =>
  Math.max(0.25, 1 - Math.min(5, tier) * 0.15);
export function land(m: Motion, time: number) {
  if (!m.grounded) {
    m.landedAt = time;
    m.groundedSince = time;
    m.missApplied = false;
  }
  m.grounded = true;
  m.vy = 0;
}
export function addHop(m: Motion, forwardX: number, forwardZ: number) {
  const speed = Math.hypot(m.vx, m.vz);
  const next = Math.min(MOVE.maxSpeed, speed + MOVE.hopGain);
  m.vx = (speed > 0.001 ? m.vx / speed : forwardX) * next;
  m.vz = (speed > 0.001 ? m.vz / speed : forwardZ) * next;
  m.tier = Math.min(5, m.tier + 1);
}
export function stepMotion(
  m: Motion,
  input: MoveIntent,
  time: number,
  dt: number,
) {
  if (input.jump) m.pendingJump = time;
  const landingAge = time - m.landedAt;
  const grace = m.chain && landingAge <= MOVE.late + 1e-8;
  if (m.grounded && m.chain && !grace && !m.missApplied) {
    m.missApplied = true;
    if (m.tier > 0) {
      m.tier--;
      const speed = Math.hypot(m.vx, m.vz);
      const reduced = Math.max(0, speed - MOVE.hopGain);
      if (speed) {
        m.vx *= reduced / speed;
        m.vz *= reduced / speed;
      }
    }
  }
  if (m.grounded && time - m.groundedSince >= MOVE.reset) {
    m.tier = 0;
    m.chain = false;
  }
  const bufferedAtLanding =
    grace &&
    m.pendingJump >= m.landedAt - MOVE.early - 1e-8 &&
    m.pendingJump <= m.landedAt + MOVE.late + 1e-8;
  if (
    m.grounded &&
    (time - m.pendingJump <= MOVE.early + 1e-8 || bufferedAtLanding)
  ) {
    if (grace && m.pendingJump >= m.landedAt - MOVE.early - 1e-8)
      addHop(m, input.forwardX, input.forwardZ);
    else if (Math.hypot(m.vx, m.vz) < 0.01) {
      m.vx = input.forwardX * MOVE.speed;
      m.vz = input.forwardZ * MOVE.speed;
    }
    m.vy = MOVE.jump;
    m.grounded = false;
    m.chain = true;
    m.pendingJump = -Infinity;
  }
  if (m.grounded && !grace) {
    const speed = Math.hypot(m.vx, m.vz);
    const reduced = Math.max(
      0,
      speed - Math.max(speed, MOVE.stopSpeed) * MOVE.friction * dt,
    );
    if (speed) {
      m.vx *= reduced / speed;
      m.vz *= reduced / speed;
    }
  }
  const length = Math.hypot(input.x, input.z);
  if (length > 0.001) {
    const x = input.x / length,
      z = input.z / length;
    const remaining = Math.max(0, MOVE.speed - (m.vx * x + m.vz * z));
    const acceleration =
      (m.grounded ? MOVE.groundAccel : MOVE.airAccel * airControl(m.tier)) *
      MOVE.speed *
      dt;
    const add = Math.min(remaining, acceleration);
    m.vx += x * add;
    m.vz += z * add;
  }
  const speed = Math.hypot(m.vx, m.vz);
  if (speed > MOVE.maxSpeed) {
    m.vx *= MOVE.maxSpeed / speed;
    m.vz *= MOVE.maxSpeed / speed;
  }
  if (!m.grounded) m.vy -= MOVE.gravity * dt;
  else m.vy = -0.25;
}
export type Power = "quad" | "immortal";
export function powerEvent(index: number) {
  return {
    at: 15 + index * 90,
    power: (index % 2 === 0 ? "quad" : "immortal") as Power,
  };
}
export function damage(
  health: number,
  armor: number,
  amount: number,
  immortal: boolean,
) {
  if (immortal) return { health, armor, dealt: 0 };
  const absorbed = Math.min(armor, Math.ceil((amount * 2) / 3));
  const remainingHealth = Math.max(0, health - amount + absorbed);
  return {
    health: remainingHealth,
    armor: armor - absorbed,
    dealt: health - remainingHealth + absorbed,
  };
}
export function readyToFire(
  now: number,
  lastShot: number,
  weapon: WeaponId,
  ammo: number,
) {
  return ammo > 0 && now - lastShot + 1e-8 >= WEAPONS[weapon].cooldown;
}
