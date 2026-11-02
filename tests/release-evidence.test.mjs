import { tempDir } from './temp.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { hash, validateReport, validateReceipt, releaseSteps } from './release-evidence.mjs';
test('release evidence rejects empty reports, stale inputs and modified execution logs', async () => {
  const dir = await tempDir('crafted-evidence-'),
    file = path.join(dir, 'report.json'),
    rule = { file, key: 'cases', min: 2 };
  await writeFile(file, JSON.stringify({ status: 'passed', cases: [] }));
  await assert.rejects(validateReport(rule), /requires >= 2/);
  await writeFile(
    file,
    JSON.stringify({ status: 'passed', cases: [{ state: 0 }, { state: 1 }], errors: [] }),
  );
  const checked = await validateReport(rule),
    log = path.join(dir, 'run.log');
  await writeFile(log, 'executed two cases\n');
  const step = { id: 'fixture', commands: [['fixture.mjs']], reports: [rule] },
    identity = { runtimeHash: 'current', packageManifestSHA256: 'frozen' },
    receipt = {
      status: 'passed',
      identity,
      commands: [
        { args: ['fixture.mjs'], exitCode: 0, log, logHash: hash('executed two cases\n') },
      ],
      reports: [checked],
    };
  await writeFile(path.join(dir, 'fixture.json'), JSON.stringify(receipt));
  await validateReceipt(step, identity, { dir });
  await assert.rejects(
    validateReceipt(step, { ...identity, runtimeHash: 'changed' }, { dir }),
    /stale/,
  );
  await writeFile(log, 'changed');
  await assert.rejects(validateReceipt(step, identity, { dir }), /log changed/);
});

test('release registry covers all unit files and current packaging/renderer entrypoints', async () => {
  const files = (await readdir('tests'))
    .filter(f => f.endsWith('.test.mjs'))
    .sort()
    .map(f => 'tests/' + f);
  assert.deepEqual(releaseSteps.find(s => s.id === 'unit').commands[0], ['--test', ...files]);
  const pkg = JSON.parse(await readFile('package.json')),
    commands = releaseSteps.flatMap(s => s.commands).map(c => c.join(' '));
  for (const name of [
    'test:owned',
    'test:distribution',
    'test:source-package',
    'test:bundled',
    'test:print:references',
  ])
    assert.ok(
      commands.includes(pkg.scripts[name].replace(/^node /, '')),
      `Missing release coverage for ${name}`,
    );
});
test('tracked regression inputs retain their frozen source hashes', async () => {
  const root = 'tests/fixtures/regressions',
    manifest = JSON.parse(await readFile(root + '/provenance.json'));
  for (const f of manifest.files)
    assert.equal(hash(await readFile(root + '/' + f.file)), f.sha256, f.file);
});
