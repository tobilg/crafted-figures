// Maintainer follow-up to the archived independent R09 trial. This is not a
// fresh authoring evaluation and never modifies its frozen package or source.
import {buildFigure} from '../skill/crafted-figures/kit/build.mjs';
import {checkOutput,launchBrowser} from '../skill/crafted-figures/kit/verify.mjs';
import {captureCrop} from '../skill/crafted-figures/kit/capture.mjs';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const source=path.resolve(process.argv[2]||'tests/fixtures/regressions/migration'),out='out/reports/source-migration-current';
await mkdir(out,{recursive:true});
const report={status:'running',scope:'Maintainer verification of unchanged R09 author source with current toolkit; separate from frozen fresh-agent evidence',environment:{node:process.version,platform:process.platform},cases:[],errors:[]};let browser;
report.toolkitVersion=JSON.parse(await readFile('skill/crafted-figures/package.json','utf8')).version;
report.packageManifestSHA256=createHash('sha256').update(await readFile('dist/crafted-figures/package-manifest.json')).digest('hex');
try{
 for(const name of ['basic','articulated']){
  const dir=path.resolve(out,name),start=performance.now();await buildFigure({entry:path.join(source,name,'figure.mjs'),config:path.join(source,name,'figure.config.json'),materialFiles:name==='articulated'?['red','green','blue','spark'].map(n=>path.join(source,'materials',n+'.json')):[],out:dir,overrides:{output:'both'}});
  const buildMs=performance.now()-start;await checkOutput(dir,path.join(out,name+'-check'));browser=await launchBrowser();report.environment.browser=browser.version();
  const page=await browser.newPage({viewport:{width:960,height:1050},reducedMotion:'reduce'});page.on('pageerror',e=>report.errors.push(e.message));await page.goto(pathToFileURL(path.join(dir,'figure.html')).href);await page.locator('[data-ready=true]').waitFor();
  await page.screenshot({path:path.join(out,name+'.png'),fullPage:true});await captureCrop(page,{region:[.25,.2,.5,.5],scale:4},path.join(out,name+'-4x.png'));
  const samples=[];if(name==='articulated')for(const state of [{dial:90,lift:1,podTime:0},{dial:180,lift:.5,podTime:.3},{dial:300,lift:.5,podTime:0}]){
   const sample=await page.locator('[data-figure]').evaluate((root,state)=>{const start=performance.now();root.__craftedController.setState(state);return {ms:performance.now()-start,state:root.__craftedController.getState(),solids:root.__stage.renderer.order.length,order:root.__stage.inspectOrder(root)};},state);assert.equal(sample.order.status,'passed',JSON.stringify(sample.order));samples.push(sample);
  }
  report.cases.push({name,buildMs,samples,genericChecks:8});await browser.close();browser=null;
 }
 assert.deepEqual(report.errors,[]);report.status='passed';
}catch(e){report.status='failed';report.errors.push(e.stack);process.exitCode=1;}finally{await browser?.close();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(report.status,report.errors);}
