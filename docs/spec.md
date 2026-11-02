# Crafted Figures specification

Crafted Figures is an agent skill and toolkit for crafted isometric figures that explain how machines and everyday objects work. An agent writes a small model and scene; the toolkit turns them into standalone SVG, interactive HTML, React components, printable pages or a portable source bundle. This document states what the product must do and how changes are accepted. [Implementation status](implementation-status.md) records what has been executed.

## Users and outcomes

- **Readers** get a figure that is true to the object, recognizable and pleasant to look at, that works offline with no install, and whose controls work by pointer and keyboard on desktop and phone.
- **Authors**, usually an agent, get a short contract, working starters and checks that find real faults: parts cutting into each other, wrong paint order, overlapping callouts and broken controls. The checks name the part and the pose.
- **Maintainers** get deterministic builds, a release suite whose receipts are bound to the exact package, and a skill that installs from one ZIP.

## Scope

**In scope**

- Solids built in a Three.js scene: boxes and rounded slabs, prisms and extrusions, cylinders, revolved and analytic profiles, spheres, cones, tubes along routes, knurling and bevels, with surface marks, labels, displays and ticks attached to their host part.
- An orthographic camera, fixed for schema 1 and chosen from declared views in schema 2.
- Presets `technical`, `editorial` and `illustrated`, two themes, compact and standard detail, semantic materials and validated custom presets and materials. The `illustrated` finish adds heavy contours, smooth shading, falloff and vector shadows.
- Motion driven by a pure model: scalar and state scenes, poses, playback clips, springs, exploded views, articulated and changing geometry, numbered callouts that follow moving parts.
- Bounded WebGL effect recipes (glow, sparks, fire, steam, water, caustics and shadow) drawn behind or between SVG passes with matching depth, and a meaningful vector fallback.
- Outputs: standalone SVG and HTML, React/Next server and client components, A4 and Letter print sheets (poster, drawing, detailed) as PDF/PNG/HTML with vector solids, and local source bundles that rebuild elsewhere.
- Tools: `build`, `preview`, `check`, `audit`, `drive`, `print` and `bundle`, run with Node and no npm install.

**Out of scope**

- Arbitrary mesh import, unrestricted camera orbit and automatic shader-to-SVG conversion.
- Publishing, galleries, accounts, telemetry, session-log collection and global installation as side effects.
- A numeric frame-time gate. Timing is measured and recorded; the owner has deferred any budget, so do not add one.

## Contracts

- **Figure module.** `render({kit, config, tokens, state})` returns `{viewBox, body, title, description}`; a Three.js figure uses `createStage`. A client mounts controls and returns cleanup or an instance controller. Poses name model states; a selected pose initializes both static art and client state.
- **Model.** A pure function from state to displayed quantities. Geometry and readouts come from the same displayed state.
- **Configuration.** One validated contract with schema versions 1 and 2. Schema 1 keeps its fixed camera and fields. Schema 2 adds camera views, detailed mode, material overrides, effect policy and `finish`. Preset and material JSON schemas are versioned and reject unknown fields. Configuration changes never rewrite sources or models.
- **Separation.** Model, styling and rendering stay separate. Styles come from derived tokens; SVG IDs and styles are scoped per figure.
- **Determinism.** The same inputs produce byte-identical HTML, SVG, configuration and manifest. Builds never embed machine paths or dates.
- **Text and safety.** Text is escaped and configuration validated. Author modules are trusted code. Bundles reject symlinks, local credentials and undeclared files.

## Rendering

- Three.js owns the scene hierarchy, geometry, transforms and camera. The toolkit's own SVG renderer owns tones, outlines and paint order.
- Paint order comes from ray sampling between overlapping parts, with extra samples along thin annulus rims. A part that cuts into another is an error that names both parts, the pose and the overlap, never a silent guess. A cycle names its parts.
- An independent WebGL depth-buffer check compares the painted SVG with the meshes in every swept state. Plane-based ordering was evaluated and declined: sampling closed the one fault found, curved and concave parts need rays anyway, and rays are a small part of frame time.
- Effects share the scene and camera through matching depth passes, hold WebGL contexts only near the viewport, and fall back to vector art when WebGL is missing or lost.

## Distribution

- Source lives in `skill/crafted-figures/`; `examples/` holds the canonical recipes, which are copied into the package's templates.
- `npm run package:skill` generates the runtime, declarations and recipe copies and assembles `dist/crafted-figures/` plus a deterministic versioned ZIP and checksum. Generated files are not committed.
- The ZIP carries Vite 8, Rolldown with its portable WASI binding, Three.js, Ajv and Playwright Core, with their notices. Authoring needs Node 22.13+ or 24+ and no npm install. Browser checks and printing use the pinned Chromium if installed, otherwise an installed Chrome, Chromium or Edge. Viewing output needs only a browser.
- The project is MIT-licensed; `LICENSE` ships in the package and third-party notices are kept.

## Acceptance

A change is accepted when these pass on the changed package:

1. `npm run lint` (Biome) and `npm run test:types`.
2. `npm test`, the unit suite.
3. `npm run test:release`, which runs every release group and binds each receipt to the package, runtime and test inputs. The groups are `unit`, `audit`, `browser`, `interaction`, `zbuffer`, `wasm`, `owned`, `migration`, `fidelity`, `materials`, `illustrated`, `effects`, `changing`, `diagnostics`, `gaps`, `framework`, `print`, `print-references`, `capacity`, `compat`, `distribution`, `source-package`, `bundled` and `gap-followups`. Each report must reach its minimum count of executed cases.
4. The hosted workflow, which repeats these by job and runs the no-install package on Linux, macOS and Windows with Node 22.13 and 24.

Checks are not enough on their own. A person must look at new or changed figures, at desktop and phone widths and in 4× crops of contacts and overlaps, for appeal as well as correctness: the hand-drawn filter and banded spheres in 0.8.0 passed every check and were still wrong. Fresh agent trials on the installed package show whether the guidance works; record them in `evals/`.

Record executed evidence, the environment it ran in and what was not run in [implementation status](implementation-status.md). Never relabel a skipped or failed check as passed.

## Open work

- A helper for figures driven by a state machine and a clock, beyond `publishState`.
- Marks whose color follows state, hidden marks, `ticks` beyond local XY faces, and vertical drags.
- Browser checks and printing on Windows, Safari, Firefox, phones and hardware GPUs.
- Fresh agent trials against the current package.
