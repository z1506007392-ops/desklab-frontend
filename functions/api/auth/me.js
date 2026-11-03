import { createAuthHandlers } from '../../../server/ai/auth.js';

const auth = createAuthHandlers();

export const onRequestGet = context => auth.me(context);
