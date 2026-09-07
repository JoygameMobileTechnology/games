/* Builds the single-file SlitherDrop.html: inlines Three.js, the font, CSS and all game scripts. */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

// --- Three.js: turn the ESM build into a classic script exposing window.THREE ---
let three = read('vendor/three.module.min.js');
const exportMatch = three.match(/export\s*\{([^}]*)\}\s*;?\s*$/);
if (!exportMatch) throw new Error('Could not find the export block at the end of three.module.min.js');
const entries = exportMatch[1].split(',').map(s => s.trim()).filter(Boolean).map(s => {
  const parts = s.split(/\s+as\s+/);
  const local = parts[0].trim();
  const exported = (parts[1] || parts[0]).trim();
  return exported + ':' + local;
});
three = three.slice(0, exportMatch.index) + '\nwindow.THREE={' + entries.join(',') + '};';
three = '(function(){"use strict";\n' + three + '\n})();';

// --- Font ---
const fontB64 = fs.readFileSync(path.join(root, 'vendor/baloo2-800.woff2')).toString('base64');
const fontFace = "@font-face{font-family:'Baloo 2';font-style:normal;font-weight:800;font-display:block;" +
  'src:url(data:font/woff2;base64,' + fontB64 + ") format('woff2');}";

let css = read('src/style.css').replace('/*FONT*/', () => fontFace);

// --- Assemble ---
const inject = (html, token, content) => {
  if (!html.includes(token)) throw new Error('Template is missing ' + token);
  return html.replace(token, () => content);
};
let html = read('src/index.html');
html = inject(html, '<!--INJECT:CSS-->', '<style>\n' + css + '\n</style>');
html = inject(html, '<!--INJECT:THREE-->', '<script>\n' + three + '\n</script>');
html = inject(html, '<!--INJECT:CORE-->', '<script>\n' + read('src/core.js') + '\n</script>');
html = inject(html, '<!--INJECT:LEVELS-->', '<script>\n' + read('src/levels.js') + '\n</script>');
html = inject(html, '<!--INJECT:GAME-->', '<script>\n' + read('src/game.js') + '\n</script>');

// Output file name defaults to SlitherDrop.html; pass "index.html" for the games hub layout.
const out = path.join(root, process.argv[2] || 'SlitherDrop.html');
fs.writeFileSync(out, html);
console.log('Wrote ' + out + ' (' + (fs.statSync(out).size / 1024).toFixed(0) + ' KB)');
