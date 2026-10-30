import {Mesh,MeshBasicMaterial,Shape,Path,ExtrudeGeometry,CylinderGeometry,Group,Vector3,CatmullRomCurve3,TubeGeometry,BufferGeometry,Float32BufferAttribute,ShapeUtils,Vector2} from '../../runtime/three.mjs';

const positive=(value,label)=>{if(!Number.isFinite(value)||value<=0)throw new Error(`${label}: expected a positive finite number`);return value;};
const sources=new WeakMap();
function mesh(name,geometry,metadata){
  if(typeof name!=='string'||!name)throw new Error('Primitive requires a nonempty name');
  const object=new Mesh(geometry,new MeshBasicMaterial());object.name=name;
  for(const ring of [metadata.top,metadata.bottom,metadata.inner?.top,metadata.inner?.bottom])if(ring){ring.forEach(Object.freeze);Object.freeze(ring);}
  if(metadata.inner)Object.freeze(metadata.inner);
  object.userData.illustration={tone:'surface',details:[],...metadata};
  sources.set(object,{geometry,position:geometry.getAttribute('position'),version:geometry.getAttribute('position').version,top:metadata.top,bottom:metadata.bottom,inner:metadata.inner});return object;
}
/** Reject stale annotations after geometry replacement/mutation; transforms are safe. */
export function assertGeometry(object){const source=sources.get(object),m=object.userData.illustration;
  const e=object.matrixWorld.elements,axes=[new Vector3(e[0],e[1],e[2]),new Vector3(e[4],e[5],e[6]),new Vector3(e[8],e[9],e[10])];
  if(object.matrixWorld.determinant()<=0||axes.some((a,i)=>axes.some((b,j)=>i!==j&&Math.abs(a.dot(b))/(a.length()*b.length())>1e-6)))throw new Error(`Unsupported transform \"${object.name}\": reflected, singular or sheared geometry; use rigid transforms and positive scale before parenting`);
  if(!source||source.geometry!==object.geometry||source.position!==object.geometry.getAttribute('position')||source.version!==source.position.version||source.top!==m?.top||source.bottom!==m?.bottom||source.inner!==m?.inner)throw new Error(`Unsupported geometry "${object.name||object.type}": construct with illustrated helpers and transform the Object3D; do not replace/mutate its geometry or fabricate annotations`);
}
/** A convex rounded rectangular plan. Dimensions are local X/Y; height is Z. */
/** @param {string} name
 * @param {{width:number,depth:number,height:number,radius?:number,tone?:'surface'|'accent'}} options */
export function box(name,{width,depth,height,radius=0,tone='surface'}){
  positive(width,'width');positive(depth,'depth');positive(height,'height');
  if(!Number.isFinite(radius)||radius<0||radius>Math.min(width,depth)/2)throw new Error('radius: outside the box dimensions');
  const ring=[];
  if(!radius)ring.push([-width/2,-depth/2],[width/2,-depth/2],[width/2,depth/2],[-width/2,depth/2]);
  else for(const [x,y,start] of [[width/2-radius,-depth/2+radius,-90],[width/2-radius,depth/2-radius,0],[-width/2+radius,depth/2-radius,90],[-width/2+radius,-depth/2+radius,180]])for(let i=0;i<=8;i++){const a=(start+i*90/8)*Math.PI/180;ring.push([x+radius*Math.cos(a),y+radius*Math.sin(a)]);}
  return prism(name,{plan:ring,height,tone,crease:radius===0});
}
/** Extrude a convex counterclockwise plan along Z; split concave constructions. */
/** @param {string} name
 * @param {{plan:number[][],height:number,tone?:'surface'|'accent',crease?:boolean}} options */
export function prism(name,{plan:ring,height,tone='surface',crease=false}){
  positive(height,'height');
  if(!Array.isArray(ring)||ring.length<3||ring.some(p=>p.length!==2||p.some(v=>!Number.isFinite(v))))throw new Error('plan: require finite [x,y] points');
  let area=0;
  for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length],c=ring[(i+2)%ring.length];if((b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0])< -1e-8)throw new Error('plan: require a convex counterclockwise perimeter');area+=a[0]*b[1]-b[0]*a[1];}
  if(area<=0)throw new Error('plan: require a positive-area counterclockwise perimeter');
  const shape=new Shape();ring.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();
  const geometry=new ExtrudeGeometry(shape,{depth:height,bevelEnabled:false,steps:1});geometry.translate(0,0,-height/2);
  return mesh(name,geometry,{kind:'prism',bottom:ring.map(([x,y])=>[x,y,-height/2]),top:ring.map(([x,y])=>[x,y,height/2]),tone,crease});
}
/** Cylinder/frustum around local Z. Metadata uses the same sampled rings as Three. */
/** @param {string} name
 * @param {{radius:number,height:number,topRadius?:number,segments?:number,tone?:'surface'|'accent',boundaryBottom?:boolean,boundaryTop?:boolean}} options */
