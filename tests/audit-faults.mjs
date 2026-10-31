import * as k from '../skill/crafted-figures/kit/three/index.mjs';
import { auditScene } from '../skill/crafted-figures/kit/audit/geometry.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out = 'out/reports/audit-faults';
await mkdir(out, { recursive: true });
const report = {
  status: 'running',
  checks: [],
  errors: [],
  environment: { node: process.version },
};
const stage = () =>
  k.createStage({ bounds: k.boxBounds([-40, -40, -40], [40, 40, 40]), azimuth: 45, elevation: 30 });
function check(kind, build, expected) {
  const s = stage();
  try {
    const policy = build(s) || {},
      result = auditScene(s, policy);
    for (const code of expected)
      assert.ok(
        result.findings.some(f => f.code === code),
        `${kind}: missing ${code}`,
      );
    assert.equal(result.status, 'failed');
    report.checks.push({ kind, expected, ...result });
  } finally {
    s.dispose();
  }
}
try {
  check(
    'solid penetration',
    s => {
      s.scene.add(
        k.box('a', { width: 10, depth: 10, height: 10 }),
        k.box('b', { width: 5, depth: 5, height: 5 }),
      );
    },
    ['SOLID_CLEARANCE'],
  );
  check(
    'contact anchor is off host and seat is floating',
    s => {
      const a = k.box('a', { width: 10, depth: 10, height: 10 }),
        b = k.box('b', { width: 5, depth: 5, height: 5 });
      b.position.x = 12;
      s.scene.add(a, b);
      return { contacts: [{ a: 'a', b: 'b', atA: [0, 0, 0], atB: [-2.5, 0, 0] }] };
    },
    ['CONTACT_OWNERSHIP', 'SUPPORT_SEAT'],
  );
  check(
    'ports use wrong host and disconnect',
    s => {
      const a = k.box('a', { width: 10, depth: 10, height: 10 }),
        b = k.box('b', { width: 5, depth: 5, height: 5 });
      b.position.x = 12;
      k.port(a, 'out', { at: [0, 0, 0], direction: [1, 0, 0] });
      k.port(b, 'in', { at: [-2.5, 0, 0], direction: [-1, 0, 0] });
      s.scene.add(a, b);
      return { connections: [{ a: 'a', b: 'b', portA: 'out', portB: 'in' }] };
    },
    ['PORT_HOST', 'PORT_TERMINAL'],
  );
  check(
    'folded route',
    s => {
      s.scene.add(
        k.tube('fold', {
          points: [
            [0, 0, 0],
            [10, 0, 0],
            [0, 1, 0],
            [-10, 1, 0],
          ],
          radius: 3,
          segments: 12,
        }),
      );
    },
    ['ROUTE_FOLD'],
  );
  check(
    'end-on route',
    s => {
      const axis = s.camera.position.clone().normalize();
      s.scene.add(
        k.tube('end-on', {
          points: [
            axis.clone().multiplyScalar(-10).toArray(),
            [0, 0, 0],
            axis.clone().multiplyScalar(10).toArray(),
          ],
          radius: 1,
          segments: 8,
        }),
      );
    },
    ['ROUTE_END_ON'],
  );
  check(
    'misleading geometry proxy',
    s => {
      const a = k.box('proxy', { width: 10, depth: 10, height: 10 });
      a.geometry.getAttribute('position').array.fill(0);
      s.scene.add(a);
    },
    ['DRAWING_COVERAGE'],
  );
  check(
    'layer assignment contradicts depth',
    s => {
      const a = k.box('far', { width: 8, depth: 8, height: 8 }),
        b = k.box('near', { width: 8, depth: 8, height: 8 });
      b.position.copy(s.camera.position.clone().normalize().multiplyScalar(12));
      a.userData.svgAfterLayer = 1;
      s.scene.add(a, b);
    },
    ['PAINTER_ORDER'],
  );
  check(
    'coarse analytic surface',
    s => {
      const p = k.profile('coarse', {
        zMin: -10,
        zMax: 10,
        steps: 4,
        tolerance: 1,
        radius: z => 2 + (z * z) / 5,
      });
      p.userData.profile.tolerance = 0.08;
      s.scene.add(p);
    },
    ['PROFILE_FIDELITY'],
  );
  // Existing geometry unit fixtures also exercise projected crowding, meridian
  // wobble and the fault present only in the middle of a transition.
  report.status = 'passed';
} catch (e) {
  report.status = 'failed';
  report.errors.push(e.stack);
  process.exitCode = 1;
} finally {
  await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2) + '\n');
  console.log(report.status, report.checks.length, report.errors);
}
