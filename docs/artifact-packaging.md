# Artifact packaging — 0.6.0

The owner authorized keeping generated dependencies and duplicate assets out of Git and building the installable skill as a release artifact. The repository now contains source and pinned build inputs. `npm run package:skill` generates the runtime, declarations and recipe copies, then assembles `dist/crafted-figures/`, `dist/crafted-figures-0.6.0.zip` and a SHA-256 checksum file. No publication or installation is performed by this command.

This intentionally changes direct GitHub subdirectory installation: a raw `skill/crafted-figures/` copy needs the repository build first. Install the extracted ZIP for ready-to-use authoring without npm. Generated HTML/SVG remains standalone and needs neither Node nor network access to view. This is a distribution change under FR-06/08/20/21 and A04/A05/A11/A12; the figure/model/configuration contracts and Three.js illustration renderer are unchanged.

## Build and install

Use Node 22.13+ or Node 24+ in the repository root:

```sh
npm ci
npm --prefix skill/crafted-figures ci
npm run package:skill
```

For development without assembling the ZIP, run `npm run prepare:dev` after the two installs. Both commands generate from the pinned lockfiles and canonical examples; neither silently installs dependencies. Missing inputs produce a prerequisite error. The runtime uses Vite 8.3.5, Rolldown/WASI 1.2.15, Three.js 0.186.1, Ajv 8.20.0 and Playwright Core 1.64.1. ZIP assembly uses root-only fflate 0.8.3. The reference remains `1482e8469b0a9e0d8cc18ea2740a01423d29ae80`; builds need no reference checkout.

Verify the archive against its adjacent `.sha256` file, then extract its `crafted-figures/` folder into the desired local skill directory. Run `node scripts/figures.mjs build ...` from that installed folder, or invoke its absolute CLI path from your authoring project. Node is required for authoring. No npm installation, parent repository or native compiler addon is required. React/Next projects still install their own framework dependencies.

Browser checks and PDF printing separately require Chrome/Chromium: set `CRAFTED_CHROMIUM_EXECUTABLE`, or explicitly run `node runtime/playwright-core/cli.js install chromium` from the extracted skill. The ZIP does not contain a browser executable. Build, preview and audit work without one.

## File ownership and size

| Path | Treatment |
| --- | --- |
| Root/skill manifests and lockfiles, `kit/`, `scripts/`, `references/`, notices, agent metadata | Source in Git |
| `assets/presets/`, `assets/templates/basic-figure/`, React starter scaffold/lockfile | Authored product inputs in Git |
| Root `examples/` | Canonical recipe sources in Git |
| `skill/crafted-figures/runtime/` | Generated from pinned dependencies; ignored by Git, included in the artifact |
| `skill/crafted-figures/types/` | Generated from JSDoc by TypeScript; ignored by Git, included in the artifact |
| Other `assets/templates/` recipes and React `figures/` | Generated copies of examples; ignored by Git, included in the artifact |
| `dist/`, `out/`, `node_modules/`, build/test caches | Local output; ignored by Git |

The clean-source test captured **270 source files / 1,289,041 bytes**, excluding the reference gitlink, before final documentation edits. The previous audit captured roughly 30.3 MB. These counts describe that test snapshot, not a promise that documentation will never change the count. None of the generated components were already tracked, so no index removal was needed. They remain available locally after building.

The assembled package has **258 manifest-listed files / 25,420,847 bytes**, down from 314 / 29,472,154. Its ZIP is **6,964,740 bytes**. Playwright recorder, dashboard, trace-viewer and HTML-report UI files (`lib/vite`) and unrelated upstream skill guides (`lib/tools/skills`) are excluded at runtime generation. Runtime file count falls from 148 to 90, excluding each runtime manifest. Browser automation, browser installation support and third-party notices remain. Interactive Playwright UI/trace viewing is not a skill feature.

The package's **80 authored/generated asset files total only 140,449 bytes**. They supply working recipes, the React starter and presets, so they remain in the artifact. Canonical source is not duplicated in Git. The approximately 11.4 MB WASM compiler is required to compile newly authored figures without consumer npm installation; it belongs in the generated runtime.

