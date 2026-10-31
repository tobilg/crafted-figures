import { createValve } from '../lift-valve/scene.mjs';
export function createScene(args) {
  const k = args.kit.illustration,
    source = createValve({
      ...args,
      rotation: Math.PI / 2,
      config: { ...args.config, detail: args.config.detail === 'compact' ? 'compact' : 'standard' },
    });
  // Rotate native hierarchy to keep the cutaway open in the qualified positive-azimuth views.
  k.material(source.scene, 'steel', { role: 'subject' });
  source.scene.traverse(o => {
    if (['inlet', 'outlet'].includes(o.name)) {
      k.material(o, 'rubber', { role: 'hoses' });
      if (args.config.detail === 'detailed') k.routeRings(o, { every: 3 });
    }
    if (o.name === 'poppet') k.material(o, 'brass', { role: 'poppet' });
  });
  return source;
}
