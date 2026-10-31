import { createCabinet } from '../control-cabinet/scene.mjs';
import { measure } from './model.mjs';
export function createScene({ kit, config }) {
  const k = kit.illustration,
    s = createCabinet({ kit, config });
  const screen = new k.Group();
  screen.name = 'display-assembly';
  screen.position.set(0, -20, 87);
  screen.rotation.x = 0.3;
  s.scene.add(screen);
  const panel = k.box('display-panel', { width: 58, depth: 2, height: 22, radius: 1 });
  screen.add(panel);
  const content = k.display(panel, {
    id: 'text',
    at: [-25, -1.01, 8],
    u: [1, 0, 0],
    v: [0, 0, -1],
    normal: [0, -1, 0],
    width: 50,
    height: 16,
    text: 'READY',
    size: 5,
  });
  for (const [id, w, h, x, z] of [
    ['top', 62, 3, 0, 12.5],
    ['bottom', 62, 3, 0, -12.5],
    ['left', 3, 22, -30.5, 0],
    ['right', 3, 22, 30.5, 0],
  ]) {
    const p = k.box('bezel-' + id, { width: w, depth: 4, height: h });
    p.position.set(x, -1, z);
    screen.add(p);
  }
  const base = s.update;
  function update(state) {
    const m = measure(state);
    base({ temperatureC: m.temperatureC });
    m.closed.forEach((closed, i) => {
      const bridge = s.scene.getObjectByName('bridge-' + i),
        pusher = s.scene.getObjectByName('pusher-' + i),
        lift = closed ? 0 : 6;
      bridge.position.z = 64.75 + lift;
      bridge.userData.illustration.tone = closed ? 'accent' : 'surface';
      pusher.scale.z = 4 + lift;
      pusher.position.z = 60 + (4 + lift) / 2;
    });
    content.text = m.text || 'READY';
    return m;
  }
  return { ...s, update };
}
