import test from 'node:test';
import assert from 'node:assert/strict';

import { describeArchiveBoot, storageBootNotice } from '../src/desktop/boot-storage.js';

test('a boot notice names the unreadable saves in Chinese', () => {
  assert.equal(storageBootNotice(), '');
  assert.equal(describeArchiveBoot(), '');
  const partial = describeArchiveBoot({
    unreadableFiles: ['layout-schemes.json', 'not-a-real-file.txt', 'project.json', 'layout-schemes.json'],
  });
  assert.match(partial, /摆法、项目/);
  assert.match(partial, /没有用空白盖掉/);
  assert.doesNotMatch(partial, /layout-schemes|project\.json|not-a-real|[A-Za-z]{4,}/);
  const failed = describeArchiveBoot({ failed: true, unreadableFiles: ['project.json'] });
  assert.match(failed, /没能打开这台电脑上的存档/);
  assert.match(failed, /导出备份/);
  assert.doesNotMatch(failed, /[A-Za-z]{4,}/);
});
