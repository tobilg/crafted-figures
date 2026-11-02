const TAG = /<[a-zA-Z][^\s/>]*(?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*\s*\/?>/g;
const ATTRIBUTE = /(\s)([^\s=>/]+)(\s*=\s*)(?:"([^"]*)"|'([^']*)')/g;
const STYLE_ELEMENT = /(<style\b[^>]*>)([\s\S]*?)(<\/style>)/g;
const VALUELESS = /(\s)([^\s=>/"']+)(?=\s|\/?>)/g;
const URL_REFERENCE = /url\(\s*(&quot;|&#39;|['"])?#([^'")&\s]+)(&quot;|&#39;|['"])?\s*\)/g;
const ID_LISTS = new Set(['aria-labelledby', 'aria-describedby', 'aria-controls', 'aria-owns']);
/** Namespace SVG IDs and every local reference to them, without a DOM. Only markup is touched:
 * text content and attributes such as `data-id` stay as they are. A reference to an ID that
 * the fragment does not declare fails here, instead of drawing as missing artwork later. A
 * valueless attribute, which HTML accepts but which makes a standalone SVG unreadable, gets an
 * empty value.
 * @param {string} body trusted SVG markup
 * @param {string} prefix
 * @returns {string}
 */
export function namespaceSVG(body, prefix) {
  const declared = new Set();
  for (const [tag] of body.matchAll(TAG)) {
    for (const match of tag.matchAll(ATTRIBUTE))
      if (match[2] === 'id') declared.add(match[4] ?? match[5]);
  }
  const resolve = id => {
    if (!declared.has(id)) throw new Error(`SVG_UNRESOLVED_REFERENCE: #${id} is not declared`);
    return `${prefix}-${id}`;
  };
  const urls = value =>
    value.replace(
      URL_REFERENCE,
      (_, open = '', id, close = '') => `url(${open}#${resolve(id)}${close})`,
    );
  const rewrite = (name, value) => {
    if (name === 'id') return `${prefix}-${value}`;
    if ((name === 'href' || name === 'xlink:href') && value.trim().startsWith('#'))
      return `#${resolve(value.trim().slice(1))}`;
    if (ID_LISTS.has(name)) return value.trim().split(/\s+/).filter(Boolean).map(resolve).join(' ');
    return urls(value);
  };
  const markup = body.replace(TAG, tag => {
    const written = tag.replace(ATTRIBUTE, (_, space, name, equals, double, single) => {
      const quote = double === undefined ? "'" : '"',
        value = double ?? single;
      return `${space}${name}${equals}${quote}${rewrite(name, value)}${quote}`;
    });
    // Mask quoted values so only real valueless attributes match.
    const masked = written.replace(/"[^"]*"|'[^']*'/g, value => 'x'.repeat(value.length));
    let fixed = '',
      last = 0;
    for (const match of masked.matchAll(VALUELESS)) {
      const end = match.index + match[0].length;
      if (masked[match.index + 1] === '=' || masked[end] === '=') continue;
      fixed += `${written.slice(last, end)}=""`;
      last = end;
    }
    return fixed + written.slice(last);
  });
  return markup.replace(STYLE_ELEMENT, (_, open, css, close) => `${open}${urls(css)}${close}`);
}
