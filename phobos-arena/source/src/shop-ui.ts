import {
  CHARACTERS, CHARACTER_SKINS, WEAPON_SKINS,
  purchaseCosmetic, equipCosmetic, ownsCosmetic,
  FAVOR_COMPLETION, FAVOR_WIN_BONUS,
  type CosmeticsState, type CharacterId, type CharacterSkinId, type WeaponSkinId,
} from "./cosmetics";
import { WEAPONS, WEAPON_ORDER, type WeaponId } from "./rules";
import { CosmeticPreview } from "./cosmetic-preview";

type Category = "character" | "character-skin" | "weapon-skin";
interface ShopItem { id: string; name: string; description: string; price: number; title?: string }
const categories: { id: Category; name: string }[] = [
  { id: "character", name: "CHARACTERS" },
  { id: "character-skin", name: "CHARACTER FINISHES" },
  { id: "weapon-skin", name: "WEAPON FINISHES" },
];
const escape = (value: string) => value.replace(/[&<>"']/g,
  (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Favor-only catalog. Unlocking and equipping are explicit local profile actions. */
export class ShopUI {
  private category: Category = "character";
  private selected: string;
  private previewWeapon: WeaponId = "rocket";
  private preview: CosmeticPreview | null = null;
  private disposed = false;

  constructor(
    private host: HTMLElement,
    private state: CosmeticsState,
    private changed: () => boolean,
    closed: () => void,
  ) {
    this.selected = `character:${state.character}`;
    host.innerHTML = `<div class="dialog shop-dialog" role="dialog" aria-modal="true" aria-labelledby="shop-title">
      <div class="shop-header"><div><span class="eyebrow">THE OLD GODS ARE WATCHING</span><h2 id="shop-title">COSMETIC SHOP.</h2></div><div class="shop-wallet"><small>FAVOR</small><b id="shop-balance"></b></div><button id="shop-close" aria-label="Close cosmetic shop">×</button></div>
      <div class="shop-tabs" role="group" aria-label="Cosmetic category">${categories.map((c) => `<button data-category="${c.id}" aria-pressed="${c.id === this.category}">${c.name}</button>`).join("")}</div>
      <div class="shop-content"><section class="shop-showroom" aria-label="Cosmetic preview"><div class="showroom-grid"></div><div id="cosmetic-preview"></div><span class="preview-caption">LIVE 3D PREVIEW</span><div class="preview-toolbar"><button id="preview-left" aria-label="Rotate preview left">↶</button><span>DRAG TO ROTATE</span><button id="preview-reset" aria-label="Reset preview rotation">RESET</button><button id="preview-right" aria-label="Rotate preview right">↷</button></div><label id="preview-weapon-row" class="preview-weapon-row" hidden><span>PREVIEW WEAPON</span><select id="preview-weapon" aria-label="Weapon to preview">${WEAPON_ORDER.map((id) => `<option value="${id}" ${id === this.previewWeapon ? "selected" : ""}>${escape(WEAPONS[id].name)}</option>`).join("")}</select></label></section>
        <section class="shop-selection" aria-label="Cosmetic catalog"><div id="shop-catalog" class="shop-catalog"></div><div class="shop-detail"><span id="shop-item-type"></span><h3 id="shop-item-name"></h3><p id="shop-item-description"></p><button id="shop-action" class="primary"></button><p id="shop-feedback" role="status" aria-live="polite"></p></div></section></div>
      <div class="shop-footer"><span>APPEARANCE ONLY. SAME DAMAGE, SPEED & HITBOX.</span><p>Favor of the Old Gods: earn ${FAVOR_COMPLETION} for a completed match, plus ${FAVOR_WIN_BONUS} for a win. Saved on this device. No real-money purchases.</p></div>
    </div>`;
    this.element("shop-close").onclick = closed;
    host.addEventListener("keydown", this.keepFocus);
    host.querySelectorAll<HTMLButtonElement>("[data-category]").forEach((button) => {
      button.onclick = () => {
        this.category = button.dataset.category as Category;
        this.selected = this.equippedId(this.category);
        this.element("shop-feedback").textContent = "";
        this.render();
      };
    });
    this.element("shop-action").onclick = () => this.activate();
    this.element("preview-left").onclick = () => this.preview?.rotate(-1);
    this.element("preview-right").onclick = () => this.preview?.rotate(1);
    this.element("preview-reset").onclick = () => this.preview?.reset();
    this.element("preview-weapon").onchange = (event) => {
      this.previewWeapon = (event.target as HTMLSelectElement).value as WeaponId;
      this.updatePreview();
    };
    // A hidden panel has no usable canvas dimensions; main opens it before mounting.
    try {
      this.preview = new CosmeticPreview(this.element("cosmetic-preview"));
    } catch {
      this.element("cosmetic-preview").innerHTML = "<p class='preview-unavailable'>3D preview unavailable in this browser session.</p>";
      ["preview-left", "preview-right", "preview-reset"].forEach((id) =>
        (this.element(id) as HTMLButtonElement).disabled = true);
    }
    this.render();
    this.element("shop-close").focus();
  }

  private element(id: string) { return this.host.querySelector<HTMLElement>(`#${id}`)!; }

  private items(): ShopItem[] {
    const source = this.category === "character" ? CHARACTERS
      : this.category === "character-skin" ? CHARACTER_SKINS : WEAPON_SKINS;
    return source.map((item) => ({ ...item, id: `${this.category}:${item.id}` }));
  }

  private equippedId(category: Category) {
    return `${category}:${category === "character" ? this.state.character
      : category === "character-skin" ? this.state.characterSkin : this.state.weaponSkin}`;
  }

  private render() {
    if (this.disposed) return;
    this.element("shop-balance").textContent = this.state.favor.toLocaleString();
    this.host.querySelectorAll<HTMLButtonElement>("[data-category]").forEach((button) =>
      button.setAttribute("aria-pressed", String(button.dataset.category === this.category)));
    this.element("preview-weapon-row").hidden = this.category !== "weapon-skin";
    this.host.querySelector(".shop-showroom")!.classList.toggle("weapon-preview", this.category === "weapon-skin");
    const items = this.items();
    const catalog = this.element("shop-catalog");
    const scroll = catalog.scrollTop;
    catalog.innerHTML = items.map((item, index) => {
      const status = item.id === this.equippedId(this.category) ? "EQUIPPED"
        : ownsCosmetic(this.state, item.id) ? "OWNED" : `${item.price} FAVOR`;
      return `<button class="shop-item" data-cosmetic="${item.id}" aria-pressed="${item.id === this.selected}"><span class="item-number">${String(index + 1).padStart(2, "0")}</span><span class="item-name">${escape(item.name)}<small>${escape(item.title ?? (this.category === "weapon-skin" ? "ALL WEAPONS" : this.category === "character-skin" ? "ALL CHARACTERS" : "CHARACTER"))}</small></span><span class="item-status ${ownsCosmetic(this.state, item.id) ? "owned" : ""}">${status}</span></button>`;
    }).join("");
    catalog.scrollTop = scroll;
    catalog.querySelectorAll<HTMLButtonElement>("[data-cosmetic]").forEach((button) => {
      button.onclick = () => {
        this.selected = button.dataset.cosmetic!;
        this.element("shop-feedback").textContent = "";
        this.render();
      };
    });
    const item = items.find((candidate) => candidate.id === this.selected) ?? items[0];
    this.selected = item.id;
    this.element("shop-item-type").textContent = this.category === "character" ? "CHARACTER" : "COSMETIC FINISH";
    this.element("shop-item-name").textContent = item.name;
    this.element("shop-item-description").textContent = item.description;
    const action = this.element("shop-action") as HTMLButtonElement;
    const owned = ownsCosmetic(this.state, item.id);
    const equipped = this.equippedId(this.category) === item.id;
    const affordable = this.state.favor >= item.price;
    action.disabled = equipped || (!owned && !affordable);
    action.textContent = equipped ? "EQUIPPED" : owned ? "EQUIP →"
      : affordable ? `UNLOCK & EQUIP · ${item.price} FAVOR`
      : `NEED ${item.price - this.state.favor} MORE FAVOR`;
    this.updatePreview();
  }

  private updatePreview() {
    const id = this.selected.split(":")[1];
    if (this.category === "weapon-skin")
      this.preview?.showWeapon(this.previewWeapon, id as WeaponSkinId);
    else this.preview?.showCharacter(
      this.category === "character" ? id as CharacterId : this.state.character,
      this.category === "character-skin" ? id as CharacterSkinId : this.state.characterSkin,
    );
  }

  private activate() {
    if (this.disposed) return;
    const item = this.items().find((candidate) => candidate.id === this.selected)!;
    const previous = structuredClone(this.state);
    const owned = ownsCosmetic(this.state, item.id);
    if (!owned) {
      const result = purchaseCosmetic(this.state, item.id);
      if (!result.ok) {
        this.element("shop-feedback").textContent = result.reason ?? "This cosmetic could not be unlocked.";
        return;
      }
    }
    if (!equipCosmetic(this.state, item.id)) {
      Object.assign(this.state, previous);
      return;
    }
    if (!this.changed()) {
      Object.assign(this.state, previous);
      this.render();
      this.element("shop-feedback").textContent = "Browser storage is unavailable. Nothing was spent or equipped.";
      return;
    }
    this.render();
    this.element("shop-feedback").textContent = `${item.name} ${owned ? "equipped" : "unlocked and equipped"}.`;
  }

  dispose() {
    this.disposed = true;
    this.host.removeEventListener("keydown", this.keepFocus);
    this.preview?.dispose();
    this.preview = null;
  }

  private keepFocus = (event: KeyboardEvent) => {
    if (event.key !== "Tab") return;
    const focusable = [...this.host.querySelectorAll<HTMLElement>("button:not(:disabled),select:not(:disabled)")]
      .filter((element) => element.getClientRects().length > 0);
    const next = event.shiftKey ? focusable.at(-1) : focusable[0];
    const edge = event.shiftKey ? focusable[0] : focusable.at(-1);
    if (document.activeElement === edge && next) {
      event.preventDefault();
      next.focus();
    }
  };
}
