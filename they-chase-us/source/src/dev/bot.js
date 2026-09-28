// Automated test player (?bot=1). Not part of the shipped game logic; used for balance runs and smoke tests.
import { CONFIG } from '../config.js';

export function installBot(game) {
  const el = document.getElementById('app');
  const mk = (type, cx) => new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, isPrimary: true, pointerType: 'touch', clientX: cx, clientY: 600, button: 0, buttons: type === 'pointerup' ? 0 : 1 });
  const bot = { enabled: true, holdStart: -1, lastRelease: -9, want: 1, curX: 272, pickPref: /Recruit|Multishot|Sharp|Frost|Fire Arrow|Lightning Arrow/, buyUpgrades: true, autoCards: true, autoRestart: false, log: [] };
  window.bot = bot;

  // ---- level: aim at the nearest enemy, hold for the right range, drag toward its lane ----
  const origStepLevel = game._stepLevel.bind(game);
  game._stepLevel = (dt) => {
    if (bot.enabled) {
      const t = game.time, pl = game.player, st = game.stats, inp = game.input;
      if (inp.down && (bot.holdStart < 0 || !pl.holding)) { window.dispatchEvent(mk('pointerup', bot.curX)); bot.holdStart = -1; bot.lastRelease = t; }
      let best = null, bd = 1e9;
      for (const e of game.enemies.list) { if (!e.alive || e.airborne) continue; const d = e.z - pl.z; if (d > 0.3 && d < bd) { bd = d; best = e; } }
      if (!inp.down && !pl.holding && bot.holdStart < 0 && t - bot.lastRelease > 0.2 && best && bd < st.maxRange + 3) {
        const d = Math.min(st.maxRange, Math.max(1.5, bd - 0.5));
        const f = (d - 1.5) / (st.maxRange - 1.5); const u = 1 - Math.sqrt(Math.max(0, 1 - f));
        bot.want = u * st.drawTime + 0.03; bot.holdStart = t; bot.curX = 272;
        el.dispatchEvent(mk('pointerdown', bot.curX));
      } else if (pl.holding && bot.holdStart >= 0) {
        if (best) { const dxm = Math.max(-0.4, Math.min(0.4, (best.x - pl.x) * 0.5)); bot.curX += game.dragSign * dxm * inp.width() / 6.6; window.dispatchEvent(mk('pointermove', bot.curX)); }
        if (t - bot.holdStart >= bot.want) { window.dispatchEvent(mk('pointerup', bot.curX)); bot.holdStart = -1; bot.lastRelease = t; }
      }
    }
    origStepLevel(dt);
  };

  // ---- bonus: go for the weakest guard of the next row, run through its gap, dodge slams ----
  const origStepBonus = game._stepBonus.bind(game);
  game._stepBonus = (dt) => {
    if (bot.enabled) {
      const pl = game.player, bs = game.bonus;
      const row = bs.rows.find((r) => !r.passed && r.z < pl.z);
      let want = null;
      if (row && bs.phase === 'run') {
        const alive = row.guards.filter((e) => e.alive);
        const dead = row.guards.filter((e) => !e.alive);
        const tgt = alive.length ? alive.reduce((a, b) => (a.hp < b.hp ? a : b)) : null;
        const near = pl.z - row.z < 5;
        want = near ? (dead.length ? dead[0].x : (tgt ? tgt.x : 0)) : (tgt ? tgt.x : 0);
      } else if (bs.phase === 'arena' && bs.slamWarn) want = bs.slamX > 0 ? -2.5 : 2.5;
      if (want != null) pl.x += Math.max(-9 * dt, Math.min(9 * dt, want - pl.x));
    }
    origStepBonus(dt);
  };

  // ---- cards & restarts ----
  setInterval(() => {
    if (!bot.enabled) return;
    if (game.state === 'cards' && bot.autoCards && performance.now() - game.ui.cardsShownAt > 400) {
      const cards = document.querySelectorAll('#c-list .card');
      if (!cards.length) return;
      const pick = [...cards].find((c) => bot.pickPref.test(c.textContent)) || cards[0];
      const ev = (type) => new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 2, isPrimary: true, pointerType: 'touch', clientX: 200, clientY: 300, button: 0 });
      pick.dispatchEvent(ev('pointerdown')); pick.dispatchEvent(ev('pointerup'));
    }
    if (bot.autoRestart && (game.state === 'fail' || game.state === 'results' || game.state === 'end')) {
      bot.log.push({ level: game.level, state: game.state, kills: game.kills, mult: game.bonus.mult, hp: Math.round(game.player.hp), picks: Object.keys(game.picks), engageFirst: +game.engageFirst.toFixed(1), idleMax: +game.idleMax.toFixed(1), fillers: game.fillers });
      bot.holdStart = -1; bot.lastRelease = -9;
      if (game.state !== 'fail') game.goMain();
      if (bot.buyUpgrades) { let guard = 0; while (guard++ < 20) { const ids = ['hp', 'speed', 'atk'].sort((a, b2) => (game.save.upg[a] || 0) - (game.save.upg[b2] || 0)); if (!game.buyUpgrade(ids[0]) && !game.buyUpgrade(ids[1]) && !game.buyUpgrade(ids[2])) break; } }
      game.startLevel(game.state === 'fail' ? game.level : game.save.level);
    }
  }, 500);
  const origStart = game.startLevel.bind(game);
  game.startLevel = (L) => { bot.holdStart = -1; bot.lastRelease = -9; origStart(L); };
  return bot;
}
