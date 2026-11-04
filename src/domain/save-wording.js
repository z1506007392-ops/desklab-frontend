// The same sentences on the web and in the desktop shell. The shell's files
// are not the browser's localStorage, so the words must not say they are.

export function keptSaveSentence(fileArchive) {
  return fileArchive
    ? '这台电脑上已经保存的项目不会被改掉，除非你之后自己点“保存项目”。'
    : '浏览器里已经保存的项目不会被改掉，除非你之后自己点“保存项目”。';
}

export function unreadOriginalSentence(fileArchive, label) {
  const place = fileArchive ? '这台电脑上的存档' : '浏览器';
  return `你原来的存档读不出来，${label}只留在当前页面，没有写入${place}。`;
}

export function viewingSharedSentence(fileArchive) {
  return fileArchive
    ? '只能转视角和查看，不能编辑。这台电脑上保存的项目没有被改动。'
    : '只能转视角和查看，不能编辑。你浏览器里保存的项目没有被改动。';
}

export function draftClearFailureSentence(fileArchive) {
  return fileArchive
    ? '本地草稿没有从这台电脑上清掉。请再保存一次，或导出备份。'
    : '本地草稿清理失败；请检查浏览器存储权限后重试。';
}

export function savedButDraftRemainsSentence(fileArchive) {
  return fileArchive
    ? '项目已保存，但本地草稿没有从这台电脑上清掉。请再保存一次，或导出备份。'
    : '项目已保存，但本地草稿清理失败；刷新前请检查浏览器存储权限。';
}
