'use strict';
globalThis.Exploration = (() => {
  const regions = {
    dorm: { name: '梧桐宿舍', color: '#73aaa0', rooms: ['203 · 陈旭与苏祁', '204 · 新生寝室', '一楼公共客厅', '自习与洗衣间'], style: 'dorm', npc: '苏祁', line: '你也觉得今天似曾相识？我把旧主机搬到公共客厅了。八处校史印章集齐后，去找学生会的档案员。' },
    hall: { name: '钟楼教学楼', color: '#bc7771', rooms: ['101 · 阶梯教室', '102 · 研讨教室', '顾清河的办公室', '校史展览室'], style: 'class', npc: '顾清河', line: '答案不只在课本里。实验楼断了电，配电箱在仪器室。你若能恢复电力，也许会看到一份不该存在的记录。' },
    library: { name: '静川图书馆', color: '#6d97b7', rooms: ['文学阅览室', '数字资料室', '林晚的阅读角', '旧报刊档案室'], style: 'library', npc: '林晚', line: '我在找一张没有署名的书签。镜湖边有一条石板小路，沿着花圃走，也许还找得到。数字资料室的终端能复原记忆。' },
    lake: { name: '镜湖船屋', color: '#66a9a5', rooms: ['船具收藏间', '水文观测室', '临湖茶室', '旧船坞仓库'], style: 'lake', npc: '守湖人', line: '绕远一点未必是浪费时间。桥外的草地里藏着旧东西，船屋的箱子则留给肯停下来的人。' },
    gym: { name: '风雨运动馆', color: '#b69762', rooms: ['体能训练室', '战术分析室', '队员更衣室', '器材保管间'], style: 'gym', npc: '校队队长', line: '护腕能帮你挡住下一击，跑鞋让出手的时机更从容。后街可以买到装备；练完后别忘了在成长面板穿上。' },
    lab: { name: '知行实验楼', color: '#798cca', rooms: ['嵌入式实验室', '量子计算机房', '仪器与配电室', '封存档案室'], style: 'lab', npc: '实验助教', line: '档案室的电子箱没电了。先去左侧仪器室合上配电开关，再试着打开它。你听，天枢的频率变了。' },
    gate: { name: '后街维修铺', color: '#be9970', rooms: ['零件回收工坊', '柜台与补给', '维修操作间', '旧物储藏室'], style: 'shop', npc: '维修铺老板', line: '废品里也能淘出宝。回收机抓到重物会收得更慢，别被废铁拖住。第一次达到 250 分，我会给你一份额外报酬。' },
    plaza: { name: '学生会馆', color: '#a582ae', rooms: ['校园广播站', '社团活动室', '学生会办公室', '校史资料库'], style: 'club', npc: '档案员许知', line: '我正在整理江大的记忆。宿舍、教学楼、图书馆、船屋、运动馆、实验楼、维修铺和这里，各有一枚校史印章。集齐八枚，我有一样东西交给你。' }
  };
  const objects = zone => {
    const r = regions[zone]; if (!r) return outdoor;
    return [
      { id: zone+'-exit', type: 'exit', name: '回到校园', x: 0, z: 12, zone },
      { id: zone+'-npc', type: 'npc', name: r.npc, x: -10, z: 5.5, zone, text: r.line },
      { id: zone+'-stamp', type: 'stamp', name: '校史印章 · '+r.name, x: -15, z: -5, zone },
      { id: zone+'-student', type: 'npc', name: zone==='hall'?'准备竞赛的学生':'校园志愿者', x: 4, z: 0, zone, text: '房间里留下的东西，往往比公告栏上的通知更有意思。收集到的印章和宝箱会永久记录，不必重复寻找。' },
      { id: zone+'-researcher', type: 'npc', name: zone==='hall'?'助教周然':'社团伙伴', x: 2, z: -5, zone, text: '听说后街的工具组不只方便维修，也能加强天枢的出手。小游戏首胜有额外奖励，别忘了去看看。' },
      { id: zone+'-chest', type: 'chest', name: '旧木箱', x: 12, z: 9, zone, cash: 70, xp: 20 },
      { id: zone+'-pc', type: 'pc', name: zone === 'gate' ? '零件回收机' : '校园网络终端', x: 12, z: -8, zone, game: zone === 'gate' ? 'salvage' : 'memory' },
      { id: zone+'-note', type: 'note', name: '留在桌上的便签', x: -5, z: -6, zone, text: r.line },
      ...(zone === 'lab' ? [
        { id: 'lab-switch', type: 'switch', name: '仪器室配电开关', x: -14, z: 10, zone },
        { id: 'lab-cache', type: 'chest', name: '封存的电子箱', x: 14, z: 5, zone, requires: 'lab-switch', cash: 240, xp: 55 }
      ] : []),
      ...(zone === 'plaza' ? [{ id: 'plaza-curator', type: 'quest', name: '交付校史印章', x: -5, z: 9, zone }] : [])
    ];
  };
  const outdoor = [
    { id: 'woodland-cache', type: 'chest', name: '台地上的旧旅行箱', x: -49, z: -26, cash: 180, xp: 35 },
    { id: 'woodland-herbs', type: 'chest', name: '林间补给匣', x: -52, z: 19, cash: 80, xp: 25 },
    { id: 'woodland-npc', type: 'npc', name: '摄影社学姐', x: -47, z: 1, text: '台阶上面是旧气象台的遗址。从林间小径往北走，会经过一片秋树。下面的岔路通向补给匣，别只沿着主路走。' },
    { id: 'garden-chest', type: 'chest', name: '花圃后的铁盒', x: -28, z: -3, cash: 90, xp: 25 },
    { id: 'bridge-chest', type: 'chest', name: '桥畔旧木箱', x: -15, z: 26, cash: 100, xp: 25 },
    { id: 'courtyard-chest', type: 'chest', name: '钟楼庭院藏匣', x: 8, z: -32, cash: 120, xp: 30 },
    { id: 'lab-garden-note', type: 'note', name: '石碑上的刻字', x: 18, z: 13, text: '“在错误发生之前，做出不同的选择。”落款的年份是 2038。' },
    { id: 'campus-npc', type: 'npc', name: '社团招新同学', x: -5, z: -5, text: '教学楼后有个安静的小庭院。里面那只铁盒，学长说只留给愿意绕路的人。' },
    { id: 'dorm-annex-door', type: 'door', name: '进入宿舍北楼', x: -25, z: -23.2, destination: 'dorm' },
    { id: 'dorm-west-door', type: 'door', name: '进入宿舍西楼', x: -36, z: -8.5, destination: 'dorm' },
    { id: 'gate-east-door', type: 'door', name: '进入维修铺东间', x: 34, z: 24.4, destination: 'gate' }
  ];
  const all = () => [...outdoor, ...Object.keys(regions).flatMap(objects)];
  const fresh = () => ({ opened: [], stamps: [], talked: [], switches: [], visited: [], claimed: false });
  function ensure(s) { return RPG.ensure(s).world ||= fresh(); }
  function validate(w) {
    if (!w) return fresh();
    const ids = type => all().filter(o=>type.includes(o.type)).map(o=>o.id);
    for (const [key, allowed] of Object.entries({ opened: ids(['chest']), stamps: Object.keys(regions), talked: ids(['npc','note']), switches: ['lab-switch'], visited: Object.keys(regions) })) {
      if (!Array.isArray(w[key]) || new Set(w[key]).size !== w[key].length || w[key].some(id=>!allowed.includes(id))) return null;
    }
    return typeof w.claimed === 'boolean' ? w : null;
  }
  function act(s, id) {
    const o = all().find(o=>o.id===id), w = ensure(s);
    if (!o || s.active) return { ok:false, text:'现在无法调查。' };
    if (o.type === 'chest') {
      if (w.opened.includes(id)) return { ok:false, text:'箱子已经空了，收获已放进行囊。' };
      if (o.requires && !w.switches.includes(o.requires)) return { ok:false, text:'电子锁没有供电。仪器室的配电开关或许能让它重新工作。' };
      w.opened.push(id); TS.effect(s,{cash:o.cash}); RPG.xp(s,o.xp);
      if (RPG.ensure(s).bag.coffee < 9) RPG.ensure(s).bag.coffee++;
      return { ok:true, reward:true, text:`获得 ¥${o.cash}、${o.xp} EXP，以及冰咖啡一杯（行囊上限 9）。` };
    }
    if (o.type === 'stamp') {
      if (w.stamps.includes(o.zone)) return { ok:false, text:`这枚印章已经收集。校史印章 ${w.stamps.length} / 8。` };
      w.stamps.push(o.zone); RPG.xp(s,15); return { ok:true, reward:true, text:`印章盖在了你的校园手册上。校史印章 ${w.stamps.length} / 8，+15 EXP。` };
    }
    if (o.type === 'switch') {
      if (w.switches.includes(id)) return { ok:false, text:'电力稳定，封存档案室的电子箱已解锁。' };
      w.switches.push(id); return { ok:true, text:'灯光依次亮起。封存档案室传来电子锁重新通电的声音。' };
    }
    if (o.type === 'quest') {
      if (w.claimed) return { ok:true, reward:false, text:'这枚吊坠是你的了。谢谢你替江大找回这八段记忆。' };
      if (w.stamps.length < 8) return { ok:true, reward:false, text:`已经收集 ${w.stamps.length} / 8 枚印章。每栋建筑的左上房间都有一枚，房间内的小地图可以帮助你找路。` };
      w.claimed = true; const r=RPG.ensure(s); if (!r.owned.includes('pendant')) r.owned.push('pendant'); RPG.xp(s,100); TS.effect(s,{reputation:8,cash:300});
      return { ok:true, reward:true, text:'校史寻踪完成！获得专注吊坠、¥300、100 EXP 和 8 声望。吊坠已放入成长面板的装备栏。' };
    }
    if (o.type === 'npc' || o.type === 'note') { if (!w.talked.includes(id)) { w.talked.push(id); RPG.xp(s,5); } return { ok:true, text:o.text }; }
    return { ok:true, game:o.game, destination:o.destination, exit:o.type==='exit', text:'终端已就绪。' };
  }
  return { regions, objects, outdoor, all, fresh, ensure, validate, act };
})();
