import { tempDir } from './temp.mjs';
import { printSheet } from '../skill/crafted-figures/kit/print/index.mjs';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';
const out = 'out/reports/print-suite';
await mkdir(out, { recursive: true });
const report = {
  status: 'running',
  environment: { node: process.version, pdfjs: '6.4.299' },
  cases: [],
  errors: [],
};
try {
  for (const name of ['dial-indicator', 'control-cabinet', 'exploded-assembly', 'ripple-tank'])
    for (const paper of ['a4', 'letter']) {
      const dir = `out/print/${name}-${paper}`;
      await printSheet({
        spec: `examples/${name}/sheet.mjs`,
        paper,
        format: 'all',
        png: true,
        out: dir,
      });
      for (const format of ['poster', 'drawing', 'detailed']) {
        const task = getDocument({
          data: new Uint8Array(await readFile(`${dir}/${format}-${paper}.pdf`)),
          useSystemFonts: true,
          isEvalSupported: false,
        });
        const doc = await task.promise;
        const pages = [];
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i),
            ops = await page.getOperatorList(),
            text = (await page.getTextContent()).items.map(x => x.str).join(' '),
            paths = ops.fnArray.filter(x =>
              [OPS.constructPath, OPS.stroke, OPS.fill, OPS.eoFill, OPS.fillStroke].includes(x),
            ).length,
            images = ops.fnArray.filter(x =>
              [OPS.paintImageXObject, OPS.paintInlineImageXObject].includes(x),
            ).length;
          assert.ok(paths > 0, 'actual PDF must preserve vector operators');
          assert.ok(text.length > 50, 'actual PDF retains explanatory text');
          pages.push({
            page: i,
            vectorOperators: paths,
            imageOperators: images,
            textLength: text.length,
          });
        }
        if (name === 'dial-indicator' && paper === 'a4' && format === 'poster') {
          const repeat = await tempDir('crafted-print-repeat-');
          await printSheet({ spec: `examples/${name}/sheet.mjs`, paper, format, out: repeat });
          assert.deepEqual(
            await readFile(`${repeat}/poster-a4.pdf`),
            await readFile(`${dir}/poster-a4.pdf`),
            'identical print inputs must produce identical PDF bytes in the same browser environment',
          );
          report.deterministicPDF = true;
        }
        assert.equal(doc.numPages, format === 'detailed' ? 2 : 1);
        report.cases.push({ name, paper, format, pages });
        await task.destroy();
      }
    }
  const tmp = await tempDir('crafted-print-fault-');
  const source = path.resolve('examples/dial-indicator/figure.mjs'),
    config = path.resolve('examples/dial-indicator/figure.config.json');
  await writeFile(
    path.join(tmp, 'overflow.mjs'),
    `export default ${JSON.stringify({ schemaVersion: 1, figure: source, config, title: 'Overflow fault', description: 'Too much text. '.repeat(2000), maxPages: 2, views: { main: { pose: 'rest' } }, parts: [], steps: [] })}`,
  );
  await assert.rejects(
    printSheet({ spec: path.join(tmp, 'overflow.mjs'), out: path.join(tmp, 'out') }),
    /overflow/i,
  );
  report.overflowDetected = true;
  report.status = 'passed';
} catch (e) {
  report.status = 'failed';
  report.errors.push(e.stack);
  process.exitCode = 1;
} finally {
  await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2) + '\n');
  console.log(report.status, report.cases.length, report.errors);
}