`kit/package-files.mjs` defines the shared package/source-bundle file boundary. It filters local environment files, credentials, dependency trees, caches and logs; rejects symlinks; and includes runtime files only when listed with matching hashes in the runtime manifest. Sanitized environment examples remain eligible. This is a packaging boundary, not a comprehensive secret scanner for deliberately authored public sources. The ZIP uses sorted paths, normalized modes and a fixed DOS date; environment details stay in test reports.

## Executed verification

Current evidence uses Node 22.13.0, Darwin x64 and Chromium 156.0.8078.4. The machine-readable packaging report (local evidence: `out/reports/artifact-packaging.json`) binds the package/archive hashes to the executed reports. Evidence is local and ignored by Git.

| Check | Result / evidence |
| --- | --- |
| Deterministic archive, exact manifest/hashes, excluded UI files, extracted no-install figure build, installer asset resolution | Four checks passed in distribution report (local evidence: `out/reports/distribution/report.json`); byte-identical builds under UTC and Pacific/Honolulu. Installer resolution is a dry run, not a new browser download |
| Clean source snapshot | Five steps passed in source-package report (local evidence: `out/reports/source-package/report.json`): clear raw-source error, both fresh locked installs, package build, real HTML/SVG build; ZIP identical to the working-tree ZIP. Temporary source and dependencies removed |
| Unit suite | 38 tests passed in `out/artifact-unit.log`, including local-file exclusion, runtime tampering and symlink rejection |
| Browser suite | 14 cases passed in browser report (local evidence: `out/reports/browser/report.json`), including controls, poses, motion/cleanup, no-JavaScript output, typography and offline exports |
| Guarded artifact consumers | Six cases passed in bundled runtime report (local evidence: `out/reports/bundled-runtime/report.json`), with network/npm/native-addon/repository-import guards, fresh authored modules, deterministic outputs and relocated source-bundle rebuild |
| Compatibility, isolated package, React and print | All five stages passed in compatibility report (local evidence: `out/reports/compat/report.json`), including strict consumer types, nine independent package smoke steps, a real Next/React build with hydration/control/unmount checks and two source-bundle rebuilds. Hybrid A4 poster/drawing/two-page detailed PDF/HTML/PNG output passed without overflow |
| Visual comparison | All eight dial matrix screenshots have zero changed pixels against 0.5.0 in comparison report (local evidence: `out/reports/artifact-visual-comparison.json`). Current technical-light desktop, editorial-dark mobile and hybrid A4 poster images inspected; no new visual defect observed |
| Git selection | Selection report (local evidence: `out/reports/artifact-source-selection.json`) confirms generated components are excluded, authored assets remain selected, and no already tracked file is ignored |
| Skill metadata | `quick_validate.py` passed |

Archive SHA-256: `d939a15b0430020c7e7597133ad724b22c3955bd9f4f929c232dfc1dc2ab7e5e`. Package-manifest SHA-256: `526e2ed7cea367df5a1fdd459ee50b30b1265a60fdd0082c21d1326e42635ea3`.

Reproduce after source setup and explicit browser setup:

```sh
npm test
npm run test:distribution
npm run test:source-package
npm run test:bundled
npm run test:browser
npm run test:compat
```

CI now prepares generated components before development checks, uploads the built folder and ZIP/checksum, and feeds that artifact into the Node/OS no-install consumer matrix. The clean-source test is also configured. Remote CI and other OS/browser/GPU environments have not been executed here. Fresh agent trials and the full 16-step release qualification were not rerun for this packaging increment. The numeric timing budget remains deferred.

The [public-release audit](public-release-audit.md) retains separate outstanding items: historical full-release/parity checks require ignored frozen evaluation inputs, historical evidence links are local, and the owner has not selected a root license. Those do not block building or using this ZIP. The pre-change 0.5.0 package, reports, documentation and packaging inputs are preserved in `out/history/pre-artifact-packaging-0.5.0/`.
