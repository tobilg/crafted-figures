# Reproducing release verification

`npm run test:release` must run through npm, because the clean-source step needs npm's own executable path. Hosted CI runs the same suites by job and adds `npm run lint`.

Regression inputs extracted from earlier agent trials live in `tests/fixtures/regressions/`: the construction scene and sheet, and the particle fallback scenarios and model. Their provenance manifest binds every file to its original source hash, and a unit test checks those hashes. Do not reformat them.

From a fresh source checkout with Node 22.13+ or Node 24+:

```sh
npm ci
npm --prefix skill/crafted-figures ci
npm run package:skill
node skill/crafted-figures/runtime/playwright-core/cli.js install chromium
npm run test:release
```

`test:release` runs the release registry in `tests/release-evidence.mjs` and binds each receipt to the package, runtime and verification-input hashes. Its unit step discovers the same `tests/*.test.mjs` files as `npm test`. It also covers owned-renderer browsers, print-reference faults, archive distribution, clean-source builds and guarded offline consumers. Selected steps can be run with `npm run test:release -- unit print-references distribution`. Changing a package or verification input invalidates older receipts, so do not edit tests, examples, scripts or `dist/` while it runs. Without the pinned Chromium, browser groups use an installed Chrome, Chromium or Edge and record which one ran.

## Generated-file ownership

`package:skill` verifies every existing file in `dist/crafted-figures/` against its previous manifest before replacement. Edited files, unrelated files, unknown subdirectories and symlinks cause a conflict without clearing the output. Move intentional local edits to an authoring workspace or another backup location, then rebuild. Unmodified obsolete generated files are safely removed. Canonical source lives in `skill/crafted-figures/` and `examples/`.

Generated recipe directories use ignored `.crafted-generated.json` ownership manifests. The first sync can adopt an older unmanifested copy only when all its files exactly match canonical inputs. Later syncs reject edits and unknown files, remove obsolete owned files and reject retired recipe directories. Preflight covers all recipes before any are changed. The authored basic and React scaffolds remain intact. Ownership manifests are development metadata and do not ship in the skill or source bundles.

The workflow collects timing measurements without enforcing a numeric performance budget. Hosted Actions, fresh agent trials and untested platforms require their own executions; local receipts do not establish them.
