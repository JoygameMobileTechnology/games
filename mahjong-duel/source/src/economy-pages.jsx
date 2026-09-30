import React, { useEffect, useRef, useState } from 'react';
import { ArrowsClockwise, Check, Clock, Eye, Lightbulb, Snowflake } from '@phosphor-icons/react';
import { ProgressionPage } from './progression-page.jsx';
import { CurrencyBalance, CurrencyIcon } from './currency-ui.jsx';
import { getDailyQuestView } from './daily-quests.js';
import { getDailyQuestPresentation } from './daily-quest-presentation.js';
import { DailyQuestIcon } from './daily-quest-icon.jsx';
import { SHOP_CURRENCY_PACKS, SHOP_BOOSTER_PACKS, canAfford } from './economy.js';
import './economy-pages.css';
import './daily-quests-page.css';
import './shop-page.css';

const format = value => Number(value || 0).toLocaleString();
const DIFFICULTIES = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
const BOOSTERS = { shuffle: { label: 'Shuffle', Icon: ArrowsClockwise }, hint: { label: 'Hint', Icon: Lightbulb }, freeze: { label: 'Freeze', Icon: Snowflake }, eagle: { label: 'Eagle Eye', Icon: Eye } };
const SHOP_ARTWORK = {
  'coins-pouch': './assets/remake/economy/shop/coins-pouch.webp',
  'gems-pouch': './assets/remake/economy/shop/gems-pouch.webp',
  'travelers-purse': './assets/remake/economy/shop/travelers-purse.webp',
  'jade-chest': './assets/remake/economy/shop/jade-chest.webp',
  'imperial-chest': './assets/remake/economy/shop/imperial-chest.webp',
};
const boosterKinds = product => Object.keys(BOOSTERS).filter(kind => product.boosters[kind] > 0);
const singlePacks = SHOP_BOOSTER_PACKS.filter(product => boosterKinds(product).length === 1);
const comboPacks = SHOP_BOOSTER_PACKS.filter(product => boosterKinds(product).length > 1);
const currencyText = amounts => Object.entries(amounts || {}).filter(([, value]) => value > 0).map(([kind, value]) => `${format(value)} ${kind}`).join(' and ');

function CurrencyAmounts({ amounts, className = '' }) {
  return <span className={`economy-amounts ${className}`}>{['coins', 'gems'].filter(kind => amounts?.[kind] > 0).map(kind => <span key={kind} aria-label={`${format(amounts[kind])} ${kind}`}><CurrencyIcon kind={kind} /><strong>{format(amounts[kind])}</strong></span>)}</span>;
}
function BoosterContents({ boosters, large = false }) {
  return <div className={`shop-booster-contents ${large ? 'is-large' : ''}`}>{Object.entries(BOOSTERS).filter(([kind]) => boosters?.[kind] > 0).map(([kind, { label, Icon }]) => <span key={kind} aria-label={`${format(boosters[kind])} ${label}`}><span className="shop-booster-coin"><Icon size={40} weight={kind === 'hint' ? 'fill' : 'bold'} aria-hidden="true" /></span><strong>×{format(boosters[kind])}</strong><small>{label}</small></span>)}</div>;
}
function ShopArtwork({ product, priority = false }) {
  return <div className="shop-product-art"><img src={SHOP_ARTWORK[product.id]} alt="" aria-hidden="true" width="512" height="512" loading={priority ? 'eager' : 'lazy'} decoding="async" draggable="false" /></div>;
}
function boosterSummary(product) {
  const kinds = boosterKinds(product), counts = kinds.map(kind => product.boosters[kind]);
  if (kinds.length === Object.keys(BOOSTERS).length && counts.every(count => count === counts[0])) return `${counts[0]} of each booster`;
  return kinds.map(kind => `${product.boosters[kind]} ${BOOSTERS[kind].label}${product.boosters[kind] > 1 ? 's' : ''}`).join(' + ');
}
function ShopBoosterCard({ product, currencies, busy, onSelect, combo = false }) {
  const canBuy = canAfford(currencies, product.cost);
  return <article className={`shop-product ${combo ? 'shop-combo-product' : 'shop-booster-product'}`} aria-label={product.name}>
    <div className="shop-booster-copy"><h4>{product.name}</h4>{combo && <p>{boosterSummary(product)}</p>}</div>
    {!combo && <BoosterContents boosters={product.boosters} />}
    <button type="button" className="economy-price-button" data-shop-product={product.id} disabled={busy || !canBuy} onClick={() => onSelect(product)} aria-label={`Buy ${product.name} for ${currencyText(product.cost)}`}><CurrencyAmounts amounts={product.cost} /></button>
    {!canBuy && <small className="shop-insufficient">Need {missingCurrency(currencies, product.cost)}</small>}
  </article>;
}
function usePageAction() {
  const [pending, setPending] = useState(null), [status, setStatus] = useState(null);
  const running = useRef(false), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const run = async (id, handler, ...args) => {
    if (running.current) return null;
    running.current = true; setPending(id); setStatus(null);
    let result;
    try { result = await handler(...args); }
    catch { result = { ok: false, message: 'That did not complete. Please try again.' }; }
    finally { running.current = false; if (mounted.current) setPending(null); }
    if (mounted.current) setStatus(result?.message ? result : null);
    return result;
  };
  return { pending, status, run, clear: () => setStatus(null) };
}
function ActionStatus({ status }) {
  return <div className={`economy-action-status ${status?.ok === false ? 'is-error' : ''}`} role="status" aria-live="polite">{status?.message && <>{status.ok && <Check size={17} weight="bold" aria-hidden="true" />}<span>{status.message}</span></>}</div>;
}
function resetLabel(resetAt, now) {
  const minutes = Math.max(0, Math.ceil((resetAt - now) / 60000));
  if (!minutes) return 'New quests are arriving';
  const hours = Math.floor(minutes / 60), rest = minutes % 60;
  return `New quests in ${hours ? `${hours}h ` : ''}${rest}m`;
}

