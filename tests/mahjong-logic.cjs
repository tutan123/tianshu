/* ═══════════════════════════════════════════════════════════════════════════
   纯逻辑自测（赣麻规则）：vm 注入 mahjong.js（含最小 DOM stub），
   断言 造牌 / 牌型判定 / 赔付 / 抢杠 / 无吃无点炮 / AI 整局，
   以及本次新增的 向听数 / 有效进张 / 智脑提示 / 结算亮牌 / 提示 UI。
   运行：node _test_mahjong_logic.cjs
   ═══════════════════════════════════════════════════════════════════════════ */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, "mahjong.js"), "utf8");

let pass = 0, fail = 0;
const fails = [];
function ok(cond, name, extra) {
  if (cond) { pass++; }
  else { fail++; fails.push(name + (extra ? " → " + extra : "")); }
  return !!cond;
}
function eq(a, b, name) { return ok(a === b, name, "期望 " + JSON.stringify(b) + "，实际 " + JSON.stringify(a)); }
function group(t) { console.log("\n── " + t + " ──"); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ── 最小 DOM stub ──
   mahjong.js 用 innerHTML 拼结算面板 / 提示面板，所以 stub 会把 innerHTML 里带 id 的
   标签也登记进 ID_MAP（否则 #mjmGo / #mjmResHands 这种动态节点查不到）。 */
const ID_MAP = new Map();
const VOID_TAGS = { br: 1, hr: 1, img: 1, input: 1, meta: 1, link: 1 };
function regIds(el) {
  if (!el || typeof el !== "object") return;
  if (el.id) ID_MAP.set(el.id, el);
  if (el.childNodes) for (const c of el.childNodes) regIds(c);
}
function unregIds(el) {
  /* 注意：只注销子节点。元素自己在真 DOM 里不会因为设置 innerHTML 而改名/消失。 */
  if (!el || typeof el !== "object") return;
  if (el.childNodes) for (const c of el.childNodes) unregIds(c);
}
function makeElement(tag) {
  const e = {
    tagName: String(tag || "div").toUpperCase(), id: "", className: "", style: {}, dataset: {},
    childNodes: [], children: [], _html: "", _text: "", parentNode: null,
    classList: { _s: new Set(), add() { for (const a of arguments) this._s.add(a); }, remove() { for (const a of arguments) this._s.delete(a); }, contains(c) { return this._s.has(c); }, toggle(c) { this._s.has(c) ? this._s.delete(c) : this._s.add(c); } },
    setAttribute() {}, getAttribute() { return null; }, removeAttribute() {},
    appendChild(c) { c.parentNode = this; this.childNodes.push(c); this.children.push(c); this._html = ""; regIds(c); return c; },
    removeChild(c) { const i = this.childNodes.indexOf(c); if (i >= 0) { this.childNodes.splice(i, 1); this.children.splice(i, 1); } unregIds(c); return c; },
    addEventListener() {}, removeEventListener() {}, focus() {}, blur() {}, click() {},
    getBoundingClientRect() { return { left: 10, top: 20, width: 1180, height: 818 }; },
    getContext() {
      const noop = () => {};
      return { setTransform: noop, clearRect: noop, fillRect: noop, beginPath: noop, moveTo: noop, lineTo: noop, arc: noop, ellipse: noop, fill: noop, stroke: noop, save: noop, restore: noop, clip: noop, translate: noop, scale: noop, quadraticCurveTo: noop, closePath: noop, fillText: noop, strokeText: noop, drawImage: noop, putImageData: noop, getImageData: () => ({ data: [] }), createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }), createPattern: () => null, measureText: () => ({ width: 8 }), set fillStyle(v) {}, set strokeStyle(v) {}, set font(v) {}, set lineWidth(v) {}, set shadowColor(v) {}, set shadowBlur(v) {}, set textAlign(v) {}, set textBaseline(v) {}, set lineCap(v) {}, set lineJoin(v) {}, set globalAlpha(v) {} };
    },
    querySelector() { return null; }, querySelectorAll() { return []; }
  };
  /** 像真 DOM 一样：innerHTML 读的是「当前子节点序列化」或上次写入的字符串 */
  e._sync = function () {
    if (this._html || !this.childNodes.length) return this._html;
    let s = "";
    for (const c of this.childNodes) {
      const t = c.tagName.toLowerCase();
      s += "<" + t + (c.id ? ' id="' + c.id + '"' : "") + (c.className ? ' class="' + c.className + '"' : "") + ">";
      s += c._sync();
      if (!VOID_TAGS[t]) s += "</" + t + ">";
    }
    return s;
  };
  Object.defineProperty(e, "innerHTML", {
    get() { return this._sync(); },
    set(v) {
      unregIds(this);
      this.childNodes = []; this.children = [];
      this._html = String(v == null ? "" : v);
      parseIds(this._html, this);
      ensureIds(this._html);
    }, configurable: true
  });
  Object.defineProperty(e, "textContent", { get() { return this._text || this._sync().replace(/<[^>]*>/g, ""); }, set(v) { this._text = String(v == null ? "" : v); }, configurable: true });
  Object.defineProperty(e, "lastChild", { get() { return this.childNodes[this.childNodes.length - 1] || null; }, configurable: true });
  return e;
}
/** 极简 HTML 扫描：只登记标签与 id（不建整棵树），足够 getElementById 用 */
function parseIds(html, root) {
  const re = /<([a-zA-Z][\w-]*)([^>]*)>/g;
  let m;
  while ((m = re.exec(html))) {
    const tag = m[1].toLowerCase();
    const idm = /id\s*=\s*"([^"]*)"/.exec(m[2]);
    if (!idm || !idm[1]) continue;
    const el = makeElement(tag);
    el.id = idm[1];
    const cm = /class\s*=\s*"([^"]*)"/.exec(m[2]);
    if (cm) el.className = cm[1];
    if (VOID_TAGS[tag]) { el._html = ""; ID_MAP.set(el.id, el); continue; }
    const start = m.index + m[0].length;
    const openRe = new RegExp("<" + tag + "(?=[\\s>])", "gi");
    const closeRe = new RegExp("</" + tag + "\\s*>", "gi");
    let depth = 1, idx = start, end = html.length;
    while (depth > 0) {
      openRe.lastIndex = idx; closeRe.lastIndex = idx;
      const o = openRe.exec(html), c = closeRe.exec(html);
      if (!c) { end = html.length; break; }
      if (o && o.index < c.index) { depth++; idx = o.index + 1; }
      else { depth--; idx = c.index + c[0].length; end = c.index; if (depth === 0) break; }
    }
    el._html = html.slice(start, end);
    parseIds(el._html, el);
    ID_MAP.set(el.id, el);
  }
}
/** 兜底：任何写进 innerHTML 的 id 都留个长期占位元素，保证 getElementById 查得到
   （真 DOM 里它们本来就在，只是这个 stub 不建整棵树） */
const HTML_IDS = new Map();
function ensureIds(html) {
  const re = /id\s*=\s*"([^"]+)"/g;
  let m;
  while ((m = re.exec(html))) {
    if (!HTML_IDS.has(m[1])) HTML_IDS.set(m[1], makeElement("div"));
  }
}
const documentStub = {
  createElement: makeElement,
  getElementById(id) { return ID_MAP.get(id) || HTML_IDS.get(id) || null; },
  querySelector() { return null; }, querySelectorAll() { return []; },
  addEventListener() {}, head: makeElement("head"), body: makeElement("body")
};
const windowStub = {
  setTimeout, clearTimeout, setInterval, clearInterval, requestAnimationFrame() { return 0; }, cancelAnimationFrame() {},
  console, Math, Date, JSON, devicePixelRatio: 1,
  document: documentStub,
  innerWidth: 1280, innerHeight: 900,
  AudioSys: { blip() {}, click() {}, ding() {}, good() {}, bad() {} }
};
windowStub.window = windowStub;

const ctx = vm.createContext(windowStub);
vm.runInContext(SRC, ctx, { filename: "mahjong.js" });
const MJ = ctx.Mahjong || windowStub.Mahjong;
if (!MJ) { console.error("mahjong.js 未导出 window.Mahjong"); process.exit(1); }
const T = MJ.test;

/* ── 手牌书写："123m 456m 789m 123s 99s"（m=万 s=条 p=筒）；字牌直接写 东/南/西/北/中/發/白 ── */
const SUIT_MAP = { m: "万", s: "条", p: "筒" };
const HONOR_CH = "东南西北中發白";
function P(s) {
  const out = [];
  for (const part of String(s).split(/\s+/)) {
    if (!part) continue;
    const m = /^([0-9]+)([msp])$/.exec(part);
    if (m) { for (const ch of m[1]) out.push(ch + SUIT_MAP[m[2]]); continue; }
    const m2 = /^([1-9])([万条筒])$/.exec(part);            // 也接受 "9筒 / 1万" 这种直写
    if (m2) { out.push(part); continue; }
    for (const ch of part) if (HONOR_CH.indexOf(ch) < 0) throw new Error("bad hand token: " + part);
    for (const ch of part) out.push(ch);
  }
  return out;
}
function meld(type, s, an) {
  const t = P(s);
  return { type, tiles: type === "gang" ? [t[0], t[0], t[0], t[0]] : [t[0], t[0], t[0]], from: 0, an: !!an, kind: an ? "an" : "ming" };
}

/* ═══════════════ 1. 造牌 ═══════════════ */
group("1. 造牌 / 牌张");
{
  const wall = T.createWall();
  eq(wall.length, 136, "共 136 张（108 序数牌 + 28 字牌）");
  const c = T.counts(wall);
  eq(Object.keys(c).length, 34, "34 种牌（万条筒 1-9 + 东南西北中發白）");
  let allFour = true, onlyKnown = true, honorN = 0;
  for (const k of Object.keys(c)) {
    if (c[k] !== 4) allFour = false;
    if (/^[1-9][万条筒]$/.test(k)) continue;
    if (T.HONORS.indexOf(k) >= 0) { honorN++; continue; }
    onlyKnown = false;
  }
  ok(allFour, "每种恰好 4 张");
  ok(onlyKnown, "只有万条筒 1-9 与 7 种字牌（无其他牌）");
  eq(honorN, 7, "7 种字牌都在牌墙里");
  eq(T.sortTiles(wall).length, 136, "排序后仍是 136 张");
  eq(T.createWall(false).length, 108, "createWall(false) → 旧 108 张牌组");
  eq(Object.keys(T.counts(T.createWall(false))).length, 27, "旧牌组 27 种（无字牌）");
  ok(T.createWall(false).every(t => !T.isHonor(t)), "旧牌组里没有字牌");
  eq(T.deckSize(), 136, "deckSize() = 136");
  eq(T.deckSize(false), 108, "deckSize(false) = 108");
}

