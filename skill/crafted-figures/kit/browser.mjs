import {chromium} from '../runtime/playwright-core/index.mjs';
/** Chromium is an external executable, not an npm dependency of the consumer.
 * An explicit local Chrome/Chromium path overrides the pinned Playwright cache. */
export async function launchChromium(options={}){
 try{return await chromium.launch({headless:true,...options,...(process.env.CRAFTED_CHROMIUM_EXECUTABLE?{executablePath:process.env.CRAFTED_CHROMIUM_EXECUTABLE}:{})});}
 catch(e){throw new Error(`Chromium could not launch: ${e.message}\nSet CRAFTED_CHROMIUM_EXECUTABLE to an existing Chrome/Chromium executable, or run node runtime/playwright-core/cli.js install chromium inside the skill. This check did not pass.`);}
}
