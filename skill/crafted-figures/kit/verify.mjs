import { createServer } from 'node:http';
import { readFile, realpath, mkdir, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
import { launchChromium, waitForFigure } from './browser.mjs';
import { digest as hash } from './hash.mjs';
import { zBufferOrder } from './order-check.mjs';
/** Loopback-only, realpath-confined preview. */
export async function preview(dir, port = 4173) {
  const base = await realpath(path.resolve(dir));
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://127.0.0.1');
      let name = decodeURIComponent(url.pathname);
      if (name === '/') {
        const html = await stat(path.join(base, 'figure.html')).catch(() => null);
        name = html?.isFile() ? '/figure.html' : '/figure.svg';
      }
      const file = await realpath(path.resolve(base, '.' + name));
      if (!file.startsWith(base + path.sep)) throw new Error('outside preview');
      const data = await readFile(file);
      res.setHeader(
        'Content-Type',
        {
          '.html': 'text/html; charset=utf-8',
          '.svg': 'image/svg+xml',
          '.json': 'application/json',
          '.png': 'image/png',
        }[path.extname(file)] || 'application/octet-stream',
      );
      res.end(data);
    } catch {
      res.statusCode = 404;
      res.end('Not found');
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve(undefined));
  });
  return {
    url: `http://127.0.0.1:${/** @type {import('node:net').AddressInfo} */ (server.address()).port}`,
    close: () =>
      new Promise((resolve, reject) => server.close(e => (e ? reject(e) : resolve(undefined)))),
  };
}
export const launchBrowser = launchChromium;
/** Drive every named pose and range input through its span in the real page. Loading a figure
 * says nothing about the poses a reader can reach: an order failure or a readout that stops
 * following its control only shows up here. Each state is also compared with a depth buffer. */
