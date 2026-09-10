import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { ArenaBuilder } from "./builder";
import type { ArenaLayout } from "./types";

/**
 * An original three-storey cathedral circuit. The nave, crypt, and forge are
 * distinct combat rooms; pierced walls limit sight lines between their loops.
 * Four ground ramps reach the galleries, whose two opposing ramps reach the
 * rail bridge. Everything used by a walk edge is ordinary walkable geometry.
 */
export function buildOssuary(
  scene: THREE.Scene,
  world: RAPIER.World,
): ArenaLayout {
  const b = new ArenaBuilder(scene, world);
  const vector = (x: number, floorY: number, z: number, offset = 0.9) =>
    new THREE.Vector3(x, floorY + offset, z);
  const pickups: ArenaLayout["pickups"] = [];
  const pickup = (
    kind: ArenaLayout["pickups"][number]["kind"],
    x: number,
    y: number,
    z: number,
  ) => pickups.push({ kind, position: vector(x, y, z, 0.7) });
  const chain = (...ids: string[]) => {
    for (let i = 1; i < ids.length; i++) b.link(ids[i - 1], ids[i]);
  };

  // The three rooms share a foundation, but tall masonry divides them into
  // separate encounters. Doorways occur at each end and in the undercroft.
  b.floor(0, 0, 56, 56);
  b.box("dark", 0, 8, -28, 57, 16, 1);
  b.box("dark", 0, 8, 28, 57, 16, 1);
  b.box("stone", -28, 7, 0, 1, 14, 56);
  b.box("stone", 28, 7, 0, 1, 14, 56);
  for (const side of [-1, 1]) {
    for (const [z, depth] of [
      [-25, 6],
      [-9, 10],
      [9, 10],
      [25, 6],
    ]) {
      b.box("stone", side * 10, 6.5, z, 1, 13, depth);
      b.box("trim", side * 10, 13.12, z, 1.25, 0.24, depth);
    }
    b.arch(side * 10, -18, 0, 8, 7, Math.PI / 2, side < 0 ? "ember" : "cyan");
    b.arch(side * 10, 18, 0, 8, 7, Math.PI / 2, side < 0 ? "ember" : "cyan");
    b.arch(side * 10, 0, 0, 8, 13, Math.PI / 2, side < 0 ? "ember" : "cyan");

    // Four broad continuous ramps, rather than stair collision, retain the
    // movement feel on phones. The central gallery covers a sheltered bypass.
    b.floor(side * 20, 0, 14, 14, 4, "dark");
    b.ramp(side * 21, -15, 6, 16, 0, 4, "z");
    b.ramp(side * 21, 15, 6, 16, 4, 0, "z");
    for (const x of [side * 14, side * 26]) {
      for (const z of [-6, 6]) b.pillar(x, z, 0, 3.2, 0.9);
    }
    // Gallery fascia makes the over/under route legible at a glance.
    for (const z of [-7, 7]) {
      b.box("trim", side * 20, 3.7, z, 14.1, 0.3, 0.13);
      b.box(
        side < 0 ? "ember" : "cyan",
        side * 20,
        3.86,
        z + Math.sign(z) * 0.08,
        13.4,
        0.055,
        0.025,
        { solid: false },
      );
    }
    // The outer landing is wide enough to turn a two-thumb player around.
    // A separate ascending route from each room gives the rail perch two exits.
    b.ramp(
      side * 17,
      0,
      5,
      12,
      side < 0 ? 4 : 8,
      side < 0 ? 8 : 4,
      "x",
      "metal",
    );
    b.box(side < 0 ? "ember" : "cyan", side * 20, 4.01, -5.8, 8, 0.015, 0.07, {
      solid: false,
    });
    b.box(side < 0 ? "ember" : "cyan", side * 20, 4.01, 5.8, 8, 0.015, 0.07, {
      solid: false,
    });

    // Exterior buttresses stay against the perimeter, leaving the ramp and
    // its ground-level side passage unobstructed.
    for (const z of [-23, -13, 0, 13, 23]) {
      b.pillar(side * 27.1, z, 0, 14.3, 0.95);
      b.box("bone", side * 26.6, 10.8, z, 1.4, 0.3, 1.6);
      b.box(
        side < 0 ? "ember" : "cyan",
        side * 26.55,
        6.4,
        z,
        0.035,
        5.5,
        0.16,
        { solid: false },
      );
    }
    b.box("trim", side * 27.3, 13.5, 0, 0.35, 0.3, 55);
    for (const z of [-11, 11]) {
      b.pillar(side * 7.6, z, 0, 15, 1.3);
      b.box("stone", side * 8.9, 6.5, z, 1.4, 13, 1.15);
    }
  }

  // The bridge affords long lateral shots while its underspace protects the
  // objective from overhead fire. The ends connect to opposing ramp routes.
  b.floor(0, 0, 22, 5, 8, "metal");
  for (const z of [-2.5, 2.5]) {
    b.box("trim", 0, 7.74, z, 22, 0.3, 0.14);
    b.box("ember", 0, 7.92, z + Math.sign(z) * 0.08, 21.5, 0.05, 0.025, {
      solid: false,
    });
  }
  // Tall arch silhouettes span the nave beyond the bridge, safely above play.
  b.arch(0, -11, 0, 13.8, 17, 0, "ember");
  b.arch(0, 11, 0, 13.8, 17, 0, "cyan");
  for (const z of [-27.2, 27.2]) {
    b.arch(0, z, 0, 9, 15, 0, z < 0 ? "ember" : "cyan");
    for (const x of [-22, -14, 14, 22]) b.pillar(x, z, 0, 15, 0.9);
    for (const x of [-6.4, 6.4])
      b.box(z < 0 ? "ember" : "cyan", x, 7, z, 0.13, 7, 0.08, { solid: false });
    b.box("trim", 0, 15.4, z, 55, 0.3, 0.45);
  }
  // These low reliquaries split the nave into left/right approach lanes and
  // interrupt an otherwise uninterrupted end-to-end rail sight line.
  for (const z of [-13, 13]) {
    b.box("dark", 0, 1.2, z, 4.5, 2.4, 3);
    b.box("bone", 0, 2.45, z, 4.65, 0.1, 3.15);
    b.box("ember", 0, 1.8, z + Math.sign(z) * 1.51, 2.7, 0.1, 0.025, {
      solid: false,
    });
  }

  // Each side chamber has a recognizable beacon without extra realtime
  // shadows. The reactor and its matching collider are off the walk routes.
  b.box("metal", 26.6, 1.6, 0, 1.1, 3.2, 4.8);
  for (const z of [-1.6, 0, 1.6])
    b.box("cyan", 26.02, 1.6, z, 0.025, 2.5, 0.23, { solid: false });
  for (const z of [-2.5, 2.5]) {
    b.box("bone", -26.5, 1.5, z, 1.1, 3, 1.3);
    b.box("ember", -25.94, 1.65, z, 0.025, 1.4, 0.2, { solid: false });
  }
  const cryptLight = new THREE.PointLight("#ff602b", 22, 15, 2);
  cryptLight.position.set(-21, 2.7, 0);
  scene.add(cryptLight);
  const forgeLight = new THREE.PointLight("#4fd7ed", 25, 16, 2);
  forgeLight.position.set(23, 2.6, 0);
  scene.add(forgeLight);
  b.seal(0, 0, 0, 2.25);
  b.seal(0, 8, 0, 1.2);
  b.pad("nave-lift", 0, 0, 5, 5, 8, 0, 1.5);

  // Ground nave graph: the centerline deliberately does not cross reliquaries.
  b.node("objective", 0, 0, 0);
  b.node("nave-north-health", 0, 0, -22);
  b.node("nave-south-health", 0, 0, 22);
  for (const side of [-1, 1]) {
    const prefix = side < 0 ? "west" : "east";
    for (const [label, z] of [
      ["north", -18],
      ["inner-north", -7],
      ["center", 0],
      ["inner-south", 7],
      ["south", 18],
    ] as const)
      b.node(`nave-${prefix}-${label}`, side * 5, 0, z);
    chain(
      `nave-${prefix}-north`,
      `nave-${prefix}-inner-north`,
      `nave-${prefix}-center`,
      `nave-${prefix}-inner-south`,
      `nave-${prefix}-south`,
    );
    b.link("nave-north-health", `nave-${prefix}-north`);
    b.link("nave-south-health", `nave-${prefix}-south`);
    b.link("objective", `nave-${prefix}-center`);
  }
  for (const label of ["north", "inner-north", "inner-south", "south"])
    b.link(`nave-west-${label}`, `nave-east-${label}`);

  // Side-room navigation includes separate outer ramp approaches, inner
  // ground bypasses, and gallery landings. No line-of-sight graph shortcuts.
  for (const side of [-1, 1]) {
    const p = side < 0 ? "west" : "east";
    for (const [label, z] of [
      ["north", -18],
      ["center", 0],
      ["south", 18],
    ] as const) {
      b.node(`${p}-door-${label}`, side * 10, 0, z);
      b.link(`${p}-door-${label}`, `nave-${p}-${label}`);
    }
    b.node(`${p}-undercroft`, side * 21, 0, 0);
    b.link(`${p}-undercroft`, `${p}-door-center`);
    for (const sign of [-1, 1]) {
      const end = sign < 0 ? "north" : "south";
      b.node(`${p}-bypass-${end}`, side * 16, 0, sign * 10);
      b.node(`${p}-entry-${end}`, side * 16, 0, sign * 18);
      b.node(`${p}-corner-${end}`, side * 16, 0, sign * 25);
      b.node(`${p}-ramp-approach-${end}`, side * 21, 0, sign * 25);
      b.node(`${p}-ramp-foot-${end}`, side * 21, 0, sign * 23);
      b.node(`${p}-ramp-middle-${end}`, side * 21, 2, sign * 15);
      b.node(`${p}-ramp-top-${end}`, side * 21, 4, sign * 7);
      b.node(`${p}-gallery-inner-${end}`, side * 21, 4, sign * 5);
      b.node(`${p}-gallery-outer-${end}`, side * 25, 4, sign * 5);
      chain(
        `${p}-undercroft`,
        `${p}-bypass-${end}`,
        `${p}-entry-${end}`,
        `${p}-corner-${end}`,
        `${p}-ramp-approach-${end}`,
        `${p}-ramp-foot-${end}`,
        `${p}-ramp-middle-${end}`,
        `${p}-ramp-top-${end}`,
        `${p}-gallery-inner-${end}`,
        `${p}-gallery-outer-${end}`,
      );
      b.link(`${p}-entry-${end}`, `${p}-door-${end}`);
    }
    b.node(`${p}-gallery-center`, side * 25, 4, 0);
    chain(
      `${p}-gallery-outer-north`,
      `${p}-gallery-center`,
      `${p}-gallery-outer-south`,
    );
    b.node(`${p}-upper-ramp-foot`, side * 23, 4, 0);
    b.node(`${p}-upper-ramp-middle`, side * 17, 6, 0);
    b.node(`${p}-upper-ramp-top`, side * 11, 8, 0);
    b.node(`${p}-bridge-ammo`, side * 7, 8, 0);
    chain(
      `${p}-gallery-center`,
      `${p}-upper-ramp-foot`,
      `${p}-upper-ramp-middle`,
      `${p}-upper-ramp-top`,
      `${p}-bridge-ammo`,
    );
  }
  b.node("bridge-rail", 0, 8, 0);
  b.node("bridge-drop", -5, 8, 0);
  b.node("bridge-pad-landing", 5, 8, 0);
  chain(
    "west-bridge-ammo",
    "bridge-drop",
    "bridge-rail",
    "bridge-pad-landing",
    "east-bridge-ammo",
  );
  b.node("nave-pad", 0, 0.07, 5);
  b.link("nave-pad", "nave-east-inner-south");
  b.link("nave-pad", "nave-west-inner-south");
  b.link("nave-pad", "bridge-pad-landing", "pad");
  b.link("bridge-drop", "nave-west-inner-north", "drop");

  // Spawns have explicit nodes so bots never acquire a shortcut through a
  // wall when first entering the graph. Resources sit directly on nav nodes.
  const spawnData = [
    { x: -22, y: 0, z: -25, join: "west-ramp-approach-north" },
    { x: 22, y: 0, z: 25, join: "east-ramp-approach-south" },
    { x: -16, y: 0, z: 11, join: "west-bypass-south" },
    { x: 16, y: 0, z: -11, join: "east-bypass-north" },
    { x: -5, y: 0, z: -24, join: "nave-north-health" },
    { x: 5, y: 0, z: 24, join: "nave-south-health" },
    { x: -25, y: 4, z: 4, join: "west-gallery-outer-south" },
    { x: 25, y: 4, z: -4, join: "east-gallery-outer-north" },
  ];
  spawnData.forEach((spawn, i) => {
    b.node(`spawn-${i}`, spawn.x, spawn.y, spawn.z);
    b.link(`spawn-${i}`, spawn.join);
    if (i === 6) b.link(`spawn-${i}`, "west-gallery-center");
    if (i === 7) b.link(`spawn-${i}`, "east-gallery-center");
  });
  // Opposing ground passages give mirrored spawns comparable weapon access.
  // Rail stays on the exposed upper crossing, reached from either gallery.
  pickup("rocket", -16, 0, -10);
  pickup("rail", 0, 8, 0);
  pickup("shotgun", 16, 0, 10);
  pickup("armor", -25, 4, 0);
  pickup("armor", 25, 4, 0);
  pickup("health", 0, 0, -22);
  pickup("health", 0, 0, 22);
  pickup("health", 21, 0, 0);
  pickup("health", -21, 4, 5);
  pickup("ammo", -16, 0, 10);
  pickup("ammo", 16, 0, -10);
  pickup("ammo", -7, 8, 0);
  pickup("ammo", 7, 8, 0);

  b.finish();
  return {
    id: "ossuary",
    name: "The Ossuary",
    subtitle: "Cathedral circuits · Three levels · Linked chambers",
    spawns: spawnData.map(({ x, y, z }) => vector(x, y, z)),
    waypoints: b.nodes.map((node) => node.position.clone()),
    pickups,
    powerPosition: vector(0, 0, 0, 0.7),
    jumpPads: b.pads,
    teleporters: b.portals,
    nodes: b.nodes,
    edges: b.edges,
    killY: -12,
    camera: {
      position: new THREE.Vector3(21, 23, 32),
      target: new THREE.Vector3(-1, 4.5, 0),
    },
  };
}
