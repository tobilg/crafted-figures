import {Vector2,Vector3,Matrix3,Raycaster} from '../../runtime/three.mjs';
import {assertGeometry} from './primitives.mjs';
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const svgPass=o=>{for(let p=o;p;p=p.parent)if(p.userData.svgAfterLayer!==undefined)return p.userData.svgAfterLayer;return -1;};
const num=v=>{if(!Number.isFinite(v))throw new Error('Non-finite projected geometry');return String(Number(v.toFixed(3)));};
const pathOf=(points,closed=true)=>points.map((p,i)=>`${i?'L':'M'}${num(p[0])} ${num(p[1])}`).join('')+(closed?'Z':'');
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
function hull(points){const p=[...points].sort((a,b)=>a[0]-b[0]||a[1]-b[1]),lo=[],hi=[];for(const v of p){while(lo.length>1&&cross(lo.at(-2),lo.at(-1),v)<=1e-8)lo.pop();lo.push(v);}for(const v of p.reverse()){while(hi.length>1&&cross(hi.at(-2),hi.at(-1),v)<=1e-8)hi.pop();hi.push(v);}return [...lo.slice(0,-1),...hi.slice(0,-1)];}
function intersection(subject,clip){let out=subject;for(let i=0;i<clip.length;i++){const a=clip[i],b=clip[(i+1)%clip.length],input=out;out=[];if(!input.length)break;for(let j=0;j<input.length;j++){const c=input[j],d=input[(j+1)%input.length],dc=cross(a,b,c),dd=cross(a,b,d);if(dc>=-1e-8)out.push(c);if((dc>=0)!==(dd>=0)){const t=dc/(dc-dd);out.push([c[0]+(d[0]-c[0])*t,c[1]+(d[1]-c[1])*t]);}}}return out;}
/** Clip a surface polygon by an interpolated normal score. */
function clipScore(input,key,limit,greater=true){const out=[];for(let i=0;i<input.length;i++){const a=input[i],b=input[(i+1)%input.length],da=(a[key]-limit)*(greater?1:-1),db=(b[key]-limit)*(greater?1:-1);if(da>=0)out.push(a);if((da>=0)!==(db>=0)){const t=da/(da-db),p={};for(const k of ['x','y','z','light','up','view'])p[k]=a[k]+(b[k]-a[k])*t;out.push(p);}}return out;}
// One compound filled path per tone. Shared subpath edges cancel in SVG's
// nonzero fill rule, preserving curved band boundaries without polygon-union
// tolerances or a visible tessellation grid.
function joinedPaths(polygons,screen){return polygons.map(poly=>pathOf(poly.map(p=>screen([p.x,p.y,p.z])))).join('');}
/** Finite SVG illustration renderer. Pure serialization works without a DOM.
 * Uses Three.js world/camera matrices and mesh raycasting; no scene-language layer.
 * The overlap probes diagnose observed interleaving, not arbitrary mesh correctness.
 */
