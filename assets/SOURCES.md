# Asset Sources

- Kenney Furniture Kit: https://kenney.nl/assets/furniture-kit
  CC0. Downloaded from the official site on 2026-09-12. Original files and license are retained in `kenney-furniture/`.
- Kenney Nature Kit: https://kenney.nl/assets/nature-kit
  CC0. Downloaded from the official site on 2026-09-12. Original files and license are retained in `kenney-nature/`.
- `kenney-meshes.js`: 23 selected GLB models converted by Blender 5.2.1 for offline file-based loading. The reproducible converter is `docs/export-kenney.py`.
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
