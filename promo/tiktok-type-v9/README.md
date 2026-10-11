# 妖怪客栈 · 等你当家｜文字 PV V9 精修版

27 秒竖版国风文字 PV，**1080 × 1920 / 60 fps / H.264 + AAC / BT.709**。音乐与 V8 完全一致：末深落《妖怪客栈等你当家》中用户指定的主歌＋副歌，原录音 13.700–40.700 秒，原速、原调。

## 观看

- `yaoguai-type-v9.mp4`：带音乐成片。
- `preview-standalone.html`：字体、音乐、动画全部内嵌的离线预览。下载后用 Chrome / Edge 打开，点击播放；支持暂停、拖动、静音和重播。
- `storyboard.jpg`：16 个关键画面。
- `cover.jpg`：可用作视频封面的结尾标题。
- `music-excerpt.m4a`：成片使用的 27 秒音乐选段。

GitHub 若只显示文件信息，请点 **Download raw file** 下载。HTML 需要下载到本地打开；GitHub 文件页只展示源码。

## 本次精修

- **动作有衔接**：算盘的回响扩展开场；“来帮忙”的纸面展开接入掌柜句；柜台分界向上延伸；三条座位横线合成“一桌”的“一”；“开张”的门扇展开，露出游戏标题。
- **重音与普通歌词区分**：拨珠有短距离回弹，“坐”有翻转、落座与轻微压缩，“开张”做轴向展开。其余正文用克制的位移与遮罩显现。
- **排版重新校正**：角色句按一条基线阅读；“来来来”提前分流；主字、词组、边距之间保留清楚间隙。
- **字体分工明确**：毛笔字用于山海、角色主字与标题；粗宋体用于歌词主体；黑体用于招呼和重音。统一“热热闹闹”的字重。
- **画面材质统一**：纸色、细颗粒与印刷色贯穿全片；去除反复描边和散落的感叹号。结尾朱印落下后留出稳定的阅读时间。

## 选定歌词

叮叮当，算盘响，
山海伙伴来帮忙。
你当掌柜，我来跑堂，
小小客栈，大有名堂！

来来来，坐坐坐，
一桌烟火，热热闹闹！
开张！开张！
妖怪客栈，等你当家！

55 个歌词字与用户指定内容一致。逐字时间点沿用原录音的本地语音识别定位，动画通常提前约 120 ms 起势；转场与句子进出重叠。音频保留 18 ms 起点淡入、700 ms 结尾淡出，没有额外叠加音乐或音效。

## 源工程与导出

`source/` 包含 HTML、Canvas 动画、字体、音频选段、逐字时间线和导出脚本。浏览器预览用 `audio.currentTime` 作为动画时钟；导出按同一时间线渲染 1620 帧。`film.js` 中的 `bridges` 定义跨段转场，`tableBridge` 定义“坐”到“一桌”的共享横线。

需要 Node.js、Playwright、Chromium、Python 3 和 FFmpeg。运行环境使用 Node 24、Playwright 1.62.1、Chromium 151、FFmpeg 7.1.5。

```bash
cd source
npm install
node render.cjs --stills
python3 build_preview.py
node render.cjs
node verify.cjs
python3 validate_media.py
```

浏览器默认路径 `/usr/bin/chromium`，可用 `CHROMIUM_PATH` 指定其他位置；`PLAYWRIGHT_MODULE` 可指向已安装的 Playwright 模块。源工程 `index.html` 需通过静态服务器访问；直接打开请使用交付根目录的 `preview-standalone.html`。

## 来源

音乐由用户上传并指定选段；没有分发完整原曲。字体是 Noto Sans CJK SC Bold、Noto Serif CJK SC Bold、Ma Shan Zheng Regular 的子集，许可证见 `source/assets/`。所有画面由文字与几何图形在 Canvas 中绘制。来源、音频哈希及剪辑参数见 `provenance.json`。

检查记录见 `validation.json`。离线 HTML 通过无网络的 Chromium 上下文载入验证；本云环境禁止直接导航 file://，因此未用 file:// 导航方式验证。
