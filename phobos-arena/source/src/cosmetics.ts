export const CHARACTER_IDS = ["mordant", "vesper", "karn", "nyx", "grim", "malice", "seraph"] as const;
export type CharacterId = (typeof CHARACTER_IDS)[number];
export interface CharacterPalette { armor: string; metal: string; bone: string; glow: string }
export interface CharacterDefinition {
  id: CharacterId;
  name: string;
  title: string;
  description: string;
  price: number;
  palette: CharacterPalette;
}
export const CHARACTERS: readonly CharacterDefinition[] = [
  { id: "mordant", name: "Mordant", title: "The breach knight", description: "A condemned sentinel whose horned armor was fused shut when the first gate opened.", price: 0, palette: { armor: "#793c33", metal: "#282d32", bone: "#c9b49a", glow: "#ff7848" } },
  { id: "vesper", name: "Vesper", title: "The bone oracle", description: "Beneath the funeral hood, the colony's last transmission repeats through a crown of bone.", price: 250, palette: { armor: "#403c59", metal: "#252731", bone: "#d4c5ac", glow: "#a697ed" } },
  { id: "karn", name: "Karn", title: "The furnace bearer", description: "A siege engine in a prisoner's body. The reactor in its chest has never cooled.", price: 300, palette: { armor: "#71533b", metal: "#303132", bone: "#ac9983", glow: "#ffad46" } },
  { id: "nyx", name: "Nyx", title: "The eclipse blade", description: "A blade-faced hunter dressed in the shattered armor of a lunar reconnaissance unit.", price: 300, palette: { armor: "#315157", metal: "#1c252c", bone: "#a6babc", glow: "#6edcda" } },
  { id: "grim", name: "Grim", title: "The ossuary warden", description: "An exposed rib cage bound in iron, carrying the silence of a thousand sealed tombs.", price: 350, palette: { armor: "#56604a", metal: "#2c3029", bone: "#d2c7a5", glow: "#c4dc80" } },
  { id: "malice", name: "Malice", title: "The thorn revenant", description: "The gate's first offering returned with a crown of spines and a second, hungrier heart.", price: 400, palette: { armor: "#633845", metal: "#2f2630", bone: "#bd9ea2", glow: "#ec7197" } },
  { id: "seraph", name: "Seraph", title: "The fallen signal", description: "A ruined angel with folded metal pinions. Its halo receives orders from beneath Mars.", price: 500, palette: { armor: "#75694d", metal: "#353238", bone: "#e3d6b9", glow: "#f6d58a" } },
];
export const CHARACTER_SKIN_IDS = ["original", "bloodrite", "nightsilver", "ashen"] as const;
export type CharacterSkinId = (typeof CHARACTER_SKIN_IDS)[number];
export const CHARACTER_SKINS: readonly { id: CharacterSkinId; name: string; description: string; price: number; palette?: Partial<CharacterPalette> }[] = [
  { id: "original", name: "Original vestments", description: "The character's original armor, bone and energy colors.", price: 0 },
  { id: "bloodrite", name: "Bloodrite", description: "Oxblood plate, blackened iron and sacrificial ivory. Fits all seven characters.", price: 150, palette: { armor: "#862f35", metal: "#25232a", bone: "#cfba9a", glow: "#ff7253" } },
  { id: "nightsilver", name: "Nightsilver", description: "Cold silver over midnight armor, lit by a spectral blue core. Fits all seven characters.", price: 225, palette: { armor: "#596976", metal: "#1d2738", bone: "#c4d7df", glow: "#77d9ff" } },
  { id: "ashen", name: "Ashen covenant", description: "Pale ceramic, scorched joints and muted gold seals. Fits all seven characters.", price: 300, palette: { armor: "#b5a992", metal: "#37302d", bone: "#e6dbc0", glow: "#f4bd68" } },
];
export const WEAPON_SKIN_IDS = ["original", "ossified", "ritual", "voidglass", "hellfire", "frostbound", "verdigris", "royalcurse", "solarwrath"] as const;
export type WeaponSkinId = (typeof WEAPON_SKIN_IDS)[number];
export interface WeaponPalette { metal: string; dark: string; bone: string; roughness: number; metalness: number }
export const WEAPON_SKINS: readonly { id: WeaponSkinId; name: string; description: string; price: number; palette: WeaponPalette }[] = [
  { id: "original", name: "Forged iron", description: "The original dark alloy and aged bone finish. Weapon energy colors remain recognizable.", price: 0, palette: { metal: "#354049", dark: "#161c23", bone: "#c0ad8e", roughness: 0.4, metalness: 0.75 } },
  { id: "ossified", name: "Ossified", description: "Carved ivory casings around dark iron machinery. Applies to every weapon.", price: 125, palette: { metal: "#c4b69a", dark: "#453d36", bone: "#e6d8b7", roughness: 0.58, metalness: 0.25 } },
  { id: "ritual", name: "Ritual brass", description: "Warm engraved brass and oxblood fittings. Applies to every weapon.", price: 200, palette: { metal: "#9b7040", dark: "#4b242b", bone: "#debd79", roughness: 0.32, metalness: 0.85 } },
  { id: "voidglass", name: "Voidglass", description: "Polished violet alloy, obsidian housings and silver trim. Applies to every weapon.", price: 300, palette: { metal: "#50556c", dark: "#1c1730", bone: "#c1cadd", roughness: 0.22, metalness: 0.9 } },
  { id: "hellfire", name: "Hellfire", description: "Crimson plate, coal-black machinery and ember-orange trim. Forged beyond the gates of Mars. Applies to every weapon.", price: 175, palette: { metal: "#a72f39", dark: "#1f1720", bone: "#ffb071", roughness: 0.34, metalness: 0.6 } },
  { id: "frostbound", name: "Frostbound", description: "Icy cyan alloy over midnight housings, edged in cold silver. A relic of the moon's frozen side. Applies to every weapon.", price: 200, palette: { metal: "#80c4d4", dark: "#142938", bone: "#e8eff2", roughness: 0.29, metalness: 0.5 } },
  { id: "verdigris", name: "Verdigris", description: "Ancient teal patina, deep green iron and exposed copper fittings. Reclaimed from a forgotten temple. Applies to every weapon.", price: 225, palette: { metal: "#368a74", dark: "#162e2b", bone: "#cf885c", roughness: 0.48, metalness: 0.65 } },
  { id: "royalcurse", name: "Royal Curse", description: "Royal purple armor, blackened housings and ceremonial gold trim. Tribute to a fallen throne. Applies to every weapon.", price: 250, palette: { metal: "#7240a6", dark: "#231d30", bone: "#e1b45d", roughness: 0.3, metalness: 0.72 } },
  { id: "solarwrath", name: "Solar Wrath", description: "Burnt orange plate and charcoal machinery with pale gold fittings. Tempered in the furnace of a dying sun. Applies to every weapon.", price: 275, palette: { metal: "#d67727", dark: "#2d302e", bone: "#f0d795", roughness: 0.42, metalness: 0.45 } },
];
export type CosmeticKind = "character" | "character-skin" | "weapon-skin";
export interface CosmeticItem { id: string; kind: CosmeticKind; name: string; description: string; price: number; contentId: string }
export const COSMETIC_ITEMS: readonly CosmeticItem[] = [
  ...CHARACTERS.map(item => ({ ...item, contentId: item.id, id: `character:${item.id}`, kind: "character" as const })),
  ...CHARACTER_SKINS.map(item => ({ ...item, contentId: item.id, id: `character-skin:${item.id}`, kind: "character-skin" as const })),
  ...WEAPON_SKINS.map(item => ({ ...item, contentId: item.id, id: `weapon-skin:${item.id}`, kind: "weapon-skin" as const })),
];
const STARTER_ITEMS = ["character:mordant", "character-skin:original", "weapon-skin:original"];
export interface CosmeticsState {
  character: CharacterId;
  characterSkin: CharacterSkinId;
  weaponSkin: WeaponSkinId;
  favor: number;
  owned: string[];
  rewardedMatches: string[];
}
export const FAVOR_COMPLETION = 25;
export const FAVOR_WIN_BONUS = 75;
const MAX_FAVOR = 1_000_000_000;
export const findCosmetic = (id: string) => COSMETIC_ITEMS.find(item => item.id === id);
export function defaultCosmetics(): CosmeticsState {
  return { character: "mordant", characterSkin: "original", weaponSkin: "original", favor: 0, owned: [...STARTER_ITEMS], rewardedMatches: [] };
}
export function normalizeCosmetics(value: unknown): CosmeticsState {
  const result = defaultCosmetics();
  if (!value || typeof value !== "object") return result;
  const saved = value as Partial<CosmeticsState>;
  if (typeof saved.favor === "number" && Number.isFinite(saved.favor))
    result.favor = Math.min(MAX_FAVOR, Math.max(0, Math.floor(saved.favor)));
  if (Array.isArray(saved.owned))
    result.owned = [...new Set([...STARTER_ITEMS, ...saved.owned.filter(id => typeof id === "string" && findCosmetic(id))])];
  for (const [field, kind] of [["character", "character"], ["characterSkin", "character-skin"], ["weaponSkin", "weapon-skin"]] as const) {
    const selected = saved[field];
    if (typeof selected === "string" && result.owned.includes(`${kind}:${selected}`))
      (result[field] as string) = selected;
  }
  if (Array.isArray(saved.rewardedMatches))
    result.rewardedMatches = [...new Set(saved.rewardedMatches.filter(id => typeof id === "string" && id.length > 0 && id.length <= 100))].slice(-512);
  return result;
}
export const ownsCosmetic = (state: CosmeticsState, id: string) => Boolean(findCosmetic(id) && state.owned.includes(id));
export function purchaseCosmetic(state: CosmeticsState, id: string): { ok: boolean; reason?: string } {
  const item = findCosmetic(id);
  if (!item) return { ok: false, reason: "This item is unavailable." };
  if (ownsCosmetic(state, id)) return { ok: false, reason: "Already owned." };
  if (!Number.isSafeInteger(state.favor) || state.favor < item.price)
    return { ok: false, reason: `Need ${Math.max(0, item.price - (Number.isFinite(state.favor) ? state.favor : 0))} more Favor.` };
  state.favor -= item.price;
  state.owned.push(id);
  return { ok: true };
}
export function equipCosmetic(state: CosmeticsState, id: string): boolean {
  const item = findCosmetic(id);
  if (!item || !ownsCosmetic(state, id)) return false;
  if (item.kind === "character") state.character = item.contentId as CharacterId;
  if (item.kind === "character-skin") state.characterSkin = item.contentId as CharacterSkinId;
  if (item.kind === "weapon-skin") state.weaponSkin = item.contentId as WeaponSkinId;
  return true;
}
/** Award only completed matches. A tournament uses a different ID for each round. */
export function rewardMatch(state: CosmeticsState, matchId: string, won: boolean): number {
  if (!matchId || matchId.length > 100 || state.rewardedMatches.includes(matchId)) return 0;
  const earned = Math.min(MAX_FAVOR - state.favor, FAVOR_COMPLETION + (won ? FAVOR_WIN_BONUS : 0));
  state.favor += earned;
  state.rewardedMatches.push(matchId);
  if (state.rewardedMatches.length > 512) state.rewardedMatches.splice(0, state.rewardedMatches.length - 512);
  return earned;
}
