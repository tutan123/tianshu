const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
global.THREE = require('../vendor/three.min.js');
const source = path.join(__dirname, '../campus-buildings.js');

test('original architecture builder is available independently of the game state', () => {
  assert.ok(fs.existsSync(source), 'Missing original campus building builder');
  require(source);
  assert.equal(typeof CampusBuildings.build, 'function');
});

test('eight building types have distinct detail sets, finite geometry and bounded draw batches', () => {
  assert.ok(global.CampusBuildings, 'Builder must be implemented');
  const signatures = new Set();
  for (const kind of ['dorm','hall','library','lab','lake','gym','gate','plaza']) {
    const result = CampusBuildings.build(kind, {x:0,z:0,w:14,d:8,h:6});
    assert.ok(result.root instanceof THREE.Group);
    assert.ok(result.root.userData.parts >= 40, kind + ' needs modeled details');
    assert.ok(result.root.children.length < 45, kind + ' must batch repeated geometry');
    signatures.add(result.root.userData.features.join(','));
    result.root.traverse(o => {
      if (!o.isInstancedMesh) return;
      assert.ok([...o.instanceMatrix.array].every(Number.isFinite));
      assert.ok([...o.geometry.attributes.position.array].every(Number.isFinite));
    });
    const {collider} = result;
    assert.equal(collider.w, 7.6);
    assert.equal(collider.d, 4.6);
    assert.ok(result.root.userData.features.includes('recessed-windows'), kind);
    assert.ok(result.windows.length > 0, kind + ' must participate in night lighting');
  }
  assert.equal(signatures.size, 8, 'Do not reuse one facade for all eight buildings');
});

test('annex dimensions retain their collision footprint and original materials are shared', () => {
  assert.ok(global.CampusBuildings, 'Builder must be implemented');
  const a=CampusBuildings.build('dorm',{x:-36,z:-16,w:6,d:12,h:5.5});
  const b=CampusBuildings.build('dorm',{x:-22,z:-15,w:13,d:7,h:6.2});
  assert.deepEqual(a.collider,{x:-36,z:-16,w:3.6,d:6.6});
  assert.deepEqual(a.root.position.toArray(),[-36,0,-16]);
  assert.strictEqual(a.windows[0],b.windows[0]);
  assert.throws(()=>CampusBuildings.build('unknown',{x:0,z:0,w:8,d:8,h:4}), /Unknown/);
});

test('campus ground dressing batches paving and blocks the bicycle shelter footprint', () => {
  require('../world-art.js');
  assert.equal(typeof WorldArt.campusGrounds, 'function', 'Missing contextual campus grounds');
  const root=new THREE.Group(),colliders=WorldArt.campusGrounds(root);
  assert.ok(root.children.some(o=>o.isInstancedMesh&&o.count>100), 'Paving and planting should be batched');
  assert.ok(colliders.some(o=>Math.abs(-31-o.x)<o.w&&Math.abs(-21-o.z)<o.d));
  assert.ok(!colliders.some(o=>Math.abs(-25-o.x)<o.w&&Math.abs(-23.2-o.z)<o.d), 'Annex entrance stays free');
});
