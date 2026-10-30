# Three.js illustration geometry

Access helpers through `const k=kit.illustration`. `createStage` owns one native Three.js Scene and OrthographicCamera plus the SVG adapter. Returned primitives are native Three.js Meshes; `k.Group` is Three.js Group. Use normal Object3D position, rotation, quaternion, scale and parent/child transforms. Three.js owns those matrices and ray intersections.

```js
const stage=k.createStage({
  width:600,height:400,azimuth:-42,elevation:30,
  bounds:k.boxBounds([-80,-40,0],[80,40,100]),
  padding:{top:24,right:30,bottom:70,left:30},
  strokeWidth:config.stroke.width
});
const base=k.box('base',{width:160,depth:80,height:10,radius:6});
base.position.z=5;
stage.scene.add(base);
```

World Z is up. Box and cylinder origins are their centers. Keep one fixed camera and bounds that include every supported pose; do not refit on each frame. Tight bounds can be a list of actual extremal world points instead of a large enclosing box. Negative azimuths around −42° put the positive-X length toward the reader's right. Schema 1 uses the authored camera; schema 2 accepts camera overrides within the figure’s declared envelope. Review ordering and crops for each qualified view.

## Supported helpers

| Helper | Arguments and limits |
| --- | --- |
| `box(name,{width,depth,height,radius=0,tone='surface'})` | Convex rounded rectangle extruded along local Z; radius ≤ half the smaller plan dimension |
| `prism(name,{plan,height,tone,crease=false})` | Convex counterclockwise `[x,y]` perimeter; split concave constructions into physical parts |
| `cylinder(name,{radius,height,topRadius=radius,segments=96,tone})` | Cylinder or frustum, local Z axis; 16–256 segments, multiple of four |
| `annulus(name,{radius,innerRadius,height,segments=96,tone})` | Actual through-bore in both mesh and vector faces; inner radius < outer radius |
| `revolve(name,{profile,segments=96,tone})` | Group of adjacent frusta from increasing `[z,radius]` stations; endpoints and profile changes are physical dimensions |
| `tube(name,{points,radius=2,segments=24,radialSegments=24,tone})` | Three.js centripetal curve and TubeGeometry frames; 4–512 longitudinal and 12–96 radial samples, split into matching ring sections for ordering |
| `along(object,from,to)` | Put local +Z along a world/local-parent segment; construct the object's height equal to segment length |
| `mark(mesh,points,{closed=false,accent=false,width=1,normal=[0,0,1],part})` | Local surface strokes; width multiplies configured stroke width; returns the editable marking |
| `label(mesh,text,{at,u=[1,0,0],v=[0,-1,0],normal=[0,0,1],size=6})` | Local surface text; `size` is in drawing/world units. Text is escaped |
| `ringPoints(radius,z,count=96)` | Local XY ring points for markings |
| `ticks(mesh,{radius,z,count=60,every=5,major=4,minor=1.7,compact=false})` | Radial scale engraved on a local top face |
| `boxBounds(min,max)` | Eight corners for fixed camera bounds |

`tone` is `surface` or `accent`; CSS tokens provide all actual colors, including custom presets and both themes. MeshBasicMaterial colors are not a second styling interface. Surface normals control whether a marking is visible; a side inscription needs that side's normal. Keep its entire text rectangle inside the surface. For a face at local Y = −depth/2, use `u:[1,0,0]`, `v:[0,0,-1]`, `normal:[0,-1,0]`. For top text with the default basis, place the baseline near the negative-Y edge so ascenders stay inside the face.

Primitives generate geometry and private `userData.illustration` metadata together. Transform Object3D instances instead of modifying/replacing their BufferGeometry. Changed geometry, fabricated annotations, raw meshes, lines and points produce diagnostics. Do not clone a mesh to bypass the helpers; construct another primitive and place it. Use groups for articulated assemblies. Add surface markings with `mark`/`label`, not separate floating line objects.

