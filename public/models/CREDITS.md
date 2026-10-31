# 模型来源

桌面上大多数设备由 `tools/blender-models/` 里的脚本生成，归本仓库所有。键盘和音箱也是这批脚本模型。

台灯和鼠标换成了 Kenney Furniture Kit 里的现成模型。接口、锚点、功耗、`type`、`modelId` 都没改。网格已按目录里的米制尺寸缩放到包围盒，原点在包围盒中心，正面朝 three.js 的 +Z。

这两件来自同一套、同一种低多边形风格。许可证是 CC0 1.0（不必署名，可以商用）。包内 `License.txt` 写明 Creative Commons Zero。

| 设备 | modelId | 套件里的文件 | 作者 | 许可证 | 来源 |
| --- | --- | --- | --- | --- | --- |
| 鼠标 | `mouse` | `computerMouse.glb` | Kenney | CC0 1.0 | https://kenney.nl/assets/furniture-kit |
| 台灯 | `desk-lamp` | `lampRoundTable.glb` | Kenney | CC0 1.0 | https://kenney.nl/assets/furniture-kit |

许可证全文：https://creativecommons.org/publicdomain/zero/1.0/

两个文件都远小于 200KB，没有使用 Draco 或 meshopt，加载器不需要额外的解码器。
