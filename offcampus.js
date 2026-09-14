'use strict';
/*
 * 校外内容层。
 *
 * WorldDistricts 提供场地（南门商店街、校外生活街区、荷院、沿河步道），CampusRooms 提供
 * 楼层与通用陈设。两者给的是"地方"，没有玩法。这个模块补上玩法与剧情：
 *
 *   1. 七栋校外建筑各有一条现场调查线，沿用校史馆那套已验证的机制
 *      （与当地人交谈 → 找到线索 → 现场推理 → 结案领赏）。
 *   2. 一条把它们串起来的故事链「荷池底片」，终章在沿河步道显影，给一件唯一装备。
 *
 * 调查线不新增可互动物，而是挂在 CampusRooms 已经生成、且已被 expansion 验收证明可达的
 * -f1-npc 与 -f1-note 上，避免再引入一次寻路风险。只有故事链终章是一个新物件。
 */
globalThis.OffCampus = (() => {
  const investigations = {
    bookshop: {
      title: '底片上的钟楼', clue: '冲印袋与落成记录',
      intro: '旧书店主把一只牛皮纸袋推过来：“这卷底片是上个月夹在书里的。袋上的日期，比钟楼落成早了十一年。”',
      text: '冲印袋背面写着 2007.04，而校史记录里钟楼是 2018 年落成的。袋口还压着一张对折的草图，线条和今天的钟楼几乎一致。',
      question: '一张 2007 年的底片上有 2018 年才建成的钟楼，最合理的解释是？',
      choices: ['底片是后来伪造的', '拍的是设计图或模型，不是实体建筑', '日期被雨水泡花了'], answer: 1, cash: 150, xp: 40,
      reply: '店主点头：“设计图。有人在那一年就知道它会建成什么样子。”他把底片留给你。'
    },
    cafe: {
      title: '每周三的空位', clue: '靠窗桌的订单存根',
      intro: '咖啡师夏禾指了指靠窗那张空桌：“那桌每周三下午三点都点一杯美式，从来没人来取。”',
      text: '存根按日期叠成一摞：每周三 15:00，同一杯、同一张桌、同一种付款方式。十八张，没有一张被取走。',
      question: '一个人长期下单却从不出现，最可能是在做什么？',
      choices: ['系统重复下单', '店主记错了账', '用订单长期占住一个位置'], answer: 2, cash: 130, xp: 35,
      reply: '夏禾：“占位。他只需要那张桌子空着，让别人坐不到。”她顿了一下，“或者说，让某个人找不到他。”'
    },
    grocery: {
      title: '雨天的胶卷', clue: '雨天问询记录',
      intro: '便利店老板一边补货一边说：“后门那条巷子通向照相馆。邪门的是，总下雨天才有人来问过期胶卷。”',
      text: '问询记录只有日期和天气两栏。九个雨天，九次同样的问题，署名栏全是空白。记录最后一行写着：后门，23:40。',
      question: '为什么这件事只在雨天发生？',
      choices: ['雨天光线适合冲洗', '雨天胶卷容易受潮', '雨天小巷没人经过，交接不容易被看见'], answer: 2, cash: 140, xp: 35,
      reply: '老板压低声音：“雨天监控拍不清。你要真想知道，夜里去后门站一会儿。”'
    },
    arcade: {
      title: '没人操作的机台', clue: '街机运行日志',
      intro: '街机社社员把维护终端转过来：“这台机器每天 23:40 会自己投币开局，可那个点店里早没人了。”',
      text: '日志显示 23:40 投币、开局、然后停在第一个输入界面。连续二十七天，同一秒，同一步。没有任何操作记录。',
      question: '机台每天准时启动却没人玩，说明什么？',
      choices: ['机器定时故障', '有人远程接入，只是让它开机', '店员忘记断电'], answer: 1, cash: 160, xp: 45,
      reply: '社员吹了声口哨：“远程接入。而且它什么都不做，只是开着——像在等谁上线。”'
    },
    clinic: {
      title: '写在明天的名字', clue: '值班登记本',
      intro: '值班医生把登记本翻到今天那一页：“你看，明天这一栏已经有名字了。笔迹……和你刚才签的一模一样。”',
      text: '登记本按日期排，明天那一行写着你的名字、今天的就诊号，还有一句备注：复查，携带底片。',
      question: '明天的登记栏出现了今天的笔迹，怎么解释最合理？',
      choices: ['有人照着你的笔迹预先填了明天', '医生写错了日期', '系统时间不同步'], answer: 0, cash: 150, xp: 40,
      reply: '医生合上本子：“我不会写别人的笔迹。有人想让你明天来这里，而且知道你会带着什么。”'
    },
    studio: {
      title: '另一种校园布局', clue: '冲印机里的样张',
      intro: '摄影师从冲印机里抽出一张还没干的样张：“这张不是今天拍的。荷院在这个位置，可今天的荷院不在这儿。”',
      text: '样张上是航拍视角的校园：荷池在东南，短桥通向一座两层小楼。对照现在的平面图，小楼是校史馆的位置，荷池却整体偏移了近百米。',
      question: '一张照片里的校园布局和现实不符，意味着什么？',
      choices: ['照片是后期合成的', '相机镜头畸变', '拍摄时荷院还没改成现在的样子'], answer: 2, cash: 170, xp: 45,
      reply: '摄影师：“不是畸变。是它被改过位置——水是从别处引过来的。你去校史馆问修复师，他见过原件。”'
    },
    museum: {
      title: '同一天的三次改写', clue: '校刊原件与修复记录',
      intro: '校史研究员戴上手套：“同一页校刊，我们这里有三个版本。纸张不同、版式不同，但墨迹的成分测试指向同一天。”',
      text: '三个版本分别记着荷池在东南、正中、被填平。修复记录的结论是：三次改写都发生在同一天，且都用了同一批油墨。',
      question: '同一页记录在同一天被改写三次，最可能的原因是？',
      choices: ['有人在一天之内把记录改成了三种说法', '印刷厂重复排版', '纸张受潮导致显影'], answer: 0, cash: 190, xp: 50,
      reply: '研究员沉默了几秒：“不是印刷事故。是有人反复改，改到最后自己也拿不准哪一版是真的。”他递来原件编号。'
    }
  };

  // 故事链：完成对应调查线后，同一位当地人交出下一件物证。终章在沿河步道显影。
  const chain = [
    { flag: 'negative-plate', zone: 'bookshop', needs: 'bookshop-case', title: '拿到冲印底片', item: '底片', text: '店主把底片装进信封：“我留着也没用。你既然问到了，就替我看完它。”' },
    { flag: 'negative-print', zone: 'studio', needs: 'studio-case', requires: 'negative-plate', title: '取得对照样张', item: '样张', text: '摄影师把底片和样张叠在一起对着灯看：“同一座楼。这张底片比它本身还早。”' },
    { flag: 'negative-original', zone: 'museum', needs: 'museum-case', requires: 'negative-print', title: '核对原件编号', item: '原件编号', text: '研究员把编号抄在便签上：“三个版本都对应同一个编号。缺的那一张，应该还在外面。”' }
  ];
  const FINALE = { id: 'pond-develop', x: 91, z: 20, needs: 'negative-original', item: 'negative' };

  const zones = Object.keys(investigations);
  const caseId = zone => zone + '-case';
  const isCase = id => zones.includes(id.slice(0, -5)) && id.endsWith('-case');

  // 稳定 id 清单，供 Exploration.allowedIds 使用；改名或移除互动物不能让老存档失效。
  const historical = { opened: [], talked: [], switches: [...zones.map(caseId), FINALE.id], visited: [] };

  // 调查线挂在已有的 f1 npc / note 上，因此这里不产生新的室内物件。
  function objects() { return []; }
  const allObjects = () => [];
  function outdoor() {
    return [{
      id: FINALE.id, type: 'develop', name: '显影台 · 荷池底片', x: FINALE.x, z: FINALE.z,
      text: '步道尽头有一张石台，台面刻着浅槽。把底片放上去，槽里的水会把影像慢慢显出来。'
    }];
  }

  function caseSolved(s, zone) { return Exploration.ensure(s).switches.includes(caseId(zone)); }
  function flagSet(s, flag) { return s.flags.includes(flag); }
  function chainStep(zone, s) {
    return chain.find(step => step.zone === zone && caseSolved(s, step.zone) && !flagSet(s, step.flag) && (!step.requires || flagSet(s, step.requires)));
  }

  function quests(s) {
    const w = Exploration.ensure(s);
    const list = zones.map(zone => {
      const data = investigations[zone], solved = w.switches.includes(caseId(zone));
      return {
        id: zone + '-case', zone, title: data.title, description: data.intro,
        steps: [
          { text: '与当地人交谈', done: w.talked.includes(zone + '-f1-npc') },
          { text: '调查' + data.clue, done: w.talked.includes(zone + '-f1-note') },
          { text: '现场推理', done: solved }
        ],
        complete: solved, reward: `¥${data.cash} · ${data.xp} EXP`, objectiveId: zone + '-f1-npc'
      };
    });
    const remaining = chain.filter(step => !flagSet(s, step.flag));
    list.push({
      id: 'pond-negative', zone: 'museum', title: '荷池底片', description: '一条从南门旧书局开始、在沿河步道结束的线索。',
      steps: [
        ...chain.map(step => ({ text: step.title, done: flagSet(s, step.flag) })),
        { text: '在沿河步道显影', done: w.switches.includes(FINALE.id) }
      ],
      complete: w.switches.includes(FINALE.id),
      reward: '唯一装备 · 未显影底片', objectiveId: remaining.length ? chain.find(step => !flagSet(s, step.flag)).zone + '-f1-npc' : FINALE.id
    });
    return list;
  }

  // 返回 undefined 表示"不归我管"，由 Exploration.act 继续处理。
  function act(s, id, choice) {
    if (id === FINALE.id) return develop(s);
    if (isCase(id)) return { ok: true, text: investigations[id.slice(0, -5)].reply };

    const zone = id.split('-')[0];
    const data = investigations[zone];
    if (!data || !/^(.+)-f1-(npc|note)$/.test(id)) return undefined;
    const w = Exploration.ensure(s), isNpc = id.endsWith('-npc');

    // 线索便签：先记录，再回一句。
    if (!isNpc) {
      if (!w.talked.includes(id)) { w.talked.push(id); RPG.xp(s, 5); }
      return { ok: true, text: data.text };
    }

    // 与当地人交谈。
    if (!w.talked.includes(id)) { w.talked.push(id); RPG.xp(s, 5); }

    if (!caseSolved(s, zone)) {
      // 没有线索之前只给开场；拿到线索后才出题。
      if (!w.talked.includes(zone + '-f1-note')) return { ok: true, text: data.intro + '\n\n他提到了一份「' + data.clue + '」，就放在这一层。' };
      if (choice === undefined) return { ok: true, text: data.intro + '\n\n' + data.question, choices: data.choices.map((text, i) => ({ id: String(i), text })) };
      if (!/^\d+$/.test(choice) || !data.choices[Number(choice)]) return { ok: false, text: '无效的选项。', choices: data.choices.map((text, i) => ({ id: String(i), text })) };
      if (Number(choice) !== data.answer) return { ok: false, text: '对方摇了摇头：“不是这个。再看一遍记录。”', choices: data.choices.map((text, i) => ({ id: String(i), text })) };
      w.switches.push(caseId(zone));
      TS.effect(s, { cash: data.cash, reputation: 1 }); RPG.xp(s, data.xp);
      return { ok: true, reward: true, text: data.reply + '\n\n结案：¥' + data.cash + ' · ' + data.xp + ' EXP。' };
    }

    // 已结案：交出故事链的下一件物证，否则给结束语。
    const step = chainStep(zone, s);
    if (step) {
      TS.effect(s, { flags: [step.flag] });
      return { ok: true, reward: true, text: step.text + '\n\n获得「' + step.item + '」。' };
    }
    return { ok: true, text: data.reply + '\n\n这一条已经结案了。' };
  }

  function develop(s) {
    const w = Exploration.ensure(s);
    if (w.switches.includes(FINALE.id)) return { ok: true, text: '石台上的影像已经显完。槽里的水很浅，倒映着荷池。' };
    if (!flagSet(s, FINALE.needs)) {
      return { ok: true, text: '石台的凹槽是干的，还差显影要用的东西。\n\n先从南门旧书局那卷底片查起：和店主谈过、看过他的冲印袋，再回来找他。' };
    }
    w.switches.push(FINALE.id);
    const r = RPG.ensure(s);
    if (!r.owned.includes(FINALE.item)) r.owned.push(FINALE.item);
    TS.effect(s, { reputation: 10, cash: 400 });
    RPG.xp(s, 120);
    return {
      ok: true, reward: true,
      text: '水从槽口渗进来，影像一点点浮出来：荷池在东南，短桥通向一座两层小楼——正是今天校史馆的位置。\n\n照片右下角有一行铅笔字：「先照下来，再决定要不要建。」\n\n获得「未显影底片」、¥400、120 EXP 与 10 声望。'
    };
  }

  return { investigations, chain, finale: FINALE, zones, historical, objects, allObjects, outdoor, act, quests, caseId, isCase, caseSolved, flagSet };
})();
