'use client'

import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { Element, GameSave, InnFacilities, OwnedYaoguai, PotionStock, ScenePiece, StaminaPotionStock } from './types'
import { SCENE_COMPS, sceneCap, sceneTotalCap } from './scene-layers'
import {
  ACHIEVEMENTS,
  AD_STAMINA_RECOVER,
  ADVANCED_RARE_RATE,
  AUTO_ROTATE_THRESHOLD,
  BOSS_NIGHT,
  CAPTURE_NET,
  COOK_DISHES,
  DAILY_TASKS,
  ELEMENT_ORDER,
  ELEMENT_STONE_MAX_LEVEL,
  EXP_POTIONS,
  FACILITIES,
  FREE_RARE_RATE,
  GATHER_ACC_CAP,
  GATHER_STAMINA_COST_MULT,
  GATHER_TASKS_MAP,
  HASTE_TALISMAN,
  JOB_STAMINA_COST,
  MATERIALS_MAP,
  MAT_RECIPES,
  MAX_STAR,
  NEW_YAOGUAI_STAMINA,
  NORMAL_RARE_RATE,
  NORMAL_TEN_RARE_RATE,
  OFFLINE_CAP_HOURS,
  OFFLINE_EFFICIENCY,
  RECRUIT_COST,
  REGION2_UNLOCK,
  REGION3_UNLOCK,
  SEVEN_DAY_REWARDS,
  SKINS,
  SKILL_MAX_LEVEL,
  STAMINA_POTIONS,
  TUJIAN_REWARDS,
  activeFestival,
  baseGemRate,
  baseGoldRate,
  battleExpGain,
  defaultSave,
  expToNext,
  facilityCost,
  facilityMatCost,
  festivalGiftId,
  gatherRateOf,
  innExpNeeded,
  levelCapForStar,
  matCap,
  region2Unlockable,
  region3Unlockable,
  regionDef,
  skillLevelCapForStar,
  skillUpCost,
  skinUnlocked,
  staminaRegenRate,
  staminaTier,
  stoneIdFor,
  stoneUpCost,
  today,
} from './config'
import { INITIAL_YAOGUAI, RARE_IDS, YAOGUAI_MAP } from './yaoguai'
// ⚠️ 不要在这里 import './audio' —— 那是 Web Audio 实现，会把逻辑层锁死在浏览器。
// 音频与存储一律走 bridge，由渲染端启动时注入实现（Web 见 adapters-web.ts，
// 抖音小游戏见未来的 adapters-tt.ts）。本文件因此可以脱离 DOM 独立运行。
import { audio, getStorage } from './bridge'

// ============ 妖怪客栈 · 全局状态 ============

export interface OfflineReward {
  gold: number
  gems: number
  seconds: number
}

/** 自动轮换事件（非持久化，UI 提示用） */
export interface RotationEvent {
  rested: string[]
  added: string[]
  at: number
}

/** 升到 n 星所需消耗的持有数量 */
export const STAR_UP_COST: Record<number, number> = { 2: 3, 3: 4, 4: 5, 5: 6 }

interface GameStore extends GameSave {
  hasHydrated: boolean
  pendingOffline: OfflineReward | null
  /** 最近一次自动轮换事件（非持久化，UI 提示用） */
  lastRotation: RotationEvent | null

  setHydrated: () => void
  tickIncome: (dt: number) => void
  settleOffline: () => void
  dismissOffline: () => void

  upgradeFacility: (key: GameSave['facilities'] extends infer _ ? keyof GameSave['facilities'] : never) => void
  addGold: (n: number) => void
  addGems: (n: number) => void
  addTickets: (n: number) => void

  recruit: (
    kind: 'normal' | 'ten' | 'advanced' | 'advancedTen' | 'free' | 'ticket'
  ) => { ok: boolean; results: string[]; message?: string }
  starUp: (id: string) => { ok: boolean; message: string }
  /** 喂经验药水（妖怪升级） */
  feedPotion: (id: string, size: 'small' | 'medium' | 'large') => { ok: boolean; message: string; levels?: number }
  /** 购买经验药水 */
  buyPotion: (size: 'small' | 'medium' | 'large') => { ok: boolean; message: string }
  /** 买入体力药水 */
  buyStaminaPotion: (size: 'small' | 'medium' | 'large') => { ok: boolean; message: string }
  /** 使用体力药水（id 为 null 且大瓶时全体恢复） */
  useStaminaPotion: (id: string | null, size: 'small' | 'medium' | 'large') => { ok: boolean; message: string }
  /** 看广告全体体力恢复 50% */
  recoverStaminaByAd: () => { ok: boolean; message: string }
  /** 一键补充体力（V1.1）：智能消耗小/中瓶气力散，为体力不足的妖怪逐一补充 */
  oneClickStaminaRecover: () => { ok: boolean; message: string }
  /** 自动轮换排班开关 */
  setAutoRotate: (on: boolean) => void
  /** 夜战波次体力扣减（NightScreen 调用） */
  drainBattleStamina: (ids: string[], cost: number) => void
  /** 入账素材（尊重仓库存储上限） */
  addMaterials: (gains: Record<string, number>) => void
  /** 素材合成（5 低级 → 1 高级） */
  synthMaterial: (recipeId: string) => { ok: boolean; message: string }
  /** 出售素材换金币 */
  sellMaterial: (id: string, n: number) => { ok: boolean; message: string }
  /** 属性石强化（每级克制伤害 +5%） */
  upgradeElementStone: (el: Element) => { ok: boolean; message: string }
  /** 灶火做饭（消耗食材获得限时收益加成） */
  cookDish: (dishId: string) => { ok: boolean; message: string }
  toggleDeploy: (id: string) => { ok: boolean; message: string }
  /** 山野采集队：任命/召回采集妖（taskId 传 null 则清空该采集位） */
  assignGatherer: (taskId: string, yaoguaiId: string | null) => { ok: boolean; message: string }
  /** 收取采集队累积产出（尊重仓库上限） */
  collectGather: () => { ok: boolean; gained: Record<string, number>; total: number; message: string }
  /** 技能升级（V1.3 妖丹消耗：消耗妖丹/稀有妖丹/金币/灵石，每级技能效果 +15%） */
  upgradeSkill: (id: string) => { ok: boolean; message: string }
  /** 焚香引妖（V1.3.1）：今日妖王已退散后，消耗妖王诱引香再召一场妖王夜 */
  consumeBossLure: () => { ok: boolean; message: string }
  /** 张开缚妖网（V1.1 道具）：夜战中消耗，本场收服成功率 +15% */
  consumeCaptureNet: () => { ok: boolean; message: string }
  /** 激活聚宝符（V1.1 道具）：消耗后 15 分钟挂机收益 ×2 */
  consumeHasteTalisman: () => { ok: boolean; message: string }

  addCaptured: (id: string) => void
  recordCaptureAttempt: (id: string) => void
  finishBattle: (
    victory: boolean,
    gold: number,
    gems: number,
    tickets: number,
    waveReached: number,
    bossNight?: boolean,
    lineupIds?: string[],
    materialsGained?: Record<string, number>,
  ) => { expGained: Record<string, number> }
  /** 七日签到：领取今日奖励 */
  claimSignIn: () => { ok: boolean; message: string; day?: number }
  /** 领取当前节日礼包（节日期间限领一次，跨年可重复） */
  claimFestivalGift: () => { ok: boolean; message: string }
  /** 切换客栈皮肤 */
  setSkin: (id: string) => { ok: boolean; message: string }
  /** 装扮模式：保存贴片实例位置/缩放（% 场景坐标，底部中心锚点；s 0.5~2 可选） */
  setPiecePos: (id: string, x: number, y: number, s?: number) => void
  /** 装扮模式：贴片水平镜像翻转 */
  flipPiece: (id: string) => void
  /** 装扮模式：收回（删除）一个贴片实例 */
  removePiece: (id: string) => void
  /** 装扮模式：新摆一个贴片（货单拖出/点选）；设施未建或达上限返回 null */
  addPiece: (key: string, x: number, y: number) => string | null
  /** 切换今夜驻扎区域（世界地图；区域二/三分店需已开设） */
  setRegion: (region: 1 | 2 | 3) => { ok: boolean; message: string }
  /** 开设水墨幽谷分店（扣金币 → 解锁区域二 + 分店收益/体力加成） */
  openRegion2: () => { ok: boolean; message: string }
  /** 开设沸火赤川分店（扣金币 → 解锁区域三 + 分店收益/体力加成） */
  openRegion3: () => { ok: boolean; message: string }
  claimTask: (id: string) => { ok: boolean; message: string }
  claimTujianReward: (count: number) => { ok: boolean; message: string }
  claimAchievement: (id: string) => { ok: boolean; message: string }
  watchAd: () => void
  toggleSetting: (key: 'sound' | 'music') => void
  /** 独立音量调节（sfx / bgm，0-1） */
  setVolume: (key: 'sfx' | 'bgm', v: number) => void
  /** 标记白天三步引导已看过（完成或跳过） */
  markDayGuideSeen: () => void
  resetGame: () => void
  markDaily: (event: string) => void

  /** 当前每秒金币收益（含妖怪打工加成） */
  goldRate: () => number
  /** 当前每秒灵石收益 */
  gemRate: () => number
  /** 打工位上限 */
  workerLimit: () => number
  /** 在线妖怪打工加成汇总 */
  jobBonus: () => {
    goldRate: number
    gemRate: number
    globalRate: number
    offlineRate: number
    innHpRate: number
    rareRate: number
  }
}

function pickNormal(): string {
  return INITIAL_YAOGUAI[Math.floor(Math.random() * INITIAL_YAOGUAI.length)].id
}
/** 区域独占稀有池（V1.3.1 招募池随区域轮换）：按当前驻扎区域过滤稀有精怪 */
function pickRare(region: 1 | 2 | 3): string {
  const pool = RARE_IDS.filter((id) => {
    const def = YAOGUAI_MAP[id]
    return !def.spawnRegions || def.spawnRegions.includes(region)
  })
  return pool[Math.floor(Math.random() * pool.length)]
}

// ---- 挂机素材滴落累积器（模块级，不入档；食物 75 秒 +1，木材 240 秒 +1） ----
const matDrip = { food: 0, wood: 0 }
const FOOD_IDS = ['meat', 'rice', 'salt'] as const

/** 新持有妖怪的默认结构（新妖初始 50% 体力，捉妖/招募入账） */
function newOwned(): OwnedYaoguai {
  return { count: 0, star: 1, deployed: false, level: 1, exp: 0, stamina: NEW_YAOGUAI_STAMINA, skillLevel: 1 }
}

/** 自动轮换检查节流累积器（秒，模块级不入档） */
let rotateCheckAcc = 0

/**
 * 体力结算：打工按定位消耗 / 采集妖出野按 70% 消耗 / 休息恢复（客房+美食+分店+温泉加成），clamp 0-100
 * 返回新 owned（无变化时返回原引用，避免每秒无谓的新对象）
 */
