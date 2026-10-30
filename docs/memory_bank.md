# DeskLab Memory Bank for Claude

Last updated: 2026-10-30, Asia/Singapore

> Start here: `docs/AUTONOMOUS_ROADMAP.md` is the step-by-step plan, task
> board, and LLM (DeepSeek) design that every agent follows. This memory bank
> records what was done and why. Vendored agent skills are listed in
> `docs/skills.md` (files under `.claude/skills/`).

## 协作规则

两位贡献者会交替推进这个仓库：**Desklab**（Grok Bot，经 Cursor cloud agents，提交作者名 `grok`）和 **Claude**（提交作者名 `claude`）。动工前先读 `docs/AUTONOMOUS_ROADMAP.md`，再读完本文件。任何代码或文档改动，必须在同一个 PR 或同一次推送里追加下面的「进度记录」一条：日期（UTC+8）、贡献者、分支或 PR 链接、做了什么、还剩什么。没有这条记录的改动不算完成。

## 进度记录 / Progress Log

最新在上。贡献者只写 `Desklab`、`Claude`、`human`，或 `未记录`。2026-10-29 以前的提交没有写明是哪一位，git 作者名不能当成贡献者，所以标为未记录。没有 PR 的日子链到当天最后一次提交。Claude 在 master 上的记录原先写在正文里，这里按提交作者收成同一份日志。

### 2026-10-31 · Desklab (Grok Bot) · master

E18 第 2 步：备份提醒横幅抽到 `src/components/BackupReminderBanner.jsx`。导出和「以后再说」仍走原来的处理函数。还剩：其余横幅和工具栏，然后 E5。

### 2026-10-31 · Desklab (Grok Bot) · master

`04b1a27` E18 第 1 步：未保存草稿横幅抽到 `src/components/DraftRecoveryBanner.jsx`。恢复、导出、放弃仍走原来的处理函数。验证：`npm test` 394，`npm run lint`，`npm run build`，`npm run test:ui` 107 通过 + 1 跳过。还剩：其余横幅和工具栏。

### 2026-10-31 · Desklab (Grok Bot) · master

`7aba642` 领取 E18（把工具栏和横幅从 `App.jsx` 拆出去，一块一个提交，行为不变）。还剩：E18 本身，然后 E5。

### 2026-10-31 · Desklab (Grok Bot) · master

`887613a` E6：六个对话框打开时把焦点放进弹窗，Tab / Shift+Tab 在弹窗内循环，关闭后焦点回到打开它的按钮。属性面板的「属性 / 连接」可以用左右方向键切换，并加上标签页语义。连接清单里的删除按钮会读出两端设备的名字。弹窗本身不额外画焦点框，避免改外观。对比度没有改，仍由 `test/text-contrast.test.js` 守着。验证：`npm test` 394，`npm run lint`，`npm run build`，`npm run test:ui` 107 通过 + 1 跳过。还剩：无（本轮要做的 E7、E2、E3、E6 都做完了；E4、E9 和要人做的 H2/H3 按要求跳过）。

### 2026-10-31 · Desklab (Grok Bot) · master

领取 E6（对话框焦点圈定、读屏能知道焦点在弹窗里，键盘可以在弹窗内循环）。还剩：E6 本身。

### 2026-10-31 · Desklab (Grok Bot) · master

`46559aa` E3：改进建议复用已经算好的布局报告，不再对同一份桌面分析第二遍。拖动时用 `React.memo` 跳过没动的设备、线缆和功耗标签，画面外观不变。未保存判断用的整份快照也做了 `useMemo`。新增测试：传入的布局报告会被采用；36 个设备的分析必须短于 200ms。验证：`npm test` 393，`npm run lint`，`npm run build`，`npm run test:ui` 103 通过 + 1 跳过。还剩：E6。

### 2026-10-31 · Desklab (Grok Bot) · master

领取 E3（30 个以上设备时少做重复的布局分析，并避免拖动时重绘没被拖动的设备）。还剩：E3 本身。

### 2026-10-31 · Desklab (Grok Bot) · master

`5db07ee` E2 第 5 步：把「自动检查与改进建议」抽到 `src/components/RecommendationsDialog.jsx`。五个对话框都已离开 `App.jsx`（1922 行），工具栏和横幅还在。应用建议、撤销、AI 预览仍走原来的处理函数。验证：`npm test` 391，`npm run lint`，`npm run build`，`npm run test:ui` 103 通过 + 1 跳过。还剩：E3、E6。

### 2026-10-31 · Desklab (Grok Bot) · master

`c2b67b7` E2 第 4 步：把「全部连接清单」抽到 `src/components/ConnectionsListDialog.jsx`。删除连接仍记入撤销。验证：`npm test` 391，`npm run lint`，`npm run build`，`npm run test:ui` 103 通过 + 1 跳过。还剩：改进建议对话框。

### 2026-10-31 · Desklab (Grok Bot) · master

`6aa4876` E2 第 3 步：把「布线检查」对话框抽到 `src/components/WiringReportDialog.jsx`。延长线材、清理无效连接、加插排、定位和查看连接仍调用原来的处理函数。验证：`npm test` 391，`npm run lint`，`npm run build`，`npm run test:ui` 103 通过 + 1 跳过。还剩：连接清单。

### 2026-10-31 · Desklab (Grok Bot) · master

`2e9341d` E2 第 2 步：把「布局检查」对话框抽到 `src/components/LayoutReportDialog.jsx`。修复、落到表面、移回房间、贴墙和定位仍调用原来的处理函数。验证：`npm test` 391，`npm run lint`，`npm run build`，`npm run test:ui` 103 通过 + 1 跳过。还剩：布线检查、连接清单。

### 2026-10-31 · Desklab (Grok Bot) · master

`9b4ca66` E2 第 1 步：把「桌面模板」对话框抽到 `src/components/TemplateDialog.jsx`。套用模板、按设备生成、从开始引导滚到生成表单、Esc 关闭都还走原来的处理函数。验证：`npm test` 391，`npm run lint`，`npm run build`，`npm run test:ui` 103 通过 + 1 跳过。还剩：继续拆布局检查、布线检查、连接清单。

### 2026-10-31 · Desklab (Grok Bot) · master

领取 E2（把 `App.jsx` 里的对话框和横幅逐块抽到 `src/components/`，行为不变）。还剩：E2 本身。

### 2026-10-31 · Desklab (Grok Bot) · master

`4c71c1d` E7 测试稳定性。把 Playwright 全量连跑 3 遍（桌面 1440×900 和手机 390×844，`--repeat-each=3`，312 次执行）。309 通过，3 次跳过（手机工具栏用例在桌面项目里跳过）。没有失败，也没有重跑才过的用例。先前 CI 红的两处已经在 `b481b9e` 根治：拖动用 `holdGroup` 合成一步撤销；按钮条用 `scroll-padding-inline` 避免贴边裁切。这次重跑这两处仍然全绿。验证：`npm test` 391，`npm run lint`，`npm run build`，`npm run test:ui -- --repeat-each=3` 309 通过 + 3 跳过。已知限制：没有在更慢的 CI 机器上再复现历史失败，结论来自本机 Chrome 连跑。还剩：E2、E3、E6。

### 2026-10-31 · Desklab (Grok Bot) · master

领取 E7（测试稳定性：把 Playwright 多跑几遍，找出偶发失败并根治）。CI 上 `b481b9e` 已是绿的。还剩：E7 本身。

### 2026-10-31 · Claude · master

E1 补修：master 上 CI 的 Playwright 有 3 个失败（`a8e5811` 起），两个原因，都先在本地复现再修，没改测试阈值。①`edit-edge-cases.spec.mjs:52`（桌面、手机）：拖动的撤销分组只合并 500ms 内的记录，CI 机器慢、拖动中间停顿超过 500ms 就被拆成几步，撤销一次只回到拖动途中的位置（CI 里是 {x:0.654, y:0.873}）。本地在拖动测试里加 0.7 秒停顿（像用户拖到一半停下看）就复现了。修法：`project-history.js` 的 `record` 新增 `holdGroup`，拖动从按下到松手用同一个"不限时"的分组 `drag:<id>`，只在 `finishGroup`、撤销、重做时结束；`updateSelectedObject` 增加第二个参数选分组。拖动加松手后的掉落现在是一步撤销，回到拖动前的位置和高度。新增单元测试（慢速记录仍是一步）。②`compact-toolbar.spec.mjs:21`（手机）："房间尺寸" 可见比例 0.998。原因：按钮被滚进视野时浏览器把它的边缘贴着横向按钮条的边（也就是屏幕边），CI 的字体让按钮宽度带小数，贴边后就有零点几像素被裁掉；本地字体宽度是整数所以没事。本地把按钮宽度改成小数就复现了（"所有连接" 0.9996、"更多" 0.9966）。修法：按钮条加 `scroll-padding-inline: 12px 32px`、右内边距改 32px，滚进来的按钮停在离左边 12px、离右边 32px 处，也不再压在右侧 28px 的渐隐里。验证：`npm test` 391、`test:ui` 103 + 1 跳过、lint、build，手机按钮条截图已看。教训：每次推送后要看 GitHub 上的 CI，本地全绿不等于 CI 绿（这次从 `010317d` 起 CI 就一直是红的，我没去看）。

### 2026-10-30 · Claude · master

E1 完成。先用临时探查测试（用完已删）逐个试：单击设备不动不产生撤销步骤；拖动后一次撤销回原位；删除带 2 条连线的显示器后撤销能连线一起恢复、重做再删掉；撤销回到已保存状态时"未保存"消失；输入框里按 Ctrl+Z 走浏览器自己的撤销；连按方向键合并成一步；复制设备后撤销。这些都正常。发现并修了两个问题（先写了会失败的测试）：①设备快捷键只跳过输入框：选中设备时，焦点在按钮上按空格会去抬高设备，按钮按不下去；弹窗开着时方向键和 Delete 会作用到弹窗后面的设备（还会弹出"确定要删除"）。新增 `keyboard-controls.js` 的 `shouldIgnoreDeviceShortcut` / `describeKeyTarget`：任何弹窗打开、焦点在弹窗或菜单里、在输入框里时不处理；焦点在按钮上时空格和回车留给按钮；点完工具栏按钮后方向键仍能移动设备。②把显示器拖出桌面后 z 不变，悬在半空，布局检查马上报"悬空"。新增 `layout-analysis.js` 的 `settleAfterDrag`：拖动确实移动过、松手时下面没有支撑（墙壁插座除外），就用现有的 `snapObjectToSupport` 落到下方最高的表面或地板；不另记撤销步骤，一次撤销回到拖动前（含原来的高度）。新增单元测试 4 个、UI 测试 `e2e/edit-edge-cases.spec.mjs`（桌面和手机各 3 个；用 3D 选中标签的位置找到设备再拖）。已知、没改（交互要负责人定）：选中设备时鼠标滚轮会缩放设备（每格 5%）而不是缩放视角，提示条里没写，用户想拉近看时可能误改设备尺寸（可撤销）。验证：`npm test` 390、`test:ui` 103 + 1 跳过、lint、build，拖出桌面后截图已看（落在地板上、布局检查无问题）。

### 2026-10-30 · Claude · master

领取 E1（撤销/重做、拖动、连线的边界情况，写 UI 测试找 bug）。还剩：E1 本身。

### 2026-10-30 · Claude · master

E17：资产库卡片加设备小图。新脚本 `tools/thumbnails/render-thumbnails.mjs`（附 `render.html`）：起 Vite、用 Playwright 的 Chromium 打开页面、three.js 载入 `public/models/<id>.glb`，RoomEnvironment 打光、透明底、前右上方视角（插排改成从上方看，才认得出插孔），按包围盒投影轮廓取景，输出 112px WebP 到 `public/thumbnails/`（10 张共约 25KB），并为每张写 `.webp.json` 来源说明（impeccable `embed-prompt` 对 WebP 用的就是这种旁注文件；`--scan` 结果 0 缺失）。`catalog.js` 新增 `catalogThumbnailUrl`；卡片左边 56px 白色圆角方块放图（`alt=""`，按钮名称不变）。改了或加了模型要重跑：`CHROMIUM_PATH=/opt/pw-browsers/chromium node tools/thumbnails/render-thumbnails.mjs`（本机有 Playwright 自带 Chromium 时不用设）。新增 `test/thumbnails.test.js`（每个设备都有 112×112 图和来源说明）、`e2e/library-thumbnails.spec.mjs`（图片加载成功、按钮名称不变）。README、`DESIGN.md`、`.impeccable/design.json` 已更新。验证：`npm test` 387、`test:ui` 97 + 1 跳过、lint、build，四个分类截图已看。还剩：无。

### 2026-10-30 · Claude · master

E16：负责人同意做终审提的两项改进。第一项：选中设备时，3D 画面里设备正上方钉一个白色圆点标签（`Scene3D.jsx` 的 `SelectionTag`，drei `Html`）。按 threejs-react-three-fiber 技能的提醒，fiber 9 / React 19 下 `Html` 跟画布同时挂载会是空的，所以用 `portal` 画进画布上方的 `.scene-overlay` 层（`z-index:1`、`overflow:hidden`、不接收点击），`zIndexRange` 压到 [2,1]，弹窗和手机抽屉会盖住它。标签对读屏隐藏（提示条已经说了选中谁）。"唯一刻意安排的动效"从提示条挪到这个标签上。`DESIGN.md` 和 `.impeccable/design.json` 同步更新。新增 `e2e/scene-tag.spec.mjs`。验证：`npm test` 386、`test:ui` 95 + 1 跳过、lint、build，桌面和手机截图已看（抽屉、弹窗都盖在标签上面）。还剩：E17 资产库缩略图。

### 2026-10-30 · Claude · master

E15 完成：写了根目录 `DESIGN.md`（impeccable 格式：YAML 设计变量 + 八个固定章节 + 六条命名规则）和 `.impeccable/design.json`（色阶、阴影、动效、断点、9 个组件片段）。impeccable 自带的文档代理没装，按 `reference/degraded/documenter.md` 在本对话里写，只记录代码里真用到的值（删掉了没用到的 `--ok-bg`、`--text-xl`；`DESIGN.md` 里 18 个颜色和 `App.css` 逐一核对一致）。以后改界面先读 `DESIGN.md`。还剩：无（可选后续见路线图 E15）。

### 2026-10-30 · Claude · master

E15 第 5 步：impeccable 终审。没有装 impeccable 自带的审查代理，所以用一个全新的通用子代理按 `reference/degraded/finish-reviewer.md` 审（不带构建过程的上下文）。第一轮结论 fix，六条：①问题数量也要用"标签"样式（白底、圆点、墨色数字），不用实心粉色圆标；②保存/出错提示放在工具栏末尾会把整排按钮往左挤约 350px；③关闭按钮的"×"和步进器的"−/+"是文字字符，不是图标；④蓝色"提示"标签是方向里没有的第四种颜色；⑤字重用了方向没写的 700；⑥下拉框还是浏览器自带箭头、手机上 AI 输入框例句被截断。全部修了：`.ui-button-tag` 统一标签样式，"布局检查""布线检查"有问题时变标签；提示改成屏幕下方居中浮起的标签（`.status-toast`，不挡点击）；新增 `Icons.jsx`（关闭、减、加，同一线宽）；提示色改中性灰，`#d98a00` 收成 `--warn-dot`；字重只剩 500/600/800；下拉框画了同线宽的箭头；手机上 AI 输入框独占一行。复审结论 ship（只针对这六条）。审查提的可选方向没做：把选中标签钉在 3D 画面里设备旁边（3D 外观由负责人冻结，要先问）、资产库卡片加设备缩略图。验证：`npm test` 386、`test:ui` 93 + 1 跳过、lint、build。还剩：`DESIGN.md`。

### 2026-10-30 · Claude · master

E15 第 5 步开头：按 impeccable 收尾，截了桌面和手机 14 种状态（`.impeccable/review/`，不进 git），`impeccable detect` 无发现。截图时发现"桌面模板"弹窗按 Esc 关不掉（其他弹窗都能），已修，加了测试。验证：`npm test` 386、`test:ui` 93 + 1 跳过、lint。还剩：按终审意见修改、写 `DESIGN.md`。

### 2026-10-30 · Claude · master

E15 第 4 步：动效。按 emil-design-eng / impeccable 的规矩只交代状态变化，150–200ms、缓出、只动 transform 和 opacity，不从 0 缩放。唯一刻意安排的一刻：选中设备时标签弹出、圆点光圈收拢一次（`key` 让每次选中都重放）。弹窗淡入上浮、"更多"菜单从右上角展开、手机上的左右面板从边上滑入、开始引导和数量圆标出现时轻轻弹入。系统开了"减少动态效果"时只淡入、按钮按下不缩放（用 `getAnimations()` 在两种设置下核对过）。验证：`npm test` 386、`test:ui` 91 + 1 跳过、lint、build。还剩：impeccable 检查、终审和 `DESIGN.md`。

### 2026-10-30 · Claude · master

E15 第 3 步（E8、E10、E12）：工具栏控件在 `App.jsx` 里各定义一次，桌面和手机（`isMobile`，<900px）分别排布。桌面：按"编辑 / 检查 / 面板 / 保存"分四组，组间 20px。手机：第一行 DeskLab、未保存、撤销、重做、保存；第二行一条可横向滑动的按钮条（两端渐隐），房间尺寸收进新的"房间尺寸"按钮（`aria-expanded`）；390px 宽时工具栏约 95px（原来约 200px）。标题去掉"MVP"（负责人同意过）。触屏（`pointer: coarse`）上按钮、分类、关闭、标签页的可点范围扩到至少 44px，外观不变。新增 `e2e/compact-toolbar.spec.mjs`：手机两行、每个按钮都能滑到、房间尺寸开合；触屏上按钮边缘外 5px 仍能点中（去掉这段 CSS 时测试会失败，已验证）。验证：`npm test` 386、`test:ui` 91 通过 + 1 跳过（手机布局测试在桌面跳过）、lint、build。还剩：动效、impeccable 检查、终审和 `DESIGN.md`。

### 2026-10-30 · Claude · master

E15 第 2 步：去掉界面上的 emoji（✅ ⚠️ ● 📤 📥），换成 CSS 圆点：保存/出错状态、"未保存"、用电负载提示都用圆点；"布局检查""布线检查""改进建议"的数量改成深粉色小圆标（`CountBadge`），按钮的无障碍名称用 `aria-label` 保持"布局检查 (1)"不变。浅灰卡片里的次要按钮改白底。属性面板的输入框用 `useId` 关联标签（以前读屏读不出"左右 X"）。测试里的 `✅ 已保存`、`⚠️ 导入失败` 改成不带 emoji 的文字。3D 场景里的 ⚡ 功耗标签没动（3D 不改）。验证：`npm test` 386、`test:ui` 88、lint，截图已看。还剩：手机工具栏（E10/E12）、动效、终审和 `DESIGN.md`。

### 2026-10-30 · Claude · master

E15 第 1 步：`App.css` 改成一套颜色/圆角/阴影/字号/动效变量（`:root`），全部控件按"桌搭标签"重画：浅灰底、白色面板、无边框胶囊按钮、填充式输入框、白色浮起的"改进建议"标签带粉色圆点、选中提示变成带圆点的白色标签、连线模式提示改成浮起标签。组件里写死的颜色搬进 CSS 类（E11 一并完成）。布线问题卡片的彩色左边框换成状态圆点。`test/text-contrast.test.js` 现在也检查 `var(--…)` 指向的颜色。按钮文字、布局、3D 场景未动。验证：`npm test` 386、`test:ui` 88（Chromium）、lint、build，桌面和手机截图已看。还剩：去掉 emoji 状态字、手机工具栏、动效、终审和 `DESIGN.md`。

### 2026-10-30 · Claude · master

领取 E15 界面视觉重做。按 impeccable 流程，负责人回答了产品问题（用户两类都有、白天用、不改按钮文字/布局/3D/名字，不要后台感、AI 模板感、CAD 感），写入 `PRODUCT.md`；在真页面上做了四个方向的预览，负责人选了"桌搭标签"（浅灰底、白色面板、胶囊按钮、带粉色圆点的标签）。方向合同在 `.impeccable/surfaces/src-app-jsx.md`。还剩：按 E15 的步骤实现，最后写 `DESIGN.md`。

### 2026-10-30 · Desklab (Grok Bot) · [PR #3](https://github.com/z1506007392-ops/desklab-frontend/pull/3)

分支 `cursor/vendor-agent-skills-2dc1`。补上先前没放进仓库的两块：`web-design-guidelines` 改用 vercel-labs/web-interface-guidelines 的 `command.md`（`434b7f91`，MIT），审查读本地副本；`fixing-accessibility` 来自 ibelick/ui-skills（`59193a75`，MIT）；`blender-gltf-export` 按 `tools/blender-models/` 自己写，不收录 CC-BY-NC-ND 的 Blender Developer Tools。已把含 PR #2 的 master 合并进本分支。还剩：等合并进 master，本代理不自行合并。

### 2026-10-30 · Desklab (Grok Bot) · [PR #3](https://github.com/z1506007392-ops/desklab-frontend/pull/3)

分支 `cursor/vendor-agent-skills-2dc1`。把可再分发的第三方技能放进 `.claude/skills/`（Cursor 也会读这个目录，没有再复制一份）。纳入 impeccable（`df3a4ab`，Apache-2.0）、frontend-design（`ca45fc4`，Apache-2.0）、three.js 技能 13 个（`0e18186`，MIT）、emilkowalski 动画/动效 9 个（`a81dbca`，MIT）。清单在 `docs/skills.md`。当时 Vercel agent-skills 的 web-design-guidelines 没有许可证，Blender Developer Tools 是 CC-BY-NC-ND，都没有收录。还剩：替代技能，见上一条。

### 2026-10-30 · Desklab · [PR #2](https://github.com/z1506007392-ops/desklab-frontend/pull/2)

把当时的 `master`（`28c0216`）合并进 `docs/glb-models`。保留 Claude 的代码和文档，也保留本 PR 的协作规则、进度记录、`AGENTS.md`、`CLAUDE.md`、README 指针和 `ATTRIBUTION.md`。冲突只在 `README.md` 和 `docs/memory_bank.md`。还剩：E13 评测余下 6 个请求、E10 等负责人先放入技能、H2 的 KV 限流绑定，以及屏幕发黑、近景功耗标签和线缆过大。

### 2026-10-30 · Claude · [`28c0216`](https://github.com/z1506007392-ops/desklab-frontend/commit/28c0216)

`d7094e0`。E13：每条布局提示带上可直接用的 `fix`，提示词 v2 在同一批 19 个请求上把采纳率从 25% 提到 53%。后 6 个请求撞上每小时限额，没有重跑。E10 未改代码就放开，等负责人先把技能放进仓库。

### 2026-10-30 · Claude · [`eecabdb`](https://github.com/z1506007392-ops/desklab-frontend/commit/eecabdb)

`66231cb`。C8：用户可以针对上一次 AI 回答再说一句，服务端把上一轮建议和这句话送回去。阶段 C 结束。还剩阶段 E。

### 2026-10-30 · Claude · [`6525476`](https://github.com/z1506007392-ops/desklab-frontend/commit/6525476)

负责人暂缓 H2（Cloudflare KV 上的共享限流）。限流仍是单实例内存。

### 2026-10-30 · Claude · [`886b332`](https://github.com/z1506007392-ops/desklab-frontend/commit/886b332)

`ca62f5c`、`c1ee1ab`。C7：对线上 DeepSeek 跑完第一轮评测，各项门槛都过，提示词不用改。评测可以在限额处停下再续跑。记下两个没帮上忙的场景，交给 E13。

### 2026-10-30 · Claude · [`e2533ce`](https://github.com/z1506007392-ops/desklab-frontend/commit/e2533ce)

负责人已在 Cloudflare 配好 `DEEPSEEK_API_KEY` 并重新部署。线上 `/api/ai/layout` 返回 200，模型名为 `deepseek-flash`。C7 可以开始。

### 2026-10-30 · Claude · [`e4018ea`](https://github.com/z1506007392-ops/desklab-frontend/commit/e4018ea)

`2297f1f`。A10：新插排不再自动插到另一只插排上。线上验收时加第二只插排会报布线问题，这里修掉。

### 2026-10-30 · Claude · [`9c12f59`](https://github.com/z1506007392-ops/desklab-frontend/commit/9c12f59)

D2：在 https://desklab-frontend.pages.dev 上做了桌面和手机验收（模板、保存、导出、关于页）。AI 当时仍显示未开放。发现第二只插排的串联问题（A10）。

### 2026-10-30 · Claude · [`7827dda`](https://github.com/z1506007392-ops/desklab-frontend/commit/7827dda)

`deaf439`。D5：补上搜索和链接预览用的描述与 `og:image`。自定义域名还没有。

### 2026-10-30 · Claude · [`285ff35`](https://github.com/z1506007392-ops/desklab-frontend/commit/285ff35)

`0209fa0`。D4：过旧的浏览器看到「版本太旧」，应用不再启动。Safari、Firefox、微信内置浏览器还没在真机上验过。

### 2026-10-30 · Claude · [`bc2fd15`](https://github.com/z1506007392-ops/desklab-frontend/commit/bc2fd15)

`f3811c7`。D3：页面出错时给出可复制的提示，不把内容发出去。GLB 回退和 ResizeObserver 的噪音不算。

### 2026-10-30 · Claude · [`6ffef0a`](https://github.com/z1506007392-ops/desklab-frontend/commit/6ffef0a)

`835eb4c`。D1：更多菜单里的「关于与隐私」。项目只存在本机；点「让 AI 看看」才会把布局和设备名称发给 DeepSeek。还没有联系方式。

### 2026-10-30 · Claude · [`c022798`](https://github.com/z1506007392-ops/desklab-frontend/commit/c022798)

`ae578ed`。C6：`npm run eval:ai` 离线评测。真模型结果等 H1。本地开发服务器默认不再限流。

### 2026-10-30 · Claude · [`c3246cc`](https://github.com/z1506007392-ops/desklab-frontend/commit/c3246cc)

`5407119`、`1fc4ff1`。C5：改进建议对话框里的 AI 建议，可预览、应用、撤销。A5 的懒加载在开发环境把画面留白，`LazyScene3D` 改为挂载一次；测试会把空白截图判失败。

### 2026-10-30 · Claude · [`d7bda2a`](https://github.com/z1506007392-ops/desklab-frontend/commit/d7bda2a)

`9a740b0`。C4：AI 动作先过规则引擎。越界、搬桌子、拆电源线、线太短等直接拒绝，并给出中文原因。

### 2026-10-30 · Claude · [`4bc1f6c`](https://github.com/z1506007392-ops/desklab-frontend/commit/4bc1f6c)

`4e327b5`。C3：把当前桌面收成给 AI 的摘要（座位、谁放在谁上面、线长、检查结果）。

### 2026-10-30 · Claude · [`3cc8bd2`](https://github.com/z1506007392-ops/desklab-frontend/commit/3cc8bd2)

`7df818b`。C2：给布局打分，用来判断 AI 的改动有没有变好。未建模的缺线不计入。

### 2026-10-30 · Claude · [`881f471`](https://github.com/z1506007392-ops/desklab-frontend/commit/881f471)

`1a0a2ae`。C1：舒适和整齐方面的布局提示（路线图 6.6.1 的 10 条）。模板和场景生成组合都应是 0 条提示。

### 2026-10-30 · Claude · [`b15678f`](https://github.com/z1506007392-ops/desklab-frontend/commit/b15678f)

