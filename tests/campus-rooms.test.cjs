const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function game(){const c=vm.createContext({console,structuredClone});for(const f of ['content.js','state.js','rpg.js','campus-rooms.js','interiors.js','exploration.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),c);return c;}
test('all new buildings have distinct floor names and complete up/down connections',()=>{
 const {CampusRooms:R}=game();assert.equal(Object.keys(R.locations).length,7);assert.equal(R.count('hall'),3);assert.equal(R.count('library'),3);assert.equal(R.count('dorm'),2);
 for(const id of [...Object.keys(R.locations),'dorm','hall','library'])for(let f=1;f<=R.count(id);f++){
  const items=R.objects(id,f);assert.ok(R.valid(id,f));if(f>1)assert.ok(items.some(o=>o.type==='stairs'&&o.to===f-1));if(f<R.count(id))assert.ok(items.some(o=>o.type==='stairs'&&o.to===f+1));
  assert.ok(items.every(o=>Math.abs(o.x)<17.5&&Math.abs(o.z)<13.5));
 }
 assert.equal(R.valid('hall',4),false);assert.equal(R.valid('unknown',1),false);
});
test('floor rewards have independent stable ids and survive save restoration',()=>{
 const {CampusRooms:R,Exploration:E,TS}=game(),s=TS.fresh();
 const chests=R.allObjects().filter(o=>o.type==='chest');assert.equal(new Set(chests.map(o=>o.id)).size,chests.length);
 for(const o of chests){const before=s.stats.cash;assert.equal(E.act(s,o.id).reward,true);assert.ok(s.stats.cash>before);const after=s.stats.cash;E.act(s,o.id);assert.equal(s.stats.cash,after);}
 for(const id of Object.keys(R.locations))E.ensure(s).visited.push(id);
 const restored=TS.restore(JSON.stringify(s));assert.ok(restored);assert.equal(restored.rpg.world.opened.length,chests.length);assert.ok(TS.restore(JSON.stringify(TS.fresh())));
 s.rpg.world.visited.push('made-up-place');assert.equal(TS.restore(JSON.stringify(s)),null);
});