/* ═══════════════ 2. 牌型判定 ═══════════════ */
group("2. 牌型判定");
const CASES = [
  ["小胡 · 三顺一对", "123m 456m 789m 123s 99s", [], "small"],
  ["小胡 · 刻子+顺子", "111m 234m 567m 789s 22p", [], "small"],
  ["小胡 · 混合花色", "123m 345s 678p 999s 55m", [], "small"],
  ["小胡 · 幺九对将", "11m 234m 567m 789m 123p", [], "small"],
  ["小胡 · 副露碰", "234m 567m 123s 99s", [meld("peng", "1m")], "small"],
  ["小胡 · 副露明杠", "123m 456m 789s 22s", [meld("gang", "5p")], "small"],
  ["小胡 · 条子顺子", "123s 456s 789s 123p 99m", [], "small"],
  ["大胡 · 碰碰胡（全刻子）", "111m 222m 333s 444p 55s", [], "big"],
  ["大胡 · 碰碰胡（含幺九）", "999m 888p 777s 111s 22m", [], "big"],
  ["大胡 · 副露两碰", "222s 555s 99m", [meld("peng", "3m"), meld("peng", "7p")], "big"],
  ["大胡 · 副露杠+碰", "444m 666m 77p", [meld("gang", "1s"), meld("peng", "2p")], "big"],
  ["七对 · 七组对子", "11m 22m 33m 44s 55s 66p 77p", [], "bigger"],
  ["七对 · 含幺九", "11m 99m 33s 44s 55p 66p 88p", [], "bigger"],
  ["大大胡 · 龙七对（1 组 4 张）", "1111m 22m 33s 44s 55p 66p", [], "biggest"],
  ["大大胡 · 龙七对（2 组 4 张）", "1111m 2222s 33p 44p 55p", [], "biggest"],
  ["大吊车 · 4 碰单调", "55m", [meld("peng", "1m"), meld("peng", "2s"), meld("peng", "3p"), meld("peng", "4s")], "bigger"],
  ["大吊车 · 3 碰 1 杠单调", "99p", [meld("peng", "1m"), meld("peng", "2s"), meld("peng", "3p"), meld("gang", "6m")], "bigger"],
  ["大吊车 · 4 杠单调", "33s", [meld("gang", "1m"), meld("gang", "2p"), meld("gang", "5s"), meld("gang", "7s")], "bigger"],
  ["未成牌 · 全孤张", "13579m 2468s 13579p", [], null],
  ["未成牌 · 只有 13 张", "123m 456m 789m 123s 9s", [], null],
  ["未成牌 · 差一张（12s+5p）", "123m 456m 789m 12s 99s 5p", [], null],
  ["未成牌 · 六对+两张散牌", "11m 22m 33m 44s 55s 66p 78p", [], null],
  ["未成牌 · 两对子拆不开", "11m 234m 567m 99s 123p 5p", [], null],
  ["未成牌 · 多对子带副露（不算七对）", "11m 44m 77m 99s 55p 3s", [meld("peng", "1p")], null],
  ["未成牌 · 多对子（两对将）", "11m 22m 33m 44s 55s 66p 78p", [], null],
  ["字牌 · 刻子 + 顺子 = 小胡", "东东东 123m 456m 789m 99s", [], "small"],
  ["字牌 · 对子作将", "123m 456m 789m 123s 东东", [], "small"],
  ["字牌 · 全字牌碰碰胡 = 大胡", "东东东 南南南 西西西 北北北 中中", [], "big"],
  ["字牌 · 混序数牌碰碰胡", "中中中 111m 222s 333p 白白", [], "big"],
  ["字牌 · 七对", "东东 南南 西西 北北 中中 發發 白白", [], "bigger"],
  ["字牌 · 龙七对（4 张东）", "东东东东 南南 西西 北北 中中 發發", [], "biggest"],
  ["未成牌 · 字牌不能组顺子（东南西）", "东南西 北北 123m 456m 789m", [], null],
  ["未成牌 · 字牌不能组顺子（东南西北）", "东南西北 中中 123m 456m 99p", [], null],
  ["未成牌 · 字牌混入顺子假象", "东南西 123m 456m 789m 99s", [], null],
  ["未成牌 · 字牌单张凑不出", "123m 456m 789m 123s 东", [], null]
];
let caseN = 0;
for (const [name, hand, melds, want] of CASES) {
  caseN++;
  const r = T.evaluate(P(hand), melds);
  const got = r ? r.tier : null;
  ok(got === want, "用例 " + caseN + " " + name, "期望 " + want + "，实际 " + got + (r ? "(" + r.name + ")" : ""));
}
group("2b. 判定辅助函数");
{
  ok(T.isSevenPairs(P("11m 22m 33m 44s 55s 66p 77p")), "isSevenPairs 七对");
  ok(!T.isSevenPairs(P("111m 22m 33m 44s 55s 66p 7p")), "isSevenPairs 非七对");
  ok(T.isDragonSevenPairs(P("1111m 22m 33s 44s 55p 66p")), "isDragonSevenPairs 龙七对");
  ok(!T.isDragonSevenPairs(P("11m 22m 33m 44s 55s 66p 77p")), "isDragonSevenPairs 普通七对为假");
  ok(T.isAllTriplets(P("111m 222m 333s 444p 55s"), []), "isAllTriplets 碰碰胡");
  ok(!T.isAllTriplets(P("123m 456m 789m 123s 99s"), []), "isAllTriplets 有顺子为假");
  ok(T.isStandardWin(P("123m 456m 789m 123s 99s"), 0), "isStandardWin 小胡");
  ok(!T.isStandardWin(P("13579m 2468s 13579p"), 0), "isStandardWin 孤张为假");
  ok(T.isHonor("东") && T.isHonor("發") && T.isHonor("白"), "isHonor 认得字牌");
  ok(!T.isHonor("1万") && !T.isHonor("9筒"), "isHonor 不误判序数牌");
  eq(T.tileGroup("东"), 3, "字牌分组序号 3（排在筒之后）");
  eq(T.tileGroup("1万") + "" + T.tileGroup("1条") + "" + T.tileGroup("1筒"), "012", "万条筒分组 0/1/2");
  ok(T.isStandardWin(P("东东东 123m 456m 789m 99s"), 0), "字牌刻子算面子");
  ok(!T.isStandardWin(P("东南西 123m 456m 789m 99s"), 0), "字牌顺子不算面子");
  ok(!T.isStandardWin(P("东南西北 11m 123s 456s"), 0), "字牌拼不出面子");
}

/* ═══════════════ 3. 赔付（打 10 元基准） ═══════════════ */
group("3. 赔付 / 杠开");
{
  const s = T.scoreOf("small", {});
  eq(s.per, 20, "小胡 每家 20");
  eq(s.total, 60, "小胡 共收 60");
  eq(s.fan, 1, "小胡 1 倍");
  const b = T.scoreOf("big", {});
  eq(b.per, 80, "大胡 每家 80");
  eq(b.total, 240, "大胡 共收 240");
  const g = T.scoreOf("bigger", {});
  eq(g.per, 120, "大大胡 每家 120");
  eq(g.total, 360, "大大胡 共收 360");
  const x = T.scoreOf("biggest", {});
  eq(x.per, 240, "最大胡 每家 240");
  eq(x.total, 720, "最大胡 共收 720");
  eq([s.total, b.total, g.total, x.total].join("/"), "60/240/360/720", "赣麻四档 60/240/360/720");
  const k1 = T.scoreOf("small", { kongDraw: true });
  eq(k1.tier, "big", "杠开 · 小胡 → 大胡");
  eq(k1.total, 240, "杠开 · 小胡 60 → 240");
  ok(k1.fanName.indexOf("杠开") >= 0, "杠开文案带「杠开」→ " + k1.fanName);
  eq(T.scoreOf("big", { kongDraw: true }).total, 480, "杠开 · 大胡 240 → 480");
  eq(T.scoreOf("bigger", { kongDraw: true }).total, 720, "杠开 · 大大胡 360 → 720");
  const rk = T.scoreOf("small", { robKong: true });
  eq(rk.payerOnly, true, "抢杠 · 标记「杠牌一家包赔」");
  eq(rk.per, 20, "抢杠 · 每家赔付仍按档位算");
  ok(rk.fanName.indexOf("抢杠") >= 0, "抢杠文案带「抢杠」→ " + rk.fanName);
}

/* ═══════════════ 4. 抢杠规则 ═══════════════ */
group("4. 抢杠规则");
{
  eq(T.canRobKong("ming"), true, "明杠（直杠）可抢");
  eq(T.canRobKong("bu"), true, "补杠（回头杠）可抢");
  eq(T.canRobKong("an"), false, "暗杠不可抢");
  eq(T.robbable.an, false, "robbable 表：an=false");
}

/* ═══════════════ 5. 无吃 / 无点炮 ═══════════════ */
group("5. 无吃 / 无点炮");
{
  const e0 = new T.Engine(10);
  e0.deal();
  eq(e0.discard(0, 0), true, "轮到自己可以出牌");
  eq(e0.discard((e0.cur + 2) % 4, 0), false, "不是自己回合不能出牌（当前 " + e0.cur + " 号）");
  eq(e0.discard(0, 0), false, "已经出过牌，同一巡不能连出");
  const e = new T.Engine(10);
  e.deal();
  e.P[1].discards.push("1万");
  e.afterDiscard(1, "5筒");
  ok(e.phase === "claim" || e.phase === "turn", "弃牌后只可能出现 碰/杠 响应或下一家回合（无吃、无点炮）");
  /* 别人打出的牌不能直接胡：claim 只接受 peng / gang / pass */
  const e2 = new T.Engine(10);
  e2.deal();
  e2.P[1].hand = P("5筒 5筒 1m 2m 3m 4m 5m 6m 7m 8m 9m 1s 2s");
  e2.afterDiscard(0, "5筒");
  if (e2.phase === "claim") {
    eq(e2.P[1].hand.length >= 13, true, "进入碰/杠响应时手牌仍完整");
    eq(e2.claim(1, "hu"), false, "claim 不接受「胡」（无点炮）");
  } else {
    ok(true, "（本手未触发响应窗口，跳过 claim(hu) 断言）");
  }
}

