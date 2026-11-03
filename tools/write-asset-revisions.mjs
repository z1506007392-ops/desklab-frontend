import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { collectAssetRevisions, formatAssetRevisionsModule } from './static-delivery.mjs';

const publicDir = fileURLToPath(new URL('../public/', import.meta.url));
const target = fileURLToPath(new URL('../src/domain/asset-revisions.js', import.meta.url));
const revisions = collectAssetRevisions(publicDir);
writeFileSync(target, formatAssetRevisionsModule(revisions));
console.log(`wrote ${Object.keys(revisions).length} revisions`);
