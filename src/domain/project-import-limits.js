export const MAX_PROJECT_IMPORT_BYTES = 5 * 1024 * 1024;

export function getProjectImportByteLength(text) {
  return new TextEncoder().encode(text).byteLength;
}

export function assertProjectImportSize(byteLength) {
  if (byteLength > MAX_PROJECT_IMPORT_BYTES) {
    throw new Error('导入文件不能超过 5MB');
  }
}

// JSON.parse reports English parser details ("Unexpected token…"); a person
// importing the wrong file needs to hear that it is not a DeskLab backup.
export function describeProjectImportError(error) {
  if (error instanceof SyntaxError) return '这不是 DeskLab 的备份文件，或者文件已损坏';
  return error?.message || '文件内容无法识别';
}
