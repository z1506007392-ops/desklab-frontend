# DeskLab

DeskLab is a connected 3D room desktop layout and cabling tool.

## Local development

Run `npm ci`, then `npm run dev` from this repository. The frontend normally
uses port 5173 and proxies `/api` to the local backend on port 3001.

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

## Verification

- `npm test`: domain behavior tests.
- `npm run lint` and `npm run build`: source and production-build checks.
- `npm run test:ui`: real headless Google Chrome interaction tests at desktop
  (1440 × 900) and mobile-sized (390 × 844) viewports. Google Chrome must be
  installed on the machine.

The UI suite starts and stops its own Vite process on `127.0.0.1:5174`; that
port must be free. It intercepts every `/api` request with isolated fixtures,
so it needs no backend and never reads or writes the real default project.
Each test uses a fresh browser context. Screenshots, video, and traces are
disabled; assertions check rendered controls, problem reports, undo/redo,
and runtime errors. Test output stays in ignored `test-results/`.

For one scenario, use `npm run test:ui -- --project=desktop --grep "no automatic"`.

Current handoff documentation lives at `docs/memory_bank.md` in this
repository. Read it before starting, and append a 进度记录 entry in the same
PR (see 协作规则 at the top of that file). External copies, when present, are:

```text
D:\desklab\memory-bank\DeskLab-Claude-memory.md
D:\desklab\memory-bank\DeskLab-model-assets-plan.md
D:\desklab\memory-bank\DeskLab-AI-handoff-template.md
```
