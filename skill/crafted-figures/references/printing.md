# Print and local delivery

Run `node scripts/figures.mjs print --spec path/to/sheet.mjs --paper a4 --format all --png --out out/print` from the installed toolkit. Paper is `a4|letter`; formats are `poster|drawing|detailed|all`. Use an existing browser via `CRAFTED_CHROMIUM_EXECUTABLE`, or install pinned Chromium explicitly with `node runtime/playwright-core/cli.js install chromium`.

A trusted `sheet.mjs` default-exports a validated object:

```js
export default {
  schemaVersion: 1, figure: './figure.mjs', config: './figure.config.json',
  title: 'How the mechanism works', description: 'A concise explanation.', maxPages: 3,
  views: {main:{pose:'mid'}, start:{pose:'rest'}, end:{pose:'max'}},
  parts: [{id:'body',label:'Body',description:'Supports the moving assembly.'}],
  steps: [{view:'start',title:'Start',text:'Describe the actual starting state.'},
          {view:'end',title:'Finish',text:'Describe the actual final state.'}]
};
```

`figure` and `artifact` (an existing build directory) are exclusive. Paths resolve beside the sheet. Each view chooses a named `pose` or an `actions` array of `{type:'pose',name}`, `{type:'state',value}`, or `{type:'time',value}`; optional `time` freezes a deterministic sequence. `focus` and `hide` list actual semantic part/assembly IDs. `crop` is `[x,y,width,height]` in SVG viewBox units. Without a crop the printed frame fits the visible subject. `effects:true` requires working WebGL and captures only its nontransparent regions; otherwise the still uses meaningful vector symbols. The solid drawing always stays SVG/vector.

Parts have id/label/description and optional `pin:[x,y]` in viewBox units. Numbered pins match the parts list. Optional `details` and `assemblies` use the same `{view,title,text}` contract as steps. Missing parts/views, unsupported actions, invalid crops and overflow fail. Detailed layouts use 2–4 pages within explicit maxPages. `typography:{body,size}` sets print font family and point size independently of the screen frame.

Inspect every PNG page and the PDF at high zoom. A successful print command verifies page overflow and captures actual model state; it does not substitute for visual review. The manifest records pose/action hashes, vector paths and effect raster regions. Test environment lives in print-report.json. Do not promise byte-identical PDFs across browser versions.

`bundle --entry figure.mjs --config figure.config.json --sheet sheet.mjs --out share/figure` creates a local source/toolkit/artifact directory. `--sheet` is optional; repeat `--asset path` for resources not discovered by module imports. Preset/material files use the same repeatable flags as build. No publishing or telemetry occurs. Run `node rebuild.mjs` inside the bundle without npm installation; generated HTML/SVG can already be opened offline. Review the bundle manifest to ensure every required local asset is declared. Builds preserve unrelated/edited outputs instead of clearing a directory.

For a meaningful close-up, set `around: ['semantic-part-or-assembly-id']` on a view. It fits the visible named geometry plus 8% padding; `focus` independently dims other parts. `around` and a numeric `crop` are mutually exclusive. Hidden or empty subjects fail. Pins outside the selected crop are omitted. The shipped dial starter includes a portable `sheet.mjs`.

The drawing layout places the first `details` or `assemblies` note beside the parts list as its inset. Supply a meaningful close-up view for that note; drawing output fails clearly when none is declared. Poster does not require one. Detailed layouts put `details` on the overview and assemblies after the operating steps.

Print capture keeps the same geometry and painter order, but applies face-coloured seam strokes inside a shared physical-surface clip. This avoids hairline gaps in PDF consumers that ignore SVG `crispEdges`. It is vector fill treatment; solid artwork is not rasterized. The browser renderer is restored after capture.

Static figures can print non-rest named poses: provide `sheet.figure` pointing at the source figure module, whose pure `render` receives the selected model state. Static views can apply supported pose/state actions, and time actions when the model declares numeric `time`; no client controller is required. An artifact-only sheet can reuse its recorded pose, but needs source to produce another state. Generated pin centers remain inside the crop and are separated deterministically; an overcrowded crop fails with `PRINT_PIN_OVERFLOW` so the author can enlarge it or use another view.

Local SVG definitions may be reused with `href`/`xlink:href`, `url(#id)` references and ARIA ID lists. Each printed appearance of a view gets its own ID namespace. Duplicate IDs within a view or unresolved local references fail with `PRINT_DUPLICATE_ID` or `PRINT_UNRESOLVED_REFERENCE` before a PDF is written; correct the referenced definition rather than accepting missing artwork.

A poster may set `maxPages:1`; detailed sheets still need at least two meaningful pages. Include `steps:[]` when a poster has no sequence. The same sheet can define details/assemblies for the other layouts.

Construct a static figure through the injected `kit` passed to `render`. The print builder uses that same boundary to enable the adapter's vector seam treatment before serialization, so static curved surfaces receive the same PDF treatment as live captures. Directly importing a separate renderer bypasses that injection and needs its own print qualification. The treatment preserves vector geometry and painter order; it does not rasterize solids.
