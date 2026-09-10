import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { ArenaBuilder } from "./builder";
import type { ArenaLayout } from "./types";

/** Suspended cross vaults with split-height corner chapels and paired return portals. */
export function buildReliquary(
  scene: THREE.Scene,
  world: RAPIER.World,
): ArenaLayout {
  const b = new ArenaBuilder(scene, world, true);
  const pickups: ArenaLayout["pickups"] = [];
  const chain = (...ids: string[]) =>
    ids.slice(1).forEach((id, i) => b.link(ids[i], id));
  const room = (x: number, z: number, w: number, d: number, y: number) => {
    b.floor(x, z, w, d, y, "dark");
    b.box("metal", x, y - 1.2, z, w - 0.3, 0.8, d - 0.3);
    for (const side of [-1, 1]) {
      b.box(
        "violet",
        x + side * (w / 2 + 0.015),
        y - 0.45,
        z,
        0.03,
        0.065,
        d - 1,
        { solid: false },
      );
      for (const end of [-1, 1])
        b.pillar(x + side * (w / 2 - 0.7), z + end * (d / 2 - 0.7), y, 6, 0.75);
    }
  };
  room(0, 0, 12, 12, 0);
  room(-21, 0, 10, 12, 0);
  room(21, 0, 10, 12, 0);
  for (const sign of [-1, 1]) {
    room(0, sign * 21, 14, 14, 4);
    b.floor(sign * 11, 0, 10, 5, 0, "metal");
    b.ramp(0, sign * 10, 5, 8, sign < 0 ? 4 : 0, sign < 0 ? 0 : 4, "z");
    room(sign * 21, sign * 21, 10, 10, 0);
    room(sign * 21, sign * 21, 10, 10, 8);
    b.floor(sign * 21, sign * 11, 5, 10, 0, "metal");
    // Separate lanes ensure the upper descending ramp cannot form a low
    // ceiling over the lower ascending ramp near their common side chapel.
    b.ramp(
      sign * 11.5,
      sign * 18,
      3.5,
      9,
      sign < 0 ? 0 : 4,
      sign < 0 ? 4 : 0,
      "x",
      "metal",
    );
    b.ramp(
      sign * 11.5,
      sign * 24,
      3.5,
      9,
      sign < 0 ? 8 : 4,
      sign < 0 ? 4 : 8,
      "x",
      "metal",
    );
    for (const y of [0, 8]) {
      b.box("stone", sign * 25.8, y + 2.5, sign * 21, 0.5, 5, 10);
      b.box("bone", sign * 21, y + 5.8, sign * 25.5, 9.3, 0.5, 0.6);
    }
    // Tall shrines break the broad north/south rooms without obscuring ramp mouths.
    b.box("stone", 4.9 * sign, 6, 21 * sign, 1.2, 4, 3.5);
    b.box("violet", 4.25 * sign, 6, 21 * sign, 0.045, 2.3, 1.4, {
      solid: false,
    });
  }
  for (const z of [-4.6, 4.6]) b.arch(0, z, 0, 8, 12, 0, "violet");
  b.box("bone", 0, 12.2, 0, 1.3, 0.6, 10);
  b.box("bone", 0, 12.8, 0, 10, 0.6, 1.3);
  // West shortcut gate: five-unit clear opening, vertically sliding leaf is
  // owned by the runtime. A boxed header leaves space for its full travel.
  for (const z of [-3, 3]) b.box("stone", -11, 4.2, z, 1.4, 8.4, 1);
  for (const x of [-11.8, -10.2]) b.box("dark", x, 6.45, 0, 0.25, 4.9, 6);
  b.box("bone", -11, 9.05, 0, 1.9, 0.4, 7);
  for (const z of [-2.6, 2.6])
    b.box("violet", -10.25, 2.1, z, 0.045, 4, 0.08, { solid: false });
  b.seal(0, 0, 0, 1.8);
  b.portal("reliquary-north-gate", -21, 8, -23, 21, 8, 21, 0);
  b.portal("reliquary-south-gate", 23, 8, 21, -21, 8, -21, Math.PI / 2);

  b.node("objective", 0, 0, 0);
  for (const sign of [-1, 1]) {
    const p = sign < 0 ? "northwest" : "southeast";
    b.node(`${p}-wing`, sign * 21, 0, 0);
    for (const distance of [6, 11, 16])
      b.node(`${p}-cross-${distance}`, sign * distance, 0, 0);
    chain(
      "objective",
      `${p}-cross-6`,
      `${p}-cross-11`,
      `${p}-cross-16`,
      `${p}-wing`,
    );
    b.node(`${p}-stem-foot`, 0, 0, sign * 6);
    b.node(`${p}-stem-mid`, 0, 2, sign * 10);
    b.node(`${p}-stem-top`, 0, 4, sign * 14);
    b.node(`${p}-chapel`, 0, 4, sign * 21);
    chain(
      "objective",
      `${p}-stem-foot`,
      `${p}-stem-mid`,
      `${p}-stem-top`,
      `${p}-chapel`,
    );
    b.node(`${p}-corner-approach`, sign * 21, 0, sign * 6);
    b.node(`${p}-corner-link`, sign * 21, 0, sign * 11);
    b.node(`${p}-corner-entry`, sign * 21, 0, sign * 16);
    b.node(`${p}-lower`, sign * 21, 0, sign * 21);
    chain(
      `${p}-wing`,
      `${p}-corner-approach`,
      `${p}-corner-link`,
      `${p}-corner-entry`,
      `${p}-lower`,
    );
    for (const upper of [false, true]) {
      const lane = upper ? "upper" : "lower";
      const y = upper ? 8 : 0,
        z = sign * (upper ? 24 : 18);
      b.node(`${p}-${lane}-room`, sign * 21, y, z);
      b.node(`${p}-${lane}-outer`, sign * 16, y, z);
      b.node(`${p}-${lane}-mid`, sign * 11.5, upper ? 6 : 2, z);
      b.node(`${p}-${lane}-inner`, sign * 7, 4, z);
      b.node(`${p}-${lane}-chapel`, 0, 4, z);
      chain(
        `${p}-${lane}-room`,
        `${p}-${lane}-outer`,
        `${p}-${lane}-mid`,
        `${p}-${lane}-inner`,
        `${p}-${lane}-chapel`,
        `${p}-chapel`,
      );
      if (!upper) b.link(`${p}-${lane}-room`, `${p}-lower`);
    }
    b.node(`${p}-upper`, sign * 21, 8, sign * 21);
    b.link(`${p}-upper`, `${p}-upper-room`);
  }
  b.node("north-portal", -21, 8, -23);
  b.node("south-portal", 23, 8, 21);
  b.link("north-portal", "northwest-upper");
  b.link("south-portal", "southeast-upper");
  b.link("north-portal", "southeast-upper", "teleport");
  b.link("south-portal", "northwest-upper", "teleport");
  const item = (kind: ArenaLayout["pickups"][number]["kind"], node: string) => {
    const position = b.nodes.find((n) => n.id === node)!.position.clone();
    position.y -= 0.2;
    pickups.push({ kind, position });
  };
  item("rocket", "northwest-wing");
  item("rocket", "southeast-lower");
  item("plasma", "southeast-wing");
  item("plasma", "northwest-chapel");
  item("proximity", "northwest-upper");
  for (const node of [
    "northwest-lower",
    "southeast-chapel",
    "northwest-lower-chapel",
    "southeast-upper-chapel",
  ])
    item("health", node);
  item("armor", "southeast-upper");
  b.node("northwest-armor", -24, 0, -21);
  b.link("northwest-armor", "northwest-lower");
  b.node("west-ammo", -21, 0, 3);
  b.link("west-ammo", "northwest-wing");
  b.node("southeast-spawn", 23, 0, 18);
  b.link("southeast-spawn", "southeast-lower-room");
  item("armor", "northwest-armor");
  item("ammo", "west-ammo");
  item("ammo", "southeast-lower-room");
  const spawnNodes = [
    "northwest-cross-16",
    "southeast-cross-16",
    "northwest-lower-room",
    "southeast-spawn",
    "northwest-upper-room",
    "southeast-upper-room",
    "northwest-upper-chapel",
    "southeast-lower-chapel",
  ];
  b.finish();
  return {
    id: "reliquary",
    name: "The Reliquary",
    subtitle: "Suspended vaults · Split-height chapels · Void crossings",
    spawns: spawnNodes.map((id) =>
      b.nodes.find((n) => n.id === id)!.position.clone(),
    ),
    waypoints: b.nodes.map((n) => n.position.clone()),
    pickups,
    powerPosition: new THREE.Vector3(0, 0.7, 0),
    jumpPads: b.pads,
    teleporters: b.portals,
    nodes: b.nodes,
    edges: b.edges,
    killY: -14,
    mechanisms: [
      {
        id: "reliquary-west-door",
        kind: "door",
        position: new THREE.Vector3(-11, 2, 0),
        size: new THREE.Vector3(0.6, 4, 5),
        travel: new THREE.Vector3(0, 4.8, 0),
        period: 0.7,
        triggerRadius: 4,
      },
    ],
    camera: {
      position: new THREE.Vector3(35, 27, 38),
      target: new THREE.Vector3(0, 3, 0),
    },
  };
}
