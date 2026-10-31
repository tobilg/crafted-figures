import path from 'node:path';
import os from 'node:os';
import { readFile, mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { launchChromium, waitForFigure } from '../browser.mjs';
import { buildFigure } from '../build.mjs';
import { digest as hash } from '../hash.mjs';
import { escapeText } from '../text.mjs';
import { scopedCSS, styleSheet } from '../styles.mjs';
import { writeOwnedSet } from '../owned-output.mjs';
import { validateSheet } from './schema.mjs';
import { captureView } from './capture.mjs';
import { namespacePrintSVGs } from './references.mjs';
const papers = { a4: [210, 297], letter: [215.9, 279.4] },
  formats = ['poster', 'drawing', 'detailed'];
const esc = escapeText;
/** Layouts a sheet has the content for: a drawing needs an inset, a handout a second page.
 * @param {{details?:unknown[],assemblies?:unknown[],steps:unknown[]}} spec
 */
function availableFormats(spec) {
  const notes = [...spec.steps, ...(spec.assemblies || [])];
  return [
    'poster',
    ...(spec.details?.length || spec.assemblies?.length ? ['drawing'] : []),
    ...(notes.length ? ['detailed'] : []),
  ];
}
function documentHTML(spec, views, paper, format) {
  const [w, h] = papers[paper];
  const art = (viewId, cls = 'main') => {
    const view = views[viewId];
    let svg = view.svg;
    if (cls === 'inset') svg = svg.replace(/<g data-print-pin="">[\s\S]*?<\/g>/g, '');
    return `<figure class="${cls}">${svg}<figcaption>${esc(view.readout || viewId)}${view.rasters.length ? ' · effect layers are raster captures' : ''}</figcaption></figure>`;
  };
  const main = Object.keys(views)[0],
    parts = `<ol class="parts">${spec.parts.map(p => `<li><b>${esc(p.label)}</b> — ${esc(p.description)}</li>`).join('')}</ol>`;
  const note = n =>
    `<section class="note"><h3>${esc(n.title)}</h3>${art(n.view, 'inset')}<p>${esc(n.text)}</p></section>`;
  const header = `<header>${spec.eyebrow ? `<span>${esc(spec.eyebrow)}</span>` : ''}<h1>${esc(spec.title)}</h1><p>${esc(spec.description || '')}</p></header>`;
  let pages = [];
  if (format === 'poster') pages = [`${header}${art(main)}${parts}`];
  if (format === 'drawing') {
    const inset = spec.details?.[0] || spec.assemblies?.[0];
    if (!inset)
      throw new Error(
        'Drawing layout needs an inset: declare a detail or assembly with a close-up view',
      );
    pages = [
      `${header}<div class="drawing">${art(main)}<aside>${parts}<div class="drawing-detail">${note(inset)}</div></aside></div><div class="sequence">${spec.steps.map(note).join('')}</div>`,
    ];
  }
  if (format === 'detailed') {
    pages = [
      `${header}${art(main)}${parts}<div class="details">${(spec.details || []).map(note).join('')}</div>`,
    ];
    const notes = [...spec.steps, ...(spec.assemblies || [])];
    for (let i = 0; i < notes.length; i += 4)
      pages.push(
        `<h2>${i === 0 ? 'How it works' : 'Assemblies and details'}</h2><div class="steps">${notes
          .slice(i, i + 4)
          .map(note)
          .join('')}</div>`,
      );
    if (pages.length < 2)
      throw new Error('Detailed sheet needs meaningful steps or assemblies for at least two pages');
    if (pages.length > spec.maxPages)
      throw new Error(
        `Detailed sheet needs ${pages.length} pages, exceeding maxPages ${spec.maxPages}`,
      );
  }
  const css = `@page{size:${w}mm ${h}mm;margin:0}*{box-sizing:border-box}body{padding:0;margin:0;background:#ddd;color:#15181e;font:${spec.typography?.size || 11}pt ${spec.typography?.body || 'Arial, sans-serif'};-webkit-print-color-adjust:exact;print-color-adjust:exact}.sheet{position:relative;width:${w}mm;height:${h}mm;padding:14mm;background:white;break-after:page;overflow:visible}.sheet:last-child{break-after:auto}header span{font:8pt monospace;letter-spacing:.08em}h1{font-size:23pt;line-height:1.1;margin:4mm 0}h2{font-size:20pt}h3{font-size:12pt;margin:2mm 0}p{line-height:1.4;margin:2mm 0}figure{margin:0;min-width:0;display:grid;grid-template-rows:minmax(0,1fr) auto}.main{height:${format === 'poster' ? 146 : format === 'detailed' ? 115 : 116}mm}.main svg{height:100%!important;min-height:0}figcaption{font:9pt monospace;min-height:6mm;text-align:center}.parts{padding-left:7mm;display:grid;grid-template-columns:1fr 1fr;gap:2.5mm 7mm;margin:5mm 0}.parts li{padding-left:1mm;font-size:10pt;line-height:1.35}.drawing{display:grid;grid-template-columns:2fr 1fr;gap:5mm}.drawing .parts{display:block}.drawing li{margin:3mm 0}.drawing-detail .inset{height:35mm}.drawing-detail h3{font-size:10pt}.drawing-detail p{font-size:9pt}.drawing-detail figcaption{font-size:8pt}.sequence,.details,.steps{display:grid;grid-template-columns:1fr 1fr;gap:6mm}.sequence{grid-template-columns:repeat(${Math.min(4, spec.steps.length) || 1},1fr);margin-top:5mm}.inset{height:68mm}.inset svg{height:100%!important;min-height:0}.sequence .inset{height:58mm}.details .inset{height:43mm}.note p{font-size:10pt}.note{break-inside:avoid}.sheet>footer{position:absolute;bottom:6mm;left:14mm;right:14mm;border-top:.2mm solid #777;padding-top:2mm;font:8pt monospace}.note svg{border:0!important;border-radius:0!important}`;
  return {
    pages: pages.length,
    html: `<!doctype html><html lang="${esc(spec.language ?? 'en')}"><head><meta charset="utf-8"><title>${esc(spec.title)}</title><style>${css}</style></head><body>${pages.map((body, i) => `<article class="sheet" data-page="${i + 1}">${body}<footer>${esc(spec.title)} · ${i + 1} / ${pages.length}</footer></article>`).join('')}</body></html>`,
  };
}
export async function printSheet(options) {
  const specPath = path.resolve(options.spec),
    spec = validateSheet((await import(pathToFileURL(specPath).href)).default),
    base = path.dirname(specPath),
    paper = options.paper || spec.paper || 'a4',
    format = options.format || spec.format || 'poster';
  if (!papers[paper] || ![...formats, 'all', 'available'].includes(format))
    throw new Error('print: paper a4|letter and format poster|drawing|detailed|all required');
  const report = {
      status: 'running',
      environment: { node: process.version, platform: process.platform },
      formats: [],
      errors: [],
    },
    temp = await mkdtemp(path.join(os.tmpdir(), 'crafted-print-'));
  let browser;
  try {
    const figure = spec.figure
      ? (await import(pathToFileURL(path.resolve(base, spec.figure)).href)).default
      : null;
    const staticSource = figure && !figure.clientEntry;
    const buildOptions = {
      printMode: !!staticSource,
      entry: spec.figure ? path.resolve(base, spec.figure) : undefined,
      config: spec.config ? path.resolve(base, spec.config) : undefined,
      projectConfig: options.projectConfig,
      presetFiles: options.presetFiles,
      materialFiles: options.materialFiles,
      overrides: { output: 'both', theme: 'light', motion: { enabled: false } },
    };
    let dir;
    if (spec.figure) {
      dir = path.join(temp, 'figure');
      await buildFigure({ ...buildOptions, out: dir });
    } else dir = path.resolve(base, spec.artifact);
    const manifest = JSON.parse(await readFile(path.join(dir, 'build-manifest.json'), 'utf8')),
      config = JSON.parse(await readFile(path.join(dir, 'resolved-config.json'), 'utf8'));
    browser = await launchChromium();
    report.environment.browser = browser.version();
    report.environment.browserSource = browser.craftedSource;
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1200 },
      deviceScaleFactor: 2,
      reducedMotion: 'reduce',
    });
    page.on('pageerror', e => report.errors.push(e.message));
    page.on('request', r => {
      if (/^https?:/.test(r.url())) report.errors.push(`External print request: ${r.url()}`);
    });
    const openArtifact = async () => {
      if (manifest.outputHashes['figure.html'])
        await page.goto(pathToFileURL(path.join(dir, 'figure.html')).href);
      else
        await page.setContent(
          '<!doctype html><article data-figure="static-print">' +
            (await readFile(path.join(dir, 'figure.svg'), 'utf8')) +
            '</article>',
        );
    };
    await openArtifact();
    if (await page.locator('script').count()) await waitForFigure(page, report.errors);
    const views = {};
    for (const [id, view] of Object.entries(spec.views)) {
      let snapshot;
      if (staticSource) {
        let state = structuredClone(figure.initialState);
        for (const a of view.actions || [{ type: 'pose', name: view.pose }]) {
          if (a.type === 'pose') {
            if (!Object.hasOwn(figure.poses, a.name))
              throw new Error(`Print view ${id}: unknown pose ${a.name}`);
            state = structuredClone(figure.poses[a.name]);
          } else if (a.type === 'state') state = structuredClone(a.value);
          else {
            if (typeof state.time !== 'number')
              throw new Error(`Print view ${id}: static time requires a numeric model time input`);
            state.time = a.value;
          }
        }
        if (view.time !== undefined) {
          if (typeof state.time !== 'number')
            throw new Error(`Print view ${id}: static time requires a numeric model time input`);
          state.time = view.time;
        }
        await buildFigure({ ...buildOptions, out: dir, stateValue: state });
        await openArtifact();
        snapshot = { state };
      } else if (
        !figure &&
        !(await page.locator('[data-figure]').evaluate(root => !!root.__craftedController))
      ) {
        if (view.actions || view.time !== undefined || view.pose !== manifest.pose)
          throw new Error(
            `Static artifact contains only pose ${manifest.pose}; supply the figure source to render other poses/actions`,
          );
        snapshot = { state: manifest.modelState ?? null };
      }
      views[id] = await captureView(page, view, spec.parts, id, snapshot);
      const css = scopedCSS(styleSheet(config, manifest.tokens), `svg[data-print-view="${id}"]`);
      views[id].svg = views[id].svg
        .replace(/<style>[\s\S]*?<\/style>/g, '')
        .replace('<svg ', `<svg data-print-view="${id}" `)
        .replace('</svg>', `<style>${esc(css)}</style></svg>`);
    }
    const files = {},
      summary = {};
    const layouts =
      format === 'all' ? formats : format === 'available' ? availableFormats(spec) : [format];
    for (const layout of layouts) {
      const doc = documentHTML(spec, views, paper, layout);
      await page.setContent(doc.html);
      const references = await page.locator('.sheet figure > svg').evaluateAll(namespacePrintSVGs);
      await page.emulateMedia({ media: 'print' });
      await page.evaluate(() => document.fonts.ready);
      const overflow = await page.locator('.sheet').evaluateAll(pages =>
        pages.flatMap((el, i) => {
          const r = el.getBoundingClientRect(),
            footer = el.querySelector('footer').getBoundingClientRect();
          return [...el.children]
            .filter(n => n.tagName !== 'FOOTER')
            .filter(n => {
              const b = n.getBoundingClientRect();
              return b.bottom > footer.top - 4 || b.right > r.right || b.left < r.left;
            })
            .map(n => ({ page: i + 1, element: n.tagName, text: n.textContent.slice(0, 100) }));
        }),
      );
      if (overflow.length)
        throw new Error(
          `Print overflow in ${layout}: ${JSON.stringify(overflow)}. Reduce text/detail or add pages; content was not truncated.`,
        );
      const stem = `${layout}-${paper}`;
      files[stem + '.html'] = await page.content();
      const pdf = await page.pdf({
        preferCSSPageSize: true,
        printBackground: true,
        displayHeaderFooter: false,
      });
      // Chromium emits wall-clock PDF Info dates. Blank those entries in place so
      // byte offsets/xref and compressed vector/image streams remain untouched.
      files[stem + '.pdf'] = Buffer.from(
        pdf
          .toString('latin1')
          .replace(/\/(?:CreationDate|ModDate) \(D:[0-9+'-]+\)/g, value =>
            ' '.repeat(value.length),
          ),
        'latin1',
      );
      if (options.png)
        for (let i = 0; i < doc.pages; i++)
          files[`${stem}-page-${i + 1}.png`] = await page
            .locator('.sheet')
            .nth(i)
            .screenshot({ scale: 'css' });
      summary[layout] = {
        pages: doc.pages,
        views: Object.fromEntries(
          Object.entries(views).map(([id, v]) => [
            id,
            {
              state: v.state,
              readout: v.readout,
              actionHash: hash(JSON.stringify(spec.views[id])),
              vectorPaths: v.vectorPaths,
              rasters: v.rasters,
              crop: v.crop,
            },
          ]),
        ),
      };
      report.formats.push({ layout, paper, pages: doc.pages, overflow: [], references });
    }
    if (report.errors.length) throw new Error(report.errors.join('\n'));
    const outputManifest = await writeOwnedSet(path.resolve(options.out), files, {
      generator: 'crafted-figures-print',
      manifestName: 'print-manifest.json',
      metadata: {
        schemaVersion: 1,
        toolkitVersion: manifest.toolkitVersion,
        paper,
        formats: summary,
        sourceContentHash: manifest.contentHash,
        specHash: hash(await readFile(specPath)),
      },
    });
    report.status = 'passed';
    return { report, manifest: outputManifest };
  } catch (e) {
    report.status = 'failed';
    report.errors.push(e.message);
    throw e;
  } finally {
    await browser?.close();
    await rm(temp, { recursive: true, force: true });
    await mkdir(options.out, { recursive: true });
    await writeFile(
      path.join(options.out, 'print-report.json'),
      JSON.stringify(report, null, 2) + '\n',
    );
  }
}
