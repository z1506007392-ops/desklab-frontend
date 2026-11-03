# DeskLab

DeskLab is a connected 3D room desktop layout and cabling tool.

## Local development

Run `npm ci`, then `npm run dev` from this repository. The frontend normally
uses port 5173.

The desk itself has no account. Each visitor's project is saved in their own
browser (`localStorage`, see `src/domain/local-project-store.js`), together
with the previous save as a backup, so the backend is not needed to load or
save. AI suggestions require an email login code. The dev server proxies
`/api` to port 3001, where `npm run dev:api` serves the AI and auth endpoints
locally (the same handlers Cloudflare runs from `functions/`):

- `AI_MOCK=1 npm run dev:api`: offline mock answers, no key needed.
- `DEEPSEEK_API_KEY=sk-... npm run dev:api`: real DeepSeek. Never commit the
  key; `.env` files are ignored by git but not read automatically.
- No key: the endpoint answers 503 and the app shows AI as not yet open.

In production the key is the Cloudflare Pages secret `DEEPSEEK_API_KEY`;
optional settings: `DEEPSEEK_MODEL`, `DEEPSEEK_BASE_URL`, `AI_ENABLED`,
`AI_TIMEOUT_MS`, `AI_PER_IP_HOURLY`, `AI_DAILY_PER_USER` (per email, default
20; there is no site-wide daily cap), and a KV binding `AI_LIMITS` for
sessions, login codes, and those counts. Login mail uses Mailjet when
both `MAILJET_API_KEY` and `MAILJET_API_SECRET` are set, and otherwise
Brevo when `BREVO_API_KEY` is set. Either way `MAIL_FROM` is required
(`MAIL_FROM_NAME` defaults to DeskLab). A half-set Mailjet pair does not
fall through to Brevo. Until a provider is fully configured,
`POST /api/auth/request-code` returns “登录暂未开放”. Do not commit these
keys. `AI_MOCK=1` treats a missing cookie as a local developer so the mock
still answers.

## Deployment

Cloudflare Pages builds `master` on every push (`npm run build`, output
`dist`, Node version from `.node-version`) and serves
https://desklab-frontend.pages.dev. GitHub Actions (`.github/workflows/ci.yml`)
runs the checks below on pushes and pull requests. After those checks pass
on `master`, the same workflow deploys with
`wrangler pages deploy dist --project-name desklab-frontend`. Git auto-deploy
stays on as well until it is turned off.

## 3D models

Catalog devices render from `public/models/<modelId>.glb`. The files are
generated headlessly with Blender 4.2 by the scripts in `tools/blender-models/`
(see that directory's README for axes and how to regenerate them). Each mesh is
built at the catalog `defaultScale`, centred on its bounding box, glTF +Y up,
with the front toward three.js +Z.

`src/domain/catalog.js` sets `assetUrl` to those files and prefixes Vite's
`base` (`import.meta.env.BASE_URL`). The scene preloads them. If a GLB is
missing or fails to load, the in-house generic shape is drawn, then a plain
box. Handoff notes for anchors, the wall-outlet yaw, and known visual gaps are
in `docs/memory_bank.md`.

The asset library cards show `public/thumbnails/<modelId>.webp`, rendered from
those GLBs by `node tools/thumbnails/render-thumbnails.mjs` (Playwright's
Chromium; set `CHROMIUM_PATH` to use another binary). Rerun it after changing
or adding a model; it also writes each picture's `.webp.json` provenance note.

## Verification

- `npm test`: domain behavior tests.
- `npm run lint` and `npm run build`: source and production-build checks.
- `npm run test:ui`: real headless Google Chrome interaction tests at desktop
  (1440 × 900) and mobile-sized (390 × 844) viewports. Google Chrome must be
  installed on the machine.

The UI suite starts and stops its own Vite process on `127.0.0.1:5174`; that
port must be free. Each test uses a fresh browser context whose storage is
seeded with the test's project, so it needs no backend; any `/api` request is
blocked and reported as a failure. Screenshots, video, and traces are
disabled; assertions check rendered controls, problem reports, undo/redo,
and runtime errors. Test output stays in ignored `test-results/`.

For one scenario, use `npm run test:ui -- --project=desktop --grep "no automatic"`.

Agents: start with `docs/AUTONOMOUS_ROADMAP.md` (plan, task board, LLM
design), then `docs/memory_bank.md` (history and decisions). Read the memory
bank before starting, and append a 进度记录 entry in the same change (see
协作规则 at the top of that file).

Current handoff documentation lives at `docs/memory_bank.md` in this
repository. External copies, when present, are:

```text
D:\desklab\memory-bank\DeskLab-Claude-memory.md
D:\desklab\memory-bank\DeskLab-model-assets-plan.md
D:\desklab\memory-bank\DeskLab-AI-handoff-template.md
```