`3287f5d`。B6：界面测试可以代答 AI 接口。阶段 B 结束。还剩阶段 C 的建议校验和界面。

### 2026-10-30 · Claude · [`221762d`](https://github.com/z1506007392-ops/desklab-frontend/commit/221762d)

`f38b3cf`。B5：浏览器端请求 AI 布局建议的客户端，错误有中文说明。

### 2026-10-30 · Claude · [`2739d5c`](https://github.com/z1506007392-ops/desklab-frontend/commit/2739d5c)

`ea51b15`。B4：`npm run dev:api` 在本机跑同一个 AI 处理函数；`AI_MOCK=1` 不需要密钥。

### 2026-10-30 · Claude · [`c831074`](https://github.com/z1506007392-ops/desklab-frontend/commit/c831074)

`202c2c8`。B3：按地址的每小时上限和全站每日上限（北京时间零点）。有 KV 就用 KV，否则用本机内存。

### 2026-10-30 · Claude · [`756a206`](https://github.com/z1506007392-ops/desklab-frontend/commit/756a206)

`64faa10`、`60a8eca`。B1 和 B2：约定 AI 建议的格式和 DeepSeek 提示词，并加上 Cloudflare Pages 的 `/api/ai/layout`。没配密钥时返回 503。

### 2026-10-30 · Claude · [`b756467`](https://github.com/z1506007392-ops/desklab-frontend/commit/b756467)

`4e5aa30`。A9：GLB 缺失时先 HEAD 检查，缺了就画通用形状，不再变成未捕获的页面错误。阶段 A 的必做部分到此结束。

### 2026-10-30 · Claude · [`f80e841`](https://github.com/z1506007392-ops/desklab-frontend/commit/f80e841)

`b45316e`。A7：界面上漏出的内部名称改成白话（线缆类型、端口、越界提示、导入错误）。HDMI、DP、USB-C 和单位保留。

### 2026-10-30 · Claude · [`9e916cf`](https://github.com/z1506007392-ops/desklab-frontend/commit/9e916cf)

`ffefe20`。A6：灰色辅助文字对比度提到可读；审计里已修好的条目标在文档上，剩下的变成 E8–E12。

### 2026-10-30 · Claude · [`cf993c8`](https://github.com/z1506007392-ops/desklab-frontend/commit/cf993c8)

`126c945`。A5：3D 画面延后加载，three.js 单独成块。下载失败和崩溃的提示分开。

### 2026-10-30 · Claude · [`a6905c7`](https://github.com/z1506007392-ops/desklab-frontend/commit/a6905c7)

`97a4658`。A4：没有 WebGL 或画面崩溃时，其余界面仍可用，并可以重新加载 3D。顺手记下 A9（模型加载的未捕获错误）。

### 2026-10-30 · Claude · [`7306d9f`](https://github.com/z1506007392-ops/desklab-frontend/commit/7306d9f)

`6efa9da`。A3：第一次打开、还没保存时，画面上有「开始搭建」（模板、按我的设备生成、自己摆）。

### 2026-10-30 · Claude · [`0bd266b`](https://github.com/z1506007392-ops/desklab-frontend/commit/0bd266b)

`20a8fc8`。A2：工具栏下的提示在手机上改短，并换行，不再被裁掉。选中设备显示用户起的名字。

### 2026-10-30 · Claude · [`d73844f`](https://github.com/z1506007392-ops/desklab-frontend/commit/d73844f)

`940e696`。A1：「更多」里的导入导出改成「导入备份 / 导出备份」等白话，坏文件有明确的中文错误。

### 2026-10-30 · Claude · [`51b7f7b`](https://github.com/z1506007392-ops/desklab-frontend/commit/51b7f7b)

写下 `docs/AUTONOMOUS_ROADMAP.md`：阶段 A–E 的任务板和 DeepSeek 设计，给后续代理当入口。

### 2026-10-30 · Claude · [`b3c3daa`](https://github.com/z1506007392-ops/desklab-frontend/commit/b3c3daa)

`62ca3a3`、`d7dc408`。仓库是私有的，不用 GitHub Pages。改由 Cloudflare Pages 构建 `master`，站点 https://desklab-frontend.pages.dev 。GitHub Actions 只跑检查。`e4018ea` 是后来的 A10 文档，不是这次部署本身。

### 2026-10-30 · Claude · [`d52561b`](https://github.com/z1506007392-ops/desklab-frontend/commit/d52561b)

`f68761f`。保存后若 7 天没导出，黄条提醒导出备份。导出或「以后再说」会消掉。

### 2026-10-30 · Claude · [`f3f2cd1`](https://github.com/z1506007392-ops/desklab-frontend/commit/f3f2cd1)

`8447785`、`5919d80`。每个访客的项目改存在自己的浏览器里（含上一份备份），不再读写后端那份共享文件。修了 StrictMode 卸掉状态通知器之后开发环境不显示状态的问题。

### 2026-10-29 · Claude · [`8bb93ea`](https://github.com/z1506007392-ops/desklab-frontend/commit/8bb93ea)

`c21c28e`。旧存档打开时：目录端口改用现在的 GLB 锚点；过扁的 15 寸笔记本恢复成打开的高度，底面不动。提交作者约定为 Claude `claude`、Grok `grok`。转动视角会使项目变成未保存。

### 2026-10-29 · Desklab · [PR #2](https://github.com/z1506007392-ops/desklab-frontend/pull/2)

分支 `docs/glb-models`。补了 GLB 交接说明（`docs/memory_bank.md`、`README.md`、`public/models/ATTRIBUTION.md`），并写上本进度记录和协作规则（`AGENTS.md`、`CLAUDE.md`）。还剩：屏幕是暗的、近景里功耗标签和线缆过大、主机背面没有接口造型、已保存项目仍保留旧锚点。

### 2026-10-29 · Desklab · [PR #1](https://github.com/z1506007392-ops/desklab-frontend/pull/1)

