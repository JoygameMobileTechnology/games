import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Check } from '@phosphor-icons/react';
import { themes } from './themes.js';
import { themeTileSets } from './tile-data.js';
import { boardVariants } from './board-variants.js';
import { menuBackgrounds } from './menu-backgrounds.js';

export const doorArt = menuBackgrounds.find(background => background.id === 'bamboo').src;

export function DoorScene({ opening = false, onComplete }) {
  return <div className={`door-scene ${opening ? 'door-transition' : ''}`} aria-hidden="true">
    <motion.div className="door-half door-left" initial={opening ? { x: '0%' } : false} animate={{ x: opening ? '-102%' : '0%' }} transition={{ duration: .95, ease: [.55, .04, .2, 1], delay: .12 }}><img src={doorArt} alt="" /></motion.div>
    <motion.div className="door-half door-right" initial={opening ? { x: '0%' } : false} animate={{ x: opening ? '102%' : '0%' }} transition={{ duration: .95, ease: [.55, .04, .2, 1], delay: .12 }} onAnimationComplete={() => { if (opening) onComplete?.(); }}><img src={doorArt} alt="" /></motion.div>
    {opening && <motion.div className="door-light" initial={{ opacity: 0, scaleX: .1 }} animate={{ opacity: [0, 1, 0], scaleX: [1, 12, 28] }} transition={{ duration: .85 }} />}
  </div>;
}

export function FallingLeaves() {
  return <div className="falling-leaves" aria-hidden="true">{Array.from({ length: 6 }, (_, i) => <i key={i} style={{ '--leaf-x': `${i * 19 + 3}%`, '--leaf-delay': `${-i * 2.8}s`, '--leaf-duration': `${12 + i * 1.4}s` }} />)}</div>;
}

export function ThemeChooser({ themeId, boardThemeId, ruleset, onConfirm }) {
  const [tab, setTab] = useState('tiles');
  const [tileChoice, setTileChoice] = useState(themeId);
  const [boardChoice, setBoardChoice] = useState(boardThemeId);
  return <div className="collection-picker">
    <div className="parchment-tabs" role="tablist" aria-label="Theme category">
      {['tiles', 'background'].map(id => <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>{id === 'tiles' ? 'Tiles' : 'Background'}</button>)}
    </div>
    <div className={`collection-scroll ${tab === 'background' ? 'background-grid' : ''}`} role="tabpanel" aria-label={tab === 'tiles' ? 'Tile collections' : 'Board backgrounds'}>
      {themes.map(theme => tab === 'tiles' ? <button key={theme.id} className={`collection-row ${tileChoice === theme.id ? 'chosen' : ''}`} aria-pressed={tileChoice === theme.id} onClick={() => setTileChoice(theme.id)}>
        <strong>{theme.name}</strong>{tileChoice === theme.id && <Check className="collection-check" weight="bold" />}
        <span className="collection-tiles"><img src={theme.back} alt={`${theme.name} tile back`} />{themeTileSets[theme.id][ruleset].filter((_, i) => [0, 6, 12, 22, 32].includes(i)).map(face => <img key={face.id} src={face.src} alt={face.name} />)}</span>
      </button> : <button key={theme.id} className={`background-swatch ${boardChoice === theme.id ? 'chosen' : ''}`} aria-pressed={boardChoice === theme.id} onClick={() => setBoardChoice(theme.id)}>
        <img src={boardVariants[theme.id].portrait.src} alt="" /><strong>{theme.name}</strong>{boardChoice === theme.id && <Check weight="bold" />}
      </button>)}
    </div>
    <button className="primary-button" onClick={() => onConfirm(tileChoice, boardChoice)}>Confirm <Check size={22} weight="bold" /></button>
  </div>;
}

export function VictoryBloom() {
  return <div className="victory-bloom" aria-hidden="true"><span className="bloom-rays" /><span className="bloom-ring" /><img src="./assets/remake/lotus-celebration.png" alt="" />{Array.from({ length: 12 }, (_, i) => <i key={i} style={{ '--spark-angle': `${i * 30}deg`, '--spark-delay': `${i * .09}s` }} />)}</div>;
}
