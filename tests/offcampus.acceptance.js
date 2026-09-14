async (browserPage) => {
  // 校外内容层的验收：调查线在真实 UI 里能走完、错误答案不付款、故事链终章可达且只发一次。
  const c = await browserPage.context().browser().newContext({ viewport: { width: 1440, height: 960 } });
  const p = await c.newPage(), checks = [], errors = [];
  const assert = (ok, label) => { if (!ok) throw new Error(label); checks.push(label); };
  p.on('pageerror', e => errors.push(e.message));
  const shot = name => p.screenshot({ path: 'G:/Projects/Agent/Agent Cli/天枢/天枢-WebDemo-v3.0/tests/screenshots/offcampus-' + name + '.png' });
  const state = () => p.evaluate(() => JSON.parse(localStorage.getItem('tianshu-v3-auto')));

  async function approach(id) {
    assert(await p.evaluate(id => { const o = Campus3D.worldObjects().find(o => o.id === id); return !!o && Campus3D.moveTo(o.x, o.z); }, id), 'Route ' + id);
    await p.waitForFunction(id => Campus3D.getObject()?.id === id, id, { timeout: 25000 });
    await p.locator('#world-interact').click();
    await p.waitForTimeout(250);
  }
  async function enter(id) {
    if (await p.evaluate(() => !!Campus3D.getZone())) await p.locator('#exit-walk').click();
    await p.locator('#district-destination').selectOption(id);
    await approach(id + '-door');
    assert(await p.evaluate(() => Campus3D.getZone()) === id, 'entered ' + id);
  }

  try {
    await p.goto('file:///G:/Projects/Agent/Agent%20Cli/天枢/天枢-WebDemo-v3.0/index.html');
    await p.waitForFunction(() => Campus3D.ready()); await p.waitForTimeout(900);

    assert(await p.evaluate(() => typeof OffCampus === 'object' && OffCampus.zones.length === 7), '校外内容层已加载，七条调查线就位');
    assert(await p.evaluate(() => OffCampus.objects('cafe', 1).length === 0), '调查线挂在既有物件上，不新增室内物件');

    // --- 完整 UI 流程：线索 → 出题 → 错答 → 正答 → 结案 ---
    await enter('cafe');
    await approach('cafe-f1-note');
    const clue = await p.textContent('#world-dialog-text');
    assert(clue.includes('存根') || clue.includes('15:00'), '咖啡馆线索便签给出记录内容');
    await p.locator('#world-dialog-actions button:last-child').click();

    await approach('cafe-f1-npc');
    let buttons = await p.locator('#world-dialog-actions button').count();
    assert(buttons === 3, '读过线索后，当地人给出三个选项（实际 ' + buttons + '）');
    await shot('cafe-question');

    const answerKey = await p.evaluate(() => OffCampus.investigations.cafe.answer);
    const wrong = [0, 1, 2].find(i => i !== answerKey);
    const cashBefore = (await state()).stats.cash;
    await p.locator('#world-dialog-actions button').nth(wrong).click(); await p.waitForTimeout(300);
    buttons = await p.locator('#world-dialog-actions button').count();
    assert(buttons === 3, '错误答案保留选项、不关闭对话框');
    assert((await state()).stats.cash === cashBefore, '错误答案不结算');
    await shot('cafe-wrong');

    await p.locator('#world-dialog-actions button').nth(answerKey).click(); await p.waitForTimeout(300);
    buttons = await p.locator('#world-dialog-actions button').count();
    assert(buttons === 1, '正确答案结案，只留收尾按钮');
    const afterCase = (await state()).stats.cash;
    assert(afterCase > cashBefore, '结案发放报酬');
    assert(await p.evaluate(() => OffCampus.caseSolved(JSON.parse(localStorage.getItem('tianshu-v3-auto')), 'cafe')), '结案写入存档');
    await p.locator('#world-dialog-actions button:last-child').click();
    await approach('cafe-f1-npc');
    assert((await state()).stats.cash === afterCase, '已结案的调查线不再付款');
    await p.locator('#world-dialog-actions button:last-child').click();

    // --- 其余调查线：物件就是 CampusRooms 的 npc/note，可达性已由 expansion 逐层验证 ---
    const wired = await p.evaluate(() => {
      const missing = [];
      for (const zone of OffCampus.zones) {
        const ids = CampusRooms.objects(zone, 1).map(o => o.id);
        for (const suffix of ['-f1-npc', '-f1-note']) if (!ids.includes(zone + suffix)) missing.push(zone + suffix);
        if (!CampusRooms.locations[zone]) missing.push(zone + ' (未在 CampusRooms 登记)');
      }
      return missing;
    });
    assert(wired.length === 0, '七栋校外建筑的 npc / note 物件齐备：' + wired.join(','));

    // --- 故事链：三段调查与物证全部走真实 UI，顺序必须是书局 → 照相馆 → 校史馆 ---
    async function runCase(zone) {
      await enter(zone);
      await approach(zone + '-f1-note');
      await p.locator('#world-dialog-actions button:last-child').click();
      await approach(zone + '-f1-npc');
      const key = await p.evaluate(z => OffCampus.investigations[z].answer, zone);
      await p.locator('#world-dialog-actions button').nth(key).click(); await p.waitForTimeout(250);
      await p.locator('#world-dialog-actions button:last-child').click();
      await approach(zone + '-f1-npc');            // 结案后回来取物证
      const text = await p.textContent('#world-dialog-text');
      await p.locator('#world-dialog-actions button:last-child').click();
      return text;
    }
    const plateText = await runCase('bookshop');
    assert(plateText.includes('获得') && plateText.includes('底片'), '书局交出第一件物证');
    const printText = await runCase('studio');
    assert(printText.includes('获得') && printText.includes('样张'), '照相馆交出第二件物证');
    const originalText = await runCase('museum');
    assert(originalText.includes('获得') && originalText.includes('编号'), '校史馆交出第三件物证');

    const chained = await state();
    assert(chained.flags.filter(f => f.startsWith('negative-')).length === 3, '三段物证齐备');
    assert(!chained.rpg.owned.includes('negative'), '显影前不应持有唯一装备');

    if (await p.evaluate(() => !!Campus3D.getZone())) await p.locator('#exit-walk').click();
    await p.waitForTimeout(200);
    assert(await p.evaluate(() => Campus3D.worldObjects().some(o => o.id === OffCampus.finale.id)), '沿河步道的显影台出现在世界里');
    await p.locator('#district-destination').selectOption('museum');
    await p.waitForTimeout(300);
    assert(await p.evaluate(() => { const o = Campus3D.worldObjects().find(o => o.id === OffCampus.finale.id); return !!o && Campus3D.moveTo(o.x, o.z); }), '从校史馆可以走到显影台');
    await p.waitForFunction(() => Campus3D.getObject()?.id === 'pond-develop', null, { timeout: 30000 });
    await p.locator('#world-interact').click(); await p.waitForTimeout(350);
    await shot('pond-develop');
    const finaleText = await p.textContent('#world-dialog-text');
    assert(finaleText.includes('显影') || finaleText.includes('荷池'), '显影台给出终章文本');
    const finalState = await state();
    assert(finalState.rpg.owned.includes('negative'), '终章发放唯一装备「未显影底片」');
    assert(finalState.stats.reputation >= 10, '终章发放声望');
    await p.locator('#world-dialog-actions button:last-child').click();

    await p.reload(); await p.waitForFunction(() => Campus3D.ready()); await p.waitForTimeout(600);
    assert(await p.evaluate(() => JSON.parse(localStorage.getItem('tianshu-v3-auto')).rpg.world.switches.includes('pond-develop')), '终章进度在刷新后保留');
    assert(await p.evaluate(() => { const q = Exploration.quests(JSON.parse(localStorage.getItem('tianshu-v3-auto'))); return q.length === 16 && q.some(x => x.id === 'pond-negative' && x.complete); }), '任务面板包含校外条目与已完成的故事链');
    assert(errors.length === 0, '校外内容不产生页面错误');
    return { success: true, testedAt: new Date().toISOString(), checks, errors };
  } catch (error) {
    await shot('failure');
    return { success: false, checks, errors, error: error.stack };
  } finally { await c.close(); }
}
