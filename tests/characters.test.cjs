const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
global.THREE = require('../vendor/three.min.js');
const source = path.join(__dirname, '../characters.js');
const ids = ['chenxu','suqi','guqinghe','linwan','zhouran','captain','keeper','technician','shopkeeper','archivist','photographer','studentA','studentB'];

function visibleMeshes(root) {
  const result = [];
  root.traverseVisible(o => { if (o.isMesh) result.push(o); });
  return result;
}

test('character factory loads independently from browser and game state', () => {
  assert.ok(fs.existsSync(source), 'Missing shared character factory');
  require(source);
  assert.equal(typeof Characters.create, 'function');
  assert.equal(Characters.portrait('chenxu'), '');
});

test('all thirteen profiles have distinct geometry, grounded feet and compatible walking pivots', () => {
  assert.ok(global.Characters, 'Character factory must be implemented');
  const signatures = new Set();
  for (const id of ids) {
    const actor = Characters.create(id);
    assert.equal(actor.profile.id, id);
    assert.ok(actor.profile.name && actor.profile.role, id + ' metadata');
    assert.ok(actor.group instanceof THREE.Group);
    assert.deepEqual(actor.group.position.toArray(), [0,0,0]);
    const bounds = new THREE.Box3().setFromObject(actor.group);
    assert.ok(Math.abs(bounds.min.y) < .015, id + ' feet must touch the floor');
    assert.ok(bounds.max.y >= 1.8 && bounds.max.y <= 2.25, id + ' character-scale height');
    assert.ok(bounds.max.x - bounds.min.x < 1.4, id + ' fits doorways');
    const meshes = visibleMeshes(actor.group);
    assert.ok(meshes.length >= 15 && meshes.length < 100, id + ' modeled detail without unbounded meshes');
    signatures.add(JSON.stringify(meshes.map(o => [o.geometry.type,o.geometry.parameters,o.position.toArray(),o.scale.toArray()])));
    for (const leg of [actor.left,actor.right]) {
      assert.ok(leg.position.y > .6 && leg.position.y < 1, id + ' hip pivot');
      const before = new THREE.Box3().setFromObject(leg);
      leg.rotation.x = .4;
      const after = new THREE.Box3().setFromObject(leg);
      assert.notEqual(before.max.z, after.max.z, id + ' leg animation changes pose');
      leg.rotation.x = 0;
    }
    for (const mesh of meshes) assert.ok([...mesh.geometry.attributes.position.array].every(Number.isFinite));
  }
  assert.equal(signatures.size, ids.length, 'Clothing colors alone cannot distinguish profiles');
  assert.equal(Characters.create('unknown-profile').profile.id, 'studentA');
});

test('equipment changes the visible character without growing geometry, moving it or altering height', () => {
  assert.ok(global.Characters);
  const actor = Characters.create('chenxu', {player:true});
  const base = new THREE.Box3().setFromObject(actor.group);
  const initialNodes = [];
  actor.group.traverse(o => initialNodes.push(o));
  const seen = new Set();
  for (const equipped of [{hand:'wrist'}, {hand:'solder'}, {outfit:'jacket'}, {outfit:'sneakers'}, {accessory:'pendant'}, {accessory:'chip'}]) {
    Characters.updateEquipment(actor, equipped);
    const item = Object.values(equipped)[0];
    assert.ok(visibleMeshes(actor.group).some(o => {
      for (let p=o; p && p!==actor.group; p=p.parent) if(p.userData.equipment === item) return true;
      return false;
    }), item + ' should be visible');
    const bounds = new THREE.Box3().setFromObject(actor.group);
    assert.equal(bounds.max.y, base.max.y);
    assert.deepEqual(actor.group.position.toArray(), [0,0,0]);
    seen.add(visibleMeshes(actor.group).map(o => o.uuid).join(','));
  }
  assert.equal(seen.size, 6);
  for(let i=0;i<30;i++) Characters.updateEquipment(actor, {hand:i%2?'wrist':'solder',outfit:'jacket',accessory:'chip'});
  const finalNodes = [];
  actor.group.traverse(o => finalNodes.push(o));
  assert.deepEqual(finalNodes, initialNodes, 'Gear switching reuses existing nodes and materials');
  Characters.updateEquipment(actor, {});
  assert.ok(!visibleMeshes(actor.group).some(o => {
    for(let p=o;p && p!==actor.group;p=p.parent) if(p.userData.equipment) return true;
    return false;
  }));
  const other = Characters.create('chenxu', {player:true});
  const a = new Set(initialNodes.filter(o=>o.isMesh).map(o=>o.material));
  other.group.traverse(o=>{if(o.isMesh) assert.ok(a.has(o.material),'Character materials are shared');});
});

test('portraits safely degrade without THREE or a WebGL context', () => {
  assert.ok(fs.existsSync(source));
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(source,'utf8'), context);
  assert.equal(context.Characters.portrait('chenxu',{hand:'wrist'}), '');
  assert.equal(context.Characters.create('chenxu'), null);
});

test('profile materials use linear color even before campus initializes color management', () => {
  const actor=Characters.create('chenxu');
  const shirt=actor.group.getObjectByName('torso').material.color;
  assert.ok(shirt.r > .07 && shirt.r < .1, 'sRGB clothing is converted once for consistent portrait colors');
});
