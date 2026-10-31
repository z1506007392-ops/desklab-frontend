import { normalizeProject } from './local-project-store.js';
import { MAX_PROJECT_IMPORT_BYTES } from './project-import-limits.js';

// The hash is `#desklab-share-<version>.<payload>`. Version 1 is gzip, then
// base64url, of the same project JSON an imported backup has to pass.
export const SHARE_LINK_VERSION = 1;
export const SHARE_LINK_PREFIX = `#desklab-share-${SHARE_LINK_VERSION}.`;

// WeChat's in-app browser, and some chat apps, drop or refuse a link longer
// than about 2000 characters. Desktop browsers allow much more. Past this
// length the app still copies the link, and tells the person it may not open.
export const SHARE_LINK_WARN_LENGTH = 2000;

export const SHARE_LINK_MESSAGES = Object.freeze({
  damaged: '分享链接已损坏，打不开。已打开你自己的桌面。',
  unsupported: '这个分享链接的版本较新，当前页面打不开。已打开你自己的桌面。',
  tooBig: '分享链接里的数据太大，打不开。已打开你自己的桌面。',
});

const HASH_PATTERN = /^#desklab-share-(\d+)\.([A-Za-z0-9_-]*)$/;

export async function encodeShareLink(project, locationLike) {
  const clean = normalizeProject(project);
  const bytes = new TextEncoder().encode(JSON.stringify(clean));
  const compressed = await gzip(bytes);
  const hash = `${SHARE_LINK_PREFIX}${bytesToBase64Url(compressed)}`;
  const url = sharePageUrl(locationLike, hash);
  return { url, hash, tooLong: url.length > SHARE_LINK_WARN_LENGTH };
}

export async function decodeShareLink(hash, { maxBytes = MAX_PROJECT_IMPORT_BYTES } = {}) {
  if (typeof hash !== 'string' || hash.length === 0 || hash === '#') return { kind: 'absent' };
  if (!hash.startsWith('#desklab-share-')) return { kind: 'absent' };
  const match = HASH_PATTERN.exec(hash);
  if (!match || match[2].length === 0) return { kind: 'damaged' };
  if (Number(match[1]) !== SHARE_LINK_VERSION) return { kind: 'unsupported' };
  try {
    const compressed = base64UrlToBytes(match[2]);
    if (compressed.byteLength > maxBytes) return { kind: 'tooBig' };
    const jsonBytes = await gunzip(compressed, maxBytes);
    const project = normalizeProject(JSON.parse(new TextDecoder().decode(jsonBytes)));
    return { kind: 'ok', project };
  } catch (error) {
    if (error?.message === 'too big') return { kind: 'tooBig' };
    return { kind: 'damaged' };
  }
}

export function sharePageUrl(locationLike, hash) {
  const origin = locationLike?.origin || '';
  const pathname = locationLike?.pathname || '/';
  const search = locationLike?.search || '';
  return `${origin}${pathname}${search}${hash}`;
}

function bytesToBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function base64UrlToBytes(text) {
  const pad = (4 - (text.length % 4)) % 4;
  const binary = atob(text.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat(pad));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function gzip(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function gunzip(bytes, maxBytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  const reader = stream.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error('too big');
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}
