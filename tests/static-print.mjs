import { printSheet } from '../skill/crafted-figures/kit/print/index.mjs';
import { runtimeIdentity } from '../skill/crafted-figures/kit/provenance.mjs';
import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out = 'out/reports/static-print';
await mkdir(out, { recursive: true });
const report = {
  status: 'running',
  ...(await runtimeIdentity()),
  cases: [],
  errors: [],
  environment: { node: process.version },
};
async function inspectPDF(file, stem, expectedPages) {
  const task = getDocument({
      data: new Uint8Array(await readFile(file)),
      useSystemFonts: true,
      isEvalSupported: false,
    }),
    doc = await task.promise;
  assert.equal(doc.numPages, expectedPages);
  const pages = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n),
      ops = await page.getOperatorList(),
      vectors = ops.fnArray.filter(n => n === OPS.constructPath).length,
      images = ops.fnArray.filter(n =>
        [OPS.paintImageXObject, OPS.paintInlineImageXObject].includes(n),
      ).length;
    assert.ok(vectors > 100);
    assert.equal(images, 0);
    const viewport = page.getViewport({ scale: 2 }),
      canvas = doc.canvasFactory.create(Math.ceil(viewport.width), Math.ceil(viewport.height));
    await page.render({ canvasContext: canvas.context, viewport }).promise;
    await writeFile(`${stem}-${n}.png`, canvas.canvas.toBuffer('image/png'));
    doc.canvasFactory.destroy(canvas);
    pages.push({ page: n, vectors, images });
  }
  await task.destroy();
  return pages;
}
try {
  await writeFile(
    `${out}/static.mjs`,
    "import figure from '../../../examples/construction-details/figure.mjs';export default {...figure,clientEntry:undefined};\n",
  );
  await writeFile(
    `${out}/sheet.mjs`,
    `export default ${JSON.stringify({ schemaVersion: 1, figure: 'static.mjs', title: 'Construction details — static inspection pose', views: { main: { pose: 'mid' } }, parts: [], steps: [], maxPages: 1 })};\n`,
  );
  for (const paper of ['a4', 'letter']) {
    const result = await printSheet({
        spec: `${out}/sheet.mjs`,
        paper,
        out: `${out}/${paper}`,
        png: true,
      }),
      view = result.manifest.formats.poster.views.main;
    assert.deepEqual(view.state, { turnDeg: 8 });
    assert.equal(view.readout, '8° assembly turn');
    report.cases.push({
      kind: 'static',
      paper,
      state: view.state,
      readout: view.readout,
      pages: await inspectPDF(`${out}/${paper}/poster-${paper}.pdf`, `${out}/${paper}-pdf`, 1),
    });
  }
  for (const paper of ['a4', 'letter']) {
    const dir = `${out}/template-${paper}`,
      result = await printSheet({
        spec: 'examples/construction-details/sheet.mjs',
        paper,
        format: 'all',
        out: dir,
        png: true,
      });
    for (const format of ['poster', 'drawing', 'detailed']) {
      const view = result.manifest.formats[format].views.main;
      assert.deepEqual(view.state, { turnDeg: 8 });
      report.cases.push({
        kind: 'shipped-sheet',
        paper,
        format,
        state: view.state,
        pages: await inspectPDF(
          `${dir}/${format}-${paper}.pdf`,
          `${out}/template-${paper}-${format}`,
          format === 'detailed' ? 2 : 1,
        ),
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
