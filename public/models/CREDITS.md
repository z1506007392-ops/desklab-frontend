# 模型来源

## NVIDIA SimReady（CC BY 4.0）

书桌、台式主机、24/27 寸显示器、键盘、鼠标这 6 个模型来自 NVIDIA 的 SimReady 资产。负责人在 2026-11-02 看过对比图后决定换上（E57、E58）。

| 设备 | modelId | SimReady 资产 | 作者 | 许可证 |
| --- | --- | --- | --- | --- |
| 书桌 | `office-desk` | `desk_a01` | NVIDIA | CC BY 4.0 |
| 台式主机 | `desktop-pc` | `computer_desktop_tower_a01` | NVIDIA | CC BY 4.0 |
| 24 英寸显示器 | `monitor-24` | `computer_monitor_office_a01` | NVIDIA | CC BY 4.0 |
| 27 英寸显示器 | `monitor-27` | `computer_monitor_office_a01` | NVIDIA | CC BY 4.0 |
| 键盘 | `keyboard` | `computer_keyboard_a01` | NVIDIA | CC BY 4.0 |
| 鼠标 | `mouse` | `computer_mouse_office_b01` | NVIDIA | CC BY 4.0 |

- 原始资产：https://huggingface.co/datasets/nvidia/simready-assets
- 网页用 GLB 转换版（我们下载的文件）：https://huggingface.co/datasets/codepawl/simready-glb
- 许可证全文：https://creativecommons.org/licenses/by/4.0/

我们做的改动：按目录的米制尺寸缩放（书桌转了 90°，让长边和正面对上），减面（每个 3–1.1 万个三角面），贴图缩到 256 像素；书桌改成纯色、金属件改成黑色；显示器屏幕改成黑屏；鼠标去掉了鼠标垫。接口、锚点、功耗、`type`、`modelId` 都没改。重新生成用 `tools/simready/build.mjs`（见 `tools/simready/README.md`）。

这 6 个文件用 meshopt 压缩（`EXT_meshopt_compression`），贴图是 WebP。`@react-three/drei` 的 `useGLTF` 默认带 meshopt 解码器；资产库小图的渲染页（`tools/thumbnails/render.html`）也设置了解码器。

"关于与隐私"里写明了这些模型的来源和许可证。

## Kenney Furniture Kit（CC0）

台灯来自 Kenney Furniture Kit 的 `lampRoundTable.glb`，CC0 1.0（不必署名，可以商用），https://kenney.nl/assets/furniture-kit 。鼠标以前也用这套里的 `computerMouse.glb`，E58 换成了 SimReady。

## 本仓库的脚本模型

其余设备（笔记本、带鱼屏、显示器支架、桌下理线槽、路由器、插排、电源适配器、墙插、音箱、游戏主机）由 `tools/blender-models/` 里的脚本生成，归本仓库所有。理线槽是通用的槽，不是任何品牌的外形。那里也还留着书桌、主机、显示器、键盘的脚本，重新运行会覆盖上面的 SimReady 模型，不要对这几个 modelId 运行。
