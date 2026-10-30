# Overall project review — 2026-10-23

**Conclusion: crafted-figures 0.6.0 is a substantial, usable local skill, but needs corrections before a fully qualified public release.** The Three.js authoring pipeline, owned SVG renderer, effects, configuration, interaction, framework adapters, printing and portable packaging are implemented. This review found a silent print defect, reconfirmed that full release/parity checks cannot run from a fresh source checkout, and identified weaknesses in generated-file handling and release-test coverage.

This is a review of the current implementation against revision 2 of [the PRD](../plan/PRD.md) and the owner's subsequent renderer, Vite, packaging and timing-budget decisions. It does not reopen the completed migration or require a new rendering architecture. Production code was not changed. Destructive packaging probes ran only in a disposable copy.

## Findings

Priorities: **P1** should be resolved before claiming a fully qualified release; **P2** is a correctness or verification gap to fix; **P3** is lower-priority hardening. Findings are supported by execution unless marked as source inspection.

### R1 — P1: print can silently discard artwork using local SVG references

**Locations:** [capture.mjs](../skill/crafted-figures/kit/print/capture.mjs), line 33; [print/index.mjs](../skill/crafted-figures/kit/print/index.mjs), line 6. **Requirements:** FR-04, FR-18; G06/G11.

The public figure contract accepts generated SVG children. A valid figure using `<defs><path id="block-shape" …/></defs><use href="#block-shape"/>` renders correctly on screen. During print capture, IDs receive a view prefix, but the code looks for a *quoted* fragment inside each DOM attribute value. The actual `href` value has no quotes. The print layout prefixes IDs a second time without updating `href` either.

**Reproduced:** the on-screen reference resolves; the printed reference does not. The poster HTML and actual PDF lose the entire illustrated support, while the print command returns `status: "passed"`. I inspected the source screenshot, printed figure and rendered PDF page. This is a confirmed valid-SVG edge case, not evidence that the existing canonical print fixtures all fail.

Use consistent reference rewriting at both namespace boundaries, including fragment `href`/`xlink:href`, supported `url(#…)` references and ARIA ID lists. Add regressions for a reused local shape and multiple appearances of one view. Print validation should detect unresolved local references rather than reporting successful output with missing artwork.

Evidence: [probe report](../out/reports/project-review-2026-10-23/print-use/report.json), [working screen](../out/reports/project-review-2026-10-23/print-use/screen.png), [blank PDF page](../out/reports/project-review-2026-10-23/print-use/pdf-page.png), [actual PDF](../out/reports/project-review-2026-10-23/print-use/printed/poster-a4.pdf), [reproduction script](../out/reports/project-review-2026-10-23/reproduce-print.mjs).

### R2 — P1: full release/parity verification requires ignored local history

**Location:** [release-evidence.mjs](../tests/release-evidence.mjs), line 25; consumers [release.mjs](../tests/release.mjs) and [parity.mjs](../tests/parity.mjs). **Requirements:** FR-08/20; G01/G07/G12. **Previously documented; reconfirmed.**

`releaseIdentity()` unconditionally walks three directories under ignored `out/reports/`: the corrected R09 source, the construction evaluation source and an observed verification failure. These are absent from a fresh checkout. Both the selected release `unit` step and parity command fail with `ENOENT` on `out/reports/replacement-evals/R09-corrected` before they can qualify the package.

The same isolated source copy successfully assembled a byte-identical package without `reference/`. Thus ordinary package building works; the full release-verification workflow is not portable. The new Actions workflow runs its own test groups and does not eliminate this separate failure.

Move the minimal distributable regression inputs into tracked test fixtures, and make historical evaluation evidence an explicit, versioned input with an acquisition/checking procedure. Keep historical trials distinguishable from current package receipts. Do not resolve this by dropping required checks or committing all of `out/`.

Evidence: [isolated-copy report](../out/reports/project-review-2026-10-23/packaging-probes.json), [release failure](../out/reports/project-review-2026-10-23/release-clean.log), [parity failure](../out/reports/project-review-2026-10-23/parity-clean.log).

### R3 — P2: obsolete generated recipe files can ship in the next package

**Locations:** [sync-templates.mjs](../scripts/sync-templates.mjs), lines 3–6; [package-files.mjs](../skill/crafted-figures/kit/package-files.mjs), lines 25–34. **Requirements:** FR-06/08; A05/A12.

Template synchronization copies the current expected files into existing directories but never reconciles obsolete files. The package collector then recursively includes those directories. Because generated recipe copies are ignored by Git, an ordinary obsolete `.mjs` file can be invisible to source review while still appearing in the distributable.