## Contacts, curves and visibility

End a visible rod at a collar face and resume it at the other face. Do not leave a solid shaft intersecting a solid collar. If the bore is visible, use `annulus`. Give cutaways actual omitted walls; color does not create a hole. Divide cabinets into floor/back/end panels with shared boundary planes rather than overlapping full boxes.

Tube endpoints need sensible port tangents: use collinear first/second and penultimate/final points aimed into the port. Finish exactly at the port face. Use gentle bends with adequate radius and separation. The tested routes are simple open routes without self-crossing or tight view-aligned folds. Unrestricted cable routing is not promised. Tubes use the actual rings from Three.js TubeGeometry; the adapter hides internal caps and uses crisp shared fills with separately antialiased silhouette strokes to avoid independent fill-coverage hairlines. Outer edges remain separate; no depth bias or broad blur is used.

Painter ordering comes from projected overlap and Three.js ray-depth comparisons, followed by a deterministic dependency order. Average object depth is not used as a correctness argument. Interleaving/cycles fail explicitly: fix/split the geometry, then render all poses again. The finite overlap probes can miss an untested construction. Annular parts and tube sections do not establish arbitrary-mesh correctness; avoid mutually threaded or generally intersecting arrangements.

`stage.render()` returns ordered SVG children. `stage.mount(group)` creates a retained DOM view with `update()`/`dispose()`; call update after changing scene transforms. `stage.dispose()` releases geometry/materials and renderer caches. Static export can run with browser globals completely absent. Unsupported scene objects never fall back silently to a different renderer.

## Version-2 construction additions

Pass `{config,tokens}` into createStage to honor a declared v2 camera and material roles. `reservedBottom` reserves readout space inside the same drawing rectangle; SVG and canvas still share the full viewport. The authored negative-azimuth example above remains valid for v1; public v2 azimuths use [0,360).

- `extrude(name,{plan,height,tone})` triangulates a concave perimeter into actual convex pieces and omits internal construction edges. Live concavity remains an assembly, not a general boolean engine.
- `profile(name,{radius:z=>r,zMin,zMax,steps,segments,tone})` samples an analytic meridian and retains it for independent fidelity samples. `sphere` supports zMin/zMax cuts. Increasing steps improves geometric approximation; audit coarse silhouettes instead of assuming the shader/tones repaired them.
- `splitAnnulus` decomposes an actual through-bore into orderable sectors when a rod remains visible through it. The normal annulus is cheaper when one complete primitive has a valid painter order. Never substitute a solid disc for a visible opening.
- `material(object,id,{role})`, `port(object,name,{at,direction,radius})`, and `anchor(object,name)` bind appearance and local/world terminal frames to actual native objects. Ports must lie on their real hosts.
- `bolt`, `boltCircle`, `flange`, `knob`, `ruler`, `spring`, `connector`, `routeRings` and `display` compose the supported primitives. The spring is an actual routed helix and must maintain pitch/clearance. Display content uses a local affine face plane and a clip rectangle; model the enclosing bezel as physical pieces.
- `replacePart` preserves a changing shape's semantic ID and transform and disposes old buffers. Unsupported shear, reflections and geometry metadata mutation fail explicitly.

Use `mark(...,{reason:'printed graduation'})` only for a specific intentional line termination. It is not a blanket audit bypass. The renderer samples overlapping physical meshes for order; the independent browser painted-order test compares actual SVG faces against mesh rays. Tests are finite evidence, not unrestricted mesh support.

Analytic `profile` refines its initial `steps` until the sampled meridian midpoint error is within `tolerance` (default 0.04 world units). The audit repeats independent midpoint checks against the retained analytic function. Refinement is bounded; a discontinuous or excessively oscillating function fails rather than silently becoming a coarse substitute. Sphere segments use this same refinement near their poles.

