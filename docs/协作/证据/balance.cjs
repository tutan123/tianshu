// Combat balance verification: four strategies against the real UI, using the
// state a normal story path actually reaches the duel with (measured Lv.3, 91 HP).
const { chromium } = require('playwright-core');
const GAME = 'file:///G:/Projects/Agent/Agent%20Cli/%E5%A4%A9%E6%9E%A2/%E5%A4%A9%E6%9E%A2-WebDemo-v3.0/index.html';
const KEY = 'tianshu-v3-auto';

const seed = {
  version: 3,
  stats: { intelligence: 15, compute: 60, maxCompute: 100, reputation: 0, cash: 1200, physique: 36, spirit: 50 },
  bonds: { lw: 0, sq: 0, gqh: 0, zty: 0 },
  modules: { learn: 0, body: 0, predict: 0 },
  flags: ['scholar', 'public', 'backup', 'leaf', 'team', 'oldhost', 'evidence'],
  done: ['intro', 'roll', 'math', 'gym', 'roof', 'market', 'lab', 'hearing'],
  results: {}, choices: {}, messages: [], history: [], active: null, ending: null,
  settings: { volume: 0, speed: 28, auto: false, motion: true },
  day: 3, time: '夜晚', rest: 0, savedAt: null,
  rpg: { xp: 260, owned: [], equipped: { hand: null, outfit: null, accessory: null }, bag: { coffee: 0, notes: 0 }, found: [], records: {}, restDay: 0, world: { opened: [], stamps: [], talked: [], switches: [], visited: [], claimed: false } },
};

const strike = ['strike', 'strike', 'strike'];
const strategies = {
  'A 全攻不防（naive）': { first: strike, repeat: strike },
  'B 读招+超频（验收套件打法）': { first: ['assist', 'read', 'strike', 'strike', 'strike'], repeat: strike },
  'C 两次格挡（规划打法）': { first: strike, repeat: null, plan: [strike, ['guard', 'strike', 'strike'], ['guard', 'strike', 'strike'], strike] },
  'D 纯格挡（不可能赢）': { first: ['guard', 'guard', 'guard'], repeat: ['guard', 'guard', 'guard'] },
};

const wait = ms => new Promise(r => setTimeout(r, ms));

async function play(browser, name, plan) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(([k, v]) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } }, [KEY, seed]);
  const page = await ctx.newPage();
  page.setDefaultTimeout(6000);
  const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
  const result = { name, log: [], errors: errs };
  try {
    await page.goto(GAME, { waitUntil: 'load' });
    await page.waitForFunction(() => window.Campus3D && Campus3D.ready(), null, { timeout: 60000 });
    await wait(900);
    await page.click('#quest-jump'); await wait(300);
    await page.click('#enter-event'); await wait(500);
    await page.click('#skip'); await wait(700);
    result.start = await page.evaluate(() => {
      const g = JSON.parse(localStorage.getItem('tianshu-v3-auto')).active?.game;
      return g ? { hp: g.hp, maxHp: g.maxHp, enemy: g.enemy, maxEnemy: g.maxEnemy } : null;
    });

    for (let round = 0; round < 12; round++) {
      const snap = await page.evaluate(() => {
        const st = JSON.parse(localStorage.getItem('tianshu-v3-auto')), g = st.active?.game;
        return g && g.kind === 'combat' ? { turn: g.turn, hp: g.hp, enemy: g.enemy } : { ended: true, outcome: st.active?.outcome || null };
      });
      if (snap.ended) { result.outcome = snap.outcome; break; }
      const cards = await (async () => plan.plan ? (plan.plan[round] || plan.repeat) : (round === 0 ? plan.first : plan.repeat))();
      const played = [];
      for (const action of cards) {
        if (action === 'assist') {
          const on = await page.locator('#combat-assist').isEnabled().catch(() => false);
          if (!on) continue;
          await page.click('#combat-assist');
        } else {
          const on = await page.locator(`[data-card="${action}"]`).isEnabled().catch(() => false);
          if (!on) continue;
          await page.click(`[data-card="${action}"]`);
        }
        played.push(action); await wait(90);
      }
      if (!await page.locator('#combat-end').count()) break;
      await page.click('#combat-end'); await wait(180);
      const after = await page.evaluate(() => {
        const st = JSON.parse(localStorage.getItem('tianshu-v3-auto')), g = st.active?.game;
        return g && g.kind === 'combat' ? { turn: g.turn, hp: g.hp, enemy: g.enemy } : { ended: true, outcome: st.active?.outcome || null };
      });
      result.log.push({ round: round + 1, played: played.join('+'), ...after });
      if (after.ended) { result.outcome = after.outcome; break; }
    }
    // The killing blow lands on the player's turn, which swaps straight to the
    // result screen and removes #combat-end, so read the outcome once more.
    if (!result.outcome) {
      result.outcome = await page.evaluate(() => {
        const st = JSON.parse(localStorage.getItem('tianshu-v3-auto'));
        return st.active?.outcome || (st.active?.phase === 'result' ? 'result-no-outcome' : null);
      }) || 'unresolved';
    }
  } catch (e) { result.error = String(e.message).slice(0, 300); }
  finally { await ctx.close(); }
  return result;
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const out = {};
  try {
    for (const [name, plan] of Object.entries(strategies)) {
      out[name] = await play(browser, name, plan);
      const r = out[name];
      console.log(`${name}: 结果=${r.outcome || r.error || '未结束'}  ` +
        (r.log || []).map(l => `R${l.round}[${l.played}] ${l.hp ?? ''}hp/${l.enemy ?? ''}enemy`).join('  '));
    }
  } finally { await browser.close(); }
  require('node:fs').writeFileSync(require('node:path').join(__dirname, 'balance-report.json'), JSON.stringify(out, null, 2));
})();
