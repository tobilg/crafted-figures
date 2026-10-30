# Measured capacity

## Current, 0.7.0

Measured by `npm run bench:capacity` on an Apple M2 with Node 24.22.1, Chromium 156.0.8078.4 and software WebGL (ANGLE/SwiftShader). These are measurements, not a frame-rate guarantee, and **the 33 ms budget remains deferred**.

| Workload | Solids | Input median / p95 (ms) | Update-to-next-frame median / p95 (ms) | HTML bytes |
| --- | ---: | ---: | ---: | ---: |
| dial-indicator | 21 | 1.6 / 2.0 | 16.7 / 18.5 | 590,185 |
| dense-cutaway | 702 | static | 16.7 / 18.4 | 1,505,837 |
| dense-rack | 381 | 17.7 / 20.0 | 22.6 / 26.6 | 1,421,773 |
| Mixed Next page (five figures, four-control batch) | 815 | 206 / 225 | 258 / 296 | 3,861,707 server HTML |

Compared on this same machine, in Node and without a browser, one renderer update fell as follows when 0.7.0's changes landed:

| Scene | Meshes | 0.6.1 | 0.7.0 live |
| --- | ---: | ---: | ---: |
| Dial | 21 | 16 ms | 4 ms |
| Dense rack | 381 | 130 ms | 36 ms |
| Exploded assembly | 350 | 47 ms | 11 ms |
| Spring probe | 307 | 512 ms | 95 ms |
| Merging surfaces | 71 | 3,034 ms | 121 ms |

The mixed page's four-control batch took 4,592 ms median on this machine before these changes. Its effect figure now keeps its two WebGL contexts only while near the viewport, which also removes that work while it is offscreen. Across ten navigation cycles the page again held stable node, listener and context counts.

The costs that mattered were triangle tests in `Mesh.raycast` (70–91% of moving-scene CPU) and building cache keys (about 60% of an unchanged redraw). Live drawing now uses a dedicated ray test, trusts its first ray per pair, reuses results for pairs moving rigidly together, and finds overlapping pairs with a sweep instead of testing all of them. Output is unchanged: a test compares incremental rendering with a fresh render at sampled states of every example, and another compares the ray test with native Three.js rays. Verification tools still sample every overlap (`renderer.verifyOrder`).

Dense changing geometry is still the costly case: merging surfaces rebuilds its geometry on every update. A page can show about eight two-layer effect figures at once, because each layer holds a WebGL context while on or near the screen and Chromium keeps 16. Hardware GPUs, mobile devices, other browsers and larger workloads remain unmeasured.

## Historical, 0.3.1

The rest of this page preserves the original measurements and links to their frozen reports. They ran on an Intel Core i5-8257U, so they should not be compared directly with the figures above.

The final four workloads passed their functional, finite-geometry and lifecycle checks. **The 33 ms budget remains deferred.** The timings below are measurements, not a frame-rate guarantee. In particular, dense changing geometry is slow on this tested machine; the successful capacity gate does not hide that limitation.

Standalone workloads (local evidence: `out/history/pre-vite-0.3.1/reports/capacity/report.json`) and mixed-page report (local evidence: `out/history/pre-vite-0.3.1/reports/capacity-mixed/report.json`) ran sequentially with no other project verification/build job running: Node 22.12.0, Chromium 156.0.8078.4, Darwin x64, Intel Core i5-8257U @ 1.40 GHz, no CPU throttling, ANGLE/Vulkan SwiftShader. Other host applications were not controlled. Standalone viewport: 960×850 CSS px, DPR 2, no effect canvases. Mixed page: 960×900, DPR 1, configured raster DPR cap 1.5, two WebGL canvases/passes and two interleaved SVG passes. Both measured drawing buffers are 854×560 pixels for approximately 854×560 CSS pixels at DPR 1. The 1.5 cap is resolved configuration; higher-DPR registration/cap behavior has separate production-effect evidence. No hardware-versus-implementation causal comparison was performed.

| Workload / measured pose | Solids | Triangles | Routes / pieces | SVG nodes | Moved meshes / groups | Input median / p95 (ms) | Update-to-next-frame median / p95 (ms) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| dial-indicator | 21 | 6,600 | 0 / 0 | 314 | 3 / 0 | 35.2 / 43.0 | 36.9 / 44.7 |
| dense-cutaway | 702 | 42,952 | 50 / 600 | 5,370 | 0 / 0 | N/A (static) | 16.6 / 17.3 |
| dense-rack | 381 | 33,980 | 4 / 80 | 3,326 | 200 / 0 | 206.5 / 228.8 | 219.8 / 243.5 |
| Mixed Next page (five figures) | 815 | 114,292 | 2 / 480 | 5,505 | 232 / 3 | 8778.0 / 10107.6 | 8976.8 / 10238.3 |

