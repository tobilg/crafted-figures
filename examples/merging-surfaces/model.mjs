/** Two Gaussian fields at a fixed iso-value. Volume is not conserved; this is a
 * field-blending explanation, not a fluid simulation. Units are model units. */
export function measure({separation}){if(!Number.isFinite(separation))throw new Error('separation must be finite');separation=Math.max(0,Math.min(50,separation));const d=separation/2,sigma=14,level=.6;
 const squared=x=>sigma*sigma*Math.log((Math.exp(-(((x-d)/sigma)**2))+Math.exp(-(((x+d)/sigma)**2)))/level);
 const radius=x=>Math.sqrt(Math.max(0,squared(x))),intervals=[];let start=null;const min=-50,max=50,step=.25;
 const root=(a,b)=>{for(let n=0;n<45;n++){const m=(a+b)/2;if((squared(a)>0)===(squared(m)>0))a=m;else b=m;}return (a+b)/2;};
 for(let x=min;x<max;x+=step){const a=squared(x),b=squared(x+step);if(a<=0&&b>0)start=root(x,x+step);if(a>0&&b<=0){intervals.push([start??min,root(x,x+step)]);start=null;}}
 return {separation,radius,intervals,reading:`${separation.toFixed(1)} separation · ${intervals.length} connected surface${intervals.length===1?'':'s'}`};}
export const poses={rest:{separation:50},mid:{separation:30},merged:{separation:0},max:{separation:0}};
