const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

// 按依赖顺序加载真实模块，而不是打桩 —— 成就全靠既有状态推导，
// 用假状态测不出「推导源选错了」这类错误。
function boot(){
  const c=vm.createContext({console,structuredClone,setTimeout,clearTimeout,Math,Date,JSON});
  c.globalThis=c;
  c.document={createElement:()=>({getContext:()=>null,style:{}}),querySelector:()=>null,querySelectorAll:()=>[]};
  c.window=c;
  for(const f of ['content.js','state.js','rpg.js','exploration.js','offcampus.js','achievements.js']){
    vm.runInContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),c,{filename:f});
  }
  return c;
}

test('里程碑全部从既有状态推导，不新增存档字段',()=>{
  const c=boot();
  const s=c.TS.fresh();
  const list=c.Achievements.list(s);
  assert.equal(list.length,c.Achievements.count);
  assert.ok(list.length>=15,'成就数量应当足够覆盖现有内容');
  assert.ok(list.every(a=>a.id&&a.group&&a.name&&a.desc),'每枚都要有 id / 分组 / 名称 / 说明');
  assert.equal(new Set(list.map(a=>a.id)).size,list.length,'id 不能重复');
  assert.deepEqual([...new Set(list.map(a=>a.group))].sort(),['剧情','探索','玩法','成长'].sort());
  const fresh=c.Achievements.summary(s);
  assert.equal(fresh.got,0,'全新存档不该已经有成就');
  // 存档校验必须原样通过：成就没有引入任何新字段。
  assert.ok(c.TS.restore(JSON.stringify(s)),'带成就标记的存档仍应通过校验');
});

test('里程碑随真实进度点亮',()=>{
  const c=boot();
  const at=fn=>{const s=c.TS.fresh();fn(s,c);return c.Achievements.earned(s);};

  assert.ok(at(s=>s.done.push('intro')).includes('reboot'));
  assert.ok(!at(()=>{}).includes('reboot'),'没走序章就不该点亮');
  assert.ok(at(s=>{s.done.push('intro','math','gym')}).includes('fate-3'));
  assert.ok(at(s=>{s.ending='evidence'}).includes('chapter-one'));

  // 探索：八枚印章
  assert.ok(at(s=>{c.Exploration.ensure(s).stamps.push(...['dorm','hall','library','lake','gym','lab','gate','plaza'])}).includes('stamps-8'));
  assert.ok(!at(s=>{c.Exploration.ensure(s).stamps.push('dorm','hall')}).includes('stamps-8'),'两枚印章不算集齐');

  // 探索：校外七案要全部结案
  const zones=[...c.OffCampus.zones];
  assert.ok(at(s=>{for(const z of zones)c.Exploration.ensure(s).switches.push(c.OffCampus.caseId(z))}).includes('cases-7'));
  assert.ok(!at(s=>{for(const z of zones.slice(0,-1))c.Exploration.ensure(s).switches.push(c.OffCampus.caseId(z))}).includes('cases-7'),'差一案不算');

  // 玩法
  assert.ok(at(s=>{s.flags.push('mahjong-win')}).includes('mahjong'));
  assert.ok(at(s=>{c.RPG.ensure(s).records.bargain={best:300,attempts:1,won:true}}).includes('bargain'));
  assert.ok(at(s=>{c.RPG.ensure(s).records.supply={best:200,attempts:1,won:true}}).includes('supply'));
  // 六类挑战：答题/时机/线路/对决 记在 results，回收/记忆 记在 records —— 两种来源都要认。
  assert.ok(at(s=>{c.RPG.ensure(s).records.salvage={best:1,attempts:1,won:true};c.RPG.ensure(s).records.memory={best:1,attempts:1,won:true},s.results.math='success',s.results.gym='success',s.results.lab='success',s.results.duel='success'}).includes('all-kinds'));
  assert.ok(!at(s=>{s.results.math='success',s.results.gym='success',s.results.lab='success',s.results.duel='success'}).includes('all-kinds'),'六类只赢了四类不算全能');

  // 成长
  assert.ok(at(s=>{s.stats.cash=5000}).includes('cash'));
  assert.ok(!at(s=>{s.stats.cash=4999}).includes('cash'),'差一元不算');
  assert.ok(at(s=>{s.bonds.lw=60}).includes('bond'));
  assert.ok(at(s=>{const r=c.RPG.ensure(s);r.equipped.hand='gloves';r.equipped.outfit='coat';r.equipped.accessory='negative'}).includes('equip'));
  assert.ok(at(s=>{s.stats.reputation=30}).includes('rep'));
});

test('提示只弹一次，且不会在老存档上连弹一串',()=>{
  const c=boot();
  const s=c.TS.fresh();
  s.stats.cash=5000;s.flags.push('mahjong-win');
  // 老存档首次启用：静默认领，不弹提示
  assert.equal(c.Achievements.adopt(s),true,'首次应当做一次初始化');
  assert.deepEqual([...c.Achievements.sync(s)],['-'].slice(0,0),'初始化后不该再有新提示');
  assert.equal(c.Achievements.adopt(s),false,'第二次不再初始化');
  assert.ok(c.Achievements.earned(s).includes('cash'),'静默认领不影响「已获得」的判定');

  // 初始化之后新达成 → 应当弹且只弹一次
  s.bonds.lw=60;
  assert.deepEqual([...c.Achievements.sync(s)],['bond'],'新达成的应当被报出来');
  assert.deepEqual([...c.Achievements.sync(s)],[],'同一枚不重复报');
  const after=c.Achievements.summary(s);
  assert.ok(after.got>=2&&after.total===c.Achievements.count);

  // 记账用的 flag 不能撑爆存档校验的长度上限
  assert.ok(s.flags.every(f=>typeof f==='string'&&f.length<=40),'flag 必须在 40 字以内');
  assert.ok(c.TS.restore(JSON.stringify(s)),'记账后存档仍然合法');
});

test('缺少可选模块时不会抛错',()=>{
  const c=boot();
  const s=c.TS.fresh();
  delete c.OffCampus;
  assert.doesNotThrow(()=>c.Achievements.list(s),'校外内容层缺席时仍可枚举');
  assert.ok(!c.Achievements.earned(s).includes('cases-7'),'缺席时该成就保持未点亮，而不是报错');
});
