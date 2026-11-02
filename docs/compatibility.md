# Compatibility contract

The built artifact uses the toolkit's Three.js-based implementation for solid authoring and ships its authoring runtime. Node 22.13+ or Node 24+ is required; no npm installation is needed for standalone commands. The runtime embeds Vite 8.3.5 with Rolldown 1.2.15 and its portable WASI binding, Ajv 8.20.0, Playwright Core 1.64.1 and Three.js 0.186.1. Install the built ZIP; a raw source folder needs a repository build first. Runtime bundles, generated types and recipe copies are intentionally ignored in Git. Tested integration versions are React/React DOM 19.3.1, Next 16.4.2, TypeScript 7.0.2, @types/react 19.3.0 and @types/three 0.186.0. These are tested versions, not evidence for every version admitted by an optional peer range. Chromium 156 has executed browser evidence on hosted Linux and locally on macOS. Other browsers, hardware GPUs and OSes remain untested.

**Platforms.** Linux, macOS and Windows run the no-install consumer on hosted CI at Node 22.13.0 and 24, and builds and source bundling passed on all three in [run 41189536149](https://github.com/tobilg/crafted-figures/actions/runs/41189536149). The first hosted run failed on every Windows build; 0.7.0 fixed that by moving module loading out of the WASM file system. Browser checks and printing run on hosted Linux and locally on macOS, not on Windows.

**Behaviour changes in 0.8.0.** A new `illustrated` preset, a schema 2 `finish` setting and eight enamel materials change no existing figure's geometry, painter order or colors. These differences reach existing figures:

- In HTML and React output, a figure's controls now come before its caption and legend.
- A legend row may now carry `callout`, `number` and `active`. Rows without them keep their exact markup.
- Tick marks made with `ticks` now record a `data-line-reason`, so they pass the `drive` line check.
- Schema 2 CSS also lists the enamel ramps, about 3 KB per figure, and its style scope hash changes with those tokens.
- Selecting a version-2 preset with no stated schema version now selects schema 2. An explicit schema 1 with a preset that sets a schema 2 field still fails, now naming the field.
- Build errors now name the pose. An interleave error reports every clash in that pose at once, with its overlap and location, and a cycle error names the parts in the cycle.
- `clipControls` over `mountStateScene` no longer throws on cleanup.
- A build manifest's `provenance` now holds only `implementation`.

Custom presets remain valid, and `shadow` is an optional new theme token. A figure using `finish.shading:"smooth"` needs `color-mix`, which means Chrome 111, Safari 16.2 or Firefox 113 or later. Only Chrome has been run.

**Behaviour changes in 0.7.2.** Printed PDF and HTML files are much smaller, because the clip around a smooth surface now holds only its outer edges. It covers the same region, and pages render the same apart from small antialiasing differences. The figure, model, configuration and print contracts are unchanged.

**Behaviour changes in 0.7.0.** HTML figures and print pages no longer carry a product name (set `eyebrow` to add a label). SVG IDs and styles are scoped to the figure, so `figure-title` becomes `<figure>-<hash>-title`. Audits check every solid pair even when a scenario lists clearances (`clearanceScope: "declared"` restores the old focus) and an empty list no longer removes a declared check (use `replaceDeclared`). `setState` on a scalar scene rejects a key it cannot honor. A figure built with schema 1 that calls `material()` builds with a warning. Tools read `controller.stage` and `controller.effects`; `root.__stage` and `root.__effects` remain as aliases. The figure, model and configuration contracts are otherwise unchanged, and the frozen regression sources still build unmodified.

Schema 1 preserves the existing fixed authored camera and fields. Explicitly select schema 2 for camera views, detailed mode, semantic material overrides and effect policy. Numerical camera validity does not imply that a figure supports the view. JSON preset and material schemas are separately versioned and reject unknown fields. Configuration upgrades do not rewrite sources or change a model.

`render({kit,config,tokens,state})` and mount cleanup functions remain supported. Advanced mounts may return an instance controller; browser kit/tokens arguments are additive. A selected exported pose initializes both static art and client state. Version 0.5.0 intentionally removed the old projection/solid helpers and their generated types. No shim remains. Sources that used those helpers must move to `kit.illustration` as described in the skill's [migration guide](../skill/crafted-figures/references/migration.md); schema-1 configuration itself needs no migration.

Codex and Claude Code are the agent hosts that have run the skill. Other Agent Skills hosts are compatible-format only until tried. The skill owns its dependencies; generated standalone files need neither npm nor network access. The compatibility suite executes v1/v2 tests, strict types, isolated standalone and real Next consumers, and separate basic/hybrid-print source-bundle rebuilds. Global installation and publication remain separate user actions.
