import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { runtimeIdentity } from '../skill/crafted-figures/kit/provenance.mjs';
export const hash = b => createHash('sha256').update(b).digest('hex');
const evidence = (name, key, min) => ({ file: `out/reports/${name}/report.json`, key, min });
// Use the same discovery rule as npm test, including future regression files.
const unitFiles = (await readdir('tests'))
  .filter(name => name.endsWith('.test.mjs'))
  .sort()
  .map(name => 'tests/' + name);
export const releaseSteps = [
  {
    id: 'unit',
    commands: [
      ['--test', ...unitFiles],
      ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.consumer.json'],
    ],
    reports: [],
  },
  {
    id: 'audit',
    commands: [
      ['tests/audit-faults.mjs'],
      ['tests/audit-envelopes.mjs'],
      ['tests/construction.mjs'],
    ],
    reports: [
      evidence('audit-faults', 'checks', 8),
      evidence('audit-envelopes', 'cases', 87),
      evidence('construction', 'cases', 27),
    ],
  },
  {
    id: 'browser',
    commands: [['tests/browser.mjs']],
    reports: [evidence('browser', 'checks', 14)],
  },
  {
    id: 'interaction',
    commands: [['tests/interaction-browser.mjs']],
    reports: [evidence('interaction', 'cases', 15)],
  },
  {
    id: 'wasm',
    commands: [['tests/wasm-independence.mjs']],
    reports: [evidence('wasm-independence', 'cases', 3)],
  },
  {
    id: 'owned',
    commands: [['tests/owned-renderer-browser.mjs']],
    reports: [evidence('owned-renderer', 'cases', 9)],
  },
  {
    id: 'migration',
    commands: [['tests/migration-browser.mjs']],
    reports: [evidence('migration-browser', 'checks', 24)],
  },
  {
    id: 'fidelity',
    commands: [['tests/fidelity-browser.mjs']],
    reports: [evidence('fidelity', 'cases', 14)],
  },
  {
    id: 'materials',
    commands: [['tests/materials.mjs']],
    reports: [evidence('materials', 'cases', 24)],
  },
  {
    id: 'effects',
    commands: [
      ['tests/effect-registration.mjs'],
      ['tests/volume-depth.mjs'],
      ['tests/effects.mjs'],
      ['tests/optics.mjs'],
    ],
    reports: [
      evidence('effect-registration', 'cases', 8),
      evidence('volume-depth', 'cases', 4),
      evidence('production-effects', 'cases', 126),
      evidence('optics', 'cases', 6),
    ],
  },
  {
    id: 'changing',
    commands: [['tests/changing-browser.mjs'], ['tests/spring-browser.mjs']],
    reports: [
      evidence('changing-geometry', 'cases', 30),
      evidence('spring-refinement', 'cases', 24),
    ],
  },
  {
    id: 'diagnostics',
    commands: [['tests/drive-suite.mjs'], ['tests/diagnostics-browser.mjs']],
    reports: [
      evidence('drive', 'results', 3),
      evidence('drive/terminal-cabinet', 'actions', 8),
      evidence('diagnostic-faults', 'checks', 5),
    ],
  },
  {
    id: 'gaps',
    commands: [['tests/gap-browser.mjs'], ['tests/static-print.mjs']],
    reports: [evidence('gap-closure', 'cases', 34), evidence('static-print', 'cases', 8)],
  },
  {
    id: 'framework',
    commands: [
      ['node_modules/next/dist/bin/next', 'build', 'tests/fixtures/next', '--webpack'],
      ['tests/react.mjs'],
      ['tests/react.mjs', '--dev'],
    ],
    reports: [evidence('react', 'checks', 5), evidence('react-dev', 'checks', 5)],
  },
  {
    id: 'print',
    commands: [['tests/print.mjs'], ['tests/render-pdfs.mjs']],
    reports: [evidence('print-suite', 'cases', 24)],
  },
  {
    id: 'print-references',
    commands: [['tests/print-references.mjs']],
    reports: [evidence('print-references', 'cases', 10)],
  },
  {
    id: 'capacity',
    commands: [
      ['tests/capacity.mjs'],
      ['tests/next-capacity-build.mjs'],
      ['tests/react.mjs', '--capacity'],
    ],
    reports: [evidence('capacity', 'workloads', 3), evidence('capacity-mixed', 'checks', 12)],
  },
  {
    id: 'compat',
    commands: [['tests/compat.mjs']],
    reports: [
      evidence('compat', 'steps', 5),
      evidence('package', 'steps', 9),
      evidence('react-package', 'steps', 4),
      evidence('sharing', 'cases', 2),
    ],
  },
  {
    id: 'distribution',
    commands: [['tests/distribution.mjs']],
    reports: [evidence('distribution', 'checks', 4)],
  },
  {
    id: 'source-package',
    commands: [['tests/source-package.mjs']],
    reports: [evidence('source-package', 'steps', 7)],
  },
  {
    id: 'bundled',
    commands: [['tests/bundled-runtime.mjs']],
    reports: [evidence('bundled-runtime', 'cases', 6)],
  },
  {
    id: 'gap-followups',
    commands: [['tests/gap-followups.mjs']],
    reports: [evidence('gap-followups', 'cases', 6)],
  },
  {
    id: 'source-migration',
    commands: [['tests/source-migration.mjs']],
    reports: [evidence('source-migration-current', 'cases', 2)],
  },
];
/** Inputs actually used by this checkout's tests. No machine paths or dates. */
export async function releaseIdentity() {
  const files = {};
  async function walk(dir) {
    for (const e of (await readdir(dir, { withFileTypes: true })).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      if (['node_modules', '.next'].includes(e.name) || e.name.endsWith('.tsbuildinfo')) continue;
      const p = dir + '/' + e.name;
      if (e.isDirectory()) await walk(p);
      else if (/\.(mjs|js|jsx|json|mts|ts)$/.test(p)) files[p] = hash(await readFile(p));
    }
  }
  for (const p of ['tests', 'examples', 'scripts']) await walk(p);
  for (const p of [
    'package.json',
    'package-lock.json',
    'tsconfig.consumer.json',
    'evals/historical-manifest.json',
  ])
    files[p] = hash(await readFile(p));
  const manifestBytes = await readFile('dist/crafted-figures/package-manifest.json'),
    manifest = JSON.parse(manifestBytes);
  for (const [file, digest] of Object.entries(manifest.files)) {
    assert.equal(
      hash(await readFile('dist/crafted-figures/' + file)),
      digest,
      `assembled file changed: ${file}`,
    );
    assert.equal(
      hash(await readFile('skill/crafted-figures/' + file)),
      digest,
      `package is stale: ${file}`,
    );
  }
  const pkg = JSON.parse(await readFile('dist/crafted-figures/package.json'));
  return {
    toolkitVersion: pkg.version,
    ...(await runtimeIdentity()),
    packageManifestSHA256: hash(manifestBytes),
    verificationInputsHash: hash(JSON.stringify(Object.fromEntries(Object.entries(files).sort()))),
  };
}
export async function validateReport(rule) {
  const bytes = await readFile(rule.file),
    r = JSON.parse(bytes);
  assert.equal(r.status, 'passed', rule.file);
  assert.ok(
    Array.isArray(r[rule.key]) && r[rule.key].length >= rule.min,
    `${rule.file}: ${rule.key} requires >= ${rule.min} executed entries`,
  );
  assert.ok(!r.errors?.length, `${rule.file}: errors present`);
  return { ...rule, count: r[rule.key].length, sha256: hash(bytes) };
}
export async function validateReceipt(step, identity, { dir = 'out/reports/release' } = {}) {
  const receipt = JSON.parse(await readFile(`${dir}/${step.id}.json`));
  assert.equal(receipt.status, 'passed', step.id);
  assert.deepEqual(
    receipt.identity,
    identity,
    `${step.id}: stale runtime, package or verification inputs`,
  );
  assert.deepEqual(
    receipt.commands.map(c => c.args),
    step.commands,
  );
  assert.ok(receipt.commands.every(c => c.exitCode === 0));
  for (const c of receipt.commands)
    assert.equal(hash(await readFile(c.log)), c.logHash, `${step.id}: command log changed`);
  assert.deepEqual(
    receipt.reports,
    await Promise.all(step.reports.map(validateReport)),
    `${step.id}: report contents/coverage changed`,
  );
  return receipt;
}
