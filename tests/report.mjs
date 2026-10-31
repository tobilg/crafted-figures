// Shared by the checks that write a report. It imports only Node, because the no-install CI jobs
// run some of those checks with no dependencies and no generated runtime in the source tree.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

const fail = (report, error) => {
  report.status = 'failed';
  if (report.errors) report.errors.push(error.stack);
  else report.error = error.stack;
  process.exitCode = 1;
};

/** Runs a check and always writes `report.json`, recording any failure instead of throwing.
 * `cleanup` runs after the status is known, so it can keep temporary files from a failed run.
 * @param {string} out report directory
 * @param {{status?:string,errors?:string[],error?:string,cases?:unknown[],checks?:unknown[]}} report
 * @param {() => Promise<void>} body
 * @param {{cleanup?:() => void | Promise<void>}} [options]
 */
export async function runReport(out, report, body, { cleanup } = {}) {
  try {
    await body();
    if (report.errors) assert.deepEqual(report.errors, []);
    report.status = 'passed';
  } catch (e) {
    fail(report, e);
  }
  try {
    await cleanup?.();
  } catch (e) {
    fail(report, e);
  }
  await writeFile(path.join(out, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  const count = report.cases?.length ?? report.checks?.length;
  console.log(
    report.status,
    ...(count === undefined ? [] : [count]),
    report.errors ?? report.error ?? '',
  );
}

/** A full browser asks an HTTP server for a favicon and the headless build does not. The test
 * pages have none, and that request says nothing about the figure.
 * @param {{location():{url:string}}} message Playwright console message
 */
export const isMissingFavicon = message => message.location().url.endsWith('/favicon.ico');

/** Launches the browser the skill itself would use, and records which one ran.
 * @param {{environment?:Record<string,unknown>}} report
 * @param {object} [options] Playwright launch options
 */
export async function openBrowser(report, options) {
  const { launchChromium } = await import('../skill/crafted-figures/kit/browser.mjs'),
    browser = await launchChromium(options);
  report.environment ??= {};
  report.environment.browser = browser.version();
  report.environment.browserSource = browser.craftedSource;
  return browser;
}

/** `runReport` for a check that uses one browser throughout.
 * @param {string} out
 * @param {object} report
 * @param {(browser: any) => Promise<void>} body
 */
export async function runBrowserReport(out, report, body) {
  let browser;
  await runReport(
    out,
    report,
    async () => {
      browser = await openBrowser(report);
      await body(browser);
    },
    { cleanup: () => browser?.close() },
  );
}

/** Runs a command to its end and returns the exit code with stdout and stderr combined.
 * @param {string} command
 * @param {string[]} args
 * @param {import('node:child_process').SpawnOptions} [options]
 * @returns {Promise<{code:number|null,output:string}>}
 */
export const capture = (command, args, options = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], ...options });
    let output = '';
    child.stdout.on('data', d => (output += d));
    child.stderr.on('data', d => (output += d));
    child.on('error', reject);
    child.on('exit', code => resolve({ code, output }));
  });
