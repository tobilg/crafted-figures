export { scopedCSS, namespaceSVG };
import { frameContent } from '../frame-content.mjs';
import { scopedCSS, styleSheet } from '../styles.mjs';
import { namespaceSVG } from '../svg-ids.mjs';
import { bindKit } from '../bind.mjs';
import { escapeText } from '../text.mjs';
/** Pure server-safe HTML. Never creates a DOM, clock, observer or GL context. */
export function frameHTML({ id, figure, config, tokens, state, kit }) {
  if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(id))
    throw new Error(
      'Figure instance id must start with a letter and contain only letters, digits, _ or -',
    );
  const r = figure.render({ kit: bindKit(kit, { config, tokens }), config, tokens, state }),
    scope = `[data-instance="${id}"]`,
    framing = frameContent(r),
    title = escapeText(r.title),
    description = escapeText(r.description);
  return {
    title,
    description,
    html: `<style>${scopedCSS(styleSheet(config, tokens), scope)}</style><h2>${framing.number}${title}</h2><p>${description}</p><svg xmlns="http://www.w3.org/2000/svg" class="crafted" data-id-prefix="${id}-" role="img" aria-labelledby="${id}-title ${id}-description" viewBox="${r.viewBox.join(' ')}"><title id="${id}-title">${title}</title><desc id="${id}-description">${description}</desc>${namespaceSVG(r.body, id)}</svg>${framing.footer}<div data-controls></div><output data-live-readout aria-live="off"></output>`,
  };
}
