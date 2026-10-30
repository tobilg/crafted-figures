import {PNG} from 'pngjs';
import {readFile,writeFile} from 'node:fs/promises';
/** Evidence crops are nearest-neighbour enlargements, never new screenshot baselines. */
export async function crop4(source,dest,{x,y,width,height}){
 const src=PNG.sync.read(await readFile(source)),out=new PNG({width:width*4,height:height*4});
 for(let j=0;j<out.height;j++)for(let i=0;i<out.width;i++){const a=((Math.min(src.height-1,y+Math.floor(j/4)))*src.width+Math.min(src.width-1,x+Math.floor(i/4)))*4;src.data.copy(out.data,(j*out.width+i)*4,a,a+4);}
 await writeFile(dest,PNG.sync.write(out));
}
export async function contactSheet(files,dest,columns=4){
 const images=await Promise.all(files.map(async f=>PNG.sync.read(await readFile(f))));const cellW=Math.max(...images.map(im=>im.width)),cellH=Math.max(...images.map(im=>im.height));
 const out=new PNG({width:columns*cellW,height:Math.ceil(images.length/columns)*cellH});
 images.forEach((im,n)=>PNG.bitblt(im,out,0,0,im.width,im.height,(n%columns)*cellW,Math.floor(n/columns)*cellH));await writeFile(dest,PNG.sync.write(out));
}
