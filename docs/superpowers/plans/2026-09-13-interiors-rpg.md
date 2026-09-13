# Interior, Character and RPG Interface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Replace repeated interiors and characters with eight distinctive playable locations, contextual investigation tasks, and complete character/equipment/inventory/quest views.

**Architecture:** Keep the offline Three.js application and version 3 save schema. Define location-specific geometry and object positions, derive new mission progress from existing world flags, and use a shared character factory for NPCs, the player and a profile portrait. Extend existing RPG mechanics rather than creating a competing stat system.

**Tech Stack:** Existing Three.js r149, plain JavaScript/CSS, Node tests and Playwright Chrome acceptance.

**Spec:** User-approved scope in this conversation: eight different interiors, distinct characters, contextual tasks, separate character/equipment/backpack/quest interfaces, existing-save compatibility.

## Global Constraints

- Work in `G:/Projects/Agent/Agent Cli/天枢/天枢-WebDemo-v3.0` so the user's active file-based demo URL remains valid.
- Preserve all old story nodes, saves, equipment, collectibles and object IDs. Move objects deliberately into the new layouts.
- Original geometry and existing licensed assets only; no reference-game assets or third-party photographs.
- All eight interiors must have walkable entries, exits and paths to every interactive object.
- No fake inventory or mission counters. Reward claims must be once-only and survive save/restore.
- No extra frameworks, no build step or server dependency.
- Implementers own disjoint files and do not commit or touch the index. Root integrates and commits verified checkpoints.

### Task 1: Character Factory

**Files:** Create `characters.js`, `tests/characters.test.cjs`.
**Interfaces:** `Characters.create(id,{player})` returns `{group,left,right,profile}` compatible with the existing walking animation. `Characters.updateEquipment(actor,equipped)` updates visual gear. `Characters.portrait(id,equipped)` returns a cached image URL or empty string without browser/Three. Profiles include chenxu, suqi, guqinghe, linwan, zhouran, captain, keeper, technician, shopkeeper, archivist, photographer, studentA, studentB.
- [ ] Add failing tests for distinct structural signatures and stable dimensions.
- [ ] Model silhouettes, hairstyles, clothes and accessories; implement gear appearance and portrait caching.
- [ ] Run Node tests and review before integration into the campus and interiors.

### Task 2: RPG Interface

**Files:** Modify `growth-ui.js`, `rpg.js`; create `character-ui.css`, focused tests. Do not edit game.js/index.html.
**Interfaces:** Keep `GrowthUI.render(host,s,hooks)`, add optional initial view. Separate profile/gear/bag/tasks views, retain shop/finds access and existing action data attributes. Use optional `hooks.visit(zone)` for quest navigation. Consume `Exploration.quests(s)` entries `{id,title,zone,description,steps:[{text,done}],complete,reward,objectiveId}` and `Exploration.evidence(s)` items `{id,name,desc,icon}`. Use Characters.portrait when present.
- [ ] Add tests for real profile stats and inventory filtering.
- [ ] Implement distinct views, equipment comparison, bag categories/item details/use/equip, mission progress.
- [ ] Preserve buy/equip/use restrictions, save compatibility, browser action selectors.
- [ ] Verify desktop/mobile layout and data transitions during final integration.

### Task 3: Interiors and Task Scenes

**Files:** New `interiors.js`; modify exploration.js, world-art.js, campus3d.js, game.js, index.html; tests.
**Interfaces:** `Interiors.build(zone)` returns `{root,colliders,visuals,height}`; `Interiors.layout(zone)` returns bounds/spawn/room positions. All interiors remain within existing 36x28 floor bounds and four named functional areas, but walls, circulation, elevations and furniture differ. Exploration objects use explicit per-zone positions and character IDs. New missions use existing talked/switches/opened flags, validated from object data.
- [ ] Write failing tests for eight layout signatures and mission dependencies/reward dedup/save migration.
- [ ] Implement dorm corridor, lecture theater, circular archive, machine lab, boathouse, sports hall, repair workshop and broadcast/student center.
- [ ] Add contextual investigation tasks and journal/evidence APIs; remove obsolete shared-position dialogue.
- [ ] Integrate player/NPC factory and height-aware navigation, distinct interface entry points.

### Task 4: Acceptance and Delivery

- [ ] Run all Node tests and independent browser scenes for eight interiors, mission completion, old-save restore, gear/bag actions and mobile layouts.
- [ ] Verify rendered geometry and player motion, capture and inspect desktop/mobile screenshots, fix concrete defects.
- [ ] Request scope and code review, address important findings, update documentation and ledger.
- [ ] Commit verified work on the feature branch; integrate without discarding user changes.

## Execution Rulings

- Ruling: use a named feature branch in the existing directory rather than relocating the demo. The user is continuously viewing this exact file URL; changing workspaces would make acceptance and the visible app diverge. Main remains at the verified exterior checkpoint until integration.
- Ruling: mission progress derives from existing world flag arrays; new flags are additive and old saves need no new mandatory fields.