**Reproduced:** after a clean, identical build, I added `assets/templates/dial-indicator/obsolete-recipe.mjs` in the disposable checkout. Another successful package build included it in the manifest and changed the archive bytes. This demonstrates an uncontrolled generated input; it is not a failure of deterministic builds from identical clean inputs.


Generate recipe trees in staging from an explicit ownership inventory, or safely reconcile previous generated files. Preserve the authored basic/React scaffold and handle unexpected edits explicitly. Test that a stale generated recipe is excluded or causes a clear conflict, and that clean and previously built workspaces produce the same intended artifact.

Evidence: [packaging probe](../out/reports/project-review-2026-10-23/packaging-probes.json), [reproduction script](../out/reports/project-review-2026-10-23/reproduce-packaging.mjs).

### R4 — P2: the full-release test registry has drifted from current tests

**Locations:** [release-evidence.mjs](../tests/release-evidence.mjs), lines 4–20; [parity.mjs](../tests/parity.mjs), line 3; [fixture manifest](../tests/fixtures/manifest.json), line 3. **Requirements:** G01/G07/G12. **Source inspection and inventory.**

`npm test` discovers 13 unit-test files. The release runner hardcodes 11 and omits `owned-renderer.test.mjs` and `package-files.test.mjs`. Its registry also has no direct step for the newer owned-renderer browser suite or distribution/source-package/offline-runtime suites. Compatibility exercises some related behavior, but does not substitute for every new regression.

Separately, parity assigns `toolkitVersion` from the fixture manifest, which still says `0.3.1`, without comparing it to the current package's `0.6.0`. Even after R2 is corrected, a complete run of the existing release registry would not establish that every newer gate ran or label the current toolkit version correctly. The Actions workflow and `npm test` already cover several of these missing cases; the problem is divergence between qualification entrypoints.

Maintain a shared suite inventory or test that the release registry covers the intended current suites. Derive current toolkit identity from the package, while retaining explicit historical fixture/trial versions. Do not rewrite old reports as new executions.

Evidence: [inventory](../out/reports/project-review-2026-10-23/inventory.json).

### R5 — P3: package rebuild treats a generator marker as permission to delete all contents

**Location:** [package-skill.mjs](../scripts/package-skill.mjs), line 14. **Scope:** generated `dist/crafted-figures/` only.

The packager accepts an existing directory when its manifest has the expected `generator`, then removes the entire directory without checking recorded hashes or unknown files. **Reproduced:** an edited `SKILL.md` and an unrelated `local-note.txt` both disappeared on a successful rebuild.

Replacing a generated output directory is a common build convention, so this is lower priority than R1–R4. It does not erase source examples or establish a defect in the figure-output ownership guard. However, the current marker check offers less protection than a content ownership check. Either document this folder as disposable prominently, or reject/preserve modified and unowned content before replacement; add a focused regression for the chosen policy.

Evidence: [packaging probe](../out/reports/project-review-2026-10-23/packaging-probes.json).

## Overall assessment against the PRD

| Area | Assessment |
| --- | --- |
| Architecture and ownership | The default pipeline uses Three.js scene/camera state with our SVG renderer and matching effect geometry. The removed Anatomy renderer has not reappeared. A custom SVG renderer remains an intentional part of this architecture. Model, configuration and rendering responsibilities are separated; source and package builds do not require the reference checkout. |
| Figure/configuration contracts | Schema validation, presets/themes, model-derived rendering/readouts, named poses, static export, motion policy and lifecycle support are implemented. Current unit/type checks pass. The public v1 figure contract remains relevant, including the SVG case exposing R1. |
| Advanced authoring | Geometry, construction details, materials, articulated/changing geometry, effects and geometry diagnostics have implementation, examples and regression suites. Their supported envelopes are documented; generic meshes, unrestricted cameras and automatic shader-to-vector conversion are not promised. This review did not rerun every advanced fixture. |
| Integration and documents | React/server/client adapters, TypeScript declarations, source bundles and print layouts exist with prior executed evidence. R1 exposes a missing print regression beyond the existing fixtures. |
| Packaging | Source-only Git and generated installable artifacts are an appropriate split. The ready-to-use folder and ZIP include the runtime needed for authoring without npm; Node remains required, with Chromium separately needed for browser checks/printing. HTML/SVG viewing is standalone. R3 affects repeated builds in dirty generated directories. |
| Verification and CI | Substantial positive/negative tests and a conservatively configured Actions workflow are present. R2/R4 prevent treating the current full-release entrypoint as a clean-checkout qualification gate. Hosted CI and its six OS/Node consumer cases have not actually run. |
| Skill quality and evidence | The skill metadata validator passes and instructions point to focused references/templates. Earlier fresh agent evaluations exist, but this review ran no new agent trials. Historical qualification must remain attached to its original packages. |
| Performance | Measurements and support limits are documented. The owner's timing-budget deferral remains in force. No new hardware benchmark was performed and no 33 ms pass/fail is asserted. Earlier software-WebGL measurements do not isolate hardware cost from implementation cost. |

