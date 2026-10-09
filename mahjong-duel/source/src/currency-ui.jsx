import React from 'react';
import './currency-ui.css';
import { t, formatNumber, getLanguage } from './i18n.js';

const currencyNames = { coins: 'Coins', gems: 'Gems' };
const currencyArtwork = { coins: './assets/remake/economy/coins.png', gems: './assets/remake/economy/gems.png' };
const compactNumber = value => new Intl.NumberFormat(getLanguage() === 'tr' ? 'tr-TR' : 'en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
const amountOf = value => Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;

export function CurrencyIcon({ kind, className = '' }) {
  return <img className={`currency-icon currency-icon-${kind} ${className}`} src={currencyArtwork[kind]} alt="" aria-hidden="true" draggable="false" />;
}

export function CurrencyBalance({ currencies = {}, compact = false }) {
  return <div className={`currency-balance ${compact ? 'is-compact' : ''}`} role="group" aria-label={t("Currency balances")}>
    {['coins', 'gems'].map(kind => {
      const amount = amountOf(currencies?.[kind]), exact = `${formatNumber(amount)} ${t(currencyNames[kind])}`;
      return <span className={`currency-amount currency-amount-${kind}`} key={kind} role="img" aria-label={exact} title={exact}>
        <CurrencyIcon kind={kind} /><strong aria-hidden="true">{compact && amount >= 1000 ? compactNumber(amount) : formatNumber(amount)}</strong>
      </span>;
    })}
  </div>;
}
