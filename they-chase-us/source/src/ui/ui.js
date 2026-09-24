import * as THREE from 'three';
import { CONFIG, upgradeCost } from '../config.js';
import { CARDS, RARITY_NAME } from '../data/cards.js';
import { describeCard } from '../game/offers.js';
import { fmt } from '../util/math.js';

const UPG = {
  hp: { name: 'Health', ico: '❤', val: (n) => `${CONFIG.player.baseHp + CONFIG.meta.hpPerLevel * n}`, cap: Infinity },
  speed: { name: 'Move Speed', ico: '👟', val: (n) => `${(CONFIG.player.runSpeed * (1 + CONFIG.meta.speedPerLevel * n)).toFixed(2)}`, cap: CONFIG.meta.speedCap },
  atk: { name: 'Attack Speed', ico: '🏹', val: (n) => `${(CONFIG.player.drawTime - CONFIG.meta.atkPerLevel * n).toFixed(2)}s`, cap: CONFIG.meta.atkCap },
};

const TEMPLATE = `
<div id="main" class="screen ui-block">
  <div class="topbar">
    <div class="pill">Level <b id="m-level">1</b></div>
    <div class="pill"><span class="ico">🪙</span><b id="m-coins">0</b></div>
    <div class="pill">BEST <b id="m-best">×1</b></div>
  </div>
  <div class="logo outline">THEY<br>CHASE US!<small>BACKWARDS RUNNER</small></div>
  <div class="tagline outline">Run backwards. Hold to aim. Build your army.</div>
  <div class="middle">
    <div class="stopper-card" id="m-stopper" style="display:none"></div>
    <div class="tap-start outline pulse">TAP TO START</div>
  </div>
  <div class="upgrades" id="m-upgrades"></div>
  <button class="btn round grey ui-block" id="m-sound" style="position:absolute;right:14px;top:calc(64px + var(--sat))">🔊</button>
  <div style="position:absolute;left:14px;top:calc(64px + var(--sat));font-size:12px;opacity:.7">Prototype v0.1</div>
</div>
<div id="hud" class="screen">
  <div class="vignette" id="h-vig"></div>
  <div class="flash" id="h-flash"></div>
  <div class="top">
    <div><div class="dist outline" id="h-dist">0 m</div><div class="lvl outline" id="h-level">Level 1</div></div>
    <div class="spacer"></div>
    <div class="coins outline">🪙 <span id="h-coins">0</span></div>
  </div>
  <div class="xpwrap"><div class="xpfill" id="h-xpfill"></div><div class="xptext outline" id="h-xptext">Lv 1</div></div>
  <div class="shield-ind" id="h-shield" style="display:none">⛊</div>
  <div class="bonus-preview outline" id="h-preview" style="display:none">Reward: <span id="h-prev-coins">0</span> × <span id="h-prev-mult">1</span><small id="h-prev-best"></small></div>
  <div class="bossbar" id="h-boss"><div class="name outline" id="h-boss-name">The Dark Lord</div><div class="bar"><i id="h-boss-fill"></i></div></div>
  <div class="multpop outline" id="h-multpop">×2</div>
  <div class="toast outline" id="h-toast"></div>
  <div class="hint outline" id="h-hint"></div>
  <div class="followers outline" id="h-followers" style="display:none">0</div>
  <div class="pbar" id="h-pbar"><i id="h-pfill"></i></div>
  <div class="bottom" id="h-bottom"></div>
</div>
<div id="cards" class="screen"><div class="title outline">LEVEL UP — pick a card</div><div id="c-list" style="display:flex;flex-direction:column;gap:12px;align-items:center"></div></div>
<div id="results" class="screen panel">
  <h2>Multiplier reached</h2>
  <div class="mult-big outline" id="r-mult">×1</div>
  <div class="coins-big outline">🪙 <span id="r-coins">0</span></div>
  <div class="box"><div class="label" id="r-calc">57 × 7</div><div class="value" id="r-stopper"></div></div>
  <div class="btnrow"><button class="btn gold" id="r-continue">Continue</button></div>
</div>
<div id="fail" class="screen panel">
  <h1 class="outline">You fell</h1>
  <h2 id="f-pct">0% of the level completed</h2>
  <div class="box"><div class="label">Coins kept</div><div class="value">🪙 <span id="f-kept">0</span></div></div>
  <div class="box"><div class="label">Suggested upgrade</div><div class="value gold" id="f-suggest">Health</div></div>
  <div class="btnrow"><button class="btn" id="f-retry">Retry</button><button class="btn grey" id="f-main">Main</button></div>
</div>
<div id="end" class="screen panel">
  <h1 class="outline">The Dark Lord has fallen</h1>
  <div class="mult-big outline">×30</div>
  <div class="box"><div class="label">Total time · levels</div><div class="value" id="e-stats"></div></div>
  <div class="box"><div class="label">Winning build</div><div class="build-icons" id="e-build"></div></div>
  <h2>End of prototype</h2>
  <div class="btnrow"><button class="btn gold" id="e-main">Main screen</button></div>
</div>`;

