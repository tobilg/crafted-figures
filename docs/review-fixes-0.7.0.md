# Review corrections: crafted-figures 0.7.0

This increment addresses the whole-project review of 0.6.1 and adds Biome. The hosted CI result that prompted findings 1 and 2 is [run 41101188344](https://github.com/tobilg/crafted-figures/actions/runs/41101188344). Figure, model and configuration contracts are preserved, except where [compatibility](compatibility.md) lists a deliberate change. The numeric timing budget stays deferred.

**Not resolved here:**

- **Fresh agent trials (finding 9).** None ran. G09 is open for 0.7.0; the last trials were against 0.3.x.
- **Hosted confirmation (findings 1 and 2).** Nothing was pushed, so the workflow fix and the Windows fix have not run on GitHub. Windows remains unverified until they do.

| # | Finding | Correction | Regression coverage |
| --- | --- | --- | --- |
| 1 | CI browser job read `dist/` without building it | The job now runs `package:skill`; `lint` and the new suites were added | Simulated from a clean copy; hosted run pending |
| 2 | Every build failed on Windows | Modules resolve and load in JavaScript, never through the WASM file system | [wasm-independence](../tests/wasm-independence.mjs) builds with that file system blinded, and proves a plain Vite build then fails the way Windows did |
| 3 | Dragging froze under default motion | A retarget keeps the displayed value and velocity; pointer gestures use a short span; the cubic never overshoots | [interaction](../tests/interaction-browser.mjs): mid-gesture drag, held keys, reversal |
| 4 | One unorderable pose froze a live figure and split its readout | Live drawing records a diagnostic and draws its best order; a failed draw reverts to the last painted value; builds stay strict | Interaction suite; [robustness](../tests/robustness.test.mjs) |
| 5 | React `state` plus `onState` looped forever | The adapter recognizes echoes of what it displayed; external state still applies | Interaction suite, with identity and copied state |
| 6 | Painter order dominated performance | See [capacity](capacity.md) | Incremental versus fresh rendering at sampled states of every example; ray test versus native rays |
| 7 | Tests missed real interaction | `check` now sweeps poses and range inputs; a new suite covers gestures | The suites above |
| 8 | Clearance audit could falsely pass | Exact triangle distance and surface samples clipped to the shared region; a scenario adds to declared checks unless `replaceDeclared` says otherwise | Robustness tests; [gap contract](../tests/gap-contract.test.mjs) |
| 10 | Bundling and printing gaps | Sheets keep their paper and layout; npm dependencies travel with notices; `print` accepts presets and materials | Interaction and robustness suites |
| 11 | Config silently ignored; manifest could be wrong | The injected kit binds configuration; a false camera claim fails the build; `material()` under schema 1 warns | Robustness tests |
| 12 | WebGL contexts ran out on busy pages | Contexts are held only near the viewport and retried on return; a layer renders only the depth it needs | Interaction suite, 12 figures; effects suites |
| 13 | Curved outlines looked broken | Each band redraws the outlines of its earlier neighbours, so a fill cannot cover them | Inspected crops, below |
| 14 | Code was hard to review | Biome 2.6.4 formats and lints; formatting alone was proven to change no output | `npm run lint` |
| 15 | Types were never checked | `checkJs` runs over the kit in `test:types`; `resolveConfig`, `Figure` and `Controller` types corrected | [types](../tests/types.mts) |
| 16 | Controller design too narrow | `mountStateScene`, built-in effect wiring, and `controller.stage`/`effects` | Examples moved to them; effects and browser suites |
| 17 | `check` hid the real error | Mount failures report the page's own error at once; the drawn readout is optional | Interaction suite |
| 18 | Standalone SVGs were unsafe to inline | Styles and IDs are scoped per figure | Interaction suite, in a host page |
| 19 | React ID namespacing was regex-based | Attribute-aware rewriting of references in markup only; unresolved references fail | Robustness tests |
| 20 | Hard-coded branding and language | No product name by default; `eyebrow`, `language`, `control.help` and `clipControls({labels})` | Interaction suite |
| 21 | Playback overrode the user | Touching another control pauses playback | Interaction suite |
| 22 | Docs had drifted | 244 dead evidence links became plain paths; status pages say what is current | [docs-links](../tests/docs-links.test.mjs) |

Smaller items also fixed: all three kit writers share one interruptible owned-output path (`scripts/generated-tree.mjs` remains, since it replaces whole directories at development time); notices are mandatory for shipped dependencies; pointer-to-world helpers exist; spheres read as round and cones and spheres draw no dot at a collapsed ring; spring sampling resumes from checkpoints; `rendering.quality` and effect themes follow the configuration; WASI warnings no longer print; the reading appears once; suites clean up temp folders; and figures without effects no longer bundle the WebGL renderer (the dial's HTML fell from 810 KB to 590 KB).

Running `check` over every example also exposed something the review had missed: four examples wrote `<g data-scene>`, which HTML accepts but XML does not, so their `figure.svg` files did not load. The examples are fixed and such attributes now get an empty value.

## Verification

**All 23 release groups passed in one run bound to the final package** (`npm run test:release`, 14.6 minutes), along with `npm run lint`, 59 unit tests and `npm run test:types`, which now covers the kit's JSDoc. They ran on Node 24.22.1, Darwin arm64 (Apple M2), Chromium 156.0.8078.4 and software WebGL. The 21 existing groups kept their minimum case counts; the two new ones are `interaction` (15 cases) and `wasm` (3 cases).

| Check | Result |
| --- | --- |
| Hosted CI | Not run: nothing was pushed. The workflow parses, and the first steps of the fast and browser jobs passed in their exact order from a clean copy of the Git-eligible files, including `test:owned`, the step that failed on GitHub |
| Windows | Not run. Builds pass with the WASM file system blinded, where a plain Vite build fails with the same `UNRESOLVED_ENTRY` error Windows reported |
| `npm run test:parity` | Exit 2, `technicalStatus: "passed"`. Four items stay pending because the historical evaluation archive was not supplied: G09, and C01, C15 and C16 through F12. This is the documented result without that archive |
| Reproducible package | The clean copy reproduced the same ZIP, byte for byte |
| Dependency advisories | `npm audit` was clean on both lockfiles at review time; only Biome has been added since |

The assembled package has 275 manifest-listed files / 25,568,137 bytes. The ZIP is 7,008,421 bytes. Package-manifest SHA-256: `5b6fd76240a12b78057ddd43e74231e18e931f3f0d2a27ace5b8d08b49f0a400`. ZIP SHA-256: `f109961f9d2a024146ad298ff8a7fb7bcc63c9d1fd712b859caea6e5d992af68`.

## Review notes

Formatting was verified separately before any other change: all 143 sampled renderer outputs and all 16 HTML and SVG builds were byte-identical to the unformatted code, and all 46 unit tests passed. Dropping `crispEdges` to fix finding 13 was tried first and rejected because it added visible banding across surfaces. Whole figures, 4× curved-surface crops, the material sheet, and one A4 drawing page were inspected after the changes. Not every generated page was re-inspected.
