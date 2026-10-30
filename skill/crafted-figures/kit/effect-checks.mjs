/** Reusable browser verification for the packaged drive tool. GPU landmark
 * checks isolate an authored glow/spark at a declared hidden or unobstructed pose.
 * Asymmetric volumes are not treated as centroid fiducials. */
export async function inspectEffects(page,options={}){
 return page.locator('[data-figure]').evaluate((root,options)=>{
  const fx=root.__effects,s=root.__stage;if(!fx||!s)throw new Error('effects inspection requires the figure effects/stage boundary');
  const findings=[],passes=[],landmarks=[],mode=options.mode||'webgl',tolerance=options.tolerance??.5,rect=root.querySelector('svg.crafted').getBoundingClientRect();
  if(fx.stats.mode!==mode)findings.push({code:'EFFECT_MODE',expected:mode,actual:fx.stats.mode});
  const fallbacks=[...root.querySelectorAll('[data-effect-fallback]')].filter(el=>getComputedStyle(el).display!=='none'&&el.getClientRects().length).map(el=>el.dataset.effectFallback);
  for(const name of options.requiredFallbacks||[])if(!fallbacks.includes(name))findings.push({code:'EFFECT_FALLBACK',effect:name,message:'Required visible vector fallback is absent'});
  const pixels=canvas=>{const gl=canvas.getContext('webgl2');if(!gl||gl.isContextLost())throw new Error('No live WebGL context for GPU inspection');const width=gl.drawingBufferWidth,height=gl.drawingBufferHeight,data=new Uint8Array(width*height*4);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,data);let alpha=0,xsum=0,ysum=0,colored=0,edgePixels=0;for(let y=0;y<height;y++)for(let x=0;x<width;x++){const a=data[(y*width+x)*4+3];alpha+=a;xsum+=(x+.5)*a;ysum+=(height-y-.5)*a;if(a>4){colored++;if(x===0||y===0||x===width-1||y===height-1)edgePixels++;}}return {width,height,alpha,colored,edgePixels,centroid:alpha?[xsum/alpha,ysum/alpha]:null};};
  if(mode==='webgl'&&fx.stats.mode==='webgl'){
   fx.render(root.__craftedController?.getState?.().time??0);
   for(const canvas of fx.canvases){const r=canvas.getBoundingClientRect(),error=Math.max(Math.abs(rect.left-r.left),Math.abs(rect.top-r.top),Math.abs(rect.width-r.width),Math.abs(rect.height-r.height)),sample=pixels(canvas);passes.push({layer:canvas.dataset.effectLayer,error,...sample});if(error>tolerance)findings.push({code:'EFFECT_REGISTRATION',layer:canvas.dataset.effectLayer,error,tolerance});if(options.boundaries&&sample.edgePixels)findings.push({code:'EFFECT_BOUNDARY',layer:canvas.dataset.effectLayer,measured:sample.edgePixels,message:'Effect reaches the outer canvas edge; correct fitting or spatial fade'});}
   for(const landmark of options.landmarks||[]){const effect=s.scene.getObjectByName(landmark.effect),meta=effect?.userData.craftedEffect;if(!meta||!['glow','spark'].includes(meta.kind))throw new Error(`GPU landmark ${landmark.effect}: select an authored glow/spark; volume centroids are not registration fiducials`);
    const saved=[];s.scene.traverse(o=>{if(o.userData.craftedEffect){saved.push([o,o.visible]);o.visible=o===effect;}});
    try{fx.render(root.__craftedController?.getState?.().time??0);const canvas=fx.canvases.find(c=>Number(c.dataset.effectLayer)===meta.layer),sample=pixels(canvas),r=canvas.getBoundingClientRect(),p=effect.position.clone();effect.getWorldPosition(p);const expected=s.renderer.project(p,s.camera).map((n,i)=>n*(i?r.height/s.height:r.width/s.width)+(i?rect.top:rect.left)),actual=sample.centroid?.map((n,i)=>n*(i?r.height/sample.height:r.width/sample.width)+(i?r.top:r.left)),error=actual?Math.hypot(actual[0]-expected[0],actual[1]-expected[1]):null;
     landmarks.push({effect:landmark.effect,visibility:landmark.visibility||'visible',expected,actual,error,...sample});
     if(landmark.visibility==='hidden'){if(sample.colored)findings.push({code:'EFFECT_OCCLUSION',effect:landmark.effect,measured:sample.colored});}
     else if(!sample.colored||error>tolerance)findings.push({code:'EFFECT_GPU_REGISTRATION',effect:landmark.effect,error,tolerance,message:'Use an unobstructed symmetric marker pose; inspect sizing, projection and occlusion'});
    }finally{for(const [o,visible] of saved)o.visible=visible;fx.render(root.__craftedController?.getState?.().time??0);}
   }
  }
  if(mode==='vector'&&fx.canvases.some(c=>!c.hidden))findings.push({code:'EFFECT_CANVAS_VISIBLE',message:'Fallback mode retains a visible canvas'});
  return {status:findings.length?'failed':'passed',mode:fx.stats.mode,passes,landmarks,fallbacks,findings};
 },options);
}
export async function loseEffectsContext(page,options={}){
 await page.locator('[data-figure]').evaluate(root=>{const gl=root.__effects?.canvases[0]?.getContext('webgl2'),extension=gl?.getExtension('WEBGL_lose_context');if(!extension)throw new Error('Actual context loss requires a live context and WEBGL_lose_context');extension.loseContext();});
 await page.waitForFunction(()=>document.querySelector('[data-figure]').__effects.stats.mode==='vector');
 return inspectEffects(page,{...options,mode:'vector'});
}