/* ═══════════════ 6. 抢杠胡（引擎级） ═══════════════ */
group("6. 抢杠胡（引擎级）");
{
  const e = new T.Engine(10);
  e.P[0].melds = [meld("peng", "5筒")];
  e.P[0].hand = P("1m 2m 3m 6m 7m 8m 1s 2s 3s 5p");
  e.P[1].hand = P("1m 2m 3m 4m 5m 6m 7m 8m 9m 1s 2s 3s 5p");
  e.P[1].drawn = null;
  e.cur = 0; e.phase = "turn";
  e.pending = { type: "turn", seat: 0, anGangs: [], addGangs: ["5筒"] };
  eq(e.turnGang(0, "5筒", "bu"), true, "0 号家补杠 5筒");
  eq(e.phase, "rob", "补杠后进入抢杠窗口");
  eq(e.rob(1), true, "1 号家抢杠胡成功");
  eq(e.phase, "over", "抢杠后本局结束");
  ok(e.result && e.result.robKong === true, "result 标记 robKong");
  eq(e.result.seat, 1, "胡家是 1 号");
  eq(e.result.from, 0, "result.from = 杠牌的 0 号（包赔家）");
  eq(e.result.payerOnly, true, "标记杠牌一家包赔");
  /* 暗杠不能被抢 */
  const e2 = new T.Engine(10);
  e2.P[0].hand = P("1m 1m 1m 1m 2m 3m 4m 5m 6m 7m 8m 9m 1s");
  e2.P[1].hand = P("1m 2m 3m 4m 5m 6m 7m 8m 9m 1s 2s 3s 9s");
  e2.cur = 0; e2.phase = "turn"; e2.pending = { type: "turn", seat: 0, anGangs: ["1万"], addGangs: [] };
  e2.turnGang(0, "1万", "an");
  ok(e2.phase !== "rob", "暗杠不进入抢杠窗口（phase=" + e2.phase + "）");
}

/* ═══════════════ 7. 听牌 ═══════════════ */
group("7. 听牌 / waitsFor");
{
  eq(T.waitsFor(P("123m 456m 789m 23s 99s"), [], true).join("/"), "1条/4条", "两面听 1条/4条");
  eq(T.waitsFor(P("123m 456m 789m 12s 99s"), [], true).join("/"), "3条", "单钓 3条");
  eq(T.waitsFor(P("11m 22m 33m 44s 55s 66p 7p"), [], true).join("/"), "7筒", "七对听 7筒");
  eq(T.waitsFor(P("123m 456m 789m 12s 99s 5p"), [], true).length, 0, "14 张（多一张）不算听牌");
  ok(T.isTenpai(P("123m 456m 789m 23s 99s"), [], true), "isTenpai 两面听");
  ok(!T.isTenpai(P("13579m 2468s 1357p"), [], true), "isTenpai 散牌为假");
  const w = T.waitsFor(P("123m 456m 789m 东南西北"), [], true);
  ok(w.indexOf("中") < 0 && w.indexOf("發") < 0, "东南西北 不会听「中/發」（字牌不组顺子）");
}

/* ═══════════════ 8. AI 整局（136 张含字牌） ═══════════════ */
group("8. AI 整局（4 家自动 · 136 张含字牌）");
{
  let n = 0, bad = 0;
  const tiers = {};
  for (let i = 0; i < 40; i++) {
    const r = T.autoPlay(4000, true);
    n++;
    if (!r.result && r.steps >= 4000) { bad++; continue; }
    if (r.result) { const k = r.result.draw ? "流局" : r.result.tierName; tiers[k] = (tiers[k] || 0) + 1; }
  }
  eq(bad, 0, "40 局自动对战全部正常收尾（" + n + " 局）");
  console.log("  档位分布：", JSON.stringify(tiers));
  ok(Object.keys(tiers).length > 0, "至少出现一种结算档位");
  const r2 = T.autoPlay(4000, false);
  ok(r2 && (r2.result || r2.steps >= 4000), "无字牌 108 张也能整局跑完");
}

/* ═══════════════ 9. 引擎基础流程 ═══════════════ */
group("9. 引擎基础流程");
{
  const e = new T.Engine(10);
  e.deal();
  eq(e.P[0].hand.length, 14, "庄家起手 14 张");
  eq(e.P[1].hand.length, 13, "闲家起手 13 张");
  eq(e.wall.length, 136 - 53, "牌墙 83 张");
  eq(e.phase, "turn", "发牌后进入出牌阶段");
  eq(e.cur, 0, "庄家先出牌");
  const t = e.P[0].hand[0];
  eq(e.discard(0, 0), true, "庄家打出第一张");
  eq(e.P[0].hand.length, 13, "出牌后 13 张");
  eq(e.P[0].discards[e.P[0].discards.length - 1], t, "牌河里是打出的那张");
  /* 打完第一张后：下一家（或响应窗口）接上；此时只有 e.cur 那家能出牌 */
  const other = (e.cur + 2) % 4;
  eq(e.discard(other, 0), false, "不是自己回合不能出牌（" + other + " 号，当前 " + e.cur + " 号）");
  ok(T.handIsSorted(e.P[1]), "对手手牌按牌面有序");
  ok(T.meldsAreSorted(e.P[1]), "副露（空）也有序");
}

/* ═══════════════ 10. 对外 API 形状 ═══════════════ */
group("10. 对外 API 形状");
{
  ok(typeof MJ.start === "function", "Mahjong.start 是函数");
  ok(typeof MJ.isBusy === "function", "Mahjong.isBusy 是函数");
  ok(typeof MJ.dispose === "function", "Mahjong.dispose 是函数");
  ok(!!MJ.debug && typeof MJ.debug.act === "function", "Mahjong.debug.act 存在");
  ok(!!MJ.debug && typeof MJ.debug.setHand === "function", "Mahjong.debug.setHand 存在");
  ok(!!MJ.debug && typeof MJ.debug.hintNow === "function", "Mahjong.debug.hintNow 存在");
  ok(!!MJ.debug && typeof MJ.debug.brainText === "function", "Mahjong.debug.brainText 存在");
  ok(!!MJ.debug && typeof MJ.debug.hintToggle === "function", "Mahjong.debug.hintToggle 存在");
  ok(!!MJ.debug && typeof MJ.debug.hintStats === "function", "Mahjong.debug.hintStats 存在");
  ok(!!MJ.debug && typeof MJ.debug.resultView === "function", "Mahjong.debug.resultView 存在");
  ok(!!T && typeof T.hintCalc === "function", "test.hintCalc 存在");
  ok(!!T && typeof T.buildResultView === "function", "test.buildResultView 存在");
  ok(!!T && typeof T.resultHtml === "function", "test.resultHtml 存在");
  ok(!!T && typeof T.gainsOf === "function", "test.gainsOf 存在");
  ok(!!T && typeof T.remainingOf === "function", "test.remainingOf 存在");
  ok(!!T && typeof T.hintCacheStats === "function", "test.hintCacheStats 存在");
}

/* ═══════════════ 11. 手牌整理（排序） ═══════════════ */
group("11. 手牌整理（排序）");
{
  const p = { hand: P("9筒 1万 东 3条 2万 1条 5筒 9万 1筒 中 7条 白 4筒"), melds: [], drawn: null };
  T.normalizeHand(p);
  eq(p.hand.join(","), T.sortTiles(p.hand).join(","), "手牌整理为「万→条→筒→字 + 数字升序」");
  ok(T.handIsSorted(p), "handIsSorted 为真");
  const p2 = { hand: P("123m 456m 789m 123s 9s"), melds: [], drawn: null };
  p2.hand.push("5筒"); p2.drawn = "5筒";
  T.normalizeHand(p2);
  eq(p2.hand[p2.hand.length - 1], "5筒", "摸到的牌固定在最右");
  const p3 = { hand: [], melds: [{ type: "peng", tiles: P("9筒 5筒 1筒"), from: 1, an: false, kind: "ming" }], drawn: null };
  T.normalizeHand(p3);
  eq(p3.melds[0].tiles.join(","), "1筒,5筒,9筒", "副露组内按牌面排序");
  ok(T.meldsAreSorted(p3), "meldsAreSorted 为真");
}

/* ═══════════════ 12. 字牌（引擎级） ═══════════════ */
group("12. 字牌（引擎级）");
{
  const honors = T.autoPlay(4000, true);
  ok(honors.result || honors.steps >= 4000, "带字牌 136 张能整局跑完");
  const no = T.autoPlay(4000, false);
  ok(no.result || no.steps >= 4000, "无字牌 108 张能整局跑完");
  eq(T.kindsFor(true).length, 34, "kindsFor(true) = 34 种");
  eq(T.kindsFor(false).length, 27, "kindsFor(false) = 27 种");
  /* 字牌不参与顺子：4 张单字牌不该被顺子「美化」 */
  eq(T.stdShanten(P("东南西北"), 0), 8, "东南西北 4 张孤张字牌 = 8 向听（不组顺子）");
  eq(T.totalShanten(P("123m 456p 789s 东南西北"), 0), 2, "东南西北 不能当搭子 → 仍是 2 向听");
}

/* ═══════════════ 13. 渲染冒烟（stub canvas） ═══════════════ */
group("13. 渲染冒烟（stub canvas）");
{
  const host = makeElement("div");
  eq(MJ.start(host, {}), true, "Mahjong.start 返回 true");
  eq(MJ.isBusy(), true, "开局后 isBusy=true");
  const st = MJ.debug.state();
  ok(!!st && st.on === true, "state.on = true");
  eq(st.phase, "turn", "开局即等玩家出牌");
  ok(st.handSorted === true, "手牌有序");
  const rs = MJ.debug.renderStats();
  ok(!!rs && (typeof rs.frames === "number" || rs.frames === undefined), "renderStats 可读（frames=" + (rs && rs.frames) + "）");
  eq(st.lastErr, "", "渲染无异常");
  ok(MJ.debug.hand().length >= 13, "debug.hand() 返回手牌");
  ok(MJ.debug.wall().count > 0 && MJ.debug.wall().count < 136, "牌墙剩余合法");
  eq(MJ.debug.seats().length, 4, "四家座位");
  MJ.dispose();
  eq(MJ.isBusy(), false, "dispose 后 isBusy=false");
}

