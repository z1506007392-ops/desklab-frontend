import test from 'node:test';
import assert from 'node:assert/strict';

import {
  COMMUNITY_POST_LIMIT,
  COMMUNITY_POSTS_KEY,
  COMMUNITY_PROFILE_KEY,
  exportCommunityDesk,
  importCommunityDesk,
  listBuiltinDesks,
  openGalleryFromHash,
  publishCommunityDesk,
  readCommunityPosts,
  removeCommunityPost,
  saveCommunityProfile,
} from '../src/domain/community-gallery.js';
import { findHostDesk } from '../src/domain/cable-tray.js';
import { createFileArchiveStorage } from '../src/domain/file-archive.js';
import { PROJECT_STORAGE_KEY } from '../src/domain/local-project-store.js';

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem: key => (Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null),
    setItem: (key, value) => {
      data[key] = String(value);
    },
    dump: () => data,
  };
}

function deskProject() {
  return listBuiltinDesks().find(desk => desk.id === 'home-office').project;
}

const now = () => new Date('2026-11-04T00:00:00.000Z');

test('the app ships four example desks, including one with a cable tray', () => {
  const desks = listBuiltinDesks();
  assert.deepEqual(desks.map(desk => desk.id), ['home-office', 'desktop-dual', 'gaming', 'managed-cables']);
  assert.ok(desks.every(desk => desk.authorName === 'DeskLab' && desk.builtin && desk.project.objects.length > 0));
  const managed = desks.find(desk => desk.id === 'managed-cables');
  const tray = managed.project.objects.find(object => object.modelId === 'cable-tray');
  assert.ok(tray);
  assert.equal(findHostDesk(tray, managed.project.objects)?.modelId, 'office-desk');
  assert.equal(listBuiltinDesks().find(desk => desk.id === 'home-office').project.objects.some(object => object.modelId === 'cable-tray'), false);
});

test('a gallery address opens only a built-in desk', () => {
  assert.equal(openGalleryFromHash('').kind, 'absent');
  assert.equal(openGalleryFromHash('#desklab-share-2.abc').kind, 'absent');
  assert.equal(openGalleryFromHash('#desklab-gallery/gaming').desk.id, 'gaming');
  assert.equal(openGalleryFromHash('#desklab-gallery/managed-cables').desk.title, '线收进桌下槽');
  assert.equal(openGalleryFromHash('#desklab-gallery/missing').kind, 'unknown');
  assert.match(openGalleryFromHash('#desklab-gallery/missing').message, /你自己的桌面/);
  assert.equal(openGalleryFromHash('#desklab-gallery/desk-1234').kind, 'unknown');
});

test('publishing keeps the display name and does not touch the saved project', () => {
  const storage = memoryStorage({ [PROJECT_STORAGE_KEY]: '{"untouched":true}' });
  const saved = saveCommunityProfile(storage, '  小 明  ');
  assert.equal(saved.displayName, '小 明');
  const published = publishCommunityDesk(storage, {
    title: '  窗边  ',
    authorName: saved.displayName,
    project: deskProject(),
    now,
    id: 'local-1',
  });
  assert.equal(published.ok, true);
  assert.equal(published.post.authorName, '小 明');
  assert.equal(published.post.title, '窗边');
  saveCommunityProfile(storage, '改名');
  assert.equal(readCommunityPosts(storage)[0].authorName, '小 明');
  assert.equal(storage.dump()[PROJECT_STORAGE_KEY], '{"untouched":true}');
  assert.ok(storage.dump()[COMMUNITY_POSTS_KEY].includes('窗边'));
  assert.equal(JSON.parse(storage.dump()[COMMUNITY_PROFILE_KEY]).displayName, '改名');
});