async function sweepFigure(browser, dir, report) {
  const context = await browser.newContext({
      viewport: { width: 960, height: 1000 },
      reducedMotion: 'reduce',
    }),
    page = await context.newPage(),
    errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  try {
    await page.goto(pathToFileURL(path.join(dir, 'figure.html')).href);
    if (!(await page.locator('script').count())) return { status: 'not applicable' };
    await waitForFigure(page, errors);
    const root = page.locator('[data-figure]'),
      findings = [],
      depthFaults = new Map();
    const plan = await root.evaluate(el => {
      const controller = el.__craftedController;
      if (controller.stage?.renderer) controller.stage.renderer.verifyOrder = true;
      return {
        poses: controller.setPose ? controller.poseNames : [],
        inputs: [...el.querySelectorAll('[data-controls] input[type=range]')].map(input => ({
          min: Number(input.min),
          max: Number(input.max),
          name: input.labels?.[0]?.textContent ?? input.id,
        })),
      };
    });
    let depth = null,
      samples = 0;
    const inspect = async label => {
      const seen = await root.evaluate(el => ({
        live: el.querySelector('[data-live-readout]').textContent,
        drawn: el.querySelector('[data-part="static-readout"]')?.textContent,
        error: el.__craftedController.getStats?.().error,
      }));
      if (seen.live && seen.drawn !== undefined && seen.live !== seen.drawn)
        findings.push(`${label}: readout "${seen.live}" != drawing "${seen.drawn}"`);
      if (seen.error) findings.push(`${label}: ${seen.error}`);
      const order = await root.evaluate(zBufferOrder, { control: depth === null });
      if (depth === null)
        depth = {
          status: order.status,
          states: 0,
          control: order.control,
          reason: order.reason,
        };
      depth.states++;
      for (const f of order.findings || []) {
        const subject = f.part ?? (f.painted && `${f.painted} over ${f.expected}`),
          key = subject ? `${f.code} ${subject}` : f.code;
        depthFaults.set(key, {
          ...f,
          state: depthFaults.get(key)?.state ?? label,
          pixels: Math.max(f.pixels ?? 0, depthFaults.get(key)?.pixels ?? 0),
        });
      }
    };
    await inspect('initial state');
    for (const pose of plan.poses) {
      await root.evaluate(
        (el, name) => el.__craftedController.setPose(name, { immediate: true }),
        pose,
      );
      await inspect(`pose ${pose}`);
    }
    for (const [index, input] of plan.inputs.entries())
      for (let i = 0; i <= 8; i++) {
        const value = input.min + ((input.max - input.min) * i) / 8;
        await root.evaluate(
          (el, [n, v]) => {
            const control = el.querySelectorAll('[data-controls] input[type=range]')[n];
            control.value = String(v);
            control.dispatchEvent(new Event('input', { bubbles: true }));
          },
          [index, value],
        );
        samples++;
        await inspect(`input ${input.name} = ${value}`);
      }
    for (const [key, f] of depthFaults)
      findings.push(`${key} at ${f.state}${f.pixels ? ` (${f.pixels} px)` : ''}: ${f.message}`);
    if (depth) {
      if (depth.status === 'passed' || depth.status === 'failed')
        depth.status = depthFaults.size ? 'failed' : 'passed';
      depth.faults = [...depthFaults.values()];
    }
    const sweepErrors = [...findings, ...errors];
    report.errors.push(...sweepErrors.map(e => `sweep: ${e}`));
    return {
      status: sweepErrors.length ? 'failed' : 'passed',
      poses: plan.poses.length,
      inputs: plan.inputs.length,
      samples,
      findings,
      zbuffer: depth,
      errors,
    };
  } catch (e) {
    report.errors.push(`sweep: ${e.message}`);
    return { status: 'failed', errors: [e.message] };
  } finally {
    await context.close();
  }
}
/** Generic export checks; figure-specific model assertions belong to its own tests. */
export async function checkOutput(dir, reportDir) {
  dir = path.resolve(dir);
  reportDir = path.resolve(reportDir);
  await mkdir(reportDir, { recursive: true });
  const report = {
    status: 'failed',
    environment: { node: process.version, platform: os.platform(), arch: os.arch() },
    errors: [],
    checks: [],
    network: [],
    interaction:
      'loading plus a sweep of named poses and range inputs; figure-specific assertions are separate',
    sweep: { status: 'not applicable' },
  };
  let browser, server;
  try {
    const manifest = JSON.parse(await readFile(path.join(dir, 'build-manifest.json'), 'utf8'));
    if (manifest.generator !== 'crafted-figures')
      throw new Error('Invalid build manifest generator');
    const allowed = new Set(['figure.html', 'figure.svg', 'resolved-config.json']);
    for (const [name, digest] of Object.entries(manifest.outputHashes)) {
      if (!allowed.has(name)) throw new Error(`Unknown manifest output ${name}`);
      if (hash(await readFile(path.join(dir, name))) !== digest)
        throw new Error(`Output hash mismatch: ${name}`);
    }
    const outputs = ['figure.html', 'figure.svg'].filter(name => manifest.outputHashes[name]);
    if (!outputs.length) throw new Error('No deliverables in manifest');
    if (!outputs.includes('figure.html')) report.interaction = 'not applicable: static SVG only';
    browser = await launchBrowser();
    report.environment.browser = browser.version();
    report.environment.browserSource = browser.craftedSource;
    server = await preview(dir, 0);
    for (const name of outputs)
      for (const protocol of ['file', 'http'])
        for (const width of [390, 960]) {
          const context = await browser.newContext({
              viewport: { width, height: 800 },
              deviceScaleFactor: 1,
              reducedMotion: 'reduce',
            }),
            page = await context.newPage();
          const label = `${name}-${protocol}-${width}`;
          const errors = [];
          page.on('pageerror', e => errors.push(e.message));
          page.on('console', msg => {
            if (msg.type() === 'error') errors.push(msg.text());
          });
          await context.route('**/*', route => {
            const u = new URL(route.request().url());
            report.network.push({
              label,
              url: u.protocol === 'file:' ? name : u.origin === server.url ? u.pathname : u.href,
            });
            if (!['file:', 'data:'].includes(u.protocol) && u.origin !== server.url) {
              errors.push(`External request: ${u.href}`);
              route.abort();
            } else route.continue();
          });
          await page.goto(
            protocol === 'file'
              ? pathToFileURL(path.join(dir, name)).href
              : `${server.url}/${name}`,
          );
          if (name.endsWith('.html') && (await page.locator('script').count()))
            await waitForFigure(page, errors);
          await page.evaluate(() => document.fonts.ready);
          const structure = await page.evaluate(() => {
            const svg = document.querySelector('svg');
            return {
              title: Boolean(svg?.querySelector('title')?.textContent),
              description: Boolean(svg?.querySelector('desc')?.textContent),
              style: Boolean(svg?.querySelector('style')?.textContent),
              vector: Boolean(
                svg?.querySelector('path,rect,circle,ellipse,line,polyline,polygon,text,use'),
              ),
              overflow: document.documentElement.scrollWidth > innerWidth,
              forbidden: Boolean(svg?.querySelector('script,foreignObject,image')),
              labels: [...document.querySelectorAll('input,button')].every(el =>
                Boolean(
                  el.getAttribute('aria-label') ||
                    /** @type {HTMLInputElement} */ (el).labels?.length ||
                    el.textContent.trim(),
                ),
              ),
            };
          });
          for (const k of ['title', 'description', 'style', 'vector', 'labels'])
            if (!structure[k]) errors.push(`Missing ${k}`);
          if (structure.forbidden) errors.push('SVG contains script, foreignObject or image');
          if (structure.overflow) errors.push('Horizontal page overflow');
          // Chromium XML documents have no HTML body; Playwright fullPage capture waits
          // on HTML layout there. Capture the actual SVG rectangle instead.
          const capture = name.endsWith('.svg')
            ? { clip: await page.locator('svg').boundingBox() }
            : { fullPage: true };
          await page.screenshot({ path: path.join(reportDir, `${label}.png`), ...capture });
          report.checks.push({ label, structure, errors });
          report.errors.push(...errors.map(e => `${label}: ${e}`));
          await context.close();
        }
    if (outputs.includes('figure.html')) report.sweep = await sweepFigure(browser, dir, report);
    report.status = report.errors.length ? 'failed' : 'passed';
  } catch (e) {
    report.errors.push(e.message);
  } finally {
    await browser?.close();
    await server?.close();
    await writeFile(path.join(reportDir, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  }
  if (report.status !== 'passed')
    throw new Error(`Export check failed: ${report.errors.join('; ')}. Report: ${reportDir}`);
  return report;
}