export function cylinder(name,{radius,height,topRadius=radius,segments=96,tone='surface',boundaryBottom=true,boundaryTop=true}){
  if(!Number.isFinite(radius)||!Number.isFinite(topRadius)||radius<0||topRadius<0||radius+topRadius===0)throw new Error('cylinder: nonnegative radii, at least one positive');positive(height,'height');
  if(!Number.isInteger(segments)||segments<16||segments>256||segments%4)throw new Error('segments: use a multiple of four from 16 to 256');
  const geometry=new CylinderGeometry(topRadius,radius,height,segments);geometry.rotateX(Math.PI/2);
  const ring=(r,z)=>Array.from({length:segments},(_,i)=>[r*Math.cos(i*2*Math.PI/segments),r*Math.sin(i*2*Math.PI/segments),z]);
  return mesh(name,geometry,{kind:'prism',bottom:ring(radius,-height/2),top:ring(topRadius,height/2),tone,boundaryBottom,boundaryTop});
}
/** A real through-bore, with matching mesh holes and visible inner SVG walls. */
/** @param {string} name
 * @param {{radius:number,innerRadius:number,height:number,segments?:number,tone?:'surface'|'accent'}} options */
export function annulus(name,{radius,innerRadius,height,segments=96,tone='surface'}){
  positive(radius,'radius');positive(innerRadius,'innerRadius');positive(height,'height');
  if(innerRadius>=radius||!Number.isInteger(segments)||segments<16||segments>256)throw new Error('annulus: require innerRadius < radius and 16..256 segments');
  const ring=(r,z,reverse=false)=>Array.from({length:segments},(_,i)=>{const a=(reverse?-1:1)*i*2*Math.PI/segments;return [r*Math.cos(a),r*Math.sin(a),z];});
  const top=ring(radius,height/2),bottom=ring(radius,-height/2),inner={top:ring(innerRadius,height/2,true),bottom:ring(innerRadius,-height/2,true)};
  const shape=new Shape(),hole=new Path();top.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();inner.top.forEach(([x,y],i)=>i?hole.lineTo(x,y):hole.moveTo(x,y));hole.closePath();shape.holes.push(hole);
  const geometry=new ExtrudeGeometry(shape,{depth:height,bevelEnabled:false,steps:1});geometry.translate(0,0,-height/2);
  return mesh(name,geometry,{kind:'annulus',top,bottom,inner,tone});
}
/** Revolved profile as adjacent, closed Three.js frusta. Profile is [z,radius]. */
/** @param {string} name
 * @param {{profile:number[][],segments?:number,tone?:'surface'|'accent'}} options */
export function revolve(name,{profile,segments=96,tone='surface'}){
  if(!Array.isArray(profile)||profile.length<2)throw new Error('profile: provide at least two [z,radius] points');
  const group=new Group();group.name=name;
  profile.forEach(([z,r],i)=>{if(!Number.isFinite(z))throw new Error('profile z must be finite');if(!Number.isFinite(r)||r<0)throw new Error('profile radius must be finite and nonnegative');if(i&&z<=profile[i-1][0])throw new Error('profile z must increase');});
  for(let i=1;i<profile.length;i++){const [z0,r0]=profile[i-1],[z1,r1]=profile[i];const part=cylinder(`${name}-${i}`,{radius:r0,topRadius:r1,height:z1-z0,segments,tone,boundaryBottom:i===1,boundaryTop:i===profile.length-1});part.position.z=(z0+z1)/2;Object.assign(part.userData.illustration,{join:name,chunk:i});group.add(part);}
  return group;
}
/** Place an object's local +Z along a segment. Its existing height must match. */
/** @template {import('three').Object3D} T
 * @param {T} object
 * @param {number[]} from
 * @param {number[]} to
 * @returns {T} */
