import path from 'node:path';
import { writeFile } from 'node:fs/promises';
import { zBufferOrder } from './order-check.mjs';
/** Deterministic clip evidence for the common runner. State changes are immediate;
 * screen displacement is checked separately from a known intentional state jump. */
export async function sampleStates(page, action, reportDir) {
  const frames = [],
    findings = [];
  let prior;
  let nextFrame = Date.now();
  for (const [index, state] of action.states.entries()) {
    if (action.delayMs) {
      const wait = Math.max(0, nextFrame - Date.now());
      if (wait) await page.waitForTimeout(wait);
      nextFrame = Math.max(nextFrame, Date.now()) + action.delayMs;
    }
    await page.locator('[data-figure]').evaluate(async (root, state) => {
      const c = root.__craftedController;
      if (!c?.setState) throw new Error('Sampled clip requires setState');
      c.pause?.();
      await c.setState(state, { immediate: true });
    }, state);
    await page.waitForFunction(state => {
      const c = document.querySelector('[data-figure]').__craftedController,
        s = c.getState();
      return (
        !c.getStats?.().pending &&
        Object.entries(state).every(([k, v]) =>
          typeof v === 'number'
            ? Math.abs(s[k] - v) < 1e-6
            : JSON.stringify(s[k]) === JSON.stringify(v),
        )
      );
    }, state);

    const snapshot = await page.locator('[data-figure]').evaluate((root, _state) => {
      const c = root.__craftedController;
      if (!c?.setState) throw new Error('Sampled clip requires setState');
      const s = root.__craftedController?.stage,
        parts = {};
      s?.scene.updateMatrixWorld(true);
      s?.scene.traverseVisible(o => {
        if (o.isMesh && !o.userData.craftedEffect) {
          const p = o.position.clone();
          o.getWorldPosition(p);
          parts[o.name] = s.renderer.project(p, s.camera);
        }
      });
      return {
        state: c.getState(),
        readout: root.querySelector('[data-live-readout]').textContent,
        parts,
        order: s?.inspectOrder(root),
      };
    }, state);
    if (snapshot.order?.status === 'failed')
      findings.push(...snapshot.order.findings.map(f => ({ ...f, frame: index })));
    if (prior && action.maxStep !== undefined)
      for (const [name, p] of Object.entries(snapshot.parts)) {
        const q = prior.parts[name];
        if (!q) continue;
        const distance = Math.hypot(p[0] - q[0], p[1] - q[1]);
        if (distance > action.maxStep)
          findings.push({
            code: 'TEMPORAL_POP',
            part: name,
            frame: index,
            distance,
            tolerance: action.maxStep,
          });
      }
    if (prior && action.visibility) {
      const allowed = new Set(action.allowVisibilityChanges || []);
      for (const name of new Set([...Object.keys(prior.parts), ...Object.keys(snapshot.parts)]))
        if (!allowed.has(name) && Boolean(prior.parts[name]) !== Boolean(snapshot.parts[name]))
          findings.push({
            code: 'VISIBILITY_POP',
            part: name,
            frame: index,
            message: 'Unexpected appearance/disappearance between deterministic samples',
          });
    }
    if (action.zbuffer) {
      const depth = await page.locator('[data-figure]').evaluate(zBufferOrder, {});
      if (depth.status !== 'passed')
        findings.push(...depth.findings.map(f => ({ ...f, frame: index })));
      snapshot.zbuffer = depth;
    }
    if (action.fidelity) {
      const fidelity = await page
        .locator('[data-figure]')
        .evaluate(root => root.__craftedController.stage.inspectOrder(root, { tones: true }));
      if (fidelity.status !== 'passed')
        findings.push(...fidelity.findings.map(f => ({ ...f, frame: index })));
      snapshot.fidelity = fidelity;
    }
    const filename = `${action.name}-${String(index).padStart(3, '0')}.png`;
    await page
      .locator('svg.crafted')
      .first()
      .screenshot({ path: path.join(reportDir, filename) });
    frames.push({ ...snapshot, capture: filename });
    prior = snapshot;
  }
  // Offline contact sheet: original frames plus their model/readout, never an
  // auto-accepted screenshot baseline. No image library or remote asset required.
  return { status: findings.length ? 'failed' : 'passed', frames, findings };
}
export async function captureCrop(page, { selector, region, scale = 4 }, filename) {
  const target = page.locator(selector || 'svg.crafted').first(),
    bounds = await target.boundingBox();
  if (!bounds) throw new Error('Crop target is not visible');
  const [x, y, w, h] = region;
  if (w <= 0 || h <= 0 || x < 0 || y < 0 || x + w > 1 || y + h > 1)
    throw new Error('Crop region uses contained normalized [x,y,width,height]');
  const session = await page.context().newCDPSession(page),
    viewport = page.viewportSize(),
    dpr = await page.evaluate(() => devicePixelRatio);
  try {
    await session.send('Emulation.setDeviceMetricsOverride', {
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: scale,
      mobile: false,
    });
    await page.evaluate(() => new Promise(requestAnimationFrame));
    const scroll = await page.evaluate(() => ({ x: scrollX, y: scrollY })),
      clip = {
        x: bounds.x + x * bounds.width + scroll.x,
        y: bounds.y + y * bounds.height + scroll.y,
        width: w * bounds.width,
        height: h * bounds.height,
        scale: 1,
      };
    const { data } = await session.send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: true,
      clip,
    });
    const bytes = Buffer.from(data, 'base64'),
      width = bytes.readUInt32BE(16),
      height = bytes.readUInt32BE(20);
    if (Math.abs(width - clip.width * scale) > 2 || Math.abs(height - clip.height * scale) > 2)
      throw new Error(
        `Crop pixel scale mismatch: ${width}x${height}, expected ${clip.width * scale}x${clip.height * scale}`,
      );
    await writeFile(filename, bytes);
    return { width, height, scale, cssRegion: clip };
  } finally {
    await session.send('Emulation.setDeviceMetricsOverride', {
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: dpr,
      mobile: false,
    });
    await session.detach();
  }
}
