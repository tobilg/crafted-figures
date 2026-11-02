import { Raycaster, Vector2, Vector3 } from '../../runtime/three.mjs';
import { escapeText as esc } from '../text.mjs';

/** A badge's radius in drawing units at scale 1, which is what a figure without JavaScript shows. */
const BADGE_RADIUS = 10;
/** The radius a live figure keeps on screen, so numbers stay legible at any width. */
const TARGET_RADIUS_PX = 11;
/** Badges are placed so they still clear each other at this width, a narrow phone's drawing. */
const NARROW_DRAWING_PX = 340;
/** How far in front of its anchor a surface can be, in world units, before it hides the anchor. */
const HIDDEN_TOLERANCE = 1.5;
const CELL = 8;
const ID = /^[a-zA-Z][a-zA-Z0-9_-]*$/;

const STYLES = `[data-callouts]{pointer-events:none}
.callout-leader{fill:none;stroke:var(--cf-text);stroke-width:1px;vector-effect:non-scaling-stroke}
.callout-dot circle{fill:var(--cf-text)}
.callout-face{transform:scale(var(--cf-callout-scale,1))}
.callout-face circle{fill:var(--cf-card);stroke:var(--cf-text);stroke-width:1.2px;vector-effect:non-scaling-stroke}
.callout-face text{fill:var(--cf-text);font:600 11px var(--cf-body);text-anchor:middle}
[data-callout][data-active] .callout-face circle{fill:var(--cf-accent)}
[data-callout][data-active] .callout-face text{fill:var(--cf-accentInk)}
.callout-key{display:inline-block;min-width:1.6em;height:1.6em;line-height:1.5em;margin-right:.45em;border:1px solid var(--cf-text);border-radius:.8em;font-size:.82em;font-weight:600;text-align:center}
dt[data-active] .callout-key{background:var(--cf-accent);color:var(--cf-accentInk)}`;

const round = v => {
  if (!Number.isFinite(v)) throw new Error('Non-finite callout position');
  return Number(v.toFixed(1));
};
const sides = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
const segmentsCross = (a, b, c, d) =>
  sides(a, b, c) * sides(a, b, d) < 0 && sides(c, d, a) * sides(c, d, b) < 0;
function insideConvex(point, polygon) {
  let sign = 0;
  for (let i = 0; i < polygon.length; i++) {
    const side = sides(polygon[i], polygon[(i + 1) % polygon.length], point);
    if (side === 0) continue;
    if (sign && Math.sign(side) !== sign) return false;
    sign = Math.sign(side);
  }
  return true;
}
/** Which parts of the drawing are covered, on a coarse grid, for preferring empty paper. */
function coverage(items, width, height) {
  const columns = Math.ceil(width / CELL),
    rows = Math.ceil(height / CELL),
    covered = new Uint8Array(columns * rows);
  for (const { bounds, silhouette } of items) {
    const left = Math.max(0, Math.floor(bounds[0] / CELL)),
      right = Math.min(columns - 1, Math.floor(bounds[2] / CELL)),
      top = Math.max(0, Math.floor(bounds[1] / CELL)),
      bottom = Math.min(rows - 1, Math.floor(bounds[3] / CELL));
    for (let y = top; y <= bottom; y++)
      for (let x = left; x <= right; x++)
        if (
          !covered[y * columns + x] &&
          insideConvex([(x + 0.5) * CELL, (y + 0.5) * CELL], silhouette)
        )
          covered[y * columns + x] = 1;
  }
  return (x, y) => {
    const column = Math.floor(x / CELL),
      row = Math.floor(y / CELL);
    return column >= 0 && column < columns && row >= 0 && row < rows
      ? covered[row * columns + column]
      : 0;
  };
}

/** Numbered badges with leaders to points on the drawing, and a matching legend.
 *
 * Call it last while building the scene, with `pose` setting the scene to its rest pose. Badges
 * are placed against that pose, so they land in the same spots whichever state a figure is drawn
 * at. The stage then draws the callouts in every static and live output and keeps each leader on
 * its anchor as parts move. `check` fails when badges collide, leave the drawing, or point at
 * something hidden.
 *
 * Each item needs `id`, `label` and `description`, and an anchor: `part` (an object or its name,
 * optionally with a local `at`), or `at` as a world point or as a function of the model. Use the
 * name for a part that `replacePart` swaps, because the old object leaves the scene. `active(model)`
 * highlights it and `visible(model)` hides it; both use the value last given to `update`. `offset`
 * puts the badge relative to its anchor and `badge` puts it at a drawing position. `follow` keeps
 * the badge at its offset as the anchor moves. `mayHide` declares a part that can really pass
 * behind another, which `check` then accepts.
 * @param {any} stage
 * @param {Array<{id:string,label:string,description:string,part?:any|string,at?:number[]|((model:any)=>number[]),active?:(model:any)=>boolean,visible?:(model:any)=>boolean,offset?:number[],badge?:number[],follow?:boolean,mayHide?:boolean}>} items
 * @param {{pose:()=>void}} options
 */
