import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { unzipSync } from 'fflate';

export const evidenceManifestPath = 'evals/historical-manifest.json';
const digest = value => createHash('sha256').update(value).digest('hex');

/** Explicit historical input: never discover or download evidence implicitly. */
export async function historicalEvaluations(source, manifestPath = evidenceManifestPath) {
  const manifestBytes = await readFile(manifestPath),
    manifest = JSON.parse(manifestBytes);
  assert.equal(manifest.schemaVersion, 1);
  const base = {
    id: manifest.id,
    toolkitVersion: manifest.toolkitVersion,
    scope: manifest.scope,
    manifestSHA256: digest(manifestBytes),
  };
  if (!source)
    return {
      ...base,
      status: 'pending',
      reason: `Historical trials are a separate input. Obtain ${manifest.archiveName} from the maintainer and run npm run test:parity -- --evaluations <archive-or-directory>. See docs/release-verification.md.`,
    };
  const archive = (await stat(source)).isFile() ? unzipSync(await readFile(source)) : null;
  if (archive)
    assert.deepEqual(
      Object.keys(archive).sort(),
      Object.keys(manifest.files).sort(),
      'Unexpected or missing files in evaluation archive',
    );
  const files = {};
  for (const [name, hash] of Object.entries(manifest.files)) {
    assert.ok(
      !path.isAbsolute(name) &&
        !name.includes('\\') &&
        name.split('/').every(p => p && p !== '.' && p !== '..'),
      'Unsafe historical evidence path',
    );
    const bytes = archive ? Buffer.from(archive[name]) : await readFile(path.join(source, name));
    assert.equal(digest(bytes), hash, `Historical evidence changed: ${name}`);
    files[name] = bytes;
  }
  const report = JSON.parse(files[manifest.report]);
  assert.equal(report.status, 'passed');
  assert.equal(report.toolkitVersion, manifest.toolkitVersion);
  assert.deepEqual(
    report.cases.map(c => c.id).sort(),
    Array.from({ length: 10 }, (_, i) => `R${String(i + 1).padStart(2, '0')}`),
  );
  for (const c of report.cases) {
    assert.equal(c.status, 'executed');
    for (const file of [c.report, c.continuation].filter(Boolean))
      assert.ok(
        files[file.replace(/^out\/reports\/replacement-evals\//, '')],
        `Unbound trial record: ${file}`,
      );
  }
  const snapshots = report.snapshots.map(name => {
    assert.ok(files[name], `Unbound snapshot: ${name}`);
    return { file: name, sha256: manifest.files[name], snapshot: JSON.parse(files[name]) };
  });
  return {
    ...base,
    status: 'verified-historical',
    count: report.cases.length,
    snapshots,
    files: manifest.files,
  };
}
