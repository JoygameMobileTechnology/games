export const menuBackgrounds = [
  { id: 'autumn-daylight', src: './assets/remake/menu-backgrounds/autumn-daylight.webp', atmosphere: 'autumn' },
  { id: 'spring-blossom', src: './assets/remake/menu-backgrounds/spring-blossom.webp', atmosphere: 'spring' },
  { id: 'bamboo-garden', src: './assets/remake/menu-backgrounds/bamboo-garden.webp', atmosphere: 'bamboo' },
];

/** Pick once at launch; the previous launch is excluded before drawing. */
export function chooseMenuBackground(previousId, random = Math.random) {
  const choices = menuBackgrounds.filter(background => background.id !== previousId);
  return choices[Math.floor(random() * choices.length)];
}
