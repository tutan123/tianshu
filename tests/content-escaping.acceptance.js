async (browserPage) => {
  // game.js and minigames.js build HTML with innerHTML from CONTENT strings. Today
  // CONTENT is an in-repo constant, but the moment any of it is externalised — a
  // translation pass, a JSON story file — an unescaped interpolation becomes an
  // injection point. This injects a real payload into CONTENT and asserts it renders
  // as text rather than as markup.
  const context = await browserPage.context().browser().newContext({ viewport: { width: 1440, height: 960 } });
  const page = await context.newPage(), checks = [], errors = [];
  const assert = (value, label) => { if (!value) throw new Error(label); checks.push(label); };
  page.on('pageerror', error => errors.push(error.message));
  const PAYLOAD = '<img data-pwn src=x onerror="window.__pwned=1">';
  try {
    // Complete the opening first, otherwise available() only offers 'intro' and the
    // side-event list is legitimately empty.
    await page.addInitScript(key => {
      const seed = {
        version: 3,
        stats: { intelligence: 15, compute: 60, maxCompute: 100, reputation: 0, cash: 1200, physique: 20, spirit: 50 },
        bonds: { lw: 0, sq: 0, gqh: 0, zty: 0 }, modules: { learn: 0, body: 0, predict: 0 },
        flags: [], done: ['intro'], results: {}, choices: {}, messages: [], history: [],
        active: null, ending: null, settings: { volume: 0, speed: 28, auto: false, motion: true },
        day: 1, time: '清晨', rest: 0, savedAt: null,
      };
      try { localStorage.setItem(key, JSON.stringify(seed)); } catch { }
    }, 'tianshu-v3-auto');
    await page.goto('file:///G:/Projects/Agent/Agent%20Cli/天枢/天枢-WebDemo-v3.0/index.html');
    await page.waitForFunction(() => window.Campus3D && Campus3D.ready(), null, { timeout: 60000 });
    await page.waitForTimeout(900);

    const rendered = await page.evaluate(payload => {
      const out = {};
      const injected = sel => document.querySelectorAll(sel + ' [data-pwn]').length;
      const literal = sel => (document.querySelector(sel)?.textContent || '').includes(payload);

      // renderMap() + renderLocation(): side-event titles, place names, leads.
      // salvage and memory are the reachable side events once intro is done, and the
      // location sheet opens on the first available main node, which is roll/hall.
      CONTENT.nodes.salvage.title = '支线' + payload;
      CONTENT.nodes.roll.title = '主线' + payload;
      CONTENT.nodes.roll.lead = '线索' + payload;
      CONTENT.places.hall.name = '地点' + payload;
      CONTENT.places.hall.en = 'PLACE' + payload;
      document.getElementById('nav-map').click();
      out.eventMarkup = injected('#event-list');
      out.eventLiteral = literal('#event-list');
      out.locationMarkup = injected('#location-sheet');
      out.locationLiteral = literal('#location-sheet');

      // panelBody(): people biographies and secrets.
      CONTENT.people.lw.bio = '简介' + payload;
      CONTENT.people.lw.secret = '往事' + payload;
      document.querySelector('[data-panel="people"]').click();
      out.peopleMarkup = injected('#panel-body');
      out.peopleLiteral = literal('#panel-body');
      document.getElementById('close-panel').click();

      // panelBody(): timeline titles and subtitles. roll is now available.
      CONTENT.nodes.roll.subtitle = '副标题' + payload;
      document.querySelector('[data-panel="timeline"]').click();
      out.timelineMarkup = injected('#panel-body');
      out.timelineLiteral = literal('#panel-body');
      document.getElementById('close-panel').click();

      // minigames.js quiz question, answers and explanation.
      CONTENT.quiz[0].q = '题目' + payload;
      CONTENT.quiz[0].options[0] = '选项' + payload;
      CONTENT.quiz[0].explain = '解释' + payload;
      const host = document.createElement('div');
      document.body.appendChild(host);
      const state = TS.fresh();
      state.active = { id: 'math', phase: 'inter', shot: 0, game: null };
      MiniGames.start('quiz', host, state, { save() { }, hud() { }, toast() { }, icons() { }, sound() { }, finish() { } });
      out.quizMarkup = host.querySelectorAll('[data-pwn]').length;
      out.quizLiteral = host.textContent.includes(payload);
      MiniGames.stop();
      host.remove();

      out.handlerRan = !!window.__pwned;
      return out;
    }, PAYLOAD);

    assert(rendered.eventMarkup === 0, 'Event list renders injected markup as text');
    assert(rendered.eventLiteral, 'Event list shows the payload literally');
    assert(rendered.locationMarkup === 0, 'Location sheet renders injected markup as text');
    assert(rendered.locationLiteral, 'Location sheet shows the payload literally');
    assert(rendered.peopleMarkup === 0, 'People panel renders injected markup as text');
    assert(rendered.peopleLiteral, 'People panel shows the payload literally');
    assert(rendered.timelineMarkup === 0, 'Timeline panel renders injected markup as text');
    assert(rendered.timelineLiteral, 'Timeline panel shows the payload literally');
    assert(rendered.quizMarkup === 0, 'Quiz renders injected markup as text');
    assert(rendered.quizLiteral, 'Quiz shows the payload literally');
    assert(rendered.handlerRan === false, 'Injected onerror handler never executed');
    assert(errors.length === 0, 'Escaping introduces no page errors');
    return { success: true, testedAt: new Date().toISOString(), checks, errors, rendered };
  } catch (error) {
    return { success: false, checks, errors, error: error.stack, rendered: await page.evaluate(() => ({ body: document.body.innerHTML.length })).catch(() => null) };
  } finally { await context.close(); }
}
