async (browserPage) => {
  const context = await browserPage.context().browser().newContext({ viewport: { width: 1440, height: 960 } });
  const page = await context.newPage(), checks = [], errors = [];
  const assert = (value, label) => { if (!value) throw new Error(label); checks.push(label); };
  page.on('pageerror', error => errors.push(error.message));
  const state = () => page.evaluate(() => window.rpgFixture.state);
  const screenshot = name => page.screenshot({ path: 'G:/Projects/Agent/Agent Cli/天枢/天枢-WebDemo-v3.0/tests/screenshots/' + name + '.png' });
  try {
    await page.goto('file:///G:/Projects/Agent/Agent%20Cli/天枢/天枢-WebDemo-v3.0/index.html');
    await page.evaluate(() => {
      const state = TS.fresh(); RPG.ensure(state); state.stats.compute = 95;
      window.rpgFixture = { state, saves: 0, visited: '', hooks: {
        save() { window.rpgFixture.saves++; }, hud() {}, sound() {}, toast() {},
        icons() { globalThis.lucide?.createIcons(); }, visit(zone) { window.rpgFixture.visited = zone; }
      } };
      document.getElementById('panel-title').textContent = '角色档案';
      GrowthUI.render(document.getElementById('panel-body'), state, window.rpgFixture.hooks, 'profile');
      document.getElementById('panel').showModal();
    });
    assert(await page.locator('[role=tab]').count() === 4, 'Four separate accessible main views');
    assert((await page.locator('[data-stat=hp]').innerText()).includes('75'), 'Profile displays actual battle health');
    await page.locator('[data-growth-tab=profile]').focus();
    await page.keyboard.press('ArrowRight');
    assert(await page.locator('[data-growth-tab=gear]').getAttribute('aria-selected') === 'true', 'Arrow keys select and focus tabs');
    await page.locator('[data-growth-tab=shop]').click();
    await page.locator('[data-buy=wrist]').click();
    await page.locator('[data-buy=solder]').click();
    await page.locator('[data-buy=coffee]').click();
    await page.locator('[data-buy=notes]').click();
    assert((await state()).stats.cash === 280, 'Purchase charges exact total');
    assert(await page.locator('[data-buy=wrist]').isDisabled(), 'Owned equipment cannot be purchased twice');
    await page.locator('[data-growth-tab=gear]').click();
    await page.locator('[data-gear-detail=solder]').click();
    assert((await page.locator('.dossier-comparison').innerText()).includes('-4'), 'Replacement compares against current guard bonus');
    await page.locator('[data-equip=solder]').click();
    assert((await state()).rpg.equipped.hand === 'solder', 'Equipment replacement updates actual slot');
    await page.locator('[data-equip=solder]').click();
    assert((await state()).rpg.equipped.hand === null, 'Equipment can be removed');
    await page.locator('[data-equip=wrist]').click();
    await screenshot('rpg-gear-desktop');
    await page.locator('[data-growth-tab=bag]').click();
    await page.locator('[data-bag-filter]').selectOption('supplies');
    assert(await page.locator('[data-bag-item]').count() === 2, 'Bag category displays actual consumables');
    await page.locator('[data-bag-item=coffee]').click();
    assert((await page.locator('.dossier-use-preview').innerText()).includes('5 算力'), 'Use preview reports clamped actual effect');
    await page.locator('[data-use=coffee]').click();
    assert((await state()).stats.compute === 100 && (await state()).rpg.bag.coffee === 0, 'Use updates capped resource and quantity once');
    assert((await page.locator('[role=status]').innerText()).includes('恢复 5 算力'), 'Use effect remains visible after last item disappears');
    await page.locator('[data-bag-search]').fill('不存在');
    assert(await page.locator('[data-bag-item]').count() === 0, 'Search has a real empty result');
    await page.locator('[data-bag-search]').fill('');
    await page.locator('[data-bag-filter]').selectOption('gear');
    assert(await page.locator('[data-bag-item]').count() === 2, 'Equipment remains independently accessible from bag');
    await page.locator('[data-growth-tab=tasks]').click();
    assert(await page.locator('[data-quest]').count() > 0, 'Quest view consumes actual exploration missions');
    await page.locator('[data-quest-visit]').first().click();
    assert(!!await page.evaluate(() => window.rpgFixture.visited), 'Quest navigation passes a destination to the host');
    await screenshot('rpg-quests-desktop');
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      for (const view of ['profile', 'gear', 'bag', 'tasks', 'shop', 'finds']) {
        await page.locator('[data-growth-tab=' + view + ']').click();
        assert(await page.evaluate(() => {
          const root = document.querySelector('.character-ui'), rect = root.getBoundingClientRect();
          return root.scrollWidth <= root.clientWidth + 1 && rect.left >= 0 && rect.right <= innerWidth;
        }), view + ' fits ' + width + 'px viewport');
        if (width === 390 && ['profile', 'bag', 'tasks'].includes(view)) await screenshot('rpg-' + view + '-mobile');
      }
    }
    assert(await page.evaluate(() => !!TS.restore(JSON.stringify(window.rpgFixture.state))), 'UI actions retain valid version-3 state');
    assert(errors.length === 0, 'RPG views produce no page errors');
    return { success: true, testedAt: new Date().toISOString(), checks, errors };
  } catch (error) {
    await screenshot('rpg-interface-failure');
    return { success: false, checks, errors, error: error.stack };
  } finally { await context.close(); }
}
