// Engineer switch: restore the autumn and blossom rotation in loading and menu.
export const ENABLE_SEASONAL_MENU_BACKGROUNDS = false;

export const menuBackgrounds = [
  { id: 'autumn-daylight', src: './assets/remake/menu-backgrounds/autumn-daylight.webp', atmosphere: 'autumn' },
  { id: 'spring-blossom', src: './assets/remake/menu-backgrounds/spring-blossom.webp', atmosphere: 'spring' },
  { id: 'bamboo-garden', src: './assets/remake/menu-backgrounds/bamboo-garden.webp', atmosphere: 'bamboo' },
];

/** Pick once for loading and menu; avoid repeats when multiple scenes are enabled. */
export function chooseMenuBackground(previousId, random = Math.random, seasonalEnabled = ENABLE_SEASONAL_MENU_BACKGROUNDS) {
  const enabled = seasonalEnabled ? menuBackgrounds : menuBackgrounds.filter(background => background.id === 'bamboo-garden');
  const alternatives = enabled.filter(background => background.id !== previousId);
  const choices = alternatives.length ? alternatives : enabled;
  return choices[Math.floor(random() * choices.length)];
}
