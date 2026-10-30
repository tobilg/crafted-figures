import {readFile,readdir,lstat} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const directories=['agents','licenses','references','assets','scripts','kit','types'];
/** Files that never belong in an installed skill or a portable source bundle. */
export function localArtifact(name){
 return name.split('/').some(part=>
  ['node_modules','.git','.agents','.codex','.aws','.ssh','out','dist','coverage','test-results','playwright-report','blob-report','.auth','.npm','.vite','.turbo','.idea','.vscode','.local-browsers','.cache','.next','.DS_Store','Thumbs.db','Desktop.ini','.npmrc','.crafted-generated.json'].includes(part)||
  part.startsWith('._')||/^\.env(?:\.|$)/.test(part)&&!/^\.env(?:\..+)?\.(?:example|sample)$/.test(part)||
  /(?:\.log(?:\..*)?|\.tsbuildinfo|\.pem|\.key|\.p12|\.pfx|\.sw[op]|~)$/.test(part));
}
/** Shared package/bundle boundary. Runtime bytes come only from its manifest.
 * @param {string} root
 * @returns {Promise<Record<string,Buffer>>}
 */
export async function collectSkillFiles(root){
 const files={};
 async function read(name){
  if(name.startsWith('/')||name.includes('\\')||name.split('/').some(p=>!p||p==='.'||p==='..'))throw new Error(`Unsafe package path: ${name}`);
  const parts=name.split('/');for(let i=1;i<=parts.length;i++)if((await lstat(path.join(root,...parts.slice(0,i)))).isSymbolicLink())throw new Error(`Package files must not be symlinks: ${name}`);
  const file=path.join(root,name);if(!(await lstat(file)).isFile())throw new Error(`Package file must be regular: ${name}`);
  files[name]=await readFile(file);return files[name];
 }
 async function walk(dir){
  if((await lstat(path.join(root,dir))).isSymbolicLink())throw new Error(`Package directory must not be a symlink: ${dir}`);
  for(const e of (await readdir(path.join(root,dir),{withFileTypes:true})).sort((a,b)=>a.name<b.name?-1:1)){
   const name=dir+'/'+e.name;if(localArtifact(name))continue;
   if(e.isSymbolicLink())throw new Error(`Package files must not be symlinks: ${name}`);
   if(e.isDirectory())await walk(name);else await read(name);
  }
 }
 for(const name of ['SKILL.md','package.json','package-lock.json','THIRD_PARTY_NOTICES.md'])await read(name);
 for(const name of directories)await walk(name);
 const manifest=JSON.parse((await read('runtime/manifest.json')).toString());
 if(manifest.generator!=='crafted-figures-runtime'||!manifest.files)throw new Error('Missing generated runtime manifest; build the skill package first');
 for(const [name,hash] of Object.entries(manifest.files)){
  // dist/ is a required Vite layout; all other local-artifact rules still apply.
  if(localArtifact(name.replace(/^vite\/dist\//,'vite/')))throw new Error(`Local artifact in runtime manifest: ${name}`);
  if(digest(await read('runtime/'+name))!==hash)throw new Error(`Runtime file changed: ${name}; rebuild the skill package`);
 }
 return Object.fromEntries(Object.entries(files).sort(([a],[b])=>a<b?-1:1));
}
