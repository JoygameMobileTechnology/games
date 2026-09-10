import QRCode from "qrcode";
import { defaultConfig, isTeamMode, MODE_INFO, normalizeConfig, type Difficulty, type Mode } from "../match";
import { MAP_INFO, mapsForMode } from "../maps/catalog";
import type { MapId } from "../maps/types";
import type { RoomSettings, RoomState, ServerInfo } from "./types";
import "./ui.css";

export interface LanView {
  info: ServerInfo | null;
  room: RoomState | null;
  slotId: number | null;
  status: string;
  error: string | null;
  initialCode?: string;
  initialSettings: RoomSettings;
  busy: boolean;
}

export interface LanActions {
  create(settings: RoomSettings): void | Promise<void>;
  join(code: string): void | Promise<void>;
  configure(settings: RoomSettings): void | Promise<void>;
  ready(ready: boolean): void | Promise<void>;
  start(): void | Promise<void>;
  lobby(): void | Promise<void>;
  leave(): void | Promise<void>;
  close(): void;
}

const difficulties: Difficulty[] = ["Easy", "Medium", "Competitive"];
const escape = (text: string) => text.replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[c]!);
const clone = (settings: RoomSettings): RoomSettings => ({
  ...settings,
  config: { ...settings.config, botDifficulties: [...settings.config.botDifficulties], teamColors: [...settings.config.teamColors] },
});
const signature = (settings: RoomSettings) => JSON.stringify(settings);

/** The view owns forms and invitation rendering; membership belongs to its caller. */
export class LanUI {
  private view: LanView | null = null;
  private draft: RoomSettings | null = null;
  private context = "";
  private dirty = false;
  private baseline = "";
  private submitted = "";
  private settingsDrawn = "";
  private rosterDrawn = "";
  private addressesDrawn = "";
  private selectedAddress = "";
  private inviteUrl = "";
  private qrGeneration = 0;
  private pending = false;
  private disposed = false;

  constructor(private container: HTMLElement, private actions: LanActions) {
    container.addEventListener("keydown", this.onKeyDown);
  }

  render(view: LanView): void {
    if (this.disposed) return;
    this.view = view;
    const context = view.room?.code ?? "entry";
    const settings = view.room?.settings ?? view.initialSettings;
    const current = signature(settings);
    const owner = !!view.room && view.room.ownerId === view.slotId;
    if (context !== this.context) {
      this.context = context;
      this.draft = clone(settings);
      this.baseline = current;
      this.dirty = false;
      this.submitted = "";
      this.settingsDrawn = this.rosterDrawn = this.addressesDrawn = "";
      this.inviteUrl = "";
      this.qrGeneration++;
      this.mount();
    } else if ((view.room && !owner) || (!this.dirty && current !== this.baseline) || current === this.submitted) {
      this.draft = clone(settings);
      this.dirty = false;
      this.submitted = "";
      this.baseline = current;
    }
    this.el("lan-status").textContent = view.status;
    this.el("lan-error").textContent = view.error ?? "";
    this.el("lan-error").hidden = !view.error;
    this.el("lan-server-help").hidden = !!view.info;
    if (view.room) this.renderRoom(view.room, owner);
    this.renderSettings();
    this.renderAvailability();
  }

  private el<T extends HTMLElement = HTMLElement>(id: string): T {
    return this.container.querySelector<T>(`#${id}`)!;
  }

