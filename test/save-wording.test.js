import test from 'node:test';
import assert from 'node:assert/strict';

import { DESKTOP_LINK_FAILED } from '../src/desktop/archive-io.js';
import {
  draftClearFailureSentence,
  keptSaveSentence,
  savedButDraftRemainsSentence,
  unreadOriginalSentence,
  viewingSharedSentence,
} from '../src/domain/save-wording.js';

test('desktop sentences talk about this computer, and the web sentences stay the same', () => {
  const desktop = [
    keptSaveSentence(true),
    unreadOriginalSentence(true, '这张桌子'),
    viewingSharedSentence(true),
    draftClearFailureSentence(true),
    savedButDraftRemainsSentence(true),
  ].join('\n');
  const web = [
    keptSaveSentence(false),
    unreadOriginalSentence(false, '这份分享'),
    viewingSharedSentence(false),
    draftClearFailureSentence(false),
    savedButDraftRemainsSentence(false),
  ].join('\n');
  assert.match(desktop, /这台电脑/);
  assert.doesNotMatch(desktop, /浏览器/);
  assert.match(web, /浏览器/);
  assert.equal(savedButDraftRemainsSentence(false), '项目已保存，但本地草稿清理失败；刷新前请检查浏览器存储权限。');
  assert.match(unreadOriginalSentence(false, '这份分享'), /这份分享只留在当前页面/);
});

test('a system-browser failure is told in Chinese', () => {
  assert.match(DESKTOP_LINK_FAILED, /系统浏览器/);
  assert.match(DESKTOP_LINK_FAILED, /复制地址/);
  assert.doesNotMatch(DESKTOP_LINK_FAILED, /[A-Za-z]{4,}/);
});