## Verification actually performed for this review

Environment: Node **22.13.0**, Darwin x64; print reproduction used Chromium **156.0.8078.4**. Package version **0.6.0**. The read-only Anatomy checkout remains clean at `1482e8469b0a9e0d8cc18ea2740a01423d29ae80`.

| Check | Actual result |
| --- | --- |
| `npm test` | Passed: 38 tests, zero failures/skips. [Log](../out/reports/project-review-2026-10-23/unit.log). |
| `npm run test:types` | Passed. [Log](../out/reports/project-review-2026-10-23/types.log). |
| Root and skill `npm audit --json` | Both exited 0; zero known advisories returned for their dependency trees at review time. [Root](../out/reports/project-review-2026-10-23/npm-audit-root.json), [skill](../out/reports/project-review-2026-10-23/npm-audit-skill.json). |
| Workflow/skill metadata | actionlint 1.7.12 and the skill-creator metadata validator passed. [Workflow log](../out/reports/project-review-2026-10-23/actionlint.log), [skill log](../out/reports/project-review-2026-10-23/skill-validation.log). |
| Package integrity | All 258 listed package file hashes checked. Manifest lists 25,420,847 bytes. Archive is 6,964,740 bytes. |
| Isolated source packaging | Passed without generated source-tree artifacts or the reference checkout; resulting ZIP matched the existing ZIP exactly. Installed pinned dependencies were filesystem-cloned into the temporary copy, not freshly downloaded for this review. |
| Clean-source release/parity probes | Both failed as described in R2. This is a product workflow limitation, not a browser/environment blocker. |
| Dirty generated-tree probes | Confirmed R3/R5; operations completed in the disposable copy, which was subsequently removed. |
| Real print/PDF probe | Confirmed R1; browser output and actual PDF visually inspected. |

Package manifest SHA-256: `526e2ed7cea367df5a1fdd459ee50b30b1265a60fdd0082c21d1326e42635ea3`.

ZIP SHA-256: `d939a15b0430020c7e7597133ad724b22c3955bd9f4f929c232dfc1dc2ab7e5e`.

The [aggregate review record](../out/reports/project-review-2026-10-23/report.json) binds findings and logs to these artifacts. An initial packaging harness used symlinked dependencies; that setup produced different paths and was replaced with filesystem-cloned dependencies before the deterministic comparison above. Its preliminary record is retained but is not counted as a product determinism failure.

**Existing evidence inspected, not newly executed here:** the [0.6.0 packaging report](../out/reports/artifact-packaging.json) covers the browser matrix, offline/distribution checks, independent package, Next/React consumer and source-bundle/print rebuilds. The [workflow report](../out/reports/workflow/report.json) records a previous clean-source run with both fresh locked installs, packaging, 38 unit tests, strict types, four distribution cases, six offline cases, 14 dial cases and nine owned-renderer cases. Historical 0.3.1 full-release/agent evidence is not a fresh 0.6.0 qualification.

## Public-release limitations and next work

1. Fix R1 and add its print regression. Resolve R2/R4 together so current release and parity checks cover the intended suites and run from distributable inputs. Fix R3 before relying on an arbitrary existing development checkout to assemble release artifacts. Choose and document the R5 output policy.
2. Re-run current package qualification after those changes and preserve its exact identity. Retain the older successful trials as historical evidence; do not relabel them or infer fresh agent success from unit tests.
3. Execute the hosted workflow when the owner pushes. Linux/Windows consumer behavior, remote Actions execution, other browsers and hardware GPU performance remain unverified here. No remote is configured and no push/publication was performed.
4. Decide the new project's root license before public release. The PRD leaves this to the owner; upstream/dependency notices are present, but no owner-selected root `LICENSE` exists.
5. Make selected release evidence accessible to readers. Before adding this report, the documentation inventory found **214 links into ignored `out/` or `dist/`**. They are useful locally but unavailable in a fresh clone/public GitHub view. Preserve `out/` as ignored; distribute a curated evidence archive or stable published report when publication is authorized. These local review links have the same current limitation.

The remaining work is targeted correctness and release qualification. The repository already contains the intended skill implementation; another broad architecture rewrite is not indicated by this review.
