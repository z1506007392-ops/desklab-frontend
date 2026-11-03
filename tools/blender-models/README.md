# DeskLab low-poly GLB generator (Blender 4.2.3 LTS, headless)

Generates `public/models/<modelId>.glb` for every item in `src/domain/catalog.js`.

## Conventions (must match `SceneObjects.jsx` / `coordinates.js`)
- Units: metres. Each GLB is built at exactly the catalog `defaultScale`
  (`GLBModel` scales by `obj.scale / defaultScale`).
- Origin = centre of the bounding box (same as the `FallbackBox` boxGeometry).
- While modelling in Blender: X = catalog x (width), Y = catalog y (depth), Z = catalog z (height);
  the device FRONT faces Blender -Y.
- Exported with glTF +Y up, so in three.js: X = width, Y = height, Z = depth, front faces +Z
  (same side as the screens / front panels in the Generic*Model components).
- `common.finalize_and_export()` applies modifiers, joins, fits the mesh EXACTLY to the catalog
  dims, centres it, and exports. Flat PBR colours only (no textures / UVs), < 5k tris each.

## Usage

> Since E58 (2026-11-02) `office-desk`, `desktop-pc`, `monitor-24`, `monitor-27`, `keyboard` and `mouse` come from NVIDIA SimReady via `tools/simready/` (see `public/models/CREDITS.md`). Running `office_desk.py`, `desktop_pc.py`, `monitor.py -- monitor-24|monitor-27`, `keyboard.py` into `public/models` would overwrite them. `monitor.py -- ultrawide-monitor` is still in use.
```sh
B=/path/to/blender   # 4.2.x; https://download.blender.org/release/Blender4.2/
OUT=public/models    # or any dir; scripts read $DESKLAB_OUT (default /workspace/desklab-models)
export DESKLAB_OUT=$OUT
$B -b --factory-startup --python tools/blender-models/office_desk.py
$B -b --factory-startup --python tools/blender-models/desktop_pc.py
$B -b --factory-startup --python tools/blender-models/laptop.py
$B -b --factory-startup --python tools/blender-models/monitor.py -- monitor-24
$B -b --factory-startup --python tools/blender-models/monitor.py -- monitor-27
$B -b --factory-startup --python tools/blender-models/monitor.py -- ultrawide-monitor   # gently curved
$B -b --factory-startup --python tools/blender-models/router.py
$B -b --factory-startup --python tools/blender-models/power_strip.py
$B -b --factory-startup --python tools/blender-models/wall_outlet.py
$B -b --factory-startup --python tools/blender-models/power_adapter.py
$B -b --factory-startup --python tools/blender-models/keyboard.py
$B -b --factory-startup --python tools/blender-models/mouse.py
$B -b --factory-startup --python tools/blender-models/desk_lamp.py
$B -b --factory-startup --python tools/blender-models/speakers.py
$B -b --factory-startup --python tools/blender-models/cable_tray.py
# previews (Cycles CPU by default; BLENDER_EEVEE_NEXT also works headless)
$B -b --factory-startup --python tools/blender-models/render_preview.py -- $OUT/router.glb preview_router.png
python3 tools/blender-models/contact_sheet.py office-desk desktop-pc ...   # needs Pillow, reads preview_<id>.png in $DESKLAB_OUT
# validation (needs `npm i gltf-validator` in GV_DIR): 0 errors + bbox == catalog dims
GV_DIR=/path/with/node_modules node tools/blender-models/validate.mjs $OUT/*.glb
```

## Notes
- office-desk and wall-outlet use realistic colours (oak top, white face plate) instead of the
  catalog UI swatch colours; all other bodies use the catalog `color`.
- Emissive accents (LEDs, PC fan ring) stay on while a device is idle. Selection,
  related, and hover highlights still replace emissive.
- The wall-outlet face plate is modelled on +Z. The renderer yaws that mesh 180°
  so the plate meets the room-facing port anchors (local −Y / three.js −Z).
