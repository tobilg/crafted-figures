import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
const SKIP = new Set([
  'node_modules',
  'out',
  'dist',
  'reference',
  '.git',
  '.next',
  'regressions',
  'runtime',
]);
function* markdown(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* markdown(file);
    else if (entry.name.endsWith('.md')) yield file;
  }
}
test('relative Markdown links resolve in a fresh clone', () => {
  const broken = [];
  for (const file of markdown('.'))
    for (const [, target] of readFileSync(file, 'utf8').matchAll(/\]\(([^)\s]+)\)/g)) {
      if (/^[a-z]+:/i.test(target) || target.startsWith('#')) continue;
      const resolved = path.join(path.dirname(file), target.split('#')[0]);
      if (!existsSync(resolved)) broken.push(`${file} -> ${target}`);
    }
  assert.deepEqual(broken, []);
});
