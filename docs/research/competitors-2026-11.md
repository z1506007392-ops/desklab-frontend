# 竞品调研（2026-11-04）

查阅日期：2026-11-04（北京时间）。只记录这次打开或检索到的页面。页面会改，价格和人数以当天看到的文字为准。查不到的写「未查到」，不补猜测。

这次对照的是 DeskLab 已有的能力，不是把 DeskLab 做成另一家装修软件。提案 E96–E100 在 `docs/AUTONOMOUS_ROADMAP.md` 阶段 E，状态都是「等负责人决定」，这里不重复实现步骤。

## 这次没打开的页面

- `https://www.reddit.com/r/battlestations` 和 `https://old.reddit.com/r/battlestations/` 超时。订阅人数未查到。第三方分析站上的人数没有引用。
- 美国宜家 SIGNUM 商品页打开后落到了总商品推荐，不是这件线槽。尺寸和标价改用新加坡、澳洲、印度、菲律宾的商品页。
- 宜家中国书桌设计工具 `https://www.ikea.cn/cn/zh/planners/byod-planner/` 的标题是「宜家书桌设计工具」，正文是「加载中」。工具里具体有哪些步骤，未查到。
- Ergotron 规划器按身高画出的厘米数不在抓到的 HTML 里。未抄任何一张身高对照表。
- 酷家乐云设计主站上的用户数、日产出和年费档，这次没有打开该页，不引用检索摘要里的宣传数字。打开的是 AI 会员页。
- 小红书、B 站没有打开官方产品页。未查到它们提供桌面 3D 规划。桌搭照片在这些社区很常见，这次不把它们写成功能清单。

## DeskLab 现在有什么

代码和关于页，2026-11-04：

- 16 个通用模型：书桌、台式主机、15 英寸笔记本、24 寸 / 27 寸 / 带鱼屏、键盘、鼠标、台灯、音箱、路由器、插排、墙壁插座、电源适配器、游戏主机、显示器支架。没有椅子、麦克风、摄像头、悬臂挂架、线槽。书桌默认 1.4×0.7×0.75 米。
- 线沿桌面走到后沿或侧边，不穿桌板。购线清单按走线加 0.2 米，再取 0.5 / 1 / 1.5 / 2 / 3 / 5 米（更长按 5 米一档）。键盘和鼠标的线自带，不进清单。可以导出布线表。没有价格，没有商店链接。E25 定过不接商城、不编价格。
- 布局提示里，屏幕「离人太近」是座位点到屏幕近边小于 0.45 米。座位点在桌前沿再向外 0.35 米。不问身高。
- 分享是地址栏里的压缩链接，只读，对方确认后才能复制到自己的项目。超过约 2000 字会提示可能在微信里打不开。
- 存档键是 `desklab.project.v1`，一份当前项目。关于页写：项目只在这台浏览器里，不会上传；分享链接里含有房间、设备和连线；不做统计和广告追踪。邮箱登录只用于 AI 和每日次数。
- 已经从目录删掉、不能加回来的：UPS、交换机、NAS、光猫、迷你主机、一体机。

## 整间屋子

这些产品和 DeskLab 不是同一件事。它们画墙、摆家具、出效果图。DeskLab 画的是一张桌子上的接口和线。列在这里是为了看清边界。

### 宜家 Kreativ 和书桌配置器

