import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { zipSync } from 'fflate';
import { unpackZip } from '../scripts/unpack-release.mjs';
import { tempDir } from './temp.mjs';

const text = value => new TextEncoder().encode(value);
const executable = { os: 3, attrs: 0o100755 << 16 };

test('restores file bytes, nested folders and executable bits', async () => {
  const dir = await tempDir('crafted-unpack-'),
    repeated = 'stored and deflated entries both round trip '.repeat(200),
    zip = Buffer.from(
      zipSync({
        'skill/run.mjs': [text('#!/usr/bin/env node\n'), executable],
        'skill/a/b/note.txt': [text(repeated), { level: 6 }],
        'skill/empty.txt': [text(''), { level: 0 }],
      }),
    );
  assert.deepEqual(unpackZip(zip, dir).sort(), [
    'skill/a/b/note.txt',
    'skill/empty.txt',
    'skill/run.mjs',
  ]);
  assert.equal(await readFile(path.join(dir, 'skill/a/b/note.txt'), 'utf8'), repeated);
  assert.equal(await readFile(path.join(dir, 'skill/empty.txt'), 'utf8'), '');
  if (process.platform !== 'win32')
    assert.ok((await stat(path.join(dir, 'skill/run.mjs'))).mode & 0o100);
});

test('refuses a path that leaves the destination and a file that is not a ZIP', async () => {
  const dir = await tempDir('crafted-unpack-'),
    escaping = Buffer.from(zipSync({ '../outside.txt': text('no') }));
  assert.throws(() => unpackZip(escaping, dir), /Unsafe ZIP path/);
  assert.throws(() => unpackZip(Buffer.alloc(40), dir), /Not a ZIP file/);
});

test('the command checks the release checksum before unpacking', async () => {
  const dir = await tempDir('crafted-unpack-'),
    zip = Buffer.from(zipSync({ 'crafted-figures/SKILL.md': text('skill') })),
    name = 'crafted-figures-1.2.3.zip',
    run = () =>
      execFileSync(process.execPath, ['scripts/unpack-release.mjs', dir], {
        encoding: 'utf8',
        stdio: 'pipe',
      });
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), zip);
  await writeFile(path.join(dir, `${name}.sha256`), `${'0'.repeat(64)}  ${name}\n`);
  assert.throws(run, /does not match its checksum/);
  const digest = createHash('sha256').update(zip).digest('hex');
  await writeFile(path.join(dir, `${name}.sha256`), `${digest}  ${name}\n`);
  assert.match(run(), /Unpacked 1 files/);
  assert.equal(await readFile(path.join(dir, 'crafted-figures/SKILL.md'), 'utf8'), 'skill');
});
