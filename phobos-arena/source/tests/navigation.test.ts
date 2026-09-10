import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { ArenaNavigator } from "../src/navigation.ts";
import type { ArenaLayout, NavNode } from "../src/maps/types.ts";

const physicsReady = RAPIER.init();
const STEP = 1 / 120;
const rotation = { x: 0, y: 0, z: 0, w: 1 };
const capsule = () => new RAPIER.Capsule(0.5, 0.35);
const point = (p: THREE.Vector3) =>
  `(${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)})`;

async function mapFixture(id: "ossuary" | "rift") {
  await physicsReady;
  const world = new RAPIER.World({ x: 0, y: -20, z: 0 });
  world.timestep = STEP;
  const scene = new THREE.Scene();
  const map =
    id === "ossuary"
      ? (await import("../src/maps/ossuary.ts")).buildOssuary(scene, world)
      : (await import("../src/maps/rift.ts")).buildRift(scene, world);
  world.step();
  return {
    world,
    map,
    navigator: new ArenaNavigator(map, world),
    dispose() {
      const geometries = new Set<THREE.BufferGeometry>(),
        materials = new Set<THREE.Material>();
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.geometry) geometries.add(mesh.geometry);
        for (const material of Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material])
          if (material) materials.add(material);
      });
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      world.free();
    },
  };
}

function support(
  world: RAPIER.World,
  position: THREE.Vector3,
  distance = 1.25,
) {
  return world.castRay(
    new RAPIER.Ray(position, { x: 0, y: -1, z: 0 }),
    distance,
    true,
    RAPIER.QueryFilterFlags.ONLY_FIXED,
  );
}

/** The actual gameplay capsule/controller, moving against the authored collision world. */
function walker(world: RAPIER.World, start: THREE.Vector3) {
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
      start.x,
      start.y,
      start.z,
    ),
  );
  const collider = world.createCollider(
    RAPIER.ColliderDesc.capsule(0.5, 0.35),
    body,
  );
  const controller = world.createCharacterController(0.015);
  controller.setMaxSlopeClimbAngle(Math.PI / 3);
  controller.setMinSlopeSlideAngle(Math.PI / 3);
  controller.enableAutostep(0.28, 0.3, false);
  controller.enableSnapToGround(0.16);
  const position = start.clone();
  world.step();
  const move = (delta: THREE.Vector3, flying = false) => {
    if (flying) controller.disableSnapToGround();
    else controller.enableSnapToGround(0.16);
    controller.computeColliderMovement(
      collider,
      delta,
      RAPIER.QueryFilterFlags.ONLY_FIXED,
    );
    position.add(controller.computedMovement());
    body.setNextKinematicTranslation(position);
    world.step();
  };
  return {
    position,
    controller,
    move,
    dispose() {
      world.removeCharacterController(controller);
      world.removeRigidBody(body);
      world.step();
    },
  };
}

