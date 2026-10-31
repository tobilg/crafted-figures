# Public-release audit

## Current audit, 0.7.1

The owner made the repository public on 2026-10-31. This audit ran afterwards, against commit `ae425b0` and all five commits reachable from `main` and `review-fixes-0.7.0`, so it confirms what was already exposed rather than clearing it in advance.

**Result: no credentials or personal development paths were found. The main gap is that the project has no license.**

### Open decisions for the owner

| Item | Current state | Why it matters |
| --- | --- | --- |
| Root license | None; neither package manifest declares one | Anyone can read the code, but nothing grants the right to use, copy or modify it. The three files in `skill/crafted-figures/licenses/` cover third-party code only |
| Secret scanning and push protection | Disabled | Nothing would flag or block a credential pushed later |
| Dependabot security updates | Disabled | `npm audit` is clean today, but nothing would propose a fix for a later advisory |
| `main` protection | No protection rule or ruleset | Direct and force pushes are possible for anyone with write access, and a red CI run does not block a merge |
| Personal email in commits | The owner's address is in commit metadata on every non-web commit | It is publicly readable. Removing it means rewriting history; the repository has no forks yet. Future commits can use GitHub's noreply address |
| Historical evaluation archive | `test:parity` needs `crafted-figures-evaluations-0.3.0.zip`, which is not in the repository | Outside readers can run the technical checks, but they can't reproduce a full parity pass; G09, C01, C15 and C16 stay pending without it |

There is no `SECURITY.md` or `CONTRIBUTING.md`, so outside contributors and vulnerability reporters have no stated process. `plan/`, `evals/` and the review records in `docs/` are public along with the code, including their lists of known limitations.

### What was checked

| Check | Result |
| --- | --- |
| Tracked content at `ae425b0` | 333 text files, 1,742,078 bytes, no binaries, plus the `reference/anatomy` gitlink. No `out/`, `dist/`, `node_modules/`, environment files or `.DS_Store` |
| gitleaks 8.30.1, full history | One finding, a false positive: "stable keys" in `plan/PRD.md:800` matched its generic API key rule |
| Credential patterns, every revision | None for private keys, GitHub, AWS, OpenAI/Anthropic-style, Slack or npm tokens, or URLs with embedded credentials |
| Personal strings, every revision | No username, home directory or email in file contents. `/Users/a` is a test value in `tests/robustness.test.mjs`, and `docs/bundled-runtime.md:39` names `/private/tmp/crafted-validator`, which identifies nobody |
| Session identifiers and UUIDs, at `ae425b0` | None in any tracked file; the only match was the phrase "session identifiers" in this document |
| `npm audit` | 0 vulnerabilities in the root and skill lockfiles, including development dependencies |
| Workflow exposure | No repository secrets or variables. The workflow reads no secrets, does not use `pull_request_target`, and has read-only `contents` permission. Fork PRs from first-time contributors need approval to run |
| Public CI artifacts | 51 are downloadable. The one inspected, `package-compatibility-evidence` of run 41196061072 (272 files), contains hosted runner paths and no local ones |
| Upstream | `wheresryan22/anatomy` is public and MIT-licensed, and its pinned commit `1482e8469b0a` exists there. Git records a gitlink, not copied source |

Controls guarded the scans: known strings had to match first, because an earlier attempt returned false zeros when revisions were not passed separately.

**Not covered:** the other 50 CI artifacts; Actions logs, which is lower risk because no secrets are configured; ignored local files, which are not published; and legal review of the license notices. Pattern scans and gitleaks find known credential shapes, so this is not a certification that no sensitive content exists.

### Items from the 0.5.0 audit

