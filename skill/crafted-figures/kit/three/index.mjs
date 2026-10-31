import {
  Scene,
  OrthographicCamera,
  Plane,
  Raycaster,
  Vector2,
  Vector3,
} from '../../runtime/three.mjs';
import { materialIds, rampKeys } from '../materials.mjs';
import { inspectPaintedOrder } from './verify.mjs';
import { IllustrationSVGRenderer } from './renderer.mjs';
export { Group, Vector3, Vector2, Quaternion, MathUtils } from '../../runtime/three.mjs';
export {
  taperedPrism,
  box,
  prism,
  cylinder,
  annulus,
  revolve,
  tube,
  along,
  mark,
  label,
  ringPoints,
  ticks,
  extrude,
  profile,
  sphere,
  material,
  port,
  anchor,
} from './primitives.mjs';
export { mountScalarScene, mountStateScene } from './mount.mjs';
export { IllustrationSVGRenderer };
export { inspectPaintedOrder };
export const boxBounds = (min, max) =>
  [min[0], max[0]].flatMap(x =>
    [min[1], max[1]].flatMap(y => [min[2], max[2]].map(z => [x, y, z])),
  );
/** Fixed authoring camera. Bounds include every supported pose; never refit per frame.
 * @param {{width?:number,height?:number,bounds:number[][],azimuth?:number,elevation?:number,padding?:number|{top:number,right:number,bottom:number,left:number},strokeWidth?:number,config?:import('../contracts.mjs').Configuration,tokens?:Record<string,string>,reservedBottom?:number}} options
 */
