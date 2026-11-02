# Craft recipes

A good figure is true, and someone wants to look at it. Get the first right before the second, and do not stop at the first.

## Work out how it really works

Before any geometry, write down what the object does and the chain of parts from input to result. A comment at the top of `scene.mjs` is enough.

- **Every part has a job.** List the parts and say what each does. A part with no job stays only if it helps a reader recognize the object.
- **Nothing floats.** Say what holds each part. A support is part of the object, not scenery.
- **Driving parts touch.** If one part moves another, they meet in every pose, and the motion you draw passes through that contact.
- **Motion follows the real path.** A hinge swings on an arc, a slide runs straight, a spring shortens instead of teleporting.
- **Controls are real steps.** Each control is something the real object lets you do. If a reader can act out of order, like pressing start with the door open, the model decides what happens and the figure shows it.
- **Say what you simplified.** When you are unsure how something works, or leave a part out, the caption says so.

Start from the observable relationship: what the reader can vary, what moves, what the number means. Keep the model, its reading and the geometry on one state.

## Make it worth looking at

Unless the request names another medium, a brand or a technical drawing, use `"preset": "illustrated"` for everyday objects and general readers. See [configuration.md](configuration.md). An explicit request always wins.

- **Draw the thing itself.** A reader should name the object with the captions hidden. Give it the features people know it by: a toaster's slots and lever, a washer's round door and drum. Do not reduce it to a rig on a base plate.
- **Commit to color.** Pick one strong body color and one or two that contrast with it, from `material(part, id)`: `tomato`, `mint`, `teal`, `mustard`, `sky`, `cream`, `wood`, `charcoal`. Use `chrome`, `steel` and `brass` for metal. A part left without a material falls back to neutral, which reads as unfinished.
- **Print on the surfaces.** Bare faces look like a diagram. Add a made-up badge, a settings scale, a warning sticker, vents, screws and seams with `label` and `mark`. Never use a real brand name or logo unless asked.
- **Add small things that tell a story.** A cup under the spout, a slice waiting on a plate, a basket beside the washer. They need no mechanism. They only need to rest on something, clear of the working parts.
- **Number what the reader should learn.** Use `callouts` for the parts that carry the explanation, usually three to ten, and light up the ones working in each state. See [authoring.md](authoring.md). Leave the rest unlabeled.
- **Give natural things a natural shape.** A perfect sphere reads as a ball. Use `profile` with `raisedLight` for an apple's shoulders and flattened base, vary the size of repeated things, and turn each one a little differently.
- **Fill the rectangle.** Use tight bounds and no oversized base plate. If the object stands on something, make it a real thing such as a counter, a cutting board or a mat, and pass `ground` as its top so the shadow falls on it.
- **Round what is round.** Curves and rounded corners shade smoothly in this preset, so give housings a `radius`, and use `profile`, `sphere` or `beveledSlab` where a real object has a soft shoulder. A sharp box reads as a crate.
- **Show the working face.** With the default azimuth of 42 the +Y face sits on the reader's right and is the bright one, so put dials, doors and controls there. The +X face on the left is darker, which suits a badge or vents.
- **Keep the object whole, and open it as little as you can.** The reader has to recognize the object before the mechanism means anything. Keep most of the case on, and show the inside through a real opening: a window, an open door, one panel off. Remove a whole wall only when nothing smaller shows the idea, and then keep the object's outline: a corner, a rim or a lid. Cut the bright right-hand face when you can. If the interesting side falls on the dark left, turn the object or change the azimuth instead of lightening the materials.

Detail costs SVG bytes and redraw time for every part, so choose the cheap form of each detail:

- Prefer `mark` and `label` on a host to a modeled part.
- Use low `segments` on small things: 16 for a screw or stem, 32 for a knob. The default of 96 is for large round parts.
- A `sphere` or `profile` refines until it is within `tolerance` of the true curve, so `steps` and `segments` alone barely reduce it. Pass `tolerance: 0.1` on a small ball: a 3-unit ball costs about 25 KB at the default. Going much coarser can fail the tone check.
- To show something flowing along a tube, change `material` on successive chunks of the route.
- Do not model what the reader cannot see.
- Hide optional ornament behind the `standard` detail setting.

See `assets/templates/kitchen-scale/` for all of this in one small figure.

## Choose a useful construction

