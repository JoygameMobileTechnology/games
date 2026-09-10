import RAPIER from "@dimforge/rapier3d-compat";
import { Game } from "./game";
import { mountControlsUI } from "./controls-ui";
import {
  areEnemies,
  isTeamMode,
  isFlagMode,
  defaultConfig,
  MODE_INFO,
  normalizeConfig,
  scoreFor,
  teamScores,
  type Difficulty,
  type MatchConfig,
  type Mode,
  type Team,
} from "./match";
import type { MapId } from "./maps/types";
import { MAP_IDS, MAP_INFO, mapsForMode, supportsMode } from "./maps/catalog";
import { getProfile, saveProfile, storageAvailable } from "./profile";
import { mountProfileTransfer } from "./profile-transfer-ui";
import { startOfflineCache } from "./offline";
import { mountStatistics } from "./statistics-ui";
import { settleStatistics } from "./statistics";
import { WEAPONS, WEAPON_ORDER } from "./rules";
import { createTournament, recordTournamentRound, type Tournament } from "./tournament";
import { trackingMarker } from "./tracking";
import { ShopUI } from "./shop-ui";
import { rewardMatch } from "./cosmetics";
import { bindUiViewport } from "./ui-viewport";
import { LanClient } from "./lan/client";
import { LanUI } from "./lan/ui";
import { settleLanMatch } from "./lan/settlement";
import type { GameSnapshot, RoomSettings } from "./lan/types";
import "./style.css";
import "./responsive.css";
import "./shop-mobile.css";

const app = document.querySelector<HTMLDivElement>("#app")!;
bindUiViewport(app);
const profile = getProfile();
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const markUrl = escape(`${import.meta.env.BASE_URL}mark.svg`);
app.innerHTML = `<div class="boot"><img src="${markUrl}" alt=""/><strong>PHOBOS</strong><span>OPENING THE GATES</span><i></i></div>`;
let offlineStatus = import.meta.env.PROD
  ? "Preparing offline cache"
  : "Development build";

