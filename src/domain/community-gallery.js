import { buildTemplateScene } from './desk-templates.js';
import { createEntityId } from './identifiers.js';
import { normalizeProject } from './local-project-store.js';
import { screenUntrustedProject } from './untrusted-project.js';

// A desk gallery that lives on this device. A display name, the layout, and
// one optional photo stay in their own storage keys. Nothing here is uploaded,
// and nothing is synced to another device. Giving a desk to someone else is
// an exported file they import into their own gallery.
export const COMMUNITY_PROFILE_KEY = 'desklab.community-profile.v1';
export const COMMUNITY_POSTS_KEY = 'desklab.community-posts.v1';
export const COMMUNITY_POST_LIMIT = 12;
export const COMMUNITY_PHOTO_MAX_CHARS = 180_000;
export const COMMUNITY_FILE_KIND = 'desklab-community-desk';
export const COMMUNITY_FILE_VERSION = 1;
export const GALLERY_HASH_PREFIX = '#desklab-gallery/';

const DISPLAY_NAME_MAX = 24;
const TITLE_MAX = 40;
const PHOTO_PATTERN = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/;
const POST_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/;
const STORAGE_FULL_MESSAGE = '这台设备的存储空间不够，桌子没有放进图库。';
const INCOMPLETE_DESK = '这份桌子的内容不完整，不能放进图库。';

const BUILTIN_DESKS = Object.freeze([
  Object.freeze({ id: 'home-office', title: '极简单屏', summary: '27 英寸居中，键盘和鼠标在正前方。线在桌下。' }),
  Object.freeze({ id: 'desktop-dual', title: '电竞双屏', summary: '两台 27 英寸向内转，主机在左侧地上。' }),
  Object.freeze({ id: 'gaming', title: '超宽', summary: '带鱼屏、键盘、鼠标和主机。线在桌下。' }),
  Object.freeze({ id: 'managed-cables', title: '线收进桌下槽', summary: '和极简单屏同一张桌子，后沿下面这一只槽收走桌面上的线。' }),
]);

function sceneProject(templateId) {
  const scene = buildTemplateScene(templateId);
  return normalizeProject({
    room: scene.room,
    objects: scene.objects,
    connections: scene.connections,
    camera: scene.camera,
  });
}

function managedCablesProject() {
  const scene = buildTemplateScene('home-office');
  const trays = scene.objects.filter(object => object.modelId === 'cable-tray');
  if (trays.length !== 1) throw new Error('the minimal preset should already include one cable tray');
  return normalizeProject({
    room: scene.room,
    objects: scene.objects,
    connections: scene.connections,
    camera: scene.camera,
  });
}

// Built on first use. Importing this module must not build a scene: an old
// browser rejects structuredClone, and the startup check has to stay quiet.
let builtinProjects = null;

