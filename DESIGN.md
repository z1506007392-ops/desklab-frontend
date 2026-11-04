---
name: DeskLab
description: 在 3D 里摆好自己的桌面、理顺线材的规划工具；视觉方向"桌搭标签"。
colors:
  ground: "#f2f3f5"
  surface: "#ffffff"
  fill: "#eceef1"
  fill-hover: "#e2e5e9"
  fill-press: "#d8dce1"
  line: "#e4e6ea"
  ink: "#1b1b1f"
  ink-2: "#55565e"
  ink-3: "#64666f"
  ink-disabled: "#9a9ca5"
  tag-dot: "#f2357a"
  tag-dot-ink: "#c4185a"
  ok: "#18794e"
  warn: "#8f5500"
  warn-bg: "#fff3d9"
  warn-dot: "#d98a00"
  bad: "#b42318"
  bad-bg: "#fdecea"
typography:
  display:
    fontFamily: "PingFang SC, HarmonyOS Sans SC, Microsoft YaHei UI, Microsoft YaHei, Noto Sans SC, Noto Sans CJK SC, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 800
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "PingFang SC, HarmonyOS Sans SC, Microsoft YaHei UI, Microsoft YaHei, Noto Sans SC, Noto Sans CJK SC, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 800
  title:
    fontFamily: "PingFang SC, HarmonyOS Sans SC, Microsoft YaHei UI, Microsoft YaHei, Noto Sans SC, Noto Sans CJK SC, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 800
  body:
    fontFamily: "PingFang SC, HarmonyOS Sans SC, Microsoft YaHei UI, Microsoft YaHei, Noto Sans SC, Noto Sans CJK SC, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "PingFang SC, HarmonyOS Sans SC, Microsoft YaHei UI, Microsoft YaHei, Noto Sans SC, Noto Sans CJK SC, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 500
rounded:
  pill: "999px"
  field: "10px"
  card: "14px"
  dialog: "18px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button:
    backgroundColor: "{colors.fill}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    height: "32px"
    padding: "0 14px"
  button-hover:
    backgroundColor: "{colors.fill-hover}"
  button-active:
    backgroundColor: "{colors.fill-press}"
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.pill}"
    height: "32px"
    padding: "0 14px"
  button-tag:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    height: "32px"
    padding: "0 14px"
  button-danger:
    backgroundColor: "{colors.bad-bg}"
    textColor: "{colors.bad}"
    rounded: "{rounded.pill}"
    height: "32px"
  input:
    backgroundColor: "{colors.fill}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    height: "32px"
    padding: "0 10px"
  input-focus:
    backgroundColor: "{colors.surface}"
  chip:
    backgroundColor: "{colors.fill}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    height: "30px"
    padding: "0 12px"
  chip-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
  list-card:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "12px 14px"
  dialog:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.dialog}"
  status-toast:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "8px 16px 8px 14px"
---

# Design System: DeskLab

## Overview

**Creative North Star: "桌搭标签"（The Tagged Desk Post）**

DeskLab 看起来像一篇桌搭分享帖：用户自己的桌面是那张照片，界面是照片旁边干净的白纸和浅灰底。帖子里给物品打的小白标签，在这里专门用来标出三件事：选中的设备、需要处理的问题、改进建议。其余一切都退到后面，让人一眼先看到自己的桌子。

这是一个干活用的界面（Operate）：熟悉的按钮、输入框、标签页，密度适中，亮色，因为用户白天边看着真桌子边规划。负责人明确不要的三种感觉：像后台管理系统、像通用 AI 模板（米色底、到处一样的圆角卡片和阴影）、像专业 CAD 软件。

3D 场景（背景、网格、灯光、模型）不属于这套界面系统，由负责人冻结，界面改版不碰它。例外是 Leo 2026-11-04 批准的空房间外壳（E156）：实心地板、靠里的墙、去掉无限网格，角落坐标轴默认关闭。设备模型、原有灯光强度和预设不在这次例外里。

