# Task ID: 6-b · BGM 音频子代理 工作记录

## 任务
实现 Web Audio 合成 BGM 背景音乐系统（白天/夜晚/妖王王三曲目），文件边界仅 3 个：
- src/game/audio.ts（扩展，保留现有 SfxEngine 全部 API 不变）
- src/components/game/BgmPlayer.tsx（新建）
- src/app/page.tsx（最小改动：挂载 BgmPlayer + 妖王夜 stage 路由）

## 前置阅读
worklog.md 全量、audio.ts 旧版（SfxEngine 单例 + 16 音效）、page.tsx stage 状态机、
store.ts（settings.music / toggleSetting / finishBattle 第6参 bossNight）、types.ts（BattleResult.bossNight）、
agent-ctx/6-a 记录（确认 NightScreen 已支持 `bossNight?: boolean` prop）。

## 实现细节

### 1. audio.ts 重构 + BgmEngine（核心交付）
- **共享 AudioContext 管理**：从 SfxEngine 抽出模块级 `getSharedAudio()`（全局唯一 ctx + master 0.5），
  `audioUnlocked` 标志 + `unlockCallbacks` 注册表；**模块级只注册一次** pointerdown/keydown 解锁监听
  （首次手势 resume ctx 并触发全部回调），sfx 与 bgm 共用，杜绝重复监听冲突。
  SfxEngine 对外 API（play/setEnabled/syncSetting）与 16 种音效实现逐行保留，仅内部改用共享 ctx。
- **BgmEngine**：导出 `bgm` 单例，API：`play(track)` / `stop()` / `setEnabled(bool)` / `syncSetting()` /
  `currentTrack()` / `isEnabled()` / `dispose()`（HMR 用）。
  - **lookahead 调度器**：setInterval 25ms + `audioCtx.currentTime` 精确排程，前瞻窗口 1.1s
    （大于后台 tab 定时器节流间隔，切后台不断音）；每声部独立 nextT/pos 游标按拍推进取模循环。
  - **1.2s crossfade**：每曲目一个 voice（gain 0→1 线性淡入），切曲时旧 voice 锚定当前值后 1.2s 淡出、
    淡出声部停止排新音符，deadline 后断链回收；stop() 淡出 1s。
  - **自动播放策略**：未解锁手势前 play() 只记录 desired 挂起，解锁回调自动开始；
    canPlay 兼容「ctx 已 running 但未走手势」的浏览器宽放场景。
  - **总线效果**：BGM 专用 bus → 共享 master；附点八分反馈延迟回声（delay 0.75×spb、fb 0.22、wet 0.15，
    delayTime 随曲速 setTargetAtTime 平滑摆动），添国风空灵感；需要暗化音色的层挂 per-voice 低通。
  - **音色分层合成**：melody（triangle/sawtooth，attack/release 包络、力度 velocity）、bass（sine）、
    harmony（根音+纯五度倍增 dyad）、drone（根音+小二度簇、长起音 swell）、perc（底鼓=正弦150→45Hz 下滑闷响；
    轻拍=高通白噪声短促嘶响，随机相位避免机械感；噪声缓冲 0.5s 复用）。
  - **HMR/重复评估保护**：window `__yaoguaiAudioCleanup/__yaoguaiAudioInherit`——模块热更新重执行时先
    dispose 旧引擎并 close 旧 ctx（防开发环境双 BGM/孤儿 AudioContext），并继承旧 desired/开关，
    下次手势或舞台切换自动恢复；unlock 的 resume 均挂 catch 防已关闭 ctx 的未处理 rejection。

### 2. 三首曲目（各 16 小节 64 拍硬编码，起承转合，层间拍长数学对齐已脚本验证）
- **day 白天·轻松经营**：宫调式五声（C D E G A），BPM 80。主旋律 triangle 轻快级进+三度跳进
  （起:宫调上行问句 → 承:高八度呼应 → 转:G5/E5 高音区流连（力度 1.15 顶点）→ 合:回落长音归宫）；
  低音 sine C/Am/G/C 四小节循环（宫-羽-征-归宫）；harmony 层稀疏纯五度 dyad 点缀（A4/D5/G4/C5，
  全部落点对齐和弦，均属五声音阶内纯五度）。
- **night 夜晚·紧张守店**：羽调式五声（A C D E G），BPM 96。旋律徘徊+下行叹息+上方二度倚音装饰
  （0.12 拍短音 v0.6，D5→C5/E5→D5/C5→D5 等五处）；低音更沉（A2/G2/E2/D2 留白行走）；旋律挂 2400Hz
  低通变暗；perc 噪声轻拍打底（底鼓 1/3 拍 + 摇摆 off-beat 轻拍）。
