import { useCallback, useEffect, useRef, useState } from 'react';

import { requestLayoutSuggestions } from '../domain/ai-client.js';
import { buildSceneSummary } from '../domain/ai-scene-summary.js';

// State of one AI request. It lives in App (not in the dialog) so that the
// suggestions survive closing the dialog for a 3D preview.
export function useAiLayoutAssistant() {
  const [state, setState] = useState({
    status: 'idle', suggestions: [], error: null, errorCode: null, remaining: null, unavailable: false,
  });
  const controllerRef = useRef(null);
  // The suggestions of the last answer, sent back with a follow-up.
  const lastSuggestionsRef = useRef([]);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const dismissError = useCallback(() => {
    setState(previous => ({ ...previous, status: 'idle', error: null, errorCode: null }));
  }, []);

  // feedback: what the user thinks of the last answer ("不要动主机"); empty
  // for a fresh request.
  const request = useCallback(async (project, goal, feedback = '') => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState(previous => ({ ...previous, status: 'loading', error: null, errorCode: null }));
    try {
      const { suggestions, remaining } = await requestLayoutSuggestions({
        summary: buildSceneSummary(project),
        goal,
        followUp: feedback ? { previousSuggestions: lastSuggestionsRef.current, feedback } : null,
        signal: controller.signal,
      });
      setState(previous => {
        if (controllerRef.current !== controller || controller.signal.aborted || previous.status !== 'loading') {
          return previous;
        }
        lastSuggestionsRef.current = suggestions;
        return {
          ...previous,
          status: 'done',
          suggestions,
          error: null,
          errorCode: null,
          remaining: typeof remaining === 'number' ? remaining : previous.remaining,
        };
      });
    } catch (error) {
      if (controllerRef.current !== controller) return;
      if (error.code === 'cancelled') {
        setState(previous => ({ ...previous, status: 'idle', error: null, errorCode: null }));
        return;
      }
      setState(previous => ({
        ...previous,
        status: 'error',
        error: error.message,
        errorCode: error.code || null,
        unavailable: previous.unavailable || error.code === 'ai_unavailable',
        remaining: typeof error.remaining === 'number' ? error.remaining : previous.remaining,
      }));
    }
  }, []);

  const cancel = useCallback(() => {
    const current = controllerRef.current;
    controllerRef.current = null;
    current?.abort();
    setState(previous => (
      previous.status === 'loading'
        ? { ...previous, status: 'idle', error: null, errorCode: null }
        : previous
    ));
  }, []);

  return { ...state, request, cancel, dismissError };
}
