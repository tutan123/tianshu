const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
function game(){const c=vm.createContext({console,structuredClone});for(const f of ['content.js','state.js','rpg.js','exploration.js','campus-rooms.js','offcampus.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),c);return c;}

test('every off-campus investigation has a well-formed puzzle and a varied answer key',()=>{
  const {OffCampus:O}=game(),zones=O.zones;
  assert.equal(zones.length,7,'seven off-campus investigations');
  const answers=new Set();
  for(const zone of zones){
    const q=O.investigations[zone];
    for(const key of ['title','clue','intro','text','question','reply'])assert.ok(typeof q[key]==='string'&&q[key].length>4,zone+' missing '+key);
    assert.equal(q.choices.length,3,zone+' needs three choices');
    assert.ok(Number.isInteger(q.answer)&&q.answer>=0&&q.answer<q.choices.length,zone+' answer index out of range');
    assert.ok(q.cash>0&&q.xp>0,zone+' must pay something');
    answers.add(q.answer);
  }
  // One answer index repeated seven times would let a player stop reading.
  assert.ok(answers.size>=3,'answer positions must vary, saw '+[...answers].join(','));
});

test('an off-campus case requires the clue, rejects wrong answers, and pays once',()=>{
  const {OffCampus:O,Exploration:E,RPG,TS}=game(),s=TS.fresh();
  const zone='bookshop',q=O.investigations[zone],npc=zone+'-f1-npc',note=zone+'-f1-note';

  // Talking first only gives the opening; the question is gated behind the clue.
  const intro=O.act(s,npc);
  assert.equal(intro.choices,undefined,'no question before the clue is read');

  O.act(s,note);
  const asked=O.act(s,npc);
  assert.equal(asked.choices.length,3,'question appears once the clue is read');

  const wrong=q.choices.findIndex((_,i)=>i!==q.answer);
  assert.equal(O.act(s,npc,String(wrong)).ok,false,'wrong answer is refused');
  assert.equal(O.caseSolved(s,zone),false,'wrong answer must not close the case');

  const cash=s.stats.cash;
  const solved=O.act(s,npc,String(q.answer));
  assert.equal(solved.ok,true);
  assert.equal(solved.reward,true);
  assert.equal(O.caseSolved(s,zone),true);
  assert.equal(s.stats.cash,cash+q.cash,'pays the case reward');

  const again=O.act(s,npc,String(q.answer));
  assert.equal(s.stats.cash,cash+q.cash,'a closed case cannot pay its reward twice');
  // Re-talking a closed bookshop is expected to hand over its story-chain item instead;
  // the pure "closed case pays nothing" path is covered by clinic in the next test.
  assert.ok(s.flags.includes('negative-plate'),'the bookshop follow-up gives the first chain item');
});

test('the negative chain gates on the right cases and ends at the riverside',()=>{
  const {OffCampus:O,Exploration:E,RPG,TS}=game(),s=TS.fresh();
  const solve=zone=>{O.act(s,zone+'-f1-note');O.act(s,zone+'-f1-npc',String(O.investigations[zone].answer));};
  const talk=zone=>O.act(s,zone+'-f1-npc');

  // The finale refuses while the chain is incomplete.
  assert.equal(O.act(s,O.finale.id).reward,undefined,'developing before the chain must not pay');
  assert.equal(E.ensure(s).switches.includes(O.finale.id),false);

  // Solving a case outside the chain must not hand out a chain step.
  solve('clinic');
  assert.equal(talk('clinic').reward,undefined,'clinic is not part of the chain');
  assert.equal(s.flags.includes('negative-plate'),false);

  // Studio's item must wait for the bookshop one even though its own case is closed.
  solve('studio');
  assert.equal(talk('studio').reward,undefined,'studio step is locked until the plate is held');
  assert.equal(s.flags.includes('negative-print'),false);

  solve('bookshop');
  assert.equal(talk('bookshop').reward,true,'bookshop hands over the first item');
  assert.ok(s.flags.includes('negative-plate'));
  assert.equal(talk('bookshop').reward,undefined,'a collected step is not repeatable');

  // Now the studio step opens.
  assert.equal(talk('studio').reward,true,'studio hands over the second item once the plate is held');
  assert.ok(s.flags.includes('negative-print'));

  solve('museum');
  assert.equal(talk('museum').reward,true,'museum hands over the last item');
  assert.ok(s.flags.includes('negative-original'));

  const cash=s.stats.cash;
  const finale=O.act(s,O.finale.id);
  assert.equal(finale.reward,true,'the riverside develops the negatives');
  assert.equal(E.ensure(s).switches.includes(O.finale.id),true);
  assert.ok(RPG.ensure(s).owned.includes('negative'),'grants the unique accessory');
  assert.ok(s.stats.cash>cash&&s.stats.reputation>0);
  assert.equal(O.act(s,O.finale.id).reward,undefined,'the finale cannot be claimed twice');
});

test('off-campus ids are registered so existing saves keep validating',()=>{
  const {OffCampus:O,Exploration:E,TS}=game();
  // allowedIds is what save validation actually consults.
  for(const zone of O.zones)assert.ok(E.allowedIds('switches').has(O.caseId(zone)),O.caseId(zone)+' must be an accepted switch id');
  assert.ok(E.allowedIds('switches').has(O.finale.id),'the finale id must be accepted');
  assert.ok(E.allowedIds('talked').has('bookshop-f1-npc'),'off-campus npc ids must be accepted');

  const s=TS.fresh(),w=E.ensure(s);
  for(const zone of O.zones)w.switches.push(O.caseId(zone));
  w.switches.push(O.finale.id);
  w.talked.push('bookshop-f1-npc','bookshop-f1-note');
  TS.effect(s,{flags:['negative-plate','negative-print','negative-original']});
  assert.ok(TS.restore(JSON.stringify(s)),'a completed off-campus save must restore');
  assert.equal(O.quests(s).filter(q=>q.complete).length,8,'seven cases plus the story chain');
});
