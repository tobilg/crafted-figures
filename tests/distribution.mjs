import { runReport, capture } from './report.mjs';
import { tempDir } from './temp.mjs';
import { mkdir, readFile, writeFile, rm, cp, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { unzipSync } from 'fflate';
import assert from 'node:assert/strict';
import path from 'node:path';
const repo = process.cwd(),
  out = 'out/reports/distribution';
await mkdir(out, { recursive: true });
const report = {
  status: 'failed',
  environment: { node: process.version, platform: process.platform, arch: process.arch },
  checks: [],
  commands: [],
};
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
let temp;
async function run(args, cwd, env = {}) {
  const r = await capture(process.execPath, args, {
    cwd,
    env: { ...process.env, NODE_PATH: '', ...env },
  });
  report.commands.push({
    args,
    exitCode: r.code,
    output: r.output.replaceAll(temp || '<none>', '<isolated>'),
  });
  assert.equal(r.code, 0, r.output);
  return r;
}
await runReport(
  out,
  report,
  async () => {
    const pkg = JSON.parse(await readFile('skill/crafted-figures/package.json'));
    const zipName = `crafted-figures-${pkg.version}.zip`,
      zipPath = path.join('dist', zipName);
    await run(['scripts/package-skill.mjs'], repo, { TZ: 'UTC' });
    const first = await readFile(zipPath);
    await run(['scripts/package-skill.mjs'], repo, { TZ: 'Pacific/Honolulu' });
    const second = await readFile(zipPath);
    assert.deepEqual(second, first);
    assert.equal(await readFile(zipPath + '.sha256', 'utf8'), `${hash(second)}  ${zipName}\n`);
    report.archive = { file: zipPath, bytes: second.length, sha256: hash(second) };
    report.checks.push({ name: 'repeat build across time zones', status: 'passed' });
    const files = unzipSync(second),
      prefix = 'crafted-figures/',
      manifest = JSON.parse(Buffer.from(files[prefix + 'package-manifest.json']).toString());
    assert.deepEqual(
      Object.keys(files).sort(),
      [
        ...Object.keys(manifest.files).map(n => prefix + n),
        prefix + 'package-manifest.json',
      ].sort(),
    );
    for (const [name, digest] of Object.entries(manifest.files))
      assert.equal(hash(files[prefix + name]), digest, name);
    assert.ok(
      !Object.keys(files).some(n =>
        /playwright-core\/lib\/(vite|tools\/skills)\/|\/node_modules\/|\/\.env(?:$|\.)/.test(n),
      ),
    );
    report.packageManifestSHA256 = hash(files[prefix + 'package-manifest.json']);
    report.files = Object.keys(manifest.files).length;
    report.checks.push({ name: 'archive content, manifest and removed assets', status: 'passed' });
    temp = await tempDir('crafted-distribution-');
    for (let dir = temp; ; dir = path.dirname(dir)) {
      await assert.rejects(access(path.join(dir, 'node_modules')), /ENOENT/);
      if (path.dirname(dir) === dir) break;
    }
    for (const [name, bytes] of Object.entries(files)) {
      assert.ok(name.startsWith(prefix) && !name.split('/').includes('..'));
      const p = path.join(temp, name);
      await mkdir(path.dirname(p), { recursive: true });
      await writeFile(p, bytes);
    }
    const skill = path.join(temp, 'crafted-figures'),
      author = path.join(temp, 'author');
    await cp(path.join(skill, 'assets/templates/sector-gauge'), author, { recursive: true });
    await run(
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
        'output',
      ],
      author,
      { PATH: path.dirname(process.execPath) },
    );
    const build = JSON.parse(await readFile(path.join(author, 'output/build-manifest.json')));
    assert.equal(build.toolkitVersion, pkg.version);
    report.checks.push({
      name: 'extracted ZIP builds a new standalone figure without npm',
      status: 'passed',
    });
    await run(
      [path.join(skill, 'runtime/playwright-core/cli.js'), 'install', '--dry-run', 'chromium'],
      temp,
      { PATH: path.dirname(process.execPath) },
    );
    report.checks.push({
      name: 'retained explicit Chromium installer resolves its assets (dry run)',
      status: 'passed',
    });
  },
  {
    cleanup: async () => {
      if (temp) await rm(temp, { recursive: true, force: true });
    },
  },
);
