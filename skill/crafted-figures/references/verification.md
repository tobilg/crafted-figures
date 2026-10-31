# Setup and verification

Extract the built skill ZIP, use Node 22.13+ or Node 24+, and run the CLI directly. No npm install is needed: `runtime/` includes Vite 8.3.5, its portable Rolldown WASM compiler, Three.js, Ajv and Playwright Core. Keep that directory when copying/installing this skill. Playwright recorder, dashboard, trace-viewer and HTML-report UIs are intentionally excluded; browser automation, check/drive/print and explicit Chromium installation remain supported. No parent repository, submodule, global npm module or API key is needed. Generated HTML/SVG needs neither Node nor a browser download to view in an existing browser.

Browser checks and PDF printing try the pinned Chromium first, then Chrome, Chromium and Edge in their usual install locations for macOS, Windows and Linux (`PATH` and `/snap/bin` on Linux). `CRAFTED_CHROMIUM_EXECUTABLE` replaces that search: only that executable is tried, so a mistaken path fails instead of quietly using another browser. Run `node runtime/playwright-core/cli.js install chromium` inside the skill to download the pinned Chromium. Build, preview, audit and source bundling never download dependencies or browsers. Screenshots from an installed browser may differ from the pinned environment, so reports record `environment.browser` and `environment.browserSource` (`pinned`, `installed` or `configured`).

The Git repository contains authoring source and locked build inputs. Developers run `npm ci`, `npm --prefix skill/crafted-figures ci`, then `npm run package:skill` from the repository root to generate runtime, types, recipes and the installable ZIP. `npm run prepare:dev` generates the same components without assembling an archive. A raw GitHub skill-folder copy is not a ready-to-use artifact. Vite's Node build API and WASI worker are bundled with small pinned loader adapters; no native compiler binary or package-manager subprocess is needed by consumers. Node may print its experimental WASI notice. Figure clients support JS/JSON modules; toolkit tokens own CSS. This is not a general Vite application runner: implicit `vite.config.*`, `.env`, external CSS files and asset side outputs are not supported.

```
node scripts/figures.mjs build --entry assets/templates/basic-figure/figure.mjs --output both --out out/starter
node scripts/figures.mjs preview --dir out/starter --port 4173
node scripts/figures.mjs check --dir out/starter --report out/reports/starter
```

Build emits selected figure.html/figure.svg, resolved-config.json and build-manifest.json. Outputs include content/dependency/provenance hashes without timestamps or absolute machine paths. Repeated identical inputs/dependencies must produce identical bytes. Only manifest-owned, unedited generated filenames can be replaced; other files remain. Choose another out directory if an artifact was edited manually.

Preview binds loopback and confines files to the selected directory. Check verifies manifest hashes, browser loading under file:// and HTTP at 390/960 CSS px, embedded vector structure, metadata, labels, overflow, console errors and remote requests. It then sweeps every named pose and nine positions of each range input in the real page, verifying painter order against rays and a depth buffer and that the readout follows (`report.sweep`, with depth results in `report.sweep.zbuffer`). A figure that fails to mount is reported immediately with its own error. SVG-only interaction is explicitly not applicable. A standalone SVG's styles and IDs are scoped to itself, so it can be inlined in another page. No usable browser is a failure that lists each attempt and the setup options. The default target is the pinned Chromium build; no Safari/Firefox support claim follows.

The preview root opens HTML when present, otherwise the standalone SVG. Removing an old generated deliverable does not prevent rebuilding or selecting a different output format; unrelated or edited existing files still cause a conflict.

Generic checks cannot establish a particular model's truth or geometric ordering. Add meaningful pure-model tests and figure-specific browser assertions for named poses, pointer/keyboard equivalence, reduced/disabled motion, no-JavaScript behavior and cleanup. Inspect full views in both presets/themes and 4× crops of dial faces, contacts and overlaps. Fix observed defects. Do not accept a screenshot baseline merely because it exists. Record viewport, browser, DPR and platform in reports, not deterministic artifact manifests.

