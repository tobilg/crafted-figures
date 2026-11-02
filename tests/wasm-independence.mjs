import { runReport } from './report.mjs';
import { tempDir } from './temp.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
// The portable bundler's WASM file system cannot express Windows paths. Standalone builds must
// therefore never need it to read source files. This blinds it on any platform: every path it
// can see maps to an empty directory, which is what makes a plain Vite build fail on Windows.
const out = path.resolve('out/reports/wasm-independence');
await mkdir(out, { recursive: true });
const temp = await tempDir('crafted-wasm-'),
  report = {
    status: 'failed',
    environment: { node: process.version, platform: process.platform },
    cases: [],
    errors: [],
  };
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
await runReport(
  out,
  report,
  async () => {
    const skill = path.join(temp, 'skill'),
      empty = path.join(temp, 'empty'),
      chunks = path.join(skill, 'runtime/vite/dist/node/chunks');
    await mkdir(empty);
    await cp('dist/crafted-figures', skill, { recursive: true });
    const blind = JSON.stringify(empty),
      binding = path.join(chunks, 'binding.cjs'),
      worker = path.join(chunks, 'wasi-worker.mjs'),
      bindingBefore = await readFile(binding, 'utf8'),
      workerBefore = await readFile(worker, 'utf8'),
      bindingAfter = bindingBefore.replace(
        /var __hostRoot = [^;\n]*;/,
        `var __hostRoot = ${blind};`,
      ),
      workerAfter = workerBefore.replace(
        /const __hostRoot =[\s\S]*?__rootDir\)?;?\n/,
        `const __hostRoot = ${blind};\n`,
      );
    assert.notEqual(bindingAfter, bindingBefore, 'the binding root moved; update this test');
    assert.notEqual(workerAfter, workerBefore, 'the worker root moved; update this test');
    await writeFile(binding, bindingAfter);
    await writeFile(worker, workerAfter);
    const manifestFile = path.join(skill, 'runtime/manifest.json'),
      manifest = JSON.parse(await readFile(manifestFile, 'utf8'));
    for (const file of [binding, worker])
      manifest.files[path.relative(path.join(skill, 'runtime'), file).split(path.sep).join('/')] =
        digest(await readFile(file));
    await writeFile(manifestFile, JSON.stringify(manifest, null, 2));
    // Control: an ordinary Vite build really cannot see the source now.
    const author = path.join(temp, 'author with spaces');
    await cp('examples/dial-indicator', path.join(author, 'dial'), { recursive: true });
    await cp('examples/ripple-tank', path.join(author, 'tank'), { recursive: true });
    const control = path.join(temp, 'control.mjs');
    await writeFile(
      control,
      `import { build } from ${JSON.stringify(pathToFileURL(path.join(chunks, 'build.mjs')).href)};
  await build({ root: ${JSON.stringify(path.join(author, 'dial'))}, configFile: false, envDir: false, publicDir: false, logLevel: 'silent',
    build: { write: false, lib: { entry: ${JSON.stringify(path.join(author, 'dial/model.mjs'))}, name: 'x', formats: ['iife'] }, rolldownOptions: { output: { codeSplitting: false } } } });`,
    );
    const failed = spawnSync(process.execPath, [control], { encoding: 'utf8' });
    assert.notEqual(
      failed.status,
      0,
      'the blinded file system still served source to a plain build',
    );
    assert.match(failed.stderr + failed.stdout, /UNRESOLVED_ENTRY|Cannot resolve/);
    report.cases.push({ name: 'plain Vite build fails when blinded', status: 'passed' });
    for (const name of ['dial', 'tank']) {
      const cwd = path.join(author, name),
        built = spawnSync(
          process.execPath,
          [
            path.join(skill, 'scripts/figures.mjs'),
            'build',
            '--entry',
            'figure.mjs',
            '--config',
            'figure.config.json',
            '--output',
            'both',
            '--out',
            'out',
          ],
          { cwd, encoding: 'utf8' },
        );
      assert.equal(built.status, 0, built.stderr);
      assert.doesNotMatch(built.stderr, /ExperimentalWarning/, 'commands stay quiet');
      const html = await readFile(path.join(cwd, 'out/figure.html'), 'utf8');
      assert.match(html, /data-figure=/);
      report.cases.push({
        name: `${name} builds with no WASM source access`,
        status: 'passed',
        bytes: html.length,
      });
    }
  },
  {
    cleanup: async () => {
      await rm(temp, { recursive: true, force: true });
    },
  },
);
