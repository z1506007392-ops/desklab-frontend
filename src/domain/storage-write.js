// Browser storage finishes inside setItem. The desktop file archive returns
// a promise and only then is the file on disk. Callers that used to treat a
// thrown error as the only failure have to wait, or a rejected write becomes
// an unhandled error and the screen still says it saved.

export function followStorageWrite(pending, onOk = () => true, onError = () => false) {
  if (pending != null && typeof pending.then === 'function') {
    return pending.then(() => onOk(), () => onError());
  }
  return onOk();
}
