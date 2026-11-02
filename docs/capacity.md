# Measured capacity

Measured for 0.7.0 by `npm run bench:capacity` on an Apple M2 with Node 24.22.1, Chromium 156.0.8078.4 and software WebGL (ANGLE/SwiftShader). These are measurements, not a frame-rate guarantee, and **the 33 ms budget remains deferred**.

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

Reproduce with `npm run bench:capacity` after the setup in the [README](../README.md).
