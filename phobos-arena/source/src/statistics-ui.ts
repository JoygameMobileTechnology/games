import { MODE_INFO, type Mode } from "./match";
import type { Profile } from "./profile";
import { emptyStatisticsTotals, normalizeStatistics, type StatisticsTotals } from "./statistics";
import { WEAPONS, WEAPON_ORDER } from "./rules";
import "./statistics.css";

const number = (value: number) => Math.floor(value).toLocaleString();
const duration = (seconds: number) => `${Math.floor(seconds / 3600)}h ${Math.floor(seconds % 3600 / 60)}m`;
const accuracy = (total: { shots: number; hits: number }) => total.shots ? `${(total.hits / total.shots * 100).toFixed(1)}%` : "—";
export function mountStatistics(host: HTMLElement, profile: Profile) {
  const statistics = normalizeStatistics(profile.statistics);
  host.innerHTML = `<p class="panel-intro">Your record on this browser. Back up your profile below to move it to another device.</p><h3>ALL-TIME RECORD</h3><div class="stat-grid">${Object.entries(profile.stats).map(([key, value]) => `<div><b>${number(value)}</b><span>${key.replace(/([A-Z])/g, " $1").toUpperCase()}</span></div>`).join("")}</div><label class="select-row statistics-filter">DETAILED RECORD<select data-scope aria-label="Statistics scope"><option value="lifetime">All play</option><option value="solo">Offline solo</option><option value="lan">LAN multiplayer</option>${Object.entries(MODE_INFO).map(([id, mode]) => `<option value="${id}">${mode.name}</option>`).join("")}</select></label><p class="setting-note">Detailed records start with build 0.9.0; older all-time totals stay above. Tournament rounds count as matches and series retain their separate totals.</p><div data-totals class="stat-grid"></div><h3>WEAPON RECORD</h3><div data-weapons class="weapon-statistics"></div><p class="setting-note">Accuracy counts attacks that dealt enemy damage. A volley counts once, even when several pellets or splash victims connect. Immortal targets do not count as damaging hits. Damage includes health and armor actually removed. Assists credit enemy damage within five seconds before another player gets the kill. Leaving a match records partial play without granting Favor.</p>`;
  const render = () => {
    const scope = host.querySelector<HTMLSelectElement>("[data-scope]")!.value;
    const total: StatisticsTotals = scope === "lifetime" || scope === "solo" || scope === "lan" ? statistics[scope] : statistics.modes[scope as Mode] ?? emptyStatisticsTotals();
    const rows = [
      ["COMPLETED", number(total.completed)], ["WINS", number(total.wins)], ["LOSSES", number(total.losses)], ["DRAWS", number(total.draws)],
      ["ABANDONED", number(total.abandoned)], ["PLAY TIME", duration(total.playTimeSeconds)], ["KILLS", number(total.kills)], ["DEATHS", number(total.deaths)],
      ["K / D", total.deaths ? (total.kills / total.deaths).toFixed(2) : total.kills ? number(total.kills) : "—"], ["ASSISTS", number(total.assists)], ["HEADSHOTS", number(total.headshots)],
      ["ACCURACY", accuracy(total)], ["DAMAGE DEALT", number(total.damageDealt)], ["DAMAGE TAKEN", number(total.damageTaken)], ["CAPTURES", number(total.captures)], ["FLAG RETURNS", number(total.returns)],
    ];
    host.querySelector<HTMLElement>("[data-totals]")!.innerHTML = rows.map(([label, value]) => `<div><b>${value}</b><span>${label}</span></div>`).join("");
    const weapons = WEAPON_ORDER.filter(id => total.weapons[id]);
    host.querySelector<HTMLElement>("[data-weapons]")!.innerHTML = weapons.length ? `<table><thead><tr><th>WEAPON</th><th>ATTACKS</th><th>ACCURACY</th><th>KILLS</th><th>DAMAGE</th></tr></thead><tbody>${weapons.map(id => { const w = total.weapons[id]!; return `<tr><th>${WEAPONS[id].name}</th><td>${number(w.shots)}</td><td>${accuracy(w)}</td><td>${number(w.kills)}</td><td>${number(w.damageDealt)}</td></tr>`; }).join("")}</tbody></table>` : `<p class="setting-note">Play a match to begin this weapon record.</p>`;
  };
  host.querySelector<HTMLSelectElement>("[data-scope]")!.onchange = render;
  render();
}
