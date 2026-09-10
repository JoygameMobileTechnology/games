import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { ArenaBuilder } from "./builder";
import type { ArenaLayout } from "./types";

/** Reactor pit, two gallery circuits, and a contested overhead BFG crossing. */
export function buildCrucible(
  scene: THREE.Scene,
  world: RAPIER.World,
): ArenaLayout {
  const b = new ArenaBuilder(scene, world);
  const v = (x: number, y: number, z: number, offset = 0.9) =>
    new THREE.Vector3(x, y + offset, z);
  const pickups: ArenaLayout["pickups"] = [];
  const chain = (...ids: string[]) =>
    ids.slice(1).forEach((id, i) => b.link(ids[i], id));
  const item = (kind: ArenaLayout["pickups"][number]["kind"], node: string) => {
    const position = b.nodes.find((n) => n.id === node)!.position.clone();
    position.y -= 0.2;
    pickups.push({ kind, position });
  };
  // An open 16-unit reactor well splits the ground ring. The north foundation
  // and upper control room both leave a genuine 4x4 lift shaft clear.
  for (const side of [-1, 1]) b.floor(side * 17, 0, 18, 52);
  b.floor(0, 17, 16, 18);
  for (const side of [-1, 1]) b.floor(side * 5, -17, 6, 18);
  b.floor(0, -23, 4, 6);
  b.floor(0, -12, 4, 8);
  b.floor(0, 0, 16, 5, 0, "metal");
  for (const x of [-26.5, 26.5]) b.box("dark", x, 8, 0, 1, 16, 53);
  for (const z of [-26.5, 26.5]) b.box("stone", 0, 8, z, 52, 16, 1);
  for (const x of [-6.8, 6.8])
    for (const z of [-5, 5]) {
      b.box("metal", x, -3, z, 1.1, 10, 1.1);
      b.box("ember", x, -0.5, z, 0.5, 7, 0.5, { solid: false });
    }
  // The reactor glow is below traversal and the pit remains a real void hazard.
  b.box("ember", 0, -8, 0, 11, 0.3, 11, { solid: false });
  const reactor = new THREE.Mesh(
    new THREE.TorusGeometry(4.8, 0.18, 5, 24),
    b.materials.ember,
  );
  reactor.rotation.x = Math.PI / 2;
  reactor.position.y = -3.5;
  scene.add(reactor);
  for (const side of [-1, 1]) {
    b.floor(side * 20, 0, 12, 14, 4, "dark");
    b.ramp(side * 20, -15, 6, 16, 0, 4, "z");
    b.ramp(side * 20, 15, 6, 16, 4, 0, "z");
    b.ramp(
      side * 16,
      0,
      5,
      12,
      side < 0 ? 4 : 8,
      side < 0 ? 8 : 4,
      "x",
      "metal",
    );
    for (const z of [-6, 6]) {
      b.pillar(side * 24.7, z, 0, 3.1, 0.8);
      b.box("ember", side * 20, 3.87, z + Math.sign(z), 11.6, 0.055, 0.04, {
        solid: false,
      });
    }
    for (const z of [-23, -12, 12, 23]) {
      b.pillar(side * 25.6, z, 0, 15, 0.8);
      b.box("bone", side * 24.9, 11, z, 1.2, 0.35, 2);
    }
    // Furnace banks split the ground side lanes; they never cross ramp approaches.
    b.box("metal", side * 25, 1.15, 0, 1.5, 2.3, 5);
    for (const z of [-1.5, 0, 1.5])
      b.box("ember", side * 24.22, 1.3, z, 0.04, 1.4, 0.35, { solid: false });
  }
  b.floor(0, 0, 20, 5, 8, "metal");
  b.floor(0, -7.25, 5, 9.5, 8, "metal");
  for (const side of [-1, 1]) b.floor(side * 4.5, -18, 5, 12, 8, "dark");
  b.floor(0, -22, 4, 4, 8, "dark");
  b.floor(0, -14, 4, 4, 8, "dark");
  for (const x of [-3.1, 3.1])
    for (const z of [-20.7, -15.3]) {
      b.pillar(x, z, 0, 13, 0.65);
      b.box("cyan", x, 6, z, 0.1, 10, 0.12, { solid: false });
    }
  // The control-room back wall and pierced canopy distinguish the highest loop.
  b.box("stone", 0, 10.5, -24, 14, 5, 0.6);
  for (const x of [-6.6, 6.6]) b.box("stone", x, 10, -18, 0.6, 4, 12);
  for (const z of [-23, -13]) b.box("metal", 0, 13.2, z, 14, 0.6, 1);
  b.arch(0, 20, 0, 12, 15, 0, "ember");
  b.seal(0, 0, 0, 1.8);
  b.seal(0, 8, 0, 1.1);

  b.node("objective", 0, 0, 0);
  for (const side of [-1, 1]) {
    const p = side < 0 ? "west" : "east";
    for (const z of [-23, -12, 0, 12, 23])
      b.node(`${p}-inner-${z}`, side * 12, 0, z);
    chain(...[-23, -12, 0, 12, 23].map((z) => `${p}-inner-${z}`));
    b.link("objective", `${p}-inner-0`);
    b.node(`${p}-ground-cover`, side * 20, 0, 0);
    b.link(`${p}-ground-cover`, `${p}-inner-0`);
    for (const sign of [-1, 1]) {
      const end = sign < 0 ? "north" : "south";
      b.node(`${p}-${end}-foot`, side * 20, 0, sign * 23);
      b.node(`${p}-${end}-mid`, side * 20, 2, sign * 15);
      b.node(`${p}-${end}-top`, side * 20, 4, sign * 7);
      b.node(`${p}-${end}-gallery`, side * 24, 4, sign * 5);
      chain(
        `${p}-inner-${sign * 23}`,
        `${p}-${end}-foot`,
        `${p}-${end}-mid`,
        `${p}-${end}-top`,
        `${p}-${end}-gallery`,
      );
    }
    b.node(`${p}-gallery`, side * 24, 4, 0);
    chain(`${p}-north-gallery`, `${p}-gallery`, `${p}-south-gallery`);
    b.node(`${p}-high-foot`, side * 22, 4, 0);
    b.node(`${p}-high-mid`, side * 16, 6, 0);
    b.node(`${p}-high-top`, side * 10, 8, 0);
    chain(`${p}-gallery`, `${p}-high-foot`, `${p}-high-mid`, `${p}-high-top`);
  }
  b.node("south-cross", 0, 0, 23);
  chain("west-inner-23", "south-cross", "east-inner-23");
  b.node("north-west", -5, 0, -23);
  b.node("north-east", 5, 0, -23);
  chain("west-inner--23", "north-west", "north-east", "east-inner--23");
  b.node("lift-low-dock", 0, 0, -14);
  for (const side of [-1, 1]) {
    const p = side < 0 ? "west" : "east";
    b.node(`north-${p}-low`, side * 5, 0, -14);
    b.link(`north-${p}`, `north-${p}-low`);
    b.link(`north-${p}-low`, "lift-low-dock");
    b.link(`north-${p}-low`, `${p}-inner--12`);
  }
  b.node("bfg-crossing", 0, 8, 0);
  chain("west-high-top", "bfg-crossing", "east-high-top");
  b.node("upper-spine", 0, 8, -8);
  b.node("lift-high-dock", 0, 8, -14);
  chain("bfg-crossing", "upper-spine", "lift-high-dock");
  for (const side of [-1, 1]) {
    const p = side < 0 ? "west" : "east";
    b.node(`control-${p}-entry`, side * 4.8, 8, -14);
    b.node(`control-${p}-hall`, side * 4.8, 8, -18);
    b.node(`control-${p}-rear`, side * 4.8, 8, -22);
    chain(
      "lift-high-dock",
      `control-${p}-entry`,
      `control-${p}-hall`,
      `control-${p}-rear`,
    );
  }
  b.node("control-rear", 0, 8, -22);
  chain("control-west-rear", "control-rear", "control-east-rear");
  item("shotgun", "west-inner-12");
  item("shotgun", "east-inner--12");
  item("grenade", "west-gallery");
  item("grenade", "east-gallery");
  item("bfg", "bfg-crossing");
  for (const id of [
    "west-ground-cover",
    "east-ground-cover",
    "south-cross",
    "control-rear",
  ])
    item("health", id);
  for (const id of [
    "west-north-gallery",
    "east-south-gallery",
    "control-west-hall",
  ])
    item("armor", id);
  item("ammo", "west-inner--23");
  item("ammo", "east-inner-23");
  const spawnData = [
    [-23.8, 0, -23, "west-north-foot"],
    [23.8, 0, 23, "east-south-foot"],
    [-12, 0, 17, "west-inner-12"],
    [12, 0, -17, "east-inner--12"],
    [-18, 0, 0, "west-ground-cover"],
    [18, 0, 0, "east-ground-cover"],
    [-4.8, 8, -20.5, "control-west-rear"],
    [4.8, 8, -20.5, "control-east-rear"],
  ] as const;
  const spawnNodes = spawnData.map(([x, y, z, join], i) => {
    const id = b.node(`spawn-${i}`, x, y, z);
    b.link(id, join);
    return id;
  });
  b.finish();
  return {
    id: "crucible",
    name: "The Crucible",
    subtitle: "Reactor pit · Furnace loops · Freight lift",
    spawns: spawnNodes.map((id) =>
      b.nodes.find((n) => n.id === id)!.position.clone(),
    ),
    waypoints: b.nodes.map((n) => n.position.clone()),
    pickups,
    powerPosition: v(0, 0, 0, 0.7),
    jumpPads: b.pads,
    teleporters: b.portals,
    nodes: b.nodes,
    edges: b.edges,
    killY: -12,
    mechanisms: [
      {
        id: "crucible-freight-lift",
        kind: "platform",
        position: new THREE.Vector3(0, -0.4, -18),
        size: new THREE.Vector3(4, 0.8, 4),
        travel: new THREE.Vector3(0, 8, 0),
        period: 10,
      },
    ],
    camera: {
      position: new THREE.Vector3(31, 27, 36),
      target: new THREE.Vector3(0, 3.5, -3),
    },
  };
}
