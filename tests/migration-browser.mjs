import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import os from 'node:os';
import {buildFigure} from '../skill/crafted-figures/kit/build.mjs';
import {checkOutput,launchBrowser} from '../skill/crafted-figures/kit/verify.mjs';
import {crop4,contactSheet} from './images.mjs';
const cases=[['lift-valve','liftMm',[0,6,12],'seat'],['control-cabinet','temperatureC',[10,30,50],'bridge-1'],['hinged-arm','bendDeg',[0,45,90],'elbow']];
const root=resolve('out/reports/migration-browser');await mkdir(root,{recursive:true});
const report={status:'failed',environment:{node:process.version,platform:os.platform(),arch:os.arch()},checks:[],errors:[],network:[]};let browser;
try{
 browser=await launchBrowser();report.environment.browser=browser.version();
 for(const [name,key,values,detailPart] of cases){
  const {measure}=await import(`../examples/${name}/model.mjs`),images=[];
  for(const preset of ['technical','editorial'])for(const theme of ['light','dark']){
   const out=`out/migration-browser/${name}-${preset}-${theme}`;await buildFigure({entry:`examples/${name}/figure.mjs`,config:`examples/${name}/figure.config.json`,overrides:{preset,theme,output:'both',motion:{enabled:false}},out});
   for(const width of [390,960]){
    const label=`${name}-${preset}-${theme}-${width}`,context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'}),page=await context.newPage();
    page.on('pageerror',e=>report.errors.push(`${label}: ${e.message}`));page.on('console',m=>{if(m.type()==='error')report.errors.push(`${label}: ${m.text()}`);});
    await context.route('**/*',route=>{const u=new URL(route.request().url());if(!['file:','data:'].includes(u.protocol)){report.network.push(u.href);route.abort();}else route.continue();});
    await page.goto(pathToFileURL(resolve(out,'figure.html')).href);await page.locator('input').waitFor();const input=page.locator('input');
    assert.equal(await page.locator('[data-part=static-readout]').textContent(),measure({[key]:values[0]}).reading);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    const full=join(root,label+'.png');await page.screenshot({path:full,fullPage:true});
    await input.focus();assert.equal(await input.evaluate(el=>getComputedStyle(el).outlineStyle),'solid');
    for(const [press,value] of [['End',values[2]],['Home',values[0]]]){await input.press(press);assert.equal(await page.locator('[data-live-readout]').textContent(),measure({[key]:value}).reading);}
    for(const value of values){await input.fill(String(value));assert.equal(await page.locator('[data-part=static-readout]').textContent(),measure({[key]:value}).reading);assert.equal(await page.evaluate(()=>document.querySelector('article').__motion.stats.pending),false);}
    const b=await page.locator('svg').boundingBox();await page.mouse.click(b.x+b.width/2,b.y+b.height/2);assert.equal(Number(await input.inputValue()),values[1]);assert.equal(await page.locator('[data-live-readout]').textContent(),measure({[key]:values[1]}).reading);
    const positions=await page.evaluate(name=>{const s=document.querySelector('article').__stage;if(name==='lift-valve')return {gap:s.poppet.position.z-2-s.seat.position.z-5};if(name==='control-cabinet')return {closed:s.bridges.filter(o=>o.position.z===64.75).length};const p=s.tool.getWorldPosition(s.tool.position.clone());return {reachX:p.x+60,reachY:p.y};},name);
    if(name==='lift-valve')assert.equal(positions.gap,6);else if(name==='control-cabinet')assert.equal(positions.closed,2);else {const m=measure({bendDeg:45});assert.ok(Math.abs(positions.reachX-m.reachX)<1e-6&&Math.abs(positions.reachY-m.reachY)<1e-6);}
    for(const [i,value] of values.entries()){await page.locator('[data-pose]').nth(i).click();assert.equal(await page.locator('[data-live-readout]').textContent(),measure({[key]:value}).reading);}
    await input.fill(String(values[1]));
    if(width===960){const stage=join(root,label+'-stage.png');await page.locator('svg').screenshot({path:stage});images.push(stage);const part=await page.locator(`[data-object="${detailPart}"]`).boundingBox(),x=Math.max(0,Math.floor(part.x-b.x-45)),y=Math.max(0,Math.floor(part.y-b.y-45));await crop4(stage,join(root,label+'-contact-4x.png'),{x,y,width:Math.min(180,Math.floor(b.width)-x),height:Math.min(160,Math.floor(b.height)-y)});}
    const cleanup=await page.evaluate(()=>{const r=document.querySelector('article'),s=r.__stage,m=r.__motion;let geometries=0,disposed=0;s.scene.traverse(o=>{if(o.geometry){geometries++;o.geometry.addEventListener('dispose',()=>disposed++);}});r.__craftedCleanup();r.__craftedCleanup();return {geometries,disposed,children:s.scene.children.length,pending:m.stats.pending,controls:r.querySelectorAll('input,button').length};});assert.equal(cleanup.disposed,cleanup.geometries);assert.equal(cleanup.children,0);assert.equal(cleanup.pending,false);assert.equal(cleanup.controls,0);
    report.checks.push({name:label,status:'passed',positions,cleanup});await context.close();
   }
  }
  await contactSheet(images,join(root,name+'-themes.png'),2);
  const out=`out/migration-browser/${name}-technical-light`;await checkOutput(out,join(root,name+'-portable'));
  const nojs=await browser.newContext({javaScriptEnabled:false}),page=await nojs.newPage();await page.goto(pathToFileURL(resolve(out,'figure.html')).href);assert.equal(await page.locator('input,button').count(),0);assert.equal(await page.locator('[data-part=static-readout]').textContent(),measure({[key]:values[0]}).reading);await nojs.close();
 }
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.network,[]);report.status='passed';
}catch(e){report.errors.push(e.stack);process.exitCode=1;}finally{await browser?.close();await writeFile(join(root,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(`${report.status}: ${root}`);if(report.status!=='passed')console.error(report.errors.join('\n'));}