Tube `segments` and `radialSegments` are explicit approximation controls. For close-up/print cables the canonical fixtures use 64 longitudinal and 48 radial samples; the small defaults are suitable only after inspecting the target output scale. Increasing samples changes geometric fidelity and cost, not model values. Smooth outlines follow interpolated surface-normal silhouettes across shared ring boundaries; chunk hull edges are not physical seams. On screen, smooth joined fills and decomposed flat surfaces use `shape-rendering:crispEdges`; their silhouette strokes retain normal antialiasing. This also avoids radial hairlines between annular sectors at embedded CSS sizes. The print-specific clipped seam treatment is described in [printing](printing.md). Neither treatment changes the independently checked painter positions.

The spring recipe defaults to 240 longitudinal / 32 radial samples for five turns, with 32 centerline waypoints per turn. Inspect the actual export size before reducing these values; too few samples visibly polygonize the coil. Compression changes height and preserves the model, wire radius and seated end geometry.

Surface marks, face text and displays fade smoothly as their host normal approaches the camera silhouette (cosine 0–0.12); fully facing details retain their normal opacity. This is a facing treatment, not an audit exemption or hidden geometry.

## Construction recipes

Copy `assets/templates/construction-details/` for an executable sheet with three qualified camera views and model-driven turn poses. Its `scene.mjs` declares actual coupling ports and a pipe/saddle seat contact. Every detail lives on its host geometry.

- `taperedPrism(name,{bottom,top,height,tone})` connects matched convex counterclockwise rings. `beveledSlab(name,{width,depth,height,bevel,tone})` uses three real bands; bevel must be less than half each dimension.
- `routeTexture(tube,{kind:'stripe'|'braid',strands,turns,width,accent})` follows the existing sampled tube rings. Stripes run longitudinally; braid winds in both directions. Phase continues across chunk boundaries. Choose enough tube segments for the winding and audit the detail samples; this is engraved surface treatment, not separate woven strands.
- `profileSeam(profile,{angle,width})` follows a meridian. `profileGrooves(profile,{every,width})` engraves existing ring stations. Their facing normals include the meridian slope. A seam must end at a real boundary or a declared functional termination.
- `surfaceWeld(host,{from,to,across,normal,amplitude,count,width})` draws bounded scalloped engraving in a flat joint plane. `ventPanel(name,{width,depth,height,border,slots,slat})` makes real openings between rails and slats.
- `saddle(name,{radius,width,depth,height,segments})` creates a concave seat outside the supported circular section. Local Z is the pipe axis and local Y is seat height. Width must be less than the diameter and height greater than radius. Split a crossing pipe at the saddle's axial boundaries for valid painter ordering. Declare a contact on the actual seat face; tangent planes avoid cutting into the pipe between arc samples.

Port radii describe the mating cross-section, not just a connector label. Positive radii are checked using 64 transformed rim samples against both hosts and each other. Radius zero deliberately declares only a point anchor; it does not qualify a fitting's rim. Use a physically modeled reducer for mismatched diameters. Surface marks, labels and display corners are checked against actual host triangles. A line-ending reason does not exempt an off-host mark.

## Partial scales

`ticks(mesh,{radius,z,count=60,every=5,major=4,minor=1.7,compact=false,from=0,span=2*Math.PI})` attaches graduations to a local XY face. Angles are radians from −Y toward +X; a negative span reverses the sweep. `count` is the number of intervals. Partial sweeps include both endpoints, including the final endpoint in compact mode even when it is not a major graduation. Full circles omit the duplicate endpoint. `span` must be nonzero and at most one revolution in either direction; counts must be positive integers and lengths positive and no greater than the radius. Invalid inputs fail before any marks are added.

```js
k.ticks(face,{radius:41,z:3,count:48,every:8,major:5,minor:2.4,
  from:-2*Math.PI/3,span:4*Math.PI/3,compact:config.detail==='compact'});
```

The scale, pointer and text inherit the host mesh's transforms and surface ordering. See `assets/templates/sector-gauge/`.
