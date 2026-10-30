import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {zipSync} from 'fflate';
import {historicalEvaluations,evidenceManifestPath} from '../tests/historical-evidence.mjs';

const args=process.argv.slice(2),options={};
for(let i=0;i<args.length;i+=2){if(!['--source','--out'].includes(args[i])||!args[i+1])throw new Error('Usage: npm run evidence:pack -- --source <original-evaluation-directory> --out <archive-directory>');options[args[i].slice(2)]=args[i+1];}
if(!options.source||!options.out)throw new Error('Explicit --source and --out are required');
await historicalEvaluations(options.source);
const manifest=JSON.parse(await readFile(evidenceManifestPath));
const files=Object.fromEntries(await Promise.all(Object.keys(manifest.files).sort().map(async name=>[name,[await readFile(path.join(options.source,name)),{os:3,attrs:0o100644<<16}]])));
const bytes=zipSync(files,{level:6,mtime:new Date(1980,0,1)}),sha256=createHash('sha256').update(bytes).digest('hex');
await mkdir(options.out,{recursive:true});const file=path.join(options.out,manifest.archiveName);
await writeFile(file,bytes);await writeFile(file+'.sha256',`${sha256}  ${manifest.archiveName}\n`);
console.log(`Historical records only; not current-package qualification.\n${file}\nSHA-256 ${sha256}`);
