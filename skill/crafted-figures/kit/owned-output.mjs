import {readFile,writeFile,mkdir,lstat,unlink} from 'node:fs/promises';import path from 'node:path';import {createHash} from 'node:crypto';
export const digest=value=>createHash('sha256').update(value).digest('hex');
/** Transaction preflight: never overwrite unrelated or locally edited files. */
export async function writeOwnedSet(out,files,{generator,manifestName,metadata={}}){
 let prior;try{prior=JSON.parse(await readFile(path.join(out,manifestName),'utf8'));if(prior.generator!==generator)throw new Error(`${manifestName}: unrelated manifest`);}catch(e){if(e.code!=='ENOENT')throw e;}
 const obsolete=Object.keys(prior?.outputHashes||{}).filter(name=>!Object.hasOwn(files,name));
 for(const name of new Set([...Object.keys(files),...obsolete])){if(path.isAbsolute(name)||name.split(/[\\/]/).includes('..'))throw new Error(`Invalid output name ${name}`);try{const file=path.join(out,name),s=await lstat(file);if(!s.isFile()||s.isSymbolicLink()||digest(await readFile(file))!==prior?.outputHashes?.[name])throw new Error(`${file}: unrelated or edited output; choose another destination`);}catch(e){if(e.code!=='ENOENT')throw e;}}
 const manifest={generator,...metadata,outputHashes:Object.fromEntries(Object.entries(files).map(([k,v])=>[k,digest(v)]))};
 await mkdir(out,{recursive:true});for(const [name,value] of Object.entries(files)){await mkdir(path.dirname(path.join(out,name)),{recursive:true});await writeFile(path.join(out,name),value);}for(const name of obsolete)await unlink(path.join(out,name)).catch(e=>{if(e.code!=='ENOENT')throw e;});await writeFile(path.join(out,manifestName),JSON.stringify(manifest,null,2)+'\n');return manifest;
}
