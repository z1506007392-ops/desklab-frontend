// node validate.mjs file.glb ...  (needs `npm i gltf-validator` resolvable; run with NODE_PATH or from a dir that has it)
import fs from 'fs'; import { createRequire } from 'module';
const require = createRequire(process.env.GV_DIR ? process.env.GV_DIR + '/' : import.meta.url);
const validator = require('gltf-validator');
const CAT = { 'monitor-24': [0.54,0.05,0.32], 'laptop-15': [0.36,0.28,0.22], 'desktop-pc': [0.25,0.5,0.5],
  'monitor-27': [0.62,0.06,0.37], 'ultrawide-monitor': [0.82,0.1,0.36],
  'office-desk': [1.4,0.7,0.75], 'router': [0.35,0.25,0.08], 'power-strip': [0.8,0.08,0.05], 'wall-outlet': [0.08,0.02,0.08], 'power-adapter': [0.1,0.05,0.03],
  keyboard: [0.44,0.15,0.032], mouse: [0.062,0.115,0.038] };
for (const f of process.argv.slice(2)) {
  const buf = new Uint8Array(fs.readFileSync(f));
  const r = await validator.validateBytes(buf);
  // parse JSON chunk for bbox
  const len = new DataView(buf.buffer).getUint32(12, true);
  const j = JSON.parse(Buffer.from(buf.slice(20, 20 + len)).toString());
  let mn=[1e9,1e9,1e9], mx=[-1e9,-1e9,-1e9];
  for (const m of j.meshes) for (const p of m.primitives) { const a=j.accessors[p.attributes.POSITION];
    for (let i=0;i<3;i++){ mn[i]=Math.min(mn[i],a.min[i]); mx[i]=Math.max(mx[i],a.max[i]); } }
  const node = j.nodes.find(n => n.mesh !== undefined);
  const id = f.split('/').pop().replace('.glb','');
  const size = mx.map((v,i)=>+(v-mn[i]).toFixed(4)), ctr = mx.map((v,i)=>+((v+mn[i])/2).toFixed(4));
  const c = CAT[id];
  console.log(`${id}: errors=${r.issues.numErrors} warnings=${r.issues.numWarnings} infos=${r.issues.numInfos} tris=${r.info.totalTriangleCount} mats=${r.info.materialCount} bytes=${buf.length}`);
  console.log(`  three.js bbox X(width)=${size[0]} Y(height)=${size[1]} Z(depth)=${size[2]}  centre=${ctr}  node transform=${JSON.stringify({t:node.translation,r:node.rotation,s:node.scale})}`);
  if (c) console.log(`  catalog x=${c[0]} y(depth)=${c[1]} z(height)=${c[2]}  -> match: ${Math.abs(size[0]-c[0])<1e-3 && Math.abs(size[1]-c[2])<1e-3 && Math.abs(size[2]-c[1])<1e-3}`);
  for (const m of r.issues.messages.slice(0,5)) console.log('   ', m.severity, m.code, m.message);
}
