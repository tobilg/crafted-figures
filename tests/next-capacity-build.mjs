import { spawn } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import * as kit from '../skill/crafted-figures/kit/index.mjs';
import { resolveConfig } from '../skill/crafted-figures/kit/config.mjs';
import { createDial } from '../examples/dial-indicator/scene.mjs';
const out = 'out/reports/capacity-mixed';
await mkdir(out, { recursive: true });
// This is the development fixture's reproducible Next build cache, not source.
await rm('tests/fixtures/next/.next', { recursive: true, force: true });
const report = {
  status: 'running',
  environment: { node: process.version },
  definition:
    'Cold: fixture .next cache removed. Warm: identical production build with that cache retained. Installed dependencies stay present.',
  builds: [],
};
const { config, tokens } = await resolveConfig(),
  stage = createDial({ kit, config, tokens });
stage.update({ displacementMm: 5 });
report.staticGeometry = { solids: 0, triangles: 0, routes: 0, movingParts: 0, effectPasses: 0 };
stage.scene.traverseVisible(o => {
  if (o.isMesh) {
    report.staticGeometry.solids++;
    report.staticGeometry.triangles +=
      (o.geometry.index?.count || o.geometry.getAttribute('position').count) / 3;
  }
  if (o.userData.route) report.staticGeometry.routes++;
});
stage.dispose();
try {
  for (const name of ['cold', 'warm']) {
    const start = performance.now(),
      result = await new Promise((resolve, reject) => {
        const p = spawn(
          process.execPath,
          ['node_modules/next/dist/bin/next', 'build', 'tests/fixtures/next', '--webpack'],
          {
            env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
            stdio: ['ignore', 'pipe', 'pipe'],
          },
        );
        let output = '';
        p.stdout.on('data', d => (output += d));
        p.stderr.on('data', d => (output += d));
        p.on('error', reject);
        p.on('exit', code => resolve({ code, output }));
      });
    await writeFile(`${out}/build-${name}.log`, result.output);
    report.builds.push({ name, ms: performance.now() - start, exitCode: result.code });
    if (result.code) throw new Error(`Next ${name} build failed; see build-${name}.log`);
  }
  report.status = 'passed';
} catch (e) {
  report.status = 'failed';
  report.error = e.stack;
  process.exitCode = 1;
} finally {
  await writeFile(`${out}/build.json`, JSON.stringify(report, null, 2) + '\n');
  console.log(report);
}
