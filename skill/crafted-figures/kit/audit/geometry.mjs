import { auditDefaults } from './defaults.mjs';
import { Box3, Vector3, Triangle, Ray } from '../../runtime/three.mjs';
import { assertGeometry, anchor } from '../three/primitives.mjs';
const v = p => (p instanceof Vector3 ? p.clone() : new Vector3(...p));
const direction = new Vector3(0.827, 0.331, 0.455).normalize();
/** Actual transformed triangles; no separately authored collision proxy. */
function trianglesOf(mesh) {
  const p = mesh.geometry.getAttribute('position'),
    index = mesh.geometry.index,
    result = [];
  for (let i = 0; i < (index ? index.count : p.count); i += 3) {
    const ids = [0, 1, 2].map(j => (index ? index.getX(i + j) : i + j));
    result.push(
      new Triangle(
        ...ids.map(j => new Vector3().fromBufferAttribute(p, j).applyMatrix4(mesh.matrixWorld)),
      ),
    );
  }
  return result;
}
function signedDistance(point, triangles) {
  const p = v(point),
    ray = new Ray(p, direction),
    hit = new Vector3(),
    closest = new Vector3(),
    distances = [];
  let distance = Infinity;
  for (const t of triangles) {
    distance = Math.min(distance, t.closestPointToPoint(p, closest).distanceTo(p));
    if (ray.intersectTriangle(t.a, t.b, t.c, false, hit)) {
      const d = hit.distanceTo(p);
      if (d > 1e-7 && !distances.some(x => Math.abs(x - d) < 1e-6)) distances.push(d);
    }
  }
  return distance < 1e-7 ? 0 : distance * (distances.length % 2 ? -1 : 1);
}
const AXES = ['x', 'y', 'z'];
/** The part of a triangle inside a box, as a polygon. */
function clipToBox(points, box) {
  let polygon = points;
  for (const axis of AXES)
    for (const [limit, sign] of [
      [box.min[axis], 1],
      [box.max[axis], -1],
    ]) {
      const input = polygon;
      polygon = [];
      for (let i = 0; i < input.length; i++) {
        const a = input[i],
          b = input[(i + 1) % input.length],
          da = (a[axis] - limit) * sign,
          db = (b[axis] - limit) * sign;
        if (da >= 0) polygon.push(a);
        if (da >= 0 !== db >= 0) polygon.push(a.clone().lerp(b, da / (da - db)));
      }
      if (polygon.length < 3) return [];
    }
  return polygon;
}
/** Surface points of `triangles` inside the region both parts occupy. Vertices alone miss
 * parts that cross with every vertex outside the other part, such as two bars or a rod through
 * a plate, so large faces are clipped to that region before sampling. */
