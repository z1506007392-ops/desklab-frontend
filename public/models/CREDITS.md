# 模型来源

桌面上大多数设备仍由 `tools/blender-models/` 里的脚本生成，归本仓库所有。下面四件是 E21 的试用：换成 Kenney Furniture Kit 里的现成模型，方便和原来的简易模型对比。接口、锚点、功耗、`type`、`modelId` 都没改。网格已按目录里的米制尺寸缩放到包围盒，原点在包围盒中心，正面朝 three.js 的 +Z。

这四件都来自同一套、同一种低多边形风格。许可证是 CC0 1.0（不必署名，可以商用）。包内 `License.txt` 写明 Creative Commons Zero。

| 设备 | modelId | 套件里的文件 | 作者 | 许可证 | 来源 |
| --- | --- | --- | --- | --- | --- |
| 键盘 | `keyboard` | `computerKeyboard.glb` | Kenney | CC0 1.0 | https://kenney.nl/assets/furniture-kit |
| 鼠标 | `mouse` | `computerMouse.glb` | Kenney | CC0 1.0 | https://kenney.nl/assets/furniture-kit |
| 台灯 | `desk-lamp` | `lampRoundTable.glb` | Kenney | CC0 1.0 | https://kenney.nl/assets/furniture-kit |
| 音箱 | `speakers` | `speakerSmall.glb`（两个并排） | Kenney | CC0 1.0 | https://kenney.nl/assets/furniture-kit |

许可证全文：https://creativecommons.org/publicdomain/zero/1.0/

音箱在套件里是一只较高的小音箱。为了不改现有锚点和旧存档里的尺寸，两只并排之后再缩进目录里的 0.32 × 0.12 × 0.18 米。

用 gltf-transform `optimize`（不启用 Draco / meshopt）处理过音箱，结果比现在的文件更大，所以保留缩放后的原网格。四个文件都远小于 200KB，加载器不需要额外的解码器。
