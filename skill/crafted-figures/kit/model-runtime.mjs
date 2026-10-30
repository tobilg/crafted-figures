/** One scalar animation clock shared by example clients. No scheduling while settled,
 * hidden, offscreen, disabled or reduced. A user update permanently stops the tour.
 * @param {{root:Element,motion:object,initial:number,draw:Function,idleAt?:Function}} options
 */
export function scalarMotion({root,motion,initial,draw,idleAt}) {
  let value=initial,target=initial,from=initial,start=null,frame=0,visible=true,disposed=false,touring=Boolean(motion.idleTour&&idleAt),elapsed=0,last=null,paused=false;
  const media=matchMedia('(prefers-reduced-motion: reduce)');
  const canEase=()=>motion.enabled&&!media.matches&&motion.durationMs>0;
  const active=()=>visible&&!document.hidden&&!disposed&&!paused;
  const stats={frames:0,pending:false,disposed:false};
  const paint=()=>draw(value);
  function cancel(){if(frame) cancelAnimationFrame(frame);frame=0;stats.pending=false;last=null;start=null;from=value;}
  function run(){if(!frame&&active()&&canEase()&&(touring||value!==target)){frame=requestAnimationFrame(tick);stats.pending=true;}}
  function tick(now){
    frame=0;stats.pending=false;
    if(!active()||!canEase())return;
    stats.frames++;
    if(touring){elapsed+=last===null?0:Math.min(64,now-last);target=idleAt(elapsed);value=target;}
    else {start??=now;const t=Math.min(1,(now-start)/motion.durationMs);value=from+(target-from)*(t*t*(3-2*t));if(t===1)value=target;}
    last=now;paint();run();
  }
  function set(next,user=true){if(disposed)return;if(user)touring=false;cancel();target=next;from=value;if(!canEase()||!active()){value=target;paint();}else run();}
  function sync(){cancel();if(!canEase()){value=target;paint();}else run();}
  const observer=new IntersectionObserver(entries=>{visible=entries.at(-1).isIntersecting;sync();});observer.observe(root);
  document.addEventListener('visibilitychange',sync);media.addEventListener('change',sync);
  paint();run();
  return {set,stats,jump(next){if(disposed)return;cancel();touring=false;target=value=next;paint();},pause(){paused=true;cancel();},resume(){paused=false;run();},get value(){return value;},dispose(){if(disposed)return;disposed=true;stats.disposed=true;cancel();observer.disconnect();document.removeEventListener('visibilitychange',sync);media.removeEventListener('change',sync);}};
}
