// Text and controls are chosen for the actual board material beneath them.
const palettes = {
  'ming-porcelain': { ink: '#253e5d', muted: '#51637a', action: '#315d89', onAction: '#fffaf0', panel: '#f3f0e5', control: '#fffdf17a', hover: '#fffdf1bd', line: '#39547432', scrim: '#172b466b', shadow: '#16325229' },
  'guo-xi': { ink: '#293f33', muted: '#54624e', action: '#41634e', onAction: '#fff9e9', panel: '#e9ecdb', control: '#fcfce878', hover: '#fcfce8ba', line: '#394d3738', scrim: '#1b30276b', shadow: '#1b332629' },
  'xia-gui': { ink: '#3d4631', muted: '#62664e', action: '#586549', onAction: '#fff9e9', panel: '#f0ead6', control: '#fffbe878', hover: '#fffbe8ba', line: '#4a513537', scrim: '#2731216b', shadow: '#30392329' },
  'dancheong': { ink: '#f3ecd8', muted: '#c4cfb8', action: '#e7cca0', onAction: '#253c31', panel: '#243b30', control: '#092b2080', hover: '#254a38bd', line: '#d5ddb336', scrim: '#091e16a6', shadow: '#071c1759' },
  'dunhuang': { ink: '#4a3225', muted: '#654c38', action: '#785037', onAction: '#fff2d8', panel: '#e9d6b4', control: '#fff2d16b', hover: '#fff2d1b3', line: '#67472f3d', scrim: '#422c1b73', shadow: '#513b232e' },
  'stained-glass': { ink: '#f0e8d6', muted: '#c4c8d1', action: '#dfc493', onAction: '#273345', panel: '#243144', control: '#08182c80', hover: '#283d53c2', line: '#d8c99c35', scrim: '#08101dab', shadow: '#060e1e66' },
  'dutch-golden-age': { ink: '#f6e7c9', muted: '#e2c8b3', action: '#e5c58b', onAction: '#4a2727', panel: '#4b2428', control: '#340e1973', hover: '#702b33b8', line: '#e3c39040', scrim: '#260e17a6', shadow: '#280b1766' },
  'neon-shrine': { ink: '#eff0fa', muted: '#c6d7e5', action: '#b2e6ea', onAction: '#2f3c58', panel: '#2b3d59', control: '#132a4a80', hover: '#415774bd', line: '#b2d9ec3d', scrim: '#10203b9e', shadow: '#14213d59' },
  'brass-meridian': { ink: '#f2e8cb', muted: '#c4d3c5', action: '#dfc58b', onAction: '#2a4542', panel: '#244745', control: '#092f3080', hover: '#2b5e5bbd', line: '#d8c89b3b', scrim: '#092b2da6', shadow: '#082a2c66' },
};

export function themeUiStyle(themeId) {
  const palette = palettes[themeId] || palettes['ming-porcelain'];
  const dark = ['dancheong', 'stained-glass', 'dutch-golden-age', 'neon-shrine', 'brass-meridian'].includes(themeId);
  return Object.fromEntries(Object.entries({ ...palette, warning: dark ? '#ffb4a3' : '#953e2e' }).map(([key, value]) => [
    `--ui-${key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}`, value,
  ]));
}