for (const id of ["ossuary", "rift"] as const) {
  test(`${id}: every spawn, pickup and elevation belongs to a strongly connected traversal graph`, async (t) => {
    const f = await mapFixture(id);
    t.after(() => f.dispose());
    const { map, navigator } = f;
    assert.ok(map.nodes.length > 0, "arena has authored route junctions");
    assert.equal(
      new Set(map.nodes.map((node) => node.id)).size,
      map.nodes.length,
      "node IDs are unique",
    );
    for (const source of map.nodes)
      for (const target of map.nodes) {
        const route = navigator.path(source.id, target.id);
        assert.ok(route.length, `${id}: no route ${source.id} → ${target.id}`);
        assert.equal(route[0].id, source.id);
        assert.equal(route.at(-1)?.id, target.id);
      }
    for (const [label, position] of [
      ...map.spawns.map((position, i) => [`spawn ${i}`, position] as const),
      ...map.pickups.map(
        (pickup, i) => [`${pickup.kind} pickup ${i}`, pickup.position] as const,
      ),
      ["power-up", map.powerPosition] as const,
    ]) {
      const nearest = navigator.nearest(position);
      assert.ok(
        nearest &&
          Math.hypot(
            nearest.position.x - position.x,
            nearest.position.z - position.z,
          ) < 2.1 &&
          Math.abs(nearest.position.y - position.y) < 1.5,
        `${id}: ${label} ${point(position)} has no reachable nearby graph node`,
      );
    }
  });

  test(`${id}: navigation nodes and spawn capsules are supported and clear of masonry`, async (t) => {
    const f = await mapFixture(id);
    t.after(() => f.dispose());
    const positions = [
      ...f.map.nodes.map((node) => [node.id, node.position] as const),
      ...f.map.spawns.map((position, i) => [`spawn ${i}`, position] as const),
    ];
    const failures: string[] = [];
    for (const [label, position] of positions) {
      if (!support(f.world, position))
        failures.push(`${label} ${point(position)} has no supporting floor`);
      if (
        f.world.intersectionWithShape(
          position,
          rotation,
          capsule(),
          RAPIER.QueryFilterFlags.ONLY_FIXED,
        )
      )
        failures.push(`${label} ${point(position)} intersects solid geometry`);
    }
    assert.deepEqual(failures, [], failures.join("\n"));
  });

  test(`${id}: every walk edge has continuous support and is traversable by the real controller`, async (t) => {
    const f = await mapFixture(id);
    t.after(() => f.dispose());
    const failures: string[] = [];
    for (const edge of f.map.edges.filter((edge) => edge.kind === "walk")) {
      const from = f.navigator.nodes.get(edge.from)!,
        to = f.navigator.nodes.get(edge.to)!;
      const label = `${edge.from} → ${edge.to}`;
      const distance = from.position.distanceTo(to.position);
      // A declared link cannot cross a hole just because both ends have floors.
      for (let step = 0; step <= Math.ceil(distance / 0.2); step++) {
        const position = from.position
          .clone()
          .lerp(to.position, step / Math.ceil(distance / 0.2));
        if (!support(f.world, position, 1.25)) {
          failures.push(`${label}: unsupported path at ${point(position)}`);
          break;
        }
      }
      const actor = walker(f.world, from.position);
      try {
        for (let i = 0; i < 12; i++) actor.move(new THREE.Vector3(0, -0.06, 0));
        let reached = false;
        for (
          let tick = 0;
          tick < Math.ceil(distance / 4 / STEP) * 2 + 120;
          tick++
        ) {
          const delta = to.position.clone().sub(actor.position);
          const horizontal = Math.hypot(delta.x, delta.z);
          if (horizontal < 0.22 && Math.abs(delta.y) < 0.35) {
            reached = true;
            break;
          }
          if (actor.position.y < Math.min(from.position.y, to.position.y) - 1)
            break;
          const speed = Math.min(4 * STEP, horizontal);
          // A small downward step matches gravity during a grounded gameplay tick;
          // a large forced descent would incorrectly prevent the controller's autostep.
          actor.move(
            new THREE.Vector3(
              horizontal ? (delta.x / horizontal) * speed : 0,
              -0.002,
              horizontal ? (delta.z / horizontal) * speed : 0,
            ),
          );
        }
        if (!reached)
          failures.push(
            `${label}: capsule stopped at ${point(actor.position)}, target ${point(to.position)}`,
          );
      } finally {
        actor.dispose();
      }
    }
    assert.deepEqual(failures, [], failures.join("\n"));
  });

  test(`${id}: jump pads deliver a real capsule to their declared landing without wall or ceiling interception`, async (t) => {
    const f = await mapFixture(id);
    t.after(() => f.dispose());
    const failures: string[] = [];
    for (const pad of f.map.jumpPads) {
      const start = pad.position.clone();
      start.y += 0.85;
      const actor = walker(f.world, start);
      const velocity = pad.velocity.clone();
      try {
        for (let i = 0; i < 12; i++) actor.move(new THREE.Vector3(0, -0.06, 0));
        let intercepted = false;
        for (let tick = 0; tick < Math.ceil(pad.flightTime / STEP); tick++) {
          velocity.y -= 20 * STEP;
          actor.move(velocity.clone().multiplyScalar(STEP), velocity.y > 0);
          for (let c = 0; c < actor.controller.numComputedCollisions(); c++) {
            const normal = actor.controller.computedCollision(c)!.normal1;
            if (normal.y < -0.5 || Math.abs(normal.y) < 0.7) intercepted = true;
          }
        }
        if (intercepted)
          failures.push(`${pad.id}: launch path hits wall or ceiling`);
        if (
          Math.hypot(
            actor.position.x - pad.landing.x,
            actor.position.z - pad.landing.z,
          ) > 0.8 ||
          Math.abs(actor.position.y - pad.landing.y) > 0.45
        )
          failures.push(
            `${pad.id}: landed at ${point(actor.position)}, expected ${point(pad.landing)}`,
          );
        if (!support(f.world, actor.position, 1.35))
          failures.push(
            `${pad.id}: no actual floor under landing ${point(actor.position)}`,
          );
      } finally {
        actor.dispose();
      }
    }
    assert.deepEqual(failures, [], failures.join("\n"));
  });

  test(`${id}: teleporter entrance and exit capsules have a clear supported arrival`, async (t) => {
    const f = await mapFixture(id);
    t.after(() => f.dispose());
    for (const portal of f.map.teleporters)
      for (const [label, position] of [
        ["entrance", portal.position],
        ["exit", portal.destination],
      ] as const) {
        assert.ok(
          support(f.world, position),
          `${portal.id} ${label} has no floor`,
        );
        assert.equal(
          f.world.intersectionWithShape(
            position,
            rotation,
            capsule(),
            RAPIER.QueryFilterFlags.ONLY_FIXED,
          ),
          null,
          `${portal.id} ${label} ${point(position)} puts a capsule inside solid geometry`,
        );
      }
  });
}

