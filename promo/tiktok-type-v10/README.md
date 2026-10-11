# 妖怪客栈 · 等你当家｜文字 PV V10 循环版

27 秒竖版国风文字 PV，**1080 × 1920 / 60 fps / H.264 + AAC / BT.709**。音乐与 V9 完全一致：末深落《妖怪客栈等你当家》中用户指定的主歌＋副歌，原录音 13.700–40.700 秒，原速、原调。

## 观看

只想观看请下载 MP4。下载工程 ZIP 后先完整解压，打开顶层的 `preview-standalone.html`，无需安装 npm、Python 或 FFmpeg；`source/` 用于修改和重新导出。

- `yaoguai-type-v10.mp4`：带音乐成片。
- `preview-standalone.html`：字体、音乐、动画全部内嵌的离线预览。下载后用 Chrome / Edge 打开，点击播放；支持暂停、拖动、静音和重播。
- `storyboard.jpg`：16 个关键画面。
- `cover.jpg`：可用作视频封面的结尾标题。
- `music-excerpt.m4a`：成片使用的 27 秒音乐选段。

GitHub 若只显示文件信息，请点 **Download raw file** 下载。HTML 需要下载到本地打开；GitHub 文件页只展示源码。

## 本次精修

- **首帧就是主角**：大号“叮”先抓住视线，再收进算盘；轨道先收拢，为“算盘响”让出空间。
- **副歌逐次升级**：“来”从一个大字，展开成两个、三个；外围字环跟随节奏聚拢，中央保留清楚的阅读区域。
- **转场从已有图形继续**：“热热闹闹”四张字牌聚合，纸面与色彩连续过渡到“开张”，沿用“坐”横线接“一桌”的动作。
- **落版适合手机阅读**：标题、朱印和“等你当家”向画面中心收拢；保留完整落款的稳定阅读时间。
- **视觉首尾相接**：26.42 秒开始纸面圆形擦除，26.95 秒回到开头的大号“叮”。源动画的首帧与结尾画面逐像素一致，适合平台自动重播。音乐保留原来的结尾淡出，因此不是无缝音频循环。

配色继续使用宣纸白、墨绿、朱红与金色，保留温暖、轻快的国风文字表现。没有新增插图、战斗画面或额外歌词。

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

`source/` 包含 HTML、Canvas 动画、字体、音频选段、逐字时间线和导出脚本。浏览器预览用 `audio.currentTime` 作为动画时钟；导出按同一时间线渲染 1620 帧。`film.js` 中的 `bridges` 定义跨段转场，`tableBridge` 定义“坐”到“一桌”的共享横线，`festivalDoors` 连接字牌与开张，`loopBack` 完成视觉回环。

需要 Node.js、Playwright、Chromium、Python 3 和 FFmpeg。Chromium 是需单独安装的系统浏览器，`npm install` 仅安装 JavaScript 依赖。运行环境使用 Node 24、Playwright 1.62.1、Chromium 151、FFmpeg 7.1.5。

```bash
cd source
npm install
node render.cjs --stills
python3 build_preview.py
node render.cjs
node verify.cjs
python3 validate_media.py
```

导出的视频位于 `source/output/yaoguai-type-v10.mp4`。

浏览器默认路径 `/usr/bin/chromium`，可用 `CHROMIUM_PATH` 指定其他位置；`PLAYWRIGHT_MODULE` 可指向已安装的 Playwright 模块。源工程 `index.html` 需通过静态服务器访问；直接打开请使用交付根目录的 `preview-standalone.html`。

## 来源

音乐由用户上传并指定选段；没有分发完整原曲。字体是 Noto Sans CJK SC Bold、Noto Serif CJK SC Bold、Ma Shan Zheng Regular 的子集，许可证见 `source/assets/`。所有画面由文字与几何图形在 Canvas 中绘制。来源、音频哈希及剪辑参数见 `provenance.json`。

检查记录见 `validation.json`。离线 HTML 通过无网络的 Chromium 上下文载入验证；本云环境禁止直接导航 file://，因此未用 file:// 导航方式验证。
