// Runs for every /api function. Desktop origins get CORS and a None cookie.
// The website does not.
import { guardApiRequest } from '../../server/ai/desktop-cors.js';

export function onRequest(context) {
  return guardApiRequest(context.request, () => context.next());
}
