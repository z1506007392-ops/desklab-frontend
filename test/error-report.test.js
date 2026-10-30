import test from 'node:test';
import assert from 'node:assert/strict';

import { formatErrorReport, shouldReportError } from '../src/domain/error-report.js';

test('real errors are reported, handled noise is not', () => {
  assert.equal(shouldReportError(new TypeError("Cannot read properties of undefined (reading 'x')")), true);
  assert.equal(shouldReportError('Script error.'), true);
  assert.equal(shouldReportError(new Error('ResizeObserver loop completed with undelivered notifications.')), false);
  assert.equal(shouldReportError(new Error('Could not load /models/router.glb: fetch failed')), false);
  assert.equal(shouldReportError(new DOMException('aborted', 'AbortError')), false);
  assert.equal(shouldReportError(null), false);
  assert.equal(shouldReportError(''), false);
});

test('the copied report has what is needed to look into it and nothing else', () => {
  const error = new Error('boom');
  error.stack = 'Error: boom\n    at a (app.js:1:1)\n    at b (app.js:2:2)';
  const text = formatErrorReport(error, { url: 'https://desklab.test/', userAgent: 'TestBrowser/1', time: new Date('2026-10-30T08:00:00Z') });
  assert.equal(text, [
    'DeskLab 错误信息',
    '时间：2026-10-30T08:00:00.000Z',
    '页面：https://desklab.test/',
    '浏览器：TestBrowser/1',
    '错误：boom',
    '位置：\nError: boom\n    at a (app.js:1:1)\n    at b (app.js:2:2)',
  ].join('\n'));
  assert.match(formatErrorReport('plain text'), /错误：plain text/);
});
