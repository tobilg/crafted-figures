# Illustrated look trial, 0.8.0

Two fresh agents each received the installed skill and one plain request, with no hint about the preset. The aim was to learn whether the new guidance and preset produce figures people want to look at, and what the skill gets in the way of. It is a small trial: two cases, on one host, and the package changed afterwards.

| | Toaster | Espresso machine |
| --- | --- | --- |
| Request | "Make me an interactive figure that explains how a pop-up toaster works." | "Make me an interactive figure that explains how an espresso machine works." |
| Time | 52 min | 49 min |
| API calls / tool calls | 49 / 85 | 66 / 102 |
| Output tokens | 200,281 | 227,241 |
| New input tokens (uncached plus cache writes) | 381,238 | 427,510 |
| Cached input read | 11.8 million | 18.4 million |
| Solids | 249 | 502 |

Tokens and time come from each agent's session transcript, counting each API message once. Both agents also wrote their own tests and ran far more verification than a figure strictly needs.

Package at trial: manifest SHA-256 `0678de1b661a19219e927498978c40947923bf5c47bda9dbff8775b1ba20d864`. Later fixes changed the package again, so the final manifest is recorded with the release receipts.

## What the trial showed

Both agents chose the `illustrated` preset unprompted, used strong color and printed details, added small objects such as toast, butter, a tamper and a coffee tin, and built working cutaways with numbered parts. Both figures passed `check`, `audit` and `drive` on the agents' own runs, and each agent reports the checks it did not run.

Both also opened the object so far that it reads as a frame before it reads as the object. Guidance now says to keep it whole.

## What the user caught afterwards

The agents and the checks missed all of these. They are why a person has to judge the look:

- The hand-drawn filter made lines shaky and aliased, because `feDisplacementMap` moves pixels without smoothing. It was removed.
- Four hard tones made spheres look striped and rounded corners look like strips. Smooth shading replaced them in this preset, with more corner facets for larger radii.
- Objects on a surface had no shadow on it, and a perfect sphere does not look like an apple. Flat tops now receive shadows, and the starter's fruit has a real shape.

## Findings from the agents

Fixed:

- `clipControls` over `mountStateScene` threw on cleanup and left its controls in the page.
- `ticks` failed the kit's own line check.
- The starter's dial scale and needle disagreed, and its needle failed the line check.
- The ground shadow swamped tall objects and hung in the air past a board, so both agents turned it off. It now has a shorter default and a `shadowLength` setting, and it stops at the edge of the surface it lands on.
- Interleave errors stopped at the first clash and gave no location, and cycle errors named no parts in a build.
- Controls came after the caption, a tall drawing pushed them off screen, and disabled buttons had no style.
- `clipControls` had no rate or early end and did not expose its button.
- `mountStateScene` had no help text, spoken value or pose buttons.
- Custom materials needed one file and one flag each. `materials.colors` now names one in the config.
- Each part repeated its material mapping, about 27% of an SVG. A finished figure uses one class per material instead.
- A custom client had to reimplement `crafted:state`. `publishState` is now exported.
- Both agents hand-wrote numbered callouts, leaders and legend highlighting, and placed them by trial and error. `callouts` now does this, and placement, phone legibility and collisions are handled and checked. Both figures were converted in scratch copies and pass `check`. On the way, `CALLOUT_HIDDEN` flagged anchors placed inside the parts they label, and one real occlusion, the lever arm in front of the timer. Declaring `part` cleared the first group, and the other was marked `mayHide`.
- Documentation conflicts and gaps: azimuth, `createScene`, sphere `tolerance`, tone bands, scenario merging, contact coordinates and the spring's seat.

Not fixed:

- No helper fits a figure with a state machine and a clock, beyond `publishState`. This is now the clearest gap.
- A mark's color cannot follow state beyond `accent`, and a mark cannot be hidden.
- `ticks` works only on local XY faces.
- Interactive CSS assumes horizontal drags.
- `check` never sends pointer-release events, and the `pose` action's fields remain undocumented.

## Limits

The agents ran on the trial package, not the final one. Their source was rebuilt with the final kit, with the shadow turned back on, and it passes `check`. `audit` and `drive` were not repeated on those rebuilds. Their custom ramps were tuned to the old four tones, so some colors shifted, such as the bread. No agent has yet authored against the final package.

Each agent also stepped outside its allowed folders once, for a browser lookup or a stray temporary file. The mechanisms come from the agents' own knowledge and were checked against no source.
