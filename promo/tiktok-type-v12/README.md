# 妖怪客栈 · 等你当家｜文字 PV V12

27 秒竖版文字宣传 PV，1080 × 1920、60 fps、H.264 + AAC、BT.709。沿用原有文字表演和用户指定的歌曲选段，在 V11 基础上精修画面。

## 观看

- **`yaoguai-type-v12.mp4`**：带音乐成片，下载即可播放。
- **`preview-standalone.html`**：动画、字体、音乐全部内嵌。下载后用 Chrome / Edge 打开，点击播放；支持暂停、拖动、静音和重播，无需安装工具。
- **`storyboard.jpg`**：16 个关键画面。
- **`cover.jpg`**：片尾标题封面。
- **`music-excerpt.m4a`**：成片使用的 27 秒音乐选段。

完整工程 ZIP 需要先解压。GitHub 文件页只显示 HTML 源码；请点 **Download raw file** 下载后打开。

## 这版调整

- **更统一的纸墨质感**：减淡金色，加入固定的细纸纤维和轻微色差，保持文字清晰。
- **更有区别的排版**：“山海伙伴”减去重复角标，“你／我”形成错落呼应；“小小客栈”先落成方印，再展开为“大有名堂”。
- **细化副歌画面**：“来”字外围的数量、空隙与进入时机错开；热闹四色字牌加轻微的印刷边缘，保留它们汇成招牌的动作。
- **首尾呼应**：开场与片尾使用同款朱印；开张牌匾、片尾书帖边界各自有明确形态，收紧游戏标题与落款的关系。

“来→坐→一桌”的共享笔画、两次开张的递进、原歌词与配乐节奏均保留。这一版使用文字与几何图形绘制。

## 歌词与音乐

叮叮当，算盘响，
山海伙伴来帮忙。
你当掌柜，我来跑堂，
小小客栈，大有名堂！

来来来，坐坐坐，
一桌烟火，热热闹闹！
开张！开张！
妖怪客栈，等你当家！

配乐为用户提供的末深落《妖怪客栈等你当家》，原录音 **13.700–40.700 秒**，原速、原调。保留选段原有的 18 ms 淡入、700 ms 淡出，AAC 音轨直接封装，不重复压缩。55 个歌词字和逐字时间点与 V11 相同。

视觉回环仍在 26.68–26.96 秒完成；音频保留歌曲结尾淡出，因此不是无缝音频循环。结尾完整文字约 24.98 秒落定，含朱印的画面约 25.04 秒落定，至 26.68 秒保持静止。

## 修改与导出

`source/` 包含 Canvas 动画、HTML 播放器、字体、音频、时间线与导出脚本。预览以 `audio.currentTime` 为时钟；视频按同一时间线渲染 1620 帧。

需要 Node.js、Playwright、Chromium、Python 3 和 FFmpeg。Chrome 可执行文件可通过 `CHROMIUM_PATH` 指定；`PLAYWRIGHT_MODULE` 可指定已有 Playwright 模块。制作联系图还需 Pillow 和中文字体，可用 `CONTACT_FONT` 指定字体文件。

```bash
cd source
npm install
node render.cjs --stills
python3 build_preview.py
node visual_review.cjs
python3 make_contact.py
node render.cjs
node verify.cjs
python3 validate_media.py
```

输出视频位于 `source/output/yaoguai-type-v12.mp4`。`index.html` 供静态服务器预览，离线观看请打开交付根目录的 `preview-standalone.html`。

## 来源与检查

音乐由用户提供；工程只包含指定选段。字体为 Noto Sans CJK SC Bold、Noto Serif CJK SC Bold、Ma Shan Zheng Regular 子集，许可见 `source/assets/`。来源与剪辑参数见 `provenance.json`。

检查记录见 `validation.json`，文件校验见 `manifest.json`、`SHA256SUMS`。离线 HTML 在无网络 Chromium 上下文中载入验证；云环境禁止直接导航 `file://`，因此使用内嵌内容载入方式验证。