export function DailyQuestsPage({ progression, onClose, onClaim, onReroll, now = Date.now(), showLoginAction = false }) {
  const view = getDailyQuestView(progression, now), action = usePageAction();
  const [rerollId, setRerollId] = useState(null);
  const currentDay = useRef(view.dayId), confirmRef = useRef(null), rerollOpener = useRef(null), questList = useRef(null), replacementFocus = useRef(null);
  useEffect(() => {
    if (currentDay.current !== view.dayId) { currentDay.current = view.dayId; setRerollId(null); action.clear(); }
  }, [view.dayId]);
  useEffect(() => { if (rerollId) confirmRef.current?.focus({ preventScroll: true }); }, [rerollId]);
  useEffect(() => {
    if (!rerollId && replacementFocus.current !== null) {
      questList.current?.children[replacementFocus.current]?.querySelector('h3')?.focus({ preventScroll: true });
      replacementFocus.current = null;
    }
  }, [rerollId, view.quests.map(quest => quest.id).join(':')]);
  const cancelReroll = () => { setRerollId(null); rerollOpener.current?.focus({ preventScroll: true }); };
  const reroll = async quest => {
    const result = await action.run(`reroll:${quest.id}`, onReroll, quest.id, view.dayId);
    if (result?.ok) { replacementFocus.current = view.quests.findIndex(item => item.id === quest.id); setRerollId(null); }
  };
  const completedCount = view.quests.filter(quest => quest.completed || quest.claimed).length;
  return <ProgressionPage title="Daily Quests" className="economy-page daily-quests-page" onClose={onClose}>
    <div className="daily-quests-dayline"><span><Clock size={25} weight="bold" aria-hidden="true" />{resetLabel(view.resetAt, now)}</span><strong>{completedCount} / {view.quests.length} completed</strong></div>
    <ActionStatus status={action.status} />
    <div className="daily-quest-list" ref={questList}>{view.quests.map(quest => {
      const difficulty = DIFFICULTIES[quest.difficulty] || DIFFICULTIES.easy;
      const presentation = getDailyQuestPresentation(quest);
      const rerolling = rerollId === quest.id, busy = Boolean(action.pending), finished = quest.completed || quest.claimed;
      return <article className={`daily-quest-card difficulty-${quest.difficulty} ${quest.claimed ? 'is-claimed' : quest.completed ? 'is-complete' : ''}`} key={`${view.dayId}:${quest.id}`} aria-label={`${quest.title}, ${difficulty} quest`}>
        <div className="daily-quest-main">
          <div className="daily-quest-art"><DailyQuestIcon metric={quest.metric} /></div>
          <div className="daily-quest-copy">
            <span className="daily-quest-difficulty">{difficulty}</span>
            <h3 tabIndex={-1}>{presentation.title}</h3>
            {presentation.detail && <p className="daily-quest-description">{presentation.detail}</p>}
          </div>
          <div className="daily-quest-progress"><progress value={Math.min(quest.progress, quest.target)} max={quest.target} aria-label={`${quest.title} progress`} /><strong>{presentation.bestRun && <small>Best run: </small>}{format(Math.min(quest.progress, quest.target))} / {format(quest.target)}</strong></div>
          <div className="daily-quest-actions">{quest.claimed ? <span className="daily-quest-claimed"><span><Check size={28} weight="bold" aria-hidden="true" /></span>Claimed</span> : quest.completed ? <button type="button" className="daily-quest-claim" disabled={busy} onClick={() => action.run(`claim:${quest.id}`, onClaim, quest.id, view.dayId)}><span><Check size={28} weight="bold" aria-hidden="true" /></span><strong>{action.pending === `claim:${quest.id}` ? 'Claiming…' : 'Claim'}</strong></button> : <button type="button" className="daily-quest-reroll" aria-label={`Replace ${quest.title}`} aria-expanded={rerolling} disabled={busy || view.rerollsLeft < 1} onClick={event => { action.clear(); rerollOpener.current = event.currentTarget; setRerollId(rerolling ? null : quest.id); }}><span className="daily-quest-wood-button"><ArrowsClockwise size={34} weight="bold" aria-hidden="true" /></span><strong>{view.rerollsLeft > 0 ? 'Re-roll' : 'Used today'}</strong></button>}</div>
        </div>
        <div className="daily-quest-reward"><strong>Reward</strong><CurrencyAmounts amounts={quest.reward} /></div>
        {rerolling && !finished && <section className="daily-quest-reroll-confirm" aria-label="Confirm quest replacement"><h4 ref={confirmRef} tabIndex={-1}>Replace this quest?</h4><p>Uses your free daily replacement. This quest’s progress is lost, and the new quest will have a different difficulty.</p><div><button type="button" className="economy-quiet-button" disabled={busy} onClick={cancelReroll}>Keep quest</button><button type="button" className="economy-small-primary" disabled={busy || view.rerollsLeft < 1} onClick={() => reroll(quest)}>{busy ? 'Replacing…' : 'Replace for free'}</button></div></section>}
      </article>;
    })}</div>
    <p className="daily-quests-footnote"><span>{view.rerollsLeft > 0 ? '1 free re-roll available today' : 'Free re-roll used · More tomorrow'}</span></p>
    {showLoginAction && <button type="button" className="progression-primary daily-quests-login-ok" onClick={onClose}>OK</button>}
  </ProgressionPage>;
}

