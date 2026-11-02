import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { zipSync } from 'fflate';
import { prepareSkill } from './prepare-skill.mjs';
import { collectSkillFiles } from '../skill/crafted-figures/kit/package-files.mjs';
import { verifyRuntime } from '../skill/crafted-figures/scripts/verify-runtime.mjs';
import { prepareGeneratedTree } from './generated-tree.mjs';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
await prepareSkill();
await verifyRuntime();
const src = path.resolve('skill/crafted-figures'),
  dest = path.resolve('dist/crafted-figures');
const files = await collectSkillFiles(src),
  pkg = JSON.parse(files['package.json'].toString());
if (!/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(pkg.version))
  throw new Error('Invalid release version');
const plan = await prepareGeneratedTree(dest, files, {
  generator: 'crafted-figures-package',
  manifestName: 'package-manifest.json',
});
await plan.commit();
files['package-manifest.json'] = plan.manifestBytes;
// Fixed DOS date, sorted paths and normalized modes make release bytes repeatable.
const entries = Object.fromEntries(
  Object.entries(files)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([name, bytes]) => [
      'crafted-figures/' + name,
      [
        bytes,
        {
          os: 3,
          attrs:
            (name === 'scripts/figures.mjs' || name.endsWith('.sh') ? 0o100755 : 0o100644) << 16,
        },
      ],
    ]),
);
const zip = zipSync(entries, { level: 6, mtime: new Date(1980, 0, 1) }),
  filename = `crafted-figures-${pkg.version}.zip`;
await writeFile(path.join('dist', filename), zip);
await writeFile(path.join('dist', filename + '.sha256'), `${hash(zip)}  ${filename}\n`);
console.log(`Assembled ${dest}\nRelease artifact: dist/${filename} (${zip.length} bytes)`);
