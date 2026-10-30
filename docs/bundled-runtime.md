# Vite 8 portable distribution — 0.4.0

This report records the historical 0.4.0 Vite increment. Its package and reports are preserved at `out/history/pre-legacy-removal-0.4.0/`; see [legacy removal](legacy-removal.md) for current 0.5.0 evidence.

The skill now builds new figures without npm installation. Copy [skill/crafted-figures](../skill/crafted-figures/SKILL.md) or [dist/crafted-figures](../out/history/pre-legacy-removal-0.4.0/package/SKILL.md), retaining `runtime/`, and invoke its Node CLI. The generated HTML/SVG still opens offline in an existing browser, with no Node requirement for viewers. The source folder includes the generated runtime so a GitHub subdirectory installation can work without a build step. Nothing was pushed, published or installed globally.

The user's explicit Vite 8 request supersedes FR-06's earlier esbuild choice. Registry verification selected **Vite 8.3.5**, pinned in both manifests/locks. [Vite's build API](https://vite.dev/guide/api-javascript.html#build) resolves real modules; exports are not stripped or concatenated. [Vite 8](https://vite.dev/blog/announcing-vite8) uses Rolldown. The distribution pins Rolldown and its portable WASI binding to **1.2.15**, avoiding platform-specific compiler downloads. The binding requires **Node 22.13+** (or Node 24+ under this package's support contract), slightly above Vite's own 22.12 minimum. Ajv **8.20.0**, Three.js **0.186.1** and Playwright Core **1.64.1** are included. The reference remains clean at `1482e8469b0a9e0d8cc18ea2740a01423d29ae80`.

## Distribution and responsibilities

[build-runtime.mjs](../skill/crafted-figures/scripts/build-runtime.mjs) uses Vite to bundle Three.js, Ajv, the Vite Node API and the WASI loader/worker. It copies the unchanged WASM binary and Playwright's already bundled runtime/assets with their notices. Small, asserted adapters convert pinned `createRequire` package loads to static imports and select the local compiler binding. Upstream renderer, scene/model and configuration contracts are preserved. The experiment also builds with Vite and remains outside the skill.

[bundler.mjs](../skill/crafted-figures/kit/bundler.mjs) uses that embedded Vite API for each authored browser client and transitive module graph. It produces one inline JS chunk, disables implicit Vite configuration, `.env` and public directories, and rejects asset side outputs. Figure CSS continues to come from validated toolkit tokens. This is a JS/JSON figure builder, not a general Vite application runner or dev server. [Source sharing](../skill/crafted-figures/kit/bundle.mjs) includes the runtime; `node rebuild.mjs` works directly after relocating a bundle.

The assembled package contains **311 manifest-listed files, 29,484,764 bytes** (about 28.1 MiB). The WASM binary is approximately 11 MB. This larger distribution replaces consumer dependency installation. `runtime/manifest.json` records bundle inputs, dependency versions and per-file hashes; assembly rejects stale inputs or modified bundled files. The `.gitignore` exception retains Vite's nested `dist/` files. Runtime regeneration is deterministic across repository-root and skill-directory invocations; a working-directory-dependent source-comment discrepancy was reproduced and fixed by setting Rolldown's `cwd` explicitly.

Final [package manifest](../out/history/pre-legacy-removal-0.4.0/package/package-manifest.json) SHA-256: `052bad2505765acb1bc14cbf09c6e5cfad1750515447e7340da8e8c46e69b6a1`. Runtime SHA-256: `8a855f8262fabd4bf3f42643f9964706970681777ac171c9e5485d480842e9e0`. Skill lock SHA-256: `4d7d4954ca03df52c4195df3c886666f16b5f1fc55e8c4e1f68679410f413164`.

Chromium is a separate executable: browser checks, scripted drives and PDFs use either the pinned Playwright cache or `CRAFTED_CHROMIUM_EXECUTABLE`. No command automatically downloads it. The optional React/Next application still installs its own framework/compiler dependencies. Development-only npm dependencies remain pinned for regenerating the runtime; standalone consumers never need them.

## Executed verification

These are focused executions for the distribution change (FR-05/06/08/20/21, A04/A05/A11/A12), not a rerun of every replacement-release gate. The final isolated test records the exact package hash above. Other checks ran during this increment; original 0.3.1 receipts are preserved separately and are not reused as 0.4.0 qualification.

[Final validation record](../out/history/pre-legacy-removal-0.4.0/reports/vite-validation.json) verifies the assembled/source file hashes and runtime inputs, checks the eight passing reports, and records their hashes alongside the prototype and runtime-rebuild evidence.

