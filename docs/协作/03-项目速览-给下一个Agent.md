# 天枢 WebDemo · 项目速览（给下一个 Agent）

> **读这一份就够了。** 目标：让一个全新的 Agent 在 5 分钟内能安全地改这个项目。
> 建立：2026-09-13。适用范围：`天枢-WebDemo-v3.0` 及后续 v3.x。

---

## 0. 三条铁律（先看这个）

1. **必须能用 `file://` 双击打开运行。** 不引入构建步骤、不引入 ES Module、不引入打包器、不启动服务器。这是本 Demo 最重要的特性。
2. **必须保持完全离线自足。** 不允许出现任何 http(s) 请求。`README.md:5`、`assets/SOURCES.md` 都以此为卖点，验收脚本会检查这一点。
3. **改任何存档相关的数值前，先读 [`01-项目体检报告.md`](01-项目体检报告.md) 的 B-7。** 校验阈值和游戏配置是分开硬编码的，不同步改会让所有玩家的存档变成"无法读取"。

---

## 1. 这是什么

**天枢 · 重返江大**：一个重生题材的校园互动影游（Visual Novel + 探索 + 轻 RPG）的**首章纵向切片**。

- 主线 10 段 + 支线 4 段 + 3 个首章结局
- 3D 校园（Three.js 实时渲染），11 栋建筑、8 类建筑结构
- 8 处可进入的室内、共 32 个房间、67 个互动点
- 6 类小游戏（答题 / 时机 / 线路旋转 / 卡牌战斗 / 回收 / 记忆复现）
- 8 级成长、3 个装备槽、6 件装备、天枢模块成长

**不是**完整商业游戏。主角和 NPC 仍是低多边形占位角色，8 处室内共用同一套平面，部分剧情影像是授权未清的旧占位素材。

---

## 2. 怎么跑 / 怎么验

```powershell
# 玩（纯静态，不需要安装任何东西）
双击 天枢-WebDemo-v3.0\开始游戏.cmd
# 或直接用 Chrome/Edge 打开 index.html

# 单元测试（当前 23 项，全绿）
node --test tests/state.test.cjs tests/exploration.test.cjs tests/arcade.test.cjs tests/architecture.test.cjs

# 浏览器验收（需要 playwright —— 目前缺失，见体检报告 B-1）
node tests/run-browser.cjs tests/architecture.acceptance.js
node tests/run-browser.cjs tests/exploration.acceptance.js
node tests/run-browser.cjs tests/arcade.acceptance.js
node tests/run-browser.cjs tests/outdoor.acceptance.js
node tests/run-browser.cjs tests/browser.acceptance.mjs
```

**注意 1**：验收脚本会**覆写** `tests/*-results.json` 并把截图写进 `tests/screenshots/`（该目录已 gitignore）。跑之前想清楚，因为 `-results.json` 是纳入 git 的。

**注意 2**：`tests/browser.acceptance.mjs` **目前跑不起来**。它用 ES Module（`import` / `export default`），而 `run-browser.cjs:12` 是用 `vm.runInThisContext('(' + source + ')')` 包一层括号加载的，只支持 `async (page) => {}` 这种表达式形式。**新写验收脚本请一律用 `.js` + `async (browserPage) => {...}` 形式。**

`tests/*.acceptance.js` 的约定：文件导出一个 `async (page) => result` 函数，由 `run-browser.cjs` 用 `vm.runInThisContext` 加载并传入 Playwright Page。返回 `{ success, checks, errors }`，`run-browser.cjs` 会写入同名 `-results.json` 并在 `success: false` 时 `exitCode = 1`。

---

## 3. 文件地图

