# Authoring

Use Node 22.13+ or Node 24+. The extracted release artifact includes its runtime; no npm installation is needed. Source checkouts must build the artifact first. See [verification.md](verification.md) for browser setup when checks or PDFs are requested. Copy a template from `assets/templates/` into your figure's working directory, inside or outside the installed package. Source files receive the toolkit from the wrapper; they need no imports from a parent checkout or bare `three` imports in the authoring directory.

Choose a starting point:

| Template | Useful pattern |
| --- | --- |
| `basic-figure/` | Static capacity tray; a count maps to actual occupied sockets |
| `sector-gauge/` | Bounded partial scales, compact endpoints and shared pointer/readout state |
| `dial-indicator/` | Continuous measurement, contact probe, moving stage, shared reading |
| `lift-valve/` | Cutaway, through-bore, revolved bonnet and routed tubes |
| `control-cabinet/` | Wiring, threshold-driven contacts and text on faces |
| `hinged-arm/` | Native Three.js group rotation and a kinematic readout |

These are starting examples, not required visual metaphors. For a different concept, change the model and geometry together. Read [craft.md](craft.md) for composition and [geometry.md](geometry.md) for the supported primitives.

## Public figure boundary

The default export requires:

- `id`: a nonempty lowercase identifier.
- `capabilities: {detail: ['compact','standard']}`: declare only modes actually supported.
- Plain JSON objects `initialState` and `poses`, including `rest`. Rest equals initialState; other poses have its complete state shape.
- `render({kit, config, tokens, state})`: returns `{viewBox:[x,y,width,height],body,title,description}`. A Three.js-backed figure also returns `renderer:'three-illustration'` for provenance.
- Optional `clientEntry: new URL('./client.mjs', import.meta.url)`.

Render is pure with respect to its inputs: no clock, randomness, browser globals or environment-selected themes. The wrapper owns the outer SVG, styles, metadata and frame. Author SVG children are trusted executable authoring code; use `kit.escapeText` for author-supplied strings. Title/description and configuration are escaped by the wrapper.

Create one scene in `scene.mjs`, shared by static render and browser mount. Keep state calculations in a pure `model.mjs`. Dispose a temporary scene in `finally` after rendering:

```js
render({kit,config,state}) {
  const stage=createScene({kit,config});
  try {
    const model=stage.update(state);
    return {
      renderer:'three-illustration', viewBox:[0,0,600,400],
      body:`<g data-scene="three">${stage.render()}</g>` +
        `<text class="reading" data-part="static-readout" x="28" y="370">${kit.escapeText(model.reading)}</text>`,
      title:'Your explanation', description:'What the visible state means'
    };
  } finally { stage.dispose(); }
}
```

The SVG is generated directly in Node from Three.js matrices and meshes. Static rendering needs neither DOM nor WebGL. Browser exports bundle the actual modules with Vite 8.3.5 and need no network when viewed.

## Interaction

`mount({root,kit,tokens,config,initialState})` returns idempotent cleanup. The `kit`/`tokens` arguments were added in 0.2; earlier clients receiving only root/config/initialState still work. The selected exported pose is initialState, never an implicit reset to rest. The wrapper provides `[data-controls]` and `[data-live-readout]`; create controls only during mount so no-JavaScript artwork is honest.

For one scalar input, use `kit.illustration.mountScalarScene`:

```js
return kit.illustration.mountScalarScene({
  root,config,stage:createScene({kit,config}),
  initial:initialState.distanceMm,
  state:distanceMm=>({distanceMm}),
  control:{label:'Distance (mm)',min:0,max:10,step:.1},
  poses:{Rest:0,Mid:5,Max:10}
});
```

`stage.update(state)` updates Three.js Object3D transforms and returns the model's `reading`. The helper renders that same displayed state, supplies pointer/native keyboard controls and optional pose buttons, and cleans up geometry/materials/listeners/frames. `idleAt` is optional; idle tours remain off by default and stop on user input. Disabled/reduced motion applies controls immediately. Hidden/offscreen/settled figures stop scheduling.

For multiple inputs, use `stage.mount(svgGroup)` to get `{update,dispose}` and implement the controls you actually need. The mounted renderer retains stable `data-object` groups, patches changed contents and reorders only when required. Dispose the view and stage as well as listeners and any animation controller. The existing `kit.scalarMotion` utility is available for scalar easing.

Use `kit.illustration` for geometry; the retained M1 projection helpers were removed in 0.5.0. There is one Three.js-based solid renderer. Schema 2 supports declared, qualified orthographic views and bounded production effects with matching depth passes. Arbitrary meshes and unrestricted camera movement remain unsupported. See [migration.md](migration.md) when updating an earlier prototype source.
