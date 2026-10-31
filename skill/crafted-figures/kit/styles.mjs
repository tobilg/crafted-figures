/** Deterministic sRGB mixing; only validated six-digit hex values enter here. */
export function mix(a, b, t) {
  const channels = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  return (
    '#' +
    channels(a)
      .map((c, i) =>
        Math.round(c * (1 - t) + channels(b)[i] * t)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}
export function contrastText(hex) {
  const c = [1, 3, 5]
    .map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(v => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722 > 0.179 ? '#000000' : '#ffffff';
}
export function readableAccent(accent, background) {
  const luminance = hex =>
    [1, 3, 5]
      .map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map(v => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
      .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
  const ratio = (a, b) =>
    (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);
  const end = contrastText(background);
  for (let t = 0; t <= 1; t += 0.05) {
    const c = mix(accent, end, t);
    if (ratio(c, background) >= 3) return c;
  }
  return end;
}
/** Single source of CSS tokens for HTML, embedded SVG, and experimental consumers. */
export function resolveTokens(config, tokens) {
  return {
    ...tokens,
    accentSurfaceInk: contrastText(mix(config.accent, '#ffffff', 0.48)),
    accentLine: readableAccent(config.accent, tokens.top),
    accentInk: contrastText(config.accent),
    accentTop: mix(config.accent, '#ffffff', 0.48),
    accentSide0: mix(config.accent, '#000000', 0.3),
    accentSide1: mix(config.accent, '#000000', 0.15),
    accentSide2: config.accent,
    accentSide3: mix(config.accent, '#ffffff', 0.25),
  };
}
/** Everything a figure's SVG needs by itself. */
const artworkRules = `.crafted{display:block;color:var(--cf-text);font-family:var(--cf-body)}
svg.crafted{width:100%;height:auto;overflow:visible;background:var(--cf-card);border-radius:8px}.surface{fill:var(--cf-surface)}.top{fill:var(--cf-top)}.side-0{fill:var(--cf-side0)}.side-1{fill:var(--cf-side1)}.side-2{fill:var(--cf-side2)}.side-3{fill:var(--cf-side3)}
.accent .surface{fill:var(--cf-accent)}.accent .top{fill:var(--cf-accentTop)}.accent .side-0{fill:var(--cf-accentSide0)}.accent .side-1{fill:var(--cf-accentSide1)}.accent .side-2{fill:var(--cf-accentSide2)}.accent .side-3{fill:var(--cf-accentSide3)}
.accent .caption{fill:var(--cf-accentSurfaceInk)}
.edge,.crease,.line,.needle{fill:none;stroke:var(--cf-stroke);stroke-width:var(--cf-width);stroke-linejoin:round;stroke-linecap:round;vector-effect:non-scaling-stroke}.crease{opacity:.6}.accent-line,.needle{stroke:var(--cf-accentLine)}.needle{stroke-width:2px}.halo{fill:var(--cf-halo)}.reading{fill:var(--cf-text);font:24px var(--cf-mono)}.caption{fill:var(--cf-muted);font:13px var(--cf-body)}`;
/** The standalone HTML page around a figure. Never part of an embeddable SVG. */
const pageRules = `*{box-sizing:border-box}body{margin:0;padding:32px 16px;background:var(--cf-page);color:var(--cf-text);font:16px/1.5 var(--cf-body)}
article.crafted{max-width:900px;margin:0 auto;padding:28px;background:var(--cf-card);border:1px solid var(--cf-stroke);border-radius:18px}article[data-frame=minimal]{padding:12px 0;border:0;border-radius:0;background:transparent}
h1{font-size:24px;line-height:1.25;margin:0 0 8px;font-weight:650}p{margin:8px 0;color:var(--cf-muted);max-width:68ch}.eyebrow{font:11px var(--cf-mono);letter-spacing:.14em;text-transform:uppercase;color:var(--cf-muted);margin-bottom:14px}
.figure-number{font-weight:400}.figure-caption{font-size:14px;line-height:1.4}.figure-caption dl{display:grid;grid-template-columns:auto 1fr;gap:4px 12px}.figure-caption dt{font-weight:600}.figure-caption dd{margin:0;color:var(--cf-muted)}
[data-controls]{margin-top:18px;display:grid;gap:10px}[data-controls]:empty,[data-live-readout]:empty{display:none}label{font-weight:600}input[type=range]{width:100%;margin:6px 0;height:32px;accent-color:var(--cf-accent);cursor:pointer}button{font:inherit;color:var(--cf-accentInk);background:var(--cf-accent);border:1px solid var(--cf-stroke);border-radius:6px;padding:8px 16px;cursor:pointer}button+button{margin-left:8px}:focus-visible{outline:3px solid var(--cf-text);outline-offset:4px}[data-live-readout]{font:16px var(--cf-mono);margin-top:12px}svg[data-interactive]{touch-action:pan-y;cursor:ew-resize}
svg:has([data-part="static-readout"])~[data-live-readout]{position:absolute;width:1px;height:1px;margin:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap}`;
function themeVariables(config, tokens) {
  const values = resolveTokens(config, tokens),
    vars = Object.entries(values)
      .map(([k, v]) => `--cf-${k}:${v}`)
      .join(';');
  return `${vars};--cf-body:${config.typography.body};--cf-mono:${config.typography.mono};--cf-width:${config.stroke.width}px;color-scheme:${config.theme}`;
}
/** Scope the toolkit's generated CSS, including nested media rules. This parser
 * accepts our rule-only stylesheet, not arbitrary user CSS.
 * @param {string} css
 * @param {string} scope
 * @param {string[]} [self] selectors that mean the scope element itself
 */
export function scopedCSS(css, scope, self = [':root', 'body', '.crafted', 'article.crafted']) {
  let out = '',
    i = 0;
  while (i < css.length) {
    const open = css.indexOf('{', i);
    if (open < 0) break;
    const selector = css.slice(i, open).trim();
    let depth = 1,
      j = open + 1;
    while (j < css.length && depth) {
      if (css[j] === '{') depth++;
      if (css[j] === '}') depth--;
      j++;
    }
    const body = css.slice(open + 1, j - 1);
    if (selector.startsWith('@media')) out += `${selector}{${scopedCSS(body, scope, self)}}`;
    else
      out +=
        selector
          .split(',')
          .map(part => {
            const trimmed = part.trim();
            return self.includes(trimmed) ? scope : `${scope} ${trimmed}`;
          })
          .join(',') + `{${body}}`;
    i = j;
  }
  return out;
}
/** The page stylesheet for standalone HTML, React frames and print. */
export function styleSheet(config, tokens) {
  return `:root,.crafted{${themeVariables(config, tokens)}}
${pageRules}
${artworkRules}
@media(max-width:500px){body{padding:16px 10px}article.crafted{padding:18px 12px}h1{font-size:22px}.caption{font-size:15px}}
@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto}}`;
}
/** Styles carried inside the SVG. Everything is scoped to that SVG, so it can be inlined in
 * another page, next to another figure, without restyling either.
 * @param {string} scope value of the SVG's data-cf attribute
 */
export function figureStyleSheet(config, tokens, scope) {
  return scopedCSS(
    `.crafted{${themeVariables(config, tokens)}}
${artworkRules}
@media(max-width:500px){.caption{font-size:15px}}`,
    `[data-cf="${scope}"]`,
    ['.crafted', 'svg.crafted'],
  );
}
