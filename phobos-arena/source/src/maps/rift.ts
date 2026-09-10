import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { ArenaBuilder, type MaterialKey } from "./builder";
import type { ArenaLayout } from "./types";

/** Four suspended foundries, connected by three different northbound climbs. */
export function buildRift(
  scene: THREE.Scene,
  world: RAPIER.World,
): ArenaLayout {
  const b = new ArenaBuilder(scene, world, true);
  const island = (
    x: number,
    z: number,
    w: number,
    d: number,
    y: number,
    accent: MaterialKey,
  ) => {
    b.floor(x, z, w, d, y);
    b.box("dark", x, y - 2, z, w - 0.5, 3.2, d - 0.5);
    b.box("metal", x, y - 3.65, z, w - 2.2, 0.5, d - 2.2);
    for (const side of [-1, 1]) {
      // The original outer trim faces coincide with the floor slab's sides.
      // Only the rendered band protrudes; its collider remains unchanged.
      b.box("trim", x + side * (w / 2 - 0.25), y - 0.6, z, 0.5, 0.35, d, {
        renderOutset: 0.01,
      });
      b.box(
        accent,
        x + side * (w / 2 + 0.012),
        y - 1.05,
        z,
        0.04,
        0.07,
        d - 2,
        { solid: false },
      );
      b.box("trim", x, y - 0.6, z + side * (d / 2 - 0.25), w, 0.35, 0.5, {
        renderOutset: 0.01,
      });
      for (let off = -d / 2 + 3; off < d / 2; off += 5) {
        b.box(
          "metal",
          x + side * (w / 2 - 1.2),
          y - 3.6,
          z + off,
          0.85,
          5,
          1.2,
          { rz: -side * 0.23 },
        );
        b.box(
          accent,
          x + side * (w / 2 - 0.85),
          y - 3.1,
          z + off,
          0.13,
          2.5,
          0.15,
          { solid: false },
        );
      }
    }
  };
  const rail = (
    x: number,
    z: number,
    width: number,
    depth: number,
    y: number,
    accent: MaterialKey,
  ) => {
    b.box("metal", x, y + 0.4, z, width, 0.8, depth);
    b.box(accent, x, y + 0.82, z, width, 0.045, depth, { solid: false });
  };
  const bridge = (
    x: number,
    z: number,
    w: number,
    d: number,
    y: number,
    accent: MaterialKey,
  ) => {
    b.floor(x, z, w, d, y, "metal");
    // Edge paint keeps exposed drops readable; breaks in the rails allow deliberate drops.
    b.box(accent, x, y + 0.013, z - d / 2 + 0.12, w, 0.026, 0.07, {
      solid: false,
    });
    b.box(accent, x, y + 0.013, z + d / 2 - 0.12, w, 0.026, 0.07, {
      solid: false,
    });
    for (const s of [-1, 1])
      rail(x, z + s * (d / 2 - 0.12), w * 0.45, 0.15, y, accent);
    b.box("trim", x, y - 1.1, z, w + 0.2, 0.35, 0.8);
  };

  // Each island has a real underside. The gaps remain open all the way to the kill plane.
  island(-21, 2, 14, 32, 0, "cyan");
  island(0, 6, 16, 24, 4, "ember");
  island(21, 2, 14, 32, 4, "ember");
  island(0, -21, 16, 14, 8, "violet");

  // Twin lower-west approaches, twin level eastern bridges, and a central high approach.
  for (const z of [-3, 8]) {
    b.ramp(-12, z, 5, 8, 0, 4, "x", "metal");
    for (const side of [-1, 1])
      b.box("cyan", -12, 2.04, z + side * 2.35, 8.95, 0.035, 0.075, {
        rz: Math.atan2(4, 8),
        solid: false,
      });
  }
  bridge(11, -3, 6, 5, 4, "ember");
  bridge(11, 9, 6, 5, 4, "ember");
  b.ramp(0, -10, 5, 8, 8, 4, "z");
  // Outer ramps create long, dependable alternatives to the jump-pad route to the rail forge.
  b.ramp(-22, -18, 5, 12, 8, 0, "z", "metal");
  bridge(-15, -26, 14, 4, 8, "cyan");
  // These landings overlap the bridges; separate their rendered top faces only.
  b.floor(-22, -25, 5, 2, 8, "metal", { renderTopLift: 0.01 });
  b.ramp(22, -16, 5, 12, 8, 4, "z", "metal");
  bridge(15, -24, 14, 4, 8, "ember");
  b.floor(22, -23, 5, 2, 8, "metal", { renderTopLift: 0.01 });
  for (const x of [-22, 22]) {
    b.box("metal", x, -4, -19, 1.2, 5, 1.2, { solid: false });
    b.box("violet", x, -4, -19, 0.13, 3.5, 1.3, { solid: false });
  }

  // Sheltered western foundry: roof, outer masonry, inset machinery, and offset entrances.
  b.box("stone", -27.5, 3, 2, 1, 6, 32);
  b.box("dark", -23, 5.7, 3, 10, 0.7, 22, { renderOutset: 0.01 });
  b.box("stone", -18.5, 2.4, 1, 0.8, 4.8, 4);
  b.box("stone", -18.5, 2.4, 13, 0.8, 4.8, 6);
  b.box("metal", -24, 1.7, 4, 3, 3.4, 4);
  b.box("trim", -24, 3.5, 4, 3.3, 0.25, 4.3);
  for (const z of [-7, 3, 13]) {
    b.box("metal", -23, 5.2, z, 9.3, 0.4, 0.6);
    b.box("cyan", -23, 4.97, z, 5.5, 0.035, 0.13, { solid: false });
  }
  for (const z of [-8, 14]) b.pillar(-26, z, 0, 5.3, 1.1);
  for (const z of [2.5, 3.5, 4.5, 5.5])
    b.box("cyan", -22.47, 1.8, z, 0.04, 1.5, 0.14, { solid: false });
  b.arch(-16, 8, 0, 5, 6, Math.PI / 2, "cyan");

  // The east hall blocks long rail lines with a complete canopy and a turbine bank.
  b.box("stone", 27.5, 7.4, 2, 1, 6.8, 32);
  b.box("dark", 23, 10, 3, 10, 0.7, 24, { renderOutset: 0.01 });
  b.box("stone", 18.5, 6.5, 2, 0.8, 5, 5);
  b.box("metal", 25, 6.1, 3, 3, 4.2, 7);
  b.box("trim", 25, 8.3, 3, 3.2, 0.25, 7.2);
  for (const z of [-7, 3, 13]) {
    b.box("metal", 23, 9.5, z, 9.3, 0.4, 0.6);
    b.box("ember", 23, 9.26, z, 5.5, 0.035, 0.13, { solid: false });
  }
  for (const z of [-9, 14]) b.pillar(26, z, 4, 5.65, 1.1);
  for (const z of [0.5, 2, 3.5, 5]) {
    b.box("dark", 23.43, 6.1, z, 0.18, 2.8, 1.1);
    b.box("ember", 23.32, 6.1, z, 0.035, 2, 0.14, { solid: false });
  }
  b.arch(16, 9, 4, 5, 6, Math.PI / 2, "ember");

  // Split central reactor gives the neutral objective several approaches and nearby cover.
  b.box("dark", 0, 7.4, 0, 2.8, 6.8, 2.8);
  b.box("trim", 0, 10.9, 0, 3.2, 0.3, 3.2);
  for (const x of [-4.5, 4.5]) {
    b.box("stone", x, 5.55, 3, 1.2, 3.1, 6);
    b.box("trim", x, 7.15, 3, 1.4, 0.15, 6.2);
    b.box("ember", x, 7.26, 3, 0.12, 0.04, 5.5, { solid: false });
  }
  for (const sign of [-1, 1]) {
    b.box("ember", sign * 1.42, 7.4, 0, 0.035, 4.5, 0.2, { solid: false });
    b.pillar(sign * 6.5, 15, 4, 4.5, 1.2);
    rail(sign * 5.8, 17.7, 3.4, 0.2, 4, "ember");
  }
  b.seal(0, 4, 9, 2.1);
  b.box("metal", 0, 3.4, 18.4, 8, 0.3, 0.65, { solid: false });

  // A high rail perch with flanking blast walls. The narrow direct approach is exposed.
  for (const sign of [-1, 1]) {
    b.box("stone", sign * 5, 9.6, -19, 3, 3.2, 5);
    b.box("bone", sign * 5, 11.3, -19, 3.3, 0.2, 5.3);
    b.box("violet", sign * 3.47, 9.6, -19, 0.035, 1.7, 2.4, { solid: false });
    b.pillar(sign * 6.4, -27, 8, 4.8, 1);
    rail(sign * 5, -14.2, 5.4, 0.2, 8, "violet");
  }
  b.box("stone", 0, 9.1, -27.5, 10, 2.2, 1);
  b.box("violet", 0, 10.24, -27.5, 7.5, 0.05, 0.6, { solid: false });
  b.seal(0, 8, -25, 1.25);

  // Shortcuts are explicitly represented in the graph; ordinary walk edges never cross voids.
  // Both shortcuts stay below the shared 16 m/s horizontal momentum cap.
  b.pad("rift-ascend", 0, 4, 15, 0, 8, -19, 2.2);
  b.pad("rift-cross", -17, 0, -11, 3, 4, 12, 2);
  b.portal("rift-west-gate", -25, 0, 10, 24, 4, -8, Math.PI / 2);
  b.portal("rift-east-gate", 25, 4, 11, -24, 0, -8, -Math.PI / 2);

  // Floor heights are supplied here; the builder adds the shared 0.9 m actor-center offset.
  const n = (id: string, x: number, y: number, z: number) =>
    b.node(id, x, y, z);
  n("w-north", -23, 0, -10);
  n("w-exit", -24, 0, -8);
  n("w-front", -23, 0, -3);
  n("w-middle", -20.5, 0, 4);
  n("w-south", -22, 0, 14);
  n("w-spawn-south", -24, 0, 16);
  n("w-portal", -25, 0, 10);
  n("w-pad", -17, 0.07, -11);
  n("w-bridge-n", -16, 0, -3);
  n("w-bridge-s", -16, 0, 8);
  n("w-ramp-n", -12, 2, -3);
  n("w-ramp-s", -12, 2, 8);
  // The steep outer climb needs 5 cm extra capsule clearance above its centerline plane.
  n("w-climb-bottom", -22, 0.05, -12);
  n("w-climb-mid", -22, 4.05, -18);
  n("w-climb-top", -22, 8, -24);
  n("nw-corner", -22, 8, -26);
  n("nw-bridge", -15, 8, -26);
  n("nw-entry", -8, 8, -26);

  n("c-west-n", -6, 4, -3);
  n("c-west-s", -6, 4, 8);
  n("c-west-edge-n", -8, 4, -3);
  n("c-west-edge-s", -8, 4, 8);
  n("c-east-n", 6, 4, -3);
  n("c-east-s", 6, 4, 9);
  n("c-north", 0, 4, -5);
  n("c-inner-west", -2.8, 4, 3);
  n("c-inner-east", 2.8, 4, 3);
  n("c-power", 0, 4, 9);
  n("c-south", 0, 4, 12);
  n("c-pad", 0, 4.07, 15);
  n("c-pad-landing", 3, 4, 12);
  n("c-spawn", -3, 4, 16);
  n("c-nw-bend", -2.8, 4, -2.7);
  n("c-ne-bend", 2.8, 4, -2.7);
  n("c-climb-bottom", 0, 4, -6);
  n("c-climb-mid", 0, 6, -10);

  n("e-bridge-n", 11, 4, -3);
  n("e-bridge-s", 11, 4, 9);
  n("e-gate-n", 16, 4, -3);
  n("e-gate-s", 16, 4, 9);
  n("e-north", 21, 4, -4);
  n("e-exit", 24, 4, -8);
  n("e-middle", 21, 4, 3);
  n("e-south", 22, 4, 13);
  n("e-spawn-south", 24, 4, 16);
  n("e-portal", 25, 4, 11);
  n("e-climb-bottom", 22, 4, -10);
  n("e-climb-mid", 22, 6, -16);
  n("e-climb-top", 22, 8, -22);
  n("ne-corner", 22, 8, -24);
  n("ne-bridge", 15, 8, -24);
  n("ne-entry", 7, 8, -24);

  n("n-west", -6, 8, -25);
  n("n-rail", 0, 8, -25);
  n("n-center", 0, 8, -22);
  n("n-pad-landing", 0, 8, -19);
  n("n-front", 0, 8, -15);
  n("n-climb-top", 0, 8, -14);
  const walk = (...ids: string[]) => {
    for (let i = 1; i < ids.length; i++) b.link(ids[i - 1], ids[i]);
  };
  walk("w-north", "w-exit", "w-front", "w-middle", "w-south", "w-spawn-south");
  walk("w-south", "w-portal");
  walk("w-north", "w-pad");
  walk("w-front", "w-bridge-n", "w-ramp-n", "c-west-edge-n", "c-west-n");
  walk("w-middle", "w-bridge-s", "w-ramp-s", "c-west-edge-s", "c-west-s");
  walk(
    "w-north",
    "w-climb-bottom",
    "w-climb-mid",
    "w-climb-top",
    "nw-corner",
    "nw-bridge",
    "nw-entry",
    "n-west",
    "n-rail",
  );

  walk("c-west-n", "c-west-s", "c-spawn", "c-pad", "c-south", "c-power");
  walk(
    "c-west-n",
    "c-nw-bend",
    "c-north",
    "c-ne-bend",
    "c-east-n",
    "c-east-s",
    "c-pad-landing",
    "c-south",
  );
  walk("c-nw-bend", "c-inner-west", "c-power", "c-inner-east", "c-ne-bend");
  walk("c-west-s", "c-power", "c-east-s");
  walk(
    "c-north",
    "c-climb-bottom",
    "c-climb-mid",
    "n-climb-top",
    "n-front",
    "n-pad-landing",
    "n-center",
    "n-rail",
  );

  walk(
    "c-east-n",
    "e-bridge-n",
    "e-gate-n",
    "e-north",
    "e-middle",
    "e-south",
    "e-spawn-south",
  );
  walk("c-east-s", "e-bridge-s", "e-gate-s", "e-south", "e-portal");
  walk(
    "e-north",
    "e-exit",
    "e-climb-bottom",
    "e-climb-mid",
    "e-climb-top",
    "ne-corner",
    "ne-bridge",
    "ne-entry",
    "n-rail",
  );
  b.link("c-pad", "n-pad-landing", "pad");
  b.link("w-pad", "c-pad-landing", "pad");
  b.link("w-portal", "e-exit", "teleport");
  b.link("e-portal", "w-exit", "teleport");
  // No blind drop edges: every high route also has a supported route back down.

  const position = (id: string) =>
    b.nodes.find((node) => node.id === id)!.position.clone();
  const pickup = (
    kind: ArenaLayout["pickups"][number]["kind"],
    id: string,
  ) => ({ kind, position: position(id).add(new THREE.Vector3(0, -0.15, 0)) });
  b.finish();
  return {
    id: "rift",
    name: "Rift Foundry",
    subtitle: "Four islands · Three levels · Open void",
    spawns: [
      "w-north",
      "w-spawn-south",
      "w-south",
      "c-spawn",
      "e-exit",
      "e-spawn-south",
      "e-south",
      "n-west",
    ].map(position),
    waypoints: b.nodes.map((node) => node.position.clone()),
    pickups: [
      pickup("rocket", "w-front"),
      pickup("rocket", "e-south"),
      pickup("rail", "n-rail"),
      pickup("rail", "c-inner-east"),
      // Repeat core weapons across the disconnected elevations; the lightning
      // pickup is the single short-range contest near the central objective.
      pickup("lightning", "c-east-n"),
      pickup("health", "w-exit"),
      pickup("health", "e-north"),
      pickup("health", "c-spawn"),
      pickup("armor", "w-south"),
      pickup("armor", "ne-entry"),
      pickup("ammo", "w-north"),
      pickup("ammo", "e-middle"),
      pickup("ammo", "c-inner-west"),
    ],
    powerPosition: position("c-power").add(new THREE.Vector3(0, 0.1, 0)),
    jumpPads: b.pads,
    teleporters: b.portals,
    nodes: b.nodes,
    edges: b.edges,
    killY: -18,
    camera: {
      position: new THREE.Vector3(28, 24, 34),
      target: new THREE.Vector3(0, 4, -2),
    },
  };
}
