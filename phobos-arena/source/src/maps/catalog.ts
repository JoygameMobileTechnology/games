import type { Mode } from "../match";
import type { MapId } from "./types";

const arenaModes: Mode[] = ["ffa", "duel", "tdm", "juggernaut"];
const allModes: Mode[] = [...arenaModes, "ctf", "oneflag"];
export const MAP_IDS: MapId[] = ["ossuary", "rift", "bastion", "conduit", "crucible", "reliquary"];
export const MAP_INFO: Record<MapId, { name: string; short: string; modes: readonly Mode[]; maxPlayers: number }> = {
  ossuary: { name: "The Ossuary", short: "OSSUARY", modes: arenaModes, maxPlayers: 8 },
  rift: { name: "Rift Foundry", short: "FOUNDRY", modes: arenaModes, maxPlayers: 8 },
  bastion: { name: "Cinder Bastion", short: "BASTION", modes: allModes, maxPlayers: 10 },
  conduit: { name: "Black Conduit", short: "CONDUIT", modes: allModes, maxPlayers: 10 },
  crucible: { name: "The Crucible", short: "CRUCIBLE", modes: arenaModes, maxPlayers: 8 },
  reliquary: { name: "The Reliquary", short: "RELIQUARY", modes: arenaModes, maxPlayers: 8 },
};
export function supportsMode(id: MapId, mode: Mode) {
  return MAP_INFO[id].modes.includes(mode);
}
export function mapsForMode(mode: Mode) {
  return MAP_IDS.filter(id => supportsMode(id, mode));
}