export function along(object,from,to){const a=new Vector3(...from),b=new Vector3(...to),direction=b.clone().sub(a);positive(direction.length(),'segment length');object.position.copy(a.add(b).multiplyScalar(.5));object.quaternion.setFromUnitVectors(new Vector3(0,0,1),direction.normalize());return object;}
/** Surface markings travel with their parent mesh and share its occlusion order.
 * Points are local coordinates on its visible surface, not independent occluders.
 */
/** @param {import('three').Mesh} object
 * @param {number[][]} points
 * @param {{closed?:boolean,accent?:boolean,width?:number,part?:string,normal?:number[],reason?:string}} options */
export function mark(object,points,{closed=false,accent=false,width=1,part,normal=[0,0,1],reason}={}){
  if(!Array.isArray(points)||points.length<2||points.some(p=>p.length!==3||p.some(v=>!Number.isFinite(v))))throw new Error('mark: require finite local [x,y,z] points');
  if(!Number.isFinite(width)||width<=0)throw new Error('mark width must be positive');
  if(!Array.isArray(normal)||normal.length!==3||normal.some(v=>!Number.isFinite(v))||Math.hypot(...normal)===0)throw new Error('mark: require a finite nonzero surface normal');
  const detail={points,closed,accent,width,part,normal,reason};object.userData.illustration.details.push(detail);return detail;
}
export function ringPoints(radius,z,count=96){return Array.from({length:count},(_,i)=>[radius*Math.cos(i*2*Math.PI/count),radius*Math.sin(i*2*Math.PI/count),z]);}
/** Text engraved/printed on a local surface, using its projected basis vectors. */
/** @param {import('three').Mesh} object
 * @param {string} text
 * @param {{at:number[],u?:number[],v?:number[],normal?:number[],size?:number}} options */
export function label(object,text,{at,u=[1,0,0],v=[0,-1,0],normal=[0,0,1],size=6}={}){
  if(typeof text!=='string'||![at,u,v,normal].every(p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite)))throw new Error('label: require text and finite local position/basis/normal vectors');
  positive(size,'label size');const detail={text,at,u,v,normal,size};object.userData.illustration.details.push(detail);return detail;
}
/** Local-XY dial graduations. Angles are radians from -Y toward +X.
 * count divides the sweep into intervals. Open sweeps include both endpoints;
 * full circles omit the duplicate endpoint. Compact mode retains open endpoints.
 * @param {import('three').Mesh} object
 * @param {{radius:number,z:number,count?:number,every?:number,major?:number,minor?:number,compact?:boolean,from?:number,span?:number}} options
 */
export function ticks(object,{radius,z,count=60,every=5,major=4,minor=1.7,compact=false,from=0,span=2*Math.PI}){
  positive(radius,'ticks radius');
  if(!Number.isFinite(z)||!Number.isFinite(from)||!Number.isFinite(span)||span===0||Math.abs(span)>2*Math.PI)throw new Error('ticks: finite z/from and nonzero span within one revolution required');
  if(!Number.isInteger(count)||count<1||!Number.isInteger(every)||every<1)throw new Error('ticks: count and every must be positive integers');
  if(![major,minor].every(v=>Number.isFinite(v)&&v>0&&v<=radius)||typeof compact!=='boolean')throw new Error('ticks: positive lengths no greater than radius and boolean compact required');
  const closed=Math.abs(span)===2*Math.PI;
  for(let i=0;i<count+(closed?0:1);i++){
    if(compact&&i%every&&(closed||i!==count))continue;
    const a=from+i*span/count,r=radius-(i%every?minor:major);
    mark(object,[[r*Math.sin(a),-r*Math.cos(a),z],[radius*Math.sin(a),-radius*Math.cos(a),z]]);
  }
}
/** A routed tube from Three.js curve frames, split at each actual geometry ring.
 * Use gentle, non-self-intersecting routes with terminal tangents aimed at ports.
 * Crossings remain subject to the same checked SVG order as every other solid.
 */
/** @param {string} name
 * @param {{points:number[][],radius?:number,segments?:number,radialSegments?:number,tone?:'surface'|'accent'}} options */
