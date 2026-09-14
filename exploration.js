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
  const investigations = {
    dorm:{title:'没有寄出的录音',description:'苏祁借来的录音机里，藏着昨天尚未发生的对话。',clue:'203 借物单',text:'借物单：录音机放进蓝柜，钥匙交给穿运动外套的新生。红柜是空的，灰柜属于宿管。柜门上的标签不是日期，是颜色。',question:'三只储物柜，哪一只存放着录音机？',choices:['蓝色储物柜','红色储物柜','灰色储物柜'],answer:'0',reply:'蓝柜里是一卷倒带过的磁带。录音中的苏祁说：“明天，别去钟楼。”',cash:110,xp:30},
    hall:{title:'黑板上的第四项',description:'顾清河留下了一道只属于这一次时间线的题。',clue:'讲义边角',text:'讲义写着：2，6，12，20。相邻项的差依次是 4、6、8；下一次继续增加 2。顾老师把最后一项擦掉了。',question:'在黑板的空格里填入下一项。',choices:['28','30','32'],answer:'1',reply:'你写下 30。投影仪短暂闪出一串坐标，顾清河的名字旁多了一条删除记录。',cash:140,xp:40},
    library:{title:'缺页目录',description:'林晚发现了一本被错误归档的旧校刊。',clue:'旧校刊索引',text:'索引备注：书架从左到右按出版时间排列。创刊于 1998，停刊于 2008，复刊于 2018。缺页夹在停刊号中。',question:'检索哪一期，才能找到缺页？',choices:['2018 复刊号','1998 创刊号','2008 停刊号'],answer:'2',reply:'停刊号中夹着一页实验楼停电记录。签名的笔迹和林晚书签上的字一模一样。',cash:120,xp:35},
    lake:{title:'逆流的水位',description:'守湖人想查清观测仪为何每天同一时刻报警。',clue:'水文值班日志',text:'手写日志：上游来水时先打开旁通，再读取水位，最后关闭检修闸。不要先关检修闸，否则压力会倒灌。',question:'选择正确的检修顺序。',choices:['关闸 → 旁通 → 读数','旁通 → 读数 → 关闸','读数 → 关闸 → 旁通'],answer:'1',reply:'水位回落。观测仪吐出一张潮线图，最高点恰好指向旧实验楼的地下管道。',cash:130,xp:35},
    gym:{title:'最后三秒',description:'队长需要一位能读懂场上空位的人。',clue:'对手防守记录',text:'战术记录：对方中锋守篮下，后卫在左翼夹击。右侧底角无人盯防，时间只够一次传球与投篮。',question:'最后三秒，你把球传向哪里？',choices:['左翼强攻','直接突破篮下','右侧底角'],answer:'2',reply:'底角投篮命中。队长把你写进替补名单，还提到了一个总在夜里独自训练的人。',cash:110,xp:40},
    lab:{title:'零号实验日志',description:'恢复供电，核对校验位，再取出被封存的实验日志。',clue:'机房校验便笺',text:'校验说明：三个状态灯从左到右是“开、关、开”。开记为 1，关记为 0。配电开关仍需在仪器室手动合上。',question:'向离线终端输入三位校验码。',choices:['101','110','011'],answer:'0',reply:'校验通过。终端确认电子箱中确有零号日志；恢复仪器室供电后才能取出。',cash:180,xp:45},
    gate:{title:'旧收音机的新声音',description:'维修铺老板把一台停在同一频率的收音机交给你。',clue:'维修台电路草图',text:'电路草图：电源正极先经保险丝，再接调谐板，最后接扬声器。烧坏的保险丝必须先更换，不能用导线短接。',question:'修理的第一步应该是什么？',choices:['短接保险丝','更换保险丝','直接换扬声器'],answer:'1',reply:'新保险丝接通了电路。收音机里传出学生会广播的试音声，日期却是明天。',cash:160,xp:40},
    plaza:{title:'明日的播报',description:'广播站收到一份提前一天的播报清单。',clue:'广播值班表',text:'值班表：A 频道播音乐，B 频道是试音线路，C 频道保留给紧急播报。异常声音来自试音，而不是正式节目。',question:'将监听线路切换到哪个频道？',choices:['A 音乐','B 试音','C 紧急播报'],answer:'1',reply:'试音线路里传来你的名字。许知把这段声音封存，交给你一份完整的校园异常记录。',cash:150,xp:40}
  };
  const objects = zone => {
    const r = regions[zone]; if (!r) return outdoor;
    const positions=globalThis.Interiors?.positions(zone),quest=investigations[zone];
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
      ...(zone === 'plaza' ? [{ id: 'plaza-curator', type: 'quest', name: '交付校史印章', x: -8, z: 11, zone }] : []),
      {id:zone+'-puzzle',type:'puzzle',name:quest.title,x:8,z:3,zone,text:quest.question,choices:quest.choices.map((text,i)=>({id:String(i),text})),answer:quest.answer,requires:zone+'-note'},
      {id:zone+'-task',type:'quest',questId:zone,name:'交付 · '+quest.title,x:8,z:10,zone}
    ].map(o=>{
      if(positions?.[o.id])[o.x,o.z]=positions[o.id];
      if(o.id===zone+'-note'){o.name=quest.clue;o.text=quest.text;}
      if(o.type==='npc')o.character=globalThis.Interiors?.layout(zone).characters[['npc','student','researcher'].indexOf(o.id.slice(zone.length+1))]||'studentA';
      if(o.id===zone+'-npc')o.text+='\n\n'+quest.description;
      return o;
    });
  };
  const outdoor = [
    { id: 'woodland-cache', type: 'chest', name: '台地上的旧旅行箱', x: -49, z: -26, cash: 180, xp: 35 },
    { id: 'woodland-herbs', type: 'chest', name: '林间补给匣', x: -52, z: 19, cash: 80, xp: 25 },
    { id: 'woodland-npc', type: 'npc', name: '摄影社学姐', x: -47, z: 1, character: 'photographer', zone: 'lake', text: '台阶上面是旧气象台的遗址。从林间小径往北走，会经过一片秋树。下面的岔路通向补给匣，别只沿着主路走。' },
    { id: 'garden-chest', type: 'chest', name: '花圃后的铁盒', x: -28, z: -3, cash: 90, xp: 25 },
    { id: 'bridge-chest', type: 'chest', name: '桥畔旧木箱', x: -15, z: 26, cash: 100, xp: 25 },
    { id: 'courtyard-chest', type: 'chest', name: '钟楼庭院藏匣', x: 8, z: -32, cash: 120, xp: 30 },
    { id: 'lab-garden-note', type: 'note', name: '石碑上的刻字', x: 18, z: 13, text: '“在错误发生之前，做出不同的选择。”落款的年份是 2038。' },
    { id: 'campus-npc', type: 'npc', name: '社团招新同学', x: -5, z: -5, character: 'studentB', zone: 'plaza', text: '教学楼后有个安静的小庭院。里面那只铁盒，学长说只留给愿意绕路的人。' },
    { id: 'dorm-annex-door', type: 'door', name: '进入宿舍北楼', x: -25, z: -23.2, destination: 'dorm' },
    { id: 'dorm-west-door', type: 'door', name: '进入宿舍西楼', x: -36, z: -8.5, destination: 'dorm' },
    { id: 'gate-east-door', type: 'door', name: '进入维修铺东间', x: 34, z: 24.4, destination: 'gate' }
  ];
  const all = () => [...outdoor, ...Object.keys(regions).flatMap(objects),...(globalThis.CampusRooms?.allObjects()||[])];
  const fresh = () => ({ opened: [], stamps: [], talked: [], switches: [], visited: [], claimed: false });
  function ensure(s) { return RPG.ensure(s).world ||= fresh(); }
  // Frozen snapshot of every interaction id that has ever been legal, grouped by the
  // save field it lands in. validate() checks against the union of this snapshot and
  // whatever objects() currently produces, so renaming or retiring an object cannot
  // present itself to the player as "corrupt save" — the old id stays acceptable.
  //
  // RULE: add ids here when you add them to objects(); never delete one. If
  // tests/interiors.test.cjs or the snapshot test fails, it means a new object id is
  // missing from this list.
  const HISTORICAL_IDS = {
    opened: [
      'bridge-chest', 'courtyard-chest', 'dorm-chest', 'dorm-task', 'garden-chest', 'gate-chest',
      'gate-task', 'gym-chest', 'gym-task', 'hall-chest', 'hall-task', 'lab-cache', 'lab-chest',
      'lab-task', 'lake-chest', 'lake-task', 'library-chest', 'library-task', 'plaza-chest',
      'plaza-task', 'woodland-cache', 'woodland-herbs'
    ],
    stamps: [
      'dorm', 'gate', 'gym', 'hall', 'lab', 'lake', 'library', 'plaza'
    ],
    talked: [
      'campus-npc', 'dorm-note', 'dorm-npc', 'dorm-researcher', 'dorm-student', 'gate-note',
      'gate-npc', 'gate-researcher', 'gate-student', 'gym-note', 'gym-npc', 'gym-researcher',
      'gym-student', 'hall-note', 'hall-npc', 'hall-researcher', 'hall-student',
      'lab-garden-note', 'lab-note', 'lab-npc', 'lab-researcher', 'lab-student', 'lake-note',
      'lake-npc', 'lake-researcher', 'lake-student', 'library-note', 'library-npc',
      'library-researcher', 'library-student', 'plaza-note', 'plaza-npc', 'plaza-researcher',
      'plaza-student', 'woodland-npc'
    ],
    switches: [
      'dorm-puzzle', 'gate-puzzle', 'gym-puzzle', 'hall-puzzle', 'lab-puzzle', 'lab-switch',
      'lake-puzzle', 'library-puzzle', 'plaza-puzzle'
    ],
    visited: [
      'dorm', 'gate', 'gym', 'hall', 'lab', 'lake', 'library', 'plaza'
    ],
  };
  function allowedIds(key) {
    const objects = all(), zones = Object.keys(regions), ids = type => objects.filter(o => type.includes(o.type)).map(o => o.id);
    const current = key === 'opened' ? [...ids(['chest']), ...zones.map(z => z + '-task')]
      : key === 'stamps' || key === 'visited' ? zones
        : key === 'talked' ? ids(['npc', 'note'])
          : key === 'switches' ? ids(['switch', 'puzzle'])
            : [];
    return new Set([...HISTORICAL_IDS[key],...(globalThis.CampusRooms?.historical[key]||[]), ...current]);
  }
  function validate(w) {
    if (!w) return fresh();
    for (const key of ['opened', 'stamps', 'talked', 'switches', 'visited']) {
      const allowed = allowedIds(key);
      if (!Array.isArray(w[key]) || new Set(w[key]).size !== w[key].length || w[key].some(id => !allowed.has(id))) return null;
    }
    return typeof w.claimed === 'boolean' ? w : null;
  }
  function quests(s){
    const w=ensure(s);
    return Object.entries(investigations).map(([zone,q])=>{
      const steps=[{text:'与'+regions[zone].npc+'交谈',done:w.talked.includes(zone+'-npc')},{text:'调查'+q.clue,done:w.talked.includes(zone+'-note')},{text:'解决现场问题',done:w.switches.includes(zone+'-puzzle')}];
      if(zone==='lab')steps.push({text:'恢复供电并取出封存日志',done:w.opened.includes('lab-cache')});
      steps.push({text:'交付调查结果',done:w.opened.includes(zone+'-task')});
      return {id:zone+'-investigation',title:q.title,zone,description:q.description,steps,complete:w.opened.includes(zone+'-task'),reward:`¥${q.cash} · ${q.xp} EXP · 学习笔记 ×1`,objectiveId:zone+'-task'};
    });
  }
  function evidence(s){const w=ensure(s);return [...Object.entries(investigations).filter(([zone])=>w.talked.includes(zone+'-note')).map(([zone,q])=>({id:zone+'-note',name:q.clue,desc:q.text,icon:'file-search'})),...(globalThis.CampusRooms?.allObjects()||[]).filter(o=>o.type==='note'&&w.talked.includes(o.id)).map(o=>({id:o.id,name:o.name,desc:o.text,icon:'file-search'}))];}
  function act(s, id, choice) {
    const o = all().find(o=>o.id===id), w = ensure(s);
    if (!o || s.active) return { ok:false, text:'现在无法调查。' };
    if(o.type==='puzzle'){
      if(w.switches.includes(id))return {ok:true,text:investigations[o.zone].reply};
      if(!w.talked.includes(o.requires))return {ok:false,text:'这里缺少关键线索。先调查本区域的“'+investigations[o.zone].clue+'”。'};
      if(choice===undefined)return {ok:true,text:o.text,choices:o.choices};
      if(!o.choices.some(c=>c.id===choice))return {ok:false,text:'无效的选项。',choices:o.choices};
      if(choice!==o.answer)return {ok:false,text:'这与现场记录对不上。\n\n'+o.text,choices:o.choices};
      w.switches.push(id);return {ok:true,text:investigations[o.zone].reply};
    }
    if(o.questId){
      const q=quests(s).find(q=>q.zone===o.zone),data=investigations[o.zone];
      if(q.complete)return {ok:true,reward:false,text:'这份调查已经归档。报酬已放进行囊。'};
      const pending=q.steps.slice(0,-1).filter(step=>!step.done);
      if(pending.length)return {ok:true,reward:false,text:data.description+'\n\n尚待完成：'+pending.map(step=>step.text).join('；')+'。'};
      w.opened.push(id);TS.effect(s,{cash:data.cash,reputation:1});RPG.xp(s,data.xp);const bag=RPG.ensure(s).bag;bag.notes=Math.min(9,bag.notes+1);
      return {ok:true,reward:true,text:data.reply+'\n\n调查完成：'+q.reward+'（笔记最多携带 9 份）。'};
    }
    if (o.type === 'chest') {
      if (w.opened.includes(id)) return { ok:false, text:'箱子已经空了，收获已放进行囊。' };
      if (o.requires && !w.switches.includes(o.requires)) return { ok:false, text:'电子锁没有供电。仪器室的配电开关或许能让它重新工作。' };
      w.opened.push(id); TS.effect(s,{cash:o.cash}); RPG.xp(s,o.xp);
      const bag=RPG.ensure(s).bag, drink=bag.coffee<9; if(drink)bag.coffee++;
      return { ok:true, reward:true, text:`获得 ¥${o.cash}、${o.xp} EXP${drink?'，以及冰咖啡一杯（行囊上限 9）':'。行囊里的冰咖啡已经满了（9 杯），这一杯留在了箱子里'}` };
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
      if (w.stamps.length < 8) return { ok:true, reward:false, text:`已经收集 ${w.stamps.length} / 8 枚印章。印章分别陈列在八栋建筑的不同区域，可以在室内小地图中寻找。` };
      w.claimed = true; const r=RPG.ensure(s); if (!r.owned.includes('pendant')) r.owned.push('pendant'); RPG.xp(s,100); TS.effect(s,{reputation:8,cash:300});
      return { ok:true, reward:true, text:'校史寻踪完成！获得专注吊坠、¥300、100 EXP 和 8 声望。吊坠已放入成长面板的装备栏。' };
    }
    if (o.type === 'npc' || o.type === 'note') { if (!w.talked.includes(id)) { w.talked.push(id); RPG.xp(s,5); } return { ok:true, text:o.text }; }
    return { ok:true, game:o.game, destination:o.destination, exit:o.type==='exit', text:'终端已就绪。' };
  }
  return { regions, objects, outdoor, all, fresh, ensure, validate, act, quests, evidence, historicalIds: HISTORICAL_IDS, allowedIds };
})();
