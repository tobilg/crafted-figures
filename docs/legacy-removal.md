# Retiring the prototype implementation — 0.5.0

This document records the completed 0.5.0 increment. Its package and reports were frozen at `out/history/pre-artifact-packaging-0.5.0/` before the [0.6.0 packaging change](artifact-packaging.md); current output paths may contain newer executions.

The stable skill now uses only our Three.js-based illustration implementation. The owner explicitly requested deleting the retained legacy implementation and supplying any missing capabilities in ours. This is an intentional retirement of the early prototype source API under FR-20, not a change to configuration schema 1 or the public figure/model/client contract.

Deleted: `kit/anatomy/iso-kit.mjs`, its root reexports, the `solidSvg` and `lineSvg` wrappers, and `types/anatomy/iso-kit.d.mts`. Regenerated declarations and package contents contain no compatibility aliases or alternate projection implementation. Current examples already used `kit.illustration`; no model migration was needed. Historical M1 output, evaluation sources, upstream MIT notices and the read-only reference remain preserved. The entire 0.4.0 package, reports, docs and canonical dial were cloned to `out/history/pre-legacy-removal-0.4.0/` before edits.

The capability audit found one gap: the current tick helper supported only full circles. `illustration.ticks` now supports `from` and signed `span` in radians, bounded to one revolution. Partial sweeps retain both endpoints; full circles omit the duplicate endpoint. Compact mode retains partial endpoints even when the last tick is not a major division. Invalid options fail before adding any marks. The [sector-gauge example](../examples/sector-gauge/figure.mjs) and shipped template demonstrate the new behavior with a pure percentage model and shared pointer/readout state.

| Retired helper capability | Current implementation |
| --- | --- |
| `AZIMUTH`, `ELEVATION`, `SHADES` | Authored stage camera options and the existing semantic four-tone renderer; no second global projection state |
| `cameraOf`, `iso`, `pointsAt` | One native orthographic camera; `stage.renderer.project(Vector3, stage.camera)` for screen annotations |
| `towardViewer`, `depthOf` | Native camera direction/world matrices and the renderer's mesh ray intersections/order checks |
| `fitProjection`, `boxCorners`, `corners` | `createStage({bounds,padding})`, `boxBounds`, and native object bounds/points; bounds include all model poses |
| `roundedPlan`, `ringOf`, `slabOf`, `insetPlan` | `box({radius})` constructs rounded slabs. Smaller dimensions/radius construct inset solids; closed host-local `mark` creates a printed inset rim |
| `extrude`, `cylinder` | `illustration.prism`, `extrude`, `cylinder`; actual Three geometry plus our SVG surface metadata |
| `extrude`/`slabOf` bevel decoration | Host-local rim marks for engraving; `beveledSlab` constructs actual bevel bands when physical geometry is needed |
| `circleRing`, `ring`, `onTop`, `planOutline` | `ringPoints` and closed `mark` on the host mesh; native top-ring metadata provides a matching outline |
| `lineOnTop`, `segment`, `rise` | `mark` for lines on a surface with its local normal; actual cylinders/tubes for physical rods or wires |
| `knurl` | `knob` attaches side markings with normals and camera-facing visibility |
| `radialTicks` | `ticks` now covers full/partial/signed scales, major/minor lengths and compact endpoints |
| `axisVector`, `translateAlong`, `topMatrix` | Native Object3D transforms and groups; `label`/`display` project face bases using the same camera. Project two world points for a 2D axis vector |
| `haloOf` | A normal rounded box rendered with scoped flat surface/top/side colors and hidden edge strokes supplies a decorative projected silhouette; no alternate geometry/projection engine |
| `pathOf`, `joinPaths`, `solidSvg`, `lineSvg` | The renderer owns solid path generation/shading. `mark` owns surface paths. The existing figure contract still accepts authored 2D SVG for captions/framing; string concatenation needs no toolkit renderer |

No old function is reintroduced under another name. Construct geometry in local coordinates, attach surface details to their host, and let Three.js transforms and the illustration renderer determine projection and ordering. The [installed migration reference](../skill/crafted-figures/references/migration.md) explains these mappings for authors. Schema 1, schema 2, model states, poses and cleanup remain supported; a source using removed prototype helper names must migrate explicitly.

