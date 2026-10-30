import test from 'node:test';import assert from 'node:assert/strict';
import {effect,surfaceHistory} from '../skill/crafted-figures/kit/effects/index.mjs';
import {measure} from '../examples/ripple-tank/model.mjs';
test('water and caustics consume replayable bounded emission history and reject invalid events',()=>{
 const water=effect('water',{kind:'water'}),caustics=effect('caustics',{kind:'caustics'});
 try{for(let time=0;time<=6;time+=.07){const m=measure({time});assert.deepEqual(m,measure({time}));assert.ok(m.history.every(e=>e.age>=0&&e.age<3.5));surfaceHistory(water,m.history);surfaceHistory(caustics,m.history);assert.deepEqual(water.material.uniforms.uHistory,caustics.material.uniforms.uHistory);}
 assert.throws(()=>surfaceHistory(water,[{x:2,y:0,age:0,amplitude:1}]),/surfaceHistory/);assert.throws(()=>surfaceHistory(water,[{x:0,y:0,age:-1,amplitude:1}]),/surfaceHistory/);assert.throws(()=>surfaceHistory(water,Array(9).fill({x:0,y:0,age:0,amplitude:1})),/at most 8/);
 }finally{water.geometry.dispose();water.material.dispose();caustics.geometry.dispose();caustics.material.dispose();}
});
