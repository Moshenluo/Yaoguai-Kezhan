// ============ 妖怪客栈 · 渲染无关桥接层 ============
//
// 【为什么需要这一层】
// 逻辑核心（store / engine / config / yaoguai）必须能在任意渲染层运行：
//   - Web（当前）：Next.js + React + Web Audio + localStorage
//   - 抖音小游戏（计划）：Cocos + tt.createInnerAudioContext + tt.setStorageSync
// 因此逻辑层不允许直接 import 任何平台/渲染相关的模块，统一改为从这里取能力。
//
// 【工作方式】
// 本模块只定义接口 + 空实现（no-op）。真正的实现由各端在启动时"注入"：
//   import { setAudioBridge, setStorageBridge } from './bridge'
// 未注入时全部降级为空实现 —— 逻辑层可以脱离浏览器独立运行与单元测试。
//
// 【当前状态】
// store.ts 是本模块唯一消费者，共 4 个调用点（syncSetting / setEnabled / 音量 ×2）。

// ---------- 音频 ----------

/** 音频能力的最小契约。各端自行实现，未实现的方法自动降级为空操作。 */
export interface AudioBridge {
  /** 存档水合完成后，从存档同步音效开关与音量 */
  syncSetting(): void
  /** 开关音效（对应 settings.sound） */
  setEnabled(on: boolean): void
  /** 设置音效音量（0-1） */
  setSfxVolume(v: number): void
  /** 设置背景音乐音量（0-1） */
  setBgmVolume(v: number): void
}

const NOOP_AUDIO: AudioBridge = {
  syncSetting: () => {},
  setEnabled: () => {},
  setSfxVolume: () => {},
  setBgmVolume: () => {},
}

let audioImpl: AudioBridge = NOOP_AUDIO

/**
 * 注入音频实现（幂等，可重复调用以替换实现）。
 * 传 null 可重置为空实现 —— 便于测试与热重载。
 */
export function setAudioBridge(impl: Partial<AudioBridge> | null): void {
  audioImpl = impl ? { ...NOOP_AUDIO, ...impl } : NOOP_AUDIO
}

/** 逻辑层使用的音频入口。永远指向当前注入的实现，未注入时为空操作。 */
export const audio: AudioBridge = {
  syncSetting: () => audioImpl.syncSetting(),
  setEnabled: (on) => audioImpl.setEnabled(on),
  setSfxVolume: (v) => audioImpl.setSfxVolume(v),
  setBgmVolume: (v) => audioImpl.setBgmVolume(v),
}

// ---------- 存储 ----------

/** 存储能力的最小契约（同步子集，覆盖 zustand persist 所需） */
export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

/** 内存兜底：SSR / 小程序逻辑层 / 单元测试环境下不会产生副作用（模块级单例，保持读写一致） */
const MEMORY_STORAGE: StorageLike = (() => {
  const map = new Map<string, string>()
  return {
    getItem: (k) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k, v) => {
      map.set(k, v)
    },
    removeItem: (k) => {
      map.delete(k)
    },
  }
})()

/**
 * 存储解析器（惰性）。
 *
 * ⚠️ 为什么不是直接注入实例：zustand persist 在 **store 模块求值的那一刻** 就会
 * 调用 getItem 做水合，而注册代码可能还没执行 —— 直接注入会丢失存档。
 * 改成每次取用时重新解析，注册顺序就无关紧要了。
 */
type StorageResolver = () => StorageLike | null

let storageResolver: StorageResolver = () => null

/**
 * 注入存储实现。
 * - Web：`() => (typeof window !== 'undefined' ? window.localStorage : null)`
 * - 抖音小游戏：封装 `tt.getStorageSync / tt.setStorageSync / tt.removeStorageSync`
 * 传 null 重置为内存存储。可重复调用，后注册者生效。
 */
export function setStorageBridge(resolver: StorageResolver | null): void {
  storageResolver = resolver ?? (() => null)
}

/** 逻辑层使用的存储入口（每次取用时解析，未注册则落内存兜底） */
export function getStorage(): StorageLike {
  return storageResolver() ?? MEMORY_STORAGE
}

// ---------- 逻辑层事件（预留） ----------

/**
 * 逻辑层向渲染层广播的事件名。
 * 目前音效由 UI 层直接触发，暂未接入；迁移到 Cocos 后，
 * 逻辑层可发 `sfx:play` 事件，由渲染层订阅并映射到 AudioSource。
 */
export type GameEventName = 'sfx:play' | 'bgm:change' | 'save:loaded'

type Handler<T = unknown> = (payload: T) => void

const handlers = new Map<GameEventName, Set<Handler>>()

/** 订阅逻辑层事件，返回取消订阅函数 */
export function on<T = unknown>(name: GameEventName, cb: Handler<T>): () => void {
  let set = handlers.get(name)
  if (!set) {
    set = new Set()
    handlers.set(name, set)
  }
  const h = cb as Handler
  set.add(h)
  return () => {
    set?.delete(h)
  }
}

/** 由逻辑层发出事件（无订阅者时为空操作） */
export function emit<T = unknown>(name: GameEventName, payload?: T): void {
  const set = handlers.get(name)
  if (!set) return
  for (const h of set) {
    try {
      ;(h as Handler<T>)(payload as T)
    } catch {
      /* 单个订阅者报错不应中断其他订阅者 */
    }
  }
}
