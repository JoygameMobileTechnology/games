const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const assert = require('node:assert/strict');
const chrome = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const url = pathToFileURL(path.resolve(__dirname, '../index.html')).href;

(async () => {
  const browser = await chromium.launch({ headless: true, ...(fs.existsSync(chrome) ? { executablePath: chrome } : {}) });
  try {
    const page = await browser.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    for (const level of [1, 3, 11, 70]) {
      await page.goto(`${url}?level=${level}`);
      await page.waitForFunction(() => window.cubeBuddies?.getState().frame > 2);
      const result = await page.evaluate(() => {
        cubeBuddies.hold(true); document.getElementById('auto').click();
        const apron = cubeBuddies.getReturnApron();
        let airborne = 0, ground = 0, buffered = 0, shortcuts = 0, physicsSamples = 0; const violations = [], history = new Map();
        for (let i = 0; i < 1500; i++) {
          cubeBuddies.advance(1 / 30, 1 / 30);
          const s = cubeBuddies.getState(), voxels = cubeBuddies.getVoxels(), solid = new Set(voxels.map(b => b.join(','))), low = voxels.filter(b => b[1] <= 1);
          for (const w of s.workers) {
            if (!w.airborneReturn) history.delete(w.id);
            if (w.carry && w.state === 'toCrate' && w.returnGround && w.cell.y !== 0) violations.push('carrier climbed after landing');
            if (w.carry && w.returnGround && w.state === 'toCrate') ground++;
            if (w.carry && w.returnGround && !w.groundEscape && ['returnRun', 'returnTurn', 'sideLand', 'truckLand'].includes(w.act)) {
              buffered++;
              const r = (w.position[0] * apron.rx + w.position[2] * apron.rz - apron.center) / apron.width;
              const f = (w.position[0] * apron.fx + w.position[2] * apron.fz - apron.base) / apron.depth;
              if (f > .001 && r*r + f*f < .999) violations.push('returner enters the reserved front apron');
              for (const [x, , z] of low) if (Math.max(Math.abs(w.position[0] - x), Math.abs(w.position[2] - z)) < 1.219)
                violations.push(`ground return cuts cube buffer: worker ${w.id} by ${x},${z}`);
            }
            if (w.airborneReturn) {
              airborne++;
              if (w.act === 'truckShortcut') shortcuts++;
              const [x, y, z] = w.position;
              for (const h of [.15, .7, 1.3]) if (solid.has(`${Math.round(x)},${Math.floor(y + h)},${Math.round(z)}`)) violations.push(`jump intersects voxel at ${x},${y},${z}`);
              const prior = history.get(w.id) || [];
              if (prior.length === 2) {
                const [a, b] = prior, dt = 1 / 30;
                const ax = (x - 2 * b[0] + a[0]) / (dt * dt), ay = (y - 2 * b[1] + a[1]) / (dt * dt), az = (z - 2 * b[2] + a[2]) / (dt * dt);
                // Positions are rounded to 0.001 in diagnostics; tolerate that quantization only.
                if (Math.abs(ax) > 4 || Math.abs(az) > 4 || Math.abs(ay + 30) > 4) violations.push('non-ballistic return trajectory');
                if (Math.hypot(x - b[0], z - b[2]) / dt > 6.3) violations.push('horizontal launch speed exceeded');
                physicsSamples++;
              }
              history.set(w.id, [...prior, w.position].slice(-2));
            }
          }
          if (s.won) break;
        }
        if (JSON.stringify(apron) !== JSON.stringify(cubeBuddies.getReturnApron())) violations.push('front apron shrank as cubes disappeared');
        return { airborne, ground, buffered, shortcuts, physicsSamples, violations: violations.slice(0, 5), moves: cubeBuddies.getState().moves };
      });
      assert.deepEqual(result.violations, [], `level ${level}: collision-free side exits and ground-only returns`);
      assert(result.airborne > 0 && result.ground > 0, 'both descent and ground return are observed');
      assert(result.buffered > 100, 'buffer checked throughout actual return runs and landings');
      assert(result.physicsSamples > 20, 'enough consecutive frames checked against constant gravity and horizontal velocity');
      assert(result.moves.sideExitLeft > 0 && result.moves.sideExitRight > 0, 'both sides are used');
      assert(result.moves.sideLand > 0 && result.moves.returnTurn > 0, 'landing and turn happen before the run back');
      if (level === 1) assert(result.shortcuts > 0 && result.moves.truckLand > 0, 'nearby carriers use direct truck shortcuts');
      console.log(`PASS level ${level}: left/right jumps, clear arcs, grounded landing, turn and ground return`);
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