export class UI {
  constructor(game, root) {
    this.game = game; this.root = root;
    root.innerHTML = TEMPLATE;
    this.$ = (id) => root.querySelector('#' + id);
    this.screens = ['main', 'hud', 'cards', 'results', 'fail', 'end'];
    this.orbs = []; this.orbPool = [];
    this.warnEls = []; for (let i = 0; i < 6; i++) { const w = document.createElement('div'); w.className = 'warn'; w.textContent = '!'; this.$('h-bottom').appendChild(w); this.warnEls.push(w); }
    this.toastT = 0; this.cardsShownAt = 0; this.onPick = null; this.resultsAnim = null;
    this._bind();
    this._proj = { x: 0, y: 0, visible: false }; this._v3 = new THREE.Vector3();
  }

  _bind() {
    const g = this.game;
    this.$('main').addEventListener('click', (e) => { if (e.target.closest('.upg') || e.target.closest('#m-sound')) return; g.audio.init(); g.audio.ui(); g.startLevel(g.level); });
    this.$('m-sound').addEventListener('click', (e) => { e.stopPropagation(); g.toggleSound(); });
    this.$('r-continue').addEventListener('click', () => { g.audio.ui(); g.goMain(); });
    this.$('f-retry').addEventListener('click', () => { g.audio.ui(); g.startLevel(g.level); });
    this.$('f-main').addEventListener('click', () => { g.audio.ui(); g.goMain(); });
    this.$('e-main').addEventListener('click', () => { g.audio.ui(); g.goMain(); });
    const up = this.$('m-upgrades');
    for (const id of ['hp', 'speed', 'atk']) {
      const b = document.createElement('button'); b.className = 'upg ui-block'; b.dataset.id = id;
      b.innerHTML = `<div class="rec" style="display:none">Recommended</div><div class="ico">${UPG[id].ico}</div><div class="name">${UPG[id].name}</div><div class="lvl"></div><div class="val"></div><div class="cost"></div>`;
      b.addEventListener('click', (e) => { e.stopPropagation(); g.audio.init(); if (!g.buyUpgrade(id)) g.audio.ui(); });
      up.appendChild(b);
    }
  }

  show(id) { for (const s of this.screens) this.$(s).classList.toggle('show', s === id); }

  // ---------- main ----------
  updateMain() {
    const s = this.game.save;
    this.$('m-level').textContent = s.level; this.$('m-coins').textContent = fmt(s.coins); this.$('m-best').textContent = '×' + (s.bestMult || 1);
    this.$('m-sound').textContent = this.game.audio.enabled ? '🔊' : '🔇';
    const st = this.$('m-stopper');
    if (s.lastStopper) { st.style.display = 'flex'; st.innerHTML = s.lastStopper.victory ? `<span class="ico">👑</span><div>Last run: <b>The Dark Lord fell</b></div>` : `<span class="ico">🛡</span><div>Stopped by <b>${s.lastStopper.name}</b> · T${s.lastStopper.tier} · HP ${fmt(s.lastStopper.hp)}<br><small>at ×${s.prevMult || 1}</small></div>`; } else st.style.display = 'none';
    for (const b of this.$('m-upgrades').children) {
      const id = b.dataset.id, n = s.upg[id] || 0, u = UPG[id], cost = upgradeCost(n), max = n >= u.cap;
      b.querySelector('.lvl').textContent = `Lv ${n}${u.cap !== Infinity ? '/' + u.cap : ''}`;
      b.querySelector('.val').textContent = max ? u.val(n) : `${u.val(n)} → ${u.val(n + 1)}`;
      b.querySelector('.cost').textContent = max ? 'MAX' : `🪙 ${fmt(cost)}`;
      b.classList.toggle('max', max); b.classList.toggle('poor', !max && s.coins < cost); b.classList.toggle('can', !max && s.coins >= cost);
      b.querySelector('.rec').style.display = s.suggest === id && !max ? 'block' : 'none';
      if (id === 'hp') b.querySelector('.ico').style.fontSize = (30 + Math.floor(n / 5) * 3) + 'px';
    }
  }