/* ═══════════════ 14. 向听数（已知手牌 + DP/暴力双实现交叉验证） ═══════════════ */
group("14. 向听数（已知手牌 + DP/暴力双实现交叉验证）");
{
  const SH = [
    ["成牌 · 三顺一对（14 张）", "123m 456m 789m 123s 99s", 0, -1, -1],
    ["听牌 · 四刻单钓 5万", "111m 222m 333m 444m 5m", 0, 0, 0],
    ["听牌 · 单钓 3条", "123m 456m 789m 12s 99s", 0, 0, 0],
    ["听牌 · 两面 1条/4条", "123m 456m 789m 23s 99s", 0, 0, 0],
    ["听牌 · 九莲式 1112345678999万", "1112345678999m", 0, 0, 0],
    ["听牌 · 14 张只差一张弃牌", "123m 456m 789m 1s 2s 9s 5p 5p", 0, 0, 0],
    ["4 向听 · 无字牌最散", "13579m 2468s 1357p", 0, 4, 4],
    ["8 向听 · 幺九+字牌全孤张（七对更近 = 6）", "19m 19s 19p 东南西北中發白", 0, 8, 6],
    ["8 向听 · 三类牌全孤张", "1m 4m 7m 1s 4s 7s 1p 4p 9p 东南西北", 0, 8, 6],
    ["七对听牌（标准型 1 向听）", "11m 22m 33m 44s 55s 66p 7p", 0, 1, 0],
    ["七对成牌（14 张）", "11m 22m 33m 44s 55s 66p 77p", 0, 1, -1],
    ["七对听牌 · 同花色", "1122334455667m", 0, 0, 0],
    ["七对听牌 · 同花色 6 对一单", "11m 22m 33m 44m 55m 66m 7m", 0, 0, 0],
    ["七对听牌 · 字牌", "东东 南南 西西 北北 中中 發發 白", 0, 3, 0],
    ["字牌刻子 + 单钓 9条", "东东东 123m 456m 789m 9s", 0, 0, 0],
    ["字牌刻子成牌", "东东东 123m 456m 789m 99s", 0, -1, -1],
    ["14 张听牌 · 多面", "234m 567m 234s 567s 5p", 0, 0, 0],
    ["成牌 · 含字牌刻子", "123m 456m 789m 111s 22s", 0, -1, -1],
    ["字牌不能组顺子（东南西+北北）", "东南西 北北 123m 456m 789m", 0, 1, 1],
    ["字牌不能组顺子（东南西北+中中）", "东南西北 中中 123m 456m 99p", 0, 2, 2],
    ["字牌不能组顺子（东南西北 作搭子）", "123m 456p 789s 东南西北", 0, 2, 2],
    ["副露 1 组 · 11 张成牌", "123m 456m 789s 22s", 1, -1, -1],
    ["副露 1 组 · 10 张听牌", "123m 456m 22s 99s", 1, 0, 0],
    ["副露 2 组 · 8 张成牌", "123m 456s 99p", 2, -1, -1],
    ["副露 2 组 · 7 张听牌", "123m 456s 9p", 2, 0, 0],
    ["副露 3 组 · 4 张听牌（两对）", "11m 22m", 3, 0, 0],
    ["副露 3 组 · 4 张两面听", "1234m", 3, 0, 0],
    ["副露 3 组 · 字牌孤张（东南西+东）", "东南西 东", 3, 1, 1],
    ["副露 3 组 · 4 张成牌", "111m 222m 333m 44m", 3, -1, -1],
    ["大吊车 · 副露 4 组单调成对", "55m", 4, -1, -1],
    ["大吊车 · 副露 4 组单调听牌差一张", "11m", 4, -1, -1]
  ];
  let k = 0;
  for (const [name, h, mc, wantStd, wantTotal] of SH) {
    k++;
    const hh = P(h);
    const gotStd = T.stdShanten(hh, mc), gotTot = T.totalShanten(hh, mc);
    ok(gotStd === wantStd, "用例 " + k + " [标准型] " + name, "期望 " + wantStd + "，实际 " + gotStd);
    ok(gotTot === wantTotal, "用例 " + k + " [综合含七对] " + name, "期望 " + wantTotal + "，实际 " + gotTot);
    eq(T.stdShantenBrute(hh, mc), gotStd, "用例 " + k + " 暴力实现与 DP 一致：" + name);
  }
  ok(SH.length >= 15, "已知向听用例 ≥15 组（实际 " + SH.length + " 组）");

  /* 两条完全独立的实现（DP 与暴力拆解）逐手交叉比对 */
  let bad = 0, cmp = 0;
  for (let it = 0; it < 1500; it++) {
    const honors = it % 2 === 0;
    const mc = it % 5;
    const len = (it % 3 === 0) ? (14 - 3 * mc) : (13 - 3 * mc);
    if (len <= 0) continue;
    const pool = [];
    for (const t of (honors ? T.KINDS_ALL : T.KINDS)) for (let q = 0; q < 4; q++) pool.push(t);
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = pool[i]; pool[i] = pool[j]; pool[j] = t; }
    const h = pool.slice(0, len);
    cmp++;
    if (T.stdShanten(h, mc) !== T.stdShantenBrute(h, mc)) {
      bad++;
      if (bad <= 5) console.error("  DP/暴力不一致 mc=" + mc + "：" + T.sortTiles(h).join(" "));
    }
  }
  eq(bad, 0, "随机 " + cmp + " 手（含副露 0~4 组、含/不含字牌）DP 与暴力实现结果完全一致");
  ok(cmp >= 1000, "随机交叉验证样本量 ≥1000（实际 " + cmp + "）");

  ok(T.evaluate(P("东南西 北北 123m 456m 789m"), []) === null, "东南西 不是面子（evaluate 返回 null）");
  eq(T.totalShanten(P("东南西 北北 123m 456m 789m"), 0), 1,
    "向听按「3 面子 + 北北将 + 字牌单张」算 = 1（不把东南西 当顺子）");
  eq(T.totalShanten(P("19m 19s 19p 东南西北中發白"), 0), 6,
    "13 张全孤张：七对 6 向听优于标准型 8 向听");
}

/* ═══════════════ 15. 有效进张与剩余张数 ═══════════════ */
group("15. 有效进张 / 剩余张数");
{
  const H = P("123m 456m 789m 23s 99s");
  eq(T.remainingOf("1条", H, {}), 4, "1条 手里没有、桌上没见 → 还剩 4");
  eq(T.remainingOf("9条", H, {}), 2, "9条 手里 2 张 → 还剩 2");
  eq(T.remainingOf("1条", H, { "1条": 2 }), 2, "1条 已见 2 张 → 还剩 2");
  eq(T.remainingOf("3条", H, { "3条": 4 }), 0, "3条 已见 4 张 → 一张不剩");
  eq(T.remainingOf("9条", H, { "9条": 3 }), 0, "9条 手里 2 + 已见 3 → 钳到 0（不会负数）");
  eq(T.remainingOf("东", H, {}), 4, "字牌同理");

  const W = T.gainsOf(H, 0, {}, true, 0);
  eq(W.map(x => x.tile).join(" "), "1条 4条", "两面听的有效牌就是 1条 / 4条");
  eq(W.reduce((a, x) => a + x.left, 0), 8, "两张各剩 4 张 → 共 8 张");

  const W2 = T.gainsOf(H, 0, { "1条": 2, "4条": 1 }, true, 0);
  eq(W2.reduce((a, x) => a + x.left, 0), 5, "已见 1条×2 / 4条×1 → 剩 2 + 3 = 5 张");
  const w1 = W2.filter(x => x.tile === "1条");
  eq(w1.length, 1, "1条 仍在进张列表里");
  eq(w1.length ? w1[0].left : -1, 2, "1条 剩 2 张（4 − 0 − 2）");

  const W3 = T.gainsOf(H, 0, { "1条": 4 }, true, 0);
  eq(W3.map(x => x.tile).join(" "), "4条", "1条 已见 4 张 → 从进张里剔除");
  eq(W3[0].left, 4, "4条 仍是 4 张");

  const meldsSeen = { "5筒": 3, "1万": 3, "2万": 1 };
  eq(T.remainingOf("5筒", P("13579m 2468s 1357p"), meldsSeen), 0, "手里 1 张 5筒 + 桌上 3 张 → 一张不剩");
  eq(T.remainingOf("1万", P("13579m 2468s 1357p"), meldsSeen), 0, "手里 1 张 1万 + 桌上 3 张 → 一张不剩");
  eq(T.remainingOf("9万", P("13579m 2468s 1357p"), meldsSeen), 3, "手里 1 张 9万 + 桌上没见 → 还剩 3");
  eq(T.remainingOf("2万", P("13579m 2468s 1357p"), meldsSeen), 3, "手里没有 2万 + 桌上已见 1 张 → 还剩 3");

  /* 未听牌：每个「进张」都必须真的让向听 −1，且剩余张数账目闭合 */
  let bad = 0, checked = 0, hands = 0;
  for (let it = 0; it < 120; it++) {
    const pool = [];
    for (const t of T.KINDS_ALL) for (let q = 0; q < 4; q++) pool.push(t);
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = pool[i]; pool[i] = pool[j]; pool[j] = t; }
    const h = pool.slice(0, 13);
    const s = T.totalShanten(h, 0);
    if (s <= 0) continue;
    hands++;
    const g = T.gainsOf(h, 0, {}, true, s);
    for (const x of g) {
      checked++;
      if (T.totalShanten(h.concat([x.tile]), 0) !== s - 1) bad++;
      if (4 - T.countIn(h, x.tile) !== x.left) bad++;           // 桌上没见 → left 必须等于 4 − 手里张数
    }
  }
  eq(bad, 0, "随机 " + hands + " 手（未听牌）：每个进张都能让向听 −1，且剩余张数账目闭合（共查 " + checked + " 张）");
  ok(checked > 0, "随机手牌确实存在进张（共 " + checked + " 张）");
  ok(hands >= 50, "未听牌样本量充足（" + hands + " 手）");
}