function applyStaminaTick(
  owned: Record<string, OwnedYaoguai>,
  dt: number,
  guestRoomLv: number,
  cookingActive: boolean,
  branchOpen = false,
  hotSpringLv = 0,
  gatherIds: Set<string> | null = null
): Record<string, OwnedYaoguai> {
  const restRate = staminaRegenRate(guestRoomLv, cookingActive, branchOpen, hotSpringLv)
  let changed = false
  const next: Record<string, OwnedYaoguai> = {}
  for (const [id, o] of Object.entries(owned)) {
    const def = YAOGUAI_MAP[id]
    if (!def) continue
    const cur = o.stamina ?? 100
    let st: number
    if (gatherIds?.has(id)) {
      // 采集妖出野：消耗为打工的 70%（不享受休息恢复）
      st = cur - ((JOB_STAMINA_COST[def.nightRole] ?? 5) * GATHER_STAMINA_COST_MULT / 3600) * dt
    } else if (o.deployed) {
      st = cur - ((JOB_STAMINA_COST[def.nightRole] ?? 5) / 3600) * dt
    } else {
      st = cur + (restRate / 3600) * dt
    }
    st = Math.max(0, Math.min(100, st))
    if (Math.abs(st - cur) > 1e-4) {
      next[id] = { ...o, stamina: st }
      changed = true
    } else {
      next[id] = o
    }
  }
  return changed ? next : owned
}

/**
 * 自动轮换：撤下体力低于阈值的打工妖休息，补上体力最高的替补（虚脱不上岗）
 * 无变化时返回 null
 */
function autoRotateOwned(
  owned: Record<string, OwnedYaoguai>,
  limit: number,
  gatherIds: Set<string> | null = null
): { owned: Record<string, OwnedYaoguai>; rested: string[]; added: string[] } | null {
  const next = { ...owned }
  const rested: string[] = []
  for (const [id, o] of Object.entries(next)) {
    if (o.deployed && (o.stamina ?? 100) < AUTO_ROTATE_THRESHOLD) {
      next[id] = { ...o, deployed: false }
      rested.push(id)
    }
  }
  let deployedCount = Object.values(next).filter((o) => o.deployed).length
  const added: string[] = []
  while (deployedCount < limit) {
    let bestId: string | null = null
    let bestSt = -1
    for (const [id, o] of Object.entries(next)) {
      if (o.deployed) continue
      // 采集妖出野中，不自动补位打工
      if (gatherIds?.has(id)) continue
      const st = o.stamina ?? 100
      if (staminaTier(st).battleOk && st > bestSt) {
        bestSt = st
        bestId = id
      }
    }
    if (!bestId) break
    next[bestId] = { ...next[bestId], deployed: true }
    added.push(bestId)
    deployedCount += 1
  }
  if (rested.length === 0 && added.length === 0) return null
  return { owned: next, rested, added }
}

/**
 * 为一只妖怪累加经验并处理连升（等级上限 = 星级×10）
 * 返回升级数与最终等级（不修改 store）
 */
export function applyExpToOwned(o: OwnedYaoguai, exp: number): { level: number; exp: number; levels: number } {
  const cap = levelCapForStar(o.star)
  let { level, exp: cur } = o
  if (level >= cap) return { level, exp: cur, levels: 0 }
  cur += exp
  let levels = 0
  while (level < cap && cur >= expToNext(level)) {
    cur -= expToNext(level)
    level += 1
    levels += 1
  }
  if (level >= cap) cur = 0 // 满级经验清零
  return { level, exp: cur, levels }
}

// ============ 存档净化（防脏数据崩溃） ============

/** 非有限数字（null/undefined/NaN/Infinity/错误类型）一律回退 fallback */
function finiteNum(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

/** 取整并限定下限 */
function intAtLeast(v: unknown, fallback: number, min: number): number {
  return Math.max(min, Math.floor(finiteNum(v, fallback)))
}

function strOr(v: unknown, fallback: string): string {
  return typeof v === 'string' ? v : fallback
}

function strArrOr(v: unknown, fallback: string[]): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : fallback
}

/** Record<string, number> 净化：丢弃非法键值，非对象则整体回退 */
function numRecOr(v: unknown, fallback: Record<string, number>): Record<string, number> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return fallback
  const out: Record<string, number> = {}
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof val === 'number' && Number.isFinite(val)) out[k] = val
  }
  return out
}

