import { escapeText as esc } from './text.mjs';
/** Optional authored framing content; deliberately separate from appearance config. */
export function frameContent(result) {
  for (const key of ['figureNumber', 'caption', 'eyebrow'])
    if (result[key] !== undefined && typeof result[key] !== 'string')
      throw new Error(`render.${key}: string required`);
  if (
    result.legend !== undefined &&
    (!Array.isArray(result.legend) ||
      result.legend.some(
        item =>
          !item ||
          Object.keys(item).some(k => !['label', 'description'].includes(k)) ||
          typeof item.label !== 'string' ||
          typeof item.description !== 'string',
      ))
  )
    throw new Error('render.legend: array of {label,description} required');
  return {
    number: result.figureNumber
      ? `<span class="figure-number">${esc(result.figureNumber)} · </span>`
      : '',
    footer:
      result.caption || result.legend?.length
        ? `<footer class="figure-caption">${result.caption ? `<p>${esc(result.caption)}</p>` : ''}${result.legend?.length ? `<dl>${result.legend.map(item => `<dt>${esc(item.label)}</dt><dd>${esc(item.description)}</dd>`).join('')}</dl>` : ''}</footer>`
        : '',
  };
}