export function tube(name,{points,radius=2,segments=24,radialSegments=24,tone='surface'}){
  positive(radius,'tube radius');
  if(!Array.isArray(points)||points.length<3||points.some(p=>p.length!==3||p.some(v=>!Number.isFinite(v))))throw new Error('tube points: require at least three finite [x,y,z] waypoints');
  if(!Number.isInteger(segments)||segments<4||segments>512||!Number.isInteger(radialSegments)||radialSegments<12||radialSegments>96)throw new Error('tube segments: use 4..512 longitudinal and 12..96 radial segments');
  for(let i=1;i<points.length;i++)if(new Vector3(...points[i]).distanceTo(new Vector3(...points[i-1]))<1e-6)throw new Error('tube points must be distinct');
  const curve=new CatmullRomCurve3(points.map(p=>new Vector3(...p)),false,'centripetal');
  const source=new TubeGeometry(curve,segments,radius,radialSegments,false),positions=source.getAttribute('position'),group=new Group();group.name=name;
  const ring=i=>Array.from({length:radialSegments},(_,j)=>{const index=i*(radialSegments+1)+(radialSegments-1-j);return [positions.getX(index),positions.getY(index),positions.getZ(index)];});
  for(let i=0;i<segments;i++){
    const bottom=ring(i),top=ring(i+1),n=radialSegments;
    const normals=source.getAttribute('normal'),normalRing=k=>Array.from({length:n},(_,j)=>{const index=k*(n+1)+(n-1-j);return [normals.getX(index),normals.getY(index),normals.getZ(index)];});
    const centroid=r=>r.reduce((s,p)=>s.map((v,k)=>v+p[k]/n),[0,0,0]);
    const vertices=[...bottom,...top,centroid(bottom),centroid(top)],indices=[];
    for(let j=0;j<n;j++){const k=(j+1)%n;indices.push(j,k,n+j,k,n+k,n+j,2*n,k,j,2*n+1,n+j,n+k);}
    const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(vertices.flat(),3));geometry.setIndex(indices);geometry.computeVertexNormals();
    group.add(mesh(`${name}-${String(i).padStart(3,'0')}`,geometry,{kind:'prism',bottom,top,tone,boundaryBottom:i===0,boundaryTop:i===segments-1,join:name,chunk:i,normals:{bottom:normalRing(i),top:normalRing(i+1)}}));
  }
  group.userData.route={radius,centers:Array.from({length:segments+1},(_,i)=>curve.getPointAt(i/segments).toArray()),waypoints:points};source.dispose();return group;
}

/** Static concave plan decomposed by Three's earcut into physical triangular prisms.
 * Keep as one assembly; adjacent shared boundaries are construction faces, not gaps.
 */
/** @param {string} name
 * @param {{plan:number[][],height:number,tone?:'surface'|'accent'}} options */
export function extrude(name,{plan,height,tone='surface'}){
 if(!Array.isArray(plan)||plan.length<3||plan.some(p=>p.length!==2||p.some(v=>!Number.isFinite(v))))throw new Error('extrude plan: finite perimeter required');
 const vertices=plan.map(p=>new Vector2(...p)),triangles=ShapeUtils.triangulateShape(vertices,[]),group=new Group();group.name=name;
 if(!triangles.length)throw new Error(`extrude ${name}: triangulation failed`);
 for(const [i,t] of triangles.entries()){let ring=t.map(j=>plan[j]);const [a,b,c]=ring;if((b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0])<0)ring=ring.reverse();const part=prism(`${name}-${i}`,{plan:ring,height,tone});part.userData.illustration.perimeterEdges=ring.map((a,j)=>{const b=ring[(j+1)%ring.length];return plan.some((p,i)=>p===a&&plan[(i+1)%plan.length]===b||p===b&&plan[(i+1)%plan.length]===a);});group.add(part);}
 return group;
}
/** Sample an analytic meridian, retaining its function for independent audit samples.
 * @param {string} name
 * @param {{radius:(z:number)=>number,zMin:number,zMax:number,steps?:number,segments?:number,tolerance?:number,tone?:string}} options
 */
