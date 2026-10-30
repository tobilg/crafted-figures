# Configuration

The executable sources of truth are `kit/config.mjs` (public JSON Schema and canonical defaults), `assets/presets/*.json` (preset defaults/palettes) and `kit/styles.mjs` (CSS token generation). Do not maintain independent copies of defaults.

Inputs are partial JSON objects. Priority: toolkit defaults → selected preset defaults → explicit `--project-config` → `--config` → CLI flags. Select the highest-priority supplied preset first, then merge layers. Nested objects merge by key; arrays replace; null, unknown keys and unsupported figure detail modes fail. No implicit home or parent config search.

Public fields: schemaVersion (1), preset, theme (light/dark), accent (six-digit hex), detail (compact/standard), frame (card/minimal), typography.body/mono (ordinary local font-family lists), stroke.width (0.25..2), motion.enabled, motion.idleTour, motion.durationMs (integer 0..2000), output (html/svg/both). No camera settings or environment-selected theme. Typography rejects declarations, controls, functions, URL expressions, braces and angle brackets. Use installed/system fonts; external fonts are outside the contract.

Font lists accept Unicode family names and quoted names containing commas, for example `"源ノ角ゴシック", sans-serif` or `"AT&T, Serif", Georgia, serif`. Quotes must balance; empty families, CSS comments and escape sequences are rejected. Naming a font does not fetch it; normal local fallback applies when it is unavailable.

Technical uses cool slate surfaces and a blue accent, with construction detail and a card. Editorial uses warm paper/bronze surfaces and a terracotta accent, compact detail and minimal framing. Each has separately designed light and dark palettes. Explicit fields override them. Accent affects semantic parts and controls; deterministic shades and black/white button text preserve control contrast. Text hierarchy uses theme inks, independent of an arbitrary brand accent.

For a custom preset, copy either built-in JSON, assign a unique `id`, and load with repeatable `--preset-file path`. A preset has `id`, `defaults`, and complete `themes.light` and `themes.dark`. Defaults use public fields except schemaVersion/preset/output. Each theme requires exactly: page, card, text, muted, surface, top, side0, side1, side2, side3, accent, stroke, halo, all six-digit hex. The resolved config accent overrides the theme accent token; set a brand accent in preset defaults to use it by default. Duplicate IDs, even built-ins, fail. Custom palettes remain the author's readability responsibility; inspect both themes.

Build flags: `--entry` and `--out` required; `--state` defaults to rest. `--config`, `--project-config`, repeatable `--preset-file`, `--preset`, `--theme`, `--output`, `--accent`, `--detail`, `--frame`, `--motion-enabled true|false`, `--idle-tour true|false`, `--duration-ms`. Font/stroke use JSON files. Unknown/repeated scalar flags fail. Paths are relative to the invocation directory, resources relative to this installed package.

## Explicit version 2

The preceding fixed-camera contract remains schema 1. Version 2 is an opt-in (`"schemaVersion":2`) with the same precedence and no implicit upgrade. It adds:

- `detail:"detailed"` when declared by the figure.
- `camera:{azimuth,elevation,padding}`: azimuth [0,360), elevation (0,90), nonnegative padding. Omitted values come from `capabilities.camera.default`; the exact azimuth/elevation pair must be in `capabilities.camera.views`. Pass resolved config/tokens into createStage. One fixed view is selected per build; no interactive free orbit or gesture refitting.
- `materials:{overrides:{role:"material-id"}}`: roles come from capabilities.materials. Nearest part assignment wins its ancestor; an explicit part-name/role override wins that node's authored material. Unknown roles/material IDs fail. Built-ins: paper, steel, chrome, gunmetal, gold, brass, copper, rubber.
- `rendering:{effects:"auto"|"off",pixelRatioCap:1..3,quality:"draft"|"standard"}`. The default cap is 1.5. Off uses vector fallback; auto does not invent an effect. Draft volume sampling is identified in the manifest and is not final parity evidence.

Custom materials use repeatable `--material-file path` and schemaVersion 1 data: `{schemaVersion:1,id,themes:{light,dark}}`. Both themes require exactly surface/top/side0/side1/side2/side3/stroke/ink, each a six-digit color. IDs cannot replace a built-in silently. Material files require a version-2 figure request.

A version-2 preset declares `schemaVersion:2` at its top level; its defaults can include advanced v2 fields. The version-1 preset data format remains valid. Full assignment/camera/effect policy and model state are recorded in new build manifests; historical reports are not rewritten. See [migration.md](migration.md) for compatibility and current support limits.
