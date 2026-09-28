export const menuBackgrounds = [
  { id: 'bamboo', src: './assets/remake/shoji-doors.png', atmosphere: 'bamboo' },
  { id: 'lantern-night', src: './assets/remake/lantern-night.png', atmosphere: 'fireflies' },
  { id: 'autumn-daylight', src: './assets/remake/autumn-daylight.png', atmosphere: 'autumn' },
];

/** Pick once at launch; the previous launch is excluded before drawing. */
export function chooseMenuBackground(previousId, random = Math.random) {
  const choices = menuBackgrounds.filter(background => background.id !== previousId);
  return choices[Math.floor(random() * choices.length)];
}
