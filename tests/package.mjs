import { tempDir } from './temp.mjs';
import { cp, mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
const repo = process.cwd(),
  reportDir = path.join(repo, 'out/reports/package');
await mkdir(reportDir, { recursive: true });
const report = {
  status: 'failed',
  node: process.version,
  platform: os.platform(),
  arch: os.arch(),
  steps: [],
};
function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const env = { ...process.env };
    delete env.NODE_PATH;
    const child = spawn(command, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', d => (output += d));
    child.stderr.on('data', d => (output += d));
    child.on('error', reject);
    child.on('exit', code => {
      report.steps.push({ command: [command, ...args].join(' '), code, output });
      code === 0 ? resolve(output) : reject(new Error(output));
    });
  });
}
let child;
try {
  await run(process.execPath, ['scripts/package-skill.mjs'], repo);
  const temp = await tempDir('crafted-isolated-');
  await cp(path.join(repo, 'dist/crafted-figures'), temp, { recursive: true });
  report.isolatedOutsideRepository = !temp.startsWith(repo);
  assert.ok(report.isolatedOutsideRepository);
  assert.ok(!(await readdir(temp)).includes('node_modules'));
  report.npmInstallRequired = false;
  // Import the shipped files directly; no npm or ancestor packages are needed.
  const resolved = await run(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      "for (const name of ['./runtime/three.mjs','./runtime/ajv.mjs','./runtime/vite/dist/node/chunks/build.mjs','./runtime/playwright-core/index.mjs']) {await import(name); console.log(import.meta.resolve(name));}",
    ],
    temp,
  );
  assert.ok(!resolved.includes(repo));
  report.independentImports = true;
  const authorDir = await tempDir('crafted-author-');
  await cp(path.join(temp, 'assets/templates/basic-figure'), authorDir, { recursive: true });
  report.authoringOutsidePackage = true;
  await run(
    process.execPath,
    [
      path.join(temp, 'scripts/figures.mjs'),
      'build',
      '--entry',
      'figure.mjs',
      '--config',
      'figure.config.json',
      '--out',
      path.join(temp, 'out/starter'),
    ],
    authorDir,
  );
  await cp(path.join(temp, 'out/starter'), path.join(reportDir, 'starter'), { recursive: true });
  child = spawn(
    process.execPath,
    ['scripts/figures.mjs', 'preview', '--dir', 'out/starter', '--port', '4179'],
    { cwd: temp, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('preview startup timeout')), 10000);
    child.stdout.once('data', () => {
      clearTimeout(timer);
      resolve();
    });
    child.once('exit', code => {
      clearTimeout(timer);
      reject(new Error(`preview exited ${code}`));
    });
  });
  const response = await fetch('http://127.0.0.1:4179/');
  assert.equal(response.status, 200);
  assert.match(await response.text(), /Capacity tray/);
  report.preview = true;
  child.kill();
  child = null;
  await run(
    process.execPath,
    ['scripts/figures.mjs', 'check', '--dir', 'out/starter', '--report', reportDir + '/check'],
    temp,
  );
  const dialAuthor = await tempDir('crafted-author-dial-');
  await cp(path.join(temp, 'assets/templates/dial-indicator'), dialAuthor, { recursive: true });
  await run(
    process.execPath,
    [
      path.join(temp, 'scripts/figures.mjs'),
      'build',
      '--entry',
      'figure.mjs',
      '--state',
      'mid',
      '--output',
      'both',
      '--motion-enabled',
      'false',
      '--out',
      path.join(temp, 'out/dial'),
    ],
    dialAuthor,
  );
  const dialManifest = JSON.parse(
    await readFile(path.join(temp, 'out/dial/build-manifest.json'), 'utf8'),
  );
  assert.equal(dialManifest.rendering.sceneLibrary, 'three');
  assert.equal(dialManifest.dependencies.three, '0.186.1');
  await run(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `import assert from 'node:assert/strict';import {chromium} from './runtime/playwright-core/index.mjs';import {pathToFileURL} from 'node:url';const browser=await chromium.launch();try{const page=await browser.newPage();await page.goto(pathToFileURL(process.cwd()+'/out/dial/figure.html').href);await page.locator('input').waitFor();assert.equal(await page.locator('[data-part=static-readout]').textContent(),'5.00 mm');await page.locator('input').press('End');assert.equal(await page.locator('[data-live-readout]').textContent(),'10.00 mm');assert.equal(await page.evaluate(()=>document.querySelector('article').__stage.scene.isScene),true);await page.locator('input').press('Home');assert.equal(await page.locator('[data-live-readout]').textContent(),'0.00 mm');console.log('Independent Three.js dial: mid export, keyboard and native scene passed');}finally{await browser.close();}`,
    ],
    temp,
  );
  await run(
    process.execPath,
    [
      'scripts/figures.mjs',
      'check',
      '--dir',
      'out/dial',
      '--report',
      reportDir + '/interactive-check',
    ],
    temp,
  );
  report.interactiveThreeTemplate = true;
  await run(
    process.execPath,
    [
      path.join(temp, 'scripts/figures.mjs'),
      'build',
      '--entry',
      'figure.mjs',
      '--output',
      'svg',
      '--out',
      path.join(temp, 'out/svg-only'),
    ],
    authorDir,
  );
  child = spawn(
    process.execPath,
    ['scripts/figures.mjs', 'preview', '--dir', 'out/svg-only', '--port', '4179'],
    { cwd: temp, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('SVG preview startup timeout')), 10000);
    child.stdout.once('data', () => {
      clearTimeout(timer);
      resolve();
    });
    child.once('exit', code => {
      clearTimeout(timer);
      reject(new Error(`SVG preview exited ${code}`));
    });
  });
  const svgResponse = await fetch('http://127.0.0.1:4179/');
  assert.equal(svgResponse.status, 200);
  assert.match(svgResponse.headers.get('content-type'), /image\/svg\+xml/);
  assert.match(await svgResponse.text(), /Capacity tray/);
  report.svgOnlyPreview = true;
  child.kill();
  child = null;
  const files = JSON.parse(await readFile(path.join(temp, 'package-manifest.json'), 'utf8')).files;
  assert.ok(
    !Object.keys(files).some(f =>
      /node_modules|(?:kit|types)\/anatomy|reference\/anatomy|experiments|publish|session-log/.test(
        f,
      ),
    ),
  );
  assert.ok(files['licenses/anatomy-MIT.txt']);
  report.packageInspection = true;
  await run(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      "import {access} from 'node:fs/promises';await access('runtime/vite/dist/node/chunks/rolldown-binding.wasm32-wasi.wasm');console.log('Portable WASM compiler included');",
    ],
    temp,
  );
  report.status = 'passed';
} catch (e) {
  report.error = e.message;
  process.exitCode = 1;
} finally {
  child?.kill();
  await writeFile(path.join(reportDir, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(`${report.status}: ${reportDir}`);
}
