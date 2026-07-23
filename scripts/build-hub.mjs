import { cpSync, mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const OUT = join(ROOT, '_site');
const EXCLUDE = new Set(['.git', '.github', 'scripts', 'node_modules', '_site']);

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const games = [];
for (const entry of readdirSync(ROOT, { withFileTypes: true })) {
  if (!entry.isDirectory() || EXCLUDE.has(entry.name)) continue;
  const dir = join(ROOT, entry.name);
  if (!existsSync(join(dir, 'index.html'))) continue;

  let title = entry.name;
  let description = '';
  const metaPath = join(dir, 'game.json');
  if (existsSync(metaPath)) {
    try {
      const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
      if (meta.title) title = meta.title;
      if (meta.description) description = meta.description;
    } catch {
      console.warn(`WARN: ${entry.name}/game.json is not valid JSON, falling back to <title>`);
    }
  }
  if (title === entry.name) {
    const m = readFileSync(join(dir, 'index.html'), 'utf8').match(/<title>(.*?)<\/title>/i);
    if (m) title = m[1].trim();
  }

  cpSync(dir, join(OUT, entry.name), { recursive: true });
  games.push({ slug: entry.name, title, description });
}

games.sort((a, b) => a.slug.localeCompare(b.slug, 'tr'));

const esc = s => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const cards = games.map(g => `    <a class="card" href="${esc(g.slug)}/">
      <b>${esc(g.title)}</b>
      ${g.description ? `<p>${esc(g.description)}</p>` : ''}
    </a>`).join('\n');

writeFileSync(join(OUT, 'index.html'), `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Game Experiments</title>
<style>
  :root {
    --bg: #EDF0F6;
    --chip: #FFFFFF;
    --ink: #1D2740;
    --muted: #65718C;
    --gold: #EFAD12;
    --shadow: 0 1px 3px rgba(29, 39, 64, .12);
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #0F1522;
      --chip: #1B2536;
      --ink: #EDF2FA;
      --muted: #8B99B5;
      --gold: #F7BE2A;
      --shadow: 0 1px 3px rgba(0, 0, 0, .35);
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100vh;
    background: var(--bg);
    color: var(--ink);
    font-family: "Avenir Next", "Segoe UI Variable Display", system-ui, -apple-system, "Segoe UI", sans-serif;
    display: flex;
    justify-content: center;
  }
  .wrap {
    width: min(92vw, 560px);
    padding: clamp(28px, 8vh, 72px) 0 48px;
  }
  h1 {
    margin: 0;
    font-size: clamp(30px, 7vw, 40px);
    font-weight: 900;
    letter-spacing: -.02em;
  }
  h1 span { color: var(--gold); }
  .sub {
    color: var(--muted);
    font-size: 14.5px;
    margin: 8px 0 28px;
    line-height: 1.5;
  }
  .games { display: flex; flex-direction: column; gap: 10px; }
  .card {
    display: block;
    background: var(--chip);
    border-radius: 12px;
    box-shadow: var(--shadow);
    padding: 16px 18px;
    text-decoration: none;
    color: var(--ink);
    transition: transform .12s ease;
  }
  .card:hover { transform: translateY(-2px); }
  .card b { font-size: 17px; font-weight: 800; }
  .card p {
    margin: 5px 0 0;
    color: var(--muted);
    font-size: 13.5px;
    line-height: 1.5;
  }
</style>
</head>
<body>
<div class="wrap">
  <h1>Game <span>Experiments</span></h1>
  <p class="sub">Tek dosyalık HTML oyun prototipleri. Her klasör bağımsız bir deneme.</p>
  <div class="games">
${cards}
  </div>
</div>
</body>
</html>
`);

console.log(`Built hub with ${games.length} game(s): ${games.map(g => g.slug).join(', ') || '(none)'}`);
