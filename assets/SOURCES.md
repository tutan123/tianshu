# Asset Sources

> Per-file status, sizes and the pre-publication checklist live in [ASSET-LEDGER.md](ASSET-LEDGER.md). This file records provenance and reasoning.

- Kenney Furniture Kit: https://kenney.nl/assets/furniture-kit
  CC0. Downloaded from the official site on 2026-09-12. Original files and license are retained in `kenney-furniture/`.
- Kenney Nature Kit: https://kenney.nl/assets/nature-kit
  CC0. Downloaded from the official site on 2026-09-12. Original files and license are retained in `kenney-nature/`.
- `kenney-meshes.js`: GLB models converted for offline file-based loading. Originally 23 models produced by Blender 5.2.1 (`docs/export-kenney.py`); now 38 models produced by `docs/export-kenney.cjs`, a Node converter that needs no Blender. `node docs/export-kenney.cjs --verify` proves it reproduces all 23 previously committed models exactly before you trust a re-export.
- The Kenney kits store their palette as sRGB bytes inside glTF's `baseColorFactor`, which the spec defines as linear. Reading them as linear washed every Kenney prop out (bark rendered as pale peach `#F2BE9E` instead of `#E28457`, foliage as pale mint `#70E6D6` instead of `#29C9AB`); the official `kenney-nature/Side/*.png` previews confirm the intended colours. `WorldArt.asset` now converts sRGB to linear on load.
- `clocktower-mesh.js`, `tianshu-clocktower.blend`, `clocktower-render.png`: original campus clocktower created for this prototype. Source: `docs/build-clocktower.py`.
- Existing stills and video clips were preserved from the earlier local prototype. They are reference/demo material, not cleared commercial-release assets. Replace or clear their rights before publication.

## Architecture Refresh (2026-09-13)

- `campus-buildings.js`: independently generated campus architecture and procedural brick/plaster/paving textures. No photographs, third-party campus models, university logos, or Reborn2 assets were imported for this refresh.
- `world-art.js` / `campusGrounds`: independently generated paving, curbs, benches, bicycle shelter, bicycles, planters, and unbranded vending-machine scenery.
- Japanese campus research references and per-source usage boundaries are documented in `docs/建筑美术参考与素材边界.md`. Reference photographs are not runtime assets and are not included in the repository.
- This record applies to the new architecture, not to uncleared stills/video inherited from the earlier prototype. It is not a blanket copyright clearance of the project.

## Runtime Libraries

- Three.js r149: MIT, https://github.com/mrdoob/three.js
- Matter.js 0.20.0: MIT, https://github.com/liabru/matter-js
- Lucide: ISC, https://lucide.dev/license

The minified vendor files retain their original license headers. Kenney asset use does not imply endorsement.

## Mahjong engine (2026-09-13)

- `mahjong.js` (154 KB, `ganma-1.0`) is **ported verbatim** from a colleague's prototype, 《重生2-原型 v1.6》. The port is byte-identical to the source file — `Get-FileHash` on both copies matches, and nothing was reformatted or trimmed.
- It is a self-contained IIFE exposing `window.Mahjong`. It injects its own stylesheet, draws its own canvas table, and needs only a host element plus an `opts.onFinish(result)` callback. It does not read any Reborn2 page variable, so it drops into this project unchanged.
- `tests/mahjong-logic.cjs` is that project's own 531-check logic suite (`_test_mahjong_logic.cjs`), also ported. The **only** edit is `ROOT`, so it resolves `mahjong.js` one directory up. `tests/mahjong.test.cjs` is a thin `node:test` wrapper that runs it, so `verify.cmd` picks it up automatically.
- `audio/mj/*.mp3` (45 files, 0.45 MB) are that project's mahjong voice clips: the filename is the trigger word. Missing files are non-fatal — the engine counts them as misses and the hand continues.
- Authorship: the Reborn2 prototype records its code as self-developed, and in turn records that what it borrowed from this project was ideas only, no code. This mahjong engine is therefore that author's work. **Confirm the arrangement with them before any public release**, and note that Reborn2's own `SOURCES.md` flags its live-action video and TTS audio as uncleared — none of that material is used here, only the mahjong code and its voice clips.
- Integration lives in this project's own files, not in the engine: `game.js` opens the overlay and settles the result, `offcampus.js` places the table in the arcade, and `exploration.css` styles the overlay.
