// Builds six catalog models from NVIDIA SimReady assets (CC BY 4.0) and
// writes them to public/models/. The web-ready GLB copies of the SimReady
// assets come from the codepawl/simready-glb dataset; see README.md for the
// sources and the attribution the licence asks for.
//
//   cd tools/simready && npm install && npm run build
//
// Node's fetch only uses an HTTPS proxy with NODE_USE_ENV_PROXY=1 set.
//
// For each model: download (cached in .cache/), drop the parts we do not
// show, recolour, turn it so its front faces three.js +Z and fit it to the
// catalog size (the same contract as tools/blender-models: metres, width on
// X, height on Y, depth on Z, origin at the centre), cut it to a triangle
// budget, shrink textures to 256 px WebP and compress with meshopt.
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import process from 'node:process';
import { NodeIO, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, dequantize, meshopt, prune, simplify, textureCompress, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import { DEVICE_CATALOG } from '../../src/domain/catalog.js';

const SOURCE = 'https://huggingface.co/datasets/codepawl/simready-glb/resolve/main/glb/';
const CACHE = new URL('./.cache/', import.meta.url);
const OUT = new URL('../../public/models/', import.meta.url);
const TEXTURE_SIZE = 256;

// near-black, as a screen that is off; the same black as the desk legs.
const SCREEN_OFF = { base: [0.01, 0.01, 0.012], roughness: 0.15, metallic: 0 };
const LEG_BLACK = { base: [0.035, 0.037, 0.034], roughness: 0.35, metallic: 0.5 };

const MODELS = [
  // The desk is long along Z with its cable hole on -X. The hole belongs at
  // the back, away from the seat; a desk's seat is on its own -y side
  // (three.js -Z), so the hole goes to +Z: turn 90°.
  // Plain colours: its many small parts and UV seams stop normal simplifying.
  { id: 'office-desk', src: 'desk_a01', yawDeg: 90, triangles: 6000, flat: true,
    recolour: { m_opaque__metal__glossy_a01: LEG_BLACK } },
  { id: 'desktop-pc', src: 'computer_desktop_tower_a01', triangles: 6000 },
  { id: 'monitor-24', src: 'computer_monitor_office_a01', triangles: 3000,
    recolour: { opaque__plastic__unique_decal_screen_a: SCREEN_OFF } },
  { id: 'monitor-27', src: 'computer_monitor_office_a01', triangles: 3000,
    recolour: { opaque__plastic__unique_decal_screen_a: SCREEN_OFF } },
  { id: 'keyboard', src: 'computer_keyboard_a01', triangles: 3000 },
  // The mouse comes on a mouse pad; the catalog mouse is the mouse alone.
  { id: 'mouse', src: 'computer_mouse_office_b01', triangles: 2000, drop: /mousepad/i },
];

const catalogSize = modelId => {
  const model = DEVICE_CATALOG.flatMap(category => category.models).find(item => item.modelId === modelId);
  if (!model) throw new Error(`${modelId} is not in the catalog`);
  // Catalog x width, y depth, z height -> three.js x width, y height, z depth.
  return [model.defaultScale.x, model.defaultScale.z, model.defaultScale.y];
};

async function source(name) {
  const file = new URL(`${name}.glb`, CACHE);
  try {
    await stat(file);
  } catch {
    const response = await fetch(`${SOURCE}${name}.glb`);
    if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
    await mkdir(CACHE, { recursive: true });
    await writeFile(file, Buffer.from(await response.arrayBuffer()));
  }
  return readFile(file);
}

async function meanOf(texture) {
  const { channels } = await sharp(Buffer.from(texture.getImage())).stats();
  return channels.map(channel => channel.mean / 255);
}

const toLinear = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

function recolour(material, { base, roughness, metallic }) {
  material.setBaseColorFactor([...base, 1]).setBaseColorTexture(null)
    .setRoughnessFactor(roughness).setMetallicFactor(metallic)
    .setMetallicRoughnessTexture(null).setNormalTexture(null).setEmissiveTexture(null);
}

// Plain colours: each material takes the average of its textures, and UVs
// and normals go (three.js shades a mesh without normals flat).
async function flatten(doc) {
  for (const material of doc.getRoot().listMaterials()) {
    const base = material.getBaseColorTexture();
    if (base) {
      const [r, g, b] = await meanOf(base);
      const f = material.getBaseColorFactor();
      material.setBaseColorFactor([toLinear(r) * f[0], toLinear(g) * f[1], toLinear(b) * f[2], f[3]]).setBaseColorTexture(null);
    }
    const mr = material.getMetallicRoughnessTexture();
    if (mr) {
      const [, rough, metal] = await meanOf(mr);
      material.setRoughnessFactor(rough * material.getRoughnessFactor()).setMetallicFactor(metal * material.getMetallicFactor());
      material.setMetallicRoughnessTexture(null);
    }
    material.setNormalTexture(null).setOcclusionTexture(null).setEmissiveTexture(null);
  }
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      for (const semantic of prim.listSemantics()) if (semantic !== 'POSITION') prim.setAttribute(semantic, null);
    }
  }
}