```
根目录（无构建，全部是可直接加载的普通脚本）
├── index.html              89 行。所有 <script defer> 的加载顺序在这里
├── styles.css              主界面样式（33 KB）
├── upgrade.css / exploration.css
├── content.js       ─── 剧情数据：places/people/modules/main/nodes/messages/quiz
├── state.js         ─── TS：状态、数值效果、存档校验与恢复
├── rpg.js           ─── RPG：等级、装备、道具、记忆物件、小游戏纪录
├── exploration.js   ─── Exploration：室内区域、互动对象、一次性奖励、探索存档校验
├── growth-ui.js     ─── 成长面板渲染
├── minigames.js     ─── MiniGames：答题 / 时机 / 线路 / 战斗
├── salvage.js       ─── Arcade：零件回收（Matter.js）+ 记忆复现
├── world-art.js     ─── WorldArt：室内搭建、室外陈设、Kenney 网格实例化、地面铺装
├── campus-buildings.js ─ CampusBuildings：8 类建筑的程序化几何与程序纹理
├── campus3d.js      ─── Campus3D：渲染、相机、移动、碰撞、寻路、室内外切换
├── game.js          ─── 主控：剧情演出、对话、所有面板、存档、模块接线
├── assets/          ─── 模型网格（js 形式）、贴图、视频、许可文档
├── vendor/          ─── three.min.js (r149) / matter.min.js / lucide.min.js
├── docs/            ─── 设计与素材边界文档、Blender 构建脚本
└── tests/           ─── 单测 + 浏览器验收脚本 + 结果 JSON
```

### 加载顺序（`index.html:12-27`，`defer` 按声明顺序执行）

```
lucide → content → state → rpg → exploration → growth-ui
→ matter → salvage → minigames
→ three → clocktower-mesh → kenney-meshes
→ world-art → campus-buildings → campus3d → game
```

`campus3d.js` 依赖 `THREE`、`CampusBuildings`、`WorldArt`、`Exploration`、`CONTENT`；`game.js` 依赖上面全部。
**插入新脚本必须放在依赖它的文件之前。**

---

## 4. 架构模式（重要）

**所有模块都是 IIFE，挂在 `globalThis` 上，没有模块系统。**

```js
'use strict';
globalThis.Campus3D = (() => {
  /* 私有变量 */
  return { init, update, setMode, /* 公开 API */ };
})();
```

**这不是偷懒，是被 `file://` 逼的。** ES Module 在 `file://` 下会被 CORS 拦截。所以：

- 不要改成 `import` / `export`
- 不要加 `package.json` 的 `"type": "module"`
- 需要跨模块调用就挂 `globalThis`

唯一的例外：`tests/*.test.cjs` 用 CommonJS，因为它们跑在 Node 里。

---

## 5. 数据流

```
content.js  (只读常量：剧情、地点、人物、模块、题目)
     ↓
state.js    TS.fresh() 造初始存档
            TS.effect(s, fx) 施加数值/羁绊/flag
            TS.complete(s, id, result) 结算剧情节点
            TS.restore(raw) 校验 + 恢复存档
     ↓
s.rpg       ← rpg.js    RPG.ensure(s)  惰性挂载（等级/装备/道具/纪录）
s.rpg.world ← exploration.js Exploration.ensure(s)  惰性挂载（宝箱/印章/开关/任务）
```

### 存档位置

| localStorage key | 用途 |
| --- | --- |
| `tianshu-v3-auto` | 自动存档（`game.js:7` 的 `key = 'tianshu-v3-'`） |
| `tianshu-v3-slot1` ~ `slot3` | 三个手动槽 |

### 存档校验链（改数据格式必看）

```
TS.restore(raw)                       state.js:69
  ├─ version === 3
  ├─ stats / bonds / modules 逐字段范围检查
  ├─ done 数组：唯一、节点存在、requires 闭包成立   ← 改剧情链会在这里炸
  ├─ messages / choices / results 与 CONTENT 对齐
  ├─ active 场景游标 + validEncounter(游戏内状态)
  └─ RPG.validate(s.rpg)              rpg.js:62
       └─ Exploration.validate(s.rpg.world)   exploration.js:47
```

任一步返回 `null` → 整份存档被拒绝 → `game.js:9` 回退到 `TS.fresh()`。
**表现是"存档无法读取"，而不是报错。** 所以改校验范围时要格外小心。

---

## 6. 关键 API 速查

### `TS`（state.js）

| 方法 | 说明 |
| --- | --- |
| `fresh()` | 全新存档 |
| `available(s)` | 当前可进入的节点 id 列表（未完成或可重玩，且 requires 满足） |
| `effect(s, fx)` | 施加数值 / `bonds` / `flags` / `module` |
| `spend(s, n)` | 原子扣算力，不足返回 false |
| `complete(s, id, result)` | 结算节点，发放 reward / fallback |
| `choose(s, id, i)` | 记录选择（校验 needFlag / cost） |
| `restore(raw)` | 校验 + 恢复，失败返回 `null` |

