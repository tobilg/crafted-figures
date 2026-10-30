import { chromium } from '../runtime/playwright-core/index.mjs';
/** Chromium is an external executable, not an npm dependency of the consumer.
 * An explicit local Chrome/Chromium path overrides the pinned Playwright cache. */
export async function launchChromium(options = {}) {
  try {
    return await chromium.launch({
      headless: true,
      ...options,
      ...(process.env.CRAFTED_CHROMIUM_EXECUTABLE
        ? { executablePath: process.env.CRAFTED_CHROMIUM_EXECUTABLE }
        : {}),
    });
  } catch (e) {
    throw new Error(
      `Chromium could not launch: ${e.message}\nSet CRAFTED_CHROMIUM_EXECUTABLE to an existing Chrome/Chromium executable, or run node runtime/playwright-core/cli.js install chromium inside the skill. This check did not pass.`,
    );
  }
}
// biome-ignore lint/suspicious/noControlCharactersInRegex: matches terminal color escapes
const ANSI = /\x1b\[[0-9;]*m/g;
/** Wait for a figure to mount, reporting the page's own error as soon as there is one instead
 * of a later timeout that hides the cause. Attach the `errors` collector before navigating.
 * @param {import('../runtime/playwright-core/index.mjs').Page} page
 * @param {string[]} errors collected page errors
 * @param {{selector?:string,timeout?:number}} [options]
 */
export async function waitForFigure(
  page,
  errors,
  { selector = '[data-ready=true]', timeout = 30000 } = {},
) {
  let settled = false;
  const ready = page.locator(selector).first().waitFor({ timeout });
  const failure = (async () => {
    while (!settled) {
      if (errors.length) throw new Error(`Figure failed to mount: ${errors[0]}`);
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  })();
  try {
    await Promise.race([ready, failure]);
  } catch (e) {
    ready.catch(() => {});
    throw new Error(e.message.replace(ANSI, ''));
  } finally {
    settled = true;
  }
}
