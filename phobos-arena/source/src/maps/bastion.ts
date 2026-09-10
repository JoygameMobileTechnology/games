import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { ArenaBuilder } from "./builder";
import type { ArenaLayout } from "./types";

/** Twin citadels, three ground approaches, and a continuous upper gallery circuit. */
export function buildBastion(
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
  b.floor(0, 0, 56, 72);
  for (const x of [-28, 28]) b.box("dark", x, 5.5, 0, 1, 11, 72);
  for (const z of [-36, 36]) b.box("stone", 0, 6, z, 56, 12, 1);
  for (const side of [-1, 1]) {
    b.floor(side * 22, 0, 6, 36, 4, "dark");
    for (const z of [-14, 14]) {
      b.pillar(side * 19.7, z, 0, 3.2, 0.7);
      b.pillar(side * 24.3, z, 0, 3.2, 0.7);
    }
    b.box("trim", side * 25.1, 4.4, 0, 0.2, 0.8, 35.5);
    b.box("violet", side * 19, 3.85, 0, 0.035, 0.07, 35.5, { solid: false });
  }
  b.floor(0, 0, 38, 5, 4, "metal");
  for (const z of [-2.5, 2.5])
    b.box("violet", 0, 3.82, z + Math.sign(z) * 0.03, 37.5, 0.07, 0.03, {
      solid: false,
    });
  for (const x of [-11, 11])
    for (const z of [-1.9, 1.9]) b.pillar(x, z, 0, 3.2, 0.6);
  for (const x of [-7, 7])
    for (const z of [-9, 9]) {
      b.box("dark", x, 1.1, z, 4, 2.2, 4.5);
      b.box("bone", x, 2.25, z, 4.15, 0.1, 4.65);
    }
  b.arch(0, -10, 0, 11, 12, 0, "violet");
  b.arch(0, 10, 0, 11, 12, 0, "violet");
  b.node("neutral-flag", 0, 0, 0);
  b.node("power", 0, 4, 0);
  for (const side of [-1, 1]) {
    b.node(`court-${side}`, side * 16, 0, 0);
    b.node(`gallery-${side}`, side * 22, 4, 0);
    b.link("neutral-flag", `court-${side}`);
    b.link("power", `gallery-${side}`);
  }
  const teamSpawns: [THREE.Vector3[], THREE.Vector3[]] = [[], []];
  for (const [team, sign] of [
    [0, -1],
    [1, 1],
  ] as const) {
    const p = `team-${team}`,
      accent = team === 0 ? "ember" : "cyan";
    // Three full-size gates join each roofed home room to separate court lanes.
    for (const [x, width] of [
      [-24, 8],
      [-8, 8],
      [8, 8],
      [24, 8],
    ]) {
      const height = Math.abs(x) > 20 ? 3.2 : 9;
      b.box("stone", x, height / 2, sign * 18, width, height, 1);
    }
    for (const x of [-16, 0, 16]) b.arch(x, sign * 18, 0, 8, 10, 0, accent);
    b.box("dark", 0, 9.3, sign * 29.5, 36, 0.6, 13, { renderOutset: 0.01 });
    b.arch(0, sign * 33, 0, 6, 9, 0, accent);
    for (const side of [-1, 1]) {
      b.pillar(side * 25, sign * 32, 0, 15, 4);
      b.box(accent, side * 25, 11, sign * 29.98, 0.18, 5, 0.03, {
        solid: false,
      });
      b.box("stone", side * 8, 1.05, sign * 28, 3, 2.1, 3);
      b.box("bone", side * 8, 2.15, sign * 28, 3.15, 0.1, 3.15);
      b.ramp(
        side * 22,
        sign * 24,
        6,
        12,
        sign < 0 ? 0 : 4,
        sign < 0 ? 4 : 0,
        "z",
      );
      b.arch(side * 22, sign * 18, 4, 6, 6, 0, accent);
    }
    b.box(accent, 0, 4.5, sign * 35.46, 5, 0.16, 0.03, { solid: false });
    const light = new THREE.PointLight(
      team === 0 ? "#ff653c" : "#55cfe5",
      22,
      18,
      2,
    );
    light.position.set(0, 5, sign * 29);
    scene.add(light);
    b.seal(0, 0, sign * 30, 2);
    b.node(`${p}-flag`, 0, 0, sign * 30);
    b.node(`${p}-rear`, 0, 0, sign * 25);
    b.node(`${p}-gate`, 0, 0, sign * 18);
    b.node(`${p}-court`, 0, 0, sign * 12);
    chain(`${p}-flag`, `${p}-rear`, `${p}-gate`, `${p}-court`, "neutral-flag");
    const spawnCoordinates = [
      [-8, 32],
      [8, 32],
      [-12, 28],
      [12, 28],
      [0, 27],
    ];
    for (let i = 0; i < spawnCoordinates.length; i++) {
      const [x, z] = spawnCoordinates[i];
      const position = v(x, 0, sign * z);
      teamSpawns[team].push(position);
      b.node(`${p}-spawn-${i}`, x, 0, sign * z);
      if (i < 2) b.link(`${p}-spawn-${i}`, `${p}-flag`);
      if (i === 4) b.link(`${p}-spawn-${i}`, `${p}-rear`);
    }
    for (const side of [-1, 1]) {
      const s = `${p}-${side}`;
      b.node(`${s}-base`, side * 14, 0, sign * 25);
      b.node(`${s}-gate`, side * 16, 0, sign * 18);
      b.node(`${s}-court`, side * 16, 0, sign * 12);
      chain(
        `${p}-rear`,
        `${s}-base`,
        `${s}-gate`,
        `${s}-court`,
        `court-${side}`,
      );
      b.link(`${s}-court`, `${p}-court`);
      b.link(`${s}-base`, `${p}-spawn-${side < 0 ? 0 : 1}`);
      b.link(`${s}-base`, `${p}-spawn-${side < 0 ? 2 : 3}`);
      b.node(`${s}-approach`, side * 22, 0, sign * 32);
      b.node(`${s}-ramp-corner`, side * 14, 0, sign * 32);
      b.node(`${s}-foot`, side * 22, 0, sign * 30);
      b.node(`${s}-ramp`, side * 22, 2, sign * 24);
      b.node(`${s}-top`, side * 22, 4, sign * 18);
      b.node(`${s}-gallery-item`, side * 22, 4, sign * 7);
      // Ground outside the ramp remains accessible after a fall or blast. Rejoin
      // beneath its high end, where the whole capsule fits, rather than its solid side.
      b.node(`${s}-outer-recovery`, side * 26, 0, sign * 22);
      b.node(`${s}-under-recovery`, side * 18, 0, sign * 22);
      chain(`${s}-outer-recovery`, `${s}-under-recovery`, `${s}-base`);
      chain(
        `${s}-base`,
        `${s}-ramp-corner`,
        `${s}-approach`,
        `${s}-foot`,
        `${s}-ramp`,
        `${s}-top`,
        `${s}-gallery-item`,
        `gallery-${side}`,
      );
    }
    b.node(`${p}-plasma`, 14, 0, sign * 22);
    chain(`${p}-1-base`, `${p}-plasma`, `${p}-1-gate`);
    item("plasma", `${p}-plasma`);
    item("rocket", `${p}--1-court`);
    item("lightning", `${p}-1-gallery-item`);
    item("health", `${p}--1-base`);
    item("armor", `${p}--1-gallery-item`);
    item("ammo", `${p}-1-court`);
    // Optional lift sits beside the ground route; passing traffic does not trigger it.
    b.pad(`${p}-gallery-lift`, -14, 0, sign * 6, -22, 4, sign * 6, 1.4);
    b.node(`${p}-pad`, -14, 0.07, sign * 6);
    b.node(`${p}-landing`, -22, 4, sign * 6);
    b.link(`${p}-pad`, "court--1");
    chain(`${p}--1-gallery-item`, `${p}-landing`, "gallery--1");
    b.link(`${p}-pad`, `${p}-landing`, "pad");
  }
  b.seal(0, 4, 0, 1.8);
  b.finish();
  return {
    id: "bastion",
    name: "Cinder Bastion",
    subtitle: "Twin citadels · Broad court · Flanking galleries",
    spawns: [...teamSpawns[0], ...teamSpawns[1]],
    waypoints: b.nodes.map((node) => node.position.clone()),
    pickups,
    powerPosition: v(0, 4, 0).add(new THREE.Vector3(0, -0.2, 0)),
    jumpPads: b.pads,
    teleporters: b.portals,
    nodes: b.nodes,
    edges: b.edges,
    killY: -16,
    flags: {
      bases: [v(0, 0, -30), v(0, 0, 30)],
      neutral: v(0, 0, 0),
      teamSpawns,
    },
    camera: {
      position: new THREE.Vector3(36, 32, 45),
      target: new THREE.Vector3(0, 3, 0),
    },
  };
}