function overlapSamples(triangles, region) {
  const samples = [],
    bounds = new Box3();
  for (const t of triangles) {
    bounds.makeEmpty().expandByPoint(t.a).expandByPoint(t.b).expandByPoint(t.c);
    if (!bounds.intersectsBox(region)) continue;
    const polygon = clipToBox([t.a, t.b, t.c], region);
    if (!polygon.length) continue;
    const center = polygon
      .reduce((sum, p) => sum.add(p), new Vector3())
      .divideScalar(polygon.length);
    samples.push(center);
    for (const p of polygon) samples.push(p, p.clone().lerp(center, 0.5));
  }
  return samples;
}
const closest = new Vector3();
function pointToTriangle(point, triangle) {
  return triangle.closestPointToPoint(point, closest).distanceTo(point);
}
/** Exact distance between two segments. */
function segmentDistance(p1, q1, p2, q2) {
  const d1 = q1.clone().sub(p1),
    d2 = q2.clone().sub(p2),
    r = p1.clone().sub(p2),
    a = d1.dot(d1),
    e = d2.dot(d2),
    f = d2.dot(r);
  let s, t;
  if (a <= 1e-12 && e <= 1e-12) return r.length();
  if (a <= 1e-12) {
    s = 0;
    t = Math.min(1, Math.max(0, f / e));
  } else {
    const c = d1.dot(r);
    if (e <= 1e-12) {
      t = 0;
      s = Math.min(1, Math.max(0, -c / a));
    } else {
      const b = d1.dot(d2),
        denominator = a * e - b * b;
      s = denominator > 1e-12 ? Math.min(1, Math.max(0, (b * f - c * e) / denominator)) : 0;
      t = (b * s + f) / e;
      if (t < 0) {
        t = 0;
        s = Math.min(1, Math.max(0, -c / a));
      } else if (t > 1) {
        t = 1;
        s = Math.min(1, Math.max(0, (b - c) / a));
      }
    }
  }
  return p1.clone().addScaledVector(d1, s).distanceTo(p2.clone().addScaledVector(d2, t));
}
function triangleDistance(a, b) {
  let distance = Infinity;
  const av = [a.a, a.b, a.c],
    bv = [b.a, b.b, b.c];
  for (const p of av) distance = Math.min(distance, pointToTriangle(p, b));
  for (const p of bv) distance = Math.min(distance, pointToTriangle(p, a));
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      distance = Math.min(
        distance,
        segmentDistance(av[i], av[(i + 1) % 3], bv[j], bv[(j + 1) % 3]),
      );
  return distance;
}
/** The smallest surface gap, if any is below `limit`. Nearby triangles only. */
function separation(aa, bb, limit) {
  let distance = Infinity;
  const boxOf = t => new Box3().expandByPoint(t.a).expandByPoint(t.b).expandByPoint(t.c),
    near = (triangles, other) =>
      triangles
        .map(t => [t, boxOf(t)])
        .filter(([, box]) => box.clone().expandByScalar(limit).intersectsBox(other.bounds));
  const a = near(aa.triangles, bb),
    b = near(bb.triangles, aa);
  for (const [ta, boxA] of a) {
    const reach = boxA.clone().expandByScalar(Math.min(limit, distance));
    for (const [tb, boxB] of b)
      if (reach.intersectsBox(boxB)) distance = Math.min(distance, triangleDistance(ta, tb));
  }
  return distance;
}
function terminal(mesh, name) {
  const p = mesh.userData.ports[name],
    normal = v(p.direction).normalize(),
    u = new Vector3(Math.abs(normal.x) < 0.8 ? 1 : 0, Math.abs(normal.x) < 0.8 ? 0 : 1, 0)
      .cross(normal)
      .normalize(),
    w = normal.clone().cross(u),
    origin = v(p.at),
    inverse = mesh.matrixWorld.clone().invert();
  const points =
    p.radius > 0
      ? Array.from({ length: 64 }, (_, i) =>
          origin
            .clone()
            .addScaledVector(u, p.radius * Math.cos((i * Math.PI) / 32))
            .addScaledVector(w, p.radius * Math.sin((i * Math.PI) / 32))
            .applyMatrix4(mesh.matrixWorld),
        )
      : [origin.clone().applyMatrix4(mesh.matrixWorld)];
  const distance = point => {
    const q = point.clone().applyMatrix4(inverse).sub(origin);
    q.addScaledVector(normal, -q.dot(normal));
    if (q.lengthSq() === 0) q.copy(u);
    q.setLength(p.radius).add(origin).applyMatrix4(mesh.matrixWorld);
    return q.distanceTo(point);
  };
  return { points, distance, radius: p.radius };
}
export function auditScene(
  stage,
  {
    tolerance = auditDefaults.tolerance,
    clearances = [],
    clearanceScope = 'all',
    contacts = [],
    connections = [],
    exceptions = [],
    profiles = [],
    context = {},
  } = {},
) {
  const { scene, camera, renderer } = stage;
  scene.updateMatrixWorld(true);
  const findings = [],
    parts = new Map(),
    routes = [];
  const add = (code, ids, measured, limit, message, category) =>
    findings.push({
      code,
      parts: ids,
      ...context,
      severity: 'error',
      measured,
      tolerance: limit,
      message,
      correction: category,
    });
  scene.traverseVisible(o => {
    if (o.userData.route) routes.push(o);
    if (!o.isMesh || o.userData.craftedEffect) return;
    try {
      assertGeometry(o);
    } catch (e) {
      add(
        'DRAWING_COVERAGE',
        [o.name],
        null,
        0,
        e.message,
        'rebuild geometry with the public helper',
      );
      return;
    }
    const triangles = trianglesOf(o),
      bounds = new Box3();
    for (const t of triangles) bounds.expandByPoint(t.a).expandByPoint(t.b).expandByPoint(t.c);
    parts.set(o.name, { object: o, triangles, bounds });
    // Every analytic ring vertex must lie on the actual drawn mesh. This also
    // detects direct Float32 array edits that did not mark the attribute dirty.
    const m = o.userData.illustration,
      recorded = [...m.top, ...m.bottom, ...(m.inner ? [...m.inner.top, ...m.inner.bottom] : [])];
    const error = Math.max(
      ...recorded.map(p => Math.abs(signedDistance(v(p).applyMatrix4(o.matrixWorld), triangles))),
    );
    if (error > tolerance)
      add(
        'DRAWING_COVERAGE',
        [o.name],
        error,
        tolerance,
        'Illustration boundary differs from mesh surface',
        'repair geometry/metadata generation',
      );
    for (const [index, detail] of (m.details || []).entries()) {
      let points = detail.points || [detail.at];
      if (detail.type === 'display')
        points = [
          [0, 0],
          [detail.width, 0],
          [0, detail.height],
          [detail.width, detail.height],
        ].map(([x, y]) => detail.at.map((n, i) => n + x * detail.u[i] + y * detail.v[i]));
      if (detail.points)
        points = [
          ...points,
          ...points.slice(1).map((p, i) => p.map((n, j) => (n + points[i][j]) / 2)),
          ...(detail.closed ? [points[0].map((n, j) => (n + points.at(-1)[j]) / 2)] : []),
        ];
      const deviation = Math.max(
        ...points.map(p => Math.abs(signedDistance(v(p).applyMatrix4(o.matrixWorld), triangles))),
      );
      if (deviation > tolerance) {
        add(
          'DETAIL_HOST',
          [o.name],
          deviation,
          tolerance,
          'Surface detail departs from its actual host surface',
          'project the detail onto its host or split it across physical pieces',
        );
        findings.at(-1).detail = detail.id || detail.part || String(index);
      }
    }
  });
  const requirePart = name => {
    const p = parts.get(name);
    if (!p) throw new Error(`audit: unknown solid ${name}`);
    return p;
  };
  // Caller may focus clearance pairs, but the report states exactly what was tested.
  // Every pair is checked unless a scenario explicitly opts out. A declared clearance raises
  // the required gap for its pair; it never removes the other pairs from the audit.
  const key = (a, b) => (a < b ? `${a}\0${b}` : `${b}\0${a}`),
    required = new Map(clearances.map(({ a, b, min = 0 }) => [key(a, b), min]));
  for (const { a, b } of clearances) {
    requirePart(a);
    requirePart(b);
  }
  const names = [...parts.keys()],
    pairs =
      clearanceScope === 'declared'
        ? clearances
        : names.flatMap((a, i) =>
            names.slice(i + 1).map(b => ({ a, b, min: required.get(key(a, b)) ?? 0 })),
          );
  let tested = 0;
  for (const { a, b, min = 0 } of pairs) {
    const aa = requirePart(a),
      bb = requirePart(b);
    const expanded = aa.bounds.clone().expandByScalar(Math.max(min, tolerance));
    if (!expanded.intersectsBox(bb.bounds)) continue;
    // Adjacent ring pieces are one continuous physical surface, not an exception
    // to collisions with any other assembly or with nonadjacent route pieces.
    const ma = aa.object.userData.illustration,
      mb = bb.object.userData.illustration;
    if (ma.join && ma.join === mb.join && Math.abs(ma.chunk - mb.chunk) === 1) continue;
    tested++;
    let distance = Infinity;
    if (aa.bounds.intersectsBox(bb.bounds)) {
      const region = aa.bounds.clone().intersect(bb.bounds);
      for (const p of overlapSamples(aa.triangles, region))
        distance = Math.min(distance, signedDistance(p, bb.triangles));
      for (const p of overlapSamples(bb.triangles, region))
        distance = Math.min(distance, signedDistance(p, aa.triangles));
    }
    // Inside means penetrating. Otherwise the real gap decides, including edge against edge.
    if (distance >= 0 && min > 0) distance = Math.min(distance, separation(aa, bb, min));
    if (distance < min - tolerance)
      add(
        'SOLID_CLEARANCE',
        [a, b],
        distance,
        min,
        `Sampled clearance ${distance.toFixed(4)} is below ${min}`,
        'separate surfaces or declare a narrow intentional contact',
      );
  }
  for (const c of contacts) {
    const a = requirePart(c.a),
      b = requirePart(c.b),
      pa = v(c.atA).applyMatrix4(a.object.matrixWorld),
      pb = v(c.atB).applyMatrix4(b.object.matrixWorld),
      gap = pa.distanceTo(pb),
      ta = c.tolerance ?? tolerance;
    const support = Math.max(
      Math.abs(signedDistance(pa, a.triangles)),
      Math.abs(signedDistance(pb, b.triangles)),
    );
    if (support > ta)
      add(
        'CONTACT_OWNERSHIP',
        [c.a, c.b],
        support,
        ta,
        'Contact anchor is not on its declared host surface',
        'seat pad/anchor on the real host',
      );
    if (gap > ta)
      add(
        'SUPPORT_SEAT',
        [c.a, c.b],
        gap,
        ta,
        'Declared support/seat points are separated',
        'repair the physical placement or pose',
      );
  }
  for (const c of connections) {
    const a = requirePart(c.a),
      b = requirePart(c.b),
      pa = anchor(a.object, c.portA),
      pb = anchor(b.object, c.portB),
      gap = pa.at.distanceTo(pb.at),
      angle =
        (Math.acos(Math.max(-1, Math.min(1, -pa.direction.dot(pb.direction)))) * 180) / Math.PI,
      limit = c.tolerance ?? tolerance;
    if (gap > limit || angle > (c.angleTolerance ?? 2))
      add(
        'PORT_TERMINAL',
        [c.a, c.b],
        { gap, angle },
        { gap: limit, angle: c.angleTolerance ?? 2 },
        'Ports are disconnected or their outward axes do not oppose',
        'align and seat the fitting/route ends',
      );
    const ra = terminal(a.object, c.portA),
      rb = terminal(b.object, c.portB);
    if (ra.radius > 0 && rb.radius > 0) {
      const rimGap = Math.max(
        ...ra.points.map(p => rb.distance(p)),
        ...rb.points.map(p => ra.distance(p)),
      );
      if (rimGap > limit)
        add(
          'PORT_RIM',
          [c.a, c.b],
          rimGap,
          limit,
          'Mating port rims differ in position, radius or transformed cross-section',
          'match the actual mating rims; model a reducer as a separate part with two matching ports',
        );
    }
    for (const [rim, host] of [
      [ra, a],
      [rb, b],
    ]) {
      const error = Math.max(...rim.points.map(p => Math.abs(signedDistance(p, host.triangles))));
      if (error > limit)
        add(
          'PORT_HOST',
          [host.object.name],
          error,
          limit,
          'Declared port boundary is not on its host surface',
          'move the port rim to the actual terminal surface',
        );
    }
  }
  for (const route of routes) {
    const { centers, radius } = route.userData.route,
      points = centers.map(p => v(p).applyMatrix4(route.matrixWorld));
    for (let i = 1; i < points.length - 1; i++) {
      const before = points[i].clone().sub(points[i - 1]),
        after = points[i + 1].clone().sub(points[i]),
        angle = before.angleTo(after),
        bend = before.length() / (2 * Math.sin(angle / 2) || 1e-12);
      if (bend < radius * 1.05)
        add(
          'ROUTE_FOLD',
          [route.name],
          bend,
          radius * 1.05,
          'Bend radius pinches its cross-section',
          'increase bend radius or separate waypoints',
        );
    }
    const along = [0];
    for (let i = 1; i < points.length; i++)
      along.push(along[i - 1] + points[i - 1].distanceTo(points[i]));
    for (let i = 0; i < points.length; i++)
      for (let j = i + 3; j < points.length; j++) {
        if (along[j] - along[i] < radius * 3) continue;
        const distance = points[i].distanceTo(points[j]);
        if (distance < 2 * radius - tolerance)
          add(
            'ROUTE_SELF',
            [route.name],
            distance,
            2 * radius,
            'Nonadjacent route sections overlap',
            'reroute around the crossing',
          );
      }
    let endOn = 0;
    const view = camera.getWorldDirection(new Vector3());
    for (let i = 1; i < points.length; i++)
      if (
        Math.abs(
          points[i]
            .clone()
            .sub(points[i - 1])
            .normalize()
            .dot(view),
        ) > 0.998
      )
        endOn++;
    if (endOn)
      add(
        'ROUTE_END_ON',
        [route.name],
        endOn,
        0,
        'Route contains a segment aimed directly at the camera',
        'choose a qualified view or reroute',
      );
  }
  // A near-parallel projection can look like a fabricated joint even when the
  // tubes are far apart in depth. Crossings at a clear angle remain allowed.
  const projected = routes.map(o => ({
    o,
    world: o.userData.route.centers.map(p => v(p).applyMatrix4(o.matrixWorld)),
    radius: o.userData.route.radius,
  }));
  for (let a = 0; a < projected.length; a++)
    for (let b = a + 1; b < projected.length; b++) {
      const aa = projected[a],
        bb = projected[b];
      let crowded = false;
      for (let i = 1; i < aa.world.length && !crowded; i++)
        for (let j = 1; j < bb.world.length && !crowded; j++) {
          const aw = aa.world[i - 1].clone().add(aa.world[i]).multiplyScalar(0.5),
            bw = bb.world[j - 1].clone().add(bb.world[j]).multiplyScalar(0.5),
            ap = renderer.project(aw, camera),
            bp = renderer.project(bw, camera),
            a0 = renderer.project(aa.world[i - 1], camera),
            a1 = renderer.project(aa.world[i], camera),
            b0 = renderer.project(bb.world[j - 1], camera),
            b1 = renderer.project(bb.world[j], camera);
          const ad = [a1[0] - a0[0], a1[1] - a0[1]],
            bd = [b1[0] - b0[0], b1[1] - b0[1]],
            parallel =
              Math.abs(ad[0] * bd[0] + ad[1] * bd[1]) /
              (Math.hypot(...ad) * Math.hypot(...bd) || 1),
            scale = renderer.width / (camera.right - camera.left),
            distance = Math.hypot(ap[0] - bp[0], ap[1] - bp[1]);
          if (
            parallel > 0.98 &&
            distance < (aa.radius + bb.radius) * scale &&
            aw.distanceTo(bw) > aa.radius + bb.radius + tolerance
          ) {
            add(
              'ROUTE_CROWDING',
              [aa.o.name, bb.o.name],
              { screenDistance: distance, worldSeparation: aw.distanceTo(bw) },
              (aa.radius + bb.radius) * scale,
              'Separated near-parallel routes collapse into a false projected joint',
              'separate the routes in projection or qualify a clearer view',
            );
            crowded = true;
          }
        }
    }
  for (const policy of profiles) {
    const object = scene.getObjectByName(policy.part),
      p = object?.userData.profile;
    if (!p) throw new Error(`audit profile ${policy.part}: analytic profile required`);
    const slopes = p.samples
      .slice(1)
      .map(([z, r], i) => (r - p.samples[i][1]) / (z - p.samples[i][0]));
    const change = Math.max(...slopes.slice(1).map((n, i) => Math.abs(n - slopes[i])));
    if (change > policy.maxSlopeChange)
      add(
        'SURFACE_WOBBLE',
        [object.name],
        change,
        policy.maxSlopeChange,
        'Meridian slope changes exceed its declared smoothness envelope',
        'refine or repair the actual surface profile',
      );
  }
  scene.traverse(o => {
    const p = o.userData.profile;
    if (!p) return;
    for (let i = 0; i < p.samples.length - 1; i++) {
      const [z0, r0] = p.samples[i],
        [z1, r1] = p.samples[i + 1],
        z = (z0 + z1) / 2,
        error = Math.abs(p.radius(z) - (r0 + r1) / 2);
      if (error > (p.tolerance ?? tolerance))
        add(
          'PROFILE_FIDELITY',
          [o.name],
          error,
          p.tolerance ?? tolerance,
          'Sampled profile departs from its analytic meridian',
          'increase adaptive profile sampling',
        );
    }
  });
  try {
    renderer.render(scene, camera);
  } catch (e) {
    add('PAINTER_ORDER', [], null, 0, e.message, 'split interleaving geometry or repair its pose');
  }
  for (const exception of exceptions) {
    if (
      !exception.reason ||
      !exception.code ||
      !Array.isArray(exception.parts) ||
      !exception.parts.length
    )
      throw new Error('audit exception requires exact code, part IDs and reason');
    for (const f of findings)
      if (
        (exception.detail === undefined || f.detail === exception.detail) &&
        f.code === exception.code &&
        f.parts.length === exception.parts.length &&
        f.parts.every(p => exception.parts.includes(p))
      ) {
        f.severity = 'exception';
        f.reason = exception.reason;
      }
  }
  if (!parts.size)
    add(
      'AUDIT_NO_SOLIDS',
      [],
      0,
      1,
      'No supported visible solids were audited',
      'supply a visible supported scene',
    );
  return {
    status: findings.some(f => f.severity === 'error') ? 'failed' : 'passed',
    findings,
    coverage: {
      solids: parts.size,
      routes: routes.length,
      clearancePairs: pairs.length,
      narrowPhasePairs: tested,
      connections: connections.length,
      contacts: contacts.length,
      details: [...parts.values()].reduce(
        (n, p) => n + p.object.userData.illustration.details.length,
        0,
      ),
    },
    assumptions: {
      method:
        'surface samples clipped to the region both parts occupy, signed ray parity; exact triangle distance for declared clearances; detail vertices/midpoints and 64 port-rim samples; finite samples may miss a smaller penetration',
      tolerance,
      units: 'authored world units',
      pointPorts:
        'radius=0 declares a point anchor only; cross-section matching requires positive radii on both ports',
    },
  };
}
