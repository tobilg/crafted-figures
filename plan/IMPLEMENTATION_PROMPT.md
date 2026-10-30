# Implementation prompt: complete the Anatomy replacement

Use this in the replacement repository. This prompt targets revision 2 of [PRD.md](PRD.md), which expands the original MVP and prototype into a full feature-replacement specification. It is suitable for continuing the existing `painter` implementation; do not start it over.

Paste the following into the implementing agent's session:

---

Implement the full replacement specified in `plan/PRD.md`. Read the entire PRD before editing. The scope includes advanced geometry/materials, authored cameras, moving mechanisms, production SVG/WebGL effects, geometric/visual verification, React/Next.js integration, typed APIs, A4/Letter printing, portable source sharing, migration, and fresh authoring validation. A dial demo, successful prototype, or the narrower migration milestone is not completion.

The working skill name is `crafted-figures`; preserve any later user-selected name and existing implementation decisions. Work in the replacement repository, never inside the Anatomy reference checkout.

## Establish current state

1. Read applicable `AGENTS.md`, inspect Git status/remotes and preserve existing staged, untracked and concurrent work.
2. Read `plan/PRD.md`, `plan/MIGRATION.md`, `docs/implementation-status.md`, `docs/three-prototype-report.md`, and existing parity/compatibility reports if present. Inspect relevant code before assuming reported milestones still match the current tree.
3. The original M1/M2 and their A01–A13/P01–P08/E01–E08 evidence already exist in the current repository. Three.js migration work may be underway. Continue from unmet requirements; do not recreate completed scaffolding or erase historical reports.
4. `plan/MIGRATION.md` describes the authorized intermediate M3 candidate and its M01–M05 checks. Revision 2 of the PRD extends the product beyond that milestone. Its old statement that PDF/React are outside the migration milestone does not exclude them from the final product.
5. Preserve the reference pin at `1482e8469b0a9e0d8cc18ea2740a01423d29ae80` unless the user has deliberately chosen another revision. Treat `reference/anatomy` as read-only design/source material. Our package/builds must work without it. If starting from an actually empty new repo, follow PRD section 4.2 before implementing the baseline.
6. Preserve the user's recorded performance policy: the 33 ms diagnostic threshold is deferred. Measure performance and report it honestly, but do not reintroduce that threshold or invent a replacement numeric gate. Correctness, lifecycle/resource checks and workload measurements remain required.

This is an implementation task. Complete actual working features, tests and evidence; do not respond with another plan alone. Make routine reversible implementation choices using the PRD and existing project conventions. Ask only when genuinely blocked by missing information or when an action would exceed the user's authorization.

## Continue through the full delivery sequence

**Existing P0–P4 / M1–M2:** preserve the configuration resolver, presets, pure model, selected-pose behavior, offline HTML/SVG, controls, lifecycle handling, independent package, notices and prototype evidence. Fix demonstrated regressions; do not repeat unchanged work merely because it appears early in the PRD.

**P5 / M3 — packaged Three.js migration:** complete `MIGRATION.md` M01–M05. Package the scene/camera/primitive/SVG pipeline, full dial, valve/pipe example, cutaway cabinet/wiring example and articulated mechanism. Preserve v1 public contracts, static DOM-free rendering, actual dependency resolution, and independent authoring. Promote a default pipeline only after its migration checks pass. This milestone alone is not full Anatomy parity.

**P6 / M4 — geometry, materials, cameras and audits:** implement FR-09–FR-12 and FR-15. Cover arbitrary-axis smooth profiles, pipes/cables/fittings, concave decomposition/cutaways, complete construction details, face content, material families and qualified camera overrides. Audit actual geometry for contacts, clearance, endpoints, routes, profile/coverage fidelity and order across declared states. Add deliberately faulty fixtures that prove the checks detect their intended faults.

**P7 / M5 — motion and effects:** implement FR-13, FR-14 and FR-16. Cover spring/reversal behavior, exploded assemblies, coupled groups/hinges/chains, detached bodies, morphing surfaces, and registered multi-layer WebGL. Deliver reference recipes for light/glow, fire/exhaust, steam/smoke, sparks and water/caustics. Use shared state/camera/geometry and correct depth/masks; a single overlay does not solve every layer arrangement. Complete the general scripted verification tools and actual fallback/context-loss tests.

**P8 / M6 — integrations, print and authoring:** implement FR-17–FR-21. Deliver typed APIs, server/client React/Next.js adapters and real integration fixtures, all A4/Letter print formats, reusable craft references/templates, compatible schema evolution, source migration guidance and portable local sharing bundles. An installed user must not need the source repo or submodule to author these outputs.

