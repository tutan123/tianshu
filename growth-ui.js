'use strict';
globalThis.GrowthUI = (() => {
  const sessions = new WeakMap();
  const tabs = [['profile', '角色', 'user-round'], ['gear', '装备', 'shirt'], ['bag', '背包', 'backpack'], ['tasks', '任务', 'notebook-tabs']];
  const categories = { all: '全部', gear: '装备', supplies: '消耗品', evidence: '线索', memories: '收藏' };
  const bonusNames = { attack: '攻击加成', hp: '生命加成', guard: '格挡加成', time: '答题 / 回收时间', window: '精准窗口', reel: '回收速度', value: '回收价值' };
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = name => `<i data-lucide="${escape(name)}" aria-hidden="true"></i>`;
  const amount = (key, value, signed = true) => `${signed && value >= 0 ? '+' : ''}${Number((['window', 'reel', 'value'].includes(key) ? value * 100 : value).toFixed(2))}${['window', 'reel', 'value'].includes(key) ? '%' : key === 'time' ? ' 秒' : ''}`;
  const empty = (title, text, name = 'package-open') => `<div class="dossier-empty">${icon(name)}<h4>${escape(title)}</h4><p>${escape(text)}</p></div>`;
  const heading = (title, meta = '') => `<div class="dossier-section-heading"><h3>${escape(title)}</h3><span>${escape(meta)}</span></div>`;
  function bonuses(values, comparison = false) {
    return `<dl class="dossier-bonus-list">${Object.entries(values).map(([key, value]) => `<div><dt>${escape(bonusNames[key] || key)}</dt><dd class="${comparison && value < 0 ? 'negative' : value > 0 ? 'positive' : ''}">${amount(key, value)}</dd></div>`).join('')}</dl>`;
  }
  function profile(s) {
    const r = RPG.ensure(s), p = RPG.profile(s), portrait = globalThis.Characters?.portrait?.('chenxu', r.equipped) || '';
    const stages = ['觉醒', '初行', '见习', '熟练', '进阶', '精英', '突破', '共鸣'];
    const stats = [['intelligence', '智力', 'brain'], ['physique', '体魄', 'activity'], ['spirit', '精神', 'sparkles'], ['compute', '算力', 'cpu'], ['reputation', '声望', 'award'], ['cash', '现金', 'wallet']];
    return `<div class="dossier-profile"><div class="dossier-portrait">${portrait ? `<img src="${escape(portrait)}" alt="陈旭当前装束" width="240" height="320">` : `<div class="dossier-portrait-fallback">${icon('user-round')}<span>陈旭</span></div>`}<span class="dossier-portrait-label">CHEN XU / 001</span></div><section class="dossier-identity"><span class="dossier-eyebrow">天枢宿主 / ${stages[p.level - 1]}</span><h3>陈旭 <small>Lv.${p.level}</small></h3><p>澜川大学 · 大一学生</p><div class="dossier-xp-label"><span>成长经验</span><b>${p.xp} / 700 EXP</b></div><div class="dossier-meter" role="progressbar" aria-label="当前等级经验" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${p.progress}"><span style="width:${p.progress}%"></span></div><p class="dossier-muted">${p.level === 8 ? '首章等级上限已达成' : `距 Lv.${p.level + 1} 还需 ${100 - p.progress} EXP`}</p><div class="dossier-health" data-stat="hp"><span>${icon('heart')}战斗生命</span><strong>${p.hp} <small>/ ${p.maxHp}</small></strong></div><p class="dossier-muted">基础 65 + 体魄 ${Math.floor(s.stats.physique / 2)} + 成长与装备 ${p.bonus.hp}</p></section></div><section>${heading('角色属性')}<dl class="dossier-stats">${stats.map(([key, label, name]) => `<div data-stat="${key}"><dt>${icon(name)}${label}</dt><dd>${key === 'cash' ? '¥' : ''}${s.stats[key]}${key === 'compute' ? `<small>/ ${s.stats.maxCompute}</small>` : ''}</dd></div>`).join('')}</dl></section><section>${heading('成长与装备加成')}${bonuses(p.bonus)}</section><section>${heading('探索记录', `收藏 ${r.found.length} / ${Object.keys(RPG.finds).length}`)}<div class="dossier-records">${Object.entries(r.records).map(([id, record]) => `<div><span>${escape(CONTENT.nodes[id]?.title || id)}</span><strong>${record.best} 分</strong><small>${record.attempts} 次 · ${record.won ? '已获首胜' : '尚未首胜'}</small></div>`).join('') || '<p class="dossier-muted">尚无小游戏记录</p>'}</div></section>`;
  }
  function comparison(s, id) {
    const c = RPG.compare(s, id);
    if (!c) return '';
    return `<div class="dossier-comparison"><h4>与当前${RPG.slots[RPG.items[id].slot]}比较</h4><p>${escape(RPG.items[c.current]?.name || '未装备')} ${icon('arrow-right')} ${escape(RPG.items[id].name)}</p>${bonuses(c.delta, true)}</div>`;
  }
  function equipButton(s, id) {
    const item = RPG.items[id], equipped = RPG.ensure(s).equipped[item.slot] === id;
    return `<button class="secondary" data-equip="${id}" ${s.active ? 'disabled' : ''}>${icon(equipped ? 'minus' : 'plus')}${equipped ? '卸下' : '装备'}</button>`;
  }
  function gear(s, ui) {
    const r = RPG.ensure(s);
    if (!r.owned.includes(ui.gear)) ui.gear = r.owned[0] || '';
    return `<section>${heading('当前装束', `${Object.values(r.equipped).filter(Boolean).length} / 3 槽位`)}<div class="dossier-slots">${Object.entries(RPG.slots).map(([slot, label]) => { const item = RPG.items[r.equipped[slot]]; return `<div><span>${label}</span>${icon(item?.icon || 'plus')}<strong>${escape(item?.name || '尚未装备')}</strong><small>${escape(item?.desc || '空槽位')}</small></div>`; }).join('')}</div></section><section>${heading('持有装备', `${r.owned.length} / ${Object.values(RPG.items).filter(item => item.slot).length}`)}${r.owned.length ? `<div class="dossier-gear-list">${r.owned.map(id => { const item = RPG.items[id]; return `<article class="dossier-gear-row"><button class="dossier-gear-select" data-gear-detail="${id}" aria-pressed="${ui.gear === id}"><span class="dossier-item-icon ${item.rarity}">${icon(item.icon)}</span><span><strong>${item.name}</strong><small>${item.desc}</small></span>${r.equipped[item.slot] === id ? `<span class="dossier-equipped">${icon('check')}已装备</span>` : ''}</button>${equipButton(s, id)}</article>`; }).join('')}</div>${comparison(s, ui.gear)}` : empty('尚未持有装备', '后街补给出售手部、衣装与配件。', 'shirt')}</section>${s.active ? '<p class="dossier-muted">剧情进行中，暂时无法更换装备。</p>' : ''}`;
  }
  function detail(s, item) {
    if (!item) return empty('没有可查看的物品', '更换分类或搜索其他物品。');
    const use = item.category === 'supplies' ? RPG.usePreview(s, item.id) : null;
    return `<aside class="dossier-item-detail" aria-label="物品详情"><div class="dossier-detail-symbol ${item.rarity || ''}">${icon(item.icon || 'file-text')}</div><span class="dossier-eyebrow">${categories[item.category]}${item.slot ? ' / ' + RPG.slots[item.slot] : ''}</span><h3>${escape(item.name)}</h3><p>${escape(item.desc)}</p><dl class="dossier-bonus-list"><div><dt>持有数量</dt><dd>${item.quantity}${item.category === 'supplies' ? ' / 9' : ''}</dd></div>${item.slot ? `<div><dt>状态</dt><dd>${item.equipped ? '已装备' : '未装备'}</dd></div>` : ''}</dl>${item.slot ? comparison(s, item.id) + equipButton(s, item.id) : ''}${use ? `<p class="dossier-use-preview">${escape(use.reason || (use.compute ? `使用后恢复 ${use.compute} 算力，达到 ${s.stats.compute + use.compute} / ${s.stats.maxCompute}` : `使用后获得 ${use.xp} EXP，达到 ${RPG.ensure(s).xp + use.xp} / 700 EXP`))}</p><button class="primary" data-use="${item.id}" ${use.allowed ? '' : 'disabled'}>${icon('check')}确认使用</button>` : ''}${['memories', 'evidence'].includes(item.category) ? '<p class="dossier-muted">已归档 · 永久保留</p>' : ''}</aside>`;
  }
  function bag(s, ui) {
    const all = RPG.inventory(s), list = RPG.inventory(s, ui.filter, ui.query);
    if (!list.some(item => item.id === ui.item)) ui.item = list[0]?.id || '';
    return `<div class="dossier-bag-tools"><label class="dossier-search">${icon('search')}<input type="search" data-bag-search aria-label="搜索背包" placeholder="搜索物品" value="${escape(ui.query)}"></label><label class="dossier-filter-label">分类<select data-bag-filter aria-label="背包分类">${Object.entries(categories).map(([id, label]) => `<option value="${id}" ${ui.filter === id ? 'selected' : ''}>${label}${id === 'all' ? ` (${all.length})` : ` (${all.filter(item => item.category === id).length})`}</option>`).join('')}</select></label></div>${!all.length ? empty('背包是空的', '探索校园获得线索与收藏，或在后街购入补给。', 'backpack') : !list.length ? empty('此分类下暂无物品', ui.query ? '没有匹配的物品。' : '获得的物品会记录在这里。') : `<div class="dossier-inventory"><div class="dossier-item-grid" aria-label="背包物品">${list.map(item => `<button class="dossier-item ${item.rarity || ''}" data-bag-item="${escape(item.id)}" aria-pressed="${ui.item === item.id}" aria-label="${escape(item.name)}，数量 ${item.quantity}">${icon(item.icon || 'file-text')}<strong>${escape(item.name)}</strong><span>× ${item.quantity}</span>${item.equipped ? '<small>已装备</small>' : ''}</button>`).join('')}</div>${detail(s, list.find(item => item.id === ui.item))}</div>`}`;
  }
  function tasks(s, hooks) {
    const quests = globalThis.Exploration?.quests?.(s) || [];
    const rewardText = reward => typeof reward === 'string' ? reward : Object.entries(reward || {}).map(([key, value]) => key === 'xp' ? `${value} EXP` : key === 'cash' ? `¥${value}` : key === 'item' ? RPG.items[value]?.name || value : `${bonusNames[key] || key} +${value}`).join(' · ');
    return `${heading('校园委托', `${quests.filter(q => q.complete).length} / ${quests.length} 已完成`)}${quests.length ? `<div class="dossier-quests">${quests.map(q => `<article class="dossier-quest" data-quest="${escape(q.id)}"><div class="dossier-quest-heading"><span>${icon(q.complete ? 'circle-check' : 'circle-dot')} ${q.complete ? '已完成' : '进行中'}</span><small>${escape(globalThis.CONTENT?.places?.[q.zone]?.name || q.zone)}</small></div><h3>${escape(q.title)}</h3><p>${escape(q.description)}</p><ol>${q.steps.map(step => `<li class="${step.done ? 'done' : ''}">${icon(step.done ? 'check' : 'circle')}<span>${escape(step.text)}</span><small>${step.done ? '完成' : '待办'}</small></li>`).join('')}</ol><div class="dossier-quest-footer"><span>${icon('gift')}${escape(rewardText(q.reward))}</span><button class="secondary" data-quest-visit="${escape(q.zone)}" data-objective="${escape(q.objectiveId)}" ${!hooks.visit || s.active ? 'disabled' : ''}>${icon('map-pin')}前往地点</button></div></article>`).join('')}</div>` : empty('暂无可记录的委托', '校园中的委托会在这里更新。', 'notebook-tabs')}`;
  }
  function shop(s) {
    const r = RPG.ensure(s);
    return `${heading('后街补给', `现金 ¥${s.stats.cash}`)}<div class="dossier-shop">${Object.entries(RPG.items).map(([id, item]) => { const owned = item.slot && r.owned.includes(id), full = !item.slot && r.bag[id] >= 9; return `<article class="dossier-shop-item ${item.rarity || ''}"><div>${icon(item.icon)}<span>${item.slot ? RPG.slots[item.slot] : `补给 · ${r.bag[id]} / 9`}</span></div><h3>${item.name}</h3><p>${item.desc}</p><button class="secondary" data-buy="${id}" ${s.active || owned || full || s.stats.cash < item.price ? 'disabled' : ''}>${icon(owned ? 'check' : 'shopping-cart')}${owned ? '已持有' : full ? '数量已满' : '¥ ' + item.price}</button></article>`; }).join('')}</div>`;
  }
  function finds(s) {
    const r = RPG.ensure(s);
    return `${heading('校园收藏', `${r.found.length} / ${Object.keys(RPG.finds).length} 已归档`)}<div class="dossier-collections">${Object.entries(RPG.finds).map(([id, item]) => { const found = r.found.includes(id); return `<article class="dossier-collection ${found ? 'found' : 'locked'}"><span>${icon(found ? item.icon : 'lock-keyhole')}${escape(globalThis.CONTENT?.places?.[id]?.name || id)}</span><h3>${found ? item.name : '未发现的记忆'}</h3><p>${found ? item.text : '前往地点附近，调查留下的物件。'}</p><small>${found ? '已归档' : item.xp + ' EXP'}</small></article>`; }).join('')}</div>`;
  }
  // 里程碑。内容全部由 Achievements 从既有状态推导，这里只负责摆出来 —— 因此
  // 面板打开时看到的永远是当前真实进度，不存在「成就表和存档对不上」这种问题。
  function milestones(s) {
    if (!globalThis.Achievements) return `${heading('里程碑', '不可用')}<p class="panel-intro">里程碑模块未加载。</p>`;
    const list = Achievements.list(s), { got, total } = Achievements.summary(s);
    const groups = [...new Set(list.map(a => a.group))];
    return `${heading('里程碑', `${got} / ${total} 已达成`)}<div class="dossier-milestones">${groups.map(group => `<section><h3>${escape(group)}</h3>${list.filter(a => a.group === group).map(a => `<article class="milestone ${a.got ? 'got' : 'locked'}"><span>${icon(a.got ? 'trophy' : 'lock-keyhole')}</span><div><strong>${escape(a.name)}</strong><p>${escape(a.desc)}</p></div></article>`).join('')}</section>`).join('')}</div>`;
  }
  function render(host, s, hooks = {}, view) {
    let ui = sessions.get(host);
    if (!ui) { ui = { tab: 'profile', filter: 'all', query: '', item: '', gear: '', status: '' }; sessions.set(host, ui); }
    if ([...tabs.map(t => t[0]), 'shop', 'finds', 'milestones'].includes(view)) { ui.tab = view; ui.status = ''; }
    const main = tabs.some(t => t[0] === ui.tab);
    const body = ({ profile, gear: () => gear(s, ui), bag: () => bag(s, ui), tasks: () => tasks(s, hooks), shop, finds, milestones: () => milestones(s) })[ui.tab](s);
    const utilityLabel = { shop: '后街补给', finds: '校园收藏', milestones: '里程碑' };
    host.innerHTML = `<div class="character-ui"><nav class="dossier-tabs" role="tablist" aria-label="角色档案">${tabs.map(([id, label, name]) => `<button id="dossier-tab-${id}" role="tab" data-growth-tab="${id}" aria-controls="growth-content" aria-selected="${ui.tab === id}" tabindex="${ui.tab === id || !main && id === 'profile' ? 0 : -1}">${icon(name)}<span>${label}</span></button>`).join('')}</nav><div class="dossier-utilities"><span>Lv.${RPG.level(s)} · 陈旭</span><button data-growth-tab="shop" aria-pressed="${ui.tab === 'shop'}">${icon('shopping-bag')}后街补给</button><button data-growth-tab="finds" aria-pressed="${ui.tab === 'finds'}">${icon('scan-search')}校园收藏</button><button data-growth-tab="milestones" aria-pressed="${ui.tab === 'milestones'}">${icon('trophy')}里程碑</button></div><div class="dossier-status" role="status" aria-live="polite">${escape(ui.status)}</div><div id="growth-content" ${main ? `role="tabpanel" aria-labelledby="dossier-tab-${ui.tab}"` : `role="region" aria-label="${utilityLabel[ui.tab] || '角色档案'}"`}>${body}</div></div>`;
    const redraw = focus => { render(host, s, hooks); if (focus) host.querySelector(focus)?.focus?.(); };
    host.querySelectorAll('[data-growth-tab]').forEach(b => {
      b.onclick = () => { ui.tab = b.dataset.growthTab; ui.status = ''; redraw(`[data-growth-tab="${ui.tab}"]`); };
      if (tabs.some(t => t[0] === b.dataset.growthTab)) b.onkeydown = event => {
        const index = tabs.findIndex(t => t[0] === b.dataset.growthTab);
        const next = { ArrowRight: (index + 1) % 4, ArrowLeft: (index + 3) % 4, Home: 0, End: 3 }[event.key];
        if (next !== undefined) { event.preventDefault(); ui.tab = tabs[next][0]; ui.status = ''; redraw(`[data-growth-tab="${ui.tab}"]`); }
      };
    });
    host.querySelectorAll('[data-gear-detail]').forEach(b => b.onclick = () => { ui.gear = b.dataset.gearDetail; redraw(`[data-gear-detail="${ui.gear}"]`); });
    host.querySelectorAll('[data-bag-item]').forEach(b => b.onclick = () => { ui.item = b.dataset.bagItem; redraw(`[data-bag-item="${ui.item}"]`); });
    const filter = host.querySelector('[data-bag-filter]');
    if (filter) filter.onchange = () => { ui.filter = filter.value; redraw('[data-bag-filter]'); };
    const search = host.querySelector('[data-bag-search]');
    if (search) search.oninput = () => { const position = search.selectionStart; ui.query = search.value; redraw('[data-bag-search]'); host.querySelector('[data-bag-search]')?.setSelectionRange?.(position, position); };
    host.querySelectorAll('[data-quest-visit]').forEach(b => b.onclick = () => { if (!s.active) hooks.visit?.(b.dataset.questVisit); });
    for (const [key, fn] of [['buy', RPG.buy], ['equip', RPG.equip], ['use', RPG.use]]) host.querySelectorAll(`[data-${key}]`).forEach(b => b.onclick = () => {
      const id = b.dataset[key], preview = key === 'use' ? RPG.usePreview(s, id) : null;
      if (fn(s, id)) {
        const r = RPG.ensure(s), item = RPG.items[id];
        ui.status = key === 'buy' ? `已购入${item.name}，支付 ¥${item.price}。` : key === 'equip' ? `${item.name}${r.equipped[item.slot] === id ? '已装备' : '已卸下'}。` : `${item.name}已使用，${preview.compute ? `恢复 ${preview.compute} 算力` : `获得 ${preview.xp} EXP`}，剩余 ${r.bag[id]}。`;
        hooks.save?.(); hooks.hud?.(); hooks.sound?.('win'); redraw();
      } else { ui.status = preview?.reason || '当前无法操作，进度已保留。'; hooks.toast?.(ui.status); redraw(); }
    });
    hooks.icons?.();
  }
  return { render };
})();
