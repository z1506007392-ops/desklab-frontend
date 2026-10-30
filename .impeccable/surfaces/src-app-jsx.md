---
version: 1
slug: "src-app-jsx"
primary_target: "src/App.jsx"
related_targets: ["src/App.css","src/components"]
---

# DeskLab editor (the whole app screen)

Scope: the single editor screen (top bar, selection strip, asset library, properties panel, dialogs, banners). Visitor mode: Operate. Audience and job: see PRODUCT.md. Fixed by the owner: button and menu wording, the layout (top bar, library left, properties right, 3D centre), the 3D scene's look, the DeskLab name. Light UI (daytime use).

## Direction contract

THESIS: The editor reads like a desk-setup share post: the user's desk is the picture, and the selected device, the things to fix, and the next step are small white tags with a dot. It refuses the grey admin bar of outlined boxes and the CAD look.

OWN-WORLD: Ground #F2F3F5, panels white, ink #1B1B1F, second ink #5A5B63. Controls are borderless pills (#ECEEF1, full radius); the primary action is an ink pill; inputs are filled, 10px radius; list cards 14px radius, no borders. One accent, the tag dot #F2357A with a soft ring, only for selection, attention and the suggestions entry; green, amber and red only for check states. One system Chinese sans, weights 500/600/800. A soft two-layer shadow only on floating things: tags, menus, dialogs.

STORY: The visitor sees their desk first, knows what is selected from its tag, sees what needs fixing from tagged counts, and saves.

FIRST VIEWPORT: Top bar: DeskLab at 17px/800 left, room size, pill actions right ending in the ink 保存项目. Below, a ground strip holding the selection tag. White library left, white properties right, 3D centre unchanged. Phone: title, undo, redo and save on one row; other actions in one scrolling pill strip.

FORM: Desk-setup share-post tags, candidate 1 of 7 on my list (shown as the pick; the owner chose it). seed:abf5163954c476fc

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Open decisions

- Done: the title is "DeskLab" (the owner allowed dropping "MVP").
- Not built, needs the owner first (the 3D look is frozen): pin the selection tag next to the device inside the 3D view.
- Not built: device thumbnails on the library cards.
