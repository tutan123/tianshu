'use strict';
globalThis.MiniGames = (() => {
  let host, state, hooks, g, kind;
  const icon = name => `<i data-lucide="${name}"></i>`;
  const escapeText = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const button = (id, label, css = 'secondary') => `<button id="${id}" class="${css}">${label}</button>`;
  const $ = id => host.querySelector(`#${id}`);
  // Encounter tuning. Save validation reads the same numbers through limits(),
  // so adding a stronger item or raising an enemy can never turn an in-progress
  // save into a rejected one for the player.
  const QUIZ_BASE_SECONDS = 22, QUIZ_SECONDS_PER_LEVEL = 5, QTE_SECONDS = 14;
  const COMBAT_BASE_HP = 65, COMBAT_ENERGY_PER_TURN = 3, COMBAT_ENEMY_HP = 120;
  // 陆沉 escalates every round on top of his move. Tuned against the state a normal
  // story path actually reaches the duel with (Lv.3, 91 HP, 13 damage and 12 guard
  // per action point): trading blows for three rounds without ever defending deals
  // 107 damage and kills you, while spending two of twelve action points on guard
  // wins with about 8 HP left. Read and 神经超频 are the slack for a prepared player.
  const COMBAT_DAMAGE_BASE = 10, COMBAT_DAMAGE_RAMP = 12;
  const combatDamage = (move, turn) => move.attack + COMBAT_DAMAGE_BASE + (turn - 1) * COMBAT_DAMAGE_RAMP;
  const quizSecondsFor = s => QUIZ_BASE_SECONDS + s.modules.learn * QUIZ_SECONDS_PER_LEVEL + (globalThis.RPG?.bonus(s).time || 0);
  const limits = {
    // Highest value each encounter can legally reach, for save validation.
    get quizSeconds() { return QUIZ_BASE_SECONDS + CONTENT.modules.learn.cost.length * QUIZ_SECONDS_PER_LEVEL + (globalThis.RPG?.limits?.().time || 0) + 5; },
    get qteSeconds() { return QTE_SECONDS; },
    get enemyHp() { return COMBAT_ENEMY_HP; },
  };
  function changed() { state.active.game = g; hooks.save(); hooks.hud(); }
  function bind(id, fn) { $(id)?.addEventListener('click', fn); }
  function finish(result) { if (g.finished) return; g.finished = true; hooks.sound(result === 'fail' ? 'soft' : 'win'); hooks.finish(result); }
  function start(type, target, s, callbacks) {
    kind = type; host = target; state = s; hooks = callbacks;
    if (['salvage', 'memory'].includes(kind)) { Arcade.start(kind, target, s, callbacks); return; }
    if (['bargain', 'supply'].includes(kind)) { Commerce.start(kind, target, s, callbacks); return; }
    g = state.active.game;
    if (!g || g.kind !== kind) {
      if (kind === 'quiz') g = { kind, index: 0, score: 0, remaining: quizSecondsFor(s), answered: null, assisted: false };
      if (kind === 'qte') g = { kind, running: false, elapsed: 0, position: 0, result: null };
      if (kind === 'circuit') g = { kind, angles: [1, 3, 2], moves: 0, hint: false };
      if (kind === 'combat') g = { kind, hp: COMBAT_BASE_HP + Math.floor(s.stats.physique / 2) + (globalThis.RPG?.bonus(s).hp || 0), maxHp: COMBAT_BASE_HP + Math.floor(s.stats.physique / 2) + (globalThis.RPG?.bonus(s).hp || 0), enemy: COMBAT_ENEMY_HP, maxEnemy: COMBAT_ENEMY_HP, turn: 1, energy: COMBAT_ENERGY_PER_TURN + (s.modules.predict === 2 ? 1 : 0), block: 0, shield: 0, boost: 0, reveal: false, log: '雨声里，你听见自己的呼吸。等待对方先露出破绽。' };
      changed();
    }
    render();
  }
  function render() {
    if (kind === 'quiz') quiz();
    if (kind === 'qte') qte();
    if (kind === 'circuit') circuit();
    if (kind === 'combat') combat();
    hooks.icons();
  }
  function quiz() {
    const q = CONTENT.quiz[g.index], answered = g.answered !== null;
    host.innerHTML = `<div class="eyebrow">${icon('brain')} 认知演算 / ${g.index + 1} OF 3</div><h2>${escapeText(q.q)}</h2><div class="game-status"><span>已理解 ${g.score} / 3</span><span id="quiz-time">${Math.ceil(g.remaining)} 秒</span></div><div class="timer-track"><span id="quiz-timer"></span></div><div>${q.options.map((o, i) => `<button class="choice quiz-answer ${answered && i === q.answer ? 'correct' : answered && i === g.answered ? 'wrong' : ''}" data-answer="${i}" ${answered ? 'disabled' : ''}><span class="choice-index">0${i + 1}</span><strong>${escapeText(o)}</strong>${g.assisted && i === q.answer ? icon('sparkles') : ''}</button>`).join('')}</div><div class="game-feedback">${answered ? (g.answered === q.answer ? '推导成立。' : '换一个角度再看。') + escapeText(q.explain) : g.assisted ? '天枢已经标记关键答案。接下来，由你把它讲清楚。' : '林晚看着你的笔尖，等你把这一步写完。'}</div><div class="game-buttons">${answered ? button('quiz-next', g.index === 2 ? '完成讲解' : '下一问 ' + icon('arrow-right'), 'primary') : button('quiz-assist', icon('cpu') + ` 天枢解析 · ${state.modules.learn ? 5 : 10} 算力`)}</div>`;
    host.querySelectorAll('[data-answer]').forEach(b => b.addEventListener('click', () => answer(Number(b.dataset.answer))));
    bind('quiz-assist', () => {
      if (g.assisted) return;
      if (!TS.spend(state, state.modules.learn ? 5 : 10)) { hooks.toast('算力不足，也可以依靠自己的判断。'); return; }
      g.assisted = true; changed(); render();
    });
    bind('quiz-next', () => {
      if (g.index === 2) { finish(g.score >= 2 ? 'success' : 'fail'); return; }
      g.index++; g.answered = null; g.assisted = false; g.remaining = quizSecondsFor(state); changed(); render();
    });
    if ($('quiz-assist')) $('quiz-assist').disabled = g.assisted;
    quizMeter();
  }
  function quizMeter() { if ($('quiz-timer')) $('quiz-timer').style.width = `${Math.max(0, g.remaining) / quizSecondsFor(state) * 100}%`; if ($('quiz-time')) $('quiz-time').textContent = `${Math.ceil(Math.max(0, g.remaining))} 秒`; }
  function answer(i) { if (g.answered !== null) return; g.answered = i; if (i === CONTENT.quiz[g.index].answer) g.score++; hooks.sound('tap'); changed(); render(); }
  function width() { return .20 * (1 + state.modules.body * .35) + Math.min(.06, state.stats.physique / 1000) + (globalThis.RPG?.bonus(state).window || 0); }
  function qte() {
    const w = width();
    host.innerHTML = `<div class="eyebrow">${icon('activity')} 神经协同 / 精准时机</div><h2>${state.active.id === 'run' ? '把力量，留给正确的瞬间' : '右侧空当，即将出现'}</h2><p class="game-subtitle">${g.result ? (g.result === 'perfect' ? '完美命中。你比天枢的预测还快了一步。' : g.result === 'success' ? '时机正确。身体跟上了你的判断。' : '偏离窗口。别停，另一个机会还在。') : '光标进入亮色区域时，锁定动作。'}</p><div class="qte-track"><span class="qte-zone" style="left:${(0.5 - w / 2) * 100}%;width:${w * 100}%"></span><span class="qte-perfect" style="left:47%;width:6%"></span><span class="qte-cursor" id="qte-cursor" style="left:${g.position * 100}%"></span></div><div class="qte-labels"><span>准备</span><span>精准窗口</span><span>收势</span></div>${button('qte-hit', g.result ? '继续 ' + icon('arrow-right') : g.running ? icon('crosshair') + ' 锁定动作' : icon('play') + ' 开始预判', 'primary qte-hit')}<div class="game-status"><span>${state.modules.body ? '神经协同 Lv.' + state.modules.body : '自主控制'}</span><span id="qte-time">${g.running ? '剩余 ' + Math.ceil(QTE_SECONDS - g.elapsed) + ' 秒' : '按下开始后计时'}</span></div>`;
    bind('qte-hit', qteAction);
  }
  function qteAction() {
    if (g.result) { finish(g.result); return; }
    if (!g.running) { g.running = true; g.elapsed = 0; changed(); render(); return; }
    const delta = Math.abs(g.position - .5);
    g.result = delta <= .03 ? 'perfect' : delta <= width() / 2 ? 'success' : 'fail';
    g.running = false; changed(); hooks.sound('tap'); render();
  }
  function circuit() {
    const aligned = g.angles.filter(a => a === 0).length;
    host.innerHTML = `<div class="eyebrow">${icon('network')} 数据取证 / 只读备份</div><h2>接通三段原始记录</h2><p class="game-subtitle">旋转数据接口，让三段线路左右贯通。原始记录不会被修改。</p><div class="circuit-labels"><span>备份源 ${icon('arrow-right')}</span><span>校验端</span></div><div class="circuit-grid">${g.angles.map((a, i) => `<button class="circuit-cell ${a === 0 ? 'connected' : ''}" data-rotate="${i}" aria-label="旋转第 ${i + 1} 段线路"><svg viewBox="0 0 100 100" style="transform:rotate(${a * 90}deg)" aria-hidden="true"><path d="M 0 50 H 100" stroke="${a === 0 ? '#d5e7aa' : '#728c71'}" stroke-width="7"/><path d="M 65 38 L 79 50 L 65 62" stroke="#f1edce" stroke-width="5" fill="none"/><circle cx="22" cy="50" r="8" fill="#1c3021" stroke="#d5e7aa" stroke-width="3"/></svg><span>记录 0${i + 1} ${g.hint ? a === 0 ? '已对齐' : '再转 ' + (4 - a) + ' 次' : ''}</span></button>`).join('')}</div><div class="game-status"><span>连接进度 ${aligned} / 3</span><span>旋转 ${g.moves} 次</span></div><div class="game-buttons">${button('circuit-check', '校验并恢复 ' + icon('arrow-right'), 'primary')}${button('circuit-hint', icon('scan-eye') + ' 演算提示 · ' + (state.modules.predict ? '免费' : '8 算力'))}</div><div class="game-feedback" id="circuit-feedback">${g.hint ? '保持线路向右。箭头与数据流一致时，接口会变为亮色。' : '天枢：记录必须同时通过方向与完整性校验。'}</div>${button('circuit-leave', '仅保留现有申请回执', 'quiet-button')}`;
    host.querySelectorAll('[data-rotate]').forEach(b => b.addEventListener('click', () => { const i = Number(b.dataset.rotate); g.angles[i] = (g.angles[i] + 1) % 4; g.moves++; hooks.sound('tap'); changed(); render(); }));
    bind('circuit-check', () => { if (g.angles.every(a => a === 0)) finish('success'); else $('circuit-feedback').textContent = '仍有接口未对齐。记录已安全保留，可以继续调整。'; });
    bind('circuit-hint', () => { if (g.hint) return; if (!state.modules.predict && !TS.spend(state, 8)) { hooks.toast('算力不足。顺着箭头方向旋转即可。'); return; } g.hint = true; changed(); render(); });
    bind('circuit-leave', () => finish('fail'));
    $('circuit-hint').disabled = g.hint;
  }
  const moves = [{ name: '试探直拳', attack: 12, shield: 0 }, { name: '过载突进', attack: 19, shield: 0 }, { name: '回撤反击', attack: 10, shield: 8 }, { name: '协议重击', attack: 23, shield: 0 }];
  function combat() {
    const move = moves[(g.turn - 1) % moves.length], reveal = state.modules.predict || g.reveal;
    const damage = 11 + (state.modules.predict === 2 ? 4 : 0) + (state.flags.includes('hardware') ? 3 : 0) + (globalThis.RPG?.bonus(state).attack || 0);
    const incoming = combatDamage(move, g.turn);
    host.innerHTML = `<div class="eyebrow">${icon('swords')} 战术演算 / ROUND ${String(g.turn).padStart(2, '0')}</div><h2>别让他决定你的下一步</h2><div class="combat-arena"><div class="fighter"><div class="fighter-emblem">旭</div><h3>陈旭</h3><div class="hp-bar"><span style="width:${g.hp / g.maxHp * 100}%"></span></div><small>生命 ${g.hp} / ${g.maxHp} · 当前格挡 ${g.block}</small></div><div class="versus">VS</div><div class="fighter enemy"><div class="fighter-emblem">沉</div><h3>陆沉</h3><div class="hp-bar"><span style="width:${g.enemy / g.maxEnemy * 100}%"></span></div><small>生命 ${g.enemy} / ${g.maxEnemy} · 当前格挡 ${g.shield}</small></div></div><div class="intent">${reveal ? '敌方意图：' + escapeText(move.name) + ' · ' + incoming + ' 伤害' + (move.shield ? ' · 行动后获得 ' + move.shield + ' 格挡' : '') : '敌方意图尚未解析 · 读招可提前预判'}</div><p class="combat-log">${escapeText(g.log)}</p><div class="hand"><button class="card" data-card="strike" ${g.energy < 1 ? 'disabled' : ''}><span class="card-cost">1</span>${icon('swords')}<h3>破绽突进</h3><p>${damage + g.boost} 点伤害<br>撕开对方防线</p></button><button class="card" data-card="guard" ${g.energy < 1 ? 'disabled' : ''}><span class="card-cost">1</span>${icon('shield')}<h3>稳住护架</h3><p>${12 + (state.modules.body === 2 ? 3 : 0) + (globalThis.RPG?.bonus(state).guard || 0)} 点格挡<br>抵消本回合受击</p></button><button class="card" data-card="read" ${g.energy < 1 ? 'disabled' : ''}><span class="card-cost">1</span>${icon('scan-eye')}<h3>因果读招</h3><p>下次攻击 +8<br>获得 5 格挡，显示意图</p></button></div><div class="game-status"><span class="energy-display">行动力 ${'◆'.repeat(g.energy)}${'◇'.repeat(Math.max(0, 3 - g.energy))} ${g.energy}</span><span>每回合恢复 3 点</span></div><div class="game-buttons">${button('combat-assist', icon('cpu') + ' 神经超频 · 10 算力')}${button('combat-end', '结束回合 ' + icon('arrow-right'), 'primary')}</div>`;
    host.querySelectorAll('[data-card]').forEach(b => b.addEventListener('click', () => {
      if (g.energy < 1 || g.finished) return; g.energy--; hooks.sound('tap');
      if (b.dataset.card === 'strike') { const hit = damage + g.boost; const blocked = Math.min(g.shield, hit); g.shield -= blocked; g.enemy = Math.max(0, g.enemy - hit + blocked); g.boost = 0; g.log = `你逼入空当，造成 ${hit - blocked} 点伤害${blocked ? '，' + blocked + ' 点被格挡' : ''}。`; }
      if (b.dataset.card === 'guard') { const block = 12 + (state.modules.body === 2 ? 3 : 0) + (globalThis.RPG?.bonus(state).guard || 0); g.block += block; g.log = `你稳住重心。获得 ${block} 点格挡。`; }
      if (b.dataset.card === 'read') { g.boost += 8; g.block += 5; g.reveal = true; g.log = '他的下一步已经写在肩膀上。下次攻击 +8，格挡 +5。'; }
      changed(); if (g.enemy <= 0) finish('success'); else render();
    }));
    bind('combat-assist', () => {
      if (g.assistedTurn === g.turn) return;
      if (!TS.spend(state, 10)) { hooks.toast('算力不足。当前手牌仍然可以完成对决。'); return; }
      g.energy++; g.assistedTurn = g.turn; g.log = '天枢接管一瞬。获得 1 点额外行动力。'; changed(); render();
    });
    $('combat-assist').disabled = g.assistedTurn === g.turn || state.stats.compute < 10;
    bind('combat-end', () => {
      const hit = Math.max(0, combatDamage(move, g.turn) - g.block); g.hp = Math.max(0, g.hp - hit); g.block = 0; g.shield = move.shield;
      g.log = `陆沉使出${move.name}。${hit ? '你受到 ' + hit + ' 点伤害。' : '你完整挡住了这一击。'}`;
      g.turn++; g.energy = COMBAT_ENERGY_PER_TURN; changed(); if (g.hp <= 0) finish('fail'); else render();
    });
  }
  function tick(dt) {
    if (['bargain', 'supply'].includes(kind)) return;
    if (['salvage', 'memory'].includes(kind)) { Arcade.tick(dt); return; }
    if (!g || g.finished) return;
    if (kind === 'quiz' && g.answered === null) { g.remaining -= dt; quizMeter(); if (g.remaining <= 0) answer(-1); }
    if (kind === 'qte' && g.running) {
      g.elapsed += dt; g.position = .5 - .5 * Math.cos(g.elapsed * Math.PI / 1.9);
      if ($('qte-cursor')) $('qte-cursor').style.left = `${g.position * 100}%`;
      if ($('qte-time')) $('qte-time').textContent = `剩余 ${Math.max(0, Math.ceil(QTE_SECONDS - g.elapsed))} 秒`;
      if (g.elapsed >= QTE_SECONDS) { g.result = 'fail'; g.running = false; changed(); render(); }
    }
  }
  function key() { if (kind === 'qte') qteAction(); else if (['salvage', 'memory'].includes(kind)) Arcade.action(); }
  function stop() { globalThis.Commerce?.stop(); g = null; host = null; globalThis.Arcade?.stop(); }
  return { start, tick, key, stop, limits };
})();
