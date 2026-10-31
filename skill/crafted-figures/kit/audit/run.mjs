import { resolveAuditPolicy } from './policy.mjs';
import { runtimeIdentity } from '../provenance.mjs';
import Ajv from '../../runtime/ajv.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as kit from '../index.mjs';
import { bindKit } from '../bind.mjs';
import { resolveConfig, loadPresets, loadMaterials, readJSON } from '../config.mjs';
import { validateFigure } from '../build.mjs';
import { auditScene } from './geometry.mjs';
const obj = (properties, required = []) => ({
    type: 'object',
    properties,
    required,
    additionalProperties: false,
  }),
  str = { type: 'string', minLength: 1 },
  num = { type: 'number' },
  point = { type: 'array', items: num, minItems: 3, maxItems: 3 },
  list = items => ({ type: 'array', items });
const auditSchema = obj(
  {
    schemaVersion: { const: 1 },
    poses: list(str),
    states: list(obj({ id: str, state: { type: 'object' } }, ['id', 'state'])),
    cameras: list(obj({ azimuth: num, elevation: num, padding: num }, ['azimuth', 'elevation'])),
    tolerance: { type: 'number', exclusiveMinimum: 0, maximum: 1 },
    clearanceScope: { enum: ['all', 'declared'] },
    replaceDeclared: {
      type: 'array',
      uniqueItems: true,
      items: { enum: ['clearances', 'contacts', 'connections', 'profiles'] },
    },
    clearances: list(obj({ a: str, b: str, min: { type: 'number', minimum: 0 } }, ['a', 'b'])),
    contacts: list(
      obj({ a: str, b: str, atA: point, atB: point, tolerance: num }, ['a', 'b', 'atA', 'atB']),
    ),
    connections: list(
      obj({ a: str, b: str, portA: str, portB: str, tolerance: num, angleTolerance: num }, [
        'a',
        'b',
        'portA',
        'portB',
      ]),
    ),
    profiles: list(
      obj({ part: str, maxSlopeChange: { type: 'number', exclusiveMinimum: 0 } }, [
        'part',
        'maxSlopeChange',
      ]),
    ),
    exceptions: list(
      obj({ code: str, parts: list(str), detail: str, reason: str }, ['code', 'parts', 'reason']),
    ),
  },
  ['schemaVersion'],
);
const check = new Ajv({ allErrors: true }).compile(auditSchema);
export async function auditFigure(options) {
  const scenario = await readJSON(options.scenario);
  if (!check(scenario)) throw new Error(`audit scenario: ${JSON.stringify(check.errors)}`);
  if (scenario.cameras?.length === 0)
    throw new Error(
      'audit cameras: provide at least one camera, or omit cameras to use the authored view',
    );
  const figure = (await import(pathToFileURL(path.resolve(options.entry)).href)).default;
  validateFigure(figure);
  if (typeof figure.createScene !== 'function')
    throw new Error(
      'audit: figure must expose createScene({kit,config,tokens}) with update(state), scene, camera, renderer and dispose',
    );
  const layers = [];
  for (const key of ['projectConfig', 'config'])
    if (options[key]) layers.push({ label: key, value: await readJSON(options[key]) });
  const presets = await loadPresets(options.presetFiles),
    materials = await loadMaterials(options.materialFiles),
    results = [];
  const states = [
    ...(scenario.poses || ['rest']).map(id => {
      if (!figure.poses[id]) throw new Error(`audit: unknown pose ${id}`);
      return { id, state: figure.poses[id] };
    }),
    ...(scenario.states || []),
  ];
  if (!states.length) throw new Error('audit: at least one pose/state required');
  for (const camera of scenario.cameras || [null]) {
    const { config, tokens } = await resolveConfig({
      layers: [
        ...layers,
        {
          label: 'audit overrides',
          value: { ...options.overrides, ...(camera ? { schemaVersion: 2, camera } : {}) },
        },
      ],
      presets,
      materials,
      capabilities: figure.capabilities,
    });
    const stage = figure.createScene({ kit: bindKit(kit, { config, tokens }), config, tokens });
    try {
      for (const { id, state } of states) {
        stage.update(state);
        const declared = {};
        for (const key of ['clearances', 'contacts', 'connections', 'profiles'])
          if (stage[key] !== undefined) declared[key] = stage[key];
        if (!check({ schemaVersion: 1, ...declared }))
          throw new Error(`audit scene declarations: ${JSON.stringify(check.errors)}`);
        // A scenario adds to what the figure declares. Removing a declared check takes an
        // explicit, reported `replaceDeclared`; an empty list is not an opt-out.
        const policy = resolveAuditPolicy(figure.auditPolicy),
          replaced = scenario.replaceDeclared || [],
          merged = { ...policy, ...scenario };
        delete merged.replaceDeclared;
        for (const key of ['clearances', 'contacts', 'connections', 'profiles'])
          merged[key] = [
            ...(replaced.includes(key) ? [] : declared[key] || []),
            ...(scenario[key] || []),
          ];
        merged.exceptions = [...policy.exceptions, ...(scenario.exceptions || [])];
        const result = auditScene(stage, {
          ...merged,
          context: { pose: id, camera: config.camera || 'authored' },
        });
        result.coverage.replacedDeclared = replaced;
        results.push(result);
      }
    } finally {
      stage.dispose();
    }
  }
  const report = {
    schemaVersion: 1,
    ...(await runtimeIdentity()),
    status: results.length > 0 && results.every(r => r.status === 'passed') ? 'passed' : 'failed',
    figure: figure.id,
    results,
    environment: { node: process.version, platform: process.platform, arch: process.arch },
  };
  await mkdir(options.report, { recursive: true });
  await writeFile(path.join(options.report, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  await writeFile(
    path.join(options.report, 'report.txt'),
    `${figure.id}: ${report.status}\n` +
      results
        .flatMap(r =>
          r.findings.map(
            f =>
              `${f.severity} ${f.code} [${f.parts.join(', ')}] ${f.pose}: ${f.message}; ${f.correction}`,
          ),
        )
        .join('\n') +
      '\n',
  );
  return report;
}
