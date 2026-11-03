import test from 'node:test';
import assert from 'node:assert/strict';

import { catalogModelUrl, hydrateProjectObjects } from '../src/domain/catalog.js';
import { normalizeProject } from '../src/domain/local-project-store.js';
import { isSafeModelAssetUrl } from '../src/domain/safe-model-url.js';
import { screenUntrustedProject, untrustedProjectError } from '../src/domain/untrusted-project.js';

function furniture(extra = {}) {
  return {
    id: 'desk',
    type: 'furniture',
    name: '桌子',
    shape: 'box',
    position: { x: 0, y: 0, z: 0.4 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1.2, y: 0.6, z: 0.75 },
    ...extra,
  };
}

function screen(project) {
  return screenUntrustedProject(normalizeProject(project));
}

test('a catalog path is a model URL and a remote or script URL is not', () => {
  assert.equal(isSafeModelAssetUrl('/models/office-desk.glb'), true);
  assert.equal(isSafeModelAssetUrl('models/office-desk.glb'), true);
  assert.equal(isSafeModelAssetUrl('./models/router.glb'), true);
  assert.equal(isSafeModelAssetUrl('/models/office-desk.glb?v=db8405b5'), true);
  assert.equal(isSafeModelAssetUrl('/models/x.glb?v=abcd1234'), true);
  for (const url of [
    'https://evil.example/steal.glb',
    'javascript:alert(1)',
    'data:text/html,hi',
    '//evil.example/models/x.glb',
    '/models/../secret.glb',
    '/models/x.glb?x=1',
    '/models/x.glb?v=abcd1234&x=1',
    '/models/x.glb?v=ABCD1234',
    '/models/x.glb?v=abcd123',
    '/models/%2e%2e/secret.glb',
    '/models/x.glb#frag',
    'https://evil.example/models/x.glb',
  ]) {
    assert.equal(isSafeModelAssetUrl(url), false, url);
  }
});

test('angle brackets in a name become fullwidth and a remote model address is dropped', () => {
  const project = screen({
    room: { length: 4, width: 3, height: 2.6 },
    objects: [furniture({
      name: '<img src=x onerror=alert(1)>',
      modelId: 'office-desk',
      assetUrl: 'https://evil.example/steal.glb',
      color: '#1e88e5',
    })],
    connections: [],
  });
  assert.equal(project.objects[0].name, '＜img src=x onerror=alert(1)＞');
  assert.equal(project.objects[0].assetUrl, null);
  assert.equal(project.objects[0].id, 'desk');
  const hydrated = hydrateProjectObjects(project.objects);
  assert.equal(hydrated[0].assetUrl, catalogModelUrl('office-desk'));
  assert.equal(hydrated[0].name.includes('<'), false);
});

test('a clean project is returned unchanged, including a blank device name', () => {
  const raw = {
    room: { length: 4, width: 3, height: 2.6 },
    objects: [furniture({ name: '' })],
    connections: [],
  };
  const normalized = normalizeProject(raw);
  assert.equal(screenUntrustedProject(normalized), normalized);
});

test('a desk with too many devices, or a huge room, is refused in Chinese', () => {
  const objects = Array.from({ length: 401 }, (_, index) => furniture({ id: `d${index}`, name: `桌子${index}` }));
  assert.throws(
    () => screen({ room: { length: 4, width: 3, height: 2.6 }, objects, connections: [] }),
    error => error.code === 'too_big' && error.message === '导入的内容太大',
  );
  assert.throws(
    () => screen({
      room: { length: 1001, width: 3, height: 2.6 },
      objects: [furniture()],
      connections: [],
    }),
    error => error.code === 'too_big',
  );
  assert.throws(
    () => screen({
      room: { length: 4, width: 3, height: 2.6 },
      objects: [furniture({ color: 'expression(alert(1))' })],
      connections: [],
    }),
    error => error.code === 'unsafe' && error.message === untrustedProjectError('unsafe').message,
  );
});
