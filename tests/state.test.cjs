const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const ctx = { console, structuredClone };
vm.createContext(ctx);
for (const file of ['content.js', 'state.js']) {
  if (fs.existsSync(path.join(root, file))) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx);
}
const api = () => { assert.ok(ctx.TS, 'game state API must be implemented'); return ctx.TS; };
test('fresh run only unlocks the opening, main chain always advances', () => {
  const T = api(), s = T.fresh();
  assert.equal(T.available(s).length, 1);
  for (const id of ctx.CONTENT.main) {
    assert.ok(T.available(s).includes(id), `unreachable: ${id}`);
    T.complete(s, id, 'success');
  }
  assert.equal(s.done.length, ctx.CONTENT.main.length);
  assert.ok(s.ending);
});
test('completed scenes cannot grant rewards twice', () => {
  const T = api(), s = T.fresh();
  T.complete(s, 'intro', 'success');
  const snapshot = JSON.stringify(s);
  assert.equal(T.complete(s, 'intro', 'success'), false);
  assert.equal(JSON.stringify(s), snapshot);
});
test('unavailable events cannot be completed', () => {
  const T = api(), s = T.fresh();
  assert.equal(T.complete(s, 'duel', 'success'), false);
  assert.equal(s.done.length, 0);
});
test('resource costs are atomic and never drive compute below zero', () => {
  const T = api(), s = T.fresh(); s.stats.compute = 3;
  assert.equal(T.spend(s, 5), false); assert.equal(s.stats.compute, 3);
  assert.equal(T.spend(s, 3), true); assert.equal(s.stats.compute, 0);
  T.effect(s, { compute: -100 }); assert.equal(s.stats.compute, 0);
});
test('modules consume compute and cannot be upgraded past their cap', () => {
  const T = api(), s = T.fresh(); s.stats.compute = 100;
  assert.equal(T.upgrade(s, 'learn'), true);
  assert.equal(s.modules.learn, 1);
  assert.ok(s.stats.compute < 100);
  s.stats.compute = 100; T.upgrade(s, 'learn');
  s.stats.compute = 100; assert.equal(T.upgrade(s, 'learn'), false);
});
test('conversation replies are awarded once', () => {
  const T = api(), s = T.fresh(); T.complete(s, 'intro', 'success');
  const msg = s.messages.find(m => m.id === 'sq-welcome'); assert.ok(msg);
  assert.equal(T.reply(s, msg.id, 0), true);
  const bond = s.bonds.sq;
  assert.equal(T.reply(s, msg.id, 0), false); assert.equal(s.bonds.sq, bond);
});
test('all main events remain completable after failures with zero compute', () => {
  const T = api(), s = T.fresh(); s.stats.compute = 0;
  for (const id of ctx.CONTENT.main) assert.equal(T.complete(s, id, 'fail'), true);
  assert.ok(s.ending);
});
test('save validation rejects corrupt and tampered data, restores scene cursor', () => {
  const T = api(), s = T.fresh();
  s.active = { id: 'intro', phase: 'shots', shot: 2, game: null };
  const restored = T.restore(JSON.stringify(s)); assert.equal(restored.active.shot, 2);
  assert.equal(T.restore('{broken'), null);
  const bad = structuredClone(s); bad.stats.cash = 'rich';
  assert.equal(T.restore(JSON.stringify(bad)), null);
  bad.stats.cash = 1200; bad.done = ['does-not-exist'];
  assert.equal(T.restore(JSON.stringify(bad)), null);
});
test('choices set persistent route flags and all three endings are reachable', () => {
  const T = api();
  const s = T.fresh(); T.effect(s, { flags: ['evidence', 'public'] });
  assert.equal(T.ending(s).id, 'dawn');
  const ally = T.fresh(); ally.bonds.lw = 30; ally.bonds.sq = 25;
  assert.equal(T.ending(ally).id, 'together');
  assert.equal(T.ending(T.fresh()).id, 'restart');
});
test('failing the lab puzzle still leaves every ending reachable', () => {
  const T = api(), C = ctx.CONTENT;
  // 'lab' is the only source of the 'evidence' flag and cannot be replayed, so a
  // single mistimed circuit used to lock the public route out for the whole run.
  const failed = T.fresh();
  for (const id of C.main) {
    if (id === 'hearing') {
      assert.equal(failed.flags.includes('evidence'), false, 'a failed lab must not grant evidence');
      assert.ok(failed.flags.includes('receipt'), 'a failed lab grants the receipt instead');
      const state = T.choiceState(failed, 'hearing', 0);
      assert.equal(state.selectable, true, 'the public route must stay selectable with only a receipt');
      assert.equal(T.choose(failed, 'hearing', 0), true);
    }
    T.complete(failed, id, id === 'lab' ? 'fail' : 'success');
  }
  assert.ok(failed.flags.includes('public'));
  assert.equal(T.ending(failed).id, 'dawn', 'dawn must be reachable from the receipt route');

  const passed = T.fresh();
  for (const id of C.main) {
    if (id === 'hearing') assert.equal(T.choose(passed, 'hearing', 0), true, 'the full-evidence route must still work');
    T.complete(passed, id, 'success');
  }
  assert.ok(passed.flags.includes('evidence'));
  assert.equal(passed.ending.id, 'dawn');

  const bare = T.fresh();
  for (const id of C.main) { if (id === 'hearing') break; T.complete(bare, id, 'success'); }
  bare.flags = bare.flags.filter(flag => flag !== 'evidence' && flag !== 'receipt');
  assert.equal(T.choiceState(bare, 'hearing', 0).selectable, false, 'without either record the route stays locked');
  assert.equal(T.choose(bare, 'hearing', 0), false);
});
test('resume preserves paid assistance and progress for every encounter kind', () => {
  const games = {
    math: { kind: 'quiz', index: 1, score: 1, remaining: 12.5, answered: null, assisted: true },
    gym: { kind: 'qte', running: true, elapsed: 2.5, position: .7, result: null },
    lab: { kind: 'circuit', angles: [0, 1, 2], moves: 4, hint: true },
    duel: { kind: 'combat', hp: 65, maxHp: 80, enemy: 40, maxEnemy: 85, turn: 2, energy: 1, block: 5, shield: 0, boost: 8, reveal: true, assistedTurn: 2, log: 'saved combat' }
  };
  for (const [id, game] of Object.entries(games)) {
    const T = api(), s = T.fresh();
    for (const node of ctx.CONTENT.main) { if (node === id) break; T.complete(s, node); }
    s.active = { id, phase: 'inter', shot: 0, game };
    s.stats.compute = 10;
    const restored = T.restore(JSON.stringify(s));
    assert.ok(restored, id);
    assert.equal(JSON.stringify(restored.active.game), JSON.stringify(game), id);
    assert.equal(restored.stats.compute, 10);
    const bad = structuredClone(s); bad.active.game.kind = 'unknown';
    assert.equal(T.restore(JSON.stringify(bad)), null);
  }
});
test('instant subtitles remain instant after save reload', () => {
  const T = api(), s = T.fresh(); s.settings.speed = 0;
  assert.equal(T.restore(JSON.stringify(s)).settings.speed, 0);
});
test('malformed combat and history cannot reach the renderer', () => {
  const T = api(), s = T.fresh();
  for (const id of ctx.CONTENT.main) { if (id === 'duel') break; T.complete(s, id); }
  s.active = { id: 'duel', phase: 'inter', shot: 0, game: { kind: 'combat', energy: 1000000 } };
  assert.equal(T.restore(JSON.stringify(s)), null);
  s.active.game = null; s.history = [{ who: 'x', text: 'y' }];
  assert.equal(T.restore(JSON.stringify(s)).history.length, 0);
});
