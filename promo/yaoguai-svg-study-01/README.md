# 妖怪客栈 · SVG 角色试绘

参考现有游戏原画，以简洁的国风卡通矢量风格重绘四位伙伴，每位三种姿态，共十二张。这是宣传素材试绘，尚未接入 PV；游戏内职能以角色资料为准。

| 角色 | 三种姿态 |
| --- | --- |
| 九尾狐 | 安静相迎、眨眼招手、抱起算盘 |
| 狌狌 | 站好迎客、挥手招呼、躬身行礼 |
| 犰狳 | 困困待命、端茶送客、快步跑堂 |
| 饕餮 | 抱碗满足、请你尝尝、鼓腮偷吃 |

## 查看与使用

下载并解压完整素材包，双击 `preview-standalone.html` 即可离线使用。页面可切换角色和姿态、查看线稿、切换底色、播放或暂停微动作，也可下载当前 SVG。

- `svg/`：十二张 640 × 640 透明背景 SVG，无嵌入位图，路径与分组可编辑。
- `png/`：对应的十二张 640 × 640 透明背景 PNG。
- `character-sheet.jpg`、`character-sheet.png`：左侧为游戏原画，右侧为三种矢量试绘姿态。
- `reference/`：四张原画参考。
- `assets/`：预览字体及许可文件。
- `tools/`：生成素材、预览和检验的源程序。
- `validation.json`：交付检验记录。

十二张 SVG 是独立的静态差分，并非完整骨骼动画；头部、耳朵和尾巴的微动作由 HTML 预览实现。下载的 SVG 保留静态图形及可编辑分组。

原画取自 [Moshenluo/Yaoguai-Kezhan](https://github.com/Moshenluo/Yaoguai-Kezhan/tree/79908426b6586f6fd9a86da571e02884c6f837d4)，参考版本为 `main` 的提交 `79908426b6586f6fd9a86da571e02884c6f837d4`。

## 复现

在素材包根目录使用 Python 3 依次运行：

```bash
python3 tools/jiuweihu.py
python3 tools/shengsheng.py
python3 tools/qiuyu.py
python3 tools/taotie.py
python3 tools/build_preview.py
```

以上流程使用 Python 标准库及随包字体。若增加预览文字，可安装 `fonttools`，并用环境变量 `FONT_SOURCE` 指定包含新增文字的完整 Noto 字体。

生成 PNG 并进行浏览器检验：

```bash
node tools/render_verify.cjs
```

此步骤需要 Node.js、Playwright 和 Chromium；可用环境变量 `CHROMIUM_PATH` 指定 Chromium 可执行文件。检验与预览截图输出至 `output/`。
