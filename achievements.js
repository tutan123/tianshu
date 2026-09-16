'use strict';
/*
 * 里程碑。
 *
 * 借鉴自同事《重生2-原型 v1.6》的成就层，但换了一种实现思路：那边为每枚成就单独记账，
 * 这里**全部从既有状态推导**，不新增任何存档字段。好处是存档格式、校验链、以及
 * tests 里的存档往返断言都不必改动，而成就永远不会和真实进度不一致。
 *
 * 「已获得」的记账只用于弹一次提示：命中时写入 `ach-<id>` 这个 flag。flags 在存档校验里
 * 只要求「是字符串且不超过 40 字」，没有白名单，所以这条路不需要动 rpg.js 或 state.js。
 */
globalThis.Achievements = (() => {
  const rpg = s => globalThis.RPG.ensure(s);
  const world = s => globalThis.Exploration.ensure(s);
  const mainDone = s => globalThis.CONTENT.main.filter(id => s.done.includes(id)).length;
  const kindWon = (s, kind) => Object.entries(globalThis.CONTENT.nodes)
    .some(([id, n]) => n.kind === kind && (s.results[id] === 'success' || rpg(s).records[id]?.won));
  const OFF_CAMPUS_ZONES = () => globalThis.OffCampus?.zones || [];

  const LIST = [
    // ── 剧情 ──
    { id: 'reboot', group: '剧情', name: '重启人生', desc: '走完序章，把这一天重新过一遍。', test: s => s.done.includes('intro') },
    { id: 'fate-3', group: '剧情', name: '命运节点', desc: '完成三个主线节点。', test: s => mainDone(s) >= 3 },
    { id: 'chapter-one', group: '剧情', name: '第一章完结', desc: '抵达这一章的终点。', test: s => !!s.ending },
    // ── 探索 ──
    { id: 'stamps-8', group: '探索', name: '八印归位', desc: '集齐校园里的八枚校史印章。', test: s => world(s).stamps.length >= 8 },
    { id: 'cases-7', group: '探索', name: '校外七案', desc: '把七栋校外建筑的调查线全部结案。', test: s => OFF_CAMPUS_ZONES().length > 0 && OFF_CAMPUS_ZONES().every(z => globalThis.OffCampus.caseSolved(s, z)) },
    { id: 'negative', group: '探索', name: '荷池底片', desc: '带三件物证走到河边的显影台。', test: s => world(s).opened.includes('pond-develop') },
    { id: 'chests', group: '探索', name: '翻遍角落', desc: '打开六个储物箱。', test: s => world(s).opened.filter(id => id.endsWith('-chest')).length >= 6 },
    // ── 玩法 ──
    { id: 'first-win', group: '玩法', name: '初尝胜果', desc: '在任意一场挑战里取胜。', test: s => Object.values(rpg(s).records).some(r => r.won) || Object.values(s.results).includes('success') },
    { id: 'mahjong', group: '玩法', name: '牌桌老千', desc: '在游戏厅的麻将机上胡一次牌。', test: s => s.flags.includes('mahjong-win') },
    { id: 'bargain', group: '玩法', name: '谈判高手', desc: '把旧书局的收购价谈下来。', test: s => !!rpg(s).records.bargain?.won },
    { id: 'supply', group: '玩法', name: '经营有方', desc: '让便利店六天经营收在正数。', test: s => !!rpg(s).records.supply?.won },
    { id: 'all-kinds', group: '玩法', name: '全能宿主', desc: '六类挑战各赢下一次。', test: s => ['quiz', 'qte', 'circuit', 'combat', 'salvage', 'memory'].every(k => kindWon(s, k)) },
    // ── 成长 ──
    { id: 'cash', group: '成长', name: '富甲一方', desc: '财富累积到 ¥5000。', test: s => s.stats.cash >= 5000 },
    { id: 'bond', group: '成长', name: '知己', desc: '与一个人走到羁绊 60。', test: s => Object.values(s.bonds).some(v => v >= 60) },
    { id: 'equip', group: '成长', name: '全副武装', desc: '三个装备槽都装上东西。', test: s => ['hand', 'outfit', 'accessory'].every(slot => !!rpg(s).equipped[slot]) },
    { id: 'rep', group: '成长', name: '声名鹊起', desc: '声望达到 30。', test: s => s.stats.reputation >= 30 }
  ];

  const byId = id => LIST.find(a => a.id === id);
  const seenFlag = id => 'ach-' + id;
  const list = s => LIST.map(a => ({ id: a.id, group: a.group, name: a.name, desc: a.desc, got: !!a.test(s) }));
  const earned = s => LIST.filter(a => a.test(s)).map(a => a.id);
  const summary = s => ({ got: earned(s).length, total: LIST.length });

  /** 本局新拿到的成就，并记账（用于弹提示）。 */
  function sync(s) {
    const have = new Set(s.flags);
    const fresh = LIST.filter(a => a.test(s) && !have.has(seenFlag(a.id))).map(a => a.id);
    if (fresh.length) s.flags = [...new Set([...s.flags, ...fresh.map(seenFlag)])];
    return fresh;
  }
  /**
   * 首次启用时把「此刻已经满足」的成就静默记为已见。
   * 否则老存档一进游戏就会连弹十几条提示。返回是否做过这次初始化。
   */
  function adopt(s) {
    if (s.flags.includes('ach-init')) return false;
    s.flags = [...new Set([...s.flags, 'ach-init', ...earned(s).map(seenFlag)])];
    return true;
  }

  return { list, earned, summary, sync, adopt, byId, count: LIST.length };
})();
