const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
function load(){const c=vm.createContext({console,structuredClone});for(const f of ['content.js','state.js','rpg.js','exploration.js','vendor/matter.min.js','salvage.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),c);return c;}
test('hook collision catches a real Matter body, retracts, and scores exactly once',()=>{
  const {Arcade:A,Matter:M}=load(),g=A.create('salvage');g.phase='out';g.angle=Math.atan2(g.items[0].x-320,g.items[0].y-40);
  const bodies=g.items.map(p=>{const b=M.Bodies.circle(p.x,p.y,A.types[p.type].radius,{isStatic:true});b.plugin.index=p.id;return b;});
  for(let i=0;i<400&&g.score===0;i++)A.step(g,.016,{},bodies);
  assert.equal(g.score,80);assert.equal(g.items[0].collected,true);assert.equal(g.caught,null);
  for(let i=0;i<100;i++)A.step(g,.016,{},bodies);assert.equal(g.score,80);
});
test('heavy junk retracts slower, equipment accelerates reels, and expiry fails',()=>{
  const {Arcade:A}=load(),light=A.create('salvage'),heavy=A.create('salvage'),geared=A.create('salvage');
  for(const g of[light,heavy,geared]){g.phase='back';g.length=300;g.caught=0;}
  heavy.items[0].type=3;A.step(light,.1,{},[]);A.step(heavy,.1,{},[]);A.step(geared,.1,{reel:.35},[]);
  assert.ok(heavy.length>light.length);assert.ok(geared.length<light.length);
  light.remaining=.01;assert.equal(A.step(light,.02,{},[]),'fail');
});
test('mid-arcade saves restore after legacy migration and reject malformed encounters',()=>{
  const {TS,RPG,Arcade:A}=load(),s=TS.fresh();TS.complete(s,'intro','success');RPG.ensure(s);
  for(const kind of['salvage','memory']){
    s.active={id:kind,phase:'inter',shot:1,game:A.create(kind)};
    assert.ok(TS.restore(JSON.stringify(s)),kind+' restores');
  }
  s.active.game.round=999;assert.equal(TS.restore(JSON.stringify(s)),null);
});
