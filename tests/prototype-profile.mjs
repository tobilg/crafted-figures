import {chromium} from 'playwright';
import {writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const browser=await chromium.launch({args:['--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
try{const page=await browser.newPage({viewport:{width:960,height:1000}});await page.goto(pathToFileURL(path.resolve('out/three-hybrid/light.html')).href);await page.waitForFunction(()=>!!window.__prototype);const result={browser:browser.version(),gpu:await page.evaluate(()=>window.__prototype.gpuInfo()),profiles:await page.evaluate(()=>window.__prototype.profile())};await writeFile('out/three-hybrid/evidence/performance-investigation.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));}finally{await browser.close();}
