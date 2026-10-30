import * as THREE from 'three';
import { rotorState } from './model.mjs';
const material = color => new THREE.MeshBasicMaterial({ color });
/** Metadata and GPU geometry are created together from identical primitive parameters. */
export function box(name, w, d, h, color) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, d, h), material(color));
  mesh.name = name;
  mesh.userData.illustration = { kind: 'box', w, d, h };
  return mesh;
}
export function cylinder(name, r, h, color) {
  const segments = 128,
    geometry = new THREE.CylinderGeometry(r, r, h, segments);
  geometry.rotateX(Math.PI / 2);
  const mesh = new THREE.Mesh(geometry, material(color));
  mesh.name = name;
  mesh.userData.illustration = { kind: 'cylinder', r, h, segments };
  return mesh;
}
export function createScene(tokens) {
  const scene = new THREE.Scene(),
    camera = new THREE.OrthographicCamera(-150, 150, 100, -100, 1, 1000);
  camera.up.set(0, 0, 1);
  camera.position.set(260, 260, 20 + Math.sqrt(260 ** 2 * 2) / Math.sqrt(3));
  camera.lookAt(0, 0, 20);
  scene.add(camera);
  const base = box('base', 160, 135, 8, tokens.surface);
  base.position.z = 4;
  scene.add(base);
  const pedestal = cylinder('pedestal', 27, 10, tokens.side1);
  pedestal.position.z = 13;
  scene.add(pedestal);
  const rotor = new THREE.Group();
  rotor.name = 'rotor';
  scene.add(rotor);
  const dial = cylinder('dial', 28, 14, tokens.top);
  dial.position.z = 25;
  dial.userData.illustration.ticks = true;
  rotor.add(dial);
  const needle = box('needle', 23, 2.2, 1.5, tokens.accent);
  needle.position.set(14.5, 0, 32.75);
  needle.userData.illustration.accent = true;
  rotor.add(needle);
  const hub = cylinder('hub', 3, 3, tokens.surface);
  hub.position.z = 33.5;
  rotor.add(hub);
  const support = box('support', 12, 12, 112, tokens.surface);
  support.position.set(36, 12, 64);
  scene.add(support);
  const glowMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthTest: true,
    depthWrite: false,
    premultipliedAlpha: true,
    toneMapped: false,
    side: THREE.DoubleSide,
    uniforms: {
      tint: { value: new THREE.Color(tokens.accent) },
      lightTheme: { value: tokens.page === '#edf1f6' ? 1 : 0 },
    },
    vertexShader:
      'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `varying vec2 vUv; uniform vec3 tint; uniform float lightTheme;
 void main(){float r=length(vUv*2.-1.);if(r>=1.)discard;float halo=pow(1.-r,2.);float core=1.-smoothstep(.18,.40,r);float a=max(halo*.8,core);vec3 color=mix(tint,vec3(1.),core*(1.-lightTheme*.6));gl_FragColor=vec4(color*a,a);}`,
  });
  const marker = new THREE.Mesh(new THREE.CircleGeometry(8, 128), glowMaterial);
  marker.name = 'marker';
  marker.position.set(55, 0, 55);
  marker.userData.illustration = { kind: 'disc', r: 8, segments: 128, effect: true };
  rotor.add(marker);
  const solids = [base, pedestal, dial, needle, hub, support];
  function update(state) {
    const m = rotorState(state);
    rotor.rotation.z = m.radians;
    rotor.updateMatrixWorld(true);
    const q = rotor.getWorldQuaternion(new THREE.Quaternion()).invert();
    marker.quaternion.copy(q.multiply(camera.quaternion));
    scene.updateMatrixWorld(true);
    camera.updateProjectionMatrix();
    return m;
  }
  function resize(w, h) {
    const half = 90;
    camera.left = (-half * w) / h;
    camera.right = (half * w) / h;
    camera.top = half;
    camera.bottom = -half;
    camera.updateProjectionMatrix();
    scene.updateMatrixWorld(true);
  }
  function dispose() {
    scene.traverse(o => {
      o.geometry?.dispose();
      if (o.material)
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose();
    });
    scene.clear();
  }
  return { scene, camera, rotor, marker, support, solids, update, resize, dispose };
}