**Key Characteristics:**
- 冷调浅灰底（#f2f3f5）上放纯白面板，不用米色、不用描边框。
- 所有按钮都是无边框胶囊，只有"保存项目"是墨色实心。
- 粉色圆点是唯一的强调色，一屏上只出现在少数几个标签上。
- 只有浮起的东西才有阴影：标签、菜单、弹窗、提示。
- 一种系统中文字体，靠 500 / 600 / 800 三档字重分层。

## Colors

一套几乎全中性的冷灰，加一个粉色圆点；绿、琥珀、红只在检查结果里出现。

### Primary
- **标签粉**（tag-dot）：标签上的圆点和它外面 3px 的淡粉光圈。只用于选中的设备、要处理的问题、改进建议入口、"未保存"。
- **深标签粉**（tag-dot-ink）：粉色需要当文字或数字用时（问题数量、"未保存"），用这个更深的粉，保证在白底上对比度够。

### Neutral
- **墨**（ink）：正文、标题、主按钮底色。不用纯黑。
- **说明灰**（ink-2）：次要文字、字段名、提示条文字。
- **安静灰**（ink-3）：输入框占位字、更次要的备注。
- **禁用灰**（ink-disabled）：只用于禁用状态。
- **底灰**（ground）：整个应用的底色、提示条、面板里的列表卡片。
- **纸白**（surface）：面板、弹窗、标签、菜单。
- **胶囊灰**（fill / fill-hover / fill-press）：按钮和输入框的底，悬停和按下逐级加深。
- **细线**（line）：面板内分区的 1px 分隔线。

### 状态色
- **通过绿**（ok）、**警告琥珀**（warn、warn-bg，圆点用 warn-dot）、**出错红**（bad、bad-bg）：只用在检查结果、线长判断、用电负载、保存/导入结果上。"提示"级别的信息用中性灰，不另加颜色。

### Named Rules
**The One Dot Rule.** 粉色只属于圆点和它标出的东西。不拿粉色做按钮底、标题、装饰或大面积色块；新功能想"醒目一点"时，用标签，不用新颜色。

**The Three States Rule.** 状态色只有绿、琥珀、红三种，而且必须代表真实的检查结果。不加蓝色"信息色"，不加第五种色相。

## Typography

**字体：** 系统中文无衬线（PingFang SC / HarmonyOS Sans SC / Microsoft YaHei / Noto Sans SC），一种字体包办所有层级。

**Character:** 普通、易读、不抢戏，像手机系统自带的字。层级靠字重和字号，不靠换字体。

### Hierarchy
- **Display**（800，17px，字距 -0.01em）：工具栏上的 DeskLab 名字、开始引导标题。
- **Headline**（800，18px）：弹窗标题。
- **Title**（800，14px；面板标题 16px）：面板分区标题、模板名称、建议分组标题。
- **Body**（400，13px，行高 1.6）：说明文字、提示、弹窗正文。
- **Label**（500，12–13px）：普通按钮文字（13px/500）、分类标签、字段名；需要强调时（主按钮、标签按钮、选中的标签页、设备名）用 600。数量数字用 800。

### Named Rules
**The Three Weights Rule.** 只用 500、600、800 三档（正文 400）。不用 700：Windows 上的微软雅黑只有 400/700 两档，多一档就会和别的层级糊成一样粗。

**The Numbers Line Up Rule.** 输入框、数量、清单里的数字一律等宽数字（tabular-nums）。

## Layout

固定的四块：顶部工具栏、左边资产库（260px）、右边属性面板（320px）、中间 3D 画面；工具栏下方是一条浅灰提示条。这套结构由负责人固定，不改。

- **桌面（≥900px）：** 工具栏第一行是名字、桌面模板、社区图库；第二行右对齐，按"编辑 / 检查 / 面板 / 保存"分四组，组内间距 8px，组间 20px，"保存项目"永远在最右。房间大小不在这一行。
- **手机（<900px）：** 工具栏两行，约 95px 高。第一行是名字、未保存、撤销、重做、保存；第二行是一条可以横向滑动的按钮条（两端渐隐），里面有社区图库。左右面板变成从边上滑出的抽屉。窄于 360px 时隐藏名字。房间大小不在按钮条上。
- **房间大小：** 第一次进入是整页选择。之后从「更多 → 设置」改长、宽、高，或回到那一页重选。主界面不放这几个控件。
- **间距节奏：** 4 / 8 / 12 / 16 / 24px；分区标题上方的空比下方多。
- **触屏：** 按钮、分类、关闭、标签页的可点范围至少 44×44px（透明扩展区），看起来大小不变。