- **boss 妖王夜·压迫感**：A 弗里几亚色彩，BPM 112。旋律小二度倚音震音（A-A-Bb-A / E-F-E / C-D-E-F-E）、
  减五度下坠（D5-Bb4）、步步上行后坍缩回 A；sawtooth 过 1100Hz 低通压暗；低音 A2 八分锤击 +
  Bb2 半音擦撞；drone 层 A2+Bb2 小二度长簇（8 拍 swell）缓缓起伏；perc 双倍密度底鼓。
- 音量：各层 gain 0.018-0.08 叠加（经 master 0.5 后整体约 0.05-0.1），安静垫底不干扰音效。

### 3. BgmPlayer.tsx（新建）
'use client' 无 UI 组件：`{ track: BgmTrackName | null }`，zustand 细粒度订阅 `settings.music`；
effect 联动 `bgm.setEnabled(musicOn)` + `play(track)/stop()`；卸载 effect cleanup 调 `bgm.stop()`。

### 4. page.tsx 最小改动（主代理委托契约）
- Stage 类型加 `'boss-night'`；`startNight(target)` 统一普通夜/妖王夜切换（复用月升动画+battleKey 重挂），
  `goNight`/`goBossNight` 分别包装；埋点 `boss_night_start`/`night_start`。
- `lastNightStage` state 记录夜战类型；`closeSettle('night')` 重开时恢复（妖王夜「重新挑战」回妖王夜）。
- DayScreen 传 `onBossNight={goBossNight}`（**依赖主代理在 DayScreen 补该 prop**）；
  NightScreen 渲染条件 `night || boss-night`、传 `bossNight={stage==='boss-night'}`（6-a 已就位）。
- 结算链路补齐：`grant()` 将 `r.bossNight` 传入 `finishBattle` 第 6 参（bossWins/bossNightDone/不推关卡），
  `battle_end` 埋点加 bossNight 标记（types.ts BattleResult.bossNight 注释明确要求 page.tsx 传参）。
- `currentTrack` 路由：splash→null / day→'day' / night→'night' / boss-night→'boss'；`<BgmPlayer track={currentTrack} />` 挂 main 内。

## 质量验证
- `bunx tsc --noEmit`：src/ 仅 1 处错误 = page.tsx:161 `DayScreen onBossNight` prop 不存在
  **（依赖 6-a/主代理改动——主代理尚未在 DayScreen 加 onBossNight，NightScreen bossNight 已由 6-a 就位无报错）**；
  本人三文件代码 0 类型错误；examples/skills 存量 4 处按任务书忽略。
- `bunx eslint src/game/audio.ts src/components/game/BgmPlayer.tsx src/app/page.tsx`：0 错误 0 警告（exit 0）。
- 曲目层数据脚本校验：三曲目各层均 64 拍精确同步（曾发现 NIGHT_PERC 8 拍 pattern 误写 8.5 拍，已修复）。
- agent-browser 实测（dev server）：splash 点击开始 → day BGM 调度 15s+ 无报错 → 入夜 crossfade 无报错 →
  夜战 perc/bass 循环回绕无报错 → 撤退结算 → 返回客栈切回 day → 设置里背景音乐开关 off/on（fadeAll/
  重启路径）全流程 console+page errors 0；HMR 热更 audio.ts 多次，清理/继承路径无未处理 rejection，
  热更后点击交互 BGM 自动恢复。
- dev.log 热编译 ✓ 无报错。

## 遗留/移交事项
1. `DayScreenProps.onBossNight` 由主代理并行开发中——page.tsx 调用端已就绪，主代理只需在
   DayScreenProps 加 `onBossNight: () => void` 并接「妖王夜入口」按钮（建议按 bossNightUnlocked +
   daily.bossNightDone 守卫），tsc 即归零。
2. BgmPlayer 的 music 开关联动完全由组件订阅驱动，store.ts 未改（toggleSetting('music') 无需调用
   bgm.setEnabled，若主代理愿意也可在 store 里加一行 `if (key === 'music') bgm.setEnabled(next.music)`
   作为双保险，非必需）。
3. 建议人工听感验收：合成 BGM 音量刻意压低（master 0.5 下整体 ~0.05-0.1），若觉得过轻可整体上调
   各 layer gain 或在 ensureBus 里把 bus.gain 从 1 提到 1.2-1.5。
