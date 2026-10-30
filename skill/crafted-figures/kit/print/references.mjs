/** Namespace each printed SVG in its own scope and reject broken local assets.
 * Runs in the browser via locator.evaluateAll; keep this function self-contained.
 * @param {SVGSVGElement[]} svgs
 */
export function namespacePrintSVGs(svgs) {
 return svgs.map((svg, index) => {
  const prefix = `use-${index + 1}-${svg.dataset.printView}-`;
  const nodes = [svg, ...svg.querySelectorAll('*')], ids = new Map();
  for (const node of nodes) {
   if (!node.id) continue;
   if (ids.has(node.id)) throw new Error(`PRINT_DUPLICATE_ID: ${node.id} in view ${svg.dataset.printView}`);
   ids.set(node.id, prefix + node.id);
  }
  let references = 0;
  const resolve = id => {
   if (!ids.has(id)) throw new Error(`PRINT_UNRESOLVED_REFERENCE: #${id} in view ${svg.dataset.printView}`);
   references++;
   return ids.get(id);
  };
  const urls = value => value.replace(/url\(\s*(['"]?)#([^'"\s)]+)\1\s*\)/g,
   (_, quote, id) => `url(${quote}#${resolve(id)}${quote})`);
  for (const node of nodes) {
   for (const attr of [...node.attributes]) {
    let value = attr.value;
    if (attr.name === 'id') value = ids.get(value);
    else if (attr.localName === 'href' && value.trim().startsWith('#')) value = '#' + resolve(value.trim().slice(1));
    else if (['aria-labelledby', 'aria-describedby'].includes(attr.name)) value = value.trim().split(/\s+/).filter(Boolean).map(resolve).join(' ');
    else value = urls(value);
    node.setAttributeNS(attr.namespaceURI, attr.name, value);
   }
   if (node.localName === 'style') node.textContent = urls(node.textContent);
  }
  return {view: svg.dataset.printView, ids: ids.size, references};
 });
}