function pickObj(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

/**
 * 存档净化：历史/损坏的 localStorage 存档（null、undefined、NaN、类型错乱）
 * 统一回退默认值，保证进入 UI 的状态字段类型完整，
 * 杜绝「null.toLocaleString()」这类渲染崩溃与 NaN 对存档的二次污染。
 */
export function sanitizeSave(raw: unknown): GameSave {
  const d = defaultSave()
  const p = pickObj(raw)

  // 设施（兼容旧字段 tables→warehouse / reception→hall）
  const facilities = { ...d.facilities }
  const rawFac = pickObj(p.facilities)
  for (const k of Object.keys(facilities) as Array<keyof InnFacilities>) {
    const legacyKey = k === 'warehouse' ? 'tables' : k === 'hall' ? 'reception' : null
    const val = rawFac[k] ?? (legacyKey !== null ? rawFac[legacyKey] : undefined)
    facilities[k] = intAtLeast(val, d.facilities[k], 0)
  }

  // 经验药水库存（无此字段 → 老档/新档赠迎宾药水；已有则逐字段净化）
  const potions: PotionStock = { small: 0, medium: 0, large: 0 }
  if (p.potions === undefined) {
    Object.assign(potions, d.potions)
  } else {
    const rawPot = pickObj(p.potions)
    for (const k of Object.keys(potions) as Array<keyof PotionStock>) {
      potions[k] = intAtLeast(rawPot[k], 0, 0)
    }
  }

  // 体力药水库存（老档无此字段 → 赠送迎宾小瓶气力散；已有则逐字段净化）
  const staminaPotions: StaminaPotionStock = { small: 0, medium: 0, large: 0 }
  if (p.staminaPotions === undefined) {
    Object.assign(staminaPotions, d.staminaPotions)
  } else {
    const rawSp = pickObj(p.staminaPotions)
    for (const k of Object.keys(staminaPotions) as Array<keyof StaminaPotionStock>) {
      staminaPotions[k] = intAtLeast(rawSp[k], 0, 0)
    }
  }

  // 素材库存（仅保留合法素材 id，未知键丢弃）
  const materials: Record<string, number> = {}
  for (const [k, v] of Object.entries(numRecOr(p.materials, {}))) {
    if (MATERIALS_MAP[k] && v > 0) materials[k] = Math.floor(v)
  }

  // 属性石强化等级（0-5）
  const rawBoost = numRecOr(p.elementBoost, {})
  const elementBoost = { ...d.elementBoost }
  for (const k of ELEMENT_ORDER) {
    elementBoost[k] = Math.min(ELEMENT_STONE_MAX_LEVEL, intAtLeast(rawBoost[k], 0, 0))
  }

  // 灶火料理增益
  const rawCook = pickObj(p.cooking)
  const cooking = {
    until: intAtLeast(rawCook.until, 0, 0),
    goldMult: Math.max(0, finiteNum(rawCook.goldMult, 0)),
    gemMult: Math.max(0, finiteNum(rawCook.gemMult, 0)),
    dish: typeof rawCook.dish === 'string' ? rawCook.dish : undefined,
  }

  // 聚宝符增益（V1.1 道具；老档无此字段 → 未激活）
  const rawHaste = pickObj(p.haste)
  const haste = { until: intAtLeast(rawHaste.until, 0, 0) }

  // 持有妖怪（等级/星级/经验/体力/技能等级逐字段净化；全部丢失时回退初始三小妖）
  const owned: Record<string, OwnedYaoguai> = {}
  for (const [id, o] of Object.entries(pickObj(p.owned))) {
    const r = pickObj(o)
    owned[id] = {
      count: intAtLeast(r.count, 0, 0),
      star: Math.min(MAX_STAR, intAtLeast(r.star, 1, 1)),
      deployed: r.deployed === true,
      level: intAtLeast(r.level, 1, 1),
      exp: intAtLeast(r.exp, 0, 0),
      stamina: Math.max(0, Math.min(100, finiteNum(r.stamina, 100))),
      skillLevel: Math.min(SKILL_MAX_LEVEL, intAtLeast(r.skillLevel, 1, 1)),
    }
  }
  if (Object.keys(owned).length === 0) Object.assign(owned, d.owned)

  // 山野采集队（老档无此字段 → 空采集队；任命仅保留合法任务+已持有妖怪，累积值仅保留合法任务）
  const rawGather = pickObj(p.gather)
  const gather = {
    assignments: {} as Record<string, string>,
    acc: {} as Record<string, number>,
  }
  for (const [taskId, yid] of Object.entries(pickObj(rawGather.assignments))) {
    if (GATHER_TASKS_MAP[taskId] && typeof yid === 'string' && owned[yid]) {
      gather.assignments[taskId] = yid
    }
  }
  for (const [taskId, v] of Object.entries(numRecOr(rawGather.acc, {}))) {
    if (GATHER_TASKS_MAP[taskId] && v > 0) {
      gather.acc[taskId] = Math.min(GATHER_ACC_CAP, v)
    }
  }
  // 剔除已不在任命中的累积（防脏档长期驻留）
  for (const taskId of Object.keys(gather.acc)) {
    if (!gather.assignments[taskId]) delete gather.acc[taskId]
  }

  // 场景贴片实例（多实例）：仅保留合法 key / 数值坐标；老档 scenePos + decoOn 迁移为实例列表
  const validCompKeys = new Set(SCENE_COMPS.map((c) => c.key))
  const pieces: ScenePiece[] = []
  const seenPieceIds = new Set<string>()
  const pushPiece = (rawId: unknown, key: string, r: Record<string, unknown>) => {
    const x = finiteNum(r.x, NaN)
    const y = finiteNum(r.y, NaN)
    if (!Number.isFinite(x) || !Number.isFinite(y)) return
    let id = typeof rawId === 'string' && rawId ? rawId : `pc-${key}-${pieces.length}`
    while (seenPieceIds.has(id)) id = `${id}-${pieces.length}`
    seenPieceIds.add(id)
    const piece: ScenePiece = {
      id,
      key,
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
    }
    const sRaw = finiteNum(r.s, 1)
    if (Number.isFinite(sRaw) && sRaw !== 1) piece.s = Math.max(0.5, Math.min(2.5, sRaw))
    if (r.f === true) piece.f = true
    pieces.push(piece)
  }
  if (Array.isArray(p.scenePieces)) {
    for (const it of p.scenePieces) {
      if (!it || typeof it !== 'object') continue
      const r = pickObj(it)
      const key = typeof r.key === 'string' && validCompKeys.has(r.key) ? r.key : null
      if (!key) continue
      pushPiece(r.id, key, r)
    }
  } else {
    // 老档迁移：scenePos 单实例 + decoOn 装饰开关
    const legacyPos = pickObj(p.scenePos)
    const legacyDeco = pickObj(p.decoOn)
    for (const [k, v] of Object.entries(legacyPos)) {
      if (!validCompKeys.has(k)) continue
      if (k.startsWith('deco-') && legacyDeco[k] !== true) continue
      pushPiece(`pc-${k}`, k, pickObj(v))
    }
  }
  // 保底：已建设施若没有任何实例（老档未保存过位置），补一个默认位
  for (const [k, lv] of Object.entries(facilities)) {
    if (!validCompKeys.has(k) || !(lv > 0)) continue
    if (pieces.some((pc) => pc.key === k)) continue
    const comp = SCENE_COMPS.find((c) => c.key === k)
    if (!comp) continue
    pushPiece(`pc-${k}`, k, { x: comp.x, y: comp.y })
  }

  const rawDaily = pickObj(p.daily)
  const rawStats = pickObj(p.stats)
  const rawSettings = pickObj(p.settings)
  const rawSignIn = pickObj(p.signIn)

  return {
    version: 1,
    playerName: strOr(p.playerName, d.playerName),
    gold: Math.max(0, Math.floor(finiteNum(p.gold, d.gold))),
    gems: Math.max(0, Math.floor(finiteNum(p.gems, d.gems))),
    tickets: Math.max(0, Math.floor(finiteNum(p.tickets, d.tickets))),
    level: Math.max(1, Math.floor(finiteNum(p.level, d.level))),
    region:
      p.region === 3 && p.region3Opened === true
        ? 3
        : p.region === 2 && p.region2Opened === true
          ? 2
          : 1,
    region2Level: Math.max(1, Math.floor(finiteNum(p.region2Level, 1))),
    region2Opened: p.region2Opened === true,
    region3Level: Math.max(1, Math.floor(finiteNum(p.region3Level, 1))),
    region3Opened: p.region3Opened === true,
    innLevel: Math.max(1, Math.floor(finiteNum(p.innLevel, d.innLevel))),
    innExp: Math.max(0, Math.floor(finiteNum(p.innExp, 0))),
    facilities,
    potions,
    staminaPotions,
    autoRotate: p.autoRotate !== false,
    materials,
    elementBoost,
    cooking,
    haste,
    gather,
    owned,
    tujian: strArrOr(p.tujian, d.tujian),
    captured: numRecOr(p.captured, {}),
    achievements: strArrOr(p.achievements, []),
    daily: {
      date: strOr(rawDaily.date, d.daily.date),
      freeRecruitUsed: rawDaily.freeRecruitUsed === true,
      tasksClaimed: strArrOr(rawDaily.tasksClaimed, []),
      adsWatched: intAtLeast(rawDaily.adsWatched, 0, 0),
      nightDone: rawDaily.nightDone === true,
      bossNightDone: rawDaily.bossNightDone === true,
      events: numRecOr(rawDaily.events, {}),
    },
    signIn: {
      totalDays: intAtLeast(rawSignIn.totalDays, 0, 0),
      lastDate: strOr(rawSignIn.lastDate, ''),
    },
    festivalClaimed: strArrOr(p.festivalClaimed, []),
    skin: strOr(p.skin, d.skin),
    scenePieces: pieces,
    stats: {
      totalGold: Math.max(0, finiteNum(rawStats.totalGold, 0)),
      totalCaptures: intAtLeast(rawStats.totalCaptures, 0, 0),
      wins: intAtLeast(rawStats.wins, 0, 0),
      fails: intAtLeast(rawStats.fails, 0, 0),
      adViews: intAtLeast(rawStats.adViews, 0, 0),
      bossWins: intAtLeast(rawStats.bossWins, 0, 0),
      winsRegion2: intAtLeast(rawStats.winsRegion2, 0, 0),
      winsRegion3: intAtLeast(rawStats.winsRegion3, 0, 0),
      gatherTotal: intAtLeast(rawStats.gatherTotal, 0, 0),
      createdAt: intAtLeast(rawStats.createdAt, Date.now(), 0),
      lastOnline: intAtLeast(rawStats.lastOnline, Date.now(), 0),
    },
    settings: {
      sound: rawSettings.sound !== false,
      music: rawSettings.music !== false,
      sfxVolume: Math.max(0, Math.min(1, finiteNum(rawSettings.sfxVolume, 0.8))),
      bgmVolume: Math.max(0, Math.min(1, finiteNum(rawSettings.bgmVolume, 0.8))),
      seenDayGuide: rawSettings.seenDayGuide === true,
    },
  }
}

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      ...defaultSave(),
      hasHydrated: false,
      pendingOffline: null,
      lastRotation: null,

      setHydrated: () => {
        const s = get()
        // 旧存档迁移：补齐新增字段
        if (!s.achievements) set({ achievements: [] })
        if (!s.daily.events) set({ daily: { ...s.daily, events: {} } })
        if (s.daily.bossNightDone === undefined) set({ daily: { ...get().daily, bossNightDone: false } })
        if (!s.signIn) set({ signIn: { totalDays: 0, lastDate: '' } })
        if (!s.festivalClaimed) set({ festivalClaimed: [] })
        if (!s.skin) set({ skin: 'default' })
        if (s.stats.bossWins === undefined) set({ stats: { ...get().stats, bossWins: 0 } })
        // 九大设施迁移（旧 tables→warehouse / reception→hall；新设施从 0 级开始；V1.3 补温泉汤院）
        const rawFac = s.facilities as unknown as Record<string, number | undefined>
        if (
          rawFac.hall === undefined ||
          rawFac.wishAltar === undefined ||
          rawFac.hotSpring === undefined
        ) {
          set({
            facilities: {
              kitchen: rawFac.kitchen ?? 1,
              guestRoom: rawFac.guestRoom ?? 1,
              hall: rawFac.reception ?? rawFac.hall ?? 1,
              warehouse: rawFac.tables ?? rawFac.warehouse ?? 1,
              powerPool: rawFac.powerPool ?? 0,
              smithy: rawFac.smithy ?? 0,
              pharmacy: rawFac.pharmacy ?? 0,
              wishAltar: rawFac.wishAltar ?? 0,
              hotSpring: rawFac.hotSpring ?? 0,
            },
          })
        }
        // 妖怪升级字段迁移（level/exp 缺省 1/0）
        const rawOwned = get().owned
        if (Object.values(rawOwned).some((o) => o.level === undefined || o.exp === undefined)) {
          const owned: Record<string, OwnedYaoguai> = {}
          for (const [id, o] of Object.entries(rawOwned)) {
            owned[id] = { ...o, level: o.level ?? 1, exp: o.exp ?? 0 }
          }
          set({ owned })
        }
        // 体力字段迁移（老档已有妖怪满体力起步，友好兼容）
        const ownedPreStamina = get().owned
        if (Object.values(ownedPreStamina).some((o) => o.stamina === undefined)) {
          const owned: Record<string, OwnedYaoguai> = {}
          for (const [id, o] of Object.entries(ownedPreStamina)) {
            owned[id] = { ...o, stamina: o.stamina ?? 100 }
          }
          set({ owned })
        }
        // 技能等级字段迁移（V1.3 老档已有妖怪默认 Lv.1）
        const ownedPreSkill = get().owned
        if (Object.values(ownedPreSkill).some((o) => o.skillLevel === undefined)) {
          const owned: Record<string, OwnedYaoguai> = {}
          for (const [id, o] of Object.entries(ownedPreSkill)) {
            owned[id] = { ...o, skillLevel: o.skillLevel ?? 1 }
          }
          set({ owned })
        }
        // 采集队字段迁移（V1.3 老档空采集队起步）
        if (!s.gather) set({ gather: { assignments: {}, acc: {} } })
        // 自动轮换开关迁移（V1.4 起默认开启：老档未明确关闭的自动开）
        if (s.autoRotate === undefined) set({ autoRotate: true })
        // 经验药水库存迁移（老玩家送 2 小瓶+1 中瓶尝鲜）
        if (!s.potions) set({ potions: { small: 2, medium: 1, large: 0 } })
        // 素材/属性石/料理字段迁移（老玩家送迎宾材料包尝鲜）
        if (!s.materials || Object.keys(s.materials).length === 0) {
          set({ materials: { meat: 6, rice: 6, salt: 4, wine: 2, wood: 35, stone: 35, iron: 25, 'pill-normal': 2 } })
        }
        if (!s.elementBoost) {
          set({ elementBoost: { metal: 0, wood: 0, water: 0, fire: 0, earth: 0, light: 0, dark: 0 } })
        }
        if (!s.cooking) set({ cooking: { until: 0, goldMult: 0, gemMult: 0 } })
        // 聚宝符增益字段迁移（V1.1 老档默认未激活）
        if (!s.haste) set({ haste: { until: 0 } })
        // 日期切换重置每日状态
        if (s.daily.date !== today()) {
          set({
            daily: { date: today(), freeRecruitUsed: false, tasksClaimed: [], adsWatched: 0, nightDone: false, bossNightDone: false, events: {} },
          })
        }
        // 离线收益结算
        const away = Math.max(0, (Date.now() - s.stats.lastOnline) / 1000)
        if (away > 60 && s.stats.totalGold > 0) {
          const capped = Math.min(away, OFFLINE_CAP_HOURS * 3600)
          const bonus = s.jobBonus()
          const eff = OFFLINE_EFFICIENCY * (1 + bonus.offlineRate / 100)
          const gold = Math.floor(s.goldRate() * eff * capped)
          const gems = Math.floor(s.gemRate() * eff * capped)
          if (gold > 0) {
            set({ pendingOffline: { gold, gems, seconds: Math.floor(capped) } })
          }
          // 离线采集累积（V1.3：与离线收益同窗口 8h 上限 × 60% 效率，累积上限 60/任务）
          const cur0 = get()
          const gatherIds = new Set(Object.values(cur0.gather.assignments))
          if (gatherIds.size > 0) {
            const acc = { ...cur0.gather.acc }
            let accChanged = false
            for (const taskId of Object.keys(cur0.gather.assignments)) {
              const rate = gatherRateOf({ ...cur0, gather: cur0.gather }, taskId)
              if (rate <= 0) continue
              const next = Math.min(GATHER_ACC_CAP, (acc[taskId] ?? 0) + (rate * OFFLINE_EFFICIENCY / 3600) * capped)
              if (next !== acc[taskId]) {
                acc[taskId] = next
                accChanged = true
              }
            }
            if (accChanged) set({ gather: { ...cur0.gather, acc } })
          }
          // 离线体力结算：打工照常消耗 / 采集妖出野 70% 消耗 / 休息恢复（与离线收益同窗口 8h 上限；分店+温泉加成联动）
          const cur = get()
          const gatherIdsNow = new Set(Object.values(cur.gather.assignments))
          const ownedAfter = applyStaminaTick(
            cur.owned,
            capped,
            cur.facilities.guestRoom,
            cur.cooking.until > Date.now(),
            cur.region2Opened || cur.region3Opened,
            cur.facilities.hotSpring,
            gatherIdsNow
          )
          if (ownedAfter !== get().owned) set({ owned: ownedAfter })
        }
        set({ hasHydrated: true, stats: { ...get().stats, lastOnline: Date.now() } })
        // 同步音效开关（经 bridge 转发，Web → SfxEngine，小游戏 → AudioSource）
        audio.syncSetting()
      },

      tickIncome: (dt) => {
        const s = get()
        const goldGain = s.goldRate() * dt
        const gemGain = s.gemRate() * dt
        let innExp = s.innExp + Math.floor(goldGain)
        let innLevel = s.innLevel
        let need = innExpNeeded(innLevel)
        while (innExp >= need && innLevel < 60) {
          innExp -= need
          innLevel += 1
          need = innExpNeeded(innLevel)
        }
        // ---- 山野采集队累积（V1.3：任命妖怪的采集位按速率累积产出，上限 60/任务） ----
        let gather = s.gather
        const gatherIds = new Set(Object.values(s.gather.assignments))
        if (gatherIds.size > 0) {
          const acc = { ...s.gather.acc }
          let accChanged = false
          for (const taskId of Object.keys(s.gather.assignments)) {
            const rate = gatherRateOf(s, taskId)
            if (rate <= 0) continue
            const cur = acc[taskId] ?? 0
            if (cur >= GATHER_ACC_CAP) continue
            acc[taskId] = Math.min(GATHER_ACC_CAP, cur + (rate / 3600) * dt)
            accChanged = true
          }
          if (accChanged) gather = { ...s.gather, acc }
        }
        // ---- 体力结算：打工按定位消耗 / 采集妖出野 70% 消耗 / 休息恢复（客房+美食+分店+温泉加成） ----
        const cookingActive = s.cooking.until > Date.now()
        let owned = applyStaminaTick(
          s.owned,
          dt,
          s.facilities.guestRoom,
          cookingActive,
          s.region2Opened || s.region3Opened,
          s.facilities.hotSpring,
          gatherIds
        )
        // ---- 自动轮换（开启时每 15 秒检查：体力过低撤下休息，补上体力充沛的替补；采集妖不参与） ----
        rotateCheckAcc += dt
        let lastRotation = s.lastRotation
        if (s.autoRotate && rotateCheckAcc >= 15) {
          rotateCheckAcc = 0
          const rotated = autoRotateOwned(owned, s.workerLimit(), gatherIds)
          if (rotated) {
            owned = rotated.owned
            lastRotation = { rested: rotated.rested, added: rotated.added, at: Date.now() }
          }
        }
        // 挂机素材滴落：食物 + 偶尔松木（PRD：客栈经营自动产出基础食材和少量木材）
        let materials = s.materials
        const gains: Record<string, number> = {}
        matDrip.food += dt
        matDrip.wood += dt
        if (matDrip.food >= 75) {
          matDrip.food = 0
          gains[FOOD_IDS[Math.floor(Math.random() * FOOD_IDS.length)]] = 1
        }
        if (matDrip.wood >= 240) {
          matDrip.wood = 0
          gains.wood = 1
        }
        if (Object.keys(gains).length > 0) {
          const cap = matCap(s)
          let total = Object.values(materials).reduce((a, b) => a + b, 0)
          const next = { ...materials }
          for (const [id, n] of Object.entries(gains)) {
            if (total >= cap) break
            next[id] = (next[id] ?? 0) + n
            total += n
          }
          materials = next
        }
        set({
          gold: Math.floor(s.gold + goldGain),
          gems: s.gems + gemGain,
          innExp,
          innLevel,
          owned,
          lastRotation,
          materials,
          gather,
          stats: { ...s.stats, totalGold: s.stats.totalGold + goldGain, lastOnline: Date.now() },
        })
      },

      settleOffline: () => {
        const s = get()
        if (!s.pendingOffline) return
        set({
          gold: Math.floor(s.gold + s.pendingOffline.gold),
          gems: s.gems + s.pendingOffline.gems,
          pendingOffline: null,
        })
      },

      dismissOffline: () => set({ pendingOffline: null }),

      upgradeFacility: (key) => {
        const s = get()
        const cfg = FACILITIES.find((f) => f.key === key)
        if (!cfg) return
        const lv = s.facilities[key]
        if (lv >= cfg.maxLevel) return
        // 建造门槛（温泉汤院需客栈 5 级）
        if (cfg.unlockInnLevel && s.innLevel < cfg.unlockInnLevel) return
        const cost = facilityCost(cfg, lv)
        if (s.gold < cost) return
        // Lv.4+ 消耗建设素材
        const matCost = facilityMatCost(key, lv)
        for (const [id, n] of Object.entries(matCost)) {
          if ((s.materials[id] ?? 0) < n) return
        }
        set((prev) => {
          const materials = { ...prev.materials }
          for (const [id, n] of Object.entries(matCost)) materials[id] = (materials[id] ?? 0) - n
          // 设施首次建成（Lv.0 → 1）时自动摆一个默认位贴片实例
          let scenePieces = prev.scenePieces
          if (lv + 1 >= 1 && !(scenePieces ?? []).some((pc) => pc.key === key)) {
            const comp = SCENE_COMPS.find((c) => c.key === key)
            if (comp) {
              scenePieces = [
                ...(scenePieces ?? []),
                {
                  id: `pc-${Date.now().toString(36)}-${Math.floor(Math.random() * 1296).toString(36)}`,
                  key,
                  x: comp.x,
                  y: comp.y,
                },
              ]
            }
          }
          return {
            gold: s.gold - cost,
            materials,
            facilities: { ...s.facilities, [key]: lv + 1 },
            daily: { ...s.daily, events: { ...s.daily.events, upgrade: (s.daily.events.upgrade ?? 0) + 1 } },
            scenePieces,
          }
        })
      },

      addGold: (n) => set((s) => ({ gold: Math.max(0, Math.floor(s.gold + n)) })),
      addGems: (n) => set((s) => ({ gems: Math.max(0, s.gems + n) })),
      addTickets: (n) => set((s) => ({ tickets: Math.max(0, s.tickets + n) })),

      recruit: (kind) => {
        const s = get()
        // 招募池随区域轮换（V1.3.1）：当前驻扎区域的独占稀有才可能被招徕
        const region = (s.region ?? 1) as 1 | 2 | 3
        const results: string[] = []
        const grant = (id: string) => {
          results.push(id)
          set((prev) => {
            const owned = { ...prev.owned }
            const cur: OwnedYaoguai = owned[id] ? { ...owned[id] } : newOwned()
            cur.count += 1
            owned[id] = cur
            const tujian = prev.tujian.includes(id) ? prev.tujian : [...prev.tujian, id]
            return { owned, tujian }
          })
        }

        if (kind === 'free') {
          if (s.daily.freeRecruitUsed) return { ok: false, results: [], message: '今日免费招募已领取' }
          grant(Math.random() < FREE_RARE_RATE ? pickRare(region) : pickNormal())
          set((prev) => ({
            daily: { ...prev.daily, freeRecruitUsed: true, events: { ...prev.daily.events, recruit: (prev.daily.events.recruit ?? 0) + 1 } },
          }))
          return { ok: true, results }
        }

        if (kind === 'normal') {
          if (s.gold < RECRUIT_COST.normal) return { ok: false, results: [], message: '金币不足' }
          set({ gold: s.gold - RECRUIT_COST.normal })
          grant(Math.random() < NORMAL_RARE_RATE ? pickRare(region) : pickNormal())
        } else if (kind === 'ten') {
          if (s.gold < RECRUIT_COST.ten) return { ok: false, results: [], message: '金币不足' }
          set({ gold: s.gold - RECRUIT_COST.ten })
          for (let i = 0; i < 10; i++) {
            if (i === 9) grant(pickRare(region)) // 保底稀有（本区独占）
            else grant(Math.random() < NORMAL_TEN_RARE_RATE ? pickRare(region) : pickNormal())
          }
        } else if (kind === 'ticket') {
          // 招募券并入普通池（V1.3.1）：用券免费抽普通池一次，稀有概率同普通单抽
          if (s.tickets < 1) return { ok: false, results: [], message: '招募券不足' }
          set({ tickets: s.tickets - 1 })
          grant(Math.random() < NORMAL_RARE_RATE ? pickRare(region) : pickNormal())
        } else {
          // 高级招募（单抽/十连）：灵石消耗，稀有概率更高，同样随区域轮换
          if (kind === 'advancedTen') {
            // 高级十连：约九折 + 第 10 位必得稀有
            if (s.gems < RECRUIT_COST.advancedTen) return { ok: false, results: [], message: '灵石不足' }
            set({ gems: s.gems - RECRUIT_COST.advancedTen })
          } else {
            if (s.gems < RECRUIT_COST.advanced) return { ok: false, results: [], message: '灵石不足' }
            set({ gems: s.gems - RECRUIT_COST.advanced })
          }
          if (kind === 'advancedTen') {
            for (let i = 0; i < 10; i++) {
              if (i === 9) grant(pickRare(region)) // 高级十连保底稀有
              else grant(Math.random() < ADVANCED_RARE_RATE ? pickRare(region) : pickNormal())
            }
          } else {
            grant(Math.random() < ADVANCED_RARE_RATE ? pickRare(region) : pickNormal())
          }
        }

        set((prev) => ({
          daily: { ...prev.daily, events: { ...prev.daily.events, recruit: (prev.daily.events.recruit ?? 0) + 1 } },
        }))
        return { ok: true, results }
      },

      starUp: (id) => {
        const s = get()
        const owned = s.owned[id]
        if (!owned) return { ok: false, message: '未持有该妖怪' }
        if (owned.star >= MAX_STAR) return { ok: false, message: '已达最高星级' }
        const cost = STAR_UP_COST[owned.star + 1]
        if (owned.count < cost) return { ok: false, message: `还需 ${cost - owned.count} 只重复妖怪` }
        set({
          owned: { ...s.owned, [id]: { ...owned, count: owned.count - cost, star: owned.star + 1 } },
          daily: { ...s.daily, events: { ...s.daily.events, starup: (s.daily.events.starup ?? 0) + 1 } },
        })
        return { ok: true, message: `${YAOGUAI_MAP[id].name} 升至 ${owned.star + 1} 星！等级上限解锁至 ${levelCapForStar(owned.star + 1)} 级` }
      },

      feedPotion: (id, size) => {
        const s = get()
        const owned = s.owned[id]
        if (!owned) return { ok: false, message: '未持有该妖怪' }
        const potion = EXP_POTIONS.find((p) => p.id === size)
        if (!potion) return { ok: false, message: '药水不存在' }
        if ((s.potions[size] ?? 0) <= 0) return { ok: false, message: `${potion.name}不足，可在商店购买` }
        const cap = levelCapForStar(owned.star)
        if (owned.level >= cap) return { ok: false, message: `已达当前星级上限 Lv.${cap}，升星后解锁` }
        const next = applyExpToOwned(owned, potion.exp)
        set((prev) => ({
          potions: { ...prev.potions, [size]: prev.potions[size] - 1 },
          owned: { ...prev.owned, [id]: { ...owned, level: next.level, exp: next.exp } },
          daily: { ...prev.daily, events: { ...prev.daily.events, feed: (prev.daily.events.feed ?? 0) + 1 } },
        }))
        const name = YAOGUAI_MAP[id]?.name ?? id
        return {
          ok: true,
          levels: next.levels,
          message:
            next.levels > 0
            ? `${name} 升至 Lv.${next.level}！属性大涨（攻击+${Math.round(next.levels * 3)}% 生命+${Math.round(next.levels * 4)}%）`
            : `${name} 经验 +${potion.exp}（Lv.${next.level} ${next.exp}/${expToNext(next.level)}）`,
        }
      },

      buyPotion: (size) => {
        const s = get()
        const potion = EXP_POTIONS.find((p) => p.id === size)
        if (!potion) return { ok: false, message: '药水不存在' }
        if (potion.currency === 'gold') {
          if (s.gold < potion.price) return { ok: false, message: '金币不足' }
          set((prev) => ({ gold: prev.gold - potion.price, potions: { ...prev.potions, [size]: prev.potions[size] + 1 } }))
        } else {
          if (s.gems < potion.price) return { ok: false, message: '灵石不足' }
          set((prev) => ({ gems: prev.gems - potion.price, potions: { ...prev.potions, [size]: prev.potions[size] + 1 } }))
        }
        return { ok: true, message: `购得 ${potion.name}×1` }
      },

      // ---------- 体力与轮换 ----------

      buyStaminaPotion: (size) => {
        const s = get()
        const potion = STAMINA_POTIONS.find((p) => p.id === size)
        if (!potion) return { ok: false, message: '药水不存在' }
        if ((s.staminaPotions[size] ?? 0) >= 99) return { ok: false, message: '库存已足（上限 99）' }
        if (potion.currency === 'gold') {
          if (s.gold < potion.price) return { ok: false, message: '金币不足' }
          set((prev) => ({
            gold: prev.gold - potion.price,
            staminaPotions: { ...prev.staminaPotions, [size]: (prev.staminaPotions[size] ?? 0) + 1 },
          }))
        } else {
          if (s.gems < potion.price) return { ok: false, message: '灵石不足' }
          set((prev) => ({
            gems: prev.gems - potion.price,
            staminaPotions: { ...prev.staminaPotions, [size]: (prev.staminaPotions[size] ?? 0) + 1 },
          }))
        }
        return { ok: true, message: `购得 ${potion.name}×1` }
      },

      useStaminaPotion: (id, size) => {
        const s = get()
        const potion = STAMINA_POTIONS.find((p) => p.id === size)
        if (!potion) return { ok: false, message: '药水不存在' }
        if ((s.staminaPotions[size] ?? 0) <= 0) return { ok: false, message: `${potion.name}不足，可在商店购买` }

        if (potion.target === 'single') {
          if (!id) return { ok: false, message: '请选择要恢复的妖怪' }
          const o = s.owned[id]
          if (!o) return { ok: false, message: '未持有该妖怪' }
          if ((o.stamina ?? 100) >= 100) return { ok: false, message: `${YAOGUAI_MAP[id]?.name ?? '该妖怪'}体力已满` }
          const next = Math.min(100, (o.stamina ?? 100) + potion.value)
          set((prev) => ({
            staminaPotions: { ...prev.staminaPotions, [size]: (prev.staminaPotions[size] ?? 0) - 1 },
            owned: { ...prev.owned, [id]: { ...o, stamina: next } },
            daily: {
              ...prev.daily,
              events: { ...prev.daily.events, staminaPotion: (prev.daily.events.staminaPotion ?? 0) + 1 },
            },
          }))
          return { ok: true, message: `${YAOGUAI_MAP[id]?.name ?? id} 体力恢复至 ${Math.round(next)}（${staminaTier(next).name}）` }
        }

        // 大瓶：全体恢复
        if (!Object.values(s.owned).some((o) => (o.stamina ?? 100) < 100)) {
          return { ok: false, message: '全体妖怪体力均已充沛' }
        }
        set((prev) => {
          const owned = { ...prev.owned }
          for (const [k, o] of Object.entries(owned)) {
            owned[k] = { ...o, stamina: Math.min(100, (o.stamina ?? 100) + potion.value) }
          }
          return {
            staminaPotions: { ...prev.staminaPotions, [size]: (prev.staminaPotions[size] ?? 0) - 1 },
            owned,
            daily: {
              ...prev.daily,
              events: { ...prev.daily.events, staminaPotion: (prev.daily.events.staminaPotion ?? 0) + 1 },
            },
          }
        })
        return { ok: true, message: `${potion.name}：全体妖怪体力 +${potion.value}！` }
      },

      recoverStaminaByAd: () => {
        const s = get()
        if (!Object.values(s.owned).some((o) => (o.stamina ?? 100) < 100)) {
          return { ok: false, message: '全体妖怪体力均已充沛' }
        }
        const gain = 100 * AD_STAMINA_RECOVER
        set((prev) => {
          const owned = { ...prev.owned }
          for (const [k, o] of Object.entries(owned)) {
            owned[k] = { ...o, stamina: Math.min(100, (o.stamina ?? 100) + gain) }
          }
          return {
            owned,
            daily: {
              ...prev.daily,
              events: { ...prev.daily.events, staminaAd: (prev.daily.events.staminaAd ?? 0) + 1 },
            },
          }
        })
        return { ok: true, message: `全体妖怪体力恢复 ${Math.round(AD_STAMINA_RECOVER * 100)}%！` }
      },

      setAutoRotate: (on) => {
        set({ autoRotate: on })
        rotateCheckAcc = 0
      },

      /**
       * 一键补充体力（V1.1）：为所有体力不足的妖怪智能使用气力散
       * 策略：按体力从低到高逐只补；缺口≤30 用小瓶、>30 用中瓶（避免溢出浪费）；
       * 首选无库存时自动改用另一档；大瓶回元丹（灵石货）不自动消耗。
       */
      oneClickStaminaRecover: () => {
        const s = get()
        let small = s.staminaPotions.small ?? 0
        let medium = s.staminaPotions.medium ?? 0
        const lowList = Object.entries(s.owned)
          .filter(([, o]) => (o.stamina ?? 100) < 100)
          .sort((a, b) => (a[1].stamina ?? 100) - (b[1].stamina ?? 100))
        if (lowList.length === 0) return { ok: false, message: '全体妖怪体力均已充沛' }
        if (small + medium <= 0)
          return { ok: false, message: '气力散库存不足：可看广告恢复，或去商店购买小瓶/中瓶' }

        const owned = { ...s.owned }
        let usedSmall = 0
        let usedMedium = 0
        let recovered = 0
        for (const [id, o] of lowList) {
          const cur = o.stamina ?? 100
          const gap = 100 - cur
          // 智能选药：小缺口用小瓶，大缺口用中瓶；首选无库存时改用另一档
          let potion: 'small' | 'medium' | null = null
          if (gap <= 30) {
            if (small > 0) potion = 'small'
            else if (medium > 0) potion = 'medium'
          } else {
            if (medium > 0) potion = 'medium'
            else if (small > 0) potion = 'small'
          }
          if (!potion) break
          const value = potion === 'small' ? 30 : 60
          owned[id] = { ...o, stamina: Math.min(100, cur + value) }
          if (potion === 'small') {
            small -= 1
            usedSmall += 1
          } else {
            medium -= 1
            usedMedium += 1
          }
          recovered += 1
        }
        if (recovered === 0)
          return { ok: false, message: '气力散库存不足：可看广告恢复，或去商店购买' }

        set((prev) => ({
          owned,
          staminaPotions: {
            ...prev.staminaPotions,
            small: Math.max(0, (prev.staminaPotions.small ?? 0) - usedSmall),
            medium: Math.max(0, (prev.staminaPotions.medium ?? 0) - usedMedium),
          },
          daily: {
            ...prev.daily,
            events: { ...prev.daily.events, staminaPotion: (prev.daily.events.staminaPotion ?? 0) + usedSmall + usedMedium },
          },
        }))
        const parts: string[] = []
        if (usedSmall > 0) parts.push(`小瓶×${usedSmall}`)
        if (usedMedium > 0) parts.push(`中瓶×${usedMedium}`)
        const leftover = lowList.length - recovered
        const tail =
          leftover > 0
            ? `；药水用尽，${leftover} 只待恢复（可看广告）`
            : '，体力全部补满！'
        return { ok: true, message: `一键补充 ${recovered} 只（${parts.join(' + ')}）${tail}` }
      },

      drainBattleStamina: (ids, cost) => {
        if (!ids || ids.length === 0 || cost <= 0) return
        set((prev) => {
          const owned = { ...prev.owned }
          for (const id of ids) {
            const o = owned[id]
            if (!o) continue
            owned[id] = { ...o, stamina: Math.max(0, (o.stamina ?? 100) - cost) }
          }
          return { owned }
        })
      },

      // ---------- 素材系统 ----------

      addMaterials: (gains) => {
        if (!gains) return
        set((prev) => {
          const cap = matCap(prev)
          const cur = { ...prev.materials }
          let total = Object.values(cur).reduce((a, b) => a + b, 0)
          for (const [id, n] of Object.entries(gains)) {
            if (!MATERIALS_MAP[id] || n <= 0) continue
            const room = Math.max(0, cap - total)
            if (room <= 0) break
            const add = Math.min(room, Math.floor(n))
            cur[id] = (cur[id] ?? 0) + add
            total += add
          }
          return { materials: cur }
        })
      },

      synthMaterial: (recipeId) => {
        const s = get()
        const recipe = MAT_RECIPES.find((r) => r.id === recipeId)
        if (!recipe) return { ok: false, message: '配方不存在' }
        const have = s.materials[recipe.from.id] ?? 0
        if (have < recipe.from.n) {
          return { ok: false, message: `${MATERIALS_MAP[recipe.from.id]?.name ?? recipe.from.id}不足（需 ${recipe.from.n}）` }
        }
        const cap = matCap(s)
        const total = Object.values(s.materials).reduce((a, b) => a + b, 0)
        if (total - recipe.from.n + recipe.to.n > cap) return { ok: false, message: '仓库容量不足，先出售或消耗些素材' }
        set((prev) => ({
          materials: {
            ...prev.materials,
            [recipe.from.id]: (prev.materials[recipe.from.id] ?? 0) - recipe.from.n,
            [recipe.to.id]: (prev.materials[recipe.to.id] ?? 0) + recipe.to.n,
          },
          daily: { ...prev.daily, events: { ...prev.daily.events, synth: (prev.daily.events.synth ?? 0) + 1 } },
        }))
        return { ok: true, message: `合成 ${MATERIALS_MAP[recipe.to.id]?.name ?? recipe.to.id}×${recipe.to.n}` }
      },

      sellMaterial: (id, n) => {
        const s = get()
        const def = MATERIALS_MAP[id]
        if (!def) return { ok: false, message: '素材不存在' }
        const have = s.materials[id] ?? 0
        const sell = Math.min(have, Math.max(1, Math.floor(n)))
        if (have <= 0) return { ok: false, message: '库存不足' }
        const gold = sell * def.sellPrice
        set((prev) => ({
          materials: { ...prev.materials, [id]: (prev.materials[id] ?? 0) - sell },
          gold: Math.floor(prev.gold + gold),
        }))
        return { ok: true, message: `出售 ${def.name}×${sell}，入账 ${gold} 金币` }
      },

      upgradeElementStone: (el) => {
        const s = get()
        const lv = s.elementBoost[el] ?? 0
        if (lv >= ELEMENT_STONE_MAX_LEVEL) return { ok: false, message: '已强化至满级' }
        const cost = stoneUpCost(lv)
        const sid = stoneIdFor(el)
        const stones = s.materials[sid] ?? 0
        if (stones < cost.stones) return { ok: false, message: `还需 ${MATERIALS_MAP[sid]?.name ?? sid}×${cost.stones - stones}` }
        if (s.gems < cost.gems) return { ok: false, message: `灵石不足（需 ${cost.gems}）` }
        set((prev) => ({
          gems: prev.gems - cost.gems,
          materials: { ...prev.materials, [sid]: (prev.materials[sid] ?? 0) - cost.stones },
          elementBoost: { ...prev.elementBoost, [el]: lv + 1 },
        }))
        return {
          ok: true,
          message: `${MATERIALS_MAP[sid]?.name ?? sid}强化至 ${lv + 1} 级，克制伤害 +${(lv + 1) * 5}%`,
        }
      },

      cookDish: (dishId) => {
        const s = get()
        const dish = COOK_DISHES.find((d) => d.id === dishId)
        if (!dish) return { ok: false, message: '菜品不存在' }
        for (const [id, n] of Object.entries(dish.cost)) {
          if ((s.materials[id] ?? 0) < n) {
            return { ok: false, message: `${MATERIALS_MAP[id]?.name ?? id}不足（需 ${n}）` }
          }
        }
        const now = Date.now()
        // 已有增益：时长叠加（同类不叠加倍率，取较高者）
        const base = s.cooking.until > now ? s.cooking.until : now
        const until = base + dish.minutes * 60_000
        set((prev) => {
          const materials = { ...prev.materials }
          for (const [id, n] of Object.entries(dish.cost)) materials[id] = (materials[id] ?? 0) - n
          return {
            materials,
            cooking: {
              until,
              goldMult: Math.max(prev.cooking.goldMult, dish.goldMult),
              gemMult: Math.max(prev.cooking.gemMult, dish.gemMult),
              dish: dish.name,
            },
            daily: { ...prev.daily, events: { ...prev.daily.events, cook: (prev.daily.events.cook ?? 0) + 1 } },
          }
        })
        return { ok: true, message: `${dish.name}上桌！${dish.desc}` }
      },

      toggleDeploy: (id) => {
        const s = get()
        const owned = s.owned[id]
        if (!owned) return { ok: false, message: '未持有' }
        if (!owned.deployed) {
          const deployedCount = Object.values(s.owned).filter((o) => o.deployed).length
          if (deployedCount >= s.workerLimit()) return { ok: false, message: '打工位已满，升级客房解锁更多' }
        }
        // 上岗打工时自动召回采集位（出野与打工不可兼任）
        let gather = s.gather
        if (!owned.deployed) {
          const taskId = Object.entries(s.gather.assignments).find(([, yid]) => yid === id)?.[0]
          if (taskId) {
            const assignments = { ...s.gather.assignments }
            delete assignments[taskId]
            gather = { ...s.gather, assignments }
          }
        }
        set({ owned: { ...s.owned, [id]: { ...owned, deployed: !owned.deployed } }, gather })
        return {
          ok: true,
          message: owned.deployed
            ? '已安排休息'
            : Object.values(gather.assignments).includes(id)
              ? '已上岗打工（已召回采集位）'
              : '已上岗打工',
        }
      },

      assignGatherer: (taskId, yaoguaiId) => {
        const s = get()
        const task = GATHER_TASKS_MAP[taskId]
        if (!task) return { ok: false, message: '采集任务不存在' }
        if (s.innLevel < task.unlockInnLevel)
          return { ok: false, message: `客栈等级达到 ${task.unlockInnLevel} 级后解锁此采集位` }
        const assignments = { ...s.gather.assignments }
        const acc = { ...s.gather.acc }
        // 同一只妖只能驻一个采集位：先从其他位召回
        for (const [tid, yid] of Object.entries(assignments)) {
          if (yid === yaoguaiId) {
            delete assignments[tid]
            if (!acc[tid]) delete acc[tid]
          }
        }
        if (yaoguaiId === null) {
          delete assignments[taskId]
          delete acc[taskId]
          set({ gather: { assignments, acc } })
          return { ok: true, message: '已召回采集妖' }
        }
        const o = s.owned[yaoguaiId]
        if (!o) return { ok: false, message: '未持有该妖怪' }
        // 上岗采集自动撤下打工位（出野与打工不可兼任）
        let owned = s.owned
        if (o.deployed) {
          owned = { ...s.owned, [yaoguaiId]: { ...o, deployed: false } }
        }
        assignments[taskId] = yaoguaiId
        if (acc[taskId] === undefined) acc[taskId] = 0
        set({ owned, gather: { assignments, acc } })
        const def = YAOGUAI_MAP[yaoguaiId]
        return {
          ok: true,
          message: `${def?.name ?? '妖怪'}已前往「${task.name}」${o.deployed ? '（已撤下打工位）' : ''}`,
        }
      },

      collectGather: () => {
        const s = get()
        const gained: Record<string, number> = {}
        let total = 0
        const acc = { ...s.gather.acc }
        const cap = matCap(s)
        let stock = Object.values(s.materials).reduce((a, b) => a + b, 0)
        for (const [taskId, v] of Object.entries(acc)) {
          const task = GATHER_TASKS_MAP[taskId]
          if (!task) continue
          const n = Math.floor(v)
          if (n <= 0) continue
          const room = Math.max(0, cap - stock)
          if (room <= 0) break
          const add = Math.min(room, n)
          gained[task.material] = (gained[task.material] ?? 0) + add
          total += add
          stock += add
          acc[taskId] = v - add // 保留小数进度
        }
        if (total <= 0) {
          return { ok: false, gained, total: 0, message: Object.keys(s.gather.assignments).length === 0 ? '还没有妖怪在采集' : '暂无可收取的产出' }
        }
        const materials = { ...s.materials }
        for (const [id, n] of Object.entries(gained)) {
          materials[id] = (materials[id] ?? 0) + n
        }
        set({
          materials,
          gather: { ...s.gather, acc },
          stats: { ...s.stats, gatherTotal: (s.stats.gatherTotal ?? 0) + total },
          daily: { ...s.daily, events: { ...s.daily.events, gather: (s.daily.events.gather ?? 0) + 1 } },
        })
        const parts = Object.entries(gained).map(([id, n]) => `${MATERIALS_MAP[id]?.name ?? id}×${n}`)
        return { ok: true, gained, total, message: `采收入账：${parts.join('、')}` }
      },

      upgradeSkill: (id) => {
        const s = get()
        const o = s.owned[id]
        if (!o) return { ok: false, message: '未持有该妖怪' }
        const cur = o.skillLevel ?? 1
        if (cur >= SKILL_MAX_LEVEL) return { ok: false, message: '技能已至臻化境（Lv.5）' }
        const cap = skillLevelCapForStar(o.star)
        if (cur >= cap) return { ok: false, message: `技能等级受星级限制（${o.star}星上限 Lv.${cap}），先升星再精进` }
        const cost = skillUpCost(cur + 1)
        if (!cost) return { ok: false, message: '配置异常' }
        if (s.gold < cost.gold) return { ok: false, message: `还需金币 ${cost.gold - s.gold}` }
        if (s.gems < cost.gems) return { ok: false, message: `还需灵石 ${cost.gems - s.gems}` }
        if ((s.materials['pill-normal'] ?? 0) < cost.pillNormal)
          return { ok: false, message: `还需妖丹 ${cost.pillNormal - (s.materials['pill-normal'] ?? 0)}（夜战掉落）` }
        if ((s.materials['pill-rare'] ?? 0) < cost.pillRare)
          return { ok: false, message: `还需稀有妖丹 ${cost.pillRare - (s.materials['pill-rare'] ?? 0)}（妖王夜掉落）` }
        const materials = { ...s.materials }
        if (cost.pillNormal > 0) materials['pill-normal'] = (materials['pill-normal'] ?? 0) - cost.pillNormal
        if (cost.pillRare > 0) materials['pill-rare'] = (materials['pill-rare'] ?? 0) - cost.pillRare
        set({
          gold: s.gold - cost.gold,
          gems: s.gems - cost.gems,
          materials,
          owned: { ...s.owned, [id]: { ...o, skillLevel: cur + 1 } },
          daily: { ...s.daily, events: { ...s.daily.events, skillup: (s.daily.events.skillup ?? 0) + 1 } },
        })
        return { ok: true, message: `技能精进至 Lv.${cur + 1}（效果 +${cur * 15 + 15}%）` }
      },

      addCaptured: (id) => {
        set((prev) => {
          const owned = { ...prev.owned }
          const cur: OwnedYaoguai = owned[id] ? { ...owned[id] } : newOwned()
          cur.count += 1
          owned[id] = cur
          const tujian = prev.tujian.includes(id) ? prev.tujian : [...prev.tujian, id]
          return {
            owned,
            tujian,
            stats: { ...prev.stats, totalCaptures: prev.stats.totalCaptures + 1 },
            daily: { ...prev.daily, events: { ...prev.daily.events, capture: (prev.daily.events.capture ?? 0) + 1 } },
          }
        })
      },

      recordCaptureAttempt: (id) => {
        set((prev) => ({ captured: { ...prev.captured, [id]: (prev.captured[id] ?? 0) + 1 } }))
      },

      consumeBossLure: () => {
        const s = get()
        if ((s.materials['boss-lure'] ?? 0) <= 0)
          return { ok: false, message: '未持有妖王诱引香（商店有售）' }
        if (!s.daily.bossNightDone) return { ok: false, message: '今夜妖王尚未退散，先去正面迎敌吧' }
        set((prev) => ({
          materials: { ...prev.materials, 'boss-lure': (prev.materials['boss-lure'] ?? 0) - 1 },
        }))
        return { ok: true, message: '焚香引妖：妖王循香而至！' }
      },

      /** 张开缚妖网（V1.1）：夜战中消耗，本场收服成功率 +15% */
      consumeCaptureNet: () => {
        const s = get()
        if ((s.materials[CAPTURE_NET.id] ?? 0) <= 0)
          return { ok: false, message: `未持有${CAPTURE_NET.name}（商店法宝铺有售）` }
        set((prev) => ({
          materials: { ...prev.materials, [CAPTURE_NET.id]: (prev.materials[CAPTURE_NET.id] ?? 0) - 1 },
        }))
        return { ok: true, message: `张开${CAPTURE_NET.name}：本场收服成功率 +${Math.round(CAPTURE_NET.bonus * 100)}%！` }
      },

      /** 激活聚宝符（V1.1）：消耗后限时挂机收益 ×2（重复激活延长） */
      consumeHasteTalisman: () => {
        const s = get()
        if ((s.materials[HASTE_TALISMAN.id] ?? 0) <= 0)
          return { ok: false, message: `未持有${HASTE_TALISMAN.name}（商店法宝铺有售）` }
        const now = Date.now()
        // 生效中再次激活 → 从当前截止时间顺延（不打折）；过期后激活 → 从现在起算
        const base = s.haste?.until && s.haste.until > now ? s.haste.until : now
        const until = base + HASTE_TALISMAN.minutes * 60 * 1000
        set((prev) => ({
          materials: { ...prev.materials, [HASTE_TALISMAN.id]: (prev.materials[HASTE_TALISMAN.id] ?? 0) - 1 },
          haste: { until },
        }))
        const mins = Math.round((until - now) / 60000)
        return { ok: true, message: `${HASTE_TALISMAN.name}激活：挂机收益 ×${HASTE_TALISMAN.mult}，持续至 ${mins} 分钟后！` }
      },

      finishBattle: (victory, gold, gems, tickets, waveReached, bossNight, lineupIds, materialsGained) => {
        const prev = get()
        // 参战妖怪经验结算（每只上阵妖获得相同经验，满级不累计）
        const expGained: Record<string, number> = {}
        const expPer = battleExpGain(waveReached, victory, bossNight ?? false)
        let owned = prev.owned
        if (lineupIds && lineupIds.length > 0) {
          owned = { ...prev.owned }
          for (const id of lineupIds) {
            const o = owned[id]
            if (!o) continue
            const cap = levelCapForStar(o.star)
            if (o.level >= cap) continue
            const next = applyExpToOwned(o, expPer)
            owned[id] = { ...o, level: next.level, exp: next.exp }
            expGained[id] = expPer
          }
        }
        // 素材掉落入仓库（尊重存储上限）
        let materials = prev.materials
        if (materialsGained && Object.keys(materialsGained).length > 0) {
          const cap = matCap(prev)
          let total = Object.values(materials).reduce((a, b) => a + b, 0)
          const next = { ...materials }
          for (const [id, n] of Object.entries(materialsGained)) {
            if (!MATERIALS_MAP[id] || n <= 0) continue
            const room = Math.max(0, cap - total)
            if (room <= 0) break
            const add = Math.min(room, Math.floor(n))
            next[id] = (next[id] ?? 0) + add
            total += add
          }
          materials = next
        }
        // 区域结算：妖王夜为独立挑战不推关卡；区域二/三胜利推各自分店进度
        const inRegion2 = prev.region === 2 && prev.region2Opened === true
        const inRegion3 = prev.region === 3 && prev.region3Opened === true
        set({
          owned,
          materials,
          gold: Math.floor(prev.gold + gold),
          gems: prev.gems + gems,
          tickets: prev.tickets + tickets,
          // 妖王夜为独立挑战：不推进主线关卡
          level: victory && !bossNight && !inRegion2 && !inRegion3 ? prev.level + 1 : prev.level,
          region2Level:
            victory && !bossNight && inRegion2 ? (prev.region2Level ?? 1) + 1 : (prev.region2Level ?? 1),
          region3Level:
            victory && !bossNight && inRegion3 ? (prev.region3Level ?? 1) + 1 : (prev.region3Level ?? 1),
          stats: {
            ...prev.stats,
            wins: prev.stats.wins + (victory && !bossNight ? 1 : 0),
            fails: prev.stats.fails + (victory ? 0 : 1),
            bossWins: prev.stats.bossWins + (victory && bossNight ? 1 : 0),
            winsRegion2: (prev.stats.winsRegion2 ?? 0) + (victory && !bossNight && inRegion2 ? 1 : 0),
            winsRegion3: (prev.stats.winsRegion3 ?? 0) + (victory && !bossNight && inRegion3 ? 1 : 0),
          },
          daily: {
            ...prev.daily,
            nightDone: true,
            bossNightDone: prev.daily.bossNightDone || (victory && !!bossNight),
            events: { ...prev.daily.events, night: (prev.daily.events.night ?? 0) + 1 },
          },
        })
        return { expGained }
      },

      claimSignIn: () => {
        const s = get()
        if (s.signIn.lastDate === today()) return { ok: false, message: '今日已签到，明天再来～' }
        const totalDays = s.signIn.totalDays + 1
        // 7 天一轮循环：当前领取的是第 (totalDays-1) % 7 + 1 天奖励
        const dayIndex = (totalDays - 1) % 7
        const reward = SEVEN_DAY_REWARDS[dayIndex]
        set({
          gold: Math.floor(s.gold + (reward.gold ?? 0)),
          gems: s.gems + (reward.gems ?? 0),
          tickets: s.tickets + (reward.tickets ?? 0),
          signIn: { totalDays, lastDate: today() },
        })
        return { ok: true, message: `第 ${dayIndex + 1} 天签到成功！`, day: dayIndex + 1 }
      },

      claimFestivalGift: () => {
        const s = get()
        const fest = activeFestival()
        if (!fest) return { ok: false, message: '当前没有节日活动' }
        const gid = festivalGiftId(fest)
        if (s.festivalClaimed.includes(gid)) return { ok: false, message: '节日礼包已领取过啦' }
        set({
          gold: Math.floor(s.gold + (fest.gift.gold ?? 0)),
          gems: s.gems + (fest.gift.gems ?? 0),
          tickets: s.tickets + (fest.gift.tickets ?? 0),
          festivalClaimed: [...s.festivalClaimed, gid],
        })
        return { ok: true, message: `${fest.name}礼包：${fest.giftDesc}` }
      },

      setSkin: (id) => {
        const s = get()
        const skin = SKINS.find((k) => k.id === id)
        if (!skin) return { ok: false, message: '皮肤不存在' }
        if (!skinUnlocked(s, id)) return { ok: false, message: '该皮肤尚未解锁' }
        if (s.skin === id) return { ok: false, message: '当前已穿戴该皮肤' }
        set({ skin: id })
        return { ok: true, message: `客栈换上了「${skin.name}」` }
      },

      setPiecePos: (id, x, y, s) => {
        const s0 = get()
        const list = s0.scenePieces ?? []
        if (!list.some((pc) => pc.id === id)) return
        const next = list.map((pc) => {
          if (pc.id !== id) return pc
          const np: ScenePiece = {
            ...pc,
            x: Math.max(0, Math.min(100, x)),
            y: Math.max(0, Math.min(100, y)),
          }
          if (typeof s === 'number') {
            const sc = Math.max(0.5, Math.min(2.5, s))
            if (sc !== 1) np.s = sc
            else delete np.s
          }
          return np
        })
        set({ scenePieces: next })
      },

      flipPiece: (id) => {
        const s0 = get()
        set({
          scenePieces: (s0.scenePieces ?? []).map((pc) => {
            if (pc.id !== id) return pc
            const np: ScenePiece = { ...pc }
            if (np.f) delete np.f
            else np.f = true
            return np
          }),
        })
      },

      removePiece: (id) => {
        const s0 = get()
        set({ scenePieces: (s0.scenePieces ?? []).filter((pc) => pc.id !== id) })
      },

      addPiece: (key, x, y) => {
        const s0 = get()
        const comp = SCENE_COMPS.find((c) => c.key === key)
        if (!comp) return null
        const lvl = comp.facility ? (s0.facilities[key as keyof typeof s0.facilities] ?? 0) : 0
        if (comp.facility && lvl <= 0) return null
        const list = s0.scenePieces ?? []
        if (list.filter((pc) => pc.key === key).length >= sceneCap(comp, lvl)) return null
        // 全院总上限（随客栈等级扩容）
        if (list.length >= sceneTotalCap(s0.innLevel)) return null
        const id = `pc-${Date.now().toString(36)}-${Math.floor(Math.random() * 1296).toString(36)}`
        set({
          scenePieces: [
            ...list,
            { id, key, x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) },
          ],
        })
        return id
      },

      setRegion: (region) => {
        const s = get()
        if (region === s.region) return { ok: false, message: '今夜已驻扎此地' }
        if (region === 2 && !s.region2Opened) return { ok: false, message: '水墨幽谷分店尚未开设' }
        if (region === 3 && !s.region3Opened) return { ok: false, message: '沸火赤川分店尚未开设' }
        const def = regionDef(region)
        set({ region })
        return { ok: true, message: `今夜移驻「${def.name}」，伴曲「${def.subtitle}」` }
      },

      openRegion2: () => {
        const s = get()
        if (s.region2Opened) return { ok: false, message: '水墨别院已开张' }
        if (!region2Unlockable(s)) return { ok: false, message: '前置条件尚未满足' }
        if (s.gold < REGION2_UNLOCK.openCost) return { ok: false, message: `开设分店还需 ${REGION2_UNLOCK.openCost - s.gold} 金币` }
        set({
          gold: s.gold - REGION2_UNLOCK.openCost,
          region2Opened: true,
          region: 2,
        })
        return { ok: true, message: '🖌️ 水墨别院开张！挂机收益 +30%，休息恢复 +20%' }
      },

      openRegion3: () => {
        const s = get()
        if (s.region3Opened) return { ok: false, message: '沸泉别馆已开张' }
        if (!region3Unlockable(s)) return { ok: false, message: '前置条件尚未满足' }
        if (s.gold < REGION3_UNLOCK.openCost) return { ok: false, message: `开设分店还需 ${REGION3_UNLOCK.openCost - s.gold} 金币` }
        set({
          gold: s.gold - REGION3_UNLOCK.openCost,
          region3Opened: true,
          region: 3,
        })
        return { ok: true, message: '🔥 沸泉别馆开张！挂机收益 +50%，休息恢复 +30%' }
      },

      markDaily: (event) => {
        set((prev) => ({
          daily: { ...prev.daily, events: { ...prev.daily.events, [event]: (prev.daily.events[event] ?? 0) + 1 } },
        }))
      },

      claimTask: (id) => {
        const s = get()
        const task = DAILY_TASKS.find((t) => t.id === id)
        if (!task) return { ok: false, message: '任务不存在' }
        if (s.daily.tasksClaimed.includes(id)) return { ok: false, message: '已领取' }
        // 完成判定
        const progress =
          task.id === 'login'
            ? 1
            : task.id === 'night'
              ? s.daily.events.night ?? 0
              : task.id === 'capture'
                ? s.daily.events.capture ?? 0
                : task.id === 'recruit'
                  ? s.daily.events.recruit ?? 0
                  : task.id === 'upgrade'
                    ? s.daily.events.upgrade ?? 0
                    : task.id === 'starup'
                      ? s.daily.events.starup ?? 0
                      : s.daily.events.ad ?? 0
        if (progress < task.target) return { ok: false, message: '任务未完成' }
        set({
          gold: Math.floor(s.gold + (task.reward.gold ?? 0)),
          gems: s.gems + (task.reward.gems ?? 0),
          tickets: s.tickets + (task.reward.tickets ?? 0),
          daily: { ...s.daily, tasksClaimed: [...s.daily.tasksClaimed, id] },
        })
        return { ok: true, message: '领取成功！' }
      },

      claimTujianReward: (count) => {
        const s = get()
        const rewardKey = `tujian-${count}`
        if (s.daily.tasksClaimed.includes(rewardKey)) return { ok: false, message: '已领取' }
        const reward = TUJIAN_REWARDS.find((r) => r.count === count)
        if (!reward) return { ok: false, message: '奖励不存在' }
        if (s.tujian.length < count) return { ok: false, message: '收集数量不足' }
        set({
          gold: Math.floor(s.gold + (reward.reward.gold ?? 0)),
          gems: s.gems + (reward.reward.gems ?? 0),
          tickets: s.tickets + (reward.reward.tickets ?? 0),
          daily: { ...s.daily, tasksClaimed: [...s.daily.tasksClaimed, rewardKey] },
        })
        return { ok: true, message: '收集奖励已领取！' }
      },

      claimAchievement: (id) => {
        const s = get()
        const def = ACHIEVEMENTS.find((a) => a.id === id)
        if (!def) return { ok: false, message: '成就不存在' }
        if (s.achievements.includes(id)) return { ok: false, message: '已领取' }
        if (achievementProgress(s, id) < def.target) return { ok: false, message: '成就未达成' }
        set({
          gold: Math.floor(s.gold + (def.reward.gold ?? 0)),
          gems: s.gems + (def.reward.gems ?? 0),
          tickets: s.tickets + (def.reward.tickets ?? 0),
          achievements: [...s.achievements, id],
        })
        return { ok: true, message: `成就达成：${def.name}！` }
      },

      watchAd: () => {
        set((prev) => ({
          stats: { ...prev.stats, adViews: prev.stats.adViews + 1 },
          daily: {
            ...prev.daily,
            adsWatched: prev.daily.adsWatched + 1,
            events: { ...prev.daily.events, ad: (prev.daily.events.ad ?? 0) + 1 },
          },
        }))
      },

      toggleSetting: (key) => {
        set((s) => {
          const next = { ...s.settings, [key]: !s.settings[key] }
          if (key === 'sound') audio.setEnabled(next.sound)
          return { settings: next }
        })
      },

      /** 独立音量调节（0-1；实时写入音频总线并存档） */
      setVolume: (key, v) => {
        const clamped = Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0.8))
        set((s) => ({
          settings:
            key === 'sfx'
              ? { ...s.settings, sfxVolume: clamped }
              : { ...s.settings, bgmVolume: clamped },
        }))
        if (key === 'sfx') audio.setSfxVolume(clamped)
        else audio.setBgmVolume(clamped)
      },

      markDayGuideSeen: () => {
        set((s) =>
          s.settings.seenDayGuide ? s : { settings: { ...s.settings, seenDayGuide: true } }
        )
      },

      resetGame: () => {
        set({ ...defaultSave(), hasHydrated: true, pendingOffline: null })
      },

      // ---------- 派生计算 ----------

      jobBonus: () => {
        const s = get()
        const bonus = { goldRate: 0, gemRate: 0, globalRate: 0, offlineRate: 0, innHpRate: 0, rareRate: 0 }
        for (const [id, owned] of Object.entries(s.owned)) {
          if (!owned.deployed) continue
          const def = YAOGUAI_MAP[id]
          if (!def) continue
          const starMult = 1 + (owned.star - 1) * 0.25
          // 体力档位影响打工效率（疲惫 60% / 力竭 30% / 虚脱 0%）
          const jobEff = staminaTier(owned.stamina ?? 100).jobEff
          bonus.goldRate += (def.dayStats.goldRate ?? 0) * starMult * jobEff
          bonus.gemRate += (def.dayStats.gemRate ?? 0) * starMult * jobEff
          bonus.globalRate += (def.dayStats.globalRate ?? 0) * starMult * jobEff
          bonus.offlineRate += (def.dayStats.offlineRate ?? 0) * starMult * jobEff
          bonus.innHpRate += (def.dayStats.innHpRate ?? 0) * starMult * jobEff
          bonus.rareRate += (def.dayStats.rareRate ?? 0) * starMult * jobEff
        }
        return bonus
      },

      goldRate: () => {
        const s = get()
        const bonus = s.jobBonus()
        const fest = activeFestival()
        const cook = s.cooking.until > Date.now() ? 1 + s.cooking.goldMult : 1
        // 聚宝符（V1.1 道具）：生效期间挂机收益 ×2
        const haste = s.haste?.until > Date.now() ? HASTE_TALISMAN.mult : 1
        return baseGoldRate(s) * (1 + bonus.goldRate / 100) * (1 + bonus.globalRate / 100) * cook * haste * (fest ? 1 + fest.buff : 1)
      },

      gemRate: () => {
        const s = get()
        const bonus = s.jobBonus()
        const fest = activeFestival()
        const cook = s.cooking.until > Date.now() ? 1 + s.cooking.gemMult : 1
        // 聚宝符（V1.1 道具）：生效期间挂机收益 ×2
        const haste = s.haste?.until > Date.now() ? HASTE_TALISMAN.mult : 1
        return baseGemRate(s) * (1 + bonus.gemRate / 100) * (1 + bonus.globalRate / 100) * cook * haste * (fest ? 1 + fest.buff : 1)
      },

      workerLimit: () => {
        const s = get()
        return 2 + s.facilities.guestRoom
      },
    }),
    {
      name: 'yaoguai-inn-save-v1',
      // 存储经 bridge 惰性解析：Web → localStorage，小游戏 → tt.*StorageSync，
      // 未注入时自动落内存兜底（SSR / 单元测试安全）。
      storage: createJSONStorage(() => getStorage()),
      partialize: (state) => {
        const { hasHydrated: _h, pendingOffline: _o, lastRotation: _r, ...rest } = state
        void _h
        void _o
        void _r
        return rest as GameSave
      },
      /** 持久化合并时全量净化：脏存档（null/NaN/缺字段/旧结构）统一回退默认值 */
      merge: (persisted, current) => ({
        ...current,
        ...sanitizeSave(persisted),
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated()
      },
    }
  )
)

