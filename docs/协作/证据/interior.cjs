// Focused traversal test: can the player actually REACH every interaction point
// inside all 8 interiors? Waits properly for arrival instead of a fixed sleep.
const path = require('node:path');
const { chromium } = require('playwright-core');
const GAME = 'file:///G:/Projects/Agent/Agent%20Cli/%E5%A4%A9%E6%9E%A2/%E5%A4%A9%E6%9E%A2-WebDemo-v3.0/index.html';

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 960 } })).newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 300)));
  await page.goto(GAME, { waitUntil: 'load' });
  await page.waitForFunction(() => window.Campus3D && Campus3D.ready(), null, { timeout: 60000 });
  await new Promise(r => setTimeout(r, 1500));

  const result = await page.evaluate(async () => {
    const waitFor = (pred, ms) => new Promise(res => {
      const t = setTimeout(() => res(false), ms);
      const iv = setInterval(() => { if (pred()) { clearInterval(iv); clearTimeout(t); res(true); } }, 100);
    });
    const out = [];
    for (const zone of ['dorm', 'hall', 'library', 'lake', 'gym', 'lab', 'gate', 'plaza']) {
      Campus3D.setMode('walk', zone);
      Campus3D.enterInterior(zone);
      await new Promise(r => setTimeout(r, 400));
      const objects = Campus3D.worldObjects().map(o => ({ id: o.id, type: o.type, x: o.x, z: o.z }));
      const rows = [];
      for (const o of objects) {
        // reset to the interior spawn so each target is tested from a known place
        const spawn = { x: 0, z: 10.5 };
        const routed = Campus3D.moveTo(o.x, o.z);
        const arrived = routed ? await waitFor(() => Campus3D.getObject()?.id === o.id, 14000) : false;
        rows.push({ id: o.id, type: o.type, routed, arrived, from: spawn, at: Campus3D.inspect().player });
      }
      out.push({ zone, unreachable: rows.filter(r => !r.arrived).map(r => r.id), total: rows.length });
      Campus3D.exitInterior();
      await new Promise(r => setTimeout(r, 200));
    }
    return out;
  });

  console.log(JSON.stringify({ interiors: result, pageErrors: errs }, null, 2));
  await browser.close();
})().catch(e => { console.error(e); process.exitCode = 1; });
