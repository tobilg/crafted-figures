# Migration and support

Use Three.js-backed helpers for new figures. Existing schema-version-1 files retain their defaults and fixed camera; opt in explicitly to schema 2 for camera/material/effect fields. A new camera must be listed in the figure's capabilities and tested for SVG order. Do not add a renderer switch or rewrite user sources during a build.

## Version changes

Version 0.5.0 removes the old projection helpers (`kit.iso`, `kit.extrude`, `kit.fitProjection`, and their companion functions). Use only `kit.illustration` for solid construction. This is an intentional source API break; schema-1 configuration and the figure/model contracts remain supported. There is no compatibility renderer or shim.

Version 0.6.0 distributes a built ZIP instead of committing runtime bundles, generated declarations and copied recipes to Git. Build source checkouts before installation; extracted release artifacts retain the no-install workflow. It requires Node 22.13+ or Node 24+ and ships its runtime, so standalone authoring needs no npm installation. Browser checks/printing use an existing Chrome/Chromium executable or explicit pinned-browser setup. Generated standalone files require none of them to view.

## Support scope

Actual Codex/Chromium trials establish only their tested scope. Other Agent Skills hosts, Safari/Firefox, hardware GPUs and other OS versions remain untested. Treat unsupported intersections, arbitrary mesh assets or out-of-envelope cameras as concrete gaps; do not relabel a simpler unrelated solid to hide a missing capability.

## Replacing the old projection helpers

Use `createStage({bounds:boxBounds(min,max),padding})` for fitting. For a screen annotation, update the scene matrices and call `stage.renderer.project(new k.Vector3(x,y,z), stage.camera)`; use `object.localToWorld(...)` for a local point. Surface lines belong in `mark`, face text in `label` or `display`, and physical motion in Object3D transforms. These use the same camera as the solids.

Use `box({radius})` for rounded slabs, `prism`/`extrude` for authored plans, `cylinder` for round bodies, `knob` for knurling, and `beveledSlab` for real bevel bands. A printed inset rim is a closed `mark` on the host's local top ring. `ringPoints` supplies circular marks. Existing full-circle `ticks` calls retain their defaults; set `from` and `span` in radians for partial scales. See `assets/templates/sector-gauge/` for a complete example.

A decorative halo can use a normal illustrated rounded box with its surface/top/side tokens set to one color and its edge/crease strokes hidden in a scoped SVG group. It still uses the native geometry and camera. Do not give it fake occlusion or a second projection. Hand-authored 2D SVG for captions, leaders and framing remains valid under the figure contract.
