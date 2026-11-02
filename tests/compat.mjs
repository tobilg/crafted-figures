import { capture } from './report.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
const out = 'out/reports/compat';
await mkdir(out, { recursive: true });
const report = {
  status: 'running',
  environment: { node: process.version, platform: process.platform },
  steps: [],
};
// The v1/v2 contract tests and the consumer type check run in `npm test` and `test:types`.
for (const [name, args] of [
  ['isolated-standalone', ['tests/package.mjs']],
  ['isolated-framework', ['tests/react-package.mjs']],
  ['isolated-source-bundles', ['tests/bundle.mjs']],
]) {
  const { code, output } = await capture(process.execPath, args);
  await writeFile(`${out}/${name}.log`, output);
  report.steps.push({
    name,
    command: [process.execPath, ...args],
    exitCode: code,
    status: code === 0 ? 'passed' : 'failed',
  });
  if (code !== 0) {
    report.status = 'failed';
    process.exitCode = 1;
    break;
  }
}
if (report.status === 'running') report.status = 'passed';
await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2) + '\n');
console.log(report.status);