/** 妖王夜是否已解锁（累计守店胜利≥3） */
export function bossNightUnlocked(save: GameSave): boolean {
  return save.stats.wins >= BOSS_NIGHT.unlockWins
}

/** 今日是否可领签到奖励 */
export function signInAvailable(save: GameSave): boolean {
  return save.signIn.lastDate !== today()
}

/** 每日任务进度 */
export function taskProgress(save: GameSave, taskId: string): number {
  if (taskId === 'login') return 1
  if (taskId === 'night') return save.daily.events.night ?? 0
  if (taskId === 'capture') return save.daily.events.capture ?? 0
  if (taskId === 'recruit') return save.daily.events.recruit ?? 0
  if (taskId === 'upgrade') return save.daily.events.upgrade ?? 0
  if (taskId === 'starup') return save.daily.events.starup ?? 0
  if (taskId === 'ad') return save.daily.events.ad ?? 0
  return 0
}

/** 成就进度（捕捉/战斗/妖王/经营/养成五线） */
export function achievementProgress(save: GameSave, achievementId: string): number {
  switch (achievementId) {
    case 'capture-1':
      return save.stats.totalCaptures >= 1 ? 1 : 0
    case 'capture-5':
      return save.stats.totalCaptures
    case 'capture-rare':
      return RARE_IDS.some((id) => (save.owned[id]?.count ?? 0) > 0) ? 1 : 0
    case 'capture-all-rare':
      return RARE_IDS.filter((id) => (save.owned[id]?.count ?? 0) > 0).length
    case 'battle-first-win':
      return save.stats.wins >= 1 ? 1 : 0
    case 'battle-10-win':
      return save.stats.wins
    case 'battle-level-3':
      return save.level
    case 'boss-first-win':
      return save.stats.bossWins >= 1 ? 1 : 0
    case 'boss-3-win':
      return save.stats.bossWins
    case 'boss-all-legend':
      return ['baize', 'taotie'].filter((id) => (save.owned[id]?.count ?? 0) > 0).length
    case 'biz-gold-10k':
      return Math.floor(save.stats.totalGold)
    case 'biz-gold-100k':
      return Math.floor(save.stats.totalGold)
    case 'biz-inn-5':
      return save.innLevel
    case 'biz-tujian-6':
      return save.tujian.length
    // ---- 养成线 ----
    case 'growth-level-10':
      return Object.values(save.owned).some((o) => (o.level ?? 1) >= 10) ? 1 : 0
    case 'growth-level-50':
      return Object.values(save.owned).some((o) => (o.level ?? 1) >= 50) ? 1 : 0
    case 'growth-facility-3':
      return Object.values(save.facilities).filter((lv) => lv >= 3).length >= 1 ? 1 : 0
    case 'growth-facility-all3':
      return Object.values(save.facilities).filter((lv) => lv >= 3).length
    // ---- 属性线 ----
    case 'elem-lightdark': {
      const light = Object.entries(save.owned).some(
        ([id, o]) => o.count > 0 && YAOGUAI_MAP[id]?.element === 'light'
      )
      const dark = Object.entries(save.owned).some(
        ([id, o]) => o.count > 0 && YAOGUAI_MAP[id]?.element === 'dark'
      )
      return (light ? 1 : 0) + (dark ? 1 : 0)
    }
    case 'elem-stone-max':
      return Object.values(save.elementBoost ?? {}).some((lv) => lv >= 5) ? 1 : 0
    // ---- 素材线 ----
    case 'mat-cook':
      return save.daily.events.cook ?? 0
    case 'mat-synth':
      return save.daily.events.synth ?? 0
    // ---- 体力轮换线 ----
    case 'stamina-potion':
      return save.daily.events.staminaPotion ?? 0
    case 'stamina-ad':
      return save.daily.events.staminaAd ?? 0
    case 'stamina-squad':
      return Object.keys(save.owned).length
    // ---- 世界地图线（V1.2 区域探索 + 连锁分店） ----
    case 'region2-open':
      return save.region2Opened ? 1 : 0
    case 'region2-win':
      return save.stats.winsRegion2 ?? 0
    case 'region2-level-5':
      return save.region2Level ?? 1
    // ---- 世界地图线·三（V1.3 沸火赤川） ----
    case 'region3-open':
      return save.region3Opened ? 1 : 0
    case 'region3-win':
      return save.stats.winsRegion3 ?? 0
    case 'region3-level-5':
      return save.region3Level ?? 1
    // ---- 采集线（V1.3 山野采集队） ----
    case 'gather-first':
      return (save.stats.gatherTotal ?? 0) >= 1 ? 1 : 0
    case 'gather-100':
      return save.stats.gatherTotal ?? 0
    case 'gather-team':
      return Math.min(5, Object.keys(save.gather?.assignments ?? {}).length)
    // ---- 技能升级线（V1.3 妖丹消耗） ----
    case 'skill-first':
      return Object.values(save.owned).some((o) => (o.skillLevel ?? 1) >= 2) ? 1 : 0
    case 'skill-max':
      return Object.values(save.owned).some((o) => (o.skillLevel ?? 1) >= SKILL_MAX_LEVEL) ? 1 : 0
    // ---- 温泉线（V1.3 温泉汤院） ----
    case 'spring-build':
      return (save.facilities.hotSpring ?? 0) >= 1 ? 1 : 0
    case 'spring-level-3':
      return (save.facilities.hotSpring ?? 0) >= 3 ? 1 : 0
    // ---- 水墨新妖线（V1.3 墨麟/砚灵） ----
    case 'capture-ink':
      return ['molin', 'yanling'].filter((id) => (save.owned[id]?.count ?? 0) > 0).length
    default:
      return 0
  }
}
