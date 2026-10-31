/** Instance-scoped public capture/control boundary. Legacy cleanup functions work.
 *
 * Tools reach the scene through `controller.stage` and `controller.effects`. `root.__stage`
 * and `root.__effects` remain as aliases for clients written before those fields existed.
 */
export function registerController(root, result, { poses = {} } = {}) {
  const dispose = typeof result === 'function' ? result : result?.dispose?.bind(result);
  if (!dispose)
    throw new Error('mount must return a cleanup function or controller with dispose()');
  const controller = {};
  for (const name of ['getState', 'setState', 'setTime', 'pause', 'resume', 'getStats'])
    if (typeof result[name] === 'function') controller[name] = result[name].bind(result);
  for (const name of ['stage', 'effects']) if (result[name]) controller[name] = result[name];
  controller.stage ??= root.__stage;
  controller.effects ??= root.__effects;
  if (controller.stage) root.__stage = controller.stage;
  if (controller.effects) root.__effects = controller.effects;
  controller.poseNames = Object.keys(poses);
  if (controller.setState)
    controller.setPose = (name, options) => {
      if (!Object.hasOwn(poses, name)) throw new Error(`Unknown pose ${name}`);
      return controller.setState(structuredClone(poses[name]), options);
    };
  let disposed = false;
  controller.dispose = () => {
    if (disposed) return;
    disposed = true;
    dispose();
    delete root.__craftedController;
    delete root.__stage;
    delete root.__effects;
    delete root.dataset.ready;
  };
  root.__craftedController = controller;
  root.dataset.ready = 'true';
  return controller;
}