// For a plain-colour model: weld by position, simplify with small detached
// parts pruned, fall back to sloppy simplification, keep the used vertices.
function simplifyFlat(doc, targetTriangles, error) {
  const prims = doc.getRoot().listMeshes().flatMap(mesh => mesh.listPrimitives());
  const count = prim => (prim.getIndices()?.getCount() ?? prim.getAttribute('POSITION').getCount()) / 3;
  const total = prims.reduce((sum, prim) => sum + count(prim), 0);
  for (const prim of prims) {
    const position = prim.getAttribute('POSITION');
    const positions = new Float32Array(position.getArray());
    const remap = MeshoptSimplifier.generatePositionRemap(positions, 3);
    const indices = (prim.getIndices()
      ? Uint32Array.from(prim.getIndices().getArray())
      : Uint32Array.from({ length: position.getCount() }, (_, i) => i)).map(i => remap[i]);
    const target = Math.max(3, Math.floor((count(prim) / total) * targetTriangles) * 3);
    let [kept] = MeshoptSimplifier.simplify(indices, positions, 3, target, error, ['Prune']);
    if (kept.length > target * 1.5) [kept] = MeshoptSimplifier.simplifySloppy(indices, positions, 3, null, target, error);
    const used = new Map();
    const order = [];
    const next = Uint32Array.from(kept, vertex => {
      if (!used.has(vertex)) { used.set(vertex, order.length); order.push(vertex); }
      return used.get(vertex);
    });
    const compact = new Float32Array(order.length * 3);
    order.forEach((vertex, i) => compact.set(positions.subarray(vertex * 3, vertex * 3 + 3), i * 3));
    position.setArray(compact);
    const indexAccessor = prim.getIndices() ?? doc.createAccessor().setType('SCALAR').setBuffer(position.getBuffer());
    prim.setIndices(indexAccessor.setArray(next));
  }
}

const triangles = doc => doc.getRoot().listMeshes().reduce((sum, mesh) => sum + mesh.listPrimitives()
  .reduce((n, prim) => n + (prim.getIndices()?.getCount() ?? prim.getAttribute('POSITION').getCount()) / 3, 0), 0);

await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

const only = new Set(process.argv.slice(2));
for (const model of MODELS) {
  if (only.size > 0 && !only.has(model.id)) continue;
  const doc = await io.readBinary(new Uint8Array(await source(model.src)));
  const root = doc.getRoot();
  const before = triangles(doc);
  if (model.drop) for (const node of root.listNodes()) if (model.drop.test(node.getName())) node.dispose();

  // Turn, then fit to the catalog size with the centre on the origin.
  const scene = root.getDefaultScene() ?? root.listScenes()[0];
  const half = ((model.yawDeg ?? 0) * Math.PI) / 360;
  const turn = doc.createNode('turn').setRotation([0, Math.sin(half), 0, Math.cos(half)]);
  for (const child of scene.listChildren()) { scene.removeChild(child); turn.addChild(child); }
  const fit = doc.createNode(model.id).addChild(turn);
  scene.addChild(fit);
  const { min, max } = getBounds(scene);
  const size = catalogSize(model.id);
  const scale = size.map((target, i) => target / (max[i] - min[i]));
  fit.setScale(scale).setTranslation(max.map((value, i) => -((value + min[i]) / 2) * scale[i]));

  await doc.transform(dequantize());
  if (model.flat) {
    await flatten(doc);
    simplifyFlat(doc, model.triangles, 0.01);
  }
  for (const material of root.listMaterials()) {
    const colour = model.recolour?.[material.getName()];
    if (colour) recolour(material, colour);
  }
  await doc.transform(
    ...(model.flat ? [] : [weld(), simplify({ simplifier: MeshoptSimplifier, ratio: Math.min(1, model.triangles / before), error: 0.02, lockBorder: false })]),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [TEXTURE_SIZE, TEXTURE_SIZE], quality: 80 }),
    dedup(),
    prune(),
  );
  // Simplifying can pull the outline in a little: fit to the catalog again.
  const cut = getBounds(scene);
  const refit = fit.getScale().map((value, i) => value * (size[i] / (cut.max[i] - cut.min[i])));
  fit.setScale(refit);
  const moved = getBounds(scene);
  fit.setTranslation(fit.getTranslation().map((value, i) => value - (moved.max[i] + moved.min[i]) / 2));
  await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'high' }));
  // Extensions left with nothing to do once textures were dropped.
  if (root.listTextures().length === 0) {
    for (const extension of root.listExtensionsUsed()) {
      if (['EXT_texture_webp', 'KHR_texture_transform'].includes(extension.extensionName)) extension.dispose();
    }
  }
  const file = new URL(`${model.id}.glb`, OUT);
  await io.write(file.pathname, doc);
  const out = getBounds(root.getDefaultScene() ?? root.listScenes()[0]);
  console.log(`${model.id.padEnd(12)} ${String(before).padStart(6)} -> ${String(triangles(doc)).padStart(5)} triangles, `
    + `${Math.round((await stat(file)).size / 1024)} KB, size ${out.max.map((v, i) => (v - out.min[i]).toFixed(3)).join(' x ')}`);
}