| Execution | Observed result / evidence |
| --- | --- |
| `npm test` on Node 22.13.0 and 24.22.0 | 33 passed, including model/config, output preservation, deterministic artifacts and geometry. [Node 22 log](../out/vite-unit-node22.log), [Node 24 log](../out/vite-unit.log). |
| `npm run test:bundled` | Five passed cases: enforced offline isolation, fresh static/dial/hybrid modules, repeated byte-identical builds, and relocated source-bundle rebuild. Network, subprocesses, native addons and checkout imports are blocked; no ancestor node_modules exists. A deliberate network attempt proves the guard fails. [Final Node 22.13 report](../out/history/pre-legacy-removal-0.4.0/reports/bundled-runtime/report.json). |
| Runtime regeneration | All 148 generated files/manifest match byte for byte across working directories; two builds took 6.47 seconds locally. [Report](../out/history/pre-legacy-removal-0.4.0/reports/vite-runtime-rebuild.json). |
| Isolated package smoke | Nine steps passed on Node 22.13.0: direct bundled imports, newly copied sources outside the package, preview, file/HTTP checks, mid-pose keyboard controls, and SVG-only preview. No npm invocation. [Report](../out/history/pre-legacy-removal-0.4.0/reports/package/report.json). |
| Browser suite | 14 checks passed on Node 24.22.0 / Chromium 156.0.8078.4: both presets/themes, desktop/mobile, controls, motion, no-JS and offline loading. [Report](../out/history/pre-legacy-removal-0.4.0/reports/browser/report.json). |
| Canonical root build/check | The PRD dial command builds real HTML/SVG on Node 22.13.0; eight generic export checks pass. [Runnable HTML](../out/dial/figure.html), [SVG](../out/dial/figure.svg), [report](../out/history/pre-legacy-removal-0.4.0/reports/vite-dial/report.json). |
| Type and framework consumers | Declaration generation and typecheck pass; isolated Next 16.4.2 / React 19.3.1 / TypeScript 7.0.2 passes four setup/build steps plus server render, hydration, independent controls and navigation. [Framework report](../out/history/pre-legacy-removal-0.4.0/reports/react-package/report.json). |
| Compatibility/source sharing | Five compatibility stages pass. Basic and hybrid/print bundles rebuild outside the checkout without npm, with identical HTML/SVG/config/manifest bytes. Hybrid A4 poster/drawing/detailed PDFs and previews are produced. [Compatibility](../out/history/pre-legacy-removal-0.4.0/reports/compat/report.json), [sharing](../out/history/pre-legacy-removal-0.4.0/reports/sharing/report.json), [print delivery](../out/share/exploded-assembly/print/). |
| Scripted mechanisms | Cabinet, exploded assembly and turning mechanism scenarios all pass through the common runner. [Report](../out/history/pre-legacy-removal-0.4.0/reports/drive/report.json). |
| Bounded prototype | `prototype:build` and `test:prototype` execute successfully using Vite. Registration, ordering, fallback, lifecycle and measured performance remain covered; no timing budget is introduced. [Report](../out/three-hybrid/evidence/report.json). |
| Skill/package integrity | Skill-creator validator passes using the existing `/private/tmp/crafted-validator` Python environment. Skill `npm ci --ignore-scripts --no-audit --no-fund` succeeds; runtime input/file hashes and source/assembled package files match. |

Visual review examined the technical light desktop dial, editorial dark mobile dial, light dial crop and dark contact crop, plus all four generated assembly print preview pages (poster, drawing and both detailed pages). Labels, controls, surfaces, contacts and page boundaries remain readable and intact. All eight dial matrix PNGs have **zero changed pixels** versus the preserved 0.3.1 views: [comparison](../out/history/pre-legacy-removal-0.4.0/reports/vite-visual-comparison.json). Original baselines were not replaced or auto-accepted. This review is of the browser/print previews; it does not claim a fresh full PDF rasterization or all 42 pages from the earlier release.

## Reproduce

Inside either copied skill folder, with Node 22.13+ or Node 24+:

```sh
node scripts/figures.mjs build --entry assets/templates/dial-indicator/figure.mjs --config assets/templates/dial-indicator/figure.config.json --output both --state mid --out out/dial
node scripts/figures.mjs preview --dir out/dial --port 4173
```

For browser/PDF work, use an existing executable through `CRAFTED_CHROMIUM_EXECUTABLE`, or explicitly download the pinned browser:

```sh
node runtime/playwright-core/cli.js install chromium
node scripts/figures.mjs check --dir out/dial --report out/check
```

For development and verification from this repository:

```sh
npm ci
npm --prefix skill/crafted-figures ci
npm run runtime:build
npm run types:build
npm run test:types
npm run package:skill
npm run test:bundled
npm test
npm run test:browser
npm run test:package
npm run test:compat
node tests/drive-suite.mjs
npm run prototype:build
npm run test:prototype
```

## Remaining scope limits

Local execution covers Darwin x64 with Node 22.13.0 / 24.22.0 and pinned Chromium under software WebGL. The no-install CI matrix covers Linux/macOS/Windows with Node 22.13/24 but **remote jobs have not executed**; other OS/CPU combinations and hardware GPUs are not certified by this run. Node's WASI warning is expected. Browser executable installation/access remains required for browser/PDF operations, and React applications retain their own dependencies.

No implementation blocker remains for the requested bundled distribution. The complete 0.3.1 replacement qualification, frozen agent evaluations and source migrations remain at `out/history/pre-vite-0.3.1/` and their original trial locations. The entire G01–G12 release matrix, full capacity suite and fresh agent trials have **not** been rerun against 0.4.0. The [readiness report](replacement-readiness.md) distinguishes that historical release from this verified packaging increment. No performance budget waiver beyond the user's existing deferral is inferred.
