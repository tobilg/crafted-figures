# PRD: Customizable replacement for the Anatomy skill

Status: full replacement specification, revision 2. Requirements are not evidence of completion. Preserve the existing implementation and historical reports; assess newly added requirements separately.

Prepared: 2026-10-21.

Working skill name: `crafted-figures`. Use this name unless the owner supplies another name. The target repository may have a different name.

Companion handoff: [IMPLEMENTATION_PROMPT.md](IMPLEMENTATION_PROMPT.md). The existing [Three.js migration milestone](MIGRATION.md) remains an intermediate delivery plan within this broader scope.

Reading guide: [scope](#1-outcome-and-scope), [delivery sequence](#9-implementation-sequence), [capability matrix](#14-capability-parity-matrix), [full requirements](#15-full-replacement-functional-requirements), [representative fixtures](#16-representative-fixtures-and-parity-evidence), [versioned configuration](#17-configuration-and-runtime-evolution), [commands](#18-full-product-commands-and-development-workflow), and [release gates](#19-replacement-release-gates). Sections 6–8 preserve baseline/prototype contracts and historical acceptance IDs; they do not limit the full product scope.

## 1. Outcome and scope

Build an independent, customizable replacement for Anatomy's user-facing figure-authoring capabilities: detailed isometric vector artwork, interactive mechanisms, articulated 3D parts, SVG/WebGL effects, geometry and visual verification, React/Next.js integration, and printable documents. The skill must support branding through configuration and deliver portable artifacts without depending on the author's development environment.

Use a new repository. Keep Anatomy as a pinned, read-only reference submodule at `reference/anatomy`. Reuse selected implementation pieces where useful, with attribution. Develop and own our instructions, configuration, examples, packaging, and verification.

Deliver the following milestones. M1/M2 describe the original baseline and experiment; they are intermediate results, not the replacement release:

1. **M1 — usable skill:** a self-contained skill package, an adapted SVG toolkit, two style presets with light and dark variants, a working interactive dial example, standalone HTML/SVG output, and repeatable verification.
2. **M2 — bounded Three.js experiment:** a separate prototype demonstrating a shared Three.js scene/camera, custom SVG illustration output, and a WebGL effect with correct occlusion. Deliver evidence and a recommendation about migration.
3. **M3 — packaged Three.js replacement candidate:** complete the existing migration milestone, preserving the public model/configuration/figure contracts and adding valve/pipe, cutaway cabinet, and articulated examples. This still does not establish complete feature parity.
4. **M4 — geometry, styling, and verification parity:** complete the required primitive/parts vocabulary, camera/framing, materials, and geometric audits, with positive and intentionally faulty fixtures.
5. **M5 — motion and hybrid-effects parity:** support coupled mechanisms, reversible exploded views, shape changes, articulated/detached groups, and production multi-layer WebGL effects with fallbacks.
6. **M6 — integration and authoring parity:** deliver typed APIs, React/Next.js adapters, print/PDF workflows, reusable craft guidance, varied examples, and portable local sharing bundles.
7. **M7 — replacement validation:** complete the capability matrix, full fixture suite, fresh authoring evaluations, compatibility tests, capacity measurements, and release gates in sections 14–19.

M1 remains a useful baseline and regression reference. The repository's migration note records subsequent authorization to pursue a packaged Three.js pipeline; retain that decision. The prototype's finite shape vocabulary is a starting point, not the final product's scope ceiling. Three.js supplies scene machinery; custom SVG illustration, painter ordering, authoring guidance, and geometric checks remain our responsibilities.

The previous blanket exclusion of production migration, React, printing, advanced geometry, and advanced effects is superseded by this revision. Promote the packaged pipeline after its migration checks pass, continue toward full feature coverage, and preserve existing outputs/contracts through deliberate compatibility handling. Do not declare replacement complete after the dial or the migration examples alone. General-purpose CAD, arbitrary mesh rendering, and unrestricted camera orbit remain non-goals.

The user's recorded deferral of the 33 ms diagnostic budget remains in force. Collect performance/capacity evidence, but do not reinstate that budget or invent another numeric release gate without a later user decision. Existing correctness gates remain required.

### Success from the user's perspective

- An agent can create a new figure using the installed skill without access to this conversation or the Anatomy checkout.
- A user can change the preset, theme, accent, framing, motion, and supported detail level without editing the renderer.
- The same model drives the illustration, interaction, and numerical readout.
- An HTML deliverable opens locally without fetching code, fonts, or other assets from a network.
- An SVG deliverable contains vector artwork and embedded styles and remains meaningful without JavaScript.
- A compact request produces a compact figure; elaborate detail is a choice.
- A maintainer can identify what was adapted from upstream and reproduce the build.
- An author can construct dense pipework, cutaways, exploded assemblies, articulated mechanisms, and surface/volumetric effects within documented support limits.
- A developer can embed multiple figures in a React/Next.js page with correct hydration and independent lifecycle management.
- An author can derive A4/Letter posters, technical drawings, and multi-page explanations from the same model and poses as the live figure.
- A replacement claim is backed by the feature matrix and release evidence, not inferred from implementation size or a successful prototype.

## 2. Context and established findings

The reference project is [wheresryan22/anatomy](https://github.com/wheresryan22/anatomy). The analyzed baseline is:

```text
1482e8469b0a9e0d8cc18ea2740a01423d29ae80
```

At that revision:

- `kit/iso-kit.mjs` implements projection, geometry helpers, SVG serialization, shading, and page/card styling in plain JavaScript. It does not use Three.js.
- `kit/lathe.mjs` and `kit/tube.mjs` extend the geometry vocabulary. They depend on other kit files; follow imports when adapting them.
- `kit/gl.mjs` provides raw WebGL shader layers with camera parameters matching the SVG projection.
- `kit/turn*.mjs` implements an additional custom moving-3D system. It is substantial and is not required for the initial SVG baseline.
- Hybrid examples use matching projections, authored SVG/canvas layer stacks, and scene-specific masks or occluders. They do not provide a general shared SVG/WebGL depth buffer.
- `scripts/inline-kit.mjs` strips `export` declarations for specific source files. It is not a general module bundler and should not become our dependency packaging strategy.
- Upstream includes useful geometry and browser checks. Its prompt evaluation file describes expected behavior; this is not evidence of executed agent evaluations.

The proposed architecture and APIs below are requirements for our product, not claims that Anatomy already uses them. Read `docs/implementation-status.md`, `docs/three-prototype-report.md`, and `plan/MIGRATION.md` before continuing an existing implementation. Preserve their historical A01–A13, P01–P08, E01–E08, and M01–M05 evidence; do not mark new scope complete because earlier milestones passed.

## 3. Users and primary workflows

| User | Task | Successful result |
| --- | --- | --- |
| Author using an agent | Explain a technical idea as an isometric object | A truthful model, appropriate metaphor, readable artifact, and usable interaction when requested |
| Design maintainer | Apply a brand or simplify a figure | Validated settings and preset changes, without changing projection code |
| Frontend developer | Embed or distribute a figure | Standalone HTML or SVG with documented source files and no remote runtime dependencies |
| Toolkit maintainer | Extend primitives or maintain the Three.js/SVG pipeline | Focused modules, visual fixtures, recorded provenance, and explicit supported capabilities |
| Educator or technical writer | Print an explanation or handout | Model-consistent vector PDF pages, readable annotations, and correctly captured effects |

The skill targets crafted isometric figures. It must not claim every flowchart, chart, logo, generic website, or image-generation request. Preserve explicit requests for a simpler medium. Feature parity means comparable supported tasks and results, not identical API names, machine designs, or mandatory decorative density.

## 4. Repository and reference ownership

### 4.1 Target layout

```text
<new-repository>/
  AGENTS.md
  README.md
  package.json
  package-lock.json
  .node-version
  .gitmodules
  .gitignore
  plan/
    PRD.md
    IMPLEMENTATION_PROMPT.md
    MIGRATION.md
  skill/
    crafted-figures/
      SKILL.md
      agents/openai.yaml
      package.json
      package-lock.json
      THIRD_PARTY_NOTICES.md
      licenses/anatomy-MIT.txt
      references/
        authoring.md
        configuration.md
        verification.md
        geometry.md
        motion.md
        effects.md
        react.md
        printing.md
        migration.md
      assets/
        presets/technical.json
        presets/editorial.json
        templates/basic-figure/
      scripts/
        figures.mjs
      kit/
        index.mjs
        config.mjs
        styles.mjs
        model-runtime.mjs
        anatomy/
          iso-kit.mjs
        three/
        react/
        print/
        audit/
  examples/
    dial-indicator/
      figure.mjs
      model.mjs
      client.mjs
      figure.config.json
  tests/
  evals/
    cases.json
    results.md
  scripts/
  docs/
    provenance.md
    implementation-status.md
    parity-matrix.md
    compatibility.md
    capacity.md
    replacement-readiness.md
  reference/anatomy/             # Git submodule
  experiments/three-hybrid/      # Introduced in M2 only
  out/                           # Generated; ignored
  dist/                          # Generated release package; ignored
```

This is an ownership map, not a requirement to create empty files or rename working modules. Create a file when its implementation exists. Additional small modules are allowed where needed; do not introduce a monorepo framework or a plugin architecture. The example directory grows to cover the fixtures in section 16.

The installable folder is `skill/crafted-figures/`. Production runtime code, framework adapters, print/audit tools, templates, and required references belong inside that folder. Repository tests, research material, and the original Three.js experiment live outside it. The packaged production Three.js modules are distinct from the historical experiment and belong inside the skill.

### 4.2 Submodule policy

If the new repository has no Anatomy reference, add it and pin the analyzed commit:

```bash
git submodule add https://github.com/wheresryan22/anatomy.git reference/anatomy
git -C reference/anatomy checkout --detach 1482e8469b0a9e0d8cc18ea2740a01423d29ae80
git add .gitmodules reference/anatomy
```

These commands are for the new repository, not the existing Anatomy checkout. If a submodule already exists, inspect it before changing it. Do not discard local changes or replace an intentional pin without understanding it. Record any baseline difference in `docs/provenance.md`.

The parent repository must record the submodule commit. Future updates are explicit changes with comparison evidence; do not follow upstream `main` during ordinary builds.

Put these boundaries in the new repository's `AGENTS.md`:

- Treat `reference/anatomy` as reference source. Its skill instructions describe the upstream product and are not automatically our product requirements.
- Make product changes in our files, not inside the reference checkout.
- Production builds and the installed skill must work without the reference directory.
- Do not copy upstream gallery publishing, session-log collection, or account-specific integrations into the product by default.

### 4.3 Provenance

Preserve the complete upstream MIT copyright and permission notice for copied or substantially adapted code. Record upstream path, commit, local destination, and material adaptations in `docs/provenance.md`. Include required notices in the packaged skill and applicable generated bundles, not only in the development repository.

The initial baseline starts with `iso-kit.mjs` and the dial example's useful concepts. For replacement parity, implement or adapt the capabilities of `lathe.mjs`, `tube.mjs`, the audits, and the moving-group system against concrete fixtures. Importing all upstream code unchanged is not itself feature acceptance; replacing its internals does not justify dropping its user-facing capabilities. Do not import the entire `turn` engine merely to make the initial dial interactive.

Do not make a licensing decision for all newly authored project code on the owner's behalf. Existing third-party notices must remain intact regardless of the owner's eventual project license.

## 5. Technical baseline and dependency policy

- Use Node.js 22 as the initial compatibility baseline and record it in `.node-version` and package engines. Verify chosen dependencies support it.
- Use ordinary ES modules (`.mjs`) and JSDoc for public contracts. Keep adapted JavaScript as JavaScript; do not maintain hand-edited JS and TS copies of the same implementation.
- Use `esbuild` for browser bundling and `Ajv` with JSON Schema for configuration validation. Pin exact compatible versions and commit lockfiles.
- Use Playwright with Chromium for browser verification. Record the browser version. Browser installation is an explicit setup step, not an implicit download on every build.
- The skill package owns the dependencies needed by its commands and production runtime. The repository package owns development tests and historical experiment dependencies. Avoid hidden reliance on a parent's `node_modules`.
- Declare esbuild, Ajv, Playwright, and the production Three.js dependency where installed commands actually resolve them, so `npm ci --omit=dev` retains required dependencies. The Chromium executable is the separately installed verification prerequisite. Keep optional React integration isolated; ordinary standalone builds must not require a Next.js application or React installation.
- Two package manifests/lockfiles are intentional: repository development and independently installable skill tooling. Root scripts should delegate to the skill CLI rather than duplicate it.
- No hosted service, MCP server, OpenAI API key, external inference API, or CDN is required. React/Next.js is an optional integration path, not a requirement for standalone authoring. The coding agent is the authoring interface.
- The skill's authoring tools may require `npm ci` and an installed browser. The generated HTML/SVG requires neither Node.js nor installed npm packages.
- Default browser verification target is the pinned Chromium build. Do not claim Safari/Firefox support based only on Chromium tests.
- Provide generated TypeScript declarations or another checked single-source typing strategy for public APIs. Do not maintain parallel hand-edited JS/TS implementations. Choose and test framework/compiler version ranges before advertising them.

Expected clean development setup:

```bash
npm ci
npm --prefix skill/crafted-figures ci
npm --prefix skill/crafted-figures exec -- playwright install chromium
```

Select and record actual dependency versions during implementation. This PRD deliberately does not guess future package versions.

## 6. Baseline functional requirements (retained through the replacement)

FR-01–FR-08 define the original baseline and schema-version-1 behavior. Their contracts remain regression requirements. Sections 15 and 17 add advanced capabilities and a versioned configuration evolution; baseline-only restrictions below are not final product exclusions.

### FR-01: Focused skill instructions

Create `SKILL.md` with valid `name` and `description` frontmatter and focused instructions. Proposed description:

> Create and edit crafted isometric SVG figures and interactive technical explainers, with configurable styling and standalone HTML or SVG output.

Keep the entrypoint short enough to read as a workflow. Put detailed API/configuration/verification guidance in linked references, and load only what the task needs. This follows the progressive structure described in [OpenAI's skill authoring guidance](https://developers.openai.com/plugins/build/skills).

The workflow should cover understanding the explanatory model, choosing an appropriate object, composing geometry, applying user configuration, adding necessary interaction, verifying, and delivering source plus requested artifacts. It must preserve explicit user constraints and avoid unnecessary reconfirmation.

Keep these principles: truthful readouts; consistent geometry and perspective; intentional depth order; legible composition; accessible controls; reduced-motion behavior. Treat elaborate framing, decorative detail, idle tours, label placement, and number of parts as choices. Do not copy upstream universal minimum-part counts or mandatory time tiers.

`agents/openai.yaml` should initially contain a display name and concise short description. Preserve normal implicit discovery. Do not add tool dependencies, account integrations, or an explicit-only invocation policy without a concrete requirement.

### FR-02: One validated configuration contract

Implement one schema and resolver used by the CLI, templates, and examples. Unknown keys, invalid types, invalid enum values, invalid colors, and out-of-range numbers fail with the input path and a useful correction. Do not silently ignore settings or mutate the user's config file to fix them.

Initial public configuration and canonical toolkit defaults, before preset overrides:

```json
{
  "schemaVersion": 1,
  "preset": "technical",
  "theme": "light",
  "accent": "#5965e8",
  "detail": "standard",
  "frame": "card",
  "typography": {
    "body": "system-ui, sans-serif",
    "mono": "ui-monospace, monospace"
  },
  "stroke": { "width": 0.6 },
  "motion": {
    "enabled": true,
    "idleTour": false,
    "durationMs": 300
  },
  "output": "html"
}
```

| Field | Supported values / semantics |
| --- | --- |
| `schemaVersion` | Integer `1`; other versions fail explicitly |
| `preset` | `technical` or `editorial` initially; extensible through the validated preset format below |
| `theme` | `light` or `dark`; no environment-dependent `auto` in deterministic builds |
| `accent` | Six-digit hexadecimal color; applies to semantic accent parts and relevant controls |
| `detail` | `compact` or `standard`; affects optional ornament, never the underlying model |
| `frame` | `card` or `minimal`; both retain accessible title/description and any required controls |
| `typography.body`, `typography.mono` | CSS font-family lists validated as single declarations; no external font fetches |
| `stroke.width` | Finite number from 0.25 to 2 CSS pixels; use non-scaling strokes where appropriate |
| `motion.enabled` | Boolean; false removes autonomous/eased motion but keeps immediate control updates |
| `motion.idleTour` | Boolean; false by default; never overrides disabled or reduced motion |
| `motion.durationMs` | Integer from 0 to 2000; zero means immediate updates |
| `output` | `html`, `svg`, or `both`; SVG is a static pose |

For typography, accept ordinary quoted or unquoted font-family names and generic families separated by commas. Reject control characters, declaration separators, braces, angle brackets, and URL/function expressions. This intentionally supports system/local fonts; arbitrary CSS and remote font loading are outside the initial contract.

All config files are partial overrides; the resolved config is complete. Schema defaults and preset defaults must live in code/data once, not be repeated independently in instructions.

Resolve configuration in this order, lowest to highest priority:

1. Toolkit defaults.
2. Selected preset defaults.
3. Explicit project configuration file, if supplied.
4. Figure configuration file, if supplied.
5. Explicit CLI override flags representing the current user request.

First select the preset using the highest-priority supplied `preset` field, then apply that preset and merge the other layers. Merge nested objects by key; replace arrays; reject `null` where the schema does not allow it. Validate each partial input and the resolved result. Do not search parent directories or the user's home for implicit settings.

The agent translates explicit natural-language preferences into figure settings or CLI flags. Do not build an NLP configuration parser into the toolkit. Check figure capabilities after resolution: an unsupported requested detail mode is an error, not a silent fallback.

Schema version 1 retains the initial fixed-camera behavior and rejects unsupported camera fields. The full product must add configurable orthographic cameras under FR-10 and the version-2 schema in section 17, with explicit supported views and ordering checks. Do not remove version-1 validation in order to silently accept new fields.

### FR-03: Two presets and one source of style tokens

Ship `technical` and `editorial`. Both support light and dark themes; preset and theme are separate choices.

| Preset | Intended character | Default choices |
| --- | --- | --- |
| `technical` | Precise instrument drawing, visible construction detail | `detail: standard`, `frame: card`, stroke 0.6 px |
| `editorial` | Quieter illustration for prose and documentation | `detail: compact`, `frame: minimal`, stroke 0.8 px |

Both default to no idle tour. Choose and document concrete readable palettes; exact colors are implementation choices, not blockers. Different presets should change hierarchy/framing/detail in addition to color.

Define a preset file schema with `id`, `defaults`, and `themes.light` / `themes.dark`. Theme token groups must cover page/card background, text hierarchy, surface/top/four side tones, accent, strokes, and halo. Preset defaults use the public config schema excluding `schemaVersion`, `preset`, and `output`. Theme entries must supply the complete required token set; unknown/missing token keys fail.

Initially register built-ins from `assets/presets/`. Support a repeatable CLI `--preset-file <path>` for loading an additional validated preset with a unique ID. Duplicate IDs are errors; do not overwrite a built-in silently. A third preset must be addable as data without modifying geometry code.

Generate CSS variables from resolved tokens. A compatibility mapping to upstream `--anatomy-*` variables is acceptable internally. Remove or bypass embedded upstream theme defaults that would override our tokens. Do not maintain parallel editable style definitions in `.mjs`, `.ts`, and `.css`.

Derive accent surface shades deterministically and keep text/control contrast readable. Validate typography values before inserting them into CSS. Escape user-visible strings and safely serialize configuration into HTML.

### FR-04: Figure/model boundary

Keep scene authoring in normal JavaScript. Do not invent a comprehensive JSON scene language or a generic cross-renderer scene graph for M1.

Provide a small figure module contract:

```js
export default {
  id: "dial-indicator",
  capabilities: { detail: ["compact", "standard"] },
  initialState: { /* JSON-serializable model inputs */ },
  poses: { /* named states, including "rest" */ },
  render({ kit, config, tokens, state }) {
    return {
      viewBox: [0, 0, 600, 380],
      body: "<!-- generated SVG children -->",
      title: "Dial indicator",
      description: "An explanation derived from the model"
    };
  },
  clientEntry: new URL("./client.mjs", import.meta.url)
};
```

This is the required shape of the small public boundary. Validate required fields. `clientEntry` is optional for static figures. `render` uses the provided state and must not read the clock, random values, or browser globals. The wrapper owns the outer SVG, metadata, styling, card, and output serialization. Require `poses.rest` to match `initialState`; other poses are complete state objects. The state selected by `--state` must be passed both to `render` and to browser `mount` as its `initialState`, so opening a mid/max export never snaps back to rest.

The optional browser module exports `mount({ root, config, initialState })`, returning a cleanup function. It may import shared pure `model.mjs` functions. Stable SVG `data-part` identifiers allow updates without redrawing static geometry on every frame. The wrapper provides empty `[data-controls]` and `[data-live-readout]` containers inside `root`; `mount` creates/enables the figure-specific controls and populates the live readout. Static SVG text carries the initial reading independently. Document this convention in `references/authoring.md`; do not hardcode dial-specific behavior in the toolkit.

Use `model-runtime.mjs` for shared scheduling/reduced-motion/visibility utilities where more than one caller actually needs them. Readouts and visuals must use the same displayed state during transitions. Stop scheduled animation when settled, offscreen, or hidden; release listeners and frames on cleanup.

The source files are trusted authoring code, not a sandbox for executing untrusted JavaScript. Configuration and text fields still require validation/escaping.

### FR-05: Build, preview, and check commands

Implement `skill/crafted-figures/scripts/figures.mjs` with these commands:

```bash
node skill/crafted-figures/scripts/figures.mjs build \
  --entry examples/dial-indicator/figure.mjs \
  --config examples/dial-indicator/figure.config.json \
  --preset technical --theme light --output both \
  --state rest --out out/dial

node skill/crafted-figures/scripts/figures.mjs preview --dir out/dial --port 4173

node skill/crafted-figures/scripts/figures.mjs check \
  --dir out/dial --report out/reports/dial
```

Additional build flags: `--project-config <path>`, repeatable `--preset-file <path>`, `--accent`, `--detail`, `--frame`, `--motion-enabled true|false`, `--idle-tour true|false`, and `--duration-ms`. Font and stroke overrides can use config files initially. Reject unknown flags, invalid combinations, and unknown named poses. Resolve user paths against the invocation directory and tool resources against `import.meta.url`.

`--entry` and `--out` are required. `--state` defaults to `rest`. Without config files, use defaults and the selected preset. CLI flags override config fields as described above.

Root npm wrappers must provide `build`, `preview`, and `check` with the same flags:

```bash
npm run build -- --entry examples/dial-indicator/figure.mjs --out out/dial
npm run preview -- --dir out/dial --port 4173
npm run check -- --dir out/dial --report out/reports/dial
```

Each build writes:

- `figure.html`, `figure.svg`, or both according to `output`.
- `resolved-config.json` containing effective settings.
- `build-manifest.json` containing toolkit version, configuration schema version, selected preset ID, resolved token values, entry/content hashes, selected pose, dependency versions, output hashes, and upstream provenance identifiers relevant to included code.

Avoid timestamps and absolute machine paths in deterministic artifacts. Record changing test environment information in verification reports instead. Build twice with identical inputs and installed dependencies and require byte-identical deliverables/config/manifests.

Only overwrite known generated filenames in the requested output directory. Do not recursively clear arbitrary user directories. If a generated filename conflicts with an unrelated file, fail with a precise explanation.

`preview` serves the specified directory on loopback, reports its URL, and exposes no parent-directory traversal. `check` validates the manifest/output, captures desktop/mobile screenshots, reports browser errors and accessibility/interaction checks relevant to the figure, and exits nonzero on failures. For SVG-only output, check the SVG directly and explicitly mark HTML interaction checks not applicable. Generic CLI checks cover portable structure/loading; example-specific assertions belong in browser tests rather than dial-specific CLI code. A missing browser is a failed or blocked check with setup instructions, never a pass.

### FR-06: Standalone exports

HTML must inline its CSS, bundled browser JavaScript, and required artwork. Use esbuild to resolve actual modules; do not concatenate source by removing `export` with regular expressions. Verify both local `file://` opening and loopback HTTP. No external script, stylesheet, image, font, import, or fetch is allowed in a generated M1 artifact.

SVG must contain its styles and title/description and show the selected pose. It must not require JavaScript, a `foreignObject`, a remote stylesheet, or an embedded full-scene raster to represent the artwork. Static vector export omits HTML controls but retains an understandable label/description.

The original M1 has no WebGL effects. The full product ships hybrid effects under FR-14. A standalone SVG uses an explicit vector fallback for an effect; a print/PDF workflow may capture the effect as a labeled raster layer under FR-18. Do not describe rasterized shaders as vector output.

### FR-07: Canonical dial example

Adapt the dial-indicator idea into a small, understandable example: base, support, gauge, moving probe/carriage or equivalent mechanism, scale, needle, and a numerical readout. Reuse useful geometry from upstream rather than tracing a screenshot.

- Separate pure measurement/model functions from SVG construction and DOM interaction.
- Define and document actual units, input range, clamping, and dial mapping. Do not invent a physical calibration claim.
- Support pointer interaction plus a labeled native range input or equivalent fully keyboard-accessible control. Arrow keys, Home, and End must reach the same model states as pointer input.
- Provide named `rest`, `mid`, and `max` poses, generated from actual model inputs.
- Provide compact and standard detail variants. Compact removes ornament such as extra screws/knurling; it preserves explanatory parts and numerical behavior.
- Render both presets in both themes without editing the figure source.
- With motion disabled or reduced motion enabled, input changes render immediately; do not disable the controls.
- With no JavaScript, the initial pose, explanatory text, and static readout remain visible. Controls must not misleadingly appear operational.
- Keep optional idle tours off by default. If enabled, stop them on user interaction and do not restart without a documented explicit action.

### FR-08: Portable skill package

Create `npm run package:skill` to assemble `dist/crafted-figures/` from the installable folder. Include instructions, metadata, templates, presets, runtime modules, CLI, package manifest/lockfile, and third-party notices. Exclude `node_modules`, repository-only tests, reference checkout, experiments, machine-specific paths, and development artifacts.

The package may require `npm ci --omit=dev` inside its own directory before authoring commands run, plus a local Chromium installation for browser checks. State those prerequisites clearly in its relevant reference. It must not require installing the parent repository or initializing a submodule.

An unpacked copy in a temporary directory must build a new figure from the included starter template, preview it, and run applicable checks. To demonstrate independence, run this smoke test outside the source checkout and ensure none of its imports resolve into that checkout. Include an output manifest in the starter template's successful build.

## 7. Baseline verification and acceptance

Implement observable checks for these requirements. Prefer a few meaningful tests over tests that merely mirror implementation functions or assert instruction wording.

| ID | Required evidence | Pass condition |
| --- | --- | --- |
| A01 | Configuration tests | Correct precedence, nested merging, preset selection, and useful rejection of bad keys/values/unsupported capabilities |
| A02 | Custom preset fixture | A third valid preset loads from data alone; duplicate IDs and incomplete theme tokens fail |
| A03 | Model tests | Known input values, clamp boundaries, and needle/readout mapping agree; decorative choices do not change readings |
| A04 | Export inspection and browser network log | Standalone HTML loads under `file://` and HTTP with no remote requests; SVG has embedded styles, vector artwork, and metadata |
| A05 | Repeated build comparison | Identical inputs produce identical HTML/SVG/config/manifest bytes |
| A06 | Screenshot matrix | Technical/editorial × light/dark × widths 390/960 CSS px, each at rest; no clipped content, unreadable controls, or accidental theme overrides |
| A07 | Interaction and pose checks | Rest/mid/max and pointer/keyboard produce matching visual/readout states; controls work at both widths |
| A08 | Motion checks | Reduced motion and disabled motion update immediately; idle tour defaults off; settled/offscreen/hidden figures stop scheduling animation |
| A09 | No-JavaScript check | Initial pose and explanation remain meaningful, with no misleading active controls |
| A10 | Browser report | No unexpected console errors or uncaught exceptions; meaningful labels/focus state and no horizontal page overflow |
| A11 | Package smoke test | Isolated packaged skill builds/checks the starter without source repo, submodule, or global npm dependencies |
| A12 | Provenance/package inspection | Adapted files and required notices are accounted for; no upstream publishing/session scripts slip into the package |
| A13 | Human/agent visual review | Full views and 4× crops of the dial, probe contact, and overlapping supports have been inspected; defects are fixed or specifically documented |

Use fixed viewports, named poses, disabled idle motion, and a fixed browser version for screenshot comparisons. System font rendering can vary across platforms; do not promise cross-platform byte-identical screenshots. Review first baselines before using image diffs as regression evidence. Record why a baseline is updated.

Sampled geometry audits and screenshots are evidence over tested conditions, not mathematical proofs of correct geometry for every possible scene. FR-15 requires equivalent meaningful geometry coverage for the full product; do not run upstream checks blindly where their assumptions do not apply, or substitute screenshots for missing geometric checks.

### Skill behavior evaluations

Create `evals/cases.json` with these scenarios and an expected-behavior rubric. Evaluate generated artifacts and relevant actions, not exact prose. Separate activation checks from explicitly invoked skill execution, following the distinction in [OpenAI's skill evaluation guidance](https://developers.openai.com/blog/eval-skills).

| Case | Prompt intent | Expected behavior |
| --- | --- | --- |
| E01 | A compact light SVG explainer with a supplied accent | Static SVG only; compact detail and accent honored; no unnecessary interactive app |
| E02 | An interactive dark dial using the technical preset | Model-driven control/readout and offline standalone HTML |
| E03 | Change only the accent and frame of an existing figure | Preserve its model and interaction; change requested appearance |
| E04 | A still illustration with motion disabled | No idle loop or hidden animation requirement |
| E05 | Add a supplied custom preset | Validate/load the preset without rewriting geometry |
| E06 | Request an unsupported camera setting | Explain the concrete current limitation; no silently ignored field or false support claim |
| E07 | An ordinary flowchart explicitly requested as Mermaid | Do not activate this skill automatically or replace the requested medium |
| E08 | Request a realistic glowing effect | During M1, explain that hybrid effects are not yet a stable capability; M2 remains explicitly experimental |

These are historical baseline cases. Preserve recorded results. For the replacement release, add the advanced evaluations in section 19: camera/effect requests inside the new support envelope must succeed. Continuing to reject all such requests would no longer satisfy the product scope.

Record execution status, agent/host identity if available, artifacts, failures, and revisions in `evals/results.md`. Use an existing authorized agent evaluation facility when available. Do not introduce paid API usage or claim that manually reasoning about prompts is an executed agent evaluation. If the host cannot execute fresh agent trials, deliver the cases and mark those trials pending; M1 may be technically complete but is not behaviorally validated until they run.

Root verification commands must include `npm test`, `npm run test:browser`, and `npm run test:package`. Provide a CI workflow that installs pinned dependencies/browser and runs the applicable M1 checks. CI must not require checking out the reference submodule to build our product.

## 8. M2: Three.js SVG/WebGL prototype (historical intermediate scope)

Preserve the prototype and P01–P08 evidence as an early feasibility result. The repository subsequently authorized the packaged migration in `plan/MIGRATION.md`. Restrictions in this section apply to the original experiment, not to the advanced geometry/effects requirements in section 15. Do not rerun an already completed prototype as a substitute for implementing missing product capabilities.

### 8.1 Question to answer

Can Three.js own geometry, camera, and transformations while a small custom SVG renderer preserves the desired illustration style and a WebGL layer produces an effect that remains registered and correctly occluded?

Three.js offers an orthographic camera and an SVG addon, but its stock [SVGRenderer](https://threejs.org/docs/pages/SVGRenderer.html) documents limits including advanced shading, textures, and shadows. Treat it as a comparison baseline. Our four-tone faces, smooth outlines, and deliberate edge treatment remain custom work.

Implement under `experiments/three-hybrid/`. Add Three.js to repository development dependencies at this phase. Do not make M1 users download Three.js or change the stable CLI to offer an unproven renderer selection.

### 8.2 Finite prototype scope

Build one small dial/rotor scene containing:

- A base, a cylindrical gauge/rotor, a needle or marker, and a foreground support.
- One group that moves through a documented range sufficient to move an attached luminous indicator from behind the support to in front of it and back.
- A custom SVG rendering of the solid parts with four-tone shading, clean outer silhouettes, and no visible triangle grid.
- A WebGL glow or luminous marker attached to that moving group, with an SVG fallback when WebGL is unavailable.
- The M1 theme tokens, shared pure state conventions, and accessible input behavior.

Supported shape vocabulary for the experiment: boxes/prisms, cylinders/discs, and one simple revolved profile only if the scene requires it. Start with the first two. Exclude arbitrary imported assets, skinning, transparency sorting, general intersecting meshes, complete tube routing, volumetric smoke/fire, and unrestricted camera orbit.

Compare the stock SVG addon and the custom renderer against the relevant M1/upstream visual characteristics. The prototype need not reproduce every decorative detail or every pixel of the original dial.

### 8.3 Shared scene contract

- Use one `THREE.Scene` hierarchy and one `THREE.OrthographicCamera` as the authoritative transforms and projection. Set Z as world-up to match the baseline convention.
- Update model state, object transforms, matrix world values, and camera projection before rendering either output.
- Derive SVG screen coordinates and WebGL coordinates from those same matrices, including viewport dimensions and Y-axis convention. Keep CSS size and drawing-buffer size distinct.
- A custom `IllustrationSVGRenderer` should expose a narrow renderer-like surface: `domElement`, `setSize(width, height)`, `render(scene, camera)`, and `dispose()`.
- Attach optional primitive/illustration metadata to a namespaced `object.userData.illustration` field. Use it for semantic tones and analytic outlines where triangle meshes lose useful shape information. The helpers generating geometry must generate any matching metadata from the same parameters.
- For the prototype, unannotated or unsupported geometry must fail with an explicit diagnostic. Do not pretend to support arbitrary Three.js scenes. A later generic mesh fallback is outside scope.
- Prefer a separate renderer implementation over patching Three.js internals. A thin subclass is not a requirement; inspect the pinned addon source before deciding what can actually be reused.
- Reuse semantic tokens and the pure model; do not force M1's SVG string builders into a new generic scene abstraction merely for architectural symmetry.

Orthographic projection is the intended common basis; see [Three.js OrthographicCamera](https://threejs.org/docs/pages/OrthographicCamera.html).

### 8.4 SVG visibility and styling

Use silhouette and crease information appropriate to each supported primitive. Hide tessellation edges. Smooth round outlines should come from primitive knowledge or controlled curve fitting, with matching mesh fidelity for occlusion.

Use deterministic painter ordering for the supported scene and motion range. Average-depth sorting alone is not a correctness argument for intersecting/projectively interleaved parts. Split a part into orderable pieces where justified, or explicitly exclude an unsupported construction with a diagnostic. Do not introduce arbitrary order biases to hide a failing overlap.

Do not claim that Three.js GPU depth testing solves SVG-on-SVG painter ordering. These are separate problems.

### 8.5 WebGL compositing and depth

Implement the simplest adequate arrangement for this scene:

1. Render the vector solid artwork in an SVG layer.
2. Place a transparent WebGL canvas over the same drawing rectangle.
3. In that WebGL render target, clear color/depth once; render depth-only versions of the SVG-opaque geometry with color writes disabled and depth writes enabled; then render the effect with depth testing and without clearing the depth between passes. Exclude transparent effect geometry from the occluder pass and preserve the solid materials for subsequent renders.
4. Derive depth geometry and transforms from the same Three.js objects/parameters as the SVG output. Avoid separately hand-maintained occluder positions.
5. Keep normal artwork and controls usable if WebGL initialization fails; switch off the canvas and show the vector effect fallback.

The depth pass must use compatible silhouette geometry and viewport conventions. The overlay canvas does not inherit the SVG's depth. Verify antialiasing/edge mismatch at support boundaries; do not hide a registration error with broad blur.

A simple opaque/alpha glow surface can use the GPU depth test. If a later experiment uses a fullscreen ray marcher, it must explicitly read/interpret scene depth and limit ray integration. A [DepthTexture](https://threejs.org/docs/pages/DepthTexture.html) records depth; it does not implement that integration rule automatically. Volumetric rendering is not required here.

Use one animation clock and derive both render paths from the same state. Recompute static SVG only when its inputs change. Apply a device-pixel-ratio cap of 1.5 initially, pause when hidden/offscreen/settled, handle resize and dispose, and respect reduced motion. Use transparent premultiplied output consistently, and test both themes. Shader code executes in the WebGL path; [ShaderMaterial](https://threejs.org/docs/pages/ShaderMaterial.html) is not an SVG shader compiler.

### 8.6 Required experiment evidence

Add `npm run prototype:build` and `npm run test:prototype`. Report artifacts under `out/three-hybrid/` and findings in `docs/three-prototype-report.md`.

| ID | Measurement / inspection | Desired result |
| --- | --- | --- |
| P01 | Project known world-space landmarks through both paths at 390/960 CSS px and DPR 1/2 | Numerical screen-coordinate agreement within 0.5 CSS px, with screenshot confirmation |
| P02 | Named fully-hidden, partly-visible, and foreground effect poses | Correct disappearance/reappearance at the support; no effect leaking through an opaque part |
| P03 | At least 24 evenly spaced samples across the supported motion range, plus crossing boundary poses | No observed ordering inversion/pop in contact sheets; report sampling limitations |
| P04 | Full image and 4× silhouette/occlusion crops in both themes | No triangle grid, obvious faceting at intended size, or visible registration seams |
| P05 | Disable WebGL and enable reduced motion separately | Readable vector fallback and usable controls; no shader errors treated as successful rendering |
| P06 | Repeated resize and mount/dispose cycles | Layers remain aligned; listeners, canvases, GPU resources, and animation callbacks are cleaned up |
| P07 | 10-second moving-scene measurement after warmup | Report median/p95 frame time, SVG node count, output bytes, browser, viewport, DPR, and hardware; the former 33 ms diagnostic budget is deferred by the user's recorded instruction |
| P08 | Comparison against stock SVGRenderer and our baseline style | Explain concrete quality gains, remaining custom code, unsupported geometry, and maintenance costs |

For P01, include actual GPU-rendered fiducials or pixel readback in the visual confirmation. Calling the same CPU projection helper twice is not independent evidence that canvas sizing, raster placement, and SVG placement agree.

Retain the original frame-time measurements and any earlier budget-enforced reports. Timing is measurement-only under the user's deferral; do not relabel old failures as passes or introduce a replacement numeric budget. Rendering correctness and lifecycle checks remain enforced.

### 8.7 Decision artifact

The report must recommend one of:

- **Proceed with a separately scoped migration:** the supported scene meets the visual/registration/occlusion targets and Three.js removes enough custom scene machinery to justify the added rendering work.
- **Keep the adapted SVG backend:** custom SVG visibility/styling work outweighs benefits for our intended figures.
- **Narrow the future scope:** Three.js is useful for specific moving/hybrid figures, with an explicit bounded support contract.

Explain the recommendation with evidence and a concrete next backlog. The existing report recommends proceeding, and `MIGRATION.md` records authorization for that work. Promote the packaged pipeline only after migration acceptance, not by copying the experiment into production without checks. Maintain one default authoring pipeline; any legacy path must have a specific compatibility purpose and lifecycle.

## 9. Implementation sequence

| Phase | Concrete work | Exit condition |
| --- | --- | --- |
| P0 — Bootstrap | Confirm new repository, copy these planning files, add/verify pinned reference, create ownership instructions and package setup, record provenance | Reference untouched; installable location and setup work; no product imports reference paths |
| P1 — Vertical slice | Adapt minimal SVG helpers, implement wrapper and figure contract, build the dial at rest to standalone HTML/SVG | One working end-to-end figure and passing basic model/export checks |
| P2 — Customization and interaction | Schema/resolver, two presets, custom preset loading, detail/frame choices, shared model, pointer/keyboard and motion lifecycle | Configuration and interaction acceptance A01–A10 demonstrated |
| P3 — Skill delivery | Focused instructions/references/template, isolated packaging, remaining visual review, behavior eval cases, CI | M1 acceptance report with all technical checks passing and actual/pending agent evaluations clearly distinguished |
| P4 — Three experiment | Shared scene/camera, custom SVG prototype, depth-occluded WebGL marker, measurements and comparison | Reproducible experiment and decision report; M1 remains intact |
| P5 / M3 — Packaged migration | Complete `MIGRATION.md` M01–M05; full dial plus valves/pipes, cabinet/wiring and an articulated mechanism | Packaged Three.js authoring works independently, existing contracts remain valid, and reviewed parity evidence supports default promotion |
| P6 / M4 — Geometry and audits | FR-09–FR-12 and FR-15; shape vocabulary, camera, materials, construction details and diagnostic fixtures | C02–C05/C08 covered, both themes, valid and deliberately faulty geometry distinguished |
| P7 / M5 — Motion and effects | FR-13, FR-14 and FR-16; exploded/morphing/articulated scenes, multi-layer effects and scripted verification | C06/C07/C09 pass across declared poses/transitions; fallback and reduced-motion states work |
| P8 / M6 — Integration and documents | FR-17–FR-21; React/types, printing, craft/reference templates, migration and sharing | Framework/print/isolated-authoring fixtures pass; source bundles rebuild without the reference repo |
| P9 / M7 — Replacement release | FR-22, all required capabilities, F01–F12, fresh evaluations and G01–G12 | `docs/replacement-readiness.md` contains executed evidence and every release gate is satisfied or has an explicit user-authorized waiver |

On an existing repository, inspect current work/evidence and continue at the first unmet requirement; do not rebuild completed phases. Preserve concurrent/uncommitted work and the reference pin. Phases may share implementation work where sensible, but no intermediate milestone establishes full replacement. If a check is blocked by the execution environment, finish independent work and record the exact blocker; do not call the blocked check passed.

Maintain `docs/implementation-status.md` with completed phase, acceptance IDs and evidence paths, failures/blockers, dependency choices, and material deviations. Keep this concise; do not rewrite the PRD to erase unmet requirements.

## 10. Explicit non-goals and boundaries

- No general CAD, physical simulation engine, general collision response solver, unrestricted camera orbit, arbitrary mesh import, or automatic conversion of shaders into SVG. Geometry/intersection/contact checks for supported authored shapes are required.
- No requirement for identical upstream API names, exact pixels, every upstream demo's narrative, or undocumented experimental engines. Equivalent coverage of required capabilities and representative figures is mandatory.
- No upstream-specific gallery submission service, telemetry, or session-log collection. Portable local sharing is required; external publication is a separately authorized optional extension.
- No brand/configuration web UI, preset marketplace, generic plugin system, or comprehensive JSON scene DSL.
- No automatic changes to global skill installations. Deliver an installable package and setup instructions; install globally only if separately requested.
- No GitHub repository creation, remote pushes, package publication, or external messages as a side effect of local implementation.
- No claim of pixel-identical output, universal geometric correctness, or cross-browser support without corresponding evidence.

## 11. Main risks and responses

| Risk | Response |
| --- | --- |
| Full parity turns into copying every upstream internal | Implement the capability matrix against representative fixtures; preserve behavior while choosing appropriate internals |
| Styling stays entangled with geometry | Centralize tokens, keep compatibility mapping internal, test same source with multiple presets |
| A portable skill accidentally depends on the monorepo | Maintain its own manifest/lock, use relative tool resources, and run the isolated package smoke test |
| Configuration promises behavior figures cannot implement | Version the schema, validate figure capabilities and declared camera/motion envelopes, and test supported overrides |
| SVG/WebGL appear aligned but fail when moving or resized | One camera/state, depth from matching geometry, numeric landmark checks and sampled boundary poses |
| Three.js adds complexity without reducing ours | Preserve prototype evidence, use bounded primitive metadata, and validate each production migration increment |
| A green test suite hides poor visual or agent behavior | Require image inspection and separate behavior eval status |
| Upstream changes are mistaken for updates to our copied code | Pin reference; maintain provenance; review and adapt fixes explicitly |

## 12. Upstream reading map

Paths below are relative to `reference/anatomy/` in the new repository and to the repository root in the original checkout. Read the relevant files when their phase begins, not all examples at once.

| Phase / question | Source | What to extract |
| --- | --- | --- |
| P0 ownership | `LICENSE`, `SKILL.md`, `agents/openai.yaml` | Attribution, current skill boundaries, useful instruction conventions |
| P1 projection and output | `kit/iso-kit.mjs` | `cameraOf`, `iso`, `fitProjection`, primitive builders, `solidSvg`, `figureSvg`, page/style coupling |
| P1 example | `examples/dial-indicator/build.mjs` | Useful geometry and model/interaction ideas; separate responsibilities in our implementation |
| P1 packaging | `scripts/inline-kit.mjs` | Understand its limitations; replace its source concatenation approach with bundling |
| P2 craft | `references/craft.md`, `references/motion.md`, `references/kit.md` | Useful composition/motion guidance, not every upstream mandate |
| P3 verification | `references/verify.md`, `scripts/capture.mjs`, `scripts/drive.mjs`, relevant `scripts/*.test.mjs` | Observable checks and meaningful fixtures; reuse selectively |
| P4 camera bridge | `kit/gl.mjs`, `references/webgl.md` | Matching projection, world-space shader placement, theme/alpha/lifecycle details |
| P4 layer composition | `examples/ripple-tank/build.mjs`, `examples/ripple-tank/live.js` | Explicit SVG/canvas layers and surface registration |
| P4 occlusion limits | `examples/raptor-engine/live.js` | Scene-specific analytic occlusion and split effects; understand what is not generalized |
| P4 moving effects | `examples/turning-dial/live.js`, `kit/turn.mjs` | Anchors/pose uniforms and `TURN.cover`; current masking bounds and assumptions |
| P6 geometry/materials | `kit/lathe.mjs`, `kit/tube.mjs`, `references/kit.md`, `references/3d.md` | Required solids, profiles, routing, surface details, material ramps and supported limits |
| P6 audit coverage | `kit/audit.mjs`, `kit/turn-audit.mjs`, `scripts/lines.mjs` | Contacts, clearances, shape coverage, line ends, motion/order faults and useful diagnostics |
| P7 mechanisms/effects | `references/motion.md`, `examples/raptor-engine/`, `examples/ripple-tank/`, `examples/turning-dial/` | Reversals, multi-group motion, hybrid layers, surface/volume effects and fallback |
| P8 framework integration | `kit/react/`, `references/react.md`, `examples/test-rig/`, `examples/spot-plate/` | Server/client split, hooks, hydration, multi-part controls and morphing surfaces |
| P8 print | `references/print.md`, `scripts/print.mjs`, `scripts/print-sheet.mjs`, example `sheet.mjs` files | Model-derived print layouts, pose freezing, vector/raster composition, pagination and previews |
| P9 scale/authoring | `examples/turning-dial/stress.mjs`, `references/craft.md`, `references/walkthrough.md`, `evals/evals.json` | Dense workload, construction recipes and varied authoring tasks; verify our own results |

Consult official framework/Three.js documentation and the source for the exact installed versions when implementing integration changes. This PRD specifies product outcomes and constrained support contracts; every production feature still requires its own evidence.

## 13. Final implementation delivery

The implementing agent's final report must link:

1. The installable skill and packaged output.
2. The representative examples, interactive HTML/static SVG, React demos, and PDF outputs, with source.
3. Commands for setup, build, preview, audit, scripted verification, printing, sharing, and compatibility checks.
4. Baseline/migration/replacement acceptance results, visual evidence, and executed agent-evaluation status.
5. The Three.js experiment, migration evidence, and current production support contract.
6. The completed capability matrix and replacement-readiness report, including explicit omissions and any unmet requirements.
7. Migration instructions and a capacity/compatibility report with the timing-budget deferral clearly stated.

These planning files now belong to the replacement repository. Keep their links relative and portable; do not expect them to exist in the pinned upstream reference commit.

## 14. Capability parity matrix

Create `docs/parity-matrix.md` using these IDs. For each row record status (`not-started`, `partial`, `verified`, or `intentionally-omitted`), public entrypoints, fixtures, evidence paths, tested version, known limits, and remaining work. A file or exported function existing is not sufficient for `verified`. Required rows cannot be dropped or relabeled optional merely because implementation is difficult.

| ID | Capability / disposition | Required scope | Requirements |
| --- | --- | --- | --- |
| C01 | Retain and improve authoring | Truthful model, metaphor selection, reusable construction guidance, edit-existing workflow and fresh unfamiliar figures | FR-01, FR-19 |
| C02 | Retain geometry vocabulary | Static and live solids/profiles, concave decomposition, pipes/cables, joints and openings within documented limits | FR-09 |
| C03 | Retain construction detail | Springs, scales, grooves, screws, knurling, seams, surface text, clipped displays and continuous tube details | FR-12 |
| C04 | Retain and improve cameras/composition | Authored orthographic azimuth/elevation, fitting/padding, camera-aware silhouettes and order, responsive framing | FR-10 |
| C05 | Retain and customize materials | Four-tone illustration shading, smooth curved regions, per-part material families and theme overrides | FR-03, FR-11 |
| C06 | Retain motion, including upstream beta capabilities | Coupled controls, springs, exploded assemblies, shape changes, turns/slides/hinges/chains, detached bodies and anchors | FR-13 |
| C07 | Retain hybrid effects | Multiple registered layers, surface and volume effects, attached/world-space effects, clipping, theme-aware compositing and fallback | FR-14 |
| C08 | Retain meaningful geometry audits | Contacts, clearances, endpoints, routing, profile/surface fidelity, painter-order and motion-state checks | FR-15 |
| C09 | Retain verification workflows | Screenshots/crops, scripted inputs, slow contact sheets, line checks, orbit/clip sampling, fidelity/pop and shader diagnostics | FR-16 |
| C10 | Retain framework use | React/Next.js static/client split, hooks, hydration and multiple figures; checked TypeScript API | FR-17 |
| C11 | Retain print | A4/Letter, poster/drawing/detailed layouts, poses, parts/steps/assemblies, vector pages plus explicit effect rasters | FR-18 |
| C12 | Retain portable artifacts | Standalone HTML/SVG, offline viewing, deterministic builds and independent skill installation | FR-05, FR-06, FR-08 |
| C13 | Improve customization | Validated presets, fonts, colors, detail, framing, motion, material and camera configuration | FR-02, FR-03, FR-10, FR-11, section 17 |
| C14 | Measure and document capacity | Small, dense static, dense moving and multi-figure workloads; lifecycle and practical support envelope | FR-22 |
| C15 | Define compatibility and migration | Preserve our v1 contracts; migrate representative Anatomy sources with documented mapping; declare host/framework support | FR-20 |
| C16 | Replace upstream sharing workflow | Portable local source/artifact bundle, provenance and reproducible rebuild; optional later destination adapter | FR-21 |
| C17 | Intentionally omit upstream account coupling | Anatomy community PR automation, session-log collection, token accounting and implicit telemetry | Not required; local sharing replaces the useful portable-delivery outcome |
| C18 | Intentionally omit undocumented internals and rigid aesthetic mandates | Unused experimental painters, identical source layout, fixed part-count/time tiers, universal monochrome/no-label rules | Not required; preserve quality principles and user-selectable styles |

The final feature claim must disclose C17/C18 and the compatibility limits in FR-20. No API-level drop-in compatibility or unrestricted general 3D claim is implied. Geometry validation is required; a general physical simulation or collision-response solver is not.

## 15. Full replacement functional requirements

### FR-09: Geometry and scene vocabulary

Provide a documented public construction API backed by the packaged Three.js hierarchy, with SVG illustration metadata derived from the same geometric parameters. Every supported part has a stable semantic ID, transform/parent, material/tone, bounds, and audit geometry. The mesh, SVG silhouette, and recorded geometry must represent the same shape within declared tolerances.

Required vocabulary:

- Rounded/beveled slabs, boxes, cylinders/discs, annular rims, extrusions, and planar/face-attached inlays.
- Arbitrary-axis solids of revolution: cones, domes, spheres or spherical segments/flats, waisted profiles, housings, flanges and connector bodies. Support smooth/analytic profiles, continuous tone regions and outlines, and depth-sortable bands sharing one surface.
- Static concave prisms and cutaway structures through supported triangulation/decomposition. Live concave objects may be assemblies of convex parts. Openings/recesses can use modeled component pieces and explicit clipping; a general boolean-solid engine is not required.
- Pipes, tubes and cables along explicit world-space routes, with filleted bends, capped ends, fittings, collars/clamps, gaps under fittings, and sort-ready pieces. Preserve cross-section, surface treatment and seams across chunk boundaries.
- Rods extending/retracting through a gland, contact pads/saddles on curved surfaces, and axis-aligned or arbitrary-axis connectors with explicit ports.
- Semantic assemblies containing multiple parts, with attached surface detail and ports that move with their parent. Model linkage and layer membership must not be maintained independently in SVG and WebGL implementations.

Support authored translation/rotation and documented scale behavior. Reject unsupported transforms (for example shear that invalidates analytic metadata) explicitly. Unsupported geometry must identify the part and the operation; it must not disappear, become a bounding box, or bypass audits silently.

Acceptance: F02–F04/F06 exercise the vocabulary in actual mechanisms, and focused geometry fixtures cover each primitive family and end-cap/opening behavior. Compare SVG silhouette/coverage to the mesh or independently sampled analytic surface at multiple supported views. Inspect round profiles at 4× and verify no artificial triangle grid, staircase shading, chunk seams, or missing caps. Do not satisfy an unfamiliar shape request by labeling an unrelated primitive as equivalent.

### FR-10: Camera, framing, and composition

Expose orthographic azimuth/elevation and fitting/padding as supported authoring/configuration parameters. World coordinates remain Z-up. Derive SVG projection, material facing, effect rays, pointer-to-world mapping, and audit rays from the same authoritative camera.

- Each figure declares its supported camera values or envelope. A static camera choice may rebuild/reorder artwork; continuous free camera orbit is not required.
- Qualify at least the baseline 45°/30°, an oblique 35°/30° view, and a raised 45°/44° view on suitable fixtures. Those checks are minimum representative views, not a claim that every scene is valid at every angle.
- Fit from all visible geometry and relevant motion envelopes, including effects and annotations where they occupy layout space. Prevent clipping at declared endpoints; do not continually refit during a gesture and cause the object to wobble in scale.
- Preserve aspect ratio, matched SVG/canvas rectangles, responsive framing at 390/960 CSS px, and consistent scale when an author requests a set of figures.
- A camera override outside a figure's support envelope fails with the allowed values/range and an actionable explanation. It must not be silently clamped or accepted with incorrect visibility.
- Card/minimal frames must support a title, hint, truthful readout, optional figure number, caption and legend. Compact output may omit decorative framing; accessible identification remains.

Acceptance: change camera settings without editing geometry and verify fitting, facing, ordering, interaction mapping and effect registration at each qualified view. Include an invalid-envelope case. Camera labels/values in the manifest must reflect the actual rendering camera.

### FR-11: Per-part materials and shading

Retain the illustration's filled surfaces, four side tones, lighter caps/tops, semantic line hierarchy, silhouettes, creases and optional bevels. Smoothly curved bodies need continuous tone regions whose geometry agrees with the surface; simple flat-facet shading is insufficient for large curved profiles.

Ship paper plus steel, chrome, gunmetal, gold, brass, copper and rubber material families, each tested in light/dark. Material ramps are stylized illustration choices, not a claim of physically based rendering. Support per-part or semantic-assembly assignments and validated custom material data without modifying geometry.

Materials must update consistently under supported motion and camera changes. Surface detail fades with facing where appropriate, without hard terminations. Transparent-looking glass/fluid treatments may use constrained SVG shading or the hybrid path; document the choice and fallback. General arbitrary transparent-mesh sorting is not required.

Acceptance: F09 renders all materials on flat and curved geometry, with side-by-side theme comparisons and movement through facing changes. Custom material data changes appearance alone, does not alter model values, and receives the same unknown-key/type validation as presets. Presets and material overrides resolve predictably and appear in the build manifest.

### FR-12: Parts, surface detail, and face content

Provide reusable recipes/helpers for feet, posts, rails, bushings, screws/bolt circles, knobs/knurls, ruler/dial ticks, coils, grooves, ribs, seams, welds, vents, label plates, flanges, tees/elbows/clamps, cable terminals and connector shells. A recipe can compose primitives; each need not become a special engine class.

- A spring surrounding a rod must have correct front/back visibility. A seam follows its host's geometry and reaches a real boundary; details on curved parts use that part's frame and profile.
- Tube braids/rings/stripes follow the cross-section and remain continuous through drawn chunk joints.
- Text and screen contents can lie in horizontal, vertical or tilted face planes. Clip content to the display and the enclosing opening where both constraints apply; recess walls remain visible.
- Surface labels and functional annotations are supported when the user needs them. Decorative detail levels are optional, but every level preserves the mechanism and contact/visibility correctness.
- Line-ending exceptions, such as a needle tip or printed label rules, are explicit metadata with a reason. Avoid making all lines exempt to obtain a clean report.

Acceptance: F02's tilted display and input sequence, F03's fittings/tube textures, F08's spring and probe, and F09's surface-detail sheet pass line/coverage checks and close-up review. The compact/standard/detailed modes retain the same model behavior.

### FR-13: Motion, articulated mechanisms, and changing geometry

The model produces one displayed state consumed by numerical readouts, geometry/transforms, shaders and accessible descriptions. Use deterministic time/pose sampling for tests, print and replay. Keep figure-specific physical relationships in pure model functions rather than independent renderer animations.

Required motion/interaction support:

- Pointer/keyboard/native controls, multiple controls, one input driving several parts, explicit phase changes, and user takeover from an optional idle tour.
- Easing and springs, including fast direction reversals; no jumps from reset clocks or stale target states. Preserve reduced-motion and offscreen/hidden scheduling behavior.
- Exploded assemblies with per-group translation, staggered springs, reassembly and reversals before all groups have started. Re-sort visibility when the displayed geometry requires it and validate intermediate/reversal states, not only assembled/apart endpoints.
- Hierarchical turns, slides and arbitrary-axis hinges within declared ranges; coupled hinge chains; group-local and world-space anchors/directions for effects and contacts.
- Detachment into a free rigid-group pose without a one-frame jump, with deterministic example motion and a correctly seated terminal pose. No general rigid-body physics solver is required.
- Shape changes such as a compressing coil, a changing profile, or merging glass drops. Recompute changing geometry only; preserve semantic identity, normals/shading, clipping and readout consistency.
- Reset, pause, named poses and deterministic time/state control accessible to verification/export tools. Multiple independent figures cannot share accidental global input or animation state.

Acceptance: F04 tests partial stagger/reversal sequences, F06 tests a hinge chain and detach/reattach or reset, F07 tests merging surfaces, and F08 tests spring compression. Sample transitions plus specifically targeted crossing/stagger boundaries. Reduced motion renders immediate meaningful states with functional controls. A valid moving scene must not be accepted solely because rest/max screenshots look correct.

### FR-14: Production SVG/WebGL effects

Promote the camera/scene/compositor concepts into a documented effects authoring API. Keep solid artwork vector-based. Support multiple canvas/SVG passes where an effect must appear between different classes of artwork; a single front overlay is insufficient for every supported phenomenon.

Required effect families must have reusable helpers or worked, parameterized reference recipes, shared pure model inputs, both-theme implementations, and vector fallback:

| Family | Required representative behavior | Fixture |
| --- | --- | --- |
| Light and glow | Attached luminous source and light pool; correct support/window occlusion | F06 |
| Fire/exhaust | World-space bounded volume, continuous ignition/throttle/shutdown envelopes, explicit depth-limited integration | F04 |
| Steam/smoke | Semi-transparent volume with smooth spatial fade and motion independent of a detached emitter where applicable | F04 |
| Sparks/particles | Emission anchored to a moving part; released particles remain in world space and occlude correctly | F06 |
| Water/glass and caustics | Registered surface effect, reflections/refraction treatment, receiving-plane light/caustics and shadows; model changes propagate consistently | F05 |

An effect is not complete merely because a shader compiles. Require these integration rules:

- One scene/camera, viewport mapping, state and clock. Explicit group-local versus world-space semantics; the same data supplies SVG, meshes, depth and shader uniforms.
- Use matching depth geometry and/or documented masks/layer splits appropriate to the phenomenon. GPU depth testing handles a surface effect; a ray marcher must read/interpret depth and bound its integration. SVG-SVG order remains separately validated.
- Openings may require clipping both in the surface plane and by the enclosing aperture. Avoid separately hand-positioned masks that drift during motion or camera changes.
- Composite alpha consistently, document each pass's blending and color-space assumptions, and test light/dark intentionally. Light-theme effects must not be dark-theme colors pasted onto white. Transition intensity follows the model and does not acquire a dark rim as it fades.
- Temporal envelopes avoid sudden phase/color switches; spatial terms approach zero before effect bounds or canvas edges. Treat intended discontinuities in the model explicitly rather than claiming every physical signal is smooth.
- Handle initialization failure, WebGL context loss, resizing and cleanup. Restore deliberately or remain in a clearly supported vector fallback. No effect failure disables the explanatory controls.
- Pause/suspend rendering when inactive/offscreen/hidden. Reduced motion uses an appropriate still effect and immediate input updates. Maintain a configurable DPR cap with deterministic captures.

Acceptance: F04/F05/F06 each pass registration, transition/contact-sheet, no-WebGL, actual context-loss, reduced-motion and both-theme checks. At least one fixture must require more than a single overlay pass. Inspect volume boundaries, glass/window edges and occlusion crossings at 4× or greater. These recipes establish the supported families; a universal shader editor or arbitrary shader-to-SVG conversion remains out of scope.

### FR-15: Geometry audits and actionable diagnostics

Implement audits against the actual authored shapes and displayed poses. Reuse the Three.js/primitive metadata and analytic geometry where suitable. A depth buffer cannot establish physical clearances or valid contacts. Recorded proxy shapes must be checked against what is drawn; do not hide faults with tiny stand-ins.

Minimum coverage:

| Audit class | Required detection and evidence |
| --- | --- |
| Solid/tube clearances | Unintended penetration or insufficient clearance between supported solids and routes, including moving groups |
| Ports and terminals | Disconnected pipe/cable ends, misaligned fittings, rim gaps and ends seated on the wrong host |
| Supports and seats | Floating unsupported assemblies, sunk contacts, incorrectly owned saddles/pads and detached parts with invalid terminal placement |
| Route quality | Self-overlap, folds/pinches, end-on projection failures, crowding that looks like a joint, and invalid crossings around bends/fittings |
| Profile/surface fidelity | Wobbling smooth profiles, discontinuous curvature/tone regions and mismatches between rendered and recorded shapes |
| Painter order | Wrong near/far order, cycles/interleaving, invalid static/live layer assignments and pose-dependent inversions |
| Motion coverage | Assembled/apart states, reachable spring reversals, hinge bounds, free-group clips, changing geometry and moving contact points |
| Drawing coverage | Audit geometry meaningfully covers the SVG/mesh being drawn, with explicit and narrow documented exceptions |

Each finding includes a stable code, involved part IDs, camera/pose or clip time, measured quantity/tolerance where applicable, severity, and a suggested corrective category. Generate JSON plus a concise human report and optional marked image. Nonzero exit status for unexcused failures is mandatory. Publish sampling/tolerance assumptions and distinguish proven analytic checks from sampled checks.

Allow deliberate contacts and special cases through named, narrow exceptions with reasons; report them. Avoid blanket assembly exemptions, arbitrary painter biases, or globally loosening tolerances to make a fixture pass.

Acceptance: valid F03/F04/F06 scenes pass their declared envelopes. Add deliberately faulty fixtures for every audit class and show that each fails with the expected kind of diagnostic. At least one fault must exist only mid-transition and one must be a misleading audit proxy. Preserve a known-fault regression set when fixing false negatives.

### FR-16: Scripted visual verification and geometry fidelity

Expand `check` and provide reusable `drive`/`audit` tooling rather than writing a special browser script for every figure. A scenario file describes pointer moves/drags/clicks, keyboard/text input, waiting for a model condition, named pose/time changes, screenshots, crops, slow playback, contact sheets and line checks. Exact syntax belongs in the maintained reference and must be schema-validated.

Required observable checks:

- Real pointer capture/keyboard events, asynchronous state completion, captured readout alongside frames, and reliable readiness instead of arbitrary long sleeps.
- Line-ending checks for paths, curves, arcs and visible surface details, accounting for clipping/fading and explicit exceptions. Report and visualize unsupported markup rather than skipping it silently.
- Sample supported group turns/hinge clips and capture boundary close-ups. Compare painter order against independent depth/ray evidence where possible; detect temporal pops separately from an intended user/model jump.
- Compare static/live renderings and silhouette/tone coverage for the same state. Surface shapes and details must remain faithful during animation.
- Theme-aware shader registration/intensity/boundary checks, no-WebGL/context-loss runs, reduced-motion runs, console/network errors and lifecycle cleanup.
- Desktop/mobile screenshots and reviewed crops. Numeric image thresholds cannot replace inspecting the image; do not auto-accept newly generated regression baselines.

Acceptance: one common scenario runner drives at least F02, F04 and F06 without fixture-specific branches in the runner. Known line, order, temporal-pop and effect-registration faults fail their checks. Browser dependencies/launch failures produce a blocked/failed report, not empty green evidence.

### FR-17: React/Next.js and typed integration

Provide server-safe drawing components and client lifecycle/control hooks or equivalent focused adapters. Support pure JavaScript authoring and checked TypeScript consumers without duplicated implementations.

- Server rendering builds initial vector art from the pure model; it must not access `window`, create WebGL contexts, or require a fake browser DOM merely to serialize SVG.
- Client hydration starts at exactly the server-rendered pose/readout. Defer interaction/effect setup to lifecycle hooks, and ship geometry code to the client only where live changes need it.
- Preserve stable keys, clip/mask/gradient IDs and scoped styles across streamed server content and multiple instances. An effect or readout must bind to its own figure root.
- Hooks/adapters cover readouts, visibility, reduced motion, scheduling/easing and cleanup. Repeated mounts and framework development remounts must not accumulate callbacks or GPU resources.
- Support caller-controlled model state and event callbacks without triggering a full framework render for every static SVG part on every animation frame.
- Publish checked types for configuration, figure/model contracts, supported primitives/materials, runtime controllers and integrations. Pin tested React/Next/compiler versions in fixtures and document the actual supported ranges.

Acceptance: F07 and F08 run in a real pinned Next.js application with server-rendered art and client controls. Check a long streamed page with multiple instances, no hydration/key/ID errors, correct initial render, independent controls and cleanup on navigation/remount. Compile a TypeScript consumer against the packaged API. Standalone CLI use still works without React/Next installed.

### FR-18: Printable documents and export

Implement a `sheet.mjs` specification beside a figure and a `print` command. A sheet references the built figure/model, named poses or deterministic action sequences, parts/assemblies, focus/hide choices, crops and explanatory text. Numerical annotations and snapshots must agree with the same model state as the live figure.

The public sheet contract must contain: `schemaVersion`, a `figure` entry or an existing artifact source (exactly one), optional figure `config`, `title`, named `views`, a `parts` list, `steps`, optional `details`/`assemblies`, and `maxPages`. Each view identifies a named pose or a validated deterministic action sequence, optional model/effect time, part IDs to focus/hide and an optional viewBox crop. Steps/details/assemblies reference view IDs; missing references fail. Parts use semantic IDs with labels/descriptions and optional pin anchors. Paper/layout/output flags belong to the print invocation and override sheet defaults. Document units and allowed fields in the package's print schema/reference, and keep explanatory text/model-derived numbers in the trusted JavaScript spec rather than inventing a separate expression language.

Required formats:

| Format | Required content | Page policy |
| --- | --- | --- |
| `poster` | Title, explanation, key numbers, main figure, numbered part pins and concise descriptions | One page |
| `drawing` | Drawing header, parts/specification, main view, inset and a short sequence of operating states | One page |
| `detailed` | Overview, meaningful close-ups, operating steps, optional assemblies and specification | Two to four pages, with explicit `maxPages` |

Support both A4 and US Letter. Layout must reflow for the selected paper; do not crop an A4 image onto Letter. Titles, captions and pins must remain readable in print, including monochrome use.

- Freeze all SVG layers and model poses consistently. Keep solid artwork vector in PDF; capture only requested WebGL/effect regions as bounded high-resolution rasters in the correct layer order.
- Support numbered pins, non-overlapping labels, focus/dim styling, hiding foreground parts for close-ups, and crops around semantic part IDs. The chosen crop must contain the intended subject.
- Provide PDF, inspectable intermediate HTML and PNG page previews. Fail on overflow, missing parts/poses, broken assets or page-count violations instead of silently truncating content.
- A figure may link to an already generated PDF; avoid links to nonexistent files or cyclic build requirements.
- Keep print typography/layout tokens configurable separately from screen framing where needed; use the same semantic colors/material identity and correct static effect fallback/raster labeling.

Acceptance: F10 generates all three formats on both paper sizes, covering a simple figure, a multi-assembly figure and a hybrid figure. Inspect every generated page and representative high-zoom PDF crops. Verify vector content remains vector, effect rasters occupy only intended regions, model numbers match poses, and a deliberate overflow produces a useful error. Record page count and selected pose/action hashes in the print manifest.

### FR-19: Craft guidance, reusable examples, and agent behavior

Extend progressive references with concrete decision guidance and executable recipes: selecting a physical metaphor, collecting/checking real numbers, planning parts/ports, composing cutaways, choosing a camera, routing pipes, placing surface detail, constructing smooth profiles, coordinating motion, selecting effect layers and debugging common audit faults.

Preserve user choice. Detailed work should contain purposeful construction and readable volume; compact work should stay compact. Do not restore mandatory part counts, forced idle tours, fixed time estimates, universal one-accent rules or prohibitions on needed labels. Distinguish a project's style preset from geometric correctness.

Package starter sources for a static figure, controlled interactive mechanism, hybrid effect, React integration and printable sheet. They must use public APIs and work outside the repository. Package enough small working examples/recipes to enable unfamiliar scenes without searching the upstream checkout. Large regression fixtures may stay repository-only.

Acceptance: fresh authoring trials create unfamiliar figures from the packaged skill and raw requests, without the implementation discussion or expected solution. Evaluate task truth, style/configuration compliance, correct interactions, geometry/effect checks, requested output, and edit preservation. Keep successful and failed artifacts with the package hash; revise instructions in response to observed failures.

### FR-20: Compatibility, migration, and release lifecycle

Document a support contract rather than implying that every Anatomy source file will run unchanged.

- Preserve our existing schema-version-1 defaults/precedence, public `render` boundary, selected-pose behavior, CLI commands, pure models, immediate/reduced-motion interaction and offline artifacts. Additive browser `kit`/`tokens` arguments are allowed; old clients remain valid.
- Add advanced capabilities through versioned schemas and public modules. Validate and document migration from v1 to v2; do not change an existing figure's camera/material/model implicitly during an upgrade.
- Anatomy source/API compatibility is not promised. Provide a mapping for common primitives, ports/materials, model/pose functions, layered effects, React components and print specs. Migrate representative source figures and state which transformations were manual.
- Never modify original user sources as an implicit build step. A migration command, if supplied, writes to a requested new destination, reports unsupported constructs and preserves model semantics; it is not a universal source translator.
- Maintain one default authoring pipeline once migration acceptance passes. Retain any legacy implementation only for a documented compatibility purpose, with supported versions, regression tests and a retirement path. Do not advertise two interchangeable renderers without equivalent support.
- The packaged skill includes all required modules/references/notices and pinned dependency information. Record release/package version, schema/API compatibility, tested host/framework/browser/OS versions, and upgrade changes. Keep global installation/publishing separate from local builds.
- Initial verified agent/browser targets may remain Codex and pinned Chromium. List other Agent Skills hosts as compatible-format or untested until actual trials establish support. Explicitly document the Node 22 requirement and dependency-installation differences from upstream.

Acceptance: original v1 fixture builds retain their declared behavior; a version-2 fixture exercises new fields; invalid/new fields fail clearly in v1; packaged JS/TS/React consumers resolve independently. An unfamiliar external author can follow the migration recipe for at least one basic and one advanced figure. Existing user data and original upstream source remain untouched.

### FR-21: Local sharing and source delivery

Replace the useful outcome of the upstream publishing workflow with a portable local bundle. Include figure/model source, declared assets/config/presets, required public toolkit or installable skill package, lockfiles, license notices, build instructions/manifests, and requested HTML/SVG/PDF/previews. Exclude session logs, account information, caches and unrelated source files.

The bundle must rebuild after installing its own declared dependencies in a separate directory without the source checkout or reference submodule. Viewing generated artifacts remains offline. An unpacked directory is the required format; an archive can be added without changing this portability contract.

The exact Anatomy community GitHub workflow, token/session statistics, automatic remote publication and a hosted gallery are intentionally omitted. A future destination-specific uploader is optional and must only run when explicitly requested; it is not a release blocker for the replacement described here.

Acceptance: bundle one basic and one hybrid/print fixture, rebuild from the isolated copy, compare deterministic model/vector outputs and inspect the raster/PDF evidence under a recorded browser environment. No absolute machine paths or undeclared parent-package imports may be necessary.

### FR-22: Capacity and performance evidence

Define repeatable workloads for: the small interactive dial; a dense static/cutaway assembly with many cables; a dense moving scene comparable in scale to the upstream roughly 380-part stress example; and a page containing multiple mixed static/hybrid/React figures.

Record actual solids, SVG nodes, route pieces, triangles, effect passes/canvases and moving-group counts rather than assuming example names imply comparable complexity. Capture warm/cold build times, output bytes, audit time, frame-time median/p95, event-to-state latency, DOM writes, active frame callbacks and memory/resource counts where measurable. Include viewport, DPR/cap, software versus hardware GPU, CPU throttling, browser and machine.

Honor the user's timing-budget deferral: collect and compare measurements without reintroducing the 33 ms gate or a new numerical performance requirement. Still require no unbounded resource growth, no permanent hidden/settled animation loops, and no functional failures under the tested workload. Any later budget must be explicitly recorded as a new decision; historical measurements remain intact.

Publish `docs/capacity.md` with observed practical limits, costly features, useful quality/detail controls and untested environments. Use optional detail reduction only where it preserves the explanatory model and does not conceal geometry faults. No 60 fps or universal mobile-performance claim without corresponding measurements.

## 16. Representative fixtures and parity evidence

Build feature-equivalent figures; identical narratives or screenshots are not required. Keep source/model readable and register every fixture's declared shapes, materials, camera envelope, controls, clips, themes, output modes and expected audit exceptions. The upstream examples are comparison references, not the sole source of expected results.

| ID | Fixture / upstream reference | Required coverage |
| --- | --- | --- |
| F01 | Dial / `dial-indicator` | Baseline contract, models/readouts, presets/detail, pointer/keyboard, standalone files, v1/v2 migration |
| F02 | Cutaway cabinet / `arcade-cabinet`, `desk-computer` | Concave/static construction, wiring, tilted clipped screen, text/keyboard input, sequential physical event, reserved/moving painter order |
| F03 | Valve and pipe assembly / `lathe`, `tube` recipes | Arbitrary-axis profiles, bends, terminal fittings/saddles/clamps, textured tube continuity, camera variants and positive/negative audits |
| F04 | Exploded engine/test assembly / `raptor-engine` | Smooth waisted profiles, dense routes, staggered reversible explosion, intermediate clearances/order, fire/exhaust and steam, multiple assemblies |
| F05 | Ripple/optics tank / `ripple-tank` | Multiple SVG/canvas layers, registered water and receiving-plane caustics/shadows, model history, both-theme effects and fallbacks |
| F06 | Articulated turning mechanism / `turning-dial` | Multiple turns/slides/hinges, hinge chain, detached rigid group, local/world anchors, luminous source and released sparks, material facing |
| F07 | Merging surface control / `spot-plate` | One control driving multiple merging/morphing shapes, continuous shading, React/Next integration and truthful readout |
| F08 | Spring/probe test rig / `test-rig` | Compressing springs, changing geometry, model-derived measurements, real Next server/client split and multiple-instance behavior |
| F09 | Material and surface-detail sheet | Every material family, flat/curved surfaces, face text, seams/ticks/knurls/ribs and deliberate line/fidelity faults |
| F10 | Print suite using F01/F02/F04/F05 | Both paper sizes and all layouts, poses/steps/parts/assemblies, vector solids, effect rasters, page limits and overflow failure |
| F11 | Dense and multi-figure stress suite | FR-22 workloads, instance isolation, resize/mount/dispose/visibility behavior, measured capacity with timing budget deferred |
| F12 | Fresh authored figures and migration trials | Unfamiliar tasks, packaged-only resources, source-preserving edits, external rebuild, basic/advanced source migration |

For every relevant visual fixture, include light/dark at 390/960 CSS px, named end states, representative intermediate states, reduced motion and applicable no-WebGL/context-loss states. Test both presets on F01/F09 and at least one advanced figure; do not multiply every expensive print/animation test by every irrelevant combination.

Create `tests/fixtures/manifest.json` listing capability IDs, declared cameras/poses/clips, associated positive/negative tests and evidence outputs. Store human-reviewed baselines with the runtime/package version. Raw screenshots alone are not a parity report: explain what was checked, what was observed, and what remains untested.

## 17. Configuration and runtime evolution

Keep the section-6 schema as version 1. Introduce version 2 for advanced settings, maintaining the same precedence rules and rejecting unknown keys. Existing v1 files remain valid and retain their behavior; builds must never reinterpret them as v2 without an explicit version change.

Example of a partial version-2 override:

```json
{
  "schemaVersion": 2,
  "preset": "technical",
  "theme": "light",
  "detail": "detailed",
  "camera": { "azimuth": 45, "elevation": 44, "padding": 24 },
  "materials": { "overrides": { "subject": "steel", "hoses": "rubber" } },
  "rendering": { "effects": "auto", "pixelRatioCap": 1.5, "quality": "standard" }
}
```

Version-2 contracts:

- `detail`: `compact`, `standard`, `detailed`, subject to declared figure support. Detailed adds purposeful construction; it does not change the model.
- `camera`: finite azimuth in `[0, 360)`, elevation in `(0, 90)`, nonnegative viewBox padding. Numerical validity does not imply a figure supports that view. Resolve omitted values from the figure's authored camera, then apply explicit overrides and validate the camera envelope.
- `materials.overrides`: map of declared semantic part/assembly roles to registered material IDs. Unknown roles or materials fail. A part-specific assignment can override its assembly; document deterministic precedence and include resolved assignments in the manifest.
- `rendering.effects`: `auto` or `off`. `auto` enables effects authored by the figure when the environment supports them; it does not invent effects. `off` selects the figure's meaningful vector fallback.
- `rendering.pixelRatioCap`: finite number from 1 to 3, default 1.5; affects raster layers/captures only, not vector geometry or model values.
- `rendering.quality`: `draft` or `standard`, with explicit sampling/fidelity settings. Draft output must be identified in manifests and cannot be used as final parity evidence. Both modes retain model truth and correctness diagnostics.
- Version custom preset/material schemas independently. Load material data through a validated public API or a repeatable `--material-file` flag; do not embed executable JavaScript in JSON preset data.

Keep figure construction in JavaScript. The scene is Three.js objects plus public construction helpers and namespaced metadata, not a second full JSON scene language.

Preserve `render({ kit, config, tokens, state })` and DOM-free static export. Advanced figures may additionally declare a serializable camera/motion envelope and audit/capture metadata. Browser `mount` may receive `kit` and `tokens` as additional arguments. Continue accepting a cleanup function; an additive controller result may expose `dispose`, `getState`, `setState`, `setTime`, `pause` and `resume` for tools. Normalize both forms without breaking existing clients, and document which methods a static or interactive figure supports.

The runtime must register each controller against its own figure instance so print/drive tools can target it. Initial state always equals the selected exported pose, including mid/max. Deterministic capture must wait for the requested state and relevant effects to settle or freeze at a specified time; it must not guess from wall-clock delay alone.

Record schema/API/package versions, resolved camera/material/effect parameters, source/dependency hashes, selected model state and applicable audit policy in manifests. Keep environmental capture information in reports. Never retrofit newly required fields into old historical reports and claim those checks ran.

## 18. Full-product commands and development workflow

Preserve the existing build/preview/check/test/package/prototype commands. Add these user-facing operations as the relevant features land; document exact options and machine-readable reports in the packaged references:

```bash
npm run build -- --entry examples/valve-assembly/figure.mjs --config examples/valve-assembly/figure.config.json --output both --out out/valve
npm run audit -- --entry examples/valve-assembly/figure.mjs --config examples/valve-assembly/figure.config.json --scenario examples/valve-assembly/audit.json --report out/reports/valve-audit
npm run drive -- --dir out/valve --actions examples/valve-assembly/actions.json --report out/reports/valve-drive
npm run print -- --spec examples/exploded-assembly/sheet.mjs --paper a4 --format all --png --out out/print/assembly-a4
npm run print -- --spec examples/exploded-assembly/sheet.mjs --paper letter --format all --png --out out/print/assembly-letter
npm run bundle -- --entry examples/exploded-assembly/figure.mjs --config examples/exploded-assembly/figure.config.json --out out/share/assembly
```

These names describe the requested fixture roles; if an existing implementation uses another directory, choose one canonical name and update commands/references together. The root wrappers delegate to the installed skill CLI (`figures.mjs audit|drive|print|bundle`); installing the development repository must not be necessary to use them.

- `audit` takes a figure/config plus a scenario declaring reachable poses/clips/cameras and exception policy; it reports geometric findings and exits nonzero on failures.
- `drive` takes an artifact directory and validated browser action file; it records actions, frame/pose/readout state, screenshots and runtime findings.
- `print` consumes the sheet contract, selects paper/layout, freezes requested states and reports page/model/vector/raster metadata.
- `bundle` creates the portable source/artifact directory from FR-21, with a complete declared rebuild manifest. It performs no remote publication.

Add root verification entrypoints `test:geometry`, `test:motion`, `test:effects`, `test:react`, `test:print`, `test:compat`, `test:parity`, and `bench:capacity`. Each runs meaningful fixtures or aggregates existing suites; avoid duplicating test implementation solely to create a command. `test:parity` verifies the required fixture manifest and produces a capability report rather than merely building examples.

CI should separate fast contract/geometry checks, browser/effects checks, framework/print checks, and package/migration checks. Production tests must not import the reference checkout. Explicit upstream comparison jobs may initialize the pinned submodule. Record unexecuted platform/browser jobs as unexecuted, not supported by inference. Benchmark jobs preserve the timing-budget deferral.

## 19. Replacement release gates

The existing A01–A13 baseline, P01–P08 prototype, E01–E08 behavior, and M01–M05 migration IDs retain their historical meanings. Add the following gates; do not rename an earlier pass to imply newly added coverage.

| Gate | Required release evidence |
| --- | --- |
| G01 — Traceable capability coverage | Every required C01–C16 row is verified with API/fixture/report links; C17/C18 omissions and compatibility limits are disclosed |
| G02 — Geometry/camera/materials | FR-09–FR-12 and F02/F03/F09 pass, including alternate qualified cameras and type/unsupported diagnostics |
| G03 — Dynamic scenes | FR-13 passes on exploded, articulated/detached and morphing fixtures, including mid-transition/reversal states |
| G04 — Hybrid effects | Every required FR-14 family has an executed recipe/fixture, both themes, layer/registration evidence, fallback and context-loss results |
| G05 — Trustworthy diagnostics | Every FR-15/FR-16 audit class has valid and deliberately faulty coverage; line/order/pop/fidelity failures cannot silently pass |
| G06 — Integrations and print | Packaged TypeScript/React/Next consumers and all required paper/layout cases pass; server/hydration/multiple-instance and vector/raster checks executed |
| G07 — Portability and reproducibility | Baseline contracts still pass, isolated standalone/framework/share bundles rebuild, deterministic artifacts match, source/provenance/notices complete |
| G08 — Compatibility and migration | Published version/support matrix, preserved v1 behavior, explicit v2 upgrade rules, basic/advanced source migration examples, and no undeclared legacy dependency |
| G09 — Fresh skill behavior | Advanced authoring/editing evaluations and positive/negative activation checks have executed artifacts/traces under a frozen package |
| G10 — Capacity and lifecycle | FR-22 workload reports and resource-cleanup checks complete; performance thresholds explicitly deferred, without false timing/performance claims |
| G11 — Human-readable visual review | Representative whole figures, junctions, surfaces, animation contact sheets and every print page inspected; material defects resolved and differences explained |
| G12 — Honest readiness report | `docs/replacement-readiness.md` links exact package/version, gates, omissions, known limits and reproduction commands; no required capability/check is silently missing |

Fresh advanced evaluation cases for G09:

| ID | Task | Required outcome |
| --- | --- | --- |
| R01 | Create an unfamiliar compact static mechanism with supplied brand settings | Correct explanatory model, honored constraints and standalone vector output |
| R02 | Create an unfamiliar pipe-connected mechanism with a requested raised view | Supported arbitrary-axis geometry/routes/camera plus meaningful audit results |
| R03 | Create or edit an exploded assembly with rapid open/close reversals | Correct intermediate contact/order behavior and unchanged model semantics |
| R04 | Add a realistic effect seen through an opening | Production hybrid workflow, correct registration/occlusion and both-theme fallback |
| R05 | Embed two interactive figures in a provided Next.js page | Server/client boundary, independent controls/IDs and no hydration failures |
| R06 | Turn an existing live figure into a Letter detailed handout | Correct model poses, pagination, annotations and PDF/vector/effect treatment |
| R07 | Change only material/preset on an existing complex figure | Preserve geometry/model/controls and limit edits to requested appearance |
| R08 | Use a normal relevant request without explicitly naming the skill, and an unrelated Mermaid request | Observed positive and negative activation behavior under the actual supported host |
| R09 | Migrate a representative Anatomy source into the packaged API | Explicit mapping, preserved model behavior, meaningful limitations and independent rebuild |
| R10 | Request an unsupported construction or camera outside the declared envelope | Precise diagnostic and supported alternative; no false claim of completion |

Use fresh authorized agent/host trials where available, with the packaged skill and raw task inputs, without supplying an intended answer. A simulated prompt review is not an executed trial. Do not add paid services or external account actions merely to manufacture evidence. If a required trial cannot run, report G09 pending and the exact blocker.

Run unfamiliar authoring tasks against a frozen package hash, inspect their artifacts and record agent/host/version information available from the environment. Do not reuse the implementation agent's knowledge of a reference example as evidence that a fresh author can produce it.

Release completion means required gates are satisfied. An explicit user-authorized waiver may be recorded with its scope/reason, but must not be invented by the implementing agent. The existing numeric timing-budget deferral is such a recorded decision; it does not waive rendering correctness, resource cleanup, measurements, or any feature family. If a required gate is pending, describe the result as an intermediate replacement candidate and list what remains. A successful M1/M2/M3 alone is never full replacement acceptance.
