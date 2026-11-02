# Public-release audit, 0.7.1

The owner made the repository public on 2026-10-31. This audit ran afterwards, against commit `ae425b0` and all five commits reachable from `main` and `review-fixes-0.7.0`, so it confirms what was already exposed rather than clearing it in advance.

**Result: no credentials or personal development paths were found. The main gap is that the project has no license.**

**Since this audit (0.8.0):** the owner chose the MIT license. [LICENSE](../LICENSE) is at the repository root and in the skill package, and both package manifests declare it. The merged branch `review-fixes-0.7.0` was deleted from GitHub. The prototype, the reference submodule and the historical records were removed, along with the parity gate and its archive. The other decisions below remain open.

### Open decisions for the owner

| Item | Current state | Why it matters |
| --- | --- | --- |
| Secret scanning and push protection | Disabled | Nothing would flag or block a credential pushed later |
| Dependabot security updates | Disabled | `npm audit` is clean today, but nothing would propose a fix for a later advisory |
| `main` protection | No protection rule or ruleset | Direct and force pushes are possible for anyone with write access, and a red CI run does not block a merge |
| Personal email in commits | The owner's address is in the author metadata of every commit | It is publicly readable. Removing it means rewriting history; the repository has no forks yet. Future commits can use GitHub's noreply address |

There is no `SECURITY.md` or `CONTRIBUTING.md`, so outside contributors and vulnerability reporters have no stated process. `evals/` and the records in `docs/` are public along with the code, including their lists of known limitations.

### What was checked

| Check | Result |
| --- | --- |
| Tracked content at `ae425b0` | 333 text files, 1,742,078 bytes, no binaries, plus one submodule gitlink. No `out/`, `dist/`, `node_modules/`, environment files or `.DS_Store` |
| gitleaks 8.30.1, full history | One finding, a false positive: "stable keys" in `plan/PRD.md:800` matched its generic API key rule |
| Credential patterns, every revision | None for private keys, GitHub, AWS, OpenAI/Anthropic-style, Slack or npm tokens, or URLs with embedded credentials |
| Personal strings, every revision | No local username, home directory or email in file contents; the public GitHub handle appears in repository URLs. `/Users/a` is a test value in `tests/robustness.test.mjs`, and a since-deleted runtime report named `/private/tmp/crafted-validator`, which identifies nobody |
| Session identifiers and UUIDs, at `ae425b0` | None in any tracked file; the only match was the phrase "session identifiers" in this document |
| `npm audit` | 0 vulnerabilities in the root and skill lockfiles, including development dependencies |
| Workflow exposure | No repository secrets or variables. The workflow reads no secrets, does not use `pull_request_target`, and has read-only `contents` permission. Fork PRs from first-time contributors need approval to run |
| Public CI artifacts | 51 are downloadable. The one inspected, `package-compatibility-evidence` of run 41196061072 (272 files), contains hosted runner paths and no local ones |

Controls guarded the scans: known strings had to match first, because an earlier attempt returned false zeros when revisions were not passed separately.

**Not covered:** the other 50 CI artifacts; Actions logs, which is lower risk because no secrets are configured; ignored local files, which are not published; and legal review of the license notices. Pattern scans and gitleaks find known credential shapes, so this is not a certification that no sensitive content exists.
