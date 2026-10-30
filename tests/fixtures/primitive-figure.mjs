// Public figure contracts accept SVG primitives, without requiring path builders.
export default {
  id:'primitive-block',
  capabilities:{detail:['compact','standard']},
  initialState:{},
  poses:{rest:{}},
  render(){
    return {
      viewBox:[0,0,300,220],
      title:'Bored support block',
      description:'A cylindrical opening passes through the top of a solid support.',
      body:`<polygon class="side-0" points="50,100 150,150 150,190 50,140"/>
<polygon class="side-1" points="150,150 250,100 250,140 150,190"/>
<polygon class="top" points="50,100 150,50 250,100 150,150"/>
<ellipse class="surface" cx="150" cy="100" rx="30" ry="15"/>
<polyline class="edge" points="50,100 150,50 250,100 250,140 150,190 50,140 50,100 150,150 250,100"/>
<line class="edge" x1="150" y1="150" x2="150" y2="190"/>
<ellipse class="edge" cx="150" cy="100" rx="30" ry="15"/>`
    };
  }
};
