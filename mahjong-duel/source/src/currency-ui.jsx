import React from 'react';
import './currency-ui.css';

const currencyNames = { coins: 'Coins', gems: 'Gems' };
const currencyArtwork = { coins: './assets/remake/economy/coins.png', gems: './assets/remake/economy/gems.png' };
const compactNumber = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 });
const amountOf = value => Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;

export function CurrencyIcon({ kind, className = '' }) {
  return <img className={`currency-icon currency-icon-${kind} ${className}`} src={currencyArtwork[kind]} alt="" aria-hidden="true" draggable="false" />;
}

export function CurrencyBalance({ currencies = {}, compact = false }) {
  return <div className={`currency-balance ${compact ? 'is-compact' : ''}`} role="group" aria-label="Currency balances">
    {['coins', 'gems'].map(kind => {
      const amount = amountOf(currencies?.[kind]), exact = `${amount.toLocaleString()} ${currencyNames[kind]}`;
      return <span className={`currency-amount currency-amount-${kind}`} key={kind} role="img" aria-label={exact} title={exact}>
        <CurrencyIcon kind={kind} /><strong aria-hidden="true">{compact && amount >= 1000 ? compactNumber.format(amount) : amount.toLocaleString()}</strong>
      </span>;
    })}
  </div>;
}
