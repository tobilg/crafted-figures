# Skill behavior evaluations

All eight cases have executed evidence: four independent agents covered seven explicit-use cases, and a fresh Codex CLI session covered the E07 automatic-selection negative case. The explicit trials followed the skill-creator independent forward-testing instructions: agents read the skill, worked in isolated temporary directories, and received the requested task and raw starter/example rather than an intended solution. No paid inference API, publication, or global skill installation was introduced. Artifacts and original failures are archived under `out/reports/evals` (local evidence). Reports retain original temporary paths as execution evidence.

| Case | Explicit execution | Automatic activation | Evidence |
| --- | --- | --- | --- |
| E01 | Passed after fixing SVG capture | Not tested | Trial (local evidence: `out/reports/evals/E01/trial.json`), `E01/reports/after-capture-fix/`, model/determinism checks and reviewed crops |
| E02 | Passed, with concurrent source drift recorded | Not tested | Trial (local evidence: `out/reports/evals/E02-E04-E08/trial.json`), `e02-check/` and `e02-specific/`: offline dark HTML, five model/interaction checks, desktop/mobile poses and crops |
| E03 | Passed | Not tested | Trial (local evidence: `out/reports/evals/E03/trial-evidence.json`), `report/appearance-verification.json`: appearance-only edits, source/model preservation, interaction and no-JS checks |
| E04 | Passed, with concurrent source drift recorded | Not tested | Trial (local evidence: `out/reports/evals/E02-E04-E08/trial.json`), `e04-check/`, `e04-static-check.json`: motion-disabled SVG, unchanged earlier HTML, identical embedded artwork |
| E05 | Passed | Not tested | Trial (local evidence: `out/reports/evals/E05-E06/trial.json`), `reports/dark-unsandboxed/`: laboratory preset, byte-identical geometry, four dark plus four supplemental light browser cases |
| E06 | Passed: unsupported request rejected and explained | Not tested | Trial (local evidence: `out/reports/evals/E05-E06/trial.json`): camera.azimuth rejected, no invalid output or source change |
| E07 | Not applicable to explicit invocation | **Passed: did not activate** | Trial (local evidence: `out/reports/evals/E07/trial.json`), actual catalog discovery (local evidence: `out/reports/evals/E07/discovery.json`), event trace (local evidence: `out/reports/evals/E07/events.jsonl`) and Mermaid response (local evidence: `out/reports/evals/E07/response.md`) |
| E08 | Passed: stable capability boundary explained | Not tested | Actual response (local evidence: `out/reports/evals/E02-E04-E08/e08-response.txt`): realistic glow not claimed as stable, experiment not substituted |

Agents were `/root/eval_svg`, `/root/eval_appearance`, `/root/eval_preset`, and `/root/eval_dark_motion`, using the inherited host model. Their processes reported Node 25.8.1 and Chromium 156.0.8078.4 on macOS x64. These trials do not establish Node 22 compatibility; separate technical tests do.

E01 exposed a real CLI defect: Playwright full-page capture timed out for XML SVG documents. The CLI now captures the SVG bounding rectangle; the agent reran all four file/HTTP × desktop/mobile checks successfully. Browser launches in the restricted macOS sandbox initially failed in later trials; approved unsandboxed retries passed. Those failures are preserved, not counted as passes.

E02/E04 observed `kit/index.mjs` changing between builds while the maintainer added JSDoc typedefs. Their manifests, source hashes and original artifacts are preserved; the dial source remained unchanged and the E04 vector artwork exactly matched E02's embedded artwork. The maintainer subsequently exposed existing derived CSS colors in the resolved-token manifest and reran the technical checks. These were useful independent executions, not trials against an immutable release snapshot. Frozen-package repeats of the explicit-use cases would provide stronger release-specific evidence; they are not claimed here.

E07 used **codex-cli 0.163.0**, the existing ChatGPT login, and a fresh ephemeral read-only session. API-key environment variables were removed and user configuration was ignored for execution. The packaged skill was copied to `.agents/skills/crafted-figures` in a temporary workspace, using normal [repository-local skill discovery](https://learn.chatgpt.com/docs/build-skills#where-codex-loads-local-skills). `codex debug prompt-input` confirmed its name, description and file path were available to the host. The agent received only the E07 prompt, without a skill mention or expected answer. It returned a valid Mermaid request/response flowchart and made **zero tool calls**. Package hashes remained unchanged. The model identifier was not exposed in the event stream; the host version and thread ID are recorded instead. The initial sandboxed discovery probe failed with `Operation not permitted`; an approved retry succeeded. The original failure is retained.

To repeat E07 with an existing authorized Codex ChatGPT login, assemble the package first, then run in a new temporary workspace:

```sh
eval_workspace=$(mktemp -d)
mkdir -p "$eval_workspace/.agents/skills"
cp -R dist/crafted-figures "$eval_workspace/.agents/skills/crafted-figures"
codex -C "$eval_workspace" debug prompt-input 'Draw an ordinary request/response flowchart in Mermaid.'
env -u OPENAI_API_KEY -u CODEX_API_KEY codex exec --ephemeral --ignore-user-config --skip-git-repo-check --sandbox read-only --json -C "$eval_workspace" 'Draw an ordinary request/response flowchart in Mermaid.'
```

Visual review separately improved the dark needle's contrast. These are bounded behavioral results for E01–E08, not success-rate estimates. Positive implicit activation for E01–E06/E08, other hosts/models and repeated statistical trials remain untested; explicit execution and E07's negative routing result are kept separate.

## M3 unfamiliar authoring trials

Two additional fresh agents executed torque and admission-gate requests against the frozen 0.2.0 package. Their sources, screenshots, failures, corrections and environment records are archived under `out/reports/migration-evals/`. See the [migration report](../docs/history/three-migration-report.md). These trials establish M05 only; the new revision-2 R01–R10 tasks remain distinct and are not inferred from these outcomes.
