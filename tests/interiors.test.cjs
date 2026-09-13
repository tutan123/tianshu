const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
function game(){const c=vm.createContext({console,structuredClone});for(const f of ['content.js','state.js','rpg.js','interiors.js','exploration.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),c);return c;}
test('eight interior plans have distinct walls, four areas and reachable object cells',()=>{
 const {Interiors:I,Exploration:E}=game(),signatures=new Set();
 for(const zone of Object.keys(E.regions)){
  const p=I.layout(zone);assert.equal(p.areas.length,4);signatures.add(JSON.stringify(p.walls));
  const clear=(x,z)=>Math.abs(x)<17.5&&Math.abs(z)<13.5&&!p.walls.some(([cx,cz,w,d])=>Math.abs(x-cx)<w/2+.3&&Math.abs(z-cz)<d/2+.3);
  const seen=new Set(['0,12']),queue=[[0,12]];
  for(let k=0;k<queue.length;k++){const [x,z]=queue[k];for(const [dx,dz]of[[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,nz=z+dz,key=nx+','+nz;if(!seen.has(key)&&clear(nx,nz)){seen.add(key);queue.push([nx,nz]);}}}
  for(const o of E.objects(zone)){assert.ok(clear(o.x,o.z),zone+': '+o.id+' clear');assert.ok(seen.has(Math.round(o.x)+','+Math.round(o.z)),zone+': '+o.id+' connected');}
 }
 assert.equal(signatures.size,8);
});
test('room investigations require clues and correct choices, pay once, and round-trip saves',()=>{
 const {Exploration:E,TS}=game(),s=TS.fresh();
 for(const zone of Object.keys(E.regions)){
  const quest=E.quests(s).find(q=>q.zone===zone),puzzle=E.objects(zone).find(o=>o.type==='puzzle');
  assert.ok(quest);assert.equal(E.act(s,quest.objectiveId).reward,false);
  assert.equal(E.act(s,puzzle.id,puzzle.answer).ok,false,'must inspect clue first');
  E.act(s,zone+'-note');E.act(s,zone+'-npc');
  assert.equal(E.act(s,puzzle.id,'invalid').ok,false);assert.equal(E.act(s,puzzle.id,puzzle.choices.find(c=>c.id!==puzzle.answer).id).ok,false);
  assert.equal(E.act(s,puzzle.id,puzzle.answer).ok,true);
  if(zone==='lab'){E.act(s,'lab-switch');E.act(s,'lab-cache');}
  assert.equal(E.act(s,quest.objectiveId).reward,true);const cash=s.stats.cash;
  assert.equal(E.act(s,quest.objectiveId).reward,false);assert.equal(s.stats.cash,cash);
 }
 assert.equal(E.quests(s).filter(q=>q.complete).length,8);assert.equal(E.evidence(s).length,8);
 assert.equal(E.quests(TS.restore(JSON.stringify(s))).filter(q=>q.complete).length,8);
 assert.ok(TS.restore(JSON.stringify(TS.fresh())));
});
