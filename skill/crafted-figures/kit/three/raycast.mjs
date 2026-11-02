/** Nearest front-facing hit along a world-space ray, for painter ordering.
 *
 * Painter ordering casts many rays per moving pair, so this avoids the per-hit allocation and
 * attribute interpolation of `Mesh.raycast`. The test is the same Moller-Trumbore variant with
 * backface culling. Diagnostics deliberately keep using native Three.js rays, which makes
 * them an independent check of this code.
 */
const prepared = new WeakMap();
function prepare(geometry) {
  let entry = prepared.get(geometry);
  if (entry) return entry;
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  const position = geometry.getAttribute('position'),
    index = geometry.index,
    { min, max } = geometry.boundingBox;
  entry = {
    positions: position.array,
    indices: index ? index.array : null,
    count: index ? index.count : position.count,
    bounds: [min.x, min.y, min.z, max.x, max.y, max.z],
  };
  prepared.set(geometry, entry);
  return entry;
}
function missesBounds(b, ox, oy, oz, dx, dy, dz) {
  let near = 0,
    far = Infinity;
  for (const [o, d, lo, hi] of [
    [ox, dx, b[0], b[3]],
    [oy, dy, b[1], b[4]],
    [oz, dz, b[2], b[5]],
  ]) {
    if (d === 0) {
      if (o < lo || o > hi) return true;
      continue;
    }
    const a = (lo - o) / d,
      c = (hi - o) / d;
    near = Math.max(near, Math.min(a, c));
    far = Math.min(far, Math.max(a, c));
    if (near > far) return true;
  }
  return false;
}
/** @param {{geometry:import('three').BufferGeometry}} mesh
 * @param {Float64Array|number[]} inverse elements of the inverse world matrix
 * @param {{origin:import('three').Vector3,direction:import('three').Vector3}} ray unit-direction world ray
 * @returns {number|null} world distance to the nearest front-facing triangle */
export function firstFrontHit(mesh, inverse, ray) {
  const { positions: p, indices, count, bounds } = prepare(mesh.geometry),
    e = inverse,
    { x: wx, y: wy, z: wz } = ray.origin,
    { x: vx, y: vy, z: vz } = ray.direction;
  // An untransformed-length direction keeps the ray parameter in world units.
  const ox = e[0] * wx + e[4] * wy + e[8] * wz + e[12],
    oy = e[1] * wx + e[5] * wy + e[9] * wz + e[13],
    oz = e[2] * wx + e[6] * wy + e[10] * wz + e[14],
    dx = e[0] * vx + e[4] * vy + e[8] * vz,
    dy = e[1] * vx + e[5] * vy + e[9] * vz,
    dz = e[2] * vx + e[6] * vy + e[10] * vz;
  if (missesBounds(bounds, ox, oy, oz, dx, dy, dz)) return null;
  let best = Infinity;
  for (let i = 0; i < count; i += 3) {
    const ia = (indices ? indices[i] : i) * 3,
      ib = (indices ? indices[i + 1] : i + 1) * 3,
      ic = (indices ? indices[i + 2] : i + 2) * 3,
      ax = p[ia],
      ay = p[ia + 1],
      az = p[ia + 2],
      e1x = p[ib] - ax,
      e1y = p[ib + 1] - ay,
      e1z = p[ib + 2] - az,
      e2x = p[ic] - ax,
      e2y = p[ic + 1] - ay,
      e2z = p[ic + 2] - az,
      nx = e1y * e2z - e1z * e2y,
      ny = e1z * e2x - e1x * e2z,
      nz = e1x * e2y - e1y * e2x,
      facing = dx * nx + dy * ny + dz * nz;
    if (facing >= 0) continue;
    const qx = ox - ax,
      qy = oy - ay,
      qz = oz - az,
      u = -(dx * (qy * e2z - qz * e2y) + dy * (qz * e2x - qx * e2z) + dz * (qx * e2y - qy * e2x));
    if (u < 0) continue;
    const v = -(
      dx * (e1y * qz - e1z * qy) +
      dy * (e1z * qx - e1x * qz) +
      dz * (e1x * qy - e1y * qx)
    );
    if (v < 0 || u + v > -facing) continue;
    const q = qx * nx + qy * ny + qz * nz;
    if (q < 0) continue;
    const t = q / -facing;
    if (t < best) best = t;
  }
  return best === Infinity ? null : best;
}