function tinyLayout(
  nodes: NavNode[],
  edges: ArenaLayout["edges"],
): ArenaLayout {
  return {
    id: "ossuary",
    name: "Navigation regression",
    subtitle: "",
    nodes,
    edges,
    spawns: [],
    waypoints: [],
    pickups: [],
    powerPosition: new THREE.Vector3(),
    jumpPads: [],
    teleporters: [],
    killY: -20,
    camera: { position: new THREE.Vector3(), target: new THREE.Vector3() },
  };
}

test("pathfinding respects directed shortcuts and does not invent a route to a disconnected floor", async (t) => {
  await physicsReady;
  const world = new RAPIER.World({ x: 0, y: -20, z: 0 });
  t.after(() => world.free());
  const nodes = [
    { id: "low", position: new THREE.Vector3(0, 0.9, 0) },
    { id: "ramp", position: new THREE.Vector3(8, 3.9, 0) },
    { id: "high", position: new THREE.Vector3(0, 6.9, 0) },
    { id: "island", position: new THREE.Vector3(0, 20.9, 0) },
  ];
  const navigator = new ArenaNavigator(
    tinyLayout(nodes, [
      { from: "low", to: "ramp", kind: "walk" },
      { from: "ramp", to: "high", kind: "walk" },
      { from: "high", to: "low", kind: "drop" },
    ]),
    world,
  );
  assert.deepEqual(
    navigator.path("low", "high").map((node) => node.id),
    ["low", "ramp", "high"],
  );
  assert.deepEqual(
    navigator.path("high", "low").map((node) => node.id),
    ["high", "low"],
  );
  assert.deepEqual(navigator.path("low", "island"), []);
  assert.deepEqual(navigator.path("island", "low"), []);
  assert.equal(
    navigator.nearest(new THREE.Vector3(0, 6.8, 0))?.id,
    "high",
    "overlapping floors retain their height identity",
  );
});

test("safeStrafe rejects walls, low and overhead obstructions, floor drops and void gaps", async (t) => {
  await physicsReady;
  const cases = [
    { name: "clear floor", expected: true, boxes: [[0, -0.5, 0, 10, 1, 10]] },
    {
      name: "full wall",
      expected: false,
      boxes: [
        [0, -0.5, 0, 10, 1, 10],
        [1, 1, 0, 0.2, 2, 3],
      ],
    },
    {
      name: "knee-height blocker",
      expected: false,
      boxes: [
        [0, -0.5, 0, 10, 1, 10],
        [1, 0.3, 0, 0.2, 0.6, 3],
      ],
    },
    {
      name: "head-height beam",
      expected: false,
      boxes: [
        [0, -0.5, 0, 10, 1, 10],
        [1, 1.6, 0, 0.2, 0.4, 3],
      ],
    },
    {
      name: "ledge to lower floor",
      expected: false,
      boxes: [
        [-0.5, -0.5, 0, 2, 1, 4],
        [2.5, -1.2, 0, 4, 1, 4],
      ],
    },
    { name: "open void", expected: false, boxes: [[-0.5, -0.5, 0, 2, 1, 4]] },
    {
      name: "gap between support samples",
      expected: false,
      boxes: [
        [-0.5, -0.5, 0, 1.8, 1, 4],
        [2.5, -0.5, 0, 3.4, 1, 4],
      ],
    },
  ];
  for (const scenario of cases) {
    const world = new RAPIER.World({ x: 0, y: -20, z: 0 });
    try {
      for (const [x, y, z, width, height, depth] of scenario.boxes)
        world.createCollider(
          RAPIER.ColliderDesc.cuboid(
            width / 2,
            height / 2,
            depth / 2,
          ).setTranslation(x, y, z),
        );
      world.step();
      const navigator = new ArenaNavigator(tinyLayout([], []), world);
      assert.equal(
        navigator.safeStrafe(new THREE.Vector3(0, 0.9, 0), 1, 0),
        scenario.expected,
        scenario.name,
      );
    } finally {
      world.free();
    }
  }
});
