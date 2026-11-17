const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const chrome = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cube-trails-'));
  // Test-only hook: compare actual framebuffer pixels in one JS call, so camera/UI
  // animation between screenshots cannot masquerade as a visible trail.
  const probe = `window.cubeBuddies = {
    trailContrast() {
      const gl = renderer.getContext(), size = gl.drawingBufferWidth * gl.drawingBufferHeight * 4;
      const off = new Uint8Array(size), on = new Uint8Array(size);
      for (const enabled of [false, true]) {
        for (const w of workers) if (w.trail) w.trail.material.uniforms.opacity.value = enabled ? TRAIL_OPACITY : 0;
        renderer.render(scene, camera); gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, enabled ? on : off);
      }
      let strong = 0, peak = 0;
      for (let i=0; i<size; i+=4) { const delta=Math.max(Math.abs(on[i]-off[i]),Math.abs(on[i+1]-off[i+1]),Math.abs(on[i+2]-off[i+2])); if(delta>8)strong++;peak=Math.max(peak,delta); }
      return { strong, peak };
    },`;
  let html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  assert(html.includes('window.cubeBuddies = {') && html.includes('try { init(); } catch'));
  html = html.replace('window.cubeBuddies = {', probe).replace('try { init(); } catch', 'try { init(); hold = true; } catch');
  const file = path.join(dir, 'index.html'); fs.writeFileSync(file, html);
  const browser = await chromium.launch({ headless: true, ...(fs.existsSync(chrome) ? { executablePath: chrome } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
    const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(pathToFileURL(file).href);
    await page.waitForFunction(() => window.cubeBuddies?.getState().frame > 2);
    await page.evaluate(() => { document.getElementById('auto').click(); cubeBuddies.advance(12, 1/60); });
    await page.waitForTimeout(500);
    const contrast = await page.evaluate(() => cubeBuddies.trailContrast());
    assert(contrast.strong >= 100 && contrast.peak >= 15, `trails must visibly affect the actual render: ${JSON.stringify(contrast)}`);
    const trails = await page.evaluate(() => cubeBuddies.getTrails());
    assert(trails.trails.some(t => t.visible), 'moving workers leave trails');
    // Upright on screen: each rung runs along the camera's up axis (a world-vertical sheet goes edge-on when a worker
    // runs towards the camera), points upwards, and is no taller than the torso.
    const [ux, uy, uz] = trails.up;
    assert(uy > .5, 'camera up axis points mostly upwards');
    for (const t of trails.trails.filter(t => t.visible)) for (let i=0; i<t.positions.length; i+=6) {
      const p=t.positions, dx=p[i+3]-p[i], dy=p[i+4]-p[i+1], dz=p[i+5]-p[i+2], len=Math.hypot(dx, dy, dz);
      assert(len > 0 && Math.abs((dx*ux+dy*uy+dz*uz)/len - 1) < 1e-4, 'ribbon stays upright on screen');
      assert(len <= .5 + 1e-6, 'ribbon stays torso-height');
    }
    await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(200);
    const mobile = await page.evaluate(() => cubeBuddies.trailContrast());
    assert(mobile.strong >= 20 && mobile.peak >= 15, `trails remain readable on mobile: ${JSON.stringify(mobile)}`);
    await page.locator('#restart').click(); await page.locator('#modalPrimary').click();
    assert((await page.evaluate(() => cubeBuddies.getTrails().trails)).every(t => !t.visible && t.points === 0), 'restart clears old trails');
    const reduced = await browser.newPage({ reducedMotion: 'reduce' });
    await reduced.goto(pathToFileURL(file).href); await reduced.waitForFunction(() => window.cubeBuddies);
    assert.equal((await reduced.evaluate(() => cubeBuddies.getTrails())).trails.length, 0);
    assert.deepEqual(errors, []);
    console.log(`PASS visible rendered trails (${contrast.strong} contrasting pixels, peak ${contrast.peak}), mobile ${mobile.strong} pixels, screen-upright torso height, reset and reduced motion`);
  } finally { await browser.close(); fs.rmSync(dir, { recursive: true, force: true }); }
})().catch(e => { console.error(e); process.exitCode = 1; });
