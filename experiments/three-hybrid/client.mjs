import * as THREE from 'three';
import { SVGRenderer } from 'three/addons/renderers/SVGRenderer.js';
import { createScene } from './scene.mjs';
import { poses, rotorState } from './model.mjs';
import { IllustrationSVGRenderer } from './IllustrationSVGRenderer.mjs';
import { DepthOverlay } from './overlay.mjs';
import { scalarMotion } from '../../skill/crafted-figures/kit/model-runtime.mjs';
/** The prototype deliberately exposes a diagnostic handle, not a stable toolkit API. */
export function mountPrototype(root, config, tokens) {
  const data = createScene(tokens),
    { scene, camera, marker, solids } = data,
    stage = root.querySelector('[data-stage]'),
    input = root.querySelector('input'),
    readout = root.querySelector('output'),
    status = root.querySelector('[data-status]');
  const illustration = new IllustrationSVGRenderer(tokens),
    canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.className = 'overlay';
  stage.replaceChildren(illustration.domElement, canvas);
  let overlay = null,
    fallbackReason = null,
    disposed = false,
    current = poses.rest,
    renderCount = 0,
    lastSignature = '',
    motion;
  try {
    if (window.__disableWebGL) throw new Error('WebGL disabled for fallback verification');
    overlay = new DepthOverlay(data, canvas);
  } catch (e) {
    fallbackReason = e.message;
    canvas.remove();
    illustration.fallback = true;
  }
  const describe = () => {
    status.textContent = overlay
      ? 'SVG solids + depth-tested WebGL marker'
      : `Vector fallback · ${fallbackReason}`;
    root.dataset.webgl = String(Boolean(overlay));
  };
  describe();
  const render = (state, force = false) => {
    if (disposed) return;
    current = rotorState(state);
    data.update(current);
    input.value = String(current.angleDeg);
    readout.textContent = current.reading;
    input.setAttribute('aria-valuetext', current.reading);
    const signature = `${current.angleDeg}:${illustration.width}:${illustration.height}:${illustration.fallback}`;
    if (force || signature !== lastSignature) {
      illustration.render(scene, camera);
      lastSignature = signature;
      renderCount++;
    }
    overlay?.render();
  };
  const resize = () => {
    if (disposed) return;
    const b = stage.getBoundingClientRect();
    data.resize(b.width, b.height);
    illustration.setSize(b.width, b.height);
    overlay?.setSize(b.width, b.height);
    render(current, true);
  };
  resize();
  const observer = new ResizeObserver(resize);
  observer.observe(stage);
  const abort = new AbortController(),
    opts = { signal: abort.signal };
  const createMotion = (tour = false) =>
    scalarMotion({
      root,
      motion: { ...config.motion, idleTour: tour },
      initial: current.angleDeg,
      idleAt: t => (243 + t * 0.035) % 360,
      draw: value => render({ angleDeg: value }),
    });
  motion = createMotion();
  input.addEventListener('input', () => motion.set(Number(input.value)), opts);
  for (const button of root.querySelectorAll('[data-pose]'))
    button.addEventListener('click', () => motion.set(poses[button.dataset.pose].angleDeg), opts);
  let pointer = null;
  const move = e => {
    const b = stage.getBoundingClientRect();
    motion.set(Math.min(360, Math.max(0, ((e.clientX - b.left) / b.width) * 360)));
  };
  stage.addEventListener(
    'pointerdown',
    e => {
      if (e.button !== 0) return;
      pointer = e.pointerId;
      stage.setPointerCapture(pointer);
      move(e);
    },
    opts,
  );
  stage.addEventListener(
    'pointermove',
    e => {
      if (e.pointerId === pointer) move(e);
    },
    opts,
  );
  const release = () => {
    if (pointer !== null && stage.hasPointerCapture(pointer)) stage.releasePointerCapture(pointer);
    pointer = null;
  };
  stage.addEventListener('pointerup', release, opts);
  stage.addEventListener('pointercancel', release, opts);
  const loss = e => {
    e.preventDefault();
    if (disposed) return;
    overlay?.dispose();
    overlay = null;
    fallbackReason = 'WebGL context lost';
    illustration.fallback = true;
    describe();
    render(current, true);
  };
  canvas.addEventListener('webglcontextlost', loss, opts);
  const diagnostics = {
    get state() {
      return current;
    },
    get stats() {
      return {
        renderCount,
        motion: { ...motion.stats },
        canvases: stage.querySelectorAll('canvas').length,
        nodes: illustration.domElement.querySelectorAll('*').length,
        webgl: Boolean(overlay),
        fallbackReason,
        disposed,
        gpuMemory: overlay ? { ...overlay.renderer.info.memory } : null,
        sceneChildren: scene.children.length,
        ratio: overlay?.ratio,
        width: illustration.width,
        height: illustration.height,
      };
    },
    setAngle(angle) {
      motion.set(angle);
    },
    pose(angle) {
      motion.dispose();
      render({ angleDeg: angle });
      motion = createMotion();
    },
    play() {
      motion.dispose();
      motion = createMotion(true);
    },
    stop() {
      motion.set(current.angleDeg);
    },
    resize,
    snapshot() {
      return illustration.domElement.outerHTML;
    },
    fallbackSVG() {
      const was = illustration.fallback;
      illustration.fallback = true;
      illustration.render(scene, camera);
      const svg = illustration.domElement.outerHTML;
      illustration.fallback = was;
      render(current, true);
      return svg;
    },
    stock() {
      const renderer = new SVGRenderer();
      renderer.domElement.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      renderer.setClearColor(tokens.card);
      renderer.setPrecision(3);
      renderer.setSize(illustration.width, illustration.height);
      const m = marker.visible;
      marker.visible = false;
      renderer.render(scene, camera);
      marker.visible = m;
      return {
        svg: renderer.domElement.outerHTML,
        nodes: renderer.domElement.querySelectorAll('*').length,
        faces: renderer.info.render.faces,
      };
    },
    unsupported() {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(2), new THREE.MeshBasicMaterial());
      mesh.name = 'unsupported-sphere';
      scene.add(mesh);
      let message = '';
      try {
        illustration.render(scene, camera);
      } catch (e) {
        message = e.message;
      } finally {
        scene.remove(mesh);
        mesh.geometry.dispose();
        mesh.material.dispose();
        render(current, true);
      }
      return message;
    },
    gpuInfo() {
      if (!overlay) return null;
      const gl = overlay.renderer.getContext(),
        ext = gl.getExtension('WEBGL_debug_renderer_info');
      return {
        vendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
        renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      };
    },
    occlusion() {
      if (!overlay) throw new Error('GPU occlusion evidence unavailable in fallback');
      const masked = overlay.pixels(),
        bare = overlay.pixels({ occlusion: false });
      const rays = new THREE.Raycaster(),
        w = masked.width,
        h = masked.height;
      let opaqueLeaks = 0,
        visiblePixels = 0,
        unoccludedPixels = 0,
        occludedInterior = 0;
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          if (bare.data[i + 3] > 5) unoccludedPixels++;
          if (masked.data[i + 3] > 5) visiblePixels++;
          if (bare.data[i + 3] < 20) continue;
          rays.setFromCamera(
            new THREE.Vector2(((x + 0.5) / w) * 2 - 1, ((y + 0.5) / h) * 2 - 1),
            camera,
          );
          const effect = rays.intersectObject(marker, false)[0],
            hit = rays.intersectObjects(solids, false)[0];
          if (effect && hit && hit.distance < effect.distance - 0.001) {
            // Interior confirmation excludes the one-device-pixel antialias boundary.
            let interior = true;
            for (const [dx, dy] of [
              [-1, 0],
              [1, 0],
              [0, -1],
              [0, 1],
            ]) {
              rays.setFromCamera(
                new THREE.Vector2(((x + 0.5 + dx) / w) * 2 - 1, ((y + 0.5 + dy) / h) * 2 - 1),
                camera,
              );
              const a = rays.intersectObjects(solids, false)[0],
                b = rays.intersectObject(marker, false)[0];
              if (!a || !b || a.distance >= b.distance) interior = false;
            }
            if (interior) {
              occludedInterior++;
              if (masked.data[i + 3] > 5) opaqueLeaks++;
            }
          }
        }
      overlay.render();
      return {
        angle: current.angleDeg,
        visiblePixels,
        unoccludedPixels,
        visibleFraction: visiblePixels / unoccludedPixels,
        occludedInterior,
        opaqueLeaks,
        order: illustration.order,
      };
    },
    fiducials() {
      if (!overlay) throw new Error('GPU alignment evidence unavailable in fallback');
      const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xff00ff, 0xffff00],
        points = [
          [-60, -40, 9],
          [60, -40, 9],
          [-60, 40, 9],
          [60, 40, 9],
          [0, 0, 100],
        ],
        meshes = [];
      const saved = [...solids, marker].map(o => o.visible);
      for (const o of [...solids, marker]) o.visible = false;
      points.forEach((p, i) => {
        const mesh = new THREE.Mesh(
          new THREE.CircleGeometry(1.7, 64),
          new THREE.MeshBasicMaterial({
            color: colors[i],
            toneMapped: false,
            side: THREE.DoubleSide,
          }),
        );
        mesh.position.fromArray(p);
        mesh.quaternion.copy(camera.quaternion);
        mesh.userData.diagnostic = true;
        scene.add(mesh);
        meshes.push(mesh);
      });
      scene.updateMatrixWorld(true);
      const gl = overlay.renderer,
        target = overlay.target;
      gl.setRenderTarget(target);
      gl.clear(true, true, true);
      gl.render(scene, camera);
      const bytes = new Uint8Array(target.width * target.height * 4);
      gl.readRenderTargetPixels(target, 0, 0, target.width, target.height, bytes);
      const results = points.map((p, index) => {
        const rgb = [(colors[index] >> 16) & 255, (colors[index] >> 8) & 255, colors[index] & 255];
        let sx = 0,
          sy = 0,
          n = 0;
        for (let y = 0; y < target.height; y++)
          for (let x = 0; x < target.width; x++) {
            const i = (y * target.width + x) * 4;
            if (bytes[i + 3] > 200 && rgb.every((v, k) => Math.abs(bytes[i + k] - v) < 10)) {
              sx += x + 0.5;
              sy += y + 0.5;
              n++;
            }
          }
        const svg = illustration.project(new THREE.Vector3(...p), camera),
          gpu = [
            (sx / n / target.width) * illustration.width,
            (1 - sy / n / target.height) * illustration.height,
          ];
        return {
          world: p,
          svg,
          gpu,
          pixels: n,
          error: Math.hypot(svg[0] - gpu[0], svg[1] - gpu[1]),
        };
      });
      // Render actual GPU fiducials to visible canvas, and independent SVG crosshairs.
      gl.setRenderTarget(null);
      gl.clear(true, true, true);
      gl.render(scene, camera);
      illustration.domElement.innerHTML =
        '<title>GPU registration fiducials</title>' +
        results
          .map(
            r =>
              `<path d="M${r.svg[0] - 6} ${r.svg[1]}h12M${r.svg[0]} ${r.svg[1] - 6}v12" stroke="${tokens.text}" stroke-width=".7"/>`,
          )
          .join('');
      meshes.forEach(o => {
        scene.remove(o);
        o.geometry.dispose();
        o.material.dispose();
      });
      for (const [i, o] of [...solids, marker].entries()) o.visible = saved[i];
      return results;
    },
    restore() {
      render(current, true);
    },
    async profile() {
      motion.dispose();
      const results = [];
      for (const mode of ['clock', 'svg', 'webgl', 'hybrid']) {
        const intervals = [],
          costs = [];
        let last = null;
        await new Promise(resolve => {
          let count = 0;
          function step(now) {
            if (last !== null && count > 10) intervals.push(now - last);
            last = now;
            const start = performance.now();
            if (mode !== 'clock') {
              data.update({ angleDeg: (count * 3) % 360 });
              if (mode === 'svg' || mode === 'hybrid') illustration.render(scene, camera);
              if (mode === 'webgl' || mode === 'hybrid') overlay?.render();
            }
            if (count > 10) costs.push(performance.now() - start);
            if (++count < 80) requestAnimationFrame(step);
            else resolve();
          }
          requestAnimationFrame(step);
        });
        intervals.sort((a, b) => a - b);
        costs.sort((a, b) => a - b);
        results.push({
          mode,
          samples: intervals.length,
          medianIntervalMs: intervals[Math.floor(intervals.length * 0.5)],
          p95IntervalMs: intervals[Math.floor(intervals.length * 0.95)],
          medianSubmissionMs: costs[Math.floor(costs.length * 0.5)],
          p95SubmissionMs: costs[Math.floor(costs.length * 0.95)],
        });
      }
      render(current, true);
      motion = createMotion();
      return results;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      release();
      abort.abort();
      observer.disconnect();
      motion.dispose();
      overlay?.dispose();
      illustration.dispose();
      data.dispose();
      stage.replaceChildren();
    },
  };
  return diagnostics;
}
