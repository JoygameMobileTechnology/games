import React from 'react';
import './tile-rarity.css';

/** Mount only when a face or an Eagle Eye reveal may show its rarity. */
export function TileRarity({ rarity }) {
  return <span className="tile-rarity-frame" aria-hidden="true" style={{ '--rarity-color': rarity.color }} />;
}
