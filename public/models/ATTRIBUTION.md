# 3D Model Attributions

The files in this directory are the meshes the desk scene draws. The
code-native sections below are the React/Three.js fallbacks used when a GLB
is missing or fails to load. They are not the contents of the `.glb` files.

## In-house GLB meshes

- **Files**: `office-desk.glb`, `desktop-pc.glb`, `laptop-15.glb`,
  `monitor-24.glb`, `monitor-27.glb`, `ultrawide-monitor.glb`, `router.glb`,
  `power-strip.glb`, `wall-outlet.glb`, `power-adapter.glb`
- **Source**: Generated in-house by `tools/blender-models/` with Blender 4.2
  headless. Flat colours, no textures.
- **License**: DeskLab-owned
- **Added**: 2026-10-29
- **Notes**: Built at each catalog item's `defaultScale`, bounding-box centred,
  glTF +Y up, front toward three.js +Z. The desk top is oak and the outlet
  face plate is white; other bodies use the catalog colour. Generator notes
  are in `tools/blender-models/README.md`.

## Code-Native Generic Monitor
- **Model Name**: Generic low-poly monitor
- **Source**: In-house generated React/Three.js geometry in `src/components/SceneObjects.jsx`
- **License**: DeskLab-owned
- **Added**: 2026-06-26
- **Notes**: Generic unbranded monitor family. Fallback for `monitor-24`, `monitor-27`, and `ultrawide-monitor` when their GLB is unavailable.

## Code-Native Generic Power Strip
- **Model Name**: Generic low-poly power strip
- **Source**: In-house generated React/Three.js geometry in `src/components/SceneObjects.jsx`
- **License**: DeskLab-owned
- **Added**: 2026-06-26
- **Notes**: Generic unbranded power strip. Fallback for `power-strip` when its GLB is unavailable.

## Code-Native Generic Router
- **Model Name**: Generic low-poly router
- **Source**: In-house generated React/Three.js geometry in `src/components/SceneObjects.jsx`
- **License**: DeskLab-owned
- **Added**: 2026-06-26
- **Notes**: Generic unbranded router. Fallback for `router` when its GLB is unavailable.

## Code-Native Generic Desktop PC
- **Model Name**: Generic low-poly desktop PC tower
- **Source**: In-house generated React/Three.js geometry in `src/components/SceneObjects.jsx`
- **License**: DeskLab-owned
- **Added**: 2026-07-05
- **Notes**: Generic unbranded tower PC. Fallback for `desktop-pc` when its GLB is unavailable.

## Code-Native Generic Power Adapter
- **Model Name**: Generic low-poly power adapter
- **Source**: In-house generated React/Three.js geometry in `src/components/SceneObjects.jsx`
- **License**: DeskLab-owned
- **Added**: 2026-07-05
- **Notes**: Generic unbranded AC-to-DC power adapter. Fallback for `power-adapter` when its GLB is unavailable.

## Code-Native Generic Wall Outlet
- **Model Name**: Generic low-poly wall outlet
- **Source**: In-house generated React/Three.js geometry in `src/components/SceneObjects.jsx`
- **License**: DeskLab-owned
- **Added**: 2026-07-05
- **Notes**: Generic unbranded dual wall outlet. Fallback for `wall-outlet` when its GLB is unavailable. The renderer yaws this fallback 180° so the plate faces the room, matching the GLB.

## Code-Native Generic Laptop
- **Model Name**: Generic low-poly laptop
- **Source**: In-house generated React/Three.js geometry in `src/components/SceneObjects.jsx`
- **License**: DeskLab-owned
- **Added**: 2026-07-05
- **Notes**: Generic unbranded open laptop. Fallback for `laptop-15` when its GLB is unavailable.

## Code-Native Generic Office Desk
- **Model Name**: Generic low-poly office desk
- **Source**: In-house generated React/Three.js geometry in `src/components/SceneObjects.jsx`
- **License**: DeskLab-owned
- **Added**: 2026-07-05
- **Notes**: Generic unbranded four-leg desk with cable tray. Fallback for `office-desk` when its GLB is unavailable.

## Historical Sketchfab laptop (not shipped)

- **Model Name**: Low Poly Laptop
- **Author**: XX-Alias Neal (@meta-creators)
- **Source URL**: [https://sketchfab.com/3d-models/low-poly-laptop-a9c2e21a123542fdaf8edfdac4c22869](https://sketchfab.com/3d-models/low-poly-laptop-a9c2e21a123542fdaf8edfdac4c22869)
- **License**: CC0 (Public Domain / Free Standard)
- **Download Date**: 2026-06-09
- **Notes**: Recorded here from an earlier download. It is not `laptop-15.glb`.
  The shipped laptop is the in-house Blender mesh listed above.
