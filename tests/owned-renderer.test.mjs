import test from 'node:test';
import assert from 'node:assert/strict';
import {access} from 'node:fs/promises';
import * as kit from '../skill/crafted-figures/kit/index.mjs';
import {resolveConfig} from '../skill/crafted-figures/kit/config.mjs';
import {createGauge} from '../examples/sector-gauge/scene.mjs';
const k=kit.illustration,near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
test('0.5: retired projection toolkit is absent, with no compatibility reexports',async()=>{
  assert.deepEqual(Object.keys(kit).sort(),['effects','escapeText','illustration','registerController','scalarMotion']);
  for(const name of ['kit/anatomy/iso-kit.mjs','types/anatomy/iso-kit.d.mts'])await assert.rejects(access(new URL('../skill/crafted-figures/'+name,import.meta.url)),/ENOENT/);
});
test('partial scales include both endpoints, signed sweeps and compact endpoints',()=>{
  for(const span of [Math.PI,-Math.PI,2*Math.PI,-2*Math.PI])for(const compact of [false,true]){
    const face=k.cylinder('face',{radius:12,height:2});
    try{
      const from=Math.PI/4;k.ticks(face,{radius:10,z:1,count:6,every:4,from,span,compact});
      const details=face.userData.illustration.details,closed=Math.abs(span)===2*Math.PI;
      const indices=Array.from({length:closed?6:7},(_,i)=>i).filter(i=>!compact||i%4===0||(!closed&&i===6));
      assert.equal(details.length,indices.length);
      details.forEach((d,j)=>{const i=indices[j],angle=from+i*span/6;
        near(d.points[1][0],10*Math.sin(angle));near(d.points[1][1],-10*Math.cos(angle));
        near(Math.hypot(d.points[0][0],d.points[0][1]),10-(i%4?1.7:4));
      });
      const first=details[0].points[1],last=details.at(-1).points[1];assert.ok(Math.hypot(first[0]-last[0],first[1]-last[1])>1);
    }finally{face.geometry.dispose();face.material.dispose();}
  }
});
test('invalid scale settings fail before mutating surface annotations',()=>{
  const face=k.cylinder('face',{radius:12,height:2});
  for(const invalid of [{radius:0},{z:NaN},{from:Infinity},{span:0},{span:7},{count:0},{count:2.5},{every:0},{major:11},{minor:-1},{compact:'yes'}]){
    assert.throws(()=>k.ticks(face,{radius:10,z:1,...invalid}),/ticks/);
    assert.equal(face.userData.illustration.details.length,0);
  }
  face.geometry.dispose();face.material.dispose();
});
test('partial gauge uses the same native transforms in both detail modes and all 101 states',async()=>{
  for(const detail of ['compact','standard']){
    const {config}=await resolveConfig({layers:[{label:'test',value:{detail}}]}),stage=createGauge({kit,config});
    try{
      const marks=stage.face.userData.illustration.details.filter(d=>d.points?.length===2&&d!==stage.pointer);
      assert.equal(marks.length,detail==='compact'?7:49);
      for(let percent=0;percent<=100;percent++){
        const m=stage.update({percent}),end=stage.pointer.points[1];
        near(Math.atan2(end[0],-end[1])*180/Math.PI,m.angleDeg);
        assert.equal(m.reading,`${percent}%`);
        assert.match(stage.render(),/data-object="scale"/);
      }
      // Surface marks and labels follow the same parent transform as geometry.
      const before=stage.render();stage.face.rotation.z=.2;const after=stage.render();assert.notEqual(before,after);
      const world=stage.face.localToWorld(new k.Vector3(...stage.pointer.points[1]));
      const projected=stage.renderer.project(world,stage.camera);assert.ok(projected.every(Number.isFinite));
      assert.ok(after.includes(projected.map(n=>Number(n.toFixed(3))).join(' ')));
    }finally{stage.dispose();}
  }
});
