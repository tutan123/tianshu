'use strict';
globalThis.Arcade = (() => {
  const sequences = [[1, 3, 0], [2, 0, 3, 1], [0, 2, 1, 3, 2]];
  const types = [
    { name: '芯片', value: 80, weight: 1, color: '#8cdbdd', radius: 19 },
    { name: '电路板', value: 50, weight: 1.7, color: '#83b69a', radius: 25 },
    { name: '线圈', value: 30, weight: 1.3, color: '#e3b274', radius: 19 },
    { name: '废主机', value: 5, weight: 3.8, color: '#798587', radius: 29 }
  ];
  let host, state, hooks, g, bodies = [], canvas, ctx, stopped = true;
  // Salvage tuning. valid() derives its bounds from these same values, so a
  // stronger reel-time or value item can never turn an in-progress save into a
  // rejected one for the player.
  const ITEM_LAYOUT = [0, 2, 3, 1, 1, 0, 2, 3, 0, 3, 1, 0];
  const BASE_SECONDS = 45, TIME_SLACK = 5, ELAPSED_LIMIT = 200, ANGLE_LIMIT = 1.2;
  const MIN_LENGTH = 28, OUT_LENGTH = 455, LENGTH_SLACK = 5;
  const MAX_SCORE_SLACK = 50, MEMORY_SCORE_LIMIT = 120, MEMORY_TIMER_LIMIT = 20;
  const maxSeconds = () => BASE_SECONDS + (globalThis.RPG?.limits?.().time || 0) + TIME_SLACK;
  const maxScore = () => Math.ceil(ITEM_LAYOUT.reduce((sum, type) => sum + types[type].value, 0) * (1 + (globalThis.RPG?.limits?.().value || 0))) + MAX_SCORE_SLACK;
  function create(kind, bonus = {}) {
    if (kind === 'memory') return { kind, round: 0, cursor: 0, mistakes: 0, score: 0, phase: 'ready', timer: 0, assisted: false };
    return { kind, phase: 'ready', remaining: BASE_SECONDS + (bonus.time || 0), score: 0, elapsed: 0, angle: -.9, length: MIN_LENGTH, caught: null, flash: '', items: Array.from({ length: 12 }, (_, i) => ({ id: i, type: ITEM_LAYOUT[i], x: 82 + (i % 4) * 155 + (i > 7 ? 12 : 0), y: 185 + Math.floor(i / 4) * 104, collected: false })) };
  }
  function valid(v) {
    if (!v || !['salvage', 'memory'].includes(v.kind)) return false;
    const num = (k, lo, hi) => Number.isFinite(v[k]) && v[k] >= lo && v[k] <= hi;
    if (v.kind === 'memory') return Number.isInteger(v.round) && num('round', 0, 2) && Number.isInteger(v.cursor) && num('cursor', 0, 5) && Number.isInteger(v.mistakes) && num('mistakes', 0, 2) && num('score', 0, MEMORY_SCORE_LIMIT) && ['ready', 'show', 'input'].includes(v.phase) && num('timer', 0, MEMORY_TIMER_LIMIT) && typeof v.assisted === 'boolean';
    return ['ready', 'swing', 'out', 'back'].includes(v.phase) && num('remaining', 0, maxSeconds()) && num('score', 0, maxScore()) && num('elapsed', 0, ELAPSED_LIMIT) && num('angle', -ANGLE_LIMIT, ANGLE_LIMIT) && num('length', 0, OUT_LENGTH + LENGTH_SLACK) && typeof v.flash === 'string' && v.flash.length <= 100 && (v.caught === null || Number.isInteger(v.caught) && v.caught >= 0 && v.caught < 12) && Array.isArray(v.items) && v.items.length === 12 && v.items.every((p, i) => p.id === i && Number.isInteger(p.type) && p.type >= 0 && p.type < types.length && Number.isFinite(p.x) && p.x >= 30 && p.x <= 610 && Number.isFinite(p.y) && p.y >= 100 && p.y <= 420 && typeof p.collected === 'boolean');
  }
  function point(v) { return { x: 320 + Math.sin(v.angle) * v.length, y: 40 + Math.cos(v.angle) * v.length }; }
  function step(v, dt, bonus, collisionBodies) {
    if (v.phase === 'ready') return null;
    v.elapsed += dt; v.remaining = Math.max(0, v.remaining - dt);
    if (v.phase === 'swing') v.angle = Math.sin(v.elapsed * 1.1) * 1.08;
    if (v.phase === 'out') {
      for (let t = 0; t < dt; t += .01) {
        v.length += Math.min(.01, dt - t) * 330;
        const p = point(v), hit = Matter.Query.point(collisionBodies.filter(b => !v.items[b.plugin.index].collected), p)[0];
        if (hit) { v.caught = hit.plugin.index; v.phase = 'back'; v.flash = types[v.items[v.caught].type].name; break; }
        if (v.length > OUT_LENGTH || p.x < 20 || p.x > 620 || p.y > 435) { v.phase = 'back'; break; }
      }
    } else if (v.phase === 'back') {
      const weight = v.caught === null ? 1 : types[v.items[v.caught].type].weight;
      v.length -= dt * 300 * (1 + (bonus.reel || 0)) / weight;
      if (v.length <= MIN_LENGTH) {
        if (v.caught !== null) { const item = v.items[v.caught], gain = Math.round(types[item.type].value * (1 + (bonus.value || 0))); item.collected = true; v.score += gain; v.flash = '+' + gain + ' 回收价值'; }
        v.caught = null; v.length = MIN_LENGTH; v.phase = 'swing';
      }
    }
    return v.score >= 250 ? 'success' : v.remaining <= 0 ? 'fail' : null;
  }
  function start(kind, target, s, callbacks) {
    host = target; state = s; hooks = callbacks; stopped = false;
    g = state.active.game || create(kind, RPG.bonus(state)); state.active.game = g;
    if (kind === 'salvage' && !globalThis.Matter) {
      host.innerHTML = '<h2>回收装置暂未连接</h2><p>这次先保留委托记录。</p><button class="primary" id="arcade-offline">返回校园</button>';
      host.querySelector('button').onclick = () => hooks.finish('fail'); return;
    }
    if (kind === 'salvage') bodies = g.items.map(item => { const b = Matter.Bodies.circle(item.x, item.y, types[item.type].radius, { isStatic: true }); b.plugin.index = item.id; return b; });
    render(); hooks.save();
  }
  function render() {
    if (g.kind === 'memory') { renderMemory(); return; }
    host.classList.add('arcade-encounter');
    host.innerHTML = `<div class="arcade-heading"><div><span class="eyebrow">BACKSTREET WORKSHOP / 01</span><h2>把机会，从旧物里找回来</h2></div><span class="arcade-tag">零件回收</span></div><div class="arcade-meters"><span>回收价值 <b id="salvage-score">${g.score}</b> / 250</span><span id="salvage-time">${Math.ceil(g.remaining)} 秒</span></div><canvas id="salvage-board" width="640" height="460" aria-label="回收装置与十二件零件"></canvas><div class="salvage-footer"><span id="salvage-message">芯片 80 · 电路板 50 · 线圈 30 · 废料 5</span><span>首通：¥180 · 60 EXP</span></div><div class="game-buttons"><button id="salvage-release" class="secondary"><i data-lucide="scissors"></i>放下重物</button><button id="salvage-fire" class="primary"><i data-lucide="crosshair"></i>${g.phase === 'ready' ? '启动回收' : '发射抓手'}</button></div>`;
    canvas = host.querySelector('canvas'); ctx = canvas.getContext('2d');
    host.querySelector('#salvage-fire').onclick = action;
    host.querySelector('#salvage-release').onclick = () => { if (g.caught !== null) { g.items[g.caught].collected = true; g.caught = null; g.flash = '已放下重物'; hooks.save(); } };
    canvas.addEventListener('pointerdown', e => { e.preventDefault(); action(); });
    hooks.icons(); draw();
  }
  function action() {
    if (stopped) return;
    if (g.kind === 'memory') { if (g.phase === 'ready') { g.phase = 'show'; g.timer = 0; g.cursor = 0; renderMemory(); hooks.save(); } return; }
    if (g.phase === 'ready') { g.phase = 'swing'; render(); }
    else if (g.phase === 'swing') { g.phase = 'out'; hooks.sound(); }
    hooks.save();
  }
  function draw() {
    if (!ctx || g.kind !== 'salvage') return;
    const c = ctx; c.clearRect(0, 0, 640, 460); c.fillStyle = '#152d34'; c.fillRect(0, 0, 640, 460);
    c.strokeStyle = '#294149'; c.lineWidth = 1;
    for (let x = 0; x < 640; x += 32) { c.beginPath(); c.moveTo(x, 55); c.lineTo(x, 460); c.stroke(); }
    for (let y = 60; y < 460; y += 32) { c.beginPath(); c.moveTo(0, y); c.lineTo(640, y); c.stroke(); }
    c.fillStyle = '#344b50'; c.fillRect(0, 0, 640, 55); c.fillStyle = '#deb67c';
    for (let x = 14; x < 640; x += 28) c.fillRect(x, 49, 14, 3);
    for (const item of g.items) {
      if (item.collected || item.id === g.caught) continue;
      part(item, item.x, item.y);
    }
    const p = point(g); c.lineWidth = 3; c.strokeStyle = '#e0d9bb'; c.beginPath(); c.moveTo(320, 40); c.lineTo(p.x, p.y); c.stroke();
    c.fillStyle = '#ddaa68'; c.fillRect(292, 16, 56, 26); c.fillStyle = '#17282d'; c.fillRect(308, 22, 24, 14);
    c.save(); c.translate(p.x, p.y); c.rotate(-g.angle); c.strokeStyle = '#b5dbe0'; c.lineWidth = 5; c.beginPath(); c.moveTo(-13, -7); c.lineTo(-19, 11); c.lineTo(-8, 18); c.moveTo(13, -7); c.lineTo(19, 11); c.lineTo(8, 18); c.stroke(); c.restore();
    if (g.caught !== null) part(g.items[g.caught], p.x, p.y + 22);
    const ready = g.phase === 'ready';
    if (ready) { c.fillStyle = '#0c202a99'; c.fillRect(0, 56, 640, 404); c.fillStyle = '#eef1e9'; c.font = '500 25px Microsoft YaHei'; c.textAlign = 'center'; c.fillText('选准方向，抓住下一次机会', 320, 233); c.font = '14px Microsoft YaHei'; c.fillStyle = '#aac8ca'; c.fillText('轻巧芯片比沉重主机更值得带回来', 320, 268); }
    host.querySelector('#salvage-score').textContent = g.score;
    host.querySelector('#salvage-time').textContent = Math.ceil(g.remaining) + ' 秒';
    host.querySelector('#salvage-message').textContent = g.flash || '芯片 80 · 电路板 50 · 线圈 30 · 废料 5';
    host.querySelector('#salvage-fire').disabled = !['ready', 'swing'].includes(g.phase);
    host.querySelector('#salvage-release').disabled = g.caught === null;
  }
  function part(item, x, y) {
    const c = ctx, data = types[item.type]; c.save(); c.translate(x, y); c.fillStyle = '#06181d66'; c.beginPath(); c.ellipse(3, data.radius + 9, data.radius + 5, 8, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = data.color; c.strokeStyle = '#cbe6d4'; c.lineWidth = 2;
    if (item.type === 2) { c.lineWidth = 7; c.strokeStyle = data.color; c.beginPath(); c.arc(0, 0, 14, 0, Math.PI * 2); c.stroke(); }
    else { c.fillRect(-data.radius, -data.radius * .75, data.radius * 2, data.radius * 1.5); c.fillStyle = '#122831'; c.fillRect(-11, -8, 22, 16); for (let i = -1; i <= 1; i++) { c.fillStyle = '#c6b878'; c.fillRect(i * 9 - 2, -data.radius - 1, 4, 8); c.fillRect(i * 9 - 2, data.radius - 7, 4, 8); } }
    c.fillStyle = '#dceae3'; c.font = '12px Microsoft YaHei'; c.textAlign = 'center'; c.fillText(data.name + ' · ' + data.value, 0, data.radius + 27); c.restore();
  }
  function renderMemory() {
    host.classList.add('arcade-encounter');
    const labels = ['月光', '雨滴', '银杏', '火花'], symbols = ['moon', 'droplets', 'leaf', 'zap'];
    host.innerHTML = `<div class="eyebrow">SIGNAL ARCHIVE / ${g.round + 1} OF 3</div><h2>四秒钟的回声</h2><p>${g.phase === 'input' ? '轮到你了。把刚才的信号按顺序点亮。' : g.phase === 'show' ? '记住它们亮起的顺序。' : '准备好，就让记忆重新亮起来。'}</p><div class="memory-progress">${sequences[g.round].map((_, i) => `<span class="${i < g.cursor ? 'complete' : ''}"></span>`).join('')}</div><div class="memory-grid">${labels.map((label, i) => `<button data-signal="${i}" class="signal signal-${i}" ${g.phase !== 'input' ? 'disabled' : ''}><i data-lucide="${symbols[i]}"></i><span>${label}</span></button>`).join('')}</div><div class="game-status"><span>稳定度 ${3 - g.mistakes} / 3</span><span>还原 ${g.score} / 12</span></div><div class="game-buttons"><button id="memory-replay" class="secondary" ${g.phase !== 'input' || g.assisted ? 'disabled' : ''}>重放信号 · 5 算力</button><button id="memory-start" class="primary" ${g.phase !== 'ready' ? 'disabled' : ''}>${g.round ? '下一组信号' : '开始还原'}</button></div>`;
    host.querySelector('#memory-start').onclick = action;
    host.querySelector('#memory-replay').onclick = () => { if (g.assisted || !TS.spend(state, 5)) { hooks.toast('算力不足'); return; } g.assisted = true; g.cursor = 0; g.phase = 'show'; g.timer = 0; renderMemory(); hooks.save(); hooks.hud(); };
    host.querySelectorAll('[data-signal]').forEach(b => b.onclick = () => {
      if (g.phase !== 'input') return;
      if (Number(b.dataset.signal) !== sequences[g.round][g.cursor]) {
        g.mistakes++; b.classList.add('wrong'); hooks.sound('soft');
        if (g.mistakes >= 3) { finish('fail'); return; }
        g.cursor = 0; g.timer = 0; g.phase = 'show';
      } else { g.cursor++; hooks.sound(); }
      if (g.cursor === sequences[g.round].length) {
        g.score += sequences[g.round].length;
        if (g.round === 2) { finish('success'); return; }
        g.round++; g.cursor = 0; g.phase = 'ready'; g.assisted = false;
      }
      renderMemory(); hooks.save();
    }); hooks.icons();
  }
  function finish(result) { if (stopped) return; stopped = true; hooks.finish(result); }
  function tick(dt) {
    if (stopped || !g) return;
    if (g.kind === 'salvage') {
      if (globalThis.Matter) { const result = step(g, dt, RPG.bonus(state), bodies); draw(); if (result) finish(result); }
      return;
    }
    if (g.kind === 'memory' && g.phase === 'show') {
      g.timer += dt; const index = Math.floor(g.timer / .85), on = g.timer % .85 < .55;
      host.querySelectorAll('[data-signal]').forEach(b => b.classList.toggle('lit', on && Number(b.dataset.signal) === sequences[g.round][index]));
      if (index >= sequences[g.round].length) { g.phase = 'input'; g.timer = 0; renderMemory(); hooks.save(); }
    }
  }
  function stop() { stopped = true; host = null; ctx = null; canvas = null; g = null; }
  return { create, valid, point, step, types, start, tick, action, stop };
})();
