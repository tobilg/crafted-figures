import { tempDir } from './temp.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import path from 'node:path';
import { preview } from '../skill/crafted-figures/kit/verify.mjs';

test('FR-05: preview opens SVG-only output and confines encoded paths and symlinks', async () => {
  const root = await tempDir('cf-preview-'),
    dir = path.join(root, 'out');
  let server;
  try {
    await mkdir(dir);
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><title>Static preview</title></svg>';
    await writeFile(path.join(dir, 'figure.svg'), svg);
    await writeFile(path.join(root, 'private.txt'), 'outside preview');
    await symlink(path.join(root, 'private.txt'), path.join(dir, 'linked.txt'));
    server = await preview(dir, 0);
    let response = await fetch(server.url);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /image\/svg\+xml/);
    assert.equal(await response.text(), svg);
    for (const request of ['/linked.txt', '/%2e%2e%2fprivate.txt', '/%zz'])
      assert.equal((await fetch(server.url + request)).status, 404);
    await writeFile(path.join(dir, 'figure.html'), '<!doctype html><title>HTML preview</title>');
    response = await fetch(server.url);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /text\/html/);
    assert.match(await response.text(), /HTML preview/);
  } finally {
    await server?.close();
    await rm(root, { recursive: true, force: true });
  }
});