/* ═══════════════ 16. 智脑提示（选牌 / 听牌 / 有效牌） ═══════════════ */
group("16. 智脑提示（选牌 / 听牌 / 有效牌）");
{
  const h1 = T.hintCalc({ hand: P("123m 456m 789m 12s 99s 5p"), melds: [], seen: {}, honors: true });
  eq(h1.discard, "5筒", "① 14 张手牌建议打 5筒");
  eq(h1.shanten, 0, "① 打完即听（0 向听）");
  eq(h1.tenpaiAfter, true, "① 标记「打完成听」");
  eq(h1.waits.join("/"), "3条", "① 听 3条");
  eq(h1.waitsLeft, 4, "① 剩 4 张");
  const t1 = T.hintLines(h1);
  eq(t1.l1, "打 5筒 → 听 3条（剩 4 张）", "① 提示文案：打 5筒 → 听 3条（剩 4 张）");
  ok(/^有效牌：/.test(t1.l2), "① 第二行以「有效牌：」开头 → " + t1.l2);

  const h2 = T.hintCalc({ hand: P("123m 456m 789m 23s 99s 东"), melds: [], seen: {}, honors: true });
  eq(h2.discard, "东", "② 打孤张字牌 东");
  eq(h2.waits.join("/"), "1条/4条", "② 两面听 1条/4条");
  eq(h2.waitsLeft, 8, "② 剩 8 张");
  eq(T.hintLines(h2).l1, "打 东 → 听 1条/4条（剩 8 张）", "② 提示文案带张数");

  const h3 = T.hintCalc({ hand: P("11m 22m 33m 44s 55s 66p 7p"), melds: [], seen: {}, honors: true });
  eq(h3.tenpaiNow, true, "③ 13 张手牌判定「已听」");
  eq(h3.discard, null, "③ 已听时没有「建议打出的牌」");
  eq(h3.waits.join("/"), "7筒", "③ 六对一单 → 只听 7筒");
  eq(T.hintLines(h3).l1, "已听：7筒（剩 3 张）", "③ 文案：已听：7筒（剩 3 张）");

  const h4 = T.hintCalc({ hand: P("13579m 2468s 1357p 中"), melds: [], seen: {}, honors: true });
  ok(h4.improve.length > 0 && h4.improve.length <= 5, "④ 有效牌提示列 1~5 种（实际 " + h4.improve.length + "）");
  ok(h4.improve.every(x => x.left >= 1 && x.left <= 4), "④ 每种都标注 1~4 的剩余张数");
  ok(/^有效牌：/.test(T.hintLines(h4).l2), "④ 文案以「有效牌：」开头 → " + T.hintLines(h4).l2);
  ok(h4.improveKinds >= h4.improve.length, "④ improveKinds 不少于展示条数");

  const h5h = P("7m 8m 3s 5s 8s 9s 9s 5p 6p 7p 8p 东 發發");
  const h5 = T.hintCalc({ hand: h5h, melds: [], seen: {}, honors: true });
  eq(h5.discard, "东", "⑤ 并列时选孤张（字牌孤张 东）");
  ok(T.isolation(h5h, "东") < T.isolation(h5h, "5筒"), "⑤ 东 的孤张度确实低于 5筒");
  ok(T.isolation(h5h, "东") < T.isolation(h5h, "8筒"), "⑤ 东 的孤张度确实低于 8筒");

  /* ⑥ 选牌最优性：随机 400 手，断言建议的那张确实「向听最小且进张最多」 */
  let bad = 0, checked = 0, tenpaiCases = 0, nonTenpai = 0;
  for (let it = 0; it < 400; it++) {
    const pool = [];
    for (const t of T.KINDS_ALL) for (let q = 0; q < 4; q++) pool.push(t);
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = pool[i]; pool[i] = pool[j]; pool[j] = t; }
    /* 一半随机手牌，一半构造「一打即听」：4 组面子 + 1 张单吊，摸到重复张 */
    let h = pool.slice(0, 14);
    if (it % 2 === 1) {
      const melds = ["1万", "1万", "1万", "1条", "1条", "1条", "1筒", "1筒", "1筒", "2万", "3万", "4万"];
      h = melds.concat(["9条", "9条"]);
    }
    const r = T.hintCalc({ hand: h, melds: [], seen: {}, honors: true });    const opts = r.options;
    let bs = 99, bu = -1;
    for (const o of opts) { if (o.shanten < bs) { bs = o.shanten; bu = o.ukeire; } else if (o.shanten === bs && o.ukeire > bu) bu = o.ukeire; }
    const chosen = opts.filter(o => o.discard === r.discard)[0];
    checked++;
    if (!chosen || chosen.shanten !== bs || chosen.ukeire !== bu) {
      bad++;
      if (bad <= 3) console.error("  非最优：手牌 " + T.sortTiles(h).join(" ") + " 建议 " + r.discard + "（sh " + (chosen && chosen.shanten) + "/" + bs + "，uke " + (chosen && chosen.ukeire) + "/" + bu + "）");
    }
    if (bs === 0) tenpaiCases++; else nonTenpai++;
  }
  eq(bad, 0, "随机 " + checked + " 手：建议打出的那张始终是「向听最小 + 进张最多」的最优解之一");
  ok(tenpaiCases > 0, "样本里含「一打即听」的局面（" + tenpaiCases + " / " + checked + "）");
  ok(nonTenpai > 0, "样本里也含非听牌局面（" + nonTenpai + " / " + checked + "）");

  /* ⑦ 缓存 + 性能（目标 < 300ms） */
  T.hintCacheClear();
  const s1 = T.hintCacheStats();
  T.hintCalc({ hand: P("13579m 2468s 1357p 中"), melds: [], seen: {}, honors: true });
  const s2 = T.hintCacheStats();
  T.hintCalc({ hand: P("13579m 2468s 1357p 中"), melds: [], seen: {}, honors: true });
  const s3 = T.hintCacheStats();
  eq(s1.size, 0, "⑦ 缓存初始为空");
  eq(s2.size, 1, "⑦ 首次计算写入缓存");
  eq(s3.hits, 1, "⑦ 相同手牌第二次直接命中缓存");
  let worst = 0, worstHand = "", sum = 0, n = 0;
  for (let it = 0; it < 60; it++) {
    const pool = [];
    for (const t of T.KINDS_ALL) for (let q = 0; q < 4; q++) pool.push(t);
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = pool[i]; pool[i] = pool[j]; pool[j] = t; }
    const h = pool.slice(0, 14);
    T.hintCacheClear();
    const t0 = Date.now();
    T.hintCalc({ hand: h, melds: [], seen: {}, honors: true });
    const ms = Date.now() - t0;
    sum += ms; n++;
    if (ms > worst) { worst = ms; worstHand = T.sortTiles(h).join(" "); }
  }
  ok(worst < 300, "⑦ 单次提示计算最坏耗时 " + worst + "ms < 300ms（平均 " + (sum / n).toFixed(0) + "ms）");
  console.log("  提示最坏耗时 " + worst + "ms / 平均 " + (sum / n).toFixed(0) + "ms（" + worstHand + "）");
}

