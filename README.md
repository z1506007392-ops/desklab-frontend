# DeskLab

DeskLab is a connected 3D room desktop layout and cabling tool.

## Local development

Run `npm ci`, then `npm run dev` from this repository. The frontend normally
uses port 5173.

There are no accounts. Each visitor's project is saved in their own browser
(`localStorage`, see `src/domain/local-project-store.js`), together with the
previous save as a backup, so the backend is not needed to load or save. The
dev server still proxies `/api` to port 3001 for future server features.

## Deployment

Cloudflare Pages builds `master` on every push (`npm run build`, output
`dist`, Node version from `.node-version`) and serves
https://desklab-frontend.pages.dev. GitHub Actions (`.github/workflows/ci.yml`)
runs the checks below on pushes and pull requests.

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
design), then `docs/memory_bank.md` (history and decisions).

Current handoff documentation lives at:

```text
D:\desklab\memory-bank\DeskLab-Claude-memory.md
D:\desklab\memory-bank\DeskLab-model-assets-plan.md
D:\desklab\memory-bank\DeskLab-AI-handoff-template.md
```
