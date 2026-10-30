# Three.js hybrid dial experiment

Run from the repository root after installing root and skill dependencies:

```sh
npm run prototype:build
npm run test:prototype
node tests/prototype-profile.mjs
```

Open `out/three-hybrid/light.html` or `dark.html` directly. Drag the drawing, use the native range input, or select Behind / Crossing / In front. The model accepts 0–360 degrees; named poses are 243° hidden, 234° partial, and 27° foreground. Motion is settled by default. Browser diagnostics expose an explicit tour for measurement only.

Three.js owns the one scene hierarchy, the Z-up orthographic camera, primitive geometry and moving group. `IllustrationSVGRenderer.mjs` implements primitive outlines, four-tone faces and checked painter order; `overlay.mjs` renders matching solid geometry into depth before the transparent marker. It never assumes that canvas inherits SVG depth.

Supported: annotated nonintersecting boxes, cylinders and discs, this fixed camera and finite scene/motion range. Unsupported or interleaved geometry produces a diagnostic. No arbitrary mesh import, unrestricted orbit, shader-to-SVG conversion or general engine is offered. WebGL failure uses a solid vector marker. The test writes standalone vector fallbacks and the stock/custom SVG comparison.

See [decision and measurements](../../docs/three-prototype-report.md). At the user's request, the 33 ms diagnostic budget is deferred. `test:prototype` still records the full P07 measurement with status `measured`; exceeding the budget does not cause failure. Rendering, registration, occlusion, interaction, fallback and lifecycle assertions remain enforced. Earlier budget-enforced reports are preserved. This directory and Three.js are excluded from the stable skill package.
