# Review corrections — crafted-figures 0.6.1

This increment addresses all five findings in the [2026-10-23 review](project-review-2026-10-23.md). It preserves the existing Three.js renderer, public figure/configuration contracts and timing-budget deferral. The previous 0.6.0 package, reports, documentation and verification inputs are preserved under `out/history/pre-review-fixes-0.6.0/`.

| Finding | Correction | Regression coverage |
| --- | --- | --- |
| R1: missing SVG artwork in print | Each printed SVG is namespaced once using the DOM. Local `href`, `xlink:href`, quoted/unquoted `url(#id)` and ARIA references resolve within that view. Duplicate IDs and unresolved references fail before PDF output. | [Print-reference suite](../tests/print-references.mjs): all three layouts on A4/Letter, repeated views, actual PDF vector inspection, and four deliberately invalid reference cases. |
| R2: release checks require ignored files | Minimal unchanged migration, construction and fallback inputs now live in tracked regression fixtures with source hashes and required MIT notices. Full release identity no longer walks ignored historical directories. Historical trials are a separate explicit, hash-checked input to parity. | [Source-package check](../tests/source-package.mjs) executes a current release unit step and parity from a fresh source copy. Missing trials produce an explicit pending result; altered records fail. The original migration and gap follow-up suites now use tracked inputs. |
| R3: stale generated recipes ship | Recipe sync validates every managed tree before writing. Unexpected files and retired directories cause a conflict; obsolete unchanged owned files are removed. Older unmanifested copies can be adopted only when identical to canonical sources. | [Generated-tree regressions](../tests/generated-tree.test.mjs) verify stale-file rejection, safe updates/removal and preservation of the authored scaffolds. |
| R4: release registry/version drift | Release units use the same file discovery rule as `npm test`. Current renderer, distribution, source-package, offline-runtime and print-reference suites are registered. Parity obtains the current toolkit version from the actual assembled package; historical fixture/trial versions remain explicit. | [Release-evidence regressions](../tests/release-evidence.test.mjs) compare discovered tests and root entrypoints with the registry. Clean-source parity checks current version metadata. |
| R5: package rebuild discards local work | Existing package contents must match the previous manifest before staged replacement. Edited/unrelated files, unknown subdirectories and symlinks fail without clearing the destination. | Generated-tree regressions check both edited `SKILL.md` and unrelated notes survive rejected builds, alongside safe obsolete-file removal. |

Generated ownership manifests are ignored development metadata and excluded from the installed skill and source bundles. No new runtime dependency was added. The skill version and its lockfile are 0.6.1; the existing pinned toolchain is unchanged.

## Verification

**All 21 current release groups passed**, including 46 unit tests and strict types. [The aggregate evidence](../out/reports/review-fixes-0.6.1/report.json) binds every command log and report to the exact package/runtime/verification inputs. The [final run log](../out/reports/review-fixes-0.6.1/release-final.log) and [individual receipts](../out/reports/release/) retain the executed results.

| Executed verification | Result |
| --- | --- |
| Print references | All ten cases passed, including deliberate failures. All eight actual PDF-rendered pages were visually inspected; reused supports, gradients and clipping remain visible. |
| Existing print output | The 32 standard and ten static PDF pages, plus four enlarged PDF crops, remain pixel-identical to the preserved baseline. Final regenerated PNG hashes match the reviewed files. |
| Browser, geometry, effects and integration | All registered groups passed, including production/development React, changing geometry, diagnostics, both-theme effects/fallbacks, source migration and original evaluation-source follow-ups. Representative current follow-up figures and the actual construction PDF were inspected. |
| Portable delivery | Nine independent package steps, four distribution cases, six guarded offline cases and seven clean-source steps passed. The clean source copy ran both locked installs, built without `reference/` or generated inputs, reproduced the exact ZIP and executed the release unit step. Expected nonzero results for an unbuilt checkout and missing evidence were checked explicitly. |
| Parity without history | Exit 2, explicitly pending historical evidence; all 21 current technical groups passed. [Report](../out/reports/review-fixes-0.6.1/parity-without-history.json). |
| Parity with explicit archive | Exit 0, zero unmet aggregate rows; ten original trials verified against their frozen hashes and version. These remain historical 0.3.0 trials. [Report](../out/reports/review-fixes-0.6.1/parity-with-history.json). |
| Metadata and preservation | actionlint 1.7.12, skill metadata validation and Git whitespace checks passed. The reference checkout remains clean at `1482e8469b0a9e0d8cc18ea2740a01423d29ae80`. |

The [assembled folder](../dist/crafted-figures/) contains 259 manifest-listed files / 25,422,400 bytes. The [ZIP](../dist/crafted-figures-0.6.1.zip) is 6,965,756 bytes. Package-manifest SHA-256: `81d605b499c6dbfe18a517a95b62eb9b303b583430b1a3687a442b92a697fb8c`. ZIP SHA-256: `f5f1c184d7eced6ea6d8ef9d306ff1fda586c2f2619420da0cadf4436b869ea9`.

Verification ran on Node 22.13.0, Darwin x64, Chromium 156.0.8078.4 and software ANGLE/SwiftShader. The pinned dependency versions are recorded in the aggregate report; no dependency version changed. Earlier attempts remain preserved: a temporary Node executable disappeared before distribution could start, and a report-key typo initially rejected six successful offline cases. The executable was restored, the key corrected, and the entire final 21-group run completed against the corrected verification identity.

No local implementation or check blocker remains for R1–R5. No fresh agent trials or hosted Actions run occurred. Other OS/browser combinations and hardware GPUs remain unqualified. The numeric timing budget stays deferred: the current mixed workload measured 8,847.4 ms median / 10,195.2 ms p95 per four-control batch, with ten successful navigation/cleanup cycles. That functional pass does not imply a frame-rate target. [Historical capacity measurements](capacity.md) retain their original reports and values.

Evidence and built artifacts remain local/ignored. No public evidence location was created, and the new project's root license remains an owner decision. These are public-release follow-ups, separate from the five corrected findings.

Reproduction, historical archive acquisition/checking and generated-output conflict handling are documented in [release verification](release-verification.md). No push, publication or global installation is part of this increment.