export function profile(name,{radius,zMin,zMax,steps=48,segments=96,tolerance=.04,tone='surface'}){
 if(typeof radius!=='function'||!Number.isFinite(zMin)||!Number.isFinite(zMax)||zMax<=zMin||!Number.isInteger(steps)||steps<4||steps>256)throw new Error('profile: finite increasing z bounds, radius(z), and 4..256 steps required');
 if(!Number.isFinite(tolerance)||tolerance<=0||tolerance>1)throw new Error('profile: tolerance must be positive and at most 1 world unit');
 const samples=[[zMin,radius(zMin)]];
 const refine=(a,b,depth=0)=>{const z=(a[0]+b[0])/2,r=radius(z);if(!Number.isFinite(r)||r<0)throw new Error(`profile ${name}: radius must remain finite and nonnegative`);if(Math.abs(r-(a[1]+b[1])/2)>tolerance){if(depth>=16||samples.length>2048)throw new Error(`profile ${name}: refinement limit exceeded; simplify the analytic meridian or declare a measured tolerance`);refine(a,[z,r],depth+1);refine([z,r],b,depth+1);}else samples.push(b);};
 for(let i=0;i<steps;i++){const z=zMin+(zMax-zMin)*(i+1)/steps;refine(samples.at(-1),[z,radius(z)]);}
 const group=revolve(name,{profile:samples,segments,tone});
 group.userData.profile={radius,zMin,zMax,steps,samples,tolerance};
 const delta=(zMax-zMin)*1e-5,slope=z=>{const a=Math.max(zMin,z-delta),b=Math.min(zMax,z+delta);return (radius(b)-radius(a))/(b-a);};
 group.children.forEach((o,i)=>{const m=o.userData.illustration;const normal=(z,j)=>new Vector3(Math.cos(j*2*Math.PI/segments),Math.sin(j*2*Math.PI/segments),-slope(z)).normalize().toArray();m.normals={bottom:m.bottom.map((p,j)=>normal(samples[i][0],j)),top:m.top.map((p,j)=>normal(samples[i+1][0],j))};});return group;
}
/** Full sphere or spherical segment, optionally with flat end caps at the cuts. */
/** @param {string} name
 * @param {{radius:number,zMin?:number,zMax?:number,steps?:number,segments?:number,tone?:'surface'|'accent'}} options */
export function sphere(name,{radius,zMin=-radius,zMax=radius,...options}){positive(radius,'sphere radius');if(zMin< -radius||zMax>radius)throw new Error('sphere segment exceeds radius');return profile(name,{...options,zMin,zMax,radius:z=>Math.sqrt(Math.max(0,radius*radius-z*z))});}
/** Semantic material and role inherit through assemblies; a part assignment wins. */
/** @template {import('three').Object3D} T
 * @param {T} object
 * @param {string} id
 * @param {{role?:string}} options
 * @returns {T} */
export function material(object,id,{role}={}){if(!/^[a-z][a-z0-9-]*$/.test(id))throw new Error('material: invalid id');object.userData.material=id;if(role)object.userData.materialRole=role;return object;}
/** Named local anchor and outward direction move with their real host. */
/** @template {import('three').Object3D} T
 * @param {T} object
 * @param {string} name
 * @param {{at:number[],direction:number[],radius?:number}} options
 * @returns {T} */
export function port(object,name,{at,direction,radius=0}){if(!name||![at,direction].every(p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite))||Math.hypot(...direction)===0||!Number.isFinite(radius)||radius<0)throw new Error('port: name, finite point/nonzero direction and nonnegative radius required');(object.userData.ports??={})[name]={at:[...at],direction:[...direction],radius};return object;}
export function anchor(object,name){const p=object.userData.ports?.[name];if(!p)throw new Error(`port ${object.name}.${name}: not declared`);object.updateWorldMatrix(true,false);return {at:new Vector3(...p.at).applyMatrix4(object.matrixWorld),direction:new Vector3(...p.direction).transformDirection(object.matrixWorld),radius:p.radius};}

/** Convex matched polygon rings for a physical bevel band; no mesh fallback.
 * @param {string} name
 * @param {{bottom:number[][],top:number[][],height:number,tone?:'surface'|'accent'}} options */
export function taperedPrism(name,{bottom,top,height,tone='surface'}){
 positive(height,'height');if(!Array.isArray(bottom)||!Array.isArray(top)||bottom.length!==top.length)throw new Error('taperedPrism: matching convex rings required');
 for(const ring of [bottom,top]){const check=prism(name,{plan:ring,height});check.geometry.dispose();check.material.dispose();}
 const n=top.length,low=bottom.map(([x,y])=>[x,y,-height/2]),high=top.map(([x,y])=>[x,y,height/2]),indices=[];
 for(let i=0;i<n;i++){const j=(i+1)%n;indices.push(i,j,n+i,j,n+j,n+i);}
 for(let i=1;i<n-1;i++)indices.push(0,i+1,i,n,n+i,n+i+1);
 const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute([...low,...high].flat(),3));geometry.setIndex(indices);geometry.computeVertexNormals();
 return mesh(name,geometry,{kind:'prism',bottom:low,top:high,tone,crease:true});
}