**P9 / M7 — replacement validation:** implement FR-22 and close the required capability matrix C01–C16, representative fixtures F01–F12, advanced agent evaluations R01–R10 and release gates G01–G12. Declare C17/C18 intentional omissions and support limitations. Measurements remain mandatory with numerical timing thresholds deferred.

Use phased vertical slices rather than adding all APIs as stubs. Work may cross phase boundaries where dependencies justify it, but the end-state scope does not shrink to the examples that happened to be easiest.

## Non-negotiable product contracts

- The model, geometry/transforms, SVG, WebGL, readout, accessible state and print captures must agree. Sample intermediate and reversal states, not only endpoints.
- Three.js owns production scene/camera machinery. Our SVG adapter owns supported illustration styles, silhouettes and checked painter order. Geometry/contact audits are separate from GPU visibility.
- Do not disguise missing shape support with raster artwork, bounding boxes, omitted parts, arbitrary ordering biases or tiny audit stand-ins. Diagnose unsupported constructions precisely.
- Preserve v1 configuration behavior; introduce advanced fields through the v2 contract in PRD section 17. Invalid keys, roles, material IDs, camera envelopes and capabilities fail explicitly.
- Keep source-level JS/TypeScript APIs and React adapters single-sourced and typed. Do not maintain duplicate hand-edited JS/TS engines.
- Static SVG/HTML remains portable and deterministic. A pure SVG effect fallback is vector; a captured WebGL region in a PDF is raster and must be described accurately.
- Reduced/disabled motion retains functional immediate controls. Hidden/settled figures do not keep animating. Instances have independent IDs, events, readouts and resource lifecycles.
- Compact/detailed presets change presentation, not explanatory truth. Do not reinstate mandatory part counts, forced idle tours or universal decorative restrictions.
- Preserve third-party attribution, original sources and unrelated user work. No gallery/session-log coupling, global installation, remote publication or push is part of completing local implementation.
- No general CAD/physics engine, arbitrary mesh importer, unrestricted orbit or universal shader-to-SVG conversion is required. Bounded supported features must still cover the mandatory parity matrix.

## Commands and verification

Preserve these existing command families and their tested options:

```bash
npm ci
npm --prefix skill/crafted-figures ci
npm --prefix skill/crafted-figures exec -- playwright install chromium
npm run build -- --entry examples/dial-indicator/figure.mjs --config examples/dial-indicator/figure.config.json --preset technical --theme light --output both --state rest --out out/dial
npm run preview -- --dir out/dial --port 4173
npm run check -- --dir out/dial --report out/reports/dial
npm test
npm run test:browser
npm run package:skill
npm run test:package
npm run prototype:build
npm run test:prototype
```

Add the full-product command contracts from PRD section 18: `audit`, `drive`, `print` and `bundle`, backed by the installed skill CLI. Add meaningful aggregate suites `test:geometry`, `test:motion`, `test:effects`, `test:react`, `test:print`, `test:compat`, `test:parity`, and `bench:capacity`.

Run checks relevant to each change and resolve actual failures. Inspect full figures, close-ups, transition contact sheets and every generated print page. Preserve failing evidence and explain baseline changes. Command existence, a compilable shader, a directory of screenshots, or a passing small dial does not establish feature parity.

Run fresh authorized agent/host trials with a frozen packaged skill and raw task inputs. Include unfamiliar advanced figures, constrained edits, printing/framework tasks and actual positive/negative activation. Do not supply the intended solution or claim that reviewing a prompt is an executed trial. If the environment cannot run a required trial, preserve the case and mark the release gate pending with the exact blocker.

## Track completion and deliver

Maintain these records without rewriting historical results:

- `docs/implementation-status.md`: completed increments, acceptance IDs, current failures and deviations.
- `docs/parity-matrix.md`: C01–C18 dispositions, implementation entrypoints, fixture/report links and limits.
- `docs/compatibility.md`: versions, schema/API migration, supported hosts/frameworks/browsers/platforms and explicit untested combinations.
- `docs/capacity.md`: reproducible workload measurements, resource behavior and the deferred timing policy.
- `docs/replacement-readiness.md`: package hash/version, G01–G12 evidence, intentional omissions and remaining blockers.

Continue until required gates are satisfied, or an actual external blocker prevents further independent progress. Do not mark blocked/unexecuted checks passed and do not invent waivers. If time/context ends mid-implementation, leave a precise continuation record instead of declaring replacement complete.

Finish with links to the installed/package artifact, representative runnable examples and source, React demo, print documents, sharing bundle, parity/readiness reports and reproduction commands. Explicitly distinguish an intermediate replacement candidate from a release that satisfies the full matrix. Do not publish or push as part of finishing.

---

The full PRD is authoritative for product scope. Preserve later explicit user decisions and existing implementation evidence; record any necessary deviation and its impact instead of silently redefining an unmet requirement.