  private mount() {
    const view = this.view!;
    const room = view.room;
    this.container.innerHTML = `<section class="dialog lan-dialog" role="dialog" aria-modal="true" aria-labelledby="lan-title">
      <div class="dialog-heading"><span class="eyebrow">LOCAL NETWORK</span><h2 id="lan-title">${room ? "ROOM LOBBY." : "LAN PLAY."}</h2><button type="button" id="lan-close" class="close-button" aria-label="${room ? "Leave room and close" : "Close LAN panel"}" title="${room ? "Leave room" : "Close"}">×</button></div>
      <p id="lan-status" class="lan-status" role="status" aria-live="polite"></p><p id="lan-error" class="lan-error" role="alert" hidden></p>
      <p id="lan-server-help" class="lan-note">Open the game using the local server’s network address, on the same network as the other players. A room code works only on that server. No internet connection is needed.</p>
      ${room ? `<div class="lan-room-heading"><div><span>ROOM CODE</span><strong id="lan-room-code"></strong></div><span id="lan-phase"></span></div>
        <p id="lan-room-summary" class="lan-note"></p><div class="lan-room-grid"><section aria-label="Players"><div id="lan-roster" class="lan-roster"></div><p id="lan-ready-note" class="lan-note"></p><div class="lan-room-actions"><button type="button" id="lan-ready" class="lan-button"></button><button type="button" id="lan-start" class="primary">START MATCH →</button><button type="button" id="lan-lobby" class="primary">RETURN TO LOBBY →</button><button type="button" id="lan-leave" class="lan-button">LEAVE ROOM</button></div></section>
          <details class="lan-invite" open><summary>INVITE PLAYERS</summary><label class="lan-field" for="lan-address"><span>LOCAL SERVER ADDRESS</span><select id="lan-address"></select></label><p id="lan-address-help" class="lan-note"></p><img id="lan-qr" width="176" height="176" alt="QR code to join this room" hidden/><p id="lan-qr-note" class="lan-note">Scan with your phone’s Camera to open this room.</p><label class="lan-field" for="lan-invite-url"><span>JOIN LINK</span><input id="lan-invite-url" type="text" readonly spellcheck="false"/></label><div class="lan-invite-actions"><button type="button" id="lan-copy" class="lan-button">COPY LINK</button><button type="button" id="lan-share" class="lan-button">SHARE LINK</button></div><p id="lan-copy-status" class="lan-note" role="status" aria-live="polite"></p></details></div>`
        : `<form id="lan-join-form" class="lan-join"><label class="lan-field" for="lan-join-code"><span>HAVE A ROOM CODE?</span><input id="lan-join-code" type="text" maxlength="24" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ROOM CODE" required/></label><button type="submit" id="lan-join" class="lan-button">JOIN ROOM →</button></form><p class="lan-note">Enter a code from this server, or scan the host’s QR code with your phone’s Camera.</p>`}
      <details id="lan-settings-details" class="lan-settings-details" ${room ? "" : "open"}><summary id="lan-settings-label">${room ? "ROOM SETTINGS" : "CREATE A ROOM"}</summary><form id="lan-settings-form"><div id="lan-settings-fields"></div><p id="lan-settings-note" class="lan-note"></p><div class="lan-settings-actions"><button type="submit" id="lan-save" class="primary">${room ? "APPLY SETTINGS →" : "CREATE ROOM →"}</button><button type="button" id="lan-discard" class="lan-button" hidden>DISCARD CHANGES</button></div></form></details>
    </section>`;
    this.el("lan-close").onclick = () => this.actions.close();
    if (room) {
      this.el("lan-ready").onclick = () => {
        const self = this.view?.room?.slots.find((slot) => slot.id === this.view?.slotId);
        if (self) this.invoke(() => this.actions.ready(!self.ready));
      };
      this.el("lan-start").onclick = () => this.invoke(() => this.actions.start());
      this.el("lan-lobby").onclick = () => this.invoke(() => this.actions.lobby());
      this.el("lan-leave").onclick = () => this.invoke(() => this.actions.leave());
      this.el<HTMLSelectElement>("lan-address").onchange = (event) => {
        this.selectedAddress = (event.target as HTMLSelectElement).value;
        this.updateInvitation();
      };
      this.el("lan-copy").onclick = () => { void this.copyInvitation(); };
      this.el("lan-share").onclick = () => { void this.shareInvitation(); };
    } else {
      this.el<HTMLInputElement>("lan-join-code").value = view.initialCode ?? "";
      this.el<HTMLFormElement>("lan-join-form").onsubmit = (event) => {
        event.preventDefault();
        const code = this.el<HTMLInputElement>("lan-join-code").value.trim().toUpperCase();
        if (code && this.view?.info) this.invoke(() => this.actions.join(code));
      };
    }
    this.el<HTMLFormElement>("lan-settings-form").onsubmit = (event) => {
      event.preventDefault();
      if (!this.view?.info || !this.draft || this.pending || this.view.busy) return;
      const room = this.view.room;
      if (room && (!this.dirty || room.phase !== "lobby" || room.ownerId !== this.view.slotId)) return;
      const score = this.el<HTMLInputElement>("lan-score");
      if (!score.reportValidity()) return;
      this.draft.config.scoreLimit = score.valueAsNumber;
      this.normalizeDraft();
      const settings = clone(this.draft);
      this.submitted = signature(settings);
      this.invoke(() => room ? this.actions.configure(settings) : this.actions.create(settings));
    };
    this.el("lan-discard").onclick = () => {
      this.draft = clone(this.view!.room?.settings ?? this.view!.initialSettings);
      this.baseline = signature(this.draft);
      this.dirty = false;
      this.submitted = "";
      this.renderSettings();
      this.renderAvailability();
    };
    this.el("lan-close").focus({ preventScroll: true });
  }

  private renderRoom(room: RoomState, owner: boolean) {
    const info = this.view!.info;
    this.el("lan-room-code").textContent = room.code;
    this.el("lan-phase").textContent = room.phase === "playing" ? "MATCH IN PROGRESS" : room.phase === "results" ? "MATCH COMPLETE" : owner ? "YOU ARE HOST" : "WAITING ROOM";
    const config = room.settings.config;
    this.el("lan-room-summary").textContent = `${MODE_INFO[config.mode].name} · ${MAP_INFO[room.settings.mapId].name} · ${config.population} slots · ${config.timeLimit / 60} min · ${config.scoreLimit} ${MODE_INFO[config.mode].scoreLabel.toLowerCase()}`;
    const roster = JSON.stringify([room.slots, room.ownerId, this.view!.slotId, config.mode, config.teamColors]);
    if (roster !== this.rosterDrawn) {
      this.rosterDrawn = roster;
      this.el("lan-roster").innerHTML = room.slots.map((slot) => {
        const reserved = slot.reservedUntil !== null;
        const status = reserved ? slot.controller === "bot" ? "BOT COVER · SLOT RESERVED" : "DISCONNECTED · SLOT RESERVED"
          : slot.controller === "empty" ? "OPEN SLOT" : slot.controller === "bot" ? "BOT"
            : slot.connected ? slot.ready ? "READY" : "NOT READY" : "DISCONNECTED";
        const tags = [slot.id === this.view!.slotId ? "YOU" : "", slot.id === room.ownerId ? "HOST" : "", isTeamMode(config.mode) ? `TEAM ${slot.id % 2 === 0 ? "I" : "II"}` : ""].filter(Boolean);
        const color = isTeamMode(config.mode) ? config.teamColors[slot.id % 2] : "#686a69";
        return `<div class="lan-slot ${slot.id === this.view!.slotId ? "lan-self" : ""}" style="--slot-color:${escape(color)}"><span class="lan-slot-number">${String(slot.id + 1).padStart(2, "0")}</span><span class="lan-slot-name">${escape(slot.controller === "empty" && !reserved ? "Empty slot" : slot.name)}<small>${tags.join(" · ")}</small></span><span class="lan-slot-state ${slot.ready && slot.connected ? "is-ready" : ""}">${status}</span></div>`;
      }).join("");
    }
    this.el("lan-ready-note").textContent = room.phase === "playing" ? "The match continues while this panel is open."
      : room.phase === "results" ? owner ? "Return everyone to the lobby to prepare the next match." : "The host can return everyone to the lobby for the next match."
        : `Players reconnecting within ${info?.reconnectSeconds ?? 60} seconds reclaim their slot. ${room.settings.replaceDisconnected ? "A bot takes over during disconnection." : "Disconnected players are not replaced by bots."}`;
    this.updateAddresses();
  }

  private normalizeDraft() {
    const draft = this.draft!;
    const mode = draft.config.mode;
    if (!MAP_INFO[draft.mapId].modes.includes(mode)) draft.mapId = mapsForMode(mode)[0];
    const old = draft.config.botDifficulties;
    draft.config = normalizeConfig(draft.config, MAP_INFO[draft.mapId].maxPlayers);
    draft.config.botDifficulties = draft.config.botDifficulties.map((value, index) => old[index] ?? "Competitive");
  }

  private changed(structural = false) {
    this.dirty = true;
    this.submitted = "";
    if (structural) { this.normalizeDraft(); this.renderSettings(); }
    else {
      // The DOM already contains this edit. Do not rebuild it on the next roster update.
      const room = this.view!.room;
      const editable = !room || room.ownerId === this.view!.slotId && room.phase === "lobby";
      this.settingsDrawn = signature(this.draft!) + editable;
    }
    this.renderAvailability();
  }

  private renderSettings() {
    const draft = this.draft!;
    const { config } = draft;
    const room = this.view!.room;
    const editable = !room || (room.ownerId === this.view!.slotId && room.phase === "lobby");
    const key = signature(draft) + editable;
    // A routine roster/connection update must not replace active form controls.
    if (key === this.settingsDrawn) return;
    this.settingsDrawn = key;
    const active = document.activeElement as HTMLInputElement | null;
    const focusedId = active && this.container.contains(active) ? active.id : "";
    const selection = active?.tagName === "INPUT" && active.type === "text" ? [active.selectionStart, active.selectionEnd] : null;
    const botDetailsOpen = this.container.querySelector<HTMLDetailsElement>(".lan-bot-details")?.open ?? false;
    const populations = config.mode === "duel" ? [2]
      : Array.from({ length: MAP_INFO[draft.mapId].maxPlayers - 1 }, (_, i) => i + 2).filter((n) => !isTeamMode(config.mode) || n % 2 === 0);
    const options = (values: readonly string[], selected: string) => values.map((value) => `<option value="${escape(value)}" ${value === selected ? "selected" : ""}>${escape(value)}</option>`).join("");
    this.el("lan-settings-fields").innerHTML = `<fieldset ${editable ? "" : "disabled"}><div class="lan-fields">
      <label class="lan-field" for="lan-mode"><span>GAME MODE</span><select id="lan-mode">${(Object.keys(MODE_INFO) as Mode[]).map((mode) => `<option value="${mode}" ${mode === config.mode ? "selected" : ""}>${MODE_INFO[mode].name}</option>`).join("")}</select></label>
      <label class="lan-field" for="lan-map"><span>ARENA</span><select id="lan-map">${mapsForMode(config.mode).map((id) => `<option value="${id}" ${id === draft.mapId ? "selected" : ""}>${MAP_INFO[id].name} · up to ${MAP_INFO[id].maxPlayers}</option>`).join("")}</select></label>
      <label class="lan-field" for="lan-population"><span>ROOM SIZE</span><select id="lan-population">${populations.map((n) => `<option value="${n}" ${n === config.population ? "selected" : ""}>${n} players${isTeamMode(config.mode) ? ` · ${n / 2}v${n / 2}` : ""}</option>`).join("")}</select></label>
      <label class="lan-field" for="lan-time"><span>ROUND TARGET</span><select id="lan-time">${Array.from({ length: 10 }, (_, i) => `<option value="${(i + 1) * 60}" ${(i + 1) * 60 === config.timeLimit ? "selected" : ""}>${i + 1} min</option>`).join("")}</select></label>
      <label class="lan-field" for="lan-score"><span>SCORE TO WIN</span><input id="lan-score" type="number" min="1" max="999" step="1" required value="${config.scoreLimit}"/></label>
      <label class="lan-field" for="lan-all-bots"><span>ALL BOT DIFFICULTIES</span><select id="lan-all-bots"><option value="mixed">Mixed</option>${options(difficulties, difficulties.find((level) => config.botDifficulties.every((d) => d === level)) ?? "mixed")}</select></label>
    </div><div class="lan-toggles"><label class="switch-row"><span>Fill empty slots with bots</span><input id="lan-fill-bots" type="checkbox" ${draft.fillBots ? "checked" : ""}/></label><label class="switch-row"><span>Replace disconnected players with bots</span><input id="lan-replace-bots" type="checkbox" ${draft.replaceDisconnected ? "checked" : ""}/></label></div>
    ${isTeamMode(config.mode) ? `<div class="lan-fields lan-team-colors">${config.teamColors.map((color, i) => `<label class="lan-field" for="lan-team-${i}"><span>TEAM ${i === 0 ? "I" : "II"} COLOR</span><input id="lan-team-${i}" type="color" value="${escape(color)}"/></label>`).join("")}</div><p class="lan-note">Alternating slots form Team I and Team II. Friendly fire is off.</p>` : ""}
    <details class="lan-bot-details" ${botDetailsOpen ? "open" : ""}><summary>INDIVIDUAL BOT DIFFICULTIES</summary><p class="lan-note">Used when a bot occupies that slot. Slot 1 uses Competitive difficulty.</p><div class="lan-fields">${config.botDifficulties.map((level, i) => `<label class="lan-field" for="lan-bot-${i}"><span>SLOT ${i + 2}${isTeamMode(config.mode) ? ` · TEAM ${(i + 1) % 2 === 0 ? "I" : "II"}` : ""}</span><select id="lan-bot-${i}" data-lan-bot="${i}">${options(difficulties, level)}</select></label>`).join("")}</div></details></fieldset>`;
    this.el<HTMLSelectElement>("lan-mode").onchange = (event) => {
      const mode = (event.target as HTMLSelectElement).value as Mode;
      const level = draft.config.botDifficulties[0] ?? "Competitive";
      draft.config = { ...defaultConfig(mode), timeLimit: draft.config.timeLimit, teamColors: [...draft.config.teamColors] };
      draft.config.botDifficulties.fill(level);
      this.changed(true);
    };
    this.el<HTMLSelectElement>("lan-map").onchange = (event) => { draft.mapId = (event.target as HTMLSelectElement).value as MapId; this.changed(true); };
    this.el<HTMLSelectElement>("lan-population").onchange = (event) => { draft.config.population = Number((event.target as HTMLSelectElement).value); this.changed(true); };
    this.el<HTMLSelectElement>("lan-time").onchange = (event) => { draft.config.timeLimit = Number((event.target as HTMLSelectElement).value); this.changed(); };
    this.el<HTMLInputElement>("lan-score").oninput = (event) => { draft.config.scoreLimit = (event.target as HTMLInputElement).valueAsNumber; this.changed(); };
    this.el<HTMLSelectElement>("lan-all-bots").onchange = (event) => {
      const value = (event.target as HTMLSelectElement).value;
      if (value !== "mixed") { draft.config.botDifficulties.fill(value as Difficulty); this.changed(true); }
    };
    this.el<HTMLInputElement>("lan-fill-bots").onchange = (event) => { draft.fillBots = (event.target as HTMLInputElement).checked; this.changed(); };
    this.el<HTMLInputElement>("lan-replace-bots").onchange = (event) => { draft.replaceDisconnected = (event.target as HTMLInputElement).checked; this.changed(); };
    this.container.querySelectorAll<HTMLSelectElement>("[data-lan-bot]").forEach((select) => {
      select.onchange = () => {
        draft.config.botDifficulties[Number(select.dataset.lanBot)] = select.value as Difficulty;
        this.el<HTMLSelectElement>("lan-all-bots").value = difficulties.find((level) => draft.config.botDifficulties.every((d) => d === level)) ?? "mixed";
        this.changed();
      };
    });
    config.teamColors.forEach((_, i) => {
      const input = this.container.querySelector<HTMLInputElement>(`#lan-team-${i}`);
      if (input) input.oninput = () => { draft.config.teamColors[i] = input.value; this.changed(); };
    });
    if (focusedId) {
      const next = this.container.querySelector<HTMLInputElement>(`#${focusedId}`);
      next?.focus({ preventScroll: true });
      if (next && selection) next.setSelectionRange(selection[0], selection[1]);
    }
  }

  private renderAvailability() {
    if (!this.view) return;
    const view = this.view;
    const room = view.room;
    const blocked = view.busy || this.pending;
    const owner = !!room && room.ownerId === view.slotId;
    const editable = !room || owner && room.phase === "lobby";
    const save = this.el<HTMLButtonElement>("lan-save");
    save.hidden = !editable;
    save.disabled = blocked || !view.info || !!room && !this.dirty;
    const discard = this.el<HTMLButtonElement>("lan-discard");
    discard.hidden = !room || !editable || !this.dirty;
    discard.disabled = blocked;
    this.el("lan-settings-note").textContent = !room ? "Create a room, then invite players. Tied matches can run into sudden death, with a ten-minute maximum."
      : !owner ? "The host controls these settings."
        : room.phase !== "lobby" ? "Return to the lobby to change settings."
          : this.dirty ? "Unsaved changes. Apply them before starting. Changes can reset player readiness."
            : "Settings are shared with everyone. Choose the roster before players ready up.";
    if (!room) {
      this.el<HTMLButtonElement>("lan-join").disabled = blocked || !view.info;
      return;
    }
    const self = room.slots.find((slot) => slot.id === view.slotId);
    const ready = this.el<HTMLButtonElement>("lan-ready");
    ready.hidden = room.phase !== "lobby" || owner;
    ready.disabled = blocked || !self?.connected || owner && this.dirty;
    ready.textContent = self?.ready ? "NOT READY" : "READY UP";
    ready.setAttribute("aria-pressed", String(!!self?.ready));
    const start = this.el<HTMLButtonElement>("lan-start");
    start.hidden = !owner || room.phase !== "lobby";
    const waiting = room.slots.some((slot) => slot.id !== room.ownerId && slot.controller === "human" && (!slot.connected || !slot.ready));
    const occupied = room.slots.filter((slot) => slot.controller !== "empty").length;
    start.disabled = blocked || this.dirty || waiting || occupied < 2;
    start.textContent = waiting ? "WAITING FOR PLAYERS" : occupied < 2 ? "NEED ANOTHER PLAYER OR BOT" : "START MATCH →";
    const lobby = this.el<HTMLButtonElement>("lan-lobby");
    lobby.hidden = !owner || room.phase !== "results";
    lobby.disabled = blocked;
    this.el<HTMLButtonElement>("lan-leave").disabled = blocked;
  }

  private updateAddresses() {
    const addresses = [...new Set((this.view?.info?.addresses ?? []).filter((address) => {
      try {
        const url = new URL(address);
        return ["http:", "https:"].includes(url.protocol) && !["localhost", "0.0.0.0", "[::]", "[::1]"].includes(url.hostname.toLowerCase()) && !url.hostname.startsWith("127.") && !url.username && !url.password;
      } catch { return false; }
    }))];
    if (!addresses.includes(this.selectedAddress)) this.selectedAddress = addresses.find((address) => {
      try { return new URL(address).origin === location.origin; } catch { return false; }
    }) ?? addresses[0] ?? "";
    const key = JSON.stringify(addresses);
    if (key !== this.addressesDrawn) {
      this.addressesDrawn = key;
      const select = this.el<HTMLSelectElement>("lan-address");
      select.innerHTML = addresses.map((address) => `<option value="${escape(address)}">${escape(address)}</option>`).join("");
      select.value = this.selectedAddress;
      select.disabled = addresses.length < 2;
    }
    this.el("lan-address-help").textContent = !addresses.length ? "No network address is available. Check the address shown by the local server. Players already on this server can join by room code."
      : addresses.length > 1 ? "Choose the address on the same network as your players." : "Players must be on the same local network.";
    this.updateInvitation();
  }

  private updateInvitation() {
    if (!this.view?.room) return;
    let invite = "";
    if (this.selectedAddress) {
      const url = new URL(this.selectedAddress);
      url.search = "";
      url.hash = "";
      url.searchParams.set("room", this.view.room.code);
      invite = url.toString();
    }
    this.el<HTMLInputElement>("lan-invite-url").value = invite;
    this.el<HTMLButtonElement>("lan-copy").disabled = !invite;
    this.el<HTMLButtonElement>("lan-share").hidden = typeof navigator.share !== "function";
    this.el<HTMLButtonElement>("lan-share").disabled = !invite;
    if (invite === this.inviteUrl) return;
    this.inviteUrl = invite;
    const generation = ++this.qrGeneration;
    const image = this.el<HTMLImageElement>("lan-qr");
    image.hidden = true;
    image.removeAttribute("src");
    this.el("lan-copy-status").textContent = "";
    this.el("lan-qr-note").textContent = invite ? "Scan with your phone’s Camera to open this room." : "Share the room code after players open this local server.";
    if (!invite) return;
    void QRCode.toDataURL(invite, { width: 220, margin: 3, errorCorrectionLevel: "M", color: { dark: "#101318", light: "#ffffff" } }).then((source) => {
      if (this.disposed || generation !== this.qrGeneration) return;
      image.src = source;
      image.hidden = false;
    }).catch(() => {
      if (!this.disposed && generation === this.qrGeneration) this.el("lan-qr-note").textContent = "QR preview unavailable. Share the link or room code instead.";
    });
  }

  private async copyInvitation() {
    if (!this.inviteUrl) return;
    const url = this.inviteUrl;
    let copied = false;
    try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(url); copied = true; } } catch { /* Plain HTTP may not expose Clipboard API. */ }
    if (this.disposed || this.inviteUrl !== url) return;
    if (!copied) {
      const input = this.el<HTMLInputElement>("lan-invite-url");
      input.focus();
      input.select();
      try { copied = document.execCommand("copy"); } catch { /* The selected field remains available for manual copy. */ }
    }
    this.el("lan-copy-status").textContent = copied ? "Join link copied." : "Select and copy the join link above.";
  }

  private async shareInvitation() {
    if (!this.inviteUrl || typeof navigator.share !== "function") return;
    const url = this.inviteUrl;
    try {
      await navigator.share({ title: "Phobos LAN room", text: `Join room ${this.view!.room!.code} on our local network.`, url });
    } catch (error) {
      if (!this.disposed && this.inviteUrl === url && (!(error instanceof Error) || error.name !== "AbortError")) this.el("lan-copy-status").textContent = "Sharing is unavailable. Copy the join link instead.";
    }
  }

  private invoke(action: () => void | Promise<void>) {
    if (this.pending || this.view?.busy || this.disposed) return;
    this.pending = true;
    this.renderAvailability();
    void Promise.resolve().then(() => { if (!this.disposed) return action(); }).catch((error: unknown) => {
      if (this.disposed) return;
      this.el("lan-error").hidden = false;
      this.el("lan-error").textContent = error instanceof Error ? error.message : "That action could not be completed. Try again.";
    }).finally(() => {
      this.pending = false;
      if (!this.disposed) this.renderAvailability();
    });
  }

  private onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      this.actions.close();
      return;
    }
    if (event.key !== "Tab") return;
    const targets = [...this.container.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), select:not(:disabled), summary, [tabindex='0']")].filter((node) => !node.hidden && node.getClientRects().length > 0);
    const first = targets[0], last = targets.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  dispose(): void {
    this.disposed = true;
    this.qrGeneration++;
    this.container.removeEventListener("keydown", this.onKeyDown);
    this.container.replaceChildren();
  }
}
