import {Group,Vector3,Quaternion} from '../../runtime/three.mjs';
import {extrude,taperedPrism,box,prism,cylinder,annulus,tube,revolve,along,mark,label,ringPoints,material} from './primitives.mjs';
/** A bore around another visible part needs independently orderable sectors.
 * Each sector is the actual convex portion of the sampled annular mesh.
 * Radial construction edges are omitted, never physical outer/inner boundaries.
 */
export function splitAnnulus(name,{radius,innerRadius,height,segments=64,tone='surface'}){
 if(!(radius>innerRadius&&innerRadius>0)||!Number.isInteger(segments)||segments<16||segments>256)throw new Error('splitAnnulus: positive ordered radii and 16..256 sectors required');
 const group=new Group();group.name=name;
 const point=(r,i)=>[r*Math.cos(i*2*Math.PI/segments),r*Math.sin(i*2*Math.PI/segments)];
 for(let i=0;i<segments;i++){const p=prism(`${name}-${i}`,{plan:[point(radius,i),point(radius,i+1),point(innerRadius,i+1),point(innerRadius,i)],height,tone});p.userData.illustration.perimeterEdges=[true,false,true,false];group.add(p);}return group;
}
/** Small, composable construction recipes. IDs derive from the caller's assembly. */
export function bolt(name,{radius=2,height=2,tone='surface'}={}){const o=cylinder(name,{radius,height,segments:24,tone});mark(o,[[-radius*.65,0,height/2],[radius*.65,0,height/2]],{reason:'engraved screw slot'});return o;}
export function boltCircle(name,{count=6,radius=14,boltRadius=2,z=0}={}){const g=new Group();g.name=name;for(let i=0;i<count;i++){const b=bolt(`${name}-${i}`,{radius:boltRadius});b.position.set(radius*Math.cos(i*2*Math.PI/count),radius*Math.sin(i*2*Math.PI/count),z+1);g.add(b);}return g;}
export function flange(name,{radius=18,bore=9,height=4,count=6}={}){const g=new Group();g.name=name;g.add(annulus(`${name}-body`,{radius,innerRadius:bore,height}),boltCircle(`${name}-bolts`,{count,radius:(radius+bore)/2,boltRadius:1.2,z:height/2}));return g;}
export function knob(name,{radius=10,height=7,count=40}={}){const o=cylinder(name,{radius,height});for(let i=0;i<count;i++){const a=i*2*Math.PI/count,n=[Math.cos(a),Math.sin(a),0];mark(o,[[radius*n[0],radius*n[1],-height*.35],[radius*n[0],radius*n[1],height*.35]],{normal:n,reason:'cut knurl ends on the knob shoulder'});}return o;}
export function ruler(object,{from=[-20,0,1],length=40,count=20,majorEvery=5,direction=[1,0,0],across=[0,1,0],normal=[0,0,1]}={}){for(let i=0;i<=count;i++){const p=from.map((v,j)=>v+direction[j]*length*i/count);mark(object,[p,p.map((v,j)=>v+across[j]*(i%majorEvery?1.5:3))],{normal,reason:'printed graduation'});}return object;}
/** A real helix made from Three's sampled tube geometry, with front/back order. */
export function spring(name,{radius=8,wireRadius=.7,height=24,turns=5,segments=240,radialSegments=32}={}){
 if(!Number.isFinite(turns)||turns<=0||turns>16)throw new Error('spring: turns must be positive and at most 16');
 if(height<=wireRadius*2*turns)throw new Error('spring: coil pitch would self-intersect; increase height or reduce wire radius');
 const samples=Math.ceil(turns*32),points=Array.from({length:samples+1},(_,i)=>{const t=i/samples,a=t*turns*2*Math.PI;return [radius*Math.cos(a),radius*Math.sin(a),Math.min(1,Math.max(0,(t-.06)/.88))*height];});
 return tube(name,{points,radius:wireRadius,segments,radialSegments});
}
/** Tapered connector with an actual bore; ports can be attached to its end pieces. */
export function connector(name,{radius=6,bore=3,height=8}={}){const g=new Group();g.name=name;g.add(annulus(`${name}-sleeve`,{radius,innerRadius:bore,height}));const lip=annulus(`${name}-lip`,{radius:radius*1.2,innerRadius:bore,height:2});lip.position.z=height/2+1;g.add(lip);return g;}
/** Rings use exact route sample frames, so treatment crosses every segment joint. */
export function routeRings(group,{every=3,width=.6}={}){for(let i=0;i<group.children.length;i+=every){const o=group.children[i],m=o.userData.illustration;const top=m.top,center=top.reduce((s,p)=>s.map((x,j)=>x+p[j]/top.length),[0,0,0]);for(let j=0;j<top.length;j++){const next=top[(j+1)%top.length],normal=top[j].map((v,k)=>v-center[k]);mark(o,[top[j],next],{normal,width,reason:'continuous circumferential hose rib'});}}return group;}
/** Face plane is an affine rectangle; the renderer clips all text and rules to it. */
export function display(object,{id,at,width,height,u=[1,0,0],v=[0,-1,0],normal=[0,0,1],text='',size=4}){
 if(!id||!Number.isFinite(width)||width<=0||!Number.isFinite(height)||height<=0)throw new Error('display: id and positive dimensions required');
 const d={id,at,u,v,normal,width,height,text,size,type:'display'};object.userData.illustration.details.push(d);return d;
}

