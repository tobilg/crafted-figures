# Crafted Figures

This repository builds **crafted-figures 0.7.1**, an independent skill for crafted isometric SVG explainers. Three.js owns the scene, geometry and orthographic camera; the packaged illustration renderer produces vector artwork, and matching WebGL depth passes support authored effects. It includes mechanisms, profiles/routes/materials, geometric diagnostics, React/Next adapters, print layouts and portable source bundles.

The [skill source](skill/crafted-figures/SKILL.md) builds into `dist/crafted-figures/`, `dist/crafted-figures-0.7.1.zip` and its `.sha256` checksum. Install the **built ZIP**, extracting its `crafted-figures/` folder into your chosen skill location. The artifact contains its Vite/Three.js/Ajv/Playwright runtime and needs no npm installation. A raw GitHub source-folder copy requires a build first.

Use Node 22.13+ or Node 24+. To build from a source checkout:

```sh
npm ci
npm --prefix skill/crafted-figures ci
npm run package:skill
```

Packaging generates the runtime, TypeScript declarations and copied recipes before assembling a deterministic ZIP. Those outputs are ignored by Git. `npm run prepare:dev` generates the components for development without creating the archive. No reference checkout is needed. See [packaging and verification](docs/artifact-packaging.md).

The [Test and build skill workflow](.github/workflows/verify.yml) runs on pushes, pull requests and manual dispatch. It runs contract/type/geometry, browser/effect, React/print/capacity and package/prototype checks, then tests the built package without npm installation on Linux, macOS and Windows with Node 22.13 and 24. All jobs must pass before the final installable artifact is uploaded.

On GitHub, open **Actions → Test and build skill → a successful run → Artifacts → crafted-figures-release-zip**. That download contains the versioned skill ZIP and its checksum; extract the inner ZIP's `crafted-figures/` folder to install it. The workflow summary also links the download. Installable artifacts are retained for 30 days; intermediate candidates and diagnostic evidence for 7 days. Uploads are workflow artifacts, not published GitHub Releases. The first hosted run ([41101188344](https://github.com/tobilg/crafted-figures/actions/runs/41101188344), on the initial commit) failed: the browser job did not build the package it reads, and every Windows build failed. Both are addressed in 0.7.0 but need a new hosted run to confirm; until a run succeeds there is no verified ZIP to download, and **Windows remains unverified**.

After that setup, repository wrappers work as usual:

```sh
npm run build -- --entry examples/dial-indicator/figure.mjs --config examples/dial-indicator/figure.config.json --preset technical --theme light --output both --state rest --out out/dial
npm run preview -- --dir out/dial --port 4173
npm run check -- --dir out/dial --report out/reports/dial
```

Browser checks and printing use the pinned Chromium if it is installed, otherwise Chrome, Chromium or Edge already on the machine. To choose one, set `CRAFTED_CHROMIUM_EXECUTABLE`; to get the pinned build, run `node skill/crafted-figures/runtime/playwright-core/cli.js install chromium`. Reports record which one ran (`environment.browserSource`). Preview stays running; run checks in another terminal. After building, open `out/dial/figure.html` directly or its static `out/dial/figure.svg`. Generated HTML/SVG needs no npm installation or network access. The dial's 0–10 mm travel and 0–300° mapping are illustrative, with no calibration claim.

