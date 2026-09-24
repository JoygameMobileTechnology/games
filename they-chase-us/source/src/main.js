import './style.css';
import { Game } from './game/game.js';
import { CONFIG } from './config.js';

const game = new Game({ canvas: document.getElementById('gl'), appEl: document.getElementById('app'), uiEl: document.getElementById('ui') });
window.game = game; window.CONFIG = CONFIG;

if (/[?&]debug=1/.test(location.search)) {
  import('./ui/debug.js').then((m) => m.setupDebug(game));
}

if (/[?&]bot=1/.test(location.search)) {
  import('./dev/bot.js').then((mod) => mod.installBot(game));
}
