#!/usr/bin/env node
'use strict';
/*
 * Live health probe for 天枢 · 重返江大.
 *
 * Complements the acceptance suites: they assert authored expectations, this
 * measures the running build and reports raw numbers (boot time, frame rate,
 * routing reachability, layout overflow, rendered pixel variety).
 *
 *   node tests/agent.probe.cjs [outputDir]
 *
 * Writes screenshots + probe-report.json. Default output is tests/screenshots/probe/
 * (gitignored). Runs headless against the locally installed Chrome.
 */
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const { chromium } = (() => {
  try { return require('playwright-core'); } catch { return require('playwright'); }
})();

const root = path.resolve(__dirname, '..');
const GAME = pathToFileURL(path.join(root, 'index.html')).href;
const OUT = path.resolve(process.argv[2] || path.join(root, 'tests', 'screenshots', 'probe'));
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const report = { url: GAME, checks: [], errors: [], consoleErrors: [], failedRequests: [], screenshots: [] };
  const assert = (ok, name, detail) => report.checks.push({ ok: !!ok, name, detail });

  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.on('pageerror', e => report.errors.push(String(e.message).slice(0, 400)));
    page.on('console', m => { if (m.type() === 'error') report.consoleErrors.push(m.text().slice(0, 400)); });
    page.on('requestfailed', r => report.failedRequests.push(r.url() + ' :: ' + (r.failure()?.errorText || '')));
    page.on('request', r => { if (/^https?:/.test(r.url())) report.failedRequests.push('EXTERNAL ' + r.url()); });

    const t0 = Date.now();
    await page.goto(GAME, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => window.Campus3D && Campus3D.ready(), null, { timeout: 60000 });
    report.bootMs = Date.now() - t0;
    await wait(2500);

    const shot = async name => {
      const p = path.join(OUT, name + '.png');
      await page.screenshot({ path: p });
      report.screenshots.push(p);
    };

    const boot = await page.evaluate(() => ({
      keys: ['TS', 'CONTENT', 'RPG', 'Exploration', 'WorldArt', 'CampusBuildings', 'Interiors', 'Characters', 'Campus3D', 'MiniGames', 'Arcade', 'GrowthUI'].filter(k => !window[k]),
      has3d: !document.getElementById('map3d').hidden,
      inspect: Campus3D.inspect(),
    }));
    assert(boot.keys.length === 0, '所有全局模块已注册', boot.keys.join(','));
    assert(boot.has3d, '三维场景初始化成功');
    assert(boot.inspect.architecture.length === 11, '11 栋建筑已构建', String(boot.inspect.architecture.length));
    await shot('01-overview-desktop');

    const overlay = await page.evaluate(() => ({ scrollW: document.documentElement.scrollWidth, innerW: innerWidth }));
    assert(overlay.scrollW <= overlay.innerW + 1, '桌面端无水平溢出', `scrollW=${overlay.scrollW} innerW=${overlay.innerW}`);

    const walk = await page.evaluate(() => { Campus3D.setMode('walk', 'dorm'); Campus3D.zoom(10); const s = Campus3D.inspect(); return { spawn: s.player, clear: Campus3D.clearAt(s.player[0], s.player[2]) }; });
    assert(walk.clear, '步行出生点可通行', JSON.stringify(walk.spawn));
    await wait(1600); await shot('02-walk-dorm');

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

    // --- every outdoor entrance must be reachable by the in-game path finder ---
    const doors = [];
    for (const z of ['dorm', 'hall', 'library', 'lake', 'gym', 'lab', 'gate', 'plaza']) {
      const r = await page.evaluate(async zone => {
        Campus3D.setMode('walk', zone);
        const door = Campus3D.worldObjects().find(o => o.id === zone + '-door');
        const routed = Campus3D.moveTo(door.x, door.z);
        const arrived = await new Promise(res => {
          const t = setTimeout(() => res(false), 12000);
          const iv = setInterval(() => { if (Campus3D.getObject()?.id === zone + '-door') { clearInterval(iv); clearTimeout(t); res(true); } }, 120);
        });
        return { zone, routed, arrived };
      }, z).catch(e => ({ zone: z, error: String(e).slice(0, 200) }));
      doors.push(r);
      if (z === 'library') await shot('03-walk-library');
    }
    assert(doors.every(d => d.arrived), '八处室外入口均可寻路抵达', JSON.stringify(doors.filter(d => !d.arrived)));

    // --- every interactive object inside every interior must be reachable ---
    report.interiorReach = await page.evaluate(async () => {
      const waitFor = (pred, ms) => new Promise(res => {
        const t = setTimeout(() => res(false), ms);
        const iv = setInterval(() => { if (pred()) { clearInterval(iv); clearTimeout(t); res(true); } }, 100);
      });
      const out = [];
      for (const zone of Object.keys(Exploration.regions)) {
        Campus3D.setMode('walk', zone); Campus3D.enterInterior(zone);
        await new Promise(r => setTimeout(r, 350));
        const unreachable = [];
        for (const o of Campus3D.worldObjects()) {
          Campus3D.moveTo(0, 10.5);
          const routed = Campus3D.moveTo(o.x, o.z);
          const arrived = routed && await waitFor(() => Campus3D.getObject()?.id === o.id, 14000);
          if (!arrived) unreachable.push(o.id);
        }
        out.push({ zone, total: Campus3D.worldObjects().length, unreachable });
        Campus3D.exitInterior();
        await new Promise(r => setTimeout(r, 200));
      }
      return out;
    });
    assert(report.interiorReach.every(z => z.unreachable.length === 0), '室内互动点全部可达', JSON.stringify(report.interiorReach.filter(z => z.unreachable.length)));
    await page.evaluate(() => { Campus3D.setMode('walk', 'dorm'); Campus3D.enterInterior('dorm'); });
    await wait(900); await shot('04-interior-dorm');
    await page.evaluate(() => Campus3D.exitInterior());

    await page.evaluate(() => { Campus3D.setMode('walk', 'library'); Campus3D.zoom(12); Campus3D.setWeather('night'); });
    await wait(1600); await shot('05-walk-night');
    await page.evaluate(() => Campus3D.setWeather('rain'));
    await wait(900); await shot('06-walk-rain');
    assert(await page.evaluate(() => Campus3D.inspect().rain), '雨景开启后雨线可见');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => { Campus3D.setWeather('day'); Campus3D.setMode('walk', 'dorm'); });
    await wait(1800); await shot('07-mobile-walk');
    const mob = await page.evaluate(() => {
      const over = [];
      for (const el of document.querySelectorAll('body *')) {
        const b = el.getBoundingClientRect();
        if (b.width < 2 || b.height < 2 || getComputedStyle(el).display === 'none') continue;
        if (b.right > innerWidth + 2 || b.left < -2) over.push({ id: el.id || String(el.className).slice(0, 30), left: Math.round(b.left), right: Math.round(b.right) });
      }
      return { scrollW: document.documentElement.scrollWidth, innerW: innerWidth, overflowing: over.slice(0, 12) };
    });
    assert(mob.scrollW <= mob.innerW + 1, '移动端无水平溢出', `scrollW=${mob.scrollW}`);
    report.mobileOverflow = mob.overflowing;
    await page.evaluate(() => Campus3D.setMode('overview', 'dorm'));
    await wait(1600); await shot('08-mobile-overview');

    await page.setViewportSize({ width: 1440, height: 960 });
    report.fps = await page.evaluate(() => new Promise(res => {
      Campus3D.setMode('walk', 'library');
      let n = 0; const t0 = performance.now();
      const tick = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(tick); else res(Math.round(n / ((performance.now() - t0) / 1000))); };
      requestAnimationFrame(tick);
    }));
    assert(report.fps >= 30, '桌面步行模式帧率可接受', report.fps + ' fps');
    assert(report.errors.length === 0, '无未捕获页面错误', report.errors.join(' | '));
    assert(report.failedRequests.length === 0, '无外部网络请求', report.failedRequests.join(' | '));

    report.success = report.checks.every(c => c.ok);
  } catch (e) {
    report.fatal = String(e.stack || e).slice(0, 1500);
    report.success = false;
  } finally {
    await browser.close();
    fs.writeFileSync(path.join(OUT, 'probe-report.json'), JSON.stringify(report, null, 2));
    for (const c of report.checks) console.log(`  ${c.ok ? '通过' : '失败'}  ${c.name}${c.detail ? '  ' + c.detail : ''}`);
    console.log(`\n${report.success ? '探针通过' : '探针失败'}  boot=${report.bootMs}ms  fps=${report.fps}  截图 ${report.screenshots.length} 张 -> ${OUT}`);
    if (!report.success) { console.log(JSON.stringify({ errors: report.errors, fatal: report.fatal }, null, 2)); process.exitCode = 1; }
  }
})();
