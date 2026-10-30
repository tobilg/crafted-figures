import {measure} from './model.mjs';
import {addDetails} from './details.mjs';
import {addLuminous} from './luminous.mjs';
import {createPlate} from './plate.mjs';
const addv=(a,b)=>a.map((x,i)=>x+b[i]),sub=(a,b)=>a.map((x,i)=>x-b[i]),mul=(a,t)=>a.map(x=>x*t),len=a=>Math.hypot(...a),unit=a=>mul(a,1/len(a));
/** Original object dimensions and pivots, manually expressed as native groups. */
export function createScene({kit,config,tokens}){
 const k=kit.illustration,s=k.createStage({width:640,height:470,bounds:[...k.boxBounds([-82,-78,-17],[82,78,0]),[-50,-50,42],[50,50,42]],azimuth:40,elevation:31,padding:24,reservedBottom:54,config,tokens,strokeWidth:config.stroke.width});
 const origins=new Map([[s.scene,[0,0,0]]]);
 const group=(name,origin,parent=s.scene)=>{const g=new k.Group();g.name=name;g.position.set(...sub(origin,origins.get(parent)));parent.add(g);origins.set(g,origin);return g;};
 const put=(o,p,parent=s.scene,mat=null)=>{o.position.set(...sub(p,origins.get(parent)));parent.add(o);if(mat)k.material(o,mat);return o;};
 const box=(n,x,y,w,d,z,h,r=1,p=s.scene,mat=null)=>put(k.box(n,{width:w,depth:d,height:h,radius:r}),[x+w/2,y+d/2,z+h/2],p,mat);
 const cyl=(n,x,y,r,z,h,p=s.scene,mat=null,topRadius=r)=>put(k.cylinder(n,{radius:r,height:h,topRadius,segments:48}),[x,y,z+h/2],p,mat);
 const rod=(n,a,b,r,p,mat='steel',r2=r)=>{const o=k.cylinder(n,{radius:r,topRadius:r2,height:len(sub(b,a)),segments:32});k.along(o,sub(a,origins.get(p)),sub(b,origins.get(p)));p.add(o);k.material(o,mat);return o;};
 const capsule=(n,a,b,r,p,mat='gold')=>{const L=len(sub(b,a)),o=k.profile(n,{zMin:-r,zMax:L+r,steps:12,segments:32,tolerance:.06,radius:z=>z<0?Math.sqrt(Math.max(0,r*r-z*z)):z>L?Math.sqrt(Math.max(0,r*r-(z-L)**2)):r});o.quaternion.setFromUnitVectors(new k.Vector3(0,0,1),new k.Vector3(...unit(sub(b,a))));put(o,a,p,mat);return o;};
 const sphere=(n,p,r,parent,mat='chrome')=>put(k.sphere(n,{radius:r,steps:12,segments:32}),p,parent,mat);
 for(const [i,[x,y]] of [[-60,-56],[60,-56],[-60,56],[60,56]].entries()){cyl('stand.foot.pad.'+i,x,y,7,-17,1.6);cyl('stand.foot.'+i,x,y,5.4,-15.4,3.4);}
 box('stand.base',-82,-78,164,156,-12,12,8);
 for(const [i,[x,y]] of [[-60,-56],[60,-56],[-60,56],[60,56]].entries())cyl('stand.post.'+i,x,y,3.4,0,8);
 for(const part of createPlate(k))put(part,[0,0,9]);
 const wheelAt=[40*Math.cos(40*Math.PI/180),40*Math.sin(40*Math.PI/180),0];cyl('dial.washer',0,0,4.2,0,3.2);cyl('wheel.washer',wheelAt[0],wheelAt[1],6.4,0,3.2);
 const dial=group('dial',[0,0,0]),wheel=group('wheel',wheelAt);
 cyl('lock.pinion',0,0,8,3.2,4,dial,'brass');const wheelDisc=cyl('lock.wheel',wheelAt[0],wheelAt[1],32,3.2,4,wheel,'brass');k.ticks(wheelDisc,{radius:28.8,z:2.01,count:100,every:10,minor:1.2,major:2.4});cyl('lock.wheel.hub',wheelAt[0],wheelAt[1],6,7.2,.5,wheel,'steel');
 cyl('dial.body',0,0,50,10,4.4,dial,'steel');const face=cyl('dial.bevel',0,0,50,14.4,3.2,dial,'steel',46);k.ticks(face,{radius:45.2,z:1.61,count:100,every:10,minor:1.4,major:2.6,compact:config.detail==='compact'});k.mark(face,k.ringPoints(45.2,1.62),{closed:true});
 for(let i=0;i<10;i++){const a=i*Math.PI/5;k.label(face,String(i*10),{at:[Math.sin(a)*39.8,-Math.cos(a)*39.8,1.63],u:[Math.cos(a),Math.sin(a),0],v:[Math.sin(a),-Math.cos(a),0],size:3.4});}
 cyl('dial.hub',0,0,12,17.6,1.8,dial,'chrome');
 const a=220*Math.PI/180,wedge=[[51.2,-.7],[51.2,.7],[57.4,2.6],[57.4,-2.6]].reverse().map(([r,t])=>[Math.cos(a)*r-Math.sin(a)*t,Math.sin(a)*r+Math.cos(a)*t]);put(k.prism('stand.index',{plan:wedge,height:3,tone:'accent'}),[0,0,11.5],s.scene,'brass');
 const pawl=group('pawl',[0,58.3,0]);cyl('pawl.post',0,58.3,2.4,10,1,s.scene,'gunmetal');const ring=[];for(let j=0;j<=10;j++)ring.push([2.2*Math.cos(j*Math.PI/10),2.2*Math.sin(j*Math.PI/10)]);ring.push([-.6,-7.9],[0,-8.15],[.6,-7.9]);const pawlArm=k.extrude('pawl.arm',{plan:ring,height:1.6});put(pawlArm,[0,58.3,11.8],pawl,'chrome');cyl('pawl.pin',0,58.3,1.1,12.6,.7,pawl,'steel');
 box('hand.palm',-18.5,-16.5,30,33,19.4,8,3.2,dial,'gold');box('hand.cover',-15.5,-13.2,26.6,26.4,27.4,1.2,2.6,dial,'gold');box('hand.connector',-15.1,-10.4,4.4,20.8,28.6,5.2,.9,dial,'gunmetal');
 for(const [i,x] of [-5.1,.1].entries())box('hand.saddle.'+i,x,-1.9,2.4,3.8,28.6,.9,.5,dial,'gunmetal');
 rod('piston.body',[-6.1,0,31.9],[2.9,0,31.9],2.4,dial,'gunmetal');const gland=k.profile('piston.gland',{zMin:0,zMax:1.4,steps:12,segments:32,radius:z=>2.3+.55*Math.sqrt(Math.max(0,1-(z/1.4)**2))});gland.quaternion.setFromUnitVectors(new k.Vector3(0,0,1),new k.Vector3(1,0,0));put(gland,[2.9,0,31.9],dial,'brass');rod('piston.rod',[4.3,0,31.9],[8.9,0,31.9],.95,dial,'chrome');box('hand.clevis',8.9,-1.9,2.4,3.8,28.6,5.7,.5,dial,'steel');sphere('hand.ball',[-8.3,0,31.9],2.2,dial);cyl('hand.ball.post',-8.3,0,1.3,28.6,1.1,dial,'steel');
 const fingerGroups=[],fingerTips=[],fingerPorts=[];let fingerGuide,led;
 for(const f of [{id:1,y:-9.2,psi:-13},{id:2,y:0,psi:0},{id:3,y:9.2,psi:13}]){
  const psi=f.psi*Math.PI/180,w=[-Math.sin(psi),Math.cos(psi),0],d1=[Math.cos(psi),Math.sin(psi),0],pitch=a=>[Math.cos(a)*Math.cos(psi),Math.cos(a)*Math.sin(psi),-Math.sin(a)],B=[11.5,f.y,23.4],C1=addv(B,mul(d1,3.7+Math.abs(Math.tan(psi))*3.55)),E1=addv(C1,mul(d1,7.4)),d2=pitch(8*Math.PI/180),C2=addv(E1,mul(unit(addv(d1,d2)),5.3)),J1=mul(addv(E1,C2),.5),E2=addv(C2,mul(d2,5.8));
  const tipOf=a=>{const d3=pitch(a),C3=addv(E2,mul(unit(addv(d2,d3)),5.3));return {C3,E3:addv(C3,mul(d3,3.6)),J2:mul(addv(E2,C3),.5)};};let lo=0,hi=70*Math.PI/180;for(let n=0;n<60;n++){const m=(lo+hi)/2;if(tipOf(m).E3[2]-2.35>17.6)lo=m;else hi=m;}const {C3,E3,J2}=tipOf(hi);
  const flex=f.id===2,g1=flex?group('f2.mcp',C1,dial):dial,g2=flex?group('f2.pip',J1,g1):dial,g3=flex?group('f2.dip',J2,g2):dial;
  capsule('hand.f'+f.id+'.p1',C1,E1,2.35,g1);capsule('hand.f'+f.id+'.p2',C2,E2,2.35,g2);capsule('hand.f'+f.id+'.p3',C3,E3,2.35,g3);
  for(const [joint,J,r,parent] of [['k0',C1,3.7,dial],['k1',J1,3.5,g1],['k2',J2,3.3,g2]])for(const side of [-1,1])rod('hand.f'+f.id+'.'+joint+'.'+side,addv(J,mul(w,side*2.35)),addv(J,mul(w,side*3.55)),r,parent,'chrome');
  fingerTips.push({point:E3,parent:g3,origin:origins.get(g3)});if(flex){fingerGroups.push({g1,g2,g3,w});fingerGuide={C2,d2,w,g2,origin:origins.get(g2)};led={point:addv(E3,mul(unit(sub(E3,C3)),2.35)),normal:unit(sub(E3,C3)),parent:g3,origin:origins.get(g3)};}
  else{const M=mul(addv(C1,E1),.5),j=box('hand.f'+f.id+'.junction',M[0]-2.1,M[1]-1.7,4.2,3.4,M[2]+2.35,6,.3,dial,'gunmetal');j.rotation.z=psi;fingerPorts.push({id:f.id,p:addv(M,addv(mul(d1,-2.1),[0,0,2.35+6*.62])),d1});}
 }
 // Native cut sphere gives the thumb's two flat mating faces.
 const thumb=k.sphere('hand.thumb.knuckle',{radius:3.2,zMin:-2.6,zMax:2.6,steps:12,segments:32});thumb.quaternion.setFromUnitVectors(new k.Vector3(0,0,1),new k.Vector3(0,1,0));put(thumb,[-4,-19.1,23.4],dial,'chrome');rod('hand.thumb.cone',[-4,-21.7,23.4],[-4,-24.7,23.4],1.8,dial,'steel',1.25);capsule('hand.thumb.link',[-4,-26.6,23.4],[-4,-33.1,23.4],1.9,dial);
 cyl('hand.pod.socket',-7,11.4,1.7,28.6,.3,dial,'gunmetal');const pod=group('pod',[-7,11.4,28.9],dial),hex=Array.from({length:6},(_,j)=>[1.35*Math.cos((2*j+1)*Math.PI/6),1.35*Math.sin((2*j+1)*Math.PI/6)]);put(k.prism('hand.pod.nut',{plan:hex,height:1.4}),[-7,11.4,29.6],pod,'brass');cyl('hand.pod.cap',-7,11.4,.9,30.3,.6,pod,'chrome');
 // A preserved 300-degree counterexample requires splitting this circular joint cap.
 // Native extrude decomposes the exact original 32-gon into triangular prisms.
 const cap=s.scene.getObjectByName('hand.f3.k0.1'),splitCap=k.extrude('hand.f3.base-cap',{plan:cap.userData.illustration.top.map(p=>p.slice(0,2)),height:1.2});splitCap.name=cap.name;splitCap.position.copy(cap.position);splitCap.quaternion.copy(cap.quaternion);splitCap.userData.splitCap=true;k.material(splitCap,'chrome');cap.parent.add(splitCap);cap.removeFromParent();cap.geometry.dispose();
 const details=addDetails({k,s,config,dial,wheel,wheelDisc,face,box,cyl,rod,put,fingerPorts,fingerGuide});const luminous=addLuminous({kit,k,s,config,dial,led});
 function update(state){const m=measure(state);dial.rotation.z=m.dial*Math.PI/180;wheel.rotation.z=m.wheel*Math.PI/180;pawl.rotation.z=m.pawl*Math.PI/180;for(const {g1,g2,g3,w} of fingerGroups){for(const [g,key] of [[g1,'f2.mcp'],[g2,'f2.pip'],[g3,'f2.dip']])g.quaternion.setFromAxisAngle(new k.Vector3(...w),m[key]*Math.PI/180);}pod.position.set(-7,11.4,28.9);pod.quaternion.identity();if(m.pod){const {R,t}=m.pod;pod.position.add(new k.Vector3(...t));const trace=R[0]+R[4]+R[8]; // convert supplied rotation via transformed basis, using native Euler quaternion composition
 const phi=m.podTime<.79888?2*Math.PI*(m.podTime/.79888)**2*(3-2*m.podTime/.79888):2*Math.PI,psi=m.podTime<.79888?0:40*Math.PI/180*(1-Math.exp(-(m.podTime-.79888)/.25));pod.quaternion.setFromAxisAngle(new k.Vector3(0,0,1),psi).multiply(new k.Quaternion().setFromAxisAngle(new k.Vector3(1,0,0),phi));void trace;}s.scene.updateMatrixWorld(true);luminous.update(state);const particles=luminous.getParticles().length;return {...m,particles,reading:m.reading+(particles?' · '+particles+' sparks':'')};}
 return {...s,update,dial,wheel,pawl,pod,fingerGroups,fingerTips,led,luminous,...details};
}
