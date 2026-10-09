import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Check } from '@phosphor-icons/react';
import { themes, rulesetForTheme } from './themes.js';
import { themeTileSets } from './tile-data.js';
import { boardVariants } from './board-variants.js';
import { t } from './i18n.js';

export function ThemeChooser({ themeId, boardThemeId, onConfirm }) {
  const [tab, setTab] = useState('tiles');
  const [tileChoice, setTileChoice] = useState(themeId);
  const [boardChoice, setBoardChoice] = useState(boardThemeId);
  return <div className="collection-picker">
    <div className="parchment-tabs" role="tablist" aria-label={t('Theme category')}>
      {['tiles', 'background'].map(id => <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>{t(id === 'tiles' ? 'Tiles' : 'Background')}</button>)}
    </div>
    <div className={`collection-scroll ${tab === 'background' ? 'background-grid' : ''}`} role="tabpanel" aria-label={t(tab === 'tiles' ? 'Tile collections' : 'Board backgrounds')}>
      {themes.map(theme => tab === 'tiles' ? <button key={theme.id} className={`collection-row ${tileChoice === theme.id ? 'chosen' : ''}`} aria-pressed={tileChoice === theme.id} onClick={() => setTileChoice(theme.id)}>
        <strong>{t(theme.name)}</strong>{tileChoice === theme.id && <Check className="collection-check" weight="bold" />}
        <span className="collection-tiles"><img src={theme.back} alt={t('{theme} tile back', { theme: t(theme.name) })} />{themeTileSets[theme.id][rulesetForTheme(theme.id)].filter((_, i) => [0, 6, 12, 22, 32].includes(i)).map(face => <img key={face.id} src={face.src} alt={t(face.name)} />)}</span>
      </button> : <button key={theme.id} className={`background-swatch ${boardChoice === theme.id ? 'chosen' : ''}`} aria-pressed={boardChoice === theme.id} onClick={() => setBoardChoice(theme.id)}>
        <img src={boardVariants[theme.id].portrait.src} alt="" /><strong>{t(theme.name)}</strong>{boardChoice === theme.id && <Check weight="bold" />}
      </button>)}
    </div>
    <button className="primary-button" onClick={() => onConfirm(tileChoice, boardChoice)}>{t('Confirm')} <Check size={22} weight="bold" /></button>
  </div>;
}

export function VictoryBloom() {
  return <div className="victory-bloom" aria-hidden="true"><span className="bloom-rays" /><span className="bloom-ring" /><img src="./assets/remake/lotus-celebration.png" alt="" />{Array.from({ length: 12 }, (_, i) => <i key={i} style={{ '--spark-angle': `${i * 30}deg`, '--spark-delay': `${i * .09}s` }} />)}</div>;
}
