# Migration and support

Use Three.js-backed helpers for new figures. Existing schema-version-1 files retain their defaults and fixed camera; opt in explicitly to schema 2 for camera/material/effect fields. A new camera must be listed in the figure's capabilities and tested for SVG order. Do not add a renderer switch or rewrite user sources during a build.

| Existing Anatomy concept | Crafted Figures mapping |
| --- | --- |
| Projection P / iso transforms | createStage + one OrthographicCamera; world Z-up |
| Box/rounded slabs | illustration.box (with radius); concave plan via extrude |
| Lathe/profile | revolve for authored meridian samples; profile for an analytic radius(z); native transforms for arbitrary axes |
| Routed tubes | tube with actual Three sweep rings; routeRings, connectors and explicit ports |
| Turn/hinge groups | native Group, local position/quaternion, reparentKeepingWorld for detachment |
| Four-tone materials | semantic material roles and schema-2 overrides; JSON material registry |
| Live state/readout | pure model + displayed state; mountScalarScene or an instance controller |
| GL cover/masks | production matching depth pass, bounded surface/volume recipes and meaningful vector fallback |
| React drawing/live split | prepareFigure server data and a client LiveFigure wrapper |
| Printable sheets | schema-1 sheet.mjs + print CLI with explicit vector/raster capture |
| Community publishing | local bundle and independent rebuild; no account/session telemetry |

Copy a source into a new destination, preserve its model tests first, then replace projection/primitive construction and finally interaction/effects. Treat unsupported intersections, arbitrary mesh assets, or out-of-envelope cameras as concrete migration gaps. Do not relabel a simpler unrelated solid to hide a missing capability. Record manual transformations and test representative intermediate poses.

Version 0.5.0 removes the retained prototype helpers (`kit.iso`, `kit.extrude`, `kit.fitProjection`, and their companion functions) and the Anatomy-derived implementation. Use only `kit.illustration` for solid construction. This is an intentional source API break, authorized by the owner; schema-1 configuration and the figure/model contracts remain supported. There is no compatibility renderer or shim. Version 0.6.0 distributes a built ZIP instead of committing runtime bundles, generated declarations and copied recipes to Git. Build source checkouts before installation; extracted release artifacts retain the no-install workflow. Version 0.6.0 requires Node 22.13+ or Node 24+ and ships its runtime; standalone authoring no longer needs npm installation. Browser checks/printing use an existing Chrome/Chromium executable or explicit pinned-browser setup. Generated standalone files require none of them to view.

Version 0.3.1 includes the advanced geometry, motion, effects, audit, framework and print APIs described in these references. Actual Codex/Chromium trials establish only their tested scope. Other Agent Skills hosts, Safari/Firefox, hardware GPUs and other OS versions remain untested. Full replacement and source-migration acceptance are separate from a successful build.

The native orthographic convention can face the opposite horizontal direction from an upstream projection at the same numeric azimuth. Compare known axes, contacts and controls, then declare an appropriate supported camera; do not introduce a reflected transform to hide the difference. Preserve original shader-specific behavior as an explicit limitation when adapting it to a bounded recipe.

## Replacing prototype helpers

Use `createStage({bounds:boxBounds(min,max),padding})` for fitting. For a screen annotation, update the scene matrices and call `stage.renderer.project(new k.Vector3(x,y,z), stage.camera)`; use `object.localToWorld(...)` for a local point. Surface lines belong in `mark`, face text in `label` or `display`, and physical motion in Object3D transforms. These use the same camera as the solids.

Use `box({radius})` for rounded slabs, `prism`/`extrude` for authored plans, `cylinder` for round bodies, `knob` for knurling, and `beveledSlab` for real bevel bands. A printed inset rim is a closed `mark` on the host's local top ring. `ringPoints` supplies circular marks. Existing full-circle `ticks` calls retain their defaults; set `from` and `span` in radians for partial scales. See `assets/templates/sector-gauge/` for a complete example.

A decorative halo can use a normal illustrated rounded box with its surface/top/side tokens set to one color and its edge/crease strokes hidden in a scoped SVG group. It still uses the native geometry and camera. Do not give it fake occlusion or a second projection. Hand-authored 2D SVG for captions, leaders and framing remains valid under the figure contract.
