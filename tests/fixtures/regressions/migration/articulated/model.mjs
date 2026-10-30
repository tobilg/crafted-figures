/** MIT upstream model functions, extracted without upstream engine imports. */
export const follow = (values) => ({ ...values, wheel: -(values.dial ?? 0) / 4, pawl: 4 * Math.sin(((values.dial ?? 0) * Math.PI) / 18), "f2.mcp": -22 * (values.lift ?? 0), "f2.pip": -14 * (values.lift ?? 0), "f2.dip": -9 * (values.lift ?? 0) });
export const tapAt = (time) => {
  const phase = ((time % 4) + 4) % 4;
  const up = Math.min(1, Math.max(0, (phase - 0.4) / 0.9));
  const down = Math.min(1, Math.max(0, (phase - 2.2) / 1.1));
  const ease = (x) => x * x * (3 - 2 * x);
  return ease(up) * (1 - ease(down));
};
export const breakAt = (time) => {
  if (!(time > 0)) return null;
  const flight = 0.79888;
  const c = 1.0;
  let phi = 0;
  let psi = 0;
  let y = 0;
  let z = 0;
  if (time < flight) {
    const s = time / flight;
    phi = 2 * Math.PI * s * s * (3 - 2 * s);
    y = 16 * time;
    z = 25 * time - 49 * time * time;
  } else {
    const k = 1 - Math.exp(-(time - flight) / 0.25);
    phi = 2 * Math.PI;
    y = 16 * flight + 1.5 * k;
    z = -11.3;
    psi = (40 * Math.PI * k) / 180;
  }
  const cp = Math.cos(phi);
  const sp = Math.sin(phi);
  const cz = Math.cos(psi);
  const sz = Math.sin(psi);
  const R = [cz, -sz * cp, sz * sp, sz, cz * cp, -cz * sp, 0, sp, cp];
  return { R, t: [-R[2] * c, y - R[5] * c, z + c - R[8] * c] };
};
export const BREAK_END = 2.2;

export const INDEX=220;
export const readingOf=turn=>((((INDEX+90-turn)/3.6)%100)+100)%100;
/** @param {{dial:number,lift:number,podTime:number}} state */
export function measure(state){if(!state||!['dial','lift','podTime'].every(key=>Number.isFinite(state[key])))throw new Error('finite dial, lift, podTime required');const dial=state.dial,lift=Math.max(0,Math.min(1,state.lift)),podTime=Math.max(0,Math.min(BREAK_END,state.podTime));return {...follow({dial,lift}),podTime,pod:breakAt(podTime),reading:`dial ${Math.round(readingOf(dial))%100} · ${(((dial%360)+360)%360).toFixed(1)}°${podTime>0?' · pod off':''}`};}
export const poses={rest:{dial:0,lift:0,podTime:0},mid:{dial:90,lift:.5,podTime:0},max:{dial:180,lift:1,podTime:0},released:{dial:100,lift:.3,podTime:.3},landed:{dial:100,lift:.3,podTime:2.2}};

// Effect history is explicit and survives later emitter movement.
for(const pose of Object.values(poses))Object.assign(pose,{effectTime:0,burstTime:-1,burstDial:0,burstSeed:7});
poses.sparks={dial:100,lift:.3,podTime:.2,effectTime:.2,burstTime:.2,burstDial:100,burstSeed:7};
