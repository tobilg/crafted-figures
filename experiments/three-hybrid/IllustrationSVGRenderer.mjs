import * as THREE from 'three';
import {mix,readableAccent} from '../../skill/crafted-figures/kit/styles.mjs';
const NS='http://www.w3.org/2000/svg';
const pathOf=points=>points.map((p,i)=>`${i?'L':'M'}${p[0].toFixed(3)} ${p[1].toFixed(3)}`).join('')+'Z';
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
function hull(points){const p=[...points].sort((a,b)=>a[0]-b[0]||a[1]-b[1]),lo=[],hi=[];for(const v of p){while(lo.length>1&&cross(lo.at(-2),lo.at(-1),v)<=1e-8)lo.pop();lo.push(v);}for(const v of p.reverse()){while(hi.length>1&&cross(hi.at(-2),hi.at(-1),v)<=1e-8)hi.pop();hi.push(v);}return [...lo.slice(0,-1),...hi.slice(0,-1)];}
function intersection(subject,clip){let out=subject;for(let i=0;i<clip.length;i++){const a=clip[i],b=clip[(i+1)%clip.length],input=out;out=[];if(!input.length)break;for(let j=0;j<input.length;j++){const c=input[j],d=input[(j+1)%input.length],dc=cross(a,b,c),dd=cross(a,b,d);if(dc>=-1e-8)out.push(c);if((dc>=0)!==(dd>=0)){const t=dc/(dc-dd);out.push([c[0]+(d[0]-c[0])*t,c[1]+(d[1]-c[1])*t]);}}}return out;}
/** Narrow supported renderer. Convex, nonintersecting annotated primitives only.
 * Order is an overlap graph checked by rays, not average object depth.
 */