export class IllustrationSVGRenderer {
  constructor({width=600,height=400,strokeWidth=.6}={}){this.width=width;this.height=height;this.strokeWidth=strokeWidth;this.rays=new Raycaster();this.cache=new WeakMap();this.pairs=new WeakMap();this.order=[];this.disposed=false;this.printMode=false;}
  project(point,camera){const v=point.clone().project(camera);return [(v.x+1)*this.width/2,(1-v.y)*this.height/2];}
  primitive(mesh,camera,cameraKey){
    assertGeometry(mesh);
    const m=mesh.userData.illustration;
    if(!m||!['prism','annulus'].includes(m.kind))throw new Error(`Unsupported geometry "${mesh.name||mesh.type}": use the illustrated primitive helpers; arbitrary meshes are not supported`);
    if(!['surface','accent'].includes(m.tone))throw new Error(`Unsupported semantic tone: ${m.tone}`);
    const geometryKey=mesh.matrixWorld.elements.join(',')+'|'+cameraKey+'|'+mesh.geometry.uuid;
    const key=geometryKey+'|print:'+this.printMode+'|'+(this.idPrefix||'')+'|'+JSON.stringify(m);
    const cached=this.cache.get(mesh);if(cached?.key===key)return cached;
    const normalMatrix=new Matrix3().getNormalMatrix(mesh.matrixWorld),view=camera.getWorldDirection(new Vector3()).negate(),light=new Vector3(-.707,.707,0).normalize();
    const screen=p=>this.project(new Vector3(...p).applyMatrix4(mesh.matrixWorld),camera);
    const worldNormal=n=>n.clone().applyMatrix3(normalMatrix).normalize();
    const visible=n=>worldNormal(n).dot(view)>1e-7;
    const color=n=>{const normal=worldNormal(n);if(normal.z>.9)return 'top';return 'side-'+Math.max(0,Math.min(3,Math.floor((normal.dot(light)+1)*2)));};
    const top=m.top,bottom=m.bottom,n=top.length;
    if(n<3||bottom.length!==n)throw new Error(`Invalid primitive metadata: ${mesh.name}`);
    const topN=new Vector3(...top[1]).sub(new Vector3(...top[0])).cross(new Vector3(...top[2]).sub(new Vector3(...top[0]))).normalize();
    if(topN.lengthSq()<1e-12)topN.copy(new Vector3(...bottom[1]).sub(new Vector3(...bottom[0])).cross(new Vector3(...bottom[2]).sub(new Vector3(...bottom[0]))).normalize());
    const bottomN=new Vector3(...bottom[1]).sub(new Vector3(...bottom[0])).cross(new Vector3(...bottom[2]).sub(new Vector3(...bottom[0]))).normalize().negate();
    if(bottomN.lengthSq()<1e-12)bottomN.copy(topN).negate();
    const faces=[];
    // Smooth pieces share exact vertices. Disable independent fill antialiasing
    // at those shared edges; retain ordinary antialiased silhouette strokes.
    // A face-coloured seam stroke can erase the adjacent piece's outline.
    const joinStyle=fill=>{
      if((m.normals||m.perimeterEdges)&&!this.printMode)return ' style="shape-rendering:crispEdges"';
      if(m.boundaryTop!==false&&m.boundaryBottom!==false&&!m.perimeterEdges)return '';
      const token=m.tone==='accent'&&!m.material?(fill==='top'?'accentTop':fill.replace('side-','accentSide')):fill.replace('side-','side');
      return ` style="stroke:var(--cf-${token});stroke-width:.5px;stroke-linejoin:round;vector-effect:non-scaling-stroke"`;
    };
    const sides=(top,bottom)=>{
      const runs=top.map((p,i)=>{const next=(i+1)%n;const normal=new Vector3(...bottom[next]).sub(new Vector3(...bottom[i])).cross(new Vector3(...top[i]).sub(new Vector3(...bottom[i]))).normalize();return (!m.perimeterEdges||m.perimeterEdges[i])&&visible(normal)?color(normal):null;});
      let start=runs.findIndex((v,i)=>v!==runs[(i+n-1)%n]);if(start<0)start=0;
      for(let step=0;step<n;){const i=(start+step)%n,fill=runs[i];let count=1;while(step+count<n&&runs[(i+count)%n]===fill)count++;if(fill){const ids=Array.from({length:count+1},(_,j)=>(i+j)%n);faces.push(`<path class="${fill}"${joinStyle(fill)} d="${pathOf([...ids.map(j=>screen(top[j])),...ids.reverse().map(j=>screen(bottom[j]))])}"/>`);}step+=count;}
      return runs;
    };
    if(m.inner)sides(m.inner.top,m.inner.bottom);
    let runs;const smoothOutline=[],coverage=[];
    if(m.normals){
      const regions=new Map(['top','side-0','side-1','side-2','side-3'].map(k=>[k,[]]));
      const vertex=(p,n)=>{const normal=worldNormal(new Vector3(...n));return {x:p[0],y:p[1],z:p[2],light:Number(normal.dot(light).toFixed(10)),up:Number(normal.z.toFixed(10)),view:Number(normal.dot(view).toFixed(10))};};
      for(let i=0;i<n;i++){const j=(i+1)%n,surface=[vertex(bottom[i],m.normals.bottom[i]),vertex(bottom[j],m.normals.bottom[j]),vertex(top[j],m.normals.top[j]),vertex(top[i],m.normals.top[i])],poly=clipScore(surface,'view',0);
        // A smooth silhouette follows the same interpolated normal zero as the
        // visible fill. Chunk hull tangents leave gaps whenever the extremal
        // ring vertex changes; those are construction artifacts, not creases.
        const crossing=[];for(let e=0;e<surface.length;e++){const a=surface[e],b=surface[(e+1)%surface.length];if(Math.abs(a.view)<1e-9)crossing.push(screen([a.x,a.y,a.z]));if(a.view*b.view<0){const t=a.view/(a.view-b.view);crossing.push(screen([a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t,a.z+(b.z-a.z)*t]));}}if(crossing.length===2)smoothOutline.push(pathOf(crossing,false));
        if(poly.length<3)continue;if(this.printMode)coverage.push(pathOf(poly.map(p=>screen([p.x,p.y,p.z]))));const cap=clipScore(poly,'up',.9);if(cap.length>2)regions.get('top').push(cap);
        const side=clipScore(poly,'up',.9,false);for(let band=0;band<4;band++){const clipped=clipScore(clipScore(side,'light',-1+band*.5),'light',-.5+band*.5,false);if(clipped.length>2)regions.get('side-'+band).push(clipped);}
      }
      for(const [fill,polygons] of regions)if(polygons.length)faces.push(`<path class="${fill}"${joinStyle(fill)} d="${joinedPaths(polygons,screen)}"/>`);
      runs=top.map(()=>true);
    }else runs=sides(top,bottom);
    if(visible(topN)&&m.boundaryTop!==false)faces.push(`<path class="${color(topN)}"${joinStyle(color(topN))} fill-rule="evenodd" d="${pathOf(top.map(screen))}${m.inner?pathOf(m.inner.top.map(screen)):''}"/>`);
    if(visible(bottomN)&&m.boundaryBottom!==false)faces.push(`<path class="${color(bottomN)}"${joinStyle(color(bottomN))} fill-rule="evenodd" d="${pathOf(bottom.map(screen))}${m.inner?pathOf(m.inner.bottom.map(screen)):''}"/>`);
    const silhouette=hull([...top.map((p,i)=>[...screen(p),1,i]),...bottom.map((p,i)=>[...screen(p),0,i])]);
    let outline='';for(let i=0;i<silhouette.length;i++){const a=silhouette[i],b=silhouette[(i+1)%silhouette.length];if(a[2]!==b[2]&&m.perimeterEdges&&!(m.perimeterEdges[a[3]]&&m.perimeterEdges[(a[3]+n-1)%n]))continue;if(a[2]===b[2]&&((a[2]?m.boundaryTop===false:m.boundaryBottom===false)||(m.perimeterEdges&&!m.perimeterEdges[(a[3]+1)%n===b[3]?a[3]:b[3]])))continue;outline+=pathOf([a,b],false);}
    if(m.normals)outline=smoothOutline.join('');
    const edges=[];const perimeter=ring=>m.perimeterEdges?ring.map((p,i)=>m.perimeterEdges[i]?pathOf([screen(p),screen(ring[(i+1)%n])],false):'').join(''):pathOf(ring.map(screen));
    if(visible(topN)&&m.boundaryTop!==false)edges.push(perimeter(top));
    if(visible(bottomN)&&m.boundaryBottom!==false)edges.push(perimeter(bottom));
    if(m.inner){if(visible(topN))edges.push(pathOf(m.inner.top.map(screen)));if(visible(bottomN))edges.push(pathOf(m.inner.bottom.map(screen)));}
    if(m.crease)for(let i=0;i<n;i++)if(runs[i]&&runs[(i+n-1)%n])edges.push(pathOf([screen(bottom[i]),screen(top[i])],false));
    const details=(m.details||[]).filter(d=>visible(new Vector3(...d.normal))).map(d=>{
      const t=Math.min(1,worldNormal(new Vector3(...d.normal)).dot(view)/.12),fade=t*t*(3-2*t);
      const opacity=fade<1?` opacity="${num(fade)}"`:'';
      if(d.type==='display'){const p=screen(d.at),u=screen(d.at.map((x,i)=>x+d.u[i])),v=screen(d.at.map((x,i)=>x+d.v[i])),id=`${this.idPrefix||''}display-${mesh.name}-${d.id}`;return `<g${opacity} transform="matrix(${[u[0]-p[0],u[1]-p[1],v[0]-p[0],v[1]-p[1],...p].map(num).join(' ')})"><defs><clipPath id="${escape(id)}"><rect width="${num(d.width)}" height="${num(d.height)}"/></clipPath></defs><rect width="${num(d.width)}" height="${num(d.height)}" fill="var(--cf-side0)"/><g clip-path="url(#${escape(id)})"><text fill="var(--cf-top)" x="1" y="${num(d.size+1)}" style="font:${num(d.size)}px var(--cf-mono)">${escape(d.text)}</text></g></g>`;}
      if(d.text!==undefined){const p=screen(d.at),u=screen(d.at.map((v,i)=>v+d.u[i])),v=screen(d.at.map((v,i)=>v+d.v[i]));return `<text${opacity} class="caption" style="font-size:${num(d.size)}px" transform="matrix(${[u[0]-p[0],u[1]-p[1],v[0]-p[0],v[1]-p[1],...p].map(num).join(' ')})">${escape(d.text)}</text>`;}
      return `<path${opacity}${d.reason?` data-line-reason="${escape(d.reason)}"`:""}${d.part?` data-part="${escape(d.part)}"`:''}${d.angle===undefined?'':` data-angle="${escape(d.angle)}"`} class="line${d.accent?' accent-line':''}" style="stroke-width:${num(this.strokeWidth*d.width)}px" d="${pathOf(d.points.map(screen),d.closed)}"/>`;
    }).join('');
    const content=`${m.inner||m.perimeterEdges||m.boundaryTop===false||m.boundaryBottom===false?'':`<path class="surface" d="${pathOf(silhouette)}"/>`}${faces.join('')}<path class="crease" d="${edges.join('')}"/><path class="edge" style="stroke-linecap:round" d="${outline}"/>${details}`;
    const xs=silhouette.map(p=>p[0]),ys=silhouette.map(p=>p[1]);
    const result={mesh,key,geometryKey,silhouette,content,fillContent:faces.join(''),coverage:this.printMode?coverage.join('')+(visible(topN)&&m.boundaryTop!==false?pathOf(top.map(screen)):'')+(visible(bottomN)&&m.boundaryBottom!==false?pathOf([...bottom].reverse().map(screen)):''):'',bounds:[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)]};this.cache.set(mesh,result);return result;
  }
  relation(a,b,camera){
    // Disjoint screen bounds cannot impose painter order. Do this before
    // caching: storing concatenated matrix strings for every disjoint pair
    // made dense scenes retain quadratic amounts of unnecessary data.
    const aa=a.bounds,bb=b.bounds;
    if(!(aa[2]>bb[0]&&bb[2]>aa[0]&&aa[3]>bb[1]&&bb[3]>aa[1]))return 0;
    let cache=this.pairs.get(a.mesh);if(!cache)this.pairs.set(a.mesh,cache=new WeakMap());const prior=cache.get(b.mesh);if(prior?.a===a.geometryKey&&prior?.b===b.geometryKey)return prior.sign;
    let sign=0;
    {
      const overlap=intersection(a.silhouette,b.silhouette);
      if(overlap.length>=3){const center=overlap.reduce((s,p)=>[s[0]+p[0]/overlap.length,s[1]+p[1]/overlap.length],[0,0]);const signs=new Set();
        for(const pt of [center,...overlap.map(p=>[center[0]*.04+p[0]*.96,center[1]*.04+p[1]*.96])]){
          this.rays.setFromCamera(new Vector2(pt[0]/this.width*2-1,1-pt[1]/this.height*2),camera);
          const x=this.rays.intersectObject(a.mesh,false)[0],y=this.rays.intersectObject(b.mesh,false)[0];if(!x||!y)continue;const delta=x.distance-y.distance;if(Math.abs(delta)>1e-4)signs.add(Math.sign(delta));
        }
        if(signs.size>1)throw new Error(`Unsupported intersecting/interleaved primitives: ${a.mesh.name} / ${b.mesh.name}; split the physical geometry`);
        sign=[...signs][0]||0;
      }
    }
    cache.set(b.mesh,{a:a.geometryKey,b:b.geometryKey,sign});return sign;
  }
  /** @returns {Array<{name:string,attributes:Object,content:string}>} ordered vector parts */
  render(scene,camera){
    if(this.disposed)throw new Error('IllustrationSVGRenderer disposed');if(!camera.isOrthographicCamera)throw new Error('Only fixed orthographic cameras are supported');
    scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);camera.updateProjectionMatrix();
    const cameraKey=camera.matrixWorld.elements.join(',')+'|'+camera.projectionMatrix.elements.join(','),items=[],names=new Set();
    scene.traverseVisible(o=>{if(o.isMesh){if(o.userData.craftedEffect)return;if(names.has(o.name))throw new Error(`Duplicate primitive name: ${o.name}`);names.add(o.name);items.push(this.primitive(o,camera,cameraKey));}else if(o.isLine||o.isPoints)throw new Error(`Unsupported geometry "${o.name||o.type}"; use surface marks`);});
    const edges=items.map(()=>new Set()),incoming=items.map(()=>0);
    for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){const sign=this.relation(items[i],items[j],camera);if(sign){const [a,b]=sign>0?[i,j]:[j,i];if(svgPass(items[a].mesh)>svgPass(items[b].mesh))throw new Error(`SVG_LAYER_ORDER: ${items[a].mesh.name} is behind ${items[b].mesh.name} but assigned to a later SVG pass`);edges[a].add(b);incoming[b]++;}}
    const order=[],ready=incoming.map((n,i)=>n===0?i:-1).filter(i=>i>=0);
    while(ready.length){ready.sort((a,b)=>items[a].mesh.name<items[b].mesh.name?-1:1);const i=ready.shift();order.push(i);for(const j of edges[i])if(--incoming[j]===0)ready.push(j);}
    if(order.length!==items.length)throw new Error('Unsupported cyclic SVG painter order; split physical geometry instead of adding order biases');
    this.order=order.map(i=>items[i].mesh.name);
    // PDF consumers do not consistently honor SVG crispEdges. In print captures
    // only, close seams with face-coloured strokes clipped to the exact compound
    // coverage of the joined surface. This does not merge painter slots or move
    // geometry. Browser output avoids these large unused clip paths entirely.
    const contents=new Map();
    if(this.printMode){const joined=new Map();
      for(const i of order){const item=items[i],m=item.mesh.userData.illustration;if(!m.normals||!m.join)continue;const key=item.mesh.parent.uuid+'|'+m.join+'|'+svgPass(item.mesh);if(!joined.has(key))joined.set(key,[]);joined.get(key).push(item);}
      for(const group of joined.values()){const id=`${this.idPrefix||''}surface-${group[0].mesh.name}`,clip=`<defs><clipPath id="${escape(id)}"><path d="${group.map(p=>p.coverage).join('')}"/></clipPath></defs>`;for(const [j,item] of group.entries())contents.set(item.mesh,(j===0?clip:'')+item.content.replace(item.fillContent,`<g clip-path="url(#${escape(id)})">${item.fillContent}</g>`));}
    }
    return order.map(i=>{const {mesh}=items[i],content=contents.get(mesh)||items[i].content,m=mesh.userData.illustration;return {name:mesh.name,attributes:{'data-object':mesh.name,'data-svg-pass':String(svgPass(mesh)),'data-assemblies':(()=>{const names=[];for(let p=mesh.parent;p;p=p.parent)if(p.name)names.push(p.name);return names.join(' ');})(),...(m.effectFallback?{'data-effect-fallback':m.effectFallback}:{}),...(m.part?{'data-part':m.part}:{}),...(m.angle===undefined?{}:{'data-angle':num(m.angle)}),class:`solid${m.tone==='accent'&&!m.material?' accent':''}`,...(m.materialStyle?{style:m.materialStyle}:{})},content};});
  }
  serialize(scene,camera){return this.render(scene,camera).map(p=>`<g ${Object.entries(p.attributes).map(([k,v])=>`${k}="${escape(v)}"`).join(' ')}>${p.content}</g>`).join('');}
  /** Update only changed parts and actual order changes; keep the surrounding SVG. */
  mount(group,scene,camera){this.idPrefix=group.ownerSVGElement?.dataset.idPrefix||'';const nodes=new Map();let disposed=false;
    for(const el of [...group.children])if(el.hasAttribute('data-object'))nodes.set(el.getAttribute('data-object'),{el,content:el.innerHTML});
    const update=()=>{if(disposed)return;const parts=this.render(scene,camera),keep=new Set();const cursors=new Map([group,...(this.passTargets?.values()||[])].map(g=>[g,g.firstElementChild]));
      for(const p of parts){keep.add(p.name);let node=nodes.get(p.name);if(!node){node={el:group.ownerDocument.createElementNS('http://www.w3.org/2000/svg','g')};nodes.set(p.name,node);}
        for(const [k,v] of Object.entries(p.attributes))if(node.el.getAttribute(k)!==v)node.el.setAttribute(k,v);
        if(node.content!==p.content){node.el.innerHTML=p.content;node.content=p.content;}
        const target=this.passTargets?.get(Number(p.attributes['data-svg-pass']))||group,old=node.el.parentElement;if(old!==target&&cursors.get(old)===node.el)cursors.set(old,node.el.nextElementSibling);const cursor=cursors.get(target);if(cursor===node.el)cursors.set(target,cursor.nextElementSibling);else target.insertBefore(node.el,cursor);
      }
      for(const [name,node] of nodes)if(!keep.has(name)){node.el.remove();nodes.delete(name);}
    };
    this.mountedUpdate=update;update();return {update,dispose:()=>{disposed=true;nodes.clear();this.mountedUpdate=null;}};
  }
  setPassTargets(targets){this.passTargets=targets;this.mountedUpdate?.();}
  dispose(){this.disposed=true;this.cache=new WeakMap();this.pairs=new WeakMap();this.order=[];}
}
