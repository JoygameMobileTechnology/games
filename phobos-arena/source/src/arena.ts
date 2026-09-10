import type * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";
import { buildOssuary } from "./maps/ossuary";
import { buildRift } from "./maps/rift";
import { buildBastion } from "./maps/bastion";
import { buildConduit } from "./maps/conduit";
import { buildCrucible } from "./maps/crucible";
import { buildReliquary } from "./maps/reliquary";
import type { ArenaLayout, MapId } from "./maps/types";

export type { ArenaLayout, MapId } from "./maps/types";

export function buildArena(
  scene: THREE.Scene,
  world: RAPIER.World,
  id: MapId = "ossuary",
): ArenaLayout {
  const builders = { ossuary: buildOssuary, rift: buildRift, bastion: buildBastion,
    conduit: buildConduit, crucible: buildCrucible, reliquary: buildReliquary };
  return builders[id](scene, world);
}