### Named Rules
**The Still Toolbar Rule.** 工具栏的按钮位置不随状态变化。临时消息（已保存、导入失败）以浮起标签出现在屏幕下方居中，不插进工具栏，不挡点击。

## Elevation & Depth

默认是平的：面板、按钮、卡片都靠底色深浅分层（底灰 → 纸白 → 胶囊灰），不靠阴影和描边。只有浮在上面的东西才有阴影，而且都是带偏移的柔和双层阴影。

### Shadow Vocabulary
- **标签浮起**（`0 1px 2px rgba(27,27,31,.08), 0 4px 12px rgba(27,27,31,.08)`）：标签按钮、提示条和 3D 画面里的选中标签。
- **菜单浮起**（`0 2px 6px rgba(27,27,31,.08), 0 12px 32px rgba(27,27,31,.14)`）：更多菜单、连线模式提示、底部消息。
- **弹窗浮起**（`0 2px 6px rgba(27,27,31,.06), 0 24px 60px rgba(27,27,31,.18)`）：弹窗、开始引导、手机上的抽屉面板。

### Named Rules
**The Only Floating Things Cast Shadows Rule.** 静止在页面里的东西（按钮、输入框、列表卡片、面板）没有阴影。要让某个东西"浮起来"，它必须真的叠在别的内容上，或者是一个标签。

## Shapes

圆润但分层：可以点的控件是全圆角胶囊（999px），输入框 10px，列表卡片 14px，弹窗 18px。不用描边框；分区用 1px 细线。图标在 16px 网格上，统一 1.75px 圆头线条（`src/components/Icons.jsx`），颜色跟随文字。

## Components

### Buttons
- **Shape:** 全圆角胶囊（999px），高 32px，左右 14px。
- **普通：** 胶囊灰底、墨色字、500 字重；悬停加深一级，按下再加深一级并缩到 0.97。
- **主按钮（保存项目等）：** 墨色底、白字、600。一屏只有一个。
- **危险（删除）：** 淡红底、红字。
- **Focus：** 2px 墨色描边，外扩 2px。
- **放在浅灰卡片里的次要按钮** 用纸白底，免得和卡片糊在一起。

### 标签按钮（Signature）
白底、标签浮起阴影、左边一个 8px 粉色圆点带 3px 淡粉光圈、600 字重。"改进建议"一直是标签；"布局检查""布线检查"只有在有问题要处理时才变成标签，问题数量用深标签粉的数字写在文字后面（按钮的读屏名称仍是"布局检查 (1)"）。

### 选中标签（Signature）
选中设备时出现两个白色圆点标签：
- **3D 画面里**：钉在设备正上方，只写设备名，像桌搭帖在照片上给物品打的标签。它画在盖在画布上的一层里，不挡 3D 操作，会被弹窗和手机抽屉盖住，读屏跳过它。
- **提示条里**："已选中：设备名"，给读屏和操作提示用，不做动效。提示条下面有「移动 / 旋转」两个胶囊，按下的那个是墨色底白字，和分类标签的选中态一样。

整套界面唯一刻意安排的动效在 3D 里的标签上：200ms 弹入，圆点光圈 600ms 收拢一次；每次选中新设备都重放。

### 功耗标签
墙插、插排、电源适配器接近上限（超过 90%）或超载时，设备正上方出现同样的白色圆点标签，写"超载 497W / 450W"或"接近上限 …"。它标的是要处理的问题，所以用粉点，不用状态色；没事时不出现，负载数字留在属性面板的"已接负载"里。和选中标签同一层、同样不挡操作、读屏跳过（超载在布线检查里有）；不做弹入，动效只留给选中标签。选中的设备不挂功耗标签，两张标签不叠在一起。

