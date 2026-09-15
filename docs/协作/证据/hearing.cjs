// User-visible check for the lab-softlock fix: with only the 'receipt' flag the
// public re-vote option must be clickable in the real hearing UI, and with neither
// record it must be visibly locked.
const { chromium } = require('playwright-core');
const GAME = 'file:///G:/Projects/Agent/Agent%20Cli/%E5%A4%A9%E6%9E%A2/%E5%A4%A9%E6%9E%A2-WebDemo-v3.0/index.html';
const KEY = 'tianshu-v3-auto';

const base = {
  version: 3,
  stats: { intelligence: 15, compute: 60, maxCompute: 100, reputation: 0, cash: 1200, physique: 36, spirit: 50 },
  bonds: { lw: 0, sq: 0, gqh: 0, zty: 0 },
  modules: { learn: 0, body: 0, predict: 0 },
  results: {}, choices: {}, messages: [], history: [], active: null, ending: null,
  settings: { volume: 0, speed: 28, auto: false, motion: true },
  day: 3, time: '上午', rest: 0, savedAt: null,
  rpg: { xp: 200, owned: [], equipped: { hand: null, outfit: null, accessory: null }, bag: { coffee: 0, notes: 0 }, found: [], records: {}, restDay: 0, world: { opened: [], stamps: [], talked: [], switches: [], visited: [], claimed: false } },
};
const upToLab = ['intro', 'roll', 'math', 'gym', 'roof', 'market', 'lab'];
const wait = ms => new Promise(r => setTimeout(r, ms));

async function check(browser, label, extraFlags) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(([k, v]) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } }, [KEY, { ...base, done: upToLab, flags: extraFlags }]);
  const page = await ctx.newPage();
  page.setDefaultTimeout(6000);
  const out = { label, flags: extraFlags };
  try {
    await page.goto(GAME, { waitUntil: 'load' });
    await page.waitForFunction(() => window.Campus3D && Campus3D.ready(), null, { timeout: 60000 });
    await wait(900);
    await page.click('#quest-jump'); await wait(300);      // select the next main node = hearing
    await page.click('#enter-event'); await wait(500);
    await page.click('#skip'); await wait(600);
    const node = await page.evaluate(() => JSON.parse(localStorage.getItem('tianshu-v3-auto')).active?.id);
    out.node = node;
    out.choice0 = {
      disabled: await page.locator('[data-choice="0"]').isDisabled(),
      hint: (await page.locator('[data-choice="0"] small').textContent().catch(() => null)),
    };
    out.choice2 = { disabled: await page.locator('[data-choice="2"]').isDisabled() };
  } catch (e) { out.error = String(e.message).slice(0, 200); }
  finally { await ctx.close(); }
  return out;
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    console.log(JSON.stringify([
      await check(browser, '只有申请回执（实验楼失手）', ['receipt']),
      await check(browser, '完整证据（实验楼成功）', ['evidence']),
      await check(browser, '两者都没有', []),
    ], null, 2));
  } finally { await browser.close(); }
})();
