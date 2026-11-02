# SimReady 模型

`build.mjs` 生成 6 个目录模型：`office-desk`、`desktop-pc`、`monitor-24`、`monitor-27`、`keyboard`、`mouse`，写到 `public/models/`。负责人在 E57 看过对比图后决定换上（E58）。

## 来源和许可证

- 原作：NVIDIA SimReady，https://huggingface.co/datasets/nvidia/simready-assets ，CC BY 4.0。
- 下载的是网页用的 GLB 转换版：https://huggingface.co/datasets/codepawl/simready-glb （同样 CC BY 4.0，要求署名 NVIDIA 并链接来源数据集）。
- 署名写在 `public/models/CREDITS.md` 和应用的"关于与隐私"里。换资产、加资产时两处都要改。

## 运行

依赖和应用分开，不进 CI：

```sh
cd tools/simready
npm install
NODE_USE_ENV_PROXY=1 npm run build            # 全部 6 个
NODE_USE_ENV_PROXY=1 node build.mjs mouse     # 只做一个
```

`NODE_USE_ENV_PROXY=1` 让 Node 的 fetch 走 `HTTPS_PROXY`（云端会话需要）。源文件缓存在 `.cache/`（不进 git）。

改了模型之后重新生成资产库小图：

```sh
node tools/thumbnails/render-thumbnails.mjs office-desk desktop-pc monitor-24 monitor-27 keyboard mouse
```

## 每个模型做了什么

1. 去掉不显示的部分（鼠标的鼠标垫）。
2. 改颜色：显示器屏幕改黑屏（原来是一张壁纸），书桌的金属件改成桌腿的黑色。
3. 转向并对齐尺寸，约定和 `tools/blender-models/` 一样：米制，three.js 的 X 是宽、Y 是高、Z 是深，正面朝 +Z，原点在包围盒中心。尺寸直接读 `src/domain/catalog.js` 的 `defaultScale`。书桌原文件长边在 Z、线孔在 -X 一侧。线孔应在背面、远离座位，而书桌的座位在它自己的 -y 一侧（three.js -Z，和设备"正面朝 +Z"相反），所以转 90°，让线孔到 +Z。
4. 减面：主机 6 千、显示器和键盘 3 千、鼠标 2 千个三角面（gltf-transform `simplify`，误差上限 0.02）。书桌由很多独立小块和贴图接缝组成，普通减面下不去，所以先改成纯色（每种材质取贴图平均色，去掉贴图、UV 和法线，three.js 按平面着色），再用 meshoptimizer 的 `simplify`（`Prune`）减到约 1.1 万。
5. 贴图缩到 256 像素 WebP，去重、清理，再按目录尺寸对齐一次（减面会让外形缩一点点），最后 meshopt 压缩。

6 个文件合计约 380 KB，三角面约 3 千到 1.1 万；原文件合计约 4.4 MB、一张桌四十多万面。
