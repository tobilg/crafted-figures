import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareGeneratedTree } from './generated-tree.mjs';

export const recipeNames = [
  'sector-gauge',
  'construction-details',
  'dial-indicator',
  'lift-valve',
  'control-cabinet',
  'hinged-arm',
  'spring-probe',
  'merging-surfaces',
  'ripple-tank',
  'turning-mechanism',
  'exploded-assembly',
];
const reactRecipes = ['spring-probe', 'merging-surfaces'];
const sourceFiles = ['figure.mjs', 'scene.mjs', 'client.mjs', 'model.mjs', 'figure.config.json'];

/** Generate only declared recipes. Refuse stale/edited inputs before any writes. */
export async function syncTemplates(root = fileURLToPath(new URL('../', import.meta.url))) {
  const templates = path.join(root, 'skill/crafted-figures/assets/templates');
  async function knownChildren(dir, allowed) {
    let entries;
    try {
      entries = await readdir(dir);
    } catch (error) {
      if (error.code === 'ENOENT') return;
      throw error;
    }
    for (const name of entries)
      if (!allowed.includes(name))
        throw new Error(
          `Unexpected template path: ${path.join(dir, name)}. Preserve or remove obsolete generated recipes before syncing.`,
        );
  }
  await knownChildren(templates, [...recipeNames, 'basic-figure', 'react-next']);
  await knownChildren(path.join(templates, 'react-next/figures'), reactRecipes);
  const plans = [];
  for (const [name, relative] of [
    ...recipeNames.map(n => [n, n]),
    ...reactRecipes.map(n => [n, `react-next/figures/${n}`]),
  ]) {
    const names = [...sourceFiles];
    if (['dial-indicator', 'construction-details'].includes(name)) names.push('sheet.mjs');
    const files = Object.fromEntries(
      await Promise.all(
        names.map(async file => [file, await readFile(path.join(root, 'examples', name, file))]),
      ),
    );
    plans.push(
      await prepareGeneratedTree(path.join(templates, relative), files, {
        generator: 'crafted-figures-template',
        manifestName: '.crafted-generated.json',
        adoptIdentical: true,
      }),
    );
  }
  for (const plan of plans) await plan.commit();
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await syncTemplates();
