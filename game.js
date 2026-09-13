'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = name => `<i data-lucide="${name}"></i>`;
  const icons = () => window.lucide?.createIcons();
  const key = 'tianshu-v3-';
  function read(name) { try { return localStorage.getItem(key + name); } catch { return null; } }
  let state = TS.restore(read('auto')) || TS.fresh();
  let selectedPlace = CONTENT.nodes[TS.available(state)[0] || 'finale'].place;
  let selectedEvent = null, paused = false, panelName = '', textIndex = 0, textElapsed = 0, autoElapsed = 0, lastTick = 0, saveElapsed = 0, storageWarned = false;
  let zoom = 1, panX = 0, panY = 0, audioContext, audioGain, mediaToken = 0;
  const mapReady = () => !!window.Campus3D?.ready();
  function mapMode(mode) {
    if (!mapReady()) return;
    Campus3D.setMode(mode, selectedPlace);
    Campus3D.setActive(!state.active);
  }
  function nearPlace(place) {
    const id = TS.available(state).find(n => CONTENT.nodes[n].place === place);
    $('near-interact').disabled = !id;
    $('near-interact').querySelector('span').textContent = id ? CONTENT.nodes[id].title : '暂无附近事件';
    $('near-interact').dataset.node = id || '';
    const found = RPG.ensure(state).found.includes(place);
    $('near-discover').disabled = !place || found;
    $('near-discover').dataset.place = place || '';
    $('near-discover').querySelector('span').textContent = found ? '记忆已归档' : place ? '调查 · ' + CONTENT.places[place].name : '调查附近';
  }
  function syncMap() {
    if (mapReady()) Campus3D.update({ available: TS.available(state), selected: selectedPlace, night: state.time === '夜晚', motion: state.settings.motion, exploration: Exploration.ensure(state), equipped: RPG.ensure(state).equipped });
  }
  function objectNear(o) {
    $('world-interact').disabled=!o;
    $('world-interact').querySelector('span').textContent=o?o.name:'附近没有可互动对象';
  }
  function closeWorldDialog() { $('world-dialog').close(); Campus3D.setActive(!state.active); }
  function worldInteract(o, choice) {
    if(state.active)return;
    if(o.type==='door'){Campus3D.enterInterior(o.destination);return;}
    if(o.type==='exit'){Campus3D.exitInterior();return;}
    const result=Exploration.act(state,o.id,choice); save();hud(); if(result.reward)sound('win');else sound('soft');
    $('world-dialog-title').textContent=o.name;
    $('world-dialog-type').textContent={npc:'校园见闻 / 对话',quest:'校史寻踪 / 委托',chest:'行囊 / 探索发现',pc:'校园网络 / 终端',stamp:'校史寻踪 / 印章',switch:'实验楼 / 电力系统',puzzle:'校园异常 / 现场推理',note:'记忆碎片 / 调查'}[o.type]||'校园见闻';
    $('world-dialog-text').textContent=result.text;
    const actions=$('world-dialog-actions');actions.replaceChildren();
    function action(text,fn,primary=false){const b=document.createElement('button');b.className=primary?'primary':'secondary';b.textContent=text;b.onclick=fn;actions.appendChild(b);}
    if(result.choices){
      // Puzzles answer in place: the dialog stays open and re-renders with the verdict.
      for(const c of result.choices)action(c.text,()=>worldInteract(o,c.id));
    }else{
      const story=TS.available(state).find(id=>CONTENT.nodes[id].place===o.zone&&!CONTENT.nodes[id].repeatable);
      if(o.type==='pc'){
        const allowed=TS.available(state).includes(o.game);
        $('world-dialog-text').textContent=allowed?(o.game==='salvage'?'回收机已启动。抓取高价值零件，别让废铁耗尽时间。首胜奖励 ¥180 与 60 EXP。':'终端正在重放一段破碎的记忆。依次复原三组信号，首胜奖励 ¥180 与 60 EXP。'):'终端等待天枢连接。先完成宿舍里的“命运重启”剧情，再来启动小游戏。';
        if(allowed)action('开始 · '+CONTENT.nodes[o.game].title,()=>{closeWorldDialog();enter(o.game);},true);
        if(o.zone==='gate')action('查看补给与装备',()=>{closeWorldDialog();openPanel('rpg');});
      }
      if(o.type==='npc'&&story)action('谈谈 · '+CONTENT.nodes[story].title,()=>{closeWorldDialog();enter(story);},true);
      action(result.reward?'收好，继续探索':'继续探索',closeWorldDialog,!actions.children.length);
    }
    Campus3D.setActive(false);
    if(!$('world-dialog').open)$('world-dialog').showModal();
    icons();
  }
  const stats = { intelligence: '智力', compute: '算力', reputation: '声望', cash: '财富', physique: '体魄', spirit: '精神' };
  const role = { 陈旭: '重生者 · 天枢宿主', 天枢: '量子智脑 · 意识连接', 林晚: '经管系新生', 苏祁: '室友 · 技术搭档', 顾清河: '计算机学院教授', 赵天宇: '同届学生', 陆沉: '未知协议宿主' };
  function toast(text, warning = false) {
    const el = document.createElement('div'); el.className = 'toast' + (warning ? ' warn' : ''); el.textContent = text;
    $('toasts').appendChild(el); while ($('toasts').children.length > 3) $('toasts').firstChild.remove();
    setTimeout(() => el.remove(), 4000);
  }
  function save(name = 'auto', quiet = true) {
    try { state.savedAt = new Date().toISOString(); localStorage.setItem(key + name, JSON.stringify(state)); $('saved-status').textContent = '进度已记录'; if (!quiet) toast('已写入存档 ' + name); return true; }
    catch { if (!storageWarned) { toast('浏览器无法写入本地存档，可在存档面板导出进度。', true); storageWarned = true; } return false; }
  }
  function sound(type = 'tap') {
    if (!state.settings.volume) return;
    try {
      audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
      audioContext.resume(); const osc = audioContext.createOscillator(), gain = audioContext.createGain();
      osc.connect(gain); gain.connect(audioContext.destination); const now = audioContext.currentTime;
      osc.type = 'sine'; osc.frequency.setValueAtTime(type === 'win' ? 523 : type === 'soft' ? 220 : 660, now); osc.frequency.exponentialRampToValueAtTime(type === 'win' ? 784 : 440, now + .16);
      gain.gain.setValueAtTime(.055 * state.settings.volume, now); gain.gain.exponentialRampToValueAtTime(.001, now + .25); osc.start(now); osc.stop(now + .27);
    } catch { /* Audio is optional when the browser blocks an audio context. */ }
  }
  function hud() {
    RPG.ensure(state);
    const exploration=Exploration.ensure(state);
    $('stamp-progress').textContent=exploration.stamps.length+' / 8';
    $('exploration-progress').textContent=exploration.claimed?'校史寻踪已完成':exploration.stamps.length===8?'前往学生会馆交付印章':`已探索 ${exploration.visited.length} 处室内 · 打开 ${exploration.opened.length} 个宝箱`;
    $('host-level').textContent = 'Lv.' + RPG.level(state);
    $('host-xp').textContent = state.rpg.xp + ' EXP';
    $('top-stats').innerHTML = `<div class="top-stat">${icon('cpu')}<div><small>可用算力</small><b>${Math.round(state.stats.compute)} <small>/ ${state.stats.maxCompute}</small></b></div></div><div class="top-stat">${icon('wallet')}<div><small>财富</small><b>¥ ${state.stats.cash.toLocaleString()}</b></div></div><div class="top-stat">${icon('sparkles')}<div><small>校园声望</small><b>${state.stats.reputation}</b></div></div>`;
    $('cine-compute').textContent = `${Math.round(state.stats.compute)} / ${state.stats.maxCompute}`;
    $('system-label').textContent = !state.done.length ? '天枢 · 等待接入' : state.stats.compute ? '天枢 · 意识连接正常' : '天枢 · 自主行动模式';
    const unread = state.messages.filter(m => !m.read).length; $('message-count').textContent = unread; $('message-count').hidden = !unread;
    $('date').textContent = `2018.09.${String(state.day + 2).padStart(2, '0')} · ${state.time}`;
    document.body.classList.toggle('night', state.time === '夜晚'); document.body.classList.toggle('reduce-motion', !state.settings.motion);
    syncMap();
    icons();
  }
  function renderMap() {
    hud();
    const available = TS.available(state), next = CONTENT.main.find(id => !state.done.includes(id)), count = CONTENT.main.filter(id => state.done.includes(id)).length;
    $('progress').textContent = `${String(count).padStart(2, '0')} / 10`; $('progress-fill').style.width = `${count * 10}%`;
    $('quest-title').textContent = next ? CONTENT.nodes[next].title : '第一章 · 命运已改写';
    $('quest-lead').textContent = next ? CONTENT.nodes[next].lead : '你留下的每一个选择，都成为这次重启的一部分。';
    const sides = available.filter(id => !CONTENT.nodes[id].main);
    $('side-count').textContent = `${sides.length} 条可探索`;
    $('event-list').innerHTML = sides.length ? sides.map(id => `<button class="event-row" data-event="${id}">${icon('message-square')}<span><strong>${CONTENT.nodes[id].title}</strong><small>${CONTENT.places[CONTENT.nodes[id].place].name} · 支线事件</small></span></button>`).join('') : `<p class="event-empty">${state.done.length ? '暂时没有新的约定。<br>继续前行，故事正在发生。' : '熟悉的校园，新的开始。<br>有人正在宿舍等你。'}</p>`;
    const pinHost = $(mapReady() ? 'pins-3d' : 'pins');
    pinHost.innerHTML = Object.entries(CONTENT.places).map(([id, p]) => {
      const events = available.filter(n => CONTENT.nodes[n].place === id), isMain = events.some(n => CONTENT.nodes[n].main);
      return `<button class="pin ${isMain ? 'main' : events.length ? 'side' : ''} ${selectedPlace === id ? 'selected' : ''}" data-place="${id}" style="left:${p.x}%;top:${p.y}%" aria-label="${p.name}${isMain ? ' · 主线可进入' : events.length ? ' · 支线可进入' : ''}"><span class="pin-mark">${icon(p.icon)}</span><span class="pin-name">${p.name}</span>${events.length ? `<span class="pin-flag">${isMain ? '!' : '?'}</span>` : ''}</button>`;
    }).join('');
    pinHost.querySelectorAll('[data-place]').forEach(b => b.addEventListener('click', () => { selectedPlace = b.dataset.place; selectedEvent = null; sound(); renderMap(); }));
    $('event-list').querySelectorAll('[data-event]').forEach(b => b.addEventListener('click', () => selectEvent(b.dataset.event)));
    renderLocation(); fitMap(); icons();
    syncMap();
  }
  function selectEvent(id) { selectedPlace = CONTENT.nodes[id].place; selectedEvent = id; renderMap(); }
  function renderLocation() {
    const p = CONTENT.places[selectedPlace], available = TS.available(state).filter(id => CONTENT.nodes[id].place === selectedPlace);
    const event = available.includes(selectedEvent) ? selectedEvent : available[0]; selectedEvent = event || null;
    const n = CONTENT.nodes[event], done = Object.entries(CONTENT.nodes).filter(([id, node]) => node.place === selectedPlace && state.done.includes(id)).length;
    $('location-sheet').innerHTML = `<div class="location-photo" style="background-position:${p.x}% ${p.y}%"><span>${p.en}</span></div><div class="location-body"><div class="location-meta"><span>${n ? n.main ? '主线事件' : '羁绊支线' : '校园地点'}</span><span>${n ? n.day > state.day ? '第 ' + n.day + ' 日 · ' + n.time : n.time : '已记录 ' + done + ' 段故事'}</span></div><h2>${n ? n.title : p.name}</h2><p>${n ? n.lead : p.detail}</p>${available.length > 1 ? `<div class="location-events">${available.map(id => `<button class="event-chip ${event === id ? 'active' : ''}" data-pick="${id}">${CONTENT.nodes[id].main ? '主线' : '支线'} · ${CONTENT.nodes[id].title}</button>`).join('')}</div>` : ''}<div class="location-actions">${n ? `<button class="primary" id="enter-event" data-node="${event}"><span>${event === 'intro' ? '开启这次人生' : '前往 · ' + p.name}</span>${icon('arrow-right')}</button><button class="secondary walk-button" id="enter-walk" title="切入该地点的局部三维地图">${icon('footprints')}步行探索</button><p class="location-note">${n.main ? '命运节点' : '自由探索'} <span> / </span> ${n.kind === 'choice' ? '剧情选择' : { quiz: '认知演算', qte: '精准时机', circuit: '线索取证', combat: '战术对决', salvage: '零件回收', memory: '记忆复原' }[n.kind]}</p>` : `<button class="primary" id="location-rest">${icon('coffee')}<span>停留片刻 · 恢复 20 算力</span></button><button class="secondary walk-button" id="enter-walk" title="切入该地点的局部三维地图">${icon('footprints')}步行探索</button>`}</div></div>`;
    $('enter-event')?.addEventListener('click', () => enter(event));
    $('location-rest')?.addEventListener('click', rest);
    if ($('enter-walk')) $('enter-walk').hidden = !mapReady();
    $('enter-walk')?.addEventListener('click', () => mapMode('walk'));
    $('location-sheet').querySelectorAll('[data-pick]').forEach(b => b.addEventListener('click', () => selectEvent(b.dataset.pick)));
    if (mapReady()) $('location-sheet').querySelector('.location-photo').style.backgroundImage = `url('${Campus3D.preview(selectedPlace)}')`;
  }
  function rest() { if (state.stats.compute >= state.stats.maxCompute) { toast('精力充足，去看看校园里正在发生的事吧。'); return; } TS.effect(state, { compute: 20 }); state.rest++; save(); renderMap(); sound('soft'); toast('停下来听了一会儿风声。算力 +20。'); }
  function fitMap() {
    if (mapReady()) { Campus3D.resize(); return; }
    const vp = $('map-viewport'), width = vp.clientWidth, height = vp.clientHeight;
    const small = width <= 800, base = small ? Math.max(width * 1.8, height * 1.25) : Math.max(width, height * 16 / 9);
    const h = base * 9 / 16, offsetY = small ? Math.max(55, (height - h) * .12) : (height - h) / 2;
    Object.assign($('map-plane').style, { width: base + 'px', height: h + 'px', left: (width - base) / 2 + 'px', top: offsetY + 'px', transform: `translate(${panX}px, ${panY}px) scale(${zoom})` });
  }
  function setMedia(media, position) {
    const token = ++mediaToken, video = $('scene-video'); video.pause(); video.classList.remove('ready'); $('media-note').hidden = true;
    $('scene-image').style.backgroundImage = `url('assets/${['rain', 'awake', 'library', 'linwan'].includes(media) ? media + '.jpg' : 'campus.png'}')`;
    $('scene-image').style.backgroundPosition = position || '50% 50%';
    if (media === 'campus') { video.removeAttribute('src'); video.load(); return; }
    video.src = `assets/video/${media}.mp4`; video.muted = true;
    video.oncanplay = () => { if (token !== mediaToken) return; video.classList.add('ready'); if (!paused && !panelName) video.play().catch(() => {}); };
    video.onerror = () => { if (token === mediaToken) { video.classList.remove('ready'); $('media-note').hidden = false; } };
    video.load();
  }
  function enter(id) {
    if (!TS.available(state).includes(id)) return;
    const n = CONTENT.nodes[id]; state.active = { id, phase: 'shots', shot: 0, game: null }; if (n.main) { state.day = n.day; state.time = n.time; }
    paused = false; $('pause-shade').hidden = true; $('cinema').hidden = false; $('world').inert = true; window.Campus3D?.setActive(false); sound(); save(); showActive();
  }
  function showActive() {
    if (!state.active) return; const a = state.active, n = CONTENT.nodes[a.id];
    window.Campus3D?.setActive(false);
    $('cinema').hidden = false; $('world').inert = true; $('scene-title').textContent = n.title; $('scene-chapter').textContent = n.subtitle; hud();
    if (a.phase === 'shots') showShot();
    else if (a.phase === 'inter') { setMedia(n.shots.at(-1).media, n.shots.at(-1).position); interaction(); }
    else { setMedia(n.shots.at(-1).media, n.shots.at(-1).position); showResult(); }
  }
  function showShot() {
    const a = state.active, n = CONTENT.nodes[a.id], sh = n.shots[a.shot];
    MiniGames.stop(); $('dialogue').hidden = false; $('interaction').hidden = true; $('skip').hidden = false;
    $('speaker').textContent = sh.who || '江城 · 2018'; $('speaker-role').textContent = role[sh.who] || '记忆片段';
    $('subtitle').textContent = ''; textIndex = 0; textElapsed = 0; autoElapsed = 0;
    $('shot-number').textContent = `${String(a.shot + 1).padStart(2, '0')} / ${String(n.shots.length).padStart(2, '0')}`;
    $('shot-track').innerHTML = n.shots.map((_, i) => `<span class="${i <= a.shot ? 'done' : ''}"></span>`).join('');
    $('auto-play').innerHTML = `自动 <span>${state.settings.auto ? '开' : '关'}</span>`;
    setMedia(sh.media, sh.position);
    const historyId = `${a.id}:${a.shot}`;
    if (!state.history.some(h => h.id === historyId)) state.history.push({ id: historyId, who: sh.who || '旁白', text: sh.text });
    save(); icons();
  }
  function nextLine() {
    if (paused || panelName || !state.active || state.active.phase !== 'shots') return;
    const a = state.active, n = CONTENT.nodes[a.id], sh = n.shots[a.shot];
    if (textIndex < sh.text.length) { textIndex = sh.text.length; $('subtitle').textContent = sh.text; autoElapsed = 0; return; }
    if (a.shot < n.shots.length - 1) { a.shot++; sound('tap'); showShot(); }
    else { a.phase = 'inter'; save(); interaction(); }
  }
  function interaction() {
    const a = state.active, n = CONTENT.nodes[a.id]; $('dialogue').hidden = true; $('interaction').hidden = false; $('skip').hidden = true;
    $('interaction').innerHTML = '<div class="encounter" id="encounter"></div>';
    if (n.kind !== 'choice') {
      MiniGames.start(n.kind, $('encounter'), state, { save, hud, toast, icons, sound, finish: complete }); return;
    }
    $('encounter').innerHTML = `<div class="eyebrow">${icon('git-branch')} 命运分歧</div><h2>${n.question}</h2><p>天枢等待你的决定。</p>${n.choices.map((c, i) => {
      const { locked, poor } = TS.choiceState(state, a.id, i);
      return `<button class="choice" data-choice="${i}" ${locked || poor ? 'disabled' : ''}><span class="choice-index">0${i + 1}</span><span><strong>${c.text}</strong><small>${locked ? (c.lockedHint || '尚未取得所需证据') : poor ? '算力不足 · 需要 ' + c.cost : c.hint}</small></span>${icon(locked ? 'lock-keyhole' : 'arrow-up-right')}</button>`;
    }).join('')}`;
    $('encounter').querySelectorAll('[data-choice]').forEach(b => b.addEventListener('click', () => {
      if (!TS.choose(state, a.id, Number(b.dataset.choice))) return;
      sound('tap'); state.history.push({ id: `${a.id}:choice`, who: '陈旭 · 选择', text: n.choices[Number(b.dataset.choice)].text });
      complete('success', n.choices[Number(b.dataset.choice)].response);
    })); icons();
  }
  function complete(result, text) {
    const a = state.active; if (!a || a.phase !== 'inter') return;
    const n = CONTENT.nodes[a.id], firstWin=n.repeatable&&result!=='fail'&&!RPG.ensure(state).records[a.id]?.won, score=a.game?.score||0, levelBefore = RPG.level(state); if (!TS.complete(state, a.id, result)) return;
    if (RPG.level(state) > levelBefore) toast('宿主突破 · Lv.' + RPG.level(state) + '，攻击与生命已提升');
    MiniGames.stop(); a.phase = 'result'; a.game = null; a.text = text || (result === 'fail' ? n.fail : n.success); a.outcome = result;
    if(n.repeatable)a.text+=` 本次成绩 ${score}，最高纪录 ${RPG.ensure(state).records[a.id].best}。`+(firstWin?' 首胜奖励：¥180、60 EXP、10 算力。':' 首胜奖励仅领取一次，可继续挑战最高纪录。');
    state.history.push({ id: `${a.id}:result`, who: '命运记录', text: a.text }); save(); hud(); showResult(); sound('win');
  }
  function fxText(fx = {}) {
    const lines = []; for (const [k, label] of Object.entries(stats)) if (fx[k]) lines.push(`${label} ${fx[k] > 0 ? '+' : ''}${fx[k]}`);
    for (const [k, v] of Object.entries(fx.bonds || {})) lines.push(`${CONTENT.people[k].name} ${v > 0 ? '+' : ''}${v}`);
    if (fx.flags?.includes('evidence')) lines.push('完整证据已归档'); if (fx.module) lines.push(CONTENT.modules[fx.module].name + ' Lv.1'); return lines;
  }
  function showResult() {
    const a = state.active, n = CONTENT.nodes[a.id], choice = n.choices?.[state.choices[a.id]], rewards = [...fxText(choice?.fx), ...fxText(a.outcome === 'fail' ? n.fallback : n.reward)];
    $('dialogue').hidden = true; $('skip').hidden = true; $('interaction').hidden = false;
    $('interaction').innerHTML = `<div class="encounter"><div class="result-seal">${icon(a.outcome === 'perfect' ? 'sparkles' : 'check')}</div><div class="eyebrow">${a.outcome === 'perfect' ? '精准命中' : a.outcome === 'fail' ? '另一种前进' : '命运已发生偏移'}</div><h2>${n.title}</h2><p class="result-text">${esc(a.text)}</p><div class="reward-list">${rewards.map(r => `<span>${r}</span>`).join('')}</div><button class="primary" id="back-campus">${a.id === 'finale' ? '查看我的首章结局' : '回到校园'}${icon('arrow-right')}</button></div>`;
    $('back-campus').addEventListener('click', () => { const ended = a.id === 'finale'; leaveScene(); if (ended) openPanel('ending'); }); icons();
  }
  function leaveScene() {
    state.active = null; paused = false; MiniGames.stop(); $('cinema').hidden = true; $('world').inert = false; $('scene-video').pause(); $('pause-shade').hidden = true; window.Campus3D?.setActive(true);
    const next = TS.available(state).find(id => CONTENT.nodes[id].main) || TS.available(state)[0]; if (next) { selectedPlace = CONTENT.nodes[next].place; selectedEvent = next; }
    save(); renderMap();
  }
  function togglePause(force) { paused = typeof force === 'boolean' ? force : !paused; $('pause-shade').hidden = !paused; if (paused) $('scene-video').pause(); else if (!panelName) $('scene-video').play().catch(() => {}); save(); }
  const panelTitles = { rpg: ['HOST RECORD / LEVEL & EQUIPMENT', '成长与行囊'], modules: ['TIANSHU / NEURAL SYSTEM', '天枢 · 意识中枢'], people: ['CONNECTIONS', '与你相连的人'], phone: ['MESSAGES', '口袋里的消息'], timeline: ['FATE ARCHIVE', '命运轨迹'], saves: ['MEMORY SLOTS', '保存这一刻'], settings: ['PREFERENCES', '偏好设置'], history: ['STORY LOG', '台词回顾'], ending: ['CHAPTER COMPLETE', '你的第一章'] };
  function openPanel(name) {
    if (name === 'ending' && !state.ending) return;
    panelName = name; $('scene-video').pause(); window.Campus3D?.setActive(false);
    [$('panel-eyebrow').textContent, $('panel-title').textContent] = panelTitles[name];
    panelBody(); if (!$('panel').open) $('panel').showModal(); icons();
  }
  function closePanel() { $('panel').close(); panelName = ''; if (state.active && !paused) $('scene-video').play().catch(() => {}); window.Campus3D?.setActive(!state.active); save(); hud(); }
  function panelBody() {
    const body = $('panel-body');
    if (panelName === 'rpg') { GrowthUI.render(body, state, { save, hud, sound, toast, icons }); return; }
    if (panelName === 'modules') {
      body.innerHTML = `<p class="panel-intro">宿主：陈旭 / 意识同步率 97.3%<br>当前可用算力 <b>${state.stats.compute}</b> / ${state.stats.maxCompute}</p><div class="stat-grid">${Object.entries(stats).map(([k, n]) => `<div class="stat-tile"><span>${n}</span><strong>${state.stats[k]}</strong></div>`).join('')}</div>${Object.entries(CONTENT.modules).map(([id, m]) => `<div class="module-row"><div class="module-icon">${icon(m.icon)}</div><div><h3>${m.name}<small>Lv.${state.modules[id]} / 2</small></h3><p>${state.modules[id] ? m.desc[state.modules[id] - 1] : '尚未接入'}${state.modules[id] < 2 ? '<br>下一阶：' + m.desc[state.modules[id]] : ''}</p></div><button class="primary" data-upgrade="${id}" ${state.modules[id] >= 2 || state.stats.compute < m.cost[state.modules[id]] ? 'disabled' : ''}>${state.modules[id] >= 2 ? icon('check') + ' 已满级' : icon('plus') + m.cost[state.modules[id]] + ' 算力'}</button></div>`).join('')}<div class="panel-actions"><button class="secondary" id="rest-panel" ${state.active ? 'disabled' : ''}>${icon('coffee')}休息恢复 · 20 算力</button></div>`;
      body.querySelectorAll('[data-upgrade]').forEach(b => b.addEventListener('click', () => { if (TS.upgrade(state, b.dataset.upgrade)) { save(); hud(); sound('win'); toast(CONTENT.modules[b.dataset.upgrade].name + ' 已升级'); panelBody(); } }));
      $('rest-panel').addEventListener('click', () => { rest(); panelBody(); });
    }
    if (panelName === 'people') body.innerHTML = `<p class="panel-intro">有些关系，不在最优解里。<br>羁绊达到 20，解锁一段不曾说出口的往事。</p><div class="people-grid">${Object.entries(CONTENT.people).map(([id, p]) => `<article class="person"><div class="person-head"><div class="avatar" style="color:${p.color};${p.image ? 'background-image:url(' + p.image + ')' : ''}">${p.image ? '' : p.initial}</div><div><h3>${p.name}</h3><div class="role">${p.role}</div></div></div><p>${p.bio}</p><div class="bond-info"><span>${state.bonds[id] >= 35 ? '默契相知' : state.bonds[id] >= 20 ? '渐渐靠近' : state.bonds[id] ? '初识' : '尚待相遇'}</span><span>${state.bonds[id]} / 100</span></div><div class="bond-track"><span style="width:${state.bonds[id]}%;background:${p.color}"></span></div><p class="secret ${state.bonds[id] < 20 ? 'locked' : ''}">${state.bonds[id] >= 20 ? p.secret : '一段尚未解锁的往事 · 羁绊 20'}</p></article>`).join('')}</div>`;
    if (panelName === 'phone') {
      body.innerHTML = state.messages.length ? [...state.messages].reverse().map(m => {
        const data = CONTENT.messages[m.id], p = CONTENT.people[data.person];
        return `<article class="thread"><div class="thread-head"><div class="avatar small" style="color:${p.color}">${p.initial}</div><div>${p.name}<small>${m.read ? '已读' : '新消息'}</small></div></div><p class="chat-bubble">${data.text}</p>${m.reply !== null ? `<p class="chat-bubble self">${data.replies[m.reply].text}</p><p class="chat-bubble">${data.replies[m.reply].response}</p>` : `<div class="reply-row">${data.replies.map((r, i) => `<button class="secondary" data-reply="${m.id}:${i}">${r.text}</button>`).join('')}</div>`}</article>`;
      }).join('') : '<div class="empty-state">手机还很安静。<br>走进校园，故事会慢慢来到这里。</div>';
      state.messages.forEach(m => m.read = true); save(); hud();
      body.querySelectorAll('[data-reply]').forEach(b => b.addEventListener('click', () => { const [id, i] = b.dataset.reply.split(':'); if (TS.reply(state, id, Number(i))) { sound(); save(); hud(); panelBody(); } }));
    }
    if (panelName === 'timeline') {
      body.innerHTML = `<p class="panel-intro">已改写 ${state.done.length} / ${Object.keys(CONTENT.nodes).length} 段命运 · 首章结局 ${state.ending ? '1' : '0'} / 3</p>${state.ending ? `<button class="secondary" id="ending-open">${icon('award')} ${state.ending.title}</button><br><br>` : ''}<div class="timeline">${CONTENT.main.map(id => {
        const n = CONTENT.nodes[id], done = state.done.includes(id), current = TS.available(state).includes(id), c = n.choices?.[state.choices[id]];
        return `<div class="timeline-item ${done ? 'complete' : current ? '' : 'locked'}"><h3>${done || current ? n.title : '尚未发生的故事'}</h3><small>${n.subtitle} · ${CONTENT.places[n.place].name}</small>${done ? `<p>${c ? '你选择了：' + c.text : state.results[id] === 'fail' ? '你找到了另一种前进的方式。' : '你完成了这次挑战。'}</p><button class="secondary" data-review="${id}">${icon('history')} 回顾这一幕</button>` : current ? '<p>当前命运节点</p>' : ''}</div>`;
      }).join('')}</div>`;
      $('ending-open')?.addEventListener('click', () => openPanel('ending'));
      body.querySelectorAll('[data-review]').forEach(b => b.addEventListener('click', () => { openPanel('history'); const id = b.dataset.review; $('panel-body').innerHTML = state.history.filter(h => h.id.startsWith(id + ':')).map(historyHtml).join(''); }));
    }
    if (panelName === 'history') body.innerHTML = state.history.length ? state.history.map(historyHtml).join('') : '<div class="empty-state">尚未留下台词记录。</div>';
    if (panelName === 'saves') {
      body.innerHTML = `<p class="panel-intro">当前进度：第 ${state.day} 日 · ${state.done.length} 段故事已记录。<br>自动存档会在剧情推进、选择与战术行动后更新。</p>${[1, 2, 3].map(i => {
        const s = TS.restore(read('slot' + i));
        return `<div class="save-row"><span class="save-number">0${i}</span><div class="save-detail"><h3>${s ? s.ending?.title || (s.active ? CONTENT.nodes[s.active.id].title : '第 ' + s.day + ' 日 · 校园') : '空白记忆'}</h3><p>${s ? s.done.length + ' 段故事 · ' + (s.savedAt ? new Date(s.savedAt).toLocaleString('zh-CN') : '') : '尚未写入记录'}</p></div><button class="secondary" data-save="${i}">写入</button><button class="secondary" data-load="${i}" ${s ? '' : 'disabled'}>读取</button></div>`;
      }).join('')}<div class="panel-actions"><button class="secondary" id="export">${icon('download')}导出进度</button><button class="secondary" id="import">${icon('upload')}导入进度</button><button class="secondary danger-button" id="new-game">${icon('rotate-ccw')}新的回溯</button></div>`;
      body.querySelectorAll('[data-save]').forEach(b => b.addEventListener('click', () => {
        const i = b.dataset.save; if (read('slot' + i)) confirmPanel('覆盖记忆 ' + i, '该存档槽原有记录将被当前进度替换。', () => { save('slot' + i, false); openPanel('saves'); }); else { save('slot' + i, false); panelBody(); }
      }));
      body.querySelectorAll('[data-load]').forEach(b => b.addEventListener('click', () => confirmPanel('读取这段记忆', '当前自动进度将由所选存档替换。', () => loadState(TS.restore(read('slot' + b.dataset.load))))));
      $('export').addEventListener('click', () => { save(); const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }), url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = 'tianshu-day' + state.day + '.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000); toast('进度已导出'); });
      $('import').addEventListener('click', () => $('import-file').click());
      $('new-game').addEventListener('click', () => confirmPanel('再次回到起点', '这会重置当前自动进度。三个手动存档会保留。', () => loadState(TS.fresh())));
    }
    if (panelName === 'settings') {
      body.innerHTML = `<div class="setting-row"><label for="volume">交互音量<small>按键与事件反馈</small></label><input id="volume" type="range" min="0" max="100" value="${state.settings.volume * 100}"><span class="setting-value" id="volume-value">${Math.round(state.settings.volume * 100)}%</span></div><div class="setting-row"><label for="text-speed">字幕速度<small>向右加快，最右端即时显示</small></label><input id="text-speed" type="range" min="0" max="65" value="${65 - state.settings.speed}"></div><div class="setting-row"><label for="setting-auto">自动推进字幕</label><input id="setting-auto" type="checkbox" ${state.settings.auto ? 'checked' : ''}></div><div class="setting-row"><label for="setting-motion">界面动态效果</label><input id="setting-motion" type="checkbox" ${state.settings.motion ? 'checked' : ''}></div><div class="panel-actions"><button class="secondary" id="fullscreen">${icon('maximize')}切换全屏</button></div><p class="panel-intro" style="margin-top:24px">天枢 · 重返江大 / 本地体验版 3.0<br>故事与人物延续天枢设定，游戏架构独立重建。</p>`;
      $('volume').addEventListener('input', e => { state.settings.volume = Number(e.target.value) / 100; $('volume-value').textContent = e.target.value + '%'; save(); });
      $('volume').addEventListener('change', () => sound());
      $('text-speed').addEventListener('input', e => { state.settings.speed = 65 - Number(e.target.value); save(); });
      $('setting-auto').addEventListener('change', e => { state.settings.auto = e.target.checked; save(); });
      $('setting-motion').addEventListener('change', e => { state.settings.motion = e.target.checked; hud(); save(); });
      $('fullscreen').addEventListener('click', async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch { toast('当前浏览器未开放全屏，可使用窗口最大化。'); } });
    }
    if (panelName === 'ending') {
      const e = state.ending;
      body.innerHTML = `<div class="ending-cover"><div class="eyebrow">第一章 · 命运已改写</div><h3>${e.title}</h3><span class="route-stamp">${e.tag}</span></div><p class="ending-copy">${e.text}</p><div class="stat-grid"><div class="stat-tile"><span>留下的故事</span><strong>${state.done.length}</strong></div><div class="stat-tile"><span>校园声望</span><strong>${state.stats.reputation}</strong></div><div class="stat-tile"><span>与你相连</span><strong>${Object.values(state.bonds).reduce((a, b) => a + b, 0)}</strong></div></div><p class="ending-next">未完的记录 / 第二章线索<br>${state.flags.includes('oldhost') ? '顾清河留下的门禁卡，打开了一间七年无人进入的实验室。' : '陆沉发来一段录音。里面的声音，和天枢一模一样。'}</p><div class="panel-actions"><button class="primary" id="ending-back">回到校园${icon('arrow-right')}</button><button class="secondary" id="ending-save">${icon('bookmark')}保存这次人生</button></div>`;
      $('ending-back').addEventListener('click', closePanel); $('ending-save').addEventListener('click', () => openPanel('saves'));
    }
    icons();
  }
  function historyHtml(h) { return `<div class="backlog-line"><small>${esc(h.who)}</small><p>${esc(h.text)}</p></div>`; }
  function confirmPanel(title, text, action) {
    $('panel-title').textContent = title;
    $('panel-body').innerHTML = `<p class="panel-intro">${text}</p><div class="panel-actions"><button class="primary" id="confirm-yes">确认${icon('check')}</button><button class="secondary" id="confirm-no">取消</button></div>`;
    $('confirm-yes').addEventListener('click', action); $('confirm-no').addEventListener('click', () => openPanel('saves')); icons();
  }
  function loadState(s) {
    if (!s) { toast('存档无法读取，当前进度已保留。', true); return; }
    closePanel(); state = s; paused = false; MiniGames.stop(); $('pause-shade').hidden = true; panelName = ''; save();
    selectedPlace = CONTENT.nodes[TS.available(state)[0] || 'finale'].place; selectedEvent = null;
    renderMap(); if (state.active) showActive(); else { $('cinema').hidden = true; $('world').inert = false; $('scene-video').pause(); mapMode('overview'); }
    toast('记忆已恢复');
  }
  document.querySelectorAll('[data-panel]').forEach(b => b.addEventListener('click', () => openPanel(b.dataset.panel)));
  $('close-panel').addEventListener('click', closePanel);
  $('panel').addEventListener('cancel', e => { e.preventDefault(); closePanel(); });
  $('panel').addEventListener('click', e => { if (e.target === $('panel')) { const r = $('panel').getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) closePanel(); } });
  $('quest-jump').addEventListener('click', () => { const n = CONTENT.main.find(id => !state.done.includes(id)); if (n) selectEvent(n); else openPanel('ending'); });
  $('home').addEventListener('click', e => { e.preventDefault(); mapMode('overview'); zoom = 1; panX = panY = 0; fitMap(); });
  $('nav-map').addEventListener('click', () => { mapMode('overview'); zoom = 1; panX = panY = 0; renderMap(); });
  $('zoom-in').addEventListener('click', () => { if (mapReady()) Campus3D.zoom(-7); else { zoom = Math.min(1.8, zoom + .2); fitMap(); } });
  $('zoom-out').addEventListener('click', () => { if (mapReady()) Campus3D.zoom(7); else { zoom = Math.max(.8, zoom - .2); fitMap(); } });
  $('reset-map').addEventListener('click', () => { if (mapReady()) Campus3D.reset(); else { zoom = 1; panX = panY = 0; fitMap(); } });
  $('walk-toggle').addEventListener('click', () => mapMode(Campus3D.getMode() === 'walk' ? 'overview' : 'walk'));
  $('exit-walk').addEventListener('click', () => { if(Campus3D.getZone())Campus3D.exitInterior();else mapMode('overview'); });
  $('floor-map').addEventListener('click',()=>Campus3D.survey());
  $('world-interact').addEventListener('click',()=>Campus3D.interact());
  $('world-dialog-close').addEventListener('click',closeWorldDialog);
  $('world-dialog').addEventListener('cancel',e=>{e.preventDefault();closeWorldDialog();});
  $('near-interact').addEventListener('click', () => { const id = $('near-interact').dataset.node; if (id) enter(id); });
  $('near-discover').addEventListener('click', () => {
    const place = $('near-discover').dataset.place;
    if (RPG.discover(state, place)) { save(); hud(); nearPlace(place); sound('win'); toast(RPG.finds[place].name + ' · +' + RPG.finds[place].xp + ' EXP'); }
  });
  document.querySelectorAll('[data-weather]').forEach(b => b.addEventListener('click', () => {
    if (!mapReady()) return;
    Campus3D.setWeather(b.dataset.weather);
    document.querySelectorAll('[data-weather]').forEach(other => other.setAttribute('aria-pressed', String(other === b)));
  }));
  document.querySelectorAll('[data-direction]').forEach(b => {
    b.addEventListener('pointerdown', e => { e.preventDefault(); b.setPointerCapture(e.pointerId); Campus3D.controls(b.dataset.direction, true); });
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(event, () => Campus3D.controls(b.dataset.direction, false));
  });
  let drag = null;
  $('map-viewport').addEventListener('pointerdown', e => { if (e.target.closest('button')) return; drag = { x: e.clientX, y: e.clientY, panX, panY }; $('map-viewport').setPointerCapture(e.pointerId); });
  $('map-viewport').addEventListener('pointermove', e => { if (!drag) return; panX = TS.clamp(drag.panX + e.clientX - drag.x, -300, 300); panY = TS.clamp(drag.panY + e.clientY - drag.y, -180, 180); fitMap(); });
  $('map-viewport').addEventListener('pointerup', () => drag = null); $('map-viewport').addEventListener('pointercancel', () => drag = null);
  $('next-line').addEventListener('click', nextLine);
  $('subtitle').addEventListener('click', nextLine);
  $('skip').addEventListener('click', () => { if (state.active?.phase !== 'shots' || paused) return; state.active.phase = 'inter'; state.active.shot = CONTENT.nodes[state.active.id].shots.length - 1; const sh = CONTENT.nodes[state.active.id].shots.at(-1); setMedia(sh.media, sh.position); save(); interaction(); });
  $('pause').addEventListener('click', () => togglePause()); $('resume').addEventListener('click', () => togglePause(false));
  $('auto-play').addEventListener('click', () => { state.settings.auto = !state.settings.auto; $('auto-play').innerHTML = `自动 <span>${state.settings.auto ? '开' : '关'}</span>`; autoElapsed = 0; save(); });
  $('import-file').addEventListener('change', async e => {
    const file = e.target.files[0]; e.target.value = ''; if (!file) return;
    if (file.size > 1000000) { toast('存档文件过大，无法导入。', true); return; }
    try { const s = TS.restore(await file.text()); if (!s) toast('这不是有效的天枢 3.0 存档，当前进度已保留。', true); else confirmPanel('导入这段记忆', '当前自动进度将替换为导入文件中的记录。', () => loadState(s)); } catch { toast('文件读取失败，当前进度已保留。', true); }
  });
  document.addEventListener('keydown', e => {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
    if (e.code === 'Escape' && !panelName && state.active) { e.preventDefault(); togglePause(); return; }
    if (e.code !== 'Space' || e.repeat || panelName || paused || !state.active) return;
    e.preventDefault(); if (state.active.phase === 'shots') nextLine(); else if (state.active.phase === 'inter' && ['qte','salvage','memory'].includes(CONTENT.nodes[state.active.id].kind)) MiniGames.key();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { save(); if (state.active) togglePause(true); } });
  window.addEventListener('pagehide', () => save()); window.addEventListener('resize', fitMap);
  function frame(time) {
    const dt = Math.min((time - lastTick) / 1000 || 0, .1); lastTick = time;
    if (state.active && !paused && !panelName && !document.hidden) {
      if (state.active.phase === 'shots') {
        const sh = CONTENT.nodes[state.active.id].shots[state.active.shot];
        if (textIndex < sh.text.length) { textElapsed += dt * 1000; const step = state.settings.speed ? Math.floor(textElapsed / state.settings.speed) : sh.text.length; if (step) { textElapsed = 0; textIndex = Math.min(sh.text.length, textIndex + step); $('subtitle').textContent = sh.text.slice(0, textIndex); } }
        else if (state.settings.auto) { autoElapsed += dt; if (autoElapsed >= Math.max(3.5, sh.text.length * .085)) nextLine(); }
      } else if (state.active.phase === 'inter') MiniGames.tick(dt);
      saveElapsed += dt; if (saveElapsed >= 2) { saveElapsed = 0; save(); }
    }
    requestAnimationFrame(frame);
  }
  if (window.Campus3D) {
    Campus3D.init($('map3d'), {
      select: place => { selectedPlace = place; selectedEvent = null; renderMap(); },
      enter: place => { const id = TS.available(state).find(n => CONTENT.nodes[n].place === place); if (id) enter(id); else toast('这里暂时没有可触发的剧情。'); },
      near: nearPlace,
      object: objectNear,
      interact: worldInteract,
      zone: id=>{
        $('explore-place').textContent=id?Exploration.regions[id].name:CONTENT.places[selectedPlace].name;
        $('exit-walk').querySelector('span').textContent=id?'返回校园':'校园全景';
        $('mini-frame').querySelector('span').textContent=id?'室内平面 · 北 ↑':'江大 · 北 ↑';
        if(id){const w=Exploration.ensure(state);if(!w.visited.includes(id))w.visited.push(id);save();hud();}
      },
      mode: next => {
        const walking = next === 'walk'; document.body.classList.toggle('walking', walking);
        for (const id of ['walk-controls', 'mini-frame', 'explore-bar','exploration-journal']) $(id).hidden = !walking;
        $('explore-place').textContent = CONTENT.places[selectedPlace].name;
        $('walk-toggle').setAttribute('aria-pressed', String(walking));
        nearPlace(null);
      },
      weather: (night, wet) => { document.body.classList.toggle('world-night', night); document.querySelector('.weather').textContent = wet ? '雨 · 19°C' : night ? '夜 · 21°C' : '晴 · 24°C'; },
      error: err => toast('三维场景载入失败，已保留平面地图。', true)
    });
    $('map3d').hidden = !mapReady();
    document.body.classList.toggle('has-3d', mapReady());
    $('walk-toggle').hidden = !mapReady();
    document.querySelector('.weather-tools').hidden = !mapReady();
    if (mapReady()) Campus3D.setMode('overview');
  }
  renderMap(); if (state.active) showActive(); icons(); requestAnimationFrame(frame);
})();
