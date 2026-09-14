const test=require('node:test');
const assert=require('node:assert/strict');
global.THREE=require('../vendor/three.min.js');
require('../world-districts.js');
const root=new THREE.Group(), result=WorldDistricts.build(root);
const blocked=(x,z)=>result.colliders.some(c=>Math.abs(x-c.x)<c.w&&Math.abs(z-c.z)<c.d);
test('expanded area and seven distinct enterable facades preserve the campus',()=>{
  const b=WorldDistricts.bounds;
  assert.ok((b.maxX-b.minX)*(b.maxZ-b.minZ)/(99*73)>4);
  assert.equal(WorldDistricts.buildings.length,7);
  assert.equal(new Set(result.visuals.map(v=>v.root.userData.features.join())).size,7);
  for(const building of WorldDistricts.buildings){
    assert.deepEqual(building.entry,[building.x,building.z+building.d/2+1.5]);
    assert.equal(blocked(...building.entry),false,building.id+' entrance blocked');
  }
  for(const c of result.colliders){
    assert.ok([c.x,c.z,c.w,c.d].every(Number.isFinite));
    assert.ok(c.x+c.w<=-57||c.x-c.w>=42||c.z+c.d<=-36||c.z-c.d>=37,'old campus overlap');
  }
});
test('all geometry and instances are finite with a modest batched exterior',()=>{
  let draws=0,parts=0;
  root.traverse(o=>{
    if(!o.isMesh)return;
    draws++;
    assert.ok([...o.geometry.attributes.position.array].every(Number.isFinite));
    assert.ok(o.isInstancedMesh,'outdoor geometry must be instanced');
    assert.ok([...o.instanceMatrix.array].every(Number.isFinite));parts+=o.count;
  });
  assert.ok(draws<100,draws+' draw batches');assert.ok(parts>500);
});
test('streets, east connector and river crossings stay traversable',()=>{
  for(let z=38;z<74;z++)assert.equal(blocked(26,z),false,'south gate '+z);
  for(let x=42;x<=88;x++)assert.equal(blocked(x,9),false,'east path '+x);
  for(let x=-53;x<50;x++)assert.equal(blocked(x,73),false,'shopping street '+x);
  for(let x=87;x<=101;x++)assert.equal(blocked(x,-9),false,'river bridge '+x);
  assert.ok(blocked(68,29));assert.ok(blocked(69,61));assert.ok(blocked(97,40));
  // Flood the new outdoor area to catch disconnected door pockets.
  const seen=new Set(['26,38']),queue=[[26,38]],b=WorldDistricts.bounds;
  for(let i=0;i<queue.length;i++)for(const [dx,dz] of[[1,0],[-1,0],[0,1],[0,-1]]){
    const x=queue[i][0]+dx,z=queue[i][1]+dz,key=x+','+z;
    if(x<b.minX+1||x>b.maxX-1||z<b.minZ+1||z>b.maxZ-1||seen.has(key)||blocked(x,z))continue;
    seen.add(key);queue.push([x,z]);
  }
  for(const building of WorldDistricts.buildings)assert.ok(seen.has(building.entry[0]+','+Math.ceil(building.entry[1])),building.id+' disconnected');
});