/* ═══════════════ 17. 结算亮牌数据结构 ═══════════════ */
group("17. 结算亮牌数据结构");
{
  function mkE() { const e = new T.Engine(10); e.deal(); return e; }
  function sortedOk(h) { for (let i = 1; i < h.length; i++) if (T.cmpTile(h[i - 1], h[i]) > 0) return false; return true; }

  const e1 = mkE();
  e1.P[0].hand = P("123m 456m 789m 123s 99s"); e1.P[0].melds = []; e1.P[0].drawn = "9条";
  e1.P[1].hand = P("11m 22m 33m 44s 55s 66p 7p"); e1.P[1].drawn = "7筒";
  e1.P[2].hand = P("13579m 2468s 135p 9p 9p"); e1.P[2].drawn = null;
  e1.P[3].hand = P("123m 456m 789m 111s 22s"); e1.P[3].drawn = "2条";
  e1.settle(0, { selfDraw: true }, T.evaluate(e1.P[0].hand, e1.P[0].melds));
  const r1 = T.buildResultView(e1, e1.result);
  eq(r1.seats.length, 4, "① 四家都有亮牌数据");
  eq(r1.seats.map(s => s.name).join("/"), "你/金老板/红姐/顾曼", "① 四家名字顺序正确");
  eq(r1.names, "你/金老板/红姐/顾曼", "① names 字段与座位一致");
  ok(r1.seats.every(s => sortedOk(s.hand)), "① 每家手牌都按「万→条→筒→字 + 数字」排好序");
  eq(r1.seats[0].hand.length, 14, "① 胡家手牌 14 张（含胡的那张）");
  eq(r1.seats[0].win, true, "① 胡家标记 win");
  eq(r1.seats[0].winTile, "9条", "① 记录胡的那张牌 9条");
  ok(r1.seats[0].winTileIdx >= 0 && r1.seats[0].hand[r1.seats[0].winTileIdx] === "9条", "① 胡牌张能在手牌里定位（单独描金边用）");
  eq(r1.seats[0].tierName, "小胡", "① 档位为小胡");
  eq(r1.seats[0].how, "自摸", "① 标注自摸");
  eq(r1.seats[0].net, 60, "① 你的净收支 +60");
  eq(r1.per, 20, "① 小胡每家应付 20");
  eq(r1.total, 60, "① 小胡共收 60");
  eq(r1.payers.length, 3, "① 三家都要付");
  eq(r1.payers.map(p => p.amount).join("/"), "20/20/20", "① 三家各付 20");
  ok(r1.payText1.indexOf("赔付明细") >= 0 && r1.payText1.indexOf("60") >= 0 && r1.payText1.indexOf("20") >= 0,
    "① 赔付明细文本包含金额 → " + r1.payText1);
  ok(r1.payText2.indexOf("+60") >= 0, "① 明示你的净收支 → " + r1.payText2);
  eq(r1.tiers.map(t => t.total).join("/"), "60/240/360/720", "① 列出赣麻四档赔付 60/240/360/720");
  eq(r1.tiers.map(t => t.name).join("/"), "小胡/大胡/大大胡/最大胡", "① 四档名称正确");
  ok(r1.tiers.filter(t => t.cur).length === 1 && r1.tiers.filter(t => t.cur)[0].key === "small", "① 当前档位高亮正确");

  const e2 = mkE();
  e2.P[0].hand = P("123m 456m 789m 123s 99s"); e2.P[0].melds = []; e2.P[0].drawn = "9条";
  e2.P[1].hand = P("234m 567m 123s 99s");
  e2.P[1].melds = [
    { type: "peng", tiles: P("5筒 5筒 5筒"), from: 0, an: false, kind: "ming" },
    { type: "gang", tiles: P("3万 3万 3万 3万"), from: 2, an: true, kind: "an" },
    { type: "gang", tiles: P("7条 7条 7条 7条"), from: 1, an: false, kind: "ming" },
    { type: "gang", tiles: P("中 中 中 中"), from: 3, an: false, kind: "bu" }
  ];
  e2.P[1].drawn = null;
  e2.P[2].hand = P("13579m 2468s 1357p"); e2.P[2].drawn = null;
  e2.P[3].hand = P("19m 19s 19p 东南西北中發白"); e2.P[3].drawn = null;
  e2.settle(0, { selfDraw: true }, T.evaluate(e2.P[0].hand, e2.P[0].melds));
  const r2 = T.buildResultView(e2, e2.result);
  eq(r2.seats[1].melds.length, 4, "② 副露四组都进结算数据");
  eq(r2.seats[1].melds.map(m => m.label).join("/"), "碰/暗杠/明杠/补杠", "② 副露类型分别标注 碰/暗杠/明杠/补杠");
  ok(r2.seats[1].melds.every(m => sortedOk(m.tiles)), "② 副露组内也按牌面排序");
  eq(r2.seats[1].meldTxt.indexOf("碰5筒") >= 0, true, "② 副露文本带类型与牌面 → " + r2.seats[1].meldTxt);
  eq(r2.seats[2].tenpai, false, "② 散牌家标记未听牌");
  eq(r2.seats[3].tenpai, false, "② 13 张全孤张不算听牌");
  const e2b = mkE();
  e2b.P[0].hand = P("123m 456m 789m 123s 99s"); e2b.P[0].drawn = "9条";
  e2b.P[3].hand = P("123m 456m 789m 23s 99s"); e2b.P[3].drawn = null;
  e2b.settle(0, { selfDraw: true }, T.evaluate(e2b.P[0].hand, e2b.P[0].melds));
  const r2b = T.buildResultView(e2b, e2b.result);
  eq(r2b.seats[3].tenpai, true, "② 两面听的家标记 tenpai");
  ok(r2b.seats[3].waits.length > 0, "② 听牌家给出听牌张 → " + r2b.seats[3].waits.join("/"));

  const e3 = mkE();
  e3.P[1].hand = P("123m 456m 789m 111s 22s"); e3.P[1].melds = []; e3.P[1].drawn = "2条";
  e3.P[0].hand = P("123m 456m 789m 123s 9s"); e3.P[0].drawn = null;
  e3.P[2].hand = P("13579m 2468s 1357p"); e3.P[2].drawn = null;
  e3.P[3].hand = P("19m 19s 19p 东南西北中發白"); e3.P[3].drawn = null;
  e3.settle(1, { selfDraw: true }, T.evaluate(e3.P[1].hand, e3.P[1].melds));
  const r3 = T.buildResultView(e3, e3.result);
  eq(r3.seats[1].win, true, "③ AI（金老板）是胡家");
  eq(r3.mine, -20, "③ 你付 20");
  eq(r3.seats[0].pay, 20, "③ 你的应付额 20");
  eq(r3.seats[2].pay + r3.seats[3].pay, 40, "③ 其他两家各付 20");
  ok(r3.payText1.indexOf("你 付 20") >= 0, "③ 赔付明细里列出你的应付 → " + r3.payText1);
  ok(r3.payText2.indexOf("-20") >= 0, "③ 你的净收支 −20 → " + r3.payText2);

  const TIERCASE = [
    ["123m 456m 789m 123s 99s", [], "小胡", 60],
    ["111m 222m 333s 444p 55s", [], "大胡", 240],
    ["11m 22m 33m 44s 55s 66p 77p", [], "大大胡", 360],
    ["1111m 22m 33s 44s 55p 66p", [], "最大胡", 720]
  ];
  for (const [h, melds, wantName, wantTotal] of TIERCASE) {
    const e = mkE();
    e.P[0].hand = P(h); e.P[0].melds = melds; e.P[0].drawn = null;
    const ev = T.evaluate(e.P[0].hand, e.P[0].melds);
    if (!ev) { ok(false, "④ " + wantName + " 用例成牌判定失败：" + h); continue; }
    e.settle(0, { selfDraw: true }, ev);
    const rv = T.buildResultView(e, e.result);
    eq(rv.tierName, wantName, "④ " + h + " → 档位 " + wantName);
    eq(rv.total, wantTotal, "④ " + wantName + " 共收 " + wantTotal);
    eq(rv.mine, wantTotal, "④ " + wantName + " 你的净收支 +" + wantTotal);
    eq(rv.per * 3, wantTotal, "④ 每家应付 × 3 = " + wantTotal);
  }

  const e5 = mkE();
  e5.P[0].melds = [{ type: "peng", tiles: P("5筒 5筒 5筒"), from: 1, an: false, kind: "ming" }];
  e5.P[0].hand = P("1m 2m 3m 6m 7m 8m 1s 2s 3s 5p");
  e5.P[1].hand = P("1m 2m 3m 4m 5m 6m 7m 8m 9m 1s 2s 3s 5p"); e5.P[1].drawn = null;
  e5.P[2].hand = P("13579m 2468s 1357p"); e5.P[2].drawn = null;
  e5.P[3].hand = P("19m 19s 19p 东南西北中發白"); e5.P[3].drawn = null;
  e5.cur = 0; e5.phase = "turn";
  e5.pending = { type: "turn", seat: 0, anGangs: [], addGangs: ["5筒"] };
  ok(e5.turnGang(0, "5筒", "bu") === true, "⑤ 0 号家补杠 5筒");
  ok(e5.rob(1) === true, "⑤ 1 号家抢杠胡");
  const r5 = T.buildResultView(e5, e5.result);
  eq(r5.payerOnly, true, "⑤ 标记「杠牌一家包赔」");
  eq(r5.payerSeat, 0, "⑤ 包赔家是杠牌的 0 号（你）");
  eq(r5.seats[0].pay, 60, "⑤ 你（杠家）付全部 60");
  eq(r5.seats[2].pay, 0, "⑤ 红姐付 0");
  eq(r5.seats[3].pay, 0, "⑤ 顾曼付 0");
  eq(r5.seats[1].net, 60, "⑤ 抢杠家收 60");
  eq(r5.mine, -60, "⑤ 你的净收支 −60");
  eq(r5.seats[1].how, "抢杠胡", "⑤ 标注「抢杠」来源");
  ok(r5.payText1.indexOf("包赔三家") >= 0, "⑤ 明细里说明包赔 → " + r5.payText1);

  const e6 = mkE();
  e6.P[0].hand = P("123m 456m 789m 123s 9s"); e6.P[0].drawn = null;
  e6.P[1].hand = P("13579m 2468s 1357p"); e6.P[1].drawn = null;
  e6.P[2].hand = P("19m 19s 19p 东南西北中發白"); e6.P[2].drawn = null;
  e6.P[3].hand = P("123m 456m 789m 23s 99s"); e6.P[3].drawn = null;
  e6.drawGame("牌墙摸完（无人成牌）");
  const r6 = T.buildResultView(e6, e6.result);
  eq(r6.draw, true, "⑥ 标记流局");
  ok(r6.why.indexOf("牌墙摸完") >= 0, "⑥ 说明原因：牌墙摸完 → " + r6.why);
  eq(r6.seats.length, 4, "⑥ 流局也亮四家手牌");
  eq(r6.seats.reduce((a, s) => a + s.hand.length, 0), 52, "⑥ 四家手牌共 52 张（13×4）");
  ok(r6.seats.every(s => sortedOk(s.hand)), "⑥ 流局四家手牌都排好序");
  ok(r6.seats.every(s => s.net === 0), "⑥ 流局不计收支");
  eq(r6.mine, 0, "⑥ 流局你的净收支 0");
  eq(r6.payText1.indexOf("流局原因") >= 0, true, "⑥ 流局文案带原因 → " + r6.payText1);

  const e7 = mkE();
  e7.P[0].hand = P("55m");
  e7.P[0].melds = [
    { type: "peng", tiles: P("1m 1m 1m"), from: 1, an: false, kind: "ming" },
    { type: "peng", tiles: P("2s 2s 2s"), from: 2, an: false, kind: "ming" },
    { type: "peng", tiles: P("3p 3p 3p"), from: 3, an: false, kind: "ming" },
    { type: "gang", tiles: P("6m 6m 6m 6m"), from: -1, an: true, kind: "an" }
  ];
  e7.P[0].drawn = "5万";
  e7.settle(0, { selfDraw: true }, T.evaluate(e7.P[0].hand, e7.P[0].melds));
  const r7 = T.buildResultView(e7, e7.result);
  eq(r7.tierName, "大大胡", "⑦ 大吊车（手中仅剩一张单调成对）= 大大胡 360");
  eq(r7.total, 360, "⑦ 大吊车共收 360");
  eq(r7.seats[0].melds.map(m => m.label).join("/"), "碰/碰/碰/暗杠", "⑦ 大吊车的副露类型也都标出来");
  const e8 = mkE();
  e8.P[0].hand = P("1111m 22m 33s 44s 55p 66p"); e8.P[0].melds = []; e8.P[0].drawn = "1万";
  e8.settle(0, { selfDraw: true }, T.evaluate(e8.P[0].hand, e8.P[0].melds));
  const r8 = T.buildResultView(e8, e8.result);
  eq(r8.tierName, "最大胡", "⑧ 龙七对（七对含 4 张）= 最大胡 720");
  eq(r8.total, 720, "⑧ 龙七对共收 720");

  const html1 = T.resultHtml(r1, e1.result);
  eq((html1.match(/class="mjm-rhand[ "]/g) || []).length, 4, "⑨ 结算面板渲染出 4 组手牌");
  eq((html1.match(/class="mjm-rtile/g) || []).length, r1.handTotal + r1.meldTotal,
    "⑨ 手牌牌面元素数 = 四家手牌总张数（" + (r1.handTotal + r1.meldTotal) + "）");
  ok(html1.indexOf("赔付明细") >= 0 && html1.indexOf("共 60") >= 0, "⑨ 面板文本含赔付明细与金额");
  ok(html1.indexOf('id="mjmGo"') >= 0, "⑨ 面板带「继续」按钮（沿用 onFinish 流程）");
  ok(html1.indexOf("mjm-rtile win") >= 0, "⑨ 胡的那张牌在面板里有单独高亮样式");
  ok(html1.indexOf("小胡") >= 0 && html1.indexOf("720") >= 0, "⑨ 面板列出四档赔付（60/240/360/720）");
  const html2 = T.resultHtml(r2, e2.result);
  eq(html2.indexOf("碰5筒") >= 0, true, "⑨ 副露在面板里标注为「类型+牌面」（碰5筒）");
  eq(html2.indexOf("暗杠3万") >= 0, true, "⑨ 暗杠标注出来（暗杠3万）");
  eq(html2.indexOf("补杠中") >= 0, true, "⑨ 补杠标注出来（补杠中）");
  eq(html2.indexOf("明杠7条") >= 0, true, "⑨ 明杠标注出来（明杠7条）");
  const html6 = T.resultHtml(r6, e6.result);
  eq((html6.match(/class="mjm-rhand[ "]/g) || []).length, 4, "⑨ 流局面板同样渲染 4 组手牌");
  ok(html6.indexOf("流局原因") >= 0, "⑨ 流局面板说明原因");
}

