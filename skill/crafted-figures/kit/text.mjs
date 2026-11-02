const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
/** Escape text or quoted attribute content. Author-provided SVG body is trusted code.
 * @param {unknown} value
 */
export const escapeText = value => String(value).replace(/[&<>"']/g, c => entities[c]);
