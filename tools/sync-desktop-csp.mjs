// `tauri build` reads tauri.conf.json before beforeBuildCommand, so the
// packaged CSP has to be in the file already. The default matches
// PACKAGED_API_ORIGIN. Set VITE_DESKLAB_API_BASE to another https origin
// before `npm run desktop:build` to write that origin into connect-src.
import { readFileSync, writeFileSync } from 'node:fs';

import { cspForBuild } from '../src/domain/desktop-csp.js';

const path = new URL('../src-tauri/tauri.conf.json', import.meta.url);
const text = readFileSync(path, 'utf8');
const policy = cspForBuild(process.env.VITE_DESKLAB_API_BASE);
const pattern = /"csp"\s*:\s*(?:null|"(?:\\.|[^"\\])*")/;
if (!pattern.test(text)) {
  console.error('tauri.conf.json has no security.csp field');
  process.exit(1);
}
const next = text.replace(pattern, `"csp": ${JSON.stringify(policy)}`);
const parsed = JSON.parse(next);
if (parsed?.app?.security?.csp !== policy) {
  console.error('desktop CSP was not written into tauri.conf.json');
  process.exit(1);
}
if (next !== text) writeFileSync(path, next);
