# Reproducing release verification

`npm run test:release` must run through npm, because the clean-source step needs npm's own executable path. Hosted CI runs the same suites by job and adds `npm run lint`; it does not run `test:parity`, whose result depends on the historical archive described below.

Current automated regression inputs live in `tests/fixtures/regressions/`. Their provenance manifest binds every extracted file to its original historical source hash. They include the two R09 migration figures, the construction scene/sheet and the particle fallback scenarios/model. They do not include upstream engines, frozen toolkits, screenshots, account state or session logs. Production and regression builds require no `reference/` checkout.

From a fresh source checkout with Node 22.13+ or Node 24+:

```sh
npm ci
npm --prefix skill/crafted-figures ci
npm run package:skill
node skill/crafted-figures/runtime/playwright-core/cli.js install chromium
npm run test:release
npm run test:parity
```

`test:release` runs the current automated registry and binds each receipt to the package, runtime and verification-input hashes. Its unit step discovers the same `tests/*.test.mjs` files as `npm test`. It also covers owned-renderer browsers, print-reference faults, archive distribution, clean-source builds and guarded offline consumers. Selected steps can be run with `npm run test:release -- unit print-references distribution`. Changing a package or verification input invalidates older receipts.

`test:parity` reports the **current package version**, current automated coverage and historical evaluations separately. It runs without local historical directories. Missing test receipts are pending, with their exact reason. Without an explicit historical evaluation input, G09 remains pending and the command exits **2**; it does not invent trials, silently waive the requirement or crash while walking an ignored directory. Malformed or altered evidence fails. A passing current automated registry is reported as `technicalStatus: "passed"` independently of historical availability.

## Historical evaluation input

The original R01–R10 records remain unchanged. [The tracked historical manifest](../evals/historical-manifest.json) records their exact hashes and frozen version. The archive contains the selected trial records/snapshots, not every linked image/source/trace; the original full evaluation archive remains the source for those attachments. No report in this archive is relabeled as a fresh trial on the current package.

A maintainer who has the original evaluation directory can create the bounded evidence archive:

```sh
npm run evidence:pack -- --source out/reports/replacement-evals --out out/evidence
npm run test:parity -- --evaluations out/evidence/crafted-figures-evaluations-0.3.0.zip
```

On another machine, obtain that archive from the maintainer through an explicitly authorized transfer, then pass its local path to `--evaluations`. An original evidence directory is also accepted. Validation checks every declared record hash, trial ID and frozen snapshot; the ZIP must contain exactly the declared files. There is no automatic download and no public URL has been created. This explicit input supports historical evidence review, not a claim that new agent evaluations ran.

The original record archive assembled locally has SHA-256 `362c3922d0b71c0e39a2704aac0f1bc35ca209e063eeea50d68bc77821bf1e56`. Historical records are outside the installable skill and remain outside Git. A future fresh evaluation set needs its own manifest and package identity.

## Generated-file ownership

`package:skill` verifies every existing file in `dist/crafted-figures/` against its previous manifest before replacement. Edited files, unrelated files, unknown subdirectories and symlinks cause a conflict without clearing the output. Move intentional local edits to an authoring workspace or another backup location, then rebuild. Unmodified obsolete generated files are safely removed. Canonical source lives in `skill/crafted-figures/` and `examples/`.

Generated recipe directories use ignored `.crafted-generated.json` ownership manifests. The first sync can adopt an older unmanifested copy only when all its files exactly match canonical inputs. Later syncs reject edits and unknown files, remove obsolete owned files and reject retired recipe directories. Preflight covers all recipes before any are changed. The authored basic and React scaffolds remain intact. Ownership manifests are development metadata and do not ship in the skill or source bundles.

The full workflow continues to collect timing measurements without enforcing the deferred numeric performance budget. Hosted Actions, fresh agent trials and untested platforms require their own executions; local receipts do not establish them.