function projectsById() {
  if (!builtinProjects) {
    builtinProjects = new Map([
      ['home-office', sceneProject('home-office')],
      ['desktop-dual', sceneProject('desktop-dual')],
      ['gaming', sceneProject('gaming')],
      ['managed-cables', managedCablesProject()],
    ]);
  }
  return builtinProjects;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

// A label from a file is data, not markup. Non-strings are refused so
// String(object) cannot turn an illegal field into a title.
function plainLabel(value) {
  if (typeof value !== 'string') return null;
  let out = '';
  for (const char of value) {
    const code = char.charCodeAt(0);
    const hidden = code <= 31 || code === 127
      || (code >= 0x202A && code <= 0x202E)
      || (code >= 0x2066 && code <= 0x2069)
      || code === 0x200E || code === 0x200F || code === 0xFEFF;
    if (!hidden) out += char;
  }
  return out.replaceAll('<', '＜').replaceAll('>', '＞').trim().replace(/\s+/g, ' ');
}

export function normalizeDisplayName(value) {
  if (value != null && typeof value !== 'string') return { ok: false, message: INCOMPLETE_DESK };
  const name = plainLabel(value ?? '');
  if (!name) return { ok: false, message: '先写一个显示名。图库只在这台设备上使用它。' };
  if ([...name].length > DISPLAY_NAME_MAX) return { ok: false, message: `显示名最多 ${DISPLAY_NAME_MAX} 个字。` };
  return { ok: true, name };
}

export function normalizeDeskTitle(value) {
  if (value != null && typeof value !== 'string') return { ok: false, message: INCOMPLETE_DESK };
  const title = plainLabel(value ?? '');
  if (!title) return { ok: false, message: '给这张桌子起个名字。' };
  if ([...title].length > TITLE_MAX) return { ok: false, message: `名字最多 ${TITLE_MAX} 个字。` };
  return { ok: true, title };
}

function photoHeaderMatches(kind, binary) {
  const code = index => binary.charCodeAt(index);
  if (kind === 'jpeg') {
    return binary.length >= 3 && code(0) === 0xff && code(1) === 0xd8 && code(2) === 0xff;
  }
  if (kind === 'png') {
    return binary.length >= 8
      && code(0) === 0x89 && code(1) === 0x50 && code(2) === 0x4e && code(3) === 0x47
      && code(4) === 0x0d && code(5) === 0x0a && code(6) === 0x1a && code(7) === 0x0a;
  }
  return kind === 'webp' && binary.length >= 12 && binary.slice(0, 4) === 'RIFF' && binary.slice(8, 12) === 'WEBP';
}

function acceptPhoto(photo) {
  if (photo === undefined || photo === null || photo === '') return { ok: true, photo: null };
  if (typeof photo !== 'string') return { ok: false, message: '照片需要是这台设备上的一张图片。' };
  if (photo.length > COMMUNITY_PHOTO_MAX_CHARS) {
    return { ok: false, message: '这张照片太大，放不进这台设备的图库。请换一张小一些的。' };
  }
  const match = PHOTO_PATTERN.exec(photo);
  if (!match || match[2].length % 4 !== 0) {
    return { ok: false, message: '照片需要是这台设备上的一张图片。' };
  }
  let binary;
  try {
    binary = atob(match[2]);
  } catch {
    return { ok: false, message: '照片需要是这台设备上的一张图片。' };
  }
  if (!photoHeaderMatches(match[1], binary)) {
    return { ok: false, message: '照片需要是这台设备上的一张图片。' };
  }
  return { ok: true, photo };
}

function cleanProject(project) {
  let normalized;
  try {
    normalized = normalizeProject(project);
  } catch {
    return { ok: false, message: INCOMPLETE_DESK };
  }
  if (!Array.isArray(normalized.objects) || normalized.objects.length === 0) {
    return { ok: false, message: '当前房间里还没有设备，不能放进图库。' };
  }
  return screenDesk(normalized);
}

// A desk file is the same kind of untrusted input as a backup or a share
// link. Drop model addresses that are not on this site, and refuse a desk
// that is too large to open.
function screenDesk(project) {
  try {
    return { ok: true, project: screenUntrustedProject(project) };
  } catch (error) {
    return { ok: false, message: error instanceof Error && error.message ? error.message : INCOMPLETE_DESK };
  }
}

function readJson(storage, key) {
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function isThenable(value) {
  return value != null && typeof value.then === 'function';
}

// Browser storage throws at once when it is full. The desktop file archive
// updates memory immediately and resolves after the file is on disk, rolling
// memory back if that write fails. Callers that can await still get a plain
// result from a synchronous store.
function refusedWrite(error) {
  if (error?.code === 'archive_write_failed' && typeof error.message === 'string' && error.message) {
    return { ok: false, message: error.message };
  }
  return { ok: false, message: STORAGE_FULL_MESSAGE };
}

function writeJson(storage, key, value) {
  let result;
  try {
    result = storage.setItem(key, JSON.stringify(value));
  } catch (error) {
    return refusedWrite(error);
  }
  if (!isThenable(result)) return { ok: true };
  return result.then(
    () => ({ ok: true }),
    error => refusedWrite(error),
  );
}

function continueAfterWrite(written, buildOk) {
  if (isThenable(written)) return written.then(result => (result.ok ? buildOk() : result));
  if (!written.ok) return written;
  return buildOk();
}

export function listBuiltinDesks() {
  return BUILTIN_DESKS.map(desk => ({
    id: desk.id,
    builtin: true,
    title: desk.title,
    summary: desk.summary,
    authorName: 'DeskLab',
    photo: null,
    project: clone(projectsById().get(desk.id)),
  }));
}

export function readCommunityProfile(storage) {
  const parsed = readJson(storage, COMMUNITY_PROFILE_KEY);
  const name = normalizeDisplayName(parsed?.displayName);
  return { displayName: name.ok ? name.name : '' };
}

export function saveCommunityProfile(storage, displayName) {
  const name = normalizeDisplayName(displayName);
  if (!name.ok) return name;
  return continueAfterWrite(
    writeJson(storage, COMMUNITY_PROFILE_KEY, { displayName: name.name }),
    () => ({ ok: true, displayName: name.name }),
  );
}

function normalizeStoredPost(entry) {
  if (!entry || typeof entry !== 'object' || typeof entry.id !== 'string' || !POST_ID.test(entry.id)) return null;
  const title = normalizeDeskTitle(entry.title);
  const author = normalizeDisplayName(entry.authorName);
  const project = cleanProject(entry.project);
  if (!title.ok || !author.ok || !project.ok) return null;
  // A broken photo must not throw away the desk that is already on this device.
  const picture = acceptPhoto(entry.photo);
  return {
    id: entry.id,
    builtin: false,
    title: title.title,
    summary: '',
    authorName: author.name,
    photo: picture.ok ? picture.photo : null,
    project: project.project,
    createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : '',
  };
}

export function readCommunityPosts(storage) {
  const parsed = readJson(storage, COMMUNITY_POSTS_KEY);
  if (!Array.isArray(parsed)) return [];
  return parsed.map(normalizeStoredPost).filter(Boolean);
}

export function listGalleryDesks(storage) {
  return [...listBuiltinDesks(), ...readCommunityPosts(storage)];
}

export function publishCommunityDesk(storage, { title, authorName, project, photo, now = () => new Date(), id } = {}) {
  const named = normalizeDeskTitle(title);
  if (!named.ok) return named;
  const author = normalizeDisplayName(authorName);
  if (!author.ok) return author;
  const picture = acceptPhoto(photo);
  if (!picture.ok) return picture;
  const clean = cleanProject(project);
  if (!clean.ok) return clean;
  if (id != null && (typeof id !== 'string' || !POST_ID.test(id))) return { ok: false, message: INCOMPLETE_DESK };
  const posts = readCommunityPosts(storage);
  if (posts.length >= COMMUNITY_POST_LIMIT) {
    return { ok: false, message: `这台设备的图库最多留 ${COMMUNITY_POST_LIMIT} 张桌子。先删掉一张再放。` };
  }
  const post = {
    id: id || createEntityId('desk'),
    title: named.title,
    authorName: author.name,
    photo: picture.photo,
    project: clean.project,
    createdAt: now().toISOString(),
  };
  return continueAfterWrite(
    writeJson(storage, COMMUNITY_POSTS_KEY, [post, ...posts]),
    () => ({ ok: true, post: { ...post, builtin: false, summary: '' } }),
  );
}

export function removeCommunityPost(storage, id) {
  const posts = readCommunityPosts(storage);
  const next = posts.filter(post => post.id !== id);
  if (next.length === posts.length) return { ok: false, message: '图库里没有这张桌子。' };
  return continueAfterWrite(
    writeJson(storage, COMMUNITY_POSTS_KEY, next),
    () => ({ ok: true }),
  );
}

export function galleryHashId(hash) {
  if (typeof hash !== 'string' || !hash.startsWith(GALLERY_HASH_PREFIX)) return null;
  let id = hash.slice(GALLERY_HASH_PREFIX.length);
  try {
    id = decodeURIComponent(id);
  } catch {
    return '';
  }
  if (!id || id.length > 80) return '';
  return id;
}

// Only the desks shipped with the app open from the address. A desk saved on
// this device is not in the address, so another device cannot be asked to load it.
export function openGalleryFromHash(hash) {
  if (typeof hash !== 'string' || !hash.startsWith(GALLERY_HASH_PREFIX)) return { kind: 'absent' };
  const id = galleryHashId(hash);
  const desk = id ? listBuiltinDesks().find(item => item.id === id) : null;
  if (!desk) return { kind: 'unknown', message: '图库里没有这张桌子，已打开你自己的桌面。' };
  return { kind: 'ok', desk };
}

export function exportCommunityDesk(desk) {
  const title = normalizeDeskTitle(desk?.title);
  if (!title.ok) return title;
  const author = normalizeDisplayName(desk?.authorName);
  if (!author.ok) return author;
  const picture = acceptPhoto(desk?.photo);
  if (!picture.ok) return picture;
  const clean = cleanProject(desk?.project);
  if (!clean.ok) return clean;
  const file = {
    kind: COMMUNITY_FILE_KIND,
    version: COMMUNITY_FILE_VERSION,
    title: title.title,
    authorName: author.name,
    photo: picture.photo,
    project: clean.project,
  };
  return { ok: true, filename: 'desklab-desk.json', contents: `${JSON.stringify(file, null, 2)}\n` };
}

export function importCommunityDesk(raw) {
  let parsed = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { ok: false, message: '这不是一份桌子文件。' };
    }
  }
  if (!parsed || typeof parsed !== 'object' || parsed.kind !== COMMUNITY_FILE_KIND || parsed.version !== COMMUNITY_FILE_VERSION) {
    return { ok: false, message: '这不是 DeskLab 的桌子文件。' };
  }
  const title = normalizeDeskTitle(parsed.title);
  if (!title.ok) return title;
  const rawAuthor = typeof parsed.authorName === 'string' && parsed.authorName.trim() ? parsed.authorName : '未署名';
  const author = normalizeDisplayName(rawAuthor);
  if (!author.ok) return author;
  const picture = acceptPhoto(parsed.photo);
  if (!picture.ok) return picture;
  const clean = cleanProject(parsed.project);
  if (!clean.ok) return clean;
  const screened = screenDesk(clean.project);
  if (!screened.ok) return screened;
  return {
    ok: true,
    desk: {
      title: title.title,
      authorName: author.name,
      photo: picture.photo,
      project: screened.project,
    },
  };
}
