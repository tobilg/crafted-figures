import { tempDir } from './temp.mjs';
import { execFileSync, spawn } from 'node:child_process';
import { mkdir, copyFile, lstat, readFile, writeFile, access, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
const out = 'out/reports/source-package';
await mkdir(out, { recursive: true });
const report = {
  status: 'failed',
  environment: { node: process.version, platform: process.platform, arch: process.arch },
  steps: [],
};
const temp = await tempDir('crafted-source-build-');
async function run(args, expected = 0) {
  const result = await new Promise((resolve, reject) => {
    const p = spawn(process.execPath, args, {
      cwd: temp,
      env: { ...process.env, NODE_PATH: '', NEXT_TELEMETRY_DISABLED: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    p.stdout.on('data', d => (output += d));
    p.stderr.on('data', d => (output += d));
    p.on('error', reject);
    p.on('exit', code => resolve({ code, output }));
  });
  report.steps.push({
    args,
    exitCode: result.code,
    expected,
    output: result.output.replaceAll(temp, '<clean-source>'),
  });
  assert.equal(result.code, expected, result.output);
  return result.output;
}
try {
  assert.ok(process.env.npm_execpath, 'Run this check with npm run test:source-package');
  const names = [
    ...new Set(
      execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
        encoding: 'utf8',
      })
        .split('\0')
        .filter(Boolean),
    ),
  ];
  let count = 0,
    bytes = 0;
  for (const name of names) {
    const s = await lstat(name);
    if (s.isDirectory()) continue;
    assert.ok(s.isFile() && !s.isSymbolicLink(), name);
    await mkdir(path.dirname(path.join(temp, name)), { recursive: true });
    await copyFile(name, path.join(temp, name));
    count++;
    bytes += s.size;
  }
  report.sourceFiles = count;
  report.sourceBytes = bytes;
  for (const name of [
    'node_modules',
    'skill/crafted-figures/runtime',
    'skill/crafted-figures/types',
    'skill/crafted-figures/assets/templates/dial-indicator',
    'skill/crafted-figures/assets/templates/react-next/figures',
    'reference/anatomy',
  ])
    await assert.rejects(access(path.join(temp, name)), /ENOENT/);
  assert.match(
    await run(['skill/crafted-figures/scripts/figures.mjs', 'build'], 1),
    /unbuilt skill source checkout/,
  );
  await run([process.env.npm_execpath, 'ci', '--no-audit', '--no-fund']);
  await run([
    process.env.npm_execpath,
    '--prefix',
    'skill/crafted-figures',
    'ci',
    '--no-audit',
    '--no-fund',
  ]);
  await run(['scripts/package-skill.mjs']);
  const version = JSON.parse(await readFile('skill/crafted-figures/package.json')).version,
    name = `dist/crafted-figures-${version}.zip`;
  const actual = await readFile(path.join(temp, name));
  assert.deepEqual(
    actual,
    await readFile(name),
    'clean-source archive must match working-tree archive',
  );
  report.archiveSHA256 = createHash('sha256').update(actual).digest('hex');
  await run(['tests/release.mjs', 'unit']);
  await run(['tests/parity.mjs'], 2);
  const parity = JSON.parse(await readFile(path.join(temp, 'out/reports/parity/report.json')));
  assert.equal(parity.toolkitVersion, version);
  assert.equal(parity.status, 'pending');
  assert.equal(parity.historicalEvaluationReport.status, 'pending');
  assert.ok(!parity.errors.some(e => e.includes("scandir 'out/")));
  report.cleanReleaseUnit = 'passed';
  report.cleanParity = 'pending-unexecuted-steps-and-explicit-historical-evidence';
  await run([
    'dist/crafted-figures/scripts/figures.mjs',
    'build',
    '--entry',
    'examples/sector-gauge/figure.mjs',
    '--config',
    'examples/sector-gauge/figure.config.json',
    '--output',
    'both',
    '--out',
    'out/smoke',
  ]);
  report.status = 'passed';
} catch (e) {
  report.error = e.stack;
  process.exitCode = 1;
} finally {
  await rm(temp, { recursive: true, force: true });
  report.temporarySourceAndDependenciesRemoved = true;
  await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2) + '\n');
  console.log(report.status, report.error || '');
}