[Biome](https://biomejs.dev) 2 formats and lints the code and JSON: `npm run lint` checks without changing anything (CI runs it), `npm run lint:fix` applies safe fixes, and `npm run format` formats. Markdown, generated output, the reference checkout and frozen regression inputs are excluded in [biome.json](biome.json).

Build all fourteen examples in both themes with `npm run build:examples`. Sources are in [examples](examples/); outputs are `out/examples/<name>-light/figure.html` and corresponding dark/SVG files. Advanced examples include the [cabinet](examples/terminal-cabinet/figure.mjs), [valve](examples/valve-assembly/figure.mjs), [exploded assembly](examples/exploded-assembly/figure.mjs), [optics tank](examples/ripple-tank/figure.mjs), [turning tool](examples/turning-mechanism/figure.mjs), [merging surfaces](examples/merging-surfaces/figure.mjs), [spring rig](examples/spring-probe/figure.mjs) and [material sheet](examples/material-sheet/figure.mjs). The real [Next fixture](tests/fixtures/next) demonstrates multiple server/client figures; the independent package includes its own React starter.

```sh
npm run build -- --entry examples/valve-assembly/figure.mjs --config examples/valve-assembly/figure.config.json --output both --out out/valve
npm run audit -- --entry examples/valve-assembly/figure.mjs --config examples/valve-assembly/figure.config.json --scenario examples/valve-assembly/audit.json --report out/reports/valve-audit
npm run drive -- --dir out/valve --actions examples/valve-assembly/actions.json --report out/reports/valve-drive
npm run print -- --spec examples/exploded-assembly/sheet.mjs --paper a4 --format all --png --out out/print/assembly-a4
npm run print -- --spec examples/exploded-assembly/sheet.mjs --paper letter --format all --png --out out/print/assembly-letter
npm run bundle -- --entry examples/exploded-assembly/figure.mjs --config examples/exploded-assembly/figure.config.json --out out/share/assembly
```

Local print evidence at `out/reports/print-suite/report.json` records the required paper/layout combinations. Reviewed outputs include `out/print/exploded-assembly-letter/detailed-letter.pdf` and `out/print/ripple-tank-a4/drawing-a4.pdf`, with their HTML/PNG counterparts beside them. Bundles contain sources, artifacts, notices, lockfiles and a rebuild command. Their generated artwork opens offline.

```sh
npm run lint
npm test
npm run test:types
npm run test:browser
npm run test:zbuffer
npm run test:interaction
npm run test:wasm
npm run test:geometry
npm run test:motion
npm run test:audit
npm run test:diagnostics
npm run test:fidelity
npm run test:materials
npm run test:effects
npm run test:react
npm run test:react:dev
npm run test:print
npm run package:skill
npm run test:package
npm run test:distribution
npm run test:source-package
npm run test:compat
npm run bench:capacity
npm run test:parity

npm run prototype:build
npm run test:prototype
```

`package:skill` assembles `dist/crafted-figures/`. Copy it into another workspace and run `node scripts/figures.mjs build ...` directly; keep its bundled `runtime/` directory. Browser/print checks use the separate executable described above. Its CLI provides the same build/preview/check/audit/drive/print/bundle operations. No npm install, parent package, submodule or global installation is needed. The raw `skill/crafted-figures/` source folder omits generated runtime, declarations and copied recipes in Git; use the built ZIP or run the source-build commands above. To enable local Codex discovery, place the package in the target project's `.agents/skills/crafted-figures/`, or give the agent its `SKILL.md` path. These commands do not change any global installation.

Build outputs, screenshots, raw agent traces and archived packages under `out/` and `dist/` are excluded from Git. Documentation links into those directories refer to local evidence; a fresh clone does not contain it. Automated release checks use tracked regression fixtures. Historical evaluation records are an explicit, hash-checked archive input to parity; without that input, parity reports G09 pending. See the [public-release audit](docs/public-release-audit.md) for cleanup candidates, required committed assets and the remaining release issues.

See [capability coverage](docs/parity-matrix.md), [implementation evidence](docs/implementation-status.md), [order verification](docs/order-verification.md), [fresh evaluations](evals/replacement-results.md), [historical evaluations](evals/results.md), [compatibility/migration](docs/compatibility.md), [capacity](docs/capacity.md), [visual review](docs/visual-review.md), and the [prototype decision](docs/three-prototype-report.md). Timing is measured with the user's numeric budget deferral retained. Chromium on the recorded software-GPU environment is tested; broader browser/device support is not inferred.

Anatomy remains a read-only reference pinned to `1482e8469b0a9e0d8cc18ea2740a01423d29ae80`. Builds and CI need no reference checkout. [Provenance and MIT notices](docs/provenance.md) are retained; licensing newly authored code remains the owner's decision. No publication, account setup or remote push is part of this project.

The 0.3.1 gap-closure increment adds a [construction-details example](examples/construction-details/), stricter geometry/fidelity diagnostics, reusable effect/playback scenarios and static-pose printing. See [the implementation and evidence](docs/gap-closure.md).

```bash
npm run build -- --entry examples/construction-details/figure.mjs --config examples/construction-details/figure.config.json --state mid --out out/construction
npm run test:construction
npm run test:gaps
npm run types:build
npm run package:skill
npm run test:release
npm run test:parity
```

`test:release` records executed commands and binds their reports to the exact package, runtime and verification inputs. It includes standalone consumers with no npm installation, optional framework consumers with pinned dependencies, and browser/server checks. Its identity check uses tracked verification inputs and works in a fresh source checkout. `test:parity` separates current automated coverage from explicitly supplied frozen trial records; missing records stay pending. These commands do not simulate fresh-agent trials. `npm run test:release -- unit gaps compat` runs selected steps; all remaining steps are required before claiming full coverage. Browser setup and Node prerequisites are the same as above. The numeric performance budget remains deferred.

Development dependencies are separate from consumer setup. To rebuild the shipped runtime with pinned Vite 8:

```sh
npm ci
npm --prefix skill/crafted-figures ci
npm run package:skill
npm run test:bundled
```

The bundling test builds new static, interactive and hybrid sources outside the checkout with no `node_modules`, network access, native addons or package-manager subprocesses. It also rebuilds a relocated source bundle. Optional React/Next consumers install their own framework dependencies. Runtime build output stays local and is included in the versioned release ZIP. Install that artifact rather than the unbuilt GitHub subdirectory.

Release verification now uses tracked regression inputs and an explicit, hash-checked historical evaluation archive. See [release verification](docs/release-verification.md) for clean-checkout commands, pending-versus-passed semantics and generated-output conflict handling.
