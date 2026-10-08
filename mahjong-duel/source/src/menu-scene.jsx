import React from 'react';
import { MenuAtmosphere } from './menu-atmosphere.jsx';
import './menu-scene.css';

export function MenuScene({ background, paused = false }) {
  return <div className="menu-scene" data-menu-background={background.id} aria-hidden="true">
    <img className="menu-scene-art" src={background.src} alt="" draggable="false" fetchPriority="high" />
    <MenuAtmosphere kind={background.atmosphere} paused={paused} />
  </div>;
}
