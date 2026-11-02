import { escapeText as esc } from './text.mjs';
const legendRow = ({ label, description, callout, number, active }) => {
  if (callout === undefined) return `<dt>${esc(label)}</dt><dd>${esc(description)}</dd>`;
  const link = ` data-callout="${esc(callout)}"${active ? ' data-active=""' : ''}`;
  return `<dt${link}><span class="callout-key">${esc(number)}</span>${esc(label)}</dt><dd>${esc(description)}</dd>`;
};
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
          Object.keys(item).some(
            k => !['label', 'description', 'callout', 'number', 'active'].includes(k),
          ) ||
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
        ? `<footer class="figure-caption">${result.caption ? `<p>${esc(result.caption)}</p>` : ''}${result.legend?.length ? `<dl>${result.legend.map(item => legendRow(item)).join('')}</dl>` : ''}</footer>`
        : '',
  };
}