### 控制柄
选中且可以编辑时，设备上出现移动和旋转控制柄（不缩放）。颜色跟房间角落的坐标轴一致：左右红、前后绿、上下蓝。旋转只留上下那一圈，因为项目只记绕垂直轴的角度，一格 15°，和 Q / E 相同。拖控制柄和拖设备本身走同一套位置数据和一步撤销。背景、网格、灯光、模型仍不改。

### Chips
- **分类标签：** 胶囊灰底、500 字重、高 30px；选中时墨色底白字。
- **检查汇总：** 小胶囊，用对应状态的浅底和深字（严重 / 警告 / 提示，提示为中性灰）。

### Cards / Containers
- **列表卡片**（资产、连接、模板、问题、AI 建议）：底灰、14px 圆角、无边框、无阴影，内边距 12–14px。
- **资产卡片的设备小图：** 左边 56px 的白色圆角方块（10px），放从仓库 GLB 渲染的透明底图片（前右上方视角，插排从上方看）。图片由 `tools/thumbnails/render-thumbnails.mjs` 生成，不手画、不用照片。
- **检查问题卡片：** 左边一个带光圈的状态圆点代替彩色边条。
- **不要卡片套卡片：** AI 建议区是一个用细线隔开的分区，不是一个带边框的盒子。

### Inputs / Fields
- **Style:** 胶囊灰底、无可见描边、10px 圆角、高 32px；下拉框用同线宽的画出来的箭头。
- **Focus:** 背景变纸白，1px 墨色边，外加 3px 淡墨光圈。
- **Disabled:** 更浅的灰底和禁用灰字。

### Navigation
- **属性 / 连接 标签页：** 分段胶囊；未选中透明底、说明灰、500；选中胶囊灰底、墨色、600。
- **更多菜单：** 纸白、14px 圆角、菜单阴影，从按钮右上角 150ms 展开；菜单项高 32px（触屏 44px），悬停胶囊灰底。

### 底部消息
纸白胶囊、菜单阴影，绿色或红色圆点；出错时文字为红色。固定在屏幕下方居中，不响应鼠标。

### 动效
只交代"什么变了"：150–200ms，`cubic-bezier(0.23, 1, 0.32, 1)` 缓出，只动 transform 和 opacity，不从 0 缩放。弹窗淡入上浮、菜单从右上角展开、手机抽屉从边上滑入。系统开了"减少动态效果"时全部只淡入。

## Do's and Don'ts

### Do:
- **Do** 用标签（白底 + 粉色圆点）标出需要用户注意的东西，并且只标这些。
- **Do** 从 `src/App.css` 顶部的变量取颜色、圆角、阴影、字号；新颜色先进变量再用。
- **Do** 让文字对比度至少 4.5:1；`test/text-contrast.test.js` 会检查变量里的文字颜色。
- **Do** 新增图标时画在 16px 网格上、1.75px 圆头线条，放进 `Icons.jsx`。
- **Do** 手机和桌面都截图看一遍再提交；按钮文字保持不变，界面测试按文字找按钮。

### Don't:
- **Don't** 用米色或暖色底、衬线大标题、赤陶色强调（负责人不要通用 AI 模板感）。
- **Don't** 做成灰底满屏描边按钮和表格的后台风格，也不要做成工程图、尺寸标注式的 CAD 风格。
- **Don't** 在卡片、提示、问题项上加超过 1px 的彩色左/右边条，用状态圆点代替。
- **Don't** 用 emoji 或 ×、−、+ 这类文字字符当图标。
- **Don't** 用渐变、毛玻璃、发光边当装饰，也不要硬边偏移阴影。
- **Don't** 加第四种状态色（比如蓝色"信息色"）或第二种强调色。
- **Don't** 改 3D 场景的背景、网格、灯光和模型外观（负责人冻结）。E156 的空房间外壳是负责人单独批准的，不要把它退回线框和无限网格。