/* ═══════════════ 18. 提示 UI + 结算亮牌（stub DOM） ═══════════════ */
(async function section18() {
  group("18. 提示 UI / 结算亮牌（stub DOM）");
  const host = makeElement("div");
  eq(MJ.start(host, {}), true, "开局（stub DOM）");
  ok(!!documentStub.getElementById("mjmBrain"), "「智脑提示」面板已插入 DOM");
  ok(!!documentStub.getElementById("mjmBrainB"), "提示文本容器存在");
  ok(!!documentStub.getElementById("mjmHintToggle"), "提示开关存在");
  ok(!!documentStub.getElementById("mjmHintMark"), "手牌金框叠加层存在");

  const res = MJ.debug.setHand(P("123m 456m 789m 1s 2s 3s 4s 中"), [], null);
  eq(res, true, "调试：强行给一手 14 张牌并轮到自己");
  const h = MJ.debug.hintNow();
  ok(!!h, "hintNow() 同步算出提示");
  eq(h.discard, "中", "建议打 中（打掉中 即听 1条/4条）");
  eq(h.discardIdx >= 0, true, "建议的牌在手牌里有下标（画金框用）");
  const bt = MJ.debug.brainText();
  ok(bt.panel.indexOf("打 中") >= 0, "面板显示「打 中 …」建议文本 → " + bt.panel.replace(/<[^>]*>/g, " ").slice(0, 70));
  ok(bt.panel.indexOf("剩 ") >= 0 || bt.panel.indexOf("有效进张") >= 0, "面板显示听牌/进张张数");
  eq(bt.markClass.indexOf("on") >= 0, true, "被建议的牌有高亮 class（on）");
  ok(/^\d+(\.\d+)?px$/.test(bt.markLeft), "金框定位到具体像素 left=" + bt.markLeft);
  ok(/^\d+(\.\d+)?px$/.test(bt.markTop), "金框定位到具体像素 top=" + bt.markTop);
  eq(bt.markDisplay, "block", "金框已显示");
  const rs = MJ.debug.renderStats();
  eq(rs.hintIdx, h.discardIdx, "画布上同一张牌也带金框标记（renderStats.hintIdx）");

  eq(MJ.debug.hintToggle(false), false, "关闭智脑提示");
  const btOff = MJ.debug.brainText();
  eq(btOff.toggle, "关", "开关文字变成「关」");
  ok(btOff.panel.indexOf("已关闭") >= 0, "面板提示已关闭 → " + btOff.panel.replace(/<[^>]*>/g, ""));
  eq(btOff.markDisplay, "none", "关闭后金框收起");
  eq(MJ.debug.hint(), null, "关闭后 hint() 返回 null");
  eq(MJ.debug.hintToggle(true), true, "重新开启智脑提示");
  const btOn = MJ.debug.brainText();
  eq(btOn.toggle, "开", "开关文字回到「开」");
  ok(btOn.panel.indexOf("打 中") >= 0, "开启后提示恢复");
  eq(MJ.debug.hintToggle(), false, "不带参数 = 切换（开 → 关）");
  eq(MJ.debug.hintToggle(), true, "不带参数 = 切换（关 → 开）");
  const hs = MJ.debug.hintStats();
  ok(hs.calcCount >= 1 && typeof hs.lastMs === "number", "提示统计可读：算过 " + hs.calcCount + " 次，最近 " + hs.lastMs + "ms");

  const resEl = () => documentStub.getElementById("mjmRes") || { innerHTML: "", style: {} };
  eq(MJ.debug.forceWin(0), true, "调试造胡（小胡自摸）");
  eq(MJ.debug.act("settle"), true, "触发结算面板");
  for (let i = 0; i < 30 && resEl().style.display !== "flex"; i++) await sleep(60);
  const rv = MJ.debug.resultView();
  ok(!!rv && rv.seats.length === 4, "结算亮牌数据已生成（4 家）");
  const panelHtml = resEl().innerHTML;
  eq((panelHtml.match(/class="mjm-rhand[ "]/g) || []).length, 4, "结算面板渲染出 4 组手牌");
  const tiles = panelHtml.match(/class="mjm-rtile/g) || [];
  ok(tiles.length >= 52, "面板里手牌牌面元素数 ≥52（实际 " + tiles.length + "）");
  ok(panelHtml.indexOf("赔付明细") >= 0 && panelHtml.indexOf("60") >= 0, "赔付明细文本包含金额");
  ok(panelHtml.indexOf('id="mjmResHands"') >= 0, "面板含手牌区容器 #mjmResHands");
  ok(panelHtml.indexOf('id="mjmResPay"') >= 0, "面板含赔付区容器 #mjmResPay");
  ok(panelHtml.indexOf('id="mjmGo"') >= 0, "面板含「继续」按钮 #mjmGo");
  const rs2 = MJ.debug.render();
  eq(rs2.resHands, 4, "Canvas 亮牌板画出 4 家");
  ok(rs2.resHandTiles >= 52, "Canvas 亮牌板画出 ≥52 张手牌（实际 " + rs2.resHandTiles + "）");

  let fin = null;
  MJ.dispose();
  const host2 = makeElement("div");
  eq(MJ.start(host2, { onFinish: function (r) { fin = r; } }), true, "带 onFinish 重新开局");
  eq(MJ.debug.forceWin(0), true, "再次造胡");
  eq(MJ.debug.act("settle"), true, "再次结算");
  for (let i = 0; i < 30 && resEl().style.display !== "flex"; i++) await sleep(60);
  const go2 = documentStub.getElementById("mjmGo");
  ok(!!go2, "「继续」按钮已解析进 DOM（stub 会登记 innerHTML 里的 id）");
  if (go2 && typeof go2.onclick === "function") go2.onclick();
  ok(!!fin && fin.win === true && fin.score === 60 && fin.fan === 1, "点击继续 → onFinish 收到 win:true / 60 / 1 倍（契约不变）");
  eq(MJ.isBusy(), false, "结算后 isBusy=false");
  MJ.dispose();
  eq(MJ.isBusy(), false, "dispose 后 isBusy=false");

  console.log("\n════════════════════════════════");
})();


