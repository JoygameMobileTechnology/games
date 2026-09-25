export const themes = [
  { id: 'ming-porcelain', back: './assets/backs/ming-porcelain.webp', name: 'Ming porcelain', caption: 'Blue & white. Timeless by nature.', accent: '#28558c', ink: '#244674', surface: '#f4f7fb', tint: '#dce6f2' },
  { id: 'guo-xi', back: './assets/backs/guo-xi.webp', name: 'Guo Xi', caption: 'Quiet mountains. A thoughtful moment.', accent: '#426857', ink: '#304e43', surface: '#f1f4ee', tint: '#d6e1d6' },
  { id: 'xia-gui', back: './assets/backs/xia-gui.webp', name: 'Xia Gui', caption: 'A river of ink. A little room to breathe.', accent: '#65745b', ink: '#485541', surface: '#f6f5ef', tint: '#e0e3d4' },
  { id: 'dancheong', back: './assets/backs/dancheong.webp', name: 'Dancheong', caption: 'Temple colors. Perfectly in balance.', accent: '#377c70', ink: '#28564e', surface: '#f2f5ef', tint: '#d5e4dc' },
  { id: 'dunhuang', back: './assets/backs/dunhuang.webp', name: 'Dunhuang', caption: 'Mineral color. Stories in the stone.', accent: '#9a654c', ink: '#714c3b', surface: '#f7f2e8', tint: '#e8daca' },
  { id: 'stained-glass', back: './assets/backs/stained-glass.webp', name: 'Stained Glass', caption: 'A mosaic of color. A moment of light.', accent: '#765565', ink: '#503f59', surface: '#f5f1f6', tint: '#e0d9e9' },
  { id: 'dutch-golden-age', back: './assets/backs/dutch-golden-age.webp', name: 'Dutch Golden Age', caption: 'Small treasures. Rich in detail.', accent: '#856947', ink: '#564632', surface: '#f7f3ec', tint: '#e7decb' },
  { id: 'neon-shrine', back: './assets/backs/neon-shrine.webp', name: 'Neon Shrine', caption: 'Soft neon. A different kind of zen.', accent: '#725b99', ink: '#49385f', surface: '#f5f2fc', tint: '#e1d9f1' },
  { id: 'brass-meridian', back: './assets/backs/brass-meridian.webp', name: 'Brass Meridian', caption: 'Find your bearings. Follow your memory.', accent: '#65796e', ink: '#3d534b', surface: '#f4f4ed', tint: '#dce1d6' },
].map((theme, index) => ({ ...theme, number: String(index + 1).padStart(2, '0') }));
export const themeById = Object.fromEntries(themes.map(theme => [theme.id, theme]));
export const defaultTheme = themes[0];