/** Three real solid bands, with shared boundaries and matched audit geometry. */
export function beveledSlab(name,{width,depth,height,bevel=1,tone='surface'}){
 if(![width,depth,height,bevel].every(n=>Number.isFinite(n)&&n>0)||bevel*2>=Math.min(width,depth,height))throw new Error('beveledSlab: positive dimensions; bevel < half every dimension');
 const ring=(w,d)=>[[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]],outer=ring(width,depth),inner=ring(width-2*bevel,depth-2*bevel),g=new Group();g.name=name;
 const bands=[taperedPrism(name+'-lower',{bottom:inner,top:outer,height:bevel,tone}),prism(name+'-middle',{plan:outer,height:height-2*bevel,tone,crease:true}),taperedPrism(name+'-upper',{bottom:outer,top:inner,height:bevel,tone})];
 bands[0].position.z=(-height+bevel)/2;bands[2].position.z=(height-bevel)/2;
 bands.forEach((o,i)=>{Object.assign(o.userData.illustration,{boundaryBottom:i===0,boundaryTop:i===2,join:name,chunk:i});g.add(o);});return g;
}
const meridianNormal=(m,a,b)=>{const x=(a[0]+b[0])/2,y=(a[1]+b[1])/2,r=Math.hypot(x,y),dr=Math.hypot(...m.top[0].slice(0,2))-Math.hypot(...m.bottom[0].slice(0,2)),dz=m.top[0][2]-m.bottom[0][2];return [x/r,y/r,-dr/dz];};
const interpolate=(ring,index)=>{const n=ring.length,i=((index%n)+n)%n,a=Math.floor(i),t=i-a;return ring[a].map((x,j)=>x+(ring[(a+1)%n][j]-x)*t);};
const center=ring=>ring.reduce((sum,p)=>sum.map((v,i)=>v+p[i]/ring.length),[0,0,0]);
/** Continuous stripes or counterwound braid on the actual TubeGeometry rings.
 * Details are split at host chunks and facing changes, never screen-space masks. */