- 美国帮助页：[What is IKEA Kreativ?](https://www.ikea.com/us/en/customer-service/knowledge/articles/43460e1e-dd01-4fe8-86ac-74efecd7743f.html)、[Getting started](https://www.ikea.com/us/en/customer-service/knowledge/articles/982f84a7-5941-45a8-a34a-1727c57dcc7f.html)。免费。可以拍或上传房间照片再擦掉家具，在 App 里用 LiDAR 扫描（网页改为手填尺寸），或从 50 多个现成房间开始。帮助页写尚未支持：纺织品、吊装（吊灯、窗帘杆）、零件（拉手、铰链）、完整厨房（厨房另有规划器）。同一篇入门说明写可以复制一份设计。
- 美国规划工具总页：[Design and planning tools](https://www.ikea.com/us/en/planners/)。有分房间的规划器，也有「Build your own desk」：桌面、桌腿、储物混搭。
- 新加坡书桌配置器：[Build your own desk Planner](https://www.ikea.com/sg/en/planners/desk-planner/)。页面写选择桌面、桌腿或桌脚，以及附件、抽屉。
- 日本规划工具页：[Planning tools](https://www.ikea.com/jp/en/planners/)。写卧室、客厅、餐厅、入口、办公、儿童房这些规划器在 2026-09-30 之后不能新建方案（已有方案可编辑到 2027-04-30），之后用 Kreativ。
- 宜家中国：[组合书桌](https://www.ikea.cn/cn/zh/cat/zu-he-shu-zhuo-xi-lie-11811/) 写可以自己配桌面、桌腿、支架、抽屉，设计工具会一步步引导。工具页本身这次没加载出来。中国站 [更多服务里的设计工具](https://www.ikea.cn/cn/zh/more/more/) 列出的是衣柜、视听储物柜、浴室、书柜，没有看到和美国站并列的那一排房间规划器。
- 和 DeskLab：宜家卖的是自己的家具，规划完就能买。DeskLab 的书桌是一只通用模型，不对应某个货号。宜家这些页没写 HDMI、插排容量或线长。

### Planner 5D

[定价页](https://planner5d.com/pricing)，2026-11-04：

- 免费：0 美元。不限项目数，可分享，网页和手机，家具目录的 50%。
- Premium：大字写每月 4.99 美元，旁边写按年付 59.99 美元或按月付 19.99 美元。FAQ 写按月 19.99 美元、按年 59.99 美元。页面里的结构化数据也是月付 19.99、年付 59.99。4.99 是年付折到每个月的展示，不是月付账单。含：上传平面图转成 3D、1 万件以上家具、从照片做 3D 模型、标准渲染、Budget Widget（计划和跟踪花费）。
- Professional：大字每月 33.33 美元，旁边写按年 399.99 或按月 49.99。FAQ 与此一致。另有 4K 渲染、自带模型（obj、fbx、blend、stl 等）、360°、CAD 导出、报价清单、品牌主页。
- FAQ 写每个档位含免费都能用邮件或链接邀请别人查看或一起改。
- 未查到 Budget Widget 是否接入某家零售商的实时标价。

首页 [planner5d.com](https://planner5d.com/) 写 2D/3D、家具库、渲染。它是装修工具。没有接口和线长。

### Sweet Home 3D

[官网](https://www.sweethome3d.com/) 和 [下载页](https://www.sweethome3d.com/download/)：免费的室内软件，画墙、从目录拖家具、3D 预览。下载页写完整版带 1 万个以上模型和 400 张纹理。macOS：商店付费版 10894 件家具、423 张纹理；SourceForge 免费版 929 件家具、26 张纹理。Windows：商店付费版 10836 件家具、423 张纹理；免费版 100 件家具、26 张纹理。可以导入 OBJ、DAE、3DS、KMZ。[用户指南](https://www.sweethome3d.com/users-guide/) 讲的是户型、家具和渲染。指南和下载页没有写接口、线长或插排负载。未查到它做这些。

### 酷家乐

这次打开的是 [酷家乐 AI](https://ai.kujiale.com/pub/ai)：

- 免费版：0 元/月。访问全部 AI 模型，基础分辨率，带水印，无商用授权。
- AI PRO：首年 499 元。页面写去品牌水印、商用授权、AI 实时渲染，高清离线渲染只写了普通 1K 和全景 2K。赠送额度那几行在抓取结果里被截断，具体次数未引用。

这是效果图和 AI 出图，不是桌面布线。云设计主站的价格和用户规模未查到（见文首）。

## 只做桌子、用真实商品

### Juddesk

[juddesk.com](https://www.juddesk.com/)，2026-11-04 打开的首页：

- 浏览器里的 3D 桌子。免费，不注册就能摆，写明没有次数限制。
- 「100+ real products」，按真实尺寸。举例：Secretlab MAGNUS Pro XL、Herman Miller Aeron（Size B）、Lian Li 机箱、LG 带鱼屏、Apple Studio Display XDR、WOBKEY 键盘、罗技鼠标、Elgato Stream Deck、Rode 麦克风、IKEA ELLOVEN 支架。还有椅子、灯、植物。
- 可以改地板和墙。分享链接不需要账号。可以下载图片。可以发到社区图库，别人 remix；公开时显示缩短后的名字，可以取消公开。命名槽位用 Google 登录，可选。
- 零件单可以打开去买放下的那件商品。首页没有写佣金比例，未查到它怎么从购买里分成。
- 网站自己写 “Backed by JUDDESKCOM — 250K across Facebook, Instagram, TikTok & YouTube.” 这是页面上的话，没有另核粉丝数。
- 首页没有写接口兼容、线长、插排过载。未查到这些功能。

和 DeskLab 最接近的是「在浏览器里摆一张桌子再分享」。差别是 Juddesk 用品牌货和购物，DeskLab 用通用模型和线。

### Desk Setup Builder

[desksetupbuilder.com](https://www.desksetupbuilder.com/)：用真实产品在 3D 里设计，记下已有和想买的，分享或浏览别人的桌子。2026-11-04 首页写 “490 desks designed so far”。有按风格和预算挑选的清单，其中一条写 “Under $500 total”。页面没有写这 500 美元怎么算出来，未查到是实时价格还是编辑写的。首页可见 LED 灯带、灯板、房间装修。没有看到线长或插排。未查到收费价格。

## 线材

### 宜家 SIGNUM

货号 102.002.54，装在桌面底下的钢制线槽。

| 页面 | 这次看到的标价 | 尺寸 |
|---|---|---|
| [新加坡](https://www.ikea.com/sg/en/p/signum-cable-trunking-horizontal-silver-colour-10200254/) | 9.90 新加坡元 | 长 70 厘米，宽 16 厘米，最大承重 10 千克 |
| [澳洲](https://www.ikea.com/au/en/p/signum-cable-trunking-horizontal-silver-colour-10200254/) | 15 澳元 | 同上 |
| [印度](https://www.ikea.com/in/en/p/signum-cable-trunking-horizontal-silver-colour-10200254/) | 699 印度卢比 | 同上 |
| [菲律宾](https://www.ikea.com/ph/en/p/signum-cable-management-horizontal-silver-color-10200254/) | 499 菲律宾比索 | 同上 |

不能用于玻璃桌面。中国站是否在售、人民币价格，未查到。它是商品，不是规划软件。评论里有人写槽太浅、电源和充电器放不进去（澳洲页），这是个别人的评价，不是测量。

### Roomiva

[Cable Management Planner](https://roomivahome.com/cable-management-planner/)：一张表，字段是桌上设备数量、桌宽（英寸）、显示器支架数量、有没有落地或墙壁插座，按钮写 “Plan My Cables”。抓取结果里没有算出的购物清单，未查到按钮按下之后给出什么数字。页下半是英文说明，自己的公式包括：购买长度 = 实测 + 12 英寸；美标 15 安插排按 80% 约 1440 瓦。这些是该页的说法，不是 DeskLab 该照搬的国标。页上写一张桌子通常有 8 到 14 根线，没有出处，不采用。

未查到另一家消费级网站同时做：按接口判断线能不能接、按绕桌走线给购买长度、再在 3D 里放一只线槽。机柜向的 [Homelab Twin](https://rack-density.com/homelab/) 只在检索摘要里看到，写的是机柜、UPS 和交换机，不是书桌。本次没有单独打开，不展开。

## 晒桌搭

### PCPartPicker

- [关于](https://pcpartpicker.com/about/)：选零件、兼容提示、多家零售商价格、分享零件单、论坛、完成的装机可以按零件筛选。
- [完成的装机](https://pcpartpicker.com/builds/)：可按价格区间、发布日期、评分排序。英国站首页检索到的句子是 “Browse thousands of PCs built by users showing their partlist, photos and overall build experience.” 「thousands」是网站自己的话，没有另数条数。
- [披露](https://pcpartpicker.com/disclosure/)：通过与列出的商家的联盟关系获得报酬；这不影响评测、跑分、内容和观点。不接受捐赠，联盟收入用于维护和功能。德国站零件单页脚另写：报酬不影响展示哪些产品、什么价格、价格的排序。
- 论坛里员工说过用户不能生成自己的联盟链接（[帖子](https://pcpartpicker.com/forums/topic/426204-feature-request-affiliate-links)），工作人员回复不会加这个功能。具体佣金百分比，披露页没写，未查到。
- 它管的是机箱里的零件和显示器、键鼠，不是桌下的走线。

### Reddit r/battlestations

现行规则和订阅人数未查到（页面超时）。

搜索工具打开过旧帖 [My PLP setup](https://old.reddit.com/r/battlestations/comments/aogog4/my_plp_setup/)，侧栏写规则自 2019-08-09 起，其中有：完整电脑桌的实拍；笔记本至少外接显示器和键鼠；只要照片，不要 CAD 或 AI 图；必须是自己在用的；禁止联盟链接和广告。这是旧帖页面上的侧栏，不是这次打开的规则页，不能当成仍生效。

若这些限制还在，3D 渲染图库和这个版块不是同一类内容。Juddesk、Desk Setup Builder 收的是 3D，不是实拍。

### Loadout、MySetup、DeskFlex

- [loadout.app](https://loadout.app/)：上传实拍，在照片上点热点，写产品名和链接，分享个人页。[图库](https://loadout.app/gallery) 是一张张照片。打开的 [一个个人页](https://loadout.app/kelex) 把用户自己填的价格加总成 2607 美元。这是用户填写的数字，不是商店实时价。没有 3D，也没有线长。
- [mysetup.is](https://mysetup.is/)：发照片、给整套设置打分、保留多套和升级历史。页面把兼容、功耗、对比写成产品要做的事，并写 “is being designed”。本次没有打开一条已经算出的兼容或功耗结果。未查到收费价格。
- [deskflexhq.com](https://deskflexhq.com/)：照片图库加讨论。免费：1 套公开桌子、5 张照片、1 个收藏列表。Premium：每月 5 美元或每年 40 美元，可随时在设置里取消，已付时间用完为止。付费后：多套桌子、最多 20 张照片、前后对比滑块、改动日志、最多 12 个相册、隐藏不公开、多个收藏列表、可参与 Desk of the Week 和偶尔的比赛。页面没有写联盟佣金。未查到。

## 人体工学

### Ergotron

[Workspace Planner](https://www.ergotron.com/tools/workspace-planner)：点选身高，用 BIFMA G1 的数据摆显示器、键盘和椅子，坐着或站着。身高从 5 英尺 0 英寸到 6 英尺 4 英寸。页面同时写视距 20 到 30 英寸、屏幕倾角 10° 到 20°。双光眼镜：再低 6 英寸、上倾 30° 到 40°、拉近到眼睛 16 英寸内。页末建议买他们的升降台或显示器挂架。[公制页](https://www.ergotron.com/portals/0/html/planner/metric-sit-stand1.html) 列出 152、155、157、160、163、165、168、170、173、175、178、180、183、185、188、191、193 厘米，视距写 50–75 厘米。每个身高下面的显示器、键盘、座椅高度，这次没读到，未查到。

[工作表 PDF](https://www.ergotron.com/portals/0/literature/guidelines/workspace-planning-tool-worksheet.pdf) 写：这些值是该身高的平均尺寸，不含性别、年龄、体型差别；来自 1988 年美军人体测量；没算衣服，要另加鞋高；当作起点，不是最终安装高度。

### OSHA

[显示器一节](https://www.osha.gov/etools/computer-workstations/components/monitors)，公开说明，不是商品：

- 屏幕放在正前方，至少 20 英寸（约 50 厘米）。
- 屏幕上沿在眼睛高度或略低。
- 从眼睛到屏幕，一般以 20 到 40 英寸（50 到 100 厘米）为宜。字小的屏幕可能要把字号加大。
- 屏幕中心通常在水平视线往下 15° 到 20°。
- 不要偏到左右 35° 以外。
- 双光眼镜：把屏幕放得比一般建议更低，并朝上倾；或者换一副适合看屏幕的单光镜。
- 倾角通常不超过 10° 到 20°，否则天花板的灯会反光。

DeskLab 的 0.45 米是座位点到屏幕近边。OSHA 的 50 厘米是眼睛到屏幕。两段长度不能直接比大小。Ergotron 美国页写 20–30 英寸，OSHA 写 20–40 英寸，两家公开说法也不完全一样。

## 见到的收费方式

| 方式 | 这次看到的例子 | 和 DeskLab 的关系 |
|---|---|---|
| 免费工具，靠联盟链接 | PCPartPicker 披露页。报酬来自商家，不靠捐赠 | 购线清单最接近。线材类目佣金比例未查到 |
| 京东联盟 CPS | [协议页](https://union.jd.com/searchResultDetail?articleId=57251)：服务费比例以商品页为准；推广者目前另付所收服务费的 10% 平台费。帮助中心写有按关键词查商品的接口 | 要人注册账号。首页当天展示的是食品和纸品示例，不是 HDMI。线材比例未查到 |
| 订阅，解锁目录、渲染、多套方案 | Planner 5D 月付 19.99 / 年付 59.99 美元起。DeskFlex 月付 5 / 年付 40 美元 | DeskLab 没有渲染和家具目录可卖。多套本地方案，竞品的免费档已经给出 |
| 订阅，解锁 AI 出图 | 酷家乐 AI 免费带水印；AI PRO 首年 499 元 | DeskLab 的 AI 已是登录后每天 20 次，这次不另提案改额度 |
| 卖自己的家具 | 宜家规划器 | DeskLab 没有自有商品 |
| 完全免费的摆放 | Juddesk 首页写免费、不注册、不限次数 | 图库若收费，要面对已经免费的对手 |

淘宝联盟、亚马逊 Associates 的现行类目比例，这次没有打开官方费率表，未查到。

## 看过、这次不写成提案的方向

- 做成酷家乐或 Planner 5D 那样的整屋设计。用户要的是桌子和线，不是画墙和出效果图。目录原则是小而家用。工作量会盖过布线。
- 换成 Juddesk 那样的品牌货目录（具体型号的键盘、椅子、麦克风）。要商标、尺寸授权和大量模型，3D 会整批换掉。和「通用模型、按接口接线」不是同一条路。若以后做，应单独批准，不要塞进 E98 那一件线槽里。
- 用房间照片或 LiDAR 对齐真实屋子（Kreativ 的做法）。手机端已经定为提醒去电脑，不再做细的手机优化。扫描在手机上，和这个决定拧着。
- 照搬 Roomiva 的美标 15 安、1440 瓦。DeskLab 的插排和墙插用的是目录里的瓦数上限，不是美国插座。

## 提案从哪几条差别来

| 编号 | 差别 | 工作量 | 要负责人拍板的外观或设备 |
|---|---|---|---|
| E96 | 分享停在一条私有链接；Juddesk、Desk Setup Builder、PCPartPicker、DeskFlex 都有可浏览的成品 | 大。要服务器和审核，并改关于页 | 3D 模型和场景不变。新的是图库页，以及「布局可以上传」 |
| E97 | 清单没有购买入口；PCPartPicker 用联盟链接，且不自己编一套价 | 小（搜索链接）到中（联盟接口） | 无新设备，3D 不变。多一个链接 |
| E98 | 线算清楚了，但没有地方收；宜家卖线槽，Roomiva 只写文章 | 中。一件设备和线的画法 | 有。新模型，3D 会变 |
| E99 | 提示不看身高；Ergotron 和 OSHA 看眼睛高度 | 小。本机三个字段和一句建议 | 这一版没有。椅子和升降桌要另外批 |
| E100 | 浏览器里只有一份方案；Planner 5D 免费档不限项目数 | 中。只改本机存档 | 无新设备，3D 不变。多一个「更多」菜单项 |
