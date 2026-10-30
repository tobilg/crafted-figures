import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { releaseSteps, releaseIdentity, validateReceipt } from './release-evidence.mjs';
import { historicalEvaluations, evidenceManifestPath } from './historical-evidence.mjs';
const args = process.argv.slice(2);
assert.ok(
  args.length === 0 || (args.length === 2 && args[0] === '--evaluations'),
  'Usage: npm run test:parity -- [--evaluations <archive-or-directory>]',
);
const out = 'out/reports/parity';
await mkdir(out, { recursive: true });
const report = {
  schemaVersion: 2,
  status: 'running',
  environment: { node: process.version },
  fixtures: [],
  capabilities: [],
  release: [],
  historicalEvaluations: [],
  errors: [],
};
try {
  const identity = await releaseIdentity();
  report.identity = identity;
  const manifest = JSON.parse(await readFile('tests/fixtures/manifest.json', 'utf8')),
    matrix = await readFile('docs/parity-matrix.md', 'utf8');
  assert.equal(manifest.schemaVersion, 1);
  report.toolkitVersion = identity.toolkitVersion;
  report.fixtureIntroducedWithToolkitVersion = manifest.introducedWithToolkitVersion;
  assert.deepEqual(
    manifest.fixtures.map(f => f.id),
    Array.from({ length: 12 }, (_, i) => `F${String(i + 1).padStart(2, '0')}`),
  );
  const qualified = new Set();
  for (const step of releaseSteps) {
    try {
      const receipt = await validateReceipt(step, identity);
      report.release.push({ id: step.id, status: 'passed', reports: receipt.reports });
      for (const r of receipt.reports) qualified.add(r.file);
    } catch (e) {
      report.release.push({ id: step.id, status: 'pending', reason: e.message });
      report.errors.push(`${step.id}: ${e.message}`);
    }
  }
  // Fresh-author trials were executed on explicitly frozen packages. Retain their
  // identities and outcomes; do not relabel them as current-package test receipts.
  report.technicalStatus = report.errors.length ? 'pending' : 'passed';
  const historical = await historicalEvaluations(args[1]);
  report.historicalEvaluationReport = historical;
  report.historicalEvaluations = historical.snapshots || [];
  if (historical.status !== 'verified-historical') report.errors.push('G09: ' + historical.reason);
  for (const f of manifest.fixtures) {
    for (const field of [
      'capabilities',
      'entries',
      'shapes',
      'materials',
      'cameras',
      'poses',
      'clipTimes',
      'controls',
      'themes',
      'detail',
      'outputs',
      'exceptions',
      'positiveTests',
      'negativeTests',
      'reports',
    ])
      assert.ok(Array.isArray(f[field]), `${f.id}.${field}`);
    for (const file of [...f.entries, ...f.positiveTests, ...f.negativeTests]) await access(file);
    const evidence = f.reports.map(file => ({
      file,
      status:
        file === evidenceManifestPath
          ? historical.status === 'verified-historical'
            ? 'historical-frozen'
            : 'pending'
          : qualified.has(file)
            ? 'release-verified'
            : 'pending',
    }));
    report.fixtures.push({
      id: f.id,
      evidence,
      status:
        evidence.length && evidence.every(e => e.status !== 'pending')
          ? 'evidence-passed'
          : 'incomplete',
    });
  }
  for (let n = 1; n <= 18; n++) {
    const id = `C${String(n).padStart(2, '0')}`,
      row = matrix.split('\n').find(l => l.startsWith(`| ${id} |`));
    assert.ok(row, `${id} absent from matrix`);
    const status = row.split('|')[2].trim();
    assert.ok(['not-started', 'partial', 'verified', 'intentionally-omitted'].includes(status));
    const fixtures = manifest.fixtures.filter(f => f.capabilities.includes(id)).map(f => f.id);
    if (n <= 16) assert.ok(fixtures.length, `${id} has no fixture`);
    const missingEvidence = report.fixtures
      .filter(f => fixtures.includes(f.id) && f.status !== 'evidence-passed')
      .map(f => f.id);
    report.capabilities.push({ id, status, fixtures, missingEvidence });
    if (n <= 16 && (status !== 'verified' || missingEvidence.length))
      report.errors.push(
        `${id}: ${status}; incomplete evidence: ${missingEvidence.join(', ') || 'none'}`,
      );
  }
  report.status = report.errors.length ? 'pending' : 'passed';
  if (report.errors.length) process.exitCode = 2;
} catch (e) {
  report.status = 'failed';
  report.errors.push(e.stack);
  process.exitCode = 1;
} finally {
  await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2) + '\n');
  console.log(
    `${report.status}: ${report.errors.length} unmet requirements; see ${out}/report.json`,
  );
}