| 0.5.0 item | Status at 0.7.1 |
| --- | --- |
| Release checks not self-contained | **Resolved for automated checks.** No test reads the ignored frozen inputs; they now come from `tests/fixtures/regressions/`. Parity still needs the archive above |
| Evidence links into ignored `out/` and `dist/` | **Resolved.** 210 links at 0.5.0, none in tracked Markdown now |
| No owner-selected root license | **Open**, and now more pressing because the repository is public |
| Remote CI not executed | **Resolved.** [Run 41196061072](https://github.com/tobilg/crafted-figures/actions/runs/41196061072) passed all 11 jobs on `main`, from a checkout without the reference submodule |

## Historical audit, 0.5.0

The owner subsequently authorized artifact-based distribution in 0.6.0. [Artifact packaging](artifact-packaging.md) supersedes the committed-runtime/types/recipe requirements below: Git now holds their sources and lockfiles, while `package:skill` generates the ready-to-use ZIP. It also implements the shared package/source-bundle local-file filter identified below. The measurements and findings below are retained as historical evidence and describe 0.5.0, not the current repository.

The 0.5.0 source and runtime were audited before a first commit. The initial Git-eligible working tree contained **507 regular files / 30,335,436 bytes**, plus the Anatomy submodule gitlink. Only `.gitmodules`, `README.md` and that gitlink were staged; the implementation files were still untracked. No root commit history existed to scan. Changes in this audit are limited to ignore rules and documentation; source, runtime, fixtures, frozen evaluations and historical evidence were preserved.

Most proposed public repository bytes in 0.5.0 were the portable runtime. The largest file was the **11,397,229-byte Rolldown WASM compiler**. That version needed it committed for direct source-folder installation. Version 0.6.0 generates it into the release artifact instead; consumers install that artifact without npm.

### Removal candidates

Sizes below are approximate local `du` measurements, not promised reclaimed disk space; some historical copies use filesystem cloning.

| Files | Local size | Treatment |
| --- | ---: | --- |
| `.DS_Store` | 8 KiB | Disposable OS metadata; ignored |
| Root `node_modules/` | 519 MiB | Reinstallable with root `npm ci`; safe to remove when not using development tooling |
| `skill/crafted-figures/node_modules/` | 84 MiB | Reinstallable with the skill's `npm ci`; unnecessary for normal use of the committed runtime |
| `tests/fixtures/next/.next/` | 161 MiB | Rebuildable Next cache; safe to remove when no fixture server/build is running |
| Root `dist/` | 29 MiB | Regenerated by `npm run package:skill`; preserve separately if it is an identified release snapshot |
| Generated figure/print folders under `out/` | Includes 525 MiB in `out/print/` | Regenerate using the recorded commands after checking for unique or edited deliverables |
| `out/share/` | 207 MiB | Generated portable bundles, but inspect for unique source edits or distributed snapshots before deleting |
| `out/history/` | 1.0 GiB | Historical evidence, not a disposable cache; preserve an archive and its hashes before any cleanup |
| `out/reports/` | 381 MiB | Mixed generated reports, frozen agent trials and actual regression inputs; **do not delete wholesale** |

No source file was established to be dead code. Old-looking tests, geometry fixtures and example copies have consumers in scripts, CI, the capability manifest or historical reports. A small optional future archive could move `plan/IMPLEMENTATION_PROMPT.md`, `plan/MIGRATION.md` and historical milestone documents out of the main reading path, but the PRD, ownership instructions and cross-links currently reference them. Archiving them requires updating those references; it is not a meaningful size saving.

The bounded `experiments/three-hybrid/` implementation is about 40 KiB and remains required by the prototype commands and CI. The `reference/anatomy` checkout is about 27 MiB locally but Git records it as a gitlink, not copied source in this repository. Builds and CI work without initializing it. Preserve the reference pin and notices under the current ownership instructions.

### Files required by the historical 0.5.0 distribution

- `skill/crafted-figures/runtime/`, including `vite/dist/`, WASM, Playwright assets, manifest and notices. Trim vendored runtime assets only through the runtime build script followed by package/browser checks, not by deleting individual files.
- `skill/crafted-figures/types/` and its generated recipe templates. They are intentional installable assets; a user installing the skill directly from Git needs them. Root `examples/` remains the maintained source for synchronized recipes.
- Root and skill package manifests/lockfiles, plus the Next fixture and packaged React starter lockfiles.
- `tests/fixtures/m1-baseline/dial-rest.svg`, other authored test fixtures, schemas, presets and material data. Do not ignore SVG, PNG, JSON, WASM or `types/` globally.
- `AGENTS.md`, `plan/PRD.md`, third-party notices and the package's `agents/openai.yaml`. Root `.agents/` is a local install directory; the package's `agents/` is product metadata.

### Ignore changes and verification

The former broad `!skill/crafted-figures/runtime/**` exception could re-include local `.DS_Store` or `node_modules` files below the runtime. It is replaced by an exception only for the required `runtime/vite/dist/` subtree. Local-file exclusions follow that exception, so they still apply there.

Added exclusions cover dependency/build caches, downloaded browsers, interrupted `.runtime-build-*` directories, test reports, browser authentication state, logs, environment files, npm credentials, private-key formats, local agent directories and editor/OS files. Sanitized `.env.example`, `.env.*.example`, `.env.sample`, `.npmrc.example` and shared `.vscode/extensions.json` remain eligible. No real environment or credential file was added to test the patterns.

Executed `git check-ignore --no-index` probes confirmed **all 314 package files and 12 source/example probes remain visible**, while **31 local/generated/credential path probes are ignored**, including junk nested inside the runtime. All **149 runtime files**, including its manifest, remain visible. The local report is `out/reports/public-release-ignore-check.json`.

A temporary copy containing only Git-eligible files (508 files at capture time) also passed package assembly and a real sector-gauge HTML/SVG build under Node 22.13.0, with no `node_modules`, reference checkout or dependency installation. Its package manifest hash exactly matched the existing 0.5.0 delivery, `1af64d5ab7ff68d032e81443ed94f44b2635bd2bd85b8fcc9a073bdc8a5f2e37`. The same copy reproduced the expected `ENOENT` for the ignored R09 inputs when invoking the release identity function; that is a confirmed release-check dependency, not a passing full release run. The temporary copy was removed after recording `out/reports/public-release-clean-copy.json`. No browser or full application test suite was rerun for ignore/documentation-only changes.

`.gitignore` affects Git selection only. It does not remove already tracked files. The 0.5.0 packaging script's recursive copies could include future local `.env` files or logs placed inside allowed directories; no such contamination was found in that package. Version 0.6.0 resolves this item with a shared collector that excludes local files, rejects symlinks and verifies manifest-listed runtime bytes.

### Outstanding public-release issues

1. **Historical release checks are not self-contained in a fresh clone.** `tests/release-evidence.mjs` hashes frozen inputs under ignored `out/reports/replacement-evals/R09-corrected`, `out/reports/gap-evals/construction/source` and `out/reports/gap-evals/verification/reports/observed-failure-t231`. `tests/gap-followups.mjs` also reads a frozen model there; `tests/parity.mjs` reads frozen evaluation reports/snapshots. `npm run test:release` and `npm run test:parity` therefore need those archives. Move sanitized regression inputs into versioned fixtures, and give immutable evaluation evidence an explicit acquisition path or separate historical gate. Do not fix this by committing the entire `out/` tree or inventing passing evidence.
2. **Most raw evidence is local.** The initial audit found 210 Markdown links into ignored `out/` or `dist/`. The six README links were replaced with local-path instructions. Historical documents retain their evidence links, which will not resolve on GitHub. Publish only a deliberately reviewed evidence subset or archive when ready; raw agent traces can contain prompts, filesystem paths, session identifiers and environment details. No evidence was published or removed in this audit.
3. **New project code has no owner-selected root license.** Existing dependency and historical MIT notices are present. Selecting the project's license remains an owner decision; this audit does not assign one.
4. **Current qualification is scoped.** The 0.5.0 focused checks are documented in [legacy-removal.md](legacy-removal.md). Full release gates and fresh agent trials apply to older frozen packages. The stale 0.4.0 “current version” wording in [replacement-readiness.md](replacement-readiness.md) was corrected without changing historical results. Remote CI remains unexecuted locally; a public push is not part of this audit.

A pattern scan of Git-eligible text checked private-key markers, common GitHub/AWS/OpenAI/Slack token forms, credential URLs and machine-specific home paths. **No apparent project credentials or personal development paths were found.** The matches were inspected: Playwright's documented `user:password` proxy examples and its generic `pwuser`/`$Username` WSL paths. This is a working-tree pattern scan, not a comprehensive secret or dependency-security certification. Ignored raw evidence and `.git` metadata are outside the proposed public source set.

Useful final inspection commands, which do not stage, delete or publish anything:

```sh
git status --short --untracked-files=all
git ls-files --cached --others --exclude-standard
git ls-files --cached --ignored --exclude-standard
git diff --check
```

Avoid `git clean -fdx` for this project: ignored directories contain preserved evidence and regression inputs as well as disposable caches.
