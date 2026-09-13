# Asset Sources

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
