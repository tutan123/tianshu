const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { chromium } = require('playwright');

(async () => {
  const file = path.resolve(process.argv[2] || 'tests/architecture.acceptance.js');
  const browser = await chromium.launch({ channel:'chrome', headless:true });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    const run = vm.runInThisContext('(' + fs.readFileSync(file, 'utf8') + ')', { filename:file });
    const result = await run(page);
    const report = file.replace(/\.acceptance\.(js|mjs)$/, '-results.json');
    if(report === file)throw new Error('Expected an .acceptance.js filename');
    fs.writeFileSync(report, JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify(result, null, 2));
    if(!result.success)process.exitCode = 1;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
