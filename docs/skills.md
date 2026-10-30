# Vendored agent skills

Third-party skills for agents working in this repo. One copy lives at
`.claude/skills/<name>/SKILL.md`.

Claude Code loads project skills from that path. Cursor loads the same
directory: its docs
([Agent Skills](https://cursor.com/docs/skills)) list `.claude/skills/` as a
compatibility location next to `.cursor/skills/` and `.agents/skills/`. The
files are not copied again under `.cursor/skills/` or `.agents/skills/`, and
there are no symlinks. A second tree would duplicate a few megabytes, and
symlinks are unreliable on the Windows checkouts this repo uses. The
Impeccable Claude build also falls back to
`.claude/skills/impeccable/scripts/`, which matches this layout. Its primary
command is `<skill-base-dir>/scripts/impeccable`, so Cursor can run it from
the skill folder it discovered.

Agents that only read `.agents/skills/` (Codex and some others) will not see
these copies. Add a second tree only if that agent is actually in use.

`AGENTS.md` and `CLAUDE.md` are not on `master`. They are introduced by the
still-open docs PR
[#2](https://github.com/z1506007392-ops/desklab-frontend/pull/2)
(`docs/glb-models`). This change does not add them, so it does not collide
with that PR. After #2 merges, add one line there pointing at this file and
keep the two copies identical.

## Installed

Pins are the upstream commits copied on 2026-10-30. Skill text is unmodified.
Each folder includes that upstream's license (and Impeccable's `NOTICE.md`).

| Skill | For | Upstream | Pin |
| --- | --- | --- | --- |
| `impeccable` | UI taste, critique, and design audit. Includes `reference/` playbooks and the `scripts/` launcher. The engine binary is not in git; the launcher downloads it on first run. | https://github.com/pbakaus/impeccable | [`df3a4abe7d0840d5f60324812c432e00b66a4e75`](https://github.com/pbakaus/impeccable/commit/df3a4abe7d0840d5f60324812c432e00b66a4e75) (2026-10-30, skill version 4.8.0). Apache-2.0. |
| `frontend-design` | Distinctive visual design when building or reshaping UI. | https://github.com/anthropics/skills (`skills/frontend-design`) | [`ca45fc496a3436251f191354091d557da31c15b5`](https://github.com/anthropics/skills/commit/ca45fc496a3436251f191354091d557da31c15b5) (2026-10-28). Apache-2.0 (`LICENSE.txt` in the skill). The repo root has no GitHub license; this skill ships its own. |
| `threejs-fundamentals` | Scene, cameras, renderer, animation loop, transforms. three.js r186. | https://github.com/CloudAI-X/threejs-skills | [`0e181866f095b5f06d005133876e926515390d95`](https://github.com/CloudAI-X/threejs-skills/commit/0e181866f095b5f06d005133876e926515390d95) (2026-10-19). MIT. |
| `threejs-geometry` | Built-in shapes, BufferGeometry, instancing. | same | same |
| `threejs-materials` | Materials, PBR, node materials. | same | same |
| `threejs-lighting` | Lights, shadows, HDR. | same | same |
| `threejs-textures` | Textures, color spaces, render targets. | same | same |
| `threejs-animation` | Keyframes, mixer, skeletal and morph animation. | same | same |
| `threejs-loaders` | glTF (Draco, meshopt, KTX2) and other loaders. | same | same |
| `threejs-shaders` | ShaderMaterial and TSL. | same | same |
| `threejs-postprocessing` | EffectComposer and the WebGPU render pipeline. | same | same |
| `threejs-interaction` | Raycasting, controls, gizmos. | same | same |
| `threejs-performance` | Frame cost, draw calls, GPU memory. | same | same |
| `threejs-react-three-fiber` | React Three Fiber 9 and drei. | same | same |
| `threejs-asset-pipeline` | gltf-transform: Draco, meshopt, KTX2, WebP. | same | same |
| `emil-design-eng` | Emil Kowalski's UI polish and animation decisions. The repo's main skill. | https://github.com/emilkowalski/skills | [`a81dbca07f2217b7103e510c0f13f8d5b017afc9`](https://github.com/emilkowalski/skills/commit/a81dbca07f2217b7103e510c0f13f8d5b017afc9) (2026-10-28). MIT. |
| `animate` | Build a web animation (curve, duration, properties). Helper: `RECIPES.md`. | same | same |
| `animate-expo` | The same bar for React Native / Expo. Helper: `RECIPES.md`. | same | same |
| `review-animations` | Strict animation review. Helper: `STANDARDS.md`. | same | same |
| `improve-animations` | Audit motion and write fix plans. Helpers: `AUDIT.md`, `PLAN-TEMPLATE.md`. | same | same |
| `find-animation-opportunities` | Where motion would help, and where it would not. | same | same |
| `remove-animations` | Remove motion the UI does not need. | same | same |
| `animation-performance` | Animations that drop frames. | same | same |
| `animation-vocabulary` | Name a motion effect so the next prompt is precise. | same | same |

Paths are `.claude/skills/<skill>/`. Three.js and Emil skills are one folder
each, not nested, so Claude Code picks them up (it loads
`.claude/skills/<name>/SKILL.md`, not a category folder in between).

## Not installed

| Source | Pin checked | Why it is not in the repo |
| --- | --- | --- |
| [web-design-guidelines](https://github.com/vercel-labs/agent-skills/tree/1a2c79d4e6c4a2283dc2c614b6538cbe1ed5ca62/skills/web-design-guidelines) in [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) | [`1a2c79d4e6c4a2283dc2c614b6538cbe1ed5ca62`](https://github.com/vercel-labs/agent-skills/commit/1a2c79d4e6c4a2283dc2c614b6538cbe1ed5ca62) (2026-10-27) | No license file, and the GitHub license field is empty. That is all rights reserved. Do not copy it in. The skill itself only tells the agent to fetch https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md at review time. |
| [Blender-Developer-Tools](https://github.com/TMHSDigital/Blender-Developer-Tools) | [`1fcdfad50d1a1e7d9164787c9136214c0a508623`](https://github.com/TMHSDigital/Blender-Developer-Tools/commit/1fcdfad50d1a1e7d9164787c9136214c0a508623) (2026-10-27, version 0.158.0) | Skills, rules, examples, and docs are [CC-BY-NC-ND-4.0](https://creativecommons.org/licenses/by-nc-nd/4.0/). The author's README says that license restricts redistributing the pack (modified copies, or selling / commercially republishing it). `snippets/` and `templates/` are MIT; the bpy and glTF guidance we wanted is not in those directories. DeskLab is heading for a public launch with paid recommendations, so this repo does not republish the pack. Install it locally if you accept the license: Claude Code `/plugin marketplace add TMHSDigital/Blender-Developer-Tools@plugin-dist` then `/plugin install blender-developer-tools@blender-developer-tools`. Cursor: clone the `plugin-dist` branch into `~/.cursor/plugins/local/blender-developer-tools` and reload. glTF pitfalls live in the upstream skill `engine-export-presets` and the rules `use-correct-axis-rna-per-exporter`, `no-unapplied-modifiers-on-export`, and `validate-imported-mesh-scale`. |

From emilkowalski/skills, these are MIT but outside the animation/motion set,
so they were left upstream: `apple-design`, `ask-sonner`, `break-ui`,
`mobile-native`, `pick-ui-library`, `prototype`, `write-swift`. Same pin as
the table above if you want them later.

## How to update

1. Clone the upstream repo and check out the new commit. Read its license
   again. If the license disappeared or now forbids redistribution, do not
   copy the files; record the skip in the table above.
2. Replace `.claude/skills/<name>/` with `SKILL.md` plus the helper files
   that skill links to (`reference/`, `scripts/`, sibling markdown). Do not
   copy demos, engine binaries, or the rest of the repo. Keep the upstream
   `LICENSE` (and `NOTICE` if there is one) in the skill folder.
3. Do not edit the skill body. If you must, Apache-2.0 requires a prominent
   notice on the changed files. CC-BY-NC-ND material still cannot be
   redistributed in modified form.
4. Put the new commit SHA and date in the table above, and add a progress-log
   entry in `docs/memory_bank.md`.
5. `npm run lint` and `npm run build` should be unaffected. Skill scripts are
   ignored by ESLint (`.claude/**` in `eslint.config.js`).
