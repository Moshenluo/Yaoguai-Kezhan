'use client'

// ============ Web 端适配器（Next.js / 浏览器） ============
//
// 把浏览器专属能力注入 bridge，让逻辑层保持渲染无关。
// 这是 **副作用模块** —— 只要 import 即完成注册，无需调用任何函数：
//
//   import '@/game/adapters-web'   // 必须早于 store 首次读写
//
// 得益于 bridge 存储采用惰性解析，即使本模块晚于 store 求值也不会丢存档。
// 迁移到抖音小游戏时，改用 adapters-tt.ts 注入 tt.* API 即可，
// store / engine / config / yaoguai 一行都不用改。

import { sfx, setBgmVolume, setSfxVolume } from './audio'
import { setAudioBridge, setStorageBridge } from './bridge'

// ---------- 存储：localStorage ----------
setStorageBridge(() => (typeof window !== 'undefined' ? window.localStorage : null))

// ---------- 音频：Web Audio 合成引擎 ----------
setAudioBridge({
  syncSetting: () => sfx.syncSetting(),
  setEnabled: (on) => sfx.setEnabled(on),
  setSfxVolume,
  setBgmVolume,
})
