import { useCallback, useEffect, useRef, useState } from 'react';

import { requestLayoutSuggestions } from '../domain/ai-client.js';
import { buildSceneSummary } from '../domain/ai-scene-summary.js';

// State of one AI request. It lives in App (not in the dialog) so that the
// suggestions survive closing the dialog for a 3D preview.
export function useAiLayoutAssistant() {
  const [state, setState] = useState({ status: 'idle', suggestions: [], error: null, unavailable: false });
  const controllerRef = useRef(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const request = useCallback(async (project, goal) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState(previous => ({ ...previous, status: 'loading', error: null }));
    try {
      const { suggestions } = await requestLayoutSuggestions({
        summary: buildSceneSummary(project),
        goal,
        signal: controller.signal,
      });
      if (controllerRef.current === controller) {
        setState(previous => ({ ...previous, status: 'done', suggestions, error: null }));
      }
    } catch (error) {
      if (controllerRef.current !== controller) return;
      if (error.code === 'cancelled') {
        setState(previous => ({ ...previous, status: 'idle', error: null }));
        return;
      }
      setState(previous => ({
        ...previous,
        status: 'error',
        error: error.message,
        unavailable: previous.unavailable || error.code === 'ai_unavailable',
      }));
    }
  }, []);

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
  }, []);

  return { ...state, request, cancel };
}
