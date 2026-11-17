const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'levels/catalog.json'), 'utf8'));
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const packed = JSON.parse(html.match(/<script id="level-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
const chrome = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const url = pathToFileURL(path.join(root, 'index.html')).href;

function validateCatalog() {
  assert.equal(catalog.levels.length, 150);
  assert.deepEqual(packed.palette, catalog.palette);
  assert.deepEqual(packed.progression, catalog.progression);
  let total = 0;
  for (let i = 0; i < 150; i++) {
    const l = catalog.levels[i], p = packed.levels[i];
    const decoded = [...Buffer.from(p.cells, 'base64')].map(c => c - 1);
    const { cells, count, ...meta } = p;
    assert.deepEqual({ ...meta, cells: decoded }, l, `level ${i + 1}: all fields round-trip`);
    assert.equal(decoded.length, l.gridSize.x * l.gridSize.y * l.gridSize.z);
    const colors = Array(22).fill(0), packets = colors.slice();
    for (const c of decoded) if (c >= 0) colors[c]++;
    for (const col of l.columns) for (const p of col) packets[p.color] += p.count;
    assert.deepEqual(packets, colors, `level ${i + 1}: counts by color`);
    assert.equal(count, colors.reduce((a, b) => a + b, 0)); total += count;
  }
  assert.equal(total, 103830);
  assert.equal(Math.max(...packed.levels.map(l => l.count)), 2008);
  console.log('PASS all 150 complete records, 22 colors, 103830 cells, queues and metadata round-trip');
}

async function main() {
  validateCatalog();
  const browser = await chromium.launch({ headless: true, ...(fs.existsSync(chrome) ? { executablePath: chrome } : {}) });
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('pageerror', e => errors.push(e.message));
    await page.context().setOffline(true);
    await page.goto(url);
    await page.waitForFunction(() => window.cubeBuddies?.getState().frame > 2);
    await page.evaluate(() => cubeBuddies.hold(true));
    const loaded = await page.evaluate(() => {
      const result = [];
      for (let i = 0; i < 150; i++) {
        document.getElementById('levelPicker').click();
        document.getElementById('levelChoice').value = i;
        document.getElementById('modalPrimary').click();
        const s = cubeBuddies.getState();
        result.push({ level: s.level, total: s.total, capacity: s.capacity, queue: s.queue, grid: s.grid });
      }
      return result;
    });
    loaded.forEach((l, i) => {
      assert.equal(l.level, i); assert.equal(l.total, packed.levels[i].count);
      assert(l.capacity >= l.total, 'instance buffer contains every cube');
      assert.deepEqual(l.grid, catalog.levels[i].gridSize);
      assert.deepEqual(l.queue, catalog.levels[i].columns.map(col => col.map(p => ({ color: p.color + 5, count: p.count }))));
    });
    console.log('PASS all 150 levels load through the picker with exact geometry counts and queue order');

    for (const [width, height] of [[320, 640], [390, 844], [768, 1024], [1440, 900]]) {
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(100);
      const b = await page.evaluate(() => {
        const t = document.getElementById('tray').getBoundingClientRect();
        return { left: t.left, right: t.right, bottom: t.bottom, scroll: document.documentElement.scrollWidth, columns: document.querySelectorAll('.col').length };
      });
      assert.equal(b.columns, 4); assert.equal(b.scroll, width);
      assert(b.left >= 0 && b.right <= width && b.bottom <= height, `four columns fit ${width}px`);
    }
    console.log('PASS four-column queues fit 320/390/768/1440px offline');

    // Different shapes, grid heights, color counts, column counts and maximum instance capacity.
    for (const id of process.env.ALL_LEVELS === '1' ? catalog.levels.map(l => l.id) : [1, 2, 3, 11, 70, 91, 111, 150]) {
      await page.evaluate(id => {
        document.getElementById('levelPicker').click(); document.getElementById('levelChoice').value = id - 1; document.getElementById('modalPrimary').click();
        if (!cubeBuddies.getState().auto) document.getElementById('auto').click();
      }, id);
      let state;
      for (let batch = 0; batch < 600; batch++) {
        state = await page.evaluate(() => { cubeBuddies.advance(8); return cubeBuddies.getState(); });
        assert.equal(state.remaining + state.carried + state.collected, state.total, `level ${id}: cube conservation`);
        const owed = state.queue.flat().reduce((n, p) => n + p.count, 0) + state.slots.reduce((n, s) => n + (s?.remaining || 0), 0);
        assert.equal(owed, state.total - state.collected, `level ${id}: packet conservation`);
        assert(!state.moves.coveredTake, `level ${id}: never take covered cubes`);
        if (state.won) break;
      }
      assert(state.won, `level ${id} must finish: ${state.collected}/${state.total}`);
      console.log(`PASS level ${id}: ${state.collected}/${state.total} delivered`);
    }
    await page.evaluate(() => cubeBuddies.advance(3));
    await page.locator('#modalPrimary').click();
    assert.equal(await page.evaluate(() => cubeBuddies.getState().level), 29, 'last level begins the repeat sequence at 30');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
