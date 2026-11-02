/** Compare the painted SVG with a real depth buffer, pixel by pixel.
 *
 * Runs in the page through `locator.evaluate`, so it must stay self-contained. The depth pass
 * uses raw WebGL rather than the kit's renderers or Three.js's: the check stays independent of
 * what it checks, and no figure has to ship a WebGL renderer for it.
 *
 * Only interior pixels count, where neighbours agree in both buffers, because the rasterizers
 * differ at edges. A disagreement is confirmed with a ray: surfaces meeting within
 * `tieTolerance` have no visible order, so they are ties rather than faults. `control` repaints
 * in reverse, which must disagree wherever parts overlap, proving the comparison can fail.
 * @param {Element} root the figure root
 * @param {{scale?:number,minPixels?:number,minCoverage?:number,tieTolerance?:number,control?:boolean}} [options]
 * @returns {Promise<Record<string,any>>}
 */
export async function zBufferOrder(
  root,
  { scale = 2, minPixels = 4, minCoverage = 24, tieTolerance = 0.08, control = false } = {},
) {
  const stage = root.__craftedController?.stage;
  if (!stage) return { status: 'not applicable', reason: 'no stage on this figure', findings: [] };
  const started = performance.now(),
    { scene, camera, width: stageWidth, height: stageHeight } = stage,
    width = Math.round(stageWidth * scale),
    height = Math.round(stageHeight * scale),
    meshes = [];
  scene.updateMatrixWorld(true);
  camera.updateMatrixWorld(true);
  scene.traverseVisible(o => {
    if (o.isMesh && !o.userData.craftedEffect && !o.userData.illustration?.effectFallback)
      meshes.push(o);
  });
  const idOf = new Map(meshes.map((mesh, i) => [mesh.name, i + 1]));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true });
  if (!gl)
    return {
      status: 'blocked',
      reason: 'WebGL2 is unavailable, so painted order was not checked',
      findings: [
        {
          code: 'ZBUFFER_UNAVAILABLE',
          message: 'WebGL2 is unavailable, so painted order was not checked',
        },
      ],
    };
  const compile = (type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
      throw new Error(`z-buffer shader: ${gl.getShaderInfoLog(shader)}`);
    return shader;
  };
  const program = gl.createProgram();
  gl.attachShader(
    program,
    compile(
      gl.VERTEX_SHADER,
      '#version 300 es\nin vec3 p;uniform mat4 m;void main(){gl_Position=m*vec4(p,1.);}',
    ),
  );
  gl.attachShader(
    program,
    compile(
      gl.FRAGMENT_SHADER,
      '#version 300 es\nprecision highp float;uniform vec3 c;out vec4 o;void main(){o=vec4(c,1.);}',
    ),
  );
  gl.linkProgram(program);
  // biome-ignore lint/correctness/useHookAtTopLevel: a WebGL call, not a React hook
  gl.useProgram(program);
  const matrixAt = gl.getUniformLocation(program, 'm'),
    colorAt = gl.getUniformLocation(program, 'c'),
    positionAt = gl.getAttribLocation(program, 'p'),
    vertices = gl.createBuffer(),
    indices = gl.createBuffer();
  gl.viewport(0, 0, width, height);
  gl.enable(gl.DEPTH_TEST);
  gl.disable(gl.DITHER);
  gl.disable(gl.BLEND);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.enableVertexAttribArray(positionAt);
  const view = camera.projectionMatrix.clone().multiply(camera.matrixWorldInverse);
  for (const [i, mesh] of meshes.entries()) {
    const id = i + 1,
      position = mesh.geometry.getAttribute('position'),
      index = mesh.geometry.index;
    gl.uniformMatrix4fv(matrixAt, false, view.clone().multiply(mesh.matrixWorld).elements);
    gl.uniform3f(colorAt, (id >> 16) / 255, ((id >> 8) & 255) / 255, (id & 255) / 255);
    gl.bindBuffer(gl.ARRAY_BUFFER, vertices);
    gl.bufferData(gl.ARRAY_BUFFER, position.array, gl.STREAM_DRAW);
    gl.vertexAttribPointer(positionAt, 3, gl.FLOAT, false, 0, 0);
    if (index) {
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indices);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, index.array, gl.STREAM_DRAW);
      gl.drawElements(
        gl.TRIANGLES,
        index.count,
        index.array instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT,
        0,
      );
    } else gl.drawArrays(gl.TRIANGLES, 0, position.count);
  }
  const pixels = new Uint8Array(width * height * 4);
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  const depthIds = new Int32Array(width * height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const from = ((height - 1 - y) * width + x) * 4;
      depthIds[y * width + x] = (pixels[from] << 16) | (pixels[from + 1] << 8) | pixels[from + 2];
    }

  // Document order is the real paint order, including parts moved into effect overlay layers.
  const painted = [...root.querySelectorAll('svg.crafted [data-object]')].filter(
    node => !node.hasAttribute('data-effect-fallback') && idOf.has(node.dataset.object),
  );
  const rasterize = async nodes => {
    const ns = 'http://www.w3.org/2000/svg',
      svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('xmlns', ns);
    svg.setAttribute('viewBox', `0 0 ${stageWidth} ${stageHeight}`);
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));
    svg.setAttribute('shape-rendering', 'crispEdges');
    for (const node of nodes) {
      const id = idOf.get(node.dataset.object),
        fill = `#${id.toString(16).padStart(6, '0')}`,
        group = document.createElementNS(ns, 'g');
      group.setAttribute('fill', fill);
      for (const path of node.querySelectorAll(
        ':scope > path.surface, :scope > path.top, :scope > path[class^="side-"]',
      )) {
        const copy = document.createElementNS(ns, 'path');
        copy.setAttribute('d', path.getAttribute('d'));
        if (path.hasAttribute('fill-rule'))
          copy.setAttribute('fill-rule', path.getAttribute('fill-rule'));
        group.append(copy);
      }
      svg.append(group);
    }
    const url = URL.createObjectURL(
        new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' }),
      ),
      image = new Image();
    image.src = url;
    await image.decode();
    const surface = document.createElement('canvas');
    surface.width = width;
    surface.height = height;
    const context = surface.getContext('2d', { willReadFrequently: true });
    context.imageSmoothingEnabled = false;
    context.drawImage(image, 0, 0, width, height);
    URL.revokeObjectURL(url);
    const { data } = context.getImageData(0, 0, width, height),
      ids = new Int32Array(width * height);
    for (let i = 0; i < ids.length; i++)
      ids[i] = (data[i * 4] << 16) | (data[i * 4 + 1] << 8) | data[i * 4 + 2];
    return ids;
  };
  const compare = paintIds => {
    const pairs = new Map();
    let compared = 0;
    for (let y = 1; y < height - 1; y++)
      for (let x = 1; x < width - 1; x++) {
        const i = y * width + x,
          depth = depthIds[i],
          paint = paintIds[i];
        if (depth || paint) compared++;
        if (depth === paint) continue;
        if (
          depthIds[i - 1] !== depth ||
          depthIds[i + 1] !== depth ||
          depthIds[i - width] !== depth ||
          depthIds[i + width] !== depth ||
          paintIds[i - 1] !== paint ||
          paintIds[i + 1] !== paint ||
          paintIds[i - width] !== paint ||
          paintIds[i + width] !== paint
        )
          continue;
        const key = depth * 16777216 + paint;
        let pair = pairs.get(key);
        if (!pair) {
          pair = { depth, paint, pixels: 0, samples: [] };
          pairs.set(key, pair);
        }
        pair.pixels++;
        if (pair.pixels % 7 === 1 && pair.samples.length < 12) pair.samples.push([x, y]);
      }
    return { pairs: [...pairs.values()], compared };
  };
  const { pairs, compared } = compare(await rasterize(painted)),
    rays = stage.renderer.rays,
    nameOf = id => meshes[id - 1]?.name ?? null,
    findings = [];
  let ties = 0;
  for (const pair of pairs) {
    const at = pair.samples[0].map(v => v / scale);
    if (!pair.paint || !pair.depth) {
      if (pair.pixels >= minCoverage)
        findings.push({
          code: pair.paint ? 'ZBUFFER_EXCESS' : 'ZBUFFER_MISSING',
          part: nameOf(pair.paint || pair.depth),
          pixels: pair.pixels,
          at,
          message: pair.paint
            ? 'Painted artwork has no mesh surface behind it'
            : 'A mesh surface has no painted artwork',
        });
      continue;
    }
    if (pair.pixels < minPixels) continue;
    let gap = -Infinity,
      absent = 0;
    for (const [x, y] of pair.samples) {
      rays.setFromCamera(
        { x: ((x + 0.5) / width) * 2 - 1, y: 1 - ((y + 0.5) / height) * 2 },
        camera,
      );
      const near = rays.intersectObject(meshes[pair.depth - 1], false)[0],
        far = rays.intersectObject(meshes[pair.paint - 1], false)[0];
      if (!far || !near) absent++;
      else gap = Math.max(gap, far.distance - near.distance);
    }
    if (gap <= tieTolerance && absent < pair.samples.length) {
      ties += pair.pixels;
      continue;
    }
    findings.push({
      code: gap === -Infinity ? 'ZBUFFER_EXCESS' : 'ZBUFFER_ORDER',
      expected: nameOf(pair.depth),
      painted: nameOf(pair.paint),
      pixels: pair.pixels,
      gap: gap === -Infinity ? null : gap,
      at,
      message: `${nameOf(pair.paint)} is painted over ${nameOf(pair.depth)}, which the depth buffer says is in front`,
    });
  }
  const result = {
    status: findings.length ? 'failed' : 'passed',
    scale,
    parts: meshes.length,
    compared,
    tiedPixels: ties,
    findings,
    assumptions: {
      method: 'raw WebGL depth buffer versus crisp-edged SVG fills, interior pixels only',
      minPixels,
      minCoverage,
      tieTolerance,
    },
  };
  if (control) {
    const reversed = compare(await rasterize([...painted].reverse()));
    result.control = {
      pixels: reversed.pairs
        .filter(pair => pair.depth && pair.paint)
        .reduce((sum, pair) => sum + pair.pixels, 0),
    };
  }
  result.elapsedMs = Math.round(performance.now() - started);
  return result;
}
