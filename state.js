'use strict';
globalThis.TS = (() => {
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  function fresh() {
    return { version: 3, stats: { intelligence: 15, compute: 60, maxCompute: 100, reputation: 0, cash: 1200, physique: 20, spirit: 50 }, bonds: { lw: 0, sq: 0, gqh: 0, zty: 0 }, modules: { learn: 0, body: 0, predict: 0 }, flags: [], done: [], results: {}, choices: {}, messages: [], history: [], active: null, ending: null, settings: { volume: 0.25, speed: 28, auto: false, motion: true }, day: 1, time: '清晨', rest: 0, savedAt: null };
  }
  function available(s) { return Object.keys(CONTENT.nodes).filter(id => (!s.done.includes(id) || CONTENT.nodes[id].repeatable) && CONTENT.nodes[id].requires.every(r => s.done.includes(r))); }
  function effect(s, fx = {}) {
    for (const key of Object.keys(s.stats)) if (Number.isFinite(fx[key])) s.stats[key] += fx[key];
    s.stats.maxCompute = clamp(s.stats.maxCompute, 100, 200);
    s.stats.compute = clamp(s.stats.compute, 0, s.stats.maxCompute);
    for (const key of Object.keys(s.stats)) s.stats[key] = Math.max(0, s.stats[key]);
    if (fx.bonds) for (const [key, value] of Object.entries(fx.bonds)) if (key in s.bonds) s.bonds[key] = clamp(s.bonds[key] + value, 0, 100);
    if (fx.flags) s.flags = [...new Set([...s.flags, ...fx.flags])];
    if (fx.module && fx.module in s.modules) s.modules[fx.module] = Math.max(1, s.modules[fx.module]);
  }
  function spend(s, amount) { if (!Number.isFinite(amount) || amount < 0 || s.stats.compute < amount) return false; s.stats.compute -= amount; return true; }
  function upgrade(s, id) {
    const m = CONTENT.modules[id], level = s.modules[id];
    if (!m || level >= m.cost.length || !spend(s, m.cost[level])) return false;
    s.modules[id]++; return true;
  }
  function ending(s) {
    if (s.flags.includes('evidence') && s.flags.includes('public')) return { id: 'dawn', title: '破晓之人', tag: '真相路线', text: '被提前写好的名单终于作废。你没有成为下一个安排结果的人，而是把选择还给了每一个人。顾清河把实验室的钥匙交给你：“这次，试着走得比我远。”' };
    if (s.bonds.lw + s.bonds.sq >= 50) return { id: 'together', title: '同路之人', tag: '羁绊路线', text: '你的作品拿了第一，但更值得记住的，是饭桌上多出来的两副碗筷。林晚把那片银杏叶夹进你的笔记本。天枢写下一条无法量化的记录：这一次，宿主不再独行。' };
    return { id: 'restart', title: '命运的变量', tag: '自我路线', text: '七年前你从这里低着头走过。今天，你带着第一个作品、第一个机会，以及一个尚未解开的秘密，再次站到起点。天枢问你下一步做什么。你说：“让我自己想想。”' };
  }
  function complete(s, id, result = 'success') {
    if (!available(s).includes(id)) return false;
    const n = CONTENT.nodes[id];
    if (n.repeatable && globalThis.RPG) {
      RPG.reward(s, id, s.active?.game?.score || 0, result !== 'fail');
      if (!s.done.includes(id)) s.done.push(id);
      s.results[id] = result; return true;
    }
    effect(s, result === 'fail' ? n.fallback || n.reward : n.reward);
    globalThis.RPG?.xp(s, n.main ? 25 : 15);
    if (n.kind === 'quiz' && s.modules.learn === 2 && result !== 'fail') effect(s, { intelligence: 4 });
    s.done.push(id); s.results[id] = result;
    if (n.main) { s.day = n.day; s.time = n.time; }
    for (const msg of n.messages || []) if (!s.messages.some(m => m.id === msg)) s.messages.push({ id: msg, read: false, reply: null });
    if (id === 'finale') s.ending = ending(s);
    return true;
  }
  function reply(s, id, index) {
    const msg = s.messages.find(m => m.id === id), data = CONTENT.messages[id];
    if (!msg || msg.reply !== null || !data?.replies[index]) return false;
    msg.reply = index; msg.read = true; effect(s, data.replies[index].fx); return true;
  }
  function choose(s, id, index) {
    const n = CONTENT.nodes[id], c = n?.choices?.[index];
    if (!c || !available(s).includes(id) || Object.hasOwn(s.choices, id)) return false;
    if (c.needFlag && !s.flags.includes(c.needFlag)) return false;
    if (c.cost && s.stats.compute < c.cost) return false;
    effect(s, c.fx); s.choices[id] = index; return true;
  }
  function validEncounter(g, kind) {
    if (g === null || g === undefined) return true;
    if (typeof g !== 'object' || g.kind !== kind || g.finished === true) return false;
    if (['salvage', 'memory'].includes(kind)) return !!globalThis.Arcade?.valid(g);
    const number = (key, min, max) => Number.isFinite(g[key]) && g[key] >= min && g[key] <= max;
    const integer = (key, min, max) => Number.isInteger(g[key]) && number(key, min, max);
    if (kind === 'quiz') return integer('index', 0, CONTENT.quiz.length - 1) && integer('score', 0, CONTENT.quiz.length) && number('remaining', -.1, 60) && (g.answered === null || Number.isInteger(g.answered) && g.answered >= -1 && g.answered < CONTENT.quiz[g.index].options.length) && typeof g.assisted === 'boolean';
    if (kind === 'qte') return typeof g.running === 'boolean' && number('elapsed', 0, 14.1) && number('position', 0, 1) && [null, 'success', 'perfect', 'fail'].includes(g.result);
    if (kind === 'circuit') return Array.isArray(g.angles) && g.angles.length === 3 && g.angles.every(a => Number.isInteger(a) && a >= 0 && a <= 3) && integer('moves', 0, 1000000) && typeof g.hint === 'boolean';
    if (kind === 'combat') return integer('maxHp', 1, 1000000) && integer('hp', 1, g.maxHp) && g.maxEnemy === 85 && integer('enemy', 1, 85) && integer('turn', 1, 1000000) && integer('energy', 0, 5) && ['block', 'shield', 'boost'].every(k => integer(k, 0, 1000000)) && typeof g.reveal === 'boolean' && typeof g.log === 'string' && g.log.length <= 2000 && (g.assistedTurn === undefined || integer('assistedTurn', 1, g.turn));
    return false;
  }
  function restore(raw) {
    try {
      if (typeof raw !== 'string' || raw.length > 1000000) return null;
      const s = JSON.parse(raw), base = fresh();
      if (s.version !== 3 || !s.stats || !s.bonds || !s.modules || !Array.isArray(s.done)) return null;
      for (const key of Object.keys(base.stats)) if (!Number.isFinite(s.stats[key]) || s.stats[key] < 0 || s.stats[key] > 1000000) return null;
      if (s.stats.maxCompute < 100 || s.stats.maxCompute > 200 || s.stats.compute > s.stats.maxCompute) return null;
      for (const key of Object.keys(base.bonds)) if (!Number.isFinite(s.bonds[key]) || s.bonds[key] < 0 || s.bonds[key] > 100) return null;
      for (const key of Object.keys(base.modules)) if (!Number.isInteger(s.modules[key]) || s.modules[key] < 0 || s.modules[key] > 2) return null;
      if (new Set(s.done).size !== s.done.length || s.done.some(id => !CONTENT.nodes[id])) return null;
      for (const id of s.done) if (CONTENT.nodes[id].requires.some(r => !s.done.includes(r))) return null;
      if (!Array.isArray(s.flags) || s.flags.some(f => typeof f !== 'string' || f.length > 40)) return null;
      if (!Array.isArray(s.messages) || s.messages.some(m => !CONTENT.messages[m.id] || (m.reply !== null && !CONTENT.messages[m.id].replies[m.reply]))) return null;
      if (!s.choices || Object.entries(s.choices).some(([id, i]) => !CONTENT.nodes[id]?.choices?.[i])) return null;
      if (!s.results || Object.entries(s.results).some(([id, r]) => !s.done.includes(id) || !['success', 'fail', 'perfect'].includes(r))) return null;
      if (!Array.isArray(s.history)) return null;
      s.history = s.history.filter(h => h && typeof h.id === 'string' && h.id.length < 100 && typeof h.text === 'string' && typeof h.who === 'string' && h.text.length < 2000).slice(-200);
      if (s.active) {
        const a = s.active, n = CONTENT.nodes[a.id];
        if (!n || !['shots', 'inter', 'result'].includes(a.phase) || !Number.isInteger(a.shot) || a.shot < 0 || a.shot >= n.shots.length) return null;
        if (a.phase === 'result' ? !s.done.includes(a.id) : !available(s).includes(a.id)) return null;
        if (a.phase === 'result' && (typeof a.text !== 'string' || a.text.length > 4000)) return null;
        if (a.phase === 'inter' && !validEncounter(a.game, n.kind)) return null;
      }
      s.settings = { ...base.settings, ...s.settings };
      s.settings.volume = clamp(Number(s.settings.volume) || 0, 0, 1);
      s.settings.speed = Number.isFinite(s.settings.speed) ? clamp(s.settings.speed, 0, 65) : 28;
      s.settings.auto = !!s.settings.auto; s.settings.motion = !!s.settings.motion;
      s.day = clamp(Number(s.day) || 1, 1, 4); s.time = typeof s.time === 'string' ? s.time.slice(0, 8) : '清晨';
      s.rest = Number.isInteger(s.rest) && s.rest >= 0 ? s.rest : 0;
      if (globalThis.RPG) { s.rpg = RPG.validate(s.rpg); if (!s.rpg) return null; }
      s.ending = s.done.includes('finale') ? ending(s) : null;
      return s;
    } catch { return null; }
  }
  return { fresh, available, effect, spend, upgrade, ending, complete, reply, choose, restore, clamp };
})();
