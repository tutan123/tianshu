const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
function load(){
  const c=vm.createContext({console,structuredClone});
  for(const f of ['content.js','state.js','rpg.js','campus-rooms.js','exploration.js','commerce.js']){
    const file=path.join(__dirname,'..',f);if(fs.existsSync(file))vm.runInContext(fs.readFileSync(file,'utf8'),c);
  }
  assert.ok(c.Commerce,'Commerce rules are available');return c;
}
test('negotiation spends AP, rejects unavailable cards and completes with a viable contract',()=>{
  const {Commerce:C,TS}=load(),g=C.create('bargain',TS.fresh());
  assert.ok(C.act(g,'clue'));assert.equal(g.price,275);assert.equal(g.ap,1);
  const before=JSON.stringify(g);assert.equal(C.act(g,'press'),false);assert.equal(JSON.stringify(g),before);
  C.act(g,'rapport');assert.equal(g.turn,2);assert.equal(g.ap,3);
  for(let i=0;i<3&&!g.result;i++){C.act(g,'press');if(!g.result)C.act(g,'rapport');}
  assert.equal(g.result,'success');assert.ok(g.score>0);
  const terminal=JSON.stringify(g);assert.equal(C.act(g,'press'),false);assert.equal(JSON.stringify(g),terminal);
});
test('negotiation clues and bonds improve the opening, while passing cannot stall forever',()=>{
  const {Commerce:C,TS,Exploration}=load(),s=TS.fresh(),base=C.create('bargain',s);
  s.bonds.lw=20;Exploration.ensure(s).talked.push('bookshop-f1-note');
  const improved=C.create('bargain',s);assert.equal(improved.trust,base.trust+2);assert.equal(improved.clues,base.clues+1);
  for(let i=0;i<7;i++)C.act(base,'pass');assert.equal(base.result,'fail');
});
test('retail purchase and pricing affect real sales, spoilage and the six-round ledger',()=>{
  const {Commerce:C,TS}=load(),s=TS.fresh(),g=C.create('supply',s),cash=s.stats.cash;
  C.act(g,'order',{item:0,quantity:10});C.act(g,'price',{item:0,level:1});
  assert.ok(C.act(g,'trade'));assert.equal(g.cash,340);assert.equal(g.history[0].sold[0],10);assert.equal(g.day,1);
  assert.equal(g.stock[0],0);assert.equal(s.stats.cash,cash,'shop trial never spends the player wallet');
  C.act(g,'order',{item:0,quantity:20});C.act(g,'price',{item:0,level:2});C.act(g,'trade');
  assert.equal(g.history[1].sold[0],10);assert.equal(g.history[1].waste,10);
  for(let i=0;i<4;i++)C.act(g,'trade');assert.equal(g.day,6);assert.equal(g.history.length,6);assert.ok(g.result);
  assert.equal(C.act(g,'trade'),false);
});
test('retail rejects overdrafts and invalid quantities without mutations; supplier win reduces cost',()=>{
  const {Commerce:C,TS,RPG}=load(),s=TS.fresh(),g=C.create('supply',s);
  for(const quantity of [-1,21,1.5,NaN]){const before=JSON.stringify(g);assert.equal(C.act(g,'order',{item:0,quantity}),false);assert.equal(JSON.stringify(g),before);}
  C.act(g,'order',{item:0,quantity:20});C.act(g,'order',{item:1,quantity:20});
  const before=JSON.stringify(g);assert.equal(C.act(g,'trade'),false);assert.equal(JSON.stringify(g),before);
  RPG.ensure(s).records.bargain={best:300,attempts:1,won:true};
  const deal=C.create('supply',s);C.act(deal,'order',{item:0,quantity:10});C.act(deal,'trade');assert.equal(deal.cash,350);
});
test('new activities resume pending orders and completed ledgers, rejecting corrupted save fields',()=>{
  const {Commerce:C,TS,RPG}=load(),s=TS.fresh();TS.complete(s,'intro');RPG.ensure(s);
  for(const kind of ['bargain','supply']){
    s.active={id:kind,phase:'inter',shot:0,game:C.create(kind,s)};
    assert.ok(TS.restore(JSON.stringify(s)),kind+' restores');
    if(kind==='supply'){C.act(s.active.game,'order',{item:1,quantity:5});C.act(s.active.game,'trade');}
    const saved=JSON.stringify(s);assert.equal(JSON.stringify(TS.restore(saved).active.game),JSON.stringify(s.active.game));
    for(const field of ['score','turn','cash','result','history']){
      const bad=JSON.parse(saved);bad.active.game[field]=field==='result'?'win':field==='history'?[null]:-99;
      if(field in s.active.game)assert.equal(TS.restore(JSON.stringify(bad)),null,kind+' rejects '+field);
    }
    C.act(s.active.game,'quit');assert.ok(TS.restore(JSON.stringify(s)),'unclaimed result resumes');
  }
  assert.ok(TS.restore(JSON.stringify(TS.fresh())),'old saves remain loadable');
});
test('repeatable first wins grant a backpack item only once and retain both records on restore',()=>{
  const {TS,RPG}=load(),s=TS.fresh();TS.complete(s,'intro');const r=RPG.ensure(s),cash=s.stats.cash;
  for(const id of ['bargain','supply']){
    assert.ok(TS.available(s).includes(id));s.active={id,phase:'inter',shot:0,game:{score:250}};
    TS.complete(s,id,'success');TS.complete(s,id,'success');
  }
  assert.equal(s.stats.cash,cash+360);assert.equal(r.xp,145);assert.equal(r.bag.notes,1);assert.equal(r.bag.coffee,1);
  s.active=null;assert.ok(TS.restore(JSON.stringify(s)));
  r.bag.coffee=9;delete r.records.supply;RPG.reward(s,'supply',300,true);
  assert.equal(r.bag.coffee,9);assert.equal(s.stats.cash,cash+630,'full bag converts the coffee to its shop value');
});
test('planning with campus demand reaches profit target, while an empty store fails',()=>{
  const {Commerce:C,TS}=load(),g=C.create('supply',TS.fresh()),empty=C.create('supply',TS.fresh());
  for(const [a,b] of [[14,8],[16,3],[8,17],[3,4],[20,3],[13,13]]){
    C.act(g,'order',{item:0,quantity:a});C.act(g,'order',{item:1,quantity:b});
    assert.ok(C.act(g,'trade'));assert.ok(C.valid(g));C.act(empty,'trade');
  }
  // 74 coffees * 6 margin + 48 notebooks * 8 margin - 6 rounds * 20 overhead.
  assert.equal(g.cash,1008);assert.equal(g.score,708);assert.equal(g.result,'success');
  assert.equal(empty.cash,180);assert.equal(empty.result,'fail');
  const bad=structuredClone(g);bad.history[0].cash++;assert.equal(C.valid(bad),false);
});
