import { CONFIG } from '../config.js';
import { CARDS, ELEMENT_STARTERS, CARD_IDS } from '../data/cards.js';

// Card offer logic (GDD section 7). Returns [{ id, rarity }, ...] with 3 different cards.
function eligible(id, ctx) {
  const c = CARDS[id];
  const picks = ctx.picks[id] ? ctx.picks[id].length : 0;
  if (picks >= c.max) return false;
  const st = ctx.stats;
  if (c.cat === 'element') {
    if (c.starter) return !st.element;
    if (c.element === 'any') return !!st.element;
    return st.element === c.element;
  }
  switch (id) {
    case 'multishot': return st.arrows < 7;
    case 'recruit': return st.allies < CONFIG.ally.max;
    case 'headshot': return st.critChance < 0.5;
    case 'shared_element': return !!st.element && st.allies >= 3;
    case 'healing_potion': return ctx.hpFrac < 0.7;
    default: return true;
  }
}

function rollRarity(ctx) {
  const R = CONFIG.rarity;
  const epicOk = ctx.levelUps >= R.epicFromLevelUp - 1;
  let r = Math.random();
  if (epicOk && r < R.epic) return 'E';
  r = Math.random();
  return r < R.rare / (R.rare + R.common) ? 'R' : 'C';
}

function pickCard(pool, rarity, ctx, exclude) {
  const order = rarity === 'E' ? ['E', 'R', 'C'] : rarity === 'R' ? ['R', 'C', 'E'] : ['C', 'R', 'E'];
  for (const r of order) {
    const cands = pool.filter((id) => !exclude.has(id) && CARDS[id].rar.includes(r) && !(id === 'multishot' && r === 'E' && ctx.stats.arrows > 5));
    if (!cands.length) continue;
    let total = 0; const w = cands.map((id) => { const ww = 1 + (ctx.picks[id] ? CONFIG.rarity.ownedWeightBonus : 0) * 1; total += ww; return ww; });
    let x = Math.random() * total;
    for (let i = 0; i < cands.length; i++) { x -= w[i]; if (x <= 0) return { id: cands[i], rarity: r }; }
    return { id: cands[cands.length - 1], rarity: r };
  }
  return null;
}

export function makeOffer(ctx) {
  // ctx: { level, levelUps (0 for first offer of the level), picks, stats, hpFrac }
  if (ctx.level === 1 && ctx.levelUps === 0) {
    return [{ id: 'multishot', rarity: 'R' }, { id: 'recruit', rarity: 'C' }, { id: 'sharp_tip', rarity: 'C' }];
  }
  const pool = CARD_IDS.filter((id) => eligible(id, ctx));
  const out = []; const used = new Set();
  if (ctx.levelUps === 0) {
    // first offer of the level: one element card + Recruit or Multishot
    if (!ctx.stats.element) {
      const starters = ELEMENT_STARTERS.filter((id) => pool.includes(id));
      if (starters.length) { const id = starters[Math.floor(Math.random() * starters.length)]; out.push({ id, rarity: 'R' }); used.add(id); }
    } else {
      const elemCards = pool.filter((id) => CARDS[id].cat === 'element');
      if (elemCards.length) { const p = pickCard(elemCards, rollRarity(ctx), ctx, used); if (p) { out.push(p); used.add(p.id); } }
    }
    const rm = ['recruit', 'multishot'].filter((id) => pool.includes(id));
    if (rm.length) { const id = rm[Math.floor(Math.random() * rm.length)]; const p = pickCard([id], rollRarity(ctx), ctx, used); if (p) { out.push(p); used.add(p.id); } }
  }
  let guard = 0;
  while (out.length < 3 && guard++ < 20) {
    const p = pickCard(pool, rollRarity(ctx), ctx, used);
    if (!p) break;
    out.push(p); used.add(p.id);
  }
  return out;
}

export function describeCard(id, rarity, picksOwned) {
  const c = CARDS[id];
  const v = c.val[rarity] != null ? c.val[rarity] : c.val[c.rar[0]];
  return c.text(v, picksOwned);
}
