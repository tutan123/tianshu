// Combat balance + save-restore path probe.
// 1. Injects a crafted mid-game save through localStorage (exercises TS.restore).
// 2. Reloads, walks the real UI into the 'duel' combat encounter.
// 3. Plays a deliberately naive strategy (always strike / end turn) and reports turns.
// Read-only: never writes to the project tree.
const path = require('node:path');
const { chromium } = require('playwright-core');
const GAME = 'file:///G:/Projects/Agent/Agent%20Cli/%E5%A4%A9%E6%9E%A2/%E5%A4%A9%E6%9E%A2-WebDemo-v3.0/index.html';
const KEY = 'tianshu-v3-auto';

const crafted = {
  version: 3,
  stats: { intelligence: 15, compute: 60, maxCompute: 100, reputation: 0, cash: 1200, physique: 20, spirit: 50 },
  bonds: { lw: 0, sq: 0, gqh: 0, zty: 0 },
  modules: { learn: 0, body: 0, predict: 0 },
  flags: [], done: ['intro', 'roll', 'math', 'gym', 'roof', 'market', 'lab', 'hearing'],
  results: {}, choices: {}, messages: [], history: [], active: null, ending: null,
  settings: { volume: 0, speed: 28, auto: false, motion: true },
  day: 3, time: '夜晚', rest: 0, savedAt: null,
};

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const out = { saveRestore: {}, combat: {}, errors: [] };
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 960 } })).newPage();
  page.on('pageerror', e => out.errors.push(String(e.message).slice(0, 300)));
  const wait = ms => new Promise(r => setTimeout(r, ms));

  try {
    // --- 1. seed the save, then reload: does TS.restore accept a crafted v3 save? ---
    // Must use addInitScript: the game saves on 'pagehide', so a plain evaluate+reload
    // gets clobbered by the outgoing page's autosave.
    await page.addInitScript(([k, v]) => {
      try { localStorage.setItem(k, JSON.stringify(v)); } catch { }
    }, [KEY, crafted]);
    await page.goto(GAME, { waitUntil: 'load' });
    await page.waitForFunction(() => window.TS && window.Campus3D?.ready(), null, { timeout: 60000 });
    await wait(1200);

    out.saveRestore = await page.evaluate(() => ({
      restoreAccepted: !!TS.restore(localStorage.getItem('tianshu-v3-auto')),
      progressLabel: document.getElementById('progress')?.textContent,
      questTitle: document.getElementById('quest-title')?.textContent,
      level: document.getElementById('host-level')?.textContent,
    }));

    // --- 2. drive the real UI into the duel encounter ---
    await page.click('#quest-jump');
    await wait(400);
    const node = await page.getAttribute('#enter-event', 'data-node');
    out.enteredNode = node;
    await page.click('#enter-event');
    await wait(600);
    await page.click('#skip');           // jump to the interaction phase
    await wait(800);
    out.gameKind = await page.evaluate(() => JSON.parse(localStorage.getItem('tianshu-v3-auto')).active?.game?.kind || null);

    // --- 3. play naively: strike with every action point, then end the turn ---
    const log = [];
    for (let turn = 1; turn <= 40; turn++) {
      const snap = await page.evaluate(() => {
        const st = JSON.parse(localStorage.getItem('tianshu-v3-auto'));
        const g = st.active?.game;
        if (!g || g.kind !== 'combat') return null;
        return { turn: g.turn, hp: g.hp, maxHp: g.maxHp, enemy: g.enemy, energy: g.energy, block: g.block, shield: g.shield, finished: !!g.finished, phase: st.active.phase };
      });
      if (!snap) { log.push({ note: 'combat ended or left combat', turn }); break; }
      if (snap.enemy <= 0 || snap.hp <= 0) { log.push(snap); break; }
      for (let k = 0; k < snap.energy; k++) {
        const ok = await page.locator('[data-card="strike"]').isEnabled().catch(() => false);
        if (!ok) break;
        await page.click('[data-card="strike"]');
        await wait(120);
      }
      const endOk = await page.locator('#combat-end').isEnabled().catch(() => false);
      if (!endOk) break;
      await page.click('#combat-end');
      await wait(220);
      const after = await page.evaluate(() => {
        const st = JSON.parse(localStorage.getItem('tianshu-v3-auto'));
        const g = st.active?.game;
        return g && g.kind === 'combat' ? { turn: g.turn, hp: g.hp, enemy: g.enemy } : { phase: st.active?.phase || 'left', outcome: st.active?.outcome || null, text: (st.active?.text || '').slice(0, 120) };
      });
      log.push({ before: { turn: snap.turn, hp: snap.hp, enemy: snap.enemy, energy: snap.energy, block: snap.block, enemyShield: snap.shield }, after });
      if (after.phase) break;
    }
    out.combat = { log };
    out.finalActive = await page.evaluate(() => {
      const st = JSON.parse(localStorage.getItem('tianshu-v3-auto'));
      return { phase: st.active?.phase || null, outcome: st.active?.outcome || null, done: st.done, text: (st.active?.text || '').slice(0, 200) };
    });
  } catch (e) {
    out.fatal = String(e.stack || e).slice(0, 800);
  } finally {
    await browser.close();
    const p = path.join(__dirname, 'combat-report.json');
    require('node:fs').writeFileSync(p, JSON.stringify(out, null, 2));
    console.log(JSON.stringify(out, null, 2));
  }
})();
