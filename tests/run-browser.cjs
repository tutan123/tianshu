const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');

// playwright-core is enough: every suite launches the locally installed Chrome via
// channel:'chrome', so no browser download is required. Fall back to full playwright.
const { chromium } = (() => {
  try { return require('playwright-core'); } catch { return require('playwright'); }
})();

(async () => {
  const file = path.resolve(process.argv[2] || 'tests/architecture.acceptance.js');
  if (!/\.acceptance\.(js|mjs)$/.test(file)) throw new Error('Expected an .acceptance.js or .acceptance.mjs filename');
  const report = file.replace(/\.acceptance\.(js|mjs)$/, '-results.json');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    // .js suites are bare `async (page) => {}` expressions loaded through vm;
    // .mjs suites are ES modules and must be imported.
    const run = file.endsWith('.mjs')
      ? (await import(pathToFileURL(file).href)).default
      : vm.runInThisContext('(' + fs.readFileSync(file, 'utf8') + ')', { filename: file });
    const result = await run(page);
    fs.writeFileSync(report, JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify(result, null, 2));
    if (!result?.success) process.exitCode = 1;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
