import {
  ticks,
  box,
  cylinder,
  createStage,
  profile,
  port,
  material,
  Vector3,
} from '../skill/crafted-figures/kit/three/index.mjs';
import type { Configuration, Controller } from '../skill/crafted-figures/kit/contracts.mjs';
import { resolveConfig } from '../skill/crafted-figures/kit/config.mjs';
import { LiveFigure } from '../skill/crafted-figures/kit/react/client.mjs';
import { createElement } from 'react';
const config: Configuration = {
  schemaVersion: 2,
  camera: { azimuth: 45, elevation: 30, padding: 20 },
  materials: { overrides: { subject: 'steel' } },
};
const part = material(box('body', { width: 20, depth: 30, height: 4 }), 'steel', {
  role: 'subject',
});
part.position.copy(new Vector3(1, 2, 3));
port(part, 'out', { at: [0, 0, 2], direction: [0, 0, 1] });
const scene = createStage({
  config,
  bounds: [
    [0, 0, 0],
    [20, 30, 20],
  ],
});
scene.scene.add(part, profile('waist', { radius: z => 5 + z * z, zMin: -1, zMax: 1 }));
const controller: Controller<{ value: number }> = {
  dispose() {},
  getState: () => ({ value: 1 }),
  setState(state) {
    state.value.toFixed(1);
  },
};
// @ts-expect-error numeric geometry dimensions are checked
box('bad', { width: 'twenty', depth: 3, height: 2 });
// @ts-expect-error v1 must reject camera fields
const _invalid: Configuration = { schemaVersion: 1, camera: { azimuth: 45 } };
createElement(LiveFigure<{ value: number }>, {
  id: 'typed',
  figureId: 'typed',
  html: '<svg/>',
  config,
  tokens: {},
  initialState: { value: 1 },
  poses: { rest: { value: 1 } },
  mount: () => controller,
});
cylinder('cone', { radius: 2, topRadius: 0, height: 10 });

ticks(cylinder('scale', { radius: 12, height: 2 }), {
  radius: 10,
  z: 1,
  from: -Math.PI / 2,
  span: Math.PI,
  compact: true,
});

// The public configuration entry accepts real layers and registries.
const resolved = await resolveConfig({
  layers: [{ label: 'typed', value: { schemaVersion: 2, eyebrow: 'Acme', language: 'de' } }],
  presets: new Map(),
  capabilities: { detail: ['standard'] },
});
resolved.config.theme;
// @ts-expect-error schema 1 has no eyebrow
const _branded: Configuration = { schemaVersion: 1, eyebrow: 'Acme' };
