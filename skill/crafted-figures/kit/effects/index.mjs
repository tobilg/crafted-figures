import {
  Mesh,
  ShaderMaterial,
  PlaneGeometry,
  BoxGeometry,
  WebGLRenderer,
  WebGLRenderTarget,
  DepthTexture,
  MeshBasicMaterial,
  Vector2,
  Vector3,
  Vector4,
  Matrix4,
  Quaternion,
  DoubleSide,
  BackSide,
  UnsignedIntType,
} from '../../runtime/three.mjs';
const vertex = `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
const surface = `varying vec2 vUv; uniform float uTime,uIntensity,uDark,uKind,uHistoryCount;uniform vec4 uHistory[8];uniform vec3 uViewLocal;
float heightAt(vec2 p){float h=0.0;for(int i=0;i<8;i++){if(float(i)>=uHistoryCount)break;vec4 source=uHistory[i];float age=source.z,r=length(p-source.xy),front=r-age*.48;h+=source.w*.035*sin(front*29.0)*exp(-front*front*60.0)*smoothstep(0.0,.18,age)*exp(-age*.48)*(1.0-smoothstep(3.0,3.5,age));}return h;}
vec2 slopeAt(vec2 p){float d=.008;return vec2(heightAt(p+vec2(d,0.0))-heightAt(p-vec2(d,0.0)),heightAt(p+vec2(0.0,d))-heightAt(p-vec2(0.0,d)))/(2.0*d);}
void main(){vec2 p=vUv*2.0-1.0;float edge=(1.0-smoothstep(.75,1.0,abs(p.x)))*(1.0-smoothstep(.75,1.0,abs(p.y)));float alpha;vec3 color;
 if(uKind<.5){float r=length(p);alpha=(1.0-smoothstep(.05,1.0,r))*exp(-r*r*2.0)*uIntensity;color=mix(vec3(.05,.48,.55),vec3(.42,.94,1.0),uDark);}
 else if(uKind<1.5){vec2 slope=slopeAt(p);vec3 normal=normalize(vec3(-slope,.8));float facing=clamp(abs(dot(normal,normalize(uViewLocal))),0.0,1.0),fresnel=.02+.98*pow(1.0-facing,5.0);
 // Analytic refraction of the declared planar tile pattern; no scene texture or arbitrary mesh refraction.
 vec2 refracted=p-slope*.11,cell=abs(fract((refracted+1.0)*5.0)-.5);float grout=smoothstep(.455,.49,max(cell.x,cell.y));vec3 floorColor=mix(vec3(.48,.79,.82),vec3(.09,.38,.46),uDark)*(1.0-grout*.32);
 vec3 reflection=mix(vec3(.75,.9,.96),vec3(.28,.59,.72),clamp(.5+slope.y*.8,0.0,1.0));reflection=mix(reflection,reflection*.62,uDark);
 color=mix(floorColor,reflection,clamp(.18+fresnel*.7+length(slope)*.2,0.0,1.0));alpha=edge*(.32+.3*fresnel+.14*length(slope))*uIntensity;}
 else if(uKind<2.5){float d=.012;vec2 s=slopeAt(p);float curvature=(slopeAt(p+vec2(d,0.0)).x-slopeAt(p-vec2(d,0.0)).x+slopeAt(p+vec2(0.0,d)).y-slopeAt(p-vec2(0.0,d)).y)/(2.0*d);float focus=clamp(-curvature*.045,0.0,1.0);alpha=edge*focus*.65*uIntensity;color=mix(vec3(.35,.77,.79),vec3(.62,.96,.9),uDark);}
 else {float r=length(p);alpha=(1.0-smoothstep(.55,1.0,r))*uIntensity;color=mix(vec3(.08,.18,.22),vec3(.01,.025,.04),uDark);}
 alpha=clamp(alpha,0.0,.95);gl_FragColor=vec4(color*alpha,alpha);}`;
const volume = `uniform sampler2D uDepth;uniform vec2 uResolution;uniform mat4 uInvProjection,uCameraWorld,uWorldInverse;uniform vec3 uHalf;uniform float uNear,uFar,uTime,uIntensity,uDark,uKind,uSteps;
float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
float noise3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float turbulence(vec3 p){return .57*noise3(p)+.29*noise3(p*2.03)+.14*noise3(p*4.07);}
void main(){vec2 uv=gl_FragCoord.xy/uResolution;vec4 a=uInvProjection*vec4(uv*2.0-1.0,-1.0,1.0);vec3 origin=(uCameraWorld*vec4(a.xyz/a.w,1.0)).xyz;vec3 direction=normalize((uCameraWorld*vec4(0.0,0.0,-1.0,0.0)).xyz);vec3 ro=(uWorldInverse*vec4(origin,1.0)).xyz,rd=(uWorldInverse*vec4(direction,0.0)).xyz;vec3 inv=1.0/(rd+vec3(1e-9));vec3 t0=(-uHalf-ro)*inv,t1=(uHalf-ro)*inv;vec3 lo=min(t0,t1),hi=max(t0,t1);float start=max(0.0,max(lo.x,max(lo.y,lo.z))),end=min(min(hi.x,min(hi.y,hi.z)),texture2D(uDepth,uv).x*(uFar-uNear));if(end<=start)discard;float stepSize=(end-start)/uSteps;vec4 sum=vec4(0.0);
 for(int i=0;i<48;i++){if(float(i)>=uSteps)break;float t=start+(float(i)+.5)*stepSize;vec3 q=(ro+rd*t)/uHalf;float z=q.z*.5+.5;float radial=dot(q.xy,q.xy);float bound=(1.0-smoothstep(.65,1.0,abs(q.x)))*(1.0-smoothstep(.65,1.0,abs(q.y)))*smoothstep(0.0,.12,z)*(1.0-smoothstep(.65,1.0,z));float noise=turbulence(vec3(q.xy*4.0,q.z*3.5-uTime*1.8));float width=uKind<.5?mix(.5,.12,z):mix(.32,.65,z);vec2 curl=q.xy-vec2(sin(z*8.0-uTime*2.0),cos(z*6.0-uTime*1.6))*z*.13;float body=exp(-dot(curl,curl)/(width*width));float wisps=smoothstep(.22,.78,noise+body*.45);float density=body*bound*wisps*uIntensity;float alpha=1.0-exp(-density*stepSize*(uKind<.5?.32:.16));vec3 color;
 if(uKind<.5){float heat=clamp(body*(1.0-z)*1.4+noise*.23,0.0,1.0);color=mix(vec3(1.0,.11,.012),vec3(1.0,.94,.64),pow(heat,1.8));color=mix(vec3(.19,.43,1.0),color,smoothstep(.04,.2,z));}else color=mix(vec3(.36,.45,.49),vec3(.8,.87,.9),uDark)*( .72+.28*noise);sum.rgb+=(1.0-sum.a)*color*alpha;sum.a+=(1.0-sum.a)*alpha;}
 gl_FragColor=sum;}`;
/** Bounded, parameterized effect recipes. All placement is native Three transforms.
 * Volumes read matching scene depth; surface recipes use the retained depth pass.
 */
export function effect(
  name,
  {
    kind = 'glow',
    size = [10, 10, 10],
    layer = 0,
    intensity = 1,
    theme = 'light',
    quality = 'standard',
  } = {},
) {
  if (
    !['glow', 'spark', 'fire', 'steam', 'water', 'caustics', 'shadow'].includes(kind) ||
    !size.every(v => Number.isFinite(v) && v > 0) ||
    !Number.isInteger(layer) ||
    layer < 0 ||
    layer > 4
  )
    throw new Error(`effect ${name}: unsupported kind, bounds or layer`);
  const isVolume = ['fire', 'steam'].includes(kind),
    geometry = isVolume ? new BoxGeometry(...size) : new PlaneGeometry(size[0], size[1]);
  const uniforms = {
    uHistoryCount: { value: 0 },
    uHistory: { value: Array.from({ length: 8 }, () => new Vector4()) },
    uViewLocal: { value: new Vector3(0, 0, 1) },
    uTime: { value: 0 },
    uIntensity: { value: intensity },
    uDark: { value: theme === 'dark' ? 1 : 0 },
    uKind: {
      value: isVolume
        ? kind === 'steam'
          ? 1
          : 0
        : kind === 'water'
          ? 1
          : kind === 'caustics'
            ? 2
            : kind === 'shadow'
              ? 3
              : 0,
    },
    uHalf: { value: new Vector3(...size).multiplyScalar(0.5) },
    uDepth: { value: null },
    uResolution: { value: new Vector2(1, 1) },
    uInvProjection: { value: new Matrix4() },
    uCameraWorld: { value: new Matrix4() },
    uWorldInverse: { value: new Matrix4() },
    uNear: { value: 0.1 },
    uFar: { value: 10000 },
    uSteps: { value: quality === 'draft' ? 24 : 48 },
  };
  const material = new ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: isVolume ? volume : surface,
    uniforms,
    transparent: true,
    premultipliedAlpha: true,
    depthWrite: false,
    depthTest: !isVolume,
    side: isVolume ? BackSide : DoubleSide,
    forceSinglePass: true,
  });
  const object = new Mesh(geometry, material);
  object.name = name;
  object.userData.craftedEffect = {
    kind,
    layer,
    isVolume,
    billboard: ['glow', 'spark'].includes(kind),
  };
  return object;
}
/** Shared deterministic wave events for water and its receiving-plane caustics.
 * Coordinates are surface-local normalized [-1,1]; age is seconds since emission.
 * @param {Mesh} object
 * @param {Array<{x:number,y:number,age:number,amplitude:number}>} history
 */
export function surfaceHistory(object, history) {
  const kind = object.userData.craftedEffect?.kind;
  if (!['water', 'caustics'].includes(kind))
    throw new Error('surfaceHistory requires a water or caustics surface');
  if (
    !Array.isArray(history) ||
    history.length > 8 ||
    history.some(
      e =>
        !e ||
        Object.keys(e).some(k => !['x', 'y', 'age', 'amplitude'].includes(k)) ||
        !['x', 'y', 'age', 'amplitude'].every(k => Number.isFinite(e[k])) ||
        Math.abs(e.x) > 1 ||
        Math.abs(e.y) > 1 ||
        e.age < 0 ||
        e.amplitude < 0 ||
        e.amplitude > 1,
    )
  )
    throw new Error(
      'surfaceHistory: at most 8 events with x/y in [-1,1], nonnegative age and amplitude in [0,1]',
    );
  const u = /** @type {any} */ (object.material).uniforms;
  u.uHistoryCount.value = history.length;
  for (const [i, e] of history.entries()) u.uHistory.value[i].set(e.x, e.y, e.age, e.amplitude);
  return object;
}
/** Explicit vector fallback stays in the normal SVG and is excluded from GL depth. */
export function fallback(object, effectName) {
  object.traverse(o => {
    if (o.userData.illustration) o.userData.illustration.effectFallback = effectName;
  });
  return object;
}
/** Place vector artwork after an effect pass. The assignment lives on the
 * same scene hierarchy; impossible solid painter ordering is rejected. */
export function svgPass(object, { afterLayer }) {
  if (!Number.isInteger(afterLayer) || afterLayer < 0 || afterLayer > 4)
    throw new Error('SVG pass afterLayer must be an integer from 0 to 4');
  object.userData.svgAfterLayer = afterLayer;
  return object;
}
class Pass {
  constructor(scene, camera, canvas, layer, { pixelRatioCap = 1.5 } = {}) {
    const context = canvas.getContext('webgl2', {
      alpha: true,
      antialias: true,
      premultipliedAlpha: true,
    });
    if (!context) throw new Error('WebGL2 unavailable');
    this.scene = scene;
    this.camera = camera;
    this.layer = layer;
    this.cap = pixelRatioCap;
    this.renderer = new WebGLRenderer({
      canvas,
      context,
      alpha: true,
      antialias: true,
      premultipliedAlpha: true,
    });
    this.renderer.autoClear = false;
    this.renderer.setClearColor(0, 0);
    this.depth = new MeshBasicMaterial({ colorWrite: false, depthWrite: true });
    this.renderer.debug.onShaderError = () => {
      this.error = 'Shader compilation/link failed';
    };
  }
  size(w, h) {
    const r = this.renderer;
    r.setPixelRatio(Math.min(devicePixelRatio, this.cap));
    r.setSize(w, h, false);
    const size = r.getDrawingBufferSize(new Vector2());
    this.drawing = size;
    if (this.target?.width === size.x && this.target?.height === size.y) return;
    this.target?.dispose();
    this.target = null;
  }
  /** Volumes read scene depth from a texture; only a layer with a volume allocates one. */
  depthTarget() {
    const { x, y } = this.drawing;
    this.target ??= new WebGLRenderTarget(x, y, {
      depthBuffer: true,
      depthTexture: new DepthTexture(x, y, UnsignedIntType),
    });
    return this.target;
  }
  render(time) {
    const s = this.scene,
      c = this.camera,
      r = this.renderer,
      meshes = [];
    s.updateMatrixWorld(true);
    c.updateMatrixWorld(true);
    s.traverse(o => {
      if (o.isMesh) meshes.push({ o, visible: o.visible, material: o.material });
    });
    const original = s.overrideMaterial;
    try {
      for (const { o } of meshes)
        if (o.userData.craftedEffect || o.userData.illustration?.effectFallback) o.visible = false;
      const here = meshes
          .filter(({ o, visible }) => visible && o.userData.craftedEffect?.layer === this.layer)
          .map(({ o }) => o.userData.craftedEffect),
        volumes = here.some(e => e.isVolume),
        surfaces = here.some(e => !e.isVolume);
      s.overrideMaterial = this.depth;
      if (volumes) {
        r.setRenderTarget(this.depthTarget());
        r.clear(true, true, true);
        r.render(s, c);
      }
      r.setRenderTarget(null);
      r.clear(true, true, true);
      if (surfaces) r.render(s, c); // Matching depth retained in the visible canvas.
      s.overrideMaterial = original;
      for (const { o, visible } of meshes) {
        const e = o.userData.craftedEffect;
        if (!e) {
          o.visible = visible && !o.userData.illustration?.effectFallback;
          o.material = this.depth;
          continue;
        }
        o.visible = visible && e.layer === this.layer;
        if (!o.visible) continue;
        if (e.billboard) {
          const parentRotation = o.parent?.getWorldQuaternion(new Quaternion()) || new Quaternion();
          o.quaternion.copy(parentRotation.invert().multiply(c.quaternion));
          o.updateWorldMatrix(true, false);
        }
        const u = o.material.uniforms;
        u.uTime.value = time;
        u.uDepth.value = this.target?.depthTexture ?? null;
        u.uResolution.value.set(this.drawing.x, this.drawing.y);
        u.uInvProjection.value.copy(c.projectionMatrixInverse);
        u.uCameraWorld.value.copy(c.matrixWorld);
        u.uWorldInverse.value.copy(o.matrixWorld).invert();
        u.uNear.value = c.near;
        u.uFar.value = c.far;
        u.uViewLocal.value
          .set(0, 0, 1)
          .transformDirection(c.matrixWorld)
          .transformDirection(u.uWorldInverse.value);
      }
      r.render(s, c);
      if (this.error) throw new Error(this.error);
    } finally {
      s.overrideMaterial = original;
      for (const { o, visible, material } of meshes) {
        o.visible = visible;
        o.material = material;
      }
      r.setRenderTarget(null);
    }
  }
  dispose() {
    this.target?.dispose();
    this.depth.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}
/** A browser keeps a limited number of WebGL contexts and drops the oldest when more are
 * created, so a figure only holds its contexts while it is on or near the screen. */
const NEAR_VIEWPORT = '100%';
const MIN_VIEWPORT = 40;
/** Resizing or capturing can report a viewport a few pixels tall for one frame, and a figure
 * outside it would look scrolled away. Trust only a measurement against a usable viewport
 * at least as large as the present one. Cross-origin frames report no bounds.
 * @param {IntersectionObserverEntry} entry
 */
function measuredInFullViewport({ rootBounds }) {
  if (!rootBounds) return true;
  return (
    Math.min(rootBounds.width, rootBounds.height) >= 3 * MIN_VIEWPORT &&
    rootBounds.width >= innerWidth &&
    rootBounds.height >= innerHeight
  );
}
/** Multiple transparent canvases share exactly one authoritative scene/camera.
 * The caller owns the clock and calls render after model updates; no private RAF.
 * `stats.mode` is `webgl`, `vector` (fallback) or `suspended` (offscreen, holding no context).
 */
export function mountEffects(root, stage, config) {
  const svg = root.querySelector('svg.crafted'),
    host = svg.parentElement,
    canvases = [],
    passes = [],
    svgLayers = [];
  let disposed = false,
    unavailable = false,
    time = 0,
    contexts = new AbortController();
  const stats = { mode: 'vector', renders: 0, canvases: 0, svgPasses: 0, error: null };
  const fallbackNodes = () => root.querySelectorAll('[data-effect-fallback]');
  const showFallback = () => {
    stats.mode = 'vector';
    stage.renderer.setPassTargets(new Map());
    for (const s of svgLayers) s.style.display = 'none';
    for (const c of canvases) c.hidden = true;
    for (const el of fallbackNodes()) el.style.removeProperty('display');
  };
  const layers = new Set();
  stage.scene.traverse(o => {
    if (o.userData.craftedEffect) layers.add(o.userData.craftedEffect.layer);
  });
  const vectorLayers = new Set();
  stage.scene.traverse(o => {
    if (o.userData.svgAfterLayer !== undefined) vectorLayers.add(o.userData.svgAfterLayer);
  });
  let resizing, watching;
  function align(el, rect, parent) {
    Object.assign(el.style, {
      left: `${rect.left - parent.left - host.clientLeft + host.scrollLeft}px`,
      top: `${rect.top - parent.top - host.clientTop + host.scrollTop}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    });
  }
  function resize() {
    if (disposed || stats.mode !== 'webgl') return;
    const rect = svg.getBoundingClientRect(),
      parent = host.getBoundingClientRect();
    for (const el of svgLayers) align(el, rect, parent);
    for (let i = 0; i < passes.length; i++) {
      align(canvases[i], rect, parent);
      passes[i].size(rect.width, rect.height);
    }
    render(time);
  }
  function render(next = 0) {
    time = next;
    if (disposed || stats.mode !== 'webgl') return;
    try {
      for (const pass of passes) pass.render(time);
      for (const el of fallbackNodes()) el.style.display = 'none';
      stats.renders++;
    } catch (e) {
      stats.error = e.message;
      showFallback();
    }
  }
  /** Release every context and layer element; the vector fallback remains drawn. */
  function teardown() {
    contexts.abort();
    contexts = new AbortController();
    showFallback();
    for (const s of svgLayers) s.remove();
    for (const p of passes) p.dispose();
    for (const c of canvases) c.remove();
    svgLayers.length = passes.length = canvases.length = 0;
    stats.svgPasses = stats.canvases = 0;
  }
  function activate() {
    if (disposed || unavailable || !layers.size || stats.mode === 'webgl') return;
    teardown();
    stats.error = null;
    try {
      if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
      const targets = new Map();
      for (const layer of [...new Set([...layers, ...vectorLayers])].sort((a, b) => a - b)) {
        if (layers.has(layer)) {
          const canvas = document.createElement('canvas');
          canvas.dataset.effectLayer = String(layer);
          canvas.setAttribute('aria-hidden', 'true');
          Object.assign(canvas.style, { position: 'absolute', pointerEvents: 'none' });
          host.append(canvas);
          canvases.push(canvas);
          canvas.addEventListener(
            'webglcontextlost',
            e => {
              e.preventDefault();
              if (!disposed) {
                stats.error = 'WebGL context lost';
                showFallback();
              }
            },
            { signal: contexts.signal },
          );
          passes.push(new Pass(stage.scene, stage.camera, canvas, layer, config.rendering));
        }
        if (vectorLayers.has(layer)) {
          const overlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg'),
            g = document.createElementNS(overlay.namespaceURI, 'g');
          overlay.setAttribute('viewBox', svg.getAttribute('viewBox'));
          overlay.setAttribute('class', 'crafted');
          overlay.setAttribute('aria-hidden', 'true');
          overlay.dataset.vectorLayer = String(layer);
          g.dataset.scene = '';
          overlay.append(g);
          Object.assign(overlay.style, {
            position: 'absolute',
            pointerEvents: 'none',
            background: 'transparent',
            overflow: 'visible',
          });
          host.append(overlay);
          svgLayers.push(overlay);
          targets.set(layer, g);
        }
      }
      stage.renderer.setPassTargets(targets);
      stats.svgPasses = svgLayers.length;
      stats.mode = 'webgl';
      stats.canvases = canvases.length;
      resize();
    } catch (e) {
      unavailable = true;
      stats.error = e.message;
      showFallback();
    }
  }
  if (config.rendering?.effects !== 'off' && layers.size) {
    const rect = root.getBoundingClientRect();
    if (rect.bottom >= -innerHeight && rect.top <= 2 * innerHeight) activate();
    else {
      showFallback();
      stats.mode = 'suspended';
    }
    resizing = new ResizeObserver(resize);
    resizing.observe(svg);
    // A context lost while on screen stays in the fallback; returning to the figure retries.
    watching = new IntersectionObserver(
      entries => {
        const entry = entries.at(-1);
        if (entry.isIntersecting) {
          if (stats.mode === 'suspended') activate();
        } else if (!unavailable && measuredInFullViewport(entry)) {
          teardown();
          stats.mode = 'suspended';
        }
      },
      { rootMargin: NEAR_VIEWPORT },
    );
    watching.observe(root);
  }
  return {
    render,
    /** Acquire contexts now, for tools that need this figure's raster layers while offscreen. */
    activate,
    stats,
    canvases,
    svgLayers,
    dispose() {
      if (disposed) return;
      resizing?.disconnect();
      watching?.disconnect();
      teardown();
      disposed = true;
    },
  };
}
