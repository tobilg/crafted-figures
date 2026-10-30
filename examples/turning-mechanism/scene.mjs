import {measure,releasedSpark} from './model.mjs';
export function createScene({kit,config,tokens}){const k=kit.illustration,s=k.createStage({width:640,height:440,reservedBottom:45,bounds:k.boxBounds([-64,-38,-8],[88,95,88]),config,tokens});
 const add=(o,p)=>{o.position.set(...p);s.scene.add(o);return o;};k.material(add(k.box('base',{width:152,depth:133,height:8,radius:6}),[12,28.5,-4]),'gunmetal',{role:'base'});
 add(k.cylinder('pedestal',{radius:12,height:36}),[-45,0,18]);const shoulder=new k.Group();shoulder.name='shoulder';shoulder.position.set(-45,0,36);s.scene.add(shoulder);
 const first=k.box('first-link',{width:60,depth:10,height:5,radius:2});first.position.set(28,0,2.5);shoulder.add(first);k.material(first,'steel',{role:'links'});
 const elbow=new k.Group();elbow.name='elbow';elbow.position.set(56,0,5);shoulder.add(elbow);const second=k.box('second-link',{width:46,depth:8,height:5,radius:2});second.position.set(21,0,2.5);elbow.add(second);k.material(second,'brass',{role:'links'});
 const pin=k.cylinder('elbow-pin',{radius:5,height:3});pin.position.z=6.5;elbow.add(pin);
 const tool=k.cylinder('tool',{radius:4,height:6,tone:'accent'});tool.position.set(42,0,8);elbow.add(tool);k.port(tool,'emitter',{at:[0,0,3],direction:[0,0,1]});
 const lamp=kit.effects.effect('lamp',{kind:'glow',size:[15,15,1],theme:config.theme});lamp.position.z=3.1;tool.add(lamp);const lampHeight=.02,vf=kit.effects.fallback(k.cylinder('lamp-vector',{radius:1.5,height:lampHeight,tone:'accent'}),'lamp');vf.position.z=3+lampHeight/2;tool.add(vf);
 const pad=add(k.cylinder('landing-pad',{radius:9,height:3}),[65,35,1.5]);k.material(pad,'rubber');
 const pool=add(kit.effects.effect('light-pool',{kind:'glow',size:[28,28,1],theme:config.theme,layer:0,intensity:.5}),[65,35,3.05]);pool.userData.craftedEffect.billboard=false;
 const poolVector=add(kit.effects.fallback(k.annulus('light-pool-vector',{radius:8,innerRadius:7.4,height:.1,tone:'accent'}),'light-pool'),[65,35,3.06]);
 const sparkVectors=Array.from({length:6},(_,i)=>{const o=kit.effects.fallback(k.cylinder('spark-vector-'+i,{radius:.55,height:.12,segments:24,tone:'accent'}),'spark-'+i);s.scene.add(o);return o;});
 const sparks=Array.from({length:6},(_,i)=>{const o=kit.effects.effect('spark-'+i,{kind:'spark',size:[3,3,1],theme:config.theme,layer:1});s.scene.add(o);return o;});
 const worldPose=(turn,bend)=>{shoulder.rotation.z=turn;elbow.rotation.z=bend;s.scene.updateMatrixWorld(true);return {point:new k.Vector3(42,0,8).applyMatrix4(elbow.matrixWorld),quaternion:elbow.getWorldQuaternion(new k.Quaternion())};};
 const releasePose=worldPose(-Math.PI/6,Math.PI/3),landing=new k.Vector3(65,35,6);
 // Cache each emission in world space at its own birth, never the current emitter.
 const origins=sparks.map((_,i)=>{const m=measure({time:1.4+i*.18});return worldPose(m.turn,m.bend).point.add(new k.Vector3(0,0,3)).toArray();});
 function update(state){const m=measure(state);shoulder.rotation.z=m.turn;elbow.rotation.z=m.bend;if(m.time<m.release){if(tool.parent!==elbow)elbow.add(tool);tool.position.set(42,0,8);tool.quaternion.identity();}else{if(tool.parent!==s.scene)k.reparentKeepingWorld(tool,s.scene);tool.position.copy(releasePose.point).lerp(landing,m.travel);tool.position.z+=18*Math.sin(Math.PI*m.travel);tool.quaternion.copy(releasePose.quaternion).slerp(new k.Quaternion(),m.travel);}s.scene.updateMatrixWorld(true);
 sparks.forEach((o,i)=>{const p=releasedSpark(m.time,i,origins[i]);o.visible=!!p;const vector=sparkVectors[i];vector.visible=!!p&&p.intensity>0;if(p){o.position.set(...p.position);o.material.uniforms.uIntensity.value=p.intensity;vector.position.set(...p.position);// The lamp core represents an emission until a separate glyph clears its
 // physical envelope. Grow the glyph within measured clearance; never bias
 // it toward the camera or permit it to intersect the emitting solid.
 const local=tool.worldToLocal(new k.Vector3(...p.position)),clearance=Math.max(local.z-vf.position.z-lampHeight/2,Math.hypot(local.x,local.y)-4),scale=Math.min(Math.sqrt(p.intensity),Math.max(0,clearance)/.56);vector.visible=scale>1e-4;vector.scale.setScalar(Math.max(1e-5,scale));}});return m;}
 return {...s,update,tool,origins};}
