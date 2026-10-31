import { inspectEffects, loseEffectsContext } from './effect-checks.mjs';
import { runtimeIdentity } from './provenance.mjs';
import { sampleStates, captureCrop } from './capture.mjs';
import Ajv from '../runtime/ajv.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { launchChromium, waitForFigure } from './browser.mjs';
import { readJSON } from './config.mjs';
import { escapeText } from './text.mjs';
import { zBufferOrder } from './order-check.mjs';
const object = (properties, required = []) => ({
    type: 'object',
    properties,
    required,
    additionalProperties: false,
  }),
  str = { type: 'string', minLength: 1 },
  point = {
    type: 'array',
    items: { type: 'number', minimum: 0, maximum: 1 },
    minItems: 2,
    maxItems: 2,
  };
const action = (type, properties = {}, required = []) =>
  object({ type: { const: type }, ...properties }, ['type', ...required]);
export const driveSchema = object(
  {
    schemaVersion: { const: 1 },
    viewport: object(
      {
        width: { type: 'integer', minimum: 200, maximum: 4000 },
        height: { type: 'integer', minimum: 200, maximum: 4000 },
      },
      ['width', 'height'],
    ),
    reducedMotion: { type: 'boolean' },
    webgl: { type: 'boolean' },
    actions: {
      type: 'array',
      minItems: 1,
      items: {
        oneOf: [
          action(
            'move',
            { selector: str, to: point, steps: { type: 'integer', minimum: 1, maximum: 240 } },
            ['selector', 'to'],
          ),
          action(
            'playback',
            {
              name: { type: 'string', pattern: '^[a-zA-Z0-9_-]+$' },
              from: { type: 'number', minimum: 0 },
              to: { type: 'number', minimum: 0 },
              rate: { type: 'number', minimum: 0.05, maximum: 1 },
              fps: { type: 'integer', minimum: 1, maximum: 30 },
              maxStep: { type: 'number', exclusiveMinimum: 0 },
            },
            ['name', 'from', 'to'],
          ),
          action('fidelity'),
          action('effects', {
            mode: { enum: ['webgl', 'vector'] },
            tolerance: { type: 'number', minimum: 0, maximum: 1 },
            boundaries: { type: 'boolean' },
            requiredFallbacks: { type: 'array', items: str },
            landmarks: {
              type: 'array',
              items: object({ effect: str, visibility: { enum: ['visible', 'hidden'] } }, [
                'effect',
              ]),
            },
          }),
          action('contextLoss', { requiredFallbacks: { type: 'array', items: str } }),
          action('click', { selector: str }, ['selector']),
          action('key', { selector: str, key: str }, ['selector', 'key']),
          action('text', { selector: str, value: str }, ['selector', 'value']),
          action(
            'drag',
            {
              selector: str,
              from: point,
              to: point,
              steps: { type: 'integer', minimum: 1, maximum: 240 },
            },
            ['selector', 'from', 'to'],
          ),
          action('pose', { name: str }, ['name']),
          action('state', { value: { type: 'object' } }, ['value']),
          action('time', { value: { type: 'number', minimum: 0 } }, ['value']),
          action('wait', {
            state: { type: 'object' },
            readout: str,
            timeoutMs: { type: 'integer', minimum: 1, maximum: 30000 },
          }),
          action(
            'capture',
            { name: { type: 'string', pattern: '^[a-zA-Z0-9_-]+$' }, selector: str },
            ['name'],
          ),
          action('order'),
          action('zbuffer', {
            scale: { type: 'number', minimum: 1, maximum: 4 },
            control: { type: 'boolean' },
          }),
          action(
            'crop',
            {
              name: { type: 'string', pattern: '^[a-zA-Z0-9_-]+$' },
              selector: str,
              region: {
                type: 'array',
                items: { type: 'number', minimum: 0, maximum: 1 },
                minItems: 4,
                maxItems: 4,
              },
              scale: { type: 'number', minimum: 1, maximum: 4 },
            },
            ['name', 'region'],
          ),
          action(
            'samples',
            {
              name: { type: 'string', pattern: '^[a-zA-Z0-9_-]+$' },
              states: { type: 'array', minItems: 2, maxItems: 240, items: { type: 'object' } },
              maxStep: { type: 'number', exclusiveMinimum: 0 },
              visibility: { type: 'boolean' },
              allowVisibilityChanges: { type: 'array', items: str },
              fidelity: { type: 'boolean' },
              zbuffer: { type: 'boolean' },
            },
            ['name', 'states'],
          ),
          action('lines'),
          action('dispose'),
        ],
      },
    },
  },
  ['schemaVersion', 'actions'],
);
const validate = new Ajv({ allErrors: true }).compile(driveSchema);
/** Browser checks use actual SVG path metrics, including curves/arcs, not a path regex approximation. */
export async function inspectLines(page) {
  return page.evaluate(() => {
    const nodes = [...document.querySelectorAll('svg .line')],
      findings = [],
      samples = [];
    for (const el of nodes) {
      if (el.getAttribute('data-line-reason')) continue;
      if (typeof el.getTotalLength !== 'function') {
        findings.push({
          code: 'LINE_UNSUPPORTED',
          part: el.closest('[data-object]')?.getAttribute('data-object'),
          message: 'Unsupported visible line markup',
        });
        continue;
      }
      const style = getComputedStyle(el);
      if (style.display === 'none' || Number(style.opacity) === 0) continue;
      if (el.tagName === 'path' && (el.getAttribute('d').match(/[mM]/g) || []).length > 1) {
        findings.push({
          code: 'LINE_UNSUPPORTED',
          message:
            'Multiple open subpaths need separate authored marks or a specific ending reason',
        });
        continue;
      }
      const length = el.getTotalLength(),
        matrix = el.getScreenCTM(),
        world = p => new DOMPoint(p.x, p.y).matrixTransform(matrix),
        id = el.closest('[data-object]')?.getAttribute('data-object');
      const points = [];
      for (let i = 0; i <= Math.ceil(length * 2); i++)
        points.push(world(el.getPointAtLength(Math.min(length, i / 2))));
      samples.push({
        el,
        id,
        points,
        ends: [world(el.getPointAtLength(0)), world(el.getPointAtLength(length))],
        closed: /[zZ]\s*$/.test(el.getAttribute('d') || ''),
      });
    }
    const boundaries = new Map();
    for (const s of samples) {
      const host = s.el.closest('[data-object]');
      if (!host || boundaries.has(host)) continue;
      const points = [];
      // Bands of one joined surface share a silhouette, and a band may draw its neighbour's.
      const surface = host.dataset.join
        ? host.parentElement.querySelectorAll(
            `[data-join="${CSS.escape(host.dataset.join)}"] path.edge`,
          )
        : [];
      for (const edge of [...host.querySelectorAll('path.edge,path.crease'), ...surface]) {
        if (!edge.getAttribute('d')) continue;
        const length = edge.getTotalLength(),
          matrix = edge.getScreenCTM();
        for (let i = 0; i <= Math.ceil(length * 2); i++) {
          const p = edge.getPointAtLength(Math.min(length, i / 2));
          points.push(new DOMPoint(p.x, p.y).matrixTransform(matrix));
        }
      }
      boundaries.set(host, points);
    }
    for (const s of samples) {
      if (s.closed) continue;
      for (const [index, p] of s.ends.entries()) {
        if (p.x < 0 || p.y < 0 || p.x >= innerWidth || p.y >= innerHeight) {
          findings.push({
            code: 'LINE_UNSUPPORTED',
            part: s.id,
            end: index,
            message:
              'Endpoint outside the captured viewport; enlarge or scroll the scenario before checking',
          });
          continue;
        }
        const old = s.el.style.pointerEvents;
        s.el.style.pointerEvents = 'stroke';
        const probe = s.el.getPointAtLength(
            index ? Math.max(0, s.el.getTotalLength() - 0.5) : Math.min(0.5, s.el.getTotalLength()),
          ),
          screen = new DOMPoint(probe.x, probe.y).matrixTransform(s.el.getScreenCTM());
        const visible = document.elementsFromPoint(screen.x, screen.y).includes(s.el);
        s.el.style.pointerEvents = old;
        if (!visible) continue; // Real browser hit testing applies ancestor clipping and display/fading.
        let nearest = Infinity;
        for (const q of boundaries.get(s.el.closest('[data-object]')) || [])
          nearest = Math.min(nearest, Math.hypot(p.x - q.x, p.y - q.y));
        for (const o of samples)
          if (o !== s)
            for (const q of o.points) nearest = Math.min(nearest, Math.hypot(p.x - q.x, p.y - q.y));
        if (nearest > 1.5)
          findings.push({
            code: 'LINE_END',
            part: s.id,
            end: index,
            distance: Number.isFinite(nearest) ? nearest : null,
            tolerance: 1.5,
            message:
              'Unjoined line end; terminate at a boundary or record its specific printed/functional purpose',
          });
      }
    }
    return {
      status: findings.length ? 'failed' : 'passed',
      findings,
      checked: samples.length,
      explicitReasons: nodes.filter(n => n.getAttribute('data-line-reason')).length,
    };
  });
}
export async function drive(options) {
  const scenario = await readJSON(options.actions);
  if (!validate(scenario)) throw new Error(`drive actions: ${JSON.stringify(validate.errors)}`);
  await mkdir(options.report, { recursive: true });
  const report = {
    schemaVersion: 1,
    ...(await runtimeIdentity()),
    status: 'running',
    actions: [],
    errors: [],
    network: [],
    environment: { node: process.version, platform: process.platform },
  };
  let browser;
  try {
    browser = await launchChromium({ headless: true });
    report.environment.browser = browser.version();
    report.environment.browserSource = browser.craftedSource;
    const page = await browser.newPage({
      viewport: scenario.viewport || { width: 960, height: 850 },
      reducedMotion: scenario.reducedMotion ? 'reduce' : 'no-preference',
    });
    if (scenario.webgl === false)
      await page.addInitScript(() => {
        const original = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (type, ...args) {
          return String(type).includes('webgl') ? null : original.call(this, type, ...args);
        };
      });
    page.on('pageerror', e => report.errors.push(e.message));
    page.on('console', m => {
      if (m.type() === 'error') report.errors.push(m.text());
    });
    page.on('request', r => {
      if (/^https?:/.test(r.url())) report.network.push(r.url());
    });
    await page.goto(pathToFileURL(path.resolve(options.dir, 'figure.html')).href);
    await waitForFigure(page, report.errors, { selector: '[data-figure][data-ready=true]' });
    await page.locator('[data-figure]').evaluate(root => {
      const renderer = root.__craftedController?.stage?.renderer;
      if (renderer) renderer.verifyOrder = true;
    });
    for (const a of scenario.actions) {
      const root = '[data-figure]';
      if (a.type === 'move') {
        const b = await page.locator(a.selector).boundingBox();
        if (!b) throw new Error('move target is not visible');
        await page.mouse.move(b.x + b.width * a.to[0], b.y + b.height * a.to[1], {
          steps: a.steps || 1,
        });
      }
      if (a.type === 'click') await page.locator(a.selector).click();
      if (a.type === 'key') await page.locator(a.selector).press(a.key);
      if (a.type === 'text') await page.locator(a.selector).fill(a.value);
      if (a.type === 'drag') {
        const b = await page.locator(a.selector).boundingBox();
        if (!b) throw new Error('drag target is not visible');
        await page.mouse.move(b.x + b.width * a.from[0], b.y + b.height * a.from[1]);
        await page.mouse.down();
        await page.mouse.move(b.x + b.width * a.to[0], b.y + b.height * a.to[1], {
          steps: a.steps || 12,
        });
        await page.mouse.up();
      }
      if (['pose', 'state', 'time'].includes(a.type))
        await page.locator(root).evaluate((el, a) => {
          const c = el.__craftedController,
            method = { pose: 'setPose', state: 'setState', time: 'setTime' }[a.type];
          if (typeof c?.[method] !== 'function')
            throw new Error(`Controller does not support ${method}`);
          c[method](a.name ?? a.value, { immediate: true });
        }, a);
      if (a.type === 'wait')
        await page.waitForFunction(
          a => {
            const root = document.querySelector('[data-figure]'),
              c = root.__craftedController,
              s = c?.getState?.();
            return (
              (!a.readout ||
                root.querySelector('[data-live-readout]').textContent.includes(a.readout)) &&
              (!a.state ||
                Object.entries(a.state).every(([k, v]) =>
                  typeof v === 'number' ? Math.abs(s?.[k] - v) < 1e-4 : s?.[k] === v,
                )) &&
              !c?.getStats?.().pending
            );
          },
          a,
          { timeout: a.timeoutMs || 10000 },
        );
      let sampling;
      if (['samples', 'playback'].includes(a.type)) {
        let requested = a;
        if (a.type === 'playback') {
          if (a.to <= a.from) throw new Error('playback: to must exceed from');
          const rate = a.rate ?? 0.25,
            fps = a.fps ?? 8,
            count = Math.ceil(((a.to - a.from) / rate) * fps);
          if (count > 240)
            throw new Error('playback: at most 240 frames; shorten the clip or lower fps');
          const base = await page.locator(root).evaluate(el => el.__craftedController.getState());
          if (typeof base.time !== 'number')
            throw new Error('playback requires a numeric time model and deterministic setTime');
          requested = {
            ...a,
            states: Array.from({ length: count + 1 }, (_, i) => ({
              ...base,
              time: a.from + ((a.to - a.from) * i) / count,
            })),
            delayMs: 1000 / fps,
          };
        }
        sampling = await sampleStates(page, requested, options.report);
        if (sampling.status !== 'passed')
          report.errors.push(
            ...sampling.findings.map(f => `${f.code}: ${f.message || f.part || f.actual || ''}`),
          );
        await writeFile(
          path.join(options.report, a.name + '-sheet.html'),
          `<!doctype html><html><head><meta charset="utf-8"><title>Sampled states</title><style>body{font:14px system-ui;display:grid;grid-template-columns:repeat(4,1fr);gap:12px}img{width:100%}figure{margin:0}</style></head><body>${sampling.frames.map(f => `<figure><img src="${f.capture}"><figcaption>${escapeText(f.readout)} · ${escapeText(JSON.stringify(f.state))}</figcaption></figure>`).join('')}</body></html>`,
        );
      }
      let order;
      if (['order', 'fidelity'].includes(a.type)) {
        order = await page.locator(root).evaluate((el, tones) => {
          if (!el.__craftedController?.stage?.inspectOrder)
            throw new Error('Figure does not expose painted-order checks');
          return el.__craftedController?.stage.inspectOrder(el, { tones });
        }, a.type === 'fidelity');
        if (order.status !== 'passed')
          report.errors.push(
            ...order.findings.map(
              f => `${f.code}: ${f.message || [f.actual, f.expected].join(' / ')}`,
            ),
          );
      }
      let zbuffer;
      if (a.type === 'zbuffer') {
        zbuffer = await page
          .locator(root)
          .evaluate(zBufferOrder, { scale: a.scale, control: a.control });
        if (zbuffer.status !== 'passed')
          report.errors.push(
            ...(zbuffer.findings.length
              ? zbuffer.findings
              : [{ code: 'ZBUFFER_NOT_RUN', message: zbuffer.reason }]
            ).map(f => `${f.code}: ${f.message}`),
          );
      }
      let effects;
      if (['effects', 'contextLoss'].includes(a.type)) {
        effects = await (a.type === 'contextLoss' ? loseEffectsContext : inspectEffects)(page, a);
        if (effects.status !== 'passed')
          report.errors.push(
            ...effects.findings.map(f => `${f.code}: ${f.effect || f.message || ''}`),
          );
      }
      if (a.type === 'crop') await captureCrop(page, a, path.join(options.report, a.name + '.png'));
      let lines;
      if (a.type === 'lines') {
        lines = await inspectLines(page);
        if (lines.status !== 'passed')
          report.errors.push(...lines.findings.map(f => `${f.code}: ${f.part || ''} ${f.message}`));
      }
      let capture;
      if (a.type === 'capture') {
        capture = a.name + '.png';
        if (a.selector)
          await page.locator(a.selector).screenshot({ path: path.join(options.report, capture) });
        else await page.screenshot({ path: path.join(options.report, capture), fullPage: true });
      }
      const snapshot = await page.locator(root).evaluate(el => ({
        state: el.__craftedController?.getState?.(),
        readout: el.querySelector('[data-live-readout]')?.textContent,
        stats: el.__craftedController?.getStats?.(),
      }));
      if (a.type === 'dispose')
        await page.locator(root).evaluate(el => el.__craftedController.dispose());
      report.actions.push({
        action: a,
        ...snapshot,
        ...(capture ? { capture } : {}),
        ...(lines ? { lines } : {}),
        ...(order ? { order } : {}),
        ...(zbuffer ? { zbuffer } : {}),
        ...(sampling ? { sampling } : {}),
        ...(effects ? { effects } : {}),
      });
    }
    report.status = report.errors.length || report.network.length ? 'failed' : 'passed';
  } catch (e) {
    report.status = 'failed';
    report.errors.push(e.message);
  } finally {
    await browser?.close();
    await writeFile(
      path.join(options.report, 'report.json'),
      JSON.stringify(report, null, 2) + '\n',
    );
  }
  return report;
}
