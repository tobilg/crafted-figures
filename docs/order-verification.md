# Painted-order verification, 0.7.1

Item 3 of the post-review plan: find a browser automatically, add a z-buffer check, and move to plane-based ordering only if ray sampling proved limiting. The first two are in. Plane-based ordering was not adopted, for the reasons below.

## Browser discovery

`launchChromium` tries the pinned Chromium, then Chrome, Chromium and Edge in their usual locations. An explicit `CRAFTED_CHROMIUM_EXECUTABLE` is tried alone, so a mistaken path fails and names itself rather than falling back. Reports record `environment.browserSource`.

Executed: with no pinned build and no variable, `check` ran on installed Chrome 156.0.8078.74 (`installed`). A bogus configured path failed and named the path. The same case found and ran installed Chrome on hosted Linux (156.0.8078.47). Candidate lists for all three platforms have a unit test, which is the only coverage of the Windows paths.

## Depth-buffer check

`kit/order-check.mjs` draws the meshes into a raw WebGL depth and ID buffer and compares interior pixels with a raster of the painted SVG fills. It shares no code with the painter or its rays. `check` runs it in every swept state, and `drive` offers it as an action and per sampled frame.

| Case | Result |
| --- | --- |
| All 16 examples through `check` | 209 states, no findings; `dense-cutaway` is static, so it is not applicable. Reverse-paint controls see overlap in the 15 live figures |
| Cost per run | 18–71 ms by figure at scale 2, on an Apple M2 with software WebGL |
| Part moved behind everything (dial) | `ZBUFFER_ORDER`, up to 5,685 px |
| Artwork with no mesh | `ZBUFFER_EXCESS` |
| Surface with no artwork | `ZBUFFER_MISSING` |
| A client that reverses the live paint order | `check` fails with `ZBUFFER_ORDER` |
| No WebGL2 | `check` fails with `ZBUFFER_UNAVAILABLE`; it does not pass unchecked |

Reproduce with `npm run test:zbuffer` (`out/reports/zbuffer/report.json`).

Limits: fills only, not strokes; interior pixels only; a fault that exists only between swept states can pass (`check` samples nine positions per input); figures with no controller or stage report `not applicable`.

## The fault it found

The check found one ordering defect that the existing 36×24 ray grid passed. Two parts overlapping only along a thin annulus rim can fall between the ray samples, because the rim is the only concave case: the overlap region's samples land in the hole.

| Rim width / height, box size | States | Misordered before | After rim sampling |
| --- | --- | --- | --- |
| 0.6 / 2, 34 | 540 | 0 | 0 |
| 0.3 / 0.5, 60 | 540 | 0 | 0 |
| 0.15 / 0.3, 70 (scale 4) | 540 | 164 (up to 2,156 px) | 0 |

`relation()` now adds samples along the annulus rim, inside the overlap. No example changed its findings, and `test:zbuffer` keeps a 126-state regression for the hairline case.

## Why not plane-based ordering

- **Correctness.** Ray sampling was limiting in one case, and targeted samples closed it. All other parts are convex, so an overlap between them contains samples that reach both.
- **Speed.** A CPU profile of live updates puts `firstFrontHit` at 6–14% of the time. Most of it is `relation` in merging surfaces (38%) and `num` in the rack (27%). Replacing the rays would not noticeably change frame time. Medians are dial 2 ms, exploded 8 ms, rack 17 ms, spring 58 ms and merging surfaces 113 ms.
- **Risk.** Curved and concave surfaces have no single separating plane, so rays would have to stay as a fallback, leaving two ordering paths to keep consistent.

Reopen this if the depth check reports `ZBUFFER_ORDER` on a real figure that sampling cannot fix.

## Lazy-context bug found by hosted CI

Run 41133288848 of commit `ebc287a` failed in the candidate job on `gap-followups`: after a lost WebGL context, the figure returned to WebGL instead of staying in its vector fallback. This was a defect in the 0.7.0 lazy contexts, not in the new check.

Reproduced in a Linux container limited to 0.6 CPU, in 1 of 5 runs: during a capture the browser reported a viewport 1 px tall for one frame, so the figure looked scrolled away. Its effects were torn down and reacquired.

Near-viewport tracking now ignores measurements against a collapsed viewport, and only a figure that really left is reacquired on return. After the fix, 14 of 14 throttled runs passed. The collapse occurred in three of them, including the sequence that failed before. An interaction test drives the same sequence deterministically, and a real departure and return still retries a lost context.

## Release evidence

On an Apple M2 with Node 24.22.1 and pinned Chromium 156.0.8078.4: `npm run test:release` passed all 24 groups in one run bound to this package (15.4 minutes), including the new `zbuffer` group and a 16-case interaction suite. `npm run lint` and `npm run test:types` passed. `npm run test:parity` exits 2 as before: technical checks pass, and the four pending requirements (G09, C01, C15, C16) all wait on the historical evaluation archive. Hosted CI [run 41189536149](https://github.com/tobilg/crafted-figures/actions/runs/41189536149) of `2225bf8` then passed all 11 jobs on these changes, including the `gap-followups` step that failed before and all 10 `zbuffer` cases on Linux x64.
