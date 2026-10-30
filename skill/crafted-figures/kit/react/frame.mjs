import {frameContent} from '../frame-content.mjs';
import {styleSheet} from '../styles.mjs';import {escapeText} from '../index.mjs';
/** Scope the toolkit's generated CSS, including nested media rules. This parser
 * accepts our rule-only stylesheet, not arbitrary user CSS. */
export function scopedCSS(css,scope){
 let out='',i=0;while(i<css.length){const open=css.indexOf('{',i);if(open<0)break;const selector=css.slice(i,open).trim();let depth=1,j=open+1;while(j<css.length&&depth){if(css[j]==='{')depth++;if(css[j]==='}')depth--;j++;}const body=css.slice(open+1,j-1);
 if(selector.startsWith('@media'))out+=`${selector}{${scopedCSS(body,scope)}}`;
 else out+=selector.split(',').map(s=>{s=s.trim();return [':root','body','.crafted','article.crafted'].includes(s)?scope:`${scope} ${s}`;}).join(',')+`{${body}}`;i=j;}return out;
}
/** Namespace SVG IDs/references deterministically; content is trusted renderer output. */
export function namespaceSVG(body,id){return body.replace(/\bid="([^"]+)"/g,(_,v)=>`id="${id}-${v}"`).replace(/url\(#([^)]*)\)/g,(_,v)=>`url(#${id}-${v})`).replace(/\b(href|xlink:href)="#([^"]+)"/g,(_,attr,v)=>`${attr}="#${id}-${v}"`);}
/** Pure server-safe HTML. Never creates a DOM, clock, observer or GL context. */
export function frameHTML({id,figure,config,tokens,state,kit}){
 if(!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(id))throw new Error('Figure instance id must start with a letter and contain only letters, digits, _ or -');
 const r=figure.render({kit,config,tokens,state}),scope=`[data-instance="${id}"]`,framing=frameContent(r),title=escapeText(r.title),description=escapeText(r.description);
 return {title,description,html:`<style>${scopedCSS(styleSheet(config,tokens),scope)}</style><h2>${framing.number}${title}</h2><p>${description}</p><svg xmlns="http://www.w3.org/2000/svg" class="crafted" data-id-prefix="${id}-" role="img" aria-labelledby="${id}-title ${id}-description" viewBox="${r.viewBox.join(' ')}"><title id="${id}-title">${title}</title><desc id="${id}-description">${description}</desc>${namespaceSVG(r.body,id)}</svg>${framing.footer}<div data-controls></div><output data-live-readout aria-live="off"></output>`};
}
