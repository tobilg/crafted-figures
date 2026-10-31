#!/usr/bin/env node
import path from 'node:path';
import { access } from 'node:fs/promises';
try {
  await access(new URL('../runtime/manifest.json', import.meta.url));
} catch {
  console.error(
    'This is an unbuilt skill source checkout. From the repository root run npm ci, npm --prefix skill/crafted-figures ci, then npm run package:skill. For installation without npm, extract the built crafted-figures ZIP instead.',
  );
  process.exit(1);
}
const { buildFigure } = await import('../kit/build.mjs');
const { bundleFigure } = await import('../kit/bundle.mjs');
const { printSheet } = await import('../kit/print/index.mjs');
const { drive } = await import('../kit/drive.mjs');
const { auditFigure } = await import('../kit/audit/run.mjs');
const { preview, checkOutput } = await import('../kit/verify.mjs');
const schemas = {
  bundle: [
    'entry',
    'out',
    'config',
    'project-config',
    'preset-file',
    'material-file',
    'asset',
    'sheet',
    'paper',
    'format',
    'state',
  ],
  print: [
    'spec',
    'paper',
    'format',
    'png',
    'out',
    'project-config',
    'preset-file',
    'material-file',
  ],
  build: [
    'entry',
    'out',
    'config',
    'project-config',
    'preset-file',
    'material-file',
    'state',
    'preset',
    'theme',
    'output',
    'accent',
    'detail',
    'frame',
    'motion-enabled',
    'idle-tour',
    'duration-ms',
  ],
  audit: [
    'entry',
    'config',
    'project-config',
    'preset-file',
    'material-file',
    'scenario',
    'report',
  ],
  drive: ['dir', 'actions', 'report'],
  preview: ['dir', 'port'],
  check: ['dir', 'report'],
};
export function parseArgs(args) {
  const [command, ...rest] = args;
  if (!schemas[command])
    throw new Error('Use build, preview, check, audit, drive, print, or bundle');
  const flags = {};
  for (let i = 0; i < rest.length; i++) {
    const key = rest[i].replace(/^--/, '');
    if (rest[i] !== `--${key}` || !schemas[command].includes(key))
      throw new Error(`Unknown ${command} flag: ${rest[i]}`);
    if (key === 'png') {
      flags.png = true;
      continue;
    }
    const value = rest[++i];
    if (value === undefined || value.startsWith('--')) throw new Error(`--${key} needs a value`);
    if (key === 'preset-file' || key === 'material-file' || key === 'asset')
      flags[key] = [...(flags[key] ?? []), path.resolve(value)];
    else {
      if (Object.hasOwn(flags, key)) throw new Error(`Duplicate --${key}`);
      flags[key] = value;
    }
  }
  for (const key of command === 'print'
    ? ['spec', 'out']
    : command === 'build' || command === 'bundle'
      ? ['entry', 'out']
      : command === 'audit'
        ? ['entry', 'scenario', 'report']
        : command === 'drive'
          ? ['dir', 'actions', 'report']
          : command === 'check'
            ? ['dir', 'report']
            : ['dir'])
    if (!flags[key]) throw new Error(`--${key} is required`);
  if (command === 'build' || command === 'audit' || command === 'bundle') {
    const overrides = {};
    for (const key of ['preset', 'theme', 'output', 'accent', 'detail', 'frame'])
      if (flags[key] !== undefined) overrides[key] = flags[key];
    for (const [flag, key] of [
      ['motion-enabled', 'enabled'],
      ['idle-tour', 'idleTour'],
      ['duration-ms', 'durationMs'],
    ])
      if (flags[flag] !== undefined) {
        overrides.motion ??= {};
        if (key === 'durationMs') {
          if (!/^\d+$/.test(flags[flag]))
            throw new Error('--duration-ms must be an integer 0..2000');
          overrides.motion[key] = Number(flags[flag]);
        } else {
          if (!['true', 'false'].includes(flags[flag]))
            throw new Error(`--${flag} must be true or false`);
          overrides.motion[key] = flags[flag] === 'true';
        }
      }
    return {
      command,
      options: {
        entry: flags.entry,
        out: flags.out,
        sheet: flags.sheet,
        paper: flags.paper,
        format: flags.format,
        assets: flags.asset || [],
        scenario: flags.scenario,
        report: flags.report,
        config: flags.config,
        projectConfig: flags['project-config'],
        presetFiles: flags['preset-file'] || [],
        materialFiles: flags['material-file'] || [],
        state: flags.state,
        overrides,
      },
    };
  }
  if (command === 'print')
    return {
      command,
      options: {
        spec: flags.spec,
        paper: flags.paper,
        format: flags.format,
        png: flags.png,
        out: flags.out,
        projectConfig: flags['project-config'],
        presetFiles: flags['preset-file'] || [],
        materialFiles: flags['material-file'] || [],
      },
    };
  if (
    flags.port !== undefined &&
    (!/^\d+$/.test(flags.port) || Number(flags.port) < 1 || Number(flags.port) > 65535)
  )
    throw new Error('--port must be an integer 1..65535');
  return { command, options: flags };
}
try {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (!((major === 22 && minor >= 13) || major >= 24))
    throw new Error(
      'Crafted Figures requires Node 22.13+ or Node 24+ for the bundled Vite 8 WASM compiler.',
    );
  const { command, options } = parseArgs(process.argv.slice(2));
  if (command === 'bundle') {
    await bundleFigure(options);
    console.log(`Bundled ${options.out}`);
  }
  if (command === 'print') {
    const result = await printSheet(options);
    console.log(`Printed ${result.report.formats.length} formats in ${options.out}`);
  }
  if (command === 'build') {
    const result = await buildFigure(options);
    console.log(`Built ${result.files.join(', ')} in ${result.out}`);
  }
  if (command === 'drive') {
    const report = await drive(options);
    console.log(`Drive ${report.status}: ${options.report}`);
    if (report.status !== 'passed') process.exitCode = 1;
  }
  if (command === 'audit') {
    const report = await auditFigure(options);
    console.log(`Audit ${report.status}: ${options.report}`);
    if (report.status !== 'passed') process.exitCode = 1;
  }
  if (command === 'check') {
    const report = await checkOutput(options.dir, options.report);
    console.log(`Passed ${report.checks.length} export checks; report: ${options.report}`);
  }
  if (command === 'preview') {
    const server = await preview(options.dir, Number(options.port || 4173));
    console.log(server.url);
    const stop = async () => {
      await server.close();
      process.exit(0);
    };
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
  }
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}
