import { bundleModule } from '../skill/crafted-figures/kit/bundler.mjs';
// Maintainer regressions from independently preserved frozen-package findings.
// Never edit or reinterpret the fresh-agent trial's source/reports.
import { auditFigure } from '../skill/crafted-figures/kit/audit/run.mjs';
import { buildFigure } from '../skill/crafted-figures/kit/build.mjs';
import { printSheet } from '../skill/crafted-figures/kit/print/index.mjs';
import { drive } from '../skill/crafted-figures/kit/drive.mjs';
import { runtimeIdentity } from '../skill/crafted-figures/kit/provenance.mjs';
import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const out = 'out/reports/gap-followups',
  source = 'tests/fixtures/regressions/construction',
  scenarios = 'tests/fixtures/regressions/particles';
await mkdir(out, { recursive: true });
const report = {
  status: 'running',
  scope:
    'Maintainer verification of preserved agent inputs against the corrected candidate; not a new fresh-agent trial',
  ...(await runtimeIdentity()),
  packageManifestSHA256: createHash('sha256')
    .update(await readFile('dist/crafted-figures/package-manifest.json'))
    .digest('hex'),
  cases: [],
  errors: [],
  environment: { node: process.version },
};
try {
  const audit = await auditFigure({
    entry: `${source}/figure.mjs`,
    config: `${source}/figure.config.json`,
    scenario: `${source}/audit.json`,
    report: `${out}/declared-audit`,
  });
  assert.equal(audit.status, 'passed');
  assert.equal(audit.results.length, 3);
  for (const r of audit.results) {
    assert.equal(r.coverage.connections, 3);
    assert.equal(r.coverage.contacts, 1);
  }
  report.cases.push({
    kind: 'original-scene-declarations',
    samples: audit.results.length,
    coverage: audit.results.map(r => r.coverage),
  });
  const printed = await printSheet({
    spec: `${source}/sheet.mjs`,
    paper: 'letter',
    out: `${out}/static-print`,
    png: true,
  });
  assert.deepEqual(printed.manifest.formats.poster.views.main.state, { turnDeg: 8 });
  const task = getDocument({
      data: new Uint8Array(await readFile(`${out}/static-print/poster-letter.pdf`)),
      useSystemFonts: true,
      isEvalSupported: false,
    }),
    doc = await task.promise;
  assert.equal(doc.numPages, 1);
  const page = await doc.getPage(1),
    ops = await page.getOperatorList(),
    vectors = ops.fnArray.filter(n => n === OPS.constructPath).length,
    images = ops.fnArray.filter(n =>
      [OPS.paintImageXObject, OPS.paintInlineImageXObject].includes(n),
    ).length;
  assert.ok(vectors > 100);
  assert.equal(images, 0);
  const viewport = page.getViewport({ scale: 3 }),
    canvas = doc.canvasFactory.create(Math.ceil(viewport.width), Math.ceil(viewport.height));
  await page.render({ canvasContext: canvas.context, viewport }).promise;
  await writeFile(`${out}/static-print/pdf-page.png`, canvas.canvas.toBuffer('image/png'));
  doc.canvasFactory.destroy(canvas);
  await task.destroy();
  report.cases.push({
    kind: 'original-static-sheet',
    vectors,
    images,
    state: printed.manifest.formats.poster.views.main.state,
  });
  // Compare compiled modules: a formatter may rewrite the source, not what it computes.
  const compiled = async entry =>
    (await bundleModule({ entry, platform: 'node' })).code.replace(/^\/\/ .*\n/gm, '');
  assert.equal(
    await compiled('examples/turning-mechanism/model.mjs'),
    await compiled('tests/fixtures/regressions/particles/model.mjs'),
    'Particle correction must preserve the explanatory model',
  );
  for (const theme of ['light', 'dark']) {
    const dir = `${out}/particles-${theme}`;
    await buildFigure({
      entry: 'examples/turning-mechanism/figure.mjs',
      config: 'examples/turning-mechanism/figure.config.json',
      state: 'mid',
      out: dir,
      overrides: { theme },
    });
    for (const mode of ['unavailable', 'context-loss']) {
      const r = await drive({
        dir,
        actions: `${scenarios}/${mode}.json`,
        report: `${out}/${mode}-${theme}`,
      });
      assert.equal(r.status, 'passed', JSON.stringify(r.errors));
      report.cases.push({
        kind: 'original-2.31-second-scenario',
        theme,
        mode,
        actions: r.actions.length,
      });
    }
  }
  report.status = 'passed';
} catch (e) {
  report.status = 'failed';
  report.errors.push(e.stack);
  process.exitCode = 1;
} finally {
  await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2) + '\n');
  console.log(report.status, report.cases.length, report.errors);
}
