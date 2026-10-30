# Deterministic motion

Use `kit.illustration.mountScalarScene` for a single scalar and native keyboard/pointer input. `stage.update(state)` returns the same model reading that places geometry. It accepts a cleanup function as before; its returned function additionally exposes getState/setState/pause/resume/getStats. `kit.registerController(root, result, {poses})` normalizes that or a controller object. The standalone wrapper registers it automatically. Controllers belong to one root.

For explicit sequences, `clipControls({root,controller,duration,motion})` adds Play/Pause/Replay and deterministic `setTime(seconds)`. It never starts on load. Disabled/reduced motion and hidden/offscreen states stop scheduling. Time changes remain immediate. Capture tools use controller state/time, never wall-clock guesses.

`springTimeline(initial, {stiffness,damping,stagger,step,bounds})` accepts `command(time, targets)` and `sample(time)`. Targets preserve position/velocity on reversal; a newer target cancels a delayed stale target. Bounds are declared hard stops. Use cumulative positive separations for exploded stacks: each upper group adds the lower groups' gaps, so stagger and reversal cannot put it through its neighbor. Test intermediate states, especially before delayed groups start.

`reparentKeepingWorld(object,parent)` uses native Three attachment; it preserves the current world transform. A deterministic free path must start at that exact release pose and end on an actual seat. Cache particle birth transforms at emission time; released particles must not follow later emitter movement. The turning-mechanism template demonstrates both.

`replacePart(old,replacement)` requires the same semantic name, preserves the old local transform, and disposes the replaced geometry. Recompute only the coil/profile that changed. A field-blending surface is not a volume-conserving fluid simulation; label its actual model.
