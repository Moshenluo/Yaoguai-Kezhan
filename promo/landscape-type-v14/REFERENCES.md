# 《妖怪客栈》16:9 文字 PV：GitHub 参考与落地建议

检索日期：2026-10-24。此次只阅读公开源码和文档，没有安装、运行或复制第三方动画实现。建议继续使用现有 Canvas → Chromium → FFmpeg 管线，把下列编排方法写入自己的确定性动画函数。

## 1. Motion Canvas：把动作的并行与接力分清

- 项目：<https://github.com/motion-canvas/motion-canvas>
- 已读取：README、MIT LICENSE、`packages/core/src/flow/all.ts`、`sequence.ts`、`chain.ts`、`packages/core/src/tweening/tween.ts`。
- [all 源码](https://github.com/motion-canvas/motion-canvas/blob/main/packages/core/src/flow/all.ts)：同时启动动作，等待全部完成。
- [sequence 源码](https://github.com/motion-canvas/motion-canvas/blob/main/packages/core/src/flow/sequence.ts)：按固定间隔启动，但不等待上个动作结束，动作允许重叠。
- [chain 源码](https://github.com/motion-canvas/motion-canvas/blob/main/packages/core/src/flow/chain.ts)：一个动作完成后再接下一个。
- [tween 源码](https://github.com/motion-canvas/motion-canvas/blob/main/packages/core/src/tweening/tween.ts)：基于线程的固定时间计算进度，并明确写出结束值。
- 许可证：[MIT](https://github.com/motion-canvas/motion-canvas/blob/main/LICENSE)。

**用于本片的具体方法：**

先做“动作拥有者”的交接。例如算盘横梁离开算盘后，旧镜头停止画这根横梁，由转场函数继续画同一位置、宽度、颜色的横梁，最终由下一镜接手。标题的逐字入场与背景铺纸可并行，招牌落定后再开门则应串行。相邻歌词字可以有 30–70ms 的视觉动作重叠，但每字真正落定仍对齐现有音节时间。

这个项目提供的是动画组织方式，并没有一个通用功能可以自动让所有物体自然变形；“共享元素”具体造型与接手状态仍需我们设计。

## 2. Remotion：逐帧确定、带阻尼的落定与转场重叠

- 项目：<https://github.com/remotion-dev/remotion>
- [时间段文档源码](https://github.com/remotion-dev/remotion/blob/main/packages/docs/docs/sequence.mdx)：`from`、`durationInFrames` 和局部时间轴；当前文档已推荐部分新版 timing props，不应把旧 `<Sequence>` 用法当成唯一入口。
- [spring 文档源码](https://github.com/remotion-dev/remotion/blob/main/packages/docs/docs/spring.mdx)：spring 使用 `frame/fps` 计算；增大 damping 可去掉默认弹跳；`overshootClamping` 可限制越过目标；`durationInFrames` 可明确动作时长。
- [TransitionSeries 文档源码](https://github.com/remotion-dev/remotion/blob/main/packages/docs/docs/transitions/transitionseries.mdx)：两镜转场时同时存在，因此镜头总时长会减去重叠时长；Overlay 则叠在切点上，不改变总时长。
- 许可证：[Remotion License](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md)，不是 MIT。当前读取版本允许个人、最多 3 名雇员的营利组织及非营利组织等免费使用，其余情况需 Company License。本片只借鉴公开描述的时间轴方法，不引入该依赖。

**用于本片的具体方法：**

保留 27 秒/1620 帧及现有歌曲时间轴，所有动作由绝对秒数或 `frame/60` 计算。掌柜、片尾标题和牌匾采用高阻尼/无回弹的落定；跑堂和字牌只保留一次很短的轻回弹。每个字应该有“入场—可读—接下一动作”三个明确时间段。转场覆盖原有句间空间，不把每个转场时长额外加进歌曲。

## 3. Anime.js：有方向的 stagger 与空间展开

- 项目：<https://github.com/juliangarnier/anime>
- 已读取 README 中的 `stagger(65, {from:'center'})` 与 `inOutQuint` 用法。
- [stagger 实现](https://github.com/juliangarnier/anime/blob/master/src/utils/stagger.js)：支持 `from`、`axis`、`grid`、`reversed`、不同的分布曲线，以及可播种的随机抖动。
- 许可证：[MIT](https://github.com/juliangarnier/anime/blob/master/LICENSE.md)。

**用于本片的具体方法：**

在 16:9 中充分利用横向空间：让“来来来”从一字到两字、三字，中心随布局重新分配；不要三字各自从屏幕外飞到固定位置。让“热热闹闹”从左向右一拍一拍接力，已出现的邻字受到一次小位移后归位。装饰性外围文字可以从中心向两端散开，但歌词本体遵守音节先后，不能用“中心优先”改变歌词次序。随机项若使用，必须固定种子，避免预览和导出不一致。

## 4. Codrops On-Scroll Typography Animations：具体字效范例

- 项目：<https://github.com/codrops/OnScrollTypographyAnimations>
- [动画源码](https://github.com/codrops/OnScrollTypographyAnimations/blob/main/src/js/index.js)，已实际读取。
- [README](https://github.com/codrops/OnScrollTypographyAnimations/blob/main/README.md)。
- 许可证：[MIT](https://github.com/codrops/OnScrollTypographyAnimations/blob/main/LICENSE)。示例使用 GSAP、Splitting、Lenis；本片不复制示例代码、不引入这些依赖，也不使用示例图片。

源码中可借鉴的具体例子：

| 范例 | 实际手法 | 对《妖怪客栈》的适用方式 |
| --- | --- | --- |
| `fx4` | 字符从以词中心为基准的水平偏移聚回，center stagger | “山海伙伴”以左右呼应组成横向标题；词组内部的字距有一次呼吸后稳定 |
| `fx9` | 字符由视口中点出发，`scaleX` 从 0 到 1 | “来”从一个主字扩为三字的横向铺展，变形幅度要小，不能把汉字拉成难认的细条 |
| `fx11` | 每个字符套遮罩，从右侧 `xPercent:105` 进入，0.042s stagger | 掌柜/品牌字以克制的横向揭字进入，比所有字都弹跳更稳重 |
| `fx14` | 词组横向平移与字符局部运动同时进行 | “我来跑堂”形成整体向右的动势，同时各字有细小错步；镜头先为下一句留出空间 |

不建议直接用例子的随机字母闪烁、强烈扭转、`scaleX:6` 或连续 3D 翻滚。这些会干扰中文歌词辨识，也会把轻快国风推向电子故障风。

## 横版的镜头建议

以下是针对本片的创作建议，不是上述项目的官方规定。

- **输出：1920×1080 / 60fps。** 真正重排横向构图，不把 1080×1920 缩放后放在横版中央。主要字的静态停留可先以左右约 100–140px、上下约 80px 的设计留白检查；这不是任何平台的官方安全区保证。
- **开头 0–2.9s：** “叮”近景占画面一侧，另两字沿算盘横梁展开；品牌在下方有清楚且稳定的落款。最后一声带动横梁展开成下一页。
- **3–6s：** “山海”毛笔大字左右呼应，“伙伴来帮忙”以更紧凑的字重/字距形成第二层，避免把竖版 2×2 字阵原样搬到横版。
- **6–9s：** 掌柜在左、跑堂在右，以中间柜台线相接；进入第二句时让第一句主动让出空间，保持一次只有一个主要阅读焦点。
- **9–12.5s：** “小小客栈”的方印与“大”仍保留强尺度差，但展开后的“大有名堂”利用横向跨度，不能留成中间一条窄竖柱。
- **12.5–19.5s：** “来来来／坐坐坐”沿同一组横坐标转换；座位横线连成“一桌”，桌面铺出“烟火”；“热热闹闹”四张字牌横向接力。
- **20–22s：** 第一次“开张”形成完整横招牌，第二次扩大近景，随后左右开门露出标题，保留语义清晰的高潮递进。
- **22–27s：** “妖怪客栈”成为横向书法主标题，“等你当家”在下方收束；约 1.6 秒完整静止落款值得保留，不能为了更快而把品牌记忆时间剪掉。

## 阅读与访问说明

公开 raw.githubusercontent.com 文件均实际读取成功。GitHub 搜索 API 与以上项目的官网文档域名在本环境返回代理 403，因此技术细节以仓库内的文档/源码为依据；没有把失败的网页访问说成已读。记录针对读取当日默认分支，未来上游文件和许可证可能变化。所有建议都可在本地 Canvas 实现，没有理由仅为参考效果而迁移整个渲染框架。
