import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { buildArena } from "../src/arena.ts";
import { MAP_IDS, MAP_INFO, mapsForMode } from "../src/maps/catalog.ts";
import { isFlagMode, type Mode } from "../src/match.ts";
import { WEAPON_ORDER, type WeaponId } from "../src/rules.ts";
import { getWeaponSlots } from "../src/weapon-slots.ts";

test("six unique arenas cover every launch mode twice and the full arsenal within five keys", async () => {
  await RAPIER.init();
  assert.ok(new Set(MAP_IDS).size >= 6);
  const modes: Mode[] = ["ffa", "duel", "tdm", "ctf", "oneflag", "juggernaut"];
  for (const mode of modes) assert.ok(mapsForMode(mode).length >= 2, mode);
  const arsenal = new Set<WeaponId>();
  for (const id of MAP_IDS) {
    const world = new RAPIER.World({ x: 0, y: -20, z: 0 });
    const scene = new THREE.Scene();
    try {
      const map = buildArena(scene, world, id);
      assert.equal(map.id, id);
      assert.equal(map.name, MAP_INFO[id].name);
      assert.ok(map.spawns.length >= MAP_INFO[id].maxPlayers, `${id}: capacity`);
      const slots = getWeaponSlots(map.pickups);
      assert.equal(slots.length, 5, `${id}: three collectible roles plus starting loadout`);
      slots.forEach(weapon => arsenal.add(weapon));
      if (MAP_INFO[id].modes.some(isFlagMode)) {
        assert.ok(map.flags, `${id}: flag layout required`);
        assert.ok(map.flags.teamSpawns.every(spawns => spawns.length >= 5), `${id}: 5v5 spawns`);
      }
    } finally {
      scene.traverse(object => {
        const mesh = object as THREE.Mesh;
        mesh.geometry?.dispose();
        (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(m => m?.dispose());
      });
      world.free();
    }
  }
  assert.deepEqual([...arsenal].sort(), [...WEAPON_ORDER].sort());
});
