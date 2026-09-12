import { writeFile } from 'node:fs/promises';

export default async function acceptance(browserPage) {
  const root = new URL('../', import.meta.url);
  const context = await browserPage.context().browser().newContext({ viewport: { width: 1440, height: 960 } });
  const page = await context.newPage();
  const errors = [], checks = [];
  page.on('pageerror', error => errors.push(error.message));
  const assert = (condition, name) => { if (!condition) throw new Error(name); checks.push(name); };
  const current = () => page.evaluate(() => JSON.parse(localStorage.getItem('tianshu-v3-auto')));
  const screenshot = name => page.screenshot({ path: decodeURIComponent(new URL(`screenshots/${name}.png`, import.meta.url).pathname).replace(/^\/(\w:)/, '$1') });
  try {
    await page.goto(new URL('index.html', root).href);
    await page.waitForFunction(() => Campus3D.ready() && Campus3D.inspect().frameTime > .5);
    assert(await page.locator('#pins-3d button').count() === 8, 'Eight projected campus markers');
    const pixelCheck = await page.evaluate(() => {
      const c = document.querySelector('canvas#campus-canvas'), gl = c.getContext('webgl2') || c.getContext('webgl');
      const pixel = new Uint8Array(4), colors = new Set();
      for (let x = .2; x < .85; x += .08) for (let y = .2; y < .85; y += .08) { gl.readPixels(Math.floor(c.width * x), Math.floor(c.height * y), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel); colors.add([...pixel].join(',')); }
      return colors.size;
    });
    assert(pixelCheck > 12, 'WebGL framebuffer has varied rendered pixels');
    const oldRadius = await page.evaluate(() => Campus3D.inspect().radius);
    await page.locator('#zoom-in').click();
    assert(await page.evaluate(() => Campus3D.inspect().radius) < oldRadius, 'Zoom button changes 3D camera');
    await page.locator('#enter-walk').click();
    await page.keyboard.down('w'); await page.waitForTimeout(550); await page.keyboard.up('w');
    assert(await page.evaluate(() => Campus3D.getNear()) === 'dorm', 'Walking reaches an available event');
    await page.keyboard.down('w'); await page.waitForTimeout(1500); await page.keyboard.up('w');
    assert((await page.evaluate(() => Campus3D.inspect().player))[2] > -10.91, 'Building collision blocks walking through walls');
    await page.locator('[data-weather=rain]').click();
    assert(await page.evaluate(() => Campus3D.inspect().rain) === true, 'Rain weather enables animated particles');
    await screenshot('acceptance-desktop-rain');
    await page.locator('#nav-map').click();
    assert(await page.evaluate(() => Campus3D.getMode()) === 'overview', 'Campus navigation exits walking');
    await page.locator('[data-weather=auto]').click();
    await page.locator('#enter-walk').click();
    await page.keyboard.down('w'); await page.waitForTimeout(500); await page.keyboard.up('w');
    await page.locator('#near-interact').click();
    assert(await page.locator('#cinema').isVisible(), 'Nearby interaction enters cinematic story');
    await page.locator('#next-line').click();
    await page.locator('#next-line').click();
    const shot = (await current()).active.shot;
    await page.reload();
    assert((await current()).active.shot === shot, 'Cinematic shot cursor survives reload');
    assert(!(await page.evaluate(() => Campus3D.inspect().active)), '3D renderer pauses during restored cinematic');
    await screenshot('acceptance-cinema');
    const visited = [];
    async function finishNode(id, initial = false) {
      if (!initial) {
        const main = await page.evaluate(id => CONTENT.nodes[id].main, id);
        if (main) await page.locator('#quest-jump').click();
        else await page.locator(`[data-event="${id}"]`).click();
        await page.locator('#enter-event').click();
      }
      assert((await current()).active.id === id, `Entered ${id} through UI`);
      await page.locator('#skip').click();
      const kind = await page.evaluate(id => CONTENT.nodes[id].kind, id);
      if (kind === 'choice') await page.locator('[data-choice]:not([disabled])').first().click();
      if (kind === 'quiz') {
        await page.locator('#quiz-assist').click();
        const paid = (await current()).stats.compute;
        await page.reload();
        assert((await current()).active.game.assisted && (await current()).stats.compute === paid, 'Paid quiz assistance survives reload');
        assert(await page.locator('#quiz-assist').isDisabled(), 'Reload cannot charge quiz assistance twice');
        for (const answer of [1, 2, 1]) { await page.locator(`[data-answer="${answer}"]`).click(); await page.locator('#quiz-next').click(); }
      }
      if (kind === 'qte') {
        await page.locator('#qte-hit').click();
        await page.waitForFunction(() => { const e = document.querySelector('#qte-cursor'); const p = parseFloat(e.style.left); return p > 44 && p < 56; });
        await page.locator('#qte-hit').click();
        await page.locator('#qte-hit').click();
      }
      if (kind === 'circuit') {
        await page.locator('#circuit-hint').click();
        await page.locator('[data-rotate="0"]').click();
        const before = (await current()).active.game;
        await page.reload();
        assert(JSON.stringify((await current()).active.game) === JSON.stringify(before), 'Circuit rotation and paid hint survive reload');
        await page.locator('#circuit-check').click();
        assert(await page.locator('#circuit-feedback').textContent().then(t => t.includes('未对齐')), 'Incomplete circuit remains recoverable');
        for (const i of [0, 1, 2]) {
          const angles = (await current()).active.game.angles;
          for (let j = 0; j < (4 - angles[i]) % 4; j++) await page.locator(`[data-rotate="${i}"]`).click();
        }
        await page.locator('#circuit-check').click();
      }
      if (kind === 'combat') {
        await page.locator('[data-card=read]').click();
        await page.locator('#combat-assist').click();
        const before = (await current()).active.game;
        await page.reload();
        assert(JSON.stringify((await current()).active.game) === JSON.stringify(before), 'Combat HP, energy and paid assistance survive reload');
        await screenshot('acceptance-cards');
        for (let turn = 0; turn < 15 && await page.locator('#combat-end').count(); turn++) {
          while (await page.locator('[data-card=strike]:not([disabled])').count()) await page.locator('[data-card=strike]').click();
          if (await page.locator('#combat-end').count()) await page.locator('#combat-end').click();
        }
      }
      assert((await current()).active.phase === 'result', `${id} resolves to result`);
      await page.locator('#back-campus').click(); visited.push(id);
    }
    await finishNode('intro', true);
    await page.locator('[data-panel=saves]').first().click();
    await page.locator('[data-save="1"]').click();
    assert(await page.locator('[data-load="1"]').isEnabled(), 'Manual save slot becomes readable');
    await page.locator('#close-panel').click();
    await page.locator('[data-panel=phone]').first().click();
    await page.locator('[data-reply]').first().click();
    assert((await current()).messages.some(m => m.reply !== null), 'Phone reply persists');
    await page.locator('#close-panel').click();
    for (const id of ['roll','repair','math','leaf','gym','run','roof','market','professor','lab','hearing','duel','finale']) await finishNode(id);
    assert((await current()).done.length === 14, 'All ten main and four side events completed through UI');
    assert((await current()).ending.id === 'dawn', 'Evidence and public route reach expected ending');
    await screenshot('acceptance-ending');
    await page.locator('#ending-back').click();
    await page.locator('[data-panel=saves]').first().click();
    await page.locator('[data-load="1"]').click(); await page.locator('#confirm-yes').click();
    assert((await current()).done.length === 1, 'Manual load restores earlier progress');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#nav-map').click();
    await page.waitForTimeout(500); await screenshot('acceptance-mobile-map');
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile viewport has no horizontal overflow');
    await page.locator('#enter-walk').click();
    const before = await page.evaluate(() => Campus3D.inspect().player);
    const box = await page.locator('[data-direction=up]').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.waitForTimeout(500); await page.mouse.up();
    const after = await page.evaluate(() => Campus3D.inspect().player);
    assert(Math.hypot(before[0] - after[0], before[2] - after[2]) > 1, 'Touch direction pad moves the player');
    await screenshot('acceptance-mobile-walk');
    await page.locator('#exit-walk').click();
    assert(await page.evaluate(() => Campus3D.getMode()) === 'overview', 'Mobile return control exits walking');
    const fallback = await context.newPage();
    await fallback.route('**/vendor/three.min.js', route => route.abort());
    await fallback.goto(new URL('index.html', root).href);
    assert(await fallback.locator('#map3d').isHidden() && await fallback.locator('#pins button').count() === 8, 'Missing Three.js falls back to usable illustrated map');
    await fallback.locator('#enter-event').click();
    assert(await fallback.locator('#cinema').isVisible(), 'Fallback map can still enter story');
    assert(errors.length === 0, 'No uncaught page errors');
    const report = { testedAt: new Date().toISOString(), checks, visited, pixelColors: pixelCheck, errors, success: true };
    await writeFile(new URL('browser-results.json', import.meta.url), JSON.stringify(report, null, 2));
    return report;
  } catch (error) {
    await screenshot('acceptance-failure');
    await writeFile(new URL('browser-results.json', import.meta.url), JSON.stringify({ success: false, checks, errors, error: error.stack }, null, 2));
    throw error;
  } finally { await context.close(); }
}
