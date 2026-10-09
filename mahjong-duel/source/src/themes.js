// Only these collections are available in the game build; the full art catalogue remains separate.
export const launchThemeIds = ["ming-porcelain", "dancheong", "stained-glass", "dutch-golden-age"];
export const THEME_RULESETS = Object.freeze({
  'ming-porcelain': 'eastern',
  dancheong: 'eastern',
  'stained-glass': 'western',
  'dutch-golden-age': 'western',
});

/** The collection determines its tile set; old Settings preferences are ignored. */
export function rulesetForTheme(themeId) {
  return Object.hasOwn(THEME_RULESETS, themeId) ? THEME_RULESETS[themeId] : 'eastern';
}
export const themes = [
  { id: 'ming-porcelain', back: './assets/backs/ming-porcelain.webp', name: 'Ming porcelain', caption: 'Blue & white. Timeless by nature.', accent: '#28558c', ink: '#244674', surface: '#f4f7fb', tint: '#dce6f2' },
  { id: 'dancheong', back: './assets/backs/dancheong.webp', name: 'Dancheong', caption: 'Temple colors. Perfectly in balance.', accent: '#377c70', ink: '#28564e', surface: '#f2f5ef', tint: '#d5e4dc' },
  { id: 'stained-glass', back: './assets/backs/stained-glass.webp', name: 'Stained Glass', caption: 'A mosaic of color. A moment of light.', accent: '#765565', ink: '#503f59', surface: '#f5f1f6', tint: '#e0d9e9' },
  { id: 'dutch-golden-age', back: './assets/backs/dutch-golden-age.webp', name: 'Dutch Golden Age', caption: 'Small treasures. Rich in detail.', accent: '#856947', ink: '#564632', surface: '#f7f3ec', tint: '#e7decb' },
].map((theme, index) => ({ ...theme, number: String(index + 1).padStart(2, '0') }));
export const themeById = Object.fromEntries(themes.map(theme => [theme.id, theme]));
export const defaultTheme = themes[0];
