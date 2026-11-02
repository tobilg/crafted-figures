import { runReport, openBrowser } from './report.mjs';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { printSheet } from '../skill/crafted-figures/kit/print/index.mjs';

const out = 'out/reports/print-references';
await mkdir(out, { recursive: true });
const report = {
  status: 'running',
  environment: { node: process.version, platform: process.platform },
  cases: [],
  errors: [],
};
let browser;
const body = `<defs>
 <path id="support" d="M 20 60 L 75 25 L 130 60 L 130 115 L 75 150 L 20 115 Z"/>
 <linearGradient id="base"><stop stop-color="#5965e8"/><stop offset="1" stop-color="#a8b0ff"/></linearGradient>
 <linearGradient id="shade" href="#base"/>
 <clipPath id="window"><rect x="0" y="0" width="300" height="180"/></clipPath>
 <title id="support-title">Reusable supports</title><desc id="support-desc">Two matching vector supports.</desc>
 </defs><g data-scene><g data-object="supports" aria-labelledby="support-title support-desc" style="clip-path:url('#window')">
 <use href="#support" fill="url(#shade)" stroke="#101830"/>
 <use xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="#support" x="140" fill="url('#shade')" stroke="#101830"/>
 </g></g>`;
const sheet = {
  schemaVersion: 1,
  figure: 'figure.mjs',
  title: 'Reusable SVG supports',
  description: 'Shared vector shapes retain local references in every printed view.',
  maxPages: 2,
  views: { main: { pose: 'rest' } },
  parts: [],
  steps: [
    { title: 'First view', text: 'The same local shape appears twice.', view: 'main' },
    { title: 'Repeated view', text: 'IDs remain independent in this second view.', view: 'main' },
  ],
  details: [
    {
      title: 'Support detail',
      text: 'The gradient and clipping region remain attached.',
      view: 'main',
    },
  ],
};
async function fixture(name, markup) {
  const dir = path.join(out, name);
  await mkdir(dir, { recursive: true });
  await writeFile(
    path.join(dir, 'figure.mjs'),
    `export default {id:'print-reference-${name}',capabilities:{detail:['standard']},initialState:{},poses:{rest:{}},render(){return ${JSON.stringify({ viewBox: [0, 0, 300, 180], title: sheet.title, description: sheet.description, body: markup })};}};\n`,
  );
  await writeFile(path.join(dir, 'sheet.mjs'), `export default ${JSON.stringify(sheet)};\n`);
  return path.join(dir, 'sheet.mjs');
}
async function inspectPDF(file, stem) {
  const task = getDocument({
      data: new Uint8Array(await readFile(file)),
      useSystemFonts: true,
      isEvalSupported: false,
    }),
    doc = await task.promise;
  const pages = [];
  try {
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n),
        ops = await page.getOperatorList(),
        paths = ops.fnArray.filter(x => x === OPS.constructPath).length,
        images = ops.fnArray.filter(x =>
          [OPS.paintImageXObject, OPS.paintInlineImageXObject].includes(x),
        ).length;
      assert.ok(paths > 0);
      assert.equal(images, 0);
      const viewport = page.getViewport({ scale: 1.5 }),
        canvas = doc.canvasFactory.create(Math.ceil(viewport.width), Math.ceil(viewport.height));
      await page.render({ canvasContext: canvas.context, viewport }).promise;
      await writeFile(`${stem}-${n}.png`, canvas.canvas.toBuffer('image/png'));
      doc.canvasFactory.destroy(canvas);
      pages.push({ page: n, paths, images });
    }
  } finally {
    await task.destroy();
  }
  return pages;
}
await runReport(
  out,
  report,
  async () => {
    const spec = await fixture('valid', body);
    browser = await openBrowser(report);
    const page = await browser.newPage({ viewport: { width: 1000, height: 1300 } });
    for (const paper of ['a4', 'letter']) {
      const dir = path.join(out, paper);
      await printSheet({ spec, paper, format: 'all', out: dir, png: true });
      for (const format of ['poster', 'drawing', 'detailed']) {
        const stem = path.join(dir, `${format}-${paper}`);
        await page.goto(pathToFileURL(path.resolve(stem + '.html')).href);
        const checked = await page.locator('figure > svg').evaluateAll(svgs =>
          svgs.map(svg => ({
            ids: [...svg.querySelectorAll('[id]')].map(n => n.id),
            uses: [...svg.querySelectorAll('use')].map(n => {
              const href =
                  n.getAttribute('href') ||
                  n.getAttributeNS('http://www.w3.org/1999/xlink', 'href'),
                box = n.getBBox();
              return {
                href,
                resolves: [...svg.querySelectorAll('[id]')].some(t => t.id === href.slice(1)),
                width: box.width,
                height: box.height,
              };
            }),
          })),
        );
        assert.ok(checked.length >= (format === 'poster' ? 1 : 3));
        const ids = checked.flatMap(v => v.ids);
        assert.equal(new Set(ids).size, ids.length);
        for (const view of checked) {
          assert.equal(view.uses.length, 2);
          assert.ok(view.uses.every(u => u.resolves && u.width > 50 && u.height > 50));
        }
        report.cases.push({
          kind: 'resolved-local-references',
          paper,
          format,
          views: checked,
          pages: await inspectPDF(stem + '.pdf', stem + '-pdf'),
        });
      }
    }
    for (const [name, markup, code] of [
      ['missing-href', body.replace('href="#support"', 'href="#missing"'), 'UNRESOLVED_REFERENCE'],
      ['missing-url', body.replace('url(#shade)', 'url(#missing)'), 'UNRESOLVED_REFERENCE'],
      [
        'missing-aria',
        body.replace('support-title support-desc', 'support-title missing'),
        'UNRESOLVED_REFERENCE',
      ],
      [
        'duplicate-id',
        body.replace('</defs>', '<path id="window" d="M0 0L1 1"/></defs>'),
        'PRINT_DUPLICATE_ID',
      ],
    ]) {
      const invalid = await fixture(name, markup),
        dir = path.join(out, name, 'print');
      await assert.rejects(
        printSheet({ spec: invalid, paper: 'a4', format: 'poster', out: dir }),
        new RegExp(code),
      );
      const failure = JSON.parse(await readFile(path.join(dir, 'print-report.json')));
      assert.equal(failure.status, 'failed');
      await assert.rejects(readFile(path.join(dir, 'poster-a4.pdf')), /ENOENT/);
      report.cases.push({ kind: name, diagnostic: code, status: 'rejected-before-writing-pdf' });
    }
  },
  {
    cleanup: async () => {
      await browser?.close();
    },
  },
);