export function createStage({
  width = 600,
  height = 400,
  bounds,
  azimuth = 42,
  elevation = 30,
  padding = 30,
  strokeWidth = 0.6,
  config,
  tokens,
  reservedBottom = 0,
}) {
  if (config?.schemaVersion === 2 && config.camera)
    ({ azimuth = azimuth, elevation = elevation, padding = padding } = config.camera);
  if (
    !Array.isArray(bounds) ||
    bounds.length < 2 ||
    bounds.some(p => p.length !== 3 || p.some(v => !Number.isFinite(v)))
  )
    throw new Error('bounds: require finite world points covering all poses');
  const scene = new Scene(),
    camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10000),
    a = (azimuth * Math.PI) / 180,
    e = (elevation * Math.PI) / 180;
  camera.up.set(0, 0, 1);
  camera.position
    .set(Math.cos(a) * Math.cos(e), Math.sin(a) * Math.cos(e), Math.sin(e))
    .multiplyScalar(2000);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  const points = bounds.map(p => new Vector3(...p).applyMatrix4(camera.matrixWorldInverse)),
    xs = points.map(p => p.x),
    ys = points.map(p => p.y),
    xmin = Math.min(...xs),
    xmax = Math.max(...xs),
    ymin = Math.min(...ys),
    ymax = Math.max(...ys),
    pad =
      typeof padding === 'number'
        ? { top: padding, right: padding, bottom: padding, left: padding }
        : { ...padding };
  pad.bottom += reservedBottom;
  const usableW = width - pad.left - pad.right,
    usableH = height - pad.top - pad.bottom,
    scale = Math.min(usableW / (xmax - xmin), usableH / (ymax - ymin));
  if (!Number.isFinite(scale) || scale <= 0) throw new Error('Invalid camera bounds or padding');
  camera.left = (xmin + xmax) / 2 - (pad.left + usableW / 2) / scale;
  camera.right = camera.left + width / scale;
  camera.top = (ymin + ymax) / 2 + (pad.top + usableH / 2) / scale;
  camera.bottom = camera.top - height / scale;
  camera.updateProjectionMatrix();
  const ignoredMaterials = new Set();
  const applyAppearance = ({ strict = true } = {}) => {
    if (config?.schemaVersion !== 2) {
      if (config)
        scene.traverse(o => {
          if (o.userData.material) ignoredMaterials.add(`${o.userData.material} on ${o.name}`);
        });
      return;
    }
    const used = new Set(),
      overrides = config.materials?.overrides || {};
    scene.traverse((/** @type {any} */ o) => {
      if (!o.isMesh) return;
      let chosen;
      for (let p = o; p; p = p.parent) {
        const role = p.userData.materialRole;
        if (Object.hasOwn(overrides, p.name)) {
          chosen = overrides[p.name];
          used.add(p.name);
          break;
        }
        if (role && Object.hasOwn(overrides, role)) {
          chosen = overrides[role];
          used.add(role);
          break;
        }
        if (p.userData.material) {
          chosen = p.userData.material;
          break;
        }
      }
      if (chosen) {
        if (!materialIds.includes(chosen) && !tokens?.[`material-${chosen}-top`])
          throw new Error(`Unknown material ${chosen} on ${o.name}`);
        o.userData.illustration.materialStyle = rampKeys
          .map(key => `--cf-${key === 'ink' ? 'muted' : key}:var(--cf-material-${chosen}-${key})`)
          .join(';');
        o.userData.illustration.material = chosen;
      }
    });
    // A live pose may legitimately omit a role; builds validate the declared scene.
    if (!strict) return;
    for (const role of Object.keys(overrides))
      if (!used.has(role))
        throw new Error(`Material role ${role} is declared but not present in the rendered scene`);
  };
  const renderer = new IllustrationSVGRenderer({ width, height, strokeWidth }),
    pointerRays = new Raycaster();
  let disposed = false;
  /** @param {number[]} point */
  const pointerRay = ([x, y]) => {
    pointerRays.setFromCamera(new Vector2((x / width) * 2 - 1, 1 - (y / height) * 2), camera);
    return pointerRays.ray;
  };
  const stage = {
    scene,
    camera,
    renderer,
    width,
    height,
    view: { azimuth, elevation, padding },
    /** Materials a schema-1 configuration cannot apply; builds report these as warnings. */
    ignoredMaterials,
    inspectOrder: (root, options) => inspectPaintedOrder(stage, root, options),
    /** Pointer mapping uses this stage's camera; points are SVG user units.
     * @param {number[]} world @returns {number[]} */
    project: world => renderer.project(new Vector3(...world), camera),
    /** @param {number[]} point @returns {import('three').Ray} world-space view ray */
    pointerRay: point => pointerRay(point).clone(),
    /** @param {number[]} point
     * @param {{at:number[],normal:number[]}} plane
     * @returns {Vector3|null} world point under the pointer */
    pointerToPlane: (point, { at, normal }) =>
      pointerRay(point).intersectPlane(
        new Plane().setFromNormalAndCoplanarPoint(
          new Vector3(...normal).normalize(),
          new Vector3(...at),
        ),
        new Vector3(),
      ),
    /** @param {number[]} point
     * @param {number[]} from
     * @param {number[]} to
     * @returns {number} 0..1 along the on-screen projection of a world segment */
    pointerOnSegment: (point, from, to) => {
      const a = renderer.project(new Vector3(...from), camera),
        b = renderer.project(new Vector3(...to), camera),
        dx = b[0] - a[0],
        dy = b[1] - a[1],
        length = dx * dx + dy * dy;
      if (length < 1e-9)
        throw new Error('pointerOnSegment: segment is end-on to the camera; choose another axis');
      return Math.min(1, Math.max(0, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / length));
    },
    render: () => {
      applyAppearance();
      return renderer.serialize(scene, camera);
    },
    mount: group => {
      applyAppearance();
      const view = renderer.mount(group, scene, camera);
      return {
        ...view,
        update() {
          applyAppearance({ strict: false });
          return view.update();
        },
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      renderer.dispose();
      scene.traverse((/** @type {any} */ o) => {
        o.geometry?.dispose();
        if (o.material)
          for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose();
      });
      scene.clear();
    },
  };
  return stage;
}

export * from './parts.mjs';
export * from './motion.mjs';
export { clipControls } from './clip.mjs';
