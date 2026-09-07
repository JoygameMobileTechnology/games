import { build } from 'esbuild';
import { readFile, writeFile, rename, rm, mkdir } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const defaultOutput = resolve(sourceRoot, '../index.html');

// Browser and LAN builds share the same game engine. The standalone flag only
// replaces transport and connection UI; the Node server remains independently usable.
export async function buildPages(outputPath = defaultOutput) {
  const output = resolve(outputPath);
  const [template, css, bundle] = await Promise.all([
    readFile(join(sourceRoot, 'public/index.html'), 'utf8'),
    readFile(join(sourceRoot, 'public/style.css'), 'utf8'),
    build({
      absWorkingDir: sourceRoot,
      entryPoints: ['public/app.js'],
      bundle: true,
      write: false,
      platform: 'browser',
      format: 'esm',
      target: ['safari15.4', 'chrome100'],
      define: { __CW_STANDALONE__: 'true' },
      minifySyntax: true,
      legalComments: 'inline',
      metafile: true,
      plugins: [{
        name: 'lan-shared-imports',
        setup(builder) {
          builder.onResolve({ filter: /^\/shared\// }, args => ({
            path: join(sourceRoot, args.path.slice(1)),
          }));
        },
      }],
    }),
  ]);

  const imports = Object.values(bundle.metafile.outputs).flatMap(file => file.imports);
  if (bundle.outputFiles.length !== 1 || imports.length) {
    throw new Error('The Pages edition must contain one script with no external imports.');
  }
  const inlineScript = bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  const inlineStyle = css.replace(/<\/style/gi, '<\\/style');
  const styleMarker = '<link rel="stylesheet" href="/style.css">';
  const scriptMarker = '<script type="module" src="/app.js"></script>';
  if (!template.includes(styleMarker) || !template.includes(scriptMarker)) {
    throw new Error('The HTML entry points changed; update the Pages build markers.');
  }
  const html = template
    .replace(styleMarker, () => `<style>\n${inlineStyle}\n</style>`)
    .replace(scriptMarker, () => `<script type="module">\n${inlineScript}\n</script>`)
    .replace('href="/" aria-label="Castle Wars home"', 'href="./" aria-label="Castle Wars home"')
    .replace(/<meta name="description" content="[^"]*">/, '<meta name="description" content="Little castles. Ridiculous firepower. A browser-only solo skirmish against the AI.">');

  // Never leave a partially written playable file if bundling or writing fails.
  await mkdir(dirname(output), { recursive: true });
  const temporary = `${output}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, html, { flag: 'wx' });
    await rename(temporary, output);
  } finally {
    await rm(temporary, { force: true });
  }
  return { output, bytes: Buffer.byteLength(html) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length > 3) throw new Error('Usage: node scripts/build-pages.mjs [output.html]');
    const result = await buildPages(process.argv[2]);
    console.log(`Built ${result.output} (${Math.round(result.bytes / 1024)} KiB, self-contained)`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
