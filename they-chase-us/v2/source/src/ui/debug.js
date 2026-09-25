import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';
import { CONFIG } from '../config.js';
import { CARD_IDS, CARDS } from '../data/cards.js';
import { resetSave } from '../save.js';
import { computeStats } from '../game/stats.js';

// Debug panel (?debug=1): FPS, level select, coins, grant cards, god mode, time scale, seed, live CONFIG knobs.
export function setupDebug(game) {
  CONFIG.debug.runHidden = true; // keep simulating when the tab is occluded (testing)
  if (document.hidden) { game.paused = false; game._schedule(); }
  const wrap = document.createElement('div'); wrap.id = 'debug';
  wrap.innerHTML = '<div class="fps" id="dbg-fps">-- fps</div>';
  document.getElementById('app').appendChild(wrap);
  const fpsEl = wrap.querySelector('#dbg-fps');
  setInterval(() => { fpsEl.textContent = `${game.sceneM.avgFps.toFixed(0)} fps · pr ${game.sceneM.pixelRatio.toFixed(2)} · q${game.sceneM.qualityLevel} · en ${game.enemies.aliveCount} · ar ${game.arrows.list.length} · pt ${game.fx.particles.n} · st ${game.state}`; }, 500);

  const gui = new GUI({ title: 'Debug', width: 250 });
  gui.domElement.classList.add('ui-block');
  const d = { level: game.level, card: 'sharp_tip', rarity: 'R', god: false, seedSalt: 1337 };
  const fg = gui.addFolder('Game');
  fg.add(d, 'level', 1, 60, 1).name('Level').onChange((v) => { game.level = v; game.save.level = v; });
  fg.add({ start: () => game.startLevel(d.level) }, 'start').name('Start level');
  fg.add({ coins: () => { game.save.coins += 1000; game.ui.updateMain(); } }, 'coins').name('+1000 coins');
  fg.add(d, 'card', CARD_IDS).name('Card');
  fg.add(d, 'rarity', ['C', 'R', 'E']).name('Rarity');
  fg.add({ grant: () => { const r = CARDS[d.card].rar.includes(d.rarity) ? d.rarity : CARDS[d.card].rar[0]; game.applyCard(d.card, r); } }, 'grant').name('Grant card');
  fg.add(CONFIG.debug, 'god').name('God mode');
  fg.add(CONFIG.debug, 'timeScale', 0.1, 3, 0.1).name('Time scale');
  fg.add({ gate: () => { if (game.state === 'level') game.player.z = game.world.gateZ + 1; } }, 'gate').name('Skip to gate');
  fg.add({ hp: () => { game.player.hp = game.player.maxHp; } }, 'hp').name('Full HP');
  fg.add({ reset: () => { if (confirm('Reset save?')) { resetSave(); location.reload(); } } }, 'reset').name('Reset save');
  fg.add({ recompute: () => { game.stats = computeStats(game.picks, game.save.upg); } }, 'recompute').name('Recompute stats');

  const fc = gui.addFolder('Config'); fc.close();
  const addObj = (folder, obj, depth) => {
    for (const k in obj) {
      const v = obj[k];
      if (typeof v === 'number') folder.add(obj, k).name(k);
      else if (typeof v === 'boolean') folder.add(obj, k).name(k);
      else if (v && typeof v === 'object' && depth < 2) { const f = folder.addFolder(k); f.close(); addObj(f, v, depth + 1); }
    }
  };
  addObj(fc, CONFIG, 0);
  gui.onChange(() => { if (game.state === 'main') game.stats = computeStats(game.picks, game.save.upg); });
  game.debugGui = gui;
}
