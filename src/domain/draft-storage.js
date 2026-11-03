import { parseProjectDraft } from './draft.js';

export const PROJECT_DRAFT_STORAGE_KEY = 'desklab.project-draft.v1';

function settle(result, onOk, onError) {
  if (result && typeof result.then === 'function') return result.then(onOk, onError);
  return onOk();
}

export function createProjectDraftStorage(getStorage, key) {
  let safeToClear = true;

  return {
    read() {
      try {
        const rawDraft = getStorage().getItem(key);
        if (rawDraft === null || rawDraft === '') {
          safeToClear = true;
          return { ok: true, draft: null };
        }

        const draft = parseProjectDraft(rawDraft);
        if (!draft) {
          safeToClear = false;
          return {
            ok: false,
            operation: 'parse',
            error: new Error('本地草稿无法解析或版本不受支持'),
            draft: null,
          };
        }

        safeToClear = true;
        return { ok: true, draft };
      } catch (error) {
        safeToClear = false;
        return { ok: false, operation: 'read', error, draft: null };
      }
    },
    write(draft) {
      try {
        const pending = getStorage().setItem(key, JSON.stringify(draft));
        return settle(pending, () => {
          safeToClear = true;
          return { ok: true };
        }, error => {
          safeToClear = false;
          return { ok: false, operation: 'write', error };
        });
      } catch (error) {
        safeToClear = false;
        return { ok: false, operation: 'write', error };
      }
    },
    clear() {
      if (!safeToClear) {
        return {
          ok: false,
          operation: 'clear-blocked',
          error: new Error('本地草稿读取失败，已阻止清理以保留恢复材料'),
        };
      }

      try {
        const pending = getStorage().removeItem(key);
        return settle(pending, () => ({ ok: true }), error => ({ ok: false, operation: 'clear', error }));
      } catch (error) {
        return { ok: false, operation: 'clear', error };
      }
    },
  };
}
