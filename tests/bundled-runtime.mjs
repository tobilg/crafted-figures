import { tempDir } from './temp.mjs';
import assert from 'node:assert/strict';
import { mkdir, cp, readFile, writeFile, access, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const repo = process.cwd(),
  out = path.resolve('out/reports/bundled-runtime');
await mkdir(out, { recursive: true });
const report = {
  status: 'failed',
  environment: { node: process.version, platform: process.platform, arch: process.arch },
  cases: [],
  commands: [],
};
const digest = x => createHash('sha256').update(x).digest('hex');
let workspace;
async function run(args, cwd, { guard = true, expected = 0 } = {}) {
  const env = {
    ...process.env,
    PATH: path.dirname(process.execPath),
    NODE_PATH: '',
    NODE_OPTIONS: guard
      ? `--import=${pathToFileURL(path.join(workspace, 'offline-guard.mjs')).href}`
      : '',
  };
  const result = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let log = '';
    child.stdout.on('data', d => (log += d));
    child.stderr.on('data', d => (log += d));
    child.on('error', reject);
    child.on('exit', code => resolve({ code, log }));
  });
  report.commands.push({
    args: args.map(s => s.replaceAll(workspace, '<isolated>')),
    code: result.code,
    log: result.log.replaceAll(workspace, '<isolated>'),
  });
  assert.equal(result.code, expected, result.log);
  return result.log;
}
try {
  workspace = await tempDir('crafted-bundled-');
  const skill = path.join(workspace, 'skill'),
    author = path.join(workspace, 'author with spaces');
  await cp('dist/crafted-figures', skill, { recursive: true });
  await mkdir(author);
  assert.ok(!workspace.startsWith(repo));
  for (let dir = workspace; ; dir = path.dirname(dir)) {
    await assert.rejects(access(path.join(dir, 'node_modules')), /ENOENT/);
    if (path.dirname(dir) === dir) break;
  }
  const manifest = JSON.parse(await readFile(path.join(skill, 'package-manifest.json'), 'utf8'));
  for (const [name, hash] of Object.entries(manifest.files)) {
    assert.equal(digest(await readFile(path.join(skill, name))), hash, name);
    assert.ok(!name.split('/').includes('node_modules'));
    assert.ok(!name.endsWith('.node'));
    assert.ok(!/^(kit|types)\/anatomy\//.test(name));
  }
  report.packageManifestSHA256 = digest(await readFile(path.join(skill, 'package-manifest.json')));
  // These guards are inherited by WASI workers. Fail if code tries native addon
  // loading, npm/other subprocesses, network downloads, or repository imports.
  await writeFile(
    path.join(workspace, 'offline-guard.mjs'),
    `import net from 'node:net';import http from 'node:http';import https from 'node:https';import cp from 'node:child_process';import {register,syncBuiltinESMExports} from 'node:module';
 const denied=()=>{throw new Error('Offline isolation: network, subprocess and native-addon access denied');};
 net.Socket.prototype.connect=denied;http.request=denied;https.request=denied;http.get=denied;https.get=denied;globalThis.fetch=denied;process.dlopen=denied;
 for(const key of ['spawn','spawnSync','exec','execSync','execFile','execFileSync','fork'])cp[key]=denied;syncBuiltinESMExports();
 register(new URL('./import-guard.mjs',import.meta.url));
 `,
  );
  await writeFile(
    path.join(workspace, 'import-guard.mjs'),
    `export async function resolve(id,context,next){const result=await next(id,context);if(result.url.startsWith(${JSON.stringify(pathToFileURL(repo + path.sep).href)}))throw new Error('Repository import escaped isolation: '+result.url);return result;}`,
  );
  // Prove that the guard fails closed, instead of merely installing dead hooks.
  await run(['--input-type=module', '-e', "await fetch('https://example.invalid')"], workspace, {
    expected: 1,
  });
  report.cases.push({
    id: 'isolation',
    status: 'passed',
    npmInvoked: false,
    ancestorNodeModules: false,
    nativeAddons: false,
    networkGuardSelfTest: true,
  });
  const cli = path.join(skill, 'scripts/figures.mjs');
  for (const template of ['basic-figure', 'dial-indicator', 'sector-gauge', 'turning-mechanism']) {
    const source = path.join(author, template);
    await cp(path.join(skill, 'assets/templates', template), source, { recursive: true });
    const cfg = path.join(source, 'figure.config.json');
    await writeFile(
      cfg,
      JSON.stringify({ ...JSON.parse(await readFile(cfg, 'utf8')), output: 'both' }),
    );
    const figure = path.join(source, 'figure.mjs'),
      text = await readFile(figure, 'utf8');
    // A new local module is consumed by both graph collection and the figure.
    await writeFile(
      path.join(source, 'caption.mjs'),
      "export const caption = 'Fresh isolated authoring';\n",
    );
    await writeFile(
      figure,
      "import {caption} from './caption.mjs';\n" +
        text.replace('export default {', 'export default { caption,'),
    );
    // Local Vite config/env must not run or alter these deterministic artifacts.
    await writeFile(
      path.join(source, 'vite.config.mjs'),
      "throw new Error('Implicit project config must not execute');",
    );
    await writeFile(path.join(source, '.env'), 'VITE_UNWANTED=unwanted-environment-value\n');
    const output = path.join(source, 'output');
    const args = [
      cli,
      'build',
      '--entry',
      'figure.mjs',
      '--config',
      'figure.config.json',
      '--output',
      'both',
      '--motion-enabled',
      'false',
      '--out',
      output,
    ];
    await run(args, source);
    const before = {};
    for (const file of ['figure.html', 'figure.svg', 'resolved-config.json', 'build-manifest.json'])
      before[file] = await readFile(path.join(output, file));
    const buildManifest = JSON.parse(before['build-manifest.json']);
    assert.equal(buildManifest.bundler.version, '8.3.5');
    assert.ok(buildManifest.sourceHashes['caption.mjs']);
    await run(args, source);
    for (const [file, bytes] of Object.entries(before))
      assert.deepEqual(await readFile(path.join(output, file)), bytes, file);
    assert.ok(!before['figure.html'].includes(Buffer.from(repo)));
    assert.ok(!before['figure.html'].includes(Buffer.from(workspace)));
    await cp(output, path.join(out, template), { recursive: true });
    report.cases.push({
      id: template,
      status: 'passed',
      newSource: true,
      deterministic: true,
      files: Object.keys(before),
      bundler: buildManifest.bundler,
    });
  }
  const dial = path.join(author, 'dial-indicator');
  await run(
    [
      cli,
      'bundle',
      '--entry',
      'figure.mjs',
      '--config',
      'figure.config.json',
      '--out',
      path.join(workspace, 'share'),
    ],
    dial,
  );
  await cp(path.join(workspace, 'share'), path.join(workspace, 'relocated share'), {
    recursive: true,
  });
  await run(['rebuild.mjs'], path.join(workspace, 'relocated share'));
  for (const name of ['figure.html', 'figure.svg', 'build-manifest.json', 'resolved-config.json'])
    await assert.deepEqual(
      await readFile(path.join(workspace, 'share/artifacts', name)),
      await readFile(path.join(workspace, 'relocated share/artifacts', name)),
      name,
    );
  report.cases.push({
    id: 'source-bundle',
    status: 'passed',
    noInstallRebuild: true,
    relocatedBytesMatch: true,
  });
  report.status = 'passed';
} catch (e) {
  report.error = e.stack;
  process.exitCode = 1;
} finally {
  report.workspace = workspace;
  if (report.status === 'passed') {
    await rm(workspace, { recursive: true });
    report.temporaryCopiesRemoved = true;
  }
  await writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(`${report.status}: ${out}`, report.error || '');
}