合并提交 [`1f10bfc`](https://github.com/z1506007392-ops/desklab-frontend/commit/1f10bfc)，接线提交 [`4ee93b6`](https://github.com/z1506007392-ops/desklab-frontend/commit/4ee93b6)。目录设备改画 `public/models/<modelId>.glb`：`BASE_URL`、预加载、空闲时保留自发光、锚点改到接口上、墙壁插座网格偏航 180°、加载失败时 GLB → 通用形状 → 方块。还剩：上面的视觉缺口，以及交接文档（本 PR 在补）。

### 2026-10-29 · Desklab · [`3f556ec`](https://github.com/z1506007392-ops/desklab-frontend/commit/3f556ec)

分支 `feat/glb-models`。为 10 个目录设备提交 GLB，以及 Blender 4.2 无界面生成脚本 `tools/blender-models/`。网格按 `defaultScale` 制作、包围盒居中、+Y 朝上、正面朝 +Z。还剩：场景仍在画通用形状，尚未把 `assetUrl` 指到这些文件。

### 2026-10-28 · 未记录 · [`11cfcc3`](https://github.com/z1506007392-ops/desklab-frontend/commit/11cfcc3)

`ea2dbc4..11cfcc3`，`master`。功率和坐标轴标签改为始终朝向相机；直流设备优先接到已有适配器；每对电脑和显示器只建议一根视频线；桌面模板、按设备清单生成、购物清单、属性面板改成白话、资产库显示规格；新设备落到桌边空位；没画的电源、视频、网线视为模型未完成，由系统补上，而不是当成故障。仓库说明改指向新的 GitHub 账号。还剩：目录设备仍是通用形状，没有 GLB。

### 2026-10-25 · 未记录 · [`a8d5489`](https://github.com/z1506007392-ops/desklab-frontend/commit/a8d5489)

`c71c8c0..a8d5489`。按家庭用户收窄目录：去掉 UPS、交换机、NAS、猫、迷你主机、一体机和多余桌子，只留一张可调书桌；路由建议改为普通网口；JSON 工具和坐标轴收进「更多」。依赖审计清到 0。还剩：建模仍然靠逐件摆放，模板和购物清单尚未做。

### 2026-09-09 · 未记录 · [`bfa0549`](https://github.com/z1506007392-ops/desklab-frontend/commit/bfa0549)

`ba0acd3..bfa0549`。改进建议的结果改成用户能看懂的说法，并加上 Playwright 用户流程。还剩：目录仍含家庭用户用不到的设备。

### 2026-08-01 · 未记录 · [`2dfb441`](https://github.com/z1506007392-ops/desklab-frontend/commit/2dfb441)

`38459dd..2dfb441`。应用「加长线缆」时重新校验长度，避免过期补丁。还剩：建议面板的措辞和端到端流程。

### 2026-07-17 · 未记录 · [`440a79b`](https://github.com/z1506007392-ops/desklab-frontend/commit/440a79b)

`8a82217..440a79b`。拒绝对象、布局、端口、线缆上已经过期的自动补丁；跳过含糊的线缆建议；自动连接使用不重复的 id；应用时重算自动线长。还剩：手动改长度的补丁还没做同样的重算。

### 2026-07-16 · 未记录 · [`84c5a68`](https://github.com/z1506007392-ops/desklab-frontend/commit/84c5a68)

`c35262e..84c5a68`。建议引擎忽略非法或重复的对象 id、端口 id、型号 id，非法功率和最大负载退回目录值，不透明 id 原样保留。还剩：过期补丁仍可能被应用。

### 2026-07-15 · 未记录 · [`ee48d87`](https://github.com/z1506007392-ops/desklab-frontend/commit/ee48d87)

`dc0a188..ee48d87`。分析器拒绝空的连接和端口字段、未知线缆类型、不支持的端口方向、重复 id；报告非法锚点和非法端口集合；畸形的实时数据不再把分析打崩。还剩：建议引擎对同一类脏数据的防护。

### 2026-07-14 · 未记录 · [`a588e1e`](https://github.com/z1506007392-ops/desklab-frontend/commit/a588e1e)

`257d1df..a588e1e`。通用模型收进目录包围盒并加上覆盖测试；剪贴板导入、历史分组、功率元数据、网络和交换机建议、购买后的接线引导、自动连接的幂等和过期目标都收紧了一轮。还剩：分析器对空字段和畸形实时数据仍然不严。

### 2026-07-13 · 未记录 · [`4660198`](https://github.com/z1506007392-ops/desklab-frontend/commit/4660198)

`18ce68a..4660198`。补上升降桌和 L 型桌的通用模型，并让已有通用模型的零件落在目录尺寸内。还剩：交换机、UPS、插排的包围盒，以及建议引擎的脏数据防护。

### 2026-07-05 · 未记录 · [`e707b9c`](https://github.com/z1506007392-ops/desklab-frontend/commit/e707b9c)

`3e3b2d7..e707b9c`。为台式主机、迷你主机、电源适配器、墙壁插座、笔记本、NAS、猫、一体机、书桌、电竞桌加上通用低模，并同步记忆库。还剩：升降桌、L 型桌，以及这些模型是否越出目录包围盒。

### 2026-06-26 · 未记录 · [`c9fff49`](https://github.com/z1506007392-ops/desklab-frontend/commit/c9fff49)

`8521765..c9fff49`。为显示器、插排、路由器、交换机、UPS 加上代码生成的通用低模。还剩：电脑、插座、家具等其余目录项。

### 2026-06-25 · 未记录 · [`114ed1b`](https://github.com/z1506007392-ops/desklab-frontend/commit/114ed1b)

`eef96fe..114ed1b`。前端仓库在 D 盘迁移后重新建库。功率读写收拢到同一套分类；建议引擎避开缺坐标的设备；端口锚点不重叠；修掉 React 19 的 `inert` 警告。还剩：目录设备没有通用外形，分析仍是方块。
## Mission

DeskLab is a connected 3D room desktop layout and cabling tool. The long-term product direction is:

- The user models their current room, furniture, devices, power strips, outlets, and cable connections.
- AI later analyzes the model and proposes options:
  - free layout/cabling improvements,
  - paid purchase recommendations,
  - step-by-step changes after purchase.
- The product does not cover in-wall electrical work or construction.
- Generic realistic device categories are enough. Do not spend excessive time chasing exact branded SKU models.

Product decisions from the product owner (2026-10-25):

- Target users are ordinary home users, including gamers. Do not design for
  NAS/homelab or small-office setups.
- Keep the device catalog small; more device types make the product harder to
  use. Home users do not need a UPS, switch, NAS, or modem, and these were
  removed (see "Home-user catalog reduction" below).
- The goal is a real public launch, not only a demo.
- An LLM is intended to be a core selling point. The rule engine stays the
  source of truth; the LLM is expected to build on it. Provider is undecided.
- The roadmap is being revised step by step with the product owner. Report to
  them after each completed feature slice.
- Principle (2026-10-28): desk-setup users' real devices already work. A
  connection missing from the model (for example no power line drawn) means
  the model is incomplete, not that the user has a problem. Never report it as
  a warning or recommend buying something because of it; complete the model
  for the user instead. Only flag what is a real-world concern (too few
  outlets, overload, daisy-chained strips, cables too short).
- Accounts (2026-10-30): start anonymous. Each visitor's project is saved in
  their own browser, not on the server (see "Browser-local saves" below).
  Accounts or cloud sync may come later.

The current work mode is autonomous engineering:

- Pick one high-value, reproducible vertical slice at a time.
- Prefer test-first when fixing bugs or hardening behavior.
- Make the smallest change that moves the product toward robustness.
- Run the full relevant verification.
- Commit only the files changed for that slice.
- Do not ask the user technical questions unless there is a true product decision or irreversible action.

## Repositories

Frontend:
```
D:\desklab\frontend
```

Backend:
```
D:\desklab\backend
```

GitHub repositories (public):
```text
Frontend: https://github.com/z1506007392-ops/desklab-frontend
Backend:  https://github.com/z1506007392-ops/desklab-backend
```

Canonical tracked memory-bank copy:
```text
D:\desklab\frontend\docs\memory_bank.md
```

Moved on 2026-10-28 from the hollowell1225 account to z1506007392-ops (new
repositories with full history). The old repositories remain as the
`hollowell1225` git remote. Both local repos use the GitHub CLI as their
credential helper (repo-local config), so pushes use the active `gh` account.

Commit author (product owner rule, 2026-10-30): two agents work on these repos,
and each marks its own commits by author name, with the same email
`285454369+z1506007392-ops@users.noreply.github.com`:
- Claude: `claude`
- Grok: `grok`
Set `user.name` / `user.email` repo-locally only. No AI sign-off lines in
commit messages. Before starting, pull both repos and read the other agent's
recent commits.

Keep this external handoff copy and the tracked copy synchronized whenever the
memory bank is updated. The tracked copy is committed and pushed with the
frontend repository so it is protected by the GitHub backup.

Expected dev URLs:
```
Frontend: http://localhost:5173/
Backend:  http://localhost:3001/api/projects/default (no longer used by the
          frontend since 2026-10-30; projects are saved in the browser)
```

Services may or may not be running. Check and restart them when needed.

Additional handoff docs:
```
D:\desklab\memory-bank\DeskLab-model-assets-plan.md
D:\desklab\memory-bank\DeskLab-AI-handoff-template.md
```

Frontend commands:
```bash
npm test
npm run lint
npm run build
npm run dev
```

Backend commands:
```bash
npm test
npm run check:contracts
npm start
```

## Critical Safety Rules

- Frontend was moved to `D:\desklab\frontend` and rebaselined as a new git repository during the D-drive migration. The old frontend `.git` history could not be recovered after Windows partially moved hidden git files. Current frontend git history starts at `eef96fe`.

- Backend untracked is local editor state. DO NOT touch:
  ```
  ?? .vscode/
  ```

- Do NOT overwrite or delete: `D:\desklab\backend\data\default-project.json`
  (the owner's pre-2026-10-30 project; the frontend no longer reads it. To
  move it into the browser: in the app, 更多 → 导入 JSON, pick the file, then 保存项目.)
  Backend tests that touch runtime data should back it up and restore it, or use isolated test storage.

- Never claim browser/visual QA unless actually performed. If browser runtime fails, record the failure instead of pretending.

## Current Git State (2026-10-30 handoff)

### Frontend `D:\desklab\frontend`
- Feature HEAD on `master` at this merge: `28c0216 docs: record E13 results and pause E10`
- Since 2026-10-29 the product owner wants each verified slice pushed straight
  to `origin/master` (pull --rebase and re-verify first if the remote moved).
- Catalog devices render from `public/models/<modelId>.glb`. See
  "Catalog GLB models (2026-10-29)" below.
- Untracked: none expected.

Historical commits captured at the 2026-07-14 baseline (most recent first,
baseline at bottom):
```
4008b33 fix: make improvement patches idempotent
d36aecf fix: ignore missing improvement targets
f26c112 fix: validate stale connection ports
8f6ca7c fix: reject deleted connection endpoints
cc991f7 fix: reject stale connection port conflicts
97d60c3 fix: make automatic connections idempotent
51353a9 fix: reject malformed power roots
33eff79 fix: preserve independent power loads
206adcd fix: require rooted power paths
797fbdc fix: require powered auto power sources
89097cd fix: reapply changed free improvements
9d81dbc fix: require power for network capacity
72a9f2e feat: apply newly unlocked free improvements
9659963 fix: require switch power before uplink
a41e62c fix: reject WAN switch uplinks
bf82644 fix: exclude WAN ports from switch capacity
7530afe fix: count capacity across routers
97bfffe fix: count reachable switch capacity
f619fed fix: validate switch uplink direction
a8c0ef9 fix: preserve uplinks with spare router capacity
1bde233 feat: suggest switch uplinks
f08c985 fix: clarify full-router switch guidance
bbf0291 feat: guide switch purchases when router is full
436bb69 fix: include switch power step in guidance
77aa29f fix: require router uplink for network suggestions
7841a36 feat: guide wiring after hardware purchase
d7656ab fix: dedupe power graph connection ids
ae4d983 fix: count invalid connections accurately
0e50733 fix: apply unpowered purchase recommendations
3d39356 fix: apply display connection recommendations
373067b fix: flag duplicate connection ids
a163378 fix: reject blank connection port ids
a85b16a fix: ignore invalid connection occupancy
42177ce fix: flag self-referencing connections
2ff0bfc fix: dedupe occupied power graph ports
4831314 fix: exclude invalid links from power graph
1465637 fix: ignore invalid strip output capacity
96ab864 fix: skip invalid power input recommendations
cf36b14 fix: tolerate null recommendation state
f69fec0 fix: match LAN port ids case-insensitively
a90dab6 fix: filter invalid switch recommendations
bb3d27b fix: validate auto-network port directions
51f12ba fix: validate optional power metadata
cfd9581 fix: prevent clock rollback history grouping
26be343 fix: respect zero project history limit
b2db1ed fix: limit clipboard project imports
59597c1 test: require bounds layouts for generic catalog models
d8b3682 test: cover generic laptop layout bounds
0ac9589 test: cover generic all-in-one layout bounds
67d30cf fix: keep generic power strip within catalog bounds
7adc0db fix: keep generic ups within catalog bounds
257d1df fix: keep generic switch within catalog bounds
4770cb1 fix: keep generic router within catalog bounds
b74e570 fix: keep generic modem within catalog bounds
a6ad8cd fix: keep generic nas within catalog bounds
f6c4b16 fix: keep generic wall outlet within catalog bounds
6706f06 fix: keep generic power adapter within catalog bounds
c15e614 fix: keep generic mini pc within catalog bounds
fd1fa11 fix: preserve desktop pc scale behavior
2731fd0 fix: keep generic desktop pc within catalog bounds
525b695 test: cover generic monitor layout bounds
92d0eb7 test: cover generic gaming desk layout bounds
f2f10f4 test: cover generic office desk layout bounds
961ae2d test: cover generic standing desk layout bounds
60ca14c fix: keep generic l-desk within catalog bounds
f64d4e7 test: cover generic assets for catalog models
13d483d feat: add generic l-desk model asset
18ce68a feat: add generic standing desk model asset
e707b9c docs: record generic gaming desk asset slice
3a2e4d2 feat: add generic gaming desk model asset
412e176 docs: record generic office desk asset slice
9c94b59 feat: add generic office desk model asset
12735b8 docs: record generic all-in-one asset slice
53630cc feat: add generic all-in-one model asset
44eecb2 docs: record generic modem asset slice
23752a0 feat: add generic modem model asset
4b93b25 docs: record generic nas asset slice
dfceab9 feat: add generic two-bay nas model asset
e3189a0 docs: record generic laptop asset slice
2dfed7c feat: add generic laptop model asset
22f7f2e docs: record generic wall outlet asset slice
1aa312e feat: add generic wall outlet model asset
82ec3b8 docs: record generic power adapter asset slice
6451fcc feat: add generic power adapter model asset
6ecc6c0 docs: record generic mini pc asset slice
55b9ddb feat: add generic mini pc model asset
17a5ff0 docs: record generic desktop pc asset slice
4f4bd89 feat: add generic desktop pc model asset
3e3b2d7 docs: sync current DeskLab memory bank
c9fff49 feat: add generic ups model asset
6dcdd2f feat: add generic switch model asset
c979589 feat: add generic router model asset
1977ab1 feat: add generic power strip model asset
8521765 feat: add generic monitor model asset
114ed1b fix: pass inert as a boolean instead of an empty string
5d39e0f test: lock distinct default port anchors per catalog model
82463e4 refactor: route remaining power reads through shared helpers
87ffc32 test: lock buildRecommendations facade against malformed live state
f321ab7 refactor: use classifyPowerLoad in PropertiesEditor load badge
47c987e refactor: centralize power-load classification in a tested domain helper
41c57d1 fix: coerce wattage and maxLoad to numbers in power-load analysis
7c7bded fix: guard recommendation distance loops against missing positions
eef96fe chore: rebaseline frontend after D drive move
```
Power-load reads are fully centralized: an audit of `src/` for raw
`maxLoad ??` / `wattage ??` reads or inlined `> maxLoad * 0.9` thresholds is clean.

Catalog devices render from in-house GLB meshes in `public/models/` (merged
2026-10-29 as `1f10bfc`). The code-native generic shapes are the load fallback,
not the primary mesh. Details are in "Catalog GLB models (2026-10-29)".

Historical note: code-native generic assets were added for the catalog as it
stood in July 2026, including models later removed from the home catalog
(switch, UPS, NAS, modem, mini PC, all-in-one, and the extra desks). Those
removed models are no longer offered. A saved object of a removed model still
loads and draws as the plain box. The generic layouts that remain are still
checked by the catalog-driven bounds test.

### Runtime QA performed (2026-06-25, real, not faked)
- Booted both servers: backend `node server.js` (3001) + frontend `vite` (5173),
  both HTTP 200. Backend was already running once during the session (a duplicate
  start hit `EADDRINUSE` — harmless).
- Loaded the app via the Claude_Preview MCP. DOM mounts (`title=DeskLab`), and the
  UI header showed `布局检查 (2)`, `布线检查 (5)`, `改进建议 (6)` against the real
  `default-project.json` (7 objects, 2 connections) — i.e. the analysis +
  recommendation engine works end-to-end on real data.
- LIMITATION: `preview_screenshot` times out — the react-three-fiber WebGL canvas
  stays at default 300x150 in the headless preview (no GPU). DOM/console QA works;
  pixel screenshots of the 3D scene do not. Use a real browser for visual model QA.
- Console QA surfaced and fixed a real React 19 warning (`inert=""`); after the fix
  a fresh preview load reports zero console errors.
- Preview launch config lives at `D:\.claude\.claude\launch.json` (name
  `desklab-frontend`, runs `npm --prefix D:\desklab\frontend run dev`, port 5173,
  `autoPort:false`). It is outside both repos, so the "no untracked files"
  invariant for the frontend repo still holds.

### Generic monitor model asset slice (2026-06-26)
- Added a code-native, in-house, generic low-poly monitor render path for
  `monitor-24`, `monitor-27`, and `ultrawide-monitor`; no external meshes,
  scraped assets, logos, or branded silhouettes were introduced.
- `src/domain/model-assets.js` owns the lightweight generic asset registry.
  `SceneObjects.jsx` keeps GLB `assetUrl` rendering first, uses the generic
  monitor only when no external asset URL is present, and preserves the box
  fallback for unknown models.
- Added `test/model-assets.test.js` to lock the monitor asset mapping and
  unknown-model fallback behavior.
- Updated `public/models/ATTRIBUTION.md` with DeskLab-owned source notes for
  the code-native monitor.
- Verification: `node --test test\model-assets.test.js`, `npm test` (176
  passed), `npm run lint`, `npm run build`.
- Browser/visual QA: Browser plugin bootstrap failed in this Codex environment
  because the Node browser runtime reported missing sandbox metadata, so QA
  used local Chrome headless via DevTools Protocol against
  `http://127.0.0.1:5173/` with the local backend on `http://localhost:3001`.
  Desktop 1440x900 and mobile 390x844 loaded with no error overlay and no
  console errors; adding "24 英寸显示器" from the asset library selected
  `monitor-24` and showed the monitor in the canvas. Console warnings were
  limited to the existing `THREE.Clock` deprecation from Three/Drei.

### Generic power-strip model asset slice (2026-06-26)
- Added a code-native, in-house, generic low-poly power strip render path for
  `power-strip`; no external meshes, scraped assets, logos, or branded
  silhouettes were introduced.
- `src/domain/model-assets.js` now maps `power-strip` to
  `generic-power-strip`. `SceneObjects.jsx` renders a long body, top socket
  plate, six generic socket pairs, and an input end block while preserving GLB
  `assetUrl` priority and unknown-model box fallback.
- Expanded `test/model-assets.test.js` to lock the power-strip asset mapping.
- Updated `public/models/ATTRIBUTION.md` with DeskLab-owned source notes for
  the code-native power strip.
- Verification: `node --test test\model-assets.test.js`, `npm test` (177
  passed), `npm run lint`, `npm run build`.
- Browser/visual QA: Browser plugin bootstrap still failed because the Node
  browser runtime reported missing sandbox metadata, so QA used local Chrome
  headless via DevTools Protocol against `http://127.0.0.1:5173/` with the
  local backend on `http://localhost:3001`. Desktop 1440x900 and mobile 390x844
  loaded with no error overlay and no console errors; adding "插排" from the
  "电源" asset category selected `power-strip` and showed the model in the
  canvas. Console warnings were limited to the existing `THREE.Clock`
  deprecation from Three/Drei.

### Generic router model asset slice (2026-06-26)
- Added a code-native, in-house, generic low-poly router render path for
  `router`; no external meshes, scraped assets, logos, or branded silhouettes
  were introduced.
- `src/domain/model-assets.js` now maps `router` to `generic-router`.
  `SceneObjects.jsx` renders a compact router body, front network ports,
  two simple antennas, and a status light while preserving GLB `assetUrl`
  priority and unknown-model box fallback.
- Expanded `test/model-assets.test.js` to lock the router asset mapping.
- Updated `public/models/ATTRIBUTION.md` with DeskLab-owned source notes for
  the code-native router.
- Verification: `node --test test\model-assets.test.js`, `npm test` (178
  passed), `npm run lint`, `npm run build`.
- Browser/visual QA: after the same Browser plugin bootstrap failure already
  observed this session, QA used local Chrome headless via DevTools Protocol
  against `http://127.0.0.1:5173/` with the local backend on
  `http://localhost:3001`. Desktop 1440x900 and mobile 390x844 loaded with no
  error overlay and no console errors; adding "路由器" from the "网络" asset
  category selected `router` and showed the model in the canvas. Console
  warnings were limited to the existing `THREE.Clock` deprecation from
  Three/Drei.

### Generic switch model asset slice (2026-06-26)
- Added a code-native, in-house, generic low-poly network switch render path for
  `switch`; no external meshes, scraped assets, logos, or branded silhouettes
  were introduced.
- `src/domain/model-assets.js` now maps `switch` to `generic-switch`.
  `SceneObjects.jsx` renders a long switch body, dark front panel, eight
  generic Ethernet ports, and small status LEDs while preserving GLB `assetUrl`
  priority and unknown-model box fallback.
- Expanded `test/model-assets.test.js` to lock the switch asset mapping.
- Updated `public/models/ATTRIBUTION.md` with DeskLab-owned source notes for
  the code-native switch.
- Verification: `node --test test\model-assets.test.js`, `npm test` (179
  passed), `npm run lint`, `npm run build`.
- Browser/visual QA: using local Chrome headless via DevTools Protocol against
  `http://127.0.0.1:5173/` with the local backend on `http://localhost:3001`,
  desktop 1440x900 and mobile 390x844 loaded with no error overlay and no
  console errors; adding "交换机" from the "网络" asset category selected
  `switch` and showed the model in the canvas. Console warnings were limited
  to the existing `THREE.Clock` deprecation from Three/Drei.

### Generic UPS model asset slice (2026-06-26)
- Added a code-native, in-house, generic low-poly UPS render path for `ups`;
  no external meshes, scraped assets, logos, or branded silhouettes were
  introduced.
- `src/domain/model-assets.js` now maps `ups` to `generic-ups`.
  `SceneObjects.jsx` renders a vertical UPS body, front panel, display area,
  power button, status light, and vent slots while preserving GLB `assetUrl`
  priority and unknown-model box fallback.
- Expanded `test/model-assets.test.js` to lock the UPS asset mapping.
- Updated `public/models/ATTRIBUTION.md` with DeskLab-owned source notes for
  the code-native UPS.
- Verification: `node --test test\model-assets.test.js`, `npm test` (180
  passed), `npm run lint`, `npm run build`.
- Browser/visual QA: Browser plugin bootstrap still failed because the Node
  browser runtime reported missing sandbox metadata, so QA used local Chrome
  headless via DevTools Protocol against `http://127.0.0.1:5173/` with the
  local backend on `http://localhost:3001`. Desktop 1440x900 and mobile 390x844
  loaded with no error overlay and no console errors; adding "UPS" from the
  "电源" asset category selected `ups` and showed the model in the canvas.
  Console warnings were limited to the existing `THREE.Clock` deprecation from
  Three/Drei.

### Generic desktop PC model asset slice (2026-07-05)
- Added a code-native, in-house, generic low-poly tower PC render path for
  `desktop-pc`; no external meshes, scraped assets, logos, or branded
  silhouettes were introduced.
- `src/domain/model-assets.js` now maps `desktop-pc` to
  `generic-desktop-pc`. `SceneObjects.jsx` renders a tower body, inset front
  panel, fan vent, power button/status light, and two front ports while
  preserving GLB `assetUrl` priority and unknown-model box fallback.
- Expanded `test/model-assets.test.js` test-first to lock the desktop PC asset
  mapping. The focused test failed on the previous `null` mapping before the
  implementation and passed afterward.
- Updated `public/models/ATTRIBUTION.md` with DeskLab-owned source notes for
  the code-native desktop PC.
- Verification: `node --test test\model-assets.test.js` (7 passed), `npm test`
  (181 passed), `npm run lint`, `npm run build`. The existing large-chunk build
  warning remains non-fatal.
- Browser/visual QA: not completed. Both localhost services returned HTTP 200,
  but the Browser plugin bootstrap failed because the runtime request lacked
  required sandbox metadata (`sandboxPolicy`). No browser or visual QA is
  claimed.
- Commit: `4f4bd89 feat: add generic desktop pc model asset` (pushed to
  `origin/master`).

### Generic mini PC model asset slice (2026-07-05)
- Added a code-native, in-house, generic low-poly compact computer render path
  for `mini-pc`; no external meshes, scraped assets, logos, or branded
  silhouettes were introduced.
- `src/domain/model-assets.js` now maps `mini-pc` to `generic-mini-pc`.
  `SceneObjects.jsx` renders a low compact body, top vent, power button/status
  light, and two front ports while preserving GLB `assetUrl` priority and
  unknown-model box fallback.
- Expanded `test/model-assets.test.js` test-first to lock the mini PC mapping.
  The focused test failed on the previous `null` mapping before implementation
  and passed afterward.
- Updated `public/models/ATTRIBUTION.md` with DeskLab-owned source notes.
- Verification: `node --test test\model-assets.test.js` (8 passed), `npm test`
  (182 passed), `npm run lint`, `npm run build`. The existing large-chunk build
  warning remains non-fatal.
- Browser/visual QA: not completed. Both localhost services returned HTTP 200,
  but Browser bootstrap again failed because the runtime request lacked
  required sandbox metadata (`sandboxPolicy`). No browser or visual QA is
  claimed.
- Commit: `55b9ddb feat: add generic mini pc model asset` (pushed to
  `origin/master`).

### Generic power adapter model asset slice (2026-07-05)
- Added a code-native, in-house, generic low-poly AC-to-DC adapter render path
  for `power-adapter`; no external meshes, scraped assets, logos, or branded
  silhouettes were introduced.
- `src/domain/model-assets.js` now maps `power-adapter` to
  `generic-power-adapter`. `SceneObjects.jsx` renders a compact power brick,
  top label panel, two AC-side contacts, and a DC-side strain relief while
  preserving GLB `assetUrl` priority and unknown-model box fallback.
- Expanded `test/model-assets.test.js` test-first to lock the adapter mapping.
  The focused test failed on the previous `null` mapping before implementation
  and passed afterward.
- Updated `public/models/ATTRIBUTION.md` with DeskLab-owned source notes.
- Verification: `node --test test\model-assets.test.js` (9 passed), `npm test`
  (183 passed), `npm run lint`, `npm run build`. The existing large-chunk build
  warning remains non-fatal.
- Browser/visual QA: not completed. Both localhost services returned HTTP 200,
  but Browser bootstrap remained blocked by missing runtime sandbox metadata
  (`sandboxPolicy`). No browser or visual QA is claimed.
- Commit: `6451fcc feat: add generic power adapter model asset` (pushed to
  `origin/master`).

### Generic wall outlet model asset slice (2026-07-05)
- Added a code-native, in-house, generic low-poly dual wall outlet render path
  for `wall-outlet`; no external meshes, scraped assets, logos, or branded
  silhouettes were introduced.
- `src/domain/model-assets.js` now maps `wall-outlet` to
  `generic-wall-outlet`. `SceneObjects.jsx` renders a thin wall plate, inset
  faceplate, two outlet rows, and a center fastener while preserving existing
  wall-snap rotation, GLB `assetUrl` priority, and unknown-model box fallback.
- Expanded `test/model-assets.test.js` test-first to lock the outlet mapping.
  The focused test failed on the previous `null` mapping before implementation
  and passed afterward.
- Updated `public/models/ATTRIBUTION.md` with DeskLab-owned source notes.
- Verification: `node --test test\model-assets.test.js` (10 passed), `npm test`
  (184 passed), `npm run lint`, `npm run build`. The existing large-chunk build
  warning remains non-fatal.
- Browser/visual QA: not completed because the same Browser runtime
  `sandboxPolicy` metadata blocker remained active. No browser or visual QA is
  claimed.
- Commit: `1aa312e feat: add generic wall outlet model asset` (pushed to
  `origin/master`).

### Generic laptop model asset slice (2026-07-05)
- Added a code-native, in-house, generic low-poly open laptop render path for
  `laptop-15` when its catalog `assetUrl` is `null`.
- `src/domain/model-assets.js` maps `laptop-15` to `generic-laptop`.
  `SceneObjects.jsx` renders a thin base, keyboard deck, display bezel/screen,
  and hinge while preserving GLB `assetUrl` priority and box fallback.
- Expanded `test/model-assets.test.js` test-first; the focused test failed on
  the previous `null` mapping before implementation and passed afterward.
- Updated `public/models/ATTRIBUTION.md` with DeskLab-owned source notes while
  retaining the historical external-model attribution.
- Verification: `node --test test\model-assets.test.js` (11 passed), `npm test`
  (185 passed), `npm run lint`, `npm run build`. The existing large-chunk build
  warning remains non-fatal.
- Browser/visual QA: not completed because the Browser runtime remained blocked
  by missing `sandboxPolicy` metadata. No browser or visual QA is claimed.
- Commit: `2dfed7c feat: add generic laptop model asset` (pushed to
  `origin/master`).

### Generic two-bay NAS model asset slice (2026-07-05)
- Added a code-native, in-house, generic low-poly network storage render path
  for `nas-2bay`; no external meshes, logos, or branded silhouettes.
- `src/domain/model-assets.js` maps `nas-2bay` to `generic-nas-2bay`.
  `SceneObjects.jsx` renders an enclosure, inset front panel, two drive bays,
  bay handles, and status LEDs while preserving GLB priority and box fallback.
- Expanded `test/model-assets.test.js` test-first; the focused test failed on
  the previous `null` mapping before implementation and passed afterward.
- Updated `public/models/ATTRIBUTION.md` with DeskLab-owned source notes.
- Verification: focused tests 12/12; `npm test` 186/186; lint and build passed.
  The existing large-chunk warning remains non-fatal.
- Browser/visual QA: not completed because Browser bootstrap remained blocked
  by missing `sandboxPolicy` metadata. No browser or visual QA is claimed.
- Commit: `dfceab9 feat: add generic two-bay nas model asset` (pushed).

### Generic modem model asset slice (2026-07-05)
- Added a code-native, in-house, generic low-poly modem/network-terminal render
  path for `modem`; no external meshes, logos, or branded silhouettes.
- `src/domain/model-assets.js` maps `modem` to `generic-modem`.
  `SceneObjects.jsx` renders a low-profile body, status strip, four LEDs,
  network socket, and round power input while preserving GLB priority and box
  fallback.
- Expanded `test/model-assets.test.js` test-first; the focused test failed on
  the previous `null` mapping before implementation and passed afterward.
- Updated `public/models/ATTRIBUTION.md` with DeskLab-owned source notes.
- Verification: focused tests 13/13; `npm test` 187/187; lint and build passed.
  The existing large-chunk warning remains non-fatal.
- Browser/visual QA: not completed because Browser bootstrap remained blocked
  by missing `sandboxPolicy` metadata. No browser or visual QA is claimed.
- Commit: `23752a0 feat: add generic modem model asset` (pushed).

### Generic all-in-one model asset slice (2026-07-05)
- Added a code-native, in-house, generic low-poly integrated computer render
  path for `all-in-one`; no external meshes, logos, or branded silhouettes.
- `src/domain/model-assets.js` maps `all-in-one` to `generic-all-in-one`.
  `SceneObjects.jsx` renders the display, screen, lower chin, thick rear compute
  enclosure, stand, and base while preserving GLB priority and box fallback.
- Expanded `test/model-assets.test.js` test-first; the focused test failed on
  the previous `null` mapping before implementation and passed afterward.
- Updated `public/models/ATTRIBUTION.md` with DeskLab-owned source notes.
- Verification: focused tests 14/14; `npm test` 188/188; lint and build passed.
  The existing large-chunk warning remains non-fatal.
- Browser/visual QA: not completed because Browser bootstrap remained blocked
  by missing `sandboxPolicy` metadata. No browser or visual QA is claimed.
- Commit: `53630cc feat: add generic all-in-one model asset` (pushed).

### Generic office desk model asset slice (2026-07-05)
- Added a code-native, in-house, generic low-poly office desk render path for
  `office-desk`; no external meshes, logos, or branded silhouettes.
- `src/domain/model-assets.js` maps `office-desk` to `generic-office-desk`.
  `SceneObjects.jsx` renders a full desktop, four metal-style legs, and a rear
  cable tray while retaining the catalog dimensions used by support/collision
  logic and preserving GLB priority and box fallback.
- Expanded `test/model-assets.test.js` test-first; the focused test failed on
  the previous `null` mapping before implementation and passed afterward.
- Updated `public/models/ATTRIBUTION.md` with DeskLab-owned source notes.
- Verification: focused tests 15/15; `npm test` 189/189; lint and build passed.
  The existing large-chunk warning remains non-fatal.
- Browser/visual QA: not completed because Browser bootstrap remained blocked
  by missing `sandboxPolicy` metadata. No browser or visual QA is claimed.
- Commit: `9c94b59 feat: add generic office desk model asset` (pushed).

### Generic gaming desk model asset slice (2026-07-05)
- Added a code-native, in-house, generic low-poly gaming desk render path for
  `gaming-desk`; no external meshes, logos, or branded silhouettes.
- `src/domain/model-assets.js` maps `gaming-desk` to `generic-gaming-desk`.
  `SceneObjects.jsx` renders a wide desktop, angled legs, rear crossbar, and
  monitor shelf, all kept within the catalog bounding box while preserving GLB
  priority and box fallback.
- Expanded `test/model-assets.test.js` test-first; the focused test failed on
  the previous `null` mapping before implementation and passed afterward.
- Updated `public/models/ATTRIBUTION.md` with DeskLab-owned source notes.
- Verification: focused tests 16/16; `npm test` 190/190; lint and build passed.
  The existing large-chunk warning remains non-fatal.
- Browser/visual QA: not completed because Browser bootstrap remained blocked
  by missing `sandboxPolicy` metadata. No browser or visual QA is claimed.
- Commit: `3a2e4d2 feat: add generic gaming desk model asset` (pushed).


### Generic standing desk model asset slice (2026-07-13)
- Added a code-native, in-house, generic low-poly adjustable standing desk
  render path for `standing-desk`; no external meshes, logos, or branded
  silhouettes were introduced.
- `src/domain/model-assets.js` maps `standing-desk` to
  `generic-standing-desk`. `SceneObjects.jsx` renders a desktop, two lift
  columns, lower sleeves, feet, rear crossbar, and front control panel while
  preserving GLB priority and box fallback.
- Expanded `test/model-assets.test.js` test-first; the focused test failed on
  the previous `null` mapping before implementation and passed afterward.
- Updated `public/models/ATTRIBUTION.md` with DeskLab-owned source notes.
- Verification: focused `node --test test\model-assets.test.js` passed 17/17;
  `npm test` passed 191/191; `npm run lint` passed; `npm run build` passed
  after rerun with permission to write Vite's `node_modules\.vite-temp`, with
  the existing non-fatal large chunk warning.
- Runtime endpoint QA: `curl.exe -sS -I http://127.0.0.1:5173/` returned HTTP
  200, and `curl.exe -sS http://localhost:3001/api/projects/default` returned
  the default project JSON. No backend write/save was performed.
- Browser/visual QA: not completed in this handoff slice because the user
  explicitly disallowed Codex IAB, page screenshots, and Base64 image output;
  no browser or visual QA is claimed for this slice.
- Commit: `18ce68a feat: add generic standing desk model asset` (pushed).

### Generic L desk model asset slice (2026-07-13)
- Added a code-native, in-house, generic low-poly L-shaped desk render path for
  `l-desk`; no external meshes, logos, or branded silhouettes were introduced.
- `src/domain/model-assets.js` maps `l-desk` to `generic-l-desk`.
  `SceneObjects.jsx` renders intersecting desktop slabs, four legs, and rear
  cable trays while preserving GLB priority and box fallback.
- Expanded `test/model-assets.test.js` test-first; the focused test failed on
  the previous `null` mapping before implementation and passed afterward.
- Updated `public/models/ATTRIBUTION.md` with DeskLab-owned source notes.
- Verification: focused `node --test test\model-assets.test.js` passed 18/18;
  `npm test` passed 192/192; `npm run lint` passed; `npm run build` passed
  with the existing non-fatal large chunk warning.
- Runtime endpoint QA: `curl.exe -sS -I http://127.0.0.1:5173/` returned
  HTTP 200, and `curl.exe -sS http://localhost:3001/api/projects/default`
  returned the default project JSON. No backend write/save was performed.
- Browser/visual QA: not completed because the user explicitly disallowed
  Codex IAB, page screenshots, and Base64 image output; no browser or visual
  QA is claimed for this slice.
- Commit: `13d483d feat: add generic l-desk model asset` (pushed).

### Generic catalog asset coverage regression test (2026-07-13)
- Added a public-interface regression test in `test/model-assets.test.js` that
  enumerates every `DEVICE_CATALOG` model with `assetUrl: null` and requires a
  matching in-house generic asset with the same category and DeskLab-owned
  metadata.
- This prevents future catalog additions from silently falling back to an
  unstyled box while leaving external GLB-backed models unaffected.
- Verification: `node --test test\model-assets.test.js` passed 19/19;
  `npm test` passed 193/193; `npm run lint` passed; `npm run build` passed
  with the existing non-fatal large chunk warning.
- Browser/visual QA: not performed because the user explicitly disallowed
  Codex IAB, page screenshots, and Base64 image output.
- Commit: `f64d4e7 test: cover generic assets for catalog models` (pushed).

### Generic L desk geometry-bound regression fix (2026-07-13)
- Fixed a real L-desk rendering defect: the right desktop slab extended to
  normalized depth `0.54`, beyond the catalog footprint limit of `0.5`.
- Added `src/domain/generic-model-layouts.js` as the shared layout seam for the
  L-desk desktop slabs, legs, and cable trays. `SceneObjects.jsx` now renders
  from this layout instead of duplicating placement constants.
- Added `test/generic-model-layouts.test.js`; its public-interface assertion
  failed against the previous right-top position and passed after the slab was
  moved inside the footprint.
- Verification: focused geometry/model-asset tests passed 20/20; `npm test`
  passed 194/194; `npm run lint` passed; `npm run build` passed with the
  existing non-fatal large chunk warning.
- Runtime endpoint QA: frontend and local backend `curl` checks both returned
  HTTP 200. No backend write/save was performed.
- Browser/visual QA: not performed because the user explicitly disallowed
  Codex IAB, page screenshots, and Base64 image output.
- Commit: `60ca14c fix: keep generic l-desk within catalog bounds` (pushed).

### Generic standing desk geometry-bound regression test (2026-07-13)
- Added normalized shared layout data for the standing desk's top, lift columns,
  sleeves, feet, rear crossbar, and control panel in
  `src/domain/generic-model-layouts.js`.
- `SceneObjects.jsx` now renders those horizontal placements and dimensions from
  the shared layout, rather than maintaining a second set of geometry constants.
- Added a test-first public-interface assertion that the standing desk remains
  inside its catalog footprint. It failed before the standing-desk layout was
  registered and passed once the renderer consumed it.
- Verification: focused layout tests passed 2/2; `npm test` passed 195/195;
  `npm run lint` and `npm run build` passed with the existing non-fatal large
  chunk warning.
- Runtime endpoint QA: frontend and local backend `curl` checks returned HTTP
  200. No backend write/save was performed.
- Browser/visual QA: not performed because the user explicitly disallowed
  Codex IAB, page screenshots, and Base64 image output.
- Commit: `961ae2d test: cover generic standing desk layout bounds` (pushed).

### Generic office desk geometry-bound regression test (2026-07-13)
- Added normalized shared layout data for the office desk's desktop, four legs,
  and rear cable tray in `src/domain/generic-model-layouts.js`.
- `SceneObjects.jsx` now renders the office desk's horizontal placement and
  footprint dimensions from that shared layout, avoiding duplicate constants.
- Added a test-first public-interface assertion that the office desk remains
  inside its catalog footprint. It failed before the office-desk layout was
  registered and passed once the renderer consumed it.
- Verification: focused layout tests passed 3/3; `npm test` passed 196/196;
  `npm run lint` and `npm run build` passed with the existing non-fatal large
  chunk warning.
- Runtime endpoint QA: frontend and local backend `curl` checks returned HTTP
  200. No backend write/save was performed.
- Browser/visual QA: not performed because the user explicitly disallowed
  Codex IAB, page screenshots, and Base64 image output.
- Commit: `f2f10f4 test: cover generic office desk layout bounds` (pushed).

### Generic gaming desk geometry-bound regression test (2026-07-13)
- Added normalized shared layout data for the gaming desk's desktop, two angled
  legs, rear crossbar, and monitor shelf in `src/domain/generic-model-layouts.js`.
- `SceneObjects.jsx` now renders the gaming desk's horizontal placement,
  footprint dimensions, and leg rotation from the shared layout rather than
  duplicating constants.
- Added a test-first public-interface assertion that the gaming desk remains
  inside its catalog footprint. It failed before the gaming-desk layout was
  registered and passed once the renderer consumed it.
- Verification: focused layout tests passed 4/4; `npm test` passed 197/197;
  `npm run lint` and `npm run build` passed with the existing non-fatal large
  chunk warning.
- Runtime endpoint QA: frontend and local backend `curl` checks returned HTTP
  200. No backend write/save was performed.
- Browser/visual QA: not performed because the user explicitly disallowed
  Codex IAB, page screenshots, and Base64 image output.
- Commit: `92d0eb7 test: cover generic gaming desk layout bounds` (pushed).

### Generic monitor geometry-bound regression test (2026-07-13)
- Added one normalized shared layout for the monitor panel, screen, rear housing,
  stand, and base, mapped to `monitor-24`, `monitor-27`, and
  `ultrawide-monitor` in `src/domain/generic-model-layouts.js`.
- `GenericMonitorModel` now reads that layout through the object's real
  `modelId`, keeping the three catalog variants on the same render/test seam.
- Added a test-first public-interface assertion for all three monitor model ids.
  It failed before their shared layout was registered and passed once rendering
  consumed it.
- Verification: focused layout tests passed 5/5; `npm test` passed 198/198;
  `npm run lint` and `npm run build` passed with the existing non-fatal large
  chunk warning.
- Runtime endpoint QA: frontend and local backend `curl` checks returned HTTP
  200. No backend write/save was performed.
- Browser/visual QA: not performed because the user explicitly disallowed
  Codex IAB, page screenshots, and Base64 image output.
- Commit: `525b695 test: cover generic monitor layout bounds` (pushed).

### Generic desktop PC geometry-bound regression fix (2026-07-13)
- Added one normalized shared layout for the tower body, front panel, fan vent,
  power button, status light, and two front ports, mapped to `desktop-pc` in
  `src/domain/generic-model-layouts.js`.
- Added a test-first public-interface assertion for `desktop-pc`. It failed
  before the layout was registered and passed after rendering consumed it.
- Fixed a real catalog-footprint overflow: front details previously extended
  through normalized depth `0.51–0.60`; they now remain at or inside the front
  boundary (`z <= 0.5`). The status light uses independent X/Z scale so that
  its layout descriptor remains correct after non-uniform object resizing.
- Verification: focused layout tests passed 6/6; `npm test` passed 199/199;
  `npm run lint` and `npm run build` passed with the existing non-fatal large
  chunk warning.
- Runtime endpoint QA: frontend and local backend `curl` checks returned HTTP
  200. No backend write/save was performed.
- Browser/visual QA: not performed because the user explicitly disallowed
  Codex IAB, page screenshots, and Base64 image output.
- Commits: `2731fd0 fix: keep generic desktop pc within catalog bounds` and
  `fd1fa11 fix: preserve desktop pc scale behavior` (pushed).

### Generic mini PC geometry-bound regression fix (2026-07-13)
- Added one normalized shared layout for the compact body, top vent, power
  button, status light, and two front ports, mapped to `mini-pc` in
  `src/domain/generic-model-layouts.js`.
- Added a test-first public-interface assertion for `mini-pc`. It failed before
  the layout was registered and passed after rendering consumed it.
- Fixed a real catalog-footprint overflow: the front button, status light, and
  ports previously extended through normalized depth `0.51–0.55`; their visible
  geometry now remains inside the front boundary (`z <= 0.5`). Independent X/Z
  scale preserves the default silhouette and keeps the layout valid after
  non-uniform object resizing.
- Verification: focused layout tests passed 7/7; `npm test` passed 200/200;
  `npm run lint` and `npm run build` passed with the existing non-fatal large
  chunk warning.
- Runtime endpoint QA: frontend and local backend `curl` checks returned HTTP
  200. No backend write/save was performed.
- Browser/visual QA: not performed because the user explicitly disallowed
  Codex IAB, page screenshots, and Base64 image output.
- Commit: `c15e614 fix: keep generic mini pc within catalog bounds` (pushed).

### Generic power adapter geometry-bound regression fix (2026-07-13)
- Added one normalized shared layout for the adapter body, top label, two AC
  pins, and DC strain relief, mapped to `power-adapter` in
  `src/domain/generic-model-layouts.js`.
- Added a test-first public-interface assertion for `power-adapter`. It failed
  before the layout was registered and passed after rendering consumed it.
- Fixed real catalog-footprint overflows: AC pins previously extended to
  normalized depth `0.86` and the DC strain relief to `-0.73`; both now remain
  inside the `[-0.5, 0.5]` footprint. The strain-relief cylinder uses independent
  X/Z scale to preserve the default silhouette after non-uniform resizing.
- Verification: focused layout tests passed 8/8; `npm test` passed 201/201;
  `npm run lint` and `npm run build` passed with the existing non-fatal large
  chunk warning.
- Runtime endpoint QA: frontend and local backend `curl` checks returned HTTP
  200. No backend write/save was performed.
- Browser/visual QA: not performed because the user explicitly disallowed
  Codex IAB, page screenshots, and Base64 image output.
- Commit: `6706f06 fix: keep generic power adapter within catalog bounds`
  (pushed).

### Generic wall outlet geometry-bound regression fix (2026-07-13)
- Added one normalized shared layout for the outlet body, faceplate, four slots,
  and center fastener, mapped to `wall-outlet` in
  `src/domain/generic-model-layouts.js`.
- Added a test-first public-interface assertion for `wall-outlet`. It failed
  before the layout was registered and passed after rendering consumed it.
- Fixed real catalog-footprint overflows: the faceplate, slots, and fastener
  previously extended through normalized depth `0.56`, `0.60`, and `0.62`;
  all now remain inside the front boundary (`z <= 0.5`).
- Verification: focused layout tests passed 9/9; `npm test` passed 202/202;
  `npm run lint` and `npm run build` passed with the existing non-fatal large
  chunk warning. Local frontend and backend `curl` checks returned HTTP 200.
- Browser/visual QA: not performed because the user explicitly disallowed
  Codex IAB, page screenshots, and Base64 image output.
- Commit: `f6c4b16 fix: keep generic wall outlet within catalog bounds`
  (pushed).

### Generic NAS geometry-bound regression fix (2026-07-13)
- Added one normalized shared layout for the NAS body, front panel, two drive
  bays, drive handles, and status lights, mapped to `nas-2bay` in
  `src/domain/generic-model-layouts.js`.
- Added a public layout-bound assertion for `nas-2bay` and made rendering consume
  the same layout data.
- Fixed the front components' real normalized-depth overflow (up to `0.615`):
  panel, bays, handles, and lights now remain within `z <= 0.5`.
- Verification: focused layout tests 10/10; `npm test` 203/203; `npm run lint`
  and `npm run build` passed with the existing non-fatal large chunk warning;
  local frontend and backend `curl` checks returned HTTP 200.
- Browser/visual QA: not performed because the user explicitly disallowed
  Codex IAB, page screenshots, and Base64 image output.
- Commit: `a6ad8cd fix: keep generic nas within catalog bounds` (pushed).

### Generic modem geometry-bound regression fix (2026-07-13)
- Added a normalized shared layout for the modem body, top plate, status lights,
  and front ports, mapped to `modem`; front ports now remain at `z <= 0.5`.
- Test-first `modem` bounds assertion failed before registration and passed after.
- Verification: focused tests 11/11; `npm test` 204/204; lint, build, and local
  frontend/backend HTTP checks passed. Browser/visual QA was not performed.
- Commit: `b74e570 fix: keep generic modem within catalog bounds` (pushed).

### Generic router geometry-bound regression fix (2026-07-13)
- Added a normalized shared layout for the router body, four ports, antennas,
  and status light. The port centers moved from `z=0.51` to `z=0.46` so their
  visible geometry remains within the catalog footprint.
- Test-first `router` bounds assertion failed before layout registration and
  passed afterward. Verification: focused 12/12; `npm test` 205/205; lint,
  build, and local frontend/backend HTTP checks passed. Browser QA not performed.
- Commit: `4770cb1 fix: keep generic router within catalog bounds` (pushed).

### Generic switch geometry-bound regression fix (2026-07-14)
- Added one normalized shared layout for the switch body, front panel, eight
  ports, and status lights. The panel and ports moved to `z=0.46`, keeping
  their visible geometry within the catalog footprint.
- Test-first `switch` bounds assertion failed before layout registration and
  passed afterward. Verification: focused 13/13; `npm test` 206/206; lint,
  build, and local frontend/backend HTTP checks passed. Browser QA not performed.
- Commit: `257d1df fix: keep generic switch within catalog bounds` (pushed).

### Generic UPS geometry-bound regression fix (2026-07-14)
- Added normalized shared layout data for the UPS body, front panel, display,
  button, status light, and five vents. All front components now stay inside
  the catalog footprint.
- Test-first `ups` assertion failed before layout registration and passed after.
  Verification: focused 14/14; `npm test` 207/207; lint, build, and local
  frontend/backend HTTP checks passed. Browser QA not performed.
- Commit: `7adc0db fix: keep generic ups within catalog bounds` (pushed).

### Generic power strip geometry-bound regression fix (2026-07-14)
- Added normalized layout data for the strip body, top plate, six socket pairs,
  and input end. The input end moved from `x=-0.47,z=-0.52` to `x=-0.45,z=-0.42`,
  keeping its full visible geometry inside the footprint.
- Test-first `power-strip` assertion failed before registration and passed after.
  Verification: focused 15/15; `npm test` 208/208; lint, build, and local
  frontend/backend HTTP checks passed. Browser QA not performed.
- Commit: `67d30cf fix: keep generic power strip within catalog bounds` (pushed).

### Generic all-in-one layout coverage (2026-07-14)
- Added one shared normalized layout for the panel, screen, lower bezel, rear
  housing, stand, and base, mapped to `all-in-one`. Existing geometry remained
  within bounds; this slice makes that invariant executable and removes duplicate
  render constants.
- Test-first `all-in-one` bounds assertion failed before layout registration and
  passed after. Verification: focused 16/16; `npm test` 209/209; lint, build,
  and local frontend/backend HTTP checks passed. Browser QA not performed.
- Commit: `0ac9589 test: cover generic all-in-one layout bounds` (pushed).

### Generic laptop layout coverage (2026-07-14)
- Added one shared normalized layout for the laptop base, keyboard, lid, screen,
  and hinge, mapped to `laptop-15`; the existing in-bounds geometry is unchanged.
- Test-first `laptop-15` assertion failed before registration and passed after.
  Verification: focused 17/17; `npm test` 210/210; lint, build, and local
  frontend/backend HTTP checks passed. Browser QA not performed.
- Commit: `d8b3682 test: cover generic laptop layout bounds` (pushed).

### Generic catalog layout coverage guard (2026-07-14)
- Added one catalog-driven regression test requiring every `assetUrl: null`
  catalog model to have an in-bounds shared layout. This protects future catalog
  additions against silently bypassing geometry-bound coverage.
- Verification: focused 18/18; `npm test` 211/211; lint, build, and local
  frontend/backend HTTP checks passed. Browser QA not performed.
- Commit: `59597c1 test: require bounds layouts for generic catalog models`
  (pushed).

### Clipboard import size guard (2026-07-14)
- Added `project-import-limits.js` with the shared 5MB byte limit and UTF-8 text
  byte measurement. File and clipboard imports now use the same guard before
  JSON parsing or validation.
- This fixes the prior clipboard-only gap, where arbitrarily large text could be
  parsed before the backend's request-size protection applied.
- Verification: focused 2/2; `npm test` 213/213; lint, build, and local
  frontend/backend HTTP checks passed. Browser QA not performed.
- Commit: `b2db1ed fix: limit clipboard project imports` (pushed).

### Zero project-history limit guard (2026-07-14)
- Fixed a history-limit boundary bug: JavaScript `slice(-0)` retained every
  snapshot, so `limit: 0` unintentionally created unbounded undo history.
  Limits are now safely normalized and zero explicitly disables snapshots.
- Test-first regression coverage verifies zero history has neither undo nor redo.
- Verification: focused 6/6; `npm test` 214/214; lint, build, and local
  frontend/backend HTTP checks passed. Browser QA not performed.
- Commit: `26be343 fix: respect zero project history limit` (pushed).

### Project-history clock-rollback group guard (2026-07-14)
- Fixed a grouping boundary bug: a negative elapsed time from a system-clock
  rollback still satisfied the prior `< groupWindowMs` check, merging an
  independent operation into the previous undo group.
- Grouping now requires a non-decreasing timestamp as well as being within the
  configured time window. Test-first coverage confirms undo returns the second
  operation after a clock rollback.
- Verification: focused 7/7; `npm test` 215/215; lint, build, and local
  frontend/backend HTTP checks passed. Browser QA not performed.
- Commit: `cfd9581 fix: prevent clock rollback history grouping` (pushed).

### Optional power-metadata validation guard (2026-07-14)
- Closed a frontend/backend contract gap: the backend rejected invalid optional
  `wattage` and `maxLoad`, but shared frontend envelope validation accepted
  them, allowing bad data to survive load/import/draft recovery until save.
- The shared validator now accepts those fields only when absent, null, or a
  non-negative finite number. Regression coverage rejects string and negative
  values for both fields in a successful-looking project response.
- Verification: project-client 33/33; draft 18/18; `npm test` 216/216; lint,
  build, and local frontend/backend HTTP checks passed. Browser QA not performed.
- Commit: `51f12ba fix: validate optional power metadata` (pushed).

### Backend null port-anchor normalization guard (2026-07-14)
- Fixed a backend 500 path: `anchor: null` was explicitly accepted as an
  optional port value, but output normalization unconditionally read its
  coordinates and threw a `TypeError`.
- Normalization now preserves an explicit null anchor and still copies valid
  coordinate objects, keeping the output stable for ETag versioning.
- Verification: backend validate 22/22; `npm test` 31/31;
  `npm run check:contracts` passed. No browser or visual QA performed.
- Commit: backend `fd2eb33 fix: preserve null port anchors` (pushed).

### Nullable port-anchor contract alignment (2026-07-14)
- Aligned the JSON Schema and OpenAPI 3.1 Port schemas with the runtime and
  frontend behavior: optional `anchor` now explicitly accepts either a
  normalized vector or `null`.
- Updated the read-only contract checker to require both alternatives while
  retaining the normalized-vector range checks. The checker was red before
  the update and green afterward.
- Verification: `npm run check:contracts`; backend `npm test` 31/31. No
  browser or visual QA performed.
- Commit: backend `ddf4c1e contract: allow null port anchors` (pushed).

### OpenAPI power-metadata contract guard (2026-07-14)
- Added missing `wattage` and `maxLoad` fields (non-negative numbers) to the
  OpenAPI Object schema, matching the persisted JSON Schema and runtime
  validation.
- The read-only contract checker now requires both fields; it failed before
  the OpenAPI update and passed afterward.
- Verification: `npm run check:contracts`; backend `npm test` 31/31. No
  browser or visual QA performed.
- Commit: backend `2aa0943 contract: document power metadata in openapi`
  (pushed).

### Null optional model-metadata normalization guard (2026-07-14)
- Fixed a response-contract mismatch: compatibility validation accepted
  `category`, `modelId`, and `color` as null, then wrote those nulls back even
  though the formal schemas declare them optional strings.
- Normalization now omits null values for those metadata fields while retaining
  meaningful `assetUrl: null` values used by in-house generic models.
- Verification: backend validate 23/23; `npm test` 32/32;
  `npm run check:contracts` passed. No browser or visual QA performed.
- Commit: backend `9ecbcc9 fix: normalize null model metadata` (pushed).

### Auto-network direction guard (2026-07-14)
- Fixed invalid auto-network recommendations for custom/imported ethernet ports:
  the previous matching logic checked only type and occupancy, so an
  output-only device port could be suggested as a connection target.
- The suggestion now requires the device port to receive and the distributor
  port to provide network traffic, with the existing port-semantics guard on
  both ends. Regression coverage fails against the prior suggestion and passes
  after the change.
- Verification: recommendations 36/36; `npm test` 217/217; lint, build, and
  local frontend/backend HTTP checks passed. Browser QA not performed.
- Commit: `bb3d27b fix: validate auto-network port directions` (pushed).

### Switch purchase direction guard (2026-07-14)
- Fixed an invalid `buy_switch` purchase suggestion for custom/imported
  ethernet ports. The capacity calculation previously counted an output-only
  device uplink as an unconnected client port, which could recommend a switch
  even when no device could receive a LAN connection.
- Device ports now count only when they can receive network traffic; router LAN
  ports count only when they can provide it. Both paths reuse the existing
  port-semantics consistency guard.
- Regression coverage was added test-first: it fails against the prior logic
  for an output-only ethernet device and passes after the guard.
- Verification: recommendations 37/37; `npm test` 218/218; lint, build, and
  local frontend/backend HTTP checks passed. Browser QA not performed.
- Commit: `a90dab6 fix: filter invalid switch recommendations` (pushed).

### Case-insensitive LAN port recognition (2026-07-14)
- Fixed a false `buy_switch` purchase recommendation for custom/imported router
  ports such as `LAN-1`. LAN capacity recognition previously matched only a
  lower-case `lan` substring in the port id, treating that valid port as absent.
- Router LAN port ids now compare case-insensitively while retaining the
  existing ethernet type, output direction, and semantics checks.
- Regression coverage was added test-first and confirms a single custom
  `LAN-1` router port supplies capacity for one ethernet device.
- Verification: recommendations 38/38; `npm test` 219/219; lint, build, and
  local frontend/backend HTTP checks passed. Browser QA not performed.
- Commit: `f69fec0 fix: match LAN port ids case-insensitively` (pushed).

### Null recommendation-state guard (2026-07-14)
- Fixed a recommendation-panel crash when a transient project state supplied
  `null` for the project itself, `objects`, or `connections`. Default
  destructuring handles only `undefined`, so `null` previously reached wiring
  analysis and failed on an array operation.
- The facade now normalizes those two collections to empty arrays and safely
  destructures a nullable project, returning a stable empty recommendation set.
- Regression coverage confirms the facade remains safe for both forms of null
  live state.
- Verification: recommendations 38/38; `npm test` 219/219; lint, build, and
  local frontend/backend HTTP checks passed. Browser QA not performed.
- Commit: `cf36b14 fix: tolerate null recommendation state` (pushed).

### Invalid power-input recommendation guard (2026-07-14)
- Fixed a recommendation path that could generate an invalid connection for a
  custom AC/DC input port whose direction contradicted its power type. Wiring
  analysis correctly reported the malformed port, but the recommendation engine
  still offered automatic power connection or a power purchase; the generated
  auto-connection would then be rejected by backend validation.
- Auto-power and buy-power paths now skip semantically inconsistent target
  inputs, leaving the configuration error for the user to correct rather than
  proposing an impossible fix.
- Test-first coverage verifies that an `ac_input` marked as `output` receives
  neither a free auto-power nor a paid power recommendation.
- Verification: recommendations 39/39; `npm test` 220/220; lint, build, and
  local frontend/backend HTTP checks passed. Browser QA not performed.
- Commit: `96ab864 fix: skip invalid power input recommendations` (pushed).

### Invalid power-strip capacity guard (2026-07-14)
- Fixed a false `buy_power_strip` recommendation for a malformed AC output.
  The previous capacity calculation treated an `ac_output` with an input
  direction as a usable outlet when an invalid connection occupied it.
- Only directionally consistent AC outputs now contribute to power-strip
  capacity, so a configuration error does not look like a full valid strip.
- Test-first coverage uses an invalid occupied output and confirms no purchase
  suggestion is produced.
- Verification: recommendations 40/40; `npm test` 221/221; lint, build, and
  local frontend/backend HTTP checks passed. Browser QA not performed.
- Commit: `1465637 fix: ignore invalid strip output capacity` (pushed).

### Invalid power-graph edge guard (2026-07-14)
- Fixed false load, overload, and UPS-purchase analysis caused by the shared
  power graph accepting any AC/DC output-to-input link. It previously skipped
  the direction, port-compatibility, and cable-type checks already enforced by
  wiring analysis.
- The shared graph now includes only semantically valid power connections, so
  malformed directions, AC/DC type mismatches, and wrong cable types cannot
  inflate upstream electrical load.
- Test-first coverage verifies all three invalid-link classes contribute zero
  load while valid recursive load calculations remain unchanged.
- Verification: analysis 19/19; `npm test` 222/222; lint, build, and local
  frontend/backend HTTP checks passed. Browser QA not performed.
- Commit: `4831314 fix: exclude invalid links from power graph` (pushed).

### Duplicate power-port graph guard (2026-07-14)
- Fixed a remaining disagreement between the shared power graph and wiring
  analysis: two individually valid links could reuse one physical power port.
  Wiring analysis rejects the later link, but the graph previously counted both
  loads and could create a false overload/UPS purchase recommendation.
- The graph now mirrors the nested per-object port-occupancy rule and ignores
  later conflicting connections in their deterministic input order.
- Test-first coverage confirms a duplicate source outlet counts only the first
  300W load rather than both connected loads.
- Verification: analysis 20/20; `npm test` 223/223; lint, build, and local
  frontend/backend HTTP checks passed. Browser QA not performed.
- Commit: `2ff0bfc fix: dedupe occupied power graph ports` (pushed).

### Self-referencing wiring guard (2026-07-14)

- Problem: the backend contract rejects a connection whose two endpoints belong
  to the same object, but frontend wiring analysis treated one as valid. For a
  power connection this derived a misleading `power_cycle` issue and occupied
  ports instead of marking the corrupt connection for removal.
- Test-first regression: `test/analysis.test.js` now supplies one object with
  AC input/output ports joined by a self-reference; it must emit
  `self_connection`, must not emit `power_cycle`, and must expose the connection
  through `getInvalidConnectionIds`.
- Fix: `analyzeProjectWiring` now rejects same-object endpoints after confirming
  both referenced objects exist, emitting an error with `invalidConnectionIds`
  and skipping all subsequent semantic, occupancy, and power-graph work.
- Verification: focused test first red then green; `npm test` 224/224;
  `npm run lint`; `npm run build` (known non-fatal large-chunk warning only);
  local frontend `/` and backend `/api/projects/default` HTTP checks both 200.
  No browser or visual QA was performed.
- Commit: `42177ce fix: flag self-referencing connections` (pushed).

### Invalid recommendation-occupancy guard (2026-07-14)

- Problem: wiring analysis correctly excludes invalid links from port occupancy,
  but both recommendation builders independently counted every raw connection.
  A self-referencing invalid power link could therefore consume a usable source
  port, suppress `auto_power_device`, and create a false purchase suggestion.
- Test-first regression: `test/recommendations.test.js` creates an invalid
  self-link on a strip's AC output and a nearby unpowered device. The available
  output must still produce an auto-power fix and must prevent a paid-power
  recommendation.
- Fix: both free and purchase recommendation occupancy maps now derive a shared
  invalid-id set from `wiringIssues` and skip those connections. This preserves
  deterministic valid-link occupancy while matching analysis semantics.
- Verification: focused test first red then green; `npm test` 225/225;
  `npm run lint`; `npm run build` (known non-fatal large-chunk warning only);
  local frontend `/` and backend `/api/projects/default` HTTP checks both 200.
  No browser or visual QA was performed.
- Commit: `a85b16a fix: ignore invalid connection occupancy` (pushed).

### Blank connection-port guard (2026-07-14)

- Problem: `analyzeProjectWiring` used truthiness to detect endpoint ports, so
  explicit empty-string IDs were mislabeled as a legacy unbound connection.
  The frontend envelope and backend validator both reject those IDs.
- Test-first regression: an HDMI link with both port IDs set to `''` must emit
  `missing_connection_port`, not `legacy_connection`, and must be returned as
  invalid for cleanup/recommendation filtering.
- Fix: port-binding detection now matches validation semantics: a port field is
  present whenever it is neither `undefined` nor `null`; its non-blank validity
  is then checked through the ordinary endpoint lookup path.
- Verification: focused test first red then green; `npm test` 226/226;
  `npm run lint`; `npm run build` (known non-fatal large-chunk warning only);
  local frontend `/` and backend `/api/projects/default` HTTP checks both 200.
  No browser or visual QA was performed.
- Commit: `a163378 fix: reject blank connection port ids` (pushed).

### Duplicate connection-ID guard (2026-07-14)

- Problem: persisted projects reject duplicate connection IDs, but direct wiring
  analysis accepted distinct links that reused one ID when their ports differed.
- Test-first regression: two valid HDMI links with the same ID and different
  endpoint ports must report `duplicate_connection_id` and expose that ID as
  invalid.
- Fix: wiring analysis tracks connection IDs in input order and skips each
  later duplicate before it can affect occupancy or derived power analysis.
- Verification: focused test first red then green; `npm test` 227/227; lint,
  build (known non-fatal large-chunk warning), and local frontend/backend HTTP
  checks passed. No browser or visual QA was performed.
- Commit: `373067b fix: flag duplicate connection ids` (pushed).

### Display-recommendation UI action (2026-07-14)

- Problem: the recommendation engine created valid `auto_connect_display`
  patches (HDMI, DisplayPort, and USB-C) and the modal listed them, but the UI
  offered no action button. Users could not apply a displayed recommendation.
- Fix: `App.jsx` now renders a “连接显示器” button for that code and applies the
  existing tested patch through history, connection state, and a success notice,
  matching the power/network action paths.
- Verification: the existing recommendation tests cover generated and applied
  HDMI/USB-C display links; `npm test` 227/227; lint; build (known non-fatal
  large-chunk warning); local frontend/backend HTTP checks passed. No browser or
  visual QA was performed.
- Commit: `3d39356 fix: apply display connection recommendations` (pushed).

### Unpowered purchase-recommendation UI action (2026-07-14)

- Problem: `buy_power_for_unpowered` had no modal action despite carrying an
  explicit product choice (`power-strip` for AC or `ups` for DC).
- Fix: the recommendation now offers the matching existing add-item action and
  closes the modal, consistent with other purchase recommendations.
- Verification: `npm test` 227/227; lint; build (known non-fatal large-chunk
  warning); local frontend/backend HTTP checks passed. No browser or visual QA.
- Commit: `0e50733 fix: apply unpowered purchase recommendations` (pushed).

### Invalid-connection cleanup count (2026-07-14)

- Fixed cleanup confirmation/button/status counts to use the actual number of
  connection objects removed, rather than unique invalid IDs. This correctly
  reports two removals when a duplicate-ID conflict requires both records to go.
- Verification: `npm test` 227/227; lint; build (known non-fatal large-chunk
  warning); local frontend/backend HTTP checks passed. No browser or visual QA.
- Commit: `ae4d983 fix: count invalid connections accurately` (pushed).

### Duplicate power-graph connection-ID guard (2026-07-14)

- Fixed a remaining split between wiring analysis and the shared power graph:
  later connections that reused a connection ID could still inflate load totals.
- The graph now skips later duplicate IDs in deterministic input order, matching
  analysis and preventing false overload/UPS recommendations.
- Verification: test-first 600W→300W regression; `npm test` 228/228; lint;
  build (known non-fatal large-chunk warning); local frontend/backend HTTP
  checks passed. No browser or visual QA was performed.
- Commit: `d7656ab fix: dedupe power graph connection ids` (pushed).

### Post-purchase wiring guidance (2026-07-14)

- Problem: purchasing a recommended UPS, power strip, or switch only added the
  object and closed the recommendation modal. The new hardware was selected but
  the user received neither a safe connection order nor a direct route to the
  wiring tools.
- Test-first regression: `test/purchase-guidance.test.js` requires each of the
  three purchasable hardware models to expose a concrete, safe next step and
  requires unknown hardware to return no invented plan. The focused test first
  failed because the guidance module did not exist.
- Fix: `src/domain/purchase-guidance.js` owns the UPS, power-strip, and switch
  guidance. `App.jsx` preserves the recommendation modal after a hardware
  purchase, keeps the new device selected, displays the model-specific order,
  and offers “打开连接面板”. The action opens the selected device's connection
  tab; it deliberately creates no automatic links because the real source,
  uplink, and loads are user-specific physical decisions.
- Verification: focused test first red then green; `npm test` 230/230;
  `npm run lint`; `npm run build` (known non-fatal large-chunk warning only);
  local frontend `/` and backend `/api/projects/default` HTTP checks both 200.
  No browser or visual QA was performed.
- Commit: `7841a36 feat: guide wiring after hardware purchase` (pushed).

### Router-uplink network recommendation guard (2026-07-14)

- Problem: automatic network recommendations could attach a device to the
  nearest switch even when that switch had no valid Ethernet path to a router.
  A dual-port ordinary device could also accidentally make a switch appear
  reachable. Both cases create a cable that looks connected without providing
  actual network access.
- Test-first regressions verify that a disconnected switch and a switch reached
  only through a regular dual-port device are rejected, while a switch directly
  uplinked to a router remains eligible for downstream auto-connections.
- Fix: `recommendations.js` now builds router-originated Ethernet reachability
  from valid connections only. Reachability can propagate only through routers
  and switches; automatic network fixes may use a router or a reachable switch.
- Verification: focused recommendations tests 44/44; `npm test` 233/233;
  `npm run lint`; `npm run build` (known non-fatal large-chunk warning only);
  local frontend `/` and backend `/api/projects/default` HTTP checks both 200.
  No browser or visual QA was performed.
- Commit: `77aa29f fix: require router uplink for network suggestions` (pushed).

### Switch purchase guidance power step (2026-07-14)

- Fixed the switch post-purchase sequence so it now requires power first,
  router LAN uplink second, and downstream devices last. The previous wording
  omitted the switch's AC input and could leave an apparently wired but
  inoperative network segment.
- Test-first coverage updated the public guidance contract; it failed against
  the old sequence and passes with the corrected order.
- Verification: `npm test` 233/233; `npm run lint`; `npm run build` (known
  non-fatal large-chunk warning only); local frontend `/` and backend
  `/api/projects/default` HTTP checks both 200. No browser or visual QA was
  performed.
- Commit: `436bb69 fix: include switch power step in guidance` (pushed).

### Full-router switch migration guidance (2026-07-14)

- Problem: a switch purchase is still necessary when the router has zero free
  LAN ports, but the ordinary uplink instruction was impossible to follow.
- Fix: `buy_switch` now marks that LAN migration is required when no router LAN
  port is free. The post-purchase flow passes that fact to the guidance module,
  which instructs the user to power the switch, move one existing router client
  to it, use the freed LAN port for the uplink, then connect remaining devices.
- Test-first coverage verifies the recommendation context and the specialized
  public guidance contract.
- Verification: `npm test` 235/235; `npm run lint`; `npm run build` (known
  non-fatal large-chunk warning only); local frontend `/` and backend
  `/api/projects/default` HTTP checks both 200. No browser or visual QA was
  performed.
- Commit: `bbf0291 feat: guide switch purchases when router is full` (pushed).

### Full-router switch guidance clarification (2026-07-14)

- Fixed an unsafe implication in the full-router switch guide: an occupied LAN
  port may be an uplink rather than a movable endpoint. The sequence now asks
  the user to free a LAN port suitable for the new uplink and presents moving a
  normal endpoint to the switch as one optional way to do so.
- Test-first coverage updated the guidance contract; `npm test` 235/235, lint,
  build (known non-fatal large-chunk warning), and local frontend/backend HTTP
  checks all passed. No browser or visual QA was performed.
- Commit: `f08c985 fix: clarify full-router switch guidance` (pushed).

### Switch uplink action (2026-07-14)

- Added a free `auto_uplink_switch` recommendation and modal action that safely
  joins an unconnected switch to a free router LAN port. It is offered only when
  no ordinary endpoint is waiting for that same capacity, so “apply all” cannot
  create competing uses of a router port.
- Test-first coverage verifies the generated router-to-switch patch; full
  verification: `npm test` 236/236, lint, build (known non-fatal large-chunk
  warning), and local frontend/backend HTTP 200. No browser or visual QA.
- Commit: `1bde233 feat: suggest switch uplinks` (pushed).

### Reachable switch capacity guard (2026-07-14)

- Fixed `buy_switch` capacity planning so an arbitrary switch object no longer
  suppresses a purchase recommendation. Only free Ethernet output or
  bidirectional ports on switches with a valid router-originated path count as
  available downstream capacity.
- Regression coverage uses a portless, disconnected switch alongside more
  unconnected endpoints than the router can serve; the purchase recommendation
  must remain present.
- Verification: focused recommendations 48/48; `npm test` 238/238; `npm run
  lint`; `npm run build` (known non-fatal large-chunk warning only); local
  frontend `/` and backend `/api/projects/default` HTTP checks both 200. No
  browser or visual QA was performed.
- Commit: `97bfffe fix: count reachable switch capacity` (pushed).

### Multi-router capacity guard (2026-07-14)

- Fixed `buy_switch` planning to sum valid, unoccupied LAN capacity across all
  routers instead of considering only the first router in the object list.
  This avoids a false purchase recommendation when a later router can serve
  the remaining Ethernet endpoint.
- Test-first regression: the new test failed against the first-router-only
  logic and passes after the aggregate-capacity change.
- Verification: focused recommendations 49/49; `npm test` 239/239; `npm run
  lint`; `npm run build` (known non-fatal large-chunk warning only); local
  frontend `/` and backend `/api/projects/default` HTTP checks both 200. No
  browser or visual QA was performed.
- Commit: `7530afe fix: count capacity across routers` (pushed).

### WAN port capacity guard (2026-07-14)

- Fixed a mismatch between purchase planning and automatic network wiring:
  switch ports marked as `WAN` are intentionally not used as downstream
  network sources, so they no longer count as available switch capacity when
  deciding whether a switch purchase is needed.
- Test-first regression covers a router-uplinked switch whose only remaining
  Ethernet port is `WAN`; the prior calculation incorrectly suppressed the
  needed purchase recommendation.
- Verification: focused recommendations 50/50; `npm test` 240/240; `npm run
  lint`; `npm run build` (known non-fatal large-chunk warning only); local
  frontend `/` and backend `/api/projects/default` HTTP checks both 200. No
  browser or visual QA was performed.
- Commit: `bf82644 fix: exclude WAN ports from switch capacity` (pushed).

### WAN switch uplink guard (2026-07-14)

- Fixed the remaining WAN-port inconsistency: `auto_uplink_switch` could wire
  a router LAN port to a switch `WAN` port even though downstream automatic
  networking deliberately rejects that port. Such an action looked successful
  but could not deliver the capacity it promised.
- A shared WAN-port predicate now protects switch-uplink selection, automatic
  network source selection, and switch-capacity planning. Test-first coverage
  verifies that a switch whose only candidate port is `WAN` receives no uplink
  recommendation.
- Verification: focused recommendations 51/51; `npm test` 241/241; `npm run
  lint`; `npm run build` (known non-fatal large-chunk warning only); local
  frontend `/` and backend `/api/projects/default` HTTP checks both 200. No
  browser or visual QA was performed.
- Commit: `a41e62c fix: reject WAN switch uplinks` (pushed).

### Powered-switch uplink guard (2026-07-14)

- Fixed automatic switch uplinks that could be offered before a switch's valid
  AC/DC power input was connected. The previous text promised downstream
  network access even though an unpowered switch cannot forward traffic.
- `auto_uplink_switch` now waits only when a switch explicitly declares power
  inputs and all of them are unconnected through valid links. Devices with no
  modeled power input retain the existing behavior.
- Test-first regression verifies that an unpowered switch gets no uplink
  suggestion; the available power recommendation is therefore the required
  next step before the UI recomputes the uplink.
- Verification: focused recommendations 52/52; `npm test` 242/242; `npm run
  lint`; `npm run build` (known non-fatal large-chunk warning only); local
  frontend `/` and backend `/api/projects/default` HTTP checks both 200. No
  browser or visual QA was performed.
- Commit: `9659963 fix: require switch power before uplink` (pushed).

### Dependency-aware one-click free fixes (2026-07-14)

- Fixed the recommendation modal's “apply all free improvements” action so it
  no longer stops after the first static suggestion list. A prerequisite such
  as powering a switch can reveal a safe switch-uplink action only after it is
  applied.
- Added `applyAllAvailableImprovements(project)`: it recomputes free
  improvements after each pass and applies only suggestion IDs not already
  applied, which guarantees termination while allowing newly unlocked fixes to
  run in the same user action. The existing `applyAllImprovements` retains its
  original static-list semantics.
- Test-first regression proves a single action powers a switch and then adds
  its router uplink. The modal now uses this dependency-aware operation and
  reports that all available free improvements were applied.
- Verification: focused recommendations 53/53; `npm test` 243/243; `npm run
  lint`; `npm run build` (known non-fatal large-chunk warning only); local
  frontend `/` and backend `/api/projects/default` HTTP checks both 200. No
  browser or visual QA was performed.
- Commit: `72a9f2e feat: apply newly unlocked free improvements` (pushed).

### Powered network-capacity guard (2026-07-14)

- Fixed a topology bug where reachability traversal added every adjacent device
  to the router-reachable set before deciding whether that device could forward
  traffic. An Ethernet-uplinked but unpowered switch could consequently be
  used as an automatic network source and counted as capacity; an unpowered
  router could be used as a source as well.
- Router roots, forwarding switches, free router LAN capacity, and automatic
  uplink candidates now require a valid connected AC/DC input when one is
  modeled. Traversal records only operational routers and switches, so the same
  invariant drives auto-networking and switch-purchase capacity.
- Test-first regressions verify that an unpowered router is not a network
  source and an unpowered uplinked switch cannot suppress a needed switch
  recommendation.
- Verification: focused recommendations 55/55; `npm test` 245/245; `npm run
  lint`; `npm run build` (known non-fatal large-chunk warning only); local
  frontend `/` and backend `/api/projects/default` HTTP checks both 200. No
  browser or visual QA was performed.
- Commit: `9d81dbc fix: require power for network capacity` (pushed).

### Dynamic free-fix patch guard (2026-07-14)

- Fixed a second-pass correctness issue in `applyAllAvailableImprovements`.
  It previously deduplicated solely by suggestion ID. If an earlier layout fix
  changed the required cable length, the later `extend-cable:<id>` suggestion
  retained its ID and the updated patch was incorrectly skipped.
- Deduplication now keys on both suggestion ID and serialized patch content:
  identical work still terminates, while a genuinely updated corrective patch
  can run in a later pass.
- Test-first regression reproduces an off-wall outlet snap that increases an
  already-short power cable from a 0.79m to a 2.79m requirement; one-click
  free fixes now reapplies the cable adjustment and leaves no cable warning.
- Verification: focused recommendations 56/56; `npm test` 246/246; `npm run
  lint`; `npm run build` (known non-fatal large-chunk warning only); local
  frontend `/` and backend `/api/projects/default` HTTP checks both 200. No
  browser or visual QA was performed.
- Commit: `89097cd fix: reapply changed free improvements` (pushed).

### Powered-source supply guard (2026-07-14)

- Fixed automatic power recommendations and purchase suppression that treated an
  unplugged power strip, UPS, or adapter as a usable source merely because it
  exposed a free output port. This could wire a device to a dead upstream and
  then hide the power recommendation it still needed.
- Both `auto_power_device` and the `buy_power_for_unpowered` availability check
  now exclude any candidate that models AC/DC inputs but has none connected by
  a valid link. Wall outlets and other modeled root sources with no input stay
  eligible.
- Test-first regression verifies an unpowered strip neither powers a PC nor
  suppresses the PC's purchase recommendation. Existing positive tests now use
  explicit wall-outlet→strip/adapter supply links, preserving coverage for
  automatic AC/DC cabling, invalid occupancy, and free-port purchase handling.
- Verification: focused recommendations 57/57; `npm test` 247/247; `npm run
  lint`; `npm run build` (known non-fatal large-chunk warning only); local
  frontend `/` and backend `/api/projects/default` HTTP checks both 200. No
  browser or visual QA was performed.
- Commit: `797fbdc fix: require powered auto power sources` (pushed).

### Rooted power-path guard (2026-07-14)

- Hardened the powered-source check from direct input occupancy to a real path
  through `buildPowerGraph()`: sources are usable only when reachable from a
  modeled root source with no AC/DC input, over valid compatible power
  connections.
- An unpowered upstream strip or adapter can no longer make a downstream strip,
  router, or switch appear operational. The same powered set now gates automatic
  power cabling, purchase suppression, router LAN capacity, switch capacity,
  automatic switch uplinks, and automatic network connections.
- Test-first regressions cover a strip fed only by an unpowered upstream strip
  and a router fed by an unpowered adapter; both are excluded until a root power
  path exists. `buildRecommendations()` also shares its already-built power graph
  with free improvements.
- Verification: focused recommendations 58/58; `npm test` 248/248; `npm run
  lint`; `npm run build` (known non-fatal large-chunk warning only); local
  frontend `/` and backend `/api/projects/default` HTTP checks both 200. No
  browser or visual QA was performed.
- Commit: `206adcd fix: require rooted power paths` (pushed).

### Independent power-load guard (2026-07-14)

- Fixed an unrelated power-cycle fault suppressing all power-load calculations.
  Previously `computeDevicePowerLoad()` returned zero whenever the global power
  graph contained any cycle, hiding overloads on separate valid branches.
- Load traversal now cuts only a back edge on its active recursion path. Valid
  independent branches continue to contribute their known load, while cyclic
  paths still terminate safely without recursion.
- Test-first regression creates a separate two-device cycle beside a 300W hub
  branch and verifies the hub still reports 300W.
- Verification: focused analysis 25/25; `npm test` 249/249; `npm run lint`;
  `npm run build` (known non-fatal large-chunk warning only); local frontend `/`
  and backend `/api/projects/default` HTTP checks both 200. No browser or visual
  QA was performed.
- Commit: `33eff79 fix: preserve independent power loads` (pushed).

### Malformed power-root guard (2026-07-14)

- Hardened root-source detection: any device that declares an AC/DC input is
  now treated as needing an actual valid root-to-device path, even if that input
  has an invalid direction in malformed imported/live data.
- This prevents a broken power strip or adapter with an output port from being
  silently promoted to an independent supply source, which previously could
  auto-wire a PC to dead hardware and suppress its power purchase guidance.
- Test-first regression covers an AC-input port incorrectly declared as output;
  it cannot power a PC and cannot suppress the PC's purchase recommendation.
- Verification: focused recommendations 59/59; `npm test` 250/250; `npm run
  lint`; `npm run build` (known non-fatal large-chunk warning only); local
  frontend `/` and backend `/api/projects/default` HTTP checks both 200. No
  browser or visual QA was performed.
- Commit: `51353a9 fix: reject malformed power roots` (pushed).

### Automatic-connection idempotency guard (2026-07-14)

- Fixed `applyImprovement()` appending the same automatic connection patch more
  than once. A rapid double click or stale callback could previously create a
  duplicate connection ID, leaving a locally invalid project that the backend
  correctly rejects on save.
- The new-connection patch path now returns the existing project unchanged when
  its connection ID already exists, making automatic power, network, display,
  and switch-uplink applications safe to retry.
- Test-first regression applies a deterministic automatic power connection twice
  and verifies the second application is a no-op.
- Verification: focused recommendations 60/60; `npm test` 251/251; `npm run
  lint`; `npm run build` (known non-fatal large-chunk warning only); local
  frontend `/` and backend `/api/projects/default` HTTP checks both 200. No
  browser or visual QA was performed.
- Commit: `97d60c3 fix: make automatic connections idempotent` (pushed).

### Stale connection-port conflict guard (2026-07-14)

- Hardened automatic connection application beyond duplicate IDs: a stale
  recommendation is now also rejected when either of its physical endpoint
  ports has already been claimed by a newer connection with a different ID.
- This keeps a delayed/rapid UI action from creating duplicate port occupancy,
  matching the backend's connection contract before the project reaches save.
- Test-first regression reserves the outlet port through a newer connection,
  then verifies a stale automatic power patch is a no-op.
- Verification: focused recommendations 61/61; `npm test` 252/252; `npm run
  lint`; `npm run build` (known non-fatal large-chunk warning only); local
  frontend `/` and backend `/api/projects/default` HTTP checks both 200. No
  browser or visual QA was performed.
- Commit: `cc991f7 fix: reject stale connection port conflicts` (pushed).

### Deleted connection-endpoint guard (2026-07-14)

- Completed the stale automatic-connection safety boundary: before appending a
  generated connection, `applyImprovement()` now verifies that both referenced
  devices still exist in the current project.
- A delayed callback can no longer reintroduce a deleted device as a dangling
  connection reference and leave the local project unsavable by the backend.
  Duplicate IDs and occupied endpoint ports remain protected by the adjacent
  guards.
- Test-first regression removes the target device before applying its old power
  suggestion and verifies the operation is a no-op. Existing retry and occupied
  port tests now use present endpoints to retain their intended coverage.
- Verification: focused recommendations 62/62; `npm test` 253/253; `npm run
  lint`; `npm run build` (known non-fatal large-chunk warning only); local
  frontend `/` and backend `/api/projects/default` HTTP checks both 200. No new
  browser or visual QA was performed for this domain-only change.
- Commit: `8f6ca7c fix: reject deleted connection endpoints` (pushed).

### Stale connection-port validity guard (2026-07-14)

- Extended automatic-connection application to verify current port-level
  semantics before appending: both ports must still exist, have valid source/
  target directions and compatible types, and still imply the patch's cable
  type.
- A stale suggestion now becomes a no-op if a user deletes or reconfigures an
  endpoint port, instead of introducing a connection the backend would reject.
  This completes the stale-patch boundary across device existence, port
  existence/semantics, port occupancy, and duplicate connection IDs.
- Test-first regression removes the source power port while retaining both
  devices; the old power suggestion is rejected. Existing stale-ID and occupied
  port regressions now define valid endpoint ports to preserve their scope.
- Verification: focused recommendations 63/63; `npm test` 254/254; `npm run
  lint`; `npm run build` (known non-fatal large-chunk warning only); local
  frontend `/` and backend `/api/projects/default` HTTP checks both 200. No new
  browser or visual QA was performed for this domain-only change.
- Commit: `f26c112 fix: validate stale connection ports` (pushed).

### Missing improvement-target guard (2026-07-14)

- Completed the stale-patch no-op boundary for layout and cable patches. When a
  suggestion targets an object or connection that was deleted before the action
  runs, `applyImprovement()` now returns the exact existing project instead of
  allocating an unchanged project state.
- This keeps the domain operation as a strict no-op that callers can recognize;
  existing valid layout and cable applications still create immutable updates.
- Test-first regression covers both a deleted object layout patch and a deleted
  connection cable patch; each is a strict no-op.
- Verification: focused recommendations 64/64; `npm test` 255/255; `npm run
  lint`; `npm run build` (known non-fatal large-chunk warning only); local
  frontend `/` and backend `/api/projects/default` HTTP checks both 200. No new
  browser or visual QA was performed for this domain-only change.
- Commit: `d36aecf fix: ignore missing improvement targets` (pushed).

### Repeated improvement-patch guard (2026-07-14)

- Made existing-target layout and cable patches idempotent as well. If the
  suggested position/rotation or cable length is already present,
  `applyImprovement()` returns the exact project instead of allocating an
  indistinguishable new state.
- This closes the repeat-action boundary across layout, cable length, and
  automatic connections, avoiding unnecessary downstream state work while
  preserving immutable updates for real changes.
- Test-first regression verifies repeated layout and cable patches are strict
  no-ops.
- Verification: focused recommendations 65/65; `npm test` 256/256; `npm run
  lint`; `npm run build` (known non-fatal large-chunk warning only); local
  frontend `/` and backend `/api/projects/default` HTTP checks both 200. No new
  browser or visual QA was performed for this domain-only change.
- Commit: `4008b33 fix: make improvement patches idempotent` (pushed).

### Case-insensitive WAN port recognition (2026-07-14)

- Fixed custom/imported switch ports whose ID used uppercase `WAN` while their
  display name did not contain WAN. The shared predicate previously compared
  only the ID's exact lowercase spelling, so such a port could be offered for
  automatic switch uplink and counted as downstream network capacity.
- WAN port IDs now compare case-insensitively, matching the existing port-name
  behavior and the router LAN ID handling. Test-first coverage confirms an
  uppercase `WAN` ID named `Internet` cannot receive an automatic uplink.
- Verification: focused regression failed before the fix and passed afterward;
  `npm test` 257/257; `npm run lint`; `npm run build` (known non-fatal
  large-chunk warning only); local frontend `/` and backend
  `/api/projects/default` HTTP checks both 200. No browser or visual QA was
  performed for this domain-only change.
- Commit: `3515306 fix: match WAN port ids case-insensitively` (pushed).

### Invalid connection-length analysis guard (2026-07-14)

- Aligned live wiring analysis with the persisted project contract for cable
  lengths. Connections with a missing, non-finite, zero, or negative length are
  now reported as `invalid_connection_length`, exposed for invalid-connection
  cleanup, and skipped before physical ports are occupied.
- The shared power graph now excludes the same malformed connections, preventing
  them from creating false powered paths, load totals, overload warnings, or
  purchase suggestions. Recommendation test fixtures that represented valid
  topology were updated with explicit positive lengths.
- Test-first regressions failed against both prior behaviors: analysis did not
  report the invalid connection, and a zero-length power link contributed a
  false 300W load. Both passed after the guards were added.
- Verification: focused analysis regressions passed; `npm test` 259/259;
  `npm run lint`; `npm run build` (known non-fatal large-chunk warning only);
  local frontend `/` and backend `/api/projects/default` HTTP checks both 200.
  No browser or visual QA was performed for this domain-only change.
- Commit: `dc0a188 fix: reject invalid connection lengths in analysis` (pushed).

### Blank connection-ID analysis guard (2026-07-15)

- Aligned live wiring analysis with the persisted project contract for
  connection IDs. Missing, empty, and whitespace-only IDs are now reported as
  `invalid_connection_id`, retain their raw value for cleanup filtering, and
  are skipped before endpoint occupancy or topology analysis.
- The shared power graph applies the same non-blank ID requirement, preventing
  malformed power links from creating false powered paths, load totals,
  overload warnings, or purchase suggestions.
- Test-first regressions failed against both prior behaviors: analysis omitted
  the invalid-ID error and treated the target as powered, while the shared graph
  counted a 300W load across a whitespace-ID connection. Both passed after the
  guards were added.
- Verification: focused analysis regressions passed; `npm test` 261/261;
  `npm run lint`; `npm run build` (known non-fatal large-chunk warning only);
  local frontend `/` and backend `/api/projects/default` HTTP checks both 200.
  No browser or visual QA was performed for this domain-only change.
- Commit: `546722d fix: reject blank connection ids in analysis` (pushed).

### Blank connection-name analysis guard (2026-07-15)

- Aligned live wiring analysis with the persisted project contract for
  connection names. Missing, empty, and whitespace-only names are now reported
  as `invalid_connection_name` and skipped before endpoint occupancy or
  topology analysis, so an unsavable link cannot hide an unpowered port.
- The shared power graph applies the same non-blank name requirement, preventing
  malformed power links from creating false powered paths, load totals,
  overload warnings, or purchase suggestions.
- Test-first regressions failed against both prior behaviors: analysis omitted
  the invalid-name error and treated the target as powered, while the shared
  graph counted a 300W load across a whitespace-name connection. Both passed
  after the guards were added. Existing recommendation fixtures that model
  valid topology now carry explicit non-blank connection names.
- Verification: focused analysis regressions passed; `npm test` 263/263;
  `npm run lint`; `npm run build` (known non-fatal large-chunk warning only);
  local frontend `/` and backend `/api/projects/default` HTTP checks both 200;
  `git diff --check` passed. No browser or visual QA was performed for this
  domain-only change.
- Commit: `617e6b0 fix: reject blank connection names in analysis` (pushed).

### Unknown connection cable-type analysis guard (2026-07-15)

- Aligned live wiring analysis with the persisted cable-type enum. A legacy
  center-to-center connection with a missing or unknown `cableType` previously
  received only the informational `legacy_connection` issue even though project
  loading and the backend reject it.
- Unsupported values now produce the cleanup-eligible
  `invalid_connection_cable_type` error before legacy or port-level analysis.
  Valid legacy connections remain informational, while valid cable types that
  mismatch bound ports retain the existing `cable_type_mismatch` behavior.
- The public-interface regression was confirmed RED because analysis omitted the
  invalid-type error, then GREEN after reusing the shared `CABLE_TYPE_VALUES`
  contract in analysis.
- Verification: focused regression passed; complete analysis tests 32/32;
  `npm test` 264/264; `npm run lint`; `npm run build` (known non-fatal
  large-chunk warning only); local frontend `/` and backend
  `/api/projects/default` HTTP checks both 200; `git diff --check` passed. No
  browser or visual QA was performed for this domain-only change.
- Commit: `64cd92f fix: reject unknown cable types in analysis` (pushed).

### Unsupported port-direction analysis guard (2026-07-15)

- Aligned live wiring analysis with the persisted port-direction enum. An
  unused non-power port whose direction was outside `input`, `output`, and
  `bidirectional` previously produced no issue even though project loading and
  the backend reject the object.
- Every port is now checked independently of connection occupancy. Unsupported
  directions produce the object-level `invalid_port_direction_definition`
  error, so malformed imported/live data has a visible device-scoped diagnosis.
  Existing valid-enum directions that contradict AC/DC port types retain the
  more specific `invalid_power_port_definition` behavior.
- The public-interface regression was confirmed RED with an unused HDMI port
  using `sideways`, then GREEN after the enum guard was added.
- Verification: focused regression passed; complete analysis tests 33/33;
  `npm test` 265/265; `npm run lint`; `npm run build` (known non-fatal
  large-chunk warning only); local frontend `/` and backend
  `/api/projects/default` HTTP checks both 200; `git diff --check` passed. No
  browser or visual QA was performed for this domain-only change.
- Commit: `390cd15 fix: report unsupported port directions` (pushed).

### Duplicate port-ID ambiguity guard (2026-07-15)

- Aligned live wiring analysis with the persisted per-device port-ID uniqueness
  contract. Duplicate IDs previously produced no object-level issue, and port
  lookup silently selected the first match when a connection referenced the
  ambiguous ID.
- Analysis now indexes duplicate port IDs once per device and reports one
  `duplicate_port_id_definition` error per duplicated value, including when the
  ports are unused. Connections that reference an ambiguous endpoint produce
  the cleanup-eligible `ambiguous_connection_port` error and stop before port
  occupancy or topology analysis.
- The shared power graph applies the same ambiguity guard, preventing malformed
  devices from creating false powered paths, load totals, overload warnings, or
  downstream purchase suggestions.
- Three public-interface TDD cycles were confirmed RED then GREEN: unused
  duplicates lacked a device error; an ambiguous connection hid an unpowered
  target; and the standalone power graph counted a false 300W load.
- Verification: focused regressions passed; complete analysis tests 36/36;
  `npm test` 268/268; `npm run lint`; `npm run build` (known non-fatal
  large-chunk warning only); local frontend `/` and backend
  `/api/projects/default` HTTP checks both 200; `git diff --check` passed. No
  browser or visual QA was performed for this domain-only change.
- Commit: `0eeb79c fix: reject duplicate port id ambiguity` (pushed).

### Duplicate object-ID ambiguity guard (2026-07-15)

- Aligned live wiring analysis with the persisted project-wide object-ID
  uniqueness contract. Duplicate device IDs previously produced no analysis
  issue, and `Map` construction silently selected the last matching object when
  resolving connection endpoints.
- Analysis now reports one `duplicate_object_id_definition` error per duplicated
  value, including when the devices are unused. Connections that reference an
  ambiguous device produce the cleanup-eligible `ambiguous_connection_object`
  error and stop before self-reference, port occupancy, or topology analysis.
- The shared power graph applies the same ambiguity guard, preventing array
  ordering from creating false powered paths, load totals, overload warnings,
  or downstream purchase suggestions.
- Three public-interface TDD cycles were confirmed RED then GREEN: unused
  duplicates lacked an object error; an ambiguous connection hid an unpowered
  target; and the standalone power graph counted a false 300W load. The GREEN
  refactor then consolidated object and port duplicate scans into the shared
  internal `getDuplicateIds` helper.
- Verification: focused regressions passed; complete analysis tests 39/39;
  `npm test` 271/271; `npm run lint`; `npm run build` (known non-fatal
  large-chunk warning only); local frontend `/` and backend
  `/api/projects/default` HTTP checks both 200; `git diff --check` passed. No
  browser or visual QA was performed for this domain-only change.
- Commit: `a1b93f9 fix: reject duplicate object id ambiguity` (pushed).

### Blank object and endpoint-ID analysis guard (2026-07-15)

- Aligned live wiring analysis with the persisted non-blank object-ID contract.
  A device whose ID was missing, empty, or whitespace-only previously produced
  no object-level analysis issue.
- Invalid device IDs now produce `invalid_object_id_definition`, including when
  the device is unused. Connections whose `fromObjectId` or `toObjectId` is not
  a non-blank string produce the cleanup-eligible
  `invalid_connection_object_id` error before object lookup, port occupancy, or
  topology analysis.
- The shared power graph applies the same endpoint-ID guard, preventing invalid
  object keys from creating false powered paths, load totals, overload warnings,
  or downstream purchase suggestions.
- Three public-interface TDD cycles were confirmed RED then GREEN: an unused
  whitespace-ID device lacked an error; a connection to that device hid an
  unpowered target; and the standalone power graph counted a false 300W load.
- Verification: focused regressions passed; complete analysis tests 42/42;
  `npm test` 274/274; `npm run lint`; `npm run build` (known non-fatal
  large-chunk warning only); local frontend `/` and backend
  `/api/projects/default` HTTP checks both 200; `git diff --check` passed. No
  browser or visual QA was performed for this domain-only change.
- Commit: `398eb00 fix: reject blank object ids in analysis` (pushed).

### Blank port and endpoint-ID analysis guard (2026-07-15)

- Aligned live wiring analysis with the persisted non-blank port-ID contract.
  A device port whose ID was missing, empty, or whitespace-only previously
  produced no object-level issue when the port was unused.
- Invalid device port IDs now produce `invalid_port_id_definition`.
  Port-bound connections whose `fromPortId` or `toPortId` is not a non-blank
  string produce the cleanup-eligible `invalid_connection_port_id` error
  before endpoint lookup, occupancy, or topology analysis. Explicit blank IDs
  are no longer mislabeled as missing referenced ports.
- The shared power graph applies the same endpoint-ID guard, preventing an
  invalid port key that happens to exist in transient data from creating false
  powered paths, load totals, overload warnings, or downstream purchase
  suggestions.
- Three public-interface TDD cycles were confirmed RED then GREEN: an unused
  whitespace-ID port lacked an object error; a connection through that port hid
  an unpowered target; and the standalone power graph counted a false 300W load.
- Verification: focused regressions passed; complete analysis tests 45/45;
  `npm test` 277/277; `npm run lint`; `npm run build` (known non-fatal
  large-chunk warning only); local frontend `/` and backend
  `/api/projects/default` HTTP checks both 200; `git diff --check` passed. No
  browser or visual QA was performed for this domain-only change.
- Commit: `a82119c fix: reject blank port ids in analysis` (pushed).

### Blank port-type analysis guard (2026-07-15)

- Aligned live wiring analysis with the persisted non-blank port-type contract.
  An unused port whose `type` was missing, empty, or whitespace-only previously
  produced no device-level issue.
- Invalid port types now produce `invalid_port_type_definition`. A port-bound
  connection whose resolved endpoint has a blank type produces the
  cleanup-eligible `invalid_connection_port_type` error before compatibility,
  cable inference, occupancy, or topology analysis.
- This closes a concrete semantic bypass: two whitespace-only types were
  previously considered equal by the compatibility helper and could form an
  apparently valid `other` connection. Non-blank custom and future port types
  remain supported through the existing `other` cable behavior.
- Two public-interface TDD cycles were confirmed RED then GREEN: an unused
  whitespace-type port lacked an object error, and a connection between two
  whitespace-type ports was absent from the invalid-connection cleanup set.
- Verification: focused regressions passed; complete analysis tests 47/47;
  `npm test` 279/279; `npm run lint`; `npm run build` (known non-fatal
  large-chunk warning only); local frontend `/` and backend
  `/api/projects/default` HTTP checks both 200; `git diff --check` passed. No
  browser or visual QA was performed for this domain-only change.
- Commit: `9504542 fix: reject blank port types in analysis` (pushed).

### Blank port-name analysis guard (2026-07-15)

- Aligned live wiring analysis with the persisted non-blank port-name contract.
  An unused port whose display name was missing, empty, or whitespace-only
  previously produced no issue, leaving an unsavable device with a blank label
  in connection controls and diagnostics.
- Invalid names now produce the device-level `invalid_port_name_definition`
  error and identify the affected port by its stable ID. Existing connections
  are not marked for deletion because a display-name defect does not invalidate
  their endpoint IDs, directions, types, occupancy, or topology.
- The public-interface regression was confirmed RED because the blank-name port
  had no error, then GREEN after adding the focused definition guard.
- Verification: focused regression passed; complete analysis tests 48/48;
  `npm test` 280/280; `npm run lint`; `npm run build` (known non-fatal
  large-chunk warning only); local frontend `/` and backend
  `/api/projects/default` HTTP checks both 200; `git diff --check` passed. No
  browser or visual QA was performed for this domain-only change.
- Commit: `400fc34 fix: report blank port names in analysis` (pushed).

### Malformed live port-data guard (2026-07-15)

- Fixed a recommendation-panel crash caused by transient devices whose `ports`
  value was a non-array collection or whose port array contained `null`.
  `buildRecommendations()` previously failed while analysis scanned duplicate
  port IDs, and the recommendation builders had independent unsafe port loops.
- Added the shared `getPortRecords()` seam. Wiring analysis, the power graph,
  recommendation generation, and stale-patch validation now treat non-array
  collections as empty and ignore non-object port entries. Analysis still
  reports array entries without a usable port record through the existing
  `invalid_port_id_definition` diagnostic.
- One public-interface TDD cycle was confirmed RED then GREEN:
  `buildRecommendations()` threw `TypeError: items is not iterable` for a
  project containing both `ports: {}` and `ports: [null]`, then returned a
  stable empty result without inventing recommendations.
- Verification: focused regression passed; `npm test` 281/281; `npm run lint`;
  `npm run build` (known non-fatal large-chunk warning only); local frontend
  `/` and backend `/api/projects/default` HTTP checks both 200;
  `git diff --check` passed. No browser or visual QA was performed.
- Commit: `5672c1b fix: tolerate malformed live port data` (pushed).

### Malformed port endpoint-lookup guard (2026-07-15)

- Closed the remaining malformed-port crash after the shared collection guard.
  Wiring analysis and recommendations already filtered non-object port entries,
  but cable endpoint positioning still called `object.ports.find()` directly.
  A valid connection whose endpoint arrays began with `null` therefore threw
  while calculating cable length.
- `getPortWorldPosition()` now resolves endpoint ports through the existing
  `getPortRecords()` seam. Malformed entries retain their device-level
  `invalid_port_id_definition` diagnostics, while a valid later port remains
  connected, is not marked for cleanup, and still occupies its power input.
- One public-interface TDD cycle was confirmed RED then GREEN:
  `analyzeProjectWiring()` first threw while reading `candidate.id`, then
  successfully analyzed the same connection after the endpoint lookup change.
- Verification: focused regression passed; `npm test` 282/282; `npm run lint`;
  `npm run build` (known non-fatal large-chunk warning only); local frontend
  `/` and backend `/api/projects/default` HTTP checks both 200;
  `git diff --check` passed. No browser or visual QA was performed.
- Commit: `57bbb0e fix: ignore malformed ports in endpoint lookup` (pushed).

### Malformed live object/connection collection guard (2026-07-15)

- Problem: the public live-insight APIs assumed every `objects` and
  `connections` array entry was record-shaped. A transient `null` entry
  crashed wiring analysis while primitives and arrays could create ghost
  diagnostics or recommendations from `id === undefined`.
- Test-first regression: one App-shaped public behavior test mixes `null`,
  `undefined`, primitives, and array records with a valid floating object.
  It first failed with `TypeError` at `analyzeProjectWiring()`, then verified
  every exported analysis/recommendation entry point ignores non-record items
  without hiding the valid `drop_to_support` suggestion.
- Fix: added the dependency-free `getRecordItems()` collection seam and used
  it at the wiring analysis, power graph, layout analysis, free-improvement,
  purchase-suggestion, and recommendation-facade boundaries. Plain mid-edit
  records still flow into the existing field-level diagnostics.
- Verification: focused regression RED 0/1 then GREEN 1/1; `npm test`
  283/283; `npm run lint`; `npm run build` (known non-fatal large-chunk
  warning only); local frontend `/` and backend `/api/projects/default`
  HTTP checks both 200; `git diff --check` passed. No browser or visual QA
  was performed.
- Commit: `a81852b fix: ignore non-record live insight entries` (pushed).

### Invalid port-anchor live-analysis guard (2026-07-15)

- Problem: frontend/backend persistence validation and both formal schemas
  require every explicit port anchor to contain finite x/y/z values within
  `[-0.5, 0.5]`, but live wiring analysis silently accepted malformed or
  out-of-range anchors. Endpoint geometry then fell back to the device center,
  which could hide unsavable port data and produce misleading cable lengths.
- Test-first regression: an unused HDMI output with `anchor.x = 0.75` must
  produce one device-level `invalid_port_anchor_definition` error without
  marking any connection for cleanup. The focused public test first returned
  no diagnostic (RED 0/1), then passed GREEN 1/1.
- Fix: `project-validation.js` now exports the complete
  `isValidPortAnchor()` contract, including the valid missing/null cases.
  Wiring analysis reuses that seam for its explicit diagnostic rather than
  duplicating coordinate/range rules; existing topology and unpowered-input
  behavior remain unchanged.
- Verification: `npm test` 284/284; `npm run lint`; `npm run build` (known
  non-fatal large-chunk warning only); local frontend `/` and backend
  `/api/projects/default` HTTP checks both 200; `git diff --check` passed.
  No browser or visual QA was performed.
- Commit: `13a23b0 fix: report invalid port anchors` (pushed).

### Non-array live port-collection diagnostic (2026-07-15)

- Problem: the persisted project contract allows `ports` to be missing, `null`,
  or an array, but live wiring analysis silently converted record, string, and
  number values to an empty collection. That hid both the unsavable definition
  and every real wiring need carried by the affected device.
- Test-first regression: one public `analyzeProjectWiring()` behavior test uses
  three unused devices with `{}`, string, and number port collections. It first
  returned no matching issues (RED 0/1), then produced one stable object-level
  `invalid_port_collection_definition` error for each device (GREEN 1/1).
- Fix: the object-definition scan now reports every explicit non-null,
  non-array port collection. Downstream readers still treat the malformed
  collection as empty so analysis cannot crash or invent ports; missing and
  `null` values retain their existing valid contract behavior, and no
  connection is marked for cleanup.
- Verification: `npm test` 285/285; `npm run lint`; `npm run build` (known
  non-fatal large-chunk warning only); local frontend `/` and backend
  `/api/projects/default` HTTP checks both 200; `git diff --check` passed.
  No browser or visual QA was performed.
- Commit: `12139cb fix: report non-array port collections` (pushed).

### Non-string live port-name recommendation guard (2026-07-15)

- Problem: wiring analysis already reported a non-string port `name` through
  `invalid_port_name_definition`, but recommendation generation still called
  `.toLowerCase()` on that value while classifying switch WAN ports. A numeric
  live name therefore crashed the App-shaped `buildRecommendations()` flow
  instead of leaving the existing diagnostic visible.
- Test-first regression: one public behavior test uses a valid router LAN port
  and a switch Ethernet port whose `name` is `42`. It first failed at
  `isWanPort()` with `TypeError` (RED 0/1), then retained the wiring definition
  error and returned the valid `auto_uplink_switch` recommendation (GREEN 1/1).
- Fix: the existing shared `isWanPort()` seam now inspects the display name
  only when it is a string. Its three callers inherit the guard without new
  branches or a wider interface; ID-based, case-insensitive WAN recognition is
  unchanged.
- Verification: `npm test` 286/286; `npm run lint`; `npm run build` (known
  non-fatal large-chunk warning only); local frontend `/` and backend
  `/api/projects/default` HTTP checks both 200; `git diff --check` passed.
  No browser or visual QA was performed.
- Commit: `0942a21 fix: tolerate non-string port names` (pushed).

### Invalid maxLoad safety-fallback guard (2026-07-16)

- Problem: a catalog UPS with a 1000W safety limit and a valid 1200W downstream
  load correctly reported `power_overload` and `buy_ups_overload` when its live
  `maxLoad` was missing or null, but invalid `-1`, `NaN`, blank-string, and
  nonnumeric-string overrides were coerced to zero and suppressed both safety
  results instead of falling back to the catalog limit.
- One App-shaped table-driven public behavior test covers missing, null,
  explicit zero, negative, `NaN`, blank string, numeric string, and nonnumeric
  string overrides through `analyzeProjectWiring()` plus
  `buildRecommendations()`. It was reconfirmed RED 0/1 on the resumed clean
  base with exactly the four invalid cases false/false, then GREEN 1/1.
- Added the single-argument `getEffectiveMaxLoad(object)` seam in `analysis.js`.
  It owns catalog lookup, safe finite non-negative number/string parsing, and
  override precedence. Explicit `0` and nonblank numeric strings remain valid;
  unusable live values fall back to the catalog value and then zero.
- Wiring analysis, purchase recommendations, PropertiesEditor, and the
  SceneObjects power overlay now use the same effective-limit seam. The separate
  wattage behavior was deliberately left unchanged.
- Verification: focused RED 0/1 then GREEN 1/1; `npm test` 287/287;
  `npm run lint`; `npm run build` (known non-fatal large-chunk warning only);
  local frontend `/` and backend `/api/projects/default` HTTP checks both 200;
  `git diff --check` passed. No browser or visual QA was performed.
- Commit: `c35262e fix: fall back from invalid max load overrides` (pushed).
  The saved RED stash was consumed and dropped after the commit was protected
  on `origin/master`.

### Invalid wattage safety-fallback guard (2026-07-16)

- Problem: a catalog desktop PC with a 350W default connected to a valid 300W
  UPS correctly triggered `power_overload` and `buy_ups_overload` when its live
  `wattage` was missing or null, but invalid `-1`, `NaN`, blank-string, and
  nonnumeric-string overrides were coerced to zero and hid both safety results.
- One App-shaped table-driven public behavior test covers missing, null,
  explicit zero, negative, `NaN`, blank string, numeric string, and nonnumeric
  string overrides through `analyzeProjectWiring()` plus
  `buildRecommendations()`. It failed RED 0/1 with exactly the four unusable
  overrides false/false, then passed GREEN 1/1.
- Added the single-argument `getEffectiveWattage(object)` seam. It shares the
  private safe parser and catalog-fallback implementation with
  `getEffectiveMaxLoad(object)`, preserving explicit zero and numeric strings
  while falling back only for unusable live values.
- Recursive power-load calculation and PropertiesEditor now use the shared
  wattage seam. Wiring analysis, purchase recommendations, and the scene power
  overlay inherit the same result through `computeDevicePowerLoad()`; unknown
  devices without a catalog wattage retain the existing zero fallback.
- Verification: focused RED 0/1 then GREEN 1/1; `npm test` 288/288;
  `npm run lint`; `npm run build` (known non-fatal large-chunk warning only);
  local frontend `/` and backend `/api/projects/default` HTTP checks both 200;
  `git diff --check` passed. No browser or visual QA was performed.
- Commit: `5edb671 fix: fall back from invalid wattage overrides` (pushed).

### Opaque-ID recommendation resolution (2026-07-16)

- Problem: the persisted project contract accepts any nonblank string for
  object and port IDs, including `:`, but recommendation generation parsed the
  display-oriented `unpowered:<object>:<port>` issue ID with `split(':')` and
  `endsWith()`. A contract-valid project with colon-bearing IDs therefore kept
  both `unpowered_input` issues while silently losing its valid free power fix
  and no-source purchase suggestion.
- One App-shaped public behavior test first proves the fixture passes
  `isProjectEnvelope()`, then reuses `analyzeProjectWiring()` output through
  `buildRecommendations()`. It failed RED 0/1 with `free=[]`, `purchases=[]`,
  and `total=0`, then passed GREEN 1/1 with `auto_power_device` plus
  `buy_power_for_unpowered` and the exact colon-bearing target port ID.
- Added the private `resolveUnpoweredInput()` seam in `recommendations.js`.
  Both free and purchase builders now use structured `issue.objectIds` to
  locate the device and an exact full-issue-ID match to resolve its port;
  neither consumer splits or suffix-guesses opaque IDs.
- Verification: focused RED 0/1 then GREEN 1/1; complete recommendations tests
  72/72; `npm test` 289/289; `npm run lint`; `npm run build` (known non-fatal
  large-chunk warning only); local frontend `/` and backend
  `/api/projects/default` HTTP checks both 200; `git diff --check` passed. No
  browser or visual QA was performed.
- Commit: `b92d185 fix: preserve opaque IDs in recommendations` (pushed).

### Non-string live model-ID recommendation guard (2026-07-16)

- Problem: the App recomputes `buildRecommendations()` on every relevant
  render, but display discovery called `.startsWith()` through optional chaining
  on each candidate `modelId`. Optional chaining protects only nullish values;
  a record-shaped live object with numeric `modelId` therefore threw a
  `TypeError` before its valid `type: 'monitor'` fallback could be used.
- One App-shaped public behavior test passes precomputed wiring issues into the
  recommendation facade for an HDMI source and a typed monitor whose live
  `modelId` is `42`. It failed RED 0/1 with
  `candidate.modelId?.startsWith is not a function`, then passed GREEN 1/1 and
  returned the valid `auto_connect_display` HDMI suggestion.
- Display matching now narrows the live model ID to a string before testing the
  existing `monitor` and `ultrawide` prefixes. Valid string model IDs and the
  independent `candidate.type === 'monitor'` fallback retain their behavior;
  no interface or unrelated recommendation path changed.
- Verification: focused RED 0/1 then GREEN 1/1; complete recommendations tests
  73/73; `npm test` 290/290; `npm run lint`; `npm run build` (known non-fatal
  large-chunk warning only); local frontend `/` and backend
  `/api/projects/default` HTTP checks both 200; `git diff --check` passed. No
  browser or visual QA was performed.
- Commit: `840ebba fix: tolerate non-string model ids` (pushed).

### Invalid port-ID recommendation guard (2026-07-16)

- Problem: live wiring analysis correctly reported a numeric port ID through
  `invalid_port_id_definition`, but recommendation action and capacity scans
  still treated that port as addressable. With one router LAN port, the invalid
  endpoint received an `auto_network_device` patch carrying `toPortId: 42`,
  the valid endpoint lost its free fix, and the same invalid demand created a
  false `buy_switch` suggestion.
- One App-shaped public behavior test keeps the analysis diagnostic visible and
  places the invalid endpoint before a valid one. It failed RED 0/1 with the
  invalid automatic patch, `buy_switch`, and total 2, then passed GREEN 1/1
  with only the valid endpoint's automatic network patch and total 1.
- Added the private `getActionablePortRecords()` seam in
  `recommendations.js`. Automatic power, network, display, and relevant
  capacity scans now use only record ports whose IDs are nonblank strings.
  Pure power-input classification deliberately keeps the broader record view,
  so a device declaring a malformed input cannot become an independent power
  root.
- Verification: focused RED 0/1 then GREEN 1/1; complete recommendations tests
  74/74; `npm test` 291/291; `npm run lint`; `npm run build` (known non-fatal
  large-chunk warning only); local frontend `/` and backend
  `/api/projects/default` HTTP checks both 200; `git diff --check` passed. No
  browser or visual QA was performed.
- Commit: `1b63d53 fix: ignore invalid port ids in recommendations` (pushed).

### Invalid object-ID recommendation guard (2026-07-16)

- Problem: live wiring analysis correctly reported a numeric object ID through
  `invalid_object_id_definition`, but recommendation builders still treated the
  device as addressable. It received an `auto_network_device` patch carrying
  `toObjectId: 42`, consumed the only router LAN port, hid the valid endpoint's
  free fix, and created a false `buy_switch` suggestion. Applying that patch
  introduced a new `invalid_connection_object_id` error.
- One App-shaped public behavior test drives the complete facade → apply →
  reanalyze path. It failed RED 0/1 with the invalid patch, false purchase,
  total 2, and a newly introduced connection error, then passed GREEN 1/1 with
  only the valid endpoint patch, no purchase, total 1, and no new error.
- Added the private `getActionableObjectRecords()` seam. Both exported
  recommendation builders now keep two views: all record objects remain in
  wiring, power, length, layout, and support geometry calculations, while only
  objects whose IDs are nonblank strings can become patch targets, topology
  endpoints, or capacity/demand candidates. A focused harness confirmed an
  invalid-ID desk still supports a valid device without inventing a drop fix.
- Verification: focused RED 0/1 then GREEN 1/1; complete recommendations tests
  75/75; `npm test` 292/292; `npm run lint`; `npm run build` (known non-fatal
  large-chunk warning only); local frontend `/` and backend
  `/api/projects/default` HTTP checks both 200; `git diff --check` passed. No
  browser or visual QA was performed.
- Commit: `9e17130 fix: ignore invalid object ids in recommendations` (pushed).

### Duplicate object-ID recommendation ambiguity guard (2026-07-16)

- Problem: wiring analysis correctly reported duplicate nonblank object IDs,
  but recommendation builders still treated every matching device as
  addressable. With one router LAN port, the first duplicate endpoint stole the
  valid endpoint's automatic network fix and created a false `buy_switch`.
  Applying the generated patch was a no-op because object lookup resolved the
  same ID to the other duplicate, whose port differed.
- One App-shaped public behavior test drives the facade → apply → reanalyze
  path. It failed RED 0/1 with the duplicate-target patch, false purchase,
  total 2, and zero applied connections, then passed GREEN 1/1 with only the
  valid endpoint patch, no purchase, total 1, and one valid applied connection.
- Deepened the private `getActionableObjectRecords()` seam to count exact
  nonblank string IDs and admit only objects whose ID occurs once. Both public
  recommendation builders inherit the guard for patch targets, topology, and
  capacity/demand scans, while the complete record view remains available to
  wiring, power, layout, cable-length, and support-geometry analysis.
- Verification: focused RED 0/1 then GREEN 1/1; complete recommendations tests
  76/76; `npm test` 293/293; `npm run lint`; `npm run build` (known non-fatal
  large-chunk warning only); local frontend `/` and backend
  `/api/projects/default` HTTP checks both 200; `git diff --check` passed. No
  browser or visual QA was performed.
- Commit: `e9f6bd3 fix: ignore duplicate object ids in recommendations`
  (pushed).

### Duplicate port-ID recommendation ambiguity guard (2026-07-16)

- Problem: wiring analysis correctly reported duplicate nonblank port IDs, but
  recommendation builders still treated those ports as actionable. With one
  router LAN port, an endpoint containing two `eth-dup` inputs stole the valid
  endpoint's automatic network fix and created a false `buy_switch`. Applying
  the generated patch added a connection that analysis immediately rejected as
  `ambiguous_connection_port`.
- One App-shaped public behavior test drives the facade → apply → reanalyze
  path. It failed RED 0/1 with the ambiguous-port patch, false purchase, total
  2, and a newly introduced connection error, then passed GREEN 1/1 with only
  the valid endpoint patch, no purchase, total 1, and no new error.
- Deepened the private `getActionablePortRecords()` seam to count exact
  nonblank string IDs within each object and admit only ports whose ID occurs
  once. Both public recommendation builders inherit the guard for automatic
  actions and capacity/demand scans. Power-role classification, wiring
  diagnostics, the power graph, and physical endpoint calculations retain the
  complete port-record view.
- Verification: focused RED 0/1 then GREEN 1/1; complete recommendations tests
  77/77; `npm test` 294/294; `npm run lint`; `npm run build` (known non-fatal
  large-chunk warning only); local frontend `/` and backend
  `/api/projects/default` HTTP checks both 200; `git diff --check` passed. No
  browser or visual QA was performed.
- Commit: `7f2c288 fix: ignore duplicate port ids in recommendations` (pushed).

### Stale ambiguous-port connection guard (2026-07-16)

- Problem: a valid automatic network suggestion could become stale after an
  endpoint was edited to contain two ports with the suggested ID. Applying the
  old patch still appended the connection, and wiring analysis then reported a
  newly introduced `ambiguous_connection_port` error alongside the existing
  duplicate-port diagnostic.
- One public behavior test generates a real `auto_network_device` suggestion,
  duplicates the target port before application, applies the stale suggestion,
  and reanalyzes the result. It failed RED 0/1 because a connection was added
  and the ambiguity error appeared, then passed GREEN 1/1 with an identity
  no-op, no connection, and no newly introduced connection error.
- `applyImprovement()` now resolves both new-connection endpoints through the
  existing `getActionablePortRecords()` seam. Application therefore revalidates
  the current project and rejects endpoint port IDs that are blank, invalid, or
  no longer unique, while normal unique endpoints keep their existing behavior.
- Verification: focused RED 0/1 then GREEN 1/1; complete recommendations tests
  78/78; `npm test` 295/295; `npm run lint`; `npm run build` (known non-fatal
  large-chunk warning only); local frontend `/` and backend
  `/api/projects/default` HTTP checks both 200; `git diff --check` passed. No
  browser or visual QA was performed.
- Commit: `8a82217 fix: reject stale ambiguous port patches` (pushed).

### Stale ambiguous-object layout guard (2026-07-16)

- Problem: a valid `move_inside_room` suggestion could become stale after a
  second object was edited to share the suggested target's ID. Application
  found the first match but then updated every object with that ID, moving both
  objects to the same position and returning a new project despite the existing
  `duplicate_object_id_definition` error.
- One public behavior test generates a real move suggestion, adds the duplicate
  object before application, and observes the project through
  `applyImprovement()` plus wiring analysis. It failed RED 0/1 because both
  objects moved to `x=2` and the operation was not an identity no-op, then
  passed GREEN 1/1 with both original positions and the duplicate-ID diagnostic
  preserved.
- The layout-patch branch now resolves its current target through the existing
  `getActionableObjectRecords()` seam. Missing, invalid, or non-unique target
  IDs therefore return the exact current project, while unique valid layout
  patches keep their immutable update behavior. Cable and connection patches
  were deliberately left unchanged.
- Verification: focused RED 0/1 then GREEN 1/1; adjacent layout tests 2/2;
  complete recommendations tests 79/79; `npm test` 296/296; `npm run lint`;
  `npm run build` (known non-fatal large-chunk warning only); local frontend
  `/` and backend `/api/projects/default` HTTP checks both 200;
  `git diff --check` passed. No browser or visual QA was performed.
- Commit: `e7393a4 fix: reject stale ambiguous layout patches` (pushed).

### Stale ambiguous-object connection guard (2026-07-16)

- Problem: a valid automatic network suggestion could become stale after a
  second endpoint was edited to share the target object's ID. Because the
  application index used last-item-wins `Map` semantics, a compatible duplicate
  still allowed the old patch to append a connection that wiring analysis
  immediately rejected as `ambiguous_connection_object`.
- One public behavior test generates a real `auto_network_device` suggestion,
  adds a same-ID endpoint with the same compatible port, applies the stale
  suggestion, and reanalyzes the result. It failed RED 0/1 with one appended
  connection and a newly introduced ambiguity error, then passed GREEN 1/1 as
  a strict identity no-op with no connection or new error.
- The new-connection branch now builds its current endpoint index from the
  existing `getActionableObjectRecords()` seam. Either source or target must
  have a valid, unique current object ID before port compatibility, cable type,
  occupancy, and append checks can run. The existing actionable-port guard and
  all normal unique-endpoint behavior remain unchanged.
- Verification: focused RED 0/1 then GREEN 1/1; stale object/port endpoint tests
  2/2; all `applyImprovement` tests 12/12; complete recommendations tests 80/80;
  `npm test` 297/297; `npm run lint`; `npm run build` (known non-fatal
  large-chunk warning only); local frontend `/` and backend
  `/api/projects/default` HTTP checks both 200; `git diff --check` passed. No
  browser or visual QA was performed.
- Commit: `99dc1a6 fix: reject stale ambiguous object patches` (pushed).

### Stale ambiguous-connection cable guard (2026-07-16)

- Problem: a valid `extend_cable` suggestion could become stale after a second
  connection was edited to share the target connection's ID. Application found
  the first match but then updated every matching record, changing two lengths
  from `[1, 5]` to `[3.3, 3.3]` despite the existing
  `duplicate_connection_id` error.
- One public behavior test generates a real cable-extension suggestion, adds a
  same-ID connection with a different length, applies the stale suggestion, and
  reanalyzes the result. It failed RED 0/1 because both records changed and the
  operation returned a new project, then passed GREEN 1/1 as a strict identity
  no-op with both original lengths and the duplicate-ID diagnostic preserved.
- Added the private `getActionableConnectionRecords()` seam, symmetric with the
  existing object and port helpers. Cable-patch application now resolves only a
  record-shaped connection whose ID is a nonblank string and unique in the
  current project. Unrelated duplicate IDs do not block a unique target, and
  the raw connection array is never filtered or written back.
- Verification: focused RED 0/1 then GREEN 1/1; normal/ambiguous cable tests
  2/2; all `applyImprovement` tests 13/13; complete recommendations tests 81/81;
  `npm test` 298/298; `npm run lint`; `npm run build` (known non-fatal
  large-chunk warning only); local frontend `/` and backend
  `/api/projects/default` HTTP checks both 200; `git diff --check` passed. No
  browser or visual QA was performed.
- Commit: `a4f1ab7 fix: reject stale ambiguous cable patches` (pushed).

### Duplicate connection-ID cable recommendation guard (2026-07-17)

- Problem: wiring analysis can report both `duplicate_connection_id` and a
  length warning for the first record in a duplicate-ID group. The free and
  purchase builders then used first-match lookup on the raw connection array,
  producing `extend_cable` and `buy_cable` suggestions that could not identify
  which physical cable to change; the free patch was already rejected as a
  no-op by the application guard.
- One public `buildRecommendations()` behavior test uses one short and one long
  connection sharing `duplicate-link`, plus an unrelated unique short
  `valid-link`. It failed RED 0/1 because both duplicate and unique IDs received
  free and purchase suggestions (total 4), then passed GREEN 1/1 with only the
  unique cable suggestions retained (total 2) while the duplicate diagnostic
  remained visible.
- Both length-warning consumers now resolve their target through the existing
  `getActionableConnectionRecords()` seam. Raw connections still feed wiring
  analysis, power graphs, occupancy, and reachability, so the change only
  removes cable actions whose target ID is blank, invalid, or non-unique.
- Verification: focused RED 0/1 then GREEN 1/1; complete recommendations tests
  82/82; `npm test` 299/299; `npm run lint`; `npm run build` (known non-fatal
  large-chunk warning only); local frontend `/` and backend
  `/api/projects/default` HTTP checks both 200; `git diff --check` passed. No
  browser or visual QA was performed.
- Commit: `599ce0b fix: skip ambiguous cable recommendations` (pushed).

### Automatic connection-ID allocation guard (2026-07-17)

- Problem: automatic connection IDs concatenated object and port IDs with
  hyphens. Two valid endpoints identified as `a-b/c` and `a/b-c` therefore
  both received `c-auto-network-a-b-c`. The facade exposed two different
  network fixes, but batch application accepted only the first because
  `applyImprovement()` correctly rejects duplicate connection IDs; the second
  recommendation then remained indefinitely.
- One public behavior test builds a valid project with two router LAN ports and
  those two endpoints, applies both `auto_network_device` suggestions, and
  recomputes recommendations. It failed RED 0/1 with one unique patch ID, one
  connected target, and one residual suggestion, then passed GREEN 1/1 with two
  unique connection IDs, both targets connected, and no residual network fix.
- Added a private deterministic connection-ID allocator seeded from all current
  record-shaped connections. It reserves each emitted ID immediately and uses
  `base`, `base-2`, `base-3`, and so on, avoiding both existing-project and
  same-batch collisions without randomness. All four automatic connection
  producers (power, switch uplink, network, and display) use the shared seam;
  suggestion IDs and raw connection analysis/occupancy behavior are unchanged.
- Verification: focused RED 0/1 then GREEN 1/1; complete recommendations tests
  83/83; `npm test` 300/300; `npm run lint`; `npm run build` (known non-fatal
  large-chunk warning only); local frontend `/` and backend
  `/api/projects/default` HTTP checks both 200; `git diff --check` passed. No
  browser or visual QA was performed.
- Commit: `9a2be2f fix: allocate unique automatic connection ids` (pushed).

### Stale automatic cable-length application guard (2026-07-17)

- Problem: an automatic network suggestion generated for endpoints 1m apart
  carried a valid 1.4m cable, but the target could be moved to 8m before the
  suggestion was applied. The current project still had no wiring issue, yet
  `applyImprovement()` appended the stale cable and immediately introduced
  `short_cable`.
- One public behavior test generates the real `auto_network_device` suggestion,
  moves only its target inside a larger room, proves the cable changed from
  having recommended slack to being insufficient, and applies the old patch. It
  failed RED 0/1 with a new connection and `short_cable`, then passed GREEN 1/1
  as a strict identity no-op with the current clean wiring state preserved.
- The `newConnection` application seam now reevaluates the proposed cable
  against the currently resolved unique endpoint objects after compatibility
  checks and before any append. Missing geometry or a cable without recommended
  slack is rejected, preventing both immediate `short_cable` and
  `low_cable_slack` warnings while leaving the existing ID, endpoint, port,
  cable-type, and occupancy guards intact.
- Verification: focused RED 0/1 then GREEN 1/1; complete recommendations tests
  84/84; `npm test` 301/301; `npm run lint`; `npm run build` (known non-fatal
  large-chunk warning only); local frontend `/` and backend
  `/api/projects/default` HTTP checks both 200; `git diff --check` passed. No
  browser or visual QA was performed.
- Commit: `77bec9d fix: revalidate automatic cable length on apply` (pushed).

### Stale cable-extension application guard (2026-08-01)

- Problem: a real `extend_cable` patch was generated with a valid 2.21m length
  while its endpoints were 2m apart. The target could then move so the current
  recommendation required 5.5m; applying the stale patch still changed the
  cable from 0.5m to 2.21m, left it short, and immediately produced another
  extension recommendation.
- One public behavior test generates the real patch, proves its proposed length
  originally had recommended slack but no longer does after the move, and then
  applies it. It failed RED 0/1 by creating a new project value with the stale
  2.21m length, then passed GREEN 1/1 as a strict identity no-op that retains
  0.5m while the recomputed recommendation exposes the current 5.5m repair.
- The cable-length patch application seam now evaluates the candidate updated
  connection against the current unique actionable endpoint objects and
  requires recommended slack before writing it. Stale patches that would leave
  either `short_cable` or `low_cable_slack` are rejected; existing target,
  numeric-length, idempotency, and current-length guards remain unchanged.
- Verification: focused RED 0/1 then GREEN 1/1; `npm test` 302/302;
  `npm run lint`; `npm run build` (known non-fatal large-chunk warning only);
  local frontend `/` and backend `/api/projects/default` HTTP checks both 200;
  `git diff --check` passed. No browser or visual QA was performed.
- Commit: `38459dd fix: revalidate cable length patches on apply` (pushed).

### Recommendation outcomes and repeatable UI verification (2026-09-09)

- Product objective: improve the user's complete modeling, diagnosis, action,
  and review flow. Prioritize observable user outcomes over an open-ended
  sequence of malformed-state hardening slices.
- Real UI RED: two overlapping furniture objects produced one layout warning,
  zero free/purchase suggestions, and the misleading "perfect" empty state.
  One browser behavior test failed on the missing unresolved-problem message,
  then passed after the panel exposed outstanding checks and direct report links.
- A second UI RED proved an empty project also claimed perfection instead of
  explaining how to start. GREEN adds a first-device action that opens the asset
  library. A checked nonempty project now describes only the current rule results.
- Renamed the panel to automatic checks and improvement suggestions and explained
  that suggestions derive from modeled equipment, positions, and connections.
  It no longer implies an external AI model or guarantees physical perfection.
- Added Playwright as a development-only dependency, a self-managed isolated Vite
  server on 127.0.0.1:5174, and five user-flow tests at desktop 1440x900 and
  mobile-sized 390x844 viewports. The tests intercept all API traffic with valid
  fixtures and exercise real React/domain behavior: unresolved overlap, empty
  project entry, apply-all with residual issues plus undo/redo, wiring report
  navigation, and scoped clean results. No backend is required by the UI suite.
- Verification: the two focused public UI RED/GREEN cycles above; npm test
  302/302; npm run test:ui 10/10; lint; build (known large-chunk warning);
  both required local HTTP endpoints 200; git diff --check passed.
  Chrome DOM/interaction/console QA was performed; no screenshots, IAB,
  pixel-level visual QA, or real-project save was performed.
- Test stability note: one initial first-device navigation check timed out.
  With runtime-error logging, the unchanged application passed a focused rerun,
  five consecutive repetitions, and both viewport suites. No runtime error was
  captured; a root cause for that isolated timeout has not been established.
- npm audit reported six affected dependency packages (four high, two moderate);
  one moderate package remained with --omit=dev. Handle compatible fixes in a
  separate verified slice, without forced major upgrades.
- Feature commit: ba0acd3 (pushed to origin/master).

### Dependency audit cleanup (2026-10-25)

- `npm audit fix` without `--force`, lockfile only, no major upgrades. Both
  repositories now report 0 vulnerabilities.
- Frontend `c71c8c0` (vite 8.3.5, rolldown 1.2.15, zod 4.6.7, brace-expansion,
  source-map-js, postcss). Backend `2d67538` (express 4.22.3, proxy-addr 2.0.8
  for a critical advisory, qs, body-parser, side-channel). Both pushed.

### Home-user catalog reduction (2026-10-25)

Product owner direction: remove what ordinary home users do not need. Four
commits, each verified separately:

- `805049c` Removed the UPS. Power advice rewritten for homes:
  `fix_power_strip_chain` (rewire the downstream strip to a wall outlet or use
  one larger strip), `split_overloaded_power` (move heavy devices to another
  wall outlet, or add a strip), and `buy_power_for_unpowered` now recommends a
  power strip for AC inputs and a power adapter for DC inputs (laptops,
  routers). Previously DC devices were told to buy a UPS, which cannot power
  them. Also fixed mismatched opening quote marks in power suggestion text.
- `4bfce77` Removed switch, NAS, and modem, the switch uplink and buy-switch
  rules, purchase guidance for switches, and the ethernet topology panel. The
  router now has three plain ports (`lan-1..3`, named 网口 1–3) and no WAN port.
  `auto_network_device` simply connects to the nearest powered router; no
  networking hardware is ever recommended for purchase. This also removed a
  bug where a project with no router was told its router had 0 free LAN ports.
- `c18cbcc` One desk only: `office-desk`, labelled 书桌 (size is adjustable).
  Removed gaming, standing, and L-shaped desks, mini PC, and all-in-one.
  Saved objects of removed models still load: stored ports are hydrated with
  anchors and they render as the fallback box. The real default project still
  contains a mini PC and an all-in-one; `default-project.json` was not edited.
- `7d2defa` Import/export/paste/copy JSON and the axes toggle moved into a
  更多 menu (fixed-position so the toolbar scroll container cannot clip it;
  Escape returns focus; outside click or an action closes it; the hidden file
  input stays mounted). Added `e2e/toolbar.spec.mjs` and the shared
  `e2e/project-fixture.mjs`.
- Catalog is now 9 models: 书桌, desktop PC, 15-inch laptop, 24/27-inch and
  ultrawide monitors, router, power strip, wall outlet, power adapter.
- Verification after the last slice: `npm test` 270/270 (lower than before
  because switch/UPS/removed-model tests were deleted), `npm run test:ui`
  12/12, lint, build (known large-chunk warning). Browser checks of the
  recommendation panel and Playwright screenshots of the menu at 1440x900 and
  390x844 were performed.
- Headless note: in Playwright (SwiftShader WebGL) the first menu open can
  take about 0.8s because it waits behind three.js first-use shader
  compilation. In a real GPU browser it opens in about 10ms. UI assertions
  auto-wait, so tests are stable.
- Follow-up: the mirrored power-load label was fixed on 2026-10-28 (`ea2dbc4`).

### Lower modeling cost: templates, device-list builder, shopping list (2026-10-28)

Product owner asked for autonomous progress while away. Each slice was
verified (unit, UI, lint, build) and committed separately; nothing pushed.

- `ea2dbc4` Power-load and axis labels use drei `Billboard`, so they no longer
  read mirrored. Verified with a 4x Playwright screenshot.
- `987a83a` A DC device next to its unplugged adapter is wired to that adapter
  (and told to plug it in) instead of being told to buy another. Powered
  sources still win; AC devices never chain through an unpowered strip.
- `63bd33c` Display suggestions: one video cable per computer-monitor pair.
  Previously a PC and one monitor got both DP and HDMI suggestions, and a spare
  output kept nagging after one link existed.
- `e4bb0e1` `src/domain/scene-builder.js`: `buildDeskScene({ devices, desk })`
  returns `{ room, objects, connections, camera, notes }`. Placement: desk
  against the +y wall (the default camera sits at -y), monitors along the
  desk's back rotated 180° to face the user, laptop front-right, PC on the
  floor right of the desk, router on the floor left, strip and adapters in the
  0.15m gap behind the desk, wall outlet on the wall at 0.3m. Wiring is planned,
  not greedy: outlet → strip → AC loads, one adapter per DC device, each video
  output to a different monitor, PC → router. Cable lengths round up to
  `STANDARD_CABLE_LENGTHS`. Device limits, desk size bounds (0.8 to 3m by 0.5
  to 1.2m), monitors that do not fit, and monitors left without a video output
  produce notes. `src/domain/desk-templates.js` defines 家庭办公, 台式机双屏,
  电竞桌. Tests require every template to have zero layout/wiring warnings and
  zero suggestions.
- `58df7ac` 桌面模板 toolbar button and 使用桌面模板 in the empty-project state.
  Applying replaces the scene like an import (undoable, warns when the scene is
  not empty) and frames the camera on the desk using the scene's camera pose.
- `b226d2a` `src/components/DeskBuilderForm.jsx`: 按我的设备生成 form inside
  the template picker (steppers, desk size, live notes, 生成桌面). This is the
  structured input a future LLM "describe your desk" flow should produce.
- `6d43b74` Real bug found by the form's UI test: reading `event.target.value`
  inside a functional state updater loses the typed value when React defers
  the update (it restores the controlled input first). Fixed in the form and in
  six ConnectionsEditor handlers. Always read the value before calling the setter.
- `034de00` Asset library cards show spec lines from
  `describeCatalogModel()` (for example `6 孔 · 最大 2500W`) instead of internal
  ids; search matches them too.
- `1b51d43` `src/domain/shopping-list.js`: 购物清单 at the top of the purchase
  section with 复制清单. Duplicates merge into quantities; unchain/split
  alternatives are listed as optional; strips are counted by outlets (one
  six-outlet strip covers several unpowered devices). Cable purchases name a
  standard store length (`加购一根 3m HDMI 线`). `STANDARD_CABLE_LENGTHS`,
  `standardCableLength()`, and `CABLE_TYPE_NAMES` now live in `connections.js`.
- `c9a649a` Properties panel uses plain labels (用电, 位置 (m) 左右/前后/上下,
  朝向, 尺寸 (m) 长/宽/高) and shows the device name and spec line.
- `7414a7c` `placeCatalogObject({ ..., objects })` finds a free spot instead of
  the room center: monitors and laptops on a desk top (laptops toward the
  front; a screen gets its own left-right column, or goes in front of another
  screen, never hidden behind one), wall outlets on the wall nearest the desk,
  floor devices behind the desk, then along its sides, then spiralling out
  while avoiding the space in front of the desk. No objects → room center as
  before. Known limit: on a 1.4m desk a second screen cannot fit beside a
  centered first one, so it lands in front of it for the user to drag; the
  add never moves existing objects.
- Verification after the last slice: `npm test` 299/299, `npm run test:ui`
  22/22, lint, build (known large-chunk warning). Playwright screenshots were
  taken of the templates, picker, form, shopping list, asset library,
  properties panel, and devices added to a template desk.
- `ff3d49a` (after product-owner feedback, see the principle under Mission):
  `unpowered_input` is an info note ('未画电源线，系统按已通电处理');
  `buildRecommendations` no longer offers `auto_power_device`; adding a device
  draws its power line via `buildPowerCompletion()` when a free outlet or strip
  exists; `buy_power_for_unpowered` and `buy_power_strip` were replaced by one
  outlet check `buy_power_strip_for_outlets` (plugs needed vs modeled outlets;
  a laptop without a modeled adapter counts once; no outlets modeled → no
  check). Verification: `npm test` 298/298, `npm run test:ui` 24/24, lint, build.
- `4a991fc` Same principle applied to video and network lines (product owner
  approved): `buildRecommendations` hides `auto_connect_display` and
  `auto_network_device` too (`MODEL_COMPLETION_CODES`).
  `buildPowerCompletion` became `buildConnectionCompletion(project, objectId)`,
  which returns all power/video/network lines for a newly added device over up
  to 5 passes (a new strip is plugged in first, then powers nearby devices);
  the new device is ordered first so its own ports get the nearest free
  sockets. Network completion no longer requires the router's power line to
  be drawn. Engine robustness tests use a local `engineRecommendations`
  helper. Verification: `npm test` 301/301, `npm run test:ui` 26/26, lint,
  build.
- `3f556ec` / `4ee93b6` (merged as `1f10bfc`, 2026-10-29): every catalog model
  now has a low-poly GLB at `public/models/<modelId>.glb`, built at the
  catalog `defaultScale` by the Blender scripts in `tools/blender-models/`.
  `catalogModelUrl()` includes Vite's base URL; the renderer scales a GLB by
  `obj.scale / defaultScale`. Port anchors are authored per model in
  `PORT_ANCHOR_BY_MODEL` (catalog.js) to sit on the mesh connectors. The
  laptop GLB is open-lid (`defaultScale.z = 0.22`).
- `c21c28e` Old saves vs the GLB models, in `hydrateProjectObjects()` (runs on
  load, import, and draft restore): a laptop-15 whose height is below 60% of
  the default (old closed-lid saves store about 0.058 or 0.105 m, which
  squashed the open-lid mesh into a flat tray) is restored to the default
  height, keeping its footprint and its bottom, so it still rests on the desk.
  Catalog ports take the `PORT_ANCHOR_BY_MODEL` anchor by `port.id` instead of
  the saved one; ports and models outside the catalog keep stored anchors.
  Saves with removed models (mini-pc, all-in-one) load unchanged and render
  as plain boxes. `e2e/legacy-save.spec.mjs` opens such a save and checks for
  no runtime errors and no 未保存 flag. Visual QA (real Chromium screenshots,
  before/after, against a copy of the backend with a constructed old save):
  the laptop lid stands up and the HDMI cable leaves the laptop's side port.
  The owner's real `default-project.json` was not available (cloud session),
  so it has not been checked against these changes.
- 未保存 note: the camera view is saved with the project, so orbiting or
  zooming marks the project unsaved (`cameraDirty`); loading alone does not.
- Browser-local saves (2026-10-30, `5919d80`, `8447785`): the backend kept
  one shared project file, so a public launch would let visitors overwrite
  each other. `src/domain/local-project-store.js`
  (`createLocalProjectClient(getStorage)`) replaced the HTTP
  `project-client.js` with the same interface (load / save(project, version)
  / validate / recoverBackup). Keys: `desklab.project.v1` (save),
  `desklab.project-backup.v1` (previous save); the unsaved-changes draft keeps
  `desklab.project-draft.v1`. First visit: empty 5 x 4 x 3 m room, version
  `"unsaved"`. Version = length + FNV-1a hash of the stored text; a mismatch
  is the old 412 conflict (`project_conflict`, same Chinese message), which
  stops a second tab overwriting a newer save. A damaged save throws
  `project_unreadable`, locks saving, and the banner restores the backup.
  `normalizeProject()` = `isProjectEnvelope` + the backend validator's field
  whitelist. Blocked storage → `storage_unavailable`; full →
  `storage_write_failed`; both have plain Chinese messages. After the first
  save the app calls `navigator.storage.persist()` (best effort). Known
  limit: browsers can still drop site data (user clears it; Safari may evict
  storage of sites unused for 7 days), so 导出 stays the user's backup.
  The UI fixture seeds `localStorage` once per tab via `addInitScript` and
  fails on any `/api` request; `e2e/local-save.spec.mjs` covers save+reload,
  the two-tab conflict, and backup recovery.
- `5919d80` StrictMode bug: the unmount cleanup disposed the only status
  notifier, so in dev (and the UI suite) every status message was dropped
  after the StrictMode remount. Each mount now creates its own notifier.
  Production builds were not affected.
- Backup reminder (2026-10-30): `src/domain/backup-reminder.js`
  (`shouldRemindBackup`, state in `desklab.backup-reminder.v1`). After a save
  with at least one object, a yellow bar (region "备份提醒") offers 导出备份 /
  以后再说 when there is no export yet or the last one is 7+ days old;
  以后再说 snoozes 7 days; any 导出 JSON or 导出备份 records the export and
  clears the snooze. Hidden while a draft-recovery or load-failure banner is
  up. `e2e/backup-reminder.spec.mjs` covers snooze across a reload and
  export → re-import. Verification: `npm test` 291, `npm run test:ui` 38.
- `940e696` A1 Plain-word backup tools: "更多" menu items are 导入备份 / 导出备份 /
  粘贴项目 / 复制项目; recovery and status messages say 导出备份; the import
  input is labelled 导入 DeskLab 备份文件. `describeProjectImportError()`
  (project-import-limits.js) turns a JSON parse error into "这不是 DeskLab
  的备份文件，或者文件已损坏". Export file names keep the `desklab-project-`
  prefix. Verification: `npm test` 292, `npm run test:ui` 40, lint, build;
  menu screenshots at desktop and phone width checked.
- `20a8fc8` A2 Hint bar under the toolbar: text comes from
  `describeSelectionHint({ selectedName, isMobile })` (selection-hint.js);
  phones get "点选设备即可编辑" / "拖动可移动，属性面板可精确调整", desktop keeps
  the shortcuts; the selected device shows its user-given name, never the
  type id. Styles moved to `.selection-hint` in App.css, which wraps instead
  of clipping. `e2e/selection-hint.spec.mjs` asserts scrollWidth <=
  clientWidth at both viewports. Verification: `npm test` 295,
  `npm run test:ui` 42, lint, build; screenshots checked.
- `6efa9da` A3 First-visit guide: region "开始搭建" centered over the 3D view
  when the project was never saved (`version === UNSAVED_PROJECT_VERSION`),
  is editable, and has no objects. Buttons: 从模板开始 (template picker),
  按我的设备生成 (picker scrolled to the builder heading via a ref flag; a
  setState inside the effect fails the react-hooks lint rule), 自己摆 (opens
  the library). Any choice dismisses it for the visit. `openProject(page,
  objects, connections, { saved: false })` opens as a first-time visitor.
  Verification: `npm test` 295, `npm run test:ui` 50, lint, build;
  screenshots checked.
- `97a4658` A4 3D view fallbacks: `canUseWebGL()` (webgl-support.js) runs once;
  without WebGL a `SceneUnavailable` notice replaces the Canvas and the rest
  of the app works. `SceneErrorBoundary` (components/SceneFallback.jsx) wraps
  the Canvas with a 重新加载 3D 画面 button; its children is a function that
  receives `reportFailure`. The Canvas now gets `gl={defaults =>
  createRendererOrReport(...)}`: R3F creates the renderer outside React
  rendering, so a refused context used to be an uncaught error no boundary
  saw. Already existing: per-object `GLTFErrorBoundary` falls back to simple
  shapes when a GLB fails (but leaves uncaught console errors, task A9).
  Verification: `npm test` 298, `npm run test:ui` 56, lint, build; scene
  render unchanged (screenshot), no-WebGL notice checked on phone.
- `126c945` A5 Code splitting: the Canvas subtree lives in
  `src/components/Scene3D.jsx` (only file importing three / R3F / drei /
  SceneObjects), loaded with `React.lazy` + `Suspense` ("正在加载 3D 画面…");
  App passes state and callbacks (drag, click, hover, background click).
  `vite.config.js` puts `node_modules/three` in its own chunk via
  `build.rolldownOptions.output.codeSplitting.groups`. Sizes: before one
  1,453 KB chunk (412 KB gz); after entry 330 KB (101 KB gz), Scene3D 405 KB
  (129 KB gz), three 723 KB (184 KB gz). The >500 KB warning that remains
  is three.js itself. `SceneErrorBoundary` now tells a chunk download
  failure (`isCodeDownloadError`, load-errors.js) from a crash and offers
  刷新页面 for it, because browsers cache failed module imports.
  Verification: `npm test` 300, `npm run test:ui` 58 (suite time 3.7 → 1.7
  min), lint, build; production `vite preview` checked in Chromium (load
  order, save + reload, no console errors).
- `ffefe20` A6 UI audit check: of the 12 findings in docs/ui-audit.md and
  docs/new-skill-ui-audit.md, 8 were already fixed (annotated in place), the
  open P1 (grey text #888 at 3.5:1) is fixed (#5f6b7a; disabled states keep
  #888, which WCAG exempts) with `test/text-contrast.test.js` scanning CSS and
  inline styles, and the P2 items became roadmap tasks E8–E12. Found for A7:
  the connections list shows raw cable types (`hdmi`, `usb_c`). Verification:
  `npm test` 302, `npm run test:ui` 58, lint, build.
- `b45316e` A7 Copy review. Scope: every string literal with Chinese in src/
  scanned for English words, rendered `.type` / `.cableType` / `.modelId` /
  `.direction`, `error.message` passthrough, and jargon (画布, 坐标, 锚点).
  Changes: connections.js gained `PORT_TYPE_NAMES`, `PORT_DIRECTION_NAMES`,
  `describePortType/Direction`, `describeCableType`; analysis.js wiring
  messages use them; the connections list shows `describeCableType`;
  `labelObjectsForPicker()` (object-labels.js) names devices in the
  connection editor by user name, numbering duplicates; port options show
  only the port name; the out-of-room message reads 左右/前后/高度; clipboard
  copy and paste failures have plain messages; 画布 → 画面 / 桌面. Left as
  is: Ctrl+Z / Ctrl+Y in tooltips, units (m, W, MB), brand-style names
  (HDMI, DP, USB-C). Verification: `npm test` 306, `npm run test:ui` 60,
  lint, build.
- `4e5aa30` A9 Missing GLBs: R3F's `createRoot` passes `reportError` as
  onCaughtError, so a GLB load failure caught by `GLTFErrorBoundary` still
  became a window error event (an uncaught page error). `DeviceMesh` now
  renders the GLB only after `modelAvailability.check(url)`
  (model-availability.js: one HEAD per URL, cached; non-2xx, network error,
  or a text/html answer = missing) says it exists; until then and when
  missing it draws the generic shape. Verification: `npm test` 309,
  `npm run test:ui` 60 (the missing-model test now fails on any uncaught
  error), lint, build; production preview: 8 HEAD + 10 GET for the gaming
  template, all 200, no console errors.
- `64faa10` B2 + `60a8eca` B1 AI endpoint. `src/domain/ai-protocol.js` (shared by
  server and browser): `ACTION_FIELDS` for move / rotate / swap / connect /
  disconnect / set_cable_length, `SUGGESTION_CATEGORIES`, `AI_LIMITS`, and
  `sanitizeSuggestions()` (drops a whole suggestion if any action is unknown
  or malformed). `server/ai/prompt.js`: roadmap §6.5 system prompt, scene and
  goal JSON-quoted inside the user message, goal capped at 200 chars.
  `server/ai/layout-handler.js`: `createLayoutHandler({ fetchImpl,
  rateLimiter, logger })`; env `DEEPSEEK_API_KEY`, `DEEPSEEK_BASE_URL`,
  `DEEPSEEK_MODEL`, `AI_ENABLED`, `AI_TIMEOUT_MS`; errors per roadmap §6.3.3.
  `functions/api/ai/layout.js` is the Pages route; shared code sits outside
  `functions/` because every file there becomes a route. Checked with
  wrangler 4 (scratchpad install, not a dependency): `wrangler pages
  functions build` compiles, and `wrangler pages dev dist` answers POST
  /api/ai/layout with 503 ai_unavailable; Cloudflare serves a missing
  /models/x.glb as 200 text/html (confirms the A9 check). DeepSeek's docs
  site was blocked in the cloud session; model names and JSON mode were
  confirmed only from third-party pages. Verification: `npm test` 326, lint,
  build.
- `202c2c8` B3 Rate limits: `server/ai/rate-limit.js` `createRateLimiter()`;
  per-address hourly (`AI_PER_IP_HOURLY`, 20) and site-wide daily
  (`AI_DAILY_TOTAL`, 2000, day boundary = Beijing midnight). KV binding
  `AI_LIMITS` if present (approximate, eventually consistent), otherwise
  per-instance memory; mode in `X-AI-Limit-Mode`. 429 message differs for
  the hour and day limits. The route creates the limiter at module scope.
  Checked in `wrangler pages dev` with a fake key: third call at limit 2 →
  429. Verification: `npm test` 331, lint, build.
- `ea51b15` B4 Local AI: `npm run dev:api` (tools/dev-api-server.mjs, Node
  http on PORT or 3001) runs `createLayoutHandler` with `process.env`;
  `AI_MOCK=1` swaps DeepSeek for `server/ai/mock-model.js` (rule-based
  answers in DeepSeek's response format, read from the scene in the prompt).
  `test/ai-dev-server.test.js` starts the real server in both modes. Live
  site check after B1–B3: POST /api/ai/layout → 503 ai_unavailable (H1 not
  done yet). Verification: `npm test` 333, lint, build.
- `f38b3cf` B5 Browser AI client: `requestLayoutSuggestions({ summary, goal,
  signal, fetchImpl, timeoutMs = 45000 })` (src/domain/ai-client.js) →
  `{ suggestions, model }` or an Error with `code` (server code,
  `network_error`, `ai_timeout`, `cancelled`) and a Chinese message.
  `AI_ERROR_MESSAGES` now lives in ai-protocol.js for both sides.
  Verification: `npm test` 337, lint, build.
- `3287f5d` B6 `openProject(page, objects, connections, { ai })`: `ai(body)`
  returns the JSON (or `{ status, json }`) for POST /api/ai/layout and
  bodies land in `evidence.aiRequests` (only present when `ai` is given, so
  existing `toEqual({ errors: [], writes: [] })` checks still hold).
  Without `ai`, an AI request is a recorded write and fails tests. Phase B
  is complete. Verification: `npm test` 337, `npm run test:ui` 64, lint,
  build.
- `1a0a2ae` C1 Layout hints: `analyzeLayoutHeuristics(room, objects,
  connections)` (layout-heuristics.js) → `{ code, severity: 'hint',
  objectIds, message, connectionIds? }` for the 10 rules in roadmap §6.6.1;
  constants in `HEURISTIC_LIMITS`. Desk frame: device front = local +y; seat
  on the desk's local -y side 0.35 m past the front edge; facing is checked
  against the desk's "toward seat" axis, not the seat point (dual monitors).
  Desk detection: modelId office-desk or type ending in -desk (an early
  /desk/ test matched desktop-pc). `findSupportingObject()` added to
  layout-analysis.js. Templates and all 1,728 `buildDeskScene` combinations
  (6 desk sizes) give zero hints. Verification: `npm test` 347, lint, build.
- `7df818b` C2 `scoreLayout(project)` (layout-score.js) → `{ total, errors,
  warnings, hints, cableMeters, codes }`; weights in `SCORE_WEIGHTS` (100 /
  20 / 5 / 1 per metre). Severity 'info' (unpowered_input, legacy_connection)
  is not counted, so no "model completion" exclusions are needed. A template
  scores only its cable metres. Verification: `npm test` 351, lint.
- `4e327b5` C3 `buildSceneSummary(project)` (ai-scene-summary.js): roadmap
  §6.4 format with `seats: [{ desk, x, y }]` (one per desk, via
  `getDeskSeat()` now exported from layout-heuristics.js together with
  `isDesk`), `restingOn` = desk id / floor / wall / air, ports with
  `linkedTo`, connections with `needed` = recommended length, findings =
  error + warning only, hints from C1, catalog ids. Sizes: home-office 3.5
  KB, desktop-dual 5.1 KB, gaming 5.6 KB. Snapshot test (UPDATE_SNAPSHOTS=1
  to rewrite). Verification: `npm test` 357, lint.
- `9a740b0` C4 AI safety core (src/domain/ai-actions.js): `applyAiActions`,
  `evaluateSuggestion`, `evaluateSuggestions` (accepted, biggest score drop
  first), `applySuggestionsInOrder` (re-checks each), `parseAiResponse`.
  Placement without z keeps the level: floor items stay on the floor, others
  drop from the ceiling onto the highest support (so a monitor moved over a
  desk lands on it). Refusals carry Chinese reasons. Refused always: unknown
  ids, out of room (no silent clamping), moving wall outlets or desks with
  things on them, monitors/laptops not on a desk, busy or incompatible
  ports, removing power lines, cables shorter than recommended, any other
  action type. Acceptance per roadmap §6.6.4. Verification: `npm test` 372
  (incl. summary → mock model → validation end to end), lint, build.
- `1fc4ff1` Dev rendering regression from A5: with `React.lazy` + `Suspense`,
  StrictMode's double mount left the R3F canvas blank in development (no
  errors; production fine). Found while screenshotting C5. `LazyScene3D.jsx`
  now imports Scene3D in an effect and mounts the canvas once; a failed
  download is rethrown for `SceneErrorBoundary`. `e2e/scene-render.spec.mjs`
  fails if the canvas screenshot is under 20 KB (blank ≈ 3.6 KB, drawn 46–146
  KB). Lesson: a visual check must look at the pixels; passing UI tests did
  not catch a blank canvas.
- `5407119` C5 AI UI: `AiSuggestionsPanel` (components/AiSuggestions.jsx) inside
  the 自动检查与改进建议 dialog (region "AI 建议"); request state in
  `useAiLayoutAssistant()` (components/useAiLayoutAssistant.js), held by App
  so suggestions survive a preview. Cards = `evaluateSuggestions(current
  project, raw suggestions)`, recomputed on every change. Preview: App state
  `aiPreview` swaps the Scene3D objects/connections, highlights
  `changedObjectIds()`, shows region "AI 预览" with 应用 / 取消, and sets
  `projectEditable` false (`projectBaseEditable` is the old value). Apply =
  `recordHistory()` + set objects/connections (one undo step). A 503 marks AI
  unavailable for the session. `openProject` gained a `room` option.
  Verification: `npm test` 373, `npm run test:ui` 76, lint, build; dialog and
  preview screenshots checked at both sizes.
- `ae578ed` C6 Evaluation harness: `tools/ai-eval/lib.mjs` (`buildEvalScenes`,
  `runEval({ post })`, `summarize`, `THRESHOLDS`), CLI `npm run eval:ai`
  (tools/ai-eval/run-eval.mjs; exit 1 = threshold missed, 2 = no endpoint /
  no key / rate-limited; raw results in ignored `tools/ai-eval/results/`).
  The local dev server no longer rate-limits unless AI_LOCAL_RATE_LIMIT=1.
  Mock baseline (not the target): parse 100%, messy helped 26%, new errors
  0, jargon 0. Real-model run and `test/fixtures/ai/recorded/` wait for H1.
  Live check after C5: AI section shows "AI 功能暂未开放" on click, canvas
  draws. Verification: `npm test` 375, lint.
- `835eb4c` D1 About & privacy: `components/AboutDialog.jsx`, opened from
  更多 → 关于与隐私 (Esc closes). Must stay true to the code: saves only in
  localStorage; AI sends room, devices, cables, user-given device names, and
  the goal to DeepSeek only on 让 AI 看看; no analytics. No contact details:
  the owner has not provided any (add them when given). The AI section's
  notice was corrected (it claimed no personal info was sent). Verification:
  `npm test` 375, `npm run test:ui` 78, lint, build; phone screenshot.
- `f3811c7` D3 Error notice: `components/ErrorNotice.jsx` (region alert "出错提示")
  listens to window error and unhandledrejection; `shouldReportError()` /
  `formatErrorReport()` in domain/error-report.js. Ignored: ResizeObserver
  loop, "Could not load ..." (GLB fallback; R3F reports caught errors
  globally), AbortError. Copy falls back to `window.prompt` when the
  clipboard is blocked. Nothing is sent. Verification: `npm test` 377,
  `npm run test:ui` 82, lint, build.
- `0209fa0` D4 Browser support. Build target = Vite `baseline-widely-available`
  = Chrome/Edge 111, Firefox 114, Safari/iOS 16.4. Newer APIs in src
  (structuredClone, Object.hasOwn, ??=, crypto.randomUUID guarded,
  navigator.storage optional) are all within that target. index.html now
  has a classic-script feature check that shows "你的浏览器版本太旧" and sets
  `window.__DESKLAB_UNSUPPORTED__` so main.jsx does not start the app
  (`e2e/old-browser.spec.mjs`). NOT verified: Safari, Firefox, iOS, WeChat's
  in-app browser. Only Chromium exists in the cloud container and the
  environment forbids installing other Playwright browsers; check on real
  devices when possible. Verification: `npm test` 377, `npm run test:ui` 84,
  lint, build.
- `deaf439` D5 index.html: meta description, og:title / og:description /
  og:image (`public/og-image.png`, 1200x630, rendered from the gaming
  template with panels and axes hidden). og:image is an absolute
  pages.dev URL: change it when a custom domain arrives.
- D2 Live acceptance (2026-10-30, https://desklab-frontend.pages.dev, Chromium
  through the proxy, 1440x900 and 390x844): first-visit guide → gaming
  template in ~4 s; canvas drawn (121 KB / 47 KB screenshots); 布局检查,
  布线检查, 所有连接 open with plain text; adding a strip selects it with the
  right hint; undo/redo; save → backup reminder → export downloads; reload
  keeps 10 objects with no 未保存; AI section answers "AI 功能暂未开放"
  (criterion 5 waits for H1); 关于与隐私 present; no console errors, no
  failed requests. Found: adding a second power strip leaves 布线检查 (1) /
  改进建议 (1) (task A10).
- `2297f1f` A10 `findNearestFreePowerSource` (recommendations.js) skips strip
  sources when the device is itself a strip (`isPowerStrip` now exported
  from analysis.js). Found by the D2 live run. Verification: `npm test` 378,
  `npm run test:ui` 86, lint, build.
- H1 done (2026-10-30): the owner added `DEEPSEEK_API_KEY` in Cloudflare and
  redeployed. Live POST /api/ai/layout → 200; DeepSeek reports the model as
  `deepseek-flash` (DEEPSEEK_MODEL unset, default `deepseek-chat`). First
  real answer for `gaming/monitor-off-centre` + "更整洁": 5 suggestions in
  ~3 s (2,519 prompt / 367 completion tokens); "显示器移到正前方" accepted
  (score 19.5 → 14.5), the other 4 (laptop, power strip, router, adapters)
  rejected for new warnings or no gain. Live browser run (desktop + phone):
  one card, preview, apply, save → monitor x = 0, no console errors.
  Next: C7 (see roadmap for running the eval within the rate limit).
- C7 Prompt iterations. v1 = the roadmap §6.5 starting prompt, unchanged.
  First real run 2026-10-30 against the live endpoint (model reported as
  deepseek-flash; 25 requests, ~2–3 s each, ~2.5k prompt / ~0.4k completion
  tokens): parse 100%, messy scenes helped 84% (16/19), average improvement
  44.3, new errors 0, jargon 0 → all thresholds met, so no prompt change was
  needed. Raw suggestions 106, accepted 25; rejection reasons: no gain 62,
  new warnings 33, outside the room 12, monitor/laptop not on a desk 7.
  Misses: home-office/laptop-at-back (laptop moved onto the monitor's
  footprint) and desktop-dual/monitor-turned-away + 适合打游戏 (moved instead
  of rotated) → task E13. Ran from the cloud session with
  `NODE_USE_ENV_PROXY=1 node tools/ai-eval/run-eval.mjs --url
  https://desklab-frontend.pages.dev/api/ai/layout`; the in-memory rate
  limit never triggered (29 calls in an hour) → task E14 / H2. `ca62f5c` stores
  three answers in test/fixtures/ai/recorded/ with a replay test.
  Verification: `npm test` 382.
- `66231cb` C8 Follow-up: request body may carry `followUp: { previousSuggestions,
  feedback }`; the server re-filters the previous suggestions with
  `sanitizeSuggestions` and `buildMessages` adds an assistant turn (previous
  JSON) and a user turn (feedback quoted, ≤200 chars). The hook keeps the
  last answer in a ref; the panel shows "不满意？告诉 AI 怎么改" + 按我的意见再来一次
  after an answer. Live check with DeepSeek: first answer 5 suggestions (1
  accepted); with "只调整显示器，别的都不要动" the second answer was only the
  monitor move (accepted). Phase C complete. Verification: `npm test` 385,
  `npm run test:ui` 88, lint, build.
- `d7094e0` E13 Prompt iterations v2. Every hint from
  `analyzeLayoutHeuristics` now carries a `fix`: ready actions in the same
  shape the AI outputs (move/rotate), each one feasible on its own (desk-side
  spots use the rotated footprint along the desk axis with a 5 cm gap and stay
  inside the room). `buildSceneSummary` passes it through, and prompt rule 7
  says to use a hint's `fix` as is instead of inventing positions. Eval v2
  against the live endpoint stopped at 19/25 requests on the hourly limit
  (429); compared on the same 19 requests with v1: messy scenes helped 81% →
  100%, accepted/raw 21/83 (25%) → 26/49 (53%), average improvement 48.8 →
  46.6, new errors 0, jargon 0. The other 6 requests were not rerun; to finish
  them, `NODE_USE_ENV_PROXY=1 node tools/ai-eval/run-eval.mjs --url
  https://desklab-frontend.pages.dev/api/ai/layout --resume
  tools/ai-eval/results/<run folder>/` (results are gitignored, so a new
  session reruns the full set). Verification: `npm test` 386, lint, build.
- Deployment (2026-10-30): Cloudflare Pages builds `master` on every push
  and serves https://desklab-frontend.pages.dev (owner's Cloudflare account;
  framework preset None, `npm run build`, output `dist`, Node from
  `.node-version`). The repository is private, so GitHub Pages is not used;
  `.github/workflows/ci.yml` only runs unit, lint, build, and Chrome UI checks.
  Verified live in Chromium: all 10 GLBs return 200, a saved template
  survives a reload, no console errors. Not done yet: own domain (not
  ICP-filed; mainland hosting on the owner's Aliyun Guangzhou VPS needs a
  filing first), and a backend on the owner's Japan EC2 for future LLM calls.
- Cloud sessions without Google Chrome: `npm run test:ui` needs a temporary
  Playwright config outside the repo that imports `playwright.config.mjs`,
  drops `use.channel`, sets `launchOptions.executablePath` to the installed
  Chromium, and sets `webServer.cwd` to the frontend. Do not commit it.
- Test notes: the Windows clipboard returns CRLF, so the shopping-list UI test
  normalizes line endings. Some source files are CRLF in the working tree;
  scripted edits must match the file's line endings.

### Catalog GLB models (2026-10-29)

The ten home-catalog devices now render from GLB files instead of the
hand-built `Generic*Model` shapes. Merged to `master` as `1f10bfc`
(PR #1; commits `3f556ec` models + generator, `4ee93b6` scene wiring).

Files:
- `public/models/<modelId>.glb` for `office-desk`, `desktop-pc`, `laptop-15`,
  `monitor-24`, `monitor-27`, `ultrawide-monitor`, `router`, `power-strip`,
  `wall-outlet`, `power-adapter`.
- Generator: `tools/blender-models/` (Blender 4.2 headless). See that
  directory's README to regenerate. `common.finalize_and_export()` fits each
  mesh to the catalog dimensions and writes the GLB.
- Wiring: `src/domain/catalog.js` (`catalogModelUrl`), `src/components/SceneObjects.jsx`
  (`GLBModel`, preload, wall-outlet yaw), `src/domain/glb-highlight.js`.

Conventions (must match `SceneObjects.jsx` / `coordinates.js`):
- Metres. Each GLB is built at exactly the catalog `defaultScale`. `GLBModel`
  scales by `obj.scale / defaultScale`, which is 1 until the user resizes.
- Origin is the centre of the bounding box, same as `FallbackBox`.
- Exported glTF +Y up. In three.js: X = width, Y = height, Z = depth, front
  faces +Z (the same side as the screens and front panels on the generic
  shapes). While modelling in Blender the front faces Blender −Y.

Rendering:
- Each catalog `assetUrl` is `models/<modelId>.glb`, prefixed with Vite's
  `import.meta.env.BASE_URL` (root `/` under `node --test`).
- `hydrateProjectObjects` copies `template.assetUrl` over a stored URL, so a
  saved project picks up the current mesh on load even if it stored `null` or
  a stale path.
- `useGLTF.preload` runs for every catalog URL when `SceneObjects.jsx` loads.
- Fallback chain: GLB, then `Generic*Model` when `getGenericModelAsset` has an
  entry, then the plain box. Suspense and the GLTF error boundary both use
  that fallback. Do not delete the generic shapes; they are the failure path.
- Idle materials keep the emissive colour and strength authored in the file
  (`applyGlbHighlight`). Selection, related, and hover still replace emissive,
  so the highlight works and LEDs / the PC fan ring stay lit when nothing is
  selected.

Anchors (`getDefaultPortAnchor` / `PORT_ANCHOR_BY_MODEL`, normalized x width,
y depth, z height; +y is the authored front / three.js +Z):
- Measured from the mesh so new cables meet the connector. Monitors and the
  tower use the rear face (the tower has no molded rear ports, so AC / HDMI /
  DP / Ethernet meet the back panel). Laptop ports sit on the sides of the
  base. Router jacks are on the front, below the antenna midline; the four
  jacks look the same, so DC uses the leftmost. Power-strip sockets are on the
  top; the input is the cable stub at −X. The adapter AC inlet is the front
  centre; DC leaves the back.
- Wall outlet: catalog anchors stay on local −Y. Wall snap aims that side into
  the room. The face plate is authored on +Z, so both the GLB and the generic
  outlet are yawed 180° (`WALL_OUTLET_MESH_YAW`) and the plate lands on the
  room-facing side. Do not flip the anchors to +Y; that would send the cable
  into the wall.
- At the time of PR #1, `withPortAnchors` kept a stored anchor. Claude's
  `c21c28e` later changed hydrate: catalog ports take `PORT_ANCHOR_BY_MODEL`
  again, and a laptop-15 whose height is under 60% of the default is restored
  to the open-lid height (bottom unchanged). Ports and models outside the
  catalog still keep their stored anchors.

Known gaps (seen while checking the 电竞桌 template in Chrome; not fixed):
- Monitor and laptop screens are dark unlit panels, so they read as black.
- Power-load labels (`PowerStatusOverlay`) and cable strokes stay large in
  world/pixel size, so they dominate a close-up.
- The tower has no molded rear I/O; cables end on the rear panel.
- The desk top is oak and the outlet plate is white, not the catalog swatches
  (`#1e88e5`, `#ffeb3b`). Other bodies use the catalog colour.
- The desk cable tray sits on the near edge (catalog −Y) because the desk is
  placed at rotation 0.

Verification on the wiring commit: `npm test` 306/306, `npm run test:ui`
26/26, lint, build (known large-chunk warning). All ten GLBs returned HTTP 200
from the dev server, including ones the template did not place (preload).

### External Chrome DOM runtime check (2026-07-14)

- Performed a real local runtime check with external Chrome headless against
  `http://127.0.0.1:5173/`; no Codex in-app browser, IAB, screenshot, or image
  output was used.
- After a 5-second virtual-time wait, the dumped DOM contained the `DeskLab`
  title, mounted `#root`, an active Three.js canvas (764×316), and the current
  default-project controls: `布局检查 (2)`, `布线检查 (5)`, and `改进建议 (6)`.
- This is DOM/runtime evidence only, not pixel-level visual QA; no screenshot
  was captured or claimed.
- Follow-up button-level interaction succeeded through the same external Chrome
  DevTools endpoint using Windows' built-in .NET WebSocket client. It opened
  `改进建议 (6)`, verified the dialog title `AI 优化与改进建议`, `免费改进 1`,
  `加购建议 5`, and the `一键修复所有免费项 (1)` button, then closed the dialog
  and verified it was gone. No repair, save, screenshot, or project-data write
  was performed; this is interaction-state QA, not pixel-level visual QA.
- A separate temporary-browser run then clicked `一键修复所有免费项 (1)` without
  saving: the live UI changed to `免费改进 0` and the apply-all button vanished.
  After the temporary browser closed, the local API still reported the original
  7 objects and 2 connections, confirming no persisted default-project data was
  changed. Local frontend and backend HTTP checks both remained 200.

Notes on the power-load slices (2026-06-25):
- `analysis.js` now exports `toPowerValue(value)` (coerce wattage/maxLoad to a safe
  non-negative number as defense in depth for malformed transient live state)
  and `classifyPowerLoad(currentLoad, maxLoad)`
  → `'overload' | 'warning' | 'ok'` (with `POWER_WARNING_RATIO = 0.9`).
- Both helpers are the single source of truth for overload/warning thresholds.
  Consumers: `analyzeProjectWiring`, `recommendations.js`, `SceneObjects.jsx`
  `PowerStatusOverlay`, and `PropertiesEditor.jsx` load badge. Do not re-inline
  `currentLoad > maxLoad * 0.9` style math in new UI — reuse `classifyPowerLoad`.
- `recommendations.js` nearest-device loops now use `calculatePositionDistance`
  (from `connections.js`) so a port-bearing object with no/NaN position no longer
  throws — it is simply skipped.

Pre-migration frontend commits preserved in this memory bank for reference only:
```
0e325f6 perf: reuse power graph in overlay
a3dfe4f perf: share power load graph
3e40649 perf: reuse project analysis results
03fc487 fix: clamp property numeric edits
c14f5d2 feat: auto-connect USB-C displays
2468840 test: add DisplayPort coverage for auto_connect_display
```

### Backend `D:\desklab\backend`
- HEAD: `2d67538 chore: resolve npm audit advisories in lockfile`
- Tests: `npm test` → 32 passed. Contracts check passed.
- Untracked (DO NOT touch): `?? .vscode/`
- The backend does not restrict object `type`/`modelId`, so the catalog
  reduction needed no backend change.

Last 5 commits:
```
2d67538 chore: resolve npm audit advisories in lockfile
9ecbcc9 fix: normalize null model metadata
2aa0943 contract: document power metadata in openapi
ddf4c1e contract: allow null port anchors
fd2eb33 fix: preserve null port anchors
```

Always re-check `git status` and recent commits before making changes.

## Frontend Architecture

### Domain modules (`src/domain/`)

Core modules:
- `recommendations.js` — **free improvements + purchase suggestions engine** (see below)
- `analysis.js` — wiring analysis: port validation, power cycle detection, overload/warning, shared `buildPowerGraph()` for load aggregation
- `layout-analysis.js` — layout analysis: overlap, out-of-bounds, floating, outlet-off-wall
- `connections.js` — port compatibility, cable type inference, distance/length evaluation
- `catalog.js` — device catalog (9 home-user models across 5 categories), `catalogModelUrl()` (Vite `BASE_URL`), hydration, port anchors, `describeCatalogModel()` spec lines
- `glb-highlight.js` — idle GLB materials keep their authored emissive; selection, related, and hover replace it
- `placement.js` — new-object placement; with existing objects it searches free spots on/around the desk
- `scene-builder.js` — `buildDeskScene()`: device list → placed, wired, camera-framed scene with notes
- `desk-templates.js` — built-in home-user templates on top of the scene builder
- `shopping-list.js` — merges purchase suggestions into a copyable shopping list
- `geometry.js` — 3D bounds, overlap detection, footprint rotation
- `project-validation.js` — `isProjectEnvelope()` shared by draft.js and local-project-store.js
- `local-project-store.js` — versioned load/save/validate/recovery in the visitor's browser (replaced the HTTP `project-client.js`)
- `project-history.js` — undo/redo with grouping and camera awareness
- `project-access.js` — editability gates for canvas interactions
- `draft.js` / `draft-storage.js` — local draft persistence and recovery
- `identifiers.js` — collision-resistant entity IDs
- `status-notifier.js` — stale-timer-safe status messages
- `keyboard-controls.js` — keyboard shortcuts for object manipulation
- `camera-snapshot.js` / `coordinates.js` / `project-export.js`

Test files under `test/` mirror the domain modules.

### 3D scene (`src/components/SceneObjects.jsx`)

Catalog objects draw `public/models/<modelId>.glb` first. Those files are
generated by `tools/blender-models/` (Blender 4.2 headless) at the catalog
`defaultScale`, bbox-centred, glTF +Y up, front toward three.js +Z. If the GLB
is missing or fails to load, the generic shape for that `modelId` is used, then
the plain box. `useGLTF.preload` fetches every catalog model when the module
loads. The wall-outlet mesh is yawed 180° so its face plate meets the
room-facing anchors. See "Catalog GLB models (2026-10-29)".

### Recommendations Module (`recommendations.js`)

**Free improvements** (`buildFreeImprovements(room, objects, connections)`):
| Code | Rank | Description |
|------|------|-------------|
| `move_inside_room` | 0 | Move out-of-bounds object inside room |
| `drop_to_support` | 1 | Drop floating object to support/floor |
| `snap_outlet_to_wall` | 2 | Snap wall outlet to nearest wall |
| `auto_power_device` | 3 | Connect unpowered device to nearest power source (engine only; hidden from `buildRecommendations`, used by `buildPowerCompletion` on add) |
| `auto_network_device` | 4 | Connect an unnetworked device to the nearest router (engine only, like power) |
| `auto_connect_display` | 5 | Connect HDMI/DP/USB-C output to nearest monitor, one cable per pair (engine only, like power) |
| `extend_cable` | 6 | Extend cable to recommended length |

**Purchase suggestions** (`buildPurchaseSuggestions(objects, connections)`):
| Code | Trigger |
|------|---------|
| `fix_power_strip_chain` | Daisy-chained power strips → rewire to a wall outlet or use one larger strip |
| `buy_cable` | Short cable / low slack → longer cable |
| `buy_power_strip_for_outlets` | Devices needing a plug exceed modeled AC outlets → N strips (product.quantity) |
| `split_overloaded_power` | Power hub external load > maxLoad → move devices to another outlet / add a strip |

No networking hardware is recommended for purchase.

**Patch application**:
- `applyImprovement(project, suggestion)` — apply single patch (layout/cable/newConnection)
- `applyAllImprovements(project, suggestions)` — apply all sequentially
- `buildRecommendations(project, options?)` — facade returning `{ freeImprovements, purchases, total }`; accepts precomputed `wiringIssues` to avoid repeated analysis in UI render paths.

All suggestion types are round-trip tested: applying the suggested patch clears the corresponding analysis issue.

### Key architectural patterns:
- Nested `Map<string, Map<string, *>>` for port occupancy tracking (NOT string-key concatenation)
- `isProjectEnvelope()` shared by draft.js and local-project-store.js for validation parity
- UI delegates to domain logic; no duplicated math in components
- Cable types inferred via `inferCableType()`, not hardcoded

## Backend Architecture

Source:
```
D:\desklab\backend\src\store.js     — atomic file writes, backup/recovery, ETag versioning
D:\desklab\backend\src\validate.js  — request body validation and normalization
```

Tests: `D:\desklab\backend\test\server.test.js`, `D:\desklab\backend\test\validate.test.js`
Contracts: `D:\desklab\backend\contracts\project.schema.json`, `openapi.yaml`

### Key backend facts:
- `validateProjectBody` normalizes and strips unknown fields. Known optional fields: `category`, `modelId`, `assetUrl`, `color`, `wattage`, `maxLoad`, `ports`, `camera`, `connections`.
- `wattage` and `maxLoad` are validated as non-negative finite numbers when present (fixed in `e15b9de`).
- Port occupancy uses nested Maps (matching frontend pattern).
- 5MB request body limit. Optimistic concurrency with `If-Match` / `ETag`.
- Backup recovery via `/api/projects/default/recover-backup`.

## Remote Demo Deployment Policy

- The remote demo environment is not the primary development backend. Use the
  local backend at port `3001` during normal development.
- Do not deploy to, restart, or depend on a remote environment unless the user
  explicitly requests deployment or demo work.
- Host addresses, tunnel URLs, service names, and credential locations are kept
  out of this tracked memory bank so the public repository contains no private
  infrastructure access details.

## Verification Gates

Frontend:
```bash
cd D:\desklab\frontend
npm test          # 394 domain tests
npm run test:ui   # 108 Chrome UI cases (107 run, 1 phone-only skipped on desktop); storage seeded per test, no backend
npm run lint      # eslint .
npm run build     # vite build (the >500 KB warning is the three.js chunk; OK)
```

Backend:
```bash
cd D:\desklab\backend
npm test              # 32 tests
npm run check:contracts  # schema + openapi checks
```

If rendered UI behavior changes, do browser QA against localhost if browser runtime works.

## High-Value Next Work

The autonomous hardening backlog and recommendation foundation are complete.
Do not resume open-ended malformed-state hardening; it had stopped producing
user-visible value. Done so far: home-user catalog reduction (2026-10-25);
templates, device-list builder, and shopping list (2026-10-28).

1. **Blocked on a product decision: LLM provider** (domestic vs Claude). Once
   chosen, the "describe your desk" flow is: backend endpoint (API key server
   side, rate limited) asks the LLM for the `{ desk, devices }` JSON that
   `DeskBuilderForm` already produces, then `buildDeskScene()` places and wires
   it and its notes are shown. The LLM never invents device ids; unsupported
   ids are dropped with a note by the builder.

2. **Candidates not yet confirmed with the product owner**:
   - LLM explanations of each suggestion and grounded Q&A.
   - Simpler manual connection flow (today: pick ports, cable type, length).
   - Launch basics: multiple projects/accounts, deployment, LLM cost limits.
   - Code-splitting the 1.46MB bundle.

3. **Always start from current evidence**:
```bash
cd D:\desklab\frontend
git status --short
git log -5 --oneline

cd D:\desklab\backend
git status --short
git log -5 --oneline
```

## Communication Style

The user is the product owner. Keep updates brief: what was found, what was changed, files changed, verification run, commit SHA. Do not ask for "Proceed" on ordinary code work.

## Quick Start for Next Agent

1. Re-check git state and recent commits for both repos.
2. Check or start services as needed (frontend :5173, backend :3001).
3. Pick one high-value, reproducible issue.
4. Write a failing test first where practical.
5. Make the smallest fix.
6. Run full verification.
7. Commit only relevant files.
8. In the same PR, append one 进度记录 entry (see 协作规则 at the top). Do not wait for a separate docs pass.
