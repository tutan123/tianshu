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
test('the historical id snapshot covers every id the content produces',()=>{
 const {Interiors:I,Exploration:E}=game();
 // Renaming or retiring an object must never turn a real save into "corrupt save",
 // so validate() unions a frozen snapshot with the live object list. This asserts
 // the snapshot stays complete: a new object whose id is missing from it fails here.
 const field={chest:'opened',note:'talked',npc:'talked',switch:'switches',puzzle:'switches'};
 for(const o of E.all()){
   const key=field[o.type];if(!key)continue;
   assert.ok(E.historicalIds[key].includes(o.id),o.id+' is missing from HISTORICAL_IDS.'+key);
 }
 for(const zone of Object.keys(E.regions)){
   assert.ok(E.historicalIds.opened.includes(zone+'-task'),zone+'-task is missing from HISTORICAL_IDS.opened');
   assert.ok(E.historicalIds.stamps.includes(zone),zone+' is missing from HISTORICAL_IDS.stamps');
 }
});
test('a save naming a snapshot id validates while an unknown id is still rejected',()=>{
 const {Exploration:E,TS}=game(),s=TS.fresh(),w=E.ensure(s);
 // The snapshot exists so a renamed object keeps its old id acceptable. Use an id
 // that is definitely in the snapshot, then prove an invented id is still refused.
 const known=E.historicalIds.talked[0];
 assert.ok(known);
 w.talked.push(known);
 assert.ok(TS.restore(JSON.stringify(s)),'a snapshot id must keep validating');
 w.talked.push('definitely-not-a-real-object');
 assert.equal(TS.restore(JSON.stringify(s)),null,'an unknown id must still be rejected');
});