function missingCurrency(currencies, cost) {
  return ['coins', 'gems'].filter(kind => cost?.[kind] > (currencies?.[kind] || 0)).map(kind => `${format(cost[kind] - (currencies?.[kind] || 0))} more ${kind}`).join(' and ');
}
export function ShopPage({ progression, onClose, onBuy, onPurchase, purchaseState = 'idle' }) {
  const [confirm, setConfirm] = useState(null), action = usePageAction();
  const bodyRef = useRef(null), scrollPosition = useRef(0), openerId = useRef(null), restore = useRef(false);
  const externalBusy = purchaseState === 'loading', busy = Boolean(action.pending) || externalBusy;
  useEffect(() => {
    if (!confirm && restore.current) {
      if (bodyRef.current) { bodyRef.current.scrollTop = scrollPosition.current; bodyRef.current.querySelector(`[data-shop-product="${openerId.current}"]`)?.focus({ preventScroll: true }); }
      restore.current = false;
    }
  }, [confirm]);
  const openConfirmation = product => { scrollPosition.current = bodyRef.current?.scrollTop || 0; openerId.current = product.id; action.clear(); setConfirm(product); if (bodyRef.current) bodyRef.current.scrollTop = 0; };
  const closeConfirmation = () => { restore.current = true; setConfirm(null); };
  const completePurchase = async () => {
    if (!confirm || busy) return;
    const result = await action.run(confirm.id, confirm.kind === 'currency' ? onPurchase : onBuy, confirm.id);
    if (result?.ok) closeConfirmation();
  };
  const affordable = !confirm || confirm.kind === 'currency' || canAfford(progression.currencies, confirm.cost);
  return <ProgressionPage title={confirm ? 'Confirm purchase' : 'Shop'} className={`economy-page shop-page ${confirm ? 'is-confirming' : ''}`} bodyRef={bodyRef} onClose={confirm ? closeConfirmation : onClose} closeLabel={confirm ? 'Back to shop' : 'Back to main menu'}>
    <div className="shop-wallet"><CurrencyBalance currencies={progression.currencies} compact={Object.values(progression.currencies || {}).some(value => value >= 100000)} /></div>
    <ActionStatus status={action.status} />
    {confirm ? <section className="shop-confirmation" aria-label={`Confirm ${confirm.name}`}>
      <span className="shop-confirmation-kicker">{confirm.kind === 'currency' ? 'Test purchase' : 'Booster purchase'}</span>
      <h3>{confirm.name}</h3><p>{confirm.description}</p>
      {confirm.kind === 'currency' ? <><ShopArtwork product={confirm} priority /><CurrencyAmounts amounts={confirm.grants} className="shop-confirmation-grants" /></> : <BoosterContents boosters={confirm.boosters} large />}
      <div className="shop-confirmation-price"><span>{confirm.kind === 'currency' ? 'Listed price' : 'You spend'}</span>{confirm.kind === 'currency' ? <strong>{confirm.priceLabel}</strong> : <CurrencyAmounts amounts={confirm.cost} />}</div>
      {confirm.kind === 'currency' ? <p className="shop-test-notice">Test purchases — no real money charged.</p> : <p className="shop-confirmation-note">Added to your booster balance for future use.</p>}
      {!affordable && <p className="shop-insufficient">You need {missingCurrency(progression.currencies, confirm.cost)}.</p>}
      <button type="button" className="progression-primary" disabled={busy || !affordable} onClick={completePurchase}>{busy ? 'Adding to your balance…' : confirm.kind === 'currency' ? 'Test purchase' : 'Confirm purchase'}</button>
      <button type="button" className="economy-quiet-button shop-cancel" disabled={busy} onClick={closeConfirmation}>Cancel</button>
    </section> : <>
      <section className="shop-section" aria-labelledby="shop-currencies-heading">
        <h3 id="shop-currencies-heading" className="ornament-heading">Gold &amp; Gems</h3>
        <p className="shop-test-notice">Test purchases — no real money charged.</p>
        <div className="shop-products shop-currency-products">{SHOP_CURRENCY_PACKS.map((product, index) => <article className={`shop-product shop-currency-product ${product.id === 'imperial-chest' ? 'is-featured' : ''}`} key={product.id} aria-label={product.name}>
          <h4>{product.name}</h4><ShopArtwork product={product} priority={index < 2} /><CurrencyAmounts amounts={product.grants} className="shop-currency-grants" />
          <button type="button" className="economy-price-button shop-currency-price" data-shop-product={product.id} disabled={busy} onClick={() => openConfirmation(product)} aria-label={`${product.name}, ${product.priceLabel}, test purchase`}>{product.priceLabel}</button>
        </article>)}</div>
      </section>
      <section className="shop-section" aria-labelledby="shop-boosters-heading"><h3 id="shop-boosters-heading" className="ornament-heading">Booster packs</h3><div className="shop-products shop-single-products">{singlePacks.map(product => <ShopBoosterCard key={product.id} product={product} currencies={progression.currencies} busy={busy} onSelect={openConfirmation} />)}</div></section>
      <section className="shop-section" aria-labelledby="shop-combos-heading"><h3 id="shop-combos-heading" className="ornament-heading">Combo packs</h3><div className="shop-combo-products">{comboPacks.map(product => <ShopBoosterCard key={product.id} product={product} currencies={progression.currencies} busy={busy} onSelect={openConfirmation} combo />)}</div></section>
    </>}
  </ProgressionPage>;
}
