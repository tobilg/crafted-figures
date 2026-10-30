import { tempDir } from './temp.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import * as k from '../skill/crafted-figures/kit/three/index.mjs';
import { auditScene } from '../skill/crafted-figures/kit/audit/geometry.mjs';
import { auditFigure } from '../skill/crafted-figures/kit/audit/run.mjs';
import { buildFigure } from '../skill/crafted-figures/kit/build.mjs';
const stage = () => k.createStage({ bounds: k.boxBounds([-30, -30, -30], [30, 30, 30]) });
test('empty camera and empty geometry audits cannot produce green evidence', async () => {
  const dir = await tempDir('crafted-audit-negative-');
  await writeFile(
    path.join(dir, 'scenario.json'),
    JSON.stringify({ schemaVersion: 1, cameras: [] }),
  );
  await assert.rejects(
    auditFigure({
      entry: 'examples/valve-assembly/figure.mjs',
      scenario: path.join(dir, 'scenario.json'),
      report: path.join(dir, 'report'),
    }),
    /at least one camera/,
  );
  const s = stage();
  assert.equal(auditScene(s).status, 'failed');
  s.dispose();
});
test('mating rims include their real radii and transformed cross-sections', () => {
  for (const radius of [1, 5]) {
    const s = stage(),
      a = k.cylinder('a', { radius: 5, height: 10 }),
      b = k.cylinder('b', { radius, height: 10 });
    a.position.z = -5;
    b.position.z = 5;
    k.port(a, 'out', { at: [0, 0, 5], direction: [0, 0, 1], radius: 5 });
    k.port(b, 'in', { at: [0, 0, -5], direction: [0, 0, -1], radius });
    s.scene.add(a, b);
    const result = auditScene(s, { connections: [{ a: 'a', b: 'b', portA: 'out', portB: 'in' }] });
    assert.equal(
      result.findings.some(f => f.code === 'PORT_RIM'),
      radius !== 5,
    );
    if (radius === 5) assert.equal(result.status, 'passed');
    s.dispose();
  }
});
test('line-ending reasons do not exempt off-host drawing geometry', () => {
  const s = stage(),
    p = k.box('host', { width: 10, depth: 10, height: 10 });
  s.scene.add(p);
  const mark = k.mark(
    p,
    [
      [-2, 0, 5],
      [2, 0, 5],
    ],
    { reason: 'printed graduation' },
  );
  assert.equal(auditScene(s).status, 'passed');
  mark.points = [
    [20, 0, 50],
    [30, 0, 50],
  ];
  const result = auditScene(s);
  assert.ok(result.findings.some(f => f.code === 'DETAIL_HOST' && f.detail === '0'));
  s.dispose();
});
test('physical bevels and open vents are actual audited solids, not surface decoration', () => {
  const s = stage(),
    slab = k.beveledSlab('slab', { width: 20, depth: 16, height: 8, bevel: 2 });
  s.scene.add(slab);
  assert.equal(auditScene(s).status, 'passed');
  assert.equal(slab.children[0].userData.illustration.bottom[0][0], -8);
  assert.equal(slab.children[0].userData.illustration.top[0][0], -10);
  s.scene.clear();
  const vents = k.ventPanel('vents', { slots: 5 });
  s.scene.add(vents);
  assert.equal(vents.children.length, 8);
  assert.equal(auditScene(s).status, 'passed');
  assert.throws(
    () => k.beveledSlab('invalid', { width: 10, depth: 10, height: 2, bevel: 2 }),
    /bevel/,
  );
  s.dispose();
});
test('runtime identity, dependency lock and declared audit policy survive deterministic builds', async () => {
  const dir = await tempDir('crafted-manifest-');
  const opts = {
    entry: 'examples/dial-indicator/figure.mjs',
    out: dir,
    overrides: { output: 'svg' },
  };
  const a = await buildFigure(opts),
    first = await readFile(path.join(dir, 'build-manifest.json'));
  assert.match(a.manifest.runtimeHash, /^[a-f0-9]{64}$/);
  assert.match(a.manifest.dependencyLockHash, /^[a-f0-9]{64}$/);
  assert.deepEqual(a.manifest.auditPolicy, { schemaVersion: 1, tolerance: 0.08, exceptions: [] });
  await buildFigure(opts);
  assert.deepEqual(await readFile(path.join(dir, 'build-manifest.json')), first);
});
test('released-particle vector glyphs clear the emitter across birth boundaries', async () => {
  const figure = (await import('../examples/turning-mechanism/figure.mjs')).default,
    kit = await import('../skill/crafted-figures/kit/index.mjs'),
    { resolveConfig, readJSON } = await import('../skill/crafted-figures/kit/config.mjs');
  for (const camera of figure.capabilities.camera.views) {
    const args = await resolveConfig({
        layers: [
          {
            label: 'fixture',
            value: { ...(await readJSON('examples/turning-mechanism/figure.config.json')), camera },
          },
        ],
        capabilities: figure.capabilities,
      }),
      s = figure.createScene({ kit, ...args });
    try {
      for (let i = 0; i < 6; i++)
        for (const delta of [-0.001, 0, 0.001, 0.03]) {
          s.update({ time: 1.4 + i * 0.18 + delta });
          assert.doesNotThrow(() => s.render());
        }
      s.update({ time: 2 });
      assert.ok(s.scene.getObjectByName('spark-vector-3').visible);
    } finally {
      s.dispose();
    }
  }
});
test('audit CLI consumes scene-declared connection checks unless explicitly overridden', async () => {
  const dir = await tempDir('crafted-declared-audit-'),
    entry = path.join(dir, 'figure.mjs'),
    scenario = path.join(dir, 'scenario.json');
  await writeFile(
    entry,
    `export default {id:'declared-audit',capabilities:{detail:['standard']},initialState:{x:0},poses:{rest:{x:0}},render(){},createScene({kit}){const k=kit.illustration,s=k.createStage({bounds:k.boxBounds([-10,-10,-10],[10,10,10])}),a=k.cylinder('a',{radius:5,height:10}),b=k.cylinder('b',{radius:1,height:10});a.position.z=-5;b.position.z=5;k.port(a,'out',{at:[0,0,5],direction:[0,0,1],radius:5});k.port(b,'in',{at:[0,0,-5],direction:[0,0,-1],radius:1});s.scene.add(a,b);return {...s,update(){},connections:[{a:'a',b:'b',portA:'out',portB:'in'}]};}};`,
  );
  await writeFile(scenario, JSON.stringify({ schemaVersion: 1 }));
  const r = await auditFigure({ entry, scenario, report: path.join(dir, 'checked') });
  assert.equal(r.status, 'failed');
  assert.equal(r.results[0].coverage.connections, 1);
  assert.ok(r.results[0].findings.some(f => f.code === 'PORT_RIM'));
  await writeFile(scenario, JSON.stringify({ schemaVersion: 1, connections: [] }));
  const empty = await auditFigure({ entry, scenario, report: path.join(dir, 'empty-list') });
  assert.equal(empty.status, 'failed', 'an empty list must not remove a declared check');
  assert.equal(empty.results[0].coverage.connections, 1);
  await writeFile(
    scenario,
    JSON.stringify({ schemaVersion: 1, replaceDeclared: ['connections'], connections: [] }),
  );
  const overridden = await auditFigure({
    entry,
    scenario,
    report: path.join(dir, 'explicit-scope'),
  });
  assert.equal(overridden.results[0].coverage.connections, 0);
  assert.deepEqual(overridden.results[0].coverage.replacedDeclared, ['connections']);
});
