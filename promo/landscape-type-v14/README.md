# 妖怪客栈 · 等你当家｜16:9 横版文字 PV

27 秒 / 1920 × 1080 / 60 fps。保留既定配乐与歌词，按横屏重新设计构图、文字运动和转场。

- [下载 MP4 成片](./yaoguai-type-wide-v14.mp4?raw=true)
- [下载完整交付包](./yaoguai-type-wide-v14-delivery.zip?raw=true)
- [查看分镜总览](./storyboard.jpg)
- [下载离线 HTML 预览](./preview-standalone.html?raw=true)
- [查看封面](./cover.jpg)

HTML 请下载到本地后用 Chrome 或 Edge 打开，点击“播放”。字体、配乐和动画均已内嵌，不需要运行服务器。GitHub 的文件页本身不会运行 HTML。

## 这一版的设计

开场的巨型“叮”收进横向算盘，右侧保留游戏名与玩法；算盘横梁展开，引出“山海伙伴”。“来帮忙”的纸条扩成下一页，让“你当掌柜／我来跑堂”在左右两边对答。

“小小客栈”先形成小印，再展开为“大有名堂”。副歌用横向逐字递进加速：“来”翻成“坐”，座位横线汇成“一桌烟火”的“一”；“热热闹闹”的四张字牌接力入场，合拢成“开张”招牌。两次“开张”由小到大，再向两侧开门，露出一整行书法游戏名。

动效按词义区分：掌柜落字有短促下压，跑堂逐字提步，字牌有轻微碰撞回弹；每次动作都收稳，让文字留出阅读时间。色彩沿用宣纸白、朱砂红、墨绿和暖金。

片尾完整信息静止约 1.64 秒，再由落款转回片头。首尾画面一致；音频保留既定结尾淡出，并非无缝音频循环。

## 配乐与文案

配乐：末深落《妖怪客栈等你当家》，用户提供。沿用原文件 13.700–40.700 秒的既定选段，不变速、不移调。MP4 直接复制现有 AAC 音频包，不进行二次音频编码。

> 叮叮当，算盘响，山海伙伴来帮忙。
> 你当掌柜，我来跑堂，小小客栈，大有名堂！
> 来来来，坐坐坐，一桌烟火，热热闹闹！
> 开张！开张！妖怪客栈，等你当家！

歌词共 55 个汉字，字级时点沿用上一版。“经营客栈 · 招募妖怪 · 夜晚守家”是用户已确认的玩法补充文案。

## GitHub 制作参考

参考了 Motion Canvas 的动作编排、Remotion 的逐帧时间线与转场重叠、Anime.js 的逐字错拍，以及 Codrops 的遮罩揭字与文字分组方法。实际阅读位置、借鉴点及许可证说明见 [REFERENCES.md](./REFERENCES.md)。

这些方法以本项目 Canvas 代码重新实现；未引入上述项目的代码或运行依赖。

## 源码与复现

`source/` 含完整动画、音频片段、字体子集和导出工具。需要 Node.js、Playwright、Chromium、Python 3（Pillow、fontTools）及 FFmpeg。默认浏览器路径为 `/usr/bin/chromium`，可用 `CHROMIUM_PATH` 修改。

```bash
cd source
npm install
python3 build_preview.py
node render.cjs --stills
node visual_review.cjs
python3 make_contact.py
node render.cjs
node verify.cjs
python3 validate_media.py
python3 review_encoded.py
```

`score.json` 保存歌词时点；`core.js` 提供字体与绘制函数；`act-one.js`、`act-two.js`、`film.js` 分别控制主歌、副歌和转场/片尾。播放器以音频时间驱动画面，导出时以 `frame / 60` 逐帧渲染，再由 FFmpeg 编码 H.264/AAC。

检查记录见 [validation.json](./validation.json) 和 `review/checks/`；素材来源见 [provenance.json](./provenance.json)，字体许可保存在 `source/assets/`。自动检查验证文件、播放及帧数据，不代表传播效果保证。
