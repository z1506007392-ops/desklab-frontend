---
name: blender-gltf-export
description: Export DeskLab catalog meshes from headless Blender 4.2 so the GLB matches catalog metres, three.js axes, cable anchors, and the gltf-validator check. Use when editing tools/blender-models, public/models GLBs, or glTF export settings.
---

# DeskLab glTF export

Catalog meshes come from `tools/blender-models/` and are drawn by `GLBModel` in `src/components/SceneObjects.jsx`. Follow that generator. Do not invent a second unit or axis system.

## How a model is built

Run Blender 4.2 headless, as the tool README does:

```sh
blender -b --factory-startup --python tools/blender-models/<model>.py
```

`-P` is the short form of `--python`. Each script writes `<modelId>.glb` under `$DESKLAB_OUT` (`common.py` holds the default directory).

`common.py` is the contract:

- 1 Blender unit is 1 metre. Leave the scene unit scale at 1. Catalog `defaultScale` is metres: `x` width, `y` depth, `z` height. Build the mesh at those sizes. `GLBModel` then scales by `obj.scale / defaultScale`, mapped onto three.js as `[ratio.x, ratio.z, ratio.y]`. A mesh built in centimetres, or exported with a unit scale other than 1, is the wrong size in the room.
- While modelling, Blender X is width, Y is depth, Z is height. The device front faces Blender −Y.
- `finalize_and_export` writes GLB with `export_yup=True` and `export_apply=True`. After that, three.js sees X = width, Y = height, Z = depth, and the front on +Z. That matches `toThreePosition` (`[x, z, y]`) and the generic models, whose screens sit on local +Z.
- The origin is the centre of the bounding box. `finalize_and_export` recentres the mesh and refits it to the catalog dims after modifiers are applied. The glTF node should not keep a translation, rotation, or scale.
- The wall outlet is the exception. `wall_outlet.py` points the face plate at three.js +Z (Blender −Y). The renderer yaws that mesh 180° (`WALL_OUTLET_MESH_YAW`) so the plate meets the anchors, which stay on local −Y (three.js −Z). Do not "fix" the yaw inside the exporter.

## Before you export

Apply modifiers, then location, rotation, and scale, before the file is written. `box` and `cyl` already bake their own transforms. `finalize_and_export` applies every remaining modifier, joins the meshes, applies the object transform, welds doubles, and recalculates face normals. `export_apply=True` bakes anything still live on the object. A leftover scale, or a bevel that is still a modifier, shows up as a node transform or the wrong triangle count, and the bbox check fails.

Keep `export_yup=True`. That flag is the axis switch. Do not pass FBX `axis_forward` / `axis_up` into the glTF exporter, and do not turn Y-up off to "match Blender".

## Materials, names, normals

Materials go through `common.mat`: one Principled BSDF, a flat base colour, roughness, metal, and optional emission. Emission is how LEDs stay lit while a device is idle. Do not add image textures or UVs. The export sets `export_texcoords=False`. If a look only exists as a procedural node graph, bake it down to Principled BSDF inputs before export. The file should contain that principled material, not a Blender node group.

`finalize_and_export` joins every mesh into one object named the catalog id (`desktop-pc`, `router`, and so on). `useGLTF` mounts that whole scene. It does not look up children by name. Keep the joined object name equal to the file id. If you later leave a connector as its own mesh so React Three Fiber can find it with `useGraph`, set the Blender object name once and do not rename it. The glTF node name is that object name.

These GLBs have no normal maps. Recalculated face normals are enough. A normal map needs a tangent-space image on the Principled BSDF Normal socket, real UVs, and texcoord export turned back on. A bump node or procedural noise will not survive as a normal map.

## Compression

Ship the GLB uncompressed. The files are flat colour and stay under about 5k triangles. `@react-three/drei`'s `useGLTF` can decode Draco and meshopt when a file contains them, but this pipeline never runs gltf-transform and never sets a compression export flag. `tools/blender-models/validate.mjs` reads the JSON chunk and the POSITION accessor min/max directly. Leave that path intact.

## Check

```sh
GV_DIR=/path/with/node_modules node tools/blender-models/validate.mjs "$DESKLAB_OUT"/*.glb
```

`gltf-validator` must report 0 errors. The printed three.js bbox must match catalog width on X, height on Y, and depth on Z, with the centre on the origin and no node translation, rotation, or scale.

Cable anchors live in `PORT_ANCHOR_BY_MODEL` in `src/domain/catalog.js`, keyed by catalog `port.id` (`ac-in`, `hdmi-out`, `lan-1`, `ac-out-1`, and so on). Values are normalized across the bbox: `x` width, `y` depth, `z` height. +y is the authored front (three.js +Z), except on the wall outlet. Put the connector on that face, then update the anchor if the jack moved. Hydrate replaces saved catalog anchors with this table.

## Sources

Exporter flags are documented by the Khronos glTF Blender add-on (Apache-2.0) and the Blender 4.2 manual. Read those when a flag is unclear. Do not paste them into this repo.

- https://github.com/KhronosGroup/glTF-Blender-IO
- https://docs.blender.org/manual/en/4.2/addons/import_export/scene_gltf2.html