export class IllustrationSVGRenderer {
 constructor(tokens,{fallback=false}={}){this.tokens=tokens;this.fallback=fallback;this.domElement=document.createElementNS(NS,'svg');this.domElement.setAttribute('xmlns',NS);this.domElement.setAttribute('role','img');this.domElement.setAttribute('aria-label','Rotating dial and support with a registered marker');this.width=600;this.height=400;this.disposed=false;this.order=[];this.rays=new THREE.Raycaster();}
 setSize(width,height){this.width=width;this.height=height;this.domElement.setAttribute('viewBox',`0 0 ${width} ${height}`);this.domElement.setAttribute('width',width);this.domElement.setAttribute('height',height);}
 project(point,camera){const v=point.clone().project(camera);return [(v.x+1)*this.width/2,(1-v.y)*this.height/2];}
 primitive(mesh,camera){
  const m=mesh.userData.illustration;if(!m||!['box','cylinder','disc'].includes(m.kind))throw new Error(`Unsupported geometry "${mesh.name||mesh.type}": require annotated box, cylinder or disc; no arbitrary mesh fallback`);
  const normalMatrix=new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld),view=camera.getWorldDirection(new THREE.Vector3()).negate(),light=new THREE.Vector3(-.707,.707,.35).normalize();
  const world=p=>new THREE.Vector3(...p).applyMatrix4(mesh.matrixWorld),screen=p=>this.project(world(p),camera),visible=n=>new THREE.Vector3(...n).applyMatrix3(normalMatrix).normalize().dot(view)>1e-7;
  const color=n=>{const normal=new THREE.Vector3(...n).applyMatrix3(normalMatrix).normalize();if(m.accent)return Math.abs(normal.z)>.9?mix(this.tokens.accent,'#ffffff',.4):this.tokens.accent;return normal.z>.9?this.tokens.top:this.tokens['side'+Math.max(0,Math.min(3,Math.floor((normal.dot(light)+1)*2)))];};
  const faces=[],vertices=[];let details='';
  const face=(p,n)=>{vertices.push(...p);if(visible(n))faces.push({p:p.map(screen),fill:color(n)});};
  if(m.kind==='box'){
    const x=m.w/2,y=m.d/2,z=m.h/2;
    face([[-x,-y,z],[x,-y,z],[x,y,z],[-x,y,z]],[0,0,1]);face([[-x,y,-z],[x,y,-z],[x,-y,-z],[-x,-y,-z]],[0,0,-1]);
    face([[x,-y,-z],[x,y,-z],[x,y,z],[x,-y,z]],[1,0,0]);face([[-x,y,-z],[-x,-y,-z],[-x,-y,z],[-x,y,z]],[-1,0,0]);
    face([[-x,y,-z],[-x,y,z],[x,y,z],[x,y,-z]],[0,1,0]);face([[x,-y,-z],[x,-y,z],[-x,-y,z],[-x,-y,-z]],[0,-1,0]);
  }else{
    const ring=z=>Array.from({length:m.segments},(_,i)=>[m.r*Math.cos(i*2*Math.PI/m.segments),m.r*Math.sin(i*2*Math.PI/m.segments),z]);
    if(m.kind==='disc'){const p=ring(0);vertices.push(...p);faces.push({p:p.map(screen),fill:this.tokens.accent});}
    else{
      const top=ring(m.h/2),bottom=ring(-m.h/2);vertices.push(...top,...bottom);
      // Merge contiguous side facets sharing a tone; outline only true boundaries.
      const runs=[];for(let i=0;i<m.segments;i++){const a=(i+.5)*2*Math.PI/m.segments,n=[Math.cos(a),Math.sin(a),0];if(!visible(n)){runs.push(null);continue;}runs.push(color(n));}
      let start=runs.findIndex((v,i)=>v!==runs[(i+m.segments-1)%m.segments]);if(start<0)start=0;
      for(let step=0;step<m.segments;){const i=(start+step)%m.segments,fill=runs[i];let count=1;while(step+count<m.segments&&runs[(i+count)%m.segments]===fill)count++;if(fill){const ids=Array.from({length:count+1},(_,j)=>(i+j)%m.segments);faces.push({p:[...ids.map(j=>screen(top[j])),...ids.reverse().map(j=>screen(bottom[j]))],fill,side:true});}step+=count;}
      if(visible([0,0,1]))faces.push({p:top.map(screen),fill:color([0,0,1]),cap:true});
      if(visible([0,0,-1]))faces.push({p:bottom.map(screen),fill:color([0,0,-1]),cap:true});
      if(m.ticks&&visible([0,0,1]))for(let i=0;i<60;i++){const a=i*Math.PI/30,r=m.r-2,inside=r-(i%5===0?3:1.2),p=screen([inside*Math.cos(a),inside*Math.sin(a),m.h/2]),q=screen([r*Math.cos(a),r*Math.sin(a),m.h/2]);details+=`<path d="M${p.join(' ')}L${q.join(' ')}" fill="none" stroke="${this.tokens.stroke}" stroke-width=".6"/>`;}
    }
  }
  const silhouette=hull(vertices.map(screen));const stroke=m.accent?readableAccent(this.tokens.accent,this.tokens.top):this.tokens.stroke;
  const content=`<path d="${pathOf(silhouette)}" fill="${this.tokens.surface}"/>`+faces.map(f=>`<path d="${pathOf(f.p)}" fill="${f.fill}"${m.kind==='box'||f.cap?` stroke="${stroke}" stroke-width=".65" stroke-linejoin="round"`:''}/>`).join('')+details+`<path d="${pathOf(silhouette)}" fill="none" stroke="${stroke}" stroke-width=".75" stroke-linejoin="round"/>`;
  return {mesh,silhouette,content};
 }
 render(scene,camera){
  if(this.disposed)throw new Error('IllustrationSVGRenderer disposed');if(!camera.isOrthographicCamera)throw new Error('Only the documented orthographic camera is supported');scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);
  const items=[];scene.traverseVisible(o=>{if(o.isMesh&&!o.userData.diagnostic){const primitive=this.primitive(o,camera);if(!o.userData.illustration.effect||this.fallback)items.push(primitive);}});
  const edges=items.map(()=>new Set()),incoming=items.map(()=>0);
  for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){
    const overlap=intersection(items[i].silhouette,items[j].silhouette);if(overlap.length<3)continue;
    const center=overlap.reduce((s,p)=>[s[0]+p[0]/overlap.length,s[1]+p[1]/overlap.length],[0,0]);const signs=new Set();
    for(const pt of [center,...overlap.map(p=>[center[0]*.04+p[0]*.96,center[1]*.04+p[1]*.96])]){
      this.rays.setFromCamera(new THREE.Vector2(pt[0]/this.width*2-1,1-pt[1]/this.height*2),camera);
      const a=this.rays.intersectObject(items[i].mesh,false)[0],b=this.rays.intersectObject(items[j].mesh,false)[0];if(!a||!b)continue;const delta=a.distance-b.distance;if(Math.abs(delta)>1e-4)signs.add(Math.sign(delta));
    }
    if(signs.size>1)throw new Error(`Unsupported intersecting/interleaved primitives: ${items[i].mesh.name} / ${items[j].mesh.name}`);
    if(signs.size){const [a,b]=[...signs][0]>0?[i,j]:[j,i];if(!edges[a].has(b)){edges[a].add(b);incoming[b]++;}}
  }
  const order=[],ready=incoming.map((n,i)=>n===0?i:-1).filter(i=>i>=0);while(ready.length){ready.sort((a,b)=>items[a].mesh.name.localeCompare(items[b].mesh.name));const i=ready.shift();order.push(i);for(const j of edges[i])if(--incoming[j]===0)ready.push(j);}
  if(order.length!==items.length)throw new Error('Unsupported cyclic SVG painter order; split geometry instead of adding an order bias');
  this.order=order.map(i=>items[i].mesh.name);this.domElement.innerHTML='<title>Rotating dial and support</title><desc>A marker orbits the dial and passes behind and in front of a support. Fixed orthographic camera.</desc>'+order.map(i=>`<g data-object="${items[i].mesh.name}">${items[i].content}</g>`).join('');
 }
 dispose(){if(this.disposed)return;this.disposed=true;this.domElement.replaceChildren();this.domElement.remove();}
}
