# 素材许可台账 / Asset Licence Ledger

- 建立：2026-09-13（DeepSeek Agent）
- 用途：公开发行前逐项确认的清单。`assets/SOURCES.md` 记录**来源与推理**，本文件记录**逐文件状态**。
- 统计方式：`git ls-tree -r -l HEAD`，只统计随仓库发布的文件。

> **本文件不是法律意见，也不构成对整个项目的无侵权保证。** 它只如实登记当前仓库里每一个文件的状态与已知依据。

---

## 0. 一句话结论

| 分类 | 文件数 | 体积 | 可商用 |
| --- | ---: | ---: | --- |
| 运行时资产：本项目原创 | 3 | 1.71 MB | ✅ 是 |
| 运行时资产：Kenney CC0 派生 | 1 | 0.38 MB | ✅ 是 |
| 运行时资产：**授权未清** | 10 | 23.61 MB | ❌ **发行前必须替换或取得许可** |
| 运行库（MIT / ISC） | 3 | 1.00 MB | ✅ 是 |
| 参考素材（不参与运行） | 2350 | 6.70 MB | ✅ CC0，但占 97% 的文件数 |
| 代码与文档 | 57 | 0.46 MB | 本项目 |
| **全仓库** | **2425** | **33.9 MB** | |

**最关键的一条**：`assets/campus.webp` 是**平面地图降级方案的主图**（3D 不可用时玩家看到的就是它），但 `SOURCES.md` 里**没有任何关于它来源的记录**。公开发行前必须澄清。

---

## 1. 运行时资产 · 本项目原创

| 文件 | 用途 | 依据 |
| --- | --- | --- |
| `assets/clocktower-mesh.js` | 钟楼网格（离线载入） | 本项目原创，构建脚本 `docs/build-clocktower.py` |
| `assets/tianshu-clocktower.blend` | 钟楼 Blender 源文件 | 同上 |
| `assets/clocktower-render.png` | 钟楼参考渲染图 | 同上，不进运行时 |
| `assets/kenney-meshes.js` | 38 个离线网格（家具/自然） | 由 Kenney CC0 原始 GLB 转换，转换器 `docs/export-kenney.cjs` |

## 2. 运行时资产 · 授权未清（发行前必须处理）

`assets/SOURCES.md` 原文：*"Existing stills and video clips were preserved from the earlier local prototype. They are reference/demo material, not cleared commercial-release assets."*

| 文件 | 用途 | 状态 |
| --- | --- | --- |
| `assets/video/library.mp4` (12.2 MB, 107 s) | 图书馆场景影像 | ❌ 未清 |
| `assets/video/notebook.mp4` (6.1 MB, 91 s) | 笔记本/回忆场景影像 | ❌ 未清 |
| `assets/video/linwan.mp4` (2.6 MB, 47 s) | 林晚角色影像 | ❌ 未清 |
| `assets/video/rain.mp4` (1.05 MB, 5 s) | 雨景循环 | ❌ 未清（画面带「视频由AI生成」水印） |
| `assets/video/awake.mp4` (1.00 MB, 5 s) | 觉醒场景 | ❌ 未清（同上） |
| `assets/awake.jpg` / `library.jpg` / `linwan.jpg` / `rain.jpg` | 对应场景的静态底图 | ❌ 未清 |
| `assets/campus.webp` (0.52 MB, 1672×941) | **平面地图降级主图**（无 Three.js 时玩家看到的地图） | ❌ **来源未记录** |

**要做的决定**：这 10 个文件是替换成自产素材，还是取得许可。`rain` / `awake` 两个短片的画面与剧情强相关（天枢唤醒陈旭），替换成本最高。

## 3. 运行库

| 文件 | 版本 | 许可 | 依据 |
| --- | --- | --- | --- |
| `vendor/three.min.js` | r149 | MIT | 文件头保留 `@license Copyright 2010-2023 Three.js Authors` |
| `vendor/matter.min.js` | 0.20.0 | MIT | 文件头保留 `matter-js 0.20.0 by @liabru` |
| `vendor/lucide.min.js` | 0.468.0 | ISC | 文件头保留 `@license lucide v0.468.0 - ISC` |

三者均为 UMD 构建，随文件自带许可证声明，符合 MIT/ISC 的保留要求。

## 4. 参考素材 · 不参与运行（CC0，但占 97% 文件数）

| 目录 | 文件数 | 体积 | 说明 |
| --- | ---: | ---: | --- |
| `assets/kenney-nature/Isometric/` | 1876 | — | Kenney 官方等距预览图 |
| `assets/kenney-nature/Side/` | 462 | — | Kenney 官方侧视预览图（**可用于核对颜色，我核验色彩空间时用过**） |
| `assets/kenney-nature/Preview.png`、`Sample.png`、`Instructions.url`、`Kenney.url`、`Patreon.url` | 5 | — | 套件说明与快捷方式 |
| `assets/kenney-furniture/` 同上结构 | 706 | — | 同上 |
| **合计** | **2350** | **6.70 MB** | 全部 CC0 |

**许可状态没问题**：两个套件的 `License.txt` 均被跟踪，CC0 也不要求署名。

**但这是仓库里最大的结构性冗余**：2350 个文件、6.70 MB，占全部 2425 个跟踪文件的 **97%**，而游戏运行时一个都不加载（运行时只用 `assets/kenney-meshes.js`）。

**并且它们对可复现性没有帮助**：转换脚本读的是 `Models/GLTF format/*.glb`，而 `.gitignore` 已经把 `Models/` 排除在版本控制之外 —— 也就是说**一份全新 clone 本来就无法重跑转换**，预览图并不能补上这个缺口。

**建议（需用户决定，我没有擅自删除）**：

```powershell
# 保留 License.txt，移除预览图（可随时从本地 kenney-*.zip 恢复）
git rm -r --cached assets/kenney-nature/Isometric assets/kenney-nature/Side `
                 assets/kenney-furniture/Isometric assets/kenney-furniture/Side
git commit -m "Drop Kenney preview renders that the runtime never loads"
```

如果希望保留少量用于核对颜色，建议只留 `Side/`（462 个文件，侧视图对查色最有用），删掉 `Isometric/`（1876 个，占大头）。

**另一个缺口**：`Models/` 被 gitignore，意味着转换流程不可复现。要么把 `Models/` 的 GLB 纳入版本控制（约 7 MB 原始资产），要么在文档里写明"重新转换需先自行从 kenney.nl 下载"。`assets/SOURCES.md` 已经写了后者，这是可接受的取舍 —— 但值得明确记录。

## 5. 公开发行前的检查清单

- [ ] 替换或清算第 2 节的 10 个文件（含 `campus.webp` 的来源澄清）
- [ ] 决定第 4 节 2350 个预览图的去留
- [ ] 确认 `License.txt`（两个 Kenney 套件）仍在仓库中
- [ ] 确认 `vendor/` 三个库的文件头许可证声明未被构建流程剥离
- [ ] 剧情文本、人名、校名（"江城大学"、人物）为虚构设定，与真实机构/人物无对应关系 —— `docs/建筑美术参考与素材边界.md` 已声明

---

## 6. 复现本台账的统计

```powershell
git ls-tree -r -l HEAD -- assets | ForEach-Object { $p = $_ -split '\s+'; [pscustomobject]@{ size=[int]$p[3]; path=($p[4..($p.Count-1)] -join ' ') } } | Sort-Object size -Descending
```
