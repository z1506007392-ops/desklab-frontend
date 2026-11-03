// Build-time delivery for models: content revisions, brotli for GLBs
// (Cloudflare does not compress model/gltf-binary), long cache headers, and
// an early low-priority preload of the open project's models. The 3D JS
// chunks are not modulepreloaded; that put them on the critical path.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { brotliCompressSync, brotliDecompressSync, constants } from 'node:zlib';
import { ASSET_REVISIONS } from '../src/domain/asset-revisions.js';
import { PROJECT_STORAGE_KEY } from '../src/domain/local-project-store.js';

const GLB_MAGIC = 0x46546c67;
const REVISION_EXT = /\.(glb|webp|woff)$/;

export function revisionOf(bytes) {
  return createHash('sha256').update(bytes).digest('hex').slice(0, 8);
}

export function collectAssetRevisions(publicDir) {
  const revisions = {};
  for (const dir of ['fonts', 'models', 'thumbnails']) {
    const folder = join(publicDir, dir);
    for (const name of readdirSync(folder).sort()) {
      if (!REVISION_EXT.test(name)) continue;
      const file = join(folder, name);
      if (!statSync(file).isFile()) continue;
      revisions[`${dir}/${name}`] = revisionOf(readFileSync(file));
    }
  }
  return revisions;
}

export function formatAssetRevisionsModule(revisions) {
  const lines = Object.keys(revisions).sort().map(key => `  '${key}': '${revisions[key]}',`);
  return `// Content revisions for cache-busted asset URLs: the first 8 hex
// characters of sha256(file). \`test/asset-revisions.test.js\` fails when a
// model, thumbnail, or the axis font changes and this file was not regenerated
// (\`node tools/write-asset-revisions.mjs\`).
export const ASSET_REVISIONS = Object.freeze({
${lines.join('\n')}
});
`;
}

export function earlyPreloadCspHash(storageKey = PROJECT_STORAGE_KEY, revisions = ASSET_REVISIONS) {
  return createHash('sha256').update(earlyModelPreloadScript(storageKey, revisions)).digest('base64');
}

export function headersFile() {
  const preloadHash = earlyPreloadCspHash();
  return `# E91 security headers for the static site. Cloudflare merges every matching
# block, and repeats of the same header name are joined with a comma.
# Cache-Control belongs in other path blocks (E71–E75). This file does not
# set it on /*, so a cache rule cannot be glued onto these values. On a conflict,
# keep both the security lines and the cache lines.
#
# CSP notes: meshopt GLBs compile WASM and decode in a blob worker, and that
# worker importScripts another blob (script-src, not only worker-src). The
# GLB loader then fetch()es each texture as a blob URL (connect-src). Troika
# lays out axis letters in a blob worker. React sets inline styles. AI and
# login stay on this origin (/api/ai, /api/auth). No remote script host.
# The first sha256 allows the small inline browser-check in index.html.
# The second sha256 allows the model preload injected at build time. It
# changes when a model revision changes (see asset-revisions.js).

/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), accelerometer=(), gyroscope=(), magnetometer=(), midi=(), display-capture=(), serial=(), hid=()
  Content-Security-Policy: default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' blob: 'wasm-unsafe-eval' 'sha256-aQVf4of+a/0G0dSzUbOWo/Fv4FGXWMQBXOrOWCGg7xs=' 'sha256-${preloadHash}'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self' data:; connect-src 'self' blob:; media-src 'self'; frame-src 'none'
  X-Frame-Options: DENY

# Long cache for files whose URL changes when the bytes change.
# /assets/* names are hashed by the build. Models, thumbnails, and the axis
# font keep their names and add ?v=<revision> (see asset-revisions.js).
# index.html stays on Pages' default max-age=0 so a new deploy is picked up.
# GLBs are brotli-compressed in dist/models by the production build. Cloudflare
# does not compress model/gltf-binary on its own.

/assets/*
  Cache-Control: public, max-age=31536000, immutable

/models/*
  Content-Type: model/gltf-binary
  Content-Encoding: br
  Vary: Accept-Encoding
  Cache-Control: public, max-age=31536000, immutable

/thumbnails/*
  Cache-Control: public, max-age=31536000, immutable

/fonts/*
  Cache-Control: public, max-age=31536000, immutable
`;
}

