import {measure} from './model.mjs';
/** Partial graduations are surface marks on the same native mesh as the dial. */
export function createGauge({kit,config}){
  const k=kit.illustration,stage=k.createStage({width:600,height:400,azimuth:-55,elevation:50,bounds:k.boxBounds([-68,-54,-13],[68,54,9]),padding:{top:28,right:40,bottom:86,left:40},strokeWidth:config.stroke.width});
  const base=k.box('base',{width:136,depth:108,height:10,radius:9});base.position.z=-8;
  const face=k.cylinder('scale',{radius:47,height:6});
  k.mark(face,k.ringPoints(44,3),{closed:true,reason:'outer scale boundary'});
  k.ticks(face,{radius:41,z:3,count:48,every:8,major:5,minor:2.4,from:-2*Math.PI/3,span:4*Math.PI/3,compact:config.detail==='compact'});
  for(const percent of [0,50,100]){
    const a=measure({percent}).angleDeg*Math.PI/180;
    k.label(face,String(percent),{at:[25*Math.sin(a)+4,-25*Math.cos(a),3],size:4.5});
  }
  const knob=k.knob('knob',{radius:7,height:5,count:32});knob.position.z=5.5;
  // A printed pointer uses the host face's ordering and cannot float off it.
  const pointer=k.mark(face,[[0,-8,3],[0,-35,3]],{accent:true,width:2/config.stroke.width,part:'needle',reason:'printed scale pointer'});
  stage.scene.add(base,face,knob);
  function update(state){const m=measure(state),a=m.angleDeg*Math.PI/180;pointer.points=[8,35].map(r=>[r*Math.sin(a),-r*Math.cos(a),3]);pointer.angle=m.angleDeg;return m;}
  return {...stage,face,pointer,update};
}
