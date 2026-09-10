import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

for (const base of ["/", "/games/phobos-arena/"]) test(`real ${base} production build hashes final HTML, CSS, JavaScript and copied assets into its offline pack`, async () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const outDir = await mkdtemp(join(tmpdir(), "phobos-offline-build-"));
  try {
    await build({ root, base, configFile: join(root, "vite.config.ts"), logLevel: "silent",
      build: { outDir, emptyOutDir: true } });
    const source = await readFile(join(outDir, "sw.js"), "utf8");
    const manifestLine = source.match(/^const FILES = (.+);$/m);
    assert.ok(manifestLine, "generated worker includes a manifest");
    const manifest = JSON.parse(manifestLine[1]) as Record<string, string>;
    for (const path of [base, `${base}index.html`, `${base}mark.svg`])
      assert.match(manifest[path], /^[a-f0-9]{64}$/, `${path} has a real digest`);
    assert.equal(manifest[base], manifest[`${base}index.html`]);
    const emitted = ["index.html", "mark.svg", ...(await readdir(join(outDir, "assets"))).map(file => `assets/${file}`)];
    assert.ok(emitted.some(file => file.endsWith(".css")), "test includes Vite's final CSS");
    assert.ok(emitted.some(file => file.endsWith(".js")));
    assert.ok(emitted.some(file => file.endsWith(".png")));
    assert.deepEqual(Object.keys(manifest).sort(), [base, ...emitted.map(file => `${base}${file}`)].sort(),
      "every emitted runtime file is covered, including files added by later Vite hooks");
    for (const [path, expected] of Object.entries(manifest)) {
      const actual = createHash("sha256").update(await readFile(join(outDir, path === base ? "index.html" : path.slice(base.length)))).digest("hex");
      assert.equal(expected, actual, `${path} digest matches the exact bytes that will be served`);
    }
  } finally { await rm(outDir, { recursive: true, force: true }); }
});
