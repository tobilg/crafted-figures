/** Static Three.js starter: occupied sockets and the readout share one count. */
export default {
  id:'capacity-tray',capabilities:{detail:['compact','standard']},initialState:{occupied:3},poses:{rest:{occupied:3},mid:{occupied:2},max:{occupied:5}},
  render({kit,config,state}){
    if(!Number.isInteger(state.occupied)||state.occupied<0||state.occupied>5)throw new Error('occupied must be an integer 0..5');
    const k=kit.illustration,stage=k.createStage({width:560,height:300,azimuth:-42,bounds:k.boxBounds([-90,-30,-10],[90,30,35]),padding:{top:25,right:25,bottom:55,left:25},strokeWidth:config.stroke.width});
    try{
      const base=k.box('tray',{width:180,depth:60,height:10,radius:6});base.position.z=-5;stage.scene.add(base);
      for(let i=0;i<5;i++){const x=-64+i*32;k.mark(base,k.ringPoints(11,5.01,64).map(([a,b,z])=>[a+x,b,z]),{closed:true});if(i<state.occupied){const peg=k.cylinder('peg-'+i,{radius:9,height:35,tone:'accent'});peg.position.set(x,0,17.5);stage.scene.add(peg);}}
      if(config.detail==='standard')for(const x of [-82,82])for(const y of [-22,22])k.mark(base,k.ringPoints(1.8,5.01,24).map(([a,b,z])=>[a+x,b+y,z]),{closed:true});
      return {renderer:'three-illustration',viewBox:[0,0,560,300],body:`<g data-scene="three">${stage.render()}</g><text class="reading" x="25" y="280">${state.occupied} / 5 occupied</text>`,title:'Capacity tray',description:`${state.occupied} of five sockets are occupied. Each raised peg represents one occupied slot.`};
    }finally{stage.dispose();}
  }
};
