import {measure,BLOCKS} from './model.mjs';
/** Manual native-primitives migration. Surface details remain attached to their hosts. */
export function createScene({kit,config}){
 const k=kit.illustration,detail=config.detail==='standard',s=k.createStage({width:600,height:400,azimuth:-42,elevation:30,bounds:[...k.boxBounds([-128,-64,-17],[134,64,0]),[-98,0,124],[84.2,0,104]],padding:{top:25,right:30,bottom:65,left:30},strokeWidth:config.stroke.width});
 const add=(o,x,y,z,p=s.scene)=>{o.position.set(x,y,z);p.add(o);return o;};
 const box=(n,x,y,w,d,z,h,r=1,p=s.scene,tone='surface')=>add(k.box(n,{width:w,depth:d,height:h,radius:r,tone}),x+w/2,y+d/2,z+h/2,p);
 const cyl=(n,x,y,r,z,h,p=s.scene,tone='surface')=>add(k.cylinder(n,{radius:r,height:h,segments:64,tone}),x,y,z+h/2,p);
 const topRing=(o,x,y,z,r)=>k.mark(o,k.ringPoints(r,z,24).map(([a,b,c])=>[a+x,b+y,c]),{closed:true,width:.65});
 const dots=(o,pts,z,r=.45)=>{if(detail)for(const [x,y] of pts)topRing(o,x,y,z,r);};
 const inset=(o,w,d,z,gap=2)=>{if(detail)k.mark(o,[[-w/2+gap,-d/2+gap,z],[w/2-gap,-d/2+gap,z],[w/2-gap,d/2-gap,z],[-w/2+gap,d/2-gap,z]],{closed:true,width:.6});};
 const knurl=(o,r,z0,z1,count)=>{if(detail)for(let i=0;i<count;i++){const a=i*2*Math.PI/count,x=r*Math.cos(a),y=r*Math.sin(a);k.mark(o,[[x,y,z0],[x,y,z1]],{width:.55,normal:[x,y,0],reason:'engraved knurl groove ends on the cylinder side'});}};
 for(const [i,[x,y]] of [[-106,-42],[112,-42],[-106,42],[112,42]].entries()){cyl('foot-pad-'+i,x,y,7,-17,1.6);cyl('foot-'+i,x,y,5.4,-15.4,3.4);}
 const base=box('base',-128,-64,262,128,-12,12,8);inset(base,262,128,6.01,5);if(detail)for(const [x,y] of [[-118,-54],[124,-54],[-118,54],[124,54]]){topRing(base,x-3,y,6.02,2.2);topRing(base,x-3,y,6.03,.5);}
 const ruler=box('ruler-strip',-110,49,230,7,0,.6,1);for(let i=0;i<=55;i++){const x=-111+4*i;k.mark(ruler,[[x,-2.7,.31],[x,-2.7+(i%5?2:3.6),.31]],{width:i%5?.5:.8,reason:'printed ruler graduation'});}dots(ruler,[[-113,0],[113,0]],.31);
 for(const [i,y] of [-20,15].entries()){const rail=box('rail-'+i,2,y,122,5,0,3,1);dots(rail,[[-55,0],[55,0]],1.51,.4);}
 for(const [i,x] of [-3,124].entries()){const stop=box('stop-'+i,x,-23,5,46,0,7,1);dots(stop,[[0,-18],[0,18]],3.51);}
 box('magnet-lower',-112,-20,44,40,0,11,3);const mag=box('magnet-upper',-111.2,-19.2,42.4,38.4,11,13,2.2);inset(mag,42.4,38.4,6.51,2.2);dots(mag,[[-17,-15],[-17,15],[17,-15]],6.52);
 const knob=cyl('magnet-knob',-80,8,6,24,4);knurl(knob,6,-2,2,36);k.mark(knob,[[0,0,2.01],[6,0,2.01]],{width:1,reason:'switch index mark'});cyl('post-seat',-98,0,5,24,4);
 const lower=cyl('post-lower',-98,0,3.2,28,68);for(const z of [60,80])if(detail)for(let i=0;i<32;i++){const a=i*Math.PI*2/32,b=(i+1)*Math.PI*2/32;k.mark(lower,[[3.2*Math.cos(a),3.2*Math.sin(a),z-62],[3.2*Math.cos(b),3.2*Math.sin(b),z-62]],{normal:[Math.cos((a+b)/2),Math.sin((a+b)/2),0],width:.45});}
 box('clamp',-105,-7,14,14,96,12,2.5);cyl('post-upper',-98,0,3.2,108,14);cyl('post-cap',-98,0,3.8,122,2);
 const arm=box('arm',-91,-3,131,6,100,4,2);dots(arm,[[-61.5,0],[60.5,0]],2.01);box('dial-bracket',32,-4,8,8,84,16,1);
 box('clamp-thumb-neck',-99.4,7,2.8,1.8,101,4,.5);const thumb=cyl('clamp-thumb-knob',-98,11.4,2.6,100,6);knurl(thumb,2.6,-3,3,18);
 const carriage=new k.Group();carriage.name='carriage';s.scene.add(carriage);const deck=box('carriage-body',-28,-24,56,48,3,5,3,carriage);dots(deck,[[-22,21.4],[-8,21.4],[8,21.4],[22,21.4]],2.51,.4);if(detail)for(const y of [-15.5,15.5])k.mark(deck,[[-28,y,2.51],[28,y,2.51]],{width:.45});
 BLOCKS.forEach((h,i)=>{const o=box('block-'+(i+1),-24+16*i,-12,15.6,24,8,h,1,carriage,'accent');inset(o,15.6,24,h/2+.01,2);});
 box('carriage-handle-neck',18,24,4,1,4,3,.4,carriage);const handle=cyl('carriage-handle',20,28,3,3,5,carriage);knurl(handle,3,-2.5,2.5,18);
 const tip=cyl('probe-tip',58,0,2.6,26,2.4,s.scene,'accent'),probe=cyl('probe',58,0,1.4,28.4,25.6,s.scene,'accent');cyl('probe-guide',58,0,2.9,54,28);
 // Clip only the two physical mounting faces; the original full circles intersected the brackets.
 let plan=Array.from({length:128},(_,i)=>[20*Math.cos(i*Math.PI/64),20*Math.sin(i*Math.PI/64)]);for(const [limit,sign] of [[-18,1],[19,-1]]){const next=[];for(let i=0;i<plan.length;i++){const a=plan[i],b=plan[(i+1)%plan.length],inside=p=>sign*(p[0]-limit)>=-1e-10;if(inside(a))next.push(a);if(inside(a)!==inside(b)){const t=(limit-a[0])/(b[0]-a[0]);next.push([limit,a[1]+t*(b[1]-a[1])]);}}plan=next;}
 const gauge=add(k.prism('dial',{plan,height:10}),58,0,87);k.mark(gauge,k.ringPoints(17.8,5.01,64),{closed:true});k.ticks(gauge,{radius:17,z:5.02,count:50,every:5,major:2.8,minor:1.3,compact:!detail});if(detail)for(const [x,y] of plan)if(x>-17.99&&x<18.99)k.mark(gauge,[[x,y,1.6],[x,y,5]],{normal:[x,y,0],width:.45,reason:'rim knurl groove'});
 box('dial-adjuster-neck',77,-2.4,4.6,4.8,84,5,1);box('dial-adjuster-cap',81.6,-3.2,2.6,6.4,83.2,6.6,1.2);
 const needle=k.mark(gauge,[[0,3.4,5.04],[0,-16,5.04]],{accent:true,width:1.4,part:'needle'});k.label(gauge,'0.01',{at:[0,9,5.02],size:2.4});cyl('needle-hub',58,0,1.6,92.05,.4);
 function update(state){const m=measure(state);carriage.position.x=m.x;tip.position.z=m.tip+1.2;const z=m.tip+2.4;probe.scale.z=(54-z)/25.6;probe.position.z=(54+z)/2;needle.points=[[-Math.sin(m.angle)*3.4,Math.cos(m.angle)*3.4,5.04],[Math.sin(m.angle)*16,-Math.cos(m.angle)*16,5.04]];s.scene.updateMatrixWorld(true);return m;}
 return {...s,update,carriage,tip,probe,needle};
}
