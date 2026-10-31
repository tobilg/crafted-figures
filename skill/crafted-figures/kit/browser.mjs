import { existsSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from '../runtime/playwright-core/index.mjs';
/** Where a Chromium browser is normally installed. Paths only; nothing is run.
 * @param {{platform?:string,env?:Record<string,string|undefined>,home?:string}} [context]
 * @returns {string[]}
 */
export function installedBrowserCandidates({
  platform = process.platform,
  env = process.env,
  home = os.homedir(),
} = {}) {
  if (platform === 'darwin') {
    const apps = [
      'Google Chrome.app/Contents/MacOS/Google Chrome',
      'Chromium.app/Contents/MacOS/Chromium',
      'Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      'Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    ];
    return ['/Applications', path.posix.join(home, 'Applications')].flatMap(dir =>
      apps.map(app => path.posix.join(dir, app)),
    );
  }
  if (platform === 'win32') {
    const roots = [env.PROGRAMFILES, env['PROGRAMFILES(X86)'], env.LOCALAPPDATA].filter(Boolean),
      apps = [
        'Google\\Chrome\\Application\\chrome.exe',
        'Chromium\\Application\\chrome.exe',
        'Microsoft\\Edge\\Application\\msedge.exe',
      ];
    return roots.flatMap(root => apps.map(app => path.win32.join(root, app)));
  }
  const names = [
      'google-chrome',
      'google-chrome-stable',
      'chromium',
      'chromium-browser',
      'microsoft-edge',
    ],
    dirs = [...(env.PATH || '').split(path.posix.delimiter).filter(Boolean), '/snap/bin'];
  return dirs.flatMap(dir => names.map(name => path.posix.join(dir, name)));
}
const isFile = file => existsSync(file) && statSync(file).isFile();
/** Launch the pinned Chromium if it is installed, otherwise a browser already on this machine.
 * An explicit CRAFTED_CHROMIUM_EXECUTABLE is used alone, so a mistaken path fails loudly.
 * `browser.craftedSource` records which one ran, because screenshots can differ between them.
 */
export async function launchChromium(options = {}) {
  const configured = process.env.CRAFTED_CHROMIUM_EXECUTABLE,
    /** @type {Array<{source:string,executablePath?:string}>} */
    attempts = configured
      ? [{ source: 'configured', executablePath: configured }]
      : [
          { source: 'pinned' },
          ...installedBrowserCandidates()
            .filter(isFile)
            .map(executablePath => ({ source: 'installed', executablePath })),
        ],
    failures = [];
  for (const { source, executablePath } of attempts)
    try {
      const browser = await chromium.launch({
        headless: true,
        ...options,
        ...(executablePath ? { executablePath } : {}),
      });
      browser.craftedSource = source;
      return browser;
    } catch (e) {
      failures.push(`${executablePath ?? 'pinned Chromium'}: ${e.message.split('\n')[0]}`);
    }
  throw new Error(
    `Chromium could not launch.\n${failures.join('\n')}\nInstall Chrome or Chromium, set CRAFTED_CHROMIUM_EXECUTABLE to one, or run node runtime/playwright-core/cli.js install chromium inside the skill. This check did not pass.`,
  );
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
