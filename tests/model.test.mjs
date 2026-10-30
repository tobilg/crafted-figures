import test from 'node:test';
import assert from 'node:assert/strict';
import { measure, poses } from '../examples/dial-indicator/model.mjs';
test('A03: physical inputs, clamping and the dial/readout mapping', () => {
  for (const [input, angle, reading] of [[-3,0,'0.00 mm'],[0,0,'0.00 mm'],[5,150,'5.00 mm'],[10,300,'10.00 mm'],[12,300,'10.00 mm']]) {
    const m = measure({ displacementMm: input }); assert.equal(m.angleDeg,angle); assert.equal(m.reading,reading); assert.equal(m.lift,m.displacementMm*4);
  }
  for (const v of [NaN,Infinity,'5',null]) assert.throws(() => measure({displacementMm:v}),/finite/);
  assert.deepEqual(Object.values(poses).map(s=>measure(s).displacementMm),[0,5,10]);
});
