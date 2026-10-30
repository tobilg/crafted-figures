import test from 'node:test';import assert from 'node:assert/strict';
import {resolveConfig} from '../skill/crafted-figures/kit/config.mjs';
import * as k from '../skill/crafted-figures/kit/three/index.mjs';
import {auditScene} from '../skill/crafted-figures/kit/audit/geometry.mjs';
const caps={detail:['compact','standard','detailed'],camera:{default:{azimuth:45,elevation:30,padding:24},views:[{azimuth:45,elevation:30},{azimuth:35,elevation:30},{azimuth:45,elevation:44}]},materials:{subject:'steel'}};
const layers=value=>[{value,label:'input.json'}];
test('v2 preserves v1 rejection and resolves camera/material declarations explicitly',async()=>{
 await assert.rejects(resolveConfig({layers:layers({schemaVersion:1,camera:{azimuth:45}}),capabilities:caps}),/camera/);
 const {config,tokens}=await resolveConfig({layers:layers({schemaVersion:2,camera:{elevation:44},materials:{overrides:{subject:'copper'}}}),capabilities:caps});
 assert.deepEqual(config.camera,{azimuth:45,elevation:44,padding:24});assert.equal(config.materials.overrides.subject,'copper');assert.match(tokens['material-copper-top'],/^#[a-f0-9]{6}$/);
 for(const value of [{camera:{azimuth:90}},{materials:{overrides:{missing:'steel'}}},{materials:{overrides:{subject:'fake'}}},{rendering:{pixelRatioCap:4}},{rendering:{quality:'ultra'}}])await assert.rejects(resolveConfig({layers:layers({schemaVersion:2,...value}),capabilities:caps}));
 const stage=k.createStage({bounds:k.boxBounds([-20,-20,-20],[20,20,20]),config,tokens});stage.scene.add(k.material(k.sphere('ball',{radius:10,steps:12}), 'steel',{role:'subject'}));assert.match(stage.render(),/material-copper-top/);stage.dispose();
});
test('cones, sphere segments, analytic waists and concave extrusion render at qualified views',()=>{
 for(const [azimuth,elevation] of [[45,30],[35,30],[45,44]]){const s=k.createStage({bounds:k.boxBounds([-30,-30,-30],[30,30,30]),azimuth,elevation});
 for(const object of [k.cylinder('cone',{radius:8,topRadius:0,height:15}),k.sphere('ball',{radius:10,steps:12}),k.profile('waist',{zMin:-10,zMax:10,steps:20,radius:z=>5+z*z/20}),k.extrude('cutaway',{plan:[[0,0],[20,0],[20,4],[4,4],[4,20],[0,20]],height:5})]){s.scene.clear();s.scene.add(object);assert.match(s.render(),/data-object/);object.traverse(o=>o.geometry?.dispose());}s.dispose();}
});
test('audits detect clearance, mid-only collision, bad seats/ports and dishonest geometry',()=>{
 const s=k.createStage({bounds:k.boxBounds([-20,-20,-20],[20,20,20])});const a=k.box('a',{width:10,depth:10,height:10}),b=k.box('b',{width:4,depth:4,height:4});s.scene.add(a,b);
 const check=()=>auditScene(s,{clearances:[{a:'a',b:'b'}]});b.position.x=-10;assert.equal(check().status,'passed');b.position.x=10;assert.equal(check().status,'passed');b.position.x=3;assert.ok(check().findings.some(f=>f.code==='SOLID_CLEARANCE'));
 b.position.x=7;k.port(a,'out',{at:[5,0,0],direction:[1,0,0]});k.port(b,'in',{at:[-2,0,0],direction:[-1,0,0]});assert.equal(auditScene(s,{connections:[{a:'a',b:'b',portA:'out',portB:'in'}]}).status,'passed');
 b.position.x=8;let r=auditScene(s,{connections:[{a:'a',b:'b',portA:'out',portB:'in'}],contacts:[{a:'a',b:'b',atA:[5,0,0],atB:[-2,0,0]}]});assert.ok(r.findings.some(f=>f.code==='PORT_TERMINAL'));assert.ok(r.findings.some(f=>f.code==='SUPPORT_SEAT'));
 b.geometry.getAttribute('position').array.fill(0);assert.ok(check().findings.some(f=>f.code==='DRAWING_COVERAGE'));s.dispose();
});
test('audits catch profile fidelity and route fold/self faults; transforms reject shear',()=>{
 const s=k.createStage({bounds:k.boxBounds([-30,-30,-30],[30,30,30])});const p=k.profile('coarse',{zMin:-10,zMax:10,steps:4,tolerance:1,radius:z=>2+z*z/5});p.userData.profile.tolerance=.08;s.scene.add(p);assert.ok(auditScene(s).findings.some(f=>f.code==='PROFILE_FIDELITY'));s.scene.clear();
 const route=k.tube('fold',{points:[[0,0,0],[10,0,0],[0,1,0],[-10,1,0]],radius:3,segments:12});s.scene.add(route);assert.ok(auditScene(s).findings.some(f=>f.code==='ROUTE_FOLD'||f.code==='ROUTE_SELF'));s.scene.clear();
 const box=k.box('sheared',{width:4,depth:4,height:4});box.matrixAutoUpdate=false;box.matrix.makeShear(.5,0,0,0,0,0);s.scene.add(box);assert.throws(()=>s.render(),/shear/);s.dispose();
});
test('projected route crowding and declared surface wobble faults are actionable',()=>{
 const s=k.createStage({bounds:k.boxBounds([-40,-40,-40],[40,40,40]),azimuth:45,elevation:30});const a=k.tube('near',{points:[[-15,0,0],[0,0,0],[15,0,0]],radius:1,segments:8}),b=k.tube('far',{points:[[-15,0,0],[0,0,0],[15,0,0]],radius:1,segments:8});b.position.copy(s.camera.position.clone().normalize().multiplyScalar(12));s.scene.add(a,b);const crowd=auditScene(s,{clearances:[{a:'near-000',b:'far-000'}]});assert.ok(crowd.findings.some(f=>f.code==='ROUTE_CROWDING'));s.scene.clear();const profile=k.profile('wobble',{zMin:0,zMax:10,steps:24,radius:z=>5+Math.sin(z*3)});s.scene.add(profile);const wobble=auditScene(s,{clearances:[{a:'wobble-1',b:'wobble-24'}],profiles:[{part:'wobble',maxSlopeChange:.3}]});assert.ok(wobble.findings.some(f=>f.code==='SURFACE_WOBBLE'));s.dispose();
});

test('interleaved SVG assignments reject a depth-order inversion',()=>{const s=k.createStage({bounds:k.boxBounds([-20,-20,-20],[20,20,20])});const far=k.box('far',{width:8,depth:8,height:8}),near=k.box('near',{width:8,depth:8,height:8});near.position.copy(s.camera.position.clone().normalize().multiplyScalar(12));far.userData.svgAfterLayer=1;s.scene.add(far,near);assert.throws(()=>s.render(),/SVG_LAYER_ORDER/);const r=auditScene(s);assert.ok(r.findings.some(f=>f.code==='PAINTER_ORDER'&&f.message.includes('SVG_LAYER_ORDER')));s.dispose();});

test('surface detail fades toward the silhouette instead of popping at full opacity',()=>{
 const s=k.createStage({bounds:k.boxBounds([-10,-10,-10],[10,10,10]),azimuth:45,elevation:30}),o=k.box('marked',{width:8,depth:8,height:4});s.scene.add(o);
 const mark=k.mark(o,[[-2,0,2],[2,0,2]],{normal:[1,0,0],reason:'printed test rule'});
 const view=s.camera.getWorldDirection(new k.Vector3()).negate(),tangent=new k.Vector3(-view.y,view.x,0).normalize();
 const opacity=cosine=>{mark.normal=tangent.clone().multiplyScalar(Math.sqrt(1-cosine*cosine)).addScaledVector(view,cosine).toArray();const text=s.render(),part=text.match(/<path[^>]*data-line-reason="printed test rule"[^>]*>/)?.[0];return part?Number(part.match(/opacity="([^"]+)"/)?.[1]||1):0;};
 assert.equal(opacity(-.01),0);assert.ok(opacity(.01)<.03);assert.ok(Math.abs(opacity(.06)-.5)<.002);assert.equal(opacity(.2),1);s.dispose();
});
