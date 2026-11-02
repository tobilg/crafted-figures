import assert from 'node:assert/strict';
import test from 'node:test';
import { outlineOf } from '../skill/crafted-figures/kit/three/renderer.mjs';

const square = (x, y, size = 1) => [
  [x, y],
  [x + size, y],
  [x + size, y + size],
  [x, y + size],
];
const loopsOf = path =>
  path
    .split('Z')
    .filter(Boolean)
    .map(loop =>
      loop
        .slice(1)
        .split('L')
        .map(point => point.split(' ').map(Number)),
    );
/** The nonzero winding number, which decides what a clip path covers. */
function winding(polygons, x, y) {
  let total = 0;
  for (const polygon of polygons)
    for (const [i, [ax, ay]] of polygon.entries()) {
      const [bx, by] = polygon[(i + 1) % polygon.length],
        side = (bx - ax) * (y - ay) - (x - ax) * (by - ay);
      if (ay <= y && by > y && side > 0) total++;
      else if (ay > y && by <= y && side < 0) total--;
    }
  return total;
}

test('neighbouring polygons merge into their outer edges', () => {
  assert.equal(outlineOf([square(0, 0), square(1, 0)]), 'M0 0L1 0L2 0L2 1L1 1L0 1Z');
});

test('a ring of polygons keeps its hole', () => {
  const ring = [];
  for (let x = 0; x < 3; x++)
    for (let y = 0; y < 3; y++) if (x !== 1 || y !== 1) ring.push(square(x, y));
  const loops = loopsOf(outlineOf(ring));
  assert.equal(loops.length, 2);
  assert.equal(winding(loops, 1.5, 1.5), 0);
  assert.equal(winding(loops, 0.5, 0.5), 1);
});

test('overlaps and separate pieces are kept, and empty edges are dropped', () => {
  assert.equal(loopsOf(outlineOf([square(0, 0, 2), square(1, 1, 2)])).length, 2);
  assert.equal(loopsOf(outlineOf([square(0, 0), square(5, 5)])).length, 2);
  assert.equal(
    outlineOf([
      [
        [0, 0],
        [0, 0],
        [1, 0],
        [1, 1],
      ],
    ]),
    'M0 0L1 0L1 1Z',
  );
  assert.equal(outlineOf([]), '');
});

test('covers exactly the same region as the polygons it replaces', () => {
  // A deterministic patchwork with holes, with vertices on the rounding grid shared by neighbours.
  let seed = 7;
  const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 2 ** 32;
    },
    polygons = [];
  for (let x = 0; x < 24; x++)
    for (let y = 0; y < 24; y++)
      if (random() > 0.25) polygons.push(square(x * 0.75, y * 0.75, 0.75));
  polygons.push(square(3.25, 3.25, 6));
  const loops = loopsOf(outlineOf(polygons));
  assert.ok(
    loops.flat().length < polygons.flat().length,
    'merging removes the shared internal edges',
  );
  for (let i = 0; i < 4000; i++) {
    const x = random() * 18,
      y = random() * 18;
    assert.equal(winding(loops, x, y), winding(polygons, x, y), `winding at ${x} ${y}`);
  }
});
