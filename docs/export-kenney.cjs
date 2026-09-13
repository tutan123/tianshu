#!/usr/bin/env node
'use strict';
/*
 * Convert Kenney CC0 GLB models into the offline bundle assets/kenney-meshes.js.
 *
 * Node replacement for docs/export-kenney.py. That script needs Blender; this one
 * does not, because every Kenney nature/furniture model stores a flat
 * pbrMetallicRoughness.baseColorFactor and carries no textures (images: 0), so a
 * direct glTF read reproduces exactly what Blender exported.
 *
 * Axis convention: Blender's glTF importer rotates Y-up to Z-up as (x, -z, y), and
 * export-kenney.py then writes (blender.x, blender.z, -blender.y). Those cancel, so
 * the output positions are the glTF positions unchanged. docs/export-kenney.cjs
 * --verify checks this against the already committed bundle before you trust it.
 *
 *   node docs/export-kenney.cjs            # rewrite assets/kenney-meshes.js
 *   node docs/export-kenney.cjs --verify   # compare a fresh conversion with the bundle
 */
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const SELECTION = {
  furniture: ['bedBunk', 'bookcaseOpen', 'desk', 'chairDesk', 'loungeSofa', 'pottedPlant', 'washer', 'computerScreen', 'kitchenCoffeeMachine', 'laptop', 'cardboardBoxClosed', 'tableRound', 'lampRoundFloor'],
  nature: [
    // Original selection.
    'tree_oak', 'tree_detailed_fall', 'plant_bushDetailed', 'grass_large', 'flower_redA', 'flower_yellowC', 'rock_largeA', 'canoe', 'fence_planks', 'lily_large',
    // Added so the campus tree grid is not two silhouettes repeated a hundred times.
    'tree_default', 'tree_detailed', 'tree_fat', 'tree_tall', 'tree_small', 'tree_thin', 'tree_oak_fall', 'tree_pineRoundA', 'tree_pineTallA', 'tree_blocks',
    'plant_bushLarge', 'grass_leafsLarge', 'flower_purpleA', 'rock_smallA', 'log_stack',
  ],
};

const COMPONENTS = { 5120: [Int8Array, 1], 5121: [Uint8Array, 1], 5122: [Int16Array, 2], 5123: [Uint16Array, 2], 5125: [Uint32Array, 4], 5126: [Float32Array, 4] };
const ITEM_SIZE = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

function readGlb(file) {
  const buf = fs.readFileSync(file);
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error(file + ': not a GLB');
  let offset = 12, json = null, bin = null;
  while (offset + 8 <= buf.length) {
    const length = buf.readUInt32LE(offset), type = buf.readUInt32LE(offset + 4);
    const chunk = buf.subarray(offset + 8, offset + 8 + length);
    if (type === 0x4e4f534a) json = JSON.parse(chunk.toString('utf8'));
    else if (type === 0x004e4942) bin = chunk;
    offset += 8 + length + ((4 - (length % 4)) % 4);
  }
  if (!json) throw new Error(file + ': no JSON chunk');
  return { json, bin };
}

function readAccessor(gltf, bin, index) {
  const accessor = gltf.accessors[index];
  const [Ctor, bytes] = COMPONENTS[accessor.componentType];
  const width = ITEM_SIZE[accessor.type];
  const view = gltf.bufferViews[accessor.bufferView];
  const base = (view.byteOffset || 0) + (accessor.byteOffset || 0);
  const stride = view.byteStride || width * bytes;
  const out = [];
  for (let i = 0; i < accessor.count; i++) {
    const at = base + i * stride;
    for (let c = 0; c < width; c++) out.push(new Ctor(bin.buffer, bin.byteOffset + at + c * bytes, 1)[0]);
  }
  return out;
}

// node.matrix if present, otherwise its TRS. Kenney models only use translation.
function nodeMatrix(node) {
  if (node.matrix) return node.matrix;
  const [tx, ty, tz] = node.translation || [0, 0, 0];
  const [qx, qy, qz, qw] = node.rotation || [0, 0, 0, 1];
  const [sx, sy, sz] = node.scale || [1, 1, 1];
  const x2 = qx + qx, y2 = qy + qy, z2 = qz + qz;
  const xx = qx * x2, xy = qx * y2, xz = qx * z2, yy = qy * y2, yz = qy * z2, zz = qz * z2, wx = qw * x2, wy = qw * y2, wz = qw * z2;
  return [
    (1 - (yy + zz)) * sx, (xy + wz) * sx, (xz - wy) * sx, 0,
    (xy - wz) * sy, (1 - (xx + zz)) * sy, (yz + wx) * sy, 0,
    (xz + wy) * sz, (yz - wx) * sz, (1 - (xx + yy)) * sz, 0,
    tx, ty, tz, 1,
  ];
}
const applyMatrix = (m, x, y, z) => [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
// Column-major a*b, matching applyMatrix's layout (translation in slots 12..14).
function multiply(a, b) {
  const out = new Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  }
  return out;
}
const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const r4 = v => Math.round(v * 1e4) / 1e4;
const r4c = v => Math.round(v * 1e4) / 1e4;

