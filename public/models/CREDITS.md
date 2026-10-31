# 模型来源

桌面上大多数设备由 `tools/blender-models/` 里的脚本生成，归本仓库所有。键盘和音箱也是这批脚本模型。

下面这些换成了现成模型。接口、锚点、功耗、`type`、`modelId` 都没改。网格按目录里的米制包围盒摆放，原点在包围盒中心。台灯和鼠标的正面朝 three.js 的 +Z（场景里再转 180° 对着人）。书桌不旋转，开口的一侧朝 three.js 的 -Z，也就是人坐的那边。

许可证都是 CC0 1.0（不必署名，可以商用）。

| 设备 | modelId | 文件 | 作者 | 许可证 | 来源 |
| --- | --- | --- | --- | --- | --- |
| 鼠标 | `mouse` | Kenney Furniture Kit 的 `computerMouse.glb` | Kenney | CC0 1.0 | https://kenney.nl/assets/furniture-kit |
| 台灯 | `desk-lamp` | Kenney Furniture Kit 的 `lampRoundTable.glb` | Kenney | CC0 1.0 | https://kenney.nl/assets/furniture-kit |
| 书桌 | `office-desk` | Metal Office Desk | Ulan Cabanilla（Poly Haven） | CC0 1.0 | https://polyhaven.com/a/metal_office_desk |

Kenney 许可证全文：https://creativecommons.org/publicdomain/zero/1.0/

Poly Haven 的模型同样是 CC0，说明在 https://polyhaven.com/license 。

书桌用了 128px 的 WebP 贴图和网格量化（`KHR_mesh_quantization`），没有用 Draco 或 meshopt。three.js 的加载器自己支持这两种，不需要额外解码器。文件约 169KB。
