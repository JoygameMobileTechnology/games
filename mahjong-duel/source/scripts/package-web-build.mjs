import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { themes } from '../src/themes.js';
import { themeTileSets } from '../src/tile-data.js';
import { boardVariants } from '../src/board-variants.js';
import { boardArt } from '../src/board-art.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
let html = await fs.readFile(path.join(dist, 'index.html'), 'utf8');
const script = html.match(/<script\b[^>]*src="([^"]+)"[^>]*><\/script>/);
const stylesheet = html.match(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/);
if (!script || !stylesheet) throw new Error('Expected one Vite JavaScript bundle and stylesheet.');
const resolveAsset = value => path.join(dist, value.replace(/^\.\//, '').replace(/^\//, ''));
let js = await fs.readFile(resolveAsset(script[1]), 'utf8');
let css = await fs.readFile(resolveAsset(stylesheet[1]), 'utf8');
const launchFaces = themes.flatMap(theme => Object.values(themeTileSets[theme.id]).flat());
const launchArtwork = new Set([
  ...launchFaces.map(tile => tile.src),
  ...themes.map(theme => theme.back),
  ...themes.flatMap(theme => [boardArt[theme.id].src, ...Object.values(boardVariants[theme.id]).map(art => art.src)]),
]);
const allTilePaths = [...new Set(js.match(/\.\/assets\/(?:tiles|backs|boards)\/[A-Za-z0-9\/-]+\.webp/g) || [])];
const tilePaths = allTilePaths.filter(source => launchArtwork.has(source));
if (tilePaths.filter(source => source.includes('/tiles/')).length !== launchFaces.length || tilePaths.filter(source => source.includes('/backs/')).length !== themes.length || tilePaths.filter(source => source.includes('/boards/')).length < themes.length) {
  throw new Error(`Expected ${launchFaces.length} launch tile faces, ${themes.length} backs and at least ${themes.length} board images.`);
}
// Keep catalogue metadata and old collection receipts, but do not ship later-theme art.
// Vite copies public/ wholesale, so prune only the generated distribution, never source assets.
for (const source of allTilePaths.filter(source => !launchArtwork.has(source))) js = js.split(source).join('');
await fs.writeFile(resolveAsset(script[1]), js);
const retainedPaths = new Set(tilePaths.map(resolveAsset));
async function pruneArtwork(directory) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await pruneArtwork(filename);
      if (!(await fs.readdir(filename)).length) await fs.rmdir(filename);
    } else if (!retainedPaths.has(filename)) await fs.unlink(filename);
  }
}
for (const directory of ['tiles', 'backs', 'boards']) await pruneArtwork(path.join(dist, 'assets', directory));
for (const source of tilePaths) {
  const data = await fs.readFile(resolveAsset(source));
  js = js.split(source).join(`data:image/webp;base64,${data.toString('base64')}`);
}
const remakePaths = [...new Set(js.match(/\.\/assets\/remake\/[A-Za-z0-9\/-]+\.(?:png|webp)/g) || [])];
for (const source of remakePaths) {
  const data = await fs.readFile(resolveAsset(source));
  const mime = source.endsWith('.png') ? 'image/png' : 'image/webp';
  js = js.split(source).join(`data:${mime};base64,${data.toString('base64')}`);
}
const fonts = [...new Set([...css.matchAll(/url\(([^)]+\.(?:woff2|woff))\)/g)].map(match => match[1]))];
for (const source of fonts) {
  const filename = source.replace(/^['"]|['"]$/g, '');
  const fontPath = path.join(dist, 'assets', path.basename(filename));
  const data = await fs.readFile(fontPath);
  const format = filename.endsWith('.woff2') ? 'woff2' : 'woff';
  css = css.split(`url(${source})`).join(`url(data:font/${format};base64,${data.toString('base64')})`);
}
html = html.replace(script[0], () => `<script type="module">${js.replace(/<\/script/gi, '<\\/script')}</script>`);
html = html.replace(stylesheet[0], () => `<style>${css}</style>`);
html = html.replace(/\s*<link rel="manifest"[^>]*>/, '');
const favicon = await fs.readFile(path.join(dist, 'favicon.svg'), 'utf8');
html = html.replace('./favicon.svg', `data:image/svg+xml,${encodeURIComponent(favicon)}`);
await fs.mkdir(path.join(root, 'output'), { recursive: true });
const destination = path.join(root, 'output/mahjong-duel-web.html');
await fs.writeFile(destination, html);
console.log(`Standalone web build: ${path.relative(root, destination)} (${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MiB, ${tilePaths.length + remakePaths.length} embedded images, ${fonts.length} fonts).`);
