// Board concepts extracted from pages 3–11 of the theme proposal.
// Source frames are preserved with CSS border-image slices for portrait play.
export const boardArt = {
  'ming-porcelain': { src: './assets/boards/ming-porcelain.webp', slice: '240', base: '#e8e8df', edge: '#65829b', light: '#e5ebeb', shade: '#a4b4bc', shadow: '#243b5059', selection: '#396ca4' },
  'guo-xi': { src: './assets/boards/guo-xi.webp', slice: '190 260 170 300', base: '#d9ddcc', edge: '#6d7b65', light: '#e7e8d9', shade: '#b0b6a2', shadow: '#253a285c', selection: '#49715c' },
  'xia-gui': { src: './assets/boards/xia-gui.webp', slice: '150 190 180 230', base: '#e5dfc9', edge: '#8a876a', light: '#f0ead9', shade: '#bcb69b', shadow: '#393e2a59', selection: '#62724c' },
  'dancheong': { src: './assets/boards/dancheong.webp', slice: '155', base: '#203b2e', edge: '#607668', light: '#ede9d8', shade: '#a7ad93', shadow: '#091c17a6', selection: '#efc57c' },
  'dunhuang': { src: './assets/boards/dunhuang.webp', slice: '125', base: '#bea37c', edge: '#8a7055', light: '#f1e4cd', shade: '#c0a888', shadow: '#50321a66', selection: '#805335' },
  'stained-glass': { src: './assets/boards/stained-glass.webp', slice: '190', base: '#1d2b3d', edge: '#65728a', light: '#e7e4e4', shade: '#a8abb9', shadow: '#081221a6', selection: '#e4c281' },
  'dutch-golden-age': { src: './assets/boards/dutch-golden-age.webp', slice: '130', base: '#621e28', edge: '#947454', light: '#f1e6d1', shade: '#beaa8e', shadow: '#271014a6', selection: '#e8c47d' },
  'neon-shrine': { src: './assets/boards/neon-shrine.webp', slice: '255', base: '#304361', edge: '#787b9a', light: '#eeebf5', shade: '#b4acc7', shadow: '#131b409e', selection: '#9ee9eb' },
  'brass-meridian': { src: './assets/boards/brass-meridian.webp', slice: '270', base: '#294f4e', edge: '#857958', light: '#eeead6', shade: '#b0ad8d', shadow: '#112c2c99', selection: '#e5c781' },
};

export function boardArtStyle(themeId) {
  const art = boardArt[themeId] || boardArt['ming-porcelain'];
  return {
    // Custom-property URLs can resolve relative to the bundled stylesheet.
    '--board-image': `url(${JSON.stringify(new URL(art.src, document.baseURI).href)})`, '--board-slice': art.slice,
    '--board-base': art.base, '--tile-edge': art.edge, '--tile-light': art.light,
    '--tile-shade': art.shade, '--tile-shadow': art.shadow, '--tile-selection': art.selection,
  };
}
