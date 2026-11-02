import { buildFigure } from '../skill/crafted-figures/kit/build.mjs';
import { drive } from '../skill/crafted-figures/kit/drive.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
const report = { status: 'running', results: [] };
try {
  for (const name of ['terminal-cabinet', 'exploded-assembly', 'turning-mechanism']) {
    const dir = `out/drive/${name}`;
    await buildFigure({
      entry: `examples/${name}/figure.mjs`,
      config: `examples/${name}/figure.config.json`,
      out: dir,
      overrides: { output: 'both', motion: { enabled: false } },
    });
    const result = await drive({
      dir,
      actions: `examples/${name}/actions.json`,
      report: `out/reports/drive/${name}`,
    });
    report.results.push({ name, status: result.status, errors: result.errors });
  }
  report.status = report.results.every(r => r.status === 'passed') ? 'passed' : 'failed';
} catch (e) {
  report.status = 'failed';
  report.error = e.stack;
}
await mkdir('out/reports/drive', { recursive: true });
await writeFile('out/reports/drive/report.json', JSON.stringify(report, null, 2) + '\n');
if (report.status !== 'passed') process.exitCode = 1;
console.log(report);
