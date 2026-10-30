---
name: crafted-figures
description: Create and edit crafted isometric SVG figures and interactive technical explainers, with configurable styling and standalone HTML or SVG output. Use for illustrated mechanisms and technical objects; preserve explicit requests for simpler media such as Mermaid.
---

# Crafted Figures

Build the explanation around a truthful model and a recognizable object. Use this folder as the independent toolkit; no reference checkout is needed.

With Node 22.13+ or Node 24+, run `node scripts/figures.mjs build ...` directly. Install the built `crafted-figures-<version>.zip` artifact. Its generated `runtime/` contains Vite 8 and the required libraries; do not run npm installation for standalone authoring. A raw source checkout requires the repository build first (`npm ci`, `npm --prefix skill/crafted-figures ci`, then `npm run package:skill` at its root). Browser checks/PDF also need a Chrome/Chromium executable; see [verification.md](references/verification.md) for explicit setup. React applications retain their own framework dependencies.

1. Identify the quantity or relationship to explain, its units and bounds. Choose geometry that makes it visible. Keep explicit constraints, medium and requested scope.
2. Read [authoring.md](references/authoring.md) for the small figure/model/client contract and starter. Build a working static pose before adding interactions. New figures use the packaged Three.js scene and SVG adapter. Use [craft.md](references/craft.md) for composition and [geometry.md](references/geometry.md) when constructing parts; diagnose unsupported overlaps instead of hiding them.
3. Read [configuration.md](references/configuration.md) for appearance changes. Translate user preferences into config or CLI flags; keep the model independent. Presets, detail and framing are choices, not mandatory ornament or part counts.
4. Add only necessary controls. Drive geometry and readout from the same displayed state. Keep pointer and keyboard behavior equivalent, reduced/disabled motion immediate, and idle tours off unless requested. Return cleanup from mount. Use [motion.md](references/motion.md) for reversible sequences and changing shapes, and [effects.md](references/effects.md) for bounded hybrid layers.
5. Run [verification.md](references/verification.md): model checks, standalone build/check, desktop/mobile views and 4× crops at contacts/overlaps. Inspect screenshots before accepting them. Record any blocked check explicitly.
6. For framework embedding, read [react.md](references/react.md). For print/PDF or portable source bundles, read [printing.md](references/printing.md). Deliver source, requested standalone files and evidence. HTML/SVG viewers need no network or npm install. Do not publish, install globally, or add account integrations as a side effect.

Keep text escaped and configuration validated. Author modules are trusted executable code. The packaged Three.js pipeline supports the documented illustrated primitives, fixed authoring cameras and model-driven motion. Version 2 adds declared camera views, material overrides and bounded hybrid recipes. It does not support arbitrary meshes, unrestricted camera controls or automatic shader-to-SVG conversion. The historical experiment remains excluded. Qualify claims against the actual figure envelope and executed verification. A successful build alone does not establish advanced feature parity.
