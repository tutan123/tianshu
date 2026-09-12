const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
function game() {
  const c = vm.createContext({ console, structuredClone });
  for (const file of ['content.js','state.js','rpg.js','exploration.js']) vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'), c);
  return c;
}
test('every campus place has four traversable interior rooms and an exit', () => {
  const { Exploration: E, CONTENT } = game();
  for (const id of Object.keys(CONTENT.places)) {
    assert.equal(E.regions[id].rooms.length, 4);
    assert.ok(E.objects(id).some(o => o.type === 'exit'));
    assert.ok(E.objects(id).some(o => o.type === 'npc'));
    assert.ok(E.objects(id).some(o => o.type === 'chest'));
  }
});
test('chests reward exactly once, and locked caches require the power switch', () => {
  const { Exploration: E, TS } = game(), s = TS.fresh();
  assert.equal(E.act(s,'lab-cache').ok, false);
  assert.equal(E.act(s,'lab-switch').ok, true);
  const cash = s.stats.cash;
  assert.equal(E.act(s,'lab-cache').ok, true);
  assert.ok(s.stats.cash > cash);
  const after = s.stats.cash;
  assert.equal(E.act(s,'lab-cache').ok, false);
  assert.equal(s.stats.cash, after);
});
test('eight stamps unlock a unique reward; imports preserve exploration and reject unknown flags', () => {
  const { Exploration: E, TS, RPG } = game(), s = TS.fresh();
  assert.equal(E.act(s,'plaza-curator').reward, false);
  for (const id of Object.keys(E.regions)) assert.equal(E.act(s,id+'-stamp').ok, true);
  assert.equal(E.act(s,'plaza-curator').reward, true);
  assert.equal(E.act(s,'plaza-curator').reward, false);
  assert.ok(RPG.ensure(s).owned.includes('pendant'));
  assert.equal(TS.restore(JSON.stringify(s)).rpg.world.stamps.length, 8);
  s.rpg.world.opened.push('unknown-chest');
  assert.equal(TS.restore(JSON.stringify(s)), null);
});
test('equipment and arcade first wins do not duplicate currency or gear', () => {
  const { RPG, TS } = game(), s = TS.fresh(); s.stats.cash = 1000;
  assert.ok(RPG.buy(s,'wrist')); assert.equal(s.stats.cash,740);
  assert.equal(RPG.buy(s,'wrist'),false); assert.equal(RPG.bonus(s).guard,4);
  RPG.reward(s,'salvage',260,true); const cash=s.stats.cash;
  RPG.reward(s,'salvage',300,true); assert.equal(s.stats.cash,cash);
  assert.equal(s.rpg.records.salvage.best,300);
});
