import { Vector2, Vector3, Matrix3, Matrix4, Raycaster } from '../../runtime/three.mjs';
import { assertSource, assertTransform } from './primitives.mjs';
import { firstFrontHit } from './raycast.mjs';
import { escapeText as esc } from '../text.mjs';
/** Rays per overlapping pair: evenly spaced overlap corners, plus the center. */
const MAX_PAIR_SAMPLES = 32;
const LIGHT = new Vector3(-1, 1, 0).normalize();
const outlinePath = d => `<path class="edge" style="stroke-linecap:round" d="${d}"/>`;
const svgPass = o => {
  for (let p = o; p; p = p.parent)
    if (p.userData.svgAfterLayer !== undefined) return p.userData.svgAfterLayer;
  return -1;
};
const num = v => {
  if (!Number.isFinite(v)) throw new Error('Non-finite projected geometry');
  return String(Number(v.toFixed(3)));
};
const pathOf = (points, closed = true) =>
  points.map((p, i) => `${i ? 'L' : 'M'}${num(p[0])} ${num(p[1])}`).join('') + (closed ? 'Z' : '');
const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
function hull(points) {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]),
    lo = [],
    hi = [];
  for (const v of p) {
    while (lo.length > 1 && cross(lo.at(-2), lo.at(-1), v) <= 1e-8) lo.pop();
    lo.push(v);
  }
  for (const v of p.reverse()) {
    while (hi.length > 1 && cross(hi.at(-2), hi.at(-1), v) <= 1e-8) hi.pop();
    hi.push(v);
  }
  return [...lo.slice(0, -1), ...hi.slice(0, -1)];
}
function intersection(subject, clip) {
  let out = subject;
  for (let i = 0; i < clip.length; i++) {
    const a = clip[i],
      b = clip[(i + 1) % clip.length],
      input = out;
    out = [];
    if (!input.length) break;
    for (let j = 0; j < input.length; j++) {
      const c = input[j],
        d = input[(j + 1) % input.length],
        dc = cross(a, b, c),
        dd = cross(a, b, d);
      if (dc >= -1e-8) out.push(c);
      if (dc >= 0 !== dd >= 0) {
        const t = dc / (dc - dd);
        out.push([c[0] + (d[0] - c[0]) * t, c[1] + (d[1] - c[1]) * t]);
      }
    }
  }
  return out;
}
/** Clip a surface polygon by an interpolated normal score. */
function clipScore(input, key, limit, greater = true) {
  const out = [];
  for (let i = 0; i < input.length; i++) {
    const a = input[i],
      b = input[(i + 1) % input.length],
      da = (a[key] - limit) * (greater ? 1 : -1),
      db = (b[key] - limit) * (greater ? 1 : -1);
    if (da >= 0) out.push(a);
    if (da >= 0 !== db >= 0) {
      const t = da / (da - db),
        p = {};
      for (const k of ['x', 'y', 'z', 'light', 'up', 'view']) p[k] = a[k] + (b[k] - a[k]) * t;
      out.push(p);
    }
  }
  return out;
}
const collapsed = ring =>
  ring.every(p => p[0] === ring[0][0] && p[1] === ring[0][1] && p[2] === ring[0][2]);
const sameElements = (a, b) => {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
};
const objectIds = new WeakMap();
let nextObjectId = 1;
function objectId(value) {
  if (value === null || typeof value !== 'object') return String(value);
  let id = objectIds.get(value);
  if (!id) {
    id = nextObjectId++;
    objectIds.set(value, id);
  }
  return `#${id}`;
}
const detailKeys = [
  'type',
  'text',
  'angle',
  'closed',
  'accent',
  'width',
  'part',
  'reason',
  'id',
  'size',
  'height',
];
const detailArrays = ['points', 'normal', 'at', 'u', 'v'];
/** Everything that can change a primitive's markup without changing its transform or
 * geometry. Frozen rings are checked by identity; detail arrays must be replaced, not edited
 * in place, for a change to redraw. */
function metadataSignature(m) {
  let signature = '';
  for (const key of Object.keys(m)) {
    if (key === 'details') continue;
    const value = m[key];
    signature += `${key}:${typeof value === 'object' ? objectId(value) : value}|`;
  }
  for (const detail of m.details || []) {
    for (const key of detailKeys) if (detail[key] !== undefined) signature += `${detail[key]}|`;
    for (const key of detailArrays) if (detail[key]) signature += `${objectId(detail[key])}|`;
  }
  return signature;
}
const insideConvex = (point, polygon) =>
  polygon.every((a, i) => cross(a, polygon[(i + 1) % polygon.length], point) >= 0);