async function boot() {
  await RAPIER.init();
  const game = new Game(
    document.querySelector<HTMLCanvasElement>("#world")!,
    profile,
  );
  let screen = profile.name ? "menu" : "identity";
  let panel: "options" | "stats" | "controls" | "setup" | "scores" | "shop" | "lan" | null =
    null;
  let shop: ShopUI | null = null;
  let disposeProfileTransfer: (() => void) | null = null;
  let disposeControls: (() => void) | null = null;
  const lan = new LanClient();
  let lanUI: LanUI | null = null;
  let latestLanSnapshot: GameSnapshot | null = null;
  let replicaMatchId: string | null = null;
  const inviteCode = new URLSearchParams(location.search).get("room")?.slice(0, 8).toUpperCase() ?? "";
  let config = defaultConfig();
  let setupDraft: MatchConfig | null = null;
  let series: Tournament | null = null;
  let seriesRoundIndex = 0;
  const modes: Mode[] = ["ffa", "duel", "tdm", "ctf", "oneflag", "juggernaut"];
  const difficulties: Difficulty[] = ["Easy", "Medium", "Competitive"];
  let messageUntil = 0;
  let hitUntil = 0;
  let hurtUntil = 0;
  const feed: { text: string; until: number }[] = [];

  app.innerHTML = `
    <div id="menu-scrim"></div>
    <header id="topbar"><a class="brand" href="#" aria-label="Phobos main menu"><img src="${markUrl}" alt=""/><span>PHOBOS<small>ARENA</small></span></a><div class="profile-chip"><i></i><span id="profile-name"></span><small>LOCAL OPERATOR</small></div></header>
    <main id="menu" class="menu-shell">
      <div class="eyebrow"><span class="dash"></span>MARS SYSTEM / PHOBOS</div>
      <h1>NO GODS.<br/>JUST FRAGS.</h1>
      <p class="intro">Beneath a dead moon.<br/>Inside a living hell.</p>
      <div class="menu-actions">
        <button id="play" class="play-button"><span><small>01 / ENTER THE ARENA</small>SKIRMISH</span><b>↗</b></button>
        <button id="lan-play" class="setup-row"><span>LAN PLAY</span><b>CREATE / JOIN ROOM</b><i>↗</i></button>
        <button id="cosmetic-shop" class="setup-row shop-entry" data-panel="shop"><span>COSMETIC SHOP</span><b><span id="favor-balance">0</span> FAVOR</b><i>↗</i></button>
        <button id="tournament" class="setup-row"><span>TOURNAMENT</span><b>BEST OF THREE</b><i>↗</i></button>
        <button id="match-setup" class="setup-row"><span>MATCH SETUP</span><b id="setup-summary"></b><i>＋</i></button>
        <div class="secondary-actions"><button data-panel="options">OPTIONS <span>↗</span></button><button data-panel="stats">STATISTICS <span>↗</span></button></div>
        <button class="controls-link" data-panel="controls">INPUT REFERENCE <span>＋</span></button>
      </div>
    </main>
    <aside id="arena-card"><div class="compact-pickers"><label>GAME MODE<select id="compact-mode" aria-label="Game mode">${modes.map((mode) => `<option value="${mode}">${escape(MODE_INFO[mode].name)}</option>`).join("")}</select></label><label>ARENA<select id="compact-map" aria-label="Arena"></select></label></div><span class="eyebrow">CHOOSE YOUR FIGHT</span><div class="mode-switch" role="group" aria-label="Game mode">${modes.map((mode) => `<button data-mode="${mode}" aria-pressed="${mode === config.mode}">${escape(MODE_INFO[mode].name.toUpperCase())}</button>`).join("")}</div><p id="mode-description"></p><span class="eyebrow map-label">SELECT YOUR ARENA</span><div class="map-switch" role="group" aria-label="Arena selection">${MAP_IDS.map((id,i)=>`<button data-map="${id}" aria-pressed="${id===game.map.id}">${String(i+1).padStart(2,"0")} / ${MAP_INFO[id].short}</button>`).join("")}</div><strong id="map-name">THE OSSUARY</strong><p id="map-description"></p><div class="arena-coordinates"><span id="arena-mode"></span><em id="arena-rules"></em></div></aside>
    <footer id="footer"><span><i class="status-dot"></i><b id="cache-status"></b></span><span>CORE PROTOTYPE <b>0.9.2</b> <em>/</em> FULL GAME IN DEVELOPMENT</span></footer>
    <section id="identity" class="modal-backdrop"><form id="name-form" class="dialog identity-dialog"><img src="${markUrl}" class="dialog-mark" alt=""/><span class="eyebrow">IDENTIFICATION</span><h2>NAME YOURSELF.</h2><p>This is how you appear in the arena.</p><label for="username">OPERATOR NAME</label><input id="username" name="username" maxlength="20" minlength="1" autocomplete="off" placeholder="Your name" required/><button class="primary" type="submit">ENTER PHOBOS <span>→</span></button><small>Stored on this device. No account required.</small></form></section>
    <section id="panel" class="modal-backdrop" hidden></section>
    <section id="pause" class="modal-backdrop" hidden><div class="dialog pause-dialog"><span class="eyebrow">MATCH PAUSED</span><h2>TAKE A BREATH.</h2><p>The arena will wait.</p><p id="orientation-note" hidden>Turn to landscape to resume. Menus work in either orientation.</p><button id="resume" class="primary">RESUME <span>→</span></button><button id="pause-scores">STANDINGS</button><button data-panel="options">OPTIONS</button><button id="leave">RETURN TO MENU</button></div></section>
    <section id="results" class="modal-backdrop" hidden><div class="dialog results-dialog"><span class="eyebrow">MATCH COMPLETE</span><h2 id="result-title"></h2><p id="result-subtitle"></p><p id="favor-earned" class="favor-earned"></p><div id="series-result" hidden></div><div id="result-board"></div><button id="rematch" class="primary">PLAY AGAIN <span>→</span></button><button id="result-menu">RETURN TO MENU</button></div></section>
    <div id="hud" hidden>
      <div class="match-header"><button id="pause-button" aria-label="Pause match">Ⅱ</button><div class="match-score"><small id="hud-mode">FREE FOR ALL</small><b><span id="frag-count">0</span><i id="score-target">/ 15</i></b><span id="opponent-score"></span></div><div class="match-clock"><b id="clock">4:00</b><small id="clock-label">THE OSSUARY</small></div><button id="scores-button" aria-label="Pause and show standings">≡</button></div>
      <div class="weapon-bar" id="weapon-bar">${WEAPON_ORDER.map((id) => `<button data-weapon="${id}" aria-label="Equip ${WEAPONS[id].name}" hidden><small></small><span>${WEAPONS[id].short}</span><b id="stock-${id}"></b></button>`).join("")}</div>
      <div id="lan-connection-status" hidden aria-live="polite"></div><div id="series-status" hidden></div><div id="flag-status" hidden></div><div id="kill-feed"></div><div id="announcement"></div>
      <div id="crosshair"><i></i><b></b></div><div id="hit-marker">×</div><div id="damage-vignette"></div>
      <div id="juggernaut-tracker" hidden><span class="tracking-arrow"></span><span class="tracking-diamond"></span><span class="tracking-label"><b>JUGGERNAUT</b><span id="tracking-name"></span></span></div><div id="role-status" hidden></div><div id="power-status"></div>
      <div class="vitals"><div class="health"><small>HEALTH</small><b id="health">125</b><span id="health-line"></span></div><div class="armor"><small>ARMOR</small><b id="armor">0</b></div></div>
      <div class="ammo"><small id="weapon-name">IRON REPEATER</small><b id="ammo">100</b><span id="ammo-kind">ROUNDS</span></div>
      <div class="motion-status"><span id="speed">320</span> UPS <i></i><span id="hop">HOP 0 / 5</span></div>
      <div class="touch-zone-label left">MOVE / TAP TO HOP</div><div class="touch-zone-label right">LOOK / TAP TO FIRE</div>
      <div id="move-stick" class="stick"><i></i></div><div id="aim-stick" class="stick aim"><i></i></div>
      <div id="death-overlay" hidden><span class="eyebrow">YOU WERE FRAGGED</span><h2>BACK INTO THE FIRE.</h2><button id="respawn" class="primary">TAP TO RESPAWN</button><p>Space / A also works</p></div>
    </div>
    <div id="performance"><span id="fps">—</span><span>FPS</span><i></i><span id="frametime">—</span><span>MS</span><small id="render-stats"></small></div>
    <div id="rotate"><img src="${markUrl}" alt=""/><h2>TURN TO LANDSCAPE.</h2><p>The arena needs room for both thumbs.</p></div>
  `;
  const $ = (id: string) => document.getElementById(id)!;
  const weaponBar = $("weapon-bar");
  const weaponButtons = new Map(
    WEAPON_ORDER.map((id) => [
      id,
      document.querySelector<HTMLButtonElement>(`[data-weapon="${id}"]`)!,
    ]),
  );
  const coarsePointer = matchMedia("(pointer:coarse)");
  const needsLandscape = () => innerHeight > innerWidth && coarsePointer.matches;
  const show = () => {
    document.body.dataset.screen = screen;
    ($("resume") as HTMLButtonElement).disabled = needsLandscape();
    $("orientation-note").hidden = !needsLandscape();
    if (screen !== "game") $("juggernaut-tracker").hidden = true;
    $("menu").hidden = screen !== "menu";
    $("arena-card").hidden = screen !== "menu";
    $("topbar").hidden = screen === "game";
    $("footer").hidden = screen === "game";
    $("menu-scrim").hidden = screen === "game";
    $("identity").hidden = screen !== "identity";
    $("hud").hidden = !game.started;
    $("pause").hidden = screen !== "pause" || !!panel;
    $("results").hidden = screen !== "results" || !!panel;
    $("profile-name").textContent = profile.name;
    $("favor-balance").textContent = (profile.cosmetics?.favor ?? 0).toLocaleString();
    $("cache-status").textContent = storageAvailable
      ? offlineStatus
      : "Browser storage unavailable";
    const networked = !!lan.room;
    $("pause").querySelector(".eyebrow")!.textContent = networked ? "LOCAL CONTROLS PAUSED" : "MATCH PAUSED";
    $("pause").querySelector("p")!.textContent = networked ? "The match continues for everyone else." : "The arena will wait.";
    $("pause-button").setAttribute("aria-label", networked ? "Pause local controls" : "Pause match");
    $("scores-button").setAttribute("aria-label", networked ? "Show live standings" : "Pause and show standings");
    $("lan-connection-status").hidden = !networked || !game.started;
    $("lan-connection-status").textContent = networked ? `LAN ${lan.room!.code} · ${lan.connected ? "CONNECTED" : "RECONNECTING — CONTROLS PAUSED"}` : "";
    $("resume").toggleAttribute("disabled", needsLandscape() || (networked && !lan.connected));
  };
  const updateMapCard = () => {
    for (const id of WEAPON_ORDER) {
      const index = game.input.weaponSlots.indexOf(id);
      const key = index < 0 ? "" : game.input.weaponKeyLabel(index);
      const button = weaponButtons.get(id)!;
      button.querySelector("small")!.textContent = key;
      button.setAttribute(
        "aria-label",
        `Equip ${WEAPONS[id].name}${key ? ` (key ${key})` : ""}`,
      );
    }
    $("compact-map").innerHTML = mapsForMode(config.mode).map((id) => `<option value="${id}" ${id === game.map.id ? "selected" : ""}>${escape(MAP_INFO[id].short)}</option>`).join("");
    $("map-name").textContent = game.map.name.toUpperCase();
    $("map-description").textContent = game.map.subtitle;
    document
      .querySelectorAll<HTMLButtonElement>("[data-map]")
      .forEach((button) => {
        const id=button.dataset.map as MapId;
        button.hidden=!supportsMode(id, config.mode);
        button.setAttribute("aria-pressed", String(id===game.map.id));
      });
  };
  document
    .querySelectorAll<HTMLButtonElement>("[data-map]")
    .forEach((button) => {
      button.onclick = () => {
        const id=button.dataset.map as MapId;
        if (!supportsMode(id,config.mode)) return;
        game.selectMap(id);
        config=normalizeConfig(config,MAP_INFO[id].maxPlayers);
        updateMapCard(); updateConfig(); show();
      };
    });
  const updateConfig = () => {
    document
      .querySelectorAll<HTMLButtonElement>("[data-mode]")
      .forEach((button) =>
        button.setAttribute(
          "aria-pressed",
          String(button.dataset.mode === config.mode),
        ),
      );
    ($("compact-mode") as HTMLSelectElement).value = config.mode;
    $("mode-description").textContent = MODE_INFO[config.mode].description;
    $("arena-mode").textContent = MODE_INFO[config.mode].short.toUpperCase();
    $("arena-rules").textContent =
      `${config.population} PLAYERS / ${config.scoreLimit} ${MODE_INFO[config.mode].scoreLabel.toUpperCase()}`;
    $("setup-summary").textContent =
      `${config.population} PLAYERS · ${config.timeLimit / 60} MIN`;
  };
  document
    .querySelectorAll<HTMLButtonElement>("[data-mode]")
    .forEach((button) => {
      button.onclick = () => {
        config = defaultConfig(button.dataset.mode as Mode);
        if(!supportsMode(game.map.id, config.mode)) game.selectMap(mapsForMode(config.mode)[0]);
        config=normalizeConfig(config,MAP_INFO[game.map.id].maxPlayers);
        updateMapCard(); updateConfig();
      };
    });
  // Both menu layouts share the same mode/map selection behavior.
  $("compact-mode").onchange = (event) => document.querySelector<HTMLButtonElement>(`[data-mode="${(event.target as HTMLSelectElement).value}"]`)?.click();
  $("compact-map").onchange = (event) => document.querySelector<HTMLButtonElement>(`[data-map="${(event.target as HTMLSelectElement).value}"]`)?.click();
  updateMapCard();
  updateConfig();
  const applySettings = () => {
    game.applySettings();
    saveProfile(profile);
    $("crosshair").className = profile.settings.crosshair;
    $("crosshair").style.color = profile.settings.crosshairColor;
  };
  const startRound = () => {
    disposeControls?.(); disposeControls = null;
    disposeProfileTransfer?.(); disposeProfileTransfer = null;
    shop?.dispose();
    shop = null;
    seriesRoundIndex = series?.rounds.length ?? 0;
    $("series-status").hidden = !series;
    $("series-status").textContent = series ? `TOURNAMENT · MATCH ${seriesRoundIndex + 1} / 3` : "";
    $("series-result").hidden = true;
    updateMapCard();
    panel = null;
    $("panel").hidden = true;
    feed.length = 0;
    screen = "game";
    game.start(config);
    if (needsLandscape()) { game.pause(); screen = "pause"; }
    show();
    applySettings();
  };
  const pause = () => {
    if (!game.active || game.ended) return;
    if (lan.room) lan.idle();
    game.pause();
    screen = "pause";
    show();
  };
  game.onPause = pause;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pause();
  });
  const syncOrientation = () => {
    if (needsLandscape()) pause();
    show();
  };
  window.addEventListener("resize", syncOrientation);
  coarsePointer.addEventListener("change", syncOrientation);
  const start = () => { series=null; startRound(); };
  const startSeries = () => {
    series=createTournament(config,game.map.id);
    config=series.config;
    startRound();
  };
  $("play").onclick = start;
  $("tournament").onclick = startSeries;
  $("rematch").onclick = () => {
    if (lan.room) { if (lan.room.ownerId === lan.slotId) lan.lobby(); else openLan(); return; }
    if (!series) { start(); return; }
    if (series.finished) series=createTournament(series.config,series.maps[0]);
    config=series.config;
    game.selectMap(series.maps[series.rounds.length]);
    startRound();
  };
  $("pause-button").onclick = pause;
  const resume = () => {
    if (lan.room && !lan.connected) return;
    if (needsLandscape()) { game.pause(); screen = "pause"; show(); return; }
    screen = "game";
    game.resume();
    show();
  };
  $("resume").onclick = resume;
  const menu = () => {
    disposeControls?.(); disposeControls = null;
    if (game.started && !game.ended) {
      const telemetry = game.isReplica ? latestLanSnapshot?.actors.find(actor => actor.id === game.player.id)?.humanTelemetry : game.player.humanTelemetry;
      if (telemetry) {
        settleStatistics(profile, { matchId: game.matchId, source: game.isReplica ? "lan" : "solo", mode: game.config.mode, outcome: "abandoned", telemetry });
        saveProfile(profile);
      }
    }
    disposeProfileTransfer?.(); disposeProfileTransfer = null;
    shop?.dispose();
    shop = null;
    lanUI?.dispose(); lanUI = null;
    replicaMatchId = null; latestLanSnapshot = null;
    lan.leave();
    if (game.isReplica) game.stopReplica();
    game.toMenu();
    series=null;
    screen = "menu";
    panel = null;
    $("panel").hidden = true;
    updateMapCard();
    updateConfig();
    show();
  };
  $("leave").onclick = menu;
  $("result-menu").onclick = menu;
  document
    .querySelector(".brand")!
    .addEventListener("click", (e) => e.preventDefault());
  $("respawn").onclick = () => game.input.onRespawn();
  $("name-form").onsubmit = (e) => {
    e.preventDefault();
    const value = ($("username") as HTMLInputElement).value.trim();
    if (!value) return;
    profile.name = value;
    saveProfile(profile);
    screen = "menu";
    show();
    if (inviteCode) openLan();
  };
  document
    .querySelectorAll<HTMLButtonElement>("[data-weapon]")
    .forEach((button) => {
      game.input.bindWeaponButton(button, button.dataset.weapon as keyof typeof WEAPONS);
    });
  const teamName = (team: Team) => (team === 0 ? "TEAM I" : "TEAM II");
  const scoreText = (value: number) => String(Math.floor(value));
  const standings = () => {
    const match = game.config;
    const sums = teamScores(game.actors, game.config, game.captureScores);
    const groups: (Team | null)[] = isTeamMode(match.mode) ? [0, 1] : [null];
    const column = isFlagMode(match.mode) ? "CAPTURES" : match.mode === "juggernaut" ? "POINTS" : "FRAGS";
    return groups
      .map((team) => {
        const members = [...game.actors]
          .filter((a) => team === null || a.team === team)
          .sort(
            (a, b) =>
              scoreFor(match, b) - scoreFor(match, a) || a.deaths - b.deaths,
          );
        return `${team === null ? "" : `<div class="team-heading" style="--team-color:${match.teamColors[team]}"><span>${teamName(team)}${game.player.team === team ? " / YOUR TEAM" : ""}</span><b>${scoreText(sums[team])}</b></div>`}<div class="board-header"><span>OPERATOR</span><span>${column}</span><span>DEATHS</span></div>${members.map((a) => {
          const slot = lan.room?.slots.find((item) => item.id === a.id);
          const label = a.id === game.player.id ? "YOU" : slot?.controller === "human" ? "PLAYER" : slot?.controller === "empty" ? "EMPTY SLOT" : a.difficulty.toUpperCase();
          return `<div class="board-row ${a.id === game.player.id ? "self" : ""}"><span>${escape(a.name)}<small>${escape(label)}${a.id === game.juggernautId ? " / JUGGERNAUT" : ""}</small></span><b>${scoreText(scoreFor(match, a))}</b><span>${a.deaths}</span></div>`;
        }).join("")}`;
      })
      .join("");
  };
  const closePanel = () => {
    disposeControls?.(); disposeControls = null;
    disposeProfileTransfer?.(); disposeProfileTransfer = null;
    if (panel === "lan" && lan.room) { menu(); return; }
    if (panel === "lan") lan.leave();
    const wasShop = panel === "shop";
    lanUI?.dispose(); lanUI = null;
    shop?.dispose();
    shop = null;
    panel = null;
    setupDraft = null;
    $("panel").hidden = true;
    show();
    if (wasShop) $("cosmetic-shop").focus();
  };
  const openPanel = (kind: typeof panel) => {
    disposeControls?.(); disposeControls = null;
    disposeProfileTransfer?.(); disposeProfileTransfer = null;
    lanUI?.dispose(); lanUI = null;
    shop?.dispose();
    shop = null;
    panel = kind;
    if (kind === "shop") {
      $("panel").hidden = false;
      shop = new ShopUI($("panel"), profile.cosmetics!, () => {
        const saved = saveProfile(profile);
        if (saved) {
          game.applyCosmetics();
          show();
        }
        return saved;
      }, closePanel);
      show();
      return;
    }
    const s = profile.settings;
    let body = "";
    if (kind === "setup") {
      setupDraft ??= normalizeConfig({
        ...config,
        botDifficulties: [...config.botDifficulties],
        teamColors: [...config.teamColors],
      }, MAP_INFO[game.map.id].maxPlayers);
      const draft = setupDraft;
      const populations =
        draft.mode === "duel"
          ? [2]
          : isTeamMode(draft.mode)
            ? Array.from({length: MAP_INFO[game.map.id].maxPlayers / 2},(_,i)=>(i+1)*2)
            : Array.from({length: MAP_INFO[game.map.id].maxPlayers - 1},(_,i)=>i+2);
      body = `<p class="panel-intro">${escape(MODE_INFO[draft.mode].name)} · ${escape(game.map.name)}. Every open slot is an AI opponent${isTeamMode(draft.mode) ? " or teammate" : ""}.</p>
        <div class="match-settings">
          <label class="select-row">Players<select id="setup-population" aria-label="Player count" ${draft.mode === "duel" ? "disabled" : ""}>${populations.map((n) => `<option value="${n}" ${n === draft.population ? "selected" : ""}>${n}${isTeamMode(draft.mode) ? ` / ${n / 2}v${n / 2}` : ""}</option>`).join("")}</select></label>
          <label class="select-row">Round target<select id="setup-time" aria-label="Round target minutes">${Array.from(
            { length: 10 },
            (_, i) => i + 1,
          )
            .map(
              (n) =>
                `<option value="${n * 60}" ${n * 60 === draft.timeLimit ? "selected" : ""}>${n} min</option>`,
            )
            .join("")}</select></label>
          <label class="select-row">${escape(MODE_INFO[draft.mode].scoreLabel)} to win<input id="setup-score" aria-label="Score to win" type="number" min="1" max="999" step="1" value="${draft.scoreLimit}"/></label>
          <label class="select-row">Set all bots<select id="all-bots" aria-label="Set difficulty for all bots"><option value="">Mixed difficulties</option>${difficulties.map((d) => `<option ${draft.botDifficulties.every((level) => level === d) ? "selected" : ""}>${d}</option>`).join("")}</select></label>
        </div>
        <p class="setting-note">Ties continue in sudden death. Every match ends by 10 minutes. You occupy slot 1${isTeamMode(draft.mode) ? " on Team I. Friendly fire is off" : ""}.</p>
        ${isTeamMode(draft.mode) ? `<div class="team-color-settings">${([0, 1] as Team[]).map((team) => `<label class="select-row">${teamName(team)} color<input id="team-color-${team}" aria-label="${teamName(team)} color" type="color" value="${draft.teamColors[team]}"/></label>`).join("")}</div>` : ""}
        <h3>BOT ROSTER</h3><div class="bot-roster">${draft.botDifficulties.map((d, i) => `<label class="select-row"><span>BOT ${String(i + 1).padStart(2, "0")}${isTeamMode(draft.mode) ? `<small>${teamName(((i + 1) % 2) as Team)}</small>` : ""}</span><select data-bot="${i}" aria-label="Bot ${i + 1} difficulty">${difficulties.map((level) => `<option ${level === d ? "selected" : ""}>${level}</option>`).join("")}</select></label>`).join("")}</div>
        <button id="save-setup" class="primary">SAVE MATCH SETUP <span>→</span></button>`;
    }
    if (kind === "scores")
      body = `<p class="panel-intro">${escape(MODE_INFO[game.config.mode].name)} · ${escape(game.map.name)} · ${lan.room ? "Match continues while viewing standings." : "Match paused."}</p><div id="live-board">${standings()}</div><button id="scores-resume" class="primary">RESUME MATCH <span>→</span></button>`;
    if (kind === "options")
      body = `<div class="options-grid">
      <div><h3>CAMERA & INPUT</h3>
      <label class="setting">Sensitivity <output id="sensitivity-value">${s.sensitivity.toFixed(2)}</output><input id="sensitivity" type="range" min=".25" max="2.5" step=".05" value="${s.sensitivity}"/></label>
      <label class="setting">Field of view <output id="fov-value">${s.fov}°</output><input id="fov" type="range" min="70" max="115" step="1" value="${s.fov}"/></label>
      <label class="switch-row">Spine lance auto-fire<input id="railAuto" type="checkbox" ${s.railAuto ? "checked" : ""}/></label>
      <label class="switch-row">${escape(WEAPONS.shotgun.name)} auto-fire<input id="shotgunAuto" type="checkbox" ${s.shotgunAuto ? "checked" : ""}/></label>
      <p class="setting-note">Disabling lance or shotgun auto-fire uses the same fire tap as projectile weapons. Other hitscan weapons keep auto-fire enabled.</p></div>
      <div><h3>DISPLAY & AUDIO</h3>
      <label class="select-row">Render resolution<select id="resolution"><option value=".65">65%</option><option value=".8">80%</option><option value="1">100%</option></select></label>
      <label class="select-row">Crosshair<select id="crosshair-select"><option value="cross">Cross</option><option value="dot">Dot</option><option value="ring">Ring</option></select></label>
      <label class="select-row">Reticle color<input id="reticle-color" type="color" value="${s.crosshairColor}"/></label>
      <label class="setting">Volume <output id="volume-value">${Math.round(s.volume * 100)}%</output><input id="volume" type="range" min="0" max="1" step=".05" value="${s.volume}"/></label>
      <label class="switch-row">Gore effects<input id="gore" type="checkbox" ${s.gore !== false ? "checked" : ""}/></label>
      <p class="setting-note">Quality stays at your chosen level. Resolution is relative to device pixel ratio, capped at 2×.</p></div>
      <div class="name-setting"><label for="rename">OPERATOR NAME</label><input id="rename" maxlength="20" value="${escape(profile.name)}"/><button id="rename-button">SAVE NAME</button></div>
      </div><section id="controls-bindings"></section><section id="profile-transfer" class="profile-transfer"></section>`;
    if (kind === "stats")
      body = `<section id="detailed-statistics"></section><section id="profile-transfer" class="profile-transfer"></section>`;
    if (kind === "controls")
      body = `<div class="control-columns"><div><h3>TOUCH / TWO THUMBS</h3><p><b>Left drag</b>Move at full speed.</p><p><b>Left tap</b>Jump forward. Time a fresh tap with landing to build speed.</p><p><b>Right drag</b>Look freely.</p><p><b>Right tap</b>Fire a projectile at your current aim.</p><p><b>Wraith caster</b>Tap once, then press and hold the second tap for automatic fire. Drag to aim; lift to stop.</p><p><b>Weapon strip</b>Tap a collected weapon to equip, including while holding movement. The strip expands as you collect the arsenal.</p></div><div><h3>KEYBOARD / MOUSE DEFAULTS</h3><p><b>W A S D / arrows</b>Move.</p><p><b>Mouse</b>Look. Click to capture cursor.</p><p><b>Space</b>Jump / respawn.</p><p><b>Left click</b>Fire a projectile, or a lance/shotgun with auto-fire off. Hold to fire the Wraith caster continuously; other projectile weapons require fresh clicks.</p><p><b>1–5</b>Select this arena’s weapon slots. Keys stay fixed as you collect weapons.<br/><b>Escape / Tab</b>Pause / standings.</p><h3>STANDARD GAMEPAD DEFAULTS</h3><p>Left stick moves. Right stick looks. A jumps, RT fires, LB/RB select weapons, Menu pauses.</p></div></div><div class="control-note">Keep an opponent near the reticle to fire hitscan weapons. The claw attacks on contact while equipped. The Wraith caster supports held automatic fire; other projectile weapons fire once per tap. Lance and shotgun auto-fire can be disabled in Options.</div><p class="setting-note">Six arenas distribute twelve weapon roles. Each arena uses five weapons including the starting claw and repeater. All six modes work offline: Free for all, Duel, Team deathmatch, CTF, One Flag CTF and Juggernaut. Tournament plays the same opponents or teams across up to three matches, rotating compatible arenas; a draw gives each entrant half a point. Choose your arena on the main menu; cyan pads launch you and violet portals transport you. Choose the mode on the main menu and tune the roster in Match setup. The standings button pauses offline play. In Juggernaut, the gold HUD marker tracks the holder through walls; an edge arrow shows their direction. CTF requires your own flag at home to capture the enemy flag. One Flag CTF requires carrying the neutral flag to the enemy base. Dropped flags return after 30 seconds. Earn Favor by completing matches, then unlock characters and finishes in the Cosmetic shop. All cosmetics preserve gameplay stats. LAN Play creates or joins a room on the local server. Share its room code or scan its QR with your phone’s Camera app. LAN matches continue while controls or standings are open. Rebind keyboard, mouse and gamepad controls in Options; weapon slots stay limited to five.</p><h3>${escape(game.map.name.toUpperCase())} / ACTIVE KEYS</h3><div class="arsenal-reference">${game.input.weaponSlots.map((id, i) => `<div><b>${escape(game.input.weaponKeyLabel(i))}</b><span>${escape(WEAPONS[id].name)}<small>${i < 2 ? "STARTING WEAPON" : "ARENA PICKUP"}</small></span></div>`).join("")}</div><h3>COMPLETE ARSENAL / 12 ROLES</h3><p class="setting-note">The active roster above determines this match’s pickups and shortcuts. The complete implemented arsenal is listed below.</p><div class="arsenal-reference">${WEAPON_ORDER.map((id) => `<div><span>${escape(WEAPONS[id].name)}<small>${id === "plasma" ? "PROJECTILE / TAP OR HOLD AUTO" : WEAPONS[id].trigger === "contact" ? "CONTACT / INFINITE" : WEAPONS[id].trigger === "hitscan" ? "HITSCAN / AUTO-FIRE" : "PROJECTILE / TAP TO FIRE"}</small></span></div>`).join("")}</div>`;
    $("panel").innerHTML =
      `<div class="dialog wide-dialog"><div class="dialog-heading"><button id="close-panel" class="close-button" aria-label="Close panel">×</button><span class="eyebrow">OPERATOR CONSOLE</span><h2>${kind === "options" ? "OPTIONS." : kind === "stats" ? "YOUR RECORD." : kind === "setup" ? "SET YOUR TERMS." : kind === "scores" ? "STANDINGS." : "INPUT REFERENCE."}</h2></div>${body}</div>`;
    $("panel").hidden = false;
    $("close-panel").onclick = closePanel;
    show();
    if (kind === "stats") mountStatistics($("detailed-statistics"), profile);
    if (kind === "options" || kind === "stats") {
      disposeProfileTransfer = mountProfileTransfer($("profile-transfer"), profile, () => screen === "menu" && !lan.room, () => {
        if (game.player) game.player.name = profile.name;
        game.input.setBindings(profile.settings.controls);
        game.applyCosmetics(); applySettings(); updateMapCard();
        openPanel(kind);
        $("profile-transfer").querySelector<HTMLElement>("[data-transfer-status]")!.textContent = "Profile restored. Your name, settings, statistics and cosmetics are ready.";
      });
    }
    if (kind === "setup") {
      const draft = setupDraft!;
      $("setup-population").onchange = (e) => {
        draft.population = Number((e.target as HTMLSelectElement).value);
        setupDraft = normalizeConfig(draft, MAP_INFO[game.map.id].maxPlayers);
        openPanel("setup");
      };
      $("setup-time").onchange = (e) =>
        (draft.timeLimit = Number((e.target as HTMLSelectElement).value));
      $("setup-score").oninput = (e) =>
        (draft.scoreLimit = Number((e.target as HTMLInputElement).value));
      $("all-bots").onchange = (e) => {
        const value = (e.target as HTMLSelectElement).value as Difficulty;
        if (!difficulties.includes(value)) return;
        draft.botDifficulties.fill(value);
        openPanel("setup");
      };
      document
        .querySelectorAll<HTMLSelectElement>("[data-bot]")
        .forEach((select) => {
          select.onchange = () => {
            draft.botDifficulties[Number(select.dataset.bot)] =
              select.value as Difficulty;
            const shared = draft.botDifficulties[0];
            ($("all-bots") as HTMLSelectElement).value =
              draft.botDifficulties.every((level) => level === shared)
                ? shared
                : "";
          };
        });
      if (isTeamMode(draft.mode))
        for (const team of [0, 1] as Team[]) {
          $(`team-color-${team}`).oninput = (e) =>
            (draft.teamColors[team] = (e.target as HTMLInputElement).value);
        }
      $("save-setup").onclick = () => {
        draft.scoreLimit = Number(($("setup-score") as HTMLInputElement).value);
        config = normalizeConfig(draft, MAP_INFO[game.map.id].maxPlayers);
        updateConfig();
        closePanel();
      };
    }
    if (kind === "scores")
      $("scores-resume").onclick = () => {
        closePanel();
        resume();
      };
    if (kind === "options") {
      disposeControls = mountControlsUI($("controls-bindings"), profile.settings.controls, next => {
        const previous = profile.settings.controls;
        profile.settings.controls = next;
        if (!saveProfile(profile)) { profile.settings.controls = previous; return false; }
        game.input.setBindings(next); updateMapCard(); return true;
      });
      ($("resolution") as HTMLSelectElement).value = String(s.resolution);
      ($("crosshair-select") as HTMLSelectElement).value = s.crosshair;
      for (const key of ["sensitivity", "fov", "volume"] as const)
        $("" + key).oninput = (e) => {
          s[key] = Number((e.target as HTMLInputElement).value);
          $(`${key}-value`).textContent =
            key === "fov"
              ? `${s[key]}°`
              : key === "volume"
                ? `${Math.round(s[key] * 100)}%`
                : s[key].toFixed(2);
          applySettings();
        };
      for (const key of ["railAuto", "shotgunAuto", "gore"] as const)
        $(key).onchange = (e) => {
          s[key] = (e.target as HTMLInputElement).checked;
          applySettings();
        };
      $("resolution").onchange = (e) => {
        s.resolution = Number((e.target as HTMLSelectElement).value);
        applySettings();
      };
      $("crosshair-select").onchange = (e) => {
        s.crosshair = (e.target as HTMLSelectElement)
          .value as typeof s.crosshair;
        applySettings();
      };
      $("reticle-color").oninput = (e) => {
        s.crosshairColor = (e.target as HTMLInputElement).value;
        applySettings();
      };
      $("rename-button").onclick = () => {
        const value = ($("rename") as HTMLInputElement).value.trim();
        if (value) {
          profile.name = value;
          if (game.player && !lan.room) game.player.name = value;
          saveProfile(profile);
          $("rename-button").textContent = lan.room ? "SAVED · NEXT ROOM" : "SAVED";
          show();
        }
      };
    }
  };
  document
    .querySelectorAll<HTMLButtonElement>("[data-panel]")
    .forEach(
      (button) =>
        (button.onclick = () =>
          openPanel(button.dataset.panel as typeof panel)),
    );
  $("match-setup").onclick = () => openPanel("setup");
  const showScores = () => {
    if (!game.started || game.ended) return;
    if (game.active) pause();
    openPanel("scores");
  };
  $("scores-button").onclick = showScores;
  $("pause-scores").onclick = showScores;
  game.input.onScores = () => { if (!panel) showScores(); };
  window.addEventListener("keydown", (e) => {
    if (e.code === "Escape" && panel) closePanel();
  });
  game.onEvent = (text, kind) => {
    if (kind === "hit") {
      hitUntil = performance.now() + 100;
      return;
    }
    if (kind === "hurt") {
      hurtUntil = performance.now() + 240;
      return;
    }
    $("announcement").textContent = text;
    $("announcement").className = kind || "";
    messageUntil = performance.now() + (kind === "location" ? 2800 : 1800);
  };
  game.onKill = (killer, victim) => {
    if (!game.isReplica) {
      if (victim.id === game.player.id) profile.stats.deaths++;
      if (killer?.id === game.player.id && areEnemies(game.config, killer, victim)) profile.stats.kills++;
      saveProfile(profile);
    }
    feed.unshift({
      text:
        killer && killer !== victim
          ? `${killer.name}  ›  ${victim.name}`
          : `${victim.name}  ›  VOID`,
      until: performance.now() + 5000,
    });
    feed.splice(4);
  };
  game.onEnd = (result) => {
    disposeControls?.(); disposeControls = null;
    disposeProfileTransfer?.(); disposeProfileTransfer = null;
    shop?.dispose(); shop = null;
    lanUI?.dispose(); lanUI = null;
    panel = null; $("panel").hidden = true;
    screen = "results";
    const won =
      result.winnerId === game.player.id ||
      (result.winnerTeam !== null && result.winnerTeam === game.player.team);
    const winner = game.actors.find((a) => a.id === result.winnerId);
    let favorEarned: number;
    if (game.isReplica && latestLanSnapshot) {
      favorEarned = settleLanMatch(profile, latestLanSnapshot, game.player.id);
    } else {
      const recorded = settleStatistics(profile, { matchId: game.matchId, source: "solo", mode: game.config.mode, outcome: result.draw ? "draw" : won ? "win" : "loss", telemetry: game.player.humanTelemetry });
      if (recorded) { profile.stats.matches++; if (won) profile.stats.wins++; }
      favorEarned = rewardMatch(profile.cosmetics!, game.matchId, won);
    }
    saveProfile(profile);
    $("favor-earned").textContent = favorEarned ? `+${favorEarned} FAVOR · ${won ? "25 match completed + 75 victory" : "Match completed"} · Balance ${profile.cosmetics!.favor}` : `Match already recorded · Balance ${profile.cosmetics!.favor} FAVOR`;
    $("result-title").textContent = result.draw
      ? "DRAW."
      : won
        ? "VICTORY."
        : "DEFEAT.";
    const ending =
      result.reason === "score"
        ? "Score target reached."
        : result.reason === "cap"
          ? "Ten-minute cap reached."
          : "The round is settled.";
    $("result-subtitle").textContent = result.draw
      ? `Even scores at the hard time cap. ${ending}`
      : `${result.winnerTeam !== null ? teamName(result.winnerTeam) : (winner?.name ?? "The leader")} takes the arena. ${ending}`;
    $("result-board").innerHTML = standings();
    $("series-result").hidden = !series;
    if(series) {
      const previous=series;
      series=recordTournamentRound(series,result,seriesRoundIndex);
      const seriesWon=series.winner===(isTeamMode(series.config.mode)?game.player.team:0);
      if(series.finished && !previous.finished) {
        profile.stats.tournaments++;
        if(series.winner===null) profile.stats.tournamentDraws++;
        else if(seriesWon) profile.stats.tournamentWins++;
        saveProfile(profile);
      }
      const entrantName=(id:number)=>isTeamMode(series!.config.mode)?teamName(id as Team):game.actors.find(a=>a.id===id)?.name??`Operator ${id+1}`;
      $("series-result").innerHTML=`<b>${series.finished ? series.winner===null ? "TOURNAMENT DRAW" : `${escape(entrantName(series.winner))} WINS THE SERIES` : `SERIES · ${series.rounds.length} / 3 MATCHES`}</b><div>${series.entrants.map(id=>`<span>${escape(entrantName(id))} <strong>${series!.points[id]}</strong></span>`).join("")}</div><p>${series.finished ? "Series complete." : `Next arena: ${MAP_INFO[series.maps[series.rounds.length]].name}.`} Drawn matches award half a point each.</p>`;
      $("rematch").textContent=series.finished ? "PLAY SERIES AGAIN →" : "NEXT MATCH →";
    } else $("rematch").textContent = lan.room ? "RETURN TO LOBBY →" : "PLAY AGAIN →";
    show();
  };
  const update = () => {
    const now = performance.now();
    $("fps").textContent = String(game.fps);
    $("frametime").textContent = game.frameMs.toFixed(1);
    $("render-stats").textContent =
      `1% ${game.lowFps} · ${game.drawCalls} DRAWS · ${(game.triangles / 1000).toFixed(1)}K TRI`;
    $("announcement").style.opacity = now < messageUntil ? "1" : "0";
    $("hit-marker").style.opacity = now < hitUntil ? "1" : "0";
    $("damage-vignette").style.opacity = now < hurtUntil ? ".75" : "0";
    const player = game.player;
    if (!game.started || !player) return;
    if (panel === "scores") $("live-board").innerHTML = standings();
    $("health").textContent = String(Math.ceil(player.health));
    $("armor").textContent = String(Math.ceil(player.armor));
    $("health-line").style.width = `${Math.min(100, player.health)}%`;
    $("health").classList.toggle("critical", player.health < 30);
    const match = game.config;
    $("hud-mode").textContent = MODE_INFO[match.mode].short.toUpperCase();
    $("score-target").textContent = `/ ${match.scoreLimit}`;
    const sums = teamScores(game.actors, game.config, game.captureScores);
    const isTeam = isTeamMode(match.mode) && player.team !== null;
    $("frag-count").textContent = scoreText(
      isTeam ? sums[player.team!] : scoreFor(match, player),
    );
    $("frag-count").style.color = isTeam ? match.teamColors[player.team!] : "";
    $("opponent-score").hidden = !isTeam;
    if (isTeam) {
      const other = (1 - player.team!) as Team;
      $("opponent-score").textContent =
        `${teamName(other)} ${scoreText(sums[other])}`;
      $("opponent-score").style.color = match.teamColors[other];
    }
    const flagMode=isFlagMode(match.mode);
    $("flag-status").hidden=!flagMode || player.health<=0;
    if(flagMode && player.team!==null) {
      const carried=game.flagStates.find(f=>f.carrierId===player.id);
      const describe=(f:typeof game.flagStates[number])=> f.status==="home" ? "HOME" : f.status==="dropped" ? `DROPPED · ${Math.max(0,Math.ceil((f.returnAt??game.time)-game.time))}s` : `CARRIED BY ${game.actors.find(a=>a.id===f.carrierId)?.name??"OPERATOR"}`;
      const objective=carried ? (match.mode==="oneflag" ? "CARRY TO ENEMY BASE" : "RETURN TO YOUR BASE") : (match.mode==="oneflag" ? "TAKE THE NEUTRAL FLAG TO ENEMY BASE" : "CAPTURE ENEMY FLAG · OWN FLAG MUST BE HOME");
      $("flag-status").innerHTML=`<b>${objective}</b>${game.flagStates.map(f=>`<span style="--flag-color:${f.team===null?"#eedfaf":match.teamColors[f.team]}">${f.team===null?"NEUTRAL FLAG":f.team===player.team?"YOUR FLAG":"ENEMY FLAG"}: ${escape(describe(f))}</span>`).join("")}`;
    }
    const holder = game.actors.find((a) => a.id === game.juggernautId);
    $("role-status").hidden = match.mode !== "juggernaut";
    $("role-status").classList.toggle("held", holder?.id === player.id);
    $("role-status").textContent = holder
      ? `${holder.id === player.id ? "YOU ARE JUGGERNAUT" : `JUGGERNAUT: ${holder.name}`} · 2× DAMAGE / ½ TAKEN`
      : "JUGGERNAUT UNCLAIMED · AWAITING A LIVING PLAYER";
    const time = Math.max(
      0,
      game.time < match.timeLimit
        ? match.timeLimit - game.time
        : game.time - match.timeLimit,
    );
    $("clock").textContent =
      `${Math.floor(time / 60)}:${String(Math.floor(time % 60)).padStart(2, "0")}`;
    $("clock-label").textContent =
      game.time >= match.timeLimit
        ? "SUDDEN DEATH"
        : game.map.name.toUpperCase();
    $("weapon-name").textContent = WEAPONS[player.weapon].name.toUpperCase();
    $("ammo").textContent =
      player.weapon === "melee" ? "∞" : String(player.ammo[player.weapon]);
    $("ammo-kind").textContent =
      player.weapon === "melee" ? "CONTACT" : "ROUNDS";
    const visibleWeapons = WEAPON_ORDER.filter((id) => player.owned.has(id));
    const maxColumns = Math.max(
      1,
      Math.min(6, Math.floor((innerWidth * 0.48 + 3) / 47)),
    );
    const rows = Math.ceil(visibleWeapons.length / maxColumns);
    weaponBar.style.setProperty(
      "--weapon-columns",
      String(Math.ceil(visibleWeapons.length / Math.max(1, rows))),
    );
    weaponBar.classList.toggle("two-rows", rows > 1);
    $("hud").style.setProperty("--weapon-rows", String(rows));
    $("hud").classList.toggle("deep-arsenal", rows > 2);
    for (const id of WEAPON_ORDER) {
      const button = weaponButtons.get(id)!;
      button.hidden = !player.owned.has(id);
      button.classList.toggle("selected", id === player.weapon);
      button.disabled = !player.owned.has(id);
      $(`stock-${id}`).textContent = !player.owned.has(id)
        ? "—"
        : id === "melee"
          ? "∞"
          : String(player.ammo[id]);
    }
    $("speed").textContent = String(
      Math.round(Math.hypot(player.motion.vx, player.motion.vz) * 40),
    );
    $("hop").textContent = `HOP ${player.motion.tier} / 5`;
    $("power-status").textContent = player.power
      ? `${player.power === "quad" ? "4× DAMAGE" : "IMMORTAL"} / ${Math.ceil(player.powerUntil - game.time)}s`
      : "";
    $("power-status").className = player.power || "";
    $("death-overlay").hidden = player.health > 0 || game.ended;
    $("crosshair").hidden = player.health <= 0;
    $("respawn").textContent =
      game.time - player.deadAt < 0.4
        ? "RESPAWNING READY IN 0.4s"
        : "TAP TO RESPAWN";
    $("kill-feed").innerHTML = feed
      .filter((f) => f.until > now)
      .map((f) => `<div>${escape(f.text)}</div>`)
      .join("");
  };
  game.onUpdate = update;
  const tracker = $("juggernaut-tracker");
  const trackingArrow = tracker.querySelector<HTMLElement>(".tracking-arrow")!;
  const trackingName = $("tracking-name");
  const trackingPosition = { x: 0, y: 0, z: 0 };
  game.onFrame = () => {
    const holder = game.actors.find((actor) => actor.id === game.juggernautId);
    if (
      screen !== "game" ||
      !game.active ||
      game.config.mode !== "juggernaut" ||
      !game.player ||
      game.player.health <= 0 ||
      !holder ||
      holder.health <= 0 ||
      holder.id === game.player.id
    ) {
      tracker.hidden = true;
      return;
    }
    trackingPosition.x = holder.mesh.position.x;
    trackingPosition.y = holder.mesh.position.y + 1.3;
    trackingPosition.z = holder.mesh.position.z;
    const marker = trackingMarker(
      game.camera,
      trackingPosition,
      innerWidth,
      innerHeight,
    );
    tracker.hidden = !marker;
    if (!marker) return;
    tracker.style.transform = `translate3d(${marker.x.toFixed(1)}px, ${marker.y.toFixed(1)}px, 0)`;
    tracker.classList.toggle("offscreen", marker.offscreen);
    trackingArrow.style.transform = `translate(-50%, -50%) rotate(${marker.angle.toFixed(1)}deg)`;
    if (trackingName.textContent !== holder.name)
      trackingName.textContent = holder.name;
  };
  const lanHello = () => ({ name: profile.name, appearance: {
    character: profile.cosmetics!.character,
    characterSkin: profile.cosmetics!.characterSkin,
    weaponSkin: profile.cosmetics!.weaponSkin,
  } });
  const initialLanSettings = (): RoomSettings => ({
    mapId: game.map.id,
    config: { ...config, botDifficulties: config.botDifficulties.map(() => "Competitive"), teamColors: [...config.teamColors] },
    fillBots: true, replaceDisconnected: true,
  });
  const renderLan = () => lanUI?.render({
    info: lan.info, room: lan.room, slotId: lan.slotId,
    status: lan.status, error: lan.error, busy: lan.busy,
    initialCode: inviteCode || lan.savedCode, initialSettings: initialLanSettings(),
  });
  const openLan = () => {
    if (screen === "identity") return;
    disposeControls?.(); disposeControls = null;
    disposeProfileTransfer?.(); disposeProfileTransfer = null;
    shop?.dispose(); shop = null;
    lanUI?.dispose();
    panel = "lan"; $("panel").hidden = false;
    lanUI = new LanUI($("panel"), {
      create: (settings) => { void lan.create(lanHello(), settings); },
      join: (code) => { void lan.join(lanHello(), code); },
      configure: (settings) => lan.configure(settings),
      ready: (ready) => lan.ready(ready), start: () => lan.start(),
      lobby: () => lan.lobby(), leave: menu,
      close: () => { if (lan.room) menu(); else closePanel(); },
    });
    renderLan(); show();
    if (!lan.info) void lan.discover();
  };
  let lastLanPhase = "";
  lan.onChange = () => {
    const room = lan.room;
    if (!room && game.isReplica) {
      game.stopReplica(); game.toMenu(); replicaMatchId = null; latestLanSnapshot = null;
      screen = "menu"; lastLanPhase = ""; openLan();
    }
    if (room?.phase === "lobby" && lastLanPhase !== `${room.code}:lobby`) {
      if (game.isReplica) game.stopReplica();
      game.toMenu(); replicaMatchId = null; latestLanSnapshot = null;
      config = room.settings.config; game.selectMap(room.settings.mapId);
      series = null; screen = "menu";
      lastLanPhase = `${room.code}:lobby`;
      updateConfig(); updateMapCard(); openLan();
    } else lastLanPhase = room ? `${room.code}:${room.phase}` : "";
    renderLan(); show();
  };
  lan.onDisconnect = () => {
    if (game.isReplica && !game.ended) pause();
    // A restored connection starts from the bot's state, without replaying input
    // that was discarded by the server when the connection disappeared.
    replicaMatchId = null;
  };
  game.onCommand = (command) => lan.queue(command);
  lan.onSnapshot = (snapshot) => {
    if (lan.slotId === null) return;
    latestLanSnapshot = snapshot;
    if (replicaMatchId !== snapshot.matchId) {
      replicaMatchId = snapshot.matchId;
      series = null; config = snapshot.config;
      disposeControls?.(); disposeControls = null;
      disposeProfileTransfer?.(); disposeProfileTransfer = null;
      shop?.dispose(); shop = null; lanUI?.dispose(); lanUI = null;
      panel = null; $("panel").hidden = true;
      $("series-status").hidden = true; $("series-result").hidden = true;
      feed.length = 0; screen = "game";
      game.startReplica(snapshot, lan.slotId);
      updateMapCard(); updateConfig(); applySettings();
      if (!snapshot.ended && (needsLandscape() || document.hidden)) pause();
      show();
    } else game.applySnapshot(snapshot);
  };
  $("lan-play").onclick = openLan;
  window.addEventListener("pagehide", () => lan.idle());
  applySettings();
  show();
  if (screen === "identity") ($("username") as HTMLInputElement).focus();
  else if (inviteCode || lan.savedCode) {
    openLan();
    if (lan.savedCode && (!inviteCode || inviteCode === lan.savedCode)) void lan.join(lanHello(), lan.savedCode);
  }
  if (import.meta.env.PROD) startOfflineCache(status => { offlineStatus = status; show(); }, import.meta.env.BASE_URL);
}

boot().catch((error) => {
  console.error(error);
  app.innerHTML = `<div class="boot error"><strong>THE GATE DID NOT OPEN.</strong><p>Phobos needs WebGL 2 and WebAssembly enabled in a current browser.</p><p>${escape(error instanceof Error ? error.message : String(error))}</p><button onclick="location.reload()">TRY AGAIN</button></div>`;
});
