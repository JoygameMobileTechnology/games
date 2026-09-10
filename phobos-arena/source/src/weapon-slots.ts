import { WEAPON_ORDER, type WeaponId } from "./rules";

/** Arena shortcuts stay fixed as weapons are collected, spent or lost. */
export function getWeaponSlots(
  pickups: readonly { kind: string }[],
): WeaponId[] {
  const available = new Set(pickups.map((pickup) => pickup.kind));
  available.add("melee");
  available.add("machinegun");
  return WEAPON_ORDER.filter((id) => available.has(id));
}