For new figures, test compact and standard retain identical model behavior. Readouts and moving geometry must agree during transitions, not just at their endpoints. Verify settled/offscreen/hidden figures stop requesting frames. Agent activation/execution evaluations are separate from code tests; record actual trials and mark unexecuted trials pending.

The interactive templates use the same CLI; for example, copy `assets/templates/dial-indicator/` and build it with `--state mid --output both`. Verify its initial reading survives mount, and use the native control to reach both stops. Inspect camera bounds and finite ordering across the supported motion range. Installation smoke tests must use the included runtime with no node_modules or parent-checkout access.

## Revision-2 audits and scripted captures

Audits check every pair of solids. Clearance uses surface samples clipped to the region both parts occupy, plus exact triangle distance for declared minimums, so parts crossing with no vertex inside each other are found. A scenario adds to what the figure declares; removing a declared check takes an explicit `replaceDeclared: ["connections"]`, and `clearanceScope: "declared"` limits clearance to the listed pairs. Both are recorded in the report's coverage.

`audit --entry figure.mjs --config figure.config.json --scenario audit.json --report out/audit` uses a figure's optional createScene boundary. The scenario has schemaVersion 1, named poses and/or `{id,state}` samples, qualified cameras, tolerance in world units, optional clearance/contact/connection lists and narrow `{code,parts,reason}` exceptions. Findings carry stable codes, measured values, pose/camera and corrective categories. Analytic profile policies may specify `{part,maxSlopeChange}`. No empty sample set is accepted. Triangle vertices/face-centroids and route/profile samples are evidence, not proof against arbitrarily small faults.

`drive --dir out/figure --actions actions.json --report out/drive` validates real click/key/text/drag actions, pose/state/time changes, wait conditions and captures. Examples:

```json
{"schemaVersion":1,"viewport":{"width":960,"height":1050},"reducedMotion":true,"actions":[
 {"type":"key","selector":"input[type=range]","key":"End"},
 {"type":"wait","readout":"10.00 mm"},
 {"type":"order"},
 {"type":"capture","name":"whole"},
 {"type":"crop","name":"contact","region":[0.2,0.2,0.5,0.5],"scale":4},
 {"type":"samples","name":"clip","states":[{"displacementMm":0},{"displacementMm":1},{"displacementMm":2}],"maxStep":100},
 {"type":"dispose"}
]}
```

Crop coordinates are normalized within the selected SVG/element. Samples freeze actual controller states, record readouts, capture frames and create an offline HTML contact sheet. `maxStep` bounds the projected part-origin displacement in viewBox units between the supplied samples; use a value derived from the intended clip speed. It diagnoses an unexpected sampled jump, not arbitrary continuous-time behavior. `order` independently compares actually painted SVG faces with mesh ray intersections. `lines` uses browser path metrics for curves/arcs and honors specific ending reasons; unsupported markup is reported.

Camera/temporal sampling limits and deliberate contacts must remain visible in reports. An order check with zero visible solid samples fails with `ORDER_NO_SAMPLES`; scroll the subject into view or adjust the sampling grid before treating it as evidence. A passing scenario does not qualify untested views. Review full views and contact sheets; do not auto-approve screenshots. Browser failures produce failed reports. Real context loss and GPU pixel registration have dedicated regression fixtures in the development repository.

A crop is captured at the requested device pixel scale and its PNG dimensions are checked against the CSS crop bounds. Line diagnostics compare open endpoints against other marks and their own host's physical edge/crease paths; browser hit testing accounts for clipping. Endpoints outside the current viewport are reported as unsupported so the scenario can scroll or enlarge its capture. Inspect the evidence; a finite sampling grid can miss a small fault.

## Depth-buffer order check

`check` runs this in every swept state of a live figure. In `drive`, use `{"type":"zbuffer","scale":2,"control":true}` for the current state, or add `"zbuffer":true` to a `samples` action to run it on each frame. Either records the result in the report and fails the run on a finding.