/** Screen points on an annulus's rim. Convex parts cannot escape the overlap samples, because
 * the whole overlap belongs to both, but a thin rim can pass between all of them. */
function rimPoints(item, screen) {
  if (item.rim) return item.rim;
  const { top, bottom, inner } = item.mesh.userData.illustration,
    n = top.length,
    middle = (a, b) => a.map((v, k) => (v + b[k]) / 2),
    points = [];
  for (let i = 0; i < n; i++) {
    // The inner rings run in the opposite direction, so index i faces (n - i) % n.
    const opposite = (n - i) % n;
    points.push(screen(middle(top[i], inner.top[opposite])));
    points.push(screen(middle(bottom[i], inner.bottom[opposite])));
  }
  item.rim = points;
  return points;
}
/** Smallest-rank-first ready list for a deterministic topological order. */
function pushRank(heap, value) {
  let i = heap.length;
  heap.push(value);
  while (i > 0) {
    const parent = (i - 1) >> 1;
    if (heap[parent] <= heap[i]) break;
    [heap[parent], heap[i]] = [heap[i], heap[parent]];
    i = parent;
  }
}
function popRank(heap) {
  const top = heap[0],
    last = heap.pop();
  if (heap.length) {
    heap[0] = last;
    let i = 0;
    for (;;) {
      const left = 2 * i + 1,
        right = left + 1;
      let small = i;
      if (left < heap.length && heap[left] < heap[small]) small = left;
      if (right < heap.length && heap[right] < heap[small]) small = right;
      if (small === i) break;
      [heap[small], heap[i]] = [heap[i], heap[small]];
      i = small;
    }
  }
  return top;
}
// One compound filled path per tone. Shared subpath edges cancel in SVG's
// nonzero fill rule, preserving curved band boundaries without polygon-union
// tolerances or a visible tessellation grid.
function joinedPaths(polygons, screen) {
  return polygons.map(poly => pathOf(poly.map(p => screen([p.x, p.y, p.z])))).join('');
}
/** Finite SVG illustration renderer. Pure serialization works without a DOM.
 * Uses Three.js world/camera matrices and mesh raycasting; no scene-language layer.
 * The overlap probes diagnose observed interleaving, not arbitrary mesh correctness.
 */
