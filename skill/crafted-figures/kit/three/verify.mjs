import {Raycaster,Vector2,Vector3,Matrix3} from '../../runtime/three.mjs';
/** Independent mesh rays versus painted SVG, including excess artwork outside
 * the mesh. A subpixel boundary band accounts for raster/analytic silhouettes.
 * Tone checks derive flat normals from mesh faces and curved normals from the
 * author's analytic meridian, independently of the SVG tone polygons. */
export function inspectPaintedOrder(stage,root,{columns=36,rows=24,tones=false,edgeTolerance=.75}={}){
 if(!Number.isInteger(columns)||!Number.isInteger(rows)||columns<2||rows<2||columns>512||rows>512||!Number.isFinite(edgeTolerance)||edgeTolerance<0||edgeTolerance>1)throw new Error('inspection: grid 2..512 and edgeTolerance 0..1 CSS px required');
 const overlays=[...root.querySelectorAll('svg[data-vector-layer]')].map(el=>({el,value:el.style.pointerEvents}));for(const {el} of overlays)el.style.pointerEvents='auto';
 try{
  const svg=root.querySelector('svg.crafted'),rect=svg.getBoundingClientRect(),screenMatrix=svg.getScreenCTM(),meshes=[];stage.scene.updateMatrixWorld(true);
  stage.scene.traverseVisible(o=>{if(o.isMesh&&!o.userData.craftedEffect&&!o.userData.illustration?.effectFallback)meshes.push(o);});
  const rays=new Raycaster(),findings=[];let checked=0,toneSamples=0,boundarySamples=0,backgroundSamples=0;const joinedBoundarySamples=[];
  const cast=(nx,ny)=>{rays.setFromCamera(new Vector2(nx*2-1,1-ny*2),stage.camera);return rays.intersectObjects(meshes,false);};
  const neighbors=(nx,ny)=>[[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]].map(([x,y])=>cast(nx+x*edgeTolerance/rect.width,ny+y*edgeTolerance/rect.height));
  for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){
   const nx=(x+.5)/columns,ny=(y+.5)/rows,point=[nx*stage.width,ny*stage.height],screen=new DOMPoint(...point).matrixTransform(screenMatrix),sx=screen.x,sy=screen.y;
   if(sx<0||sy<0||sx>=innerWidth||sy>=innerHeight)continue;
   const hits=cast(nx,ny),els=document.elementsFromPoint(sx,sy),painted=els.find(el=>el instanceof SVGPathElement&&el.closest('[data-scene]')&&getComputedStyle(el).fill!=='none'&&el.isPointInFill(new DOMPoint(sx,sy).matrixTransform(el.getScreenCTM().inverse()))&&!el.closest('[data-effect-fallback]'));
   if(!hits.length){backgroundSamples++;if(painted){if(neighbors(nx,ny).some(h=>h.length)){boundarySamples++;continue;}findings.push({code:'SVG_EXCESS',actual:painted.closest('[data-object]')?.getAttribute('data-object'),point,message:'Painted solid SVG has no matching mesh surface'});}continue;}
   if(!painted){if(neighbors(nx,ny).some(h=>!h.length)){boundarySamples++;continue;}findings.push({code:'DRAWN_COVERAGE',expected:hits[0].object.name,point,message:'Mesh surface has no painted SVG face'});continue;}
   const actual=painted.closest('[data-object]')?.getAttribute('data-object'),hit=hits[0],expected=hit.object.name;if(!actual)continue;checked++;
   if(actual!==expected){const other=hits.find(h=>h.object.name===actual);if(other&&Math.abs(other.distance-hit.distance)<.08)continue;
    // Analytic profiles have a declared meridian approximation tolerance. At
    // the shared ring only, neighboring bands can differ by that subpixel
    // silhouette amount. This never exempts another solid or an interior swap.
    const a=other?.object,b=hit.object,ma=a?.userData.illustration,mb=b.userData.illustration,profile=b.parent?.userData.profile;
    if(a&&a.parent===b.parent&&profile&&ma.join===mb.join&&Math.abs(ma.chunk-mb.chunk)===1){
     const ring=ma.chunk<mb.chunk?ma.top:ma.bottom,projected=ring.map(p=>stage.renderer.project(new Vector3(...p).applyMatrix4(a.matrixWorld),stage.camera));let distance=Infinity;
     for(let i=0;i<projected.length;i++){const p=projected[i],q=projected[(i+1)%projected.length],dx=q[0]-p[0],dy=q[1]-p[1],t=Math.max(0,Math.min(1,((point[0]-p[0])*dx+(point[1]-p[1])*dy)/(dx*dx+dy*dy||1)));distance=Math.min(distance,Math.hypot(point[0]-p[0]-t*dx,point[1]-p[1]-t*dy));}
     const scale=a.getWorldScale(new Vector3()),limit=profile.tolerance*Math.max(scale.x,scale.y,scale.z)*stage.width/(stage.camera.right-stage.camera.left);
     if(distance<=limit){joinedBoundarySamples.push({actual,expected,point,distance,tolerance:limit,worldTolerance:profile.tolerance});continue;}
    }
    findings.push({code:'PAINTED_ORDER',actual,expected,point,gap:other?other.distance-hit.distance:null});continue;}
   if(!tones)continue;
   const object=hit.object,profile=object.parent?.userData.profile;let normal;
   if(profile){const p=object.parent.worldToLocal(hit.point.clone()),eps=(profile.zMax-profile.zMin)*1e-4,a=Math.max(profile.zMin,p.z-eps),b=Math.min(profile.zMax,p.z+eps),r=Math.hypot(p.x,p.y);if(r<1e-6||p.z<=profile.zMin+eps||p.z>=profile.zMax-eps)continue;normal=new Vector3(p.x/r,p.y/r,-(profile.radius(b)-profile.radius(a))/(b-a)).applyMatrix3(new Matrix3().getNormalMatrix(object.parent.matrixWorld)).normalize();}
   else if(!object.userData.illustration.normals)normal=hit.face.normal.clone().applyMatrix3(new Matrix3().getNormalMatrix(object.matrixWorld)).normalize();
   else continue; // Swept surface tone qualification uses its dedicated route fixture.
   const light=normal.dot(new Vector3(-Math.SQRT1_2,Math.SQRT1_2,0));
   if(Math.abs(normal.z-.9)<.025||[-.5,0,.5].some(t=>Math.abs(light-t)<.025))continue;
   const wanted=normal.z>.9?'top':'side-'+Math.max(0,Math.min(3,Math.floor((light+1)*2))),seen=[...painted.classList].find(c=>c==='top'||/^side-[0-3]$/.test(c));toneSamples++;
   if(wanted!==seen)findings.push({code:'SURFACE_TONE',actual,expected:wanted,observed:seen||'unclassified',point,message:'Painted tone disagrees with independently sampled surface normal'});
  }
  if(!checked)findings.push({code:'ORDER_NO_SAMPLES',message:'No visible solid samples were checked. Scroll the figure into view or increase the grid.'});
  if(tones&&!toneSamples)findings.push({code:'TONE_NO_SAMPLES',message:'No qualified flat/analytic surface tone samples; include a visible qualified surface.'});
  return {status:findings.length?'failed':'passed',checked,toneSamples,backgroundSamples,boundarySamples,joinedBoundarySamples,findings,assumptions:{sampling:'finite screen grid; exact hit-tested SVG fills versus native mesh rays',edgeToleranceCSS:edgeTolerance,toneMargin:.025,toneScope:'mesh face normals and analytic profiles; swept-route tones require separate fixture review',joinedBoundary:'adjacent analytic bands only, within the declared meridian tolerance at their shared ring; every such sample is reported'}};
 }finally{for(const {el,value} of overlays)el.style.pointerEvents=value;}
}
