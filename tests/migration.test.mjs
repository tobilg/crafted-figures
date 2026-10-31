import test from 'node:test';
import assert from 'node:assert/strict';
import { Mesh, SphereGeometry, MeshBasicMaterial, PerspectiveCamera, Vector3 } from 'three';
import * as kit from '../skill/crafted-figures/kit/index.mjs';
import { resolveConfig } from '../skill/crafted-figures/kit/config.mjs';
import { createDial } from '../examples/dial-indicator/scene.mjs';
import { createValve } from '../examples/lift-valve/scene.mjs';
import { createCabinet } from '../examples/control-cabinet/scene.mjs';
import { createArm } from '../examples/hinged-arm/scene.mjs';
import { measure as valve } from '../examples/lift-valve/model.mjs';
import { measure as cabinet } from '../examples/control-cabinet/model.mjs';
import { measure as arm } from '../examples/hinged-arm/model.mjs';
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-5, `${a} != ${b}`);
test('M01/M02: actual Three transforms preserve dial contact and all 21 sampled model poses', async () => {
  for (const detail of ['compact', 'standard']) {
    const { config } = await resolveConfig({ layers: [{ label: 'test', value: { detail } }] }),
      stage = createDial({ kit, config });
    for (let i = 0; i <= 20; i++) {
      const m = stage.update({ displacementMm: i / 2 });
      const svg = stage.render();
      near(stage.tip.position.z - 1, stage.carriage.position.z + 5);
      near(stage.probe.position.z - stage.probe.scale.z / 2, stage.tip.position.z + 1);
      near(stage.probe.position.z + stage.probe.scale.z / 2, 78);
      assert.match(svg, new RegExp(`data-angle="${m.angleDeg}"`));
    }
    stage.dispose();
    assert.equal(stage.scene.children.length, 0);
    assert.throws(() => stage.render(), /disposed/);
  }
});
test('M02: geometry and annotations agree, and unsupported or altered geometry is rejected', () => {
  const k = kit.illustration,
    stage = k.createStage({ bounds: k.boxBounds([-60, -40, -10], [60, 40, 50]) });
  const objects = [
    k.box('rounded', { width: 20, depth: 16, height: 8, radius: 3 }),
    k.cylinder('round', { radius: 8, height: 12 }),
    k.annulus('bore', { radius: 10, innerRadius: 5, height: 6 }),
    k.revolve('profile', {
      profile: [
        [0, 4],
        [4, 9],
        [9, 5],
      ],
    }),
    k.tube('route', {
      points: [
        [-30, 0, 0],
        [-15, 0, 0],
        [0, 15, 10],
        [15, 15, 10],
      ],
      radius: 1.5,
      segments: 12,
    }),
  ];
  for (const object of objects)
    object.traverse(mesh => {
      if (!mesh.isMesh) return;
      const m = mesh.userData.illustration,
        p = mesh.geometry.getAttribute('position');
      for (const point of [
        ...m.top,
        ...m.bottom,
        ...(m.inner?.top || []),
        ...(m.inner?.bottom || []),
      ]) {
        let best = Infinity;
        for (let i = 0; i < p.count; i++)
          best = Math.min(
            best,
            Math.hypot(point[0] - p.getX(i), point[1] - p.getY(i), point[2] - p.getZ(i)),
          );
        assert.ok(best < 1e-4, mesh.name);
      }
    });
  const object = objects[0];
  stage.scene.add(object);
  stage.render();
  object.geometry.translate(1, 0, 0);
  assert.throws(() => stage.render(), /mutate/);
  stage.scene.remove(object);
  const sphere = new Mesh(new SphereGeometry(4), new MeshBasicMaterial());
  sphere.name = 'unannotated-sphere';
  stage.scene.add(sphere);
  assert.throws(() => stage.render(), /Unsupported geometry/);
  assert.throws(() => stage.renderer.render(stage.scene, new PerspectiveCamera()), /orthographic/);
  stage.dispose();
  for (const object of objects)
    object.traverse(o => {
      o.geometry?.dispose();
      o.material?.dispose();
    });
});
test('M02: crossing solids fail instead of receiving an arbitrary painter bias', () => {
  const k = kit.illustration,
    stage = k.createStage({ bounds: k.boxBounds([-40, -40, -20], [40, 40, 20]) });
  const a = k.box('a', { width: 70, depth: 10, height: 10 }),
    b = k.box('b', { width: 70, depth: 10, height: 10 });
  a.rotation.z = Math.PI / 4;
  b.rotation.z = -Math.PI / 4;
  stage.scene.add(a, b);
  assert.throws(() => stage.render(), /intersecting|cyclic/);
  stage.dispose();
});
test('M03: new example models match actual seat, contacts and tool coordinates', async () => {
  const { config } = await resolveConfig();
  const v = createValve({ kit, config });
  for (const liftMm of [-1, 0, 6, 12, 20]) {
    const m = v.update({ liftMm });
    near(v.poppet.position.z - 2 - (v.seat.position.z + 5), m.liftMm);
    near(m.opening, m.liftMm / 12);
    v.render();
  }
  v.dispose();
  const c = createCabinet({ kit, config });
  for (const [temperatureC, count] of [
    [10, 0],
    [19.9, 0],
    [20, 1],
    [30, 2],
    [40, 3],
    [50, 3],
  ]) {
    const m = c.update({ temperatureC });
    assert.equal(m.closed.filter(Boolean).length, count);
    assert.equal(c.bridges.filter(o => o.position.z === 64.75).length, count);
    c.render();
  }
  c.dispose();
  const a = createArm({ kit, config });
  for (let bendDeg = 0; bendDeg <= 90; bendDeg += 5) {
    const m = a.update({ bendDeg }),
      position = a.tool.getWorldPosition(new Vector3());
    near(position.x + 60, m.reachX);
    near(position.y, m.reachY);
    a.render();
  }
  a.dispose();
  for (const fn of [valve, cabinet, arm])
    assert.throws(() => fn({ liftMm: NaN, temperatureC: NaN, bendDeg: NaN }), /finite/);
});