New build manifests identify `crafted-figures` as the implementation and Anatomy as a design reference only. They no longer list a copied `kit/iso-kit.mjs` runtime path. The wrapper no longer inserts Anatomy attribution into every newly generated SVG. Historical adapted sources/artifacts retain their notices, and the package retains the historical MIT text. Actual Three.js, Vite/Rolldown, Ajv and Playwright notices remain intact. Authors independently reusing third-party source remain responsible for its notices.

Verification results and exact package identity are recorded in [the removal report](../out/history/pre-artifact-packaging-0.5.0/reports/legacy-removal.json). Relevant automated checks cover FR-04/06/08/09/10/20, with A01/A03/A04/A05/A06/A07/A08/A09/A10/A11/A12 regression coverage. The original P0–P4 evidence and full 0.3.1 qualification remain historical. This focused increment does not claim a new complete G01–G12 release qualification or fresh agent evaluation.

Executed on Node 22.13.0 / Darwin x64 / Chromium 156.0.8078.4:

| Check | Result |
| --- | --- |
| Full unit suite | 37 passed; the four new focused cases also reran after the visual correction |
| New sector-gauge browser suite | 9 cases passed: two presets × two themes × two detail/viewport combinations, plus no JavaScript |
| Existing dial browser suite | 14 cases passed; all eight matrix screenshots are pixel-identical to 0.4.0 |
| Canonical HTML/SVG export checker | 8 checks passed; static SVG bytes differ only by removal of the obsolete Anatomy notice |
| Guarded offline package | 6 cases passed, including the new template, deterministic builds and relocated rebuild with no npm/network/native addons/checkout imports |
| Compatibility suite | All 5 stages passed: v1/v2, strict types, independent standalone package, independent Next/React app, independent basic/hybrid-print source bundles |
| Package smoke test | All 9 steps passed; previews, controls, direct imports and no-install use outside the checkout |
| Source bundles and print | Both rebuilds reproduce all four deterministic figure files; assembly poster/drawing/two-page A4 previews reviewed |
| Package/skill inspection | 314 manifest-listed files, 29,472,154 bytes; no retired module/types/root exports; skill metadata validator passed |

The final package manifest SHA-256 is `1af64d5ab7ff68d032e81443ed94f44b2635bd2bd85b8fcc9a073bdc8a5f2e37`; runtime identity is `1d9ef7be5863ff96c3449ec060d0ed77f4b5c5d9d5b7d773d128e40d541d4183`. Pinned dependencies remain Vite 8.3.5, Rolldown/WASI 1.2.15, Three.js 0.186.1, Ajv 8.20.0 and Playwright Core 1.64.1. No dependency upgrade or new dependency was needed. The reference is unchanged at `1482e8469b0a9e0d8cc18ea2740a01423d29ae80`.

Visual review covered all eight sector views and the four 4× scale crops. It caught the initial label/pointer overlap, which was corrected and rechecked. The first browser harness tried to access statistics after cleanup removed the root property; the assertion was corrected to retain the statistics before cleanup. That initial failed report and the pre-correction screenshot remain beside the passing evidence. No implementation check remains blocked. Open [the standalone sector gauge](../out/sector-gauge/demo/figure.html), [visual evidence](../out/history/pre-artifact-packaging-0.5.0/reports/owned-renderer/contact-sheet.png) or [print previews](../out/history/pre-artifact-packaging-0.5.0/reports/owned-print-preview.png).

Reproduce the checks with Node 22.13+ or Node 24+ and the declared development dependencies:

```sh
npm run runtime:build
npm run types:build
npm test
npm run test:types
npm run package:skill
npm run test:owned
npm run test:browser
npm run test:bundled
npm run test:compat
npm run build -- --entry examples/sector-gauge/figure.mjs --config examples/sector-gauge/figure.config.json --output both --out out/sector-gauge/demo
npm run preview -- --dir out/sector-gauge/demo --port 4173
```

`test:compat` executes the independent package smoke test, real Next/React consumer and source-bundle rebuilds. Standalone authoring and rebuilt source bundles require no npm install; Chromium is still needed for browser checks and printing. The React test's application installs its own pinned framework dependencies.

Current support limits remain: illustrated solid primitives, qualified orthographic views and checked scene ordering. No arbitrary mesh, general shader conversion or unrestricted camera guarantee is introduced. The numeric performance budget remains deferred. Remote CI, other browsers/OSes and hardware GPU qualification are not new executions in this increment.