Counts are actual scene/DOM measurements at the recorded pose. Moving counts compare world transforms; replaced geometry is separate. The two springs each replace 240 stable pieces; the morph replaces 66 existing pieces and changes its part count as surfaces separate. Route pieces in the mixed page are the two swept coils. The server-only dial has 21 solids, 6,600 triangles, 313 SVG nodes, no controls/controller/canvas and a 5.00 mm static reading.

Each standalone workload samples 64 immediate updates; the static cutaway's zero input time means no input work, not infinite rendering speed. The mixed workload samples 20 batches, each dispatching native range-input events across all four live figures, with reduced motion. Its 8.8-second median is for the whole four-control batch. Latency includes synchronous displayed-state, geometry, ordering and DOM work. Frame duration includes that work plus waiting for the next animation callback; it is not a compositor presentation timestamp or proof of smooth animation. Historical wait-only measurements are retained and are not relabeled as complete frame timing.

| Workload | First / warm build (ms) | HTML / SVG bytes | Audit (ms) | DOM mutations |
| --- | ---: | ---: | ---: | ---: |
| dial-indicator | 404.1 / 281.9 | 826,259 / 185,191 | 267.8 | 500 |
| dense-cutaway | 1067.5 / 922.8 | 1,452,191 / 1,446,236 | 1002.9 | 0 |
| dense-rack | 656.1 / 639.5 | 1,650,890 / 1,006,677 | 523.6 | 12,656 |
| Mixed Next production page | 22718.1 / 16290.8 | 3,745,375 server HTML / 1,569,845 client assets | 476.0 combined painted-order | 14,608 |

Standalone “first” and “warm” builds are two calls in one fresh workload process with installed dependencies and OS caches retained. Next “cold” removes only its reproducible `.next` cache; warm repeats with it retained. Logs and the build definition are in build.json (local evidence: `out/history/pre-vite-0.3.1/reports/capacity-mixed/build.json`). Standalone audits cover actual drawing/route geometry plus a focused clearance pair; full collision/contact acceptance comes from the separate envelope suite. Mixed order checks scroll each subject into view: 100, 100, 112 and 228 visible samples passed. A zero-sample check now fails explicitly; the earlier insufficient probe report is preserved under `capacity-mixed-before-visible-probes`.

Across ten production navigation/GC cycles, one static and four live figures remounted correctly. Each retired instance had no registered controller, canvas or pending frame. Every returned page had one document, 5,541 DOM nodes, 379 listeners, 4,922 live SVG nodes plus 313 static SVG nodes, two canvases and two active GL contexts; settled frame flags were false. Pose-dependent node counts differ from the measurement table because navigation restores the initial merged state. Post-GC JS heap rose from 31.0 MB during warmup to a 32.3 MB peak and ended at 32.1 MB, with a decrease in cycle 8. No continuing resource accumulation was observed over this finite run; this is not a proof about unlimited runtime or driver memory. The standalone `performance.memory` values are coarse, so they do not substitute for these GC samples. The separate development Strict Mode check (local evidence: `out/history/pre-vite-0.3.1/reports/react-dev/report.json`) passed three remount cycles with 16 created and two remaining active GL contexts.

Practical limits are driven by what changes, not merely part count. The 381-part rigid-moving rack is much cheaper than two finely tessellated, rebuilt coils plus a morph. The historical 0.3.0 independent 654-solid source migration measured 3.7–4.4 seconds per synchronous pose update; the current follow-up is reported separately in the compatibility contract. Ray-based painter relations, changing shape construction and SVG serialization are substantial CPU work; software-rendered WebGL adds cost for effect passes. These results do not establish that a hardware GPU would solve the SVG work.

Keep unaffected geometry static, choose an appropriate authored camera/envelope, and use static exports for expensive changing scenes when immediate response matters. Compact detail removes optional ornament while preserving the model. Raster DPR caps and draft effect sampling reduce raster work; they do not remove SVG geometry cost, and draft is not final parity evidence. Do not reduce shape fidelity below what the reviewed output requires or hide faults with detail reduction. Hardware GPUs, mobile devices, alternate browsers/OSes and larger workloads remain unmeasured.

Reproduce with `npm run bench:capacity` after the setup in [README](../README.md). The original measurements and rejected probe/capture evidence remain archived. No numeric replacement budget has been introduced.

These historical 0.3.1 measurements are bound to manifest `7489164d5d00dc5913c024cbeffa022ddc15f7e81e17c5c59244feb03ed26f67` by the capacity receipt (local evidence: `out/history/pre-vite-0.3.1/reports/release/capacity.json`). Historical 0.3.0 numbers remain in `out/history/pre-gap-fixes-0.3.0/reports/`; they are not reused as current receipts.