- **Measurement:** a stage, probe and scale. The probe foot meets the stage in every pose; the shaft ends at its guide. Reuse the dial template's separation of pure model, scene and client. A smaller gauge still needs a readable HTML reading on phones.
- **Flow or capacity:** expose the working opening or occupied space. The valve's removed front wall makes the seat/poppet gap visible. Its 0–100% reading describes relative travel, not an unsupported physical flow calculation. A capacity tray maps each occupied slot to an actual peg.
- **Thresholds:** repeat a small module and show its actual state. The cabinet's bridges visibly meet or leave their terminal tops at each threshold. Put labels on unobstructed faces, away from ports and moving contacts. Explain schematic omissions in the caption.
- **Motion in depth:** use a native Group around a real pivot. Keep local child coordinates relative to that pivot. The arm's tool position and cosine readout come from the same joint angle; the pedestal, hubs and links have explicit mating planes.

## Composition and finish

Fit all poses with one camera, leaving an intentional text band. A huge axis-aligned bounding box can waste half the drawing: use actual extremal points when the tall parts occupy only a small region. Inspect both 390 and 960 CSS px views. Keep a title/description and normal-size HTML controls/readout even when the drawing has tiny engraved labels.

Use rounded housings and enough markings to say what the object is and how big it is. In a technical drawing keep them restrained, because the mechanism is the subject. In an illustrated figure they are much of its character. There is no part quota. A cutaway needs a clear missing wall, real thickness, and a caption that names what was removed.

Choose explicit contact surfaces before adding motion. Avoid geometry penetrations disguised as seams. Pipes start and end at ports; bends respect the available space. A supported silhouette can still have an ugly joint, so inspect 4× crops of the seat, collar, hinge, tube bend and overlapping support—not only the full image.

Four-tone shading and non-scaling strokes come from shared tokens. Test both themes rather than inverting a screenshot. Accent is a semantic highlight: the quantity, active part or control. Keep neutral structure readable. Do not put long prose in perspective; reserve face text for short markings and keep the explanation in the frame.

## Iterate from evidence

Build the simplest explanatory pose, then check min/mid/max and crossing positions. Use the ordinary CLI check for offline loading and metadata, and add model-specific assertions for the real geometry. Rendering without errors does not prove good composition or correct physical contacts. Record observed defects and re-inspect their fixes. Do not claim realism, calibration, unrestricted camera movement or shader support from an attractive static figure.

Then look at it as a reader would. Checks prove the figure is correct, not that it is any good, so open a screenshot and ask:

- Can you name the object without the captions?
- Is there something to look at beyond the mechanism?
- Does the drawing fill its rectangle?
- Are text and small parts legible at 390 px?

If a figure passes every check and still looks like a diagram of a generic box, it is not finished.

## Advanced construction choices

Use an analytic `profile` for a waisted nozzle or curved housing: the meridian is the real input to SVG, Three mesh and fidelity checks. Use a radius function only when it describes the intended object; a cylinder renamed as a drop is not a morph. `merging-surfaces` is an explicit Gaussian level-set recipe, not a claim of fluid volume conservation. Read its model before changing its physical interpretation.

For a supported rod, split a surrounding annulus into physical sectors so near and far sides can sort around the rod. The spring-probe starter demonstrates this. For a cable, place the terminal at a real boundary and give the first and last route spans a tangent matching its port; otherwise the cross-section may penetrate a host even when the centerline touches it. Inspect bends as well as endpoints. A route treatment should use the route's actual ring frames (`routeRings`), not screen-space stripes.

Construct tees, elbows and cutaways from physically separated connector/annular sleeves and bent route pieces. A tube's visible solid cap is suitable for an opaque schematic terminal; do not claim an exposed bore unless it is actually modeled. Use `connector` for a visible annular sleeve, `flange` for bolted rims and `boltCircle` for mating plates. Feet, posts, rails and pads can remain explicit boxes/cylinders with declared contact anchors; they do not need separate engine types. A curved saddle can be a concave extruded cross-section whose inner arc matches the supported cylinder; audit actual contact points and avoid using a large invisible clearance proxy.

For a close-up or scene edit, inspect the existing model/config before changing geometry. Preserve source/model hashes for an appearance-only request. Keep captions and legends in the authored render result (`caption`, `figureNumber`, `legend: [{label,description}]`) and long explanations in the frame. The frame validates and escapes these strings. Select a physical metaphor from the relationship, not from whichever starter happens to be shortest.
