'use strict';
globalThis.RPG = (() => {
  const items = {
    wrist: { name: '训练护腕', slot: 'hand', price: 260, icon: 'shield', rarity: 'standard', desc: '格挡 +4，回收速度 +15%', bonus: { guard: 4, reel: .15 } },
    solder: { name: '精密工具组', slot: 'hand', price: 420, icon: 'wrench', rarity: 'rare', desc: '攻击 +3，回收速度 +35%', bonus: { attack: 3, reel: .35 } },
    jacket: { name: '轻量外套', slot: 'outfit', price: 360, icon: 'shirt', rarity: 'standard', desc: '生命 +15，精准窗口 +3%', bonus: { hp: 15, window: .03 } },
    sneakers: { name: '校园跑鞋', slot: 'outfit', price: 520, icon: 'footprints', rarity: 'rare', desc: '生命 +8，精准窗口 +7%', bonus: { hp: 8, window: .07 } },
    pendant: { name: '专注吊坠', slot: 'accessory', price: 300, icon: 'gem', rarity: 'standard', desc: '答题与回收时间 +6 秒', bonus: { time: 6 } },
    chip: { name: '天枢协处理器', slot: 'accessory', price: 680, icon: 'cpu', rarity: 'rare', desc: '攻击 +5，回收价值 +25%', bonus: { attack: 5, value: .25 } },
    coffee: { name: '冰咖啡', slot: null, price: 90, icon: 'coffee', desc: '恢复 30 算力', compute: 30 },
    notes: { name: '复习手册', slot: null, price: 150, icon: 'book-marked', desc: '经验 +35', xp: 35 }
  };
  const finds = {
    dorm: { name: '没寄出的信', icon: 'mail', text: '抽屉底下，是你上一世没来得及寄出的信。这一回，收信人还在等。', xp: 20, cash: 0, bonus: { spirit: 3 } },
    hall: { name: '褪色的参赛证', icon: 'badge', text: '编号 007。正面是你的名字，背面却留下一个未来日期。', xp: 25, cash: 0, bonus: { reputation: 2 } },
    library: { name: '夹页公式', icon: 'notebook-pen', text: '第三行多了一种解法。下方小小的署名，是林晚。', xp: 25, cash: 0, bonus: { intelligence: 3 } },
    lake: { name: '银杏书签', icon: 'leaf', text: '有人把“明天见”写在叶脉旁。你把它夹进了笔记本。', xp: 25, cash: 0, bonus: { bonds: { lw: 3 } } },
    gym: { name: '旧赛场哨子', icon: 'medal', text: '哨子上刻着上一届冠军的姓氏。也许下一次，该留下你的。', xp: 20, cash: 60, bonus: { physique: 3 } },
    lab: { name: '早期协议碎片', icon: 'binary', text: '一块废弃芯片仍在发送校验信号。天枢沉默了整整三秒。', xp: 35, cash: 100, bonus: { compute: 8 } },
    gate: { name: '维修店优惠券', icon: 'ticket', text: '老板认出了你的工具。“下次过来，给你留好零件。”', xp: 20, cash: 120, bonus: {} },
    plaza: { name: '失而复得的照片', icon: 'image', text: '你和苏祁站在钟楼前。照片上的你，比记忆里笑得更轻松。', xp: 30, cash: 0, bonus: { bonds: { sq: 3 } } }
  };
  const slots = { hand: '手部', outfit: '衣装', accessory: '配件' };
  const fresh = () => ({ xp: 0, owned: [], equipped: { hand: null, outfit: null, accessory: null }, bag: { coffee: 0, notes: 0 }, found: [], records: {}, restDay: 0 });
  const ensure = s => s.rpg ||= fresh();
  const level = s => Math.min(8, 1 + Math.floor(ensure(s).xp / 100));
  function xp(s, amount) { ensure(s).xp = Math.min(700, ensure(s).xp + Math.max(0, amount)); }
  function bonus(s) {
    const out = { attack: level(s) - 1, guard: 0, hp: (level(s) - 1) * 4, time: 0, window: 0, reel: 0, value: 0 };
    for (const id of Object.values(ensure(s).equipped)) for (const [key, value] of Object.entries(items[id]?.bonus || {})) out[key] += value;
    return out;
  }
  function buy(s, id) {
    const item = items[id], r = ensure(s);
    if (!item || s.active || s.stats.cash < item.price || item.slot && r.owned.includes(id) || !item.slot && r.bag[id] >= 9) return false;
    s.stats.cash -= item.price;
    if (item.slot) { r.owned.push(id); if (!r.equipped[item.slot]) r.equipped[item.slot] = id; }
    else r.bag[id]++;
    return true;
  }
  function equip(s, id) {
    const r = ensure(s), slot = items[id]?.slot;
    if (s.active || !slot || !r.owned.includes(id)) return false;
    r.equipped[slot] = r.equipped[slot] === id ? null : id; return true;
  }
  function use(s, id) {
    const r = ensure(s), item = items[id];
    if (s.active || !item || item.slot || !r.bag[id] || item.compute && s.stats.compute >= s.stats.maxCompute || item.xp && r.xp >= 700) return false;
    r.bag[id]--; if (item.compute) TS.effect(s, { compute: item.compute }); if (item.xp) xp(s, item.xp); return true;
  }
  function discover(s, place) {
    const r = ensure(s), item = finds[place];
    if (s.active || !item || r.found.includes(place)) return false;
    r.found.push(place); xp(s, item.xp); TS.effect(s, { ...item.bonus, cash: item.cash }); return true;
  }
  function reward(s, id, score, success) {
    const r = ensure(s), previous = r.records[id];
    r.records[id] = { best: Math.max(previous?.best || 0, score), attempts: (previous?.attempts || 0) + 1, won: !!previous?.won || success };
    if (success && !previous?.won) { xp(s, 60); TS.effect(s, { cash: 180, compute: 10 }); return true; }
    return false;
  }
  function validate(r) {
    if (!r) return fresh();
    if (!Number.isInteger(r.xp) || r.xp < 0 || r.xp > 700 || !Array.isArray(r.owned) || new Set(r.owned).size !== r.owned.length || r.owned.some(id => !items[id]?.slot)) return null;
    if (!r.equipped || Object.keys(slots).some(slot => r.equipped[slot] !== null && (!r.owned.includes(r.equipped[slot]) || items[r.equipped[slot]].slot !== slot))) return null;
    if (!r.bag || ['coffee', 'notes'].some(id => !Number.isInteger(r.bag[id]) || r.bag[id] < 0 || r.bag[id] > 9)) return null;
    if (!Array.isArray(r.found) || r.found.some(id => !finds[id]) || new Set(r.found).size !== r.found.length || !r.records || Object.entries(r.records).some(([id, record]) => !['salvage','memory'].includes(id) || !Number.isFinite(record.best) || record.best < 0 || record.best > 100000 || !Number.isInteger(record.attempts) || record.attempts < 1 || typeof record.won !== 'boolean')) return null;
    if (globalThis.Exploration) { r.world = Exploration.validate(r.world); if (!r.world) return null; }
    return r;
  }
  return { items, finds, slots, fresh, ensure, level, xp, bonus, buy, equip, use, discover, reward, validate };
})();