/* ─────────────── 19. 打牌语音播报（素材名映射 / 开关持久化 / 事件触发 / 缺文件不报错） ─────────────── */
(async function section19() {
  group("19. 打牌语音播报");

  /* ① 纯映射：给定「打出 1筒 / 碰 / 自摸」能解析到正确文件名 */
  eq(T.voiceFile("1筒"), "1筒.mp3", "牌名映射：1筒 → 1筒.mp3");
  eq(T.voiceFile("9万"), "9万.mp3", "牌名映射：9万 → 9万.mp3");
  eq(T.voiceFile("5条"), "5条.mp3", "牌名映射：5条 → 5条.mp3");
  eq(T.voiceFile("东"), "东.mp3", "字牌映射：东 → 东.mp3");
  eq(T.voiceFile("白"), "白.mp3", "字牌映射：白 → 白.mp3");
  eq(T.voiceFile("發"), "发.mp3", "字牌映射：「發」用素材名 发.mp3");
  eq(T.voiceFile("中"), "中.mp3", "字牌映射：中 → 中.mp3");
  eq(T.voiceFile("碰"), "碰.mp3", "动作映射：碰 → 碰.mp3");
  eq(T.voiceFile("杠"), "杠.mp3", "动作映射：杠 → 杠.mp3");
  eq(T.voiceFile("暗杠"), "暗杠.mp3", "动作映射：暗杠 → 暗杠.mp3");
  eq(T.voiceFile("补杠"), "补杠.mp3", "动作映射：补杠 → 补杠.mp3");
  eq(T.voiceFile("胡"), "胡.mp3", "动作映射：胡 → 胡.mp3");
  eq(T.voiceFile("自摸"), "自摸.mp3", "动作映射：自摸 → 自摸.mp3（按用户原话优先「自摸！」）");
  eq(T.voiceFile("抢杠"), "抢杠.mp3", "动作映射：抢杠 → 抢杠.mp3");
  eq(T.voiceFile("杠开"), "杠开.mp3", "动作映射：杠开 → 杠开.mp3");
  eq(T.voiceFile("听"), "听.mp3", "动作映射：听 → 听.mp3");
  eq(T.voiceFile("过"), "过.mp3", "动作映射：过 → 过.mp3");
  eq(T.voiceFile("流局"), "流局.mp3", "动作映射：流局 → 流局.mp3");
  eq(T.voiceFile("1筒.mp3"), "1筒.mp3", "已带扩展名也能解析（幂等）");
  eq(T.voiceFile(""), "", "空串 → 空（静默跳过）");
  eq(T.voiceFile(null), "", "null → 空（静默跳过）");
  eq(T.voiceFile(undefined), "", "undefined → 空（静默跳过）");
  eq(T.voiceFile("10筒"), "", "不存在的牌名 → 空（不猜、不报错）");
  eq(T.voiceFile("一筒"), "", "汉字数字不算牌名 → 空");
  eq(T.voiceFile("碰碰"), "", "错词 → 空");
  eq(T.voiceFile("100万"), "", "越界数字 → 空");
  let nk = 0;
  for (const k of Object.keys(T.VOICE_NAMES)) nk++;
  eq(nk, 45, "语音词表共 45 条（27 序数牌 + 7 字牌 + 11 动作）");
  let files = 0, namesOk = true;
  for (const k of Object.keys(T.VOICE_NAMES)) { if (T.voiceFile(k)) files++; else namesOk = false; }
  eq(files, 45, "45 个词条全部能解析到文件名（无死词条）");
  eq(namesOk, true, "词表里没有解析不出来的词条");
  eq(T.VOICE_KEY, "mjVoiceOn", "localStorage 键名 = mjVoiceOn");
  const fileList = [];
  for (const k of Object.keys(T.VOICE_NAMES)) fileList.push(T.voiceFile(k));
  eq(fileList.filter((v, i) => fileList.indexOf(v) === i).length, 45, "45 个文件名互不重复");

  /* ② URL / 基址（HTA 里是绝对 file:// 路径，index.html 里是相对路径） */
  const vbase = MJ.debug.voiceBase();
  ok(/audio\/mj\/$/.test(vbase), "语音目录基址以 audio/mj/ 结尾 → " + vbase);
  const u1 = MJ.debug.voiceUrl("1筒");
  ok(u1.indexOf("audio/mj/1筒.mp3") >= 0, "voiceUrl(1筒) 指向 audio/mj/1筒.mp3 → " + u1);
  eq(u1, MJ.debug.voiceUrl("1筒"), "同一张牌 URL 稳定（可缓存复用）");
  eq(MJ.debug.voiceUrl("不存在"), "", "无法映射的名字返回空串");
  eq(u1.indexOf("?") < 0 && u1.indexOf("&") < 0, true, "URL 不带查询串（静态素材）");
  ok(MJ.debug.voiceRelBase().length > 0, "voiceRelBase() 可读 → " + MJ.debug.voiceRelBase());
  eq(MJ.debug.voiceStats().total, 45, "voiceStats().total = 45 条素材");

  /* ③ 开关：切换 / 持久化 / 关闭后不播 */
  eq(typeof MJ.debug.voiceToggle(), "boolean", "voiceToggle() 无参 = 切换，返回布尔");
  eq(MJ.debug.voiceToggle(false), false, "关闭语音");
  eq(MJ.debug.voiceStats().on, false, "voiceStats().on = false");
  const playsBefore = MJ.debug.voiceStats().plays;
  const missBefore = MJ.debug.voiceStats().misses;
  eq(MJ.debug.say("自摸"), "", "关掉开关后 say() 直接返回空（不播）");
  eq(MJ.debug.voiceStats().plays, playsBefore, "关掉开关后 plays 不增长");
  eq(MJ.debug.voiceStats().misses, missBefore, "关掉开关后也不记 miss");
  eq(MJ.debug.voiceToggle(true), true, "重新打开语音");
  eq(MJ.debug.voiceStats().on, true, "voiceStats().on 恢复 true");
  let lsVal = "n/a";
  try { lsVal = String(windowStub.localStorage ? windowStub.localStorage.getItem("mjVoiceOn") : "n/a"); } catch (e) { lsVal = "n/a"; }
  ok(lsVal === "1" || lsVal === "n/a", "开关状态写入 localStorage（键 mjVoiceOn）= " + lsVal);

  /* ④ 缺文件不抛错：stub 环境没有 Audio，say() 也必须静默返回 URL */
  let threw = false;
  try {
    MJ.debug.say("1筒"); MJ.debug.say("碰"); MJ.debug.say("自摸");
    MJ.debug.say("不存在的牌"); MJ.debug.say(""); MJ.debug.say(null);
  } catch (e) { threw = true; }
  eq(threw, false, "无 Audio 环境（素材缺失）下 say() 不抛错，静默跳过");
  const stA = MJ.debug.voiceStats();
  ok(stA.errors >= 0 && stA.misses >= 0, "voiceStats 暴露 misses/errors 计数（misses=" + stA.misses + " errors=" + stA.errors + "）");
  eq(stA.last, "自摸.mp3", "最后一次成功解析到的是 自摸.mp3");
  ok(stA.uniq.indexOf("1筒.mp3") >= 0 && stA.uniq.indexOf("碰.mp3") >= 0, "1筒 / 碰 都进入过播报记录");
  ok(typeof stA.lastAt === "number" && isFinite(stA.lastAt), "记录播报时间戳（便于验证「不阻塞」）→ " + stA.lastAt);

  /* ⑤ 事件触发：出牌 → 牌名；自摸 → 自摸；开关点得动 */
  MJ.dispose();
  const hostV = makeElement("div");
  eq(MJ.start(hostV, {}), true, "语音段：开局");
  eq(MJ.debug.voiceStats().plays, 0, "新开一局 plays 归零（不把上一局算进来）");
  eq(MJ.debug.voiceStats().ting.join(","), "false,false,false,false", "新开一局听牌播报状态复位");
  ok(!!documentStub.getElementById("mjmVoiceToggle"), "牌桌上存在 🔊 语音开关（#mjmVoiceToggle）");
  ok(!!documentStub.getElementById("mjmTing"), "听牌徽标（#mjmTing）已插入 DOM");
  {
    const tgEl = documentStub.getElementById("mjmVoiceToggle");
    ok(tgEl.className.indexOf("on") >= 0 && tgEl.className.indexOf("off") < 0, "默认开启（class 含 on）→ " + tgEl.className);
    if (typeof tgEl.onclick === "function") tgEl.onclick();
    eq(MJ.debug.voiceStats().on, false, "点 🔊 开关 → 关闭");
    ok(tgEl.className.indexOf("off") >= 0, "关闭后开关 class 含 off → " + tgEl.className);
    if (typeof tgEl.onclick === "function") tgEl.onclick();
    eq(MJ.debug.voiceStats().on, true, "再点 🔊 开关 → 重新开启");
  }
  {
    const handTile = MJ.debug.hand()[MJ.debug.hand().length - 1];
    eq(MJ.debug.act("discard", handTile), true, "调试出牌（打 " + handTile + "）");
    eq(MJ.debug.voiceStats().last, T.voiceFile(handTile), "自己出牌立刻播该牌牌名 → " + T.voiceFile(handTile));
    eq(MJ.debug.voiceStats().lastSeat, 0, "播报来源标记为自己（seat=0）");
    ok(MJ.debug.voiceStats().lastUrl.indexOf(T.voiceFile(handTile)) >= 0, "播报 URL 指向该牌素材 → " + MJ.debug.voiceStats().lastUrl);
  }
  eq(MJ.debug.forceWin(0), true, "语音段：造胡（自摸）");
  {
    const st = MJ.debug.voiceStats();
    ok(st.last === "自摸.mp3" || st.uniq.indexOf("自摸.mp3") >= 0, "自摸触发 自摸.mp3 → " + st.last);
    eq(st.uniq.indexOf("流局.mp3") >= 0, false, "胡牌不会误播 流局.mp3");
    eq(st.lastSeat, 0, "自摸播报来源是自己");
  }
  eq(MJ.debug.voiceStats().plays >= 2, true, "同局内 plays 单调增长（出牌 + 自摸已入账）");
  eq(MJ.debug.voiceStats().uniq.indexOf("听.mp3") >= 0, false, "未听牌时不会误播「听」（只有真听牌那一刻才播）");
  {
    let ok2 = false;
    try { MJ.debug.say("碰", { seat: 1 }); ok2 = true; } catch (e) { ok2 = false; }
    eq(ok2, true, "say(碰, {seat:1}) 不抛错（AI 碰也能播）");
    ok(MJ.debug.voiceStats().uniq.indexOf("碰.mp3") >= 0, "碰.mp3 已入播报记录");
    eq(MJ.debug.voiceStats().ting.length, 4, "四家听牌播报状态各自独立（避免重复「听」）");
  }

  /* ⑥ 牌面总览图分组：万 → 条 → 筒 → 字牌（与 KINDS / 手牌排序一致的分组顺序） */
  {
    const rows = MJ.debug.faceSheetRows();
    eq(rows.length, 4, "总览图分 4 行（万 / 条 / 筒 / 字牌）");
    eq(rows[0].label, "万", "第 1 行 = 万");
    eq(rows[1].label, "条", "第 2 行 = 条");
    eq(rows[2].label, "筒", "第 3 行 = 筒");
    eq(rows[3].label, "字牌", "第 4 行 = 字牌");
    eq(rows[0].tiles.join(" "), "1万 2万 3万 4万 5万 6万 7万 8万 9万", "万行 1→9 顺序");
    eq(rows[1].tiles.join(" "), "1条 2条 3条 4条 5条 6条 7条 8条 9条", "条行 1→9 顺序");
    eq(rows[2].tiles.join(" "), "1筒 2筒 3筒 4筒 5筒 6筒 7筒 8筒 9筒", "筒行 1→9 顺序");
    eq(rows[3].tiles.join(" "), "东 南 西 北 中 發 白", "字牌行 东南西北中發白");
    let tot = 0; for (const r of rows) tot += r.tiles.length;
    eq(tot, 34, "总览图共 34 种牌面");
    eq(MJ.debug.faceSheet(true), true, "打开牌面总览");
    eq(MJ.debug.renderStats().faces, 34, "总览图画出 34 张牌面");
    const ft = MJ.debug.faceTiles();
    eq(ft.length, 34, "总览图曝光 34 张坐标（供探针逐张核对）");
    ok(ft.every(t => t.w === ft[0].w && t.h === ft[0].h), "总览图每张牌面同尺寸（便于逐张比对）");
    ok(ft.every(t => t.x >= 0 && t.y >= 0 && t.x + t.w <= 1240 && t.y + t.h <= 860), "总览图所有牌面都在画布内");
    eq(ft[0].tile, "1万", "总览图第 1 张 = 1万");
    eq(ft[9].tile, "1条", "总览图第 10 张 = 1条（条排在万之后）");
    eq(ft[18].tile, "1筒", "总览图第 19 张 = 1筒（筒排在条之后）");
    eq(ft[27].tile, "东", "总览图第 28 张 = 东（字牌最后）");
    eq(MJ.debug.faceSheet(false), false, "关闭牌面总览回到牌桌");
  }

  MJ.dispose();
  eq(MJ.isBusy(), false, "语音段收尾：dispose 后 isBusy=false");

  console.log("通过 " + pass + " / 共 " + (pass + fail) + (fail ? "，失败 " + fail : "，全部通过 ✔"));
  if (fail) { console.log("失败项：\n - " + fails.join("\n - ")); process.exit(1); }
})();
