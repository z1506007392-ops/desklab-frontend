import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertProjectImportSize,
  describeProjectImportError,
  getProjectImportByteLength,
  MAX_PROJECT_IMPORT_BYTES,
} from '../src/domain/project-import-limits.js';

test('measures clipboard project text as UTF-8 bytes', () => {
  assert.equal(getProjectImportByteLength('桌面'), 6);
});

test('accepts project imports at the byte limit and rejects larger ones', () => {
  assert.doesNotThrow(() => assertProjectImportSize(MAX_PROJECT_IMPORT_BYTES));
  assert.throws(
    () => assertProjectImportSize(MAX_PROJECT_IMPORT_BYTES + 1),
    /导入文件不能超过 5MB/
  );
});

test('a file that is not a DeskLab backup gets a plain explanation', () => {
  let parseError;
  try { JSON.parse('hello'); } catch (error) { parseError = error; }
  assert.equal(describeProjectImportError(parseError), '这不是 DeskLab 的备份文件，或者文件已损坏');
  assert.equal(describeProjectImportError(new Error('导入文件不能超过 5MB')), '导入文件不能超过 5MB');
  assert.equal(describeProjectImportError(null), '文件内容无法识别');
});