export class IllustrationSVGRenderer {
  constructor({ width = 600, height = 400, strokeWidth = 0.6 } = {}) {
    this.width = width;
    this.height = height;
    this.strokeWidth = strokeWidth;
    this.rays = new Raycaster();
    this.cache = new WeakMap();
    this.pairs = new WeakMap();
    this.order = [];
    this.disposed = false;
    this.printMode = false;
    /** Live drawing trusts its first ray per pair. Verification tools set this to sample
     * every overlap, recording interleaving as a diagnostic. */
    this.verifyOrder = false;
    /** Painter problems met while drawing live; strict rendering throws them instead. */
    this.diagnostics = [];
    this.diagnosed = new Set();
    this.cameraElements = new Float64Array(32);
    this.cameraVersion = 0;
  }
  diagnose(code, parts, message) {
    const key = `${code}|${parts.join('|')}`;
    if (this.diagnosed.has(key)) return;
    this.diagnosed.add(key);
    this.diagnostics.push({ code, parts, message });
    console.error(`${code}: ${message}`);
  }
  project(point, camera) {
    const v = point.clone().project(camera);
    return [((v.x + 1) * this.width) / 2, ((1 - v.y) * this.height) / 2];
  }
  primitive(mesh, camera) {
    assertSource(mesh);
    const m = mesh.userData.illustration;
    if (!m || !['prism', 'annulus'].includes(m.kind))
      throw new Error(
        `Unsupported geometry "${mesh.name || mesh.type}": use the illustrated primitive helpers; arbitrary meshes are not supported`,
      );
    if (!['surface', 'accent'].includes(m.tone))
      throw new Error(`Unsupported semantic tone: ${m.tone}`);
    const cached = this.cache.get(mesh),
      signature = metadataSignature(m),
      moved = !cached || !sameElements(cached.matrix, mesh.matrixWorld.elements);
    if (moved) assertTransform(mesh);
    else if (
      cached.cameraVersion === this.cameraVersion &&
      cached.geometry === mesh.geometry &&
      cached.printMode === this.printMode &&
      cached.idPrefix === (this.idPrefix || '') &&
      cached.signature === signature
    )
      return cached;
    const normalMatrix = new Matrix3().getNormalMatrix(mesh.matrixWorld),
      view = camera.getWorldDirection(new Vector3()).negate(),
      light = m.toneLight ? new Vector3(...m.toneLight).normalize() : LIGHT;
    const screen = p => this.project(new Vector3(...p).applyMatrix4(mesh.matrixWorld), camera);
    const worldNormal = n => n.clone().applyMatrix3(normalMatrix).normalize();
    const visible = n => worldNormal(n).dot(view) > 1e-7;
    const color = n => {
      const normal = worldNormal(n);
      if (normal.z > 0.9) return 'top';
      return 'side-' + Math.max(0, Math.min(3, Math.floor((normal.dot(light) + 1) * 2)));
    };
    const top = m.top,
      bottom = m.bottom,
      n = top.length;
    if (n < 3 || bottom.length !== n) throw new Error(`Invalid primitive metadata: ${mesh.name}`);
    const topN = new Vector3(...top[1])
      .sub(new Vector3(...top[0]))
      .cross(new Vector3(...top[2]).sub(new Vector3(...top[0])))
      .normalize();
    if (topN.lengthSq() < 1e-12)
      topN.copy(
        new Vector3(...bottom[1])
          .sub(new Vector3(...bottom[0]))
          .cross(new Vector3(...bottom[2]).sub(new Vector3(...bottom[0])))
          .normalize(),
      );
    const bottomN = new Vector3(...bottom[1])
      .sub(new Vector3(...bottom[0]))
      .cross(new Vector3(...bottom[2]).sub(new Vector3(...bottom[0])))
      .normalize()
      .negate();
    if (bottomN.lengthSq() < 1e-12) bottomN.copy(topN).negate();
    const faces = [];
    // Smooth pieces share exact vertices. Disable independent fill antialiasing
    // at those shared edges; retain ordinary antialiased silhouette strokes.
    // A face-coloured seam stroke can erase the adjacent piece's outline.
    const joinStyle = fill => {
      if ((m.normals || m.perimeterEdges) && !this.printMode)
        return ' style="shape-rendering:crispEdges"';
      if (m.boundaryTop !== false && m.boundaryBottom !== false && !m.perimeterEdges) return '';
      const token =
        m.tone === 'accent' && !m.material
          ? fill === 'top'
            ? 'accentTop'
            : fill.replace('side-', 'accentSide')
          : fill.replace('side-', 'side');
      return ` style="stroke:var(--cf-${token});stroke-width:.5px;stroke-linejoin:round;vector-effect:non-scaling-stroke"`;
    };
    const sides = (top, bottom) => {
      const runs = top.map((_p, i) => {
        const next = (i + 1) % n;
        const normal = new Vector3(...bottom[next])
          .sub(new Vector3(...bottom[i]))
          .cross(new Vector3(...top[i]).sub(new Vector3(...bottom[i])))
          .normalize();
        return (!m.perimeterEdges || m.perimeterEdges[i]) && visible(normal) ? color(normal) : null;
      });
      let start = runs.findIndex((v, i) => v !== runs[(i + n - 1) % n]);
      if (start < 0) start = 0;
      for (let step = 0; step < n; ) {
        const i = (start + step) % n,
          fill = runs[i];
        let count = 1;
        while (step + count < n && runs[(i + count) % n] === fill) count++;
        if (fill) {
          const ids = Array.from({ length: count + 1 }, (_, j) => (i + j) % n);
          faces.push(
            `<path class="${fill}"${joinStyle(fill)} d="${pathOf([...ids.map(j => screen(top[j])), ...ids.reverse().map(j => screen(bottom[j]))])}"/>`,
          );
        }
        step += count;
      }
      return runs;
    };
    if (m.inner) sides(m.inner.top, m.inner.bottom);
    let runs;
    const smoothOutline = [],
      coverage = [];
    if (m.normals) {
      const regions = new Map(['top', 'side-0', 'side-1', 'side-2', 'side-3'].map(k => [k, []]));
      const vertex = (p, n) => {
        const normal = worldNormal(new Vector3(...n));
        return {
          x: p[0],
          y: p[1],
          z: p[2],
          light: Number(normal.dot(light).toFixed(10)),
          up: Number(normal.z.toFixed(10)),
          view: Number(normal.dot(view).toFixed(10)),
        };
      };
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n,
          surface = [
            vertex(bottom[i], m.normals.bottom[i]),
            vertex(bottom[j], m.normals.bottom[j]),
            vertex(top[j], m.normals.top[j]),
            vertex(top[i], m.normals.top[i]),
          ],
          poly = clipScore(surface, 'view', 0);
        // A smooth silhouette follows the same interpolated normal zero as the
        // visible fill. Chunk hull tangents leave gaps whenever the extremal
        // ring vertex changes; those are construction artifacts, not creases.
        const crossing = [];
        for (let e = 0; e < surface.length; e++) {
          const a = surface[e],
            b = surface[(e + 1) % surface.length];
          if (Math.abs(a.view) < 1e-9) crossing.push(screen([a.x, a.y, a.z]));
          if (a.view * b.view < 0) {
            const t = a.view / (a.view - b.view);
            crossing.push(
              screen([a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t]),
            );
          }
        }
        if (crossing.length === 2) smoothOutline.push(pathOf(crossing, false));
        if (poly.length < 3) continue;
        if (this.printMode) coverage.push(pathOf(poly.map(p => screen([p.x, p.y, p.z]))));
        const cap = clipScore(poly, 'up', 0.9);
        if (cap.length > 2) regions.get('top').push(cap);
        const side = clipScore(poly, 'up', 0.9, false);
        for (let band = 0; band < 4; band++) {
          const clipped = clipScore(
            clipScore(side, 'light', -1 + band * 0.5),
            'light',
            -0.5 + band * 0.5,
            false,
          );
          if (clipped.length > 2) regions.get('side-' + band).push(clipped);
        }
      }
      for (const [fill, polygons] of regions)
        if (polygons.length)
          faces.push(
            `<path class="${fill}"${joinStyle(fill)} d="${joinedPaths(polygons, screen)}"/>`,
          );
      runs = top.map(() => true);
    } else runs = sides(top, bottom);
    if (visible(topN) && m.boundaryTop !== false && !collapsed(top))
      faces.push(
        `<path class="${color(topN)}"${joinStyle(color(topN))} fill-rule="evenodd" d="${pathOf(top.map(screen))}${m.inner ? pathOf(m.inner.top.map(screen)) : ''}"/>`,
      );
    if (visible(bottomN) && m.boundaryBottom !== false && !collapsed(bottom))
      faces.push(
        `<path class="${color(bottomN)}"${joinStyle(color(bottomN))} fill-rule="evenodd" d="${pathOf(bottom.map(screen))}${m.inner ? pathOf(m.inner.bottom.map(screen)) : ''}"/>`,
      );
    const silhouette = hull([
      ...top.map((p, i) => [...screen(p), 1, i]),
      ...bottom.map((p, i) => [...screen(p), 0, i]),
    ]);
    let outline = '';
    for (let i = 0; i < silhouette.length; i++) {
      const a = silhouette[i],
        b = silhouette[(i + 1) % silhouette.length];
      if (
        a[2] !== b[2] &&
        m.perimeterEdges &&
        !(m.perimeterEdges[a[3]] && m.perimeterEdges[(a[3] + n - 1) % n])
      )
        continue;
      if (
        a[2] === b[2] &&
        ((a[2] ? m.boundaryTop === false : m.boundaryBottom === false) ||
          (m.perimeterEdges && !m.perimeterEdges[(a[3] + 1) % n === b[3] ? a[3] : b[3]]))
      )
        continue;
      outline += pathOf([a, b], false);
    }
    if (m.normals) outline = smoothOutline.join('');
    const edges = [];
    const perimeter = ring =>
      m.perimeterEdges
        ? ring
            .map((p, i) =>
              m.perimeterEdges[i] ? pathOf([screen(p), screen(ring[(i + 1) % n])], false) : '',
            )
            .join('')
        : pathOf(ring.map(screen));
    if (visible(topN) && m.boundaryTop !== false && !collapsed(top)) edges.push(perimeter(top));
    if (visible(bottomN) && m.boundaryBottom !== false && !collapsed(bottom))
      edges.push(perimeter(bottom));
    if (m.inner) {
      if (visible(topN)) edges.push(pathOf(m.inner.top.map(screen)));
      if (visible(bottomN)) edges.push(pathOf(m.inner.bottom.map(screen)));
    }
    if (m.crease)
      for (let i = 0; i < n; i++)
        if (runs[i] && runs[(i + n - 1) % n])
          edges.push(pathOf([screen(bottom[i]), screen(top[i])], false));
    const details = (m.details || [])
      .filter(d => visible(new Vector3(...d.normal)))
      .map(d => {
        const t = Math.min(1, worldNormal(new Vector3(...d.normal)).dot(view) / 0.12),
          fade = t * t * (3 - 2 * t);
        const opacity = fade < 1 ? ` opacity="${num(fade)}"` : '';
        if (d.type === 'display') {
          const p = screen(d.at),
            u = screen(d.at.map((x, i) => x + d.u[i])),
            v = screen(d.at.map((x, i) => x + d.v[i])),
            id = `${this.idPrefix || ''}display-${mesh.name}-${d.id}`;
          return `<g${opacity} transform="matrix(${[u[0] - p[0], u[1] - p[1], v[0] - p[0], v[1] - p[1], ...p].map(num).join(' ')})"><defs><clipPath id="${esc(id)}"><rect width="${num(d.width)}" height="${num(d.height)}"/></clipPath></defs><rect width="${num(d.width)}" height="${num(d.height)}" fill="var(--cf-side0)"/><g clip-path="url(#${esc(id)})"><text fill="var(--cf-top)" x="1" y="${num(d.size + 1)}" style="font:${num(d.size)}px var(--cf-mono)">${esc(d.text)}</text></g></g>`;
        }
        if (d.text !== undefined) {
          const p = screen(d.at),
            u = screen(d.at.map((v, i) => v + d.u[i])),
            v = screen(d.at.map((v, i) => v + d.v[i]));
          return `<text${opacity} class="caption" style="font-size:${num(d.size)}px" transform="matrix(${[u[0] - p[0], u[1] - p[1], v[0] - p[0], v[1] - p[1], ...p].map(num).join(' ')})">${esc(d.text)}</text>`;
        }
        return `<path${opacity}${d.reason ? ` data-line-reason="${esc(d.reason)}"` : ''}${d.part ? ` data-part="${esc(d.part)}"` : ''}${d.angle === undefined ? '' : ` data-angle="${esc(d.angle)}"`} class="line${d.accent ? ' accent-line' : ''}" style="stroke-width:${num(this.strokeWidth * d.width)}px" d="${pathOf(d.points.map(screen), d.closed)}"/>`;
      })
      .join('');
    const beforeOutline = `${m.inner || m.perimeterEdges || m.boundaryTop === false || m.boundaryBottom === false ? '' : `<path class="surface" d="${pathOf(silhouette)}"/>`}${faces.join('')}<path class="crease" d="${edges.join('')}"/>`,
      content = `${beforeOutline}${outlinePath(outline)}${details}`;
    const xs = silhouette.map(p => p[0]),
      ys = silhouette.map(p => p[1]);
    const result = {
      mesh,
      matrix: Float64Array.from(mesh.matrixWorld.elements),
      inverse: new Matrix4().copy(mesh.matrixWorld).invert().elements,
      geometry: mesh.geometry,
      cameraVersion: this.cameraVersion,
      printMode: this.printMode,
      idPrefix: this.idPrefix || '',
      signature,
      silhouette,
      content,
      beforeOutline,
      outline,
      details,
      fillContent: faces.join(''),
      coverage: this.printMode
        ? coverage.join('') +
          (visible(topN) && m.boundaryTop !== false ? pathOf(top.map(screen)) : '') +
          (visible(bottomN) && m.boundaryBottom !== false
            ? pathOf([...bottom].reverse().map(screen))
            : '')
        : '',
      bounds: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
    };
    this.cache.set(mesh, result);
    return result;
  }
  /** The pair's depth order from rays, reusing it while the pair moves rigidly together.
   * Two convex parts that do not intersect have one depth order everywhere, so without
   * `full` sampling the first usable ray decides. `full` samples the overlap to detect
   * parts that do interleave.
   * @returns {{sign:number,interleaved:boolean}} */
  relation(a, b, camera, full = true) {
    let cache = this.pairs.get(a.mesh);
    if (!cache) {
      cache = new WeakMap();
      this.pairs.set(a.mesh, cache);
    }
    const ea = a.matrix,
      eb = b.matrix,
      prior = cache.get(b.mesh);
    if (
      prior &&
      prior.cameraVersion === this.cameraVersion &&
      (prior.full || !full) &&
      prior.a === a.geometry &&
      prior.b === b.geometry
    ) {
      const pa = prior.ea,
        pb = prior.eb;
      let same = true;
      for (let i = 0; i < 11 && same; i++) same = pa[i] === ea[i] && pb[i] === eb[i];
      if (
        same &&
        Math.abs(eb[12] - ea[12] - (pb[12] - pa[12])) < 1e-9 &&
        Math.abs(eb[13] - ea[13] - (pb[13] - pa[13])) < 1e-9 &&
        Math.abs(eb[14] - ea[14] - (pb[14] - pa[14])) < 1e-9
      )
        return prior;
    }
    let positive = 0,
      negative = 0;
    const overlap = intersection(a.silhouette, b.silhouette);
    if (overlap.length >= 3) {
      const center = overlap.reduce(
          (s, p) => [s[0] + p[0] / overlap.length, s[1] + p[1] / overlap.length],
          [0, 0],
        ),
        stride = Math.max(1, overlap.length / MAX_PAIR_SAMPLES),
        samples = [center];
      for (let i = 0; i < overlap.length; i += stride) {
        const p = overlap[Math.floor(i)];
        samples.push([center[0] * 0.04 + p[0] * 0.96, center[1] * 0.04 + p[1] * 0.96]);
      }
      for (const item of [a, b]) {
        if (!item.mesh.userData.illustration.inner) continue;
        const matrix = item.mesh.matrixWorld,
          rim = rimPoints(item, p =>
            this.project(new Vector3(...p).applyMatrix4(matrix), camera),
          ).filter(point => insideConvex(point, overlap)),
          spacing = Math.max(1, rim.length / MAX_PAIR_SAMPLES);
        for (let i = 0; i < rim.length; i += spacing) samples.push(rim[Math.floor(i)]);
      }
      for (const pt of samples) {
        this.rays.setFromCamera(
          new Vector2((pt[0] / this.width) * 2 - 1, 1 - (pt[1] / this.height) * 2),
          camera,
        );
        const x = firstFrontHit(a.mesh, a.inverse, this.rays.ray);
        if (x === null) continue;
        const y = firstFrontHit(b.mesh, b.inverse, this.rays.ray);
        if (y === null) continue;
        const delta = x - y;
        if (delta > 1e-4) positive++;
        else if (delta < -1e-4) negative++;
        if (!full && (positive || negative)) break;
      }
    }
    const relation = {
      a: a.geometry,
      b: b.geometry,
      ea,
      eb,
      cameraVersion: this.cameraVersion,
      full,
      interleaved: positive > 0 && negative > 0,
      sign: Math.sign(positive - negative) || (positive ? 1 : 0),
    };
    cache.set(b.mesh, relation);
    return relation;
  }
  /** @param {any} scene
   * @param {any} camera
   * @param {{strict?:boolean}} [options] Strict rendering (builds, audits) rejects a pose it
   * cannot order. A mounted figure instead draws its best order and records a diagnostic, so
   * one unsampled pose cannot stop the controls or desynchronize the readout.
   * @returns {Array<{name:string,attributes:Object,content:string}>} ordered vector parts */
  render(scene, camera, { strict = true } = {}) {
    if (this.disposed) throw new Error('IllustrationSVGRenderer disposed');
    if (!camera.isOrthographicCamera)
      throw new Error('Only fixed orthographic cameras are supported');
    scene.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
    camera.updateProjectionMatrix();
    const cameraElements = [...camera.matrixWorld.elements, ...camera.projectionMatrix.elements];
    if (!sameElements(this.cameraElements, cameraElements)) {
      this.cameraElements.set(cameraElements);
      this.cameraVersion++;
    }
    const fail = (code, parts, message) => {
        if (strict) throw new Error(message);
        this.diagnose(code, parts, message);
      },
      items = [],
      names = new Set();
    scene.traverseVisible(o => {
      if (o.isMesh) {
        if (o.userData.craftedEffect) return;
        if (names.has(o.name)) throw new Error(`Duplicate primitive name: ${o.name}`);
        names.add(o.name);
        items.push(this.primitive(o, camera));
      } else if (o.isLine || o.isPoints)
        throw new Error(`Unsupported geometry "${o.name || o.type}"; use surface marks`);
    });
    const edges = items.map(() => []),
      incoming = items.map(() => 0),
      byLeft = items.map((_, i) => i).sort((a, b) => items[a].bounds[0] - items[b].bounds[0]),
      open = [];
    for (const current of byLeft) {
      const left = items[current].bounds;
      for (let k = open.length - 1; k >= 0; k--) {
        const other = open[k],
          right = items[other].bounds;
        // Disjoint screen bounds cannot impose painter order.
        if (right[2] <= left[0]) {
          open[k] = open[open.length - 1];
          open.pop();
          continue;
        }
        if (!(left[2] > right[0] && right[2] > left[0] && left[3] > right[1] && right[3] > left[1]))
          continue;
        const i = Math.min(current, other),
          j = Math.max(current, other),
          { sign, interleaved } = this.relation(
            items[i],
            items[j],
            camera,
            strict || this.verifyOrder,
          );
        if (interleaved)
          fail(
            'PAINTER_INTERLEAVE',
            [items[i].mesh.name, items[j].mesh.name],
            `Unsupported intersecting/interleaved primitives: ${items[i].mesh.name} / ${items[j].mesh.name}; split the physical geometry`,
          );
        if (!sign) continue;
        const [a, b] = sign > 0 ? [i, j] : [j, i];
        if (svgPass(items[a].mesh) > svgPass(items[b].mesh)) {
          fail(
            'SVG_LAYER_ORDER',
            [items[a].mesh.name, items[b].mesh.name],
            `SVG_LAYER_ORDER: ${items[a].mesh.name} is behind ${items[b].mesh.name} but assigned to a later SVG pass`,
          );
          continue;
        }
        edges[a].push(b);
        incoming[b]++;
      }
      open.push(current);
    }
    const byName = items
        .map((_, i) => i)
        .sort((a, b) => (items[a].mesh.name < items[b].mesh.name ? -1 : 1)),
      rank = new Array(items.length);
    byName.forEach((item, position) => {
      rank[item] = position;
    });
    const order = [],
      ready = [];
    for (let i = 0; i < items.length; i++) if (incoming[i] === 0) pushRank(ready, rank[i]);
    while (ready.length) {
      const i = byName[popRank(ready)];
      order.push(i);
      for (const j of edges[i]) if (--incoming[j] === 0) pushRank(ready, rank[j]);
    }
    if (order.length !== items.length) {
      const placed = new Set(order),
        stuck = byName.filter(i => !placed.has(i));
      fail(
        'PAINTER_CYCLE',
        stuck.map(i => items[i].mesh.name),
        'Unsupported cyclic SVG painter order; split physical geometry instead of adding order biases',
      );
      order.push(...stuck);
    }
    this.order = order.map(i => items[i].mesh.name);
    // PDF consumers do not consistently honor SVG crispEdges. In print captures
    // only, close seams with face-coloured strokes clipped to the exact compound
    // coverage of the joined surface. This does not merge painter slots or move
    // geometry. Browser output avoids these large unused clip paths entirely.
    const contents = new Map();
    // Smooth bands share a silhouette, and a band's fill covers part of the outline of the
    // neighbour painted before it, which reads as a dashed line. Each band therefore redraws
    // the outlines of its earlier neighbours. Only adjacent bands do: a band further along
    // the surface may legitimately hide this one. A part painted between the two keeps its
    // place, so the neighbour's outline is not redrawn across it.
    const positions = new Map(order.map((item, position) => [items[item], position])),
      surfaces = new Map();
    for (const item of items) {
      const m = item.mesh.userData.illustration;
      if (!m.normals || !m.join) continue;
      const key = `${item.mesh.parent.uuid}|${m.join}|${svgPass(item.mesh)}`;
      if (!surfaces.has(key)) surfaces.set(key, new Map());
      surfaces.get(key).set(m.chunk, item);
    }
    for (const bands of surfaces.values())
      for (const [chunk, item] of bands) {
        let shared = '';
        for (const neighbour of [bands.get(chunk - 1), bands.get(chunk + 1)]) {
          if (!neighbour || positions.get(neighbour) > positions.get(item)) continue;
          const b = neighbour.bounds;
          let crossed = false;
          for (let p = positions.get(neighbour) + 1; p < positions.get(item) && !crossed; p++) {
            const other = items[order[p]],
              o = other.bounds;
            crossed =
              other.mesh.parent !== item.mesh.parent &&
              o[2] > b[0] &&
              b[2] > o[0] &&
              o[3] > b[1] &&
              b[3] > o[1];
          }
          if (!crossed) shared += neighbour.outline;
        }
        if (shared)
          contents.set(
            item.mesh,
            `${item.beforeOutline}${outlinePath(shared + item.outline)}${item.details}`,
          );
      }
    if (this.printMode) {
      const joined = new Map();
      for (const i of order) {
        const item = items[i],
          m = item.mesh.userData.illustration;
        if (!m.normals || !m.join) continue;
        const key = item.mesh.parent.uuid + '|' + m.join + '|' + svgPass(item.mesh);
        if (!joined.has(key)) joined.set(key, []);
        joined.get(key).push(item);
      }
      for (const group of joined.values()) {
        const id = `${this.idPrefix || ''}surface-${group[0].mesh.name}`,
          clip = `<defs><clipPath id="${esc(id)}"><path d="${group.map(p => p.coverage).join('')}"/></clipPath></defs>`;
        for (const [j, item] of group.entries())
          contents.set(
            item.mesh,
            (j === 0 ? clip : '') +
              (contents.get(item.mesh) || item.content).replace(
                item.fillContent,
                `<g clip-path="url(#${esc(id)})">${item.fillContent}</g>`,
              ),
          );
      }
    }
    return order.map(i => {
      const { mesh } = items[i],
        content = contents.get(mesh) || items[i].content,
        m = mesh.userData.illustration;
      return {
        name: mesh.name,
        attributes: {
          'data-object': mesh.name,
          'data-svg-pass': String(svgPass(mesh)),
          'data-assemblies': (() => {
            const names = [];
            for (let p = mesh.parent; p; p = p.parent) if (p.name) names.push(p.name);
            return names.join(' ');
          })(),
          ...(m.effectFallback ? { 'data-effect-fallback': m.effectFallback } : {}),
          ...(m.join ? { 'data-join': m.join } : {}),
          ...(m.part ? { 'data-part': m.part } : {}),
          ...(m.angle === undefined ? {} : { 'data-angle': num(m.angle) }),
          class: `solid${m.tone === 'accent' && !m.material ? ' accent' : ''}`,
          ...(m.materialStyle ? { style: m.materialStyle } : {}),
        },
        content,
      };
    });
  }
  serialize(scene, camera) {
    return this.render(scene, camera)
      .map(
        p =>
          `<g ${Object.entries(p.attributes)
            .map(([k, v]) => `${k}="${esc(v)}"`)
            .join(' ')}>${p.content}</g>`,
      )
      .join('');
  }
  /** Update only changed parts and actual order changes; keep the surrounding SVG. */
  mount(group, scene, camera) {
    this.idPrefix = group.ownerSVGElement?.dataset.idPrefix || '';
    const nodes = new Map();
    let disposed = false;
    for (const el of [...group.children])
      if (el.hasAttribute('data-object'))
        nodes.set(el.getAttribute('data-object'), { el, content: el.innerHTML });
    const update = () => {
      if (disposed) return;
      const parts = this.render(scene, camera, { strict: false }),
        keep = new Set();
      const cursors = new Map(
        [group, ...(this.passTargets?.values() || [])].map(g => [g, g.firstElementChild]),
      );
      for (const p of parts) {
        keep.add(p.name);
        let node = nodes.get(p.name);
        if (!node) {
          node = { el: group.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'g') };
          nodes.set(p.name, node);
        }
        for (const [k, v] of Object.entries(p.attributes))
          if (node.el.getAttribute(k) !== v) node.el.setAttribute(k, v);
        if (node.content !== p.content) {
          node.el.innerHTML = p.content;
          node.content = p.content;
        }
        const target = this.passTargets?.get(Number(p.attributes['data-svg-pass'])) || group,
          old = node.el.parentElement;
        if (old !== target && cursors.get(old) === node.el)
          cursors.set(old, node.el.nextElementSibling);
        const cursor = cursors.get(target);
        if (cursor === node.el) cursors.set(target, cursor.nextElementSibling);
        else target.insertBefore(node.el, cursor);
      }
      for (const [name, node] of nodes)
        if (!keep.has(name)) {
          node.el.remove();
          nodes.delete(name);
        }
    };
    this.mountedUpdate = update;
    update();
    return {
      update,
      dispose: () => {
        disposed = true;
        nodes.clear();
        this.mountedUpdate = null;
      },
    };
  }
  setPassTargets(targets) {
    this.passTargets = targets;
    this.mountedUpdate?.();
  }
  dispose() {
    this.disposed = true;
    this.cache = new WeakMap();
    this.pairs = new WeakMap();
    this.order = [];
    this.diagnostics = [];
    this.diagnosed.clear();
  }
}
