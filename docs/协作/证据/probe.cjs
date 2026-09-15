// Read-only health probe for 天枢-WebDemo-v3.0.
// Loads the game in real Chrome, records console/page errors, drives the 3D scene
// and writes screenshots to an OUT-OF-TREE folder so the project is never modified.
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright-core');

const GAME = 'file:///G:/Projects/Agent/Agent%20Cli/%E5%A4%A9%E6%9E%A2/%E5%A4%A9%E6%9E%A2-WebDemo-v3.0/index.html';
const OUT = path.resolve(process.argv[2] || path.join(__dirname, 'shots'));

const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const report = { url: GAME, checks: [], errors: [], consoleErrors: [], failedRequests: [], warnings: [], screenshots: [] };
  const assert = (ok, name, detail) => report.checks.push({ ok: !!ok, name, detail });

  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();

    page.on('pageerror', e => report.errors.push(String(e.message).slice(0, 400)));
    page.on('console', m => {
      if (m.type() === 'error') report.consoleErrors.push(m.text().slice(0, 400));
      if (m.type() === 'warning') report.warnings.push(m.text().slice(0, 300));
    });
    page.on('requestfailed', r => report.failedRequests.push(r.url() + ' :: ' + (r.failure()?.errorText || '')));
    page.on('request', r => { if (/^https?:/.test(r.url())) report.failedRequests.push('EXTERNAL ' + r.url()); });

    const t0 = Date.now();
    await page.goto(GAME, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => window.Campus3D && Campus3D.ready(), null, { timeout: 60000 });
    report.bootMs = Date.now() - t0;
    await wait(2500);

    const shot = async (name) => {
      const p = path.join(OUT, name + '.png');
      await page.screenshot({ path: p });
      report.screenshots.push(p);
    };

    // ---- L0: boot ----
    const boot = await page.evaluate(() => ({
      three: THREE.REVISION,
      keys: ['TS', 'CONTENT', 'RPG', 'Exploration', 'WorldArt', 'CampusBuildings', 'Campus3D', 'MiniGames', 'Arcade', 'GrowthUI'].filter(k => !window[k]),
      has3d: !document.getElementById('map3d').hidden,
      inspect: Campus3D.inspect(),
    }));
    assert(boot.keys.length === 0, '所有全局模块已注册', boot.keys.join(','));
    assert(boot.has3d, '三维场景初始化成功');
    assert(boot.inspect.architecture.length === 11, '11 栋建筑已构建', String(boot.inspect.architecture.length));
    await shot('01-overview-desktop');

    // ---- L1: page metrics ----
    const overlay = await page.evaluate(() => {
      const r = [];
      for (const el of document.querySelectorAll('body *')) {
        const s = getComputedStyle(el);
        if (s.position !== 'fixed' && s.position !== 'absolute') continue;
        if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) continue;
        const b = el.getBoundingClientRect();
        if (b.width < 2 || b.height < 2) continue;
        r.push({ id: el.id || el.className.toString().slice(0, 40), w: Math.round(b.width), h: Math.round(b.height) });
      }
      return { scrollW: document.documentElement.scrollWidth, innerW: innerWidth, scrollH: document.documentElement.scrollHeight, innerH: innerHeight, fixed: r.length };
    });
    assert(overlay.scrollW <= overlay.innerW + 1, '桌面端无水平溢出', `scrollW=${overlay.scrollW} innerW=${overlay.innerW}`);
    report.overlay = overlay;

    // ---- L2: walk mode + collision sanity ----
    const walk = await page.evaluate(() => {
      Campus3D.setMode('walk', 'dorm');
      Campus3D.zoom(10);
      const s = Campus3D.inspect();
      return { spawn: s.player, spawnClear: Campus3D.clearAt(s.player[0], s.player[2]), mode: s.mode };
    });
    assert(walk.spawnClear, '步行出生点可通行', JSON.stringify(walk.spawn));
    await wait(1600);
    await shot('02-walk-dorm');

    // ---- L3: canvas really renders (not blank / not all one color) ----
    const pixels = await page.evaluate(() => {
      const src = document.querySelector('#campus-canvas');
      const c = document.createElement('canvas'); c.width = 160; c.height = 100;
      const x = c.getContext('2d'); x.drawImage(src, 0, 0, 160, 100);
      const d = x.getImageData(0, 0, 160, 100).data;
      const colors = new Set(); let bright = 0;
      for (let i = 0; i < d.length; i += 4) { colors.add((d[i] >> 4) + ',' + (d[i + 1] >> 4) + ',' + (d[i + 2] >> 4)); if (d[i] + d[i + 1] + d[i + 2] > 120) bright++; }
      return { colors: colors.size, bright };
    });
    assert(pixels.colors > 60 && pixels.bright > 8000, '主画布有真实渲染内容', JSON.stringify(pixels));

    // ---- L4: route to a door then enter interior, for every place ----
    const zones = [];
    for (const z of ['dorm', 'hall', 'library', 'lake', 'gym', 'lab', 'gate', 'plaza']) {
      const r = await page.evaluate(async (zone) => {
        Campus3D.setMode('walk', zone);
        const door = Campus3D.worldObjects().find(o => o.id === zone + '-door');
        const routed = Campus3D.moveTo(door.x, door.z);
        const arrived = await new Promise(res => {
          const t = setTimeout(() => res(false), 12000);
          const iv = setInterval(() => {
            if (Campus3D.getObject()?.id === zone + '-door') { clearInterval(iv); clearTimeout(t); res(true); }
          }, 120);
        });
        return { zone, routed, near: Campus3D.getObject()?.id || null, ok: arrived };
      }, z).catch(e => ({ zone: z, error: String(e).slice(0, 200) }));
      zones.push(r);
      if (z === 'library') await shot('03-walk-library');
    }
    assert(zones.every(z => z.ok), '八处室外入口均可寻路抵达', JSON.stringify(zones.filter(z => !z.ok)));

    // ---- L5: enter one interior, screenshot, exit ----
    const inside = await page.evaluate(async () => {
      const entered = Campus3D.enterInterior('dorm');
      await new Promise(r => setTimeout(r, 900));
      const s = Campus3D.inspect();
      const objs = Campus3D.worldObjects().map(o => o.id);
      const reach = [];
      for (const id of ['dorm-stamp', 'dorm-chest', 'dorm-npc', 'dorm-exit']) {
        const o = Campus3D.worldObjects().find(x => x.id === id);
        const ok = Campus3D.moveTo(o.x, o.z);
        if (ok) { await new Promise(r => setTimeout(r, 1400)); }
        reach.push({ id, routed: ok, arrived: Campus3D.getObject()?.id === id });
      }
      return { entered, zone: s.zone, objs: objs.length, reach };
    });
    assert(inside.entered && inside.zone === 'dorm', '可进入室内（dorm）', String(inside.zone));
    assert(inside.reach.every(r => r.routed), '室内互动点均可寻路', JSON.stringify(inside.reach.filter(r => !r.routed)));
    report.interiorReach = inside.reach;
    await shot('04-interior-dorm');
    await page.evaluate(() => Campus3D.exitInterior());

    // ---- L6: night + rain ----
    await page.evaluate(() => { Campus3D.setMode('walk', 'library'); Campus3D.zoom(12); Campus3D.setWeather('night'); });
    await wait(1600); await shot('05-walk-night');
    await page.evaluate(() => Campus3D.setWeather('rain'));
    await wait(900); await shot('06-walk-rain');
    assert(await page.evaluate(() => Campus3D.inspect().rain), '雨景开启后雨线可见');

    // ---- L7: mobile ----
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => { Campus3D.setWeather('day'); Campus3D.setMode('walk', 'dorm'); });
    await wait(1800); await shot('07-mobile-walk');
    const mob = await page.evaluate(() => {
      const over = [];
      for (const el of document.querySelectorAll('body *')) {
        const b = el.getBoundingClientRect();
        if (b.width < 2 || b.height < 2 || getComputedStyle(el).display === 'none') continue;
        if (b.right > innerWidth + 2 || b.left < -2) over.push({ id: el.id || el.className.toString().slice(0, 30), left: Math.round(b.left), right: Math.round(b.right) });
      }
      return { scrollW: document.documentElement.scrollWidth, innerW: innerWidth, overflowing: over.slice(0, 12) };
    });
    assert(mob.scrollW <= mob.innerW + 1, '移动端无水平溢出', `scrollW=${mob.scrollW}`);
    report.mobileOverflow = mob.overflowing;
    await page.evaluate(() => Campus3D.setMode('overview', 'dorm'));
    await wait(1600); await shot('08-mobile-overview');

    // ---- L8: FPS sample ----
    await page.setViewportSize({ width: 1440, height: 960 });
    const fps = await page.evaluate(() => new Promise(res => {
      Campus3D.setMode('walk', 'library');
      let n = 0; const t0 = performance.now();
      const tick = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(tick); else res(Math.round(n / ((performance.now() - t0) / 1000))); };
      requestAnimationFrame(tick);
    }));
    report.fps = fps;
    assert(fps >= 30, '桌面步行模式帧率可接受', fps + ' fps');

    report.success = report.errors.length === 0 && report.checks.every(c => c.ok);
  } catch (e) {
    report.fatal = String(e.stack || e).slice(0, 1500);
    report.success = false;
  } finally {
    await browser.close();
    fs.writeFileSync(path.join(OUT, 'probe-report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  }
})();
