import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildPages } from '../scripts/build-pages.mjs';

test('Pages build is a complete standalone document under any hosting prefix', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'castle-wars-pages-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const output = join(directory, 'games', 'castle-wars', 'index.html');
  const result = await buildPages(output);
  const html = await readFile(output, 'utf8');
  assert.equal(result.output, output);
  assert.equal(result.bytes, Buffer.byteLength(html));
  assert.deepEqual(await readdir(join(directory, 'games', 'castle-wars')), ['index.html']);
  assert.match(html, /<!doctype html>/i);
  assert.match(html, /<meta name="viewport"/);
  assert.match(html, /<style>[\s\S]+<\/style>/);
  assert.equal([...html.matchAll(/<script\b/gi)].length, 1);
  assert.match(html, /<script type="module">[\s\S]+<\/script>/);
  assert.doesNotMatch(html, /<script\b[^>]*\bsrc\s*=/i);
  assert.doesNotMatch(html, /<link\b[^>]*\brel="stylesheet"/i);
  assert.doesNotMatch(html, /<img\b[^>]*\bsrc="(?!data:)[^"]+"/i);
  assert.match(html, /href="\.\/" aria-label="Castle Wars home"/);
  assert.match(html, /browser-only solo skirmish/);
  assert.doesNotMatch(html, /__CW_STANDALONE__/);
  assert.match(html, /class SoloSocket|SoloSocket = class/);

  const script = html.match(/<script type="module">([\s\S]*?)<\/script>/i)[1];
  assert.doesNotMatch(script, /\bimport\s*(?:\(|["'{*])/);
  const style = html.match(/<style>([\s\S]*?)<\/style>/i)[1];
  assert.doesNotMatch(style, /@import\b|url\(\s*["']?(?!data:)/i);
});

test('build command accepts an explicit output and leaves only that file', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'castle-wars-pages-cli-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const output = join(directory, 'preview.html');
  const command = spawnSync(process.execPath, [resolve('scripts/build-pages.mjs'), output], {
    cwd: resolve('.'), encoding: 'utf8',
  });
  assert.equal(command.status, 0, command.stderr);
  assert.match(command.stdout, /self-contained/);
  assert.deepEqual(await readdir(directory), ['preview.html']);
  assert.match(await readFile(output, 'utf8'), /id="play-ai"/);
});
