import {measure} from './model.mjs';
export function createScene({kit,config,tokens}){
 const k=kit.illustration,s=k.createStage({width:800,height:560,bounds:k.boxBounds([-100,-70,-4],[100,90,40]),config,tokens,reservedBottom:36});
 const add=(o,x,y,z)=>{o.position.set(x,y,z);s.scene.add(o);return o;};
 const base=add(k.box('bench',{width:200,depth:160,height:4,radius:4}),0,10,-2);k.material(base,'paper');
 const slab=add(k.beveledSlab('bevel',{width:64,depth:34,height:8,bevel:1.5}),-55,-40,4);k.material(slab,'steel');if(config.detail!=='compact')k.surfaceWeld(slab.children[2],{from:[-22,0,.75],to:[22,0,.75],amplitude:.8,count:12});
 const panel=add(k.ventPanel('vent',{width:52,depth:32,height:3,slots:6}),48,-40,1.5);k.material(panel,'gunmetal');
 const profile=add(k.profile('housing',{zMin:0,zMax:28,steps:16,segments:48,radius:z=>8+7*(z/28-.5)**2}),-64,30,0);k.material(profile,'copper');k.profileSeam(profile,{angle:.8});if(config.detail!=='compact')k.profileGrooves(profile,{every:4});
 const route=k.tube('braided-bend',{points:[[-20,10,10],[-10,10,10],[30,22,10],[60,22,10]],radius:2,segments:40,radialSegments:48});k.routeTexture(route,{kind:'braid',strands:2,turns:6,width:.7});k.material(route,'rubber');s.scene.add(route);
 const left=k.tube('striped-inlet',{points:[[-30,58,12],[-16,58,12],[-4,58,12]],radius:2,segments:8,radialSegments:48}),right=k.tube('striped-outlet',{points:[[4,58,12],[16,58,12],[30,58,12]],radius:2,segments:8,radialSegments:48});
 for(const route of [left,right]){k.routeTexture(route,{kind:'stripe',strands:4,width:1});k.material(route,'brass');s.scene.add(route);}
 const coupling=k.annulus('coupling',{radius:3,innerRadius:2,height:8,segments:48});k.along(coupling,[-4,58,12],[4,58,12]);s.scene.add(coupling);k.material(coupling,'steel');
 k.port(left.children.at(-1),'end',{at:[-4,58,12],direction:[1,0,0],radius:2});k.port(coupling,'in',{at:[0,0,-4],direction:[0,0,-1],radius:2});k.port(coupling,'out',{at:[0,0,4],direction:[0,0,1],radius:2});k.port(right.children[0],'start',{at:[4,58,12],direction:[-1,0,0],radius:2});
 const seat=add(k.saddle('saddle',{radius:5,width:8,depth:12,height:12,segments:48}),65,60,0);seat.rotation.x=Math.PI/2;k.material(seat,'gunmetal');
 const spindle=k.revolve('supported-pipe',{profile:[[-21,5],[-6,5],[6,5],[21,5]],segments:96});k.along(spindle,[65,39,12],[65,81,12]);s.scene.add(spindle);k.material(spindle,'chrome');
 const connections=[{a:left.children.at(-1).name,b:'coupling',portA:'end',portB:'in'},{a:'coupling',b:right.children[0].name,portA:'out',portB:'start'}];
 const seatPart=seat.children.find(o=>{const ring=o.userData.illustration.top;return ring.some((p,i)=>{const q=ring[(i+1)%ring.length];return Math.abs(p[1]-7)<1e-8&&Math.abs(q[1]-7)<1e-8&&Math.min(p[0],q[0])<=0&&Math.max(p[0],q[0])>=0;});});
 if(!seatPart)throw new Error('Saddle contact face is absent');const contacts=[{a:seatPart.name,b:'supported-pipe-2',atA:[0,7,0],atB:[0,5,0]}];
 return {...s,connections,contacts,update:state=>{const m=measure(state);s.scene.rotation.z=m.radians;return m;}};
}