export function brotliEncode(bytes) {
  return brotliCompressSync(bytes, {
    params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
  });
}

export function brotliDecode(bytes) {
  return brotliDecompressSync(bytes);
}

export function isGlb(bytes) {
  return bytes.length >= 12 && bytes.readUInt32LE(0) === GLB_MAGIC;
}

// Replaces each uncompressed GLB with brotli. A second build that sees
// already-compressed bytes leaves them alone (vite cleans dist first).
export function compressGlbDirectory(dir) {
  const names = readdirSync(dir).filter(name => name.endsWith('.glb')).sort();
  let before = 0;
  let after = 0;
  const files = [];
  for (const name of names) {
    const file = join(dir, name);
    const raw = readFileSync(file);
    if (!isGlb(raw)) continue;
    const encoded = brotliEncode(raw);
    if (encoded.length >= raw.length) {
      throw new Error(`${name}: brotli did not shrink the file (${raw.length} -> ${encoded.length})`);
    }
    const decoded = brotliDecode(encoded);
    if (!isGlb(decoded) || !decoded.equals(raw)) {
      throw new Error(`${name}: brotli round-trip changed the GLB`);
    }
    writeFileSync(file, encoded);
    before += raw.length;
    after += encoded.length;
    files.push({ name, before: raw.length, after: encoded.length });
  }
  return { before, after, files };
}

export function modelRevisions(revisions) {
  const models = {};
  for (const [path, rev] of Object.entries(revisions)) {
    const match = path.match(/^models\/([^/]+)\.glb$/);
    if (match) models[match[1]] = rev;
  }
  return models;
}

// Classic script (not deferred) so a returning visitor starts the open
// project's model downloads while the page script is still downloading.
// fetchpriority stays low: a high-priority preload of these files (or of
// the 3D JS chunks) shares the slow-phone pipe with the stylesheet and
// pushes first paint from 1.5s to 3.3s in Lighthouse.
export function earlyModelPreloadScript(storageKey, revisions) {
  const models = modelRevisions(revisions);
  return `!function(){try{var REV=${JSON.stringify(models)};var raw=localStorage.getItem(${JSON.stringify(storageKey)});if(!raw)return;var project=JSON.parse(raw);var objects=project&&project.objects||[];var seen=Object.create(null);for(var i=0;i<objects.length;i++){var id=objects[i]&&objects[i].modelId;if(!id||seen[id]||!REV[id])continue;seen[id]=1;var link=document.createElement('link');link.rel='preload';link.as='fetch';link.crossOrigin='anonymous';link.fetchPriority='low';link.href='/models/'+id+'.glb?v='+REV[id];document.head.appendChild(link);}}catch(e){}}();`;
}

export function loadPerformancePlugin({ storageKey, revisions }) {
  return {
    name: 'desklab-load-performance',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const script = `<script>${earlyModelPreloadScript(storageKey, revisions)}</script>`;
        // After the stylesheet, so the parser has already queued CSS and the
        // entry script. Charset stays in the first 1024 bytes either way.
        const stylesheet = html.match(/<link rel="stylesheet"[^>]*>/);
        if (stylesheet) return html.replace(stylesheet[0], `${stylesheet[0]}\n    ${script}`);
        const charset = '<meta charset="UTF-8" />';
        if (html.includes(charset)) return html.replace(charset, `${charset}\n    ${script}`);
        return html.replace('</head>', `    ${script}\n  </head>`);
      },
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url || '').split('?')[0];
        if (path.startsWith('/assets/') || path.startsWith('/models/') || path.startsWith('/thumbnails/') || path.startsWith('/fonts/')) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
        if (path.endsWith('.glb')) {
          res.setHeader('Content-Type', 'model/gltf-binary');
          res.setHeader('Content-Encoding', 'br');
          res.setHeader('Vary', 'Accept-Encoding');
        }
        next();
      });
    },
    closeBundle() {
      const result = compressGlbDirectory(join(process.cwd(), 'dist/models'));
      console.log(`brotli GLB ${result.before} -> ${result.after} bytes (${result.files.length} files)`);
    },
  };
}