### `RPG`（rpg.js）

`level(s)` / `xp(s,n)` / `bonus(s)`（返回 `{attack, guard, hp, time, window, reel, value}`，装备与等级加成的**唯一汇聚点**）/ `buy` / `equip` / `use` / `discover(s, place)` / `reward(s, id, score, success)`

**加装备/道具只改 `rpg.js:3-12` 的 `items` 字典**，`bonus()` 会自动汇总。但记得同步 `state.js` 的校验上限 —— 见 B-7。

### `Exploration`（exploration.js）

`regions`（8 个室内区域定义）/ `objects(zone)`（**生成**该区域全部互动点）/ `outdoor`（室外互动点）/ `all()` / `ensure(s)` / `act(s, id)`

**扩展点**：想给某个室内加互动物，只需在 `objects(zone)` 里加一项。
`WorldArt.interactables()` 会自动为它生成视觉与标签，`Exploration.validate()` 会自动把它的 id 纳入允许列表。**不用改其他地方。**

### `Campus3D`（campus3d.js）

| 方法 | 说明 |
| --- | --- |
| `init(el, hooks)` | 挂载渲染器，`hooks` 含 `select/enter/near/object/interact/zone/mode/weather/error` |
| `setMode('walk'\|'overview', place)` | 局部步行 / 校园总览 |
| `enterInterior(id)` / `exitInterior()` | 室内外切换 |
| `setWeather('auto'\|'day'\|'night'\|'rain')` | 天气与昼夜 |
| `moveTo(x, z)` | A* 式网格寻路（8 邻域，16000 节点上限），返回是否找到路径 |
| `clearAt(x, z)` | 该点是否可通行（碰撞 + 湖面 + 边界） |
| `worldObjects()` | 当前场景所有可互动对象 |
| **`inspect()`** | ⭐ **官方自省接口，自动化测试的入口** |

**`inspect()` 返回**：`ready, active, mode, zone, weather, player[xyz], camera[xyz], target[xyz], radius, miniRect, rain, objects, architecture[], render, waterHeight, fog{near,far}, occluded[], near, object, route`

这是给自动化测试准备的。**任何自动化验证都应该优先用它，而不是去猜内部状态。**
我自己那套探针（`证据/probe.cjs`）就完全建立在这上面。

### `MiniGames` / `Arcade`

`MiniGames.start(kind, hostEl, state, hooks)` / `tick(dt)` / `key()` / `stop()`
`Arcade.create/valid/point/step/types/start/tick/action/stop`

`Arcade` 把纯逻辑（`create` / `step` / `point` / `valid`）和渲染分开了 —— **这是本项目里最好的设计**，所以 `arcade.test.cjs` 能在 Node 里不碰浏览器直接测回收物物理。新写小游戏请照这个模式。

---

## 7. 坐标系统（改地图前必看）

- **y 轴向上**，世界平面是 **x-z**。
- 校园可走范围：`x ∈ [-57, 42]`，`z ∈ [-36, 37]`（`campus3d.js:190`）
- 镜湖：椭圆，中心 `(-26, 16)`，半轴 `12.8 / 15.8`；只有桥面 `|z-17| < 0.95` 能过（`campus3d.js:192`）
- 室内可走范围：`|x| < 17.5` 且 `|z| < 13.5`（`campus3d.js:189`），室内出生点固定 `(0, 10.5)`
- 地面高度：`groundHeight(x,z)` — 室内 0.22；湖桥 0.73；其余由 `WorldArt.height()` 决定（林间台地最高 1.3）

| 概念 | 位置 | 含义 |
| --- | --- | --- |
| `coords` | `campus3d.js:3` | 总览视角下每个地点的取景中心 |
| `entries` | `campus3d.js:4` | 步行模式的出生点 / 门的位置 |
| `colliders` | 运行时数组 | `{x, z, w, d}`，`w/d` 是**半宽半深**（用 `<` 比较，不是 `<=`） |

**碰撞体语义容易搞错**：`clearAt` 用 `Math.abs(x - c.x) < c.w`，所以 `w` 是半宽。写碰撞体时别传全宽。

---

## 8. 不要动的东西（附原因）