test('an empty room, a long name, a bad photo, and a full gallery are refused in plain words', () => {
  const storage = memoryStorage();
  const project = deskProject();
  assert.match(publishCommunityDesk(storage, { title: '甲', authorName: '', project }).message, /显示名/);
  assert.match(publishCommunityDesk(storage, { title: '', authorName: '甲', project }).message, /名字/);
  assert.match(publishCommunityDesk(storage, { title: '甲'.repeat(41), authorName: '甲', project }).message, /40/);
  assert.match(publishCommunityDesk(storage, { title: '甲', authorName: '甲'.repeat(25), project }).message, /24/);
  assert.match(publishCommunityDesk(storage, {
    title: '甲', authorName: '甲', project: { ...project, objects: [], connections: [] },
  }).message, /还没有设备/);
  assert.match(publishCommunityDesk(storage, {
    title: '甲', authorName: '甲', project, photo: 'https://example.com/a.jpg',
  }).message, /照片/);
  const huge = `data:image/jpeg;base64,${'A'.repeat(180_000)}`;
  assert.match(publishCommunityDesk(storage, { title: '甲', authorName: '甲', project, photo: huge }).message, /太大/);
  for (let index = 0; index < COMMUNITY_POST_LIMIT; index += 1) {
    const result = publishCommunityDesk(storage, { title: `桌子${index}`, authorName: '甲', project, id: `id-${index}`, now });
    assert.equal(result.ok, true);
  }
  assert.match(publishCommunityDesk(storage, { title: '多一张', authorName: '甲', project }).message, /最多留 12/);
  assert.equal(readCommunityPosts(storage).length, 12);
});

test('a desk file round-trips, and a project backup is not a gallery file', () => {
  const storage = memoryStorage();
  const published = publishCommunityDesk(storage, {
    title: '给朋友',
    authorName: '小明',
    project: deskProject(),
    photo: 'data:image/jpeg;base64,QQ==',
    id: 'local-2',
    now,
  });
  const exported = exportCommunityDesk(published.post);
  assert.equal(exported.filename, 'desklab-desk.json');
  const imported = importCommunityDesk(exported.contents);
  assert.equal(imported.ok, true);
  assert.equal(imported.desk.title, '给朋友');
  assert.equal(imported.desk.authorName, '小明');
  assert.equal(imported.desk.photo, 'data:image/jpeg;base64,QQ==');
  assert.equal(imported.desk.project.objects.length, published.post.project.objects.length);
  const again = publishCommunityDesk(storage, { ...imported.desk, id: 'local-3', now });
  assert.equal(again.ok, true);
  assert.match(importCommunityDesk('{"room":{"length":4,"width":4,"height":3},"objects":[]}').message, /桌子文件/);
  assert.match(importCommunityDesk('not json').message, /桌子文件/);
  assert.equal(removeCommunityPost(storage, 'local-2').ok, true);
  assert.equal(removeCommunityPost(storage, 'local-2').ok, false);
  assert.equal(readCommunityPosts(storage).some(post => post.id === 'local-3'), true);
});

test('an imported desk file cannot point a device at another site', () => {
  const project = deskProject();
  project.objects[0] = { ...project.objects[0], assetUrl: 'https://evil.example/steal.glb', name: '桌<a>' };
  const imported = importCommunityDesk(JSON.stringify({
    kind: 'desklab-community-desk',
    version: 1,
    title: '外来',
    authorName: '甲',
    project,
  }));
  assert.equal(imported.ok, true);
  assert.equal(imported.desk.project.objects[0].assetUrl, null);
  assert.equal(imported.desk.project.objects[0].name.includes('<'), false);

  const huge = deskProject();
  huge.room = { ...huge.room, length: 5000 };
  const refused = importCommunityDesk(JSON.stringify({
    kind: 'desklab-community-desk',
    version: 1,
    title: '太大',
    authorName: '甲',
    project: huge,
  }));
  assert.equal(refused.ok, false);
  assert.match(refused.message, /太大/);
});

test('the desktop file archive keeps a gallery desk, and a failed write stays off disk', async () => {
  const files = new Map();
  const storage = createFileArchiveStorage({
    async write(name, text) {
      files.set(name, text);
    },
    async remove(name) {
      files.delete(name);
    },
  });
  const saved = await saveCommunityProfile(storage, '小林');
  assert.equal(saved.displayName, '小林');
  const published = await publishCommunityDesk(storage, {
    title: '我的一角',
    authorName: '小林',
    project: deskProject(),
    id: 'kept',
    now,
  });
  assert.equal(published.ok, true);
  assert.equal(JSON.parse(files.get('community-profile.json')).displayName, '小林');
  assert.equal(JSON.parse(files.get('community-posts.json'))[0].id, 'kept');
  assert.equal(files.has('project.json'), false);

  const failing = createFileArchiveStorage({
    async write() {
      throw new Error('disk full');
    },
    async remove() {},
  });
  const refused = await saveCommunityProfile(failing, '小王');
  assert.equal(refused.ok, false);
  assert.match(refused.message, /存储空间不够/);
  assert.equal(failing.getItem(COMMUNITY_PROFILE_KEY), null);
});
