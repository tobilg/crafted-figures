import { runReport, capture } from './report.mjs';
import { tempDir } from './temp.mjs';
import { bundleFigure } from '../skill/crafted-figures/kit/bundle.mjs';
import { readFile, mkdir, cp } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const out = 'out/reports/sharing';
await mkdir(out, { recursive: true });
const report = { status: 'running', environment: { node: process.version }, cases: [], errors: [] };
const run = async (cmd, args, cwd) => {
  const env = { ...process.env };
  delete env.NODE_PATH;
  const { code, output } = await capture(cmd, args, { cwd, env });
  if (code) throw new Error(output);
  return output;
};
await runReport(out, report, async () => {
  for (const name of ['dial-indicator', 'exploded-assembly']) {
    const dir = `out/share/${name}`;
    await bundleFigure({
      entry: `examples/${name}/figure.mjs`,
      config: `examples/${name}/figure.config.json`,
      overrides: { output: 'both' },
      ...(name === 'exploded-assembly' ? { sheet: `examples/${name}/sheet.mjs` } : {}),
      out: dir,
    });
    const temp = await tempDir('crafted-shared-');
    await cp(dir, temp, { recursive: true });
    const expected = {};
    for (const file of ['figure.html', 'figure.svg', 'resolved-config.json', 'build-manifest.json'])
      expected[file] = await readFile(path.join(temp, 'artifacts', file));
    const install = 'not needed: bundled runtime',
      build = await run(process.execPath, ['rebuild.mjs'], temp);
    for (const [file, bytes] of Object.entries(expected))
      assert.deepEqual(
        await readFile(path.join(temp, 'artifacts', file)),
        bytes,
        `${name} ${file} reproducibility`,
      );
    report.cases.push({
      name,
      isolatedOutsideRepository: !temp.startsWith(process.cwd()),
      install,
      build,
      deterministicFiles: Object.keys(expected),
      print:
        name === 'exploded-assembly'
          ? JSON.parse(await readFile(path.join(temp, 'print/print-report.json'), 'utf8'))
          : null,
    });
  }
});
