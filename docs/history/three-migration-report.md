# Packaged Three.js migration — 0.2.0 intermediate candidate

The full dial and three additional mechanisms now use the installed Three.js scene/camera/geometry pipeline. The default authoring path is the packaged SVG illustration adapter. The original M2 WebGL experiment remains separate. This closes the narrow M3 candidate milestone; it does **not** close revision-2 replacement gates G01–G12.

| ID | Executed evidence |
| --- | --- |
| M01 | Full dial, same pure model, 21 sampled poses with exact probe contact; original browser matrix and A01–A13 regression checks pass. Completion run (local evidence: `out/reports/migration-completion.json`). |
| M02 | Shared Three geometry/camera, actual vertex correspondence, immutable source annotations, interleaving and unsupported-mesh diagnostics; DOM-free static exports. [Tests](../../tests/migration.test.mjs). |
| M03 | Valve/pipe, cutaway cabinet/wiring and articulated arm. 24 browser cases cover presets/themes/widths, real controls, positions, no-JS, offline files and disposal. Report (local evidence: `out/reports/migration-browser/report.json`). |
| M04 | Static and interactive copied starters build and run in isolated directories after their own dependency installation; Three resolves there. Package report (local evidence: `out/reports/package/report.json`). |
| M05 | Two fresh independent agents created unfamiliar figures with a frozen package. Torque trial (local evidence: `out/reports/migration-evals/leverage/trial.json`), admission gate trial (local evidence: `out/reports/migration-evals/queue/trial.json`). |

The frozen package manifest SHA256 is `80ecf49ec85bf2c79cf7df698a125c8ebb59597c6f2703a7bbdc3063f60af6d8`; snapshot record (local evidence: `out/reports/migration-evals/snapshot.json`). The agents received only the installed skill path, raw task and permitted local evaluation scope. They did not edit the package or consult the implementation discussion. Torque passed 22 model/render checks, eight export cases and twelve browser groups. The gate passed 28 model/render groups, eight export cases and seventeen browser groups. The implementing agent reviewed their actual source/report and final desktop artifacts; each trial agent also reviewed mobile/crops and corrected an observed engraving overlap. Both trials ran Chromium 156.0.8078.4 under Node 25.8.1; the independent package regression ran Node 22.12.0. These are two sampled explicit-use outcomes, not advanced R01–R10 acceptance or an inferred success rate.

The dial's eight full views and twelve 4× detail crops were reviewed after migration. Native Three projection produces small visual differences; the authored camera was adjusted to retain the stand-left/gauge-right composition. The original static baseline is retained in `tests/fixtures/m1-baseline/dial-rest.svg`. All three new theme sheets were inspected. Cabinet face labels and fit bounds were corrected. Faint tube segment joins persist in light-theme 4× views; this is recorded for the broader M4 smooth-surface requirement, not hidden as generic geometry support.

Trial observations: the zero-radius cone was unsupported (the torque author used a supported triangular prism); accent engravings need better contrast in alternate dark themes; generic launch errors incorrectly recommend installing Chromium even when sandbox permissions are responsible. These observations drive subsequent corrections, without changing the frozen trial evidence.

Reproduce with `npm ci`, `npm --prefix skill/crafted-figures ci`, explicit Playwright Chromium installation, `npm test`, `npm run test:browser`, `npm run build:examples`, `npm run test:migration`, `npm run package:skill`, and `npm run test:package`. The completion report records actual commands and results. No timing gate was reinstated.

0.2.0 supports bounded convex solids, annuli, sampled profiles and gentle tube routes, surface marks/text and scalar articulated mechanisms. It does not yet implement the revision-2 full audit, effects, print, framework, materials or camera contracts. Continue with M4–M7; keep the original prototype findings historical.