| 不要做 | 原因 |
| --- | --- |
| 升级 `vendor/three.min.js`（现为 **r149**） | r150 起 Three.js 不再发布 UMD `three.min.js`，只有 ESM；而 ESM 在 `file://` 下被 CORS 拦截。升级 = 必须引构建或服务器 = 破坏双击即玩 |
| 把 IIFE 改成 ES Module | 同上 |
| 引入 React/Vue/打包器 | 当前 UI 在 390px 移动端无溢出、桌面 116 fps，重写收益远小于风险 |
| 修改 `campus3d.js:123` 的 `ColorManagement.legacyMode`、`outputEncoding`、`sRGBEncoding` | 这些是 **r149 的正确 API**，不是写错。改成新 API 反而会坏 |
| 引入 `package.json` 的 `"type": "module"` | 会让 `.js` 全部按 ESM 解析，直接全盘崩 |
| 改 `state.js` 的校验阈值而不改游戏配置（或反过来） | 见 B-7，会让所有玩家存档失效 |
| 在 `frame()` 里加新的 `querySelector` / 写 `style` | 已有 B-14 的性能问题，别再加 |
| 删除 `tests/*-results.json` | 那是历史验收记录，README 明确引用 |

---

## 9. 常见陷阱

1. **`pagehide` 会自动存档。** 用 Playwright 注入存档后如果直接 `reload()`，会被即将卸载的页面写回覆盖。要注入存档必须用 `addInitScript`。
   （我踩过这个坑，见 `证据/combat.cjs` 的注释。）

2. **`Exploration.validate` 的允许 id 列表是动态算出来的**（来自 `all()`）。所以给 `objects()` 加东西会自动扩展合法存档字段 —— 方便，但也意味着**删掉一个互动点会让含该 id 的老存档失效**。

3. **`requests` 必须为 0。** `architecture.acceptance.js:40` 会断言没有任何 http(s) 请求。任何外部字体、CDN、Google Fonts 都会让验收挂掉。

4. **`CONTENT.main` 的 requires 链是硬编码生成的**：`content.js:58`
   `main.forEach((id, i) => { nodes[id].requires = i ? [main[i-1]] : []; nodes[id].main = true; })`
   所以在 `main` 数组中间插一个节点会自动重连链。但 `state.js:79` 要求 `done` 满足 requires 闭包 —— **插节点会让老存档失效**（因为老存档的 done 里没有新节点，而新节点的后继 requires 它）。

5. **`architecture.test.cjs` 需要 `global.THREE`**：它在 Node 里 `require('../vendor/three.min.js')`（UMD 所以能跑）。写新的几何类单测照抄这个头部。

6. **`campus-buildings.js` 的 `collider.w/d` 是固定的 `7.6 / 4.6`**（见 `architecture.test.cjs:29-30`），跟传入的 `w/d` 无关。这是有意为之（视觉尺寸 ≠ 碰撞尺寸），改之前先确认。

7. **`frame()` 是常驻 `requestAnimationFrame` 循环**，`document.hidden` 时会提前 return。用无头浏览器截图时不要用 `--virtual-time-budget`，会因为 rAF 永不结束而挂死（我踩过）。

---

## 10. 相关文档

| 文档 | 内容 |
| --- | --- |
| `docs/探索版设计与迭代记录.md` | 最权威的设计文档：定位、节奏、地图结构、玩法、RPG、小游戏、架构、后续待办 5 项 |
| `docs/天枢-游戏策划与设计文档-v1.0.md` | 早期完整策划 |
| `docs/建筑美术参考与素材边界.md` | 本轮建筑精修的美术方向与素材边界（含 WIPO 版权说明） |
| `docs/design.md` / `docs/plan.md` | 早期短文档 |
| `assets/SOURCES.md` | 素材来源与许可台账 |
| `README.md` | 对外说明 + 验证入口 |
| `docs/build-clocktower.py` | 钟楼的 Blender 构建脚本 |
| `docs/export-kenney.py` | Kenney 素材转离线网格的脚本 |

---

## 11. 改完之后

1. 跑验证（见第 2 节）—— **跑不过就不算做完**。
2. 写交接单，模板在 [`02-任务池与验收标准.md`](02-任务池与验收标准.md) 第三节。
3. `git commit`，message 写清"改了什么 / 为什么"。
4. 如果改动影响架构或数据格式，**同步更新 `docs/探索版设计与迭代记录.md` 的「架构与存档」段**。
