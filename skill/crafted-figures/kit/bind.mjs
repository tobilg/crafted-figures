/** The kit a figure receives. Binding the resolved configuration here means an author cannot
 * silently lose a camera, material or effect-quality setting by not passing it along.
 * @template {Record<string,any>} K
 * @param {K} kit
 * @param {{config:Record<string,any>,tokens:Record<string,string>,onStage?:(stage:any)=>void}} context
 * @returns {K}
 */
export function bindKit(kit, { config, tokens, onStage }) {
  const illustration = {
    ...kit.illustration,
    createStage(options) {
      const stage = kit.illustration.createStage({ config, tokens, ...options });
      onStage?.(stage);
      return stage;
    },
  };
  const effects = kit.effects && {
    ...kit.effects,
    effect: (name, options) =>
      kit.effects.effect(name, {
        theme: config.theme,
        quality: config.rendering?.quality,
        ...options,
      }),
  };
  return { ...kit, illustration, ...(effects ? { effects } : {}) };
}