function convert(file) {
  const { json: gltf, bin } = readGlb(file);
  const parts = [];
  // Some furniture kits nest the mesh under a transformed parent, so walk the whole
  // scene graph accumulating world matrices instead of reading nodes flat.
  function walk(index, parent) {
    const node = gltf.nodes[index];
    if (!node) return;
    const world = multiply(parent, nodeMatrix(node));
    if (node.mesh !== undefined) {
      const mesh = gltf.meshes[node.mesh];
      // export-kenney.py resets its colour grouping for every imported object, so a
      // model whose parts share a colour keeps them as separate batches. Group per
      // mesh node, not globally, to reproduce that exactly.
      const groups = new Map();
      for (const primitive of mesh.primitives) {
        if (primitive.mode !== undefined && primitive.mode !== 4) continue; // triangles only
        const position = readAccessor(gltf, bin, primitive.attributes.POSITION);
        const indices = primitive.indices === undefined ? null : readAccessor(gltf, bin, primitive.indices);
        const material = primitive.material === undefined ? null : gltf.materials[primitive.material];
        const factor = material?.pbrMetallicRoughness?.baseColorFactor || [0.5, 0.5, 0.5, 1];
        const color = [r4c(factor[0]), r4c(factor[1]), r4c(factor[2])];
        const key = color.join(',');
        if (!groups.has(key)) groups.set(key, { color, positions: [] });
        const vertices = groups.get(key).positions;
        const count = indices ? indices.length : position.length / 3;
        for (let i = 0; i < count; i++) {
          const vi = indices ? indices[i] : i;
          const [x, y, z] = applyMatrix(world, position[vi * 3], position[vi * 3 + 1], position[vi * 3 + 2]);
          vertices.push(r4(x), r4(y), r4(z));
        }
      }
      for (const group of groups.values()) if (group.positions.length) parts.push(group);
    }
    for (const child of node.children || []) walk(child, world);
  }
  const scene = gltf.scenes?.[gltf.scene ?? 0];
  for (const index of scene?.nodes || []) walk(index, IDENTITY);
  return parts;
}

// Colour grouping happens per mesh node inside convert(); nothing to merge globally.
function build() {
  const result = {};
  for (const [pack, names] of Object.entries(SELECTION)) {
    for (const name of names) {
      const file = path.join(root, 'assets', 'kenney-' + pack, 'Models', 'GLTF format', name + '.glb');
      if (!fs.existsSync(file)) { console.warn('  missing: ' + name); continue; }
      result[name] = convert(file);
    }
  }
  return result;
}

const bundle = () => {
  const text = fs.readFileSync(path.join(root, 'assets', 'kenney-meshes.js'), 'utf8');
  const context = { globalThis: {} };
  require('node:vm').runInNewContext(text, context);
  return context.globalThis.KENNEY_MESHES;
};

if (process.argv.includes('--verify')) {
  const fresh = build(), committed = bundle();
  let bad = 0;
  for (const name of Object.keys(committed)) {
    if (!fresh[name]) { console.log('  only in bundle: ' + name); continue; }
    // Blender iterates an unordered object set, so compare the vertex multiset per
    // colour rather than the exact ordering.
    const key = parts => parts.map(p => p.color.join(',') + '|' + [...p.positions].sort((a, b) => a - b).join(',')).sort().join(';');
    const same = key(fresh[name]) === key(committed[name]);
    if (!same) { bad++; console.log('  MISMATCH: ' + name); }
  }
  console.log(bad ? `${bad} model(s) differ — the converter does not reproduce the bundle` : `all ${Object.keys(committed).length} committed models reproduced exactly`);
  process.exitCode = bad ? 1 : 0;
} else {
  const result = build();
  const out = path.join(root, 'assets', 'kenney-meshes.js');
  fs.writeFileSync(out, 'globalThis.KENNEY_MESHES=' + JSON.stringify(result, null, 0).replace(/\],"/g, '],\n"') + ';', 'utf8');
  console.log(`Converted ${Object.keys(result).length} CC0 models -> ${out} (${fs.statSync(out).size} bytes)`);
}
