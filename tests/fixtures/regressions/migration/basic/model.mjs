/** Manually extracted from the supplied MIT Anatomy dial. Units are drawing pixels. */
export const BLOCKS=[18,14,10], DIAL_X=58, BLOCK_W=15.6, STEP=16, TIP_R=2.6, BASE=8, PER_TURN=20;
export const STOPS=BLOCKS.map((_,i)=>DIAL_X-(-24+BLOCK_W/2)-STEP*i);
export const REACH=[STOPS[2]-6,STOPS[0]+6];
export function heightUnder(x){let top=BASE;BLOCKS.forEach((h,i)=>{const from=x-24+STEP*i,to=from+BLOCK_W;if(to>DIAL_X-TIP_R&&from<DIAL_X+TIP_R)top=Math.max(top,BASE+h);});return top;}
export function blockUnder(x){return BLOCKS.findIndex((_,i)=>{const from=x-24+STEP*i;return DIAL_X>=from&&DIAL_X<=from+BLOCK_W;});}
/** @param {{carriageX:number,tipHeight:number}} state */
export function measure(state){if(!state||!Number.isFinite(state.carriageX)||!Number.isFinite(state.tipHeight))throw new Error('finite carriageX and tipHeight required');const x=Math.max(REACH[0],Math.min(REACH[1],state.carriageX)),height=state.tipHeight-BASE,index=blockUnder(x);return {x,tip:state.tipHeight,height,angle:height/PER_TURN*Math.PI*2,index,reading:`${index<0?'between blocks':'block '+(index+1)} · reads ${height.toFixed(1)} px`};}
/** Original four-substep spring; clamp dt in the caller as upstream did. */
export function stepTip(tip,want,dt){const next={...tip};for(let i=0;i<4;i++){next.rate+=((want-next.at)*420-next.rate*26)*dt/4;next.at+=next.rate*dt/4;}if(Math.abs(want-next.at)<.005&&Math.abs(next.rate)<.005){next.at=want;next.rate=0;}return next;}
export const poseAt=x=>({carriageX:x,tipHeight:heightUnder(x)});
export const poses={rest:poseAt(STOPS[0]),mid:poseAt(STOPS[1]),max:poseAt(STOPS[2]),transition:poseAt(58)};
