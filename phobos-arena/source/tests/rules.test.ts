import test from "node:test";
import assert from "node:assert/strict";
import {
  MOVE,
  STEP,
  WEAPONS,
  WEAPON_ORDER,
  airControl,
  damage,
  land,
  newMotion,
  powerEvent,
  readyToFire,
  stepMotion,
  type Motion,
  type MoveIntent,
  type WeaponId,
} from "../src/rules.ts";

const idle: MoveIntent = { x: 0, z: 0, forwardX: 0, forwardZ: -1, jump: false };
const jump = { ...idle, jump: true };
const speed = (motion: Motion) => Math.hypot(motion.vx, motion.vz);
const near = (actual: number, expected: number, tolerance = 1e-8) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${actual} should equal ${expected}`,
  );

function airborne(tier = 0, velocity = MOVE.speed): Motion {
  const motion = newMotion(0, 1, 0);
  Object.assign(motion, { chain: true, tier, vz: -velocity });
  return motion;
}

test("initial takeoff preserves transferred momentum and has no hop bonus", () => {
  const motion = newMotion(0, 0, 0);
  motion.vx = 12.5; // 500 Quake units: already faster than ordinary walking.
  land(motion, 1);
  stepMotion(motion, jump, 1, STEP);
  near(speed(motion), 12.5);
  near(motion.vx, 12.5);
  near(motion.vz, 0);
  assert.equal(motion.tier, 0);
  assert.equal(motion.grounded, false);
});

test("five timed landing hops reach twice base speed and 25% air control", () => {
  const motion = airborne();
  const expectedSpeeds = [9.6, 11.2, 12.8, 14.4, 16, 16];
  const expectedAir = [0.85, 0.7, 0.55, 0.4, 0.25, 0.25];
  for (let index = 0; index < expectedSpeeds.length; index++) {
    const time = index + 1;
    land(motion, time);
    stepMotion(motion, jump, time, STEP);
    near(speed(motion), expectedSpeeds[index]);
    near(airControl(motion.tier), expectedAir[index]);
  }
});

test("a hop adds to remaining velocity without restoring collision losses", () => {
  const motion = airborne(4, 2.5); // A collision reduced horizontal speed to 100 Quake units.
  land(motion, 2);
  stepMotion(motion, jump, 2, STEP);
  near(speed(motion), 4.1);
  assert.equal(motion.tier, 5);
});

test("valid early jump is consumed once and does not cause another automatic hop", () => {
  const motion = airborne();
  stepMotion(motion, jump, 0.95, STEP);
  land(motion, 1);
  stepMotion(motion, idle, 1, STEP);
  assert.equal(motion.tier, 1);
  assert.equal(motion.grounded, false);
  assert.equal(motion.pendingJump, -Infinity);
  land(motion, 2);
  stepMotion(motion, idle, 2, STEP);
  assert.equal(motion.grounded, true);
  assert.equal(motion.tier, 1);
});

test("early landing window accepts 100 ms and rejects an older tap", () => {
  for (const [lead, expectedJump] of [
    [0.1, true],
    [0.101, false],
  ] as const) {
    const motion = airborne();
    stepMotion(motion, jump, 1 - lead, STEP);
    land(motion, 1);
    stepMotion(motion, idle, 1, STEP);
    assert.equal(!motion.grounded, expectedJump, `tap ${lead}s before landing`);
    assert.equal(motion.tier, expectedJump ? 1 : 0);
  }
});

test("a buffered tap valid at landing remains valid when consumed on the next simulation tick", () => {
  const motion = airborne();
  stepMotion(motion, jump, 0.9, STEP);
  land(motion, 1);
  stepMotion(motion, idle, 1 + STEP, STEP);
  assert.equal(motion.grounded, false);
  assert.equal(motion.tier, 1);
  near(speed(motion), 9.6);
});

test("late landing window accepts 80 ms, but a later tap breaks the chain by one tier", () => {
  for (const [delay, expectedTier, expectedSpeed] of [
    [0.08, 3, 12.8],
    [0.081, 1, 9.6],
  ] as const) {
    const motion = airborne(2, 11.2);
    land(motion, 1);
    stepMotion(motion, jump, 1 + delay, STEP);
    assert.equal(motion.tier, expectedTier);
    near(speed(motion), expectedSpeed);
    assert.equal(motion.grounded, false);
  }
});

test("a missed landing removes one tier only, then continuous grounding resets it", () => {
  const motion = airborne(5, 16);
  land(motion, 1);
  stepMotion(motion, idle, 1.081, STEP);
  assert.equal(motion.tier, 4);
  const afterMiss = speed(motion);
  stepMotion(motion, idle, 1.15, STEP);
  assert.equal(motion.tier, 4);
  assert.ok(
    speed(motion) < afterMiss,
    "ordinary friction resumes after the missed landing",
  );
  stepMotion(motion, idle, 1.25, STEP);
  assert.equal(motion.tier, 0);
  assert.equal(motion.chain, false);
  assert.equal(airControl(motion.tier), 1);
});

test("movement intent is full-speed regardless of stick displacement and diagonal input", () => {
  const simulate = (x: number, z: number) => {
    const motion = newMotion(0, 0, 0);
    land(motion, 0);
    for (let tick = 0; tick < 120; tick++) {
      stepMotion(motion, { ...idle, x, z }, tick * STEP, STEP);
    }
    return speed(motion);
  };
  near(simulate(0, -0.1), MOVE.speed);
  near(simulate(0, -1), MOVE.speed);
  near(simulate(1, -1), MOVE.speed);
});

test("air steering respects the speed cap and reduces acceleration at high hop tiers", () => {
  const normal = airborne(0, 8);
  const capped = airborne(5, 16);
  const strafe = { ...idle, x: 1 };
  stepMotion(normal, strafe, 1, STEP);
  stepMotion(capped, strafe, 1, STEP);
  assert.ok(speed(capped) <= 16 + 1e-8);
  assert.ok(capped.vx > 0 && capped.vx <= normal.vx * 0.25 + 1e-8);
  const boosted = airborne(0, 22);
  stepMotion(boosted, idle, 1, STEP);
  near(speed(boosted), 16);
});

test("fixed-step movement is unchanged by 30, 60, 90, or 120 Hz render scheduling", () => {
  const simulate = (renderHz: number) => {
    const motion = airborne(2, 11.2);
    let accumulator = 0,
      tick = 0;
    for (let frame = 0; frame < renderHz; frame++) {
      accumulator += 1 / renderHz;
      while (accumulator + 1e-10 >= STEP) {
        stepMotion(motion, { ...idle, x: 1 }, tick++ * STEP, STEP);
        accumulator -= STEP;
      }
    }
    return { vx: motion.vx, vy: motion.vy, vz: motion.vz, tick };
  };
  const reference = simulate(120);
  for (const renderHz of [30, 60, 90])
    assert.deepEqual(simulate(renderHz), reference);
});

test("cooldowns survive switching and prevent contact melee from hitting each tick", () => {
  const shots = Object.fromEntries(
    WEAPON_ORDER.map((id) => [id, -Infinity]),
  ) as Record<WeaponId, number>;
  shots.rail = 1;
  assert.equal(readyToFire(1.1, shots.rocket, "rocket", 10), true);
  shots.rocket = 1.1;
  assert.equal(readyToFire(1.2, shots.rail, "rail", 9), false);
  assert.equal(readyToFire(2.5, shots.rail, "rail", 9), true);
  assert.equal(readyToFire(3, shots.rail, "rail", 0), false);
  let meleeHits = 0;
  for (let tick = 0; tick <= 96; tick++) {
    const now = tick * STEP;
    if (readyToFire(now, shots.melee, "melee", Infinity)) {
      meleeHits++;
      shots.melee = now;
    }
  }
  assert.equal(meleeHits, 3, "contact attacks at 0, .4, and .8 seconds");
});

test("armor absorption and Quad damage preserve Immortality health and armor", () => {
  assert.deepEqual(damage(100, 50, 30, false), {
    health: 90,
    armor: 30,
    dealt: 30,
  });
  assert.deepEqual(damage(100, 0, WEAPONS.machinegun.damage * 4, false), {
    health: 72,
    armor: 0,
    dealt: 28,
  });
  assert.deepEqual(damage(100, 50, WEAPONS.rail.damage * 4, true), {
    health: 100,
    armor: 50,
    dealt: 0,
  });
  assert.deepEqual(damage(100, 0, WEAPONS.melee.damage, false), {
    health: 50,
    armor: 0,
    dealt: 50,
  });
});

test("reported damage excludes overkill when the victim still has armor", () => {
  const result = damage(1, 100, 30, false);
  assert.equal(result.health, 0);
  assert.equal(result.armor, 80);
  assert.equal(
    result.dealt,
    21,
    "one health and twenty armor were actually removed",
  );
});

test("power-up schedule starts at 15 seconds and alternates on the fixed 90-second clock", () => {
  assert.deepEqual([0, 1, 2, 3].map(powerEvent), [
    { at: 15, power: "quad" },
    { at: 105, power: "immortal" },
    { at: 195, power: "quad" },
    { at: 285, power: "immortal" },
  ]);
});


