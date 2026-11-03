import { createAuthHandlers } from '../../../server/ai/auth.js';

const auth = createAuthHandlers();

export const onRequestPost = context => auth.logout(context);
