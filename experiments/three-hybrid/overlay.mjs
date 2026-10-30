import * as THREE from 'three';
/** Transparent overlay. It owns no second scene or camera. */
export class DepthOverlay {
  constructor(sceneData, canvas) {
    this.data = sceneData;
    const context = canvas.getContext('webgl2', {
      alpha: true,
      antialias: true,
      premultipliedAlpha: true,
    });
    if (!context) throw new Error('WebGL2 unavailable');
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      context,
      alpha: true,
      antialias: true,
      premultipliedAlpha: true,
    });
    this.renderer.autoClear = false;
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.debug.onShaderError = () => {
      this.shaderError = 'Shader compilation/link failed';
    };
    this.depthMaterial = new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: true,
      depthTest: true,
    });
    this.disposed = false;
    this.target = null;
  }
  setSize(width, height) {
    this.width = width;
    this.height = height;
    this.ratio = Math.min(devicePixelRatio, 1.5);
    this.renderer.setPixelRatio(this.ratio);
    this.renderer.setSize(width, height, false);
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    if (!this.target || this.target.width !== size.x || this.target.height !== size.y) {
      this.target?.dispose();
      this.target = new THREE.WebGLRenderTarget(size.x, size.y, { depthBuffer: true, samples: 4 });
    }
  }
  render(target = null, { occlusion = true } = {}) {
    const { scene, camera, marker, solids } = this.data,
      r = this.renderer,
      original = scene.overrideMaterial,
      visible = solids.map(o => o.visible),
      effectVisible = marker.visible;
    r.setRenderTarget(target);
    r.clear(true, true, true);
    try {
      if (occlusion) {
        marker.visible = false;
        scene.overrideMaterial = this.depthMaterial;
        r.render(scene, camera);
      }
      // Keep the just-rendered depth. Only the effect contributes color.
      scene.overrideMaterial = original;
      for (const o of solids) o.visible = false;
      marker.visible = effectVisible;
      r.render(scene, camera);
    } finally {
      for (const [i, o] of solids.entries()) o.visible = visible[i];
      marker.visible = effectVisible;
      scene.overrideMaterial = original;
      r.setRenderTarget(null);
    }
    if (this.shaderError) throw new Error(this.shaderError);
  }
  pixels({ occlusion = true } = {}) {
    this.render(this.target, { occlusion });
    const data = new Uint8Array(this.target.width * this.target.height * 4);
    this.renderer.readRenderTargetPixels(
      this.target,
      0,
      0,
      this.target.width,
      this.target.height,
      data,
    );
    return { data, width: this.target.width, height: this.target.height };
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.target?.dispose();
    this.depthMaterial.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}
