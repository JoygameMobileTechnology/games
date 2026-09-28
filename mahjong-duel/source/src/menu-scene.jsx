import React from 'react';
import { motion } from 'motion/react';
import { DoorScene } from './remake-ui.jsx';
import { MenuAtmosphere } from './menu-atmosphere.jsx';
import './menu-scene.css';

export function MenuScene({ background, paused = false, opening = false, onComplete }) {
  if (opening && background.id === 'bamboo') return <DoorScene opening onComplete={onComplete} />;

  return <motion.div className={`menu-scene ${opening ? 'menu-scene-transition' : ''}`} data-menu-background={background.id}
    aria-hidden="true" initial={opening ? { opacity: 1 } : false} animate={{ opacity: opening ? 0 : 1 }}
    transition={{ duration: .7, ease: [.4, 0, .2, 1] }} onAnimationComplete={() => { if (opening) onComplete?.(); }}>
    <img className="menu-scene-art" src={background.src} alt="" draggable="false" fetchPriority="high" />
    <MenuAtmosphere kind={background.atmosphere} paused={paused || opening} />
  </motion.div>;
}
