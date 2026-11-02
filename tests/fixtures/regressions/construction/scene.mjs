import {measure} from './model.mjs';

/** One model-driven bench assembly, with physical terminal and seat declarations. */
export function createScene({kit, config, tokens}) {
  const k = kit.illustration;
  const stage = k.createStage({width: 760, height: 460,
    bounds: k.boxBounds([-78, -42, -4], [78, 42, 34]),
    config, tokens, reservedBottom: 40});
  const add = (part, x, y, z) => {
    part.position.set(x, y, z); stage.scene.add(part); return part;
  };
  const material = (part, id) => {k.material(part, id); return part;};
  material(add(k.box('bench', {width: 150, depth: 78, height: 4, radius: 3}), 0, 0, -2), 'gunmetal');

  // Separate panels share boundary planes; ventilation slots remain empty.
  const enclosure = new k.Group(); enclosure.name = 'instrument';
  stage.scene.add(enclosure);
  const panel = (name, width, depth, height, x, y, z) => {
    const part = k.box(name, {width, depth, height});
    part.position.set(x, y, z); enclosure.add(part); return material(part, 'steel');
  };
  panel('instrument-floor', 38, 38, 2, -50, 0, 1);
  panel('instrument-left', 2, 38, 28, -68, 0, 16);
  panel('instrument-right', 2, 38, 28, -32, 0, 16);
  panel('instrument-back', 34, 2, 28, -50, 18, 16);
  const front = panel('instrument-front', 34, 2, 28, -50, -18, 16);
  const vent = k.ventPanel('vent', {width: 38, depth: 38, height: 2, border: 3, slots: 6, slat: 2});
  vent.position.set(-50, 0, 31); enclosure.add(material(vent, 'steel'));
  k.label(front, 'H-06', {at: [-12, -1, 3], u: [1, 0, 0], v: [0, 0, -1], normal: [0, -1, 0], size: 5});
  k.label(front, 'INSPECT', {at: [-12, -1, -5], u: [1, 0, 0], v: [0, 0, -1], normal: [0, -1, 0], size: 2.5});

  const flange = k.cylinder('round-fitting', {radius: 6, height: 3, segments: 64});
  k.along(flange, [-31, 0, 20], [-28, 0, 20]); stage.scene.add(material(flange, 'brass'));
  const neck = k.cylinder('fitting-neck', {radius: 3, height: 2, segments: 64});
  k.along(neck, [-28, 0, 20], [-26, 0, 20]); stage.scene.add(material(neck, 'brass'));
  const coupling = k.annulus('coupling', {radius: 5, innerRadius: 3, height: 8, segments: 64});
  k.along(coupling, [-26, 0, 20], [-18, 0, 20]); stage.scene.add(material(coupling, 'chrome'));

  const lead = k.tube('braided-lead', {points: [[-18, 0, 20], [-8, 0, 20], [5, -8, 20], [22, -5, 20], [30, 12, 20], [38, 12, 20]], radius: 3, segments: 96, radialSegments: 48});
  k.routeTexture(lead, {kind: 'braid', strands: 2, turns: 8, width: .65});
  stage.scene.add(material(lead, 'rubber'));

  // Local Z follows world X; local Y follows world Z, making an upright saddle.
  const saddle = add(k.saddle('saddle', {radius: 3, width: 5, depth: 12, height: 20, segments: 48}), 50, 12, 0);
  saddle.quaternion.setFromAxisAngle(new k.Vector3(1, 1, 1).normalize(), 2 * Math.PI / 3);
  material(saddle, 'steel');
  const pipe = k.revolve('rigid-pipe', {profile: [[-12, 3], [-6, 3], [6, 3], [12, 3]], segments: 96});
  k.along(pipe, [38, 12, 20], [62, 12, 20]); stage.scene.add(material(pipe, 'brass'));

  k.port(neck, 'terminal', {at: [0, 0, 1], direction: [0, 0, 1], radius: 3});
  k.port(coupling, 'in', {at: [0, 0, -4], direction: [0, 0, -1], radius: 3});
  k.port(coupling, 'out', {at: [0, 0, 4], direction: [0, 0, 1], radius: 3});
  k.port(lead.children[0], 'in', {at: [-18, 0, 20], direction: [-1, 0, 0], radius: 3});
  k.port(lead.children.at(-1), 'out', {at: [38, 12, 20], direction: [1, 0, 0], radius: 3});
  k.port(pipe.children[0], 'in', {at: [0, 0, -3], direction: [0, 0, -1], radius: 3});
  const connections = [
    {a: 'fitting-neck', b: 'coupling', portA: 'terminal', portB: 'in'},
    {a: 'coupling', b: lead.children[0].name, portA: 'out', portB: 'in'},
    {a: lead.children.at(-1).name, b: pipe.children[0].name, portA: 'out', portB: 'in'}
  ];
  const seatFace = saddle.children.find(part => {
    const ring = part.userData.illustration.top;
    return ring.some((p, i) => {
      const q = ring[(i + 1) % ring.length];
      return Math.abs(p[1] - 17) < 1e-8 && Math.abs(q[1] - 17) < 1e-8 && Math.min(p[0], q[0]) <= 0 && Math.max(p[0], q[0]) >= 0;
    });
  });
  if (!seatFace) throw new Error('Missing physical saddle contact');
  const contacts = [{a: seatFace.name, b: pipe.children[1].name, atA: [0, 17, 0], atB: [3, 0, 0]}];
  return {...stage, connections, contacts, update(state) {
    const model = measure(state); stage.scene.rotation.z = model.radians;
    stage.scene.updateMatrixWorld(true); return model;
  }};
}
