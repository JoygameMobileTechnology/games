import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { ArenaBuilder } from "./builder";
import type { ArenaLayout } from "./types";

/** A figure-eight around twin reactor housings, with a raised central flag bridge. */
export function buildConduit(
  scene: THREE.Scene,
  world: RAPIER.World,
): ArenaLayout {
  const b = new ArenaBuilder(scene, world);
  const pickups: ArenaLayout["pickups"] = [];
  const v = (x: number, y: number, z: number) =>
    new THREE.Vector3(x, y + 0.9, z);
  const chain = (...ids: string[]) => {
    for (let i = 1; i < ids.length; i++) b.link(ids[i - 1], ids[i]);
  };
  const item = (kind: ArenaLayout["pickups"][number]["kind"], id: string) => {
    const position = b.nodes.find((node) => node.id === id)!.position.clone();
    position.y -= 0.2;
    pickups.push({ kind, position });
  };
  b.floor(0, 0, 36, 70, 0, "metal");
  for (const x of [-18, 18]) b.box("dark", x, 5.5, 0, 1, 11, 70);
  for (const z of [-35, 35]) b.box("stone", 0, 5, z, 36, 10, 1);
  // The solid reactor pedestal splits the low crossover into two six-metre lanes.
  b.box("dark", 0, 1.1, 0, 7, 2.2, 10);
  b.floor(0, 0, 8, 12, 3, "metal");
  b.ramp(-8, 0, 5, 8, 0, 3, "x", "metal");
  b.ramp(8, 0, 5, 8, 3, 0, "x", "metal");
  for (const z of [-4.5, 4.5]) {
    b.box("stone", 0, 6, z, 3, 6, 1);
    b.box("violet", 0, 6, z - Math.sign(z) * 0.52, 0.22, 4.5, 0.035, {
      solid: false,
    });
    b.box("bone", 0, 9.15, z, 3.3, 0.3, 1.3);
  }
  b.node("neutral-flag", 0, 3, 0);
  for (const side of [-1, 1]) {
    b.node(`mid-${side}`, side * 12, 0, 0);
    b.node(`ramp-${side}`, side * 8, 1.5, 0);
    b.node(`upper-${side}`, side * 4, 3, 0);
    chain(`mid-${side}`, `ramp-${side}`, `upper-${side}`, "neutral-flag");
    b.box("trim", side * 17.36, 4.2, 0, 0.12, 0.2, 67);
    for (const z of [-28, -17, -8, 8, 17, 28]) {
      b.pillar(side * 17.1, z, 0, 10.6, 0.65);
      b.box("violet", side * 16.73, 4.5, z, 0.025, 4, 0.16, { solid: false });
    }
  }
  b.seal(-12, 0, 0, 1.65);
  b.seal(0, 3, 0, 1.3);
  const reactorLight = new THREE.PointLight("#a679ff", 30, 17, 2);
  reactorLight.position.set(0, 6, 0);
  scene.add(reactorLight);
  const teamSpawns: [THREE.Vector3[], THREE.Vector3[]] = [[], []];
  for (const [team, sign] of [
    [0, -1],
    [1, 1],
  ] as const) {
    const p = `team-${team}`,
      accent = team === 0 ? "ember" : "cyan";
    // Monolithic housings make the two long conduits independent sight lines.
    b.box("dark", 0, 4, sign * 17, 14, 8, 12);
    b.box("trim", 0, 8.14, sign * 17, 14.2, 0.28, 12.2);
    for (const side of [-1, 1]) {
      for (const z of [13, 16, 19, 22]) {
        b.box("metal", side * 7.14, 4, sign * z, 0.28, 6.3, 0.8);
        b.box(accent, side * 7.3, 4.1, sign * z, 0.025, 4.3, 0.13, {
          solid: false,
        });
      }
      b.arch(side * 12, sign * 17, 0, 8, 8, 0, accent);
      b.box("metal", side * 12, 8.5, sign * 17, 8, 0.5, 15);
      b.box(accent, side * 12, 8.22, sign * 17, 6.8, 0.035, 13, {
        solid: false,
      });
    }
    // Home control rooms have two independent doors and an inset flag beacon.
    b.arch(0, sign * 33.6, 0, 7, 9, 0, accent);
    b.box(accent, 0, 4, sign * 34.46, 5.5, 0.15, 0.025, { solid: false });
    const light = new THREE.PointLight(
      team === 0 ? "#ff6b36" : "#4bd9e9",
      17,
      16,
      2,
    );
    light.position.set(0, 4.8, sign * 29);
    scene.add(light);
    b.seal(0, 0, sign * 29, 1.8);
    b.node(`${p}-flag`, 0, 0, sign * 29);
    b.node(`${p}-armor`, 0, 0, sign * 25);
    b.node(`${p}-cross`, 0, 0, sign * 8);
    b.node(`${p}-chaingun`, 0, 3, sign * 2.5);
    b.link(`${p}-chaingun`, "neutral-flag");
    b.link(`${p}-armor`, `${p}-flag`);
    const spawnCoordinates = [
      [-7, 32],
      [7, 32],
      [-12, 30],
      [12, 30],
      [0, 32],
    ];
    for (let i = 0; i < spawnCoordinates.length; i++) {
      const [x, z] = spawnCoordinates[i];
      teamSpawns[team].push(v(x, 0, sign * z));
      b.node(`${p}-spawn-${i}`, x, 0, sign * z);
      b.link(`${p}-spawn-${i}`, `${p}-flag`);
    }
    for (const side of [-1, 1]) {
      const s = `${p}-${side}`;
      b.node(`${s}-base`, side * 12, 0, sign * 28);
      b.node(`${s}-entry`, side * 12, 0, sign * 24);
      b.node(`${s}-weapon`, side * 12, 0, sign * 20);
      b.node(`${s}-hall`, side * 12, 0, sign * 16);
      b.node(`${s}-cross`, side * 12, 0, sign * 8);
      chain(
        `${p}-flag`,
        `${s}-base`,
        `${s}-entry`,
        `${s}-weapon`,
        `${s}-hall`,
        `${s}-cross`,
        `mid-${side}`,
      );
      b.link(`${s}-entry`, `${p}-armor`);
      b.link(`${s}-cross`, `${p}-cross`);
      b.link(`${s}-base`, `${p}-spawn-${side < 0 ? 0 : 1}`);
      b.link(`${s}-base`, `${p}-spawn-${side < 0 ? 2 : 3}`);
    }
    item("rail", `${p}-1-weapon`);
    item("nailgun", `${p}--1-weapon`);
    item("chaingun", `${p}-chaingun`);
    item("armor", `${p}-armor`);
    item("health", `${p}--1-cross`);
    item("ammo", `${p}-1-cross`);
  }
  b.finish();
  return {
    id: "conduit",
    name: "Black Conduit",
    subtitle: "Parallel reactors · Figure-eight routes · Raised flag bridge",
    spawns: [...teamSpawns[0], ...teamSpawns[1]],
    waypoints: b.nodes.map((node) => node.position.clone()),
    pickups,
    powerPosition: v(-12, 0, 0).add(new THREE.Vector3(0, -0.2, 0)),
    jumpPads: b.pads,
    teleporters: b.portals,
    nodes: b.nodes,
    edges: b.edges,
    killY: -16,
    flags: {
      bases: [v(0, 0, -29), v(0, 0, 29)],
      neutral: v(0, 3, 0),
      teamSpawns,
    },
    camera: {
      position: new THREE.Vector3(28, 28, 41),
      target: new THREE.Vector3(0, 3, 0),
    },
  };
}