It draws the meshes into a raw WebGL depth and ID buffer and compares each interior pixel with a raster of the painted SVG fills. Because it shares no code with the painter or its rays, it can catch order faults that ray sampling misses. Findings are `ZBUFFER_ORDER` (a part painted over the one that should be in front, with `pixels`, `gap` and `at`), `ZBUFFER_EXCESS` (paint with no mesh behind it), `ZBUFFER_MISSING` (a visible mesh with no paint) and `ZBUFFER_UNAVAILABLE` (no WebGL2, so nothing was checked). `control` repaints in reverse to prove that the comparison can fail; `control.pixels` is above zero wherever parts overlap.

It covers fills, not strokes, and interior pixels, not the outermost edge. Figures with no controller or stage report `not applicable`. It checks the sampled states, so a fault that exists only between them can pass. A run took about 20–70 ms per state across the bundled examples on an Apple M2 with software WebGL.

## Independent fidelity and effect scenarios

Use `{"type":"fidelity"}` for bidirectional SVG/mesh coverage and sampled tone checks. This detects extra SVG in empty mesh space as well as missing coverage and wrong front surfaces. Flat normals come from native mesh faces; analytic-profile normals come from the authored radius function. This is independent of the SVG serializer. Swept-route tone correctness still needs the route fixture and visual review. Reports record subpixel silhouette samples, tone-threshold exclusions and any adjacent analytic-band samples within the declared meridian tolerance. This finite checker does not certify an unrestricted mesh or continuous camera envelope.

Additional `drive` actions:

```json
{"schemaVersion":1,"reducedMotion":true,"actions":[
 {"type":"move","selector":"svg.crafted","to":[0.5,0.5],"steps":8},
 {"type":"time","value":2},
 {"type":"effects","mode":"webgl","boundaries":true,"landmarks":[{"effect":"marker","visibility":"visible"}]},
 {"type":"playback","name":"slow","from":1.8,"to":2,"rate":0.25,"fps":5,"maxStep":40},
 {"type":"contextLoss","requiredFallbacks":["marker"]},
 {"type":"time","value":1},
 {"type":"wait","state":{"time":1}},
 {"type":"dispose"}
]}
```

`playback` requires a deterministic numeric `time` model. It captures up to 240 paced frames at the requested playback rate (0.05–1) and sampling FPS (1–30), retaining state/readout evidence and a contact sheet. It is deliberate slow playback, not an animation-readiness sleep. `samples` additionally accepts `visibility:true`, an explicit `allowVisibilityChanges` list, and `fidelity:true` for per-frame checks. Visibility differences are sampled events; declare intended births/deaths. Neither operation claims to detect every possible between-sample pop.

`effects` measures canvas/SVG registration, actual GPU alpha pixels and optionally unexpected pixels at canvas boundaries. Landmark checks isolate a symmetric `glow`/`spark` effect, retain matching solid depth and compare its GPU centroid with its independently projected scene center. Use `visibility:'hidden'` for a fully occluded marker. Do not use a clipped/asymmetric glow's centroid as a point landmark. Default registration tolerance is 0.5 CSS px. `contextLoss` requests actual `WEBGL_lose_context`, waits for vector fallback, and verifies each required symbol is visible. A top-level `webgl:false` simulates initialization failure. Test every explanatory effect family; a lamp alone does not qualify particle fallback. Continued state/time actions after loss verify usable controls.

Build manifests include `dependencyLockHash`, `runtimeHash`, model state and resolved `auditPolicy`. An optional figure-level policy is `{schemaVersion:1,tolerance:0.08,exceptions:[]}`; audit scenarios can override it. Exceptions require exact code, parts, reason and optionally detail ID. The manifest describes policy, not an executed audit. Audit reports include the installed runtime identity and reject empty camera/state/solid evidence. Keep execution environment information in reports.

A scene may declare `contacts`, `connections`, `clearances` and `profiles` on its returned stage; the CLI validates and uses these after each state update. Explicit scenario lists replace the corresponding scene lists, including an explicit empty list. Figure audit policy provides tolerance/exception defaults, and scenario policy wins. Inspect each result's coverage counts so a deliberately narrowed scenario is not mistaken for full connection/contact evidence.