export function callouts(stage, items, { pose } = /** @type {any} */ ({})) {
  if (!Array.isArray(items) || !items.length)
    throw new Error('callouts: provide at least one item');
  if (typeof pose !== 'function')
    throw new Error(
      'callouts: pass {pose: () => update(poses.rest)}, so badges are placed against the rest pose',
    );
  const ids = new Set();
  for (const item of items) {
    if (typeof item.id !== 'string' || !ID.test(item.id))
      throw new Error(`callouts: invalid id ${JSON.stringify(item.id)}`);
    if (ids.has(item.id)) throw new Error(`callouts: duplicate id "${item.id}"`);
    ids.add(item.id);
    if (typeof item.label !== 'string' || typeof item.description !== 'string')
      throw new Error(`callouts: ${item.id} needs a label and a description`);
    if (!item.part && item.at === undefined)
      throw new Error(`callouts: ${item.id} needs a part or an at point`);
    if (item.badge && item.offset)
      throw new Error(`callouts: ${item.id} has both badge and offset; choose one`);
  }
  const { renderer, camera, scene, width, height } = stage,
    narrowRadius = (TARGET_RADIUS_PX * width) / NARROW_DRAWING_PX,
    bottom = height - (stage.frame?.bottom ?? 0);
  let model,
    placed = null,
    observer = null;
  const drawnParts = () => {
    const parts = [];
    scene.traverseVisible(o => {
      if (o.isMesh && !o.userData.craftedEffect) parts.push(renderer.primitive(o, camera));
    });
    return parts;
  };

  const ofModel = (item, read) => {
    if (model === undefined)
      throw new Error(
        `callouts: "${item.id}" reads the model, so the scene's update must call stage.callouts?.update(model)`,
      );
    return read(model);
  };
  const partOf = item => {
    if (typeof item.part !== 'string') return item.part;
    const part = scene.getObjectByName(item.part);
    if (!part) throw new Error(`callouts: "${item.id}" names no part called "${item.part}"`);
    return part;
  };
  const worldAnchor = item => {
    const at = typeof item.at === 'function' ? ofModel(item, item.at) : (item.at ?? [0, 0, 0]);
    return item.part ? partOf(item).localToWorld(new Vector3(...at)) : new Vector3(...at);
  };
  const anchorOf = item => renderer.project(worldAnchor(item), camera);
  const isShown = item => {
    for (let o = partOf(item); o; o = o.parent) if (!o.visible) return false;
    return item.visible ? Boolean(ofModel(item, item.visible)) : true;
  };

  /** Fix every badge once, against the rest pose, so numbers stay put while the figure moves. */
  function place() {
    const anchors = items.map(anchorOf),
      isCovered = coverage(drawnParts(), width, height),
      middle = anchors
        .reduce((sum, a) => [sum[0] + a[0], sum[1] + a[1]], [0, 0])
        .map(v => v / items.length),
      badges = items.map((item, i) => {
        if (item.badge) return [...item.badge];
        return item.offset
          ? [anchors[i][0] + item.offset[0], anchors[i][1] + item.offset[1]]
          : null;
      }),
      scale = width / 600,
      spacing = narrowRadius * 2 + 2;
    for (const [i, item] of items.entries()) {
      if (badges[i]) continue;
      let best = null,
        bestCost = Infinity;
      const a = anchors[i],
        outward = Math.atan2(a[1] - middle[1], a[0] - middle[0]);
      for (const reach of [36, 52, 68, 84, 100, 120, 140, 170, 200, 240])
        for (let step = 0; step < 24; step++) {
          const angle = (step * Math.PI) / 12,
            distance = reach * scale,
            c = [a[0] + distance * Math.cos(angle), a[1] + distance * Math.sin(angle)];
          if (
            c[0] < narrowRadius ||
            c[0] > width - narrowRadius ||
            c[1] < narrowRadius ||
            c[1] > bottom - narrowRadius
          )
            continue;
          if (
            badges.some(b => b && Math.hypot(b[0] - c[0], b[1] - c[1]) < spacing) ||
            anchors.some((o, j) => j !== i && Math.hypot(o[0] - c[0], o[1] - c[1]) < narrowRadius)
          )
            continue;
          // Prefer empty paper, short leaders pointing away from the middle, and no crossings.
          const r = narrowRadius * 0.7,
            over =
              isCovered(c[0], c[1]) +
              isCovered(c[0] - r, c[1]) +
              isCovered(c[0] + r, c[1]) +
              isCovered(c[0], c[1] - r) +
              isCovered(c[0], c[1] + r),
            crossings = badges.filter((b, j) => b && segmentsCross(a, c, anchors[j], b)).length,
            passes = anchors.filter((o, j) => {
              if (j === i) return false;
              const dx = c[0] - a[0],
                dy = c[1] - a[1],
                t = Math.max(
                  0,
                  Math.min(1, ((o[0] - a[0]) * dx + (o[1] - a[1]) * dy) / (dx * dx + dy * dy)),
                );
              return Math.hypot(a[0] + t * dx - o[0], a[1] + t * dy - o[1]) < 5 * scale;
            }).length,
            cost =
              reach * 1.7 +
              over * 34 +
              crossings * 400 +
              passes * 120 +
              30 * (1 - Math.cos(angle - outward));
          if (cost < bestCost) {
            bestCost = cost;
            best = c;
          }
        }
      if (!best)
        throw new Error(
          `CALLOUT_NO_ROOM: no room for a badge on "${item.id}" that clears the others; enlarge the drawing, use fewer callouts, or give it a badge position`,
        );
      badges[i] = best;
    }
    // Where two leaders still cross, trading their badges uncrosses them.
    const movable = items.map(item => !item.badge && !item.offset);
    for (let pass = 0; pass < 4; pass++) {
      let changed = false;
      for (let i = 0; i < items.length; i++)
        for (let j = i + 1; j < items.length; j++)
          if (
            movable[i] &&
            movable[j] &&
            segmentsCross(anchors[i], badges[i], anchors[j], badges[j])
          ) {
            [badges[i], badges[j]] = [badges[j], badges[i]];
            changed = true;
          }
      if (!changed) break;
    }
    placed = items.map((item, i) => ({
      item,
      number: i + 1,
      badge: badges[i],
      offset: [badges[i][0] - anchors[i][0], badges[i][1] - anchors[i][1]],
    }));
  }

  const badgeAt = (entry, anchor) =>
    entry.item.follow ? [anchor[0] + entry.offset[0], anchor[1] + entry.offset[1]] : entry.badge;
  const isActive = item => (item.active ? Boolean(ofModel(item, item.active)) : false);
  const leader = (a, b) => `M${round(a[0])} ${round(a[1])}L${round(b[0])} ${round(b[1])}`;
  const translate = p => `translate(${round(p[0])} ${round(p[1])})`;

  const api = {
    /** Give the callouts the current model, for `at`, `active` and `visible` functions. */
    update(next) {
      model = next;
    },
    /** Legend rows for the render result, numbered like the badges. */
    legend: () =>
      items.map((item, i) => ({
        label: item.label,
        description: item.description,
        callout: item.id,
        number: i + 1,
        active: isActive(item),
      })),
    markup() {
      const groups = placed.map(entry => {
        const { item, number } = entry,
          a = anchorOf(item),
          b = badgeAt(entry, a);
        return `<g data-callout="${esc(item.id)}"${isActive(item) ? ' data-active=""' : ''}${isShown(item) ? '' : ' display="none"'}><path class="callout-leader" d="${leader(a, b)}"/><g class="callout-dot" transform="${translate(a)}"><circle r="1.8"/></g><g class="callout-badge" transform="${translate(b)}"><g class="callout-face"><circle r="${BADGE_RADIUS}"/><text y="3.9">${number}</text></g></g></g>`;
      });
      return `<g data-callouts aria-hidden="true"><style>${STYLES}</style>${groups.join('')}</g>`;
    },
    /** Keep drawn callouts on their anchors, and their legend rows in step. */
    sync(group) {
      const svg = group.ownerSVGElement,
        host = svg.parentElement;
      for (const entry of placed) {
        const { item } = entry,
          node = group.querySelector(`[data-callouts] [data-callout="${item.id}"]`);
        if (!node) continue;
        const a = anchorOf(item),
          b = badgeAt(entry, a),
          active = isActive(item);
        node.querySelector('.callout-leader').setAttribute('d', leader(a, b));
        node.querySelector('.callout-dot').setAttribute('transform', translate(a));
        node.querySelector('.callout-badge').setAttribute('transform', translate(b));
        if (isShown(item)) node.removeAttribute('display');
        else node.setAttribute('display', 'none');
        for (const row of host.querySelectorAll(`[data-callout="${item.id}"]`))
          row.toggleAttribute('data-active', active);
      }
    },
    /** Hold badges at the same size on screen as the drawing resizes. */
    attach(group) {
      const svg = group.ownerSVGElement;
      if (!group.querySelector(':scope > [data-callouts]'))
        group.insertAdjacentHTML('beforeend', api.markup());
      const fit = () => {
        const box = svg.getBoundingClientRect();
        if (box.width)
          svg.style.setProperty(
            '--cf-callout-scale',
            String(
              Number(
                (
                  (TARGET_RADIUS_PX / BADGE_RADIUS) *
                  (svg.viewBox.baseVal.width / box.width)
                ).toFixed(3),
              ),
            ),
          );
      };
      fit();
      if (typeof ResizeObserver === 'function') {
        observer = new ResizeObserver(fit);
        observer.observe(svg);
      }
    },
    detach() {
      observer?.disconnect();
      observer = null;
    },
    /** Findings for the drawn state: what `check` fails a figure on.
     * @param {number} [drawnWidth] the drawing's width on screen, for the badges' real size
     * @returns {Array<{code:string,id:string,message:string}>} */
    inspect(drawnWidth) {
      const scale = drawnWidth ? (TARGET_RADIUS_PX / BADGE_RADIUS) * (width / drawnWidth) : 1,
        radius = BADGE_RADIUS * scale,
        findings = [],
        meshes = [],
        rays = new Raycaster();
      scene.updateMatrixWorld(true);
      scene.traverseVisible(o => {
        if (o.isMesh && !o.userData.craftedEffect) meshes.push(o);
      });
      const shown = placed
        .filter(({ item }) => isShown(item))
        .map(entry => {
          const a = anchorOf(entry.item);
          return { ...entry, a, b: badgeAt(entry, a) };
        });
      for (const { item, a, b } of shown) {
        if (
          b[0] - radius < 0 ||
          b[0] + radius > width ||
          b[1] - radius < 0 ||
          b[1] + radius > height ||
          a[0] < 0 ||
          a[0] > width ||
          a[1] < 0 ||
          a[1] > height
        )
          findings.push({
            code: 'CALLOUT_OUTSIDE',
            id: item.id,
            message: `callout "${item.id}" leaves the drawing; move its badge or anchor inside`,
          });
        if (item.mayHide) continue;
        const world = worldAnchor(item);
        rays.setFromCamera(new Vector2((a[0] / width) * 2 - 1, 1 - (a[1] / height) * 2), camera);
        const depth = world.clone().sub(rays.ray.origin).dot(rays.ray.direction),
          hit = rays.intersectObjects(meshes, false)[0];
        if (!hit || hit.distance >= depth - HIDDEN_TOLERANCE) continue;
        let own = false;
        const part = partOf(item);
        for (let o = hit.object; o && !own; o = o.parent) own = o === part;
        if (!own)
          findings.push({
            code: 'CALLOUT_HIDDEN',
            id: item.id,
            message: `callout "${item.id}" points at a spot behind ${hit.object.name}. If that is the part it labels, pass it as part. Otherwise anchor it on a visible surface, or declare mayHide if it really passes behind`,
          });
      }
      for (let i = 0; i < shown.length; i++)
        for (let j = i + 1; j < shown.length; j++)
          if (Math.hypot(shown[i].b[0] - shown[j].b[0], shown[i].b[1] - shown[j].b[1]) < radius * 2)
            findings.push({
              code: 'CALLOUT_OVERLAP',
              id: shown[i].item.id,
              message: `callouts "${shown[i].item.id}" and "${shown[j].item.id}" overlap at ${Math.round(drawnWidth ?? width)} px wide; move one of their badges`,
            });
      return findings;
    },
  };
  renderer.overlay = api;
  stage.callouts = api;
  pose();
  scene.updateMatrixWorld(true);
  camera.updateMatrixWorld(true);
  place();
  return api;
}
