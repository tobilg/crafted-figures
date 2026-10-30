import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {collectSkillFiles} from './package-files.mjs';
const digest=value=>createHash('sha256').update(value).digest('hex');
/** Hash installed runtime inputs with package-relative names. No dates or paths. */
export async function runtimeIdentity(){
 const source=await collectSkillFiles(fileURLToPath(new URL('../',import.meta.url))),files={};
 for(const [name,bytes] of Object.entries(source))if(['package.json','package-lock.json'].includes(name)||/^(kit|scripts|assets\/presets|runtime)\//.test(name))files[name]=digest(bytes);
 return {dependencyLockHash:files['package-lock.json'],runtimeHash:digest(JSON.stringify(Object.fromEntries(Object.entries(files).sort())))};
}