  // ---------- HUD ----------
  resetHud() { this.$('h-vig').classList.remove('low'); this.hint(null); this.$('h-toast').classList.remove('show'); for (const w of this.warnEls) w.classList.remove('show'); this.$('h-followers').style.display = 'none'; }
  showBonusHud(on) { this.$('h-preview').style.display = on ? 'block' : 'none'; }
  bossBar(frac, name) { const b = this.$('h-boss'); if (frac == null) { b.classList.remove('show'); return; } b.classList.add('show'); this.$('h-boss-name').textContent = name; this.$('h-boss-fill').style.width = (frac * 100).toFixed(1) + '%'; }
  multPop(n) { const el = this.$('h-multpop'); el.textContent = '×' + n; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); }
  flash() { const f = this.$('h-flash'); f.classList.add('on'); setTimeout(() => f.classList.remove('on'), 60); }
  toast(text, dur = 1.5) { if (!text) return; const t = this.$('h-toast'); t.textContent = text; t.classList.add('show'); this.toastT = dur; }
  hint(text) { const h = this.$('h-hint'); if (!text) { h.classList.remove('show'); return; } h.textContent = text; h.classList.add('show'); }

  _project(x, y, z) { this._v3.set(x, y, z); return this.game.sceneM.project(this._v3, this._proj); }

  update(dt) {
    const g = this.game, pl = g.player, st = g.state;
    if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) this.$('h-toast').classList.remove('show'); }
    this._updateOrbs(dt);
    if (st !== 'level' && st !== 'cards' && st !== 'gate' && st !== 'bonus' && st !== 'dying') return;
    // top
    const distGate = Math.max(0, pl.z - g.world.gateZ);
    this.$('h-dist').textContent = st === 'bonus' ? `×${g.bonus.mult}` : `${Math.round(distGate)} m`;
    this.$('h-level').textContent = `Level ${g.level}`;
    this.$('h-coins').textContent = fmt(g.levelCoins);
    const need = xpFor(g); const frac = Math.min(1, g.xp / need);
    this.$('h-xpfill').style.width = (frac * 100).toFixed(1) + '%';
    this.$('h-xptext').textContent = `Lv ${g.levelUps + 1} · ${Math.floor(g.xp)}/${need} XP`;
    // shield indicator
    const sh = this.$('h-shield'); if (g.stats.shield) { sh.style.display = 'block'; sh.classList.toggle('ready', pl.shieldT <= 0); } else sh.style.display = 'none';
    // player bar & followers
    const p = this._project(pl.x, 2.35, pl.z);
    const bar = this.$('h-pbar'); bar.style.transform = `translate(${p.x}px, ${p.y}px)`; bar.classList.toggle('hurt', pl.hp / pl.maxHp < 0.3);
    this.$('h-pfill').style.width = (Math.max(0, pl.hp / pl.maxHp) * 100).toFixed(1) + '%';
    const nAll = g.allies.aliveCount; const fo = this.$('h-followers');
    if (nAll > 0) { const q = this._project(pl.x, -0.1, pl.z); fo.style.display = 'block'; fo.style.transform = `translate(${q.x}px, ${q.y}px) translate(-50%, 0)`; fo.textContent = nAll; } else fo.style.display = 'none';
    // low hp vignette
    this.$('h-vig').classList.toggle('low', pl.hp / pl.maxHp < CONFIG.player.lowHpVignette && !pl.dead && st !== 'bonus');
    // warnings
    let wi = 0;
    for (const o of g.obstacles.list) {
      if (!(o.warnT > 0) || wi >= this.warnEls.length) continue;
      const q = this._project(o.x, 0, pl.z - CONFIG.obstacle.enterAhead);
      const w = this.warnEls[wi++]; w.classList.add('show'); w.style.left = q.x + 'px';
    }
    for (; wi < this.warnEls.length; wi++) this.warnEls[wi].classList.remove('show');
    // bonus preview
    if (st === 'bonus') { this.$('h-prev-coins').textContent = fmt(g.levelCoins); this.$('h-prev-mult').textContent = g.bonus.mult; this.$('h-prev-best').textContent = `= ${fmt(g.levelCoins * g.bonus.mult)} coins · best ×${g.save.bestMult || 1}`; }
  }

  // ---------- XP orbs ----------
  spawnOrb(x, y, z, value) {
    const p = this._project(x, y, z);
    let el = this.orbPool.pop(); if (!el) { el = document.createElement('div'); el.className = 'orb'; this.$('hud').appendChild(el); }
    el.style.display = 'block';
    this.orbs.push({ el, x: p.x, y: p.y, sx: p.x, sy: p.y, t: 0, value });
  }
  _updateOrbs(dt) {
    if (!this.orbs.length) return;
    const bar = this.$('h-xpfill').getBoundingClientRect(), app = this.game.sceneM.appEl.getBoundingClientRect();
    const tx = bar.left - app.left + bar.width, ty = bar.top - app.top + bar.height / 2;
    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const o = this.orbs[i]; o.t += dt * 1.8;
      const u = Math.min(1, o.t); const e = u * u * (3 - 2 * u);
      const x = o.sx + (tx - o.sx) * e, y = o.sy + (ty - o.sy) * e - Math.sin(u * Math.PI) * 60;
      o.el.style.transform = `translate(${x}px, ${y}px)`;
      if (u >= 1) { o.el.style.display = 'none'; this.orbPool.push(o.el); this.orbs.splice(i, 1); this.game.addXp(o.value); }
    }
  }

  // ---------- cards ----------
  showCards(offer, onPick) {
    this.onPick = onPick; const list = this.$('c-list'); list.innerHTML = '';
    const g = this.game; this.cardsShownAt = performance.now();
    const cardsEl = this.$('cards'); cardsEl.classList.add('locked');
    for (const o of offer) {
      const c = CARDS[o.id]; const n = g.picks[o.id] ? g.picks[o.id].length : 0;
      const el = document.createElement('div'); el.className = `card ui-block ${o.rarity}`;
      const isNew = !g.save.seen.includes(o.id);
      const lvl = c.max >= 99 ? `${n + 1}` : `${n + 1}/${c.max}`;
      el.innerHTML = `${isNew ? '<div class="new">New</div>' : ''}<div class="ico">${c.icon}</div><div class="body"><div class="name">${c.name}</div><div class="desc">${describeCard(o.id, o.rarity, n)}</div></div><div class="meta"><span class="rar">${RARITY_NAME[o.rarity]}</span><span>${lvl}</span></div>`;
      const armed = () => performance.now() - this.cardsShownAt > CONFIG.levelup.inputLock * 1000;
      el.addEventListener('pointerdown', (e) => { if (armed()) { el.dataset.armed = '1'; e.stopPropagation(); } });
      el.addEventListener('pointerup', (e) => { if (el.dataset.armed === '1' && this.onPick) { const cb = this.onPick; this.onPick = null; el.classList.add('picked'); e.stopPropagation(); setTimeout(() => cb(o.id, o.rarity), 120); } });
      el.addEventListener('pointerleave', () => { el.dataset.armed = '0'; });
      list.appendChild(el);
    }
    setTimeout(() => cardsEl.classList.remove('locked'), CONFIG.levelup.inputLock * 1000);
    this.$('cards').classList.add('show');
  }
  hideCards() { this.$('cards').classList.remove('show'); }

  // ---------- results / fail / end ----------
  showResults({ mult, coins, reward, stopper }) {
    this.show('results'); this.$('r-mult').textContent = '×' + mult; this.$('r-calc').textContent = `${fmt(coins)} × ${mult} = ${fmt(reward)}`;
    this.$('r-stopper').textContent = stopper ? (stopper.isBoss ? 'The Dark Lord reached you' : `Stopped by: ${stopper.name} · T${stopper.tier} · HP ${fmt(stopper.hp)}`) : (mult >= CONFIG.bonus.segments + 1 ? 'Reached the boss arena' : 'Cleared the bridge');
    const el = this.$('r-coins'); let t = 0; const g = this.game; const start = performance.now();
    const tick = () => { const u = Math.min(1, (performance.now() - start) / 1300); el.textContent = fmt(reward * u); if (u < 1) { if (Math.floor(u * 10) !== t) { t = Math.floor(u * 10); g.audio.coin(); } requestAnimationFrame(tick); } };
    tick();
  }
  showFail({ pct, kept, suggest, cause }) {
    this.show('fail'); this.$('f-pct').textContent = `${Math.round(pct * 100)}% of the level completed · ${cause === 'enemy' ? 'caught by enemies' : cause === 'spear' ? 'hit by a spear' : 'crushed by an obstacle'}`;
    this.$('f-kept').textContent = fmt(kept); this.$('f-suggest').textContent = UPG[suggest].ico + ' ' + UPG[suggest].name;
  }
  showEnd({ reward, mult, picks, time, levels }) {
    this.show('end');
    const m = Math.floor(time / 60), s = Math.floor(time % 60);
    this.$('e-stats').textContent = `${m}m ${s}s · ${levels} levels · +${fmt(reward)} coins`;
    const b = this.$('e-build'); b.innerHTML = '';
    for (const id in picks) { const best = picks[id].includes('E') ? 'E' : picks[id].includes('R') ? 'R' : 'C'; const sp = document.createElement('span'); sp.className = best; sp.title = CARDS[id].name; sp.textContent = CARDS[id].icon; b.appendChild(sp); }
  }
}
function xpFor(g) { return CONFIG.xp.base + CONFIG.xp.perLevel * (g.levelUps + g.pendingOffers + 1); }
