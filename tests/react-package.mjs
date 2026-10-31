import { tempDir } from './temp.mjs';
import { cp, mkdir, writeFile, copyFile, access, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const repo = process.cwd(),
  out = path.resolve('out/reports/react-package');
await mkdir(out, { recursive: true });
const report = { status: 'running', environment: { node: process.version }, steps: [], errors: [] };
let server, browser, temp;
const run = (cmd, args, cwd) =>
  new Promise((resolve, reject) => {
    const env = { ...process.env, NEXT_TELEMETRY_DISABLED: '1' };
    delete env.NODE_PATH;
    const p = spawn(cmd, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    p.stdout.on('data', d => (output += d));
    p.stderr.on('data', d => (output += d));
    p.on('error', reject);
    p.on('exit', code => {
      report.steps.push({ command: [cmd, ...args].join(' '), code, output });
      code ? reject(new Error(output)) : resolve(output);
    });
  });
try {
  await run(process.execPath, ['scripts/package-skill.mjs'], repo);
  temp = await tempDir('crafted-next-isolated-');
  await cp('dist/crafted-figures', path.join(temp, 'toolkit'), { recursive: true });
  await cp('dist/crafted-figures/assets/templates/react-next', temp, { recursive: true });
  report.isolatedOutsideRepository = !temp.startsWith(repo);
  assert.ok(report.isolatedOutsideRepository);
  try {
    await access(path.join(temp, 'package-lock.json'));
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
    await run('npm', ['install', '--package-lock-only', '--ignore-scripts'], temp);
    await copyFile(
      path.join(temp, 'package-lock.json'),
      path.join(repo, 'skill/crafted-figures/assets/templates/react-next/package-lock.json'),
    );
    report.createdStarterLock = true;
  }
  await run('npm', ['ci'], temp);
  await run('npm', ['run', 'check:types'], temp);
  await run('npm', ['run', 'build'], temp);
  server = spawn(
    process.execPath,
    ['node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', '4185'],
    {
      cwd: temp,
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  let log = '';
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(log)), 30000);
    server.stderr.on('data', d => (log += d));
    server.stdout.on('data', d => {
      log += d;
      if (String(d).includes('Ready')) {
        clearTimeout(timer);
        resolve();
      }
    });
    server.on('exit', code => {
      clearTimeout(timer);
      reject(new Error(`Next exit ${code}: ${log}`));
    });
  });
  const response = await fetch('http://127.0.0.1:4185'),
    html = await response.text();
  assert.equal(response.status, 200);
  assert.ok(html.includes('7.0 mm compression'));
  assert.ok(html.includes('30.0 separation'));
  browser = await chromium.launch();
  report.environment.browser = browser.version();
  const page = await browser.newPage({
    viewport: { width: 960, height: 900 },
    reducedMotion: 'reduce',
  });
  page.on('pageerror', e => report.errors.push(e.message));
  page.on('console', m => {
    if (m.type() === 'error' || /hydration|unique.*key/i.test(m.text()))
      report.errors.push(m.text());
  });
  await page.goto('http://127.0.0.1:4185');
  await page.locator('[data-ready=true]').nth(2).waitFor();
  await page.locator('[data-instance=probe-a] input').press('End');
  assert.match(
    await page.locator('[data-instance=probe-a] [data-live-readout]').textContent(),
    /28.0 N/,
  );
  assert.match(
    await page.locator('[data-instance=probe-b] [data-live-readout]').textContent(),
    /14.0 N/,
  );
  const ids = await page.locator('[id]').evaluateAll(es => es.map(e => e.id));
  assert.equal(new Set(ids).size, ids.length);
  await page.locator('[data-instance=probe-a]').screenshot({ path: path.join(out, 'probe.png') });
  await page.locator('[data-instance=drops-a]').screenshot({ path: path.join(out, 'drops.png') });
  await page.getByRole('link', { name: 'Navigate away' }).click();
  await page.getByRole('heading', { name: 'Unmounted' }).waitFor();
  await page.getByRole('link', { name: 'Return', exact: true }).click();
  await page.locator('[data-ready=true]').nth(2).waitFor();
  assert.deepEqual(report.errors, []);
  report.status = 'passed';
  report.independentFrameworkAndTypes = true;
} catch (e) {
  report.status = 'failed';
  report.errors.push(e.stack);
  process.exitCode = 1;
} finally {
  await browser?.close();
  server?.kill();
  if (temp) {
    report.workspace = temp;
    await rm(path.join(temp, 'node_modules'), { recursive: true, force: true });
    await rm(path.join(temp, '.next'), { recursive: true, force: true });
    report.reproducibleCachesRemoved = true;
  }
  await writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(report.status, report.errors);
}
