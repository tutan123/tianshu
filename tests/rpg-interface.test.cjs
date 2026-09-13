'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
function load() {
  const c = vm.createContext({ console, structuredClone });
  for (const file of ['content.js', 'state.js', 'rpg.js', 'growth-ui.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), c);
  return c;
}
test('profile derives battle health and all stats from the current state without fake attack totals', () => {
  const { RPG, TS } = load(), s = TS.fresh();
  RPG.xp(s, 125); RPG.buy(s, 'jacket'); s.stats.physique = 31;
  assert.equal(typeof RPG.profile, 'function');
  const p = RPG.profile(s);
  assert.equal(p.level, 2); assert.equal(p.xp, 125); assert.equal(p.progress, 25);
  assert.equal(p.maxHp, 99); assert.equal(p.stats.intelligence, 15); assert.equal(p.stats.cash, 840);
  assert.equal(p.bonus.attack, 1); assert.equal(p.attack, undefined);
  s.active = { game: { kind: 'combat', hp: 23, maxHp: 99 } };
  assert.equal(RPG.profile(s).hp, 23);
  RPG.xp(s, 1000); assert.equal(RPG.profile(s).progress, 100);
});
test('inventory filters actual ownership, consumables, found memories and evidence', () => {
  const c = load(), { RPG, TS } = c, s = TS.fresh();
  assert.equal(typeof RPG.inventory, 'function');
  assert.equal(RPG.inventory(s).length, 0);
  RPG.buy(s, 'wrist'); RPG.buy(s, 'coffee'); RPG.buy(s, 'coffee'); RPG.discover(s, 'dorm');
  c.Exploration = { evidence: () => [{ id: 'clue-a', name: '原始记录', desc: '已核对', icon: 'file-check' }] };
  assert.equal(RPG.inventory(s, 'gear')[0].id, 'wrist');
  assert.equal(RPG.inventory(s, 'supplies')[0].quantity, 2);
  assert.equal(RPG.inventory(s, 'memories')[0].id, 'memory:dorm');
  assert.equal(RPG.inventory(s, 'evidence')[0].name, '原始记录');
  assert.equal(RPG.inventory(s, 'all', '咖啡').length, 1);
  assert.equal(RPG.inventory(s, 'all', 'missing').length, 0);
});
test('gear comparison reports replacement deltas against the currently equipped slot', () => {
  const { RPG, TS } = load(), s = TS.fresh();
  RPG.buy(s, 'wrist'); RPG.buy(s, 'solder');
  assert.equal(typeof RPG.compare, 'function');
  const c = RPG.compare(s, 'solder');
  assert.equal(c.current, 'wrist'); assert.equal(c.delta.attack, 3); assert.equal(c.delta.guard, -4);
  assert.ok(Math.abs(c.delta.reel - .2) < 1e-9);
  RPG.equip(s, 'solder'); assert.equal(RPG.compare(s, 'solder').delta.attack, 0);
});
test('consumable preview matches clamped real effects and preserves locks and caps', () => {
  const { RPG, TS } = load(), s = TS.fresh();
  RPG.buy(s, 'coffee'); RPG.buy(s, 'notes');
  assert.equal(typeof RPG.usePreview, 'function');
  s.stats.compute = 95;
  assert.equal(RPG.usePreview(s, 'coffee').compute, 5);
  assert.equal(RPG.use(s, 'coffee'), true); assert.equal(s.stats.compute, 100);
  RPG.xp(s, 690); assert.equal(RPG.usePreview(s, 'notes').xp, 10);
  s.active = { id: 'intro' }; assert.equal(RPG.usePreview(s, 'notes').allowed, false);
  assert.equal(RPG.use(s, 'notes'), false); assert.equal(RPG.equip(s, 'wrist'), false);
  s.active = null; assert.equal(RPG.use(s, 'notes'), true); assert.equal(RPG.ensure(s).xp, 700);
  s.stats.cash = 10000; for (let i = 0; i < 12; i++) RPG.buy(s, 'coffee');
  assert.equal(RPG.ensure(s).bag.coffee, 9); assert.equal(RPG.buy(s, 'coffee'), false);
  assert.equal(RPG.usePreview(s, 'coffee').allowed, false);
  assert.ok(TS.restore(JSON.stringify(s)));
});
test('interface has four accessible views, legacy shop access and real profile data', () => {
  const { RPG, TS, GrowthUI } = load(), s = TS.fresh();
  const content = { innerHTML: '' }, host = { innerHTML: '', querySelector: () => content, querySelectorAll: () => [] };
  GrowthUI.render(host, s, { icons() {} }, 'profile');
  assert.match(host.innerHTML, /class="character-ui"/);
  for (const view of ['profile', 'gear', 'bag', 'tasks']) assert.match(host.innerHTML, new RegExp('data-growth-tab="' + view + '"'));
  assert.match(host.innerHTML, /role="tablist"/); assert.match(host.innerHTML, /data-growth-tab="shop"/);
  assert.match(host.innerHTML, /data-stat="intelligence"/); assert.match(host.innerHTML, /data-stat="hp"/);
  GrowthUI.render(host, s, { icons() {} }, 'bag'); assert.match(host.innerHTML, /data-bag-filter/); assert.match(host.innerHTML, /背包是空的/);
  GrowthUI.render(host, s, { icons() {} }, 'tasks'); assert.match(host.innerHTML, /暂无可记录的委托/);
  RPG.buy(s, 'wrist'); GrowthUI.render(host, s, { icons() {} }, 'gear'); assert.match(host.innerHTML, /data-equip="wrist"/);
});