export function routeTexture(group,{kind='stripe',strands=4,turns=5,width=.7,accent=false}={}){
 if(!group.userData.route||!['stripe','braid'].includes(kind)||!Number.isInteger(strands)||strands<1||strands>16||!Number.isFinite(turns)||turns<0||turns>32)throw new Error('routeTexture: tube, stripe|braid, 1..16 strands and 0..32 turns required');
 const pieces=group.children,lengths=[0];for(const o of pieces){const m=o.userData.illustration;lengths.push(lengths.at(-1)+new Vector3(...center(m.top)).distanceTo(new Vector3(...center(m.bottom))));}
 for(const [i,o] of pieces.entries())for(const sign of kind==='braid'?[-1,1]:[0])for(let strand=0;strand<strands;strand++){
  const m=o.userData.illustration,n=m.top.length,steps=kind==='braid'?Math.max(4,Math.ceil(turns*(lengths[i+1]-lengths[i])/lengths.at(-1)*32)):1;
  const point=t=>{const distance=lengths[i]+t*(lengths[i+1]-lengths[i]),phase=(strand/strands+sign*turns*distance/lengths.at(-1))*n,a=interpolate(m.bottom,phase),b=interpolate(m.top,phase);return a.map((x,j)=>x+(b[j]-x)*t);};
  for(let j=0;j<steps;j++){const a=point(j/steps),b=point((j+1)/steps),mid=(j+.5)/steps,c=center(m.bottom).map((x,k)=>x+(center(m.top)[k]-x)*mid),normal=a.map((x,k)=>(x+b[k])/2-c[k]);mark(o,[a,b],{normal,width,accent});}
 }
 return group;
}
/** A longitudinal machined seam follows the same sampled profile rings. */
export function profileSeam(group,{angle=0,width=.8}={}){
 if(!group.children.length||!group.children.every(o=>o.userData.illustration?.join===group.name))throw new Error('profileSeam: revolved/profile assembly required');
 for(const o of group.children){const m=o.userData.illustration,index=angle/(2*Math.PI)*m.top.length,a=interpolate(m.bottom,index),b=interpolate(m.top,index),normal=meridianNormal(m,a,b);mark(o,[a,b],{width,normal});}return group;
}
/** Circumferential engraving at selected existing profile stations. */
export function profileGrooves(group,{every=4,width=.6}={}){
 if(!Number.isInteger(every)||every<1)throw new Error('profileGrooves: positive integer spacing required');
 for(let i=every-1;i<group.children.length-1;i+=every){const o=group.children[i],m=o.userData.illustration;for(let j=0;j<m.top.length;j++){const a=m.top[j],b=m.top[(j+1)%m.top.length];mark(o,[a,b],{width,normal:meridianNormal(m,a,b)});}}return group;
}
/** Scalloped weld engraving in a declared flat host plane. Geometry audit checks
 * every segment against the actual face; the ending purpose is explicit. */
export function surfaceWeld(object,{from,to,across=[0,1,0],normal=[0,0,1],amplitude=.6,count=12,width=.8}){
 if(!Number.isInteger(count)||count<1||count>128||!Number.isFinite(amplitude)||amplitude<=0)throw new Error('surfaceWeld: 1..128 beads and positive amplitude required');
 const points=Array.from({length:count*8+1},(_,i)=>{const t=i/(count*8);return from.map((x,j)=>x+(to[j]-x)*t+across[j]*amplitude*Math.sin(t*count*Math.PI*2));});mark(object,points,{normal,width,reason:'bounded weld bead on the declared joint'});return object;
}
/** Open slots are absent geometry, framed by real rails and slats. */
export function ventPanel(name,{width=30,depth=24,height=2,border=2,slots=5,slat=1}){
 if(![width,depth,height,border,slat].every(n=>Number.isFinite(n)&&n>0)||!Number.isInteger(slots)||slots<1||slots>32||width<=2*border||depth<=2*border+(slots-1)*slat)throw new Error('ventPanel: invalid dimensions or slot count');
 const g=new Group();g.name=name;const add=(id,w,d,x,y)=>{const p=box(name+'-'+id,{width:w,depth:d,height});p.position.set(x,y,0);g.add(p);};
 for(const sign of [-1,1]){add('side-'+sign,border,depth,sign*(width-border)/2,0);add('end-'+sign,width-2*border,border,0,sign*(depth-border)/2);}
 const opening=(depth-2*border-(slots-1)*slat)/slots;for(let i=1;i<slots;i++)add('slat-'+i,width-2*border,slat,0,-depth/2+border+i*opening+(i-.5)*slat);return g;
}
/** Concave saddle cross-section: local Z is the supported cylinder axis, local
 * Y is seat height. Rotate the assembly for a horizontal world-space pipe. */
export function saddle(name,{radius,width,depth,height,segments=48}){
 if(![radius,width,depth,height].every(n=>Number.isFinite(n)&&n>0)||width>=radius*2||height<=radius||!Number.isInteger(segments)||segments<16||segments>128)throw new Error('saddle: width < diameter, height > radius, 16..128 arc segments');
 // Tangent envelope stays outside the circular host; joining arc samples by
 // chords would cut into the pipe at every segment midpoint.
 const tangents=Array.from({length:segments+1},(_,i)=>{const x=-width/2+width*i/segments,y=height-Math.sqrt(radius*radius-x*x),slope=x/Math.sqrt(radius*radius-x*x);return {x,y,slope,b:y-slope*x};});
 const arc=[[width/2,tangents.at(-1).y]];for(let i=segments;i>0;i--){const a=tangents[i],b=tangents[i-1],x=(b.b-a.b)/(a.slope-b.slope);arc.push([x,a.slope*x+a.b]);}arc.push([-width/2,tangents[0].y]);
 const plan=[[-width/2,0],[width/2,0],...arc];
 return extrude(name,{plan,height:depth});
}
